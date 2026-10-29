/* Section: Cache trade-offs
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "ctr"). */

section({
  id: "ctr",
  name: "Cache Trade-Offs",
  cap: "Size, associativity, line size, replacement, banking, write policy, by workload",
  body: `
<p>Each page here takes one cache parameter and covers what it changes, the math, its power, performance, and area (PPA) cost, and how it plays out for every workload type.</p>
<h3>The Workload Types Used Throughout</h3>
<div class="tbl"><table>
<tr><th>Workload</th><th>Examples</th><th>Memory signature</th></tr>
<tr><td>Compute-bound</td><td>548.exchange2, 508.namd, crypto</td><td>Small working set, few misses</td></tr>
<tr><td>Pointer chasing</td><td>505.mcf, graphs, trees, linked lists</td><td>Dependent, irregular misses; low MLP</td></tr>
<tr><td>Streaming</td><td>519.lbm, STREAM, memcpy</td><td>Sequential, little reuse; bandwidth-bound</td></tr>
<tr><td>Large code footprint</td><td>Servers, browsers, 502.gcc</td><td>Instruction misses dominate</td></tr>
<tr><td>Branch-heavy integer</td><td>531.deepsjeng, 557.xz</td><td>Moderate working set; mispredicts dominate</td></tr>
<tr><td>Blocked numerics</td><td>GEMM, stencils, convolutions</td><td>High reuse inside tiles</td></tr>
<tr><td>ML inference</td><td>Transformer and CNN inference on CPU</td><td>Large weights streamed; activations reused</td></tr>
<tr><td>Multithreaded shared data</td><td>Databases, web servers, key-value stores</td><td>Shared LLC pressure, coherence traffic</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A workload's L1 miss rate barely changes when you double L1 size, double associativity, or change replacement policy, but nearly halves when you double line size. What kind of workload is it?</p>`,
        a: `<ol><li>Insensitive to size, associativity, and replacement means there is little reuse to capture.</li><li>Sensitive to line size means each miss brings in data that is used soon after: strong spatial locality.</li><li>That is a <strong>streaming</strong> workload. A good prefetcher would give the same benefit without changing the line size.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You can spend a fixed area budget on either a larger L2 or a smarter replacement policy plus a prefetcher. How do you decide?</p>`,
        a: `<p>Classify the target workloads first. Capacity helps when working sets sit just above the current size (cliff behavior). Replacement policy helps when the cache thrashes with scans or cyclic patterns larger than capacity. Prefetching helps streaming and strided access regardless of size. Measure miss-rate curves versus size per workload, the share of misses from scans, and stride coverage, then compare predicted IPC per mm² and per watt. A larger cache also adds latency and leakage; the policy changes add little of either.</p>`
      }
    ]
  }
}, [
{
  id: "cache-size",
  region: "ctr",
  title: "Cache Size",
  body: `
<h3>What It Changes</h3>
<p>Capacity sets which working sets fit. Below the working set, misses are capacity misses; once the working set fits, miss rate drops sharply (a "cliff").</p>
<h3>The Math</h3>
<ul>
<li><strong>√2 rule of thumb:</strong> miss rate ∝ size<sup>−0.5</sup>, so doubling size divides miss rate by about 1.41. It is an empirical average; real curves have cliffs.</li>
<li><strong>AMAT</strong> = hit time + miss rate × miss penalty. A bigger cache lowers miss rate but often raises hit time.</li>
<li><strong>Access time</strong> grows with size because wires get longer; roughly with the square root of capacity when wire-dominated.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> fewer capacity misses; possibly a slower hit.</li><li><strong>Power:</strong> leakage ∝ capacity; dynamic energy per access rises with array size.</li><li><strong>Area:</strong> roughly linear in capacity plus tags; SRAM is often the largest share of core-plus-cache area.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No gain once the small working set fits; a slower hit can hurt.</td></tr>
<tr><td>Pointer chasing</td><td>Big gain if the structure crosses into "fits"; none if it's far larger (huge graphs). Since misses are dependent, each avoided miss saves its full latency.</td></tr>
<tr><td>Streaming</td><td>Almost no gain: data is used once. Larger caches only add latency and leakage.</td></tr>
<tr><td>Large code footprint</td><td>L1I and L2 capacity matter a lot; instruction misses stall the whole frontend.</td></tr>
<tr><td>Branch-heavy integer</td><td>Moderate gain; working sets are often mid-sized hash tables or search trees.</td></tr>
<tr><td>Blocked numerics</td><td>Gain only if the tile size can grow; well-tuned code already tiles to fit, so software adapts.</td></tr>
<tr><td>ML inference</td><td>Weights larger than the cache stream through with no reuse; a bigger LLC helps if a layer's weights or activations newly fit.</td></tr>
<tr><td>Multithreaded shared data</td><td>Shared LLC capacity is critical: threads compete, and capacity per thread falls with core count.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB L1D has a 4% miss rate and a 4-cycle hit; L1 misses cost 14 cycles. Doubling it to 64 KB adds 1 cycle of hit latency. Using the √2 rule, is it worth it?</p>`,
        a: `<ol><li>√2 rule: new miss rate ≈ 4% / √2 ≈ 2.83%.</li><li>Old AMAT = 4 + 0.04 × 14 = 4.56 cycles.</li><li>New AMAT = 5 + 0.0283 × 14 ≈ 5.40 cycles.</li><li><strong>Worse.</strong> The extra cycle on every hit outweighs the saved misses. This is why L1 sizes have stayed small while L2 and LLC grew.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why have L1 caches stayed around 32–128 KB for years while last-level caches have grown to tens or hundreds of MB?</p>`,
        a: `<p>L1 latency is in the load-to-use loop that every dependent instruction waits on, so each extra cycle costs IPC across all workloads. Larger arrays have longer wires and need more cycles. For VIPT L1s, size is also capped at page size × ways without alias handling, and energy per access grows with size, which matters for the most frequently accessed array. LLC latency is already tens of cycles and is hit far less often, so capacity is worth more there than a few extra cycles.</p>`
      }
    ]
  }
},

{
  id: "cache-assoc",
  region: "ctr",
  title: "Associativity",
  body: `
<h3>What It Changes</h3>
<p>Associativity is how many places a line can live within its set. Higher associativity reduces conflict misses: lines that would fit by capacity but collide on the same index.</p>
<h3>The Math</h3>
<ul>
<li><strong>Sets</strong> = size / (line size × ways). Index bits = log<sub>2</sub>(sets).</li>
<li><strong>2:1 rule of thumb:</strong> a direct-mapped cache of size N misses about as often as a 2-way cache of size N/2.</li>
<li><strong>Diminishing returns:</strong> most conflict misses are gone by 8 ways; fully associative removes them entirely.</li>
<li><strong>Power-of-two strides</strong> map to few sets: if the stride is S bytes and S / line size divides the set count, the access pattern touches only sets ÷ (S / line size) distinct sets.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul>
<li><strong>Performance:</strong> fewer conflict misses; but a wider tag compare and output mux can lengthen hit time.</li>
<li><strong>Power:</strong> a parallel-lookup cache reads every way's tag and data each access, so energy ∝ ways. Way prediction or serial tag-then-data lookup trades latency for energy.</li>
<li><strong>Area:</strong> more comparators and wider replacement state; tags grow by log<sub>2</sub>(ways) bits each since index bits shrink.</li>
</ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No effect.</td></tr>
<tr><td>Pointer chasing</td><td>Modest gain; heap addresses are fairly random, so conflicts are average rather than pathological.</td></tr>
<tr><td>Streaming</td><td>No gain from reuse; can help when several streams with aligned bases collide in the same sets.</td></tr>
<tr><td>Large code footprint</td><td>Moderate gain; hot functions at aligned addresses can collide.</td></tr>
<tr><td>Branch-heavy integer</td><td>Small gain.</td></tr>
<tr><td>Blocked numerics</td><td>Large gain when leading dimensions are powers of two (rows of a tile collide); padding fixes it more cheaply.</td></tr>
<tr><td>ML inference</td><td>Tensors with power-of-two shapes can collide; layout and padding matter as much as ways.</td></tr>
<tr><td>Multithreaded shared data</td><td>High LLC associativity reduces inter-thread conflicts and enables partitioning between tenants.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB cache with 64-byte lines walks down each column in turn of a float matrix with 1024 rows of 4096 bytes. How many sets does the walk use with a direct-mapped cache? With 8 ways? What fixes it?</p>`,
        a: `<ol><li>Direct-mapped: 512 sets. Each step moves 4096 / 64 = 64 lines, so set index advances by 64; only 512 / 64 = <strong>8 sets</strong> are ever used, holding 8 lines.</li><li>8-way: 64 sets, and 4096 bytes is exactly 64 sets × 64 bytes, so every access maps to the <strong>same set</strong>, holding 8 lines. Still only 8 lines of reach.</li><li>With 1024 rows, the next column's reuse of each line comes after 1024 other lines: all misses either way.</li><li>Fix in software: pad each row by one line (4096 + 64 bytes) so successive rows land in different sets, or interchange loops to walk rows.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do last-level caches often use 16 ways or more, while L1s use 8–12?</p>`,
        a: `<p>The LLC is shared by many threads and processes whose data collide in sets; more ways reduce inter-thread conflicts and enable way partitioning. LLCs usually look up tags first and then read only the matching data way, so extra ways cost mostly tag comparisons, not data energy. L1s read all ways in parallel for speed, so each way adds energy on every access and widens the output mux on the critical path.</p>`
      }
    ]
  }
},

{
  id: "cache-line",
  region: "ctr",
  title: "Cache-Line Size",
  body: `
<h3>What It Changes</h3>
<p>Line size is the unit of allocation and transfer. Larger lines exploit spatial locality and cut tag overhead; smaller lines waste less bandwidth and capacity on unused bytes.</p>
<h3>The Math</h3>
<ul>
<li><strong>Miss penalty</strong> = latency + line size / bandwidth (critical-word-first hides most of the second term).</li>
<li><strong>Lines in cache</strong> = size / line size. Doubling line size halves the line count, which can raise conflict and capacity misses for sparse data.</li>
<li><strong>Tag overhead:</strong> one tag per line, so tag storage roughly halves when line size doubles.</li>
<li><strong>Useful fraction</strong> = bytes used before eviction / line size.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> fewer compulsory misses with spatial locality; longer fills and more false sharing.</li><li><strong>Power:</strong> moving unused bytes costs DRAM and interconnect energy, which is often larger than the SRAM energy.</li><li><strong>Area:</strong> less tag area with larger lines.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Neutral.</td></tr>
<tr><td>Pointer chasing</td><td>Larger lines hurt: nodes are often smaller than a line, so bandwidth and capacity go to unused neighbors.</td></tr>
<tr><td>Streaming</td><td>Larger lines help: fewer misses per byte. A prefetcher gets the same effect without the downsides elsewhere.</td></tr>
<tr><td>Large code footprint</td><td>Larger lines help: code is mostly sequential between branches.</td></tr>
<tr><td>Branch-heavy integer</td><td>Mixed; depends on how compact the data structures are.</td></tr>
<tr><td>Blocked numerics</td><td>Help: contiguous tile rows use whole lines.</td></tr>
<tr><td>ML inference</td><td>Help for dense weights; hurt for sparse or gather-heavy access (embedding lookups).</td></tr>
<tr><td>Multithreaded shared data</td><td>Larger lines raise false sharing and move more bytes per coherence transfer.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>Memory latency is 100 cycles and the bus moves 16 bytes per cycle. Compute the miss penalty for 64-, 128-, and 256-byte lines. Then compute bandwidth efficiency for random 8-byte reads.</p>`,
        a: `<ol><li>Penalty = latency + line / bandwidth: 64 B → 104 cycles, 128 B → 108, 256 B → 116 (or less with critical-word-first).</li><li>Random 8-byte reads use 8 of each line's bytes: 8 / 64 = <strong>12.5%</strong>, 8 / 128 = 6.25%, 8 / 256 = 3.1%.</li><li>Streaming reads use every byte, so efficiency is 100% at any size, and larger lines halve the miss count.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is 64 bytes such a common line size?</p>`,
        a: `<p>It matches the DRAM burst: a DDR4 channel is 64 bits wide with a burst length of 8, delivering 64 bytes per access, and a DDR5 subchannel is 32 bits with burst length 16, also 64 bytes. It balances spatial locality against wasted bandwidth and false sharing, and keeps tag overhead small. Some designs use 128-byte lines (Apple's cores among them) or sector larger lines into 64-byte pieces to get both benefits.</p>`
      }
    ]
  }
},

{
  id: "cache-replacement",
  region: "ctr",
  title: "Replacement Policies",
  sections: [
    { id: "opt", label: "Belady's Optimal Policy (OPT)" },
    { id: "lru", label: "Least Recently Used (LRU)" },
    { id: "plru", label: "Tree Pseudo-LRU (PLRU)" },
    { id: "nru", label: "Not Recently Used (NRU)" },
    { id: "fifo", label: "First In, First Out (FIFO)" },
    { id: "random", label: "Random" },
    { id: "lfu", label: "Least Frequently Used (LFU)" },
    { id: "lip", label: "LRU Insertion Policy (LIP)" },
    { id: "bip", label: "Bimodal Insertion Policy (BIP)" },
    { id: "dip", label: "Dynamic Insertion Policy (DIP)" },
    { id: "srrip", label: "Static Re-Reference Interval Prediction (SRRIP)" },
    { id: "brrip", label: "Bimodal RRIP (BRRIP)" },
    { id: "drrip", label: "Dynamic RRIP (DRRIP)" },
    { id: "ship", label: "Signature-Based Hit Prediction (SHiP)" },
    { id: "hawkeye", label: "Hawkeye" }
  ],
  body: `
<h3>What It Changes</h3>
<p>The replacement policy picks a victim in a full set. It decides whether a working set slightly larger than the cache gets partial hits or none, and whether a scan wipes out useful data.</p>
<p>Every policy answers three questions:</p>
<ul>
<li><strong>Insertion:</strong> how much protection does a newly filled line get?</li>
<li><strong>Promotion:</strong> what does a hit change?</li>
<li><strong>Eviction:</strong> which line leaves when a miss needs room?</li>
</ul>
<p>Each example below traces one 4-way set. Letters name lines that map to that set, every column is one access, and every row is one way. Several examples reuse the same access sequence so the policies can be compared directly.</p>

<h3 id="sec-opt">Belady's Optimal Policy (OPT)</h3>
<p><strong>Why it's used.</strong> OPT is the yardstick. It gives the fewest misses any policy can get on a trace, so the gap between a real policy and OPT shows how much is left to gain. Performance models run it offline in trace-driven cache simulators. Hardware can't run it, because it needs the future, but Hawkeye (below) runs it on past accesses to train a predictor.</p>
<p><strong>How it works.</strong> On a miss in a full set, evict the line whose next use is furthest in the future. A line that is never used again is the ideal victim. Belady proved in 1966 that this minimizes misses. A variant that may also bypass, leaving the incoming line uncached, does at least as well.</p>
<p><strong>Example.</strong> The loop A B C D E F is six lines in a four-line set. At cycle 4 the next uses are A at 6, B at 7, C at 8, and D at 9, so OPT evicts D. At cycle 5 it evicts E, whose next use (10) is the furthest. A, B, and C then hit. LRU on the same accesses evicts exactly the line needed next, every time:</p>
<div class="tbl"><svg viewBox="0 0 680 497" role="img" aria-label="Two traces of a 4-way set on the access sequence A B C D E F A B C D E F. Belady's OPT, which evicts the line used furthest in the future, gets 4 hits. At cycle 4 it evicts D, at cycle 5 it evicts E, then A, B, and C hit, D and E miss, and F hits. LRU on the same sequence evicts each line just before it is needed again and gets 0 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Belady's OPT: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">A</text><text x="399.48" y="79">A</text><text x="446.48" y="79">A</text><text x="493.48" y="79">A</text><text x="540.48" y="79">D</text><text x="587.48" y="79">E</text><text x="634.48" y="79">E</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">B</text><text x="399.48" y="109">B</text><text x="446.48" y="109">B</text><text x="493.48" y="109">B</text><text x="540.48" y="109">B</text><text x="587.48" y="109">B</text><text x="634.48" y="109">B</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">C</text><text x="493.48" y="139">C</text><text x="540.48" y="139">C</text><text x="587.48" y="139">C</text><text x="634.48" y="139">C</text><text x="258.48" y="169">D</text><text x="305.48" y="169">E</text><text x="352.48" y="169">F</text><text x="399.48" y="169">F</text><text x="446.48" y="169">F</text><text x="493.48" y="169">F</text><text x="540.48" y="169">F</text><text x="587.48" y="169">F</text><text x="634.48" y="169">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">6</text><text x="188" y="80">6</text><text x="235" y="80">6</text><text x="282" y="80">6</text><text x="329" y="80">6</text><text x="376" y="80">6</text><text x="423" y="80">–</text><text x="470" y="80">–</text><text x="517" y="80">–</text><text x="564" y="80">–</text><text x="611" y="80">–</text><text x="658" y="80">–</text><text x="188" y="110">7</text><text x="235" y="110">7</text><text x="282" y="110">7</text><text x="329" y="110">7</text><text x="376" y="110">7</text><text x="423" y="110">7</text><text x="470" y="110">–</text><text x="517" y="110">–</text><text x="564" y="110">–</text><text x="611" y="110">–</text><text x="658" y="110">–</text><text x="235" y="140">8</text><text x="282" y="140">8</text><text x="329" y="140">8</text><text x="376" y="140">8</text><text x="423" y="140">8</text><text x="470" y="140">8</text><text x="517" y="140">–</text><text x="564" y="140">–</text><text x="611" y="140">–</text><text x="658" y="140">–</text><text x="282" y="170">9</text><text x="329" y="170">10</text><text x="376" y="170">11</text><text x="423" y="170">11</text><text x="470" y="170">11</text><text x="517" y="170">11</text><text x="564" y="170">11</text><text x="611" y="170">11</text><text x="658" y="170">–</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">D</text>
<text x="358.5" y="213">E</text>
<text x="546.5" y="213">A</text>
<text x="593.5" y="213">D</text>
</g>
<text x="0" y="247" style="fill:var(--ink);font-size:13px;font-weight:600">LRU on the same accesses: 0 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="268" text-anchor="start">cycle</text>
<text x="123.5" y="268">0</text>
<text x="170.5" y="268">1</text>
<text x="217.5" y="268">2</text>
<text x="264.5" y="268">3</text>
<text x="311.5" y="268">4</text>
<text x="358.5" y="268">5</text>
<text x="405.5" y="268">6</text>
<text x="452.5" y="268">7</text>
<text x="499.5" y="268">8</text>
<text x="546.5" y="268">9</text>
<text x="593.5" y="268">10</text>
<text x="640.5" y="268">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="285" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="285">A</text>
<text x="170.5" y="285">B</text>
<text x="217.5" y="285">C</text>
<text x="264.5" y="285">D</text>
<text x="311.5" y="285">E</text>
<text x="358.5" y="285">F</text>
<text x="405.5" y="285">A</text>
<text x="452.5" y="285">B</text>
<text x="499.5" y="285">C</text>
<text x="546.5" y="285">D</text>
<text x="593.5" y="285">E</text>
<text x="640.5" y="285">F</text>
</g>
<text x="0" y="313" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="326" width="43" height="26" rx="3"/><rect x="102" y="356" width="43" height="26" rx="3"/><rect x="149" y="356" width="43" height="26" rx="3"/><rect x="102" y="386" width="43" height="26" rx="3"/><rect x="149" y="386" width="43" height="26" rx="3"/><rect x="196" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="296" width="43" height="26" rx="3"/><rect x="196" y="296" width="43" height="26" rx="3"/><rect x="243" y="296" width="43" height="26" rx="3"/><rect x="337" y="296" width="43" height="26" rx="3"/><rect x="384" y="296" width="43" height="26" rx="3"/><rect x="431" y="296" width="43" height="26" rx="3"/><rect x="525" y="296" width="43" height="26" rx="3"/><rect x="572" y="296" width="43" height="26" rx="3"/><rect x="619" y="296" width="43" height="26" rx="3"/><rect x="196" y="326" width="43" height="26" rx="3"/><rect x="243" y="326" width="43" height="26" rx="3"/><rect x="290" y="326" width="43" height="26" rx="3"/><rect x="384" y="326" width="43" height="26" rx="3"/><rect x="431" y="326" width="43" height="26" rx="3"/><rect x="478" y="326" width="43" height="26" rx="3"/><rect x="572" y="326" width="43" height="26" rx="3"/><rect x="619" y="326" width="43" height="26" rx="3"/><rect x="243" y="356" width="43" height="26" rx="3"/><rect x="290" y="356" width="43" height="26" rx="3"/><rect x="337" y="356" width="43" height="26" rx="3"/><rect x="431" y="356" width="43" height="26" rx="3"/><rect x="478" y="356" width="43" height="26" rx="3"/><rect x="525" y="356" width="43" height="26" rx="3"/><rect x="619" y="356" width="43" height="26" rx="3"/><rect x="290" y="386" width="43" height="26" rx="3"/><rect x="337" y="386" width="43" height="26" rx="3"/><rect x="384" y="386" width="43" height="26" rx="3"/><rect x="478" y="386" width="43" height="26" rx="3"/><rect x="525" y="386" width="43" height="26" rx="3"/><rect x="572" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="296" width="43" height="26" rx="3"/><rect x="290" y="296" width="43" height="26" rx="3"/><rect x="478" y="296" width="43" height="26" rx="3"/><rect x="149" y="326" width="43" height="26" rx="3"/><rect x="337" y="326" width="43" height="26" rx="3"/><rect x="525" y="326" width="43" height="26" rx="3"/><rect x="196" y="356" width="43" height="26" rx="3"/><rect x="384" y="356" width="43" height="26" rx="3"/><rect x="572" y="356" width="43" height="26" rx="3"/><rect x="243" y="386" width="43" height="26" rx="3"/><rect x="431" y="386" width="43" height="26" rx="3"/><rect x="619" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="313">A</text><text x="170.5" y="313">A</text><text x="217.5" y="313">A</text><text x="264.5" y="313">A</text><text x="311.5" y="313">E</text><text x="358.5" y="313">E</text><text x="405.5" y="313">E</text><text x="452.5" y="313">E</text><text x="499.5" y="313">C</text><text x="546.5" y="313">C</text><text x="593.5" y="313">C</text><text x="640.5" y="313">C</text><text x="170.5" y="343">B</text><text x="217.5" y="343">B</text><text x="264.5" y="343">B</text><text x="311.5" y="343">B</text><text x="358.5" y="343">F</text><text x="405.5" y="343">F</text><text x="452.5" y="343">F</text><text x="499.5" y="343">F</text><text x="546.5" y="343">D</text><text x="593.5" y="343">D</text><text x="640.5" y="343">D</text><text x="217.5" y="373">C</text><text x="264.5" y="373">C</text><text x="311.5" y="373">C</text><text x="358.5" y="373">C</text><text x="405.5" y="373">A</text><text x="452.5" y="373">A</text><text x="499.5" y="373">A</text><text x="546.5" y="373">A</text><text x="593.5" y="373">E</text><text x="640.5" y="373">E</text><text x="264.5" y="403">D</text><text x="311.5" y="403">D</text><text x="358.5" y="403">D</text><text x="405.5" y="403">D</text><text x="452.5" y="403">B</text><text x="499.5" y="403">B</text><text x="546.5" y="403">B</text><text x="593.5" y="403">B</text><text x="640.5" y="403">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="430" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="430" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="447" text-anchor="start">evicts</text>
<text x="311.5" y="447">A</text>
<text x="358.5" y="447">B</text>
<text x="405.5" y="447">C</text>
<text x="452.5" y="447">D</text>
<text x="499.5" y="447">E</text>
<text x="546.5" y="447">F</text>
<text x="593.5" y="447">A</text>
<text x="640.5" y="447">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="464" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="464">A</text>
<text x="170.5" y="464">BA</text>
<text x="217.5" y="464">CBA</text>
<text x="264.5" y="464">DCBA</text>
<text x="311.5" y="464">EDCB</text>
<text x="358.5" y="464">FEDC</text>
<text x="405.5" y="464">AFED</text>
<text x="452.5" y="464">BAFE</text>
<text x="499.5" y="464">CBAF</text>
<text x="546.5" y="464">DCBA</text>
<text x="593.5" y="464">EDCB</text>
<text x="640.5" y="464">FEDC</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="479" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="489">filled on a miss</text>
<rect x="136" y="479" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="489">hit</text>
<text x="194" y="489">small number = cycle of next use (– = none)</text>
</g>
</svg></div>
<p>OPT keeps three lines of the loop and sacrifices the rest. That "keep part of the working set" behavior is what LIP, BRRIP, and the learned policies try to recover.</p>

<h3 id="sec-lru">Least Recently Used (LRU)</h3>
<p><strong>Why it's used.</strong> Temporal locality: a line used recently is likely to be used again soon. For most programs at L1 and L2, recency is the best cheap predictor of reuse, so LRU's miss rate is close to OPT's when the working set fits. With 2 ways it costs a single bit per set.</p>
<p><strong>How it works.</strong> The lines of a set are kept in order from most recently used (MRU) to least recently used (LRU). A fill or a hit moves the line to the MRU end, and the victim is the line at the LRU end. Tracking a full order takes at least log<sub>2</sub>(N!) bits per set, and a common circuit, the N × N matrix, uses N(N − 1)/2 bits: 28 for 8 ways. Every hit rewrites the state. That cost is why true LRU is rare above 4 to 8 ways.</p>
<p><strong>Where it breaks.</strong> A loop even one line larger than the set gets zero hits (see the LRU trace under OPT above). A scan of single-use lines pushes everything out, because each new line starts at MRU and must travel N positions before it can be evicted.</p>
<p><strong>Example.</strong> A is reused at cycles 4, 8, and 11, and each access puts it back at the MRU end, so it is never the victim. The bottom row shows the order from MRU to LRU after each access:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="LRU on a 4-way set with the sequence A B C D A E B F A C G A. A hits at cycles 4, 8, and 11 because each access moves it back to the MRU end. Misses at cycles 5, 6, 7, 9, and 10 evict the line at the LRU end: B, C, D, E, and B. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LRU: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">E</text><text x="405.5" y="109">E</text><text x="452.5" y="109">E</text><text x="499.5" y="109">E</text><text x="546.5" y="109">C</text><text x="593.5" y="109">C</text><text x="640.5" y="109">C</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">B</text><text x="452.5" y="139">B</text><text x="499.5" y="139">B</text><text x="546.5" y="139">B</text><text x="593.5" y="139">G</text><text x="640.5" y="139">G</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">F</text><text x="593.5" y="169">F</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="230">A</text>
<text x="170.5" y="230">BA</text>
<text x="217.5" y="230">CBA</text>
<text x="264.5" y="230">DCBA</text>
<text x="311.5" y="230">ADCB</text>
<text x="358.5" y="230">EADC</text>
<text x="405.5" y="230">BEAD</text>
<text x="452.5" y="230">FBEA</text>
<text x="499.5" y="230">AFBE</text>
<text x="546.5" y="230">CAFB</text>
<text x="593.5" y="230">GCAF</text>
<text x="640.5" y="230">AGCF</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<h3 id="sec-plru">Tree Pseudo-LRU (PLRU)</h3>
<p><strong>Why it's used.</strong> It gets most of LRU's benefit with N − 1 bits per set (7 for 8 ways, 15 for 16 ways), and a hit updates only the log<sub>2</sub>(N) bits on one path. It is the usual choice for 4- to 16-way L1 and L2 caches. The PowerPC 7450's L1 caches use it, and reverse-engineering studies report it in Intel core caches.</p>
<p><strong>How it works.</strong> A binary tree sits over the ways. Each internal bit points toward the half that should be evicted from next: 0 for the left half, 1 for the right. On any access, every bit on the path to that way is set to point away from it. To find a victim, start at the root and follow the bits down.</p>
<p><strong>Example.</strong> On the same accesses as the LRU trace, just before cycle 5, the last accesses were A (way 0, at cycle 4), D (way 3), C (way 2), and B (way 1). True LRU would evict B. The tree only records that the right pair is older than the left pair, and that D is newer than C within it, so it picks C:</p>
<div class="tbl"><svg viewBox="0 0 680 256" role="img" aria-label="A tree pseudo-LRU for 4 ways, with 3 bits. The root bit b0 is 1, pointing to the right half, ways 2 and 3. Bit b1, over ways 0 and 1, is 1. Bit b2, over ways 2 and 3, is 0, pointing to way 2. Following the bits from the root reaches way 2, holding C, so C is the victim. True LRU would evict B in way 1, because the recency order from MRU to LRU is A, D, C, B." style="width:100%;min-width:520px;max-width:680px;display:block;font-family:var(--sans)">
<path d="M340,58 L200,90" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="260" y="70" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M340,58 L480,90" style="fill:none;stroke:var(--trace);stroke-width:3"/><text x="420" y="70" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<path d="M200,126 L130,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="155" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M200,126 L270,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="245" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<path d="M480,126 L410,166" style="fill:none;stroke:var(--trace);stroke-width:3"/><text x="435" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M480,126 L550,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="525" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<circle cx="340" cy="40" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="340" y="44" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b0=1</text>
<circle cx="200" cy="108" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="200" y="112" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b1=1</text>
<circle cx="480" cy="108" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="480" y="112" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b2=0</text>
<rect x="96" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="130" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">A</text><text x="130" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 0</text>
<rect x="236" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="270" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">B</text><text x="270" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 1</text>
<rect x="376" y="166" width="68" height="34" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="410" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">C</text><text x="410" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 2</text>
<rect x="516" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="550" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">D</text><text x="550" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 3</text>
<text x="410" y="220" text-anchor="middle" style="fill:var(--trace);font-size:11px;font-weight:600">PLRU victim</text>
<text x="270" y="220" text-anchor="middle" style="fill:var(--muted);font-size:11px">true LRU victim</text>
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">Bits just before cycle 5 of the trace below</text>
<text x="340" y="244" text-anchor="middle" style="fill:var(--muted);font-size:11px">Each bit points toward the half to evict from. True recency, MRU to LRU, is A D C B.</text>
</svg></div>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="Tree pseudo-LRU on the same sequence A B C D A E B F A C G A. At cycle 5, E evicts C in way 2 while true LRU would have evicted B. B then hits at cycle 6. 4 of 12 hits, one more than true LRU on this sequence." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Tree PLRU: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">B</text><text x="546.5" y="109">B</text><text x="593.5" y="109">G</text><text x="640.5" y="109">G</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">E</text><text x="405.5" y="139">E</text><text x="452.5" y="139">E</text><text x="499.5" y="139">E</text><text x="546.5" y="139">C</text><text x="593.5" y="139">C</text><text x="640.5" y="139">C</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">F</text><text x="593.5" y="169">F</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">bits b0 b1 b2</text>
<text x="123.5" y="230">110</text>
<text x="170.5" y="230">100</text>
<text x="217.5" y="230">001</text>
<text x="264.5" y="230">000</text>
<text x="311.5" y="230">110</text>
<text x="358.5" y="230">011</text>
<text x="405.5" y="230">101</text>
<text x="452.5" y="230">000</text>
<text x="499.5" y="230">110</text>
<text x="546.5" y="230">011</text>
<text x="593.5" y="230">101</text>
<text x="640.5" y="230">111</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>
<p>Here the approximation happens to help: B is used at cycle 6 and hits, so PLRU gets 4 hits to LRU's 3. Over full benchmarks the two are usually within a few percent of each other in miss rate.</p>

<h3 id="sec-nru">Not Recently Used (NRU)</h3>
<p><strong>Why it's used.</strong> It is even cheaper than tree PLRU: one bit per line, and a hit sets only its own line's bit, with no shared tree to update. Sun's UltraSPARC T2 used it in its L2. It is also the one-bit special case of RRIP (below).</p>
<p><strong>How it works.</strong> Each line has a used bit U, set to 1 on a fill or a hit. The victim is the first line, searching from way 0, with U = 0. If every bit is 1, clear them all and search again, which picks way 0.</p>
<p><strong>Example.</strong> At cycle 5 every line has U = 1, so all bits are cleared and way 0 is evicted. That is A, which was used one access earlier. After a clear, NRU can't tell old lines from new ones:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="NRU on the sequence A B C D A E B F A C G A. Each line's used bit is set on access. At cycle 5 every bit is 1, so all are cleared and the first way, holding A, is evicted even though A was just used. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">NRU: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">E</text><text x="399.48" y="79">E</text><text x="446.48" y="79">E</text><text x="493.48" y="79">E</text><text x="540.48" y="79">C</text><text x="587.48" y="79">C</text><text x="634.48" y="79">C</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">B</text><text x="399.48" y="109">B</text><text x="446.48" y="109">B</text><text x="493.48" y="109">B</text><text x="540.48" y="109">B</text><text x="587.48" y="109">G</text><text x="634.48" y="109">G</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">F</text><text x="493.48" y="139">F</text><text x="540.48" y="139">F</text><text x="587.48" y="139">F</text><text x="634.48" y="139">F</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">D</text><text x="493.48" y="169">A</text><text x="540.48" y="169">A</text><text x="587.48" y="169">A</text><text x="634.48" y="169">A</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">1</text><text x="188" y="80">1</text><text x="235" y="80">1</text><text x="282" y="80">1</text><text x="329" y="80">1</text><text x="376" y="80">1</text><text x="423" y="80">1</text><text x="470" y="80">1</text><text x="517" y="80">1</text><text x="564" y="80">1</text><text x="611" y="80">1</text><text x="658" y="80">1</text><text x="188" y="110">1</text><text x="235" y="110">1</text><text x="282" y="110">1</text><text x="329" y="110">1</text><text x="376" y="110">0</text><text x="423" y="110">1</text><text x="470" y="110">1</text><text x="517" y="110">1</text><text x="564" y="110">0</text><text x="611" y="110">1</text><text x="658" y="110">1</text><text x="235" y="140">1</text><text x="282" y="140">1</text><text x="329" y="140">1</text><text x="376" y="140">0</text><text x="423" y="140">0</text><text x="470" y="140">1</text><text x="517" y="140">1</text><text x="564" y="140">0</text><text x="611" y="140">0</text><text x="658" y="140">0</text><text x="282" y="170">1</text><text x="329" y="170">1</text><text x="376" y="170">0</text><text x="423" y="170">0</text><text x="470" y="170">0</text><text x="517" y="170">1</text><text x="564" y="170">0</text><text x="611" y="170">0</text><text x="658" y="170">1</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">A</text>
<text x="452.5" y="213">C</text>
<text x="499.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
<text x="194" y="238">small number = used bit U</text>
</g>
</svg></div>

<h3 id="sec-fifo">First In, First Out (FIFO)</h3>
<p><strong>Why it's used.</strong> Hits change nothing, so there is no state to update on the most common event. Each set needs only a log<sub>2</sub>(N)-bit pointer. That suits highly associative structures and designs where hit-path power matters, and ARM calls it round-robin and offers it as a cache option on several Cortex cores.</p>
<p><strong>How it works.</strong> A pointer names the next victim. Each fill replaces the line at the pointer and advances the pointer by one way, wrapping around. The victim is the line filled longest ago, however often it has been used since. FIFO can also show Belady's anomaly: adding ways can increase misses on some traces.</p>
<p><strong>Example.</strong> A hits at cycle 4, but it was the first line in, so at cycle 5 E evicts it anyway. LRU would have kept A and evicted B:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="FIFO on the sequence A B C D A E B F A C G A. The hit on A at cycle 4 changes nothing, so at cycle 5 E evicts A, the oldest line, even though it was just used. B hits at cycle 6 and A at cycle 11. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">FIFO: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">E</text><text x="405.5" y="79">E</text><text x="452.5" y="79">E</text><text x="499.5" y="79">E</text><text x="546.5" y="79">E</text><text x="593.5" y="79">G</text><text x="640.5" y="79">G</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">F</text><text x="499.5" y="109">F</text><text x="546.5" y="109">F</text><text x="593.5" y="109">F</text><text x="640.5" y="109">F</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">C</text><text x="452.5" y="139">C</text><text x="499.5" y="139">A</text><text x="546.5" y="139">A</text><text x="593.5" y="139">A</text><text x="640.5" y="139">A</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">D</text><text x="499.5" y="169">D</text><text x="546.5" y="169">C</text><text x="593.5" y="169">C</text><text x="640.5" y="169">C</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">A</text>
<text x="452.5" y="213">B</text>
<text x="499.5" y="213">C</text>
<text x="546.5" y="213">D</text>
<text x="593.5" y="213">E</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">next victim</text>
<text x="123.5" y="230">way 1</text>
<text x="170.5" y="230">way 2</text>
<text x="217.5" y="230">way 3</text>
<text x="264.5" y="230">way 0</text>
<text x="311.5" y="230">way 0</text>
<text x="358.5" y="230">way 1</text>
<text x="405.5" y="230">way 1</text>
<text x="452.5" y="230">way 2</text>
<text x="499.5" y="230">way 3</text>
<text x="546.5" y="230">way 0</text>
<text x="593.5" y="230">way 1</text>
<text x="640.5" y="230">way 1</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<h3 id="sec-random">Random</h3>
<p><strong>Why it's used.</strong> It needs one LFSR for the whole cache, nothing per set, and nothing on a hit. It also has no pathological pattern: a loop slightly larger than the cache gets some hits instead of LRU's none. Hennessy and Patterson show its miss rate approaching LRU's as caches grow, since the victim matters less when there are many candidates. ARM's Cortex-A8 and Cortex-A9 L1 caches use pseudo-random replacement.</p>
<p><strong>How it works.</strong> On a miss in a full set, a pseudo-random generator (usually an LFSR) picks the way. Empty ways are filled first.</p>
<p><strong>Example.</strong> The same six-line loop that gave LRU zero hits, with the LFSR producing ways 2, 0, 3, 1, 2, 0, and 1 on the seven evictions. B happens to survive long enough to hit:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="Random replacement on the cyclic sequence A B C D E F A B C D E F, with the LFSR choosing ways 2, 0, 3, 1, 2, 0, and 1 on the seven misses that need a victim. B survives long enough to hit at cycle 7. 1 of 12 hits, where LRU gets 0." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Random: 1 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="431" y="92" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">F</text><text x="405.5" y="79">F</text><text x="452.5" y="79">F</text><text x="499.5" y="79">F</text><text x="546.5" y="79">F</text><text x="593.5" y="79">E</text><text x="640.5" y="79">E</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">C</text><text x="546.5" y="109">C</text><text x="593.5" y="109">C</text><text x="640.5" y="109">F</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">E</text><text x="358.5" y="139">E</text><text x="405.5" y="139">E</text><text x="452.5" y="139">E</text><text x="499.5" y="139">E</text><text x="546.5" y="139">D</text><text x="593.5" y="139">D</text><text x="640.5" y="139">D</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">A</text><text x="452.5" y="169">A</text><text x="499.5" y="169">A</text><text x="546.5" y="169">A</text><text x="593.5" y="169">A</text><text x="640.5" y="169">A</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">C</text>
<text x="358.5" y="213">A</text>
<text x="405.5" y="213">D</text>
<text x="499.5" y="213">B</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">F</text>
<text x="640.5" y="213">C</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
</g>
</svg></div>

<h3 id="sec-lfu">Least Frequently Used (LFU)</h3>
<p><strong>Why it's used.</strong> Frequency separates a line used many times from one used once, which recency alone can't do. A single-use scan line can never displace a line with a high count. Pure LFU is rare in CPU caches, but it is common in software caches, and frequency-style reuse counters appear inside hardware policies such as SHiP.</p>
<p><strong>How it works.</strong> Each line has a saturating counter, set to 1 on a fill and incremented on every hit. The victim is the line with the lowest count, with ties broken toward the lowest way. Counts must also age, for example by halving every count periodically. Otherwise a line that was hot in an old phase keeps its high count and occupies the cache forever.</p>
<p><strong>Example.</strong> A reaches a count of 4 and is never in danger. New lines all start at 1, so they keep replacing one another in way 1. B is evicted at cycle 5 and misses at cycle 6, because to LFU a line used once is a line used once:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="LFU on the sequence A B C D A E B F A C G A. A's use count climbs to 4, so it is never the victim. New lines start at count 1 and keep replacing each other in way 1. 4 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LFU: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">A</text><text x="399.48" y="79">A</text><text x="446.48" y="79">A</text><text x="493.48" y="79">A</text><text x="540.48" y="79">A</text><text x="587.48" y="79">A</text><text x="634.48" y="79">A</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">E</text><text x="399.48" y="109">B</text><text x="446.48" y="109">F</text><text x="493.48" y="109">F</text><text x="540.48" y="109">F</text><text x="587.48" y="109">G</text><text x="634.48" y="109">G</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">C</text><text x="493.48" y="139">C</text><text x="540.48" y="139">C</text><text x="587.48" y="139">C</text><text x="634.48" y="139">C</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">D</text><text x="493.48" y="169">D</text><text x="540.48" y="169">D</text><text x="587.48" y="169">D</text><text x="634.48" y="169">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">1</text><text x="188" y="80">1</text><text x="235" y="80">1</text><text x="282" y="80">1</text><text x="329" y="80">2</text><text x="376" y="80">2</text><text x="423" y="80">2</text><text x="470" y="80">2</text><text x="517" y="80">3</text><text x="564" y="80">3</text><text x="611" y="80">3</text><text x="658" y="80">4</text><text x="188" y="110">1</text><text x="235" y="110">1</text><text x="282" y="110">1</text><text x="329" y="110">1</text><text x="376" y="110">1</text><text x="423" y="110">1</text><text x="470" y="110">1</text><text x="517" y="110">1</text><text x="564" y="110">1</text><text x="611" y="110">1</text><text x="658" y="110">1</text><text x="235" y="140">1</text><text x="282" y="140">1</text><text x="329" y="140">1</text><text x="376" y="140">1</text><text x="423" y="140">1</text><text x="470" y="140">1</text><text x="517" y="140">1</text><text x="564" y="140">2</text><text x="611" y="140">2</text><text x="658" y="140">2</text><text x="282" y="170">1</text><text x="329" y="170">1</text><text x="376" y="170">1</text><text x="423" y="170">1</text><text x="470" y="170">1</text><text x="517" y="170">1</text><text x="564" y="170">1</text><text x="611" y="170">1</text><text x="658" y="170">1</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">E</text>
<text x="452.5" y="213">B</text>
<text x="593.5" y="213">F</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
<text x="194" y="238">small number = use count</text>
</g>
</svg></div>

<h3 id="sec-lip">LRU Insertion Policy (LIP)</h3>
<p><strong>Why it's used.</strong> In last-level caches, many lines are never reused after they're filled. Under LRU each of them is inserted at MRU and must work its way down the whole stack, pushing out N other lines first. LIP (Qureshi, Jaleel, Patt, Steely, and Emer, ISCA 2007) makes a new line earn its place: it must hit before it gets any protection. It needs no state beyond LRU's.</p>
<p><strong>How it works.</strong> It is LRU with one change: a filled line is placed at the LRU end instead of the MRU end. A hit still moves a line to MRU. Lines that are never reused then replace one another in the LRU position, and the rest of the set is untouched.</p>
<p><strong>Example.</strong> The six-line loop again. E and F go in at the LRU end and evict each other in way 3, while A, B, and C stay and hit. LRU gets 0 of 12 on this sequence:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="LRU insertion policy on the cyclic sequence A B C D E F A B C D E F. E and F are inserted at the LRU position and evict each other in way 3, so A, B, and C stay and hit at cycles 6, 7, and 8. 3 of 12 hits, where LRU gets 0." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LIP: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">B</text><text x="546.5" y="109">B</text><text x="593.5" y="109">B</text><text x="640.5" y="109">B</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">C</text><text x="452.5" y="139">C</text><text x="499.5" y="139">C</text><text x="546.5" y="139">C</text><text x="593.5" y="139">C</text><text x="640.5" y="139">C</text><text x="264.5" y="169">D</text><text x="311.5" y="169">E</text><text x="358.5" y="169">F</text><text x="405.5" y="169">F</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">D</text><text x="593.5" y="169">E</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">D</text>
<text x="358.5" y="213">E</text>
<text x="546.5" y="213">F</text>
<text x="593.5" y="213">D</text>
<text x="640.5" y="213">E</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="230">A</text>
<text x="170.5" y="230">AB</text>
<text x="217.5" y="230">ABC</text>
<text x="264.5" y="230">ABCD</text>
<text x="311.5" y="230">ABCE</text>
<text x="358.5" y="230">ABCF</text>
<text x="405.5" y="230">ABCF</text>
<text x="452.5" y="230">BACF</text>
<text x="499.5" y="230">CBAF</text>
<text x="546.5" y="230">CBAD</text>
<text x="593.5" y="230">CBAE</text>
<text x="640.5" y="230">CBAF</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<h3 id="sec-bip">Bimodal Insertion Policy (BIP)</h3>
<p><strong>Why it's used.</strong> LIP never ages its lines. When a program moves to a new working set, the old lines keep their MRU positions and the new lines fight over the single LRU slot, even if the new working set would fit. BIP adds a small chance of a normal MRU insertion, so the cache slowly turns over to the new working set while still resisting thrashing.</p>
<p><strong>How it works.</strong> On a fill, insert at MRU with a small probability ε (1/32 in the paper, from a counter or an LFSR), otherwise at the LRU end. Hits move the line to MRU as in LRU.</p>
<p><strong>Example.</strong> The set starts full of W, X, Y, and Z, which the program no longer uses. It now loops over A, B, and C, which would fit in three ways. Under LIP every new line lands in way 0 at the LRU end and is evicted by the next one, so the loop never hits. Under BIP, the coin picks MRU for B at cycle 1. That pushes stale X down to the LRU end, where the next miss evicts it, and B then hits on every trip around the loop. Later lucky insertions bring in A and C the same way:</p>
<div class="tbl"><svg viewBox="0 0 680 514" role="img" aria-label="A phase change. The set starts full of W, X, Y, and Z, which are no longer used, and the program now loops over A, B, and C, which would fit. Under LIP every new line goes into the LRU slot, way 0, and is evicted by the next new line, so the loop never hits. Under BIP, B is inserted at MRU on cycle 1 and hits at cycles 4 and 7. 0 of 9 hits for LIP, 2 of 9 for BIP." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LIP: 0 of 9 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="124" y="34">start</text>
<text x="172" y="34">0</text>
<text x="220" y="34">1</text>
<text x="268" y="34">2</text>
<text x="316" y="34">3</text>
<text x="364" y="34">4</text>
<text x="412" y="34">5</text>
<text x="460" y="34">6</text>
<text x="508" y="34">7</text>
<text x="556" y="34">8</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="172" y="51">A</text>
<text x="220" y="51">B</text>
<text x="268" y="51">C</text>
<text x="316" y="51">A</text>
<text x="364" y="51">B</text>
<text x="412" y="51">C</text>
<text x="460" y="51">A</text>
<text x="508" y="51">B</text>
<text x="556" y="51">C</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="102" y="62" width="44" height="26" rx="3"/><rect x="102" y="92" width="44" height="26" rx="3"/><rect x="150" y="92" width="44" height="26" rx="3"/><rect x="198" y="92" width="44" height="26" rx="3"/><rect x="246" y="92" width="44" height="26" rx="3"/><rect x="294" y="92" width="44" height="26" rx="3"/><rect x="342" y="92" width="44" height="26" rx="3"/><rect x="390" y="92" width="44" height="26" rx="3"/><rect x="438" y="92" width="44" height="26" rx="3"/><rect x="486" y="92" width="44" height="26" rx="3"/><rect x="534" y="92" width="44" height="26" rx="3"/><rect x="102" y="122" width="44" height="26" rx="3"/><rect x="150" y="122" width="44" height="26" rx="3"/><rect x="198" y="122" width="44" height="26" rx="3"/><rect x="246" y="122" width="44" height="26" rx="3"/><rect x="294" y="122" width="44" height="26" rx="3"/><rect x="342" y="122" width="44" height="26" rx="3"/><rect x="390" y="122" width="44" height="26" rx="3"/><rect x="438" y="122" width="44" height="26" rx="3"/><rect x="486" y="122" width="44" height="26" rx="3"/><rect x="534" y="122" width="44" height="26" rx="3"/><rect x="102" y="152" width="44" height="26" rx="3"/><rect x="150" y="152" width="44" height="26" rx="3"/><rect x="198" y="152" width="44" height="26" rx="3"/><rect x="246" y="152" width="44" height="26" rx="3"/><rect x="294" y="152" width="44" height="26" rx="3"/><rect x="342" y="152" width="44" height="26" rx="3"/><rect x="390" y="152" width="44" height="26" rx="3"/><rect x="438" y="152" width="44" height="26" rx="3"/><rect x="486" y="152" width="44" height="26" rx="3"/><rect x="534" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="150" y="62" width="44" height="26" rx="3"/><rect x="198" y="62" width="44" height="26" rx="3"/><rect x="246" y="62" width="44" height="26" rx="3"/><rect x="294" y="62" width="44" height="26" rx="3"/><rect x="342" y="62" width="44" height="26" rx="3"/><rect x="390" y="62" width="44" height="26" rx="3"/><rect x="438" y="62" width="44" height="26" rx="3"/><rect x="486" y="62" width="44" height="26" rx="3"/><rect x="534" y="62" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="79">W</text><text x="172" y="79">A</text><text x="220" y="79">B</text><text x="268" y="79">C</text><text x="316" y="79">A</text><text x="364" y="79">B</text><text x="412" y="79">C</text><text x="460" y="79">A</text><text x="508" y="79">B</text><text x="556" y="79">C</text><text x="124" y="109">X</text><text x="172" y="109">X</text><text x="220" y="109">X</text><text x="268" y="109">X</text><text x="316" y="109">X</text><text x="364" y="109">X</text><text x="412" y="109">X</text><text x="460" y="109">X</text><text x="508" y="109">X</text><text x="556" y="109">X</text><text x="124" y="139">Y</text><text x="172" y="139">Y</text><text x="220" y="139">Y</text><text x="268" y="139">Y</text><text x="316" y="139">Y</text><text x="364" y="139">Y</text><text x="412" y="139">Y</text><text x="460" y="139">Y</text><text x="508" y="139">Y</text><text x="556" y="139">Y</text><text x="124" y="169">Z</text><text x="172" y="169">Z</text><text x="220" y="169">Z</text><text x="268" y="169">Z</text><text x="316" y="169">Z</text><text x="364" y="169">Z</text><text x="412" y="169">Z</text><text x="460" y="169">Z</text><text x="508" y="169">Z</text><text x="556" y="169">Z</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="172" y="196" style="fill:var(--accent-red)">miss</text>
<text x="220" y="196" style="fill:var(--accent-red)">miss</text>
<text x="268" y="196" style="fill:var(--accent-red)">miss</text>
<text x="316" y="196" style="fill:var(--accent-red)">miss</text>
<text x="364" y="196" style="fill:var(--accent-red)">miss</text>
<text x="412" y="196" style="fill:var(--accent-red)">miss</text>
<text x="460" y="196" style="fill:var(--accent-red)">miss</text>
<text x="508" y="196" style="fill:var(--accent-red)">miss</text>
<text x="556" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="172" y="213">W</text>
<text x="220" y="213">A</text>
<text x="268" y="213">B</text>
<text x="316" y="213">C</text>
<text x="364" y="213">A</text>
<text x="412" y="213">B</text>
<text x="460" y="213">C</text>
<text x="508" y="213">A</text>
<text x="556" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="230">ZYXW</text>
<text x="172" y="230">ZYXA</text>
<text x="220" y="230">ZYXB</text>
<text x="268" y="230">ZYXC</text>
<text x="316" y="230">ZYXA</text>
<text x="364" y="230">ZYXB</text>
<text x="412" y="230">ZYXC</text>
<text x="460" y="230">ZYXA</text>
<text x="508" y="230">ZYXB</text>
<text x="556" y="230">ZYXC</text>
</g>
<text x="0" y="264" style="fill:var(--ink);font-size:13px;font-weight:600">BIP, with the 1-in-32 MRU insertion landing on cycle 1: 2 of 9 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="285" text-anchor="start">cycle</text>
<text x="124" y="285">start</text>
<text x="172" y="285">0</text>
<text x="220" y="285">1</text>
<text x="268" y="285">2</text>
<text x="316" y="285">3</text>
<text x="364" y="285">4</text>
<text x="412" y="285">5</text>
<text x="460" y="285">6</text>
<text x="508" y="285">7</text>
<text x="556" y="285">8</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="302" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="172" y="302">A</text>
<text x="220" y="302">B</text>
<text x="268" y="302">C</text>
<text x="316" y="302">A</text>
<text x="364" y="302">B</text>
<text x="412" y="302">C</text>
<text x="460" y="302">A</text>
<text x="508" y="302">B</text>
<text x="556" y="302">C</text>
</g>
<text x="0" y="330" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="360" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="390" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="420" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="102" y="313" width="44" height="26" rx="3"/><rect x="246" y="313" width="44" height="26" rx="3"/><rect x="294" y="313" width="44" height="26" rx="3"/><rect x="390" y="313" width="44" height="26" rx="3"/><rect x="438" y="313" width="44" height="26" rx="3"/><rect x="534" y="313" width="44" height="26" rx="3"/><rect x="102" y="343" width="44" height="26" rx="3"/><rect x="150" y="343" width="44" height="26" rx="3"/><rect x="198" y="343" width="44" height="26" rx="3"/><rect x="342" y="343" width="44" height="26" rx="3"/><rect x="486" y="343" width="44" height="26" rx="3"/><rect x="102" y="373" width="44" height="26" rx="3"/><rect x="150" y="373" width="44" height="26" rx="3"/><rect x="198" y="373" width="44" height="26" rx="3"/><rect x="246" y="373" width="44" height="26" rx="3"/><rect x="294" y="373" width="44" height="26" rx="3"/><rect x="342" y="373" width="44" height="26" rx="3"/><rect x="390" y="373" width="44" height="26" rx="3"/><rect x="438" y="373" width="44" height="26" rx="3"/><rect x="486" y="373" width="44" height="26" rx="3"/><rect x="534" y="373" width="44" height="26" rx="3"/><rect x="102" y="403" width="44" height="26" rx="3"/><rect x="150" y="403" width="44" height="26" rx="3"/><rect x="198" y="403" width="44" height="26" rx="3"/><rect x="246" y="403" width="44" height="26" rx="3"/><rect x="294" y="403" width="44" height="26" rx="3"/><rect x="342" y="403" width="44" height="26" rx="3"/><rect x="390" y="403" width="44" height="26" rx="3"/><rect x="438" y="403" width="44" height="26" rx="3"/><rect x="486" y="403" width="44" height="26" rx="3"/><rect x="534" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="150" y="313" width="44" height="26" rx="3"/><rect x="198" y="313" width="44" height="26" rx="3"/><rect x="246" y="343" width="44" height="26" rx="3"/><rect x="294" y="343" width="44" height="26" rx="3"/><rect x="390" y="343" width="44" height="26" rx="3"/><rect x="438" y="343" width="44" height="26" rx="3"/><rect x="534" y="343" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="342" y="313" width="44" height="26" rx="3"/><rect x="486" y="313" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="330">W</text><text x="172" y="330">A</text><text x="220" y="330">B</text><text x="268" y="330">B</text><text x="316" y="330">B</text><text x="364" y="330">B</text><text x="412" y="330">B</text><text x="460" y="330">B</text><text x="508" y="330">B</text><text x="556" y="330">B</text><text x="124" y="360">X</text><text x="172" y="360">X</text><text x="220" y="360">X</text><text x="268" y="360">C</text><text x="316" y="360">A</text><text x="364" y="360">A</text><text x="412" y="360">C</text><text x="460" y="360">A</text><text x="508" y="360">A</text><text x="556" y="360">C</text><text x="124" y="390">Y</text><text x="172" y="390">Y</text><text x="220" y="390">Y</text><text x="268" y="390">Y</text><text x="316" y="390">Y</text><text x="364" y="390">Y</text><text x="412" y="390">Y</text><text x="460" y="390">Y</text><text x="508" y="390">Y</text><text x="556" y="390">Y</text><text x="124" y="420">Z</text><text x="172" y="420">Z</text><text x="220" y="420">Z</text><text x="268" y="420">Z</text><text x="316" y="420">Z</text><text x="364" y="420">Z</text><text x="412" y="420">Z</text><text x="460" y="420">Z</text><text x="508" y="420">Z</text><text x="556" y="420">Z</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="447" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="172" y="447" style="fill:var(--accent-red)">miss</text>
<text x="220" y="447" style="fill:var(--accent-red)">miss</text>
<text x="268" y="447" style="fill:var(--accent-red)">miss</text>
<text x="316" y="447" style="fill:var(--accent-red)">miss</text>
<text x="364" y="447" style="fill:var(--accent-green)">hit</text>
<text x="412" y="447" style="fill:var(--accent-red)">miss</text>
<text x="460" y="447" style="fill:var(--accent-red)">miss</text>
<text x="508" y="447" style="fill:var(--accent-green)">hit</text>
<text x="556" y="447" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="464" text-anchor="start">evicts</text>
<text x="172" y="464">W</text>
<text x="220" y="464">A</text>
<text x="268" y="464">X</text>
<text x="316" y="464">C</text>
<text x="412" y="464">A</text>
<text x="460" y="464">C</text>
<text x="556" y="464">A</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="481" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="481">ZYXW</text>
<text x="172" y="481">ZYXA</text>
<text x="220" y="481">BZYX</text>
<text x="268" y="481">BZYC</text>
<text x="316" y="481">BZYA</text>
<text x="364" y="481">BZYA</text>
<text x="412" y="481">BZYC</text>
<text x="460" y="481">BZYA</text>
<text x="508" y="481">BZYA</text>
<text x="556" y="481">BZYC</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="496" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="506">filled on a miss</text>
<rect x="136" y="496" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="506">hit</text>
</g>
</svg></div>

<h3 id="sec-dip">Dynamic Insertion Policy (DIP)</h3>
<p><strong>Why it's used.</strong> BIP loses to LRU when the working set fits, because new lines that would have been reused start out unprotected. Neither policy wins on every program, or even across the phases of one program. DIP picks between them at run time, and set dueling lets it do that with one counter instead of a second set of tags per policy.</p>
<p><strong>How it works.</strong> A few sets are leaders that always use LRU, a few always use BIP, and the rest are followers. The paper uses 32 leaders per policy and a 10-bit saturating counter, PSEL:</p>
<ul>
<li>A miss in an LRU leader increments PSEL.</li>
<li>A miss in a BIP leader decrements PSEL.</li>
<li>When a follower set fills a line, it uses BIP if PSEL's most significant bit is 1 (the LRU leaders have been missing more), and LRU otherwise.</li>
</ul>
<p>The leaders are picked by a fixed function of the set index bits, so finding them costs a little logic and no storage.</p>
<div class="tbl"><svg viewBox="0 0 680 282" role="img" aria-label="Set dueling in DIP. A 2 MB, 16-way LLC with 64-byte lines has 2048 sets. 32 sets always use LRU and 32 always use BIP, and the other 1984 are followers. A miss in an LRU leader increments a 10-bit PSEL counter and a miss in a BIP leader decrements it. Follower sets insert with BIP when the counter's most significant bit is 1, meaning the LRU leaders have been missing more, and with LRU otherwise." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">A 2 MB, 16-way LLC with 64 B lines: 2048 sets, drawn as 32</text>
<rect x="68" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="83" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="102" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="117" y="45" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">L</text>
<rect x="136" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="151" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="170" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="185" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="204" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="219" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="238" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="253" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="272" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="287" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="306" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="321" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="340" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="355" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="374" y="30" width="30" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="389" y="45" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">B</text>
<rect x="408" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="423" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="442" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="457" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="476" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="491" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="510" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="525" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="544" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="559" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="578" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="593" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="68" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="83" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="102" y="58" width="30" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="117" y="73" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">B</text>
<rect x="136" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="151" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="170" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="185" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="204" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="219" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="238" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="253" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="272" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="287" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="306" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="321" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="340" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="355" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="374" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="389" y="73" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">L</text>
<rect x="408" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="423" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="442" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="457" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="476" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="491" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="510" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="525" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="544" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="559" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="578" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="593" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<g style="fill:var(--muted);font-size:11px"><text x="0" y="45">sets</text></g>
<g style="font-size:11px"><rect x="68" y="96" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="90" y="106" style="fill:var(--muted)">L: 32 LRU leaders</text>
<rect x="230" y="96" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="252" y="106" style="fill:var(--muted)">B: 32 BIP leaders</text>
<rect x="392" y="96" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="414" y="106" style="fill:var(--muted)">1984 followers</text></g>
<rect x="250" y="148" width="180" height="44" rx="4" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="340" y="166" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">PSEL: 10-bit counter</text><text x="340" y="182" text-anchor="middle" style="fill:var(--muted);font-size:11px">0 to 1023, MSB = bit 9</text>
<defs><marker id="arrDuel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5"><path d="M118,116 V170 H246" marker-end="url(#arrDuel)"/><path d="M562,116 V170 H434" marker-end="url(#arrDuel)"/><path d="M340,192 V226" marker-end="url(#arrDuel)"/></g>
<text x="0" y="140" style="fill:var(--ink);font-size:11px">LRU leader miss:</text><text x="0" y="155" style="fill:var(--ink);font-size:11px">PSEL + 1</text>
<text x="680" y="140" text-anchor="end" style="fill:var(--ink);font-size:11px">BIP leader miss:</text><text x="680" y="155" text-anchor="end" style="fill:var(--ink);font-size:11px">PSEL − 1</text>
<rect x="170" y="230" width="340" height="44" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="340" y="248" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">followers read the MSB on each fill</text><text x="340" y="264" text-anchor="middle" style="fill:var(--muted);font-size:11px">MSB 1 (LRU leaders miss more): insert with BIP, MSB 0: LRU</text>
</svg></div>
<p><strong>Example.</strong> PSEL starts at 512. Over a stretch of a streaming phase, the LRU leaders miss 2,400 times and the BIP leaders 1,900 times. PSEL climbs by the net 500 to 1012, below the 1023 ceiling, so its MSB is 1 and all 1984 followers insert with BIP. When the program returns to a loop that fits, the BIP leaders start missing more, PSEL falls back below 512, and the followers switch to LRU.</p>

<h3 id="sec-srrip">Static Re-Reference Interval Prediction (SRRIP)</h3>
<p><strong>Why it's used.</strong> An LRU position is really a prediction of when a line will be used again: MRU means "soon" and LRU means "far off." LRU predicts "soon" for every new line, which is wrong for scans. RRIP (Jaleel, Theobald, Steely, and Emer, ISCA 2010) stores the prediction directly in a small counter per line and gives new lines a "long" prediction, between soon and far off. A new line must be reused to become safe, so a scan can't flush lines that have shown reuse. It costs 2 bits per line.</p>
<p><strong>How it works.</strong> Each line has a 2-bit re-reference prediction value (RRPV): 0 means near-immediate reuse, 3 means distant.</p>
<ul>
<li><strong>Insertion:</strong> RRPV 2.</li>
<li><strong>Hit:</strong> RRPV 0.</li>
<li><strong>Eviction:</strong> the first line from way 0 with RRPV 3. If there is none, add 1 to every RRPV in the set and search again.</li>
</ul>
<p><strong>Example.</strong> A and B are hot, then a four-line scan passes through. At cycle 6 no line has RRPV 3, so every RRPV goes up by one: A and B to 1, C and D to 3, and C is evicted. The scan lines keep evicting each other, and A and B survive:</p>
<div class="tbl"><svg viewBox="0 0 680 497" role="img" aria-label="A scan. Hot lines A and B are used twice, then the scan C D E F passes through, then A and B are used again. LRU lets the scan evict A and B, so they miss at cycles 8 and 9: 2 of 10 hits. SRRIP inserts the scan lines at RRPV 2 while A and B sit at 0, so the scan lines evict each other and A and B hit at the end: 4 of 10 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LRU: 2 of 10 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="124" y="34">0</text>
<text x="172" y="34">1</text>
<text x="220" y="34">2</text>
<text x="268" y="34">3</text>
<text x="316" y="34">4</text>
<text x="364" y="34">5</text>
<text x="412" y="34">6</text>
<text x="460" y="34">7</text>
<text x="508" y="34">8</text>
<text x="556" y="34">9</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="124" y="51">A</text>
<text x="172" y="51">B</text>
<text x="220" y="51">A</text>
<text x="268" y="51">B</text>
<text x="316" y="51">C</text>
<text x="364" y="51">D</text>
<text x="412" y="51">E</text>
<text x="460" y="51">F</text>
<text x="508" y="51">A</text>
<text x="556" y="51">B</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="44" height="26" rx="3"/><rect x="102" y="122" width="44" height="26" rx="3"/><rect x="150" y="122" width="44" height="26" rx="3"/><rect x="198" y="122" width="44" height="26" rx="3"/><rect x="246" y="122" width="44" height="26" rx="3"/><rect x="102" y="152" width="44" height="26" rx="3"/><rect x="150" y="152" width="44" height="26" rx="3"/><rect x="198" y="152" width="44" height="26" rx="3"/><rect x="246" y="152" width="44" height="26" rx="3"/><rect x="294" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="150" y="62" width="44" height="26" rx="3"/><rect x="246" y="62" width="44" height="26" rx="3"/><rect x="294" y="62" width="44" height="26" rx="3"/><rect x="342" y="62" width="44" height="26" rx="3"/><rect x="438" y="62" width="44" height="26" rx="3"/><rect x="486" y="62" width="44" height="26" rx="3"/><rect x="534" y="62" width="44" height="26" rx="3"/><rect x="198" y="92" width="44" height="26" rx="3"/><rect x="294" y="92" width="44" height="26" rx="3"/><rect x="342" y="92" width="44" height="26" rx="3"/><rect x="390" y="92" width="44" height="26" rx="3"/><rect x="486" y="92" width="44" height="26" rx="3"/><rect x="534" y="92" width="44" height="26" rx="3"/><rect x="342" y="122" width="44" height="26" rx="3"/><rect x="390" y="122" width="44" height="26" rx="3"/><rect x="438" y="122" width="44" height="26" rx="3"/><rect x="534" y="122" width="44" height="26" rx="3"/><rect x="390" y="152" width="44" height="26" rx="3"/><rect x="438" y="152" width="44" height="26" rx="3"/><rect x="486" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="44" height="26" rx="3"/><rect x="390" y="62" width="44" height="26" rx="3"/><rect x="150" y="92" width="44" height="26" rx="3"/><rect x="438" y="92" width="44" height="26" rx="3"/><rect x="294" y="122" width="44" height="26" rx="3"/><rect x="486" y="122" width="44" height="26" rx="3"/><rect x="342" y="152" width="44" height="26" rx="3"/><rect x="534" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="198" y="62" width="44" height="26" rx="3"/><rect x="246" y="92" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="79">A</text><text x="172" y="79">A</text><text x="220" y="79">A</text><text x="268" y="79">A</text><text x="316" y="79">A</text><text x="364" y="79">A</text><text x="412" y="79">E</text><text x="460" y="79">E</text><text x="508" y="79">E</text><text x="556" y="79">E</text><text x="172" y="109">B</text><text x="220" y="109">B</text><text x="268" y="109">B</text><text x="316" y="109">B</text><text x="364" y="109">B</text><text x="412" y="109">B</text><text x="460" y="109">F</text><text x="508" y="109">F</text><text x="556" y="109">F</text><text x="316" y="139">C</text><text x="364" y="139">C</text><text x="412" y="139">C</text><text x="460" y="139">C</text><text x="508" y="139">A</text><text x="556" y="139">A</text><text x="364" y="169">D</text><text x="412" y="169">D</text><text x="460" y="169">D</text><text x="508" y="169">D</text><text x="556" y="169">B</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="124" y="196" style="fill:var(--accent-red)">miss</text>
<text x="172" y="196" style="fill:var(--accent-red)">miss</text>
<text x="220" y="196" style="fill:var(--accent-green)">hit</text>
<text x="268" y="196" style="fill:var(--accent-green)">hit</text>
<text x="316" y="196" style="fill:var(--accent-red)">miss</text>
<text x="364" y="196" style="fill:var(--accent-red)">miss</text>
<text x="412" y="196" style="fill:var(--accent-red)">miss</text>
<text x="460" y="196" style="fill:var(--accent-red)">miss</text>
<text x="508" y="196" style="fill:var(--accent-red)">miss</text>
<text x="556" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="412" y="213">A</text>
<text x="460" y="213">B</text>
<text x="508" y="213">C</text>
<text x="556" y="213">D</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="230">A</text>
<text x="172" y="230">BA</text>
<text x="220" y="230">AB</text>
<text x="268" y="230">BA</text>
<text x="316" y="230">CBA</text>
<text x="364" y="230">DCBA</text>
<text x="412" y="230">EDCB</text>
<text x="460" y="230">FEDC</text>
<text x="508" y="230">AFED</text>
<text x="556" y="230">BAFE</text>
</g>
<text x="0" y="264" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 4 of 10 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="285" text-anchor="start">cycle</text>
<text x="124" y="285">0</text>
<text x="172" y="285">1</text>
<text x="220" y="285">2</text>
<text x="268" y="285">3</text>
<text x="316" y="285">4</text>
<text x="364" y="285">5</text>
<text x="412" y="285">6</text>
<text x="460" y="285">7</text>
<text x="508" y="285">8</text>
<text x="556" y="285">9</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="302" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="124" y="302">A</text>
<text x="172" y="302">B</text>
<text x="220" y="302">A</text>
<text x="268" y="302">B</text>
<text x="316" y="302">C</text>
<text x="364" y="302">D</text>
<text x="412" y="302">E</text>
<text x="460" y="302">F</text>
<text x="508" y="302">A</text>
<text x="556" y="302">B</text>
</g>
<text x="0" y="330" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="360" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="390" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="420" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="343" width="44" height="26" rx="3"/><rect x="102" y="373" width="44" height="26" rx="3"/><rect x="150" y="373" width="44" height="26" rx="3"/><rect x="198" y="373" width="44" height="26" rx="3"/><rect x="246" y="373" width="44" height="26" rx="3"/><rect x="102" y="403" width="44" height="26" rx="3"/><rect x="150" y="403" width="44" height="26" rx="3"/><rect x="198" y="403" width="44" height="26" rx="3"/><rect x="246" y="403" width="44" height="26" rx="3"/><rect x="294" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="150" y="313" width="44" height="26" rx="3"/><rect x="246" y="313" width="44" height="26" rx="3"/><rect x="294" y="313" width="44" height="26" rx="3"/><rect x="342" y="313" width="44" height="26" rx="3"/><rect x="390" y="313" width="44" height="26" rx="3"/><rect x="438" y="313" width="44" height="26" rx="3"/><rect x="534" y="313" width="44" height="26" rx="3"/><rect x="198" y="343" width="44" height="26" rx="3"/><rect x="294" y="343" width="44" height="26" rx="3"/><rect x="342" y="343" width="44" height="26" rx="3"/><rect x="390" y="343" width="44" height="26" rx="3"/><rect x="438" y="343" width="44" height="26" rx="3"/><rect x="486" y="343" width="44" height="26" rx="3"/><rect x="342" y="373" width="44" height="26" rx="3"/><rect x="438" y="373" width="44" height="26" rx="3"/><rect x="486" y="373" width="44" height="26" rx="3"/><rect x="534" y="373" width="44" height="26" rx="3"/><rect x="390" y="403" width="44" height="26" rx="3"/><rect x="486" y="403" width="44" height="26" rx="3"/><rect x="534" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="313" width="44" height="26" rx="3"/><rect x="150" y="343" width="44" height="26" rx="3"/><rect x="294" y="373" width="44" height="26" rx="3"/><rect x="390" y="373" width="44" height="26" rx="3"/><rect x="342" y="403" width="44" height="26" rx="3"/><rect x="438" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="198" y="313" width="44" height="26" rx="3"/><rect x="486" y="313" width="44" height="26" rx="3"/><rect x="246" y="343" width="44" height="26" rx="3"/><rect x="534" y="343" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.84" y="330">A</text><text x="165.84" y="330">A</text><text x="213.84" y="330">A</text><text x="261.84" y="330">A</text><text x="309.84" y="330">A</text><text x="357.84" y="330">A</text><text x="405.84" y="330">A</text><text x="453.84" y="330">A</text><text x="501.84" y="330">A</text><text x="549.84" y="330">A</text><text x="165.84" y="360">B</text><text x="213.84" y="360">B</text><text x="261.84" y="360">B</text><text x="309.84" y="360">B</text><text x="357.84" y="360">B</text><text x="405.84" y="360">B</text><text x="453.84" y="360">B</text><text x="501.84" y="360">B</text><text x="549.84" y="360">B</text><text x="309.84" y="390">C</text><text x="357.84" y="390">C</text><text x="405.84" y="390">E</text><text x="453.84" y="390">E</text><text x="501.84" y="390">E</text><text x="549.84" y="390">E</text><text x="357.84" y="420">D</text><text x="405.84" y="420">D</text><text x="453.84" y="420">F</text><text x="501.84" y="420">F</text><text x="549.84" y="420">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="142" y="331">2</text><text x="190" y="331">2</text><text x="238" y="331">0</text><text x="286" y="331">0</text><text x="334" y="331">0</text><text x="382" y="331">0</text><text x="430" y="331">1</text><text x="478" y="331">1</text><text x="526" y="331">0</text><text x="574" y="331">0</text><text x="190" y="361">2</text><text x="238" y="361">2</text><text x="286" y="361">0</text><text x="334" y="361">0</text><text x="382" y="361">0</text><text x="430" y="361">1</text><text x="478" y="361">1</text><text x="526" y="361">1</text><text x="574" y="361">0</text><text x="334" y="391">2</text><text x="382" y="391">2</text><text x="430" y="391">2</text><text x="478" y="391">2</text><text x="526" y="391">2</text><text x="574" y="391">2</text><text x="382" y="421">2</text><text x="430" y="421">3</text><text x="478" y="421">2</text><text x="526" y="421">2</text><text x="574" y="421">2</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="447" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="124" y="447" style="fill:var(--accent-red)">miss</text>
<text x="172" y="447" style="fill:var(--accent-red)">miss</text>
<text x="220" y="447" style="fill:var(--accent-green)">hit</text>
<text x="268" y="447" style="fill:var(--accent-green)">hit</text>
<text x="316" y="447" style="fill:var(--accent-red)">miss</text>
<text x="364" y="447" style="fill:var(--accent-red)">miss</text>
<text x="412" y="447" style="fill:var(--accent-red)">miss</text>
<text x="460" y="447" style="fill:var(--accent-red)">miss</text>
<text x="508" y="447" style="fill:var(--accent-green)">hit</text>
<text x="556" y="447" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="464" text-anchor="start">evicts</text>
<text x="412" y="464">C</text>
<text x="460" y="464">D</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="479" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="489">filled on a miss</text>
<rect x="136" y="479" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="489">hit</text>
<text x="194" y="489">small number = RRPV</text>
</g>
</svg></div>

<h3 id="sec-brrip">Bimodal RRIP (BRRIP)</h3>
<p><strong>Why it's used.</strong> SRRIP still thrashes on a loop larger than the cache. Every line goes in at the same RRPV and none is reused in time, so SRRIP behaves like FIFO. BRRIP is RRIP's version of BIP: it makes almost every new line the first to go, so the lines already in the set stay long enough to hit.</p>
<p><strong>How it works.</strong> Insert at RRPV 3 (distant) most of the time, and at RRPV 2 with a small probability (1/32). Hits and eviction work as in SRRIP. The occasional RRPV 2 insertion lets a new working set get in after a phase change.</p>
<p><strong>Example.</strong> The six-line loop under both. The 1-in-32 insertion at RRPV 2 doesn't occur in these 12 accesses. Under BRRIP, E, F, and A take turns in way 0, while B, C, and D stay and hit:</p>
<div class="tbl"><svg viewBox="0 0 680 480" role="img" aria-label="Thrashing on the cyclic sequence A B C D E F A B C D E F. SRRIP inserts every line at RRPV 2, behaves like FIFO here, and gets 0 hits. BRRIP inserts at RRPV 3, so E, F, and A take turns in way 0 while B, C, and D stay and hit at cycles 7, 8, and 9: 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 0 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">E</text><text x="352.48" y="79">E</text><text x="399.48" y="79">E</text><text x="446.48" y="79">E</text><text x="493.48" y="79">C</text><text x="540.48" y="79">C</text><text x="587.48" y="79">C</text><text x="634.48" y="79">C</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">F</text><text x="399.48" y="109">F</text><text x="446.48" y="109">F</text><text x="493.48" y="109">F</text><text x="540.48" y="109">D</text><text x="587.48" y="109">D</text><text x="634.48" y="109">D</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">A</text><text x="446.48" y="139">A</text><text x="493.48" y="139">A</text><text x="540.48" y="139">A</text><text x="587.48" y="139">E</text><text x="634.48" y="139">E</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">B</text><text x="493.48" y="169">B</text><text x="540.48" y="169">B</text><text x="587.48" y="169">B</text><text x="634.48" y="169">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">2</text><text x="188" y="80">2</text><text x="235" y="80">2</text><text x="282" y="80">2</text><text x="329" y="80">2</text><text x="376" y="80">2</text><text x="423" y="80">2</text><text x="470" y="80">2</text><text x="517" y="80">2</text><text x="564" y="80">2</text><text x="611" y="80">2</text><text x="658" y="80">2</text><text x="188" y="110">2</text><text x="235" y="110">2</text><text x="282" y="110">2</text><text x="329" y="110">3</text><text x="376" y="110">2</text><text x="423" y="110">2</text><text x="470" y="110">2</text><text x="517" y="110">3</text><text x="564" y="110">2</text><text x="611" y="110">2</text><text x="658" y="110">2</text><text x="235" y="140">2</text><text x="282" y="140">2</text><text x="329" y="140">3</text><text x="376" y="140">3</text><text x="423" y="140">2</text><text x="470" y="140">2</text><text x="517" y="140">3</text><text x="564" y="140">3</text><text x="611" y="140">2</text><text x="658" y="140">2</text><text x="282" y="170">2</text><text x="329" y="170">3</text><text x="376" y="170">3</text><text x="423" y="170">3</text><text x="470" y="170">2</text><text x="517" y="170">3</text><text x="564" y="170">3</text><text x="611" y="170">3</text><text x="658" y="170">2</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">A</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="499.5" y="213">E</text>
<text x="546.5" y="213">F</text>
<text x="593.5" y="213">A</text>
<text x="640.5" y="213">B</text>
</g>
<text x="0" y="247" style="fill:var(--ink);font-size:13px;font-weight:600">BRRIP: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="268" text-anchor="start">cycle</text>
<text x="123.5" y="268">0</text>
<text x="170.5" y="268">1</text>
<text x="217.5" y="268">2</text>
<text x="264.5" y="268">3</text>
<text x="311.5" y="268">4</text>
<text x="358.5" y="268">5</text>
<text x="405.5" y="268">6</text>
<text x="452.5" y="268">7</text>
<text x="499.5" y="268">8</text>
<text x="546.5" y="268">9</text>
<text x="593.5" y="268">10</text>
<text x="640.5" y="268">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="285" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="285">A</text>
<text x="170.5" y="285">B</text>
<text x="217.5" y="285">C</text>
<text x="264.5" y="285">D</text>
<text x="311.5" y="285">E</text>
<text x="358.5" y="285">F</text>
<text x="405.5" y="285">A</text>
<text x="452.5" y="285">B</text>
<text x="499.5" y="285">C</text>
<text x="546.5" y="285">D</text>
<text x="593.5" y="285">E</text>
<text x="640.5" y="285">F</text>
</g>
<text x="0" y="313" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="326" width="43" height="26" rx="3"/><rect x="102" y="356" width="43" height="26" rx="3"/><rect x="149" y="356" width="43" height="26" rx="3"/><rect x="102" y="386" width="43" height="26" rx="3"/><rect x="149" y="386" width="43" height="26" rx="3"/><rect x="196" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="296" width="43" height="26" rx="3"/><rect x="196" y="296" width="43" height="26" rx="3"/><rect x="243" y="296" width="43" height="26" rx="3"/><rect x="431" y="296" width="43" height="26" rx="3"/><rect x="478" y="296" width="43" height="26" rx="3"/><rect x="525" y="296" width="43" height="26" rx="3"/><rect x="196" y="326" width="43" height="26" rx="3"/><rect x="243" y="326" width="43" height="26" rx="3"/><rect x="290" y="326" width="43" height="26" rx="3"/><rect x="337" y="326" width="43" height="26" rx="3"/><rect x="384" y="326" width="43" height="26" rx="3"/><rect x="478" y="326" width="43" height="26" rx="3"/><rect x="525" y="326" width="43" height="26" rx="3"/><rect x="572" y="326" width="43" height="26" rx="3"/><rect x="619" y="326" width="43" height="26" rx="3"/><rect x="243" y="356" width="43" height="26" rx="3"/><rect x="290" y="356" width="43" height="26" rx="3"/><rect x="337" y="356" width="43" height="26" rx="3"/><rect x="384" y="356" width="43" height="26" rx="3"/><rect x="431" y="356" width="43" height="26" rx="3"/><rect x="525" y="356" width="43" height="26" rx="3"/><rect x="572" y="356" width="43" height="26" rx="3"/><rect x="619" y="356" width="43" height="26" rx="3"/><rect x="290" y="386" width="43" height="26" rx="3"/><rect x="337" y="386" width="43" height="26" rx="3"/><rect x="384" y="386" width="43" height="26" rx="3"/><rect x="431" y="386" width="43" height="26" rx="3"/><rect x="478" y="386" width="43" height="26" rx="3"/><rect x="572" y="386" width="43" height="26" rx="3"/><rect x="619" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="296" width="43" height="26" rx="3"/><rect x="290" y="296" width="43" height="26" rx="3"/><rect x="337" y="296" width="43" height="26" rx="3"/><rect x="384" y="296" width="43" height="26" rx="3"/><rect x="572" y="296" width="43" height="26" rx="3"/><rect x="619" y="296" width="43" height="26" rx="3"/><rect x="149" y="326" width="43" height="26" rx="3"/><rect x="196" y="356" width="43" height="26" rx="3"/><rect x="243" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="431" y="326" width="43" height="26" rx="3"/><rect x="478" y="356" width="43" height="26" rx="3"/><rect x="525" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="313">A</text><text x="164.48" y="313">A</text><text x="211.48" y="313">A</text><text x="258.48" y="313">A</text><text x="305.48" y="313">E</text><text x="352.48" y="313">F</text><text x="399.48" y="313">A</text><text x="446.48" y="313">A</text><text x="493.48" y="313">A</text><text x="540.48" y="313">A</text><text x="587.48" y="313">E</text><text x="634.48" y="313">F</text><text x="164.48" y="343">B</text><text x="211.48" y="343">B</text><text x="258.48" y="343">B</text><text x="305.48" y="343">B</text><text x="352.48" y="343">B</text><text x="399.48" y="343">B</text><text x="446.48" y="343">B</text><text x="493.48" y="343">B</text><text x="540.48" y="343">B</text><text x="587.48" y="343">B</text><text x="634.48" y="343">B</text><text x="211.48" y="373">C</text><text x="258.48" y="373">C</text><text x="305.48" y="373">C</text><text x="352.48" y="373">C</text><text x="399.48" y="373">C</text><text x="446.48" y="373">C</text><text x="493.48" y="373">C</text><text x="540.48" y="373">C</text><text x="587.48" y="373">C</text><text x="634.48" y="373">C</text><text x="258.48" y="403">D</text><text x="305.48" y="403">D</text><text x="352.48" y="403">D</text><text x="399.48" y="403">D</text><text x="446.48" y="403">D</text><text x="493.48" y="403">D</text><text x="540.48" y="403">D</text><text x="587.48" y="403">D</text><text x="634.48" y="403">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="314">3</text><text x="188" y="314">3</text><text x="235" y="314">3</text><text x="282" y="314">3</text><text x="329" y="314">3</text><text x="376" y="314">3</text><text x="423" y="314">3</text><text x="470" y="314">3</text><text x="517" y="314">3</text><text x="564" y="314">3</text><text x="611" y="314">3</text><text x="658" y="314">3</text><text x="188" y="344">3</text><text x="235" y="344">3</text><text x="282" y="344">3</text><text x="329" y="344">3</text><text x="376" y="344">3</text><text x="423" y="344">3</text><text x="470" y="344">0</text><text x="517" y="344">0</text><text x="564" y="344">0</text><text x="611" y="344">0</text><text x="658" y="344">0</text><text x="235" y="374">3</text><text x="282" y="374">3</text><text x="329" y="374">3</text><text x="376" y="374">3</text><text x="423" y="374">3</text><text x="470" y="374">3</text><text x="517" y="374">0</text><text x="564" y="374">0</text><text x="611" y="374">0</text><text x="658" y="374">0</text><text x="282" y="404">3</text><text x="329" y="404">3</text><text x="376" y="404">3</text><text x="423" y="404">3</text><text x="470" y="404">3</text><text x="517" y="404">3</text><text x="564" y="404">0</text><text x="611" y="404">0</text><text x="658" y="404">0</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="430" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="593.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="430" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="447" text-anchor="start">evicts</text>
<text x="311.5" y="447">A</text>
<text x="358.5" y="447">E</text>
<text x="405.5" y="447">F</text>
<text x="593.5" y="447">A</text>
<text x="640.5" y="447">E</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="462" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="472">filled on a miss</text>
<rect x="136" y="462" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="472">hit</text>
<text x="194" y="472">small number = RRPV</text>
</g>
</svg></div>

<h3 id="sec-drrip">Dynamic RRIP (DRRIP)</h3>
<p><strong>Why it's used.</strong> SRRIP handles scans and BRRIP handles thrashing, and real programs move between the two. DRRIP chooses with set dueling, as DIP does, for 2 bits per line plus one counter. Reverse engineering of Intel's L3 from Ivy Bridge onward found adaptive replacement with set dueling between two policies, the same structure as DRRIP.</p>
<p><strong>How it works.</strong> 32 leader sets use SRRIP and 32 use BRRIP. A miss in an SRRIP leader increments the 10-bit PSEL, and a miss in a BRRIP leader decrements it. Follower sets insert with BRRIP when PSEL's MSB is 1 and with SRRIP otherwise.</p>
<p><strong>Example.</strong> A program alternates between a hot working set with scans and a loop larger than the LLC. In the first phase the BRRIP leaders miss more, because they insert reused lines at RRPV 3, so PSEL falls and followers use SRRIP. In the loop phase the SRRIP leaders thrash, PSEL climbs past 512, and followers switch to BRRIP:</p>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="An illustrative trace of DRRIP's PSEL counter over 10 million LLC accesses. In phase 1, a hot working set plus scans, the BRRIP leader sets miss more, so PSEL falls toward 0 and followers use SRRIP. In phase 2, a loop larger than the LLC, the SRRIP leader sets thrash, so PSEL climbs above 512 and followers switch to BRRIP. When phase 1 returns, PSEL falls back below 512 and followers return to SRRIP." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">PSEL over one run (illustrative)</text>
<rect x="70" y="40" width="224" height="160" style="fill:var(--pad-soft);stroke:none"/><text x="182" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 1: hot set plus scans</text>
<rect x="294" y="40" width="224" height="160" style="fill:var(--trace-soft);stroke:none"/><text x="406" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 2: loop larger than the LLC</text>
<rect x="518" y="40" width="112" height="160" style="fill:var(--pad-soft);stroke:none"/><text x="574" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 1 again</text>
<path d="M70,119.92179863147605 H630" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3"/>
<path d="M70,200 H630 M70,200 V40" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<polyline points="70.0,119.9 103.6,153.1 148.4,179.7 182.0,185.9 226.8,189.1 266.0,187.5 294.0,185.9 316.4,153.1 344.4,106.2 378.0,63.9 434.0,49.9 490.0,46.7 518.0,48.3 540.4,90.5 568.4,134.3 596.4,165.6 630.0,178.1" style="fill:none;stroke:var(--ink);stroke-width:2"/>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="64" y="204">0</text><text x="64" y="123.92179863147605">512</text><text x="64" y="44">1023</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="70" y="214">0</text><text x="182" y="214">2</text><text x="294" y="214">4</text><text x="406" y="214">6</text><text x="518" y="214">8</text><text x="630" y="214">10</text></g>
<text x="350" y="230" text-anchor="middle" style="fill:var(--muted);font-size:11px">LLC accesses (millions)</text>
<text x="182" y="141.92179863147607" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">followers use SRRIP</text>
<text x="406" y="159.92179863147607" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">followers use BRRIP</text>
<text x="634" y="123.92179863147605" style="fill:var(--muted);font-size:10px">MSB flips</text>
</svg></div>

<h3 id="sec-ship">Signature-Based Hit Prediction (SHiP)</h3>
<p><strong>Why it's used.</strong> RRIP gives every new line the same prediction, but whether a line is reused depends heavily on the instruction that brought it in. A streaming loop's load never sees reuse, and a lookup into a small hot table almost always does. SHiP (Wu, Jaleel, Hasenplaugh, Martonosi, Steely, and Emer, MICRO 2011) learns reuse per signature, usually a hash of the load's PC, and uses it to set the insertion RRPV.</p>
<p><strong>How it works.</strong> It runs on top of SRRIP.</p>
<ul>
<li><strong>Per line:</strong> the 14-bit signature that filled it and an outcome bit, cleared on fill.</li>
<li><strong>Signature History Counter Table (SHCT):</strong> 16K 3-bit saturating counters, indexed by signature.</li>
<li><strong>Hit:</strong> set the line's outcome bit and increment SHCT[signature].</li>
<li><strong>Eviction of a line whose outcome bit is still 0:</strong> decrement SHCT[signature].</li>
<li><strong>Fill:</strong> if SHCT[signature] is 0, insert at RRPV 3, otherwise at RRPV 2.</li>
</ul>
<p><strong>Example.</strong> PC P1 loads the hot lines A and B. PC P2 runs a seven-line scan. For brevity, both counters start at 1. Under SRRIP the scan is long enough to age A and B to RRPV 3, and they're evicted at cycles 10 and 11. Under SHiP, C is evicted at cycle 6 without being reused, which drops P2's counter to 0. Every later P2 line goes in at RRPV 3 and is replaced in way 2, so A and B are never threatened:</p>
<div class="tbl"><svg viewBox="0 0 680 544" role="img" aria-label="SHiP against SRRIP. PC P1 loads hot lines A and B, which are reused. PC P2 runs a 7-line scan, C through I. Under SRRIP the scan ages A and B to RRPV 3 and evicts them at cycles 10 and 11, so A and B miss at the end: 2 of 13 hits. Under SHiP, C is evicted without reuse at cycle 6, which drops P2's counter to 0. Every later P2 line is inserted at RRPV 3 and replaced in way 2, so A and B hit at the end: 4 of 13 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 2 of 13 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="122" y="34">0</text>
<text x="166" y="34">1</text>
<text x="210" y="34">2</text>
<text x="254" y="34">3</text>
<text x="298" y="34">4</text>
<text x="342" y="34">5</text>
<text x="386" y="34">6</text>
<text x="430" y="34">7</text>
<text x="474" y="34">8</text>
<text x="518" y="34">9</text>
<text x="562" y="34">10</text>
<text x="606" y="34">11</text>
<text x="650" y="34">12</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="122" y="51">A</text>
<text x="166" y="51">B</text>
<text x="210" y="51">A</text>
<text x="254" y="51">B</text>
<text x="298" y="51">C</text>
<text x="342" y="51">D</text>
<text x="386" y="51">E</text>
<text x="430" y="51">F</text>
<text x="474" y="51">G</text>
<text x="518" y="51">H</text>
<text x="562" y="51">I</text>
<text x="606" y="51">A</text>
<text x="650" y="51">B</text>
</g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="66" text-anchor="start">load PC</text>
<text x="122" y="66">P1</text>
<text x="166" y="66">P1</text>
<text x="210" y="66">P1</text>
<text x="254" y="66">P1</text>
<text x="298" y="66">P2</text>
<text x="342" y="66">P2</text>
<text x="386" y="66">P2</text>
<text x="430" y="66">P2</text>
<text x="474" y="66">P2</text>
<text x="518" y="66">P2</text>
<text x="562" y="66">P2</text>
<text x="606" y="66">P1</text>
<text x="650" y="66">P1</text>
</g>
<text x="0" y="94" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="124" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="154" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="184" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="107" width="40" height="26" rx="3"/><rect x="102" y="137" width="40" height="26" rx="3"/><rect x="146" y="137" width="40" height="26" rx="3"/><rect x="190" y="137" width="40" height="26" rx="3"/><rect x="234" y="137" width="40" height="26" rx="3"/><rect x="102" y="167" width="40" height="26" rx="3"/><rect x="146" y="167" width="40" height="26" rx="3"/><rect x="190" y="167" width="40" height="26" rx="3"/><rect x="234" y="167" width="40" height="26" rx="3"/><rect x="278" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="146" y="77" width="40" height="26" rx="3"/><rect x="234" y="77" width="40" height="26" rx="3"/><rect x="278" y="77" width="40" height="26" rx="3"/><rect x="322" y="77" width="40" height="26" rx="3"/><rect x="366" y="77" width="40" height="26" rx="3"/><rect x="410" y="77" width="40" height="26" rx="3"/><rect x="454" y="77" width="40" height="26" rx="3"/><rect x="498" y="77" width="40" height="26" rx="3"/><rect x="586" y="77" width="40" height="26" rx="3"/><rect x="630" y="77" width="40" height="26" rx="3"/><rect x="190" y="107" width="40" height="26" rx="3"/><rect x="278" y="107" width="40" height="26" rx="3"/><rect x="322" y="107" width="40" height="26" rx="3"/><rect x="366" y="107" width="40" height="26" rx="3"/><rect x="410" y="107" width="40" height="26" rx="3"/><rect x="454" y="107" width="40" height="26" rx="3"/><rect x="498" y="107" width="40" height="26" rx="3"/><rect x="542" y="107" width="40" height="26" rx="3"/><rect x="630" y="107" width="40" height="26" rx="3"/><rect x="322" y="137" width="40" height="26" rx="3"/><rect x="410" y="137" width="40" height="26" rx="3"/><rect x="498" y="137" width="40" height="26" rx="3"/><rect x="542" y="137" width="40" height="26" rx="3"/><rect x="586" y="137" width="40" height="26" rx="3"/><rect x="366" y="167" width="40" height="26" rx="3"/><rect x="454" y="167" width="40" height="26" rx="3"/><rect x="542" y="167" width="40" height="26" rx="3"/><rect x="586" y="167" width="40" height="26" rx="3"/><rect x="630" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="77" width="40" height="26" rx="3"/><rect x="542" y="77" width="40" height="26" rx="3"/><rect x="146" y="107" width="40" height="26" rx="3"/><rect x="586" y="107" width="40" height="26" rx="3"/><rect x="278" y="137" width="40" height="26" rx="3"/><rect x="366" y="137" width="40" height="26" rx="3"/><rect x="454" y="137" width="40" height="26" rx="3"/><rect x="630" y="137" width="40" height="26" rx="3"/><rect x="322" y="167" width="40" height="26" rx="3"/><rect x="410" y="167" width="40" height="26" rx="3"/><rect x="498" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="190" y="77" width="40" height="26" rx="3"/><rect x="234" y="107" width="40" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="116.4" y="94">A</text><text x="160.4" y="94">A</text><text x="204.4" y="94">A</text><text x="248.4" y="94">A</text><text x="292.4" y="94">A</text><text x="336.4" y="94">A</text><text x="380.4" y="94">A</text><text x="424.4" y="94">A</text><text x="468.4" y="94">A</text><text x="512.4" y="94">A</text><text x="556.4" y="94">I</text><text x="600.4" y="94">I</text><text x="644.4" y="94">I</text><text x="160.4" y="124">B</text><text x="204.4" y="124">B</text><text x="248.4" y="124">B</text><text x="292.4" y="124">B</text><text x="336.4" y="124">B</text><text x="380.4" y="124">B</text><text x="424.4" y="124">B</text><text x="468.4" y="124">B</text><text x="512.4" y="124">B</text><text x="556.4" y="124">B</text><text x="600.4" y="124">A</text><text x="644.4" y="124">A</text><text x="292.4" y="154">C</text><text x="336.4" y="154">C</text><text x="380.4" y="154">E</text><text x="424.4" y="154">E</text><text x="468.4" y="154">G</text><text x="512.4" y="154">G</text><text x="556.4" y="154">G</text><text x="600.4" y="154">G</text><text x="644.4" y="154">B</text><text x="336.4" y="184">D</text><text x="380.4" y="184">D</text><text x="424.4" y="184">F</text><text x="468.4" y="184">F</text><text x="512.4" y="184">H</text><text x="556.4" y="184">H</text><text x="600.4" y="184">H</text><text x="644.4" y="184">H</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="138" y="95">2</text><text x="182" y="95">2</text><text x="226" y="95">0</text><text x="270" y="95">0</text><text x="314" y="95">0</text><text x="358" y="95">0</text><text x="402" y="95">1</text><text x="446" y="95">1</text><text x="490" y="95">2</text><text x="534" y="95">2</text><text x="578" y="95">2</text><text x="622" y="95">2</text><text x="666" y="95">2</text><text x="182" y="125">2</text><text x="226" y="125">2</text><text x="270" y="125">0</text><text x="314" y="125">0</text><text x="358" y="125">0</text><text x="402" y="125">1</text><text x="446" y="125">1</text><text x="490" y="125">2</text><text x="534" y="125">2</text><text x="578" y="125">3</text><text x="622" y="125">2</text><text x="666" y="125">2</text><text x="314" y="155">2</text><text x="358" y="155">2</text><text x="402" y="155">2</text><text x="446" y="155">2</text><text x="490" y="155">2</text><text x="534" y="155">2</text><text x="578" y="155">3</text><text x="622" y="155">3</text><text x="666" y="155">2</text><text x="358" y="185">2</text><text x="402" y="185">3</text><text x="446" y="185">2</text><text x="490" y="185">3</text><text x="534" y="185">2</text><text x="578" y="185">3</text><text x="622" y="185">3</text><text x="666" y="185">3</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="211" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="122" y="211" style="fill:var(--accent-red)">miss</text>
<text x="166" y="211" style="fill:var(--accent-red)">miss</text>
<text x="210" y="211" style="fill:var(--accent-green)">hit</text>
<text x="254" y="211" style="fill:var(--accent-green)">hit</text>
<text x="298" y="211" style="fill:var(--accent-red)">miss</text>
<text x="342" y="211" style="fill:var(--accent-red)">miss</text>
<text x="386" y="211" style="fill:var(--accent-red)">miss</text>
<text x="430" y="211" style="fill:var(--accent-red)">miss</text>
<text x="474" y="211" style="fill:var(--accent-red)">miss</text>
<text x="518" y="211" style="fill:var(--accent-red)">miss</text>
<text x="562" y="211" style="fill:var(--accent-red)">miss</text>
<text x="606" y="211" style="fill:var(--accent-red)">miss</text>
<text x="650" y="211" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="228" text-anchor="start">evicts</text>
<text x="386" y="228">C</text>
<text x="430" y="228">D</text>
<text x="474" y="228">E</text>
<text x="518" y="228">F</text>
<text x="562" y="228">A</text>
<text x="606" y="228">B</text>
<text x="650" y="228">G</text>
</g>
<text x="0" y="262" style="fill:var(--ink);font-size:13px;font-weight:600">SHiP: 4 of 13 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="283" text-anchor="start">cycle</text>
<text x="122" y="283">0</text>
<text x="166" y="283">1</text>
<text x="210" y="283">2</text>
<text x="254" y="283">3</text>
<text x="298" y="283">4</text>
<text x="342" y="283">5</text>
<text x="386" y="283">6</text>
<text x="430" y="283">7</text>
<text x="474" y="283">8</text>
<text x="518" y="283">9</text>
<text x="562" y="283">10</text>
<text x="606" y="283">11</text>
<text x="650" y="283">12</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="300" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="122" y="300">A</text>
<text x="166" y="300">B</text>
<text x="210" y="300">A</text>
<text x="254" y="300">B</text>
<text x="298" y="300">C</text>
<text x="342" y="300">D</text>
<text x="386" y="300">E</text>
<text x="430" y="300">F</text>
<text x="474" y="300">G</text>
<text x="518" y="300">H</text>
<text x="562" y="300">I</text>
<text x="606" y="300">A</text>
<text x="650" y="300">B</text>
</g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="315" text-anchor="start">load PC</text>
<text x="122" y="315">P1</text>
<text x="166" y="315">P1</text>
<text x="210" y="315">P1</text>
<text x="254" y="315">P1</text>
<text x="298" y="315">P2</text>
<text x="342" y="315">P2</text>
<text x="386" y="315">P2</text>
<text x="430" y="315">P2</text>
<text x="474" y="315">P2</text>
<text x="518" y="315">P2</text>
<text x="562" y="315">P2</text>
<text x="606" y="315">P1</text>
<text x="650" y="315">P1</text>
</g>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="433" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="356" width="40" height="26" rx="3"/><rect x="102" y="386" width="40" height="26" rx="3"/><rect x="146" y="386" width="40" height="26" rx="3"/><rect x="190" y="386" width="40" height="26" rx="3"/><rect x="234" y="386" width="40" height="26" rx="3"/><rect x="102" y="416" width="40" height="26" rx="3"/><rect x="146" y="416" width="40" height="26" rx="3"/><rect x="190" y="416" width="40" height="26" rx="3"/><rect x="234" y="416" width="40" height="26" rx="3"/><rect x="278" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="146" y="326" width="40" height="26" rx="3"/><rect x="234" y="326" width="40" height="26" rx="3"/><rect x="278" y="326" width="40" height="26" rx="3"/><rect x="322" y="326" width="40" height="26" rx="3"/><rect x="366" y="326" width="40" height="26" rx="3"/><rect x="410" y="326" width="40" height="26" rx="3"/><rect x="454" y="326" width="40" height="26" rx="3"/><rect x="498" y="326" width="40" height="26" rx="3"/><rect x="542" y="326" width="40" height="26" rx="3"/><rect x="630" y="326" width="40" height="26" rx="3"/><rect x="190" y="356" width="40" height="26" rx="3"/><rect x="278" y="356" width="40" height="26" rx="3"/><rect x="322" y="356" width="40" height="26" rx="3"/><rect x="366" y="356" width="40" height="26" rx="3"/><rect x="410" y="356" width="40" height="26" rx="3"/><rect x="454" y="356" width="40" height="26" rx="3"/><rect x="498" y="356" width="40" height="26" rx="3"/><rect x="542" y="356" width="40" height="26" rx="3"/><rect x="586" y="356" width="40" height="26" rx="3"/><rect x="322" y="386" width="40" height="26" rx="3"/><rect x="586" y="386" width="40" height="26" rx="3"/><rect x="630" y="386" width="40" height="26" rx="3"/><rect x="366" y="416" width="40" height="26" rx="3"/><rect x="410" y="416" width="40" height="26" rx="3"/><rect x="454" y="416" width="40" height="26" rx="3"/><rect x="498" y="416" width="40" height="26" rx="3"/><rect x="542" y="416" width="40" height="26" rx="3"/><rect x="586" y="416" width="40" height="26" rx="3"/><rect x="630" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="326" width="40" height="26" rx="3"/><rect x="146" y="356" width="40" height="26" rx="3"/><rect x="278" y="386" width="40" height="26" rx="3"/><rect x="366" y="386" width="40" height="26" rx="3"/><rect x="410" y="386" width="40" height="26" rx="3"/><rect x="454" y="386" width="40" height="26" rx="3"/><rect x="498" y="386" width="40" height="26" rx="3"/><rect x="542" y="386" width="40" height="26" rx="3"/><rect x="322" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="190" y="326" width="40" height="26" rx="3"/><rect x="586" y="326" width="40" height="26" rx="3"/><rect x="234" y="356" width="40" height="26" rx="3"/><rect x="630" y="356" width="40" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="116.4" y="343">A</text><text x="160.4" y="343">A</text><text x="204.4" y="343">A</text><text x="248.4" y="343">A</text><text x="292.4" y="343">A</text><text x="336.4" y="343">A</text><text x="380.4" y="343">A</text><text x="424.4" y="343">A</text><text x="468.4" y="343">A</text><text x="512.4" y="343">A</text><text x="556.4" y="343">A</text><text x="600.4" y="343">A</text><text x="644.4" y="343">A</text><text x="160.4" y="373">B</text><text x="204.4" y="373">B</text><text x="248.4" y="373">B</text><text x="292.4" y="373">B</text><text x="336.4" y="373">B</text><text x="380.4" y="373">B</text><text x="424.4" y="373">B</text><text x="468.4" y="373">B</text><text x="512.4" y="373">B</text><text x="556.4" y="373">B</text><text x="600.4" y="373">B</text><text x="644.4" y="373">B</text><text x="292.4" y="403">C</text><text x="336.4" y="403">C</text><text x="380.4" y="403">E</text><text x="424.4" y="403">F</text><text x="468.4" y="403">G</text><text x="512.4" y="403">H</text><text x="556.4" y="403">I</text><text x="600.4" y="403">I</text><text x="644.4" y="403">I</text><text x="336.4" y="433">D</text><text x="380.4" y="433">D</text><text x="424.4" y="433">D</text><text x="468.4" y="433">D</text><text x="512.4" y="433">D</text><text x="556.4" y="433">D</text><text x="600.4" y="433">D</text><text x="644.4" y="433">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="138" y="344">2</text><text x="182" y="344">2</text><text x="226" y="344">0</text><text x="270" y="344">0</text><text x="314" y="344">0</text><text x="358" y="344">0</text><text x="402" y="344">1</text><text x="446" y="344">1</text><text x="490" y="344">1</text><text x="534" y="344">1</text><text x="578" y="344">1</text><text x="622" y="344">0</text><text x="666" y="344">0</text><text x="182" y="374">2</text><text x="226" y="374">2</text><text x="270" y="374">0</text><text x="314" y="374">0</text><text x="358" y="374">0</text><text x="402" y="374">1</text><text x="446" y="374">1</text><text x="490" y="374">1</text><text x="534" y="374">1</text><text x="578" y="374">1</text><text x="622" y="374">1</text><text x="666" y="374">0</text><text x="314" y="404">2</text><text x="358" y="404">2</text><text x="402" y="404">3</text><text x="446" y="404">3</text><text x="490" y="404">3</text><text x="534" y="404">3</text><text x="578" y="404">3</text><text x="622" y="404">3</text><text x="666" y="404">3</text><text x="358" y="434">2</text><text x="402" y="434">3</text><text x="446" y="434">3</text><text x="490" y="434">3</text><text x="534" y="434">3</text><text x="578" y="434">3</text><text x="622" y="434">3</text><text x="666" y="434">3</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="460" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="122" y="460" style="fill:var(--accent-red)">miss</text>
<text x="166" y="460" style="fill:var(--accent-red)">miss</text>
<text x="210" y="460" style="fill:var(--accent-green)">hit</text>
<text x="254" y="460" style="fill:var(--accent-green)">hit</text>
<text x="298" y="460" style="fill:var(--accent-red)">miss</text>
<text x="342" y="460" style="fill:var(--accent-red)">miss</text>
<text x="386" y="460" style="fill:var(--accent-red)">miss</text>
<text x="430" y="460" style="fill:var(--accent-red)">miss</text>
<text x="474" y="460" style="fill:var(--accent-red)">miss</text>
<text x="518" y="460" style="fill:var(--accent-red)">miss</text>
<text x="562" y="460" style="fill:var(--accent-red)">miss</text>
<text x="606" y="460" style="fill:var(--accent-green)">hit</text>
<text x="650" y="460" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="477" text-anchor="start">evicts</text>
<text x="386" y="477">C</text>
<text x="430" y="477">E</text>
<text x="474" y="477">F</text>
<text x="518" y="477">G</text>
<text x="562" y="477">H</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="494" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">SHCT[P1]</text>
<text x="122" y="494">1</text>
<text x="166" y="494">1</text>
<text x="210" y="494">2</text>
<text x="254" y="494">3</text>
<text x="298" y="494">3</text>
<text x="342" y="494">3</text>
<text x="386" y="494">3</text>
<text x="430" y="494">3</text>
<text x="474" y="494">3</text>
<text x="518" y="494">3</text>
<text x="562" y="494">3</text>
<text x="606" y="494">4</text>
<text x="650" y="494">5</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="511" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">SHCT[P2]</text>
<text x="122" y="511">1</text>
<text x="166" y="511">1</text>
<text x="210" y="511">1</text>
<text x="254" y="511">1</text>
<text x="298" y="511">1</text>
<text x="342" y="511">1</text>
<text x="386" y="511">0</text>
<text x="430" y="511">0</text>
<text x="474" y="511">0</text>
<text x="518" y="511">0</text>
<text x="562" y="511">0</text>
<text x="606" y="511">0</text>
<text x="650" y="511">0</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="526" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="536">filled on a miss</text>
<rect x="136" y="526" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="536">hit</text>
<text x="194" y="536">small number = RRPV</text>
</g>
</svg></div>

<h3 id="sec-hawkeye">Hawkeye</h3>
<p><strong>Why it's used.</strong> The other policies guess what makes a line worth keeping. Hawkeye (Jain and Lin, ISCA 2016) asks what OPT would have done on recent accesses and learns which load PCs bring in lines that OPT keeps. It's the basis for later learned policies: Glider (MICRO 2019) adds a better offline-trained predictor, and Mockingjay (HPCA 2022) predicts reuse distances to mimic OPT's eviction order directly.</p>
<p><strong>How it works.</strong></p>
<ol>
<li><strong>OPTgen:</strong> for a small sample of sets, keep a history of past accesses about 8 times as long as the associativity. An occupancy vector holds one count per past time slot: how many lines OPT keeps cached across that slot. When a line is reused, look at the interval since its last access. If every slot is below capacity, OPT would have kept it, so OPT hits and every slot in the interval goes up by 1. If any slot is already full, OPT would have missed.</li>
<li><strong>Predictor:</strong> 3-bit counters indexed by a hash of the PC that last accessed the line. An OPT hit trains that PC up, and an OPT miss trains it down.</li>
<li><strong>Cache:</strong> on a fill or a hit, the predictor classifies the PC. Lines from cache-friendly PCs get RRPV 0, and the other friendly lines in the set age by 1. Lines from cache-averse PCs get RRPV 7, the 3-bit maximum. The victim is a line at RRPV 7 if there is one. Otherwise it's the oldest friendly line, and its PC is trained down, because the prediction was wrong.</li>
</ol>
<p><strong>Example.</strong> OPTgen on one sampled set, with a capacity of 2 lines to keep the vector short. A and B come from P1, C and D from P2. At slot 6, C's interval from slot 2 crosses slot 2, where OPT is already keeping two lines (A and B), so OPT would not have kept C and P2 is trained down:</p>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="OPTgen on one sampled set with a capacity of 2 lines and the accesses A B C A D B C A at time slots 0 to 7. A and B come from PC P1, C and D from PC P2. Each slot of the occupancy vector counts how many lines OPT keeps cached across that slot. At slot 3, A's interval from slot 0 has every slot below 2, so OPT hits and slots 0 to 2 go up by 1, training P1 up. At slot 5, B's interval from slot 1 fits, so OPT hits and P1 trains up again. At slot 6, C's interval from slot 2 includes a slot already at 2, so OPT misses and P2 trains down. At slot 7, A's interval from slot 3 fits, so OPT hits and P1 trains up." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">OPTgen on one sampled set, capacity 2 lines</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="0" y="34" text-anchor="start">time slot</text><text x="139" y="34">0</text><text x="177" y="34">1</text><text x="215" y="34">2</text><text x="253" y="34">3</text><text x="291" y="34">4</text><text x="329" y="34">5</text><text x="367" y="34">6</text><text x="405" y="34">7</text></g>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle"><text x="0" y="48" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access, PC</text><text x="139" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="177" y="48">B<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="215" y="48">C<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="253" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="291" y="48">D<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="329" y="48">B<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="367" y="48">C<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="405" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text></g>
<text x="0" y="74" style="fill:var(--muted);font-size:11px">after A at 0</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="74">0</text></g>
<text x="436" y="74" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="98" style="fill:var(--muted);font-size:11px">after B at 1</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="98">0</text><text x="177" y="98">0</text></g>
<text x="436" y="98" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="122" style="fill:var(--muted);font-size:11px">after C at 2</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="122">0</text><text x="177" y="122">0</text><text x="215" y="122">0</text></g>
<text x="436" y="122" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="146" style="fill:var(--muted);font-size:11px">after A at 3</text>
<rect x="121" y="131" width="112" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="146">1</text><text x="177" y="146">1</text><text x="215" y="146">1</text><text x="253" y="146">0</text></g>
<text x="436" y="146" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<text x="0" y="170" style="fill:var(--muted);font-size:11px">after D at 4</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="170">1</text><text x="177" y="170">1</text><text x="215" y="170">1</text><text x="253" y="170">0</text><text x="291" y="170">0</text></g>
<text x="436" y="170" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="194" style="fill:var(--muted);font-size:11px">after B at 5</text>
<rect x="159" y="179" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="194">1</text><text x="177" y="194">2</text><text x="215" y="194">2</text><text x="253" y="194">1</text><text x="291" y="194">1</text><text x="329" y="194">0</text></g>
<text x="436" y="194" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<text x="0" y="218" style="fill:var(--muted);font-size:11px">after C at 6</text>
<rect x="197" y="203" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-red);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="218">1</text><text x="177" y="218">2</text><text x="215" y="218">2</text><text x="253" y="218">1</text><text x="291" y="218">1</text><text x="329" y="218">0</text><text x="367" y="218">0</text></g>
<text x="436" y="218" style="fill:var(--accent-red);font-size:11px;font-weight:600">OPT miss: P2 − 1</text>
<text x="0" y="242" style="fill:var(--muted);font-size:11px">after A at 7</text>
<rect x="235" y="227" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="242">1</text><text x="177" y="242">2</text><text x="215" y="242">2</text><text x="253" y="242">2</text><text x="291" y="242">2</text><text x="329" y="242">1</text><text x="367" y="242">1</text><text x="405" y="242">0</text></g>
<text x="436" y="242" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<g style="fill:var(--muted);font-size:11px"><rect x="0" y="260" width="16" height="12" rx="2" style="fill:none;stroke:var(--accent-green);stroke-width:2"/><text x="22" y="270">interval fits (every slot below 2): OPT keeps the line, add 1 across it</text>
<rect x="0" y="278" width="16" height="12" rx="2" style="fill:none;stroke:var(--accent-red);stroke-width:2"/><text x="22" y="288">some slot already at 2: OPT would not have kept the line</text></g>
</svg></div>
<p>After this short history P1's counter has gone up three times and P2's down once, so lines loaded by P1 would be inserted as cache-friendly and lines from P2 as cache-averse.</p>

<h3>The Math</h3>
<ul>
<li><strong>True LRU state:</strong> log<sub>2</sub>(N!) bits per set at minimum: 8 ways → 16 bits, 16 ways → 45 bits. Practical implementations use more.</li>
<li><strong>Tree PLRU:</strong> N − 1 bits: 7 bits for 8 ways.</li>
<li><strong>RRIP:</strong> 2 bits per line: 16 bits for 8 ways.</li>
<li><strong>NRU:</strong> 1 bit per line: 8 bits for 8 ways.</li>
<li><strong>FIFO:</strong> a log<sub>2</sub>(N)-bit pointer per set: 3 bits for 8 ways.</li>
<li><strong>SHiP:</strong> RRIP's 2 bits plus a 14-bit signature and an outcome bit per line, and a 16K × 3-bit SHCT (6 KB).</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> can be worth as much as a sizeable capacity increase for thrashing or scanning workloads; zero for workloads that fit.</li><li><strong>Power:</strong> state updates on every hit; small next to data access.</li><li><strong>Area:</strong> a few bits per line or set, plus predictor tables for learned policies. Usually off the hit critical path.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No effect; everything fits.</td></tr>
<tr><td>Pointer chasing</td><td>Helps when the hot part of a large structure can be kept; random or RRIP beat LRU on cyclic traversals.</td></tr>
<tr><td>Streaming</td><td>Scans evict useful data under LRU; scan-resistant policies (BIP, RRIP) protect other data. The stream itself gets no hits either way.</td></tr>
<tr><td>Large code footprint</td><td>Matters in L2/LLC; code competes with data, and protecting hot code helps the frontend.</td></tr>
<tr><td>Branch-heavy integer</td><td>Small to moderate gains.</td></tr>
<tr><td>Blocked numerics</td><td>LRU works well when tiles fit; little to gain.</td></tr>
<tr><td>ML inference</td><td>Streaming weights pollute LRU caches; insertion-at-LRU keeps activations resident.</td></tr>
<tr><td>Multithreaded shared data</td><td>One streaming thread can evict everyone's data in a shared LLC; RRIP or partitioning protects the others.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 4-entry fully associative cache sees the repeating pattern A B C D E A B C D E. What's the hit rate with LRU? With LRU insertion (new lines inserted at the LRU position, promoted to MRU on a hit)?</p>`,
        a: `<ol><li>LRU: each access evicts the line needed four accesses later, the next one in the cycle. <strong>0% hits.</strong></li><li>LRU insertion: after A B C D fill, E evicts D and is inserted at LRU. A, B, C then hit and move to MRU. D misses and evicts E (still at LRU), and E misses and evicts D.</li><li>Steady state: A, B, C hit; D and E miss. <strong>3 / 5 = 60% hits.</strong> Keeping part of a too-large working set beats losing all of it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is Belady's optimal policy, why can't hardware implement it, and how do modern policies approximate it?</p>`,
        a: `<p>Belady's OPT evicts the line whose next use is furthest in the future; it gives the minimum possible misses but needs future knowledge. Approximations: RRIP predicts re-reference distance with a small counter per line and inserts new lines as "distant" for scan resistance. Hawkeye replays recent history to compute what OPT would have done and trains a PC-based predictor to classify loads as cache-friendly or cache-averse.</p>`
      }
    ]
  }
},

{
  id: "cache-banking",
  region: "ctr",
  title: "Banking and Bank Size",
  body: `
<h3>What It Changes</h3>
<p>A banked cache splits its array into independent pieces, letting several accesses proceed at once. Bank size trades access speed against overhead.</p>
<h3>The Math</h3>
<ul>
<li><strong>Conflict probability</strong> with k random accesses over B banks: 1 − B! / ((B − k)! × B<sup>k</sup>).</li>
<li><strong>Bank selection:</strong> bank = some address bits (low line bits for spreading sequential accesses), often XOR-hashed with higher bits.</li>
<li><strong>Bank size</strong> = cache size / banks. Smaller banks have shorter wordlines and bitlines, so they are faster and use less energy per access.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul>
<li><strong>More, smaller banks:</strong> more parallelism, faster and lower-energy access per bank; but each bank needs its own decoders, sense amplifiers, and drivers, and a wider crossbar connects banks to ports. Overhead area and routing rise.</li>
<li><strong>Fewer, larger banks:</strong> denser, less overhead; slower, more conflicts.</li>
<li><strong>Versus multiporting:</strong> banking gives most of the bandwidth at far lower area than adding ports to every cell.</li>
</ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Little effect: few memory ops per cycle.</td></tr>
<tr><td>Pointer chasing</td><td>Little effect: dependent loads rarely issue in the same cycle.</td></tr>
<tr><td>Streaming</td><td>Sequential lines spread across banks well, but several arrays with identically aligned bases can hit the same bank every cycle.</td></tr>
<tr><td>Large code footprint</td><td>I-caches usually serve one fetch per cycle, so banking matters less.</td></tr>
<tr><td>Branch-heavy integer</td><td>Little effect.</td></tr>
<tr><td>Blocked numerics</td><td>Power-of-two leading dimensions cause repeated conflicts; padding fixes it.</td></tr>
<tr><td>ML inference</td><td>High load bandwidth per cycle makes bank conflicts visible; layout matters.</td></tr>
<tr><td>Multithreaded shared data</td><td>At the LLC, "banks" are slices across the chip; hashing spreads load, but a single hot line (a lock) still serializes on one slice.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>An L1 has 8 banks. Assuming random bank selection, what is the chance that 2 accesses in the same cycle conflict? 4 accesses?</p>`,
        a: `<ol><li>P(no conflict) = B! / ((B − k)! × B<sup>k</sup>).</li><li>k = 2: 1 − (8 × 7) / 64 = <strong>12.5%</strong> conflict.</li><li>k = 4: 1 − (8 × 7 × 6 × 5) / 4096 ≈ <strong>59%</strong> conflict.</li><li>Random banking works for 2 accesses per cycle, but supporting 3–4 loads per cycle needs more banks, smarter mapping, or replication.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>To support two loads per cycle, compare a true dual-ported L1, a banked L1, and a replicated L1.</p>`,
        a: `<p><strong>Dual-ported:</strong> no conflicts, but each SRAM cell needs extra ports, raising area roughly 1.5–2× and slowing access. <strong>Banked:</strong> nearly single-port area and energy, but same-bank pairs conflict and one load waits; works well when address bits spread accesses. <strong>Replicated:</strong> two copies serve reads with no conflicts, but stores must write both and area doubles. Banking is the common choice for L1D; replication suits read-heavy, small structures.</p>`
      }
    ]
  }
},

{
  id: "cache-write",
  region: "ctr",
  title: "Write Policies",
  body: `
<h3>What It Changes</h3>
<ul>
<li><strong>Write-back vs. write-through:</strong> whether a store updates only the cache (written back on eviction) or also the next level immediately.</li>
<li><strong>Write-allocate vs. no-write-allocate:</strong> whether a store miss brings the line into the cache.</li>
<li><strong>Write-combining buffers</strong> merge stores to the same line before sending them out.</li>
</ul>
<h3>The Math</h3>
<p>For write-through, traffic ∝ number of stores. For write-back, traffic ∝ dirty evictions. With write-allocate, a store miss to a line that is fully overwritten still costs a read: a full-line write is 2× the traffic unless the hardware detects it.</p>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Write-back:</strong> least traffic and energy; needs dirty bits and more careful coherence and error correction.</li><li><strong>Write-through:</strong> simpler, but bandwidth and energy grow with store count.</li><li><strong>Write-combining:</strong> a small buffer area that saves a lot of bandwidth.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Little effect.</td></tr>
<tr><td>Pointer chasing</td><td>Mostly reads; little effect.</td></tr>
<tr><td>Streaming</td><td>Large effect: output arrays written once should bypass allocation (non-temporal stores).</td></tr>
<tr><td>Large code footprint</td><td>No effect on instruction fetch.</td></tr>
<tr><td>Branch-heavy integer</td><td>Write-back absorbs repeated updates to hot data.</td></tr>
<tr><td>Blocked numerics</td><td>Write-back keeps the output tile in cache while it accumulates.</td></tr>
<tr><td>ML inference</td><td>Activation outputs are rewritten repeatedly; write-back is essential.</td></tr>
<tr><td>Multithreaded shared data</td><td>Dirty lines must be supplied by their owner on a remote read; write-through to a shared level can simplify sharing at a bandwidth cost.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A loop stores 1 GB once and never reads it back. Compare memory traffic with write-allocate versus no-write-allocate (or non-temporal stores).</p>`,
        a: `<ol><li>Write-allocate: each line is first read from memory (1 GB read), then written back when evicted (1 GB written): <strong>2 GB</strong> of traffic.</li><li>No-write-allocate or non-temporal stores: writes go straight out through write-combining buffers: <strong>1 GB</strong>.</li><li>Half the traffic, and the cache isn't polluted with lines nobody reads.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why are L1 data caches almost always write-back, while some designs make L1 write-through to an L2?</p>`,
        a: `<p>Write-back absorbs repeated stores to the same line, saving bandwidth and energy. Write-through to L2 simplifies coherence and error handling: L1 lines are never dirty, so the L2 always has current data and L1 can use simple parity. It works only if the L2 can absorb the store bandwidth, usually with a store-merging buffer between them.</p>`
      }
    ]
  }
}
]);
