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
<li><strong>Branch prediction unit.</strong> Each cycle it takes the current fetch address and the global history and predicts one fetch block: the BTB finds the branches in it and their targets, the direction predictor decides whether conditional branches are taken, and the indirect predictor and return address stack supply targets the BTB can't (see <a href="#/fe-direction">Branch Direction Predictors</a> and <a href="#/fe-targets">Branch Targets</a>). The predicted next address feeds straight back in for the next cycle.</li>
<li><strong>Fetch target queue.</strong> Holds the predicted blocks until fetch is ready for them, along with the history needed to repair the predictor. Its occupancy is how far the predictor runs ahead (see <a href="#/fe-decoupled/ftq">The Fetch Target Queue</a>).</li>
<li><strong>Prefetcher.</strong> Probes the instruction cache tags with the addresses in the queue and sends the misses to the L2, so lines arrive before fetch reaches them (see <a href="#/fe-decoupled/fdip">Fetch-Directed Prefetching</a>).</li>
<li><strong>Instruction cache.</strong> Read at the head of the queue, with the ITLB translating in parallel. The queue entry can carry the predicted way, so only one way is read (see <a href="#/stage-if/way-pred">Way Prediction</a>). A miss goes to the L2.</li>
<li><strong>Instruction queues and decoders.</strong> Predecode finds instruction boundaries, which is the hard part on x86, and the decoders turn instructions into macro-ops. Zen 5 has two 4-wide decode clusters, each with its own instruction queue and each taking a different predicted fetch window, and the two share the microcode unit (see <a href="#/fe-decode">Decoders and the Op Cache</a>).</li>
<li><strong>Op cache.</strong> Looked up with the predicted fetch addresses. On a hit it delivers already-decoded instructions, skipping the instruction cache and decoders, which saves both latency and power. The decoders fill it on a miss.</li>
<li><strong>Macro-op queue.</strong> Collects macro-ops from both paths and absorbs the difference between front-end delivery and the rate rename takes them.</li>
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
<div class="tbl"><svg viewBox="0 0 680 412" role="img" aria-label="Fetch timing after a predicted-taken branch at the end of block A, for 0 to 3 bubbles, over cycles 0 to 5. Each case has a predict lane and an instruction cache lane. The predictor writes A into the FTQ in cycle 0, and the instruction cache reads it in cycle 1, since the empty FTQ passes it straight through. With the branch in a 1-cycle BTB, the predictor predicts T in cycle 1 and fetch reads T in cycle 2, with no bubble. With a 2-cycle BTB, the predictor first predicts the fall-through block A+1 in cycle 1, the slow BTB redirects at the end of cycle 1, A+1 is flushed, fetch is idle in cycle 2, and reads T in cycle 3. With a 3-cycle BTB, the wrong-path blocks A+1 and A+2 are predicted, fetch reads A+1 in cycle 2 and discards it, is idle in cycle 3, and reads T in cycle 4. With a 4-cycle BTB, fetch reads wrong-path blocks A+1 and A+2 in cycles 2 and 3, is idle in cycle 4, and reads T in cycle 5. In a tight loop where every block ends in a taken branch, fetch delivers 1, 1/2, 1/3, or 1/4 blocks per cycle." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrTB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px;font-weight:600" text-anchor="middle"><text x="202" y="20">Cycle 0</text><text x="287" y="20">Cycle 1</text><text x="372" y="20">Cycle 2</text><text x="457" y="20">Cycle 3</text><text x="542" y="20">Cycle 4</text><text x="627" y="20">Cycle 5</text></g>
<text x="10" y="56" style="fill:var(--ink);font-size:11px;font-weight:600">1-cycle BTB read</text><text x="10" y="71" style="fill:var(--muted);font-size:10px">0 bubbles</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="154" y="57">Predict</text><text x="154" y="97">I-cache</text></g>
<rect x="162" y="40" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="202" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="247" y="40" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="287" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="332" y="40" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="372" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="417" y="40" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="457" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+2</text>
<rect x="502" y="40" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+3</text>
<rect x="587" y="40" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="57" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+4</text>
<rect x="162" y="80" width="81" height="26" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="202" y="97" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">prev</text>
<rect x="247" y="80" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="287" y="97" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="332" y="80" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="372" y="97" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="417" y="80" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="457" y="97" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="502" y="80" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="97" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+2</text>
<rect x="587" y="80" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="97" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+3</text>
<path d="M220,67 L262,78" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/>
<text x="216" y="76" text-anchor="end" style="fill:var(--muted);font-size:9px">FTQ</text>
<rect x="10" y="114" width="660" height="1" style="fill:var(--rule)"/>
<text x="10" y="136" style="fill:var(--ink);font-size:11px;font-weight:600">2-cycle BTB read</text><text x="10" y="151" style="fill:var(--muted);font-size:10px">1 bubble</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="154" y="137">Predict</text><text x="154" y="177">I-cache</text></g>
<rect x="162" y="120" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="202" y="137" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="247" y="120" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="287" y="137" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+1</text>
<rect x="332" y="120" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="372" y="137" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="417" y="120" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="457" y="137" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="502" y="120" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="137" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+2</text>
<rect x="587" y="120" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="137" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+3</text>
<rect x="162" y="160" width="81" height="26" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="202" y="177" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">prev</text>
<rect x="247" y="160" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="287" y="177" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="332" y="160" width="81" height="26" rx="3" style="fill:none;stroke:var(--rule);stroke-width:1.5;stroke-dasharray:2 3"/><text x="372" y="177" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">idle</text>
<rect x="417" y="160" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="457" y="177" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="502" y="160" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="177" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="587" y="160" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="177" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+2</text>
<path d="M220,147 L262,158" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/>
<path d="M330,118 V190" style="stroke:var(--redirect);stroke-width:2"/><text x="334" y="157" style="fill:var(--redirect);font-size:9px">slow BTB redirects</text>
<rect x="10" y="194" width="660" height="1" style="fill:var(--rule)"/>
<text x="10" y="216" style="fill:var(--ink);font-size:11px;font-weight:600">3-cycle BTB read</text><text x="10" y="231" style="fill:var(--muted);font-size:10px">2 bubbles</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="154" y="217">Predict</text><text x="154" y="257">I-cache</text></g>
<rect x="162" y="200" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="202" y="217" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="247" y="200" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="287" y="217" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+1</text>
<rect x="332" y="200" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="372" y="217" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+2</text>
<rect x="417" y="200" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="457" y="217" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="502" y="200" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="217" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="587" y="200" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="217" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+2</text>
<rect x="162" y="240" width="81" height="26" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="202" y="257" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">prev</text>
<rect x="247" y="240" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="287" y="257" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="332" y="240" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="372" y="257" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+1</text>
<rect x="417" y="240" width="81" height="26" rx="3" style="fill:none;stroke:var(--rule);stroke-width:1.5;stroke-dasharray:2 3"/><text x="457" y="257" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">idle</text>
<rect x="502" y="240" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="257" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="587" y="240" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="257" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<path d="M220,227 L262,238" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/>
<path d="M415,198 V270" style="stroke:var(--redirect);stroke-width:2"/><text x="419" y="237" style="fill:var(--redirect);font-size:9px">slow BTB redirects</text>
<rect x="10" y="274" width="660" height="1" style="fill:var(--rule)"/>
<text x="10" y="296" style="fill:var(--ink);font-size:11px;font-weight:600">4-cycle BTB read</text><text x="10" y="311" style="fill:var(--muted);font-size:10px">3 bubbles</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="154" y="297">Predict</text><text x="154" y="337">I-cache</text></g>
<rect x="162" y="280" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="202" y="297" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="247" y="280" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="287" y="297" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+1</text>
<rect x="332" y="280" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="372" y="297" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+2</text>
<rect x="417" y="280" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="457" y="297" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+3</text>
<rect x="502" y="280" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="542" y="297" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<rect x="587" y="280" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="297" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T+1</text>
<rect x="162" y="320" width="81" height="26" rx="3" style="fill:none;stroke:var(--muted);stroke-width:1.5"/><text x="202" y="337" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">prev</text>
<rect x="247" y="320" width="81" height="26" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="287" y="337" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">A</text>
<rect x="332" y="320" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="372" y="337" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+1</text>
<rect x="417" y="320" width="81" height="26" rx="3" style="fill:none;stroke:var(--redirect);stroke-width:1.5;stroke-dasharray:4 3"/><text x="457" y="337" text-anchor="middle" style="fill:var(--redirect);font-size:11px;font-weight:600">A+2</text>
<rect x="502" y="320" width="81" height="26" rx="3" style="fill:none;stroke:var(--rule);stroke-width:1.5;stroke-dasharray:2 3"/><text x="542" y="337" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">idle</text>
<rect x="587" y="320" width="81" height="26" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="627" y="337" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">T</text>
<path d="M220,307 L262,318" style="fill:none;stroke:var(--muted);stroke-width:1.2" marker-end="url(#arrTB)"/>
<path d="M500,278 V350" style="stroke:var(--redirect);stroke-width:2"/><text x="504" y="317" style="fill:var(--redirect);font-size:9px">slow BTB redirects</text>
<g style="fill:var(--muted);font-size:11px"><text x="10" y="372">Dashed red: wrong-path block, flushed. Red line: the slow BTB level returns A's target and redirects.</text>
<text x="10" y="388">Arrow: A passes through the empty FTQ and is read the next cycle. No back pressure.</text>
<text x="10" y="404">In a tight loop where every block ends in a taken branch: 1, 1/2, 1/3, or 1/4 blocks per cycle.</text></g>
</svg></div>
<p>What happens in each cycle, with no back pressure and an empty FTQ, when A's taken branch is held only by a BTB level that takes k + 1 cycles to read (k bubbles):</p>
<ol start="0">
<li><strong>Cycle 0, predict A.</strong> The predictor looks up A's start address in every BTB level and the direction predictor at once, and writes A into the FTQ. If the 1-cycle BTB holds the branch, the entry already ends at the branch with T as its next address. Otherwise the fast level saw no taken branch, so A is written as a full window with the fall-through as its next address. Meanwhile, the instruction cache reads the block predicted the cycle before.</li>
<li><strong>Cycle 1, fetch A.</strong> A goes straight through the empty FTQ to the instruction cache, which reads it (ITLB, tags, and data). With the branch in the 1-cycle BTB, the predictor is looking up T in this same cycle, and fetch reads T in cycle 2: no bubble.</li>
<li><strong>Cycles 1 to k, wrong path.</strong> With a slower BTB, the predictor goes on with the fast level's answer and predicts the fall-through blocks A+1, A+2, and so on, and fetch reads them one cycle behind. These are real instruction cache probes, which can miss and start fills, but their bytes are thrown away.</li>
<li><strong>End of cycle k, redirect.</strong> The slow level returns A's branch and target, the same override as in <a href="#/fe-decoupled/overriding">Fast and Slow Predictors</a>. A's entry is corrected (its end moves to the branch and its next address becomes T), the bytes of A past the branch are discarded, and the wrong-path entries are flushed. The block predicted in cycle k is flushed before fetch reads it, so the instruction cache is idle in cycle k + 1.</li>
<li><strong>Cycle k + 1, predict T, and cycle k + 2, fetch T.</strong> Fetch lost k cycles: k − 1 reading wrong-path blocks and 1 idle.</li>
</ol>
<p>A predictor that waits for the slow level instead of guessing loses the same k cycles, with the instruction cache idle throughout. If the FTQ already held blocks, fetch would read those during the gap and the bubbles would be hidden (see <a href="#/fe-decoupled/why">Why Decouple</a>). Tight loops expose them because the predictor can't get ahead there: every block needs a taken-branch prediction.</p>
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
        a: `<ol start="0"><li>µop cache: 30 / 8 = 3.75 cycles.</li><li>Legacy path: fetch 24 × 5 = 120 bytes / 32 = 3.75 → 4 cycles; decoders 24 instructions / 6 = 4 cycles, but they deliver at most 6 µops per cycle, so 30 / 6 = 5 cycles.</li><li>Rename: 30 / 6 = <strong>5 cycles</strong> either way.</li><li>So throughput is the same, 5 cycles per iteration, because rename binds. The µop cache still helps: it saves decode power, avoids prefix and length-decode stalls, and refills faster after a mispredict. It raises throughput only when the legacy path is the narrowest stage.</li></ol>`
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
