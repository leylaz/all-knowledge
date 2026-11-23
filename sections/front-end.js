/* Section: Front End and Branch Prediction
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "fe"). */

section({
  id: "fe",
  name: "Front End and Branch Prediction",
  cap: "Predicting the path, fetching it, and turning it into macro-ops",
  body: `
<p>The front end decides which instructions the core works on next and delivers them as macro-ops to rename. In a modern core it is mostly a prediction machine: the branch predictor runs ahead of fetch, picking the path many cycles before any branch on it executes, and the instruction cache, decoders, and op cache follow wherever it points.</p>
<div class="callout"><strong>Macro-ops and micro-ops.</strong> This section uses AMD's terms, matching the Zen 5 diagram below. The two words name two levels of the same work, and vendors draw the line differently:
<ul>
<li><strong>Macro-op (AMD).</strong> The unit that decode produces and the front end delivers to rename. Dispatch, the ROB, and retire count macro-ops. (Zen 3's and Zen 4's op caches stored macro-ops. Zen 5's stores decoded instructions instead, see <a href="#/fe-decode/uop-cache">The Op Cache</a>.) Most x86 instructions become one macro-op, some become two (AMD's guides call these fast path single and fast path double), and an instruction that needs more is sequenced by the microcode unit.</li>
<li><strong>Micro-op (AMD).</strong> The unit an execution pipe or address-generation unit actually executes. A macro-op carries up to two micro-ops and is split into them at the schedulers. <code>add rax, [rbx]</code> is one macro-op (one dispatch slot, one ROB entry) holding two micro-ops, a load and an add.</li>
<li><strong>Intel</strong> says "micro-op" (µop) for both levels and separates them by domain. A fused-domain µop is what decode, the micro-op cache, rename, and retire count, so it plays the role of AMD's macro-op. Unfused-domain µops are what the ports execute, like AMD's micro-ops. Intel's "macro" means something else again: its manuals call x86 instructions macro-instructions, and macro-fusion merges two of them (a compare and a conditional branch) into one µop.</li>
<li><strong>Arm</strong> splits it the way AMD does. Decode produces macro-ops (MOPs), which are cracked into micro-ops (µOPs) at dispatch, and Arm's decoded-op cache is a macro-op (MOP) cache.</li>
</ul>
Widths in this section (decode output, the macro-op queue, rename) are in macro-ops unless they say otherwise. Zen 5's op cache is the exception, since it counts instructions. Where a page discusses an Intel core, it uses Intel's terms and says so.</div>
<p>The units of a decoupled front end, laid out the way AMD's Zen 5 arranges them (after Chips and Cheese's diagram). The branch predictor writes predicted fetch windows into the fetch queue and looks them up in the op cache, up to two windows per cycle. Op cache hits go straight to the macro-op queue. Misses fetch from the instruction cache, which feeds two decode clusters, one per predicted window, and the decoded macro-ops fill the op cache on their way to the macro-op queue. Not drawn: the fetch-directed prefetcher and the redirects from decode and the back end.</p>
<div class="tbl"><svg viewBox="0 0 680 480" role="img" aria-label="Block diagram of the AMD Zen 5 front end. The branch predictor holds a 16K-entry L1 BTB, an 8K-entry L2 BTB, an indirect target array, and a 52-entry return stack. It sends predicted fetch windows to the fetch queue and, two ranges per cycle, to the op cache (6K instructions in 64 sets × 16 ways). Op cache misses go to the fetch queue, which reads the ITLB (64 entries L1, 2048 entries L2) and the 32 KB 8-way L1 instruction cache. The instruction cache exchanges 64 bytes per cycle with the L2 cache. Two 32-byte-per-cycle paths leave the instruction cache, each into its own instruction queue, which sends 4 instructions per cycle into a 4-wide decode cluster. Decode clusters 0 and 1 share the microcode unit between them. Each cluster sends 4 macro-ops per cycle to the macro-op queue and also fills the op cache. The op cache sends up to 12 instructions per cycle (two 6-wide paths) to the macro-op queue, which sends 8 macro-ops per cycle to rename." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
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
<text x="120" y="316">6K instructions</text>
<text x="351.5" y="283">D0</text><text x="380.5" y="283">D1</text><text x="409.5" y="283">D2</text><text x="438.5" y="283">D3</text>
<text x="561.5" y="283">D0</text><text x="590.5" y="283">D1</text><text x="619.5" y="283">D2</text><text x="648.5" y="283">D3</text>
<text x="200" y="396">12 instructions (2 × 6 wide)</text>
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
<li><strong>Branch prediction unit.</strong> Each cycle it takes the current fetch address and the global history and predicts one fetch block: the BTB finds the branches in it and their targets, the direction predictor decides whether conditional branches are taken, and the indirect predictor and return address stack supply targets the BTB can't (see <a href="#/fe-classic">Classic Direction Predictors</a>, <a href="#/fe-direction">Modern Direction Predictors</a>, and <a href="#/fe-targets">Branch Targets</a>). The predicted next address feeds straight back in for the next cycle.</li>
<li><strong>Fetch target queue.</strong> Holds the predicted blocks until fetch is ready for them, along with the history needed to repair the predictor. Its occupancy is how far the predictor runs ahead (see <a href="#/fe-decoupled/ftq">The Fetch Target Queue</a>).</li>
<li><strong>Prefetcher.</strong> Probes the instruction cache tags with the addresses in the queue and sends the misses to the L2, so lines arrive before fetch reaches them (see <a href="#/fe-decoupled/fdip">Fetch-Directed Prefetching</a>).</li>
<li><strong>Instruction cache.</strong> Read at the head of the queue, with the ITLB translating in parallel. The queue entry can carry the predicted way, so only one way is read (see <a href="#/stage-if/way-pred">Way Prediction</a>). A miss goes to the L2.</li>
<li><strong>Instruction queues and decoders.</strong> Predecode finds instruction boundaries, which is the hard part on x86, and the decoders turn instructions into macro-ops. Zen 5 has two 4-wide decode clusters, each with its own instruction queue and each taking a different predicted fetch window, and the two share the microcode unit (see <a href="#/fe-decode">Decoders and the Op Cache</a>).</li>
<li><strong>Op cache.</strong> Looked up with the predicted fetch addresses. On a hit it delivers already-decoded instructions, skipping the instruction cache and decoders, which saves both latency and power. The decoders fill it on a miss.</li>
<li><strong>Macro-op queue.</strong> Collects macro-ops from both paths and absorbs the difference between front-end delivery and the rate rename takes them.</li>
<li><strong>Redirects.</strong> When decode finds a branch the BTB missed, or the back end resolves a mispredicted branch, the predictor restarts at the correct address. The fetch target queue and everything younger than the branch are flushed (see <a href="#/fe-targets/misses">BTB Misses and Decode Redirects</a>).</li>
</ul>
<p>When the front end falls behind, the back end starves however wide it is. When it predicts wrong, everything fetched after the bad prediction is thrown away (see <a href="#/fe-mispredict">Mispredict Cost in Deep Pipelines</a>). Front-end stalls take a large share of cycles on server workloads with large code footprints, and mispredicts are often the largest single loss on integer code with hard-to-predict branches.</p>
<p>The classic 5-stage pipeline's view of branches is in <a href="#/branch-hazards">Branch Hazards</a>; these pages cover how a wide out-of-order core does it.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core runs at a base CPI of 0.25 (IPC 4). Its workload executes one branch every 5 instructions, the predictor mispredicts 2.5% of branches, and each mispredict costs 17 cycles. What is the CPI with mispredicts, and what share of time do they take?</p>`,
        a: `<ol><li>Branches per instruction: 1 / 5 = 0.2.</li><li>Mispredicts per instruction: 0.2 × 0.025 = 0.005, which is 5 MPKI.</li><li>Added CPI: 0.005 × 17 = 0.085.</li><li>CPI = 0.25 + 0.085 = <strong>0.335</strong> (IPC about 3.0).</li><li>Share of time: 0.085 / 0.335 ≈ <strong>25%</strong>, from mispredicting one branch in forty.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A team doubles the back end's width (rename, ports, ROB) on a core whose front end delivers at most 6 macro-ops per cycle from the op cache. On a server workload with a large code footprint, IPC barely moves. Why, and what would you measure first?</p>`,
        a: `<p>The front end caps throughput before the back end does. On large-footprint code, the op cache and instruction cache miss often, so delivery drops to the decoders and then to zero during instruction cache and BTB misses. Doubling the back end only raises a ceiling the workload never reaches. Measure top-down level 1 first: if front-end-bound slots dominate, split them into latency (instruction cache, ITLB, and BTB misses, redirects) and bandwidth (op cache misses, decoder limits). The fixes are front-end ones: a larger BTB to run further ahead, fetch-directed instruction prefetching, a larger instruction cache or op cache, and code layout (profile-guided optimization, hot/cold splitting).</p>`
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
    { id: "groups", label: "Fetch Blocks and Fetch Groups" },
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
<p>The <strong>fetch target queue (FTQ)</strong> holds predicted fetch blocks: a start address, an end (the predicted-taken branch, or the block's size limit, often the end of a fetch window), and the predicted next address. A <strong>fetch window</strong> is the aligned chunk of bytes fetch reads from the instruction cache in one cycle, 32 bytes on recent x86 cores, so a window always starts at an address whose low 5 bits are 0. The end is a position inside the block, not a second full address. Because a block can't run past its size limit, the end is stored as a small offset from the start of that aligned region (5 bits for a 32-byte window), along with a bit that says whether the block ended at a predicted-taken branch or simply ran out of room. Each entry also keeps what is needed to repair the predictor on a mispredict: the global history at prediction time (a copy, or a pointer into a circular history buffer), the return stack top, and which table entries made the prediction.</p>
<div class="tbl"><svg viewBox="0 0 680 266" role="img" aria-label="Fields of one example FTQ entry, for the block from 0x4013 to a predicted-taken 2-byte jump at 0x4018. The first row holds the block itself, used by fetch and the prefetcher: start address (48 bits, 0x4013), end offset (5 bits, 25), ends-taken bit (1 bit, set), branch type (3 bits, direct jump), and next address (48 bits, 0x52A0). The second row holds side information: the predicted instruction cache way (3 bits for 8 ways, way 5), a global history pointer (10 bits, 412), the return stack top (6 bits, 17), and the provider, meaning which predictor entries made the prediction (TAGE table 3 and BTB way 1). The end offset counts from the 32-byte window base 0x4000, so the jump's last byte is 0x4019. A block that just runs out of window would have offset 31, the taken bit clear, and next address 0x4020." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">One FTQ entry: the block from 0x4013 to a predicted-taken 2-byte jmp at 0x4018</text>
<text x="20" y="48" style="fill:var(--trace);font-size:12px;font-weight:600">The block (used by fetch and the prefetcher)</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="20" y="56" width="150" height="62" rx="3"/><rect x="178" y="56" width="96" height="62" rx="3"/><rect x="282" y="56" width="96" height="62" rx="3"/><rect x="386" y="56" width="110" height="62" rx="3"/><rect x="504" y="56" width="156" height="62" rx="3"/>
</g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="95" y="74">Start address</text><text x="226" y="74">End offset</text><text x="330" y="74">Ends taken</text><text x="441" y="74">Branch type</text><text x="582" y="74">Next address</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="95" y="89">48 bits</text><text x="226" y="89">5 bits</text><text x="330" y="89">1 bit</text><text x="441" y="89">3 bits</text><text x="582" y="89">48 bits</text></g>
<g style="fill:var(--trace);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="95" y="108">0x4013</text><text x="226" y="108">25</text><text x="330" y="108">1</text><text x="441" y="108">direct jmp</text><text x="582" y="108">0x52A0</text></g>
<text x="20" y="146" style="fill:var(--pad);font-size:12px;font-weight:600">Side information (a way hint for fetch, the rest to repair and train the predictor)</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5">
<rect x="20" y="154" width="120" height="62" rx="3"/><rect x="148" y="154" width="150" height="62" rx="3"/><rect x="306" y="154" width="120" height="62" rx="3"/><rect x="434" y="154" width="226" height="62" rx="3"/>
</g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="80" y="172">Predicted way</text><text x="223" y="172">History pointer</text><text x="366" y="172">Return stack top</text><text x="547" y="172">Provider</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="80" y="187">3 bits (8 ways)</text><text x="223" y="187">10 bits</text><text x="366" y="187">6 bits</text><text x="547" y="187">which entries made the prediction</text></g>
<g style="fill:var(--pad);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="80" y="206">5</text><text x="223" y="206">412</text><text x="366" y="206">17</text><text x="547" y="206">TAGE T3, BTB way 1</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="242">End offset counts from the 32-byte window base 0x4000: the jmp's last byte is 0x4019 = 0x4000 + 25.</text>
<text x="20" y="258">A block that just runs out of window has offset 31, the taken bit clear, and next address 0x4020.</text></g>
</svg></div>
<p>The occupancy of the FTQ is how far ahead the predictor is. On a mispredict, the queue is flushed along with everything younger than the branch, and the predictor restarts from the correct target with its history repaired.</p>

<h3 id="sec-groups">Fetch Blocks and Fetch Groups</h3>
<p>The two terms are easy to mix up because they often cover the same bytes, but they come from different halves of the decoupled front end:</p>
<ul>
<li><strong>A fetch block is a unit of prediction.</strong> The predictor produces it, and it is one FTQ entry: a run of bytes the predictor expects to execute in order, from a start address to the first predicted-taken branch or the block's size limit. Control flow sets its length.</li>
<li><strong>A fetch group is a unit of delivery.</strong> It is what the fetch stage hands to predecode and decode in one cycle (BOOM calls it a fetch packet). Fetch bandwidth sets its length: at most one fetch window on most cores, and never past the end of the current block.</li>
</ul>
<p>When the size limit is one fetch window, a block is usually one group and the terms coincide. They come apart in both directions:</p>
<ul>
<li><strong>One block, several groups.</strong> A block allowed to be longer than one window (up to a cache line, for example) takes more than one cycle to fetch. Its FTQ entry stays at the head until its last group has been read.</li>
<li><strong>Several blocks, one cycle.</strong> A core that follows more than one taken branch per cycle fetches more than one block per cycle. Zen 5 does this with two 32-byte fetches per cycle, one per decode cluster.</li>
</ul>
<p>The diagram shows the first case on a core whose predictor caps a block at one 64-byte line and whose fetch reads one aligned 32-byte window per cycle:</p>
<div class="tbl"><svg viewBox="0 0 680 282" role="img" aria-label="Two fetch blocks split into four fetch groups. Two 64-byte cache lines are drawn, 0x4000 and 0x5280, each split into two 32-byte windows. Block 0 runs from 0x4008 to 0x402D, 38 bytes, and ends at a predicted-taken 2-byte conditional branch at 0x402C whose target is 0x5290. Block 1 runs from 0x5290 to 0x52BF, 48 bytes, and ends at the 64-byte cap. Fetch delivers one group per cycle, never crossing a window boundary: cycle 0 gets 0x4008 to 0x401F (24 bytes), cycle 1 gets 0x4020 to 0x402D (14 bytes), cycle 2 gets 0x5290 to 0x529F (16 bytes), and cycle 3 gets 0x52A0 to 0x52BF (32 bytes). That is 86 useful bytes in 4 cycles, 21.5 bytes per cycle against a 32-byte peak. The other bytes of each window are read and discarded." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrFG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--redirect)"/></marker></defs>
<g style="stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><path d="M40,72 V226"/><path d="M168,72 V226"/><path d="M296,72 V226"/><path d="M384,72 V226"/><path d="M512,72 V226"/><path d="M640,72 V226"/></g>
<rect x="40" y="44" width="256" height="24" style="fill:var(--surface)"/><rect x="384" y="44" width="256" height="24" style="fill:var(--surface)"/>
<g style="fill:var(--trace-soft)"><rect x="72" y="44" width="152" height="24"/><rect x="448" y="44" width="192" height="24"/></g>
<rect x="216" y="44" width="8" height="24" style="fill:var(--redirect)"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5"><rect x="40" y="44" width="256" height="24"/><rect x="384" y="44" width="256" height="24"/><path d="M168,44 V68"/><path d="M512,44 V68"/></g>
<path d="M220,44 C240,16 430,16 448,42" style="fill:none;stroke:var(--redirect);stroke-width:1.5" marker-end="url(#arrFG)"/>
<text x="334" y="14" text-anchor="middle" style="fill:var(--redirect);font-size:11px">jcc at 0x402C, predicted taken to 0x5290</text>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="40" y="82">0x4000</text><text x="168" y="82">0x4020</text><text x="296" y="82">0x4040</text><text x="384" y="82">0x5280</text><text x="512" y="82">0x52A0</text><text x="640" y="82">0x52C0</text></g>
<text x="40" y="112" style="fill:var(--pad);font-size:12px;font-weight:600">Fetch blocks: one FTQ entry each, cut by the predictor</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="72" y="120" width="152" height="26" rx="3"/><rect x="448" y="120" width="192" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="148" y="137">Block 0: 38 B</text><text x="544" y="137">Block 1: 48 B</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="148" y="160">ends at the taken jcc</text><text x="544" y="160">ends at the 64-byte cap</text></g>
<text x="40" y="188" style="fill:var(--trace);font-size:12px;font-weight:600">Fetch groups: what each fetch cycle delivers, at most one 32-byte window</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="72" y="196" width="94" height="26" rx="3"/><rect x="170" y="196" width="54" height="26" rx="3"/><rect x="448" y="196" width="62" height="26" rx="3"/><rect x="514" y="196" width="126" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="119" y="213">Cycle 0</text><text x="197" y="213">Cycle 1</text><text x="479" y="213">Cycle 2</text><text x="577" y="213">Cycle 3</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="119" y="236">24 B</text><text x="197" y="236">14 B</text><text x="479" y="236">16 B</text><text x="577" y="236">32 B</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="40" y="258">2 blocks, 4 groups: 86 useful bytes in 4 cycles, 21.5 bytes per cycle against a 32-byte peak.</text>
<text x="40" y="274">Unshaded bytes in each window are read and discarded.</text></g>
</svg></div>
<p>For modeling, count both. FTQ occupancy and the lead formula below are in blocks, but fetch bandwidth and the bubbles that starve decode are in groups. Average useful bytes per group, against the window size, shows how much bandwidth taken branches and misaligned targets waste.</p>

<h3 id="sec-blocks">Fetch Blocks and Taken Branches</h3>
<p>Fetch reads one aligned window per cycle (32 bytes on recent x86 cores) and stops at the first predicted-taken branch, because the next bytes come from somewhere else. That gives two front-end limits that show up in tight loops and branchy code:</p>
<ul>
<li><strong>Taken branches per cycle.</strong> Most cores follow one taken branch per cycle; AMD's Zen 5 can follow two. A loop body with a taken branch every 3 instructions can't fetch more than 3 instructions per cycle on a one-taken core, however wide the decoders are.</li>
<li><strong>Taken-branch bubbles.</strong> Following a taken branch with no lost cycle needs the target in the same cycle the branch is found. Small, fast BTBs (an L0 or L1 BTB) give zero-bubble redirects; a target found in a larger second-level BTB costs one or more bubble cycles.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 452" role="img" aria-label="Fetch timing after a predicted-taken branch at the end of block A, over cycles 0 to 3, with no back pressure and an empty FTQ. Each case has a predict lane and an instruction cache lane. With the branch in a 1-cycle BTB: in cycle 0 the predictor hits on A's branch and writes A to the FTQ with its end at the branch and next address T, while the instruction cache reads the previous block. In cycle 1 A passes through the empty FTQ and the instruction cache reads it (ITLB, tags, and data), while the predictor looks up T. In cycle 2 fetch reads T, so there is no bubble. With the branch only in a 2-cycle BTB: in cycle 0 the fast BTB sees no taken branch, so A is written as a full window with next address A+1. In cycle 1 the predictor guesses the fall-through block A+1 while the slow BTB is still reading, and fetch reads all of A's window. At the end of cycle 1 the slow BTB returns T, A's end and next address are fixed, the bytes of A past the branch are discarded, and A+1 is flushed. In cycle 2 the predictor predicts T and fetch is idle because A+1 was flushed before it was read, which is the 1 bubble. In cycle 3 fetch reads T. With a slower BTB with a (k + 1)-cycle read, k wrong-path blocks are predicted, fetch reads and discards k − 1 of them, then idles for 1 cycle. A predictor that waits for the slow BTB instead loses the same cycles with the instruction cache idle. In a tight loop where every block ends in a taken branch, fetch delivers 1 or 1/2 blocks per cycle." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrTB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px;font-weight:600" text-anchor="middle"><text x="212" y="20">Cycle 0</text><text x="344" y="20">Cycle 1</text><text x="476" y="20">Cycle 2</text><text x="608" y="20">Cycle 3</text></g>
<rect x="10" y="186" width="664" height="1" style="fill:var(--rule)"/>
<text x="10" y="70" style="fill:var(--ink);font-size:11px;font-weight:600">1-cycle BTB read</text><text x="10" y="84" style="fill:var(--muted);font-size:10px">0 bubbles</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="140" y="48">Predict</text><text x="140" y="128">I-cache</text></g>
<rect x="148" y="32" width="128" height="62" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="212" y="48" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">A</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="212" y="63">finds A's taken branch,</text><text x="212" y="75">writes FTQ entry: end</text><text x="212" y="87">at branch, next = T</text></g>
<rect x="280" y="32" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="344" y="48" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="344" y="63">looked up in the same</text><text x="344" y="75">cycle A is fetched</text></g>
<rect x="412" y="32" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="476" y="48" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T+1</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="476" y="63">next block after T</text></g>
<rect x="544" y="32" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="608" y="48" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T+2</text>
<rect x="148" y="112" width="128" height="62" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="212" y="128" text-anchor="middle" style="fill:var(--muted);font-size:12px;font-weight:600">prev</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="212" y="143">reads the block</text><text x="212" y="155">predicted the cycle</text><text x="212" y="167">before</text></g>
<rect x="280" y="112" width="128" height="62" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="344" y="128" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">A</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="344" y="143">A skips the empty FTQ:</text><text x="344" y="155">ITLB, tags, data read</text></g>
<rect x="412" y="112" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="476" y="128" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="476" y="143">right after A:</text><text x="476" y="155">no bubble</text></g>
<rect x="544" y="112" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="608" y="128" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T+1</text>
<path d="M252,95 L296,110" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/><text x="262" y="107" text-anchor="end" style="fill:var(--muted);font-size:9px">via FTQ</text>
<text x="10" y="264" style="fill:var(--ink);font-size:11px;font-weight:600">2-cycle BTB read</text><text x="10" y="278" style="fill:var(--muted);font-size:10px">1 bubble</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="140" y="242">Predict</text><text x="140" y="322">I-cache</text></g>
<rect x="148" y="226" width="128" height="62" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="212" y="242" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">A</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="212" y="257">fast BTB: no taken</text><text x="212" y="269">branch, so A is a full</text><text x="212" y="281">window, next = A+1</text></g>
<rect x="280" y="226" width="128" height="62" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="344" y="242" text-anchor="middle" style="fill:var(--redirect);font-size:12px;font-weight:600">A+1</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="344" y="257">fall-through guess</text><text x="344" y="269">while the slow BTB</text><text x="344" y="281">is still reading</text></g>
<rect x="412" y="226" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="476" y="242" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="476" y="257">predicted right after</text><text x="476" y="269">the redirect</text></g>
<rect x="544" y="226" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="608" y="242" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T+1</text>
<rect x="148" y="306" width="128" height="62" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="212" y="322" text-anchor="middle" style="fill:var(--muted);font-size:12px;font-weight:600">prev</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="212" y="337">reads the block</text><text x="212" y="349">predicted the cycle</text><text x="212" y="361">before</text></g>
<rect x="280" y="306" width="128" height="62" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="344" y="322" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">A</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="344" y="337">full window read, bytes</text><text x="344" y="349">past the branch are</text><text x="344" y="361">discarded at redirect</text></g>
<rect x="412" y="306" width="128" height="62" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:2 3"/><text x="476" y="322" text-anchor="middle" style="fill:var(--redirect);font-size:12px;font-weight:600">idle</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="476" y="337">A+1 was flushed</text><text x="476" y="349">before fetch read it:</text><text x="476" y="361">1 bubble</text></g>
<rect x="544" y="306" width="128" height="62" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="608" y="322" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">T</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="608" y="337">one cycle later than</text><text x="608" y="349">with a 1-cycle BTB</text></g>
<path d="M252,289 L296,304" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/><text x="262" y="301" text-anchor="end" style="fill:var(--muted);font-size:9px">via FTQ</text>
<path d="M410,206 V368" style="stroke:var(--redirect);stroke-width:2"/>
<g style="fill:var(--redirect);font-size:9.5px"><text x="414" y="206">End of cycle 1: the slow BTB returns T.</text><text x="414" y="218">A's end and next are fixed, A+1 is flushed.</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="10" y="394">Assumes no back pressure and an empty FTQ, so fetch reads each block the cycle after it is predicted.</text>
<text x="10" y="410">Slower BTB with a (k + 1)-cycle read: k wrong-path blocks, fetch reads and discards k − 1, then idles 1.</text>
<text x="10" y="426">A predictor that waits for the slow BTB instead loses the same cycles, with the I-cache idle.</text>
<text x="10" y="442">Tight loop with a taken branch ending every block: 1 or 1/2 blocks per cycle.</text></g>
</svg></div>
<p>If the FTQ already held blocks, fetch would read those during the gap and the bubble would be hidden (see <a href="#/fe-decoupled/why">Why Decouple</a>). Tight loops expose it because the predictor can't get ahead there: every block needs a taken-branch prediction. The redirect is the same override as in <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>.</p>
<p>The fetch-block rounding also matters: a loop whose 40 bytes straddle two 32-byte windows takes 2 fetch cycles, and one that starts near the end of a window can need 3. Aligning hot loop heads is a classic compiler fix.</p>
<div class="tbl"><svg viewBox="0 0 680 272" role="img" aria-label="The same 40-byte loop at two start addresses, with 32-byte fetch windows starting at 0x401000, 0x401020, 0x401040, and 0x401060. Aligned at 0x401000, the loop covers bytes 0x401000 to 0x401027: cycle 0 fetches 32 bytes and cycle 1 fetches 8 bytes, so 2 fetch cycles per iteration. Starting at 0x40101C, it covers 0x40101C to 0x401043: cycle 0 fetches 4 bytes, cycle 1 fetches 32 bytes, and cycle 2 fetches 4 bytes, so 3 fetch cycles per iteration. In both rows the loop ends in a 2-byte taken jcc back to the top. A 40-byte loop needs a third cycle whenever it starts at offset 25 or later in a window." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrLA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--redirect)"/></marker></defs>
<g style="fill:var(--ink);font-size:12px;font-weight:600"><text x="52" y="22">Loop at 0x401000 (aligned): touches 2 windows, so 2 fetch groups per iteration</text><text x="52" y="142">Loop at 0x40101C: touches 3 windows, so 3 fetch groups per iteration</text></g>
<g style="fill:var(--surface);stroke:none"><rect x="52" y="50" width="576" height="24"/><rect x="52" y="170" width="576" height="24"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="53" y="50" width="190" height="24"/><rect x="245" y="50" width="46" height="24"/>
<rect x="221" y="170" width="22" height="24"/><rect x="245" y="170" width="190" height="24"/><rect x="437" y="170" width="22" height="24"/>
</g>
<g style="fill:var(--redirect)"><rect x="279" y="51" width="11" height="22"/><rect x="447" y="171" width="11" height="22"/></g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5"><rect x="52" y="50" width="576" height="24"/><rect x="52" y="170" width="576" height="24"/><path d="M244,50 V74 M436,50 V74 M244,170 V194 M436,170 V194"/></g>
<g style="fill:none;stroke:var(--redirect);stroke-width:1.5"><path d="M285,50 C270,30 70,30 56,48" marker-end="url(#arrLA)"/><path d="M453,170 C438,150 236,150 224,168" marker-end="url(#arrLA)"/></g>
<g style="fill:var(--redirect);font-size:10px"><text x="298" y="46">taken jcc back to the top</text><text x="466" y="166">taken jcc back to the top</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle"><text x="52" y="88">0x401000</text><text x="244" y="88">0x401020</text><text x="436" y="88">0x401040</text><text x="628" y="88">0x401060</text><text x="52" y="208">0x401000</text><text x="244" y="208">0x401020</text><text x="436" y="208">0x401040</text><text x="628" y="208">0x401060</text></g>
<g style="fill:var(--trace);font-size:11px;font-weight:600" text-anchor="middle"><text x="148" y="106">Cycle 0: 32 B</text><text x="268" y="106">Cycle 1: 8 B</text><text x="232" y="226">Cycle 0: 4 B</text><text x="340" y="226">Cycle 1: 32 B</text><text x="448" y="226">Cycle 2: 4 B</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="52" y="248">A 40-byte loop needs a third cycle whenever it starts at offset 25 or later in a window (25 + 40 − 1 = 64).</text>
<text x="52" y="262">Unshaded bytes in each fetched window are read and discarded.</text></g>
</svg></div>
<p>Alignment matters because fetch reads whole aligned windows: the loop's bytes are split into fetch groups at window boundaries, one group per cycle. Moving the loop doesn't change its 40 bytes, only how many windows they touch, which is ⌊(offset + 40 − 1) / 32⌋ + 1 for a loop starting at byte <em>offset</em> of its window. How many fetch blocks the loop forms depends on the predictor's size limit (with a one-window limit, the same 2 or 3), but the fetch cycles are set by the windows.</p>

<h3 id="sec-fdip">Fetch-Directed Instruction Prefetching</h3>
<p>Since the FTQ holds addresses the core will fetch soon, it doubles as a list of instruction cache lines to prefetch. <strong>Fetch-directed instruction prefetching (FDIP)</strong>, proposed in the same 1999 paper, works in three steps:</p>
<ol>
<li><strong>Enqueue.</strong> Each FTQ entry names the cache lines its fetch block covers (one, or two if the block crosses a line boundary).</li>
<li><strong>Filter.</strong> A prefetch engine walks the FTQ ahead of fetch and probes the instruction cache tags for each line, using tag-port cycles that fetch isn't using. Lines already present or already in flight are dropped. Without this filter, most prefetches would be for lines that hit anyway.</li>
<li><strong>Issue.</strong> The remaining lines go to the L2 as prefetch requests, and their fills land in the instruction cache (or in a small prefetch buffer beside it, as in the original paper) before fetch gets there.</li>
</ol>
<p>FDIP keeps no metadata of its own. The branch predictor already is its model of the program, so it is accurate exactly as long as the predictor is right, and it can only reach as far as the predictor runs ahead. That makes the BTB, not the prefetcher, the structure that decides how much instruction cache latency gets hidden. Engineers at Arm (Ishii et al., 2021) showed that FDIP with a large enough BTB matches much more complex instruction prefetchers on server traces, which is why it's the baseline in current cores.</p>

<h3 id="sec-btb-reach">How the BTB Limits Prefetching</h3>
<p><strong>Lead.</strong> A prefetch hides a miss only if it's issued at least one miss latency before fetch needs the line. How early it's issued is the predictor's <em>lead</em> over fetch:</p>
<div class="math">\\[ \\text{lead (cycles)} = \\frac{\\text{FTQ occupancy (fetch blocks)}}{\\text{fetch blocks consumed per cycle}} \\]</div>
<p>The denominator is an average over the blocks ahead of the line, not a fixed rate. A block longer than one fetch window holds the FTQ head for several cycles (see <a href="#/fe-decoupled/groups">Fetch Blocks and Fetch Groups</a>), and short taken blocks are capped at one per cycle on most cores, or two on Zen 5 (see <a href="#/fe-decoupled/blocks">Fetch Blocks and Taken Branches</a>). While fetch waits on an instruction cache miss, or on a decode queue backed up by a stalled backend, it consumes nothing, and the predictor keeps filling the FTQ. Those stalls are when the lead grows.</p>
<p>A line is fully hidden when the lead is at least its miss latency. Otherwise, latency − lead cycles are still exposed. The FTQ depth caps the lead, so hiding L2 hits needs a modest queue, while hiding LLC hits, several times slower, needs a much deeper one. But the queue only helps if the predictor actually stays on the right path long enough to fill it.</p>
<p><strong>What a BTB miss does to the lead.</strong> The predictor can only follow taken branches it knows about. When a taken branch misses in the BTB:</p>
<ol>
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
<ol>
<li>A small, single-cycle predictor (a micro-BTB with simple direction bits) makes a prediction immediately, and fetch follows it.</li>
<li>A cycle or two later, the large predictor finishes. If it agrees, nothing happens. If it disagrees, it <strong>overrides</strong>: the few blocks fetched on the fast prediction are flushed and fetch redirects, costing a short bubble instead of a full mispredict.</li>
</ol>
<p>Jiménez, Keckler, and Lin analyzed this "overriding" arrangement in 2000. The performance model has to include it: an override is a front-end bubble of a few cycles, distinct from a full back-end mispredict.</p>
<p class="refs">References: Reinman, Calder, and Austin, "Fetch Directed Instruction Prefetching," MICRO 1999 · Ishii, Lee, Nathella, and Sunwoo, "Re-establishing Fetch-Directed Instruction Prefetching: An Industry Perspective," ISPASS 2021 · Kaynak, Grot, and Falsafi, "Confluence: Unified Instruction Supply for Scale-Out Servers," MICRO 2015 · Kumar, Huang, Grot, and Nagarajan, "Boomerang: A Metadata-Free Architecture for Control Flow Delivery," HPCA 2017 · Kumar, Grot, and Nagarajan, "Blasting Through the Front-End Bottleneck with Shotgun," ASPLOS 2018 · Jiménez, Keckler, and Lin, "The Impact of Delay on the Design of Branch Predictors," MICRO 2000 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A hot loop is 7 instructions totaling 26 bytes, ending in a taken branch back to the top. The core fetches one aligned 32-byte window per cycle, follows one taken branch per cycle, and has 6-wide decode. A fetch queue sits between fetch and decode, and decode can take instructions from consecutive fetch blocks in the same cycle. The loop starts at an address ending in 0x1C. How many cycles per iteration does fetch need, and what changes if the loop is aligned to 32 bytes?</p>`,
        a: `<ol><li>The loop occupies bytes 0x1C to 0x1C + 26 − 1 = 0x35, so it crosses the boundary at 0x20.</li><li>The first window (0x00 to 0x1F) gives 4 bytes of the loop; the second (0x20 to 0x3F) gives the rest and ends at the taken branch.</li><li>Fetch needs <strong>2 cycles per iteration</strong>, so at most 7 / 2 = 3.5 instructions per cycle.</li><li>Aligned to 32 bytes, all 26 bytes fit in one window: <strong>1 cycle per iteration</strong>. Fetch now supplies 7 instructions per cycle, and one taken branch per cycle allows exactly that. Decode, at 6 per cycle, binds: the fetch queue fills and fetch stalls behind it, so throughput rises to <strong>6 instructions per cycle</strong> (7 / 6 ≈ 1.17 cycles per iteration).</li></ol>`
      },
      {
        q: `<p>Your model's predictor produces 2 fetch blocks per cycle, fetch consumes 1 per cycle, and the FTQ holds 40 blocks. An instruction cache miss that hits in the L2 takes 15 cycles (Intel Golden Cove's L2 latency). After a redirect, the FTQ starts empty at the target, which is block 0. Ignore fetch stalls. On code that misses the BTB on a taken branch every 50 fetch blocks, what share of blocks can FDIP fully hide an L2 hit for? What if the BTB misses only every 400 blocks? Can FDIP fully hide an LLC hit of 50 cycles?</p>`,
        a: `<ol><li>The predictor reaches block k at cycle k / 2, and fetch reaches it at cycle k, so block k's prefetch has a lead of k / 2 cycles.</li><li>FTQ occupancy is (predicted − fetched) = 2t − t = t blocks at cycle t, so it reaches 40 at cycle 40, when fetch is at block 40 and the predictor at block 80. Beyond block 80, the lead stays at 40 cycles.</li><li>Fully hiding 15 cycles needs k / 2 ≥ 15, so k ≥ 30. Blocks 0 to 29 after each redirect are only partly hidden, and block 0 not at all.</li><li>BTB miss every 50 blocks: blocks 30 to 49 are covered, <strong>20 / 50 = 40%</strong>.</li><li>Every 400 blocks: blocks 30 to 399, <strong>370 / 400 ≈ 92%</strong>. A better BTB raised coverage more than any change to the prefetcher could.</li><li>LLC hit: the lead never exceeds 40 cycles, so <strong>no</strong>, never fully. It needs an FTQ of at least 50 blocks, and then k ≥ 100, so the BTB must also go more than 100 blocks between misses.</li></ol>`
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
  id: "fe-classic",
  region: "fe",
  title: "Classic Direction Predictors",
  sections: [
    { id: "counters", label: "Saturating Counters" },
    { id: "bimodal", label: "Bimodal Tables" },
    { id: "local", label: "Local History Predictors" },
    { id: "correlating", label: "Correlating Predictors" },
    { id: "gshare", label: "gshare and gselect" },
    { id: "aliasing", label: "Aliasing" },
    { id: "tournament", label: "Tournament Predictors" },
    { id: "summary", label: "What Each Predictor Captures" },
    { id: "size", label: "When Bigger Tables Stop Helping" },
    { id: "workloads", label: "Where They Work and Where They Fail" }
  ],
  body: `
<p>A direction predictor answers one question per conditional branch: taken or not taken. The predictors on this page are the ones Hennessy and Patterson build up in Appendix C.2 and Section 3.3, ending with McFarling's 1993 combining predictor. They are no longer the best designs on their own, but every modern predictor is assembled from their parts: saturating counters, tables indexed by the PC and by history, and a rule for choosing between predictions. <a href="#/fe-direction">Modern Direction Predictors</a> picks up from here with perceptrons and TAGE.</p>

<h3 id="sec-counters">Saturating Counters</h3>
<p>The simplest dynamic predictor keeps one bit per branch: the last outcome. On a loop branch it mispredicts twice per visit to the loop, once at the exit (it predicts taken, the loop falls through) and again on the next entry (it predicts not taken, the loop branch is taken).</p>
<p>A <strong>2-bit saturating counter</strong> fixes that with hysteresis. It counts up on a taken outcome and down on a not-taken one, stays within 0 to 3, and predicts taken at 2 or 3. A branch in a strong state (0 or 3) has to go the other way twice in a row before the prediction flips, so a loop branch mispredicts only at the exit. The figure lays the states out in counter order (the same machine is drawn as a state diagram in <a href="#/branch-hazards/dynamic">Dynamic Prediction</a>).</p>
<div class="tbl"><svg viewBox="0 0 680 468" role="img" aria-label="A 2-bit saturating counter drawn as four states in counter order: 00 strong not taken, 01 weak not taken, 10 weak taken, 11 strong taken. Bit 1, the high bit, is the prediction: 00 and 01 predict not taken, 10 and 11 predict taken. Bit 0 is the confidence: the state is strong when bit 0 equals bit 1. A taken outcome adds 1 and a not-taken outcome subtracts 1, saturating at 11 and 00. Below, a loop branch that goes T T T N on every visit: starting from 11, the 2-bit counter mispredicts only the N at each exit, dropping to 10 and coming straight back to 11. A 1-bit predictor mispredicts the exit and also the first T of the next visit." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrCtr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">The four states of a 2-bit counter, in counter order</text>
<rect x="10" y="28" width="325" height="184" rx="6" style="fill:var(--pad-soft);stroke:none"/>
<rect x="345" y="28" width="325" height="184" rx="6" style="fill:var(--trace-soft);stroke:none"/>
<text x="22" y="48" style="fill:var(--ink);font-size:11px;font-weight:600">Bit 1 = 0: predict not taken</text>
<text x="357" y="48" style="fill:var(--trace);font-size:11px;font-weight:600">Bit 1 = 1: predict taken</text>
<rect x="45" y="85" width="100" height="70" rx="6" style="fill:var(--surface);stroke:var(--trace);stroke-width:2.5"/>
<text x="95" y="113" text-anchor="middle" style="fill:var(--ink);font-size:20px;font-weight:600;font-family:var(--mono)">00</text>
<text x="95" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">value 0</text>
<text x="95" y="146" text-anchor="middle" style="fill:var(--ink);font-size:10px">Strong not taken</text>
<rect x="200" y="85" width="100" height="70" rx="6" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="250" y="113" text-anchor="middle" style="fill:var(--ink);font-size:20px;font-weight:600;font-family:var(--mono)">01</text>
<text x="250" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">value 1</text>
<text x="250" y="146" text-anchor="middle" style="fill:var(--ink);font-size:10px">Weak not taken</text>
<rect x="380" y="85" width="100" height="70" rx="6" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="430" y="113" text-anchor="middle" style="fill:var(--ink);font-size:20px;font-weight:600;font-family:var(--mono)">10</text>
<text x="430" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">value 2</text>
<text x="430" y="146" text-anchor="middle" style="fill:var(--ink);font-size:10px">Weak taken</text>
<rect x="535" y="85" width="100" height="70" rx="6" style="fill:var(--surface);stroke:var(--trace);stroke-width:2.5"/>
<text x="585" y="113" text-anchor="middle" style="fill:var(--ink);font-size:20px;font-weight:600;font-family:var(--mono)">11</text>
<text x="585" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">value 3</text>
<text x="585" y="146" text-anchor="middle" style="fill:var(--ink);font-size:10px">Strong taken</text>
<path d="M147,108 L198,108" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="172.5" y="102" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">T: +1</text>
<path d="M198,136 L147,136" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="172.5" y="150" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">N: −1</text>
<path d="M302,108 L378,108" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="340" y="102" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">T: +1</text>
<path d="M378,136 L302,136" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="340" y="150" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">N: −1</text>
<path d="M482,108 L533,108" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="507.5" y="102" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">T: +1</text>
<path d="M533,136 L482,136" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="507.5" y="150" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">N: −1</text>
<path d="M570,85 C558,48 612,48 600,83" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="585" y="46" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">T: stays at 11</text>
<path d="M110,155 C122,192 68,192 80,157" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrCtr)"/>
<text x="95" y="203" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">N: stays at 00</text>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="234"><tspan style="font-weight:600">Bit 1 (high bit)</tspan> is the prediction: 1 predicts taken, 0 predicts not taken.</text>
<text x="10" y="252"><tspan style="font-weight:600">Bit 0 (low bit)</tspan> is the confidence: strong when it equals bit 1 (00, 11), weak when it differs (01, 10).</text>
<text x="10" y="270"><tspan style="font-weight:600">Update:</tspan> taken adds 1, not taken subtracts 1, and the counter saturates at 00 and 11 instead of wrapping.</text>
</g>
<text x="0" y="306" style="fill:var(--ink);font-size:13px;font-weight:600">A loop branch with 4 iterations per visit (T T T N), already warmed up</text>
<text x="10" y="334" style="fill:var(--muted);font-size:11px;font-weight:600">Execution</text>
<text x="227" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<text x="285" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">1</text>
<text x="343" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">2</text>
<text x="401" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">3</text>
<text x="459" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">4</text>
<text x="517" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">5</text>
<text x="575" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">6</text>
<text x="633" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">7</text>
<text x="10" y="362" style="fill:var(--ink);font-size:11px;font-weight:600">Outcome</text>
<rect x="200" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="258" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="316" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="374" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="401" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">N</text>
<rect x="432" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="490" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="548" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="606" y="347" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="633" y="362" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">N</text>
<text x="10" y="390" style="fill:var(--ink);font-size:11px;font-weight:600">2-bit: state → prediction</text>
<rect x="200" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="258" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="316" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="374" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="401" y="390" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">11 → T</text>
<rect x="432" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">10 → T</text>
<rect x="490" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="548" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="390" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="606" y="375" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="633" y="390" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">11 → T</text>
<text x="10" y="418" style="fill:var(--ink);font-size:11px;font-weight:600">1-bit: state → prediction</text>
<rect x="200" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="418" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">1 → T</text>
<rect x="258" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="418" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">1 → T</text>
<rect x="316" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="418" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">1 → T</text>
<rect x="374" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="401" y="418" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">1 → T</text>
<rect x="432" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="459" y="418" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">0 → N</text>
<rect x="490" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="418" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">1 → T</text>
<rect x="548" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="418" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">1 → T</text>
<rect x="606" y="403" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="633" y="418" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">1 → T</text>
<text x="10" y="440" style="fill:var(--muted);font-size:11px">Red cells mispredict. The exit drops the 2-bit counter only to 10 (weak taken): 1 miss per visit.</text>
<text x="10" y="458" style="fill:var(--muted);font-size:11px">The 1-bit predictor flips to N at the exit and misses the re-entry too: 2 misses per visit.</text>
</svg></div>
<p>Hennessy and Patterson define the general n-bit counter the same way: it holds a value from 0 to 2<sup>n</sup> − 1, a taken branch increments it and a not-taken branch decrements it (both saturating), and it predicts taken when the value is at least half its maximum, 2<sup>n−1</sup>. That threshold is exactly the counter's top bit, so reading the prediction costs nothing. The lower bits only set how many wrong outcomes in a row it takes to flip that bit: 2<sup>n−1</sup> from a strong state.</p>
<p>Wider counters exist (TAGE's tagged entries use 3 bits), but Hennessy and Patterson note that an n-bit counter does little better than a 2-bit one for most branches. Two bits is the standard building block.</p>

<h3 id="sec-bimodal">Bimodal Tables</h3>
<p>A <strong>bimodal</strong> predictor is a table of 2-bit counters indexed by low bits of the branch PC, with no tag. Each counter learns the bias of the branches that map to it, and nothing else. A 4096-entry table costs 4096 counters × 2 bits/counter = 8 Kbits, which is 1 KB.</p>
<p>The useful result from Hennessy and Patterson's SPEC89 data is where bimodal stops improving. A 4096-entry table mispredicts from about 1% of branches on the floating-point codes to 18% on eqntott, and an infinite table does essentially no better. Past a few thousand entries, capacity isn't the limit. The limit is the information: a counter indexed only by PC can't predict a branch whose direction changes, however much storage it has.</p>
<p>McFarling's name for the scheme comes from how branches behave. Most branches are either usually taken or usually not taken, so branch behavior has a bimodal distribution, and the predictor only has to tell the two groups apart. His SPEC89 measurements show the same saturation as Hennessy and Patterson's, plotted against size. Average accuracy rises from about 89% at 32 B (128 counters) to about 93% at 1 KB (4096 counters), then stops at 93.5% once every branch has a counter of its own.</p>
<p>He also weighs tags. A tagged, set-associative table beats an untagged array with the same number of counters, because branches stop sharing counters, but it saturates at the same 93.5%. Once the tag bits are counted, a plain array is often better for the same storage. The exception is a design that already keeps tags for a BTB, where the counters can live in the BTB entries at no extra tag cost.</p>
<p>Bimodal tables are still in every predictor. They are TAGE's base table, the fallback when no tagged entry matches, and they make good single-cycle first-level predictors because they are small and fast (see <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>).</p>

<h3 id="sec-local">Local History Predictors</h3>
<p>A bimodal counter learns only a branch's bias. Many branches follow a pattern in their own past instead: a loop branch that is taken 7 times and then falls through, or a branch that alternates. Yeh and Patt's two-level adaptive predictors (1991) handle these with two tables:</p>
<ol>
<li>A <strong>branch history table</strong>, indexed by PC, holds each branch's own last k outcomes (its <em>local history</em>).</li>
<li>A <strong>pattern history table</strong> of 2-bit counters is indexed by that local history (often combined with some PC bits). Each counter learns what follows one particular k-bit pattern.</li>
</ol>
<p>The first figure follows one branch through both tables and then over two visits to its loop.</p>
<div class="tbl"><svg viewBox="0 0 680 566" role="img" aria-label="A two-level local predictor with 3 history bits predicting a loop branch that goes T T T N on every visit. The branch at PC 0x401C uses PC bits 3 to 2, value 3, to select entry 3 of the branch history table, which holds one 3-bit history per branch. Entry 3 holds 011. That history indexes the pattern history table of eight 2-bit counters, one per pattern 000 to 111. Counter 011 holds 11, so bit 1 predicts taken. When the branch resolves taken, counter 011 counts up and saturates at 11, and T shifts into the history, which becomes 111. Only four patterns occur for this branch: 110, 101, and 011 precede taken iterations and their counters hold 11, and 111 precedes the exit and its counter holds 00. Below, eight executions over two visits: the outcomes T T T N T T T N, histories 110, 101, 011, 111 repeating, and the local predictor predicts all eight correctly. A bimodal counter indexed only by PC predicts taken every time and misses both exits." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrLoc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">One prediction: a 4-iteration loop branch (T T T N) with k = 3 history bits</text>
<rect x="10" y="140" width="90" height="40" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="55" y="157" text-anchor="middle" style="fill:var(--muted);font-size:10px">Branch PC</text>
<text x="55" y="173" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600;font-family:var(--mono)">0x401C</text>
<text x="55" y="198" text-anchor="middle" style="fill:var(--muted);font-size:10px">PC bits [3:2] = 3</text>
<text x="150" y="44" style="fill:var(--ink);font-size:11px;font-weight:600">Level 1: branch history table</text>
<text x="150" y="58" style="fill:var(--muted);font-size:10px">one k-bit history per branch</text>
<rect x="150" y="90" width="150" height="28" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="162" y="108" style="fill:var(--muted);font-size:11px">entry 0</text>
<text x="286" y="109" text-anchor="end" style="fill:var(--muted);font-size:13px;font-family:var(--mono)">100</text>
<rect x="150" y="118" width="150" height="28" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="162" y="136" style="fill:var(--muted);font-size:11px">entry 1</text>
<text x="286" y="137" text-anchor="end" style="fill:var(--muted);font-size:13px;font-family:var(--mono)">010</text>
<rect x="150" y="146" width="150" height="28" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="162" y="164" style="fill:var(--muted);font-size:11px">entry 2</text>
<text x="286" y="165" text-anchor="end" style="fill:var(--muted);font-size:13px;font-family:var(--mono)">111</text>
<rect x="150" y="174" width="150" height="28" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/>
<text x="162" y="192" style="fill:var(--ink);font-size:11px">entry 3</text>
<text x="286" y="193" text-anchor="end" style="fill:var(--ink);font-size:13px;font-family:var(--mono);font-weight:600">011</text>
<path d="M102,160 L148,160" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLoc)"/>
<text x="390" y="44" style="fill:var(--ink);font-size:11px;font-weight:600">Level 2: pattern history table</text>
<text x="390" y="58" style="fill:var(--muted);font-size:10px">one 2-bit counter per history pattern</text>
<rect x="390" y="66" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="81" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">000</text>
<text x="528" y="81" text-anchor="end" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">01</text>
<rect x="390" y="88" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="103" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">001</text>
<text x="528" y="103" text-anchor="end" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">01</text>
<rect x="390" y="110" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="125" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">010</text>
<text x="528" y="125" text-anchor="end" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">01</text>
<rect x="390" y="132" width="150" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/>
<text x="402" y="147" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">011</text>
<text x="528" y="147" text-anchor="end" style="fill:var(--ink);font-size:12px;font-family:var(--mono);font-weight:600">11</text>
<rect x="390" y="154" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="169" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">100</text>
<text x="528" y="169" text-anchor="end" style="fill:var(--muted);font-size:12px;font-family:var(--mono)">01</text>
<rect x="390" y="176" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="191" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">101</text>
<text x="528" y="191" text-anchor="end" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">11</text>
<rect x="390" y="198" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="213" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">110</text>
<text x="528" y="213" text-anchor="end" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">11</text>
<rect x="390" y="220" width="150" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="402" y="235" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">111</text>
<text x="528" y="235" text-anchor="end" style="fill:var(--ink);font-size:12px;font-family:var(--mono)">00</text>
<text x="402" y="252" style="fill:var(--muted);font-size:10px">history</text>
<text x="528" y="252" text-anchor="end" style="fill:var(--muted);font-size:10px">counter</text>
<path d="M302,160 C340,160 350,143 388,143" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLoc)"/>
<text x="345" y="182" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">history 011</text>
<text x="345" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">is the index</text>
<path d="M542,143 L578,143" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLoc)"/>
<rect x="580" y="120" width="90" height="46" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="625" y="140" text-anchor="middle" style="fill:var(--trace);font-size:13px;font-weight:600">Predict T</text>
<text x="625" y="157" text-anchor="middle" style="fill:var(--muted);font-size:10px">bit 1 of 11</text>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="280"><tspan style="font-weight:600">Update, once the branch resolves taken:</tspan> counter 011 counts up (it saturates at 11),</text>
<text x="10" y="297">and T shifts into entry 3's history: the oldest bit drops out and T enters bit 0, so 011 becomes 111.</text>
<text x="10" y="314">Gray counters are patterns this branch never makes.</text>
</g>
<text x="0" y="351" style="fill:var(--ink);font-size:13px;font-weight:600">Every visit to the loop, after the four used counters have trained</text>
<text x="10" y="377" style="fill:var(--muted);font-size:11px;font-weight:600">Execution</text>
<text x="227" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<text x="285" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">1</text>
<text x="343" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">2</text>
<text x="401" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">3</text>
<text x="459" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">4</text>
<text x="517" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">5</text>
<text x="575" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">6</text>
<text x="633" y="377" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">7</text>
<text x="10" y="405" style="fill:var(--ink);font-size:11px;font-weight:600">Outcome</text>
<rect x="200" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="258" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="316" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="374" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="401" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">N</text>
<rect x="432" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="490" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="548" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">T</text>
<rect x="606" y="390" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="633" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">N</text>
<text x="10" y="433" style="fill:var(--ink);font-size:11px;font-weight:600">History before (old → new)</text>
<rect x="200" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">110</text>
<rect x="258" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">101</text>
<rect x="316" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">011</text>
<rect x="374" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="401" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">111</text>
<rect x="432" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">110</text>
<rect x="490" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">101</text>
<rect x="548" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">011</text>
<rect x="606" y="418" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="633" y="433" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">111</text>
<text x="10" y="461" style="fill:var(--ink);font-size:11px;font-weight:600">Local: counter → prediction</text>
<rect x="200" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="258" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="316" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="374" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="401" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">00 → N</text>
<rect x="432" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="490" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="548" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="606" y="446" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="633" y="461" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">00 → N</text>
<text x="10" y="489" style="fill:var(--ink);font-size:11px;font-weight:600">Bimodal: counter → prediction</text>
<rect x="200" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="227" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="258" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="316" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="343" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="374" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="401" y="489" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">11 → T</text>
<rect x="432" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="459" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">10 → T</text>
<rect x="490" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="517" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="548" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="575" y="489" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">11 → T</text>
<rect x="606" y="474" width="54" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/><text x="633" y="489" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-family:var(--mono);font-weight:600">11 → T</text>
<text x="10" y="521" style="fill:var(--muted);font-size:11px">Each iteration leaves a different history, so each gets its own counter.</text>
<text x="10" y="538" style="fill:var(--muted);font-size:11px">Only 111 (three taken in a row) comes right before the exit, so its counter learns N and nothing misses.</text>
<text x="10" y="555" style="fill:var(--muted);font-size:11px">The bimodal counter, indexed by PC alone, misses every exit.</text>
</svg></div>
<p>A local predictor with k = 10 learns any repeating pattern whose period is at most 10 branches, including the exit of a loop with a trip count of up to 10. Its cost is a second, dependent table read per prediction, and a speculative update problem that the single global history below doesn't have: every in-flight instance of the branch needs its own copy of the history (see <a href="#/fe-direction/update">Speculative History and Repair</a>).</p>
<p>Yeh and Patt's names describe the variants by where history and counters live. <strong>GAg</strong> uses one global history and one shared counter table. <strong>PAg</strong> uses per-address histories and one shared counter table. <strong>PAp</strong> uses per-address histories and per-address counter tables. Gshare, below, is a refinement of the global scheme.</p>
<div class="tbl"><svg viewBox="0 0 680 334" role="img" aria-label="Three panels compare Yeh and Patt's two-level variants. GAg: one global history register holding the last 4 outcomes of any branch indexes one counter table shared by all branches. PAg: the PC selects a per-branch history from a branch history table, and that history indexes one counter table shared by all branches. PAp: the PC selects a per-branch history and also selects which counter table to use, so each branch has its own history and its own counters. The shared tables save storage but let two branches with the same history pattern fight over one counter, which gshare reduces by XORing PC bits into the global history." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrYP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">Yeh and Patt's variants: where the histories and the counters live</text>
<rect x="10" y="28" width="210" height="236" rx="6" style="fill:var(--pad-soft);stroke:none"/>
<text x="22" y="48" style="fill:var(--ink);font-size:13px;font-weight:600;font-family:var(--mono)">GAg</text>
<text x="22" y="64" style="fill:var(--muted);font-size:10px">Global history, shared counters</text>
<text x="59" y="128" text-anchor="middle" style="fill:var(--muted);font-size:10px">GHR</text>
<rect x="24" y="134" width="70" height="24" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><text x="59" y="151" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-family:var(--mono);font-weight:600">1011</text>
<text x="59" y="174" text-anchor="middle" style="fill:var(--muted);font-size:9px">last 4 branches,</text>
<text x="59" y="186" text-anchor="middle" style="fill:var(--muted);font-size:9px">any PC</text>
<path d="M96,146 L136,146" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<rect x="138" y="98" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="138" y="114" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="138" y="130" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="138" y="146" width="64" height="16" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><rect x="138" y="162" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="138" y="178" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="170" y="212" text-anchor="middle" style="fill:var(--muted);font-size:9px">one shared</text>
<text x="170" y="224" text-anchor="middle" style="fill:var(--muted);font-size:9px">table</text>
<text x="22" y="244" style="fill:var(--ink);font-size:10px">One history for all branches,</text>
<text x="22" y="257" style="fill:var(--ink);font-size:10px">one counter table for all.</text>
<rect x="236" y="28" width="210" height="236" rx="6" style="fill:var(--pad-soft);stroke:none"/>
<text x="248" y="48" style="fill:var(--ink);font-size:13px;font-weight:600;font-family:var(--mono)">PAg</text>
<text x="248" y="64" style="fill:var(--muted);font-size:10px">Per-branch history, shared counters</text>
<rect x="265" y="76" width="40" height="20" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><text x="285" y="90" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">PC</text>
<path d="M285,98 L285,108" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<rect x="250" y="110" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="125" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0110</text>
<rect x="250" y="132" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="147" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">1111</text>
<rect x="250" y="154" width="70" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><text x="285" y="169" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono);font-weight:600">1011</text>
<rect x="250" y="176" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="285" y="191" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0001</text>
<text x="285" y="213" text-anchor="middle" style="fill:var(--muted);font-size:9px">one per branch</text>
<path d="M322,165 L362,146" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<rect x="364" y="98" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="364" y="114" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="364" y="130" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="364" y="146" width="64" height="16" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><rect x="364" y="162" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="364" y="178" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="396" y="212" text-anchor="middle" style="fill:var(--muted);font-size:9px">one shared</text>
<text x="396" y="224" text-anchor="middle" style="fill:var(--muted);font-size:9px">table</text>
<text x="248" y="244" style="fill:var(--ink);font-size:10px">Each branch has its own history,</text>
<text x="248" y="257" style="fill:var(--ink);font-size:10px">and all share one counter table.</text>
<rect x="462" y="28" width="210" height="236" rx="6" style="fill:var(--pad-soft);stroke:none"/>
<text x="474" y="48" style="fill:var(--ink);font-size:13px;font-weight:600;font-family:var(--mono)">PAp</text>
<text x="474" y="64" style="fill:var(--muted);font-size:10px">Per-branch history and counters</text>
<rect x="491" y="76" width="40" height="20" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><text x="511" y="90" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">PC</text>
<path d="M511,98 L511,108" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<rect x="476" y="110" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="511" y="125" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0110</text>
<rect x="476" y="132" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="511" y="147" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">1111</text>
<rect x="476" y="154" width="70" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><text x="511" y="169" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono);font-weight:600">1011</text>
<rect x="476" y="176" width="70" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="511" y="191" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0001</text>
<text x="511" y="213" text-anchor="middle" style="fill:var(--muted);font-size:9px">one per branch</text>
<path d="M548,165 L588,146" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<rect x="602" y="86" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="602" y="102" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="602" y="118" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="602" y="134" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="602" y="150" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="602" y="166" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/>
<rect x="596" y="92" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="596" y="108" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="596" y="124" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="596" y="140" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="596" y="156" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/><rect x="596" y="172" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1;opacity:0.7"/>
<rect x="590" y="98" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="590" y="114" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="590" y="130" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="590" y="146" width="64" height="16" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2.5"/><rect x="590" y="162" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><rect x="590" y="178" width="64" height="16" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<path d="M533,86 C570,70 630,62 634,82" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrYP)"/>
<text x="622" y="212" text-anchor="middle" style="fill:var(--muted);font-size:9px">one table</text>
<text x="622" y="224" text-anchor="middle" style="fill:var(--muted);font-size:9px">per branch</text>
<text x="474" y="244" style="fill:var(--ink);font-size:10px">Each branch has its own history</text>
<text x="474" y="257" style="fill:var(--ink);font-size:10px">and its own counter table.</text>
<text x="10" y="290" style="fill:var(--muted);font-size:11px">In PAp the PC also picks which counter table to read. Sharing a table saves storage,</text>
<text x="10" y="307" style="fill:var(--muted);font-size:11px">but two branches with the same history pattern then fight over one counter.</text>
<text x="10" y="324" style="fill:var(--muted);font-size:11px">gshare, below, XORs PC bits into the global history to spread them apart.</text>
</svg></div>

<h3 id="sec-correlating">Correlating Predictors</h3>
<p>Local history sees only the branch's own past. Many branches are predictable only from what other branches just did. Hennessy and Patterson's example is from eqntott:</p>
<pre><code>if (aa == 2) aa = 0;     /* b1 */
if (bb == 2) bb = 0;     /* b2 */
if (aa != bb) { ... }    /* b3 */</code></pre>
<p>If b1 and b2 both find their values equal to 2 (so both assignments run), aa and bb are both 0 and b3's condition is false. A bimodal counter for b3 can't see that. A predictor that knows the outcomes of b1 and b2 can.</p>
<p>A <strong>global history register</strong> (GHR) records the outcomes of the last m branches as m bits, newest in the low bit. An <strong>(m, n) correlating predictor</strong> uses those m bits to choose among 2<sup>m</sup> n-bit counters in each entry. Its storage is 2<sup>m</sup> counters/entry × n bits/counter × the number of entries.</p>
<p>Hennessy and Patterson compare a (2, 2) predictor with 1024 entries against a 4096-entry bimodal table. Both cost 8 Kbits (2<sup>2</sup> counters/entry × 2 bits/counter × 1024 entries = 8192 bits for the first, and 4096 counters × 2 bits/counter = 8192 bits for the second). The correlating predictor outperforms the bimodal table, and often beats even an infinite bimodal table. Two bits of history buy more than extra capacity does.</p>

<h3 id="sec-gshare">gshare and gselect</h3>
<p>gshare comes from McFarling's 1993 DEC WRL report, written as branches were becoming the main limit on instruction-level parallelism. Superscalar and superpipelined machines, especially ones that execute speculatively, have more instructions in flight per branch, so each mispredicted branch throws away more work. The compiler techniques that had kept branches cheap on early RISC machines were also running out. A delayed branch helps less as the number of delay slots to fill grows, and an architecture with several implementations, each with its own pipeline, can't choose one delay-slot count that suits them all. That left the job to hardware. McFarling splits it in two: predicting the direction, and supplying the target instructions of a taken branch quickly (the BTB's job). He studies only the direction. He starts from the three known schemes, each suited to one kind of branch:</p>
<ul>
<li><strong>Bimodal:</strong> branches strongly biased one way.</li>
<li><strong>Local:</strong> branches with simple repeating patterns of their own.</li>
<li><strong>Global:</strong> branches correlated with the branches executed just before them.</li>
</ul>
<p>His two contributions are hashing the global history together with the branch address (gshare) and combining two predictors with a selector that picks, per branch, the one doing better. Together they reached 98.1% accuracy against 97.1% for the most accurate earlier scheme, typically at half the size or less for the same accuracy.</p>
<p>All the numbers in the subsections below come from one setup:</p>
<ul>
<li><strong>Workload:</strong> the 10 SPEC89 benchmarks (doduc, eqntott, espresso, fpppp, gcc, li, matrix300, nasa7, spice, and tomcatv), a mix of symbolic and numeric programs.</li>
<li><strong>Traces:</strong> the first 10 million instructions of each, traced on a DECstation 5000 with pixie.</li>
<li><strong>Initial state:</strong> every counter set as if all earlier branches had been taken.</li>
<li><strong>Metric:</strong> conditional branch prediction accuracy averaged over the benchmarks, plotted against predictor size from 32 B to 64 KB.</li>
</ul>

<h4 id="sec-mcf-local">Local Branch Prediction</h4>
<p>McFarling uses the two-level structure from <a href="#/fe-classic/local">Local History Predictors</a> with one change: the history table is a plain array with no tags, where Yeh and Patt assumed a set-associative one.</p>
<p>His example is a loop that runs 4 times with its test at the bottom, <code>for (i = 1; i &lt;= 4; i++)</code>. Its branch produces the pattern (1110)<sup>n</sup>, so with 3 bits of history and 2<sup>3</sup> counters, the history always says which iteration comes next, and after the counters settle the predictor never misses. With more branches in the program, two kinds of contention appear:</p>
<ul>
<li><strong>History contention:</strong> branches that map to the same history entry mix their outcomes into one history, which then describes none of them.</li>
<li><strong>Pattern contention:</strong> every branch shares the one counter table, so two branches can need opposite predictions after the same history. A branch running (0110)<sup>n</sup> and one running (1110)<sup>n</sup> collide this way at history 110. With 4 bits of history and 2<sup>4</sup> counters, their histories no longer overlap. If one pattern runs for a long time before the other starts, 3 bits are still enough, because the counters retrain to whichever pattern is current.</li>
</ul>
<p>McFarling sets the history table and the counter table to the same number of entries. Below about 128 B, local prediction is worse than bimodal, because there are so few history entries that contention leaves the stored histories worthless. Above that it is much better, and large local predictors approach 97.1%, with fewer than half the mispredictions of bimodal (2.9% against 6.5%). His appendix adds two refinements. Indexing the counters with a few address bits and fewer history bits sometimes helps, mostly because the history table gets smaller. Giving the history table as many entries as the counter table is usually a good choice.</p>

<h4 id="sec-mcf-global">Global Branch Prediction</h4>
<p>A global predictor keeps a single shift register, GR, holding the outcomes of the last n conditional branches, and uses it alone to index the counter table. It captures two kinds of patterns:</p>
<ul>
<li><strong>Correlation between branches.</strong> In <code>if (x &lt; 1) ...</code> followed by <code>if (x &gt; 1) ...</code>, the first branch's outcome says a lot about the second. If x &lt; 1, the second condition can't hold. If not, the second is still likely to lean one way. Pan, So, and Rahmeh found many neighboring branches in SPEC with conditions correlated like this.</li>
<li><strong>Local patterns, duplicated.</strong> When the global history happens to contain all the local history a branch needs, global prediction does as well as local prediction.</li>
</ul>
<p>McFarling's example of the second kind is a nested loop, <code>for (i = 0; i &lt; 100; i++)</code> around <code>for (j = 0; j &lt; 3; j++)</code>. With GR shifted left (newest outcome in the low bit, 1 for taken), the branches settle into:</p>
<div class="tbl"><table>
<tr><th>Branch test</th><th>Value</th><th>GR</th><th>Result</th></tr>
<tr><td>j &lt; 3</td><td>j = 1</td><td>1101</td><td>Taken</td></tr>
<tr><td>j &lt; 3</td><td>j = 2</td><td>1011</td><td>Taken</td></tr>
<tr><td>j &lt; 3</td><td>j = 3</td><td>0111</td><td>Not taken</td></tr>
<tr><td>i &lt; 100</td><td></td><td>1110</td><td>Usually taken</td></tr>
</table></div>
<p>Each history value appears before exactly one branch at exactly one value of j, so the history tells the predictor both which branch is executing and where the inner loop is.</p>
<p>Even so, at a fixed size global prediction is clearly worse than local, and it beats bimodal only above 1 KB. McFarling explains why with the information content of the counter index:</p>
<ul>
<li><strong>Address bits</strong> are worth a lot in a small table. Each doubling of the counters roughly halves the number of branches sharing a counter. Once every frequent branch has its own counter, each further address bit adds nothing.</li>
<li><strong>History bits</strong> start out worth little but keep gaining. Each branch goes the same way more than 90% of the time, so the sequence of branches leading to a given branch is highly repetitive for that branch and usually different from the sequence leading to others. History therefore identifies the branch, less efficiently than the address does, and it also carries information the address doesn't. That is why it wins in large tables.</li>
</ul>

<h4 id="sec-mcf-gselect">Global Predictor with Index Selection</h4>
<p>If history identifies the branch less efficiently than the address, the obvious fix is to use both. Pan, So, and Rahmeh's predictor, which McFarling calls <strong>gselect</strong>, indexes the counter table with low PC bits concatenated with global history bits. A table of 2<sup>K</sup> counters can use anywhere from 1 to K − 1 address bits, with history filling the rest. McFarling plots only the best split at each size (gselect-best).</p>
<p>gselect-best beats both bimodal and global prediction, since each of those is a degenerate case of it, all address bits or all history bits. At small sizes it tracks bimodal, because it needs its bits to tell branches apart. Once there are enough address bits to identify most branches, the extra bits go to history, and it pulls well ahead of bimodal and of plain global prediction.</p>
<p>Against local prediction, gselect-best is better below 1 KB and close above it. McFarling finds that notable, because gselect needs one table access where local prediction needs two in sequence, and its history costs almost no storage. A gselect predictor should therefore have less delay and be easier to pipeline than a local one.</p>

<h4 id="sec-mcf-gshare">Global History with Index Sharing</h4>
<p>Because global history only weakly identifies the branch, gselect's index is redundant. Once the address bits identify the branch, each branch sees only a few of its possible history values, so most (address, history) combinations never occur. McFarling hashes the two together instead, with a bitwise XOR, and calls the result <strong>gshare</strong>. The XOR carries more information than either input alone, and it can use more address bits <em>and</em> more history bits than a concatenation of the same width. His example has two branches with two common histories each:</p>
<div class="tbl"><table>
<tr><th>Branch address</th><th>Global history</th><th>gselect 4/4 index</th><th>gshare 8/8 index</th></tr>
<tr><td><code>00000000</code></td><td><code>00000001</code></td><td><code>00000001</code></td><td><code>00000001</code></td></tr>
<tr><td><code>00000000</code></td><td><code>00000000</code></td><td><code>00000000</code></td><td><code>00000000</code></td></tr>
<tr><td><code>11111111</code></td><td><code>00000000</code></td><td><code>11110000</code></td><td><code>11111111</code></td></tr>
<tr><td><code>11111111</code></td><td><code>10000000</code></td><td><code>11110000</code></td><td><code>01111111</code></td></tr>
</table></div>
<p>gselect 4/4 concatenates the low 4 bits of the address with the low 4 bits of the history, so it drops the upper history bit that tells the last two cases apart and sends both to one counter. gshare 8/8 XORs all 8 bits of each and gives all four cases their own counter. At a realistic size the same holds: with a 14-bit index, gshare can use 14 PC bits <em>and</em> 14 history bits, where gselect would have to split them, say 7 and 7.</p>
<p>gshare can also use fewer history bits than address bits. The history is then XORed into the higher-order address bits, which are sparser than the low ones, so they waste less of the index.</p>
<p>Comparing the best history length for each, gshare-best beats gselect-best by a small margin at 256 B and above. Below 256 B it is worse: different branches already contend heavily for the few counters, and mixing in global history makes the contention worse.</p>
<p>The cost is a new kind of collision. Under gselect, two branches whose n PC bits differ never share a counter. Under gshare, (PC<sub>1</sub>, H<sub>1</sub>) and (PC<sub>2</sub>, H<sub>2</sub>) collide whenever PC<sub>1</sub> ⊕ PC<sub>2</sub> = H<sub>1</sub> ⊕ H<sub>2</sub>, which can happen between any two branches.</p>

<h4 id="sec-mcf-combining">Combining Branch Predictors</h4>
<p>Since each scheme wins on different branches, McFarling's second idea is to run two predictors of any kind side by side and add a PC-indexed array of 2-bit counters that tracks which one has been more accurate for each branch. The structure and its update rule are in <a href="#/fe-classic/tournament">Tournament Predictors</a>. Here are his results.</p>
<p>His main pairing is <strong>bimodal/gshare</strong>: global information is used where it helps, and the bimodal prediction otherwise. The gshare half uses as many history bits as address bits, the most global information it can hold, because diluting the address information no longer matters when bimodal is always there as a fallback. The same reason makes gshare a better partner than gselect. With each of the three arrays holding 1K counters (3 arrays × 1024 counters × 2 bits = 768 B) and every benchmark run to completion:</p>
<ul>
<li><strong>Accuracy:</strong> the combination beats both of its components on every benchmark. On eqntott, gshare is far better than bimodal (about 94% against about 82%), and the combination matches gshare.</li>
<li><strong>Which side predicts:</strong> bimodal supplies most predictions, about 75% on average and nearly all of them on matrix300 and nasa7. eqntott is the exception, with gshare supplying most. The choice is made per branch, so within one benchmark some branches use bimodal and others gshare.</li>
<li><strong>Mispredictions spread out:</strong> the number of instructions between mispredicted branches rises, most on the less predictable benchmarks such as gcc.</li>
</ul>
<p>Across sizes, McFarling gives the gshare array twice the counters of the other two (bimodalN/gshareN+1), so the total is a whole number of bytes and the selector's cost is spread over more counters. This predictor is significantly better than gselect-best: a 1 KB combined predictor does about as well as a 16 KB gselect-best one. From 2 KB up, a <strong>local/gshare</strong> combination does better still, approaching 98.1% in large sizes, since a large local predictor already captures everything a bimodal one does. His conclusion is that predictors needing only one level of table access, such as gselect, gshare, and bimodal/gshare, beat the two-level local schemes at all but the largest sizes.</p>

<h3 id="sec-aliasing">Aliasing</h3>
<p>Bimodal, correlating, and gshare tables have no tags, so any two (branch, history) pairs that map to one counter share it. This is <strong>aliasing</strong>, and its effect depends on the two branches:</p>
<ul>
<li><strong>Destructive:</strong> the two go opposite ways, so each drags the counter away from the other's direction and both mispredict more.</li>
<li><strong>Constructive:</strong> the two go the same way, so one trains the counter for the other. This sometimes helps a cold branch.</li>
<li><strong>Neutral:</strong> the sharing changes no prediction.</li>
</ul>
<p>Young, Gloy, and Smith (1995) measured that destructive aliasing dominates. Michaud, Seznec, and Uhlig (1997) borrowed the cache's three Cs. <em>Compulsory</em> aliasing is a first use of an entry. <em>Capacity</em> aliasing means the table is too small for the working set of (branch, history) pairs. <em>Conflict</em> aliasing means the index function maps too many pairs to the same entry while others sit idle. History makes aliasing worse, because each branch now occupies one entry per history pattern it has seen instead of one entry in total.</p>
<p>The fixes match the causes:</p>
<ul>
<li><strong>Capacity:</strong> bigger tables, which run into the access-time limit of a single-cycle predictor.</li>
<li><strong>Conflict:</strong> better index functions, and skewed predictors (gskew) that read several banks with different hashes and take a majority vote, so two branches that collide in one bank rarely collide in the others.</li>
<li><strong>Turning destructive into constructive:</strong> the <strong>agree</strong> predictor (Sprangle et al., 1997) stores a bias bit per branch, usually in the BTB, and the counters predict whether the branch will <em>agree</em> with its bias. Two strongly biased branches with opposite directions both agree with their own bias, so they push a shared counter the same way. The <strong>bi-mode</strong> predictor (Lee, Chen, and Mudge, 1997) splits the counters into a taken-biased half and a not-taken-biased half and uses a bimodal choice table to send each branch to the matching half.</li>
<li><strong>Tags:</strong> the step TAGE takes, which turns a collision into a detected miss instead of a silent wrong answer.</li>
</ul>

<h3 id="sec-tournament">Tournament Predictors</h3>
<p>Local history is better for some branches, global history for others, and a single table has to pick one history for all of them. A <strong>tournament</strong> (McFarling's <em>combining</em>) predictor runs two component predictors side by side and adds a third table, the <strong>chooser</strong>, of 2-bit counters that decides per branch which component to believe.</p>
<p>The update rule is the part people get wrong:</p>
<ol>
<li>Both components always train on the real outcome.</li>
<li>The chooser trains only when the components <em>disagreed</em>. It counts toward whichever one was right.</li>
<li>When both were right or both were wrong, the outcome says nothing about which component is better, so the chooser is left alone.</li>
</ol>
<p>McFarling's version combined bimodal and gshare, with the chooser indexed by PC. A side effect is fast warm-up. Bimodal trains in a couple of outcomes, while gshare needs one trained counter per history pattern, so after a context switch the chooser leans on bimodal first and moves to gshare as it fills.</p>
<p>The <strong>Alpha 21264</strong> (Kessler, 1999) shipped the best-known tournament predictor:</p>
<ul>
<li><strong>Local component:</strong> 1024 entries of 10-bit local history, indexing 1024 3-bit counters.</li>
<li><strong>Global component:</strong> 4096 2-bit counters, indexed by 12 bits of global history.</li>
<li><strong>Chooser:</strong> 4096 2-bit counters, indexed by the same 12-bit global history, so the choice itself can depend on the path.</li>
<li><strong>Total:</strong> 1024 entries × 10 bits + 1024 counters × 3 bits + 4096 counters × 2 bits + 4096 counters × 2 bits = 29,696 bits, about 29 Kbits.</li>
</ul>
<p>Hennessy and Patterson's Section 3.3 comparison shows tournament predictors beating correlating predictors of the same size on SPEC89, by the largest margin at small budgets. Later designs kept the idea of several components plus a selection rule. Hennessy and Patterson describe the Intel Core i7 920's predictor as combining a 2-bit predictor, a global history predictor, and a loop exit predictor, and TAGE's provider and alternate predictions are a generalized chooser.</p>

<h3 id="sec-summary">What Each Predictor Captures</h3>
<div class="tbl"><table>
<tr><th>Predictor</th><th>Information it uses</th><th>Learns</th><th>Fails on</th></tr>
<tr><td>Bimodal</td><td>PC</td><td>Each branch's bias</td><td>Any branch whose direction changes</td></tr>
<tr><td>Local two-level</td><td>The branch's own last k outcomes</td><td>Short repeating patterns and loop exits up to k</td><td>Correlation with other branches</td></tr>
<tr><td>Correlating or gshare</td><td>PC and global history</td><td>Correlation with the last m branches</td><td>Correlation older than m, and branches whose patterns alias</td></tr>
<tr><td>Tournament</td><td>Both, plus a chooser</td><td>Per branch, the better of two components</td><td>Branches neither component predicts</td></tr>
</table></div>

<h3 id="sec-size">When Bigger Tables Stop Helping</h3>
<p>Every curve of misprediction rate against predictor size has the same shape: a steep drop while the table is too small for the program's branches, then a flat tail. Hennessy and Patterson show it twice. In Appendix C.2, a 4096-entry bimodal table and an infinite one mispredict at essentially the same rate on every SPEC89 program. In Section 3.3, the local, correlating, and tournament predictors all flatten as their total storage grows, with the tournament predictor lowest at every size. Adding bits stops paying for four reasons:</p>
<ul>
<li><strong>The information runs out before the capacity does.</strong> Once every hot static branch has its own counter, the remaining mispredictions come from branches whose outcome isn't a function of what the predictor looks at. More entries indexed by the same PC and history can only repeat the same guess. This is why Hennessy and Patterson's (2, 2) correlating predictor beats an infinite bimodal table: it adds information, not entries.</li>
<li><strong>Longer history dilutes training.</strong> The usual way to spend a bigger budget is more history bits, but each extra bit can double the number of (branch, history) patterns a branch spreads over. Each counter then sees fewer outcomes and takes longer to train, and history bits that don't correlate with the branch add noise that splits one well-trained counter into many cold ones. Juan, Sanjeevan, and Navarro (1998) found that the best history length differs per program and that going past it raises the misprediction rate. TAGE answers this by keeping several history lengths at once and choosing per branch (see <a href="#/fe-direction/tage">TAGE</a>).</li>
<li><strong>Bigger tables are slower.</strong> Access time grows with table size, and a prediction is needed every cycle to fetch the next block. Jiménez, Keckler, and Lin (2000) showed that once delay is counted, a large predictor that can't answer in one cycle can lose to a smaller one that can. Real designs pair a small fast predictor with a large slow one that overrides it (see <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>).</li>
<li><strong>Bigger tables warm up more slowly.</strong> After a context switch or phase change, a large history-indexed table needs many outcomes before most of its counters are trained, so short-running or frequently switched code sees little of the extra capacity.</li>
</ul>
<p>The one place size keeps helping is a large code footprint: when there are more hot branches than entries, the misses are capacity aliasing, and a bigger table removes them. That is the server-workload case below.</p>

<h3 id="sec-workloads">Where They Work and Where They Fail</h3>
<p>How well a predictor does depends far more on the program than on the predictor. Hennessy and Patterson's SPEC89 numbers for a 4096-entry 2-bit table make the split plain: the floating-point programs nasa7, matrix300, and tomcatv mispredict about 1% of branches or less, while the integer programs gcc, li, and eqntott mispredict 12%, 10%, and 18%. Their Core i7 data on SPEC CPU2006 shows the same split with a modern predictor: the integer benchmarks mispredict more often than the floating-point ones. Integer programs also execute more branches per instruction, so the gap in mispredictions per 1000 instructions is wider than the gap in rates.</p>
<p>Predictors do best on:</p>
<ul>
<li><strong>Loop-heavy scientific and floating-point code.</strong> Most branches are loop back edges with long trip counts, taken nearly every time, so even a bimodal counter misses only the exit.</li>
<li><strong>Strongly biased branches.</strong> Error checks, bounds checks, and null tests almost always go one way, and a 2-bit counter learns them in one or two outcomes.</li>
<li><strong>Branches that follow a fixed pattern or other branches.</strong> Short loops with a constant trip count, and branches that test the same condition as an earlier branch, are what local history, gshare, and TAGE capture.</li>
</ul>
<p>They do worst on:</p>
<ul>
<li><strong>Branches on unpredictable data.</strong> A test such as <code>if (x[i] &gt;= threshold)</code> on random input, a comparison in a sort or binary search, a hash-table probe, or a decision in a compressor goes either way with no pattern in any history, so every predictor mispredicts it close to half the time. The same loop over sorted input predicts almost perfectly. The fix is in the code, not the predictor: branchless code (a conditional move or predication) turns the control dependence into a data dependence.</li>
<li><strong>Integer code with irregular control flow.</strong> Compilers, interpreters, and logic tools have many branches that depend on the input being processed, which is why gcc, li, and eqntott sit at the top of Hennessy and Patterson's table.</li>
<li><strong>Large code footprints.</strong> Server and datacenter workloads touch so many static branches that the tables thrash. That is capacity aliasing rather than an information limit (Ferdman et al., 2012, measured how large these instruction footprints are), so here bigger tables, and bigger BTBs, keep paying off.</li>
<li><strong>Frequent context switches and short phases.</strong> The tables never finish training, and the history-based components suffer most, which is why a tournament chooser leans on bimodal right after a switch.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 5th ed., Appendix C.2 (2-bit prediction schemes) and Section 3.3 (correlating and tournament predictors, and the Intel Core i7 predictor) · McFarling, "Combining Branch Predictors," DEC WRL TN-36, 1993 · Yeh and Patt, "Two-Level Adaptive Training Branch Prediction," MICRO 1991 · Pan, So, and Rahmeh, "Improving the Accuracy of Dynamic Branch Prediction Using Branch Correlation," ASPLOS 1992 · Young, Gloy, and Smith, "A Comparative Analysis of Schemes for Correlated Branch Prediction," ISCA 1995 · Michaud, Seznec, and Uhlig, "Trading Conflict and Capacity Aliasing in Conditional Branch Predictors," ISCA 1997 · Sprangle, Chappell, Alsup, and Patt, "The Agree Predictor," ISCA 1997 · Lee, Chen, and Mudge, "The Bi-Mode Branch Predictor," MICRO 1997 · Kessler, "The Alpha 21264 Microprocessor," IEEE Micro, 1999 · Juan, Sanjeevan, and Navarro, "Dynamic History-Length Fitting: A Third Level of Adaptivity for Branch Prediction," ISCA 1998 · Jiménez, Keckler, and Lin, "The Impact of Delay on the Design of Branch Predictors," MICRO 2000 · Ferdman et al., "Clearing the Clouds: A Study of Emerging Scale-Out Workloads on Modern Hardware," ASPLOS 2012</p>`,
  practice: {
    guided: [
      {
        q: `<p>A tournament predictor combines a bimodal component and a gshare component that uses 1 bit of global history. All 2-bit counters predict taken at 2 or 3. The bimodal counter starts at 2, both gshare counters (history 0 and history 1) start at 2, and the history starts at 0. The chooser counter starts at 1, where 0 and 1 select bimodal and 2 and 3 select gshare. It trains only when the components disagree. One branch runs alone, so the history bit is its own last outcome, and it alternates T, N, T, N, … starting with T. Trace the first 6 executions (numbered 0 to 5). How many mispredict, and what happens after that?</p>`,
        a: `<ol><li>Execution 0, outcome T, history 0. Bimodal (2) predicts T and moves to 3. Gshare counter for history 0 (2) predicts T and moves to 3. They agree, so the chooser stays at 1. The chosen bimodal prediction is correct. History becomes 1.</li><li>Execution 1, outcome N, history 1. Bimodal (3) predicts T and drops to 2. Gshare counter for history 1 (2) predicts T and drops to 1. Both are wrong, so the chooser stays at 1. <strong>Mispredict.</strong> History becomes 0.</li><li>Execution 2, outcome T, history 0. Bimodal (2) predicts T and moves to 3. Gshare counter for history 0 (3) predicts T and stays at 3. Both are right, so the chooser stays at 1. Correct. History becomes 1.</li><li>Execution 3, outcome N, history 1. Bimodal (3) predicts T and drops to 2. Gshare counter for history 1 (1) predicts N and drops to 0. They disagree and gshare was right, so the chooser moves from 1 to 2. The prediction used was the chooser's old choice, bimodal, so this is a <strong>mispredict</strong>. History becomes 0.</li><li>Execution 4, outcome T, history 0. Both predict T and are right, and the chooser (2) now selects gshare. Correct.</li><li>Execution 5, outcome N, history 1. Bimodal (3) predicts T, gshare (0) predicts N. They disagree, gshare is right, and the chooser moves to 3. The chosen gshare prediction is correct.</li><li>Total: <strong>2 mispredicts</strong> in 6 executions. From then on gshare predicts every outcome, the chooser saturates at 3, and the predictor never mispredicts again, even though bimodal keeps mispredicting every N. The chooser moved only on executions 3 and 5, the two where the components disagreed.</li></ol>`
      },
      {
        q: `<p>The Alpha 21264's local component uses 3-bit counters that predict taken at 4 or more, and its global component uses 2-bit counters that predict taken at 2 or 3. Compare one 2-bit counter that starts at 3 with one 3-bit counter that starts at 7, each predicting one branch by itself.</p>
<ol>
<li>Branch A is taken 300 times, then not taken 300 times, then taken 300 times. How many of its 900 executions does each counter mispredict?</li>
<li>Branch B repeats a 50-execution pattern: 48 taken, then 2 not taken. In steady state, how many mispredictions per 50 executions does each counter make?</li>
<li>What do the two results say about widening the counter?</li>
</ol>`,
        a: `<ol>
<li>Branch A, 2-bit counter. The first 300 taken outcomes keep it at 3 with no misses. At the switch to not taken, it predicts taken at 3 (miss, down to 2) and at 2 (miss, down to 1), then predicts not taken from 1 on and ends the phase at 0. At the switch back, it predicts not taken at 0 (miss, up to 1) and at 1 (miss, up to 2), then predicts taken. Total: 2 mispredictions + 2 mispredictions = <strong>4 mispredictions</strong> in 900 executions.</li>
<li>Branch A, 3-bit counter. At the switch to not taken, it predicts taken at 7, 6, 5, and 4, so it misses 4 times before reaching 3, where it predicts not taken. It ends the phase at 0. At the switch back, it predicts not taken at 0, 1, 2, and 3, missing 4 more times. Total: 4 mispredictions + 4 mispredictions = <strong>8 mispredictions</strong> in 900 executions. Each phase change costs 2<sup>n−1</sup> mispredictions: 2<sup>1</sup> = 2 for n = 2 bits, 2<sup>2</sup> = 4 for n = 3 bits.</li>
<li>Branch B, 2-bit counter. The 48 taken outcomes leave it at 3. The first not-taken outcome is predicted taken at 3 (miss, down to 2), and the second is predicted taken at 2 (miss, down to 1). The next taken outcome is predicted not taken at 1 (miss, up to 2), and from there it predicts taken and returns to 3. That is <strong>3 mispredictions per 50 executions</strong>, a rate of 3 mispredictions / 50 executions = 6%.</li>
<li>Branch B, 3-bit counter. From 7, the two not-taken outcomes are both predicted taken (misses, down to 6 and then 5). At 5 it still predicts taken, so the next taken outcome is correct, and it climbs back to 7. That is <strong>2 mispredictions per 50 executions</strong>, a rate of 2 mispredictions / 50 executions = 4%.</li>
<li>Conclusion. A wider counter helps only when anomalies come in short runs, longer than 1 outcome but shorter than 2<sup>n−1</sup> outcomes, like Branch B's pair. It costs twice as much on every real change of direction, like Branch A's phases. That trade is why Hennessy and Patterson find n-bit counters little better than 2-bit ones, and why 3-bit counters show up only in specific components, such as the 21264's local table and TAGE's tagged entries.</li>
</ol>`
      },
      {
        q: `<p>A predictor has a 6-bit counter index. Bit 0 is the least significant bit everywhere, and the global history holds the newest outcome in bit 0. Two branches, A and B, have these 6 PC bits (taken after dropping the byte offset) and each arrives with the histories shown:</p>
<div class="tbl"><table>
<tr><th>Pair</th><th>Branch</th><th>PC bits</th><th>History</th></tr>
<tr><td>1</td><td>A</td><td><code>010110</code></td><td><code>000011</code></td></tr>
<tr><td>2</td><td>A</td><td><code>010110</code></td><td><code>100011</code></td></tr>
<tr><td>3</td><td>B</td><td><code>110110</code></td><td><code>000011</code></td></tr>
<tr><td>4</td><td>B</td><td><code>110110</code></td><td><code>010101</code></td></tr>
</table></div>
<ol>
<li>Compute each pair's index under gselect 3/3 (the low 3 PC bits followed by the low 3 history bits) and under gshare 6/6 (all 6 PC bits XOR all 6 history bits). Which pairs share a counter under each?</li>
<li>Could any other gselect split of the 6 index bits give all four pairs their own counter?</li>
<li>Explain gshare's one collision using the collision condition from the page.</li>
</ol>`,
        a: `<ol>
<li>gselect 3/3. A's low 3 PC bits are <code>110</code>, and so are B's. The low 3 history bits are <code>011</code> for pairs 1, 2, and 3, and <code>101</code> for pair 4. The indices are <code>110011</code> for pairs 1, 2, and 3, and <code>110101</code> for pair 4. <strong>Three of the four pairs share one counter.</strong></li>
<li>gshare 6/6, one XOR per pair:
<ul>
<li>Pair 1: <code>010110</code> ⊕ <code>000011</code> = <code>010101</code></li>
<li>Pair 2: <code>010110</code> ⊕ <code>100011</code> = <code>110101</code></li>
<li>Pair 3: <code>110110</code> ⊕ <code>000011</code> = <code>110101</code></li>
<li>Pair 4: <code>110110</code> ⊕ <code>010101</code> = <code>100011</code></li>
</ul>
<strong>Only pairs 2 and 3 share a counter</strong>, so gshare uses 3 counters where gselect uses 2.</li>
<li>Other gselect splits. A and B differ only in PC bit 5, and pairs 1 and 2 differ only in history bit 5. A gselect index with k PC bits and 6 − k history bits includes PC bit 5 only when k = 6 bits (pure bimodal, no history) and history bit 5 only when k = 0 bits (pure global, no address). No split includes both, so <strong>no gselect split separates all four pairs</strong>. This is McFarling's point: the distinguishing information sits in bits that a concatenation of the same width has to drop.</li>
<li>gshare's collision. Two pairs collide when PC<sub>1</sub> ⊕ PC<sub>2</sub> = H<sub>1</sub> ⊕ H<sub>2</sub>. Here PC<sub>A</sub> ⊕ PC<sub>B</sub> = <code>010110</code> ⊕ <code>110110</code> = <code>100000</code>, and H<sub>2</sub> ⊕ H<sub>3</sub> = <code>100011</code> ⊕ <code>000011</code> = <code>100000</code>. They match, so pairs 2 and 3 meet in counter <code>110101</code>. Whether that hurts depends on the outcomes: if both pairs usually go the same way the aliasing is constructive or neutral, and if they go opposite ways it is destructive.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your tournament predictor's chooser is indexed by PC, as in McFarling's design. One hot branch in a shared library is called from two places. Called from one, it follows global history closely. Called from the other, it follows only its own local pattern. Assume the two callers interleave in roughly equal numbers. What does the PC-indexed chooser do with this branch, and how would you change the design?</p>`,
        a: `<p>Assume both components are big enough that the branch's entries don't alias with other branches. A PC-indexed chooser has one counter for the branch, so it sees a mix of disagreements where global was right (calls from the first site) and where local was right (calls from the second). It drifts toward whichever wins more disagreements overall, or wanders between them, and the branch ends up predicted by the wrong component for about half of its executions.</p><p>The fix is to let the choice depend on context. Index the chooser with global history, as the Alpha 21264 did, or with PC XOR history. The two call sites leave different recent outcomes in the history, so they reach different chooser counters and each learns its own choice. The cost is that the chooser now aliases and trains like a gshare table, so it needs more entries and warms up more slowly. The more general answer is TAGE, which drops the fixed two-way choice and lets a tagged entry for each history length compete per context.</p>`
      },
      {
        q: `<p>A filter loop runs <code>if (x[i] &lt; t) out[k++] = x[i];</code> over 16,777,216 bytes drawn uniformly and independently from 0 to 255. On your core, the branchy version takes 1.0 cycles/element when the branch is predicted perfectly, a mispredict costs 17 cycles, and a branchless version (a conditional move and an unconditional store) takes 1.6 cycles/element no matter what. Assume the loop's own back-edge branch is always predicted correctly and the filter branch gets a 2-bit counter in a predictor with no aliasing. Compare the two versions in total cycles for t = 128 and for t = 250, and give the mispredict rate at which they break even. What happens to the t = 128 case if the input is sorted first?</p>`,
        a: `<p>Assume no other stalls, so the 17-cycle penalty is the whole cost of a mispredict.</p>
<ul>
<li><strong>t = 128.</strong> The branch is taken with probability 128 values / 256 values = 50%, independently each time. Neither the counter nor any history can learn anything, so assume it mispredicts 50% of the time. Branchy: 16,777,216 elements × (1.0 cycles/element + 128/256 mispredicts/element × 17 cycles/mispredict) = 159,383,552 cycles. Branchless: 16,777,216 elements × 1.6 cycles/element = 26,843,545.6 cycles. The branchless version is about 5.9× faster.</li>
<li><strong>t = 250.</strong> The branch is taken with probability 250/256, so the counter sits in its taken half. A lone not-taken outcome only drops it to weak taken. Assume two rare outcomes in a row are negligible, since that has probability (6/256)<sup>2</sup> ≈ 0.05% per element. Then it mispredicts only the 6/256 not-taken outcomes. Branchy: 16,777,216 elements × (1.0 cycles/element + 6/256 mispredicts/element × 17 cycles/mispredict) = 23,461,888 cycles. Branchless is unchanged at 26,843,545.6 cycles, so <strong>the branchy version wins</strong>: branchless takes 26,843,545.6 cycles / 23,461,888 cycles ≈ 1.14× as long.</li>
<li><strong>Break-even.</strong> 1.0 cycles/element + p × 17 cycles/mispredict = 1.6 cycles/element gives p = (1.6 cycles/element − 1.0 cycles/element) / 17 cycles/mispredict ≈ 3.5% mispredicts/element. A data-dependent branch is worth keeping only when its data is biased enough to stay below that.</li>
<li><strong>Sorted input, t = 128.</strong> The branch becomes 8,388,608 taken outcomes followed by 8,388,608 not-taken outcomes. The 2-bit counter mispredicts about twice at the switch, so branchy takes about 16,777,216 elements × 1.0 cycles/element = 16,777,216 cycles plus 2 mispredicts × 17 cycles/mispredict. It beats branchless by about 1.6×. The data, not the predictor, decides which version is faster, and no larger or smarter predictor would rescue the random case.</li>
</ul>`
      },
      {
        q: `<p>In your simulator, doubling a gshare table from 16K to 32K 2-bit counters (4 KB to 8 KB) changes MPKI (mispredictions per 1000 instructions) very differently on two traces. Both runs use the same 14 bits of history and fully warmed tables, and each measures 200 million instructions:</p>
<ul>
<li><strong>505.mcf_r:</strong> 9.80 MPKI to 9.74 MPKI.</li>
<li><strong>A web-search leaf server trace, with about 40,000 static conditional branches executed in the window:</strong> 6.1 MPKI to 4.9 MPKI.</li>
</ul>
<p>Explain the difference, describe the experiments that would confirm your explanation, and say what you would try next on each workload.</p>`,
        a: `<p>The two traces are limited by different things. mcf is limited by information and the server trace by capacity.</p>
<ul>
<li><strong>mcf.</strong> Its hot code is small, so 16K counters already hold its (branch, history) pairs, and the extra 16K counters remove almost no aliasing: 9.80 MPKI − 9.74 MPKI = 0.06 MPKI. Its mispredictions come from branches on data it loads while chasing pointers through a large graph, such as cost comparisons, so no PC-and-history index can predict them.</li>
<li><strong>Server trace.</strong> 40,000 static branches, each seen with several histories, are far more pairs than 16K counters can hold. The misses are capacity and conflict aliasing, so doubling the table removes many of them: 6.1 MPKI − 4.9 MPKI = 1.2 MPKI, about 20% of the original 6.1 MPKI.</li>
</ul>
<p>To confirm it:</p>
<ol>
<li>Run an aliasing-free version, with one counter per distinct (PC, history) pair in an unbounded map. If mcf stays near 9.7 MPKI, its limit is information. If the server trace falls well below 4.9 MPKI, more capacity, or tags, would keep paying off.</li>
<li>Count the distinct (PC, history) pairs each trace touches, and the share of predictions made by a counter that a different pair trained last. That share should be high for the server trace and low for mcf.</li>
<li>Rank static branches by mispredictions. mcf's should concentrate in a handful of data-dependent branches that mispredict at a high rate even with no aliasing. The server trace's should spread across many branches that are individually predictable.</li>
</ol>
<p>Next steps. For mcf, a bigger table won't help. Try more information instead, such as TAGE's longer histories or a statistical corrector, and accept that some branches stay near their data's entropy. The real fix there is often in software: branchless code or a data layout that makes the outcomes regular. For the server trace, try bigger or tagged tables (TAGE turns silent collisions into detected misses) and better index hashing. Check that the 8 KB table still fits the predictor's cycle budget, or put it behind a fast first-level predictor that it overrides. Also check the BTB: a footprint this large usually overflows it too.</p>`
      },
      {
        q: `<p>You are adding a first-level direction predictor to a decoupled front end. It must answer in one cycle and has a budget of 64 B. The hot code has about 1,500 static conditional branches. The candidates are:</p>
<ul>
<li>Bimodal: 256 2-bit counters.</li>
<li>Local: 64 history entries of 6 bits each indexing 64 2-bit counters (64 entries × 6 bits/entry + 64 counters × 2 bits/counter = 512 bits = 64 B).</li>
<li>gshare: 256 2-bit counters indexed by 8 PC bits XOR 8 history bits.</li>
</ul>
<p>Which do you choose, and why do the other two lose at this size? Which would you choose if the budget grew to 8 KB and the one-cycle constraint were lifted?</p>`,
        a: `<p>Choose <strong>bimodal</strong>. Assume the branches spread evenly over the index bits, and that "hot" means each of the 1,500 branches runs often enough to train a counter.</p>
<ul>
<li><strong>Why bimodal wins at 64 B.</strong> Even it is crowded: 1,500 branches / 256 counters ≈ 5.9 branches/counter. It survives because most branches are strongly biased, so branches sharing a counter often push it the same way. Its PC bits are the most efficient information at this size, as McFarling's information-content argument says.</li>
<li><strong>Why local loses.</strong> 1,500 branches / 64 history entries ≈ 23 branches/entry, so each stored history is a mix of about 23 branches' outcomes and describes none of them. This is McFarling's history contention, and it is why his local predictor falls below bimodal under about 128 B. It also needs two dependent table reads, which makes one cycle hard to meet.</li>
<li><strong>Why gshare loses.</strong> It has the same 256 counters as bimodal, but each branch now spreads over one counter per history value it sees. A table already shared by about 5.9 branches per counter gets more crowded, and destructive aliasing rises. McFarling found that gshare loses to gselect below 256 B, and that gselect tracks bimodal at small sizes.</li>
</ul>
<p>At <strong>8 KB</strong>, that is 8 KB × 8 bits/B / 2 bits/counter = 32,768 counters, about 22 counters per branch. Bimodal stops improving once every branch has its own counter, so the extra space should buy history. Among the designs on this page, choose a combined predictor, either bimodal/gshare or, at this size, local/gshare, which McFarling found best from 2 KB up. A modern design would use TAGE instead. Either way, a predictor this large will likely take more than one cycle, so keep the 64 B bimodal as the fast first level and let the large predictor override it.</p>`
      }
    ]
  }
},

{
  id: "fe-direction",
  region: "fe",
  title: "Modern Direction Predictors",
  sections: [
    { id: "perceptron", label: "Perceptron Predictors" },
    { id: "separability", label: "The Linear-Separability Limit" },
    { id: "tage", label: "TAGE" },
    { id: "extras", label: "Loop and Statistical Correctors" },
    { id: "update", label: "Speculative History and Repair" },
    { id: "model", label: "Modeling a Predictor" }
  ],
  body: `
<p>The predictors on <a href="#/fe-classic">Classic Direction Predictors</a> index untagged counter tables with a fixed amount of history, so they force one history length on every branch and can't tell when two branches collide. This page covers the designs that fixed both problems. Perceptrons use long histories at linear cost, TAGE uses many history lengths at once with tags, and side predictors cover what TAGE misses. It ends with the parts of a predictor a model has to get right: speculative history and update timing.</p>

<h3 id="sec-perceptron">Perceptron Predictors</h3>
<p>A perceptron predictor (Jiménez and Lin, 2001) replaces the table of counters with a table of small weight vectors, one vector per branch (selected by PC), with one signed weight per history bit plus a bias weight. It treats each history bit as a vote, and learns how much each vote counts.</p>
<ul>
<li><strong>Inputs:</strong> x<sub>0</sub> = 1 for the bias, and x<sub>1</sub> … x<sub>h</sub> are the last h global outcomes, with taken = +1 and not taken = −1.</li>
<li><strong>Prediction:</strong> y = w<sub>0</sub> + Σ w<sub>i</sub> x<sub>i</sub> over i = 1 … h. Predict taken when y ≥ 0. Because every x<sub>i</sub> is ±1, each product is just w<sub>i</sub> or −w<sub>i</sub>, so the hardware is a conditional negate per weight and an adder tree.</li>
<li><strong>Training:</strong> with t = +1 for taken and −1 for not taken, update when the prediction was wrong <em>or</em> when |y| ≤ θ. The update is w<sub>i</sub> ← w<sub>i</sub> + t x<sub>i</sub> for every i, saturating at the weight width (8-bit signed weights in the paper). A weight grows when its history bit agrees with the outcome and shrinks when it disagrees.</li>
<li><strong>Threshold:</strong> θ keeps training going until the prediction has a margin, so one unusual outcome can't flip it. Jiménez and Lin found the best value empirically, θ = ⌊1.93 h + 14⌋. It grows with h because the noise from the weights of uncorrelated history bits grows with the number of bits.</li>
</ul>
<p>Each weight's sign says which way its history bit pushes and its magnitude says how strongly, so the trained weights show directly which earlier branches the prediction depends on. Weights for uncorrelated bits stay near 0.</p>
<p>The main strength is storage. A perceptron costs (h + 1) weights, so storage grows linearly with history length, where a gshare table indexed by h history bits needs 2<sup>h</sup> counters. At h = 40 with 8-bit weights, each perceptron is 41 bytes, θ = ⌊1.93 × 40 + 14⌋ = 91, and a 4 KB budget holds 4096 bytes / 41 bytes ≈ 99 perceptrons. A gshare predictor with the same 4 KB holds 4096 bytes × 8 bits/byte / 2 bits/counter = 16,384 counters, a 14-bit index, so it can't use more than 14 history bits without folding them. The perceptron's weakness is the other half of that trade: 99 perceptrons for hundreds of hot branches means heavy aliasing between branches.</p>
<p>Latency is the practical problem. An adder tree over h + 1 weights has about log<sub>2</sub>(h + 1) levels, which takes several cycles at a high clock. Two refinements fix it:</p>
<ul>
<li><strong>Path-based perceptrons</strong> (Jiménez, 2003) pick each weight by the address of the branch at that history position and accumulate the sum ahead of time, branch by branch, so only the last addition is on the critical path.</li>
<li><strong>Hashed perceptrons</strong> (Tarjan and Skadron, 2005) index several weight tables with hashes of the PC and different history segments and sum one weight from each. Fewer, wider-reaching weights per prediction mean a shorter adder tree and less aliasing between branches. AMD has described its Zen predictors as perceptron-based.</li>
</ul>
<p>Even then, perceptrons usually sit in the slower, overriding level of the predictor (see <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>).</p>

<h3 id="sec-separability">The Linear-Separability Limit</h3>
<p>A perceptron can only learn outcomes that are a <strong>linearly separable</strong> function of the history: taken exactly when a weighted vote of the history bits passes a threshold. That covers a lot. It learns "same as the branch 5 back," "taken if either of two branches was taken" (OR), "taken if both were" (AND), and majority votes over many bits, and it ignores the noise of everything else.</p>
<p>It can't learn XOR. Suppose a branch is taken exactly when one of two earlier outcomes x<sub>1</sub> and x<sub>2</sub> was taken, and the other history bits are uncorrelated, so their weights go to 0. The perceptron would need:</p>
<ol>
<li>x<sub>1</sub> = +1, x<sub>2</sub> = +1, not taken: w<sub>0</sub> + w<sub>1</sub> + w<sub>2</sub> &lt; 0.</li>
<li>x<sub>1</sub> = −1, x<sub>2</sub> = −1, not taken: w<sub>0</sub> − w<sub>1</sub> − w<sub>2</sub> &lt; 0.</li>
<li>x<sub>1</sub> = +1, x<sub>2</sub> = −1, taken: w<sub>0</sub> + w<sub>1</sub> − w<sub>2</sub> ≥ 0.</li>
<li>x<sub>1</sub> = −1, x<sub>2</sub> = +1, taken: w<sub>0</sub> − w<sub>1</sub> + w<sub>2</sub> ≥ 0.</li>
</ol>
<p>Adding inequalities 1 and 2 gives 2w<sub>0</sub> &lt; 0. Adding 3 and 4 gives 2w<sub>0</sub> ≥ 0. No weights satisfy both, so training never converges and the branch stays near 50% mispredicted however long the history is. The same holds for any parity-like function.</p>
<p>A table-based predictor has no such limit: gshare or TAGE gives each history pattern its own counter, so it can learn any function of the history, XOR included, as long as the patterns fit in the table. Jiménez and Lin observed that this is exactly where gshare still beat the perceptron. It is the reason designs combine the two kinds, a perceptron-style corrector on top of TAGE (below) or a TAGE behind a perceptron (Zen 2).</p>

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
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 (tagged hybrid predictors) · Jiménez and Lin, "Dynamic Branch Prediction with Perceptrons," HPCA 2001 · Jiménez, "Fast Path-Based Neural Branch Prediction," MICRO 2003 · Tarjan and Skadron, "Merging Path and Gshare Indexing in Perceptron Branch Prediction," ACM TACO, 2005 · Seznec and Michaud, "A Case for (Partially) TAgged GEometric History Length Branch Prediction," JILP 2006 · Seznec, "TAGE-SC-L Branch Predictors," CBP-4, 2014</p>`,
  practice: {
    guided: [
      {
        q: `<p>To keep the arithmetic short, take a perceptron with h = 4 history bits. Its weights are w<sub>0</sub> = 2 (bias), w<sub>1</sub> = 3, w<sub>2</sub> = −1, w<sub>3</sub> = −4, w<sub>4</sub> = 1, and the last four outcomes, newest first, are T, N, T, T. Use θ = ⌊1.93 h + 14⌋. (a) What does it predict? (b) The branch is not taken. Apply the training rule. (c) The same history comes back and the branch is again not taken. Does the perceptron train again?</p>`,
        a: `<ol><li>Inputs: x<sub>0</sub> = +1 (bias), x<sub>1</sub> = +1, x<sub>2</sub> = −1, x<sub>3</sub> = +1, x<sub>4</sub> = +1.</li><li>y = 2 × (+1) + 3 × (+1) + (−1) × (−1) + (−4) × (+1) + 1 × (+1) = 2 + 3 + 1 − 4 + 1 = 3. Since y ≥ 0, it predicts <strong>taken</strong>.</li><li>θ = ⌊1.93 × 4 + 14⌋ = ⌊21.72⌋ = 21.</li><li>Outcome not taken, t = −1. The prediction was wrong, so every weight updates by w<sub>i</sub> ← w<sub>i</sub> + t x<sub>i</sub>: w<sub>0</sub> = 2 + (−1)(+1) = 1, w<sub>1</sub> = 3 + (−1)(+1) = 2, w<sub>2</sub> = −1 + (−1)(−1) = 0, w<sub>3</sub> = −4 + (−1)(+1) = −5, w<sub>4</sub> = 1 + (−1)(+1) = 0.</li><li>Same history again: y = 1 × (+1) + 2 × (+1) + 0 × (−1) + (−5) × (+1) + 0 × (+1) = 1 + 2 + 0 − 5 + 0 = −2, so it now predicts <strong>not taken</strong>, which is correct.</li><li>But |y| = 2 ≤ θ = 21, so it <strong>trains again</strong>, even though it was right.</li><li>Each update moves y for this history by t × (number of inputs) = (−1) × 5 = −5, since every x<sub>i</sub><sup>2</sup> = 1. So y goes −2, −7, −12, −17, −22: after <strong>4 more</strong> not-taken outcomes on this history, |y| = 22 &gt; θ = 21 and training stops. The threshold builds a margin so one stray outcome can't flip the prediction.</li></ol>`
      },
      {
        q: `<p>A TAGE predictor has 12 tagged tables with history lengths from 4 to 640 branches, spaced geometrically. Number the tables 0 to 11, so L(i) = L(0) × α<sup>i</sup>. Find α and the 12 lengths, rounded to whole branches.</p>`,
        a: `<ol><li>L(11) = L(0) × α<sup>11</sup>, so α = (640 / 4)<sup>1/11</sup> = 160<sup>1/11</sup>.</li><li>ln 160 ≈ 5.075, divided by 11 ≈ 0.461, so α ≈ e<sup>0.461</sup> ≈ <strong>1.586</strong>.</li><li>Lengths: 4, 6, 10, 16, 25, 40, 64, 101, 160, 254, 403, 640.</li><li>Half the tables cover histories up to 40 branches, where most correlation lives; the rest reach far back for the rare branches that need it, at no more storage per table.</li></ol>`
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
    { id: "folding", label: "Branch Folding" },
    { id: "indirect", label: "Indirect Branches" },
    { id: "ras", label: "The Return Address Stack" },
    { id: "footprint", label: "Large Code Footprints" }
  ],
  body: `
<p>Knowing a branch is taken is useless without knowing where it goes, and a decoupled predictor has to know both before the instruction bytes are even fetched. Three structures supply targets: the branch target buffer for most branches, an indirect predictor for branches whose target varies, and the return address stack for returns. What each wrong guess costs is on <a href="#/fe-mispredict">Mispredict Cost in Deep Pipelines</a>.</p>

<h3 id="sec-btb">The BTB</h3>
<p>The <strong>branch target buffer</strong> is a cache indexed by fetch address. A hit says "there is a branch at this offset in the block," gives its type (conditional, unconditional, call, return, indirect), and its last target. In a decoupled front end, the BTB is how the predictor finds branches at all: a branch missing from the BTB is invisible, and the predictor carries on sequentially as if it weren't there.</p>
<p>Like caches, BTBs come in levels. A small, fast level gives zero-bubble taken branches; a larger level behind it covers more code at a cycle or more of bubble per taken branch. AMD's Zen 4, for example, has a 1.5K-entry first-level BTB and a 7K-entry second level; Intel's Golden Cove has 12K entries in total. Entries store compressed targets (only the low bits that differ from the branch address for short branches) to fit more of them.</p>
<p>What an entry holds, and why:</p>
<ul>
<li><strong>Tag.</strong> Hennessy and Patterson's BTB matches the full PC, because a hit on an address that isn't a branch would send fetch somewhere wrong. Real first-level BTBs use partial tags to save area. A false hit is caught when decode finds no branch at that offset, so it costs a redirect, never correctness.</li>
<li><strong>Branch type and offset.</strong> The type says which structure supplies the target (the BTB itself, the return stack, or the indirect predictor) and whether to consult the direction predictor. The offset says where in the fetch block the branch ends, so fetch knows how many bytes to use.</li>
<li><strong>Target.</strong> The last target, or the only one for a direct branch.</li>
</ul>
<p>Which branches get an entry is a policy. Hennessy and Patterson's design stores only taken branches, since a not-taken branch just continues to the next sequential PC and an entry for it would waste space. A decoupled front end keeps the same rule at the door: a branch is inserted the first time it is taken, so branches that are never taken never cost an entry. Once inserted, a conditional branch stays even when it goes not taken, because the predictor needs to know it is there to ask the direction predictor about it. BTBs are set-associative and indexed by fetch-block address, and some designs hold two or more branches per entry so one lookup covers a whole fetch block.</p>

<h3 id="sec-misses">BTB Misses and Decode Redirects</h3>
<p>What happens when a branch isn't in the BTB depends on its kind (for a cycle-by-cycle walk through one decode redirect, see <a href="#/branch-hazards/btb">The BTB and Decode Redirects</a>):</p>
<div class="tbl"><table>
<tr><th>Branch</th><th>On a BTB miss</th><th>Cost</th></tr>
<tr><td>Conditional, actually not taken</td><td>Fall-through was right by luck</td><td>None (but nothing trains until it's inserted)</td></tr>
<tr><td>Conditional, actually taken</td><td>Fetch falls through. Decode can redirect if it applies a static guess (backward branches taken); otherwise the branch mispredicts when it executes</td><td>A decode redirect or a full mispredict</td></tr>
<tr><td>Unconditional direct jump or call</td><td>Decode sees the branch, computes the target from the instruction, and redirects fetch</td><td>A <strong>decode redirect</strong>: the front-end depth up to decode, several cycles</td></tr>
<tr><td>Return</td><td>Decode recognizes it and uses the return stack</td><td>Decode redirect</td></tr>
<tr><td>Indirect</td><td>No target until it executes</td><td>A full mispredict</td></tr>
</table></div>
<p>Decode redirects are cheaper than mispredicts because nothing past decode was fetched on the wrong path, but they are frequent on large code and they also stop the predictor from running ahead, which breaks <a href="#/fe-decoupled/fdip">fetch-directed prefetching</a>.</p>

<h3 id="sec-folding">Branch Folding</h3>
<p>Hennessy and Patterson describe a BTB variant that stores the <em>target instruction</em>, or the first few of them, instead of (or alongside) the target address. It buys two things:</p>
<ul>
<li><strong>Slack:</strong> the BTB lookup can take longer than one cycle, because fetch doesn't need the target address in time to read the instruction cache. The instructions arrive with the hit.</li>
<li><strong>Branch folding:</strong> for an unconditional branch, the BTB can hand fetch the target instruction <em>in place of</em> the branch. The branch disappears from the pipeline and takes zero cycles. AT&amp;T's CRISP processor (Ditzel and McLellan, 1987) did this. A conditional branch can be folded the same way on its prediction, but it still has to be checked when it resolves.</li>
</ul>
<p>Modern cores get most of the same effect differently. A zero-bubble first-level BTB lets the predictor follow a taken branch every cycle, the fetch target queue hides any extra lookup latency, and the op cache delivers decoded instructions at the target without going back through decode. Storing instruction bytes in a 16K-entry BTB would cost far more area than storing targets.</p>

<h3 id="sec-indirect">Indirect Branches</h3>
<p>An indirect branch jumps to an address in a register: virtual calls, function pointers, <code>switch</code> statements compiled to jump tables, and interpreter dispatch. A BTB entry holds one target, so it predicts the last target seen. That's fine for a virtual call that almost always reaches the same class, and poor for an interpreter's dispatch jump, which goes to a different handler for every bytecode.</p>
<p>The fix is to let the target depend on context, the way gshare lets direction depend on history. Chang, Hao, and Patt's <strong>target cache</strong> (1997), the design Shen and Lipasti use to introduce the topic, is a table of targets indexed by PC XOR history. It is consulted only for branches the BTB marks as indirect, and its prediction is used in place of the BTB's last target. Two choices matter:</p>
<ul>
<li><strong>Which history.</strong> <em>Pattern history</em> is the global taken/not-taken bits, which works when a conditional branch decides the target (an <code>if</code> that chooses which object to call). <em>Path history</em> is a few low address bits from each of the last several branch targets, which works when the previous targets decide the next one, as in an interpreter where one bytecode's handler predicts the next.</li>
<li><strong>Tagged or tagless.</strong> A tagless table is cheap but aliases, like gshare. A set-associative tagged table only gives a prediction on a real match and otherwise falls back to the BTB.</li>
</ul>
<p>Most indirect branches are monomorphic in practice (one target at run time), and a target cache wastes entries on them. Driesen and Hölzle's <strong>cascaded predictor</strong> (1998) uses a cheap last-target first stage and only allocates a history-indexed entry when the first stage has mispredicted, so only the polymorphic branches use the expensive table.</p>
<p>Indirect predictors in current cores index target tables with global path history, so the same branch can predict different targets on different paths. <strong>ITTAGE</strong> (Seznec, 2011) applies the TAGE idea to targets: tagged tables with geometric history lengths, each entry storing a target instead of a counter. Intel has used history-based indirect prediction since Haswell, which made switch-based interpreters far more predictable than they used to be.</p>

<h3 id="sec-ras">The Return Address Stack</h3>
<p>Returns are indirect branches with a perfect predictor available: the address after the matching call. The <strong>return address stack (RAS)</strong> pushes that address on every predicted call and pops it on every predicted return. 16 to 32 entries per thread is typical.</p>
<ul>
<li><strong>Overflow:</strong> the stack is circular, so deep call chains overwrite the oldest entries, and the returns that reach them mispredict.</li>
<li><strong>Wrong-path corruption:</strong> calls and returns on a mispredicted path push and pop entries. Cores checkpoint the top-of-stack pointer (and often the top entry) per branch and restore them on a mispredict, which repairs almost all of the damage (Skadron et al., 1998).</li>
<li><strong>Non-standard returns:</strong> code that returns somewhere other than its caller (longjmp, some coroutine and exception schemes, return-oriented tricks) mispredicts every time.</li>
</ul>
<p>Without a return stack, returns are among the worst-predicted branches: the BTB holds the target of the last return from that function, which is wrong whenever the function is called from more than one site. Hennessy and Patterson's SPEC CPU95 data show return mispredictions falling steeply over the first few stack entries and leveling off by 8 to 16 entries, since few programs nest calls deeper than that between returns. Today's larger stacks (52 entries on Zen 5, for example) cover deeper call chains in object-oriented and server code and leave room for wrong-path pushes and pops.</p>

<h3 id="sec-footprint">Large Code Footprints</h3>
<p>Datacenter workloads (databases, web servers, JIT-compiled code) execute megabytes of hot code, with many thousands of distinct taken branches. Their BTB miss rates stay high even with 12K entries, so they lose cycles to decode redirects, instruction cache misses that prefetching didn't hide, and lost predictor run-ahead. The fixes:</p>
<ul>
<li><strong>Hardware:</strong> larger and multi-level BTBs, BTB entries that cover a whole fetch region with several branches, and BTB prefetching driven by instruction cache fills.</li>
<li><strong>Software:</strong> profile-guided layout (BOLT, AutoFDO) that packs hot code together and straightens hot paths so fewer branches are taken; huge pages for code to cut ITLB misses.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 5th ed., Section 3.9 (branch-target buffers, branch folding, and return address predictors) · Shen and Lipasti, <em>Modern Processor Design</em>, Chapter 9 (target prediction for indirect jumps) · Chang, Hao, and Patt, "Target Prediction for Indirect Jumps," ISCA 1997 · Driesen and Hölzle, "The Cascaded Predictor: Economical and Adaptive Branch Target Prediction," MICRO 1998 · Ditzel and McLellan, "Branch Folding in the CRISP Microprocessor," ISCA 1987 · Seznec, "A 64-Kbytes ITTAGE Indirect Branch Predictor," CBP-3, 2011 · Skadron, Ahuja, Martonosi, and Clark, "Improving Prediction for Procedure Returns with Return-Address-Stack Repair Mechanisms," MICRO 1998 · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>A bytecode interpreter dispatches with a <code>switch</code> compiled to one indirect jump. Each bytecode takes about 15 instructions including the dispatch. With last-target prediction, the dispatch jump mispredicts 60% of the time; with a history-based indirect predictor, 10%. The mispredict penalty is 17 cycles, and the interpreter's CPI without dispatch mispredicts is 0.4. What CPI does each add?</p>`,
        a: `<ol><li>Dispatches per instruction: 1 / 15 ≈ 0.0667.</li><li>Last-target: 0.0667 × 0.6 × 17 ≈ <strong>0.68 CPI</strong>, more than the 0.4 base CPI itself.</li><li>History-based: 0.0667 × 0.1 × 17 ≈ <strong>0.11 CPI</strong>.</li><li>The history works because the next bytecode is correlated with the previous few, which is exactly what the path history captures. Threaded dispatch (a separate jump at the end of each handler) helps the same way on last-target predictors, by giving each handler its own BTB entry.</li></ol>`
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
  id: "fe-mispredict",
  region: "fe",
  title: "Mispredict Cost in Deep Pipelines",
  sections: [
    { id: "baseline", label: "From the 5-Stage Pipeline" },
    { id: "anatomy", label: "Where the Penalty Comes From" },
    { id: "resolution", label: "Resolution Time" },
    { id: "depth", label: "Pipeline Depth and Its Optimum" },
    { id: "p4", label: "Pentium 4 and the Turn Back" },
    { id: "shorten", label: "Shortening the Penalty" },
    { id: "model", label: "Modeling the Penalty" }
  ],
  body: `
<p>A predictor's accuracy only matters through what each mispredict costs, and that cost grows with the pipeline. This page covers what a mispredict costs in a deep out-of-order core, why the cost isn't a constant, and how it bounds how deep a pipeline should be. How the core squashes and restores state is on <a href="#/flush-recovery">Pipeline Flush and Recovery</a>. This page is about the cycles.</p>

<h3 id="sec-baseline">From the 5-Stage Pipeline</h3>
<p>Hennessy and Patterson's Appendix C.2 sets up the accounting. With an ideal CPI of 1, every branch that goes the wrong way costs the stages between fetch and the stage where it resolves:</p>
<div class="math">\\[ \\text{CPI} = \\text{CPI}_0 + \\frac{\\text{branches}}{\\text{instruction}} \\times \\frac{\\text{mispredicts}}{\\text{branch}} \\times \\text{penalty} \\]</div>
<p>In the classic 5-stage pipeline with the branch resolved in ID, the penalty is 1 cycle, and the details are in <a href="#/branch-hazards">Branch Hazards</a>. The formula is still the right first-order model for a wide out-of-order core. Three things change: the penalty is now tens of cycles, CPI<sub>0</sub> is a fraction of a cycle so each mispredict cycle is worth several instructions, and the penalty stops being a single number.</p>

<h3 id="sec-anatomy">Where the Penalty Comes From</h3>
<p>Interval analysis (Eyerman, Smith, and Eeckhout, 2006) splits a mispredict into pieces by asking when useful instructions stop entering the window and when they start again. From the moment the mispredicted branch is dispatched, everything behind it is wrong-path work:</p>
<div class="tbl"><table>
<tr><th>Piece</th><th>From and to</th><th>What sets it</th></tr>
<tr><td>Resolution time</td><td>The branch dispatches → it executes and the mispredict is detected</td><td>The latency of the instructions the branch depends on, and how long it waits in the scheduler</td></tr>
<tr><td>Refill time</td><td>Fetch is redirected → the first correct-path instruction reaches dispatch</td><td>Front-end depth: predictor, instruction cache or op cache, decode, rename</td></tr>
<tr><td>Ramp-up</td><td>The first correct-path instructions dispatch → the window is full enough to run at full IPC again</td><td>How much independent work the new path offers. A nearly empty window finds little parallelism at first</td></tr>
</table></div>
<p>The older instructions already in the window keep executing during resolution time, so not every one of those cycles is wasted. But nothing new and useful enters, and once the older work drains the core idles until the refill arrives. The first-order penalty is resolution time plus refill time.</p>

<h3 id="sec-resolution">Resolution Time</h3>
<p>The usual quoted penalty ("15 to 20 cycles" for a recent x86 core) is close to the refill time alone, the minimum for a branch whose operands are ready when it dispatches. Eyerman and colleagues found that resolution time is often as large as the front-end depth or larger, for a reason that makes the problem worse than it looks: the branches that are hard to predict are the ones that resolve late.</p>
<ul>
<li>A branch that is hard to predict usually depends on data: a comparison of a loaded value, a hash, a key in a search tree.</li>
<li>Its condition then waits on a load, often one that misses in the L1 or L2, and on the chain of instructions behind that load.</li>
<li>So the mispredicts that happen most often sit at the end of the longest dependence chains, and each one costs refill plus a cache-miss-sized resolution time.</li>
</ul>
<p>Resolution time also grows with the window. A larger ROB lets the front end dispatch a branch earlier relative to the work it depends on, so the branch waits longer before it can execute, and more wrong-path work fills the window behind it.</p>
<p>The opposite case exists too. When the mispredicted branch sits behind a long-latency load that blocks retirement anyway, the refill overlaps the miss and the mispredict costs almost nothing extra. That is why a mispredict count times a fixed penalty overestimates the gain from a better predictor.</p>

<h3 id="sec-depth">Pipeline Depth and Its Optimum</h3>
<p>Adding stages raises the clock and the penalty together. A first-order model, in the spirit of Hartstein and Puzak (2002), makes the trade explicit. Let:</p>
<ul>
<li>p be the number of pipeline stages,</li>
<li>t<sub>p</sub> the total logic delay of the whole pipeline, divided evenly among the stages,</li>
<li>t<sub>o</sub> the overhead per stage for latches, clock skew, and jitter,</li>
<li>CPI<sub>0</sub> the CPI from everything that doesn't scale with depth, and</li>
<li>h the stall cycles per instruction that each extra stage adds. Mispredicts contribute (mispredicts per instruction) × (penalty cycles per stage), and load-use and dependent-operation latencies add their own share.</li>
</ul>
<p>Time per instruction is cycle time times CPI:</p>
<div class="math">\\[ T(p) = \\left(t_o + \\frac{t_p}{p}\\right)\\left(\\text{CPI}_0 + h\\,p\\right) = \\text{CPI}_0\\,t_o + h\\,t_p + \\frac{\\text{CPI}_0\\,t_p}{p} + h\\,t_o\\,p \\]</div>
<p>Setting dT/dp = 0 gives</p>
<div class="math">\\[ p^* = \\sqrt{\\frac{\\text{CPI}_0\\,t_p}{h\\,t_o}} \\]</div>
<p>At the optimum the two depth-dependent terms are equal: the logic time saved by one more stage just matches the stall time it adds. The model says the optimum gets deeper when stalls per stage (h) fall, for example with a better predictor, or when latch overhead (t<sub>o</sub>) falls. But because of the square root, halving h moves the optimum only √2 ≈ 1.41× deeper, and only if mispredicts were all of h.</p>
<p>An example with numbers from the deep-pipeline era: CPI<sub>0</sub> = 0.3 cycles/instruction, t<sub>p</sub> = 3.2 ns, t<sub>o</sub> = 0.04 ns/stage, and h = 0.024 cycles/instruction per stage. Then p* = √(0.3 cycles/instruction × 3.2 ns / (0.024 cycles/instruction × 0.04 ns)) = √1000 ≈ 31.6 stages.</p>
<div class="tbl"><table>
<tr><th>Stages</th><th>Cycle time</th><th>Clock</th><th>CPI (cycles/instruction)</th><th>Time per instruction</th><th>Relative to 32 stages</th></tr>
<tr><td>16</td><td>0.04 ns + 3.2 ns / 16 = 0.24 ns</td><td>4.17 GHz</td><td>0.3 + 0.024 × 16 stages = 0.684</td><td>0.164 ns</td><td>1.10× slower</td></tr>
<tr><td>32</td><td>0.04 ns + 3.2 ns / 32 = 0.14 ns</td><td>7.14 GHz</td><td>0.3 + 0.024 × 32 stages = 1.068</td><td>0.150 ns</td><td>1.00×</td></tr>
<tr><td>64</td><td>0.04 ns + 3.2 ns / 64 = 0.09 ns</td><td>11.1 GHz</td><td>0.3 + 0.024 × 64 stages = 1.836</td><td>0.165 ns</td><td>1.11× slower</td></tr>
</table></div>
<p>The curve is flat near the bottom: halving or doubling the depth costs about 10%. That flatness is what lets everything the model leaves out decide the real answer, and all of it pushes toward shallower pipelines:</p>
<ul>
<li><strong>Power.</strong> Clock and latch power grow with the number of latches times the frequency, both of which rise with p. Srinivasan et al. (2002) found that adding power to the metric moves the optimum much shallower than performance alone does.</li>
<li><strong>Loops that can't be pipelined.</strong> Wakeup and select, the bypass network, and the load-use path have to complete in a fixed number of cycles to keep dependent instructions back to back. Cutting them across more stages adds a cycle to every dependent pair, which is part of h and grows faster than linearly once a loop no longer fits in one cycle.</li>
<li><strong>More in-flight state.</strong> A longer pipeline needs a bigger window to keep the same number of cycles of independent work in flight.</li>
</ul>

<h3 id="sec-p4">Pentium 4 and the Turn Back</h3>
<p>Intel's NetBurst cores are the experiment that tested the argument. Sprangle and Carmean (2002), from the Pentium 4 team, argued that deeper pipelines still paid as long as the structures around them scaled. Willamette (2000) had a 20-stage misprediction pipeline, counted from the trace cache, so x86 decode wasn't even in the loop (Hinton et al., 2001). Prescott (2004) went to 31 stages.</p>
<p>Prescott never reached its clock targets. It topped out at 3.8 GHz, held there by power density, and its successor Tejas was cancelled in 2004. With frequency capped by power, the extra stages bought no clock and kept their full cost in penalty cycles. Intel's next design, Core (2006), came from the Pentium M line, with a pipeline of about 14 stages, lower clocks, and much higher IPC. High-performance cores since then have kept their pipelines far shorter than Prescott's and spent their transistors on width, window size, and prediction accuracy instead.</p>

<h3 id="sec-shorten">Shortening the Penalty</h3>
<p>Each piece of the penalty has its own fixes:</p>
<ul>
<li><strong>Refill:</strong> a redirect that hits in the op cache skips the instruction cache and decode stages. Agner Fog measures a shorter mispredict penalty on Intel cores when the correct path is in the µop cache. Shallow front ends and fast redirect paths from the execution units matter too.</li>
<li><strong>Resolution:</strong> schedulers that pick branches, and the instructions that feed them, ahead of other ready work. Compilers can compute conditions earlier.</li>
<li><strong>Recovery:</strong> checkpointing the rename map at each branch so recovery is a single cycle instead of a walk of the ROB (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>).</li>
<li><strong>Avoiding the branch:</strong> if-conversion to a conditional move or select turns an unpredictable branch into a data dependence. It pays when the branch mispredicts often and both sides are short.</li>
<li><strong>Limiting the damage:</strong> confidence estimators (Jacobsen, Rotenberg, and Smith, 1996) flag predictions that are likely wrong. Pipeline gating (Manne, Klauser, and Grunwald, 1998) uses them to stop fetching down a low-confidence path, which saves energy rather than cycles. Research designs go further and keep control-independent work after the branch's reconvergence point instead of squashing it.</li>
</ul>

<h3 id="sec-model">Modeling the Penalty</h3>
<ul>
<li><strong>Don't charge a constant.</strong> Model refill as the real front-end depth along the path the redirect takes (op cache or decoders), and let resolution time come out of the timing model.</li>
<li><strong>Log the pieces per mispredict.</strong> Record dispatch-to-resolve and redirect-to-dispatch for each mispredict. Their distributions tell you whether to work on the predictor, the front end, or the scheduler.</li>
<li><strong>Keep the overlap.</strong> A mispredict under a long cache miss is nearly free. A model that adds the penalty on top of every miss overstates the cost of both.</li>
<li><strong>Simulate the wrong path when it matters.</strong> Wrong-path instructions occupy the window, consume bandwidth and energy, and touch the caches. A model that just stalls fetch until resolution misses all of that.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 5th ed., Appendix C.2 (performance of branch schemes) · Shen and Lipasti, <em>Modern Processor Design</em>, Chapter 9 (branch misprediction recovery and confidence) · Eyerman, Smith, and Eeckhout, "Characterizing the Branch Misprediction Penalty," ISPASS 2006 · Hartstein and Puzak, "The Optimum Pipeline Depth for a Microprocessor," ISCA 2002 · Sprangle and Carmean, "Increasing Processor Performance by Implementing Deeper Pipelines," ISCA 2002 · Srinivasan et al., "Optimizing Pipelines for Power and Performance," MICRO 2002 · Hinton et al., "The Microarchitecture of the Pentium 4 Processor," Intel Technology Journal, 2001 · Jacobsen, Rotenberg, and Smith, "Assigning Confidence to Conditional Branch Predictions," MICRO 1996 · Manne, Klauser, and Grunwald, "Pipeline Gating: Speculation Control for Energy Reduction," ISCA 1998 · Agner Fog, <em>The Microarchitecture of Intel, AMD and VIA CPUs</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>On a Golden Cove-like core, a redirect reaches dispatch 11 cycles after the mispredict is detected when the correct path hits in the µop cache, and 16 cycles when it goes through the legacy decoders. 70% of redirects hit in the µop cache. Mispredicted branches wait on average 9 cycles in the scheduler after dispatch and then take 2 cycles to execute and signal the mispredict. The workload has 6 mispredicts per 1,000 instructions. Use the interval model (penalty = resolution time + refill time), ignore ramp-up, and assume no cache miss overlaps a mispredict. (a) What CPI do mispredicts add? (b) What would a model that charges only the front-end refill report? (c) Which saves more per mispredict: raising the µop cache hit rate on redirects to 90%, or a scheduler change that cuts the branch's wait by 4 cycles?</p>`,
        a: `<ol><li>Refill: 0.7 × 11 cycles + 0.3 × 16 cycles = 7.7 cycles + 4.8 cycles = 12.5 cycles.</li><li>Resolution: 9 cycles + 2 cycles = 11 cycles.</li><li>Penalty: 12.5 cycles + 11 cycles = 23.5 cycles/mispredict.</li><li>(a) Added CPI: 6 mispredicts / 1,000 instructions × 23.5 cycles/mispredict = <strong>0.141 cycles/instruction</strong>.</li><li>(b) Refill only: 6 mispredicts / 1,000 instructions × 12.5 cycles/mispredict = 0.075 cycles/instruction, about half the real cost.</li><li>(c) At 90%: refill = 0.9 × 11 cycles + 0.1 × 16 cycles = 9.9 cycles + 1.6 cycles = 11.5 cycles, saving 12.5 cycles − 11.5 cycles = 1.0 cycle/mispredict. The scheduler change saves <strong>4 cycles/mispredict</strong>, four times as much. When resolution time is a large share of the penalty, speeding up the branch matters more than speeding up the front end.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Prescott's pipeline was more than twice as deep as Core 2's and ran at a higher clock, yet Core 2, two years later, was faster on most integer code. Using the depth model on this page, explain how the deeper design could lose. Then name two effects the model leaves out that also worked against Prescott.</p>`,
        a: `<p>The model's optimum assumes the clock rises as 1 / (t<sub>o</sub> + t<sub>p</sub> / p). Prescott's depth was chosen for clocks well above 3.8 GHz, but power density capped it at 3.8 GHz. With the clock capped, the cycle-time term no longer improves with depth, while the stall term h × p still grows: every mispredict and every dependent-latency stall costs about twice as many cycles as on a 14-stage pipeline. A deep pipeline at a capped clock is on the wrong side of the curve, paying for the depth without collecting the frequency. Core 2 sat near the bottom of a flat curve, with a lower clock but a much lower CPI.</p><p>Effects the model leaves out:</p><ul><li><strong>Power:</strong> latch and clock power scale with stages × frequency, which is what capped the clock in the first place.</li><li><strong>Non-linear loop costs:</strong> Prescott's deep scheduling pipeline issued load-dependent instructions before knowing whether the load hit, and replayed them on a miss, which wasted execution bandwidth on integer code. Splitting tight loops over more stages costs more than a linear h × p.</li><li><strong>Width and window:</strong> Core 2 used the transistors and power that depth would have taken on a wider core with better prediction, lowering CPI<sub>0</sub>, which the model treats as fixed.</li></ul>`
      }
    ]
  }
},

{
  id: "fe-decode",
  region: "fe",
  title: "Decoders and the Op Cache",
  sections: [
    { id: "decode", label: "What Decode Does" },
    { id: "x86", label: "Variable-Length Decode on x86" },
    { id: "uop-cache", label: "The Op Cache" },
    { id: "fusion", label: "Fusion and Cracking" },
    { id: "arm", label: "Fixed-Length ISAs" },
    { id: "model", label: "Modeling Decode" }
  ],
  body: `
<p>Decode turns instruction bytes into the macro-ops that rename and dispatch send to the back end (AMD's term, see the note on macro-ops and micro-ops in the <a href="#/r/fe">section overview</a>). On a fixed-length ISA it's simple and wide. On x86 it's one of the hardest parts of the core, which is why x86 cores cache decoded ops and bypass the decoders whenever they can.</p>

<h3 id="sec-decode">What Decode Does</h3>
<ul>
<li><strong>Find instruction boundaries</strong> in the fetched bytes (trivial for fixed-length encodings).</li>
<li><strong>Translate</strong> each instruction into one or two macro-ops: opcode, source and destination registers, immediate, and the micro-ops each macro-op will be split into at the schedulers.</li>
<li><strong>Detect branches</strong> the predictor didn't know about and redirect fetch (see <a href="#/fe-targets/misses">BTB misses and decode redirects</a>).</li>
<li><strong>Handle complex instructions</strong> by sending them to the microcode unit, which emits a longer macro-op sequence from a ROM.</li>
</ul>

<h3 id="sec-x86">Variable-Length Decode on x86</h3>
<p>x86 instructions are 1 to 15 bytes, and the length depends on prefixes, the opcode, the ModRM and SIB bytes, and the immediate size. Finding where instruction <em>n</em> + 1 starts requires knowing the length of instruction <em>n</em>, so decoding several instructions per cycle needs either a serial chain of length decoders or speculative decoding at every byte offset. Cores combine two tricks:</p>
<ul>
<li><strong>Predecode bits:</strong> when a line is filled into the instruction cache, it is scanned once and start-of-instruction bits are stored alongside it, so later fetches find boundaries immediately.</li>
<li><strong>Two decode clusters:</strong> Zen 5 splits its 8 decoders into two clusters of 4, each with its own instruction queue and each decoding a separate 32-byte fetch window, so each only has to find boundaries within its own window. Only the first of a cluster's four slots can decode an instruction longer than 10 bytes, and the two clusters share one microcode unit. AMD's optimization guide says one thread decodes at most 4 instructions per cycle, and in SMT mode each thread owns a cluster, so all 8 decoders work at once only with two threads (Agner Fog's tests suggest one thread can sometimes use both, on the two sides of a taken branch). For a single thread, the op cache is the path to full width.</li>
</ul>
<p>Intel organizes its decoders differently, and in Intel's terms: one complex decoder handles instructions that produce up to 4 µops, the simple decoders handle only 1-µop instructions, and anything longer goes to the microcode sequencer. Its decoders all work on one fetch window, so a taken branch ends the decode group.</p>
<p>Some encodings defeat the shortcuts. A <strong>length-changing prefix</strong> (the 0x66 operand-size prefix on an instruction with a 16-bit immediate) changes how long the instruction is after the predecoder has guessed, and Intel cores stall decode for a few cycles each time one appears.</p>

<h3 id="sec-uop-cache">The Op Cache</h3>
<p>The <strong>op cache</strong> (AMD's name, used here) stores recently decoded code, indexed by instruction address. Zen 3's and Zen 4's op caches held macro-ops. Zen 5's entries hold decoded instructions (or fused pairs) instead, which packs code more densely, and they become macro-ops in the macro-op queue. Intel's equivalent is the decoded stream buffer, or micro-op cache, which stores fused-domain µops. When fetch hits in it, the decoders are skipped entirely:</p>
<ul>
<li><strong>More bandwidth:</strong> Zen 5 delivers up to 12 instructions per cycle from its 6K-instruction op cache (two 6-wide pipes) versus 4 per cycle for one thread from its decoders. Intel's Lion Cove delivers 12 µops per cycle from its micro-op cache versus 8 from its decoders.</li>
<li><strong>Fewer hazards:</strong> length decoding, prefix penalties, and decoder limits don't apply on a hit.</li>
<li><strong>Less power:</strong> the decoders are among the most power-hungry parts of an x86 front end, and they idle on hits.</li>
<li><strong>A shorter pipeline:</strong> skipping decode stages shortens the mispredict refill path when the correct target is in the op cache.</li>
</ul>
<p>The cost: it's organized by code region, and each entry has limits. A Zen 5 entry holds up to 6 instructions from at most two adjacent 64-byte lines, with six 32-bit immediate or displacement slots (a 64-bit value takes two). Intel's maps 32- or 64-byte windows to a few ways of µop lines. So some code shapes fit poorly (many instructions in one window, long immediates that take extra slots), and switching between it and the decoders costs a cycle or more. Microcoded instructions are typically stored as a pointer into the microcode ROM rather than as their full decoded sequence.</p>
<p>A smaller relative is the <strong>loop buffer</strong> (Intel's loop stream detector): a short queue after decode that replays a small loop's decoded ops without fetching or decoding them again.</p>

<h3 id="sec-fusion">Fusion and Cracking</h3>
<p>Decode is where the macro-op count is decided, and macro-ops are what rename width is measured in. How many micro-ops each macro-op carries is decided here too:</p>
<ul>
<li><strong>Branch fusion:</strong> a compare or test followed by a conditional branch becomes one macro-op. Intel calls this macro-fusion (some Arm cores fuse similar pairs).</li>
<li><strong>Load-op:</strong> a load combined with an ALU operation (<code>add rax, [rbx]</code>) is one macro-op through rename and retire but carries two micro-ops, a load and an add, which the schedulers issue separately. Intel calls this micro-fusion.</li>
<li><strong>Load-op-store:</strong> a read-modify-write to memory (<code>add [rbx], rax</code>) is still one macro-op on Zen, with two micro-ops: a combined load and store address operation, and the add. Intel splits it into 2 fused-domain µops, which become 4 at the ports (load, add, store address, store data).</li>
<li><strong>Cracking:</strong> a fast path double instruction becomes two macro-ops, and anything longer becomes a microcode sequence.</li>
</ul>
<p>That is why a performance model must count macro-ops for rename and retire bounds and micro-ops for port bounds (Intel's fused and unfused µops, see <a href="#/perf-bounds/be-bounds">Back-End Bounds</a>).</p>

<h3 id="sec-arm">Fixed-Length ISAs</h3>
<p>With every AArch64 instruction 4 bytes long, boundaries are known in advance, so wide decode is cheap: Apple's Firestorm cores decode 8 instructions per cycle with no op cache. Arm went further on its own cores: when the Cortex-A715 dropped 32-bit (AArch32) support, Arm removed its macro-op cache and widened the decoders instead, because decode had become cheap enough that the cache no longer paid for its area and power. Arm's terms match AMD's: its decoders produce macro-ops, and the macro-op cache held them. RISC-V's compressed extension brings back 2-byte instructions, so wide RISC-V decoders need some of the same boundary-finding logic as x86, though only for two lengths.</p>

<h3 id="sec-model">Modeling Decode</h3>
<ul>
<li>Model the op cache as a real cache with the design's indexing and capacity rules, not a hit rate, because its misses cluster on exactly the large-footprint code where the front end matters.</li>
<li>Model the switch penalty between the op cache and the decoders. Code that bounces between them loses more than either path alone.</li>
<li>Track macro-ops per instruction and micro-ops per macro-op by instruction class (fusion, load-op, cracking, microcode). The first sets the rename and retire limits, and the second sets the port limits.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> (decoded ICache, length-changing prefixes, macro-fusion) · AMD, <em>Software Optimization Guide for the AMD Zen 5 Microarchitecture</em> (macro-ops, micro-ops, op cache, branch fusion) · Chips and Cheese, Zen 5 front-end articles (decode clusters) · Arm, Cortex-A715 announcement (2022)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A hot loop on a Golden Cove-like core has 24 instructions averaging 5 bytes, which become 30 fused-domain µops (Intel's counterpart of macro-ops). Rename is 6 wide. Compare cycles per iteration from the µop cache (8 µops per cycle) and from Intel's legacy decode path (32 bytes fetched and 6 instructions or 6 µops decoded per cycle).</p>`,
        a: `<ol><li>µop cache: 30 / 8 = 3.75 cycles.</li><li>Legacy path: fetch 24 × 5 = 120 bytes / 32 = 3.75 → 4 cycles; decoders 24 instructions / 6 = 4 cycles, but they deliver at most 6 µops per cycle, so 30 / 6 = 5 cycles.</li><li>Rename: 30 / 6 = <strong>5 cycles</strong> either way.</li><li>So throughput is the same, 5 cycles per iteration, because rename binds. The µop cache still helps: it saves decode power, avoids prefix and length-decode stalls, and refills faster after a mispredict. It raises throughput only when the legacy path is the narrowest stage.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>On an Intel core, adding one unrelated instruction elsewhere in a function makes a hot loop 2.5× slower. The loop uses 16-bit arithmetic with immediates (<code>add ax, 0x1234</code>). What's the likely mechanism, and how would you confirm and fix it?</p>`,
        a: `<p>The loop probably moved: the new instruction shifted its alignment so it no longer fits the µop cache's (decoded stream buffer's) per-window limits (or now straddles windows it can't hold), and it runs from the legacy decoders. There, every 16-bit-immediate instruction carries a length-changing prefix, and each one stalls predecode for a few cycles, so a loop full of them slows down several-fold. Confirm with counters: µops delivered from the µop cache versus the legacy decoders (Intel's <code>IDQ.DSB_UOPS</code> and <code>IDQ.MITE_UOPS</code>) and the length-changing-prefix stall counter (<code>ILD_STALL.LCP</code>). Fixes: use 32-bit operations and registers (no 0x66 prefix), load the constant into a register first, or align the loop (<code>-falign-loops</code>) so it stays in the µop cache.</p>`
      }
    ]
  }
}
]);
