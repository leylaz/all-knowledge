/* Section: Memory hierarchy
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mem"). */

section({
  id: "mem",
  name: "Memory Hierarchy",
  cap: "Caches, prefetching, banking, SRAM vs. DRAM, latency tolerance",
  body: `
<p>The memory hierarchy exists because DRAM is hundreds of cycles away. Each level trades capacity for latency, and the core's job is to either avoid misses or overlap them.</p>
<h3>Average Memory Access Time</h3>
<p>AMAT = hit time + miss rate × miss penalty, applied recursively per level. It's a useful first-order tool, but in an out-of-order core what matters is the latency that isn't hidden, which depends on memory-level parallelism.</p>
<div class="calc" data-calc="amat"></div>
<h3>Two Ways to Win</h3>
<ul><li><strong>Avoid misses:</strong> capacity, associativity, replacement, prefetching.</li><li><strong>Tolerate misses:</strong> non-blocking caches, large windows, prefetching, runahead.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>L1 hit time 4 cycles, L1 miss rate 10%. L2 hit time 14 cycles, L2 local miss rate 30%. Memory latency 200 cycles. What is the AMAT?</p>`,
        a: `<ol><li>L2 miss penalty seen from L2: 0.3 × 200 = 60.</li><li>L1 miss penalty: 14 + 60 = 74.</li><li>AMAT = 4 + 0.1 × 74 = <strong>11.4 cycles</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Using the numbers above: doubling the L2 cuts its local miss rate from 30% to 24% but adds 2 cycles of hit latency. Is it worth it?</p>`,
        a: `<p>New AMAT = 4 + 0.1 × (16 + 0.24 × 200) = 4 + 0.1 × 64 = 10.4 cycles, versus 11.4. On paper, yes.</p><p>In an interview, add the caveats: the extra 2 cycles hit every L1 miss, while the saved DRAM misses only help if they were exposed; an OoO core partly hides L2 hits but rarely hides DRAM. Area and power grow too. The real answer comes from running representative workloads and looking at both IPC and energy.</p>`
      }
    ]
  }
}, [
{
  id: "dcache",
  region: "mem",
  title: "Data Cache and Sectored Caches",
  body: `
<p>A set-associative cache splits an address into tag, index, and offset. Typical L1D choices are write-back, write-allocate, and LRU or pseudo-LRU replacement.</p>
<h3>Non-Blocking Caches</h3>
<p>MSHRs track outstanding misses so hits continue; secondary misses to the same line merge into an existing MSHR. MSHR count caps memory-level parallelism.</p>
<h3>Sectored Caches</h3>
<p>One tag covers a large block split into sectors with their own valid (and often dirty) bits. A miss fetches only the missing sector.</p>
<h3>Classifying Misses</h3>
<p>Compulsory, capacity, conflict, and in multicore systems, coherence.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB, 8-way L1D with 64-byte lines and 48-bit physical addresses. How many sets? How many offset, index, and tag bits?</p>`,
        a: `<ol><li>Lines: 32 KB / 64 B = 512. Sets: 512 / 8 = <strong>64</strong>.</li><li>Offset: log2(64) = <strong>6</strong> bits. Index: log2(64) = <strong>6</strong> bits.</li><li>Tag: 48 − 12 = <strong>36</strong> bits.</li><li>Note that index plus offset is 12 bits, exactly a 4 KB page offset. That matters for VIPT caches (next problem).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can't a VIPT L1 with 4 KB pages be larger than 32 KB at 8 ways without aliasing problems? What do designers do about it?</p>`,
        a: `<p>For the index to come entirely from untranslated page-offset bits, cache size / ways ≤ page size, so 4 KB × 8 = 32 KB. Options: more ways (more power per access), larger base pages (16 KB pages allow 128 KB at 8 ways), hardware synonym detection, or a PIPT cache with the TLB in series (more latency).</p>`
      },
      {
        q: `<p>When would you choose a sectored cache, and when would it hurt?</p>`,
        a: `<p>Good: large blocks with streaming or dense access, where one tag per block saves storage and sector-only fills save bandwidth (common in L2/LLC and GPU caches). Bad: sparse access, where a block occupies a whole frame while only one sector is used, lowering effective capacity and raising misses.</p>`
      }
    ]
  }
},

{
  id: "prefetch",
  region: "mem",
  title: "Prefetching",
  body: `
<p>Fetch lines before the demand access asks for them.</p>
<h3>Common Designs</h3>
<ul><li><strong>Next-line:</strong> on a miss to line X, fetch X+1.</li><li><strong>Stride:</strong> a PC-indexed table holds last address, stride, and confidence.</li><li><strong>Stream:</strong> detect sequential miss streams and run ahead.</li></ul>
<h3>Three Metrics</h3>
<ul><li><strong>Accuracy:</strong> useful over issued.</li><li><strong>Coverage:</strong> baseline misses eliminated.</li><li><strong>Timeliness:</strong> whether data arrives before demand.</li></ul>
<p>Inaccurate prefetches pollute the cache and waste bandwidth, so good prefetchers throttle.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A loop iteration takes 20 cycles and touches a new 64-byte line each time. Memory latency is 200 cycles. How far ahead must a stride prefetcher run?</p><p>Separately: 1000 prefetches were issued, 600 were used by demand accesses, baseline misses were 2000, and misses now are 1500. Compute accuracy and coverage.</p>`,
        a: `<ol><li>Distance: 200 / 20 = 10 iterations, so 10 lines = <strong>640 bytes ahead</strong>.</li><li>Accuracy = 600 / 1000 = <strong>60%</strong>.</li><li>Coverage = (2000 − 1500) / 2000 = <strong>25%</strong>.</li><li>600 used but only 500 misses eliminated suggests some prefetches were late (or caused extra misses through pollution).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A prefetcher raises average IPC 5% but hurts two benchmarks by 8%. What do you investigate and what would you propose?</p>`,
        a: `<p>Check per-benchmark accuracy, lateness, bandwidth use, and pollution (demand misses to lines evicted by prefetches). Likely causes are low-accuracy prefetches thrashing a small cache or saturating bandwidth. Propose feedback-directed throttling: track accuracy, lateness, and pollution per interval and adjust degree and distance. Or train only on specific PCs, or insert prefetched lines at low replacement priority.</p>`
      }
    ]
  }
},

{
  id: "l2-banks",
  region: "mem",
  title: "L2 and Banking",
  body: `
<p>The L2 is larger and slower, usually unified, and inclusive, exclusive, or neither with respect to L1.</p>
<h3>Banks</h3>
<p>Banks selected by address bits allow parallel accesses; two same-cycle accesses to one bank conflict and one waits.</p>
<p>A <strong>single-ported bank</strong> is an independent slice of the data array: its own SRAM subarray with its own row decoder, wordlines, bitlines, and sense amps. It serves exactly one read or one write per cycle. H&amp;P (Ch. 2) list this as an advanced cache optimization, <em>multibanked caches to increase bandwidth</em>, usually with <strong>sequential interleaving</strong> (line or word address mod N picks the bank). Banking is the cheap approximation of multi-porting: simple single-ported cells, near-N-way bandwidth when accesses spread evenly. Strided patterns that keep hitting one bank lose the benefit, the same problem as GPU shared-memory bank conflicts.</p>
<h3>Why One Access per Cycle</h3>
<p>The limit is physical. Each port has:</p>
<ul><li><strong>One address path:</strong> one decoder that raises exactly one wordline per cycle.</li><li><strong>Shared bitlines:</strong> every cell in a column hangs off the same bitline pair. Two wordlines firing in one column would have two cells driving the same bitlines, corrupting the read (and possibly clobbering a cell on a write).</li><li><strong>Precharge/evaluate timing:</strong> bitlines are precharged, discharged by the selected cell, then sensed. That sequence is the access; the next one waits for the next precharge.</li><li><strong>One set of sense amps and column muxes</strong>, which resolve one access’s data per cycle.</li></ul>
<p>A second port means a second wordline per row, a second bitline pair per column, and extra access transistors per cell. Cell area grows roughly quadratically with port count (more wires <em>and</em> transistors), and longer wires make the array slower and hungrier.</p>
<h3>The Address Path</h3>
<p>The circuitry that turns an address into “activate this row (and column) of cells.” For one port:</p>
<ol><li><strong>Address input/latch:</strong> the index bits (after the bank-select bits pick the bank) are captured at the start of the cycle.</li><li><strong>Row decoder:</strong> k index bits become a one-hot signal across 2<sup>k</sup> rows, usually a predecoder plus a final AND stage.</li><li><strong>Wordline driver:</strong> a strong buffer drives the selected wordline across the row, turning on every cell’s access transistors and connecting them to their bitlines.</li><li><strong>Column decoder/mux select:</strong> when a row holds more bits than needed, the remaining address bits route the right columns to the sense amps.</li></ol>
<p>A second port needs a whole second copy of this, which is where multi-porting’s area cost comes from.</p>
<h3>Banks Busy for Two Cycles</h3>
<p>A bank is busy for multiple cycles when its <strong>cycle time</strong> (how often it can start a new access) exceeds one processor clock:</p>
<ul><li><strong>Access + recovery doesn’t fit in one clock.</strong> After a read the bitlines must be precharged again. H&amp;P’s <em>access time vs. cycle time</em>: data can come out after the access time, but the bank isn’t free until the full cycle time.</li><li><strong>Fast clocks, big arrays.</strong> Long wordlines and bitlines (more RC delay) can’t finish in one cycle, so designers accept a 2-cycle busy time and add banks. Same idea as interleaved main memory: you need at least as many banks as the bank cycle time in clocks to sustain one access per clock.</li><li><strong>Read-modify-write.</strong> A partial store under ECC (e.g., 1 byte when ECC covers 8) must read, merge, recompute ECC, and write back.</li><li><strong>Wide transfers.</strong> A fill or eviction wider than the bank port takes multiple beats.</li></ul>
<p>Effect: with 2-cycle banks, consecutive-cycle accesses to one bank conflict too, so you need more banks or better hashing for the same bandwidth.</p>
<h3>Choosing Bank Bits</h3>
<p>Low line-address bits spread sequential accesses, but power-of-two strides can hammer one bank. XOR-hashing higher bits spreads them.</p>
<h3>DRAM Banks</h3>
<p>Row-buffer hits are cheap; row conflicts pay precharge and activate.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An L2 has 4 banks chosen by address bits [7:6]. Do accesses to 0x1000 and 0x1100 in the same cycle conflict? What if the bank is bits[7:6] XOR bits[9:8]?</p>`,
        a: `<ol><li>0x1000: bits [7:6] = 00 → bank 0. 0x1100: 0x100 sets only bit 8, so bits [7:6] = 00 → bank 0. <strong>Conflict.</strong> Any 256-byte stride hits the same bank.</li><li>With XOR: 0x1000 has bits [9:8] = 00 → bank 0. 0x1100 has bits [9:8] = 01 → bank 1. <strong>No conflict.</strong></li></ol>`
      },
      {
        q: `<p>4 banks, each busy for 2 cycles per access. One access arrives per cycle, in the bank order 0, 0, 1, 1. When does each start? What if the order is 0, 1, 0, 1?</p>`,
        a: `<ol><li>Order 0, 0, 1, 1: the first access holds bank 0 for cycles 0–1, so the second (arriving cycle 1) waits until <strong>cycle 2</strong>. The third starts on bank 1 at cycle 2. The fourth arrives at cycle 3 but bank 1 is busy until the end of cycle 3, so it starts at <strong>cycle 4</strong>. Two stall cycles.</li><li>Order 0, 1, 0, 1: each bank gets a request every other cycle, exactly matching its 2-cycle busy time. <strong>No stalls.</strong></li><li>With a 2-cycle bank busy time, even <em>consecutive</em>-cycle accesses to one bank conflict, not just same-cycle ones. Sustaining one access per cycle needs at least 2 banks with perfect spreading, and more in practice.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Inclusive vs. exclusive L2: what are the trade-offs?</p>`,
        a: `<p>Inclusive: the L2 tags double as a snoop filter for L1s, which simplifies coherence, but it wastes capacity on duplicated lines and evicting from L2 forces back-invalidations in L1 that can remove hot lines. Exclusive: total capacity is L1 + L2, but coherence needs separate tracking and lines move between levels on every L1 eviction. Non-inclusive designs sit in between.</p>`
      }
    ]
  }
},

{
  id: "sram-dram",
  region: "mem",
  title: "SRAM vs. DRAM",
  body: `
<p>The difference is how a bit is physically stored.</p>
<ul><li><strong>SRAM:</strong> a pair of cross-coupled inverters (a latch) plus two access transistors, <strong>6T per bit</strong>. The latch actively holds its value while powered.</li><li><strong>DRAM:</strong> charge on a <strong>capacitor</strong> with one access transistor (<strong>1T1C</strong>). The charge leaks, so it must be refreshed.</li></ul>
<div class="tbl"><table>
<tr><th></th><th>SRAM</th><th>DRAM</th></tr>
<tr><td>Cell</td><td>6T latch</td><td>1 transistor + 1 capacitor</td></tr>
<tr><td>Density</td><td>Low (big cell)</td><td>~10–20× denser</td></tr>
<tr><td>Speed</td><td>Fast (~1 ns on-chip)</td><td>Tens of ns</td></tr>
<tr><td>Refresh</td><td>None</td><td>Every ~64 ms per row</td></tr>
<tr><td>Reads</td><td>Non-destructive</td><td>Destructive; the row must be written back</td></tr>
<tr><td>Process</td><td>Same logic process as the CPU</td><td>Specialized process, usually a separate chip</td></tr>
<tr><td>Use</td><td>Caches, register files, TLBs</td><td>Main memory</td></tr>
</table></div>
<h3>Why DRAM Is Slower</h3>
<p>The capacitor is tiny, so opening a row only nudges the bitline voltage, and sense amps must amplify that small signal. Then the row is restored and the bank precharged before reuse. Hence <strong>row buffers</strong> (open a row, read many columns) and timing parameters like tRCD, tCAS, and tRP. See <a href="#/l2-banks">L2 and banking</a> for row-buffer hits vs. conflicts.</p>
<h3>Why SRAM Is Faster</h3>
<p>The latch actively drives the bitline, so the signal develops quickly, reads leave the cell intact, and nothing needs refreshing.</p>
<h3>The Hierarchy Trade-Off</h3>
<p>H&amp;P Ch. 2: SRAM is fast but expensive per bit; DRAM is dense and cheap but slow. So small SRAM caches sit in front of large DRAM main memory.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Roughly how many transistors are in the data array of a 32 KB SRAM cache built from 6T cells? What would the same capacity be in 1T1C DRAM cells?</p>`,
        a: `<ol><li>Bits: 32 × 1024 × 8 = 262,144.</li><li>SRAM: 262,144 × 6 ≈ <strong>1.57 million transistors</strong>, before tags, decoders, and sense amps.</li><li>DRAM: 262,144 transistors plus 262,144 capacitors. The cell is far smaller, which is why DRAM is ~10–20× denser.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>DRAM is much denser. Why aren’t on-chip caches built from it?</p>`,
        a: `<p>DRAM needs special process steps for the capacitor that don’t mix cheaply with a fast logic process, its reads are destructive (restore + precharge before reuse), it needs refresh, and its tiny charge makes sensing slow. SRAM sits in the same logic process and is fast and simple. Some designs did use embedded DRAM for large last-level caches (IBM POWER7–POWER9 L3, Intel’s Crystal Well eDRAM L4), trading latency for capacity where density mattered most.</p>`
      }
    ]
  }
},

{
  id: "latency-tolerance",
  region: "mem",
  title: "Memory Latency Tolerance",
  sections: [{ id: "mlp", label: "What Memory-Level Parallelism Means" }],
  body: `
<p>If misses can't be avoided, overlap them with each other and with useful work.</p>
<h3>Techniques</h3>
<ul>
<li><strong>Non-blocking caches:</strong> MSHRs allow many outstanding misses.</li>
<li><strong>Large instruction windows:</strong> a bigger ROB, IQ, and LSQ reach more independent misses.</li>
<li><strong>Prefetching:</strong> start misses before demand.</li>
<li><strong>Runahead execution:</strong> pre-execute past a blocking miss to generate prefetches.</li>
<li><strong>Critical-word-first and early restart:</strong> return the needed word before the full line.</li>
<li><strong>SMT:</strong> another thread uses the core while one waits.</li>
<li><strong>Value prediction:</strong> speculate on the loaded value so dependents can proceed.</li>
</ul>
<h3 id="sec-mlp">What Memory-Level Parallelism Means</h3>
<p><strong>Memory-level parallelism (MLP)</strong> is having several cache misses in flight at the same time, so their latencies overlap instead of adding up. If four independent loads each miss to DRAM at 200 cycles, handling them one at a time takes 4 × 200 = 800 cycles; overlapping all four takes about 200.</p>
<p>MLP needs several things working together:</p>
<ul>
<li><strong>MSHRs</strong> (miss status holding registers, also called line fill buffers): each tracks one outstanding miss, so their count caps how many misses can be in flight.</li>
<li><strong>A large instruction window</strong> (ROB, load queue) to reach independent misses far enough ahead.</li>
<li><strong>Non-blocking caches</strong> that keep serving hits while misses are pending.</li>
<li><strong>Prefetchers</strong> that start misses early.</li>
<li><strong>Enough DRAM channels and banks</strong> to serve many requests at once.</li>
</ul>
<p>Data cache <em>ports</em> are a different thing: they set how many hits can be served per cycle (bandwidth), not how many misses can overlap.</p>
<p><strong>Why the window matters even without dependents:</strong> instructions retire in order, so the ROB fills up behind a stuck load. A 4-wide core with a 128-entry ROB fills it in about 32 cycles and then stalls, so a 200-cycle DRAM miss is mostly exposed unless the work behind it contains other misses that overlap with it.</p>
<div class="calc" data-calc="little"></div>
<h3>The Limit</h3>
<p>Dependent misses (pointer chasing) serialize regardless of window size. Only prediction, prefetching that understands the data structure, or software changes help there.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Four independent loads each miss to DRAM (200 cycles). Ignoring issue time, how long do they take with 1, 2, and 4 MSHRs?</p>`,
        a: `<ol><li>1 MSHR: fully serial, 4 × 200 = <strong>800 cycles</strong>.</li><li>2 MSHRs: two waves, <strong>about 400</strong>.</li><li>4 MSHRs: all overlap, <strong>about 200</strong>.</li><li>Memory-level parallelism, not raw latency, sets the cost, as long as the misses are independent and the window can reach them.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Explain runahead execution. When does it help, and when doesn't it?</p>`,
        a: `<p>When a long-latency miss blocks the ROB head, the core checkpoints state and keeps executing past it in a speculative "runahead" mode, marking results dependent on the miss as invalid. Loads it encounters with valid addresses become prefetches. When the miss returns, it discards runahead results and resumes from the checkpoint.</p><p>Helps: independent misses beyond the ROB window, without paying for a bigger ROB. Doesn't help: dependent pointer chains (addresses depend on the blocked load), and it wastes energy re-executing instructions.</p>`
      }
    ]
  }
}
]);
