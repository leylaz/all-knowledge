/* Section: Front End and Branch Prediction
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "fe"). */

section({
  id: "fe",
  name: "Front End and Branch Prediction",
  cap: "Predicting the path, fetching it, and turning it into micro-ops",
  body: `
<p>The front end decides which instructions the core works on next and delivers them as micro-ops to rename. In a modern core it is mostly a prediction machine: the branch predictor runs ahead of fetch, picking the path many cycles before any branch on it executes, and the instruction cache, decoders, and micro-op cache follow wherever it points.</p>
<p>When the front end falls behind, the back end starves however wide it is; when it predicts wrong, everything fetched after the bad prediction is thrown away. Front-end stalls take a large share of cycles on server workloads with large code footprints, and mispredicts are often the largest single loss on integer code with hard-to-predict branches.</p>
<p>The classic 5-stage pipeline's view of branches is in <a href="#/branch-hazards">Branch Hazards</a>; these pages cover how a wide out-of-order core does it.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core runs at a base CPI of 0.25 (IPC 4). Its workload executes one branch every 5 instructions, the predictor mispredicts 2.5% of branches, and each mispredict costs 17 cycles. What is the CPI with mispredicts, and what share of time do they take?</p>`,
        a: `<ol start="0"><li>Branches per instruction: 1 / 5 = 0.2.</li><li>Mispredicts per instruction: 0.2 × 0.025 = 0.005, which is 5 MPKI.</li><li>Added CPI: 0.005 × 17 = 0.085.</li><li>CPI = 0.25 + 0.085 = <strong>0.335</strong> (IPC about 3.0).</li><li>Share of time: 0.085 / 0.335 ≈ <strong>25%</strong>, from mispredicting one branch in forty.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A team doubles the back end's width (rename, ports, ROB) on a core whose front end delivers at most 6 micro-ops per cycle from the micro-op cache. On a server workload with a large code footprint, IPC barely moves. Why, and what would you measure first?</p>`,
        a: `<p>The front end caps throughput before the back end does. On large-footprint code, the micro-op cache and instruction cache miss often, so delivery drops to the legacy decoders and then to zero during instruction cache and BTB misses; doubling the back end only raises a ceiling the workload never reaches. Measure top-down level 1 first: if front-end-bound slots dominate, split them into latency (instruction cache, ITLB, and BTB misses, redirects) and bandwidth (micro-op cache misses, decoder limits). The fixes are front-end ones: a larger BTB to run further ahead, fetch-directed instruction prefetching, a larger instruction cache or micro-op cache, and code layout (profile-guided optimization, hot/cold splitting).</p>`
      }
    ]
  }
}, [
{
  id: "fe-decoupled",
  region: "fe",
  title: "Decoupled Fetch and the Fetch Target Queue",
  sections: [
    { id: "why", label: "Why Decouple" },
    { id: "ftq", label: "The Fetch Target Queue" },
    { id: "blocks", label: "Fetch Blocks and Taken Branches" },
    { id: "fdip", label: "Fetch-Directed Prefetching" },
    { id: "overriding", label: "Fast and Slow Predictors" }
  ],
  body: `
<p>In the classic pipeline, fetch reads the instruction cache at the PC and the branch predictor is consulted along the way. Modern cores split these apart: the branch predictor runs in its own pipeline and produces a stream of addresses to fetch, and the instruction cache consumes that stream later. This page covers why, and what the queue between them makes possible.</p>

<h3 id="sec-why">Why Decouple</h3>
<p>A coupled front end stalls as a unit: an instruction cache miss stops the predictor, and a slow prediction stops fetch. Decoupling puts a queue between them so each side runs at its own pace:</p>
<ul>
<li><strong>The predictor runs ahead.</strong> While the instruction cache waits on a miss, the predictor keeps predicting the following blocks, so their addresses are known before fetch needs them.</li>
<li><strong>Bubbles are absorbed.</strong> A cycle where the predictor needs extra time (a second-level BTB lookup) costs nothing if the queue has work for fetch.</li>
<li><strong>The predictor no longer needs the instruction bytes.</strong> It predicts from addresses and history alone, which is why it must find branches through the BTB rather than by decoding them (see Branch Targets, later in this section).</li>
</ul>
<p>Reinman, Calder, and Austin proposed this organization in 1999; essentially every high-performance core since uses it (AMD since Zen, Intel's big cores, Arm's Cortex-X and Neoverse V lines, Apple's cores).</p>

<h3 id="sec-ftq">The Fetch Target Queue</h3>
<p>The <strong>fetch target queue (FTQ)</strong> holds predicted fetch blocks: a start address, an end (the predicted-taken branch or the end of a fetch window), and the predicted next address. Each entry also keeps what is needed to repair the predictor on a mispredict: the global history at prediction time and which table entries made the prediction.</p>
<p>The occupancy of the FTQ is how far ahead the predictor is. On a mispredict, the queue is flushed along with everything younger than the branch, and the predictor restarts from the correct target with its history repaired.</p>

<h3 id="sec-blocks">Fetch Blocks and Taken Branches</h3>
<p>Fetch reads one aligned window per cycle (32 bytes on recent x86 cores) and stops at the first predicted-taken branch, because the next bytes come from somewhere else. That gives two front-end limits that show up in tight loops and branchy code:</p>
<ul>
<li><strong>Taken branches per cycle.</strong> Most cores follow one taken branch per cycle; AMD's Zen 5 can follow two. A loop body with a taken branch every 3 instructions can't fetch more than 3 instructions per cycle on a one-taken core, however wide the decoders are.</li>
<li><strong>Taken-branch bubbles.</strong> Following a taken branch with no lost cycle needs the target in the same cycle the branch is found. Small, fast BTBs (an L0 or L1 BTB) give zero-bubble redirects; a target found in a larger second-level BTB costs one or more bubble cycles.</li>
</ul>
<p>The fetch-block rounding also matters: a loop whose 40 bytes straddle two 32-byte windows takes 2 fetch cycles, and one that starts near the end of a window can need 3. Aligning hot loop heads is a classic compiler fix.</p>

<h3 id="sec-fdip">Fetch-Directed Instruction Prefetching</h3>
<p>Since the FTQ holds addresses the core will fetch soon, it doubles as a list of instruction cache lines to prefetch. <strong>Fetch-directed instruction prefetching (FDIP)</strong> walks the FTQ ahead of fetch, checks each line in the instruction cache, and requests the ones that miss. Its reach is limited by how far ahead the predictor runs, and that is limited by the BTB: an unknown branch can't be predicted taken, so the predictor falls through and the run-ahead path goes wrong. This is why server cores carry very large BTBs (many thousands of entries) and why research proposals such as Shotgun and Boomerang focus on filling the BTB ahead of time.</p>

<h3 id="sec-overriding">Fast and Slow Predictors</h3>
<p>The most accurate predictors (TAGE and its relatives) need several cycles to read their tables and combine results. Waiting for them every cycle would add bubbles to every taken branch. Cores pair them instead:</p>
<ol start="0">
<li>A small, single-cycle predictor (a micro-BTB with simple direction bits) makes a prediction immediately, and fetch follows it.</li>
<li>A cycle or two later, the large predictor finishes. If it agrees, nothing happens. If it disagrees, it <strong>overrides</strong>: the few blocks fetched on the fast prediction are flushed and fetch redirects, costing a short bubble instead of a full mispredict.</li>
</ol>
<p>Jiménez, Keckler, and Lin analyzed this "overriding" arrangement in 2000. The performance model has to include it: an override is a front-end bubble of a few cycles, distinct from a full back-end mispredict.</p>
<p class="refs">References: Reinman, Calder, and Austin, "Fetch Directed Instruction Prefetching," MICRO 1999 · Jiménez, Keckler, and Lin, "The Impact of Delay on the Design of Branch Predictors," MICRO 2000 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A hot loop is 7 instructions totaling 26 bytes, ending in a taken branch back to the top. The core fetches one aligned 32-byte window per cycle, follows one taken branch per cycle, and has 6-wide decode. The loop starts at an address ending in 0x1C. How many cycles per iteration does fetch need, and what changes if the loop is aligned to 32 bytes?</p>`,
        a: `<ol start="0"><li>The loop occupies bytes 0x1C to 0x1C + 26 − 1 = 0x35, so it crosses the boundary at 0x20.</li><li>The first window (0x00 to 0x1F) gives 4 bytes of the loop; the second (0x20 to 0x3F) gives the rest and ends at the taken branch.</li><li>Fetch needs <strong>2 cycles per iteration</strong>, so at most 7 / 2 = 3.5 instructions per cycle.</li><li>Aligned to 32 bytes, all 26 bytes fit in one window: <strong>1 cycle per iteration</strong>. Now decode (6 wide) or the one-taken-branch-per-cycle limit binds: 7 instructions need 2 decode cycles, so about 3.5 per cycle either way, unless the micro-op cache or loop buffer delivers the whole loop at once.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your model has a fast single-cycle predictor overridden two cycles later by a TAGE predictor. Profiling shows 8 overrides and 3 full mispredicts per thousand instructions on a 6-wide core with a 17-cycle mispredict penalty. Which costs more, and what would you change in the model to get these costs right?</p>`,
        a: `<p>Overrides: 8 × 2 = 16 lost fetch cycles per thousand instructions, but some are hidden if the queues in front of rename hold enough work. Mispredicts: 3 × 17 = 51 cycles, and nothing hides them. So mispredicts cost more than three times as much, but overrides aren't free: at 16 cycles per thousand instructions on a core averaging about 250 cycles per thousand, they can be several percent.</p><p>In the model: count overrides separately from mispredicts; make the override flush only the blocks fetched after the fast prediction (not the back end); charge the bubble at fetch so the fetch and decode queues can absorb it; and check that the fast predictor's accuracy, not just TAGE's, matches the design, since the override rate depends on how often they disagree.</p>`
      }
    ]
  }
}
]);
