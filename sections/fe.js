/* Section: Front End and Branch Prediction
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "fe"). */

section({
  id: "fe",
  name: "Front End and Branch Prediction",
  cap: "Predicting the path, fetching it, and turning it into micro-ops",
  body: `
<p>The front end decides which instructions the core works on next and delivers them as micro-ops to rename. In a modern core it is mostly a prediction machine: the branch predictor runs ahead of fetch, picking the path many cycles before any branch on it executes, and the instruction cache, decoders, and micro-op cache follow wherever it points.</p>
<p>The units of a decoupled front end, laid out the way AMD's Zen 5 arranges them (after Chips and Cheese's diagram). The branch predictor writes predicted fetch windows into the fetch queue and looks them up in the op cache, up to two windows per cycle. Op cache hits go straight to the macro-op queue (macro-ops are AMD's term for micro-ops). Misses fetch from the instruction cache, which feeds two decode clusters, one per predicted window, and the decoded macro-ops fill the op cache on their way to the macro-op queue. Not drawn: the fetch-directed prefetcher and the redirects from decode and the back end.</p>
<div class="tbl"><svg viewBox="0 0 680 480" role="img" aria-label="Block diagram of the AMD Zen 5 front end. The branch predictor holds a 16K-entry L1 BTB, an 8K-entry L2 BTB, an indirect target array, and a 52-entry return stack. It sends predicted fetch windows to the fetch queue and, two ranges per cycle, to the op cache (6K entries, 16-way). Op cache misses go to the fetch queue, which reads the ITLB (64 entries L1, 2048 entries L2) and the 32 KB 8-way L1 instruction cache. The instruction cache exchanges 64 bytes per cycle with the L2 cache. Two 32-byte-per-cycle paths leave the instruction cache, each into its own instruction queue, which sends 4 instructions per cycle into a 4-wide decode cluster. Decode clusters 0 and 1 share the microcode unit between them. Each cluster sends 4 macro-ops per cycle to the macro-op queue and also fills the op cache. The op cache sends 12 macro-ops per cycle (two 6-wide paths) to the macro-op queue, which sends 8 macro-ops per cycle to rename." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrFE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrFEt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<text x="10" y="24" style="fill:var(--muted);font-size:12px;font-weight:600">AMD Zen 5</text>
<rect x="10" y="40" width="160" height="188" rx="5" style="fill:none;stroke:var(--pad);stroke-width:1.5;stroke-dasharray:5 4"/>
<text x="22" y="58" style="fill:var(--pad);font-size:12px;font-weight:600">Branch predictor</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5">
<rect x="22" y="66" width="136" height="32" rx="3"/><rect x="22" y="106" width="136" height="32" rx="3"/>
<rect x="22" y="146" width="136" height="32" rx="3"/><rect x="22" y="186" width="136" height="32" rx="3"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="196" y="70" width="80" height="52" rx="3"/>
<rect x="276" y="70" width="100" height="52" rx="3"/>
<rect x="376" y="70" width="294" height="52" rx="3"/>
<rect x="335" y="170" width="120" height="36" rx="3"/>
<rect x="545" y="170" width="120" height="36" rx="3"/>
<rect x="330" y="244" width="130" height="56" rx="3"/>
<rect x="466" y="244" width="68" height="56" rx="3"/>
<rect x="540" y="244" width="130" height="56" rx="3"/>
<rect x="50" y="280" width="140" height="46" rx="3"/>
<rect x="330" y="384" width="340" height="36" rx="3"/>
</g>
<g style="fill:none;stroke:var(--trace);stroke-width:1">
<rect x="337" y="266" width="116" height="26" rx="2"/><rect x="547" y="266" width="116" height="26" rx="2"/>
<path d="M366,266 V292 M395,266 V292 M424,266 V292 M576,266 V292 M605,266 V292 M634,266 V292"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="470" y="6" width="130" height="30" rx="3"/>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="90" y="80">L1 BTB</text><text x="90" y="120">L2 BTB</text>
<text x="90" y="166">Indirect target array</text><text x="90" y="200">Return stack</text>
<text x="535" y="25">L2 cache</text>
<text x="236" y="100">Fetch queue</text>
<text x="326" y="92">ITLB</text>
<text x="523" y="92">L1 instruction cache</text>
<text x="395" y="192">Instruction queue</text><text x="605" y="192">Instruction queue</text>
<text x="395" y="259">Decode cluster 0</text><text x="605" y="259">Decode cluster 1</text>
<text x="500" y="276" style="font-size:11px">Microcode</text>
<text x="120" y="300">Op cache</text>
<text x="500" y="406">Macro-op queue</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="90" y="92">16K entries</text><text x="90" y="132">8K entries</text>
<text x="90" y="212">52 entries</text>
<text x="326" y="108">64 L1, 2048 L2</text>
<text x="523" y="108">32 KB, 8-way</text>
<text x="120" y="316">6K entries, 16-way</text>
<text x="351.5" y="283">D0</text><text x="380.5" y="283">D1</text><text x="409.5" y="283">D2</text><text x="438.5" y="283">D3</text>
<text x="561.5" y="283">D0</text><text x="590.5" y="283">D1</text><text x="619.5" y="283">D2</text><text x="648.5" y="283">D3</text>
<text x="200" y="396">12 macro-ops (2 × 6 wide)</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="end">
<text x="387" y="150">32 B/cycle</text><text x="597" y="150">32 B/cycle</text>
<text x="387" y="228">4 instructions</text><text x="597" y="228">4 instructions</text>
<text x="387" y="326">4 macro-ops</text><text x="597" y="326">4 macro-ops</text>
<text x="92" y="250">2 ranges</text><text x="92" y="264">per cycle</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="545" y="58">64 B/cycle</text>
<text x="186" y="214">miss</text>
<text x="270" y="342">fill</text>
<text x="510" y="440">8 macro-ops to rename</text>
</g>
<g style="fill:none;stroke:var(--trace);stroke-width:2">
<path d="M170,96 H192" marker-end="url(#arrFEt)"/>
<path d="M100,228 V276" marker-end="url(#arrFEt)"/>
<path d="M395,122 V166" marker-end="url(#arrFEt)"/>
<path d="M605,122 V166" marker-end="url(#arrFEt)"/>
<path d="M395,206 V240" marker-end="url(#arrFEt)"/>
<path d="M605,206 V240" marker-end="url(#arrFEt)"/>
<path d="M395,300 V380" marker-end="url(#arrFEt)"/>
<path d="M605,300 V380" marker-end="url(#arrFEt)"/>
<path d="M80,326 V402 H326" marker-end="url(#arrFEt)"/>
<path d="M500,420 V452" marker-end="url(#arrFEt)"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M535,40 V66" marker-start="url(#arrFE)" marker-end="url(#arrFE)"/>
<path d="M180,280 V160 H236 V126" stroke-dasharray="4 3" marker-end="url(#arrFE)"/>
<path d="M395,346 H160 V330" stroke-dasharray="4 3" marker-end="url(#arrFE)"/>
<path d="M605,356 H130 V330" stroke-dasharray="4 3" marker-end="url(#arrFE)"/>
</g>
<g style="font-size:11px;fill:var(--muted)">
<rect x="10" y="462" width="12" height="12" rx="2" style="fill:var(--pad-soft);stroke:var(--pad)"/><text x="28" y="472">prediction</text>
<rect x="110" y="462" width="12" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace)"/><text x="128" y="472">fetch and decode path</text>
<path d="M260,468 H284" style="stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3"/><text x="290" y="472">op cache miss or fill</text>
</g>
</svg></div>
<p>What each unit does, in the order a fetch block passes through them:</p>
<ul>
<li><strong>Branch prediction unit.</strong> Each cycle it takes the current fetch address and the global history and predicts one fetch block: the BTB finds the branches in it and their targets, the direction predictor decides whether conditional branches are taken, and the indirect predictor and return address stack supply targets the BTB can't (see <a href="#/fe-direction">Branch Direction Predictors</a> and <a href="#/fe-targets">Branch Targets</a>). The predicted next address feeds straight back in for the next cycle.</li>
<li><strong>Fetch target queue.</strong> Holds the predicted blocks until fetch is ready for them, along with the history needed to repair the predictor. Its occupancy is how far the predictor runs ahead (see <a href="#/fe-decoupled/ftq">The Fetch Target Queue</a>).</li>
<li><strong>Prefetcher.</strong> Probes the instruction cache tags with the addresses in the queue and sends the misses to the L2, so lines arrive before fetch reaches them (see <a href="#/fe-decoupled/fdip">Fetch-Directed Prefetching</a>).</li>
<li><strong>Instruction cache.</strong> Read at the head of the queue, with the ITLB translating in parallel. The queue entry can carry the predicted way, so only one way is read (see <a href="#/stage-if/way-pred">Way Prediction</a>). A miss goes to the L2.</li>
<li><strong>Instruction buffer and decoders.</strong> Predecode finds instruction boundaries, which is the hard part on x86, and the decoders turn instructions into micro-ops (see <a href="#/fe-decode">Decoders and the Micro-op Cache</a>).</li>
<li><strong>Micro-op cache.</strong> Looked up with the same queue addresses. On a hit it delivers already-decoded micro-ops, skipping the instruction cache and decoders, which saves both latency and power. The decoders fill it on a miss.</li>
<li><strong>Micro-op queue.</strong> Collects micro-ops from both paths and absorbs the difference between front-end delivery and the rate rename takes them.</li>
<li><strong>Redirects.</strong> When decode finds a branch the BTB missed, or the back end resolves a mispredicted branch, the predictor restarts at the correct address. The fetch target queue and everything younger than the branch are flushed (see <a href="#/fe-targets/misses">BTB Misses and Decode Redirects</a>).</li>
</ul>
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
    { id: "btb-reach", label: "How the BTB Limits Prefetching" },
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
<p>Since the FTQ holds addresses the core will fetch soon, it doubles as a list of instruction cache lines to prefetch. <strong>Fetch-directed instruction prefetching (FDIP)</strong>, proposed in the same 1999 paper, works in three steps:</p>
<ol start="0">
<li><strong>Enqueue.</strong> Each FTQ entry names the cache lines its fetch block covers (one, or two if the block crosses a line boundary).</li>
<li><strong>Filter.</strong> A prefetch engine walks the FTQ ahead of fetch and probes the instruction cache tags for each line, using tag-port cycles that fetch isn't using. Lines already present or already in flight are dropped. Without this filter, most prefetches would be for lines that hit anyway.</li>
<li><strong>Issue.</strong> The remaining lines go to the L2 as prefetch requests, and their fills land in the instruction cache (or in a small prefetch buffer beside it, as in the original paper) before fetch gets there.</li>
</ol>
<p>FDIP keeps no metadata of its own. The branch predictor already is its model of the program, so it is accurate exactly as long as the predictor is right, and it can only reach as far as the predictor runs ahead. That makes the BTB, not the prefetcher, the structure that decides how much instruction cache latency gets hidden. Engineers at Arm (Ishii et al., 2021) showed that FDIP with a large enough BTB matches much more complex instruction prefetchers on server traces, which is why it's the baseline in current cores.</p>

<h3 id="sec-btb-reach">How the BTB Limits Prefetching</h3>
<p><strong>Lead.</strong> A prefetch hides a miss only if it's issued at least one miss latency before fetch needs the line. How early it's issued is the predictor's <em>lead</em> over fetch:</p>
<div class="math">\\[ \\text{lead (cycles)} = \\frac{\\text{FTQ occupancy (fetch blocks)}}{\\text{fetch blocks consumed per cycle}} \\]</div>
<p>A line is fully hidden when the lead is at least its miss latency. Otherwise, latency − lead cycles are still exposed. The FTQ depth caps the lead, so hiding L2 hits needs a modest queue, while hiding LLC hits, several times slower, needs a much deeper one. But the queue only helps if the predictor actually stays on the right path long enough to fill it.</p>
<p><strong>What a BTB miss does to the lead.</strong> The predictor can only follow taken branches it knows about. When a taken branch misses in the BTB:</p>
<ol start="0">
<li>The predictor doesn't see the branch and continues sequentially. Every FTQ entry after that point is on the wrong path, and so is every prefetch FDIP issues from them. Those prefetches waste L2 bandwidth and can evict useful lines.</li>
<li>Fetch reaches the block holding the branch, which is still on the correct path, and decode finds it. A direct jump, call, or return redirects at decode. A conditional branch that decode doesn't redirect, or an indirect branch, waits until it executes and mispredicts (see <a href="#/fe-targets/misses">BTB Misses and Decode Redirects</a>).</li>
<li>The redirect flushes the FTQ and the predictor restarts at the target with an empty queue, so the lead is 0. If the target line isn't in the instruction cache, it misses with its full latency exposed, right behind the redirect bubble.</li>
<li>The lead rebuilds only as fast as the predictor outruns fetch, so the lines in the first stretch after the target are prefetched too late to hide much.</li>
</ol>
<p>A BTB miss on a taken branch therefore costs twice: the redirect itself, and the instruction cache misses after it that FDIP would otherwise have hidden. The useful lead is bounded both by the FTQ depth and by the distance to the next BTB miss. A deeper FTQ does nothing for code that misses the BTB every few dozen fetch blocks.</p>
<p><strong>The BTB has to cover more code than the instruction cache.</strong> FDIP exists to bring in lines that are <em>not</em> in the instruction cache, so the predictor must know the branches in code the instruction cache doesn't hold. The BTB's reach has to extend over the code that lives in the L2. As a rough sizing, assume one ever-taken branch per 64-byte line (only branches that are taken need entries):</p>
<ul>
<li>A 32 KB instruction cache is 512 lines, so about 512 entries cover it.</li>
<li>A 1 MB L2 full of code is 16K lines, so covering it needs about 16K entries.</li>
<li>Zen 4's 8.5K entries (1.5K + 7K) cover roughly half a megabyte of code under this assumption. Server workloads with several megabytes of hot code run past that, and their predictor keeps losing its lead.</li>
</ul>
<p><strong>The dependence runs both ways.</strong> A BTB miss is found only when decode sees the branch, and that needs the instruction bytes. If the line holding the branch also misses in the instruction cache, the redirect waits for that miss too. So BTB misses expose instruction cache misses, and instruction cache misses delay BTB-miss discovery. On large-footprint code the two stalls come back to back, which is why idealizing both together gains more than the sum of each alone (see the front-end-bound server trace in <a href="#/perf-find-cause/model-examples">Worked Examples in a Model</a>).</p>
<p><strong>Filling the BTB from the instruction stream.</strong> A cache line holds the branches the BTB is missing, so a line arriving from the L2 can be predecoded and its branches inserted before the predictor needs them. Research designs build on this:</p>
<ul>
<li><strong>Confluence</strong> (Kaynak, Grot, and Falsafi, 2015) predecodes every line its instruction prefetcher brings in and fills a BTB organized by cache line from them. One prefetcher's metadata keeps both the instruction cache and the BTB filled.</li>
<li><strong>Boomerang</strong> (Kumar et al., 2017) uses a basic-block BTB, where a miss is visible at prediction time instead of at decode. On a miss, the predictor stops instead of running down the fall-through path. The line is fetched and predecoded, the missing branch is inserted, and run-ahead resumes. Other branches found in prefetched lines are kept for later, too.</li>
<li><strong>Shotgun</strong> (Kumar, Grot, and Nagarajan, 2018) splits the BTB by branch type. A large BTB for unconditional branches holds the program's coarse control flow, and each entry carries a bit vector of the cache lines used around its target, so one hit prefetches a whole code region. A small conditional-branch BTB is filled by predecoding those prefetched lines, and returns get their own small buffer.</li>
</ul>
<p>The simplest form, filling the BTB from predecoded instruction cache fills, is among the hardware fixes in <a href="#/fe-targets/footprint">Large Code Footprints</a>.</p>
<p><strong>Modeling it:</strong></p>
<ul>
<li><strong>Don't let the predictor see branches the BTB doesn't hold.</strong> A trace-driven front end that takes the next PC from the trace after a BTB miss gives FDIP perfect run-ahead and overstates its coverage. After a BTB miss, the model has to predict fall-through addresses and issue wrong-path prefetches until decode or execute redirects.</li>
<li><strong>Model the filter and the request limits:</strong> tag-probe bandwidth shared with fetch, and the number of instruction prefetches the L2 interface can have in flight.</li>
<li><strong>Classify every prefetch</strong> as timely (the line arrived before fetch), late (fetch waited for part of the latency), or useless (wrong path or evicted before use). Many late prefetches mean the lead is too short. Many useless ones point at BTB misses or mispredicts.</li>
<li><strong>Charge exposed instruction cache misses after a BTB-miss redirect correctly.</strong> They show up as instruction cache stalls, but a perfect-BTB experiment removes many of them. Run both idealizations alone and together before deciding which structure to grow.</li>
</ul>

<h3 id="sec-overriding">Fast and Slow Predictors</h3>
<p>The most accurate predictors (TAGE and its relatives) need several cycles to read their tables and combine results. Waiting for them every cycle would add bubbles to every taken branch. Cores pair them instead:</p>
<ol start="0">
<li>A small, single-cycle predictor (a micro-BTB with simple direction bits) makes a prediction immediately, and fetch follows it.</li>
<li>A cycle or two later, the large predictor finishes. If it agrees, nothing happens. If it disagrees, it <strong>overrides</strong>: the few blocks fetched on the fast prediction are flushed and fetch redirects, costing a short bubble instead of a full mispredict.</li>
</ol>
<p>Jiménez, Keckler, and Lin analyzed this "overriding" arrangement in 2000. The performance model has to include it: an override is a front-end bubble of a few cycles, distinct from a full back-end mispredict.</p>
<p class="refs">References: Reinman, Calder, and Austin, "Fetch Directed Instruction Prefetching," MICRO 1999 · Ishii, Lee, Nathella, and Sunwoo, "Re-establishing Fetch-Directed Instruction Prefetching: An Industry Perspective," ISPASS 2021 · Kaynak, Grot, and Falsafi, "Confluence: Unified Instruction Supply for Scale-Out Servers," MICRO 2015 · Kumar, Huang, Grot, and Nagarajan, "Boomerang: A Metadata-Free Architecture for Control Flow Delivery," HPCA 2017 · Kumar, Grot, and Nagarajan, "Blasting Through the Front-End Bottleneck with Shotgun," ASPLOS 2018 · Jiménez, Keckler, and Lin, "The Impact of Delay on the Design of Branch Predictors," MICRO 2000 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A hot loop is 7 instructions totaling 26 bytes, ending in a taken branch back to the top. The core fetches one aligned 32-byte window per cycle, follows one taken branch per cycle, and has 6-wide decode. A fetch queue sits between fetch and decode, and decode can take instructions from consecutive fetch blocks in the same cycle. The loop starts at an address ending in 0x1C. How many cycles per iteration does fetch need, and what changes if the loop is aligned to 32 bytes?</p>`,
        a: `<ol start="0"><li>The loop occupies bytes 0x1C to 0x1C + 26 − 1 = 0x35, so it crosses the boundary at 0x20.</li><li>The first window (0x00 to 0x1F) gives 4 bytes of the loop; the second (0x20 to 0x3F) gives the rest and ends at the taken branch.</li><li>Fetch needs <strong>2 cycles per iteration</strong>, so at most 7 / 2 = 3.5 instructions per cycle.</li><li>Aligned to 32 bytes, all 26 bytes fit in one window: <strong>1 cycle per iteration</strong>. Fetch now supplies 7 instructions per cycle, and one taken branch per cycle allows exactly that. Decode, at 6 per cycle, binds: the fetch queue fills and fetch stalls behind it, so throughput rises to <strong>6 instructions per cycle</strong> (7 / 6 ≈ 1.17 cycles per iteration).</li></ol>`
      },
      {
        q: `<p>Your model's predictor produces 2 fetch blocks per cycle, fetch consumes 1 per cycle, and the FTQ holds 40 blocks. An instruction cache miss that hits in the L2 takes 15 cycles (Intel Golden Cove's L2 latency). After a redirect, the FTQ starts empty at the target, which is block 0. Ignore fetch stalls. On code that misses the BTB on a taken branch every 50 fetch blocks, what share of blocks can FDIP fully hide an L2 hit for? What if the BTB misses only every 400 blocks? Can FDIP fully hide an LLC hit of 50 cycles?</p>`,
        a: `<ol start="0"><li>The predictor reaches block k at cycle k / 2, and fetch reaches it at cycle k, so block k's prefetch has a lead of k / 2 cycles.</li><li>FTQ occupancy is (predicted − fetched) = 2t − t = t blocks at cycle t, so it reaches 40 at cycle 40, when fetch is at block 40 and the predictor at block 80. Beyond block 80, the lead stays at 40 cycles.</li><li>Fully hiding 15 cycles needs k / 2 ≥ 15, so k ≥ 30. Blocks 0 to 29 after each redirect are only partly hidden, and block 0 not at all.</li><li>BTB miss every 50 blocks: blocks 30 to 49 are covered, <strong>20 / 50 = 40%</strong>.</li><li>Every 400 blocks: blocks 30 to 399, <strong>370 / 400 ≈ 92%</strong>. A better BTB raised coverage more than any change to the prefetcher could.</li><li>LLC hit: the lead never exceeds 40 cycles, so <strong>no</strong>, never fully. It needs an FTQ of at least 50 blocks, and then k ≥ 100, so the BTB must also go more than 100 blocks between misses.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your model has a fast single-cycle predictor overridden two cycles later by a TAGE predictor. Profiling shows 8 overrides and 3 full mispredicts per thousand instructions on a 6-wide core with a 17-cycle mispredict penalty and a CPI of 0.25 without either cost. Which costs more, and what would you change in the model to get these costs right?</p>`,
        a: `<p>Overrides: 8 × 2 = 16 lost fetch cycles per thousand instructions, but some are hidden if the queues in front of rename hold enough work. Mispredicts: 3 × 17 = 51 cycles, and nothing hides them. So mispredicts cost more than three times as much, but overrides aren't free: a CPI of 0.25 is 250 cycles per thousand instructions, so if none of the 16 cycles are hidden, overrides add 16 / 250 ≈ 6%.</p><p>In the model:</p><ul><li>Count overrides separately from mispredicts</li><li>Make the override flush only the blocks fetched after the fast prediction (not the back end)</li><li>Charge the bubble at fetch so the fetch and decode queues can absorb it</li><li>Check that the fast predictor's accuracy, not just TAGE's, matches the design, since the override rate depends on how often they disagree</li></ul>`
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
        q: `<p>A TAGE predictor has 12 tagged tables with history lengths from 4 to 640 branches, spaced geometrically. Number the tables 0 to 11, so L(i) = L(0) × α<sup>i</sup>. Find α and the 12 lengths, rounded to whole branches.</p>`,
        a: `<ol start="0"><li>L(11) = L(0) × α<sup>11</sup>, so α = (640 / 4)<sup>1/11</sup> = 160<sup>1/11</sup>.</li><li>ln 160 ≈ 5.075, divided by 11 ≈ 0.461, so α ≈ e<sup>0.461</sup> ≈ <strong>1.586</strong>.</li><li>Lengths: 4, 6, 10, 16, 25, 40, 64, 101, 160, 254, 403, 640.</li><li>Half the tables cover histories up to 40 branches, where most correlation lives; the rest reach far back for the rare branches that need it, at no more storage per table.</li></ol>`
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
        q: `<p>A bytecode interpreter dispatches with a <code>switch</code> compiled to one indirect jump. Each bytecode takes about 15 instructions including the dispatch. With last-target prediction, the dispatch jump mispredicts 60% of the time; with a history-based indirect predictor, 10%. The mispredict penalty is 17 cycles, and the interpreter's CPI without dispatch mispredicts is 0.4. What CPI does each add?</p>`,
        a: `<ol start="0"><li>Dispatches per instruction: 1 / 15 ≈ 0.0667.</li><li>Last-target: 0.0667 × 0.6 × 17 ≈ <strong>0.68 CPI</strong>, more than the 0.4 base CPI itself.</li><li>History-based: 0.0667 × 0.1 × 17 ≈ <strong>0.11 CPI</strong>.</li><li>The history works because the next bytecode is correlated with the previous few, which is exactly what the path history captures. Threaded dispatch (a separate jump at the end of each handler) helps the same way on last-target predictors, by giving each handler its own BTB entry.</li></ol>`
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
