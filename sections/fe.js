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
<li><strong>The predictor no longer needs the instruction bytes.</strong> It predicts from addresses and history alone, which is why it must find branches through the BTB rather than by decoding them (see <a href="#/fe-targets">Branch Targets</a>).</li>
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
        a: `<p>Overrides: 8 × 2 = 16 lost fetch cycles per thousand instructions, but some are hidden if the queues in front of rename hold enough work. Mispredicts: 3 × 17 = 51 cycles, and nothing hides them. So mispredicts cost more than three times as much, but overrides aren't free: at 16 cycles per thousand instructions on a core averaging about 250 cycles per thousand, they can be several percent.</p><p>In the model:</p><ul><li>Count overrides separately from mispredicts</li><li>Make the override flush only the blocks fetched after the fast prediction (not the back end)</li><li>Charge the bubble at fetch so the fetch and decode queues can absorb it</li><li>Check that the fast predictor's accuracy, not just TAGE's, matches the design, since the override rate depends on how often they disagree</li></ul>`
      }
    ]
  }
},

{
  id: "fe-direction",
  region: "fe",
  title: "Branch Direction Predictors",
  sections: [
    { id: "counters", label: "Counters and Bimodal Tables" },
    { id: "history", label: "Global History and gshare" },
    { id: "perceptron", label: "Perceptron Predictors" },
    { id: "tage", label: "TAGE" },
    { id: "extras", label: "Loop and Statistical Correctors" },
    { id: "update", label: "Speculative History and Repair" },
    { id: "model", label: "Modeling a Predictor" }
  ],
  body: `
<p>A direction predictor answers one question per conditional branch: taken or not taken. Every design since the 1980s is built from the same pieces: small saturating counters, tables indexed by the branch address and by history, and a rule for which table to trust. This page goes from the simplest table to TAGE, the basis of most high-end predictors today.</p>

<h3 id="sec-counters">Counters and Bimodal Tables</h3>
<p>A <strong>2-bit saturating counter</strong> counts up when the branch is taken and down when it isn't, between 0 and 3; it predicts taken at 2 or 3. It needs two wrong outcomes in a row to flip, so a loop branch that is taken many times and falls through once mispredicts only at the exit, not again at re-entry.</p>
<p>A <strong>bimodal</strong> predictor is a table of these counters indexed by low bits of the branch PC. It learns each branch's bias and nothing else. Two branches that share an entry <em>alias</em>; when their biases differ, they fight. A 16K-entry table of 2-bit counters is 4 KB.</p>

<h3 id="sec-history">Global History and gshare</h3>
<p>Many branches are predictable only from what happened before them: <code>if (x &gt; 0)</code> followed by <code>if (x &gt; 5)</code> is correlated. A <strong>global history register</strong> records the outcomes of the last h branches as h bits. <strong>gshare</strong> (McFarling, 1993) indexes the counter table with PC XOR history, so the same branch gets a different counter for each recent path.</p>
<p>The trade-off is the history length. Short histories train fast but miss long-range correlation; long histories capture it but spread each branch over many entries (more aliasing, slower training). A single table forces one choice, which is the problem the next two designs solve.</p>
<p>Tournament predictors (the Alpha 21264's, for example) ran a local-history and a global-history predictor side by side and used a third table of counters to choose between them per branch.</p>

<h3 id="sec-perceptron">Perceptron Predictors</h3>
<p>A perceptron predictor (Jiménez and Lin, 2001) keeps a small vector of signed weights per branch, one per history bit. The prediction is the sign of the dot product of the weights with the history (taken = +1, not taken = −1), plus a bias weight. Training adds or subtracts 1 from each weight when the prediction was wrong or the sum was below a threshold.</p>
<ul>
<li><strong>Strength:</strong> storage grows linearly with history length, not exponentially, so it can use long histories; it learns which history bits matter.</li>
<li><strong>Weakness:</strong> it can only learn linearly separable functions of the history (an XOR of two earlier outcomes defeats it), and the adder tree adds latency.</li>
</ul>
<p><strong>Hashed perceptrons</strong> index several weight tables with hashes of different history segments and sum the selected weights. AMD has described its Zen predictors as perceptron-based.</p>

<h3 id="sec-tage">TAGE</h3>
<p><strong>TAGE</strong> (TAgged GEometric history length, Seznec and Michaud, 2006) uses many history lengths at once and picks the longest one that has seen this situation before.</p>
<ul>
<li><strong>Tables:</strong> a bimodal base table T<sub>0</sub>, plus tagged tables T<sub>1</sub> … T<sub>N</sub>. Table T<sub>i</sub> is indexed and tagged with a hash of the PC and the most recent L(i) history bits.</li>
<li><strong>Geometric lengths:</strong> L(i) = L(1) × α<sup>i−1</sup>, so a dozen tables can cover histories from a few branches to several hundred.</li>
<li><strong>Entries:</strong> a 3-bit prediction counter, a partial tag (8 to 12 bits), and a "useful" bit or counter.</li>
<li><strong>Prediction:</strong> the matching table with the longest history is the <em>provider</em>; the next-longest match is the <em>alternate</em>. Use the provider's counter, except when the provider entry is newly allocated and weak, where the alternate is often more reliable.</li>
<li><strong>Update:</strong> train the provider's counter. On a mispredict, allocate an entry in a table with longer history than the provider, choosing one whose useful bit is clear. Useful bits are set when the provider was right and the alternate was wrong, and are decayed periodically so stale entries can be replaced.</li>
</ul>
<p>Why it works: most branches are captured by short histories and never consume long-history entries; only the hard ones climb to longer tables. The partial tags cut aliasing, which is what makes long histories usable.</p>

<h3 id="sec-extras">Loop Predictors and Statistical Correctors</h3>
<p>TAGE handles most patterns but has blind spots, so championship predictors add small side predictors:</p>
<ul>
<li><strong>Loop predictor:</strong> learns a branch's exact trip count (taken 63 times, then not taken) and overrides TAGE when confident. Long trip counts would otherwise need history longer than any table.</li>
<li><strong>Statistical corrector (SC):</strong> a perceptron-like adder over several tables that catches branches with a statistical bias TAGE predicts poorly, and reverts TAGE's prediction when it disagrees strongly.</li>
</ul>
<p>The combination, <strong>TAGE-SC-L</strong>, won the 2014 and 2016 Championship Branch Prediction contests, and descendants of it are in many shipping cores. Intel and Apple don't publish their predictor designs.</p>

<h3 id="sec-update">Speculative History and Repair</h3>
<p>The predictor runs far ahead of execution, so the global history must be updated with <em>predicted</em> outcomes; waiting for real outcomes would leave it many branches stale. On a mispredict, the history must be restored to its value at the branch and the correct outcome shifted in. Cores keep a checkpoint of the history pointer per in-flight branch (the history itself is a circular buffer, so a pointer is enough).</p>
<p>Counter and table updates, by contrast, usually happen at retire or at branch resolution, with the indices saved at prediction time. Updating counters speculatively helps a little on tight loops but risks training on wrong-path branches.</p>

<h3 id="sec-model">Modeling a Predictor</h3>
<ul>
<li><strong>Measure MPKI, not accuracy.</strong> 97% accuracy can be 3 MPKI or 15 MPKI depending on how many branches the code has; MPKI is what multiplies the penalty.</li>
<li><strong>Use the update timing of the real design.</strong> A trace-driven predictor study that updates instantly after each branch overstates accuracy on tight loops, where several instances of the same branch are in flight before the first resolves.</li>
<li><strong>Count storage honestly.</strong> Championship predictors are compared at a fixed budget (64 KB in recent contests), including tags and useful bits.</li>
<li><strong>Remember latency.</strong> A predictor that needs 3 cycles is paired with a fast one, and its overrides cost bubbles (see <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>).</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 (correlating and tournament predictors, and the tagged hybrid predictors section) · McFarling, "Combining Branch Predictors," DEC WRL TN-36, 1993 · Jiménez and Lin, "Dynamic Branch Prediction with Perceptrons," HPCA 2001 · Seznec and Michaud, "A Case for (Partially) TAgged GEometric History Length Branch Prediction," JILP 2006 · Seznec, "TAGE-SC-L Branch Predictors," CBP-4, 2014</p>`,
  practice: {
    guided: [
      {
        q: `<p>A TAGE predictor has 12 tagged tables with history lengths from 4 to 640 branches, spaced geometrically. Find α and the 12 lengths, rounded to whole branches.</p>`,
        a: `<ol start="0"><li>L(12) = L(1) × α<sup>11</sup>, so α = (640 / 4)<sup>1/11</sup> = 160<sup>1/11</sup>.</li><li>ln 160 ≈ 5.075, divided by 11 ≈ 0.461, so α ≈ e<sup>0.461</sup> ≈ <strong>1.586</strong>.</li><li>Lengths: 4, 6, 10, 16, 25, 40, 64, 101, 160, 254, 403, 640.</li><li>Half the tables cover histories up to 40 branches, where most correlation lives; the rest reach far back for the rare branches that need it, at no more storage per table.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A branch is taken when exactly one of two earlier branches (12 and 30 branches back) was taken. Which predictors can learn it: bimodal, gshare with 16 history bits, a perceptron with 64 history bits, TAGE with lengths up to 640?</p>`,
        a: `<p><strong>Bimodal:</strong> no; it sees only the PC, and the branch is 50/50 overall. <strong>gshare with 16 bits:</strong> no; the outcome 30 branches back isn't in its history. <strong>Perceptron:</strong> no, even though both bits are in its history: the outcome is the XOR of two history bits, which isn't linearly separable, so no weight vector predicts it. <strong>TAGE:</strong> yes, in a table with history of at least 30 branches. Each distinct history pattern gets its own tagged entry and counter, so it can learn any function of the history, at the cost of an entry per pattern that actually occurs. If the 18 branches in between vary a lot, the number of distinct patterns explodes and TAGE also struggles; in practice, combining TAGE with a perceptron-style corrector covers both cases.</p>`
      }
    ]
  }
},

{
  id: "fe-targets",
  region: "fe",
  title: "Branch Targets: BTB, Indirect Branches, and Returns",
  sections: [
    { id: "btb", label: "The BTB" },
    { id: "misses", label: "BTB Misses and Decode Redirects" },
    { id: "indirect", label: "Indirect Branches" },
    { id: "ras", label: "The Return Address Stack" },
    { id: "footprint", label: "Large Code Footprints" }
  ],
  body: `
<p>Knowing a branch is taken is useless without knowing where it goes, and a decoupled predictor has to know both before the instruction bytes are even fetched. Three structures supply targets: the branch target buffer for most branches, an indirect predictor for branches whose target varies, and the return address stack for returns.</p>

<h3 id="sec-btb">The BTB</h3>
<p>The <strong>branch target buffer</strong> is a cache indexed by fetch address. A hit says "there is a branch at this offset in the block," gives its type (conditional, unconditional, call, return, indirect), and its last target. In a decoupled front end, the BTB is how the predictor finds branches at all: a branch missing from the BTB is invisible, and the predictor carries on sequentially as if it weren't there.</p>
<p>Like caches, BTBs come in levels. A small, fast level gives zero-bubble taken branches; a larger level behind it covers more code at a cycle or more of bubble per taken branch. AMD's Zen 4, for example, has a 1.5K-entry first-level BTB and a 7K-entry second level; Intel's Golden Cove has 12K entries in total. Entries store compressed targets (only the low bits that differ from the branch address for short branches) to fit more of them.</p>

<h3 id="sec-misses">BTB Misses and Decode Redirects</h3>
<p>What happens when a branch isn't in the BTB depends on its kind:</p>
<div class="tbl"><table>
<tr><th>Branch</th><th>On a BTB miss</th><th>Cost</th></tr>
<tr><td>Conditional, actually not taken</td><td>Fall-through was right by luck</td><td>None (but nothing trains until it's inserted)</td></tr>
<tr><td>Conditional, actually taken</td><td>Fetch falls through. Decode can redirect if it applies a static guess (backward branches taken); otherwise the branch mispredicts when it executes</td><td>A decode redirect or a full mispredict</td></tr>
<tr><td>Unconditional direct jump or call</td><td>Decode sees the branch, computes the target from the instruction, and redirects fetch</td><td>A <strong>decode redirect</strong>: the front-end depth up to decode, several cycles</td></tr>
<tr><td>Return</td><td>Decode recognizes it and uses the return stack</td><td>Decode redirect</td></tr>
<tr><td>Indirect</td><td>No target until it executes</td><td>A full mispredict</td></tr>
</table></div>
<p>Decode redirects are cheaper than mispredicts because nothing past decode was fetched on the wrong path, but they are frequent on large code and they also stop the predictor from running ahead, which breaks <a href="#/fe-decoupled/fdip">fetch-directed prefetching</a>.</p>

<h3 id="sec-indirect">Indirect Branches</h3>
<p>An indirect branch jumps to an address in a register: virtual calls, function pointers, <code>switch</code> statements compiled to jump tables, and interpreter dispatch. A BTB entry holds one target, so it predicts the last target seen. That's fine for a virtual call that almost always reaches the same class, and poor for an interpreter's dispatch jump, which goes to a different handler for every bytecode.</p>
<p>Indirect predictors index target tables with global path history, so the same branch can predict different targets on different paths. <strong>ITTAGE</strong> (Seznec, 2011) applies the TAGE idea to targets: tagged tables with geometric history lengths, each entry storing a target instead of a counter. Intel has used history-based indirect prediction since Haswell, which made switch-based interpreters far more predictable than they used to be.</p>

<h3 id="sec-ras">The Return Address Stack</h3>
<p>Returns are indirect branches with a perfect predictor available: the address after the matching call. The <strong>return address stack (RAS)</strong> pushes that address on every predicted call and pops it on every predicted return. 16 to 32 entries per thread is typical.</p>
<ul>
<li><strong>Overflow:</strong> the stack is circular, so deep call chains overwrite the oldest entries, and the returns that reach them mispredict.</li>
<li><strong>Wrong-path corruption:</strong> calls and returns on a mispredicted path push and pop entries. Cores checkpoint the top-of-stack pointer (and often the top entry) per branch and restore them on a mispredict, which repairs almost all of the damage (Skadron et al., 1998).</li>
<li><strong>Non-standard returns:</strong> code that returns somewhere other than its caller (longjmp, some coroutine and exception schemes, return-oriented tricks) mispredicts every time.</li>
</ul>

<h3 id="sec-footprint">Large Code Footprints</h3>
<p>Datacenter workloads (databases, web servers, JIT-compiled code) execute megabytes of hot code, with many thousands of distinct taken branches. Their BTB miss rates stay high even with 12K entries, so they lose cycles to decode redirects, instruction cache misses that prefetching didn't hide, and lost predictor run-ahead. The fixes:</p>
<ul>
<li><strong>Hardware:</strong> larger and multi-level BTBs, BTB entries that cover a whole fetch region with several branches, and BTB prefetching driven by instruction cache fills.</li>
<li><strong>Software:</strong> profile-guided layout (BOLT, AutoFDO) that packs hot code together and straightens hot paths so fewer branches are taken; huge pages for code to cut ITLB misses.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 (branch-target buffers and return address predictors) · Seznec, "A 64-Kbytes ITTAGE Indirect Branch Predictor," CBP-3, 2011 · Skadron, Ahuja, Martonosi, and Clark, "Improving Prediction for Procedure Returns with Return-Address-Stack Repair Mechanisms," MICRO 1998 · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>A bytecode interpreter dispatches with a <code>switch</code> compiled to one indirect jump. Each bytecode takes about 15 instructions including the dispatch. With last-target prediction, the dispatch jump mispredicts 60% of the time; with a history-based indirect predictor, 10%. The mispredict penalty is 17 cycles. What CPI does each add?</p>`,
        a: `<ol start="0"><li>Dispatches per instruction: 1 / 15 ≈ 0.0667.</li><li>Last-target: 0.0667 × 0.6 × 17 ≈ <strong>0.68 CPI</strong>, more than the whole base CPI of a wide core.</li><li>History-based: 0.0667 × 0.1 × 17 ≈ <strong>0.11 CPI</strong>.</li><li>The history works because the next bytecode is correlated with the previous few, which is exactly what the path history captures. Threaded dispatch (a separate jump at the end of each handler) helps the same way on last-target predictors, by giving each handler its own BTB entry.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A recursive function reaches depth 100 on a core with a 32-entry circular return stack. How many return mispredicts happen while it unwinds? Does the answer change for a tree traversal that recurses from two call sites?</p>`,
        a: `<p>With one recursive call site, every recursive call pushes the same return address, so the 100 pushes leave all 32 entries holding that address. The first 99 returns all go back to that call site, and every entry they pop, including the wrapped-around ones, holds the right address: they all predict correctly. Only the last return, to the original caller, finds an overwritten entry and mispredicts: <strong>about 1</strong>.</p><p>With two call sites (left and right child), the overwritten entries hold whichever site pushed last, so once the unwind passes the 32 newest entries, each return is right only when its call site happens to match: if the two sites are equally likely, about half of the remaining 68 returns mispredict, roughly 34. Deep recursion from several call sites is one of the few places return mispredicts show up in profiles.</p>`
      }
    ]
  }
},

{
  id: "fe-decode",
  region: "fe",
  title: "Decoders and the Micro-op Cache",
  sections: [
    { id: "decode", label: "What Decode Does" },
    { id: "x86", label: "Variable-Length Decode on x86" },
    { id: "uop-cache", label: "The Micro-op Cache" },
    { id: "fusion", label: "Fusion and Cracking" },
    { id: "arm", label: "Fixed-Length ISAs" },
    { id: "model", label: "Modeling Decode" }
  ],
  body: `
<p>Decode turns instruction bytes into the micro-ops the back end schedules. On a fixed-length ISA it's simple and wide; on x86 it's one of the hardest parts of the core, which is why x86 cores cache decoded micro-ops and bypass the decoders whenever they can.</p>

<h3 id="sec-decode">What Decode Does</h3>
<ul>
<li><strong>Find instruction boundaries</strong> in the fetched bytes (trivial for fixed-length encodings).</li>
<li><strong>Translate</strong> each instruction into one or more micro-ops: opcode, source and destination registers, immediate, and the port class it needs.</li>
<li><strong>Detect branches</strong> the predictor didn't know about and redirect fetch (see <a href="#/fe-targets/misses">BTB misses and decode redirects</a>).</li>
<li><strong>Handle complex instructions</strong> by sending them to a microcode sequencer that emits a longer micro-op sequence from a ROM.</li>
</ul>

<h3 id="sec-x86">Variable-Length Decode on x86</h3>
<p>x86 instructions are 1 to 15 bytes, and the length depends on prefixes, the opcode, the ModRM and SIB bytes, and the immediate size. Finding where instruction <em>n</em> + 1 starts requires knowing the length of instruction <em>n</em>, so decoding several instructions per cycle needs either a serial chain of length decoders or speculative decoding at every byte offset. Cores combine two tricks:</p>
<ul>
<li><strong>Predecode bits:</strong> when a line is filled into the instruction cache, it is scanned once and start-of-instruction bits are stored alongside it, so later fetches find boundaries immediately.</li>
<li><strong>Asymmetric decoders:</strong> a few simple decoders handle instructions that produce one micro-op, and one complex decoder handles those that produce several; anything longer goes to microcode. Intel's Golden Cove has 6 decoders fed by 32 bytes per cycle.</li>
</ul>
<p>Some encodings defeat the shortcuts. A <strong>length-changing prefix</strong> (the 0x66 operand-size prefix on an instruction with a 16-bit immediate) changes how long the instruction is after the predecoder has guessed, and Intel cores stall decode for a few cycles each time one appears.</p>

<h3 id="sec-uop-cache">The Micro-op Cache</h3>
<p>The <strong>micro-op cache</strong> (Intel's decoded stream buffer, AMD's op cache) stores the micro-ops for recently decoded code, indexed by instruction address. When fetch hits in it, the decoders are skipped entirely:</p>
<ul>
<li><strong>More bandwidth:</strong> Golden Cove delivers 8 micro-ops per cycle from its 4K-entry micro-op cache versus 6 from the decoders; Zen 4 delivers 9 from a 6.75K-entry op cache versus 4 instructions from its decoders.</li>
<li><strong>Fewer hazards:</strong> length decoding, prefix penalties, and decoder asymmetry don't apply on a hit.</li>
<li><strong>Less power:</strong> the decoders are among the most power-hungry parts of an x86 front end, and they idle on hits.</li>
<li><strong>A shorter pipeline:</strong> skipping decode stages shortens the mispredict refill path when the correct target is in the micro-op cache.</li>
</ul>
<p>The cost: it's organized by code region (Intel's maps 32- or 64-byte code windows to a few ways of micro-op lines), so some code shapes fit poorly (many micro-ops in one window, long immediates that take two slots), and switching between it and the legacy decoders costs a cycle or more. Microcoded instructions are typically stored as a pointer into the microcode ROM rather than as micro-ops.</p>
<p>A smaller relative is the <strong>loop buffer</strong> (Intel's loop stream detector): a short queue after decode that replays a small loop's micro-ops without fetching or decoding them again.</p>

<h3 id="sec-fusion">Fusion and Cracking</h3>
<p>Decode is where the micro-op count is decided, and the count is what rename width is measured in:</p>
<ul>
<li><strong>Macro-fusion:</strong> a compare or test followed by a conditional branch becomes one micro-op (x86 cores; some Arm cores fuse similar pairs).</li>
<li><strong>Micro-fusion:</strong> a load combined with an ALU operation (<code>add rax, [rbx]</code>) travels as one micro-op through rename and retire but issues as two to the ports.</li>
<li><strong>Cracking:</strong> a read-modify-write to memory (<code>add [rbx], rax</code>) becomes a load, an add, and a store address and store data pair.</li>
</ul>
<p>That is why a performance model must count fused micro-ops for rename and retire bounds and unfused ones for port bounds (see <a href="#/perf-bounds/be-bounds">Back-End Bounds</a>).</p>

<h3 id="sec-arm">Fixed-Length ISAs</h3>
<p>With every AArch64 instruction 4 bytes long, boundaries are known in advance, so wide decode is cheap: Apple's Firestorm cores decode 8 instructions per cycle with no micro-op cache. Arm went further on its own cores: when the Cortex-A715 dropped 32-bit (AArch32) support, Arm removed its macro-op cache and widened the decoders instead, because decode had become cheap enough that the cache no longer paid for its area and power. RISC-V's compressed extension brings back 2-byte instructions, so wide RISC-V decoders need some of the same boundary-finding logic as x86, though only for two lengths.</p>

<h3 id="sec-model">Modeling Decode</h3>
<ul>
<li>Model the micro-op cache as a real cache with the design's indexing and capacity rules, not a hit rate, because its misses cluster on exactly the large-footprint code where the front end matters.</li>
<li>Model the switch penalty between the micro-op cache and legacy decode; code that bounces between them loses more than either path alone.</li>
<li>Track micro-ops per instruction by instruction class (fusion, cracking, microcode), since it changes every downstream width limit.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> (decoded ICache, length-changing prefixes, macro-fusion) · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em> (op cache) · Arm, Cortex-A715 announcement (2022)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A hot loop on a Golden Cove-like core has 24 instructions averaging 5 bytes, which become 30 fused micro-ops. Rename is 6 wide. Compare cycles per iteration from the micro-op cache (8 micro-ops per cycle) and from the legacy path (32 bytes fetched and 6 instructions or 6 micro-ops decoded per cycle).</p>`,
        a: `<ol start="0"><li>Micro-op cache: 30 / 8 = 3.75 cycles.</li><li>Legacy path: fetch 24 × 5 = 120 bytes / 32 = 3.75 → 4 cycles; decoders 24 instructions / 6 = 4 cycles, but they deliver at most 6 micro-ops per cycle, so 30 / 6 = 5 cycles.</li><li>Rename: 30 / 6 = <strong>5 cycles</strong> either way.</li><li>So throughput is the same, 5 cycles per iteration, because rename binds. The micro-op cache still helps: it saves decode power, avoids prefix and length-decode stalls, and refills faster after a mispredict. It raises throughput only when the legacy path is the narrowest stage.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>On an Intel core, adding one unrelated instruction elsewhere in a function makes a hot loop 2.5× slower. The loop uses 16-bit arithmetic with immediates (<code>add ax, 0x1234</code>). What's the likely mechanism, and how would you confirm and fix it?</p>`,
        a: `<p>The loop probably moved: the new instruction shifted its alignment so it no longer fits the micro-op cache's per-window limits (or now straddles windows it can't hold), and it runs from the legacy decoders. There, every 16-bit-immediate instruction carries a length-changing prefix, and each one stalls predecode for a few cycles, so a loop full of them slows down several-fold. Confirm with counters: micro-ops delivered from the decoded cache versus the legacy decoders (Intel's <code>IDQ.DSB_UOPS</code> and <code>IDQ.MITE_UOPS</code>) and the length-changing-prefix stall counter (<code>ILD_STALL.LCP</code>). Fixes: use 32-bit operations and registers (no 0x66 prefix), load the constant into a register first, or align the loop (<code>-falign-loops</code>) so it stays in the micro-op cache.</p>`
      }
    ]
  }
}
]);
