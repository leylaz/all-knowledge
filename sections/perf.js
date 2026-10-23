/* Section: Performance analysis
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "perf"). */

section({
  id: "perf",
  name: "Performance Analysis",
  cap: "Statistics, stall causes, bottlenecks, benchmarks",
  body: `
<p>Performance work is mostly measurement: choosing workloads, measuring the right things, finding the bottleneck, and summarizing results honestly. The same analysis applies to performance models, RTL, emulation, and real silicon.</p>
<h3>The Iron Law</h3>
<p>Time = instructions × CPI × cycle time. A change helps only if it improves the product; a better CPI with a lower clock or more instructions can be a loss (see <a href="#/pipelining">Pipelining and the iron law</a>).</p>
<h3>How the Pages Fit Together</h3>
<ul>
<li><a href="#/ipc-spec">IPC and simulation methodology</a>: CPI stacks, summarizing results, simulation hygiene, and model correlation.</li>
<li><a href="#/perf-stats">Performance statistics</a>: what a model counts, and how.</li>
<li><a href="#/perf-stalls">Stall causes</a>: every reason a cycle can be lost, by pipeline area.</li>
<li><a href="#/perf-bottlenecks">Bottleneck types</a>: front-end bound, bad speculation, memory-bound, and core-bound, and latency-bound vs. throughput-bound.</li>
<li><a href="#/spec-cpu">SPEC CPU benchmarks</a> and <a href="#/workloads">Types of workloads</a>: what to run.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Design A runs 1.2 billion instructions at CPI 0.8 and 3.0 GHz. Design B runs 1.0 billion at CPI 1.0 and 3.2 GHz. Which is faster?</p>`,
        a: `<ol><li>A: 1.2e9 × 0.8 / 3.0e9 = 0.32 s.</li><li>B: 1.0e9 × 1.0 / 3.2e9 ≈ 0.3125 s.</li><li><strong>B is faster</strong> despite its worse CPI.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can IPC be misleading when comparing two chips?</p>`,
        a: `<p>Different ISAs, compilers, or flags produce different instruction counts for the same work, and micro-op cracking changes what counts as an instruction. Spin loops can inflate IPC while doing no useful work. Compare execution time (or IPC only on identical binaries), and pair IPC with frequency and power.</p>`
      }
    ]
  }
}, [
{
  id: "ipc-spec",
  region: "perf",
  title: "IPC and Simulation Methodology",
  body: `
<p>IPC is instructions retired per cycle. Compare it only on identical binaries.</p>
<h3>Breaking Cycles Down</h3>
<p>A CPI stack splits cycles into base work and stall causes, showing where a gain actually came from.</p>
<h3>Summarizing a Suite</h3>
<p>Use the geometric mean of speedups, and report per-benchmark results too.</p>
<h3>Simulation Hygiene</h3>
<ul><li>Simulate representative regions (SimPoints).</li><li>Warm up caches and predictors before measuring.</li><li>Pair IPC with MPKI for caches and branches.</li><li>Sweep one parameter at a time to find where returns flatten.</li></ul>
<h3>SPEC on a Simulator vs. on Real Hardware</h3>
<p>These are two different experiments. On hardware, you time the run and get a SPEC score. On a C model, the simulator is just a program running on a host CPU, so you get two separate clocks:</p>
<div class="tbl"><table>
<tr><th></th><th>Host wall-clock time</th><th>Simulated target cycles</th></tr>
<tr><td>What it measures</td><td>How fast your simulator runs</td><td>How fast the modeled CPU would run</td></tr>
<tr><td>Depends on</td><td>Host CPU, model detail, simulator code quality</td><td>The modeled microarchitecture (and how accurate the model is)</td></tr>
<tr><td>Use it for</td><td>Planning simulation budgets</td><td>IPC, CPI stacks, design comparisons</td></tr>
</table></div>
<p>Never report host time as target performance; there’s nothing to “subtract.” Estimated target time = cycles / frequency, e.g. 5 × 10<sup>9</sup> cycles at 3 GHz ≈ 1.67 s. That only holds if the clock is fixed and memory latency is modeled sensibly: if DRAM latency is a fixed cycle count, raising the clock in the model wrongly makes memory faster too. Model it in nanoseconds if you plan to sweep frequency.</p>
<h3>Why You Can’t Simulate a Whole SPEC Run</h3>
<p>Reference inputs run hundreds of billions to trillions of instructions, and detailed cycle-level models are often 10,000× or more slower than native, so a full run would take weeks to months. Instead, simulate representative regions (SimPoint) or sampled intervals (SMARTS) and weight the results. SPEC itself points to SimPoint-based checkpoints (“pinballs”) for CPU 2017 from UT Austin. Don’t substitute the <code>test</code> or <code>train</code> inputs for <code>ref</code>: they behave differently, often with much smaller memory footprints.</p>
<h3>Two Separate Sources of Error</h3>
<ul><li><strong>Overhead:</strong> affects only how long you wait, not the answer.</li><li><strong>Abstraction:</strong> simplified bank conflicts, fixed memory latency, idealized arbitration, or predictor update timing all change the cycle count. This is the error that matters; reduce it by correlating against RTL, emulation, or silicon.</li><li><strong>Sampling:</strong> regions that miss a phase, or insufficient warmup, bias the result.</li></ul>
<h3>Measured vs. Estimated Results</h3>
<p>Published SPEC results are measured on real systems with outputs validated and the full configuration disclosed. SPEC allows performance metrics (not energy metrics) to be estimated, from simulation or models for example, but any public estimate must be clearly labeled as one.</p>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/runrules.html" target="_blank" rel="noopener">SPEC CPU 2017 run rules</a>, <a href="https://open.spec.org/cpu2017/research/simpoint.html" target="_blank" rel="noopener">SPEC CPU 2017 and simulation</a>.</p>
<h3>Model Correlation</h3>
<p>A model is only useful if it tracks the real design. Correlate against RTL simulation, emulation, or silicon with the same workloads, and compare per-structure events, not just total IPC.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Design B's speedups over A on three benchmarks are 1.10, 1.00, and 0.90. Give the arithmetic and geometric means.</p><p>Separately, a CPI stack: base 0.5, branch 0.3, L2 0.2, memory 0.6. If you halve memory stalls, what's the speedup?</p>`,
        a: `<ol><li>Arithmetic mean = 1.00. Geometric mean = (1.1 × 1.0 × 0.9)^(1/3) = 0.99^(1/3) ≈ <strong>0.997</strong>. Use the geomean for ratios; its ranking doesn't depend on which design is the baseline.</li><li>Total CPI = 1.6. New CPI = 1.6 − 0.3 = 1.3. Speedup = 1.6 / 1.3 ≈ <strong>1.23×</strong>.</li></ol>`
      },
      {
        q: `<p>Your simulator takes 6 hours on a SimPoint region of 100 million instructions and reports 40 million cycles for a 3 GHz target. What’s the target IPC and time for the region? A colleague says “the design is slow, it took 6 hours.” What’s wrong with that?</p>`,
        a: `<ol><li>IPC = 100M / 40M = <strong>2.5</strong>.</li><li>Target time = 40 × 10<sup>6</sup> / 3 × 10<sup>9</sup> ≈ <strong>13.3 ms</strong>.</li><li>The 6 hours is host time: it measures the simulator’s speed (here roughly 4,600 target instructions per second), not the modeled CPU. To estimate the whole benchmark, weight each region’s CPI by its SimPoint weight and multiply by the total instruction count.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your model predicts +8% IPC for a feature, but RTL simulation of the same workloads shows +2%. How do you find the gap?</p>`,
        a: `<ol><li>Confirm it's the same workload: same binary, region, warmup, and configuration.</li><li>Compare event counts per structure (misses, replays, stall cycles by resource) between model and RTL.</li><li>Narrow it down with directed microbenchmarks that exercise just the feature.</li><li>Check modeling assumptions: latencies, port counts, arbitration, queue sizes, and corner cases RTL implements that the model idealizes.</li><li>Fix the model or flag the RTL as a performance bug, and add the case to a correlation regression suite.</li></ol>`
      }
    ]
  }
},

{
  id: "perf-stats",
  region: "perf",
  title: "Performance Statistics",
  sections: [{ id: "counters", label: "Statistics Counters" }, { id: "kinds", label: "Kinds of Statistics" }, { id: "tracked", label: "What's Tracked, Structure by Structure" }],
  body: `
<h3 id="sec-counters">Statistics Counters</h3>

<p>A cycle-level model tracks performance with <strong>statistics counters</strong>: ordinary variables in the model's code that are incremented whenever an event happens. They're the software equivalent of the hardware performance counters on a real chip (see <a href="#/eda-rtl/test-hooks">Test hooks</a>), but with two big differences: a model can have thousands of them instead of a handful, and it can measure things no hardware counter can, such as the exact reason every single cycle was lost.</p>
<pre><code>struct CoreStats {
  uint64_t cycles = 0, insts_retired = 0;
  uint64_t rob_full_stall_cycles = 0;
  uint64_t l1d_accesses = 0, l1d_misses = 0;
  uint64_t rob_occupancy_sum = 0;   // divide by cycles for the average
};

// Inside the cycle loop:
stats.cycles++;
stats.rob_occupancy_sum += rob.size();
if (dispatch_blocked &amp;&amp; rob.full()) stats.rob_full_stall_cycles++;

// Inside the L1 data cache model:
stats.l1d_accesses++;
if (!hit) stats.l1d_misses++;</code></pre>
<h3 id="sec-kinds">Kinds of Statistics</h3>
<ul>
<li><strong>Event counts:</strong> how many times something happened (misses, mispredicts, flushes).</li>
<li><strong>Cycle counts by cause:</strong> how many cycles a stage was stalled, and why.</li>
<li><strong>Occupancy:</strong> each structure's fill level, summed every cycle and divided by total cycles for an average, often kept as a histogram too.</li>
<li><strong>Histograms and distributions:</strong> load latency, instructions issued per cycle, miss latency. Averages hide important tails.</li>
<li><strong>Per-instruction statistics:</strong> which instruction addresses (PCs) miss or mispredict most, pointing to the code that's responsible.</li>
<li><strong>Interval statistics:</strong> the same counters reported every N instructions, showing how behavior changes across program phases.</li>
<li><strong>Stall attribution:</strong> every cycle in which fewer instructions retire than the core's width, the lost slots are charged to one cause (front end, bad speculation, memory, or core resources). Summing these gives a CPI stack or top-down breakdown.</li>
</ul>
<p>At the end of a run, the model writes all counters to a statistics file. Derived metrics such as IPC, MPKI (misses per thousand instructions), and accuracy are calculated from them.</p>
<h3 id="sec-tracked">What's Typically Tracked, Structure by Structure</h3>
<div class="tbl"><table>
<tr><th>Area</th><th>Numbers tracked</th></tr>
<tr><td>Overall</td><td>Cycles; instructions and micro-ops retired; IPC and CPI; instruction mix (loads, stores, branches, integer, floating point, vector)</td></tr>
<tr><td>Front end</td><td>Instruction cache accesses, misses, and MPKI; instruction TLB misses; BTB hits and misses; fetch bubbles; fetch queue occupancy; decoded-instruction (micro-op) cache hit rate</td></tr>
<tr><td>Branch prediction</td><td>Conditional branch mispredicts (accuracy and MPKI); indirect target mispredicts; return mispredicts; cycles lost to each</td></tr>
<tr><td>Rename and dispatch</td><td>Stall cycles by cause: ROB full, issue queue full, load queue full, store queue full, out of physical registers (integer and floating point); dispatch width used per cycle</td></tr>
<tr><td>Window occupancy</td><td>Average, maximum, and histogram of ROB, issue queue, load queue, store queue, and physical register file occupancy</td></tr>
<tr><td>Issue and execute</td><td>Instructions issued per cycle (histogram); utilization of each execution port and unit; cycles a ready instruction waited for a busy port; replays after load-hit misspeculation; divider busy cycles</td></tr>
<tr><td>Loads and stores</td><td>Store-to-load forwards; forwarding failures and their stalls; memory-ordering violations and the flushes they cause; memory dependence predictor false dependences; load latency distribution; misaligned and line-split accesses; store buffer full cycles; coalesced stores</td></tr>
<tr><td>Each cache level</td><td>Accesses, hits, misses, MPKI; miss latency (average and histogram); MSHR occupancy and cycles full; evictions and writebacks; bank conflicts</td></tr>
<tr><td>Prefetchers</td><td>Prefetches issued, useful, late, and useless; accuracy, coverage, and timeliness; cache pollution (useful lines evicted by prefetches)</td></tr>
<tr><td>TLBs and page walks</td><td>Misses at each TLB level; page walks; walk latency; page-walk cache hits</td></tr>
<tr><td>Coherence</td><td>Invalidations sent and received; coherence misses; upgrades; directory or snoop lookups; cycles stalled in transient states; lines bouncing between cores</td></tr>
<tr><td>Memory (DRAM)</td><td>Reads and writes; bandwidth used; row-buffer hits, misses, and conflicts; queueing delay; bank utilization; memory-level parallelism (average outstanding misses)</td></tr>
<tr><td>Retire and recovery</td><td>Retire width used per cycle; flushes by cause (mispredict, ordering violation, exception) and cycles lost to each; which instruction type was at the ROB head while retirement was stalled</td></tr>
<tr><td>Power-related activity</td><td>Access counts for every structure (reads and writes of each array, CAM searches, wakeup broadcasts), which power models multiply by energy per access</td></tr>
</table></div>
<p>These are the numbers used for every decision in this section: for example, a ROB-size study looks at IPC, ROB-full stall cycles, ROB occupancy, and outstanding misses together. They're also what gets compared against RTL and emulation during correlation, which is why model and hardware counters are usually given matching names and definitions.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A run reports 1.0 billion cycles, 1.5 billion retired instructions, 30 million L1 data cache misses, 6 million branch mispredicts, and a summed ROB occupancy of 96 billion. Compute IPC, L1D MPKI, branch MPKI, and average ROB occupancy.</p>`,
        a: `<ol><li>IPC = 1.5 × 10<sup>9</sup> / 1.0 × 10<sup>9</sup> = <strong>1.5</strong>.</li><li>L1D MPKI = 30 × 10<sup>6</sup> / (1.5 × 10<sup>9</sup> / 1,000) = <strong>20</strong> misses per thousand instructions.</li><li>Branch MPKI = 6 × 10<sup>6</sup> / 1.5 × 10<sup>6</sup> = <strong>4</strong>.</li><li>Average ROB occupancy = 96 × 10<sup>9</sup> / 10<sup>9</sup> cycles = <strong>96 entries</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do performance models keep histograms instead of just averages?</p>`,
        a: `<p>Averages hide the shape of a distribution. An average load latency of 20 cycles could mean every load takes 20 cycles, or that 90% hit in 4 cycles and 10% take 164. Those call for completely different fixes: the first suggests a slow L1, the second a miss problem worth attacking with prefetching or a bigger cache. Histograms of latency, occupancy, and instructions issued per cycle show tails, bimodal behavior, and how often a structure is completely full, which averages can't.</p>`
      }
    ]
  }
},

{
  id: "perf-stalls",
  region: "perf",
  title: "Stall Causes",
  sections: [{ id: "by-area", label: "By Pipeline Area" }, { id: "details", label: "Details That Are Easy to Get Wrong" }],
  body: `

<p>Two kinds of counters are at the heart of a cycle-level model's statistics: <strong>event counts</strong> (how many mispredicts, misses, or flushes happened) and <strong>stall cycles by cause</strong> (how many cycles were lost, and why). The causes, grouped by where in the pipeline they arise:</p>
<h3 id="sec-by-area">Stall Causes by Pipeline Area</h3>
<div class="tbl"><table>
<tr><th>Area</th><th>Stall causes</th></tr>
<tr><td>Front end: no instructions arriving</td><td>Instruction cache and instruction TLB misses; BTB misses; the bubble after a taken branch; decoder limits (complex instructions needing microcode); fetch blocks that cross cache lines</td></tr>
<tr><td>Rename and dispatch: no room for new instructions (back-pressure)</td><td>ROB full; issue queue or scheduler queues full; load queue or store queue full; out of physical registers; out of branch checkpoints (saved snapshots of the rename table); serializing instructions and fences; and, as a throughput limit rather than a stall, rename width</td></tr>
<tr><td>Issue and execute</td><td>Operands not ready (dependency chains); execution ports or units busy; a non-pipelined unit such as the divider still occupied; register file port conflicts; replays after a load was expected to hit but missed</td></tr>
<tr><td>Loads and stores</td><td>Store-forwarding stalls; loads waiting on older stores with unknown addresses; cache bank conflicts; MSHRs full; store buffer full; misaligned or line-split accesses</td></tr>
<tr><td>Memory system and multicore</td><td>Cache misses to L2, the last-level cache, and DRAM; TLB misses and page walks; DRAM queueing when bandwidth is saturated; DRAM row conflicts; waiting for exclusive ownership of a line; false sharing; atomic operations and fences draining the store buffer</td></tr>
<tr><td>Flushes: wasted work rather than waiting</td><td>Branch mispredicts; memory-ordering violations; exceptions and interrupts; self-modifying code</td></tr>
</table></div>
<h3 id="sec-details">Details That Are Easy to Get Wrong</h3>
<ul>
<li><strong>Which structure stalls dispatch depends on the instruction.</strong> Every instruction needs a ROB entry, but the others are needed only by some: a load queue entry only for loads, a store queue entry only for stores, a physical register only for instructions that write a register (often from separate integer and floating-point/vector pools), and an issue queue entry for the type of unit the instruction will run on. So a full load queue stalls dispatch only when the next instruction is a load. Models charge the stall to the first resource the instruction couldn't get, which is how the counters show <em>which</em> structure is the bottleneck.</li>
<li><strong>Scheduler queues and issue queues are usually the same thing.</strong> The terms are often interchangeable. The real distinction is between one <em>unified</em> queue shared by all execution units and <em>distributed</em> queues, one per group of ports.</li>
<li><strong>Branch checkpoints.</strong> Cores save a snapshot of the rename table at each unresolved branch so they can recover quickly from a mispredict. When every snapshot is in use, rename stops at the next branch until an older branch resolves.</li>
<li><strong>Rename width</strong> caps how many instructions can be renamed per cycle. It's a throughput limit rather than a stall, but it shows up in the same statistics.</li>
<li><strong>BTB miss vs. taken-branch bubble.</strong> If the BTB misses, fetch doesn't know a branch is there and keeps fetching sequentially; decode discovers the branch, flushes the wrongly fetched instructions, and redirects fetch, losing a few cycles (walked through cycle by cycle in <a href="#/branch-hazards/btb">The BTB and decode redirects</a>). Even a <em>correctly predicted</em> taken branch costs a little: if the predictor and BTB take more than one cycle to produce the target, fetch has already started on the next sequential block, which is discarded, and the slots after the branch in its fetch block are wasted (about 0–2 cycles).</li>
<li><strong>A cache miss doesn't stall the whole out-of-order core, at first.</strong> Only the instructions that depend on the load wait. They sit in the issue queue until the data returns: from L2 on an L1 miss, or from the last-level cache (tens of cycles) or DRAM (hundreds of cycles) if L2 misses too. The load then broadcasts its destination register tag, waking its dependents, which get the value through the bypass network or the register file. If the core had woken them early, assuming an L1 hit, they're cancelled and replayed when the miss is detected.</li>
<li><strong>The stall spreads upstream.</strong> Waiting instructions keep occupying issue queue and ROB entries, and since instructions retire in order, nothing behind the missing load can leave the ROB. If the miss lasts long enough, those structures fill and dispatch stalls too, so one long miss shows up first as "operands not ready," then as "ROB full" or "issue queue full." That's why models count things like "cycles the ROB was full while a load miss sat at the head."</li>
<li><strong>Best and worst cases.</strong> Even with no dependents, a long miss eventually stalls the core because the ROB fills behind it; see <a href="#/perf-bottlenecks/dependency">Dependency stalls on a load miss</a> for the numbers.</li>
<li><strong>Memory-bound vs. core-bound waiting.</strong> A dependency stall is classified by what's being waited on: a load miss makes it memory-bound, a long-latency operation or busy unit makes it core-bound. See <a href="#/perf-bottlenecks">Bottleneck types</a>.</li>
<li><strong>TLB misses happen with any cache design.</strong> Every memory access needs a translation, whether the cache is virtually or physically indexed, because tags and lower levels use physical addresses. A virtually indexed, physically tagged (VIPT) cache only lets the TLB lookup happen in parallel with indexing, hiding translation latency on a TLB hit.</li>
<li><strong>Bank conflicts.</strong> If a bank is busy for a cycle or more after an access, a second access to the same bank must wait until it's free, so the penalty depends on how long the bank stays busy.</li>
<li><strong>Fences and serializing instructions.</strong> A memory fence stops later <em>memory operations</em> from being performed until the memory operations before it complete. In practice that usually means waiting for older stores to drain from the store buffer, not necessarily for the fence itself to retire. Designs differ in where they enforce it: some stall dispatch at the fence, while others let younger loads and stores enter their queues but hold them back from executing. Fully serializing instructions, such as certain control-register writes, go further: they stall rename until everything older has finished, and nothing after them executes until they're done, effectively draining the pipeline.</li>
<li><strong>Store-forwarding stalls come from partial overlap.</strong> A load that fully overlaps an older store gets its data forwarded from the store queue with no stall. If it only <em>partly</em> overlaps (for example, a 4-byte store and an 8-byte load), forwarding fails: the load waits until the store commits and writes the cache, then reads the merged data, often 10 or more cycles.</li>
<li><strong>Memory-ordering violations cause flushes, not stalls.</strong> A younger load ran before an older store to the same address and read an old value (from the cache or an even older store), so it and everything after it are flushed and re-executed.</li>
<li><strong>False sharing</strong> is two cores writing <em>different</em> variables that happen to share a cache line, so the line bounces between them even though no data is truly shared. Writing the <em>same</em> variable is true sharing. Padding data to separate lines fixes false sharing (see <a href="#/false-sharing">False sharing</a>).</li>
</ul>
<p>To group these causes into front-end bound, bad speculation, memory-bound, and core-bound, see <a href="#/perf-bottlenecks/topdown">the top-down method</a>.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model shows dispatch stalled 40% of cycles because the ROB was full, and in most of those cycles the instruction at the ROB head is a load that missed L2. What kind of bottleneck is this, and what would you investigate next?</p>`,
        a: `<ol><li>It's <strong>memory-bound</strong>: the ROB fills because a long miss blocks in-order retirement.</li><li>Check memory-level parallelism (average misses outstanding). If it's near 1, the misses are dependent (latency-bound): look at the access pattern and prefetchers that understand it. If many misses overlap, check bandwidth use and MSHR occupancy.</li><li>Check last-level cache and DRAM latencies, and whether a larger ROB or load queue would expose more overlapping misses.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A load misses all the way to DRAM (200 cycles), and nothing after it depends on it. The core is 4-wide with a 128-entry ROB. How much of the latency is hidden?</p>`,
        a: `<p>Independent instructions keep issuing, but they can't retire past the stuck load, so the ROB fills in about 128 / 4 = 32 cycles. After that, dispatch stalls for the remaining ~168 cycles, so only about 16% of the latency is hidden. The rest is hidden only if the work behind the load includes other misses that overlap with it (memory-level parallelism), or if the window is much larger.</p>`
      }
    ]
  }
},

{
  id: "perf-bottlenecks",
  region: "perf",
  title: "Bottleneck Types",
  sections: [
    { id: "topdown", label: "The Top-Down Method" },
    { id: "latency-throughput", label: "Latency- vs. Throughput-Bound" },
    { id: "diagnose", label: "Telling Them Apart" },
    { id: "dependency", label: "Dependency Stalls on a Load Miss" }
  ],
  body: `
<p>Every lost cycle has a reason, and the first step in any performance study is to name which kind of bottleneck dominates. The fix for one kind does nothing for another: a bigger cache won't help a workload that's limited by branch mispredicts.</p>
<h3 id="sec-topdown">The Top-Down Method</h3>
<p>Intel's top-down method charges every lost issue slot to exactly one of four categories (slots that do useful work count as <strong>retiring</strong>):</p>
<div class="tbl"><table>
<tr><th>Category</th><th>What it means</th><th>Typical causes</th></tr>
<tr><td>Front-end bound</td><td>The back end could accept instructions, but none are arriving</td><td>Instruction cache and TLB misses, BTB misses, taken-branch bubbles, decoder limits</td></tr>
<tr><td>Bad speculation</td><td>Slots were spent on work that was thrown away</td><td>Branch mispredicts, memory-ordering violations, other flushes</td></tr>
<tr><td>Back-end memory bound</td><td>Instructions are waiting on data</td><td>Cache and TLB misses, DRAM latency or bandwidth, store-buffer and MSHR limits</td></tr>
<tr><td>Back-end core bound</td><td>Instructions are waiting on execution resources</td><td>Long-latency operation chains, busy execution ports or units, a busy divider</td></tr>
</table></div>
<p>The result is a breakdown that adds up to 100% of slots, which is then drilled into with the detailed counters on <a href="#/perf-stalls">Stall causes</a>. The same breakdown applies to performance models, RTL, emulation, and silicon with hardware counters.</p>
<h3 id="sec-latency-throughput">Latency-Bound vs. Throughput-Bound</h3>
<p>"Latency-bound" means different things depending on the category, so it helps to split both memory-bound and core-bound in two:</p>
<div class="tbl"><table>
<tr><th></th><th>Latency-bound</th><th>Throughput-bound</th></tr>
<tr><td><strong>Memory-bound</strong></td><td>Dependent misses that can't overlap, such as pointer chasing (505.mcf, linked lists, graphs). Each miss waits for the one before it, so memory-level parallelism stays near 1. <em>Fixes:</em> lower latency (bigger or closer caches), prefetchers that understand the data structure, software changes to the data layout.</td><td>Streaming that saturates memory bandwidth (519.lbm, STREAM). Many misses overlap, but the memory system can't deliver bytes any faster. <em>Fixes:</em> more bandwidth (more channels, HBM), compression, fewer bytes per result (blocking for reuse).</td></tr>
<tr><td><strong>Core-bound</strong></td><td>Chains of long-latency operations: divides (10–40 cycles), or a chain of floating-point adds into one accumulator. <em>Fixes:</em> lower-latency units, or restructuring code to break the chain (for example, summing into several accumulators).</td><td>Lots of independent operations competing for too few execution units or ports. Matrix and vector code usually lands here: matrix multiplication has huge amounts of independent work, so it's limited by how many multiply-add units exist. <em>Fixes:</em> more or wider units.</td></tr>
</table></div>
<h3 id="sec-diagnose">Telling Them Apart</h3>
<ul>
<li><strong>Memory latency-bound:</strong> high miss rates with low memory-level parallelism (few misses outstanding at once), and the ROB often full with a missing load at its head.</li>
<li><strong>Memory bandwidth-bound:</strong> bandwidth use near the platform's peak, and loaded memory latency far above the idle latency because requests queue (see <a href="#/icx-memory/controller">the memory controller</a>).</li>
<li><strong>Core latency-bound:</strong> low miss rates and idle execution ports, but instructions waiting on operands from long-latency operations.</li>
<li><strong>Core throughput-bound:</strong> one or more execution ports busy nearly every cycle.</li>
<li><strong>Front-end bound:</strong> high instruction cache or BTB miss rates and an often-empty fetch queue; typical of large code footprints (servers, browsers, compilers).</li>
<li><strong>Bad speculation:</strong> high branch mispredicts per thousand instructions and many flushed instructions.</li>
</ul>
<h3 id="sec-dependency">Dependency Stalls on a Load Miss</h3>
<p>When instructions wait on a load that missed, the stall counts as memory-bound, even though it shows up as "operands not ready." The dependents sit in the issue queue until the data arrives: from L2 on an L1 miss, or from the last-level cache (tens of cycles) or DRAM (hundreds) if L2 misses too. The load then broadcasts its destination register tag, waking the dependents, which get the value through the bypass network or the register file.</p>
<ul>
<li><strong>Worst case:</strong> everything after the load depends on it, so nothing independent is left to run.</li>
<li><strong>Best case, with a limit:</strong> independent instructions keep issuing, but instructions retire in order, so the ROB fills behind the stuck load. A 4-wide core with a 128-entry ROB fills it in about 128 / 4 = 32 cycles and then stalls anyway. The latency is fully hidden only if the miss is short (like an L2 hit) or the work behind it includes other misses that overlap with it.</li>
</ul>
<p>Overlapping independent misses is called <strong>memory-level parallelism</strong>; see <a href="#/latency-tolerance/mlp">What memory-level parallelism means</a>.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Classify each workload into the latency-bound vs. throughput-bound, memory vs. core grid: (a) traversing a large linked list; (b) adding two huge arrays element by element; (c) a loop computing a running sum with floating-point adds into one variable; (d) a large dense matrix multiplication.</p>`,
        a: `<ol type="a"><li>Memory latency-bound: each node's address comes from the previous node, so misses can't overlap.</li><li>Memory throughput-bound: independent streaming accesses saturate bandwidth.</li><li>Core latency-bound: each add waits for the previous one (break it up with several accumulators).</li><li>Core throughput-bound: abundant independent multiply-adds, limited by how many units exist (assuming the code is blocked so data stays in cache).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A workload's top-down breakdown is 25% retiring, 10% front-end bound, 5% bad speculation, 50% memory-bound, and 10% core-bound. What do you do next?</p>`,
        a: `<p>Focus on memory, the largest category. Split it: which cache level is missing (L1, L2, last-level, DRAM), and is it latency-bound (few misses outstanding, dependent access patterns) or bandwidth-bound (bandwidth near peak)? Then look at per-PC miss statistics to find the responsible code and access pattern. Latency-bound suggests prefetching tailored to the pattern, larger caches, or data-layout changes; bandwidth-bound suggests reducing bytes moved or adding bandwidth. Improving branch prediction or the front end would gain little here.</p>`
      }
    ]
  }
},

{
  id: "spec-cpu",
  region: "perf",
  title: "SPEC CPU Benchmarks",
  body: `
<p>SPEC CPU 2017 is the standard suite for comparing CPU performance and the usual workload set in microarchitecture papers and simulator studies. (A successor suite has been in development; check SPEC's site for the current release.)</p>
<h3>Four Suites</h3>
<ul><li><strong>SPECrate Integer / Floating Point:</strong> throughput, many copies run at once. Benchmarks end in <code>_r</code>.</li><li><strong>SPECspeed Integer / Floating Point:</strong> time for one task, optionally multithreaded. Benchmarks end in <code>_s</code>.</li></ul>
<h3>Scoring</h3>
<p>Each benchmark's score is the reference machine's time divided by your time; the suite score is the geometric mean. "Base" uses consistent compiler flags across benchmarks; "peak" allows per-benchmark tuning.</p>
<h3>SPECspeed vs. SPECrate</h3>
<p>SPECspeed is a latency metric: how long does one task take? SPECrate is a throughput metric: how much work gets done when many independent tasks run at once? (Hennessy &amp; Patterson, ch. 1, makes the same split between execution time and throughput.)</p>
<div class="tbl"><table>
<tr><th></th><th>SPECspeed</th><th>SPECrate</th></tr>
<tr><td>Copies</td><td>Always one copy of each benchmark</td><td>N concurrent copies; the tester picks N (usually one per hardware thread), and N = 1 is allowed</td></tr>
<tr><td>Parallelism inside a copy</td><td>OpenMP and compiler auto-parallelization allowed, so one copy may use many threads</td><td>Forbidden; each copy is a separate single-threaded process with its own data</td></tr>
<tr><td>Binaries</td><td><code>_s</code> versions, e.g. 600.perlbench_s; 64-bit, larger workloads</td><td><code>_r</code> versions, e.g. 500.perlbench_r; smaller workloads</td></tr>
<tr><td>Memory needed</td><td>16 GB minimum</td><td>About 1–2 GB per copy</td></tr>
<tr><td>Per-benchmark score</td><td>T<sub>ref</sub> / T<sub>yours</sub></td><td>N × T<sub>ref</sub> / T<sub>yours</sub>(N), where T(N) runs from the first copy starting to the last one finishing</td></tr>
<tr><td>What it rewards</td><td>Single-thread latency: frequency, IPC, branch prediction, cache latency; plus thread scaling on the OpenMP benchmarks</td><td>Scaling across cores: shared LLC capacity, interconnect, DRAM bandwidth, and all-core (not single-core) clock speed</td></tr>
</table></div>
<p>So the two suites aren’t the same programs run two ways. SPEC builds separate versions with different workload sizes, compile flags, and run rules. Both report the geometric mean of per-benchmark ratios against a reference machine, not literal jobs per minute.</p>
<p><strong>Example (illustrative, not real scores).</strong> Two 8-core CPUs. Alone, a job takes 10 s on A and 8 s on B, so B is 25% faster on SPECspeed. With 8 copies, contention slows A’s jobs to 20 s each (0.40 jobs/s) but B’s only to 12.5 s (0.64 jobs/s), so B is 60% faster on throughput. The rate gap is bigger than the speed gap because B handles shared-resource contention better. The reverse can happen too: a chip with a high single-core boost clock and little memory bandwidth can win SPECspeed and lose SPECrate.</p>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/" target="_blank" rel="noopener">SPEC CPU 2017 documentation index</a>, <a href="https://www.spec.org/cpu2017/Docs/system-requirements.html" target="_blank" rel="noopener">system requirements</a>.</p>
<h3>Input Sets: Test, Train, and Ref</h3>
<p>Every benchmark ships with several workloads (input files plus the expected outputs), selected with <code>runcpu --size</code>. Only ref produces a score.</p>
<div class="tbl"><table>
<tr><th>Input</th><th>Purpose</th><th>Timed?</th><th>In a simulator</th></tr>
<tr><td><code>test</code></td><td>Tiny; checks that the binary builds, runs, and produces correct output</td><td>No</td><td>Smoke test that your model can run the program end to end. Too small for results: data often fits in cache and startup code dominates.</td></tr>
<tr><td><code>train</code></td><td>Medium; the profiling input for feedback-directed optimization (PGO) in peak builds</td><td>No</td><td>A cheaper stand-in only if you’ve checked it behaves like ref. Some benchmarks match closely; others don’t.</td></tr>
<tr><td><code>refrate</code> (5xx <code>_r</code>) / <code>refspeed</code> (6xx <code>_s</code>)</td><td>Full-size workloads</td><td>Yes</td><td>What you should pick SimPoints from and report.</td></tr>
</table></div>
<p>A reportable run also runs test and train first, to verify the binaries, then times ref several times. Some ref workloads are several inputs run back to back; perlbench, for example, runs more than one Perl script, and the benchmark’s time covers all of them.</p>
<p><strong>Why train and ref are separate:</strong> with PGO, the compiler tunes code layout, inlining, and branch hints to the profiled input. Training on train and scoring on ref keeps a compiler from being tuned to the exact input it’s scored on.</p>
<h3>Other Inputs</h3>
<ul><li><strong>Alberta Workloads:</strong> extra inputs from the University of Alberta for many CPU 2017 benchmarks, some with scripts that generate unlimited new inputs. They’re for research such as PGO and studying how sensitive a program is to its input, not for official results or vendor comparisons.</li><li><strong>SimPoints and pinballs:</strong> not new inputs, but representative regions cut from ref runs.</li><li><strong>Your own inputs:</strong> fine for studying a design, but you can’t call the result a SPEC score, not even an estimated one.</li></ul>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/runcpu.html" target="_blank" rel="noopener">runcpu documentation</a>, <a href="https://research.spec.org/tools/overview/alberta-workloads" target="_blank" rel="noopener">Alberta Workloads</a>.</p>
<h3>Integer Benchmarks and Their Character</h3>
<div class="tbl"><table>
<tr><th>Benchmark</th><th>What it is</th><th>What it stresses</th></tr>
<tr><td>500.perlbench</td><td>Perl interpreter</td><td>Indirect branches, frontend</td></tr>
<tr><td>502.gcc</td><td>C compiler</td><td>Large code footprint, branches</td></tr>
<tr><td>505.mcf</td><td>Network flow optimization</td><td>Pointer chasing, memory latency</td></tr>
<tr><td>520.omnetpp</td><td>Discrete event simulation</td><td>Irregular memory, cache misses</td></tr>
<tr><td>523.xalancbmk</td><td>XML transformation</td><td>Pointer-heavy, branches</td></tr>
<tr><td>525.x264</td><td>Video encoding</td><td>Compute, SIMD</td></tr>
<tr><td>531.deepsjeng</td><td>Chess search</td><td>Hard-to-predict branches</td></tr>
<tr><td>541.leela</td><td>Go (game tree search)</td><td>Hard-to-predict branches</td></tr>
<tr><td>548.exchange2</td><td>Puzzle solver</td><td>Compute-bound, small footprint</td></tr>
<tr><td>557.xz</td><td>Compression</td><td>Data-dependent branches, memory</td></tr>
</table></div>
<h3>Floating-Point Highlights</h3>
<ul><li><strong>Bandwidth-bound streaming:</strong> 519.lbm, 503.bwaves, 549.fotonik3d, 554.roms.</li><li><strong>Compute-heavy:</strong> 508.namd, 544.nab, 511.povray, 538.imagick.</li><li><strong>Large, mixed applications:</strong> 521.wrf, 527.cam4, 526.blender, 510.parest, 507.cactuBSSN.</li></ul>
<h3>Limits</h3>
<p>SPEC is mostly single-application and has smaller code footprints than servers, browsers, or JIT-compiled code, so frontend features look less important than they are in practice. Supplement it with real workloads.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Compute a SPEC-style score for three benchmarks. Reference times: 1000 s, 2000 s, 1500 s. Measured: 250 s, 800 s, 300 s.</p>`,
        a: `<ol><li>Ratios (reference / measured): 4.0, 2.5, 5.0.</li><li>Score = geometric mean = (4.0 × 2.5 × 5.0)^(1/3) = 50^(1/3) ≈ <strong>3.68</strong>.</li></ol>`
      },
      {
        q: `<p>A SPECrate run uses 64 copies of one benchmark. The reference machine ran one copy in 1000 s; your system finishes all 64 copies in 400 s. What’s the ratio? Running one copy alone takes 300 s. What does that tell you?</p>`,
        a: `<ol><li>Rate ratio = 64 × 1000 / 400 = <strong>160</strong>.</li><li>One copy alone takes 300 s, but with 64 copies each takes about 400 s, so each copy is about 33% slower under load. Ideal scaling would give 64 × 1000 / 300 ≈ 213; you’re getting 75% of that. Look at shared LLC misses, DRAM bandwidth, and the all-core clock speed.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Which SPEC CPU 2017 benchmarks would you use to evaluate a new L2 prefetcher, and why?</p>`,
        a: `<ul><li><strong>Streaming, bandwidth-heavy:</strong> 519.lbm, 503.bwaves, 549.fotonik3d, 554.roms; the prefetcher should help and must not waste bandwidth.</li><li><strong>Irregular, pointer-heavy:</strong> 505.mcf, 520.omnetpp, 523.xalancbmk; check that inaccurate prefetches don't pollute the cache.</li><li><strong>Compute-bound controls:</strong> 548.exchange2, 508.namd, 541.leela; they should show no regression.</li><li>Also check rate mode with many copies, where shared LLC and DRAM bandwidth are under pressure.</li></ul>`
      },
      {
        q: `<p>What's the difference between SPECrate and SPECspeed, and which stresses the memory system more?</p>`,
        a: `<p>SPECspeed measures how fast one task finishes (one copy; may use OpenMP threads). SPECrate measures throughput by running many independent copies at once. Rate puts more pressure on shared LLC capacity, interconnect, and DRAM bandwidth, because every core is competing for them.</p>`
      },
      {
        q: `<p>Simulating ref is too slow, so a teammate evaluated a new prefetcher using the train inputs and reports +5% IPC. Do you trust it?</p>`,
        a: `<ol><li>Not yet. Train inputs often have smaller working sets and shorter, different phases, and a prefetcher is very sensitive to footprint and access patterns. A gain that shows up when data almost fits in the L2 may disappear, or reverse, when the working set is DRAM-sized.</li><li>Check that train and ref behave alike for these benchmarks (MPKI, footprint, basic-block profiles), or better, run SimPoints taken from ref.</li><li>Never report a train-based number as a SPEC result or estimate.</li></ol>`
      }
    ]
  }
},

{
  id: "workloads",
  region: "perf",
  title: "Types of Workloads",
  body: `
<p>Workloads differ in which part of the machine limits them. Name the bottleneck first, then pick the feature to study.</p>
<h3>By Bottleneck</h3>
<ul>
<li><strong>Compute-bound:</strong> high IPC, limited by execution width and ports (namd, exchange2).</li>
<li><strong>Memory latency-bound:</strong> dependent misses, low MLP (mcf, linked data structures).</li>
<li><strong>Memory bandwidth-bound:</strong> streaming arrays, limited by DRAM bandwidth (lbm, STREAM).</li>
<li><strong>Frontend-bound:</strong> large code footprints, i-cache and BTB misses (servers, browsers, interpreters).</li>
<li><strong>Branch-bound:</strong> data-dependent, hard-to-predict branches (game search, compression).</li>
<li><strong>Synchronization-bound:</strong> locks, barriers, and sharing limit multithreaded scaling.</li>
</ul>
<h3>By Domain</h3>
<ul>
<li><strong>Client:</strong> browsers, JavaScript, app launch, UI; latency and energy matter.</li>
<li><strong>Server and cloud:</strong> databases, web services, JVMs; throughput and tail latency.</li>
<li><strong>HPC:</strong> dense numerical kernels; floating point and bandwidth.</li>
<li><strong>ML:</strong> matrix multiplies are compute-bound; inference with large models is often bandwidth-bound.</li>
<li><strong>Media and games:</strong> SIMD-heavy, real-time deadlines.</li>
</ul>
<h3>Top-Down Analysis</h3>
<p>Intel's top-down method splits pipeline slots into retiring, front-end bound, bad speculation, and back-end bound (memory or core), then drills into the largest category. See <a href="#/perf-bottlenecks">Bottleneck types</a> for the full method and how to tell the bottlenecks apart.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A top-down breakdown: retiring 30%, frontend-bound 35%, bad speculation 10%, backend-bound 25%. What kind of workload is this, and what do you check next?</p>`,
        a: `<ol><li>Frontend-bound dominates: the core is starved of instructions.</li><li>Likely a large code footprint (server, browser, interpreter, JIT).</li><li>Check L1I and L2 instruction MPKI, iTLB misses, BTB misses, and decode or micro-op cache behavior.</li><li>Features to evaluate: bigger BTB, instruction prefetching (fetch-directed prefetching with a decoupled frontend), bigger L1I or micro-op cache.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>How would you build a workload set to evaluate a phone CPU versus a server CPU?</p>`,
        a: `<p>Phone: short bursty interactive work (browser benchmarks, app launches, UI rendering, JavaScript), with single-thread latency and energy as primary metrics, plus some media and light ML. Server: databases, web serving, key-value stores, JVM and microservices with huge code footprints and many threads, measured by throughput at a latency target and performance per watt. Both should include SPEC as a common baseline, but neither should rely on it alone.</p>`
      }
    ]
  }
}
]);
