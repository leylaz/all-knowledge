/* Section: Scheduling and Execution
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "sched"). */

section({
  id: "sched",
  name: "Scheduling and Execution",
  cap: "Issue queues, wakeup and select, replay, execution units",
  sections: [
    { id: "dispatch-to-writeback", label: "From Dispatch to Writeback" },
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>Once a µop is renamed (the <a href="#/r/ren">Register Renaming</a> region) and has its ROB entry (the <a href="#/r/core">Out-of-Order Core</a> region), it waits in a scheduler until its operands are ready, then issues to an execution unit. This region covers that stretch of the pipeline. The schedulers decide how much of the window's parallelism the core actually uses, and their wakeup and select loop is one of the tightest timing paths in the core (Hennessy and Patterson, chapter 3, and Palacharla, Jouppi, and Smith, ISCA 1997).</p>
<h3 id="sec-dispatch-to-writeback">From Dispatch to Writeback</h3>
<ol>
<li><strong>Dispatch:</strong> the µop takes a scheduler entry holding its source tags and a ready bit per source.</li>
<li><strong>Wakeup:</strong> each producer that issues broadcasts its destination tag, and matching entries set their ready bits.</li>
<li><strong>Select:</strong> each port picks one ready µop, usually the oldest, and frees its entry.</li>
<li><strong>Execute:</strong> operands come from the register file or the bypass network, and the unit runs the operation.</li>
<li><strong>Replay if needed:</strong> a µop woken early on a guess, such as a load hit, reissues when the guess was wrong.</li>
</ol>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/scheduler">Scheduler Queues</a>: wakeup and select, speculative wakeup, and unified vs. distributed queues.</li>
<li><a href="#/wakeup">Wakeup and Bypass Timing</a>: the tag broadcast and match circuits, the critical loop, and what to do when it no longer fits in a cycle.</li>
<li><a href="#/replay">Selective Replay</a>: recovering from a wrong speculative wakeup without a full squash.</li>
<li><a href="#/exec-units">Execution Units</a>: the unit mix, port math, and its power, performance, and area.</li>
<li><a href="#/simd">SIMD and Vector Execution</a>: wide data paths and what they cost.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A loop iteration has 30 µops: a loop-carried chain of 8 dependent single-cycle integer adds and 22 independent µops. The core can issue 6 integer µops per cycle. Find the cycles per iteration when wakeup and select fit in one cycle, and when the loop is pipelined over 2 cycles.</p>`,
        a: `<ol><li>Issue bound: 30 µops/iteration / 6 µops/cycle = 5 cycles/iteration.</li><li>Atomic wakeup and select: each add issues the cycle after its producer, so the chain takes 8 adds/iteration × 1 cycle/add = 8 cycles/iteration. That exceeds the issue bound, so the loop runs at <strong>8 cycles/iteration</strong>.</li><li>Pipelined over 2 cycles: each dependent add waits 2 cycles, so the chain takes 8 adds/iteration × 2 cycles/add = <strong>16 cycles/iteration</strong>.</li><li>Takeaway: the 22 independent µops can't hide the chain, so the slower loop halves throughput. That's why designers keep wakeup and select within one cycle for single-cycle ops, even at the cost of a smaller scheduler.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your scheduler has to grow from 96 to 160 entries, but the wakeup and select loop already uses the whole cycle. What are your options, and what does each cost?</p>`,
        a: `<ul><li><strong>Distributed queues:</strong> split entries across several smaller queues, each feeding a few ports. Each broadcast reaches fewer entries, but a busy queue can fill while others sit idle, and µops must be steered at dispatch.</li><li><strong>Matrix scheduler:</strong> track dependences in a bit matrix indexed by entry, so wakeup is a bit-vector update instead of a tag compare. The matrix grows with entries squared.</li><li><strong>Pipelined wakeup:</strong> split the loop over 2 cycles. Dependent single-cycle ops can no longer issue back to back unless the design adds speculative grandparent wakeup, which brings its own replays.</li><li><strong>Two-level or filtered schedulers:</strong> keep a small fast queue near the ports and park µops whose operands are far from ready, such as those behind a load miss, in a larger slow buffer.</li></ul><p>Before choosing, measure whether the scheduler is the limiter at all: count dispatch stalls with the scheduler full while the ROB and physical registers still have room.</p>`
      },
      {
        q: `<p>A core wakes load dependents assuming a 5-cycle L1 hit, as Golden Cove does. Loads are 25 of every 100 µops, the L1D misses 6 times per 100 loads, and each miss leaves on average 2.5 dependent µops issued in its shadow that must reissue. The alternative is to wake dependents only once the hit is confirmed, which adds 2 cycles to every load-to-use. Which is better?</p>`,
        a: `<ol><li>Wasted issue slots with speculative wakeup: 25 loads/100 µops × 6 misses/100 loads × 2.5 µops/miss = 3.75 issue slots per 100 µops, about 3.75% of issue bandwidth. That costs time only when the core is issue bound.</li><li>Waiting for the hit signal adds 2 cycles to every load-to-use edge. On a pointer-chasing chain each 5-cycle load becomes 7 cycles, so the chain runs 7 cycles / 5 cycles = 1.4 times slower.</li><li>Speculative wakeup is better: it spends a few percent of a resource that is rarely the bottleneck to keep 2 cycles off a path that often is. It needs replay to recover, covered on <a href="#/replay">Selective Replay</a>.</li></ol>`
      }
    ]
  }
}, [
{
  id: "scheduler",
  region: "sched",
  title: "Scheduler Queues",
  sections: [
    { id: "wakeup-select", label: "Wakeup and Select" },
    { id: "speculative-wakeup", label: "Speculative Wakeup" },
    { id: "unified-distributed", label: "Unified vs. Distributed" }
  ],
  body: `
<p>Renamed instructions wait in issue queues until their operands are ready.</p>
<h3 id="sec-wakeup-select">Wakeup and Select</h3>
<p><strong>Wakeup:</strong> a producer's destination tag is broadcast and waiting entries set ready bits. <strong>Select:</strong> pick ready entries up to the issue width per port, often oldest first. For back-to-back dependent issue, wakeup plus select must fit in one cycle. The circuits, the CDB, how cost grows with the register file, and how issue lines up with bypassing are on <a href="#/wakeup">Wakeup and Bypass Timing</a>.</p>
<h3 id="sec-speculative-wakeup">Speculative Wakeup</h3>
<p>Dependents of a load are woken assuming an L1 hit; on a miss they're replayed. How a core re-runs only the instructions that used a bad value is on <a href="#/replay">Selective Replay</a>.</p>
<h3 id="sec-unified-distributed">Unified vs. Distributed</h3>
<p>A unified queue uses entries better; per-port queues are smaller and faster. Cost grows with entries times broadcast tags.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A chain of 10 dependent single-cycle adds. How many cycles does it take if wakeup plus select fits in one cycle? If it takes two?</p>`,
        a: `<ol><li>One cycle: each add issues the cycle after its producer, so about <strong>10 cycles</strong>.</li><li>Two cycles: each dependent waits an extra cycle, so about <strong>20 cycles</strong>; the chain runs at half speed.</li><li>This is why single-cycle wakeup-select is a key timing loop.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Loads take 4 cycles on an L1 hit, and dependents are woken assuming a hit. The hit rate is 90%. What happens on a miss, what does it cost, and how would you reduce it?</p>`,
        a: `<p>Dependents issued in the load's shadow find no data and must be cancelled and replayed. The cost is wasted issue slots and extra latency, and with squash-all replay, unrelated instructions get replayed too.</p><p>Fixes: a hit/miss predictor that delays wakeup for loads likely to miss, selective replay of only dependent instructions, and keeping replayed instructions in the queue until they are confirmed.</p>`
      }
    ]
  }
},

{
  id: "wakeup",
  region: "sched",
  title: "Wakeup and Bypass Timing",
  sections: [
    { id: "entry", label: "What an Entry Holds" },
    { id: "broadcast", label: "Broadcasting a Tag" },
    { id: "match", label: "The Match Circuit" },
    { id: "cdb", label: "Tomasulo's Common Data Bus" },
    { id: "cost", label: "Cost as the Register File Grows" },
    { id: "select", label: "Select and the Critical Loop" },
    { id: "bypass", label: "Issuing Before the Value Exists" },
    { id: "latency", label: "Multi-Cycle Producers and Loads" },
    { id: "dispatch", label: "The Dispatch Race" },
    { id: "matrix", label: "Matrix Schedulers" },
    { id: "pipelined", label: "When the Loop Doesn't Fit in a Cycle" }
  ],
  body: `
<p>A renamed instruction sits in an issue queue until its sources are ready. <strong>Wakeup</strong> is the hardware that tells it so. <strong>Select</strong> picks which ready entries go this cycle. This page goes through both at the circuit level, then shows how the scheduler issues a consumer <em>before</em> its operand exists, so the operand arrives through the bypass network just in time. The short version is on <a href="#/scheduler">Scheduler Queues</a>, and in-order forwarding is on <a href="#/data-hazards/forwarding">Data Hazards</a>.</p>
<p>The figure shows where the queues sit, drawn as three queues split by operation type (see <a href="#/scheduler/unified-distributed">Unified vs. Distributed</a>). Rename and dispatch insert entries from the top. Each queue's select logic drains ready entries into its functional units at the bottom. Every select also drives a tag bus that runs past every entry in every queue, and that broadcast is the wakeup this page is about.</p>
<div class="tbl"><svg viewBox="0 0 680 510" role="img" aria-label="Issue queues with the structures that fill and drain them. At the top, Rename, which allocates ROB, issue queue, and load-store queue entries, feeds Dispatch. Dispatch also reads the ready table, one bit per physical register, and routes each instruction by operation type into one of three issue queues: IQ 0 for integer, IQ 1 for loads and stores, and IQ 2 for FP and vector. Each queue holds entries, some ready and requesting, some still waiting, some free. Below each queue, its select logic receives the requests and grants entries to two functional units: select 0 to ALU 0 and ALU 1, select 1 to AGU 0 and AGU 1, select 2 to FP 0 and FP 1. Each select also drives a tag bus, drawn as one line under all three queues, and arrows from that line wake up entries in every queue. The functional units write to the result buses, which feed the PRF write ports and the bypass network back to the functional unit inputs." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrIQ" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrIQt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="20" y="20" width="140" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="200" y="20" width="280" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="530" y="20" width="130" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="40" y="96" width="150" height="114" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="245" y="96" width="150" height="114" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="450" y="96" width="150" height="114" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="60" y="262" width="110" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="265" y="262" width="110" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="470" y="262" width="110" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="45" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="120" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="250" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="325" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="455" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="530" y="330" width="65" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="40" y="395" width="560" height="34" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="stroke-width:1">
<rect x="50" y="118" width="130" height="12" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="50" y="133" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="50" y="148" width="130" height="12" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="50" y="163" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="50" y="178" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
<rect x="50" y="193" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
<rect x="255" y="118" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="255" y="133" width="130" height="12" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="255" y="148" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="255" y="163" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="255" y="178" width="130" height="12" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="255" y="193" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
<rect x="460" y="118" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="460" y="133" width="130" height="12" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="460" y="148" width="130" height="12" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="460" y="163" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
<rect x="460" y="178" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
<rect x="460" y="193" width="130" height="12" style="fill:none;stroke:var(--muted);stroke-dasharray:3 3"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M160,40 H198" marker-end="url(#arrIQ)"/>
<path d="M530,40 H482" marker-end="url(#arrIQ)"/>
<path d="M230,60 V78 H115 V94" marker-end="url(#arrIQ)"/>
<path d="M320,60 V94" marker-end="url(#arrIQ)"/>
<path d="M450,60 V78 H525 V94" marker-end="url(#arrIQ)"/>
<path d="M75,210 V260" marker-end="url(#arrIQ)"/>
<path d="M280,210 V260" marker-end="url(#arrIQ)"/>
<path d="M485,210 V260" marker-end="url(#arrIQ)"/>
<path d="M77,290 V328" marker-end="url(#arrIQ)"/>
<path d="M152,290 V328" marker-end="url(#arrIQ)"/>
<path d="M282,290 V328" marker-end="url(#arrIQ)"/>
<path d="M357,290 V328" marker-end="url(#arrIQ)"/>
<path d="M487,290 V328" marker-end="url(#arrIQ)"/>
<path d="M562,290 V328" marker-end="url(#arrIQ)"/>
<path d="M77,360 V393" marker-end="url(#arrIQ)"/>
<path d="M152,360 V393" marker-end="url(#arrIQ)"/>
<path d="M282,360 V393" marker-end="url(#arrIQ)"/>
<path d="M357,360 V393" marker-end="url(#arrIQ)"/>
<path d="M487,360 V393" marker-end="url(#arrIQ)"/>
<path d="M562,360 V393" marker-end="url(#arrIQ)"/>
<path d="M600,412 H640 V345 H597" marker-end="url(#arrIQ)"/>
</g>
<g style="fill:none;stroke:var(--trace);stroke-width:1.5">
<path d="M40,236 H600" style="stroke-width:3"/>
<path d="M155,262 V236"/><path d="M360,262 V236"/><path d="M565,262 V236"/>
<path d="M115,236 V212" marker-end="url(#arrIQt)"/>
<path d="M320,236 V212" marker-end="url(#arrIQt)"/>
<path d="M525,236 V212" marker-end="url(#arrIQt)"/>
</g>
<g style="fill:var(--trace)"><circle cx="155" cy="236" r="3.5"/><circle cx="360" cy="236" r="3.5"/><circle cx="565" cy="236" r="3.5"/></g>
<g style="fill:var(--ink);font-size:12px">
<text x="90" y="37" text-anchor="middle" style="font-weight:600">Rename</text>
<text x="340" y="37" text-anchor="middle" style="font-weight:600">Dispatch</text>
<text x="595" y="37" text-anchor="middle" style="font-weight:600">Ready table</text>
<text x="115" y="110" text-anchor="middle" style="font-weight:600">IQ 0: integer</text>
<text x="320" y="110" text-anchor="middle" style="font-weight:600">IQ 1: load/store</text>
<text x="525" y="110" text-anchor="middle" style="font-weight:600">IQ 2: FP/vector</text>
<text x="115" y="280" text-anchor="middle" style="font-weight:600">select 0</text>
<text x="320" y="280" text-anchor="middle" style="font-weight:600">select 1</text>
<text x="525" y="280" text-anchor="middle" style="font-weight:600">select 2</text>
<text x="77" y="349" text-anchor="middle">ALU 0</text>
<text x="152" y="349" text-anchor="middle">ALU 1</text>
<text x="282" y="349" text-anchor="middle">AGU 0</text>
<text x="357" y="349" text-anchor="middle">AGU 1</text>
<text x="487" y="349" text-anchor="middle">FP 0</text>
<text x="562" y="349" text-anchor="middle">FP 1</text>
<text x="320" y="416" text-anchor="middle">Result buses: PRF write ports and the bypass network</text>
</g>
<g style="fill:var(--muted);font-size:10px">
<text x="90" y="52" text-anchor="middle">allocate ROB, IQ, LSQ</text>
<text x="340" y="52" text-anchor="middle">route by op type, set initial ready bits</text>
<text x="595" y="52" text-anchor="middle">1 bit per phys reg</text>
<text x="70" y="252" text-anchor="end">request</text>
<text x="217" y="268" text-anchor="middle" style="fill:var(--trace)">tag buses</text>
<text x="217" y="280" text-anchor="middle" style="fill:var(--trace)">to all queues</text>
<text x="115" y="314" text-anchor="middle">grant, issue</text>
<text x="645" y="375">bypass</text>
</g>
<g style="fill:var(--ink);font-size:11px">
<text x="20" y="456">Insert: dispatch writes up to the rename width of entries per cycle, steered by op type.</text>
<text x="20" y="474">Drain: each select grants up to one entry per port per cycle. The entry is freed at issue,</text>
<text x="20" y="492">or held until a load's hit is confirmed. Shaded rows are ready and requesting, dashed rows are free.</text>
</g>
</svg></div>
<h3 id="sec-entry">What an Entry Holds</h3>
<p>Each issue-queue (reservation station) entry holds:</p>
<ul><li><code>valid</code>: the entry is in use</li><li><code>op</code>: the operation (often kept in a separate payload RAM that is read only after select)</li><li><code>src0_tag</code>, <code>src1_tag</code>: the physical register numbers of the sources, ⌈log₂(PRF size)⌉ bits each</li><li><code>src0_rdy</code>, <code>src1_rdy</code>: one ready bit per source</li><li><code>dst_tag</code>: the destination physical register</li></ul>
<p>The ready bits are sticky flip-flops. Once set, they stay set until the entry is freed, squashed, or cancelled by a load replay.</p>
<h3 id="sec-broadcast">Broadcasting a Tag</h3>
<ul>
<li>There is one <strong>tag bus</strong> per issue slot, so a machine that issues W instructions per cycle has W tag buses. Each carries a producer's <code>dst_tag</code> and a valid bit, and runs past every entry in the queue.</li>
<li>Every source field has one comparator per bus. The queue has entries × 2 sources × W buses comparators, and all of them evaluate every cycle.</li>
<li>The update rule for each source is <code>src_rdy_next = src_rdy | match_bus0 | match_bus1 | …</code>.</li>
<li>The tag goes out when the producer is <em>selected</em>, not when it finishes. That is what lets a dependent instruction issue in the very next cycle (see <a href="#/wakeup/bypass">Issuing Before the Value Exists</a>).</li>
</ul>
<h3 id="sec-match">The Match Circuit</h3>
<p>Each comparator is a CAM match line:</p>
<ol><li>At the start of the cycle the match line is precharged high.</li><li>Each tag bit drives an XOR of the bus bit and the stored bit. The XOR output gates a pull-down transistor on the match line.</li><li>Any mismatched bit discharges the line. The line stays high only if every bit matches, and the bus valid bit gates the result.</li><li>The W match lines for a source are ORed together and with the current ready bit, and the result is written into the ready flip-flop.</li><li>The entry's request is <code>valid & src0_rdy & src1_rdy</code>.</li></ol>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="Wakeup logic for one source of one issue queue entry, with two tag buses. Tag bus 0 carries p17 with valid set, and tag bus 1 carries p33 with valid set. The entry's stored source tag is p17. Comparator 0 compares bus 0 with the stored tag and outputs 1, a match. Comparator 1 compares bus 1 with the stored tag and outputs 0. Both outputs and the current ready bit go into an OR gate, whose output is written into the src0 ready flip-flop. The flip-flop feeds back into the OR gate and forward into an AND gate with the entry's valid bit and src1 ready bit, which produces the entry's request to select. Notes below say each comparator is a precharged match line discharged by any mismatched bit, and that the queue has entries times 2 sources times W buses comparators." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrWK" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="20" y="30" width="150" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="20" y="90" width="150" height="34" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="20" y="150" width="150" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="230" y="48" width="70" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="230" y="126" width="70" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="350" y="82" width="60" height="50" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="450" y="87" width="80" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="570" y="80" width="90" height="54" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M170,47 H200 V60 H228" marker-end="url(#arrWK)"/>
<path d="M170,107 H200 V78 H228" marker-end="url(#arrWK)"/>
<path d="M200,107 V136 H228" marker-end="url(#arrWK)"/>
<path d="M170,167 H200 V154 H228" marker-end="url(#arrWK)"/>
<path d="M300,68 H325 V98 H348" marker-end="url(#arrWK)"/>
<path d="M300,146 H325 V116 H348" marker-end="url(#arrWK)"/>
<path d="M410,107 H448" marker-end="url(#arrWK)"/>
<path d="M530,107 H568" marker-end="url(#arrWK)"/>
<path d="M540,107 V190 H380 V134" marker-end="url(#arrWK)"/>
<path d="M615,175 V136" marker-end="url(#arrWK)"/>
<path d="M660,107 H676"/>
</g>
<g style="fill:var(--ink);font-size:12px">
<text x="30" y="52" style="font-family:var(--mono);font-size:11px">bus 0: p17, valid</text>
<text x="30" y="112" style="font-family:var(--mono);font-size:11px">src0_tag: p17</text>
<text x="30" y="172" style="font-family:var(--mono);font-size:11px">bus 1: p33, valid</text>
<text x="265" y="73" text-anchor="middle" style="font-weight:600">=</text>
<text x="265" y="151" text-anchor="middle" style="font-weight:600">=</text>
<text x="380" y="112" text-anchor="middle" style="font-weight:600">OR</text>
<text x="490" y="104" text-anchor="middle" style="font-weight:600">src0_rdy</text>
<text x="490" y="119" text-anchor="middle">flip-flop</text>
<text x="615" y="102" text-anchor="middle" style="font-weight:600">AND</text>
<text x="615" y="120" text-anchor="middle">request</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="306" y="62">1</text><text x="306" y="140">0</text>
<text x="390" y="204">old ready bit</text>
<text x="575" y="190">valid, src1_rdy</text>
<text x="20" y="20">tag buses from select (one per issue slot)</text>
</g>
<g style="fill:var(--ink);font-size:11px">
<text x="20" y="236">Each "=" is a match line: precharged high, pulled low by any mismatched bit (one XOR per tag bit).</text>
<text x="20" y="254">One entry has 2 sources × W buses comparators. The whole queue has entries × 2 × W.</text>
<text x="20" y="272">All of them evaluate every cycle that any bus is valid.</text>
</g>
</svg></div>
<h3 id="sec-cdb">Tomasulo's Common Data Bus</h3>
<p>The tag bus descends from the Common Data Bus (CDB) of Tomasulo's algorithm in the IBM 360/91, as described in Hennessy and Patterson, chapter 3. There, the names were reservation-station numbers rather than physical registers. Each reservation station holds:</p>
<ul><li><strong>Op:</strong> the operation</li><li><strong>Vj, Vk:</strong> the source values, once known</li><li><strong>Qj, Qk:</strong> the reservation station that will produce each source, or 0 if the value is already in V</li><li><strong>Busy:</strong> the station is in use</li></ul>
<p>Each register in the register file also has a status field Qi: the reservation station that will write it, or 0 if the register holds the current value.</p>
<p>When a result is ready:</p>
<ol>
<li>The functional unit requests the CDB. If two units finish in the same cycle, one must wait, because there is only one bus.</li>
<li>The winner drives the tag (its reservation-station number) <em>and the full result value</em> onto the CDB in the same cycle.</li>
<li>Every reservation station compares Qj and Qk with the tag. On a match it latches the value into Vj or Vk and clears the Q field.</li>
<li>Every register whose Qi matches latches the value and clears Qi. Store buffers waiting for data do the same.</li>
<li>A station whose Qj and Qk are both 0 can start executing in the next cycle.</li>
</ol>
<p>Three consequences follow, and modern cores changed all three.</p>
<ul>
<li><strong>Wakeup and data travel together.</strong> A consumer can't start until the producer has finished and won the bus, so every dependence costs the producer's latency plus the CDB cycle. Modern cores broadcast the tag early, at select time, and deliver the value later through the bypass network.</li>
<li><strong>One result per cycle.</strong> A single CDB is a structural hazard once several units can finish together. Adding CDBs multiplies both the comparators and the value wires.</li>
<li><strong>Every entry stores values.</strong> Each source needs a 64-bit (or 256-bit or 512-bit for vector) latch writable from every CDB, and each CDB runs its full value width past every entry. This "value-capture" scheduler survived into Intel's P6 family. Cores built around a physical register file, like the Pentium 4 and Intel cores from Sandy Bridge on, keep only tags in the queue and broadcast only tags, so each bus is ⌈log₂(PRF size)⌉ bits wide instead of a full value width.</li>
</ul>
<p>So in a PRF-based core the old CDB has split in two: narrow <strong>tag buses</strong> driven at select time for wakeup, and wide <strong>result buses</strong> driven at the end of execution, which feed the bypass network and the PRF write ports.</p>
<h3 id="sec-cost">Cost as the Register File Grows</h3>
<p>Let N be the number of queue entries, W the number of tag buses, P the PRF size, and b = ⌈log₂ P⌉ the tag width.</p>
<ul>
<li><strong>Tag storage:</strong> N entries × 2 sources × b bits.</li>
<li><strong>Comparators:</strong> N × 2 × W comparators, each b bits wide, so N × 2 × W × b XOR cells.</li>
<li><strong>Ready table (scoreboard):</strong> one bit per physical register, P bits in all, set by every tag bus (W write ports) and read at dispatch (2 read ports per dispatched instruction).</li>
<li><strong>Delay:</strong> Palacharla, Jouppi, and Smith (ISCA 1997) split wakeup delay into tag drive, tag match, and the OR of the match lines. Tag drive dominates in large windows. The bus is a wire whose length grows with N, and each entry gets taller with W (one bus track and one comparator per bus), and wire RC delay grows with the square of length, so tag drive grows faster than linearly in N, and faster still at larger W. Tag match grows only slightly with b.</li>
<li><strong>Energy:</strong> almost every comparison mismatches, and a mismatch discharges a precharged match line, so nearly all N × 2 × W match lines burn energy every cycle that buses are active. Gating the comparators of empty entries and of sources that are already ready (Folegnani and González, ISCA 2001) removes much of that.</li>
</ul>
<p>The PRF size enters only through b, which grows with log₂ P. For a 64-entry queue with 4 tag buses (512 comparators):</p>
<div class="tbl"><table>
<tr><th>PRF size</th><th>Tag width b</th><th>XOR cells (N × 2 × W × b)</th><th>Relative</th></tr>
<tr><td>64 registers</td><td>6 bits</td><td>3,072</td><td>1.00×</td></tr>
<tr><td>128 registers</td><td>7 bits</td><td>3,584</td><td>1.17×</td></tr>
<tr><td>256 registers</td><td>8 bits</td><td>4,096</td><td>1.33×</td></tr>
<tr><td>512 registers</td><td>9 bits</td><td>4,608</td><td>1.50×</td></tr>
</table></div>
<p>Doubling the PRF adds one bit per comparator, a modest increase. Doubling the queue or the issue width doubles the comparator count and lengthens or loads every bus. The cost of more registers falls elsewhere: on the PRF's own ports and bitlines (<a href="#/prf-sizing">Sizing the Physical Register File</a>), on the ready table, and on every structure that stores a tag (RAT, ROB, payload RAM).</p>
<h3 id="sec-select">Select and the Critical Loop</h3>
<ul>
<li>Every entry whose request is high competes. A priority encoder or tree arbiter grants up to one request per functional unit (or per port) each cycle.</li>
<li>Priority is usually oldest first. A compacting queue keeps entries in age order so position gives age. A non-compacting queue keeps an N × N age matrix.</li>
<li>The granted entry reads its payload (op, destination) and drives its <code>dst_tag</code> onto a tag bus, which closes the loop.</li>
</ul>
<p>The loop select → tag bus → match → ready bit → request → select must fit in one cycle for dependent single-cycle instructions to issue back to back. Its delay grows with N and W, which is why large windows are split into several smaller queues, each with its own select logic.</p>
<h3 id="sec-bypass">Issuing Before the Value Exists</h3>
<p>The scheduler never checks a value. A ready bit doesn't mean "my operand is in a register." It means "if I issue now, my operand will be at my functional unit's input when I reach execute." The scheduler knows each producer's latency and broadcasts its tag exactly early enough to make that true. The value then arrives through a bypass path instead of the register file.</p>
<p>Take a pipeline with four stages after the queue: select (S), register read (RR), execute (EX), and writeback (WB), which writes the PRF. A is a single-cycle add. B and D both read A's result p20. B wins select in cycle 1. D loses select in cycle 1 to an older instruction and goes in cycle 2.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>Cycle 0</th><th>Cycle 1</th><th>Cycle 2</th><th>Cycle 3</th><th>Cycle 4</th></tr>
<tr><td><code>A: p20 = p5 + p6</code></td><td>S, broadcast p20</td><td>RR</td><td>EX, p20 computed</td><td>WB, p20 written to PRF</td><td></td></tr>
<tr><td><code>B: p21 = p20 + p7</code></td><td>woken at the end of the cycle</td><td>S, broadcast p21</td><td>RR, PRF still holds stale p20</td><td>EX, p20 from the EX → EX bypass</td><td>WB</td></tr>
<tr><td><code>D: p22 = p20 + p8</code></td><td>woken at the end of the cycle</td><td>requests, loses select</td><td>S</td><td>RR, A writes p20 this cycle</td><td>EX, p20 from the WB → EX bypass</td></tr>
</table></div>
<ul>
<li><strong>B</strong> is selected one cycle after A. It reaches EX in cycle 3, right after A's result leaves the ALU at the end of cycle 2. Its register read in cycle 2 returns garbage for p20, and the bypass mux replaces it with A's ALU output.</li>
<li><strong>D</strong> reads the PRF in cycle 3, the same cycle A writes it. Either the file writes in the first half of the cycle and reads in the second, or a second bypass level carries A's value from the writeback latch.</li>
<li>Any consumer that reads the PRF in cycle 4 or later finds p20 there.</li>
</ul>
<p>Each functional unit's input has a mux with one input from the PRF and one per (functional unit × bypass level). There are two ways to drive its select lines.</p>
<ol><li><strong>Tag compare at register read:</strong> compare the consumer's source tags with the destination tags in every unit's EX and WB latches, and take the newest match. This is the same forwarding unit an in-order pipeline uses.</li><li><strong>Timing known at issue:</strong> the scheduler knows which bus woke the source and how many cycles ago, which maps directly to one bypass input. A source that was ready long before needs the PRF.</li></ol>
<p>The bypass network's cost grows as (functional units)² × levels × value width in wires, because every unit's result must reach every unit's input. Wide cores cluster their units: the Alpha 21264 split its integer units into two clusters, and a value crossing between them cost one extra cycle.</p>
<h3 id="sec-latency">Multi-Cycle Producers and Loads</h3>
<ul>
<li><strong>Fixed latency L:</strong> broadcast the tag L − 1 cycles after select. For a 3-cycle multiply selected in cycle 0: RR in cycle 1, EX in cycles 2 to 4. The tag goes out in cycle 0 + (3 − 1) = 2, the consumer is selected in cycle 3, reads registers in cycle 4, and executes in cycle 5, right after the result appears. Single-cycle ops are the case L − 1 = 0. The delay is a shift register on the bus side or a countdown in each consumer entry.</li>
<li><strong>Variable latency (dividers):</strong> the unit announces a few cycles ahead when it will finish, and the tag goes out then.</li>
<li><strong>Loads:</strong> the latency isn't known at select, because the access may miss. The scheduler assumes an L1 hit (4 cycles to use on AMD Zen 4) and wakes dependents speculatively. If the load misses, the dependents already issued in its shadow are cancelled: their ready bits clear, they stay in the queue, and the load's fill re-broadcasts the tag later. How cores limit the damage is on <a href="#/replay">Selective Replay</a>.</li>
</ul>
<h3 id="sec-dispatch">The Dispatch Race</h3>
<p>A new entry initializes its ready bits from the ready table, which reflects broadcasts up to the end of the previous cycle. A broadcast in the <em>same</em> cycle would miss the entry, because its tags aren't in the CAM yet. Dispatch therefore also compares the incoming source tags with the current cycle's tag buses and ORs the result into the initial ready bits. A source whose producer is in the same dispatch group simply starts not ready.</p>
<h3 id="sec-matrix">Matrix Schedulers</h3>
<ul>
<li>Instead of tags, keep an N × N bit matrix. Row = consumer entry, column = producer entry.</li>
<li>At dispatch, set the bits for the queue entries the new instruction depends on. This needs a map from physical register to the queue entry that produces it.</li>
<li>When an entry is granted, clear its column: one wire per entry, no tag compare.</li>
<li>An entry is ready when its row is all zeros, a wide NOR.</li>
</ul>
<p>The matrix costs N² bits regardless of P, while the CAM costs N × 2 × W × b. They cross at N = 2 × W × b entries. For the 64-entry, 4-bus queue with a 256-entry PRF above, both come to 4,096 cells, and the matrix grows faster with N. That is one reason matrix schedulers are built as several small queues. The design is from Goshima et al. (MICRO 2001) and is widely reported in Intel and AMD cores.</p>
<h3 id="sec-pipelined">When the Loop Doesn't Fit in a Cycle</h3>
<p>If wakeup and select take two cycles, a dependent single-cycle instruction issues every other cycle and a chain runs at half speed. Stark, Brown, and Patt (MICRO 2000) recover most of the loss with speculative wakeup from grandparents: an instruction becomes a candidate when its parents' parents have issued, betting that the parents will be selected next. A wrong bet costs a cancel, the same mechanism loads already need.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A fused multiply-add with a 4-cycle latency (Intel Golden Cove and AMD Zen 4 both list 4 cycles) is selected in cycle 10. A dependent FMA uses its result as the addend. When must the producer broadcast its tag, and in which cycles is the consumer selected, read, and executed?</p><p class="given">Assume the pipeline after the queue is one select stage, one register-read stage, then execute, the consumer is selected in the first cycle it is ready, and wakeup and select fit in one cycle.</p>`,
        a: `<ol><li>Producer: select in cycle 10, register read in cycle 11, execute in cycles 12 to 15. The result exists at the end of cycle 15.</li><li>The consumer must execute in cycle 16, so it must read registers in cycle 15 and be selected in cycle 14. It must be woken by the end of cycle 13.</li><li>Broadcast cycle = select cycle + (latency − 1) = cycle 10 + (4 cycles − 1 cycle) = <strong>cycle 13</strong>.</li><li>Consumer: selected in cycle 14, register read in cycle 15 (the PRF doesn't have the value yet), execute in cycle 16 with the addend taken from the FMA unit's bypass.</li><li>If the tag went out at writeback (cycle 16) instead, the consumer would be selected in cycle 17 and execute in cycle 19, 3 cycles later on every link of the chain.</li></ol>`
      },
      {
        q: `<p>Intel Golden Cove is reported to have a 97-entry scheduler and a 280-entry integer PRF. Count the wakeup comparators and XOR cells, then compare two upgrades: growing the PRF to 512 entries, or doubling the scheduler to 194 entries.</p><p class="given">Assume 8 tag buses, two sources per entry, and one comparator per source per bus.</p>`,
        a: `<ol><li>Tag width: ⌈log₂ 280⌉ = 9 bits.</li><li>Comparators: 97 entries × 2 sources/entry × 8 buses = 1,552 comparators.</li><li>XOR cells: 1,552 comparators × 9 bits = <strong>13,968</strong>.</li><li>PRF to 512: ⌈log₂ 512⌉ = 9 bits, the same width. Comparator count and size are <strong>unchanged</strong>. The cost goes to the PRF itself and the ready table (512 bits instead of 280 bits).</li><li>Scheduler to 194: 194 entries × 2 sources/entry × 8 buses × 9 bits = <strong>27,936</strong> XOR cells, 2× the logic, plus tag buses twice as long, so wakeup delay grows faster than 2×.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You are choosing between a CAM scheduler and a matrix scheduler for one queue. Derive the queue size at which their cell counts cross, evaluate it for a design, and say what the cell counts leave out.</p><p class="given">Assume 8 tag buses, a 280-entry PRF, two sources per entry, and that the CAM costs one XOR cell per tag bit per comparator while the matrix costs one bit per (consumer, producer) pair.</p>`,
        a: `<ol><li>CAM: N entries × 2 sources × 8 buses × ⌈log₂ 280⌉ bits = N × 2 × 8 × 9 = 144 × N cells.</li><li>Matrix: N × N bits.</li><li>Crossover: N² = 144 × N, so N = <strong>144 entries</strong>. Below that the matrix is smaller. At 97 entries: matrix 97 × 97 = 9,409 bits versus CAM 97 × 144 = 13,968 cells.</li><li>What the counts leave out:<ul><li>The CAM also stores 2 tags per entry (97 entries × 2 sources × 9 bits = 1,746 bits) and needs the ready table at dispatch.</li><li>The matrix needs a map from physical register to producing queue entry at dispatch, plus the ready table for producers that have already left the queue.</li><li>Delay: the CAM's tag buses lengthen with N, and the matrix's per-row NOR widens with N. The matrix's N² growth is why it is split into several small queues.</li><li>The matrix has no tag width, so it doesn't care how big the PRF gets.</li></ul></li></ol>`
      },
      {
        q: `<p>A chain of 12 dependent single-cycle adds runs through a scheduler. How long does the chain take if tags are broadcast at select, versus at writeback as in the original Tomasulo CDB, and what hardware does the first option require?</p><p class="given">Assume the pipeline after the queue is select, register read, execute, and writeback, each one cycle, the adds never lose select, and wakeup plus select fit in one cycle.</p>`,
        a: `<ol><li>Broadcast at select: each add is selected the cycle after its producer, so the chain issues at 1 cycle/add. 12 adds × 1 cycle/add = <strong>12 cycles</strong> from the first add's execute to the end of the last add's execute.</li><li>Broadcast at writeback: a producer selected in cycle t writes back in cycle t + 3, and its consumer is selected in cycle t + 4. That is 4 cycles/add, so 12 adds × 4 cycles/add = <strong>48 cycles</strong>, 4× slower.</li><li>Hardware for the first option:<ul><li>An EX → EX bypass, because the consumer's register read happens before the producer has a result.</li><li>A WB → EX bypass (or write-before-read in the PRF), for consumers that lose select by one cycle.</li><li>Mux control for the bypass, by tag compares at register read or by timing known at issue.</li><li>A cancel mechanism for producers whose latency turns out longer than assumed, such as loads that miss.</li></ul></li></ol>`
      }
    ]
  }
},

{
  id: "replay",
  region: "sched",
  title: "Selective Replay",
  sections: [
    { id: "refetch", label: "Squash and Refetch" },
    { id: "setting", label: "Where the Idea Came From" },
    { id: "reexec", label: "Re-execution Recovery" },
    { id: "results", label: "What It Bought" },
    { id: "hold", label: "The Cost: Holding Entries" },
    { id: "later", label: "Replay in Later Cores" },
    { id: "takeaways", label: "Takeaways" }
  ],
  body: `
<p>When a speculative value turns out to be wrong, every instruction that used it must run again with the right value. There are two ways to get there. The core can squash everything younger and refetch it, or it can re-execute only the instructions that actually consumed the bad value. Tyson and Austin (MICRO 1997) built and measured the second approach, which they called <strong>re-execution recovery</strong>. Later work calls the same idea <strong>selective replay</strong>.</p>

<h3 id="sec-refetch">Squash and Refetch</h3>
<p>Squash recovery treats a bad load value like a mispredicted branch. In Tyson and Austin's words, "Mis-speculated loads may be treated the same as mis-speculated branches."</p>
<ul>
<li><strong>What happens:</strong> The core throws away the load and every younger instruction, restores the rename map, and restarts fetch at the load's PC.</li>
<li><strong>Why it's correct:</strong> Every instruction that could have used the bad value is younger than the load, so it's in the squashed set.</li>
<li><strong>Why it's expensive:</strong> Most of the squashed instructions never touched the bad value. They get refetched, decoded, renamed, and executed again anyway. On top of that, the front end has to refill before the first refetched instruction even reaches the scheduler.</li>
<li><strong>Why designers like it:</strong> It reuses the branch recovery hardware, so it costs almost nothing extra.</li>
</ul>

<h3 id="sec-setting">Where the Idea Came From</h3>
<p>Tyson and Austin needed cheap recovery for <strong>memory renaming</strong>, which makes a load look like a register read:</p>
<ol>
<li>At decode, the load's PC indexes a <strong>store/load cache</strong>. That cache returns an index into a <strong>value file</strong>, which is shared by a load and the store predicted to produce its data.</li>
<li>At rename, the load reads the value file. It gets the value that store last wrote, or the store's LSQ entry if the store is still in flight. Dependents then start right away, before the load has computed its address.</li>
<li>The load still accesses memory as usual. When the real value returns, the core compares it with the predicted one. A mismatch is a mis-speculation.</li>
<li>Confidence counters at decode decide which loads get renamed at all.</li>
</ol>
<p>So the error here is a wrong value, not a store-load ordering violation found by an address search. The recovery problem is the same, though: one load handed a bad value to a tree of dependents. One difference matters. In memory renaming, the verifying memory access has already produced the correct value, so the load itself doesn't need to run again. After an ordering violation, the load has to re-read memory first.</p>

<h3 id="sec-reexec">Re-execution Recovery</h3>
<p>Tyson and Austin leave every instruction in place and use the scheduler's own wakeup network to find the dependents. In their words, the approach "leverages dependence information stored in the reservation stations of not-yet retired instruction[s] to permit re-execution of only those instructions dependent on a speculative load value."</p>
<ol>
<li>The verifying access returns a value that doesn't match the prediction.</li>
<li>The core puts the correct value on the result bus under the load's destination tag, just like a normal completion.</li>
<li>Every waiting instruction whose operand tag matches captures the new value and re-executes. It then broadcasts its new result, which re-triggers its own dependents, and so on down the chain.</li>
<li>Memory dependences need extra help. When a store re-executes, the LSQ rechecks it against younger loads and re-issues any that read from it. A load whose address operand was regenerated also re-executes.</li>
</ol>
<p>Nothing is refetched, and younger instructions that never used the load's value keep their results.</p>
<p><strong>An instruction can run more than twice.</strong> No instruction knows how many of its operands will be regenerated, so it simply re-executes each time a new one arrives. If both operands of an add come from the bad load through chains of different lengths, the add runs once with the first corrected operand and again with the second. The paper says an instruction "may possibly re-execute multiple times, once for every re-generated operand that arrives."</p>
<p><strong>When it's safe to let go.</strong> An instruction can't free its reservation station entry when it issues, because a corrected operand might still arrive. The paper's rule is retirement: "At retirement, any re-executed instruction will be the oldest instruction in the machine, thus it cannot receive any more re-generated values, and the instruction may be safely retired."</p>

<div class="tbl"><table>
<tr><th></th><th>Squash and refetch</th><th>Selective replay</th></tr>
<tr><td>What runs again</td><td>The load and every younger instruction</td><td>Only instructions downstream of the bad value</td></tr>
<tr><td>Front end</td><td>Refetch, decode, and rename again</td><td>Not involved</td></tr>
<tr><td>Extra hardware</td><td>Almost none (branch recovery path)</td><td>Re-broadcast on the result bus, LSQ recheck for re-executed stores</td></tr>
<tr><td>Scheduler entries</td><td>Freed at issue</td><td>Held until the instruction can't be replayed</td></tr>
<tr><td>Penalty grows with</td><td>Front-end depth and window occupancy</td><td>Depth of the dependence chain</td></tr>
</table></div>

<h3 id="sec-results">What It Bought</h3>
<p>The simulator was SimpleScalar's sim-outorder: 8-wide issue and commit, a 256-entry RUU ("re-order buffer that implements renamed register storage and holds results of pending instructions"), and a 128-entry LSQ. Store forwarding took 1 cycle, and a branch mispredict cost 8 cycles. The workload was 10 SPEC95 programs.</p>
<ul>
<li><strong>Squash recovery hurt:</strong> With a moderate confidence threshold (their SQ-422), many programs saw only small speedups and CC1 slowed down by more than 5%. As they put it, "Many of the programs had more data mis-speculations than branch mis-predictions!"</li>
<li><strong>Raising the threshold only partly helped:</strong> A stricter threshold (SQ-844) mis-speculated less, but CC1 still gained very little.</li>
<li><strong>Re-execution fixed it:</strong> The same threshold with re-execution (RE-422) sped up every program, by as much as 14% for M88ksim and over 6% on average.</li>
<li><strong>Most squashed work was independent:</strong> Re-execution used less than 1/3 of the execution bandwidth squash recovery did. So, on average, fewer than 1 in 3 of the instructions in flight after a mis-speculation depended on the bad load.</li>
<li><strong>Cheap recovery allows bolder speculation:</strong> With re-execution, they could rename lower-confidence loads too (RE-211), and that did better for most programs. Going further (thresholds 111 and 000) raised mis-speculation too much.</li>
<li><strong>Slower forwarding raises the payoff:</strong> With a 3-cycle store forward, renaming with re-execution gained up to 41% for M88ksim and more than 16% overall.</li>
</ul>
<p>The lesson goes beyond renaming: <strong>recovery cost sets how aggressively you can speculate.</strong> When a wrong guess is cheap, the predictor can accept a lower hit rate in exchange for covering more instructions.</p>

<h3 id="sec-hold">The Cost: Holding Entries</h3>
<p>In sim-outorder, the RUU is both the reorder buffer and the reservation stations. Every instruction keeps its RUU entry until commit no matter what, so holding it for possible re-execution costs no capacity. That's why the cost never shows up in Tyson and Austin's results.</p>
<p>Real cores split the two. The ROB is large and cheap per entry. The issue queue is small, because every entry compares its operand tags on every wakeup broadcast. The Alpha 21264 has a 20-entry integer queue and a 15-entry FP queue, and it frees an entry as soon as its instruction issues. Selective replay breaks that: an entry has to stay from dispatch all the way to the point where it can no longer be replayed.</p>
<p>Little's law shows the size of the cost. Occupancy equals dispatch rate × time per entry. Under early deallocation, time per entry is dispatch-to-issue, often a handful of cycles. Under replay-until-retire, it's dispatch-to-retire, which includes every cache miss ahead of the instruction in program order. The queue either grows, which hurts the wakeup and select timing loop, or fills and stalls dispatch. This is the argument Chrysos and Emer make on the <a href="#/mdp-metrics/bounds">Memory Dependence Prediction</a> page. They keep early deallocation and use a predictor good enough that violations, and their full squash cost, almost never happen.</p>
<p>The way out is to shorten how long an entry has to wait. An instruction only needs its entry until every older speculative value it could depend on has been confirmed. If confirmation comes a few cycles after issue, the hold is short too.</p>

<h3 id="sec-later">Replay in Later Cores</h3>
<p>That short-hold version is exactly where replay ended up: <a href="#/scheduler/speculative-wakeup">speculative wakeup</a> on load hits. The scheduler wakes a load's dependents as if the load will hit in L1, so they issue in time to catch its data on the bypass. If the load misses, those dependents read garbage and must issue again. The hit/miss answer arrives a few cycles after the load issues, so entries are held only that long, not until retire.</p>
<p>Kim and Lipasti (HPCA 2004) compare the ways to do this:</p>
<ul>
<li><strong>Squashing replay:</strong> Re-issue everything that issued in the load's shadow, dependent or not. It's simple, but it wastes issue slots.</li>
<li><strong>Selective replay:</strong> Re-issue only the load's dependence chain, Tyson and Austin's idea applied to scheduling. It needs a way to tell which instructions depend on which in-flight loads.</li>
</ul>
<p>Store-load ordering violations, the hard case Chrysos and Emer studied, are still usually handled by a full squash. The load has to re-read memory, the violation shows up long after issue, and a good dependence predictor keeps violations rare.</p>

<h3 id="sec-takeaways">Takeaways</h3>
<ul>
<li>Replay re-runs only the instructions downstream of a bad value, from the scheduler, without going back to fetch. Refetch re-runs everything younger.</li>
<li>Tyson and Austin re-broadcast the correct value on the result bus and let the normal wakeup network find the dependents. An instruction may run once per regenerated operand.</li>
<li>In their study, fewer than 1 in 3 in-flight instructions depended on a mis-speculated load. Re-execution turned a slowdown into speedups on every program and allowed lower-confidence speculation.</li>
<li>The price is scheduler occupancy. An entry must stay until no corrected operand can reach it. Their RUU model hid this cost, but in a core with a small issue queue that frees entries at issue, it's real.</li>
<li>Replay works best when confirmation comes quickly, as with load hit speculation. For rare, late-detected errors such as ordering violations, prediction plus squash is usually the better trade.</li>
</ul>
<p class="refs">References: Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997 · Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Kim and Lipasti, "Understanding Scheduling Replay Schemes," HPCA 2004 · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core finds that a load got a wrong value. At that moment 180 younger instructions are in flight, and 40 of them depend on the load, directly or through other instructions. The longest dependence chain after the load is 7 single-cycle instructions. A refetch reaches the scheduler 13 cycles after the redirect. Compare the work wasted and the time to recover under squash and refetch versus selective replay. Ignore overlap with other work.</p>`,
        a: `<ol><li>Squash: all 180 younger instructions are thrown away and must be fetched again. The first one reaches the scheduler after 13 cycles. Re-dispatching all of them at 6 instructions/cycle takes 180 instructions / 6 instructions/cycle = 30 cycles. So the window is back where it was after about 13 cycles + 30 cycles = <strong>43 cycles</strong>, and <strong>180 instructions</strong> run a second time.</li><li>Replay: the correct value is broadcast, and only the 40 dependents issue again. The last one gets its correct value once the longest chain re-executes: 7 instructions × 1 cycle/instruction = <strong>7 cycles</strong>. The wasted work is <strong>40 issue slots</strong>.</li><li>Replay re-executes 40 instructions / 180 instructions ≈ 22% of what squash does, and it never touches the front end. The other 140 instructions keep their results.</li><li>What replay costs instead: all 180 instructions had to keep their scheduler entries after issuing, since any of them could have been a dependent until the load was checked.</li></ol>`
      },
      {
        q: `<p>A load L writes r1 with a wrong value. Three instructions use it:</p><ul><li>I1: add r2 = r1 + 8 (1 cycle)</li><li>I2: mul r3 = r1 × r6 (3 cycles)</li><li>I3: sub r4 = r2 − r3 (1 cycle)</li></ul><p>All three have already executed with the wrong r1. Using Tyson and Austin's re-execution recovery, the correct r1 is broadcast at the end of cycle 0. Each instruction issues the cycle after an operand arrives, and its result is broadcast at the end of its last execute cycle. Trace the replay. How many times does I3 execute during recovery?</p>`,
        a: `<ol><li>Cycle 0: the correct r1 goes out on the result bus. I1 and I2 both match the tag and capture it.</li><li>Cycle 1: I1 and I2 issue. I1 finishes and broadcasts the new r2 at the end of cycle 1. I2 needs 3 cycles (cycles 1, 2, and 3).</li><li>Cycle 2: I3 captures the new r2 and issues. Its r3 is still the stale value from the first wrong execution, so it broadcasts another wrong r4.</li><li>Cycle 3: I2 finishes and broadcasts the correct r3 at the end of the cycle.</li><li>Cycle 4: I3 captures r3 and issues again, now with both operands correct. It broadcasts the correct r4.</li><li>I3 executes <strong>2 times</strong> during recovery, once per regenerated operand. Any consumer of r4 also runs twice, so the extra work can multiply down the chain. A design that waited for both operands would need to know in advance which operands will be regenerated, and the paper notes that's "non-trivial."</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A core dispatches 6 µops/cycle into a 96-entry unified issue queue. On average a µop spends 8 cycles between dispatch and issue, and 30 cycles between issue and retire. Find the average issue queue occupancy when entries are freed at issue, and when they're held until retire for selective replay. What sustained dispatch rate can the second design support? Then propose a fix.</p>`,
        a: `<ol><li>Freed at issue: by Little's law, occupancy = 6 µops/cycle × 8 cycles = <strong>48 entries</strong>. The 96-entry queue is half full on average, with room for bursts.</li><li>Held until retire: occupancy = 6 µops/cycle × (8 cycles + 30 cycles) = 6 µops/cycle × 38 cycles = <strong>228 entries</strong>, which is more than the 96 entries available.</li><li>So the queue fills and dispatch stalls. The sustained rate falls to 96 entries / 38 cycles ≈ <strong>2.53 µops/cycle</strong>, about 42% of the 6 µops/cycle width. The issue-to-retire time also gets longer, because a full queue hides fewer misses.</li><li>Fix: hold each entry only until every older speculative value it could depend on is confirmed, not until retire. If confirmation comes 4 cycles after issue, occupancy = 6 µops/cycle × (8 cycles + 4 cycles) = 72 entries, which fits. Errors confirmed later than that, such as ordering violations, fall back to a full squash. Growing the queue to 228 entries is the other option, but it slows the wakeup and select loop.</li></ol>`
      },
      {
        q: `<p>Renaming a load correctly saves 3 cycles on the critical path. A wrong rename costs 22 cycles with squash recovery or 4 cycles with selective replay. Above what mis-speculation rate does renaming a load class stop paying, under each recovery scheme? How does this change the confidence threshold a designer picks?</p>`,
        a: `<ol><li>With mis-speculation rate p, renaming pays when the expected gain beats the expected loss: (1 − p) × 3 cycles > p × cost.</li><li>Squash: (1 − p) × 3 cycles = p × 22 cycles gives p = 3 cycles / (3 cycles + 22 cycles) = <strong>12%</strong>.</li><li>Replay: (1 − p) × 3 cycles = p × 4 cycles gives p = 3 cycles / (3 cycles + 4 cycles) ≈ <strong>42.9%</strong>.</li><li>With squash, only load classes that are wrong less than 12% of the time are worth renaming, so the confidence threshold must be strict and coverage stays low. With replay, classes that are wrong up to about 42.9% of the time still pay, so a lower threshold covers far more loads. This is the pattern Tyson and Austin saw when re-execution let them move to a lower-confidence setting.</li><li>Caveat: replay cost isn't really constant. It grows with the depth of the dependence chain and with issue queue pressure, so measure it per load class rather than assuming one number.</li></ol>`
      },
      {
        q: `<p>Tyson and Austin's re-execution recovery gave speedups on every program in their simulator. A colleague wants to add the same scheme to a core with small, separate integer and FP issue queues that free entries at issue, and to use it for store-load ordering violations too. What would you warn them about?</p>`,
        a: `<p>First, the result doesn't carry over directly. Their simulator used an RUU, where reservation stations and ROB entries are the same, so holding an entry until retire cost no capacity. In a core that frees issue queue entries at issue, every entry that might be replayed has to stay much longer. The queue either grows, which hurts the wakeup and select cycle time, or fills and stalls dispatch. That's the reason Chrysos and Emer kept early deallocation.</p><p>Second, ordering violations are a harder case than value mis-speculation. In memory renaming, the verifying memory access already holds the correct value, so the core only re-broadcasts it. After an ordering violation, the load must read memory again, or get the store's forwarded data, before anything can re-execute. The violation also shows up only when the older store's address resolves, which can be long after the load issued. Entries would need to stay for that whole time.</p><p>Third, memory dependences complicate the chain. A re-executed store can change data or addresses that younger loads already used, so the LSQ has to recheck it and possibly replay more loads. A re-executed address computation can send a load to a new address.</p><p>Better plan: use selective replay where errors are confirmed quickly, as with L1 hit speculation. For ordering violations, use a strong dependence predictor so they're rare, and squash when one does happen. Measure squash rate × squash cost against the IPC lost to a larger or more crowded queue before committing either way.</p>`
      }
    ]
  }
},

{
  id: "exec-units",
  region: "sched",
  title: "Execution Units",
  sections: [
    { id: "units", label: "The Units" },
    { id: "math", label: "The Math" },
    { id: "power-performance-area", label: "Power, Performance, Area" }
  ],
  body: `
<p>Execution units do the actual work. The scheduler sends ready instructions to ports, and each port feeds one or more units.</p>
<h3 id="sec-units">The Units</h3>
<div class="tbl"><table>
<tr><th>Unit</th><th>Does</th><th>Typical latency</th><th>Notes</th></tr>
<tr><td>ALU</td><td>Add, subtract, logic, shifts, compares</td><td>1 cycle</td><td>Several per core; small and cheap</td></tr>
<tr><td>Branch unit</td><td>Resolves branches, triggers recovery</td><td>1 cycle</td><td>Often shares a port with an ALU</td></tr>
<tr><td><a href="#/int-units/mul">Integer multiplier</a></td><td>Multiply</td><td>3–4 cycles</td><td>Pipelined</td></tr>
<tr><td><a href="#/int-units/div">Integer divider</a></td><td>Divide</td><td>~10–40 cycles</td><td>Iterative, usually not pipelined</td></tr>
<tr><td><a href="#/fp-units">FPU / FMA</a></td><td>FP add, multiply, fused multiply-add</td><td>3–5 cycles</td><td>Pipelined; large area</td></tr>
<tr><td>FP divide/sqrt</td><td>Division, square root</td><td>~10–30 cycles</td><td>Iterative</td></tr>
<tr><td>Vector / SIMD</td><td>Same op on many lanes</td><td>Like scalar FP</td><td>Area and power scale with width</td></tr>
<tr><td>Load unit (LDU)</td><td>Address generation + L1D access</td><td>~4–5 cycles load-to-use</td><td>Also searches the SQ</td></tr>
<tr><td>Store unit (STU)</td><td>Store address and store data</td><td>Writes the SQ</td><td>Address and data often split into separate ports</td></tr>
</table></div>
<p>Number formats, rounding, BF16 and the other ML types, and the inside of the FMA pipeline have their own section: <a href="#/r/arith">Computer Arithmetic</a>.</p>
<h3 id="sec-math">The Math</h3>
<ul>
<li><strong>Port demand:</strong> ops per cycle of a type = IPC × fraction of that type. Keep utilization well below 100% to avoid queueing.</li>
<li><strong>Throughput vs. latency:</strong> a pipelined unit with latency L can accept a new op each cycle; to keep it busy, you need L independent operations in flight (e.g., 4-cycle FMA × 2 units = 8 independent accumulations).</li>
<li><strong>Bypass network:</strong> with P producers and C consumer operands, there are about P × C forwarding paths, so it grows roughly with the square of the unit count.</li>
</ul>
<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul>
<li><strong>More units:</strong> more peak throughput, but each adds a scheduler select port, PRF read and write ports, and bypass paths. Those structures, not the units themselves, are often the limit.</li>
<li><strong>Wider SIMD:</strong> large throughput gains for vectorizable code, but area and power scale with width, and some designs lower frequency when wide vector units are active. Power-gate them when idle.</li>
<li><strong>Lower latency:</strong> helps dependent chains (pointer chasing benefits most from a faster load-to-use path) but may cost frequency or more area.</li>
<li><strong>Specialized units</strong> (crypto, matrix engines) are very efficient for their task and idle otherwise; that's acceptable because idle silicon can be power-gated ("dark silicon").</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A workload has 35% loads and 10% stores, and the target IPC is 4. Demand is bursty, and a port busy more than about 70% of the time causes noticeable queueing. How many load and store ports does it need?</p>`,
        a: `<ol><li>Loads per cycle: 0.35 × 4 = 1.4. Stores per cycle: 0.10 × 4 = 0.4.</li><li>Average demand fits in 2 load ports and 1 store port.</li><li>Two load ports would be busy 1.4 / 2 = 70% of the time, right at the queueing threshold. So designers often provision 3 load ports, or 2 load plus 2 store, for headroom.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You can add either a third load port or a 50% larger L1D for the same area. How do you choose?</p>`,
        a: `<p>Measure port utilization and the cycles where a ready load waits for a port, versus L1 miss rate and how it falls with size. A third port helps load-dense, cache-resident code (compute kernels, tight loops); a larger L1 helps when misses dominate. The port also costs a third tag/data access path (banking or replication), more LQ search bandwidth, and more bypass paths; the larger L1 may cost a cycle of latency. Simulate both on the target suite and compare IPC per mm² and per watt.</p>`
      },
      {
        q: `<p>Why is the integer divider usually not pipelined, while the multiplier is?</p>`,
        a: `<p>Division is rare, and a pipelined divider would need many copies of its iterative hardware: a large area cost for little throughput gain. Multiplication is common (address arithmetic, hashing, crypto), so a pipelined multiplier that accepts one operation per cycle pays for itself.</p>`
      }
    ]
  }
},

{
  id: "simd",
  region: "sched",
  title: "SIMD and Vector Execution",
  sections: [
    { id: "why", label: "Why SIMD" },
    { id: "isas", label: "The ISAs: Fixed Width and Vector-Length Agnostic" },
    { id: "datapath", label: "Register Width vs. Datapath Width" },
    { id: "freq", label: "Power and Frequency" },
    { id: "hard", label: "What Vectorizes Poorly" },
    { id: "model", label: "Modeling Vector Code" }
  ],
  body: `
<p>One SIMD instruction does the same operation on many elements: eight 64-bit additions, sixteen single-precision multiplies, sixty-four byte compares. It is the cheapest way to raise a core's throughput, because the expensive per-instruction work (fetch, decode, rename, scheduling, retire) is paid once for many operations.</p>

<h3 id="sec-why">Why SIMD</h3>
<p>As <a href="#/perf-power/costs">Power and Energy Modeling</a> shows, a scalar add costs far less energy than the machinery around it. Widening the operation amortizes that overhead: a 512-bit FMA does 16 single-precision multiply-adds for roughly the front-end and scheduling energy of one scalar instruction. Hennessy and Patterson's data-level parallelism chapter frames this as the main alternative to more cores for regular computations.</p>

<h3 id="sec-isas">The ISAs: Fixed Width and Vector-Length Agnostic</h3>
<div class="tbl"><table>
<tr><th>ISA</th><th>Width</th><th>Notes</th></tr>
<tr><td>x86 SSE</td><td>128-bit</td><td>16 registers (32 with AVX-512)</td></tr>
<tr><td>x86 AVX, AVX2</td><td>256-bit</td><td>Three-operand forms; AVX2 adds integer ops and gathers</td></tr>
<tr><td>x86 AVX-512</td><td>512-bit</td><td>32 registers, 8 mask registers for per-element predication, scatters</td></tr>
<tr><td>Arm NEON</td><td>128-bit</td><td>Fixed width</td></tr>
<tr><td>Arm SVE, SVE2</td><td>128 to 2048 bits, chosen by the implementation</td><td>Vector-length agnostic: the same binary runs at any width; predicate registers control which lanes are active</td></tr>
<tr><td>RISC-V V</td><td>Implementation-defined VLEN</td><td><code>vsetvl</code> sets how many elements each instruction handles; LMUL groups registers into longer vectors</td></tr>
</table></div>
<p>Fixed-width ISAs need a new instruction set extension each time the width grows, and loops need separate remainder code for the last few elements. Vector-length-agnostic ISAs write the loop once: each iteration asks the hardware how many elements it will process, and predication handles the tail.</p>

<h3 id="sec-datapath">Register Width vs. Datapath Width</h3>
<p>The ISA fixes the register width; the microarchitecture chooses how wide the execution units are:</p>
<ul>
<li>AMD's Zen 4 executes AVX-512 on 256-bit units, splitting each 512-bit operation into two halves. It gains the ISA's benefits (masks, more registers, fewer instructions to decode) without doubling the datapaths; Zen 5 widens them to 512 bits on its desktop and server parts.</li>
<li>Intel's server cores since Skylake-SP have two 512-bit FMA units (on most SKUs): 2 FMAs × 8 doubles × 2 FLOPs = 32 double-precision FLOPs per cycle per core.</li>
<li>Arm's Neoverse V1 implements SVE with two 256-bit pipes; Neoverse V2 uses four 128-bit pipes. Same ISA, different width, same binaries.</li>
</ul>
<p>Width costs more than execution units: register file ports and capacity, load and store paths (a 512-bit load per cycle per port), and bypass wiring all scale with it.</p>

<h3 id="sec-freq">Power and Frequency</h3>
<p>Wide SIMD units draw a lot of current when busy. Intel's Skylake-SP server cores lowered their maximum frequency when running heavy 256-bit or 512-bit instructions (frequency "licenses"), and the lower clock persisted for a short time afterward, so occasional AVX-512 instructions in mostly scalar code could slow the scalar code too. Later Intel cores reduced the penalty considerably, and AMD's Zen 4 doesn't apply a separate AVX-512 clock limit. A model of vector code on such parts must include the frequency effect, or it will overstate the gain.</p>

<h3 id="sec-hard">What Vectorizes Poorly</h3>
<ul>
<li><strong>Control flow:</strong> branches inside the loop become masked operations on both paths; when paths are long and rarely taken, the work grows.</li>
<li><strong>Irregular memory:</strong> gathers and scatters load or store each element separately, at a few cycles per element, so a gather-heavy loop gains little.</li>
<li><strong>Dependences across iterations:</strong> loop-carried dependences (prefix sums, recurrences) need special algorithms or don't vectorize.</li>
<li><strong>Short loops:</strong> with a trip count of 5 on 16-wide vectors, most lanes are idle.</li>
<li><strong>Amdahl:</strong> the scalar part limits the speedup no matter how wide the vectors are.</li>
</ul>

<h3 id="sec-model">Modeling Vector Code</h3>
<ul>
<li>Count micro-ops per vector instruction on the target (split operations, gathers that become many micro-ops) rather than one per instruction.</li>
<li>Model load and store bandwidth in bytes, not instructions; wide vectors usually hit the L1 or L2 bandwidth bound before the FMA bound (see the bytes-per-cycle rows on <a href="#/perf-bounds/mem-bounds">Memory Bounds</a>).</li>
<li>Include the frequency behavior of the part being modeled.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (data-level parallelism in vector, SIMD, and GPU architectures) · Stephens et al., "The ARM Scalable Vector Extension," IEEE Micro, 2017 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> · RISC-V International, <em>RISC-V "V" Vector Extension</em>, version 1.0</p>`,
  practice: {
    guided: [
      {
        q: `<p>70% of a program's run time is in loops that vectorize perfectly with 8 lanes, and the rest stays scalar. What is the speedup? If running the vector code also lowers the clock by 10% for the whole program, what is it then?</p>`,
        a: `<ol><li>Amdahl: speedup = 1 / (0.3 + 0.7 / 8) = 1 / (0.3 + 0.0875) = 1 / 0.3875 ≈ <strong>2.58×</strong>.</li><li>With a 10% lower clock everywhere: 2.58 × 0.9 ≈ <strong>2.32×</strong>.</li><li>Even perfect 8-lane vectors give well under 8×: the 30% that stays scalar becomes 77% of the new run time (0.3 / 0.3875).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A dot product of two 1 GB double-precision arrays runs on a core with two 512-bit FMA units and two 512-bit load ports at 3 GHz, and the core can draw about 15 GB/s from DRAM. Is the FMA width worth anything here? What would make it matter?</p>`,
        a: `<p>Each element pair is 16 bytes and gives one FMA (2 FLOPs). At 15 GB/s, the core gets about 0.94 billion pairs per second, about 1.9 GFLOP/s. The FMA units could do 32 double-precision FLOPs per cycle × 3 GHz = 96 GFLOP/s. The loop uses about 2% of the compute: it's entirely memory-bound, and 128-bit vectors would run it at the same speed. The width matters only when arithmetic intensity rises: data that fits in L1 or L2, or reuse such as a matrix multiply that loads each element once and uses it many times. Then the bound becomes the load ports and L1 bandwidth (two 512-bit loads per cycle feeds exactly one FMA's worth per cycle without reuse), and finally the FMA units.</p>`
      }
    ]
  }
}
]);
