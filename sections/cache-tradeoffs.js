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
        a: `<ol start="0"><li>Insensitive to size, associativity, and replacement means there is little reuse to capture.</li><li>Sensitive to line size means each miss brings in data that is used soon after: strong spatial locality.</li><li>That is a <strong>streaming</strong> workload. A good prefetcher would give the same benefit without changing the line size.</li></ol>`
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
        a: `<ol start="0"><li>√2 rule: new miss rate ≈ 4% / √2 ≈ 2.83%.</li><li>Old AMAT = 4 + 0.04 × 14 = 4.56 cycles.</li><li>New AMAT = 5 + 0.0283 × 14 ≈ 5.40 cycles.</li><li><strong>Worse.</strong> The extra cycle on every hit outweighs the saved misses. This is why L1 sizes have stayed small while L2 and LLC grew.</li></ol>`
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
        a: `<ol start="0"><li>Direct-mapped: 512 sets. Each step moves 4096 / 64 = 64 lines, so set index advances by 64; only 512 / 64 = <strong>8 sets</strong> are ever used, holding 8 lines.</li><li>8-way: 64 sets, and 4096 bytes is exactly 64 sets × 64 bytes, so every access maps to the <strong>same set</strong>, holding 8 lines. Still only 8 lines of reach.</li><li>With 1024 rows, the next column's reuse of each line comes after 1024 other lines: all misses either way.</li><li>Fix in software: pad each row by one line (4096 + 64 bytes) so successive rows land in different sets, or interchange loops to walk rows.</li></ol>`
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
        a: `<ol start="0"><li>Penalty = latency + line / bandwidth: 64 B → 104 cycles, 128 B → 108, 256 B → 116 (or less with critical-word-first).</li><li>Random 8-byte reads use 8 of each line's bytes: 8 / 64 = <strong>12.5%</strong>, 8 / 128 = 6.25%, 8 / 256 = 3.1%.</li><li>Streaming reads use every byte, so efficiency is 100% at any size, and larger lines halve the miss count.</li></ol>`
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
  body: `
<h3>What It Changes</h3>
<p>The replacement policy picks a victim in a full set. It decides whether a working set slightly larger than the cache gets partial hits or none, and whether a scan wipes out useful data.</p>
<h3>Common Policies</h3>
<ul>
<li><strong>LRU:</strong> evict least recently used. Good for recency; thrashes on loops slightly larger than the cache.</li>
<li><strong>Tree pseudo-LRU:</strong> approximates LRU with N − 1 bits per set.</li>
<li><strong>Random / FIFO:</strong> cheap; random avoids LRU's pathological 0% case.</li>
<li><strong>Insertion policies (LIP, BIP, DIP):</strong> insert new lines at or near LRU; DIP picks between LRU and BIP by set dueling.</li>
<li><strong>RRIP (SRRIP, BRRIP, DRRIP):</strong> a 2-bit re-reference prediction per line; resistant to both scans and thrashing.</li>
<li><strong>Learned policies (Hawkeye, SHiP):</strong> PC-indexed predictors learn which loads bring in lines worth keeping.</li>
</ul>
<h3>The Math</h3>
<ul>
<li><strong>True LRU state:</strong> log<sub>2</sub>(N!) bits per set at minimum: 8 ways → 16 bits, 16 ways → 45 bits. Practical implementations use more.</li>
<li><strong>Tree PLRU:</strong> N − 1 bits: 7 bits for 8 ways.</li>
<li><strong>RRIP:</strong> 2 bits per line: 16 bits for 8 ways.</li>
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
        a: `<ol start="0"><li>LRU: each access evicts the line needed four accesses later, the next one in the cycle. <strong>0% hits.</strong></li><li>LRU insertion: after A B C D fill, E evicts D and is inserted at LRU. A, B, C then hit and move to MRU. D misses and evicts E (still at LRU), and E misses and evicts D.</li><li>Steady state: A, B, C hit; D and E miss. <strong>3 / 5 = 60% hits.</strong> Keeping part of a too-large working set beats losing all of it.</li></ol>`
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
        a: `<ol start="0"><li>P(no conflict) = B! / ((B − k)! × B<sup>k</sup>).</li><li>k = 2: 1 − (8 × 7) / 64 = <strong>12.5%</strong> conflict.</li><li>k = 4: 1 − (8 × 7 × 6 × 5) / 4096 ≈ <strong>59%</strong> conflict.</li><li>Random banking works for 2 accesses per cycle, but supporting 3–4 loads per cycle needs more banks, smarter mapping, or replication.</li></ol>`
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
        a: `<ol start="0"><li>Write-allocate: each line is first read from memory (1 GB read), then written back when evicted (1 GB written): <strong>2 GB</strong> of traffic.</li><li>No-write-allocate or non-temporal stores: writes go straight out through write-combining buffers: <strong>1 GB</strong>.</li><li>Half the traffic, and the cache isn't polluted with lines nobody reads.</li></ol>`
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
