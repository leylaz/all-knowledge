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
<li><a href="#/perf-stage-stalls">Stalls by pipeline stage</a>: where each stage stalls and why, how to trace a stall back to its cause, and the cycles-per-iteration bound each stage and structure sets.</li>
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
<p>To group these causes into front-end bound, bad speculation, memory-bound, and core-bound, see <a href="#/perf-bottlenecks/topdown">the top-down method</a>. To trace a stall seen at one stage back to the stage that caused it, see <a href="#/perf-stage-stalls">Stalls by pipeline stage</a>.</p>
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
  id: "perf-stage-stalls",
  region: "perf",
  title: "Stalls by Pipeline Stage",
  sections: [
    { id: "symptom-cause", label: "Where a Stall Shows vs. Where It Starts" },
    { id: "stages", label: "Stage by Stage" },
    { id: "accounting", label: "Where to Count: Rename and Retire" },
    { id: "model", label: "Finding the Cause in a Model" },
    { id: "silicon", label: "Finding the Cause on Silicon" },
    { id: "bounds", label: "Bounding Each Stage" },
    { id: "fe-bounds", label: "Front-End Bounds" },
    { id: "be-bounds", label: "Back-End Bounds" },
    { id: "window-bounds", label: "Window Bounds" },
    { id: "mem-bounds", label: "Memory Bounds" },
    { id: "chip-bounds", label: "Chip-Level Bounds" },
    { id: "procedure", label: "Procedure and Traps" }
  ],
  body: `
<p><a href="#/perf-stalls">Stall causes</a> lists every reason a cycle can be lost. This page looks at the same problem by <em>place</em>: which stage of an out-of-order core stops moving work, why that stage in particular, and how an engineer traces a stall seen at one stage back to the stage that caused it.</p>

<h3 id="sec-symptom-cause">Where a Stall Shows vs. Where It Starts</h3>
<p>Stage <em>i</em> passes fewer instructions than its width in a cycle for one of three reasons:</p>
<ul>
<li><strong>Starved:</strong> stage <em>i</em> − 1 gave it nothing (an empty queue in front of it). The cause is upstream.</li>
<li><strong>Back-pressured:</strong> stage <em>i</em> + 1, or a structure it allocates into, has no room. The cause is downstream.</li>
<li><strong>Self-limited:</strong> the stage itself can't keep up: a decoder that handles one complex instruction per cycle, a busy divider, a retire width limit.</li>
</ul>
<p>Stalls spread in both directions. Back-pressure travels <em>upstream</em>: a load miss at the head of the ROB blocks retirement, the ROB fills, rename stalls, the queue between decode and rename fills, and finally fetch stops. Starvation travels <em>downstream</em>: an instruction cache miss empties the fetch queue, then the decode queue, and then rename and issue have nothing to do. So in one long miss nearly every stage reports "stalled," and only one of them is the cause. The rule for finding it: <strong>follow back-pressure downstream and starvation upstream until you reach the stage that is neither starved nor back-pressured.</strong> That stage is self-limited, and the lost cycles belong to it.</p>
<pre><code>One DRAM miss, watched stage by stage (arrows show which way the stall spreads):

  fetch  &lt;-  decode  &lt;-  rename  &lt;-  ROB full  &lt;-  retire blocked  &lt;-  load miss at ROB head
  stalls    stalls      stalls      (symptom)     (symptom)            (cause: memory)

One instruction cache miss:

  I-cache miss  -&gt;  fetch queue empty  -&gt;  decode idle  -&gt;  rename idle  -&gt;  issue idle
  (cause: front end)  (symptom)            (symptom)       (symptom)        (symptom)</code></pre>
<p>Step through the first case below. Rename reports "ROB full" for about twenty cycles, but the cause is the load at the head; raise the ROB size until it no longer fills and only then does rename stop stalling.</p>
<div class="trace" data-trace="rob-fill"></div>
<details class="ex"><summary>Worked example: one DRAM miss, four stall counters</summary>
<p><strong>Question.</strong> Your model of an Arm Neoverse N1 core (as in AWS Graviton2: 4-wide rename, 128-entry ROB, 2.5 GHz) has a stall counter at retire, rename, decode, and fetch. A load misses to DRAM (about 120 ns, so 300 cycles) when the ROB is empty; every instruction behind it is independent and hits in cache. Assume a 16-entry queue between decode and rename and a 32-instruction fetch queue. What does each counter report for this one miss, and which stage gets the blame?</p>
<ol start="0">
<li><strong>Retire.</strong> The load is the oldest instruction from cycle 0, so nothing retires until it returns: <strong>300</strong> stalled cycles.</li>
<li><strong>Rename.</strong> It keeps going until the ROB is full: 127 more entries at 4 per cycle ≈ 32 cycles. Then "ROB full" for 300 − 32 = <strong>268</strong> cycles.</li>
<li><strong>Decode.</strong> Once rename stops, decode fills its 16-entry output queue in 16 / 4 = 4 cycles, then stalls: ≈ <strong>264</strong> cycles.</li>
<li><strong>Fetch.</strong> The 32-entry fetch queue fills in 8 more cycles: ≈ <strong>256</strong> cycles.</li>
<li><strong>Sum:</strong> 300 + 268 + 264 + 256 = 1,088 "stalled" cycles for a 300-cycle event, 363%. Only one of the four is the cause.</li>
<li><strong>Apply the rule.</strong> Fetch and decode have full output queues: back-pressured, so follow downstream. Rename is waiting on a full ROB: back-pressured, follow downstream. Retire has entries but the head isn't done: follow to the head. The load is neither starved nor back-pressured; it's waiting on DRAM, so it's self-limited. All the lost cycles belong to <strong>memory</strong>.</li>
<li><strong>How many cycles were really lost?</strong> The 268 cycles of stalled rename (268 × 4 = 1,072 slots). The first 32 cycles weren't lost: that work just retires later. Hiding the whole miss would take a window of about 300 × 4 = 1,200 entries, which is why the real fixes are prefetching or overlapping this miss with others, not a bigger ROB.</li>
</ol>
<p><strong>Follow-up the interviewer may ask:</strong> "Now the fetch queue is empty, decode and rename are idle, and the ROB is only 40 of 128 full." Rename and decode are starved, so follow upstream: fetch is waiting on an instruction cache miss, which is self-limited. That's a <strong>front-end</strong> stall even though the back end shows idle cycles.</p>
</details>

<h3 id="sec-stages">Stage by Stage</h3>
<div class="tbl"><table>
<tr><th>Stage</th><th>Why it stalls there</th><th>How to tell it's the real cause</th></tr>
<tr><td>0. Fetch and branch prediction</td><td><ul><li>Instruction cache or instruction TLB miss</li><li>BTB miss, so decode has to redirect</li><li>The bubble after a taken branch when the predictor needs more than one cycle</li><li>Fetch blocks cut short at a cache line or taken branch</li><li>Fetch also stops when the fetch queue is full, but that's back-pressure from below</li></ul></td><td><ul><li>Fetch queue often empty while the back end has room</li><li>Instruction cache and BTB MPKI are high</li><li>Per-PC miss counts point at code with a large footprint (servers, browsers, JITs, compilers)</li></ul></td></tr>
<tr><td>1. Decode</td><td><ul><li>Fewer complex decoders than simple ones (an instruction that cracks into several micro-ops may only go to decoder 0)</li><li>Microcoded instructions</li><li>On x86, instruction-length decoding limits such as length-changing prefixes</li><li>Misses in the decoded micro-op cache that force the slower legacy decoders, with a switch penalty each way</li></ul></td><td><ul><li>Fetch queue has instructions, but micro-ops delivered per cycle stay below width</li><li>Check micro-op cache hit rate and how many micro-ops came from microcode</li></ul></td></tr>
<tr><td>2. Rename and allocate</td><td><ul><li>Almost always back-pressure: ROB, issue queue, load queue, store queue, or physical register free list is empty, or all branch checkpoints are in use</li><li>Rename also stops itself at serializing instructions</li><li>Its own width is a throughput limit, not a stall</li></ul></td><td><ul><li>Count which resource the next instruction couldn't get</li><li>A full structure is a symptom, so ask <em>why</em> it's full:<ul><li>A full ROB points to retire</li><li>A full issue queue points to issue (operands not ready)</li><li>A full store queue points to stores draining slowly to the cache</li></ul></li></ul></td></tr>
<tr><td>3. Issue (schedule)</td><td><ul><li>Instructions are in the issue queue but none are ready (dependency chains, often on a missing load)</li><li>Ready instructions compete for the same port</li><li>Replays after a load that was expected to hit missed, so its dependents were woken early</li></ul></td><td><ul><li>Cycles with zero issued while the issue queue isn't empty, split by what the oldest waiting instruction is waiting on (load or long-latency operation)</li><li>Port utilization shows contention: one port near 100% while others are idle</li></ul></td></tr>
<tr><td>4. Execute</td><td><ul><li>A non-pipelined unit such as the divider is still busy</li><li>Too few units of one type (for example, two shuffle ports for vector code that needs three)</li><li>Extra bypass latency between execution domains (integer to vector)</li></ul></td><td><ul><li>Divider busy cycles</li><li>Per-unit utilization near its maximum</li><li>Ready-but-not-issued instructions all waiting for the same unit</li></ul></td></tr>
<tr><td>5. Memory (load/store unit)</td><td><ul><li>L1 data cache misses with MSHRs full</li><li>Data TLB misses and page walks</li><li>Store-forwarding failures on partial overlap</li><li>Loads waiting for older store addresses</li><li>Cache bank conflicts</li><li>Memory-ordering violations, which flush</li></ul></td><td><ul><li>Cycles stalled while an L1, L2, or last-level miss is outstanding</li><li>MSHR-full cycles</li><li>Store-forwarding blocks</li><li>Page-walk cycles</li><li>Memory-level parallelism separates latency-bound from bandwidth-bound (see <a href="#/perf-bottlenecks/diagnose">Telling them apart</a>)</li></ul></td></tr>
<tr><td>6. Retire (commit)</td><td><ul><li>The instruction at the ROB head hasn't finished: usually a load miss or a long-latency operation</li><li>Retirement is also where precise state is updated, so exceptions, interrupts, and some machine clears (memory-ordering violations, self-modifying code) are handled there, flushing everything younger</li><li>Retire width can limit throughput briefly after a long stall ends</li></ul></td><td><ul><li>Record <strong>what instruction is at the ROB head</strong> on every cycle that nothing retires, and why it isn't done</li><li>Retire-width histogram: many 0-retire cycles followed by bursts at full width is the signature of long misses</li></ul></td></tr>
</table></div>
<p>After retirement, stores still have to leave the store buffer and write the cache. That doesn't block retirement directly, but a store buffer that drains slowly (store misses, or a fence waiting for it to empty) fills up and shows up at rename as "store queue full."</p>
<details class="ex"><summary>Worked example: three counter profiles, three different stages</summary>
<p><strong>Question.</strong> You get counter summaries from three workloads. For each, name the stage that is the real cause, the evidence from the table, and the fix.</p>
<p><strong>Case 0: a hash-table loop on an Intel Ice Lake core</strong> (5-wide rename). Rename reports "scheduler (RS) full" on 70% of cycles, the ROB is rarely more than half full, and <code>ARITH.DIVIDER_ACTIVE</code> is 98% of cycles. Each iteration has 10 fused micro-ops, including one 64-bit <code>div</code> to compute <code>hash % buckets</code>.</p>
<ol start="0">
<li>Rename's "RS full" is back-pressure, so ask why the scheduler is full: the oldest waiting micro-ops are the divide and the micro-ops that depend on it.</li>
<li>The divider is busy almost every cycle. A 64-bit divide on Ice Lake takes roughly 15 cycles and accepts a new one about every 10 cycles (approximate, from Agner Fog's tables), so the bound is about 10 cycles per iteration, against 10 / 5 = 2 for rename.</li>
<li>Cause: <strong>execute</strong> (a non-pipelined unit). Fix: replace the divide, for example with a multiply by a precomputed reciprocal (libdivide) or a power-of-two bucket count with a mask. Expect up to about 5× faster, until rename binds.</li>
</ol>
<p><strong>Case 1: a packet parser on the same core.</strong> Cycles with zero micro-ops issued but a non-empty scheduler: 18%. The oldest waiting instruction is a load, but the L1 miss rate is under 1%. <code>LD_BLOCKS.STORE_FORWARD</code> fires once every 40 instructions.</p>
<ol start="0">
<li>The load isn't missing; it's blocked. That points at the memory stage, not at the caches.</li>
<li>The code writes a header as two 4-byte stores and then reads it back as one 8-byte load. The load overlaps two stores, so it can't forward and waits for both to reach L1, roughly 10 to 15 cycles.</li>
<li>Cost when it's on the critical path: 1 / 40 × ~12 ≈ 0.3 cycles per instruction, a big share of a loop running at a CPI around 0.5.</li>
<li>Cause: <strong>memory (store-forwarding failure)</strong>. Fix: load with the same size and alignment as the stores, or keep the value in a register.</li>
</ol>
<p><strong>Case 2: a large Java service</strong> (JIT-compiled, hundreds of MB of hot code). The fetch queue is empty on 22% of cycles while the ROB is 30% full on average; instruction cache MPKI is 18, instruction TLB MPKI 1.5, BTB MPKI 8.</p>
<ol start="0">
<li>The back end has room, and nothing is arriving: rename is starved, so follow upstream to fetch.</li>
<li>All three front-end miss rates are high, which is typical of warehouse-scale code (Kanev et al., ISCA 2015, report front-end stalls in the 15% to 30% range for Google's fleet).</li>
<li>Cause: <strong>fetch</strong>. Fixes: huge pages for the code cache (cuts instruction TLB misses), profile-guided layout such as BOLT (packs hot code into fewer lines and makes hot branches fall through), and JIT code-cache compaction.</li>
</ol>
</details>

<h3 id="sec-accounting">Where to Count: Rename and Retire</h3>
<p>If every stage counts its own stalls, the totals add up to far more than 100% of cycles, because one miss is counted at five stages. Good accounting picks one point in the pipeline and charges each lost slot there exactly once:</p>
<ul>
<li><strong>Rename/allocate is the usual accounting point.</strong> It sits on the boundary between front end and back end, so a slot that goes unused there is either <em>front-end bound</em> (the queue in front of rename was empty) or <em>back-end bound</em> (some back-end resource was full). Slots that are used are later sorted into <em>retiring</em> or <em>bad speculation</em> depending on whether their instructions retired. This is exactly Intel's top-down method (see <a href="#/perf-bottlenecks/topdown">The top-down method</a>).</li>
<li><strong>Retire is where back-end stalls get explained.</strong> Rename can only say "the ROB was full." The ROB head says why: a load that missed in L2, a divide, a fence. So back-end slots counted at rename are assigned a cause by looking at the ROB head (or the oldest waiting instruction) in the same cycle.</li>
<li><strong>The two can disagree, and that's expected.</strong> A retire-side counter starts counting as soon as a missing load reaches the ROB head, but rename keeps working until the ROB fills, so part of that time isn't lost. Rename-side stalls measure lost throughput; retire-side stalls measure how long the oldest instruction blocked. Use rename-side counts for CPI stacks and retire-side observations to name the cause.</li>
</ul>
<details class="ex"><summary>Worked example: slot accounting over eight cycles</summary>
<p><strong>Question.</strong> A model of an AMD Zen 3 core (6-wide dispatch) logs eight cycles at rename. Classify every slot into top-down level 1, then explain why per-stage counters would disagree.</p>
<div class="tbl"><table>
<tr><th>Cycle</th><th>Micro-ops waiting in front of rename</th><th>Dispatched</th><th>What happened</th></tr>
<tr><td>0</td><td>≥ 6</td><td>6</td><td>All retire later</td></tr>
<tr><td>1</td><td>≥ 6</td><td>6</td><td>2 of them are past a mispredicted branch and get flushed</td></tr>
<tr><td>2</td><td>2</td><td>2</td><td>Instruction cache miss: the queue is draining</td></tr>
<tr><td>3</td><td>0</td><td>0</td><td>Still waiting on the instruction cache</td></tr>
<tr><td>4</td><td>≥ 6</td><td>0</td><td>ROB full; head is a load that missed L2</td></tr>
<tr><td>5</td><td>≥ 6</td><td>0</td><td>ROB full; same load</td></tr>
<tr><td>6</td><td>≥ 6</td><td>3</td><td>The load returned; 3 entries retired and freed</td></tr>
<tr><td>7</td><td>≥ 6</td><td>6</td><td>All retire later</td></tr>
</table></div>
<ol start="0">
<li>Total slots = 8 × 6 = 48.</li>
<li><strong>Retiring:</strong> dispatched = 6 + 6 + 2 + 0 + 0 + 0 + 3 + 6 = 23, minus 2 flushed = 21 slots, 43.8%.</li>
<li><strong>Bad speculation:</strong> the 2 flushed micro-ops, 4.2% (the refill after the redirect falls outside this window; it would count here too).</li>
<li><strong>Front-end bound:</strong> unused slots with too little in the queue: cycle 2 (4) + cycle 3 (6) = 10 slots, 20.8%.</li>
<li><strong>Back-end bound:</strong> unused slots with a full queue: cycles 4 and 5 (6 each) + cycle 6 (3) = 15 slots, 31.3%. The ROB head says why: charge all 15 to "L2 miss" in the CPI stack.</li>
<li>Check: 21 + 2 + 10 + 15 = 48. Each slot was counted once.</li>
<li><strong>Per-stage counters disagree.</strong> Fetch stalled in cycles 2 and 3 (instruction cache) and in 4 to 6 (queue full, back-pressure): 5 cycles. Decode: about the same 5. Rename: cycles 2 to 6, 5 cycles. Retire: no retirement while the L2 miss was at the head, say cycles 3 to 5, 3 cycles. That's about 18 "stalled" stage-cycles in an 8-cycle window, 225%, because both events were counted at every stage they passed through.</li>
</ol>
</details>

<h3 id="sec-model">Finding the Cause in a Model</h3>
<p>A performance model can see every structure every cycle, so it can find causes exactly instead of inferring them:</p>
<ol start="0">
<li><strong>Stall reasons with a fixed priority.</strong> Every cycle, each stage records why it passed fewer than its width, choosing one reason by a fixed order (for example, at rename: ROB full, then the instruction's issue queue, then load queue or store queue, then free registers). Counting only the first missing resource keeps the counts from overlapping. See <a href="#/perf-stalls/details">Details that are easy to get wrong</a>.</li>
<li><strong>Blame propagation.</strong> When rename is stalled on a full ROB, record the class of the instruction at the ROB head (L1 miss, L2 miss, last-level miss, DRAM, divide, fence) and charge the slot to that class. This turns a symptom counter into a cause counter and produces a CPI stack directly.</li>
<li><strong>Occupancy histograms.</strong> A structure that's full 30% of the time is a bottleneck candidate; one that's never more than half full isn't, however large its stall count looks elsewhere (see <a href="#/perf-stats/tracked">What's tracked, structure by structure</a>).</li>
<li><strong>Pipeline traces.</strong> Record each instruction's cycle at fetch, decode, rename, issue, complete, and retire, and view them in a pipeline viewer (gem5's O3 pipeline view, Konata). A stall shows up as a gap between two stages, and the instruction that every other instruction is lined up behind is visible directly.</li>
<li><strong>Per-PC attribution.</strong> Charge stall cycles to the PC of the instruction responsible (the missing load, the mispredicted branch). A handful of PCs usually accounts for most of the loss.</li>
<li><strong>Idealization experiments.</strong> Confirm a suspected cause by removing it: make the L2 always hit, give the ROB unlimited entries, use a perfect branch predictor. The IPC gained is an upper bound on what fixing that stage can deliver, and if it's small, the stall counter was pointing at a symptom.</li>
</ol>
<details class="ex"><summary>Worked example: deciding what to fix on a pointer-heavy benchmark</summary>
<p><strong>Question.</strong> On SPEC CPU2017 <code>505.mcf_r</code> (network simplex over large linked structures), your model of a 6-wide core runs at IPC 0.62 and reports rename stalled on "ROB full" 41% of cycles. The team wants to double the ROB. How do you use the model to decide?</p>
<ol start="0">
<li><strong>Blame propagation first.</strong> In the ROB-full cycles, the head is: a last-level-cache miss 64%, an L2 hit 14%, a mispredicted branch still waiting on its operand 12%, other 10%. Rename's "ROB full" is a symptom; the cause is mostly DRAM latency.</li>
<li><strong>Is the window the limit, or the misses?</strong> Look at the misses in flight while the ROB is full: a histogram centered at 1 to 2 means the misses are dependent (pointer chasing), and a bigger ROB can't overlap them. A histogram near the MSHR limit means a bigger window would help.</li>
<li><strong>Per-PC attribution.</strong> Charge the stall cycles to the PC of the instruction at the head. In mcf, a handful of loads that walk arcs and nodes typically account for most of it, and they load the next pointer, which confirms the dependent-miss reading.</li>
<li><strong>Idealization experiments.</strong> Suppose the model reports:
<div class="tbl"><table>
<tr><th>Experiment</th><th>IPC</th><th>Gain</th></tr>
<tr><td>Baseline</td><td>0.62</td><td>—</td></tr>
<tr><td>2× ROB (and matching queues)</td><td>0.66</td><td>+6%</td></tr>
<tr><td>Perfect branch prediction</td><td>0.71</td><td>+15%</td></tr>
<tr><td>Last-level cache always hits</td><td>0.95</td><td>+53%</td></tr>
<tr><td>Both of the last two</td><td>1.35</td><td>+118%</td></tr>
</table></div></li>
<li><strong>Read the table.</strong> The bigger ROB is worth 6%, so the counter was mostly pointing at a symptom. Memory is the cause. The two ideals together give far more than the sum of the separate gains (+118% vs. +68%): the mispredicted branches depend on missing loads, so each one resolves late and flushes the misses queued behind it. Fixing either one alone leaves the other in the way.</li>
<li><strong>Recommendation:</strong> spend the area on memory-side help (a prefetcher that can follow pointers, or a lower-latency path to memory) and on predicting branches that depend on loads, not on a larger ROB.</li>
</ol>
</details>

<h3 id="sec-silicon">Finding the Cause on Silicon</h3>
<p>Hardware has only a few counters that can run at once, so the work is done in rounds, from the top level down:</p>
<ol start="0">
<li><strong>Top-down level 1</strong> from a few counters: slots offered at rename, micro-ops not delivered by the front end, micro-ops issued, micro-ops retired, and recovery cycles after flushes. On Intel these are events such as <code>IDQ_UOPS_NOT_DELIVERED</code>, <code>UOPS_ISSUED.ANY</code>, <code>UOPS_RETIRED.RETIRE_SLOTS</code>, and <code>INT_MISC.RECOVERY_CYCLES</code> (names vary by generation); Arm's PMU defines <code>STALL_FRONTEND</code> and <code>STALL_BACKEND</code>, and AMD documents its own pipeline-utilization breakdown for Zen. Tools like Linux <code>perf stat --topdown</code>, pmu-tools <code>toplev</code>, and VTune compute this.</li>
<li><strong>Drill into the largest category.</strong> For back-end bound, split memory from core with counters such as "cycles stalled with an L1/L2/L3 miss outstanding" (Intel <code>CYCLE_ACTIVITY.STALLS_L3_MISS</code> and similar), resource-stall counts by structure, port utilization, and divider-active cycles. For front-end bound, split latency (instruction cache and TLB misses, redirects) from bandwidth (decoder and micro-op cache limits).</li>
<li><strong>Find the code.</strong> Precise sampling (Intel PEBS, AMD IBS, Arm SPE) tags a sample with the PC and often the load latency or data source of the instruction that caused the event, without the "skid" of ordinary sampling, which can blame an instruction several places after the real one.</li>
<li><strong>Confirm with a microbenchmark</strong> that isolates the suspected cause (a pointer chase, a divide chain, a partial-overlap store-forward), then compare its counter signature against the real workload.</li>
</ol>
<details class="ex"><summary>Worked example: drilling down on an Arm server</summary>
<p><strong>Question.</strong> A key-value store runs on AWS Graviton3 (Arm Neoverse V1, 2.6 GHz). <code>perf stat -e cycles,instructions,stall_frontend,stall_backend</code> over 10 seconds of one core reports 26.0 × 10<sup>9</sup> cycles, 23.4 × 10<sup>9</sup> instructions, 2.9 × 10<sup>9</sup> <code>STALL_FRONTEND</code> cycles, and 13.5 × 10<sup>9</sup> <code>STALL_BACKEND</code> cycles. Walk the procedure.</p>
<ol start="0">
<li><strong>Level 1.</strong> IPC = 23.4 / 26.0 = 0.90, far below what this wide core can sustain. Arm's <code>STALL_*</code> events count <em>cycles</em> in which nothing was dispatched, not slots: front end 2.9 / 26.0 = 11%, back end 13.5 / 26.0 = 52%. Back end dominates.</li>
<li><strong>Drill into the back end.</strong> Second round: <code>STALL_BACKEND_MEM</code> = 10.4 × 10<sup>9</sup> (77% of back-end stalls), so memory, not core resources. Then <code>L1D_CACHE_REFILL</code>, <code>L2D_CACHE_REFILL</code>, <code>LL_CACHE_MISS_RD</code>, and <code>DTLB_WALK</code>: suppose L2 refills are 21 per kilo-instruction and <code>DTLB_WALK</code> is 9 per kilo-instruction. Nine page walks per thousand instructions is very high: the hash table spans tens of GB in 4 KB pages, far beyond what the TLBs cover.</li>
<li><strong>Find the code.</strong> <code>perf record -e arm_spe_0//</code> (the Statistical Profiling Extension) samples loads with their PC, latency, and whether they walked the page table. Most of the samples with walks fall on the bucket load in the probe function.</li>
<li><strong>Confirm.</strong> A microbenchmark that probes a table of the same size at random reproduces the walk rate with 4 KB pages and drops it to near zero with transparent huge pages. Rerun the service with huge pages and check that <code>DTLB_WALK</code> and <code>STALL_BACKEND_MEM</code> both fall; if only the first falls, the cache misses were the bigger cost all along.</li>
</ol>
</details>

<h3 id="sec-bounds">Bounding Each Stage</h3>
<p>Counters say which stage is stalling; a bound says how many cycles per loop iteration a stage can cost, before running anything. In steady state, time per iteration is the largest of every resource's bound, plus penalties that can't overlap with anything:</p>
<div class="math">\\[ T_{iter} \\approx \\max_k B_k \\;+\\; \\sum_j r_j \\, P_j \\]</div>
<p>Each \\(B_k\\) is a lower limit in cycles per iteration set by one stage or structure; the largest is the bottleneck. \\(r_j\\) is how often a serializing event (a branch mispredict, a flush, a coherence transfer) happens per iteration, and \\(P_j\\) is its unhidden penalty. Bandwidth and capacity bounds overlap with each other, so take their max; serializing penalties don't, so add them.</p>
<p>Every bound is one of three kinds:</p>
<div class="tbl"><table>
<tr><th>Kind</th><th>Bound (cycles/iteration)</th><th>Why</th><th>What helps</th></tr>
<tr><td>0. Bandwidth</td><td>\\(N / W\\)</td><td>A stage handles at most W items per cycle, so N items per iteration take at least N / W cycles.</td><td>A wider stage, or fewer items</td></tr>
<tr><td>1. Capacity (Little's law)</td><td>\\(E_s R_s / C_s\\)</td><td>Average occupancy = throughput × residency. If each iteration holds E entries of a C-entry structure for R cycles, then E × R × (iterations per cycle) ≤ C.</td><td>More entries, or shorter residency</td></tr>
<tr><td>2. Latency (dependency)</td><td>\\(\\sum L_i\\) over the loop-carried critical path</td><td>The next iteration's chain can't start until this one's finishes.</td><td>Only shorter latencies or a restructured dependency; no width or window size helps</td></tr>
</table></div>
<p>Notation, all per iteration: \\(N_i\\) and \\(N_u\\) instructions and micro-ops; \\(N_{ld}\\), \\(N_{st}\\), \\(N_{br}\\), \\(N_{tk}\\) loads, stores, branches, and taken branches; \\(N_k\\) micro-ops that can only run on port class k; \\(W_x\\) the width of stage x; \\(P_k\\) the number of ports or units of class k; \\(C_s\\) the entries in structure s, \\(E_s\\) the entries one iteration uses, and \\(R_s\\) the cycles each entry stays; \\(L_x\\) a latency and \\(m_x\\) a miss rate per access.</p>
<p><strong>Latency vs. throughput.</strong> Latency is how long one iteration takes from start to finish; throughput is how often iterations finish. Out-of-order execution hides latency by overlapping iterations, until a capacity bound (kind 1) or a dependency (kind 2) stops the overlap. The tables below give the bounds for each part of the pipeline, matching the stages above.</p>
<p><strong>Why per iteration.</strong> These are throughput bounds, so they need work that repeats: a steady state where start-up costs (cold caches, an untrained predictor, pipeline fill) are spread over many repetitions, and where iteration i + 1 overlaps iteration i the way the max assumes. A hot loop is the natural unit, its per-iteration counts are exact, and in most compute code it's where the time goes (the 90/10 rule, Hennessy &amp; Patterson, Ch. 1). Code with no hot loop keeps the same bounds with a different unit. For server-style code whose time is spread over thousands of functions (databases, browsers, compilers), count per instruction or per 1,000 instructions, \\( \\text{CPI} \\approx \\max_k B_k + \\sum_j \\text{MPKI}_j \\, P_j / 1000 \\), or per request or transaction. That's where the instruction cache, ITLB, and BTB rows below dominate: Google's warehouse-scale profiling (Kanev et al., ISCA 2015) found front-end stalls take a large share of cycles for exactly this reason. Code that runs once has no steady state; its critical path and warm-up set the time, and these bounds don't apply.</p>
<p>Try it: the calculator below takes the main bound from each table that follows and adds the serialized penalties. Change one number at a time and watch which row becomes the bottleneck.</p>
<div class="calc" data-calc="bounds"></div>
<details class="ex"><summary>Worked example (interview level): bounding a dot product on Zen 3</summary>
<p><strong>Question.</strong> "Here is a double-precision dot product, vectorized with AVX2, on an AMD Zen 3 core (Ryzen 9 5950X at 4.5 GHz). How many cycles per iteration, what's the bottleneck, and how close to peak FLOP/s can it get? Then tell me what changes if the arrays don't fit in L1."</p>
<pre><code>loop:
  vmovupd     ymm1, [rsi + rax]            ; load 4 doubles of a
  vfmadd231pd ymm0, ymm1, [rdi + rax]      ; load 4 doubles of b, ymm0 += a * b
  add         rax, 32
  cmp         rax, rdx
  jne         loop                         ; fuses with cmp</code></pre>
<p><strong>The machine</strong> (from AMD's optimization guide and Agner Fog's tables): micro-op cache delivers 8 macro-ops per cycle; dispatch 6 macro-ops per cycle; 1 taken branch per cycle; 2 FMA pipes, FMA latency 4 cycles; 3 load pipes, but the L1 data cache delivers 2 × 32 B = 64 B per cycle, so at most 2 ymm loads per cycle; L2 to L1 bandwidth 32 B per cycle; L2 latency about 12 cycles; 24 L1 miss buffers. Peak = 2 FMA × 4 doubles × 2 FLOPs = 16 FLOPs per cycle.</p>
<p><strong>Step 0: count the work per iteration.</strong> 4 macro-ops (the FMA with a memory operand is one macro-op; <code>cmp</code> + <code>jne</code> fuse), 2 loads moving 64 B, 1 FMA, 1 taken branch, 8 FLOPs.</p>
<p><strong>Step 1: the dependency.</strong> <code>ymm0</code> is read and written by every FMA, so the loop-carried chain is one FMA: B<sub>dep</sub> = 4 cycles. The loads don't depend on each other.</p>
<p>A loop-carried chain is a value one iteration writes and the next iteration reads (see <a href="#/ooo-tradeoffs/little">Where It Buys Little</a>). This loop has two:</p>
<div class="tbl"><table>
<tr><th>Value</th><th>Written by</th><th>Read next iteration by</th><th>Latency per iteration</th></tr>
<tr><td><code>rax</code></td><td><code>add rax, 32</code></td><td>the next <code>add</code>, both load addresses, <code>cmp</code></td><td>1 cycle</td></tr>
<tr><td><code>ymm0</code></td><td><code>vfmadd231pd</code></td><td>the next FMA's addend (<code>ymm0 += &hellip;</code>)</td><td>4 cycles</td></tr>
</table></div>
<p><code>ymm1</code> isn't loop-carried: every iteration loads a fresh value, and renaming gives each iteration its own physical register. Both loads depend only on <code>rax</code>, whose chain advances 1 cycle per iteration, so the loads run ahead of the FMAs. B<sub>dep</sub> is the longest chain: max(1, 4) = 4 cycles.</p>
<p>Why 4: a 256-bit FMA on Zen 3 takes 4 cycles from inputs ready to result ready, and each FMA needs the previous one's result as its addend, so the FMAs run end to end:</p>
<pre><code>cycle:  0   1   2   3   4   5   6   7   8
FMA 0   [==============]                       writes ymm0 at the end of cycle 3
FMA 1                   [==============]       can't start until cycle 4
FMA 2                                   [===   starts at cycle 8
loads   ld  ld  ld  ld  ld  ld  ...            already done, waiting</code></pre>
<p>The chain isn't load latency plus FMA latency. The FMA's memory operand depends only on <code>rax</code>, so its load finishes early. By the time the addend is ready, the multiplicands are already there, and only the 4-cycle FMA computation sits on the chain. (Some Arm cores forward an accumulator into a dependent multiply-accumulate late, which shortens accumulate chains below the full FMA latency; Zen 3 doesn't.) One accumulator allows 1 FMA in flight, but keeping both pipes busy needs 4 × 2 = 8, which is why Step 3 splits the sum.</p>
<p><strong>Step 2: all the bounds.</strong></p>
<div class="tbl"><table>
<tr><th>Bound</th><th>Formula</th><th>Cycles/iteration</th></tr>
<tr><td>Micro-op cache</td><td>4 / 8</td><td>0.50</td></tr>
<tr><td>Taken branches</td><td>1 / 1</td><td>1.00</td></tr>
<tr><td>Dispatch</td><td>4 / 6</td><td>0.67</td></tr>
<tr><td>FMA ports</td><td>1 / 2</td><td>0.50</td></tr>
<tr><td>Load pipes (count)</td><td>2 / 3</td><td>0.67</td></tr>
<tr><td>L1 bytes</td><td>64 / 64</td><td>1.00</td></tr>
<tr><td><strong>Loop-carried FMA</strong></td><td>L<sub>FMA</sub></td><td><strong>4.00</strong></td></tr>
</table></div>
<p>T ≈ 4 cycles per iteration: 8 FLOPs / 4 cycles = 2 FLOPs per cycle, <strong>12.5% of peak</strong>. The hardware is idle 75% of the time waiting on one register. Serialized penalties: the loop-exit branch mispredicts once per call (about 13 cycles on Zen 3); for a 1,000-iteration call that's 0.013 cycles per iteration, negligible.</p>
<p><strong>Step 3: fix the dependency.</strong> Use k independent accumulators (unroll by k, add them at the end). The rule of thumb from the text, k = L<sub>FMA</sub> × P<sub>FMA</sub> = 4 × 2 = 8, assumes the FMA ports are the next bound. They aren't: check what binds next. With k = 4 (unroll by 4), per unrolled iteration:</p>
<div class="tbl"><table>
<tr><th>Bound</th><th>Formula</th><th>Cycles per unrolled iteration (4 vectors)</th></tr>
<tr><td>Micro-op cache</td><td>10 / 8</td><td>1.25</td></tr>
<tr><td>Taken branches</td><td>1 / 1</td><td>1.00</td></tr>
<tr><td>Dispatch</td><td>10 / 6</td><td>1.67</td></tr>
<tr><td>FMA ports</td><td>4 / 2</td><td>2.00</td></tr>
<tr><td>Load pipes (count)</td><td>8 / 3</td><td>2.67</td></tr>
<tr><td><strong>L1 bytes</strong></td><td>256 / 64</td><td><strong>4.00</strong></td></tr>
<tr><td><strong>Loop-carried FMA</strong></td><td>each accumulator once per iteration</td><td><strong>4.00</strong></td></tr>
</table></div>
<p>(10 macro-ops = 4 loads + 4 FMAs + <code>add</code> + fused <code>cmp</code>/<code>jne</code>.) T = 4 cycles per 4 vectors = 1 cycle per vector, <strong>4× faster</strong>, and the L1 bound and the dependency bound tie. More accumulators can't help, because L1 bytes now binds: the best k is L<sub>FMA</sub> divided by the next bound per vector, 4 / 1.0 = 4, not 8.</p>
<p><strong>Step 4: what's the ceiling?</strong> Each FMA needs two loads (32 B each), and the L1 delivers 64 B per cycle, so at most 1 FMA per cycle: 8 FLOPs per cycle, <strong>50% of peak</strong>, 36 GFLOP/s at 4.5 GHz. That's an answer interviewers like: a dot product can't reach FMA peak on this core even from L1, because its arithmetic intensity is 2 FLOPs per 16 B loaded.</p>
<p><strong>Step 5: the arrays don't fit in L1.</strong> Two arrays of 16,384 doubles (128 KB each, 256 KB together) live in the 512 KB L2. Each unrolled iteration now pulls 4 lines from L2:</p>
<ul>
<li>L2 to L1 bandwidth: 256 B / 32 B per cycle = <strong>8 cycles</strong>.</li>
<li>Miss buffers: 4 lines × ~12 cycles / 24 = 2 cycles.</li>
<li>Everything else is unchanged at ≤ 4 cycles.</li>
</ul>
<p>T ≈ 8 cycles per 4 vectors, 4 FLOPs per cycle, 25% of peak. Consistency check: at 32 B per cycle and about 12 cycles of latency, Little's law needs 32 × 12 / 64 = 6 lines in flight, well under 24 miss buffers, so bandwidth, not concurrency, is the limit (and the L2 prefetcher can keep that many in flight).</p>
<p><strong>How to wrap up the answer:</strong> 4 cycles per iteration as written, bound by the FMA latency chain; 4 accumulators make it 4× faster and move the bound to L1 bandwidth at 50% of peak; out of L1, L2 bandwidth halves it again. Nothing in the core's width matters at any point, which is the main lesson of max-of-bounds.</p>
</details>

<h3 id="sec-fe-bounds">Front-End Bounds</h3>
<p>The front end limits how fast micro-ops enter the machine; when it binds, the back end sits idle however wide it is.</p>
<div class="tbl"><table>
<tr><th>Bottleneck</th><th>Bound (cycles/iteration)</th><th>Why</th><th>Binds when</th></tr>
<tr><td>Fetch bandwidth</td><td>Bytes<sub>iter</sub> / F<sub>bytes</sub><small class="vars">Bytes<sub>iter</sub>: instruction bytes per iteration. F<sub>bytes</sub>: bytes fetched per cycle.</small></td><td>Fetch reads F<sub>bytes</sub> per cycle from the instruction cache, often 16 to 32 B</td><td>Long x86 encodings, loops of large instructions</td></tr>
<tr><td>Taken branches</td><td>N<sub>tk</sub> / T<sub>tk</sub><small class="vars">N<sub>tk</sub>: taken branches per iteration. T<sub>tk</sub>: taken branches the front end can follow per cycle. W<sub>fetch</sub>: fetch width in bytes; a block is the code from a branch target to the next taken branch.</small></td><td>Most cores follow 1 taken branch per cycle (some recent cores 2), and fetch stops at each one; each fetch block also rounds up, Σ ⌈block size / W<sub>fetch</sub>⌉</td><td>Tiny loops, branchy code</td></tr>
<tr><td>Decode width</td><td>N<sub>i</sub> / W<sub>dec</sub><small class="vars">N<sub>i</sub>: instructions per iteration. W<sub>dec</sub>: instructions decoded per cycle.</small></td><td>Decoders handle at most W<sub>dec</sub> instructions per cycle</td><td>The legacy decode path on x86 (micro-op cache misses)</td></tr>
<tr><td>Complex decode</td><td>N<sub>complex</sub> / P<sub>complex</sub><small class="vars">N<sub>complex</sub>: instructions per iteration that need a complex decoder. P<sub>complex</sub>: number of decoders that can take them (often 1).</small></td><td>Instructions that crack into several micro-ops often decode on only one decoder</td><td>Microcoded or multi-micro-op instructions in a hot loop</td></tr>
<tr><td>Micro-op cache delivery</td><td>N<sub>u</sub> / W<sub>uc</sub><small class="vars">N<sub>u</sub>: micro-ops per iteration. W<sub>uc</sub>: micro-ops the micro-op cache delivers per cycle.</small></td><td>The micro-op cache supplies W<sub>uc</sub> micro-ops per cycle and replaces decode when the loop fits</td><td>Loops that fit in the micro-op cache</td></tr>
<tr><td>Loop buffer</td><td>N<sub>u</sub> / W<sub>lsd</sub><small class="vars">N<sub>u</sub>: micro-ops per iteration. W<sub>lsd</sub>: micro-ops the loop buffer (loop stream detector) delivers per cycle.</small></td><td>Small loops replay from a buffer at its width</td><td>Very small loops</td></tr>
<tr><td>Instruction cache misses</td><td>N<sub>i</sub> · m<sub>I</sub> · L<sub>I</sub> (roughly additive)<small class="vars">N<sub>i</sub>: instructions per iteration. m<sub>I</sub>: instruction cache misses per instruction. L<sub>I</sub>: cycles to fill a miss from the next level.</small></td><td>Each miss starves the back end once the fetch queue drains. With fetch-directed instruction prefetch (FDIP), the branch predictor runs ahead and prefetches the lines it predicts, so some misses overlap and the additive form overestimates</td><td>Large code footprints (databases, JITs)</td></tr>
<tr><td>Instruction TLB misses</td><td>N<sub>i</sub> · m<sub>ITLB</sub> · L<sub>walk</sub> (roughly additive)<small class="vars">N<sub>i</sub>: instructions per iteration. m<sub>ITLB</sub>: instruction TLB misses per instruction. L<sub>walk</sub>: cycles per page walk.</small></td><td>Same, with page-walk latency</td><td>Huge binaries without large pages</td></tr>
<tr><td>BTB level and misses</td><td>N<sub>tk</sub> · (f<sub>2</sub> · b<sub>2</sub> + m<sub>BTB</sub> · L<sub>resteer</sub>) (additive)<small class="vars">N<sub>tk</sub>: taken branches per iteration. f<sub>2</sub>: fraction found only in the second-level BTB. b<sub>2</sub>: bubble cycles per such hit. m<sub>BTB</sub>: fraction that miss the BTB entirely. L<sub>resteer</sub>: cycles until decode spots the branch and re-steers fetch.</small></td><td>A taken branch in the small first-level BTB costs no bubble; one found only in the larger second level costs a bubble cycle or more (Zen 4: about 1.5K and 7K entries). A miss isn't seen until decode, which re-steers fetch several cycles late</td><td>Many taken branches spread over a large footprint: servers, interpreters, JITs</td></tr>
<tr><td>Prediction bandwidth</td><td>N<sub>pred</sub> / W<sub>pred</sub><small class="vars">N<sub>pred</sub>: predictions (fetch blocks) per iteration. W<sub>pred</sub>: predictions the branch predictor makes per cycle.</small></td><td>The predictor makes only so many predictions per cycle, and a decoupled front end runs only as far ahead as its fetch-target queue holds</td><td>Dense branches, short fetch blocks</td></tr>
<tr><td>Indirect branches and returns</td><td>(N<sub>ind</sub> · m<sub>ind</sub> + N<sub>ret</sub> · m<sub>RAS</sub>) · P<sub>mp</sub> (additive)<small class="vars">N<sub>ind</sub>, N<sub>ret</sub>: indirect branches and returns per iteration. m<sub>ind</sub>, m<sub>RAS</sub>: their target mispredict rates. P<sub>mp</sub>: cycles per mispredict, L<sub>resolve</sub> + L<sub>refill</sub> below.</small></td><td>An indirect branch mispredicts when one site jumps to many targets; returns mispredict once call depth exceeds the return stack (typically 16 to 32 entries)</td><td>Virtual calls, interpreter dispatch, deep recursion</td></tr>
<tr><td>Micro-op cache structure</td><td>N<sub>sw</sub> · P<sub>sw</sub> (additive)<small class="vars">N<sub>sw</sub>: switches per iteration between the micro-op cache and the legacy decoders. P<sub>sw</sub>: cycles lost per switch.</small></td><td>Lines map to fixed code windows (Intel: 32 B or 64 B windows with a few ways each), so dense code can miss even when the total fits; each switch to legacy decode and back costs cycles</td><td>Hot code near the cache's limits, or dense code of long instructions</td></tr>
<tr><td>Microcode sequencer</td><td>N<sub>u,ms</sub> / W<sub>ms</sub> + N<sub>ms</sub> · P<sub>ms</sub><small class="vars">N<sub>u,ms</sub>: micro-ops per iteration read from microcode ROM. W<sub>ms</sub>: micro-ops it delivers per cycle. N<sub>ms</sub>: entries into microcode per iteration. P<sub>ms</sub>: switch cycles per entry.</small></td><td>Microcoded instructions read out at low width, with a penalty to switch in and out</td><td><code>rep movs</code>, some divides, string and system instructions</td></tr>
<tr><td>Length-changing prefixes</td><td>N<sub>lcp</sub> · P<sub>lcp</sub> (additive)<small class="vars">N<sub>lcp</sub>: instructions per iteration with a length-changing prefix. P<sub>lcp</sub>: stall cycles each (a few on Intel).</small></td><td>On Intel's legacy decode path, a prefix that changes instruction length (such as a 16-bit immediate) stalls the length decoder</td><td>16-bit operations with immediates, on micro-op cache misses</td></tr>
<tr><td>Alignment</td><td>&Sigma;<sub>b</sub> &lceil;(o<sub>b</sub> + s<sub>b</sub>) / F<sub>bytes</sub>&rceil;<small class="vars">Sum over the fetch blocks b of one iteration. o<sub>b</sub>: offset of block b's first byte inside its aligned fetch window. s<sub>b</sub>: block size in bytes. F<sub>bytes</sub>: fetch window size.</small></td><td>Fetch reads aligned windows (16, 32, or 64 B), so a block that straddles a boundary costs an extra fetch cycle every iteration</td><td>Small hot loops at unlucky addresses: code that slows down with no source change</td></tr>
<tr><td>SMT sharing</td><td>Any bandwidth row with W replaced by W / n<sub>thr</sub><small class="vars">W: that row's width. n<sub>thr</sub>: hardware threads actively competing for the front end, usually 2.</small></td><td>Threads share fetch and decode, usually alternating cycles</td><td>Both hyperthreads front-end heavy</td></tr>
<tr><td>Machine clears</td><td>N<sub>clr</sub> · P<sub>clr</sub> (additive)<small class="vars">N<sub>clr</sub>: clears per iteration. P<sub>clr</sub>: cycles lost per clear, similar to a mispredict.</small></td><td>Self-modifying code, memory-ordering violations, and similar events flush the pipeline like a mispredict</td><td>JITs, code and data sharing cache lines</td></tr>
</table></div>
<p><strong>Latency rows and bandwidth rows.</strong> Top-down analysis (Yasin, ISPASS 2014) splits front-end stalls into <em>front-end latency</em>, cycles where no micro-ops arrive at all (cache and TLB misses, re-steers, clears, microcode switches), and <em>front-end bandwidth</em>, cycles where micro-ops arrive but fewer than the machine's width (decode limits, micro-op cache structure, alignment). Bandwidth rows enter the max; latency rows add once they outlast the fetch queue (see front-end decoupling below).</p>
<p><strong>Branch mispredicts are serializing.</strong> A mispredict flushes everything younger than the branch, and the useful-work gap is the time for the branch to resolve plus the time to refill the pipeline:</p>
<div class="math">\\[ T_{mp} = N_{br} \\, m_{br} \\, (L_{resolve} + L_{refill}) \\]</div>
<p>This adds to the max of the other bounds, since nothing useful overlaps it. \\(L_{refill}\\) is roughly the front-end depth, about 10 to 20 cycles on modern cores. \\(L_{resolve}\\) is how long the branch waits for its operands: a branch that depends on a DRAM miss resolves only when the miss returns, and its flush also throws away the other misses queued behind it, destroying memory-level parallelism.</p>
<p><strong>Front-end decoupling.</strong> The fetch queue (or micro-op queue) absorbs short bubbles, so short front-end stalls overlap with back-end work; long ones (instruction cache misses to L3 or DRAM, mispredicts) don't. Treat stalls shorter than the queue's drain time as hidden and longer ones as additive.</p>
<details class="ex"><summary>Worked example: a branchy loop on the Zen 3 front end</summary>
<p><strong>Question.</strong> The hot loop of a bytecode interpreter runs on Zen 3. Per iteration: 16 instructions, 62 bytes of code, 14 macro-ops (two <code>cmp</code>/<code>jcc</code> pairs fuse), 4 conditional branches, 3 of them taken (two forward branches and the back edge), each mispredicted 2% of the time. Bound it when the loop hits in the micro-op cache, when it doesn't, and say what a code-layout fix is worth.</p>
<p>Zen 3: fetch 32 B per cycle, 4 legacy decoders, micro-op cache 8 macro-ops per cycle, 1 taken branch per cycle, dispatch 6, mispredict refill about 13 cycles.</p>
<ol start="0">
<li><strong>Bandwidth bounds.</strong>
<div class="tbl"><table>
<tr><th>Bound</th><th>Formula</th><th>Cycles/iteration</th></tr>
<tr><td>Fetch bytes</td><td>62 / 32</td><td>1.94</td></tr>
<tr><td>Taken branches</td><td>3 / 1</td><td>3.00</td></tr>
<tr><td>Legacy decode</td><td>16 / 4</td><td>4.00</td></tr>
<tr><td>Micro-op cache</td><td>14 / 8</td><td>1.75</td></tr>
<tr><td>Dispatch</td><td>14 / 6</td><td>2.33</td></tr>
</table></div></li>
<li><strong>Mispredicts (additive).</strong> 4 × 0.02 = 0.08 per iteration. The branches test values that are already in registers, so they resolve a few cycles after dispatch, say 3: T<sub>mp</sub> = 0.08 × (3 + 13) ≈ 1.3 cycles.</li>
<li><strong>Micro-op cache hit:</strong> max(1.94, 3.00, 1.75, 2.33) + 1.3 = 3.0 + 1.3 ≈ <strong>4.3 cycles</strong>, bound by taken branches. Fetch stops at each taken branch, so three fetch blocks per iteration cost at least 3 cycles however wide everything else is.</li>
<li><strong>Micro-op cache miss</strong> (the interpreter's dispatch code is large): legacy decode binds, 4.0 + 1.3 ≈ <strong>5.3 cycles</strong>, plus a few cycles each time the front end switches between the two paths.</li>
<li><strong>Layout fix.</strong> Profile-guided layout (PGO or BOLT) makes the two common forward branches fall through, leaving 1 taken branch. Now dispatch binds: 2.33 + 1.3 ≈ 3.6 cycles, <strong>about 16% less time</strong> than 4.3.</li>
<li><strong>What binds next:</strong> mispredicts are now 1.3 / 3.6 = 36% of the time. A better predictor, or reorganizing the interpreter so each bytecode handler ends in its own indirect jump (threaded code), is the next lever.</li>
</ol>
</details>

<h3 id="sec-be-bounds">Back-End Bounds</h3>
<p>The back end limits how fast micro-ops are renamed, executed, and retired. The narrowest of these is usually rename, the true width of the machine.</p>
<div class="tbl"><table>
<tr><th>Bottleneck</th><th>Bound (cycles/iteration)</th><th>Why</th><th>Binds when</th></tr>
<tr><td>Rename/dispatch</td><td>N<sub>u</sub> / W<sub>ren</sub></td><td>Every micro-op passes rename in order, W<sub>ren</sub> per cycle</td><td>High-ILP code with all data in cache</td></tr>
<tr><td>Issue</td><td>N<sub>u</sub> / W<sub>issue</sub></td><td>The scheduler sends at most W<sub>issue</sub> micro-ops per cycle to ports</td><td>Rarely; issue is usually wider than rename</td></tr>
<tr><td>Port class k</td><td>N<sub>k</sub> / P<sub>k</sub></td><td>Micro-ops restricted to class k share its P<sub>k</sub> ports</td><td>Many multiplies, shuffles, floating-point ops, or branches on few ports</td></tr>
<tr><td>Non-pipelined unit</td><td>N<sub>k</sub> · II<sub>k</sub> / P<sub>k</sub></td><td>Each micro-op holds the unit for its initiation interval II<sub>k</sub></td><td>Integer or floating-point divide, square root</td></tr>
<tr><td>Retire</td><td>N<sub>u</sub> / W<sub>ret</sub></td><td>Retirement is in order, W<sub>ret</sub> per cycle</td><td>Rarely on average; matters while draining after a long miss</td></tr>
<tr><td>Loop-carried dependency</td><td>Σ L<sub>i</sub> around the cycle</td><td>The next iteration's chain waits on this one</td><td>Reductions, pointer chasing, recurrences</td></tr>
</table></div>
<p><strong>Port pressure with flexible ports.</strong> When micro-ops can run on several ports, check every subset S of ports: micro-ops that can run <em>only</em> on ports inside S must share those |S| ports.</p>
<div class="math">\\[ B_{ports} = \\max_{S} \\frac{\\#\\{\\text{micro-ops whose allowed ports} \\subseteq S\\}}{|S|} \\]</div>
<p>Those micro-ops can't escape S, so S needs at least that many cycles. The single-class bound N<sub>k</sub> / P<sub>k</sub> is the case where S is one class; in practice, checking each class and each union of overlapping classes is enough.</p>
<p><strong>Multiple accumulators.</strong> A reduction like <code>sum += a[i]</code> runs at one add latency per iteration whatever the width. Splitting it into k independent accumulators gives</p>
<div class="math">\\[ B_{dep} = \\frac{L_{add}}{k}, \\quad \\text{useful until } \\frac{L_{add}}{k} \\le \\frac{N_{add}}{P_{add}} \\]</div>
<p>so the best k is about L<sub>add</sub> × P<sub>add</sub>, the adder's latency-bandwidth product (Little's law again): a 4-cycle add on 2 ports needs k = 8.</p>
<p><strong>Fused vs. unfused micro-ops.</strong> On x86 cores, rename and retire count fused micro-ops (a load + add counts as 1), while ports count unfused ones (2). Use the fused count for W<sub>ren</sub> and W<sub>ret</sub> bounds and the unfused count for port bounds.</p>
<details class="ex"><summary>Worked example: port subsets and accumulators on Skylake</summary>
<p><strong>Question.</strong> An Intel Skylake core (4-wide rename; ALU ports p0, p1, p5, p6; FMA on p0 and p1 with 4-cycle latency; loads on p2 and p3; predicted-taken branches only on p6) runs this loop. Bound it, find the bottleneck, and restructure it.</p>
<pre><code>loop:
  vfmadd231pd ymm0, ymm8,  [rsi]        ; p01 + load (micro-fused)
  vfmadd231pd ymm1, ymm9,  [rsi + 32]
  vfmadd231pd ymm2, ymm10, [rsi + 64]
  shlx  r8,  r9,  rcx                   ; p06
  sarx  r10, r11, rcx                   ; p06
  add   rsi, 96                         ; p0156
  sub   rdx, 1
  jnz   loop                            ; fuses with sub, taken: p6 only</code></pre>
<ol start="0">
<li><strong>Count.</strong> Fused (for rename): 3 FMA+load, 2 shifts, <code>add</code>, fused <code>sub</code>/<code>jnz</code> = 7. Unfused (for ports): 3 FMAs on {p0, p1}, 3 loads on {p2, p3}, 2 shifts on {p0, p6}, 1 branch on {p6}, 1 add on {p0, p1, p5, p6}. (Non-indexed addresses keep the FMAs micro-fused; <code>[rsi + rax]</code> would un-laminate them at rename on Skylake.)</li>
<li><strong>Single-class bounds.</strong> Rename 7 / 4 = 1.75; FMA 3 / 2 = 1.5; shifts and branch 3 / 2 = 1.5; branch alone 1 / 1 = 1; loads 3 / 2 = 1.5.</li>
<li><strong>Port subsets.</strong> Micro-ops that can run only on {p0, p1, p6}: 3 FMAs + 2 shifts + 1 branch = 6, on 3 ports: <strong>2.0</strong>. All four ALU ports: 7 / 4 = 1.75. The union of two classes binds even though each class alone looks fine, and p5 is idle most of the time.</li>
<li><strong>Dependency.</strong> Each of <code>ymm0</code> to <code>ymm2</code> is updated once per iteration, so B<sub>dep</sub> = 4. T = max(4, 2.0, …) = <strong>4 cycles</strong>: latency-bound, with half the port capacity unused.</li>
<li><strong>Unroll by 3 with 9 accumulators.</strong> Per unrolled iteration: 9 FMAs, 6 shifts, 1 add, 1 branch (17 fused). Bounds: dependency 4; {p0, p1, p6} = (9 + 6 + 1) / 3 = 5.33; rename 17 / 4 = 4.25; loads 9 / 2 = 4.5; all ALU ports 17 / 4 = 4.25. T = 5.33 per 3 iterations = <strong>1.78 cycles per original iteration</strong>, 2.25× faster, now bound by the {p0, p1, p6} subset.</li>
<li><strong>Why not 6 accumulators?</strong> Unroll by 2: dependency 4 per 2 iterations = 2.0 each, while the port subset allows (6 + 4 + 1) / 3 / 2 = 1.83. The accumulator count needed is L<sub>FMA</sub> × (FMAs per cycle at the port bound) = 4 × 3 / 1.78 ≈ 6.7, so 6 is just short.</li>
<li><strong>What binds next:</strong> the p0/p1/p6 subset. Moving shift work onto an instruction that can also use p5 (or onto the vector side) loosens it; past that, loads and rename bind at about 1.5 and 1.42 cycles per original iteration.</li>
</ol>
</details>

<h3 id="sec-window-bounds">Window Bounds</h3>
<p>Every out-of-order structure obeys the same Little's-law bound, \\(E \\cdot R / C\\); what changes is which micro-ops occupy it and for how long. These are the structures that show up at rename as "full" in the stage table above.</p>
<div class="tbl"><table>
<tr><th>Structure</th><th>Entries per iteration (E)</th><th>Residency (R)</th><th>Bound</th><th>Binds when</th></tr>
<tr><td>ROB</td><td>N<sub>u</sub> (fused)</td><td>Dispatch to retire; ≈ L<sub>miss</sub> when a miss sits at the head</td><td>N<sub>u</sub> · R / C<sub>ROB</sub></td><td>Long-latency misses with many micro-ops between them</td></tr>
<tr><td>Issue queue (scheduler)</td><td>Micro-ops not yet issued</td><td>Dispatch to issue; dependents of a miss wait ≈ L<sub>miss</sub></td><td>N<sub>wait</sub> · L<sub>miss</sub> / C<sub>IQ</sub></td><td>Many micro-ops depend on a missing load; often fills before the ROB</td></tr>
<tr><td>Load queue</td><td>N<sub>ld</sub></td><td>Dispatch to retire</td><td>N<sub>ld</sub> · R / C<sub>LQ</sub></td><td>Load-heavy loops with misses</td></tr>
<tr><td>Store queue / store buffer</td><td>N<sub>st</sub></td><td>Dispatch to retire, then until written to L1</td><td>N<sub>st</sub> · (R + R<sub>drain</sub>) / C<sub>SQ</sub></td><td>Store-heavy code, store misses</td></tr>
<tr><td>Physical registers</td><td>Micro-ops that write a register (integer and floating point counted separately)</td><td>Rename until the next writer of the same architectural register retires</td><td>N<sub>dest</sub> · R / (C<sub>PRF</sub> − N<sub>arch</sub>)</td><td>Wide vector code, floating-point loops with misses</td></tr>
<tr><td>Branch checkpoints</td><td>N<sub>br</sub></td><td>Rename to branch resolve</td><td>N<sub>br</sub> · R<sub>br</sub> / C<sub>ckpt</sub></td><td>Branchy code whose branches wait on misses</td></tr>
</table></div>
<ul>
<li><strong>Residency is the term that needs thought.</strong> Entries leave the ROB, load queue, store queue, and register file only at in-order retirement, so they inherit the latency of the oldest unfinished micro-op ahead of them: with a DRAM miss at the head, every entry behind it waits about L<sub>miss</sub>. The issue queue is different: entries leave when they issue, out of order, so independent micro-ops leave quickly and only those waiting on a miss stay about L<sub>miss</sub>. The issue queue fills with the dependents of misses, not with all micro-ops.</li>
<li><strong>Subtract the architectural registers.</strong> The register file always holds N<sub>arch</sub> live architectural values (16 integer registers on x86-64, 31 on AArch64), so only C<sub>PRF</sub> − N<sub>arch</sub> are available for renaming.</li>
<li><strong>Store buffer drain.</strong> Stores write L1 after retirement, in order on x86 (TSO). Drain is a bandwidth bound, N<sub>st</sub> / W<sub>commit</sub>, with W<sub>commit</sub> often 1 to 2 per cycle. A store that misses blocks the stores behind it unless the core requests ownership of the line early (an early RFO), so store misses can serialize like an in-order core.</li>
</ul>
<details class="ex"><summary>Worked example: which window structure fills first</summary>
<p><strong>Question.</strong> A join kernel on AMD Zen 3 at 4.5 GHz does one independent DRAM miss per iteration (about 75 ns, so ≈ 340 cycles). Per iteration: 12 macro-ops, 2 loads (one misses), 1 store, 9 macro-ops that write an integer register, and 5 macro-ops that depend on the missing load. Zen 3: 256-entry ROB, 72-entry load queue, 64-entry store queue, 192 integer physical registers, about 96 integer scheduler entries (four 24-entry ALU queues), 24 L1 miss buffers, 6-wide dispatch. Which structure binds, and is enlarging it worth it?</p>
<ol start="0">
<li><strong>Residency.</strong> A miss is always at the ROB head, so every retire-ordered entry stays about 340 cycles. Scheduler entries leave when they issue, so only the 5 dependents of the miss stay that long.</li>
<li><strong>Bounds (E · R / C):</strong>
<div class="tbl"><table>
<tr><th>Structure</th><th>Formula</th><th>Cycles/iteration</th></tr>
<tr><td><strong>Integer scheduler</strong></td><td>5 × 340 / 96</td><td><strong>17.7</strong></td></tr>
<tr><td>Integer registers</td><td>9 × 340 / (192 − 16)</td><td>17.4</td></tr>
<tr><td>ROB</td><td>12 × 340 / 256</td><td>15.9</td></tr>
<tr><td>L1 miss buffers</td><td>1 × 340 / 24</td><td>14.2</td></tr>
<tr><td>Load queue</td><td>2 × 340 / 72</td><td>9.4</td></tr>
<tr><td>Store queue</td><td>1 × (340 + drain) / 64</td><td>≈ 5.4</td></tr>
<tr><td>Dispatch</td><td>12 / 6</td><td>2.0</td></tr>
</table></div></li>
<li><strong>The scheduler binds at about 17.7 cycles,</strong> just ahead of the register file. Counters would mostly say "ROB full" or "registers full"; the scheduler is the one that's easy to miss. In practice it's worse than this, because the dependents don't spread evenly over the four ALU queues.</li>
<li><strong>Consistency:</strong> at T = 17.7, misses in flight = 340 / 17.7 ≈ 19 ≤ 24 miss buffers; ROB occupancy 12 × 340 / 17.7 ≈ 230 ≤ 256. Everything fits.</li>
<li><strong>Is a bigger scheduler worth it?</strong> Doubling it moves the bound to the registers at 17.4, a 2% gain. The structures are balanced (17.7, 17.4, 15.9, 14.2), which is what a good design looks like: to reach the miss-buffer bound of 14.2 you'd have to grow the scheduler, register file, and ROB together by about 25%. A software change is cheaper: if the code is restructured so only 2 macro-ops wait on the miss, the scheduler bound drops to 7.1 and the registers bind at 17.4, so you'd also need fewer register-writing instructions to gain anything.</li>
</ol>
</details>

<h3 id="sec-mem-bounds">Memory Bounds</h3>
<p>Memory bounds come in two kinds: bandwidth bounds (ports, bytes per cycle) and miss-concurrency bounds (MSHRs, queues, page walkers), each a Little's-law limit on misses in flight.</p>
<div class="tbl"><table>
<tr><th>Bottleneck</th><th>Bound (cycles/iteration)</th><th>Why</th><th>Binds when</th></tr>
<tr><td>L1 load ports</td><td>N<sub>ld</sub> / P<sub>ld</sub></td><td>P<sub>ld</sub> load pipes, often 2 to 3</td><td>Load-heavy loops hitting L1</td></tr>
<tr><td>L1 store ports</td><td>N<sub>st</sub> / P<sub>st</sub></td><td>P<sub>st</sub> store pipes, often 1 to 2</td><td>memset, copies, scatters</td></tr>
<tr><td>L1 bytes per cycle</td><td>Bytes<sub>ld</sub> / BW<sub>L1</sub></td><td>Wide vector loads are limited by bytes, not count</td><td>AVX-512 or SVE streaming from L1</td></tr>
<tr><td>L1 MSHRs (fill buffers)</td><td>N<sub>ld</sub> · m<sub>L1</sub> · L<sub>below</sub> / C<sub>MSHR</sub></td><td>Each L1 miss holds an MSHR until its line arrives</td><td>Independent misses to L2, L3, or DRAM</td></tr>
<tr><td>L2 miss queue</td><td>N<sub>L2 miss</sub> · L<sub>below</sub> / C<sub>L2q</sub></td><td>Same, one level down; prefetches hold entries too</td><td>Streaming with aggressive prefetching</td></tr>
<tr><td>Cache-to-cache bandwidth</td><td>Lines moved · 64 B / BW<sub>level</sub></td><td>Each level moves a fixed number of bytes per cycle to the next</td><td>Data larger than L1 or L2 but still in cache</td></tr>
<tr><td>Dependent misses (pointer chasing)</td><td>L<sub>miss</sub> per link</td><td>The next address needs this load's data, so nothing overlaps</td><td>Linked lists, trees, hash chains</td></tr>
<tr><td>Data TLB misses</td><td>N<sub>ld</sub> · m<sub>TLB</sub> · L<sub>walk</sub> / P<sub>walkers</sub></td><td>Page walkers act like MSHRs, and walks can miss in the cache themselves</td><td>Random access over many 4 KB pages</td></tr>
<tr><td>Store-forwarding failure</td><td>r<sub>fail</sub> · P<sub>fail</sub> (additive)</td><td>The load waits for the store to reach L1, about 10 to 20 cycles</td><td>Partial overlap or a size mismatch between store and load</td></tr>
<tr><td>Memory-ordering violation</td><td>r<sub>viol</sub> · P<sub>flush</sub> (additive)</td><td>A load ran before an older store to the same address, so the pipeline flushes</td><td>Aliasing the memory dependence predictor misses</td></tr>
</table></div>
<p><strong>Which latency goes into the MSHR bound.</strong> L<sub>below</sub> is the latency of wherever the miss is served: roughly 12 to 15 cycles for L2, 40 to 60 for L3, and 300 to 500 for DRAM on a 4–5 GHz desktop (approximate). When misses go to several levels, weight them by miss rate:</p>
<div class="math">\\[ B_{MSHR} = \\frac{N_{ld} \\, (m_{L1 \\to L2} L_{L2} + m_{L1 \\to L3} L_{L3} + m_{L1 \\to DRAM} L_{DRAM})}{C_{MSHR}} \\]</div>
<ul>
<li><strong>Independent vs. dependent misses</strong> is the most important call in these problems. Independent misses are a capacity bound: they overlap, so time ≈ L<sub>miss</sub> / misses in flight. Dependent misses are a latency bound: each waits for the last, so time ≈ L<sub>miss</sub> per link, and no window size helps (see <a href="#/latency-tolerance/mlp">What memory-level parallelism means</a>).</li>
<li><strong>Prefetching moves the bottleneck.</strong> A working prefetcher turns a latency bound into a bandwidth bound by starting misses early, but prefetches still hold MSHRs and L2 queue entries and still use DRAM bandwidth. Prefetchers mostly help regular strides and rarely help pointer chasing or hash probes.</li>
<li><strong>Roofline.</strong> For loops dominated by compute and DRAM traffic, with arithmetic intensity I = FLOPs per byte from DRAM, attainable FLOP/s = min(peak FLOP/s, I × BW<sub>DRAM</sub>): the same max-of-bounds rule, written as a rate instead of a time (see <a href="#/gen-gpus/roofline">Roofline</a>).</li>
</ul>
<details class="ex"><summary>Worked example: hash probes into L3, with and without huge pages</summary>
<p><strong>Question.</strong> On a Ryzen 9 5950X (Zen 3, 4.5 GHz, 32 MB L3 per 8-core chiplet), one core probes a 16 MB hash table at random, keys read sequentially from an array. Each probe is one load into the table, independent of the others, plus 8 macro-ops of hashing and compare. Find the probe rate with 4 KB pages and with 2 MB pages. Zen 3: L2 512 KB at about 12 cycles, L3 at about 46 cycles, 32 B per cycle from L3 to L2, 24 L1 miss buffers, a 2,048-entry L2 data TLB, 6 page walkers.</p>
<ol start="0">
<li><strong>Where the probe hits.</strong> 16 MB at random: L1 and L2 almost always miss (L2 holds 0.5 / 16 ≈ 3%), so about 97% of probes are served by L3.</li>
<li><strong>Core bounds.</strong> Dispatch 9 / 6 = 1.5; load pipes 2 / 3 (key and probe) = 0.67. No loop-carried dependency beyond the index.</li>
<li><strong>Miss buffers.</strong> 1 × (0.03 × 12 + 0.97 × 46) / 24 = 44.98 / 24 ≈ <strong>1.87 cycles</strong>.</li>
<li><strong>L3 bandwidth.</strong> One 64 B line per probe at 32 B per cycle = <strong>2.0 cycles</strong>. This beats the miss-buffer bound: 1.87 cycles per line would need 34 B per cycle.</li>
<li><strong>TLB with 4 KB pages.</strong> The table covers 4,096 pages and the L2 TLB covers 2,048 × 4 KB = 8 MB, so about half the probes miss the TLB. Assume a walk takes about 30 cycles (upper levels in the page-walk cache, the leaf entry from L2 or L3). Walkers: 1 × 0.5 × 30 / 6 = <strong>2.5 cycles</strong>, the bottleneck.</li>
<li><strong>With 2 MB pages</strong> the table is 8 pages and TLB misses vanish: T = max(1.5, 1.87, 2.0) = 2.0 cycles, bound by L3 bandwidth. 4.5 GHz / 2.5 = 1.8 G probes/s becomes 4.5 / 2.0 = 2.25 G probes/s, <strong>25% faster</strong>.</li>
<li><strong>Contrast: the same table as linked buckets.</strong> If each probe follows a chain where the next address comes from the last load, the misses within a chain are dependent: about 46 cycles per link, plus walks. Probes are still independent of each other, so the miss buffers still overlap different chains, but each probe now holds a buffer for the whole chain: with 1.5 links on average, 1.5 × 46 / 24 ≈ 2.9 cycles. A single long chain with no other probes to overlap would be 46 cycles per link, about 23× slower than the open-addressed table.</li>
</ol>
</details>

<h3 id="sec-chip-bounds">Chip-Level Bounds</h3>
<p>Per-core resources scale with core count and shared ones don't, so with enough active cores a shared resource always becomes the bottleneck.</p>
<div class="tbl"><table>
<tr><th>Bottleneck</th><th>Bound (cycles/iteration, per core)</th><th>Why</th><th>Binds when</th></tr>
<tr><td>DRAM bandwidth</td><td>N<sub>cores</sub> · Bytes<sub>DRAM</sub> · f / BW<sub>DRAM</sub></td><td>All cores share the channels; the clock f converts bytes to cycles</td><td>Many cores streaming or missing to DRAM</td></tr>
<tr><td>Last-level cache bandwidth</td><td>N<sub>cores</sub> · Bytes<sub>LLC</sub> · f / BW<sub>LLC</sub></td><td>Ring or mesh slices have a fixed total bandwidth</td><td>Working set fits in L3 but not L2</td></tr>
<tr><td>Socket link</td><td>Bytes<sub>remote</sub> · f / BW<sub>link</sub></td><td>Remote-memory traffic crosses a narrower link</td><td>NUMA-unaware data placement</td></tr>
<tr><td>Coherence transfers</td><td>r<sub>transfer</sub> · L<sub>c2c</sub> (serializing)</td><td>A line written by one core and read by another moves each time: tens of ns within a socket, 100 ns or more across sockets (approximate)</td><td>Shared counters, locks, false sharing</td></tr>
<tr><td>SMT sharing</td><td>max over shared resources of (demand<sub>0</sub> + demand<sub>1</sub>) / capacity</td><td>Two threads split width, ports, ROB, and L1</td><td>Two threads with the same bottleneck</td></tr>
<tr><td>Frequency and power</td><td>Time = cycles / f(active cores, ISA)</td><td>All-core and wide-vector clocks run below single-core turbo</td><td>Heavy vector code, all cores busy</td></tr>
</table></div>
<p><strong>Loaded latency.</strong> When DRAM bandwidth saturates, miss latency rises until Little's law balances. With M lines in flight chip-wide:</p>
<div class="math">\\[ L_{loaded} = \\max\\left(L_{idle},\\ \\frac{M \\times 64\\ \\text{B}}{BW_{DRAM}}\\right) \\]</div>
<p>The per-core MSHR bound then uses L<sub>loaded</sub> instead of L<sub>idle</sub> and gives the same answer as the bandwidth bound, a useful cross-check. The core count at which a miss-bound loop saturates DRAM, given that one core sustains C<sub>MSHR</sub> × 64 B / L<sub>idle</sub>:</p>
<div class="math">\\[ N_{sat} = \\frac{BW_{DRAM}}{BW_{core}} = \\frac{BW_{DRAM} \\times L_{idle}}{C_{MSHR} \\times 64\\ \\text{B}} \\]</div>
<p><strong>Cycles vs. nanoseconds.</strong> DRAM latency and bandwidth are fixed in ns and GB/s. A higher core clock makes DRAM bounds larger in cycles while core-side bounds stay put, so a DRAM-bound loop gains almost nothing from frequency (see <a href="#/ipc-spec">IPC and simulation methodology</a>).</p>
<details class="ex"><summary>Worked example: STREAM triad on a 64-core EPYC, and why thread placement matters</summary>
<p><strong>Question.</strong> An AMD EPYC 7763 (Milan: 64 Zen 3 cores in 8 chiplets of 8, about 3.0 GHz all-core, 8 channels of DDR4-3200) runs the STREAM triad <code>a[i] = b[i] + s * c[i]</code> on large double arrays. How many cores saturate DRAM, what is the per-core cycle cost at 64 cores, and what happens if 8 threads all land on one chiplet? Each chiplet connects to the I/O die over a link that moves about 32 B per fabric cycle for reads and 16 B for writes, at a 1.6 GHz fabric clock (approximate).</p>
<ol start="0">
<li><strong>Bytes per element.</strong> Read <code>b</code> and <code>c</code> (16 B), and write <code>a</code> (8 B), which with normal stores is first read for ownership (8 B more): 24 B read + 8 B written = <strong>32 B</strong>.</li>
<li><strong>DRAM peak.</strong> 8 × 3,200 MT/s × 8 B = <strong>204.8 GB/s</strong>; sustained is typically 75% to 85% of that.</li>
<li><strong>One core.</strong> The L2 can track about 64 outstanding misses, mostly from the prefetcher, so with about 110 ns of DRAM latency one core sustains at most 64 × 64 B / 110 ns ≈ 37 GB/s. N<sub>sat</sub> ≈ 204.8 / 37 ≈ <strong>6 cores</strong> if they're spread across chiplets. Everything beyond that only waits longer.</li>
<li><strong>All 64 cores.</strong> Chip bound per core = 64 × 32 B × 3.0 GHz / 204.8 GB/s = <strong>30 cycles per element</strong>, about 120 cycles per 4-element AVX2 iteration, against core bounds of 1 to 2 cycles. The core is 98% idle.</li>
<li><strong>8 threads on one chiplet.</strong> The chiplet's link carries 32 B × 1.6 GHz = 51.2 GB/s of reads and 25.6 GB/s of writes. Triad needs 24 B read per 32 B, so the read side binds: 51.2 / 0.75 ≈ <strong>68 GB/s</strong> total. Spread over 8 chiplets, the same 8 threads get min(8 × 37, 204.8) = 204.8 GB/s, <strong>3× more</strong>. Same code, same core count; only placement changed.</li>
<li><strong>Cutting bytes.</strong> Non-temporal stores skip the read for ownership: 24 B per element instead of 32, so 33% more elements per second at the same bandwidth.</li>
<li><strong>Frequency.</strong> At 64 cores the loop is DRAM-bound in ns, so raising the clock from 3.0 to 3.5 GHz makes it more cycles per element (35) and the same speed.</li>
</ol>
</details>

<h3 id="sec-procedure">Procedure and Traps</h3>
<ol start="0">
<li><strong>Count per-iteration work:</strong> instructions, fused and unfused micro-ops, micro-ops per port class, loads, stores, branches, taken branches. For each load, decide where it hits and how often.</li>
<li><strong>Find dependencies:</strong> trace the loop-carried critical path for B<sub>dep</sub>, and decide whether misses are independent (overlappable) or dependent (pointer chasing).</li>
<li><strong>Bandwidth bounds (N / W):</strong> front end, rename, each port class, L1 ports, cache and DRAM bytes.</li>
<li><strong>Capacity bounds (E · R / C):</strong> ROB, issue queue, load and store queues, registers, MSHRs, L2 queue, page walkers, working out R for each from where its entries wait.</li>
<li><strong>Take the max and add penalties:</strong> mispredicts, flushes, forwarding failures, coherence transfers.</li>
<li><strong>Check consistency:</strong> at the computed T, every structure's occupancy E · R / T must fit in C. If one doesn't, it's the real bottleneck; recompute.</li>
<li><strong>Scale to the chip:</strong> multiply shared-resource demand by active cores, and if DRAM saturates, redo the miss latency as loaded latency.</li>
<li><strong>Ask what binds next:</strong> relax the bottleneck and find the second-largest bound, which tells you how much a fix is worth.</li>
</ol>
<p>Traps:</p>
<ul>
<li><strong>Latency is not throughput.</strong> A 400-cycle miss doesn't mean 400 cycles per iteration if misses overlap, and a 25-cycle iteration rate doesn't mean one iteration takes 25 cycles.</li>
<li><strong>Wrong residency.</strong> Retire-ordered structures (ROB, load and store queues, registers) hold entries until the oldest miss retires; the issue queue holds only micro-ops still waiting on operands.</li>
<li><strong>The issue queue often fills first.</strong> If 20 micro-ops per iteration depend on a 400-cycle miss, the issue queue bound is 20 × 400 / C<sub>IQ</sub>, which beats a 25-cycle MSHR bound for any issue queue under 320 entries. Textbook problems often leave this out; real cores often hit it.</li>
<li><strong>Idle latency under load.</strong> Once bandwidth saturates, use loaded latency in the MSHR bound.</li>
<li><strong>Fused vs. unfused counts:</strong> fused for rename and retire, unfused for ports.</li>
<li><strong>Max vs. add:</strong> bandwidth and capacity bounds overlap, so take the max; flushes and serializing events don't, so add them.</li>
<li><strong>Mispredict cost isn't fixed:</strong> a branch that depends on a miss resolves only when the miss returns.</li>
<li><strong>Prefetches use the same resources</strong> as demand misses: MSHRs, queue entries, and bandwidth.</li>
<li><strong>Convert at the real clock:</strong> DRAM latency and bandwidth in cycles at the clock under load, not at peak turbo.</li>
</ul>
<details class="ex"><summary>Worked example: the whole procedure on sparse matrix-vector multiply</summary>
<p><strong>Question.</strong> CSR sparse matrix-vector multiply, inner loop <code>sum += val[j] * x[col[j]]</code>, on an AMD EPYC 9654 (Genoa: 96 Zen 4 cores, about 3.5 GHz all-core, 12 channels of DDR5-4800, about 110 ns idle DRAM latency). The vector <code>x</code> is 64 MB, larger than L3, and half the <code>x</code> loads miss to DRAM; rows average 10 nonzeros. Zen 4: 6-wide dispatch, 320-entry ROB, 88-entry load queue, 224 integer and 192 floating-point registers, about 64 floating-point scheduler entries, 3 load pipes, FMA latency 4, about 24 L1 miss buffers (approximate), mispredict refill about 13 cycles. Bound one core, then the chip.</p>
<ol start="0">
<li><strong>Count.</strong> Per iteration: load <code>col[j]</code>, load <code>val[j]</code>, FMA with the <code>x</code> load as its memory operand, <code>inc j</code>, fused <code>cmp</code>/<code>jne</code>: 5 macro-ops, 3 loads, 1 FMA, 1 taken branch. <code>val</code> and <code>col</code> stream and are prefetched; <code>x</code> misses to DRAM with probability 0.5. L<sub>DRAM</sub> = 110 ns × 3.5 GHz ≈ 385 cycles.</li>
<li><strong>Dependencies.</strong> The <code>sum</code> chain is one FMA per iteration: B<sub>dep</sub> = 4. The <code>x</code> load depends on <code>col[j]</code>, an L1 hit, but not on earlier iterations, so the misses are independent and can overlap.</li>
<li><strong>Bandwidth bounds.</strong> Dispatch 5 / 6 = 0.83; loads 3 / 3 = 1.0; FMA 1 / 2 = 0.5; taken branches 1.</li>
<li><strong>Capacity bounds</strong> (a miss is almost always at the ROB head, so retire-ordered residency ≈ 385):
<div class="tbl"><table>
<tr><th>Structure</th><th>Formula</th><th>Cycles/iteration</th></tr>
<tr><td><strong>Load queue</strong></td><td>3 × 385 / 88</td><td><strong>13.1</strong></td></tr>
<tr><td>L1 miss buffers</td><td>0.5 × 385 / 24</td><td>8.0</td></tr>
<tr><td>ROB</td><td>5 × 385 / 320</td><td>6.0</td></tr>
<tr><td>FP scheduler</td><td>1 × 385 / 64 (every FMA after a miss waits on the chain)</td><td>6.0</td></tr>
<tr><td>FP registers</td><td>2 × 385 / (192 − 32)</td><td>4.8</td></tr>
<tr><td>Integer registers</td><td>2 × 385 / (224 − 16)</td><td>3.7</td></tr>
</table></div></li>
<li><strong>Max plus penalties.</strong> The row-end branch mispredicts about once per 10 iterations; it tests a counter, so it resolves quickly: 0.1 × ~13 ≈ 1.3 cycles. T ≈ 13.1 + 1.3 = <strong>14.4 cycles per nonzero</strong>, bound by the load queue: three loads per iteration all wait behind the oldest miss.</li>
<li><strong>Consistency.</strong> At T = 14.4: misses in flight 0.5 × 385 / 14.4 ≈ 13 ≤ 24; ROB 5 × 385 / 14.4 ≈ 134 ≤ 320; load queue ≈ 80 ≤ 88. One core is consistent.</li>
<li><strong>Scale to the chip.</strong> DRAM bytes per iteration: 0.5 × 64 B for <code>x</code> + 8 B <code>val</code> + 4 B <code>col</code> = 44 B. One core moves 3.5 GHz / 14.4 × 44 B ≈ 10.7 GB/s; peak is 12 × 4,800 MT/s × 8 B = 460.8 GB/s, so N<sub>sat</sub> ≈ 43 cores. At 96 cores the chip bound is 96 × 44 B × 3.5 GHz / 460.8 GB/s ≈ <strong>32 cycles per nonzero</strong>, so step 5 fails at chip scale: DRAM bandwidth is the real bottleneck. Redo the latency: for the load-queue bound to match 32 − 1.3 ≈ 31 cycles, loaded latency must be about 385 × 31 / 13.1 ≈ 900 cycles (≈ 260 ns). Using idle latency would have overestimated chip throughput by 2.2×.</li>
<li><strong>What binds next.</strong> Reordering the matrix (reverse Cuthill-McKee) so that only 10% of <code>x</code> loads miss cuts traffic to 6.4 + 12 = 18.4 B, and the chip bound to about 13.4 cycles. The per-core load-queue bound doesn't move: a window of 88 / 3 ≈ 29 iterations still holds about 3 misses, and retirement still waits on the oldest, so it stays near 13. Core and chip are then balanced at about 14.7 cycles, 2.2× faster than before at full chip. Further gains need fewer loads per nonzero (narrower column indices, blocked formats) or a core with a larger load queue.</li>
</ol>
</details>
<p>Further reading: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed. (Appendix C for pipelining, Chapter 3 for out-of-order execution and branch prediction, Chapter 2 and Appendix B for caches, MSHRs, prefetching, and DRAM); Yasin, "A Top-Down Method for Performance Analysis and Counters Architecture," ISPASS 2014; Williams, Waterman &amp; Patterson, "Roofline," CACM 2009; Little, "A Proof for the Queuing Formula: L = λW," Operations Research 1961; Agner Fog's microarchitecture guide and instruction tables for per-core port, latency, and buffer sizes.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core (Intel Golden Cove allocates 6 micro-ops per cycle) runs for 2.0 × 10<sup>9</sup> cycles. Counters report: 2.4 × 10<sup>9</sup> slots not delivered by the front end, 7.8 × 10<sup>9</sup> micro-ops issued, 6.6 × 10<sup>9</sup> micro-ops retired, and 0.1 × 10<sup>9</sup> recovery cycles after flushes. Compute the top-down level 1 breakdown, and say which stage you would look at next.</p>`,
        a: `<ol start="0"><li>Total slots = 6 × 2.0 × 10<sup>9</sup> = 12.0 × 10<sup>9</sup>.</li><li>Retiring = 6.6 / 12.0 = <strong>55%</strong>.</li><li>Bad speculation = (issued − retired + width × recovery cycles) / slots = (7.8 − 6.6 + 6 × 0.1) / 12.0 = 1.8 / 12.0 = <strong>15%</strong>. Recovery cycles count because rename issues nothing while the pipeline refills.</li><li>Front-end bound = 2.4 / 12.0 = <strong>20%</strong>.</li><li>Back-end bound = 100 − 55 − 15 − 20 = <strong>10%</strong>.</li><li>Front end is the largest loss, so look at fetch and decode: instruction cache and BTB MPKI, and micro-op cache hit rate, to tell latency (misses, redirects) from bandwidth (decoder limits).</li></ol>`
      },
      {
        q: `<p>In your model, rename is stalled 35% of cycles with "ROB full." In those cycles, the instruction at the ROB head is: a load that missed the last-level cache 60% of the time, a floating-point square root 25%, and an instruction that has already completed (retire is just catching up) 15%. Which stage is the cause, and what do you check next?</p>`,
        a: `<ol start="0"><li>Rename is only the symptom; the ROB is full because retirement is blocked, so look at the ROB head.</li><li>60% of the stall (21% of all cycles) is <strong>memory</strong>: last-level misses. Check memory-level parallelism; if it's near 1, the misses are dependent and need lower latency or a smarter prefetcher, and if it's high, check bandwidth.</li><li>25% (about 9% of cycles) is <strong>core latency</strong>: square root chains. Check whether they're dependent on each other and how long the unit stays busy.</li><li>15% (about 5% of cycles) is <strong>retire width</strong>: after a long stall, the ROB drains at retire width. That's a consequence of the other stalls, not a separate problem, unless retire is narrower than rename.</li></ol>`
      },
      {
        q: `<p>An Intel Skylake core (4-wide rename, 224-entry ROB, 97-entry scheduler, 72-entry load queue, 2 load ports, 10 L1 fill buffers) runs at 4.0 GHz with about 80 ns DRAM latency. A loop does <code>sum += a[idx[i]]</code> over a huge, randomly indexed array: per iteration 6 fused micro-ops, 2 loads (<code>idx[i]</code> hits L1; <code>a[...]</code> misses to DRAM, independent across iterations), and 1 add that depends on the miss. Bound the loop, and say what the stage counters would show.</p>`,
        a: `<ol start="0"><li>L<sub>DRAM</sub> = 80 ns × 4.0 GHz = 320 cycles.</li><li>Bandwidth bounds: rename 6 / 4 = 1.5; load ports 2 / 2 = 1; the loop-carried chain is the 1-cycle add on <code>sum</code>, so B<sub>dep</sub> = 1.</li><li>Capacity bounds: fill buffers 1 × 320 / 10 = <strong>32</strong>; ROB 6 × 320 / 224 ≈ 8.6; load queue 2 × 320 / 72 ≈ 8.9; scheduler (only the dependent add waits) 1 × 320 / 97 ≈ 3.3.</li><li>Max = <strong>32 cycles per iteration</strong>, bound by the fill buffers: only 10 misses are ever in flight. The next bound is the load queue at about 8.9, so more fill buffers could help up to about 3.6×.</li><li>Counters: rename still reports "ROB full," because loads waiting for a fill buffer stay in the ROB longer than L<sub>miss</sub> (the window holds about 224 / 6 ≈ 37 iterations, but only 10 of their misses are outstanding). The cause shows at the ROB head (a DRAM-missing load) and in the fill-buffer-full counter (<code>L1D_PEND_MISS.FB_FULL</code>). A hardware stride prefetcher won't help with random indices.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague's model has a stall counter at every stage, and summed over a run they come to 240% of cycles. They conclude everything is a bottleneck. What went wrong, and how do you fix the accounting?</p>`,
        a: `<p>One event is being counted at several stages. A long miss blocks retirement, fills the ROB, stalls rename, and backs up decode and fetch, so the same cycle appears in four or five counters; an instruction cache miss starves every stage below it. Those are symptoms of a single cause. Fix: choose one accounting point, normally rename/allocate, and charge each unused slot there exactly once: to the front end if the queue in front of rename was empty, or to the back end if a resource was full. For back-end slots, assign the cause by looking at what's at the ROB head (or the oldest waiting instruction), with a fixed priority when several resources are full. Then the categories add to 100% of slots and form a CPI stack. Keep the per-stage counters for drilling down, but don't add them together.</p>`
      },
      {
        q: `<p>An AMD Zen 4 core dispatches 6 macro-ops per cycle into a 320-entry ROB at 5 GHz. A load misses to DRAM (about 80 ns) right after the ROB empties, and every instruction after it is independent and available from the front end. Roughly how many cycles does a retire-side counter ("cycles a missing load blocks the ROB head") report, and how many does a rename-side counter ("cycles rename stalled on a full ROB") report? Which one belongs in a CPI stack?</p>`,
        a: `<ol start="0"><li>Miss latency ≈ 80 ns × 5 GHz = <strong>400 cycles</strong>. The load is the oldest instruction, so the retire-side counter sees all ~400.</li><li>Rename keeps filling the ROB at 6 per cycle: 320 / 6 ≈ <strong>53 cycles</strong> to fill. It then stalls for about 400 − 53 ≈ <strong>347 cycles</strong>.</li><li>The first 53 cycles weren't lost: rename and execute did useful work that just retires later. So the time actually lost is ≈ 347 cycles, matching the rename-side counter. Put the rename-side count in the CPI stack (charged to DRAM, because the ROB head names the cause); the retire-side count overstates the loss by the part the window hid. A bigger ROB shrinks the rename-side number; if the instructions behind the load include other misses, they overlap with this one, and the window hides even more.</li></ol>`
      },
      {
        q: `<p>A Xeon Platinum 8480+ (Sapphire Rapids) has 56 cores, each with 16 L1 fill buffers, and 8 channels of DDR5-4800. Idle DRAM latency is about 110 ns (approximate). A random-access, miss-bound loop like a hash probe keeps every fill buffer busy. At how many active cores does DRAM bandwidth saturate? With all 56 cores running at 2.0 GHz, what is the loaded latency and the per-core cycles per miss, and does the MSHR bound agree with the bandwidth bound?</p>`,
        a: `<ol start="0"><li>Peak bandwidth = 8 × 4,800 MT/s × 8 B = <strong>307.2 GB/s</strong>.</li><li>One core sustains 16 × 64 B / 110 ns ≈ 9.3 GB/s, so N<sub>sat</sub> ≈ 307.2 / 9.3 ≈ <strong>33 cores</strong> (fewer in practice, since sustained bandwidth is closer to 70–80% of peak).</li><li>At 56 cores: M = 56 × 16 = 896 lines in flight, so L<sub>loaded</sub> = max(110 ns, 896 × 64 B / 307.2 GB/s) ≈ max(110, 187) = <strong>≈ 187 ns</strong>.</li><li>MSHR bound per core = L<sub>loaded</sub> / 16 ≈ 11.7 ns ≈ <strong>23.3 cycles per miss</strong> at 2.0 GHz, compared with 110 / 16 × 2 ≈ 13.8 cycles at idle latency.</li><li>Bandwidth bound per core = 56 × 64 B × 2.0 GHz / 307.2 GB/s ≈ <strong>23.3 cycles</strong>, the same answer, as Little's law requires. Going from about 33 to 56 cores adds almost no throughput; each core just waits longer. Using idle latency here would overestimate throughput by about 1.7×.</li></ol>`
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
},

{
  id: "perf-analytical",
  region: "perf",
  title: "Analytical Performance Models",
  sections: [
    { id: "why", label: "Why Model on Paper" },
    { id: "cpi-stack", label: "First-Order CPI Stacks" },
    { id: "interval", label: "Interval Analysis" },
    { id: "roofline", label: "The Roofline Model" },
    { id: "limits", label: "Where They Break" }
  ],
  body: `
<p>A cycle-level simulator answers "what is the IPC?" after hours of simulation. An analytical model answers "roughly what, and why?" in seconds, from a handful of event counts. They are how architects sanity-check simulator results, explore a design space before building anything, and explain a result in one sentence.</p>

<h3 id="sec-why">Why Model on Paper</h3>
<ul>
<li><strong>Speed:</strong> sweep thousands of design points (ROB sizes, cache sizes, widths) from one set of profiled event counts.</li>
<li><strong>Insight:</strong> each term names a cause, so the model says <em>why</em> IPC changed.</li>
<li><strong>A check on the simulator:</strong> when the detailed model and the first-order model disagree by a lot, one of them has a bug or a missing effect, and finding which is usually instructive.</li>
</ul>

<h3 id="sec-cpi-stack">First-Order CPI Stacks</h3>
<p>The simplest model adds a penalty per event to a base CPI:</p>
<div class="math">\\[ CPI = CPI_{base} + \\sum_e \\frac{N_e}{N_i} \\, P_e \\]</div>
<p>where \\(N_e / N_i\\) is event e's rate per instruction (MPKI / 1000) and \\(P_e\\) its penalty in cycles. For an in-order pipeline this is nearly exact (see <a href="#/stall-perf">Performance of Pipelines with Stalls</a>). For an out-of-order core it overcounts, because the core overlaps misses with each other and with useful work; the useful refinements below are about how much to subtract.</p>

<h3 id="sec-interval">Interval Analysis</h3>
<p>Interval analysis (Karkhanis and Smith, 2004; Eyerman, Eeckhout, Karkhanis, and Smith, 2009) models an out-of-order core as running at a steady dispatch rate, interrupted by <strong>miss events</strong>. Execution splits into intervals, each a stretch of steady dispatch followed by one miss event:</p>
<div class="math">\\[ C \\approx \\frac{N_i}{D_{eff}} + \\sum_{\\text{mispredicts}} (c_{res} + c_{fe}) + \\sum_{\\text{I-misses}} L_{I} + \\sum_{\\text{isolated long D-misses}} L_{mem} \\]</div>
<ul>
<li><strong>Steady state:</strong> \\(D_{eff}\\) is the dispatch rate the window sustains given the code's ILP, at most the dispatch width.</li>
<li><strong>Branch mispredict:</strong> the branch resolution time \\(c_{res}\\) (how long the branch waits in the window, which grows with the dependence chain feeding it) plus the front-end refill \\(c_{fe}\\). The resolution term is why mispredicts cost more than the pipeline depth.</li>
<li><strong>Instruction cache miss:</strong> about its full latency \\(L_I\\); the fetch queue hides only a few cycles.</li>
<li><strong>Long data cache miss:</strong> to first order, the full memory latency \\(L_{mem}\\): the cycles spent filling the ROB behind the miss are useful, but they are offset by the ramp back to steady state after it returns.</li>
<li><strong>Overlap:</strong> long misses that fall within one ROB's worth of instructions of an earlier long miss overlap with it and cost almost nothing extra. Counting only the first miss of each such group is what turns the naive sum into a usable out-of-order model.</li>
</ul>
<p>Short data cache misses (L1 misses that hit L2) are mostly hidden by the window and are folded into \\(D_{eff}\\). The Sniper simulator uses this model in place of a cycle-level core, running roughly 10× faster than a detailed simulator with modest error on many workloads.</p>

<h3 id="sec-roofline">The Roofline Model</h3>
<p>For loops limited by arithmetic or memory bandwidth, the roofline model (Williams, Waterman, and Patterson, 2009) bounds attainable throughput by the lower of two ceilings:</p>
<div class="math">\\[ \\text{Attainable FLOP/s} = \\min(\\text{Peak FLOP/s}, \\; AI \\times BW) \\]</div>
<p>Arithmetic intensity AI is FLOPs per byte moved from the memory level in question. Plotted on log-log axes, the bandwidth line rises until it meets the flat compute ceiling at the <strong>ridge point</strong>, Peak / BW. Kernels left of the ridge are memory-bound, right of it compute-bound. Extra ceilings model lower roofs: no FMA, no SIMD, L2 or L3 bandwidth instead of DRAM.</p>
<p>Example, a Ryzen 9 7950X (16 Zen 4 cores): each core does two 256-bit FMAs per cycle, 16 double-precision FLOPs, so about 1.2 TFLOP/s at an all-core clock near 4.8 GHz. Two DDR5-6000 channels give 96 GB/s. The ridge is near 13 FLOP/byte. A <code>daxpy</code> (y = a·x + y) does 2 FLOPs per 24 bytes (two loads, one store): AI ≈ 0.083, so it is capped at about 8 GFLOP/s from DRAM, under 1% of peak.</p>

<h3 id="sec-limits">Where They Break</h3>
<ul>
<li><strong>Interactions:</strong> a mispredicted branch that depends on a long miss resolves only when the miss returns, so the two penalties overlap in ways a sum of independent terms misses.</li>
<li><strong>Prefetching:</strong> it turns misses into hits or partial hits; event counts must come from the configuration being modeled.</li>
<li><strong>Bandwidth and queueing:</strong> interval analysis treats memory latency as fixed; near peak bandwidth, latency rises (see <a href="#/icx-memory">Memory Interfaces</a>).</li>
<li><strong>Resource stalls without misses:</strong> port pressure or a small scheduler can cap \\(D_{eff}\\); the bounds on <a href="#/perf-stage-stalls/bounds">Stalls by Pipeline Stage</a> estimate it.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapters 1 and 3, and Chapter 4 (the roofline model) · Karkhanis and Smith, "A First-Order Superscalar Processor Model," ISCA 2004 · Eyerman, Eeckhout, Karkhanis, and Smith, "A Mechanistic Performance Model for Superscalar Out-of-Order Processors," ACM TOCS 2009 · Carlson, Heirman, and Eeckhout, "Sniper: Exploring the Level of Abstraction for Scalable and Accurate Parallel Multi-Core Simulation," SC 2011 · Williams, Waterman, and Patterson, "Roofline: An Insightful Visual Performance Model for Multicore Architectures," CACM 2009</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 4-wide core with a 256-entry ROB runs 1,000 instructions at a steady dispatch rate of 4 when nothing goes wrong. In that stretch there are 5 mispredicts (resolution 10 cycles, front-end refill 12), 2 instruction cache misses to L2 (16 cycles each), and 3 DRAM misses (300 cycles each); the second and third are 60 instructions apart, the first is 600 instructions before them. Estimate the cycles and IPC with interval analysis.</p>`,
        a: `<ol start="0"><li>Steady state: 1,000 / 4 = 250 cycles.</li><li>Mispredicts: 5 × (10 + 12) = 110 cycles.</li><li>Instruction cache misses: 2 × 16 = 32 cycles.</li><li>DRAM misses: the second and third are within one ROB (60 &lt; 256 instructions), so they overlap and count once; the first is 600 instructions away, so it is isolated. Two groups: 2 × 300 = 600 cycles.</li><li>Total ≈ 250 + 110 + 32 + 600 = <strong>992 cycles</strong>, IPC ≈ <strong>1.0</strong>. Memory is 60% of the time; doubling the ROB to 512 wouldn't merge the first miss (600 apart), but a prefetcher that covered it would save 300 cycles.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your interval model predicts that doubling the ROB from 256 to 512 entries gains 3% IPC on a database workload. Cycle-level simulation says 15%. What could the interval model be missing?</p>`,
        a: `<p>Most likely the overlap term. If the model computes miss overlap from a fixed window or from average miss distance, it misses the distribution: on databases, many long misses sit 256 to 512 instructions apart, so a 512-entry window merges them while a 256-entry one doesn't. Recompute the groups from the actual distance between consecutive long misses at each window size. Other candidates: mispredicted branches that depend on misses resolve only after the miss, and a larger window lets the core find and overlap more of those misses before the flush; the larger window can also expose more prefetch-triggering accesses earlier. And check the simulator: a 512-entry ROB with unchanged load queue, store queue, and register file would hit those limits first, so if the simulation scaled them too, the comparison isn't like for like.</p>`
      }
    ]
  }
},

{
  id: "perf-validation",
  region: "perf",
  title: "Validating a Performance Model",
  sections: [
    { id: "what", label: "What Validation Means" },
    { id: "errors", label: "Kinds of Error" },
    { id: "micro", label: "Microbenchmarks Structure by Structure" },
    { id: "metrics", label: "Error Metrics" },
    { id: "process", label: "A Correlation Process" }
  ],
  body: `
<p>A performance model is a claim about hardware that doesn't exist yet. Validation is how a team earns the right to trust it: compare it against a reference (RTL simulation, emulation, an earlier chip, or the new silicon), find where it disagrees, and fix either the model or the understanding. <a href="#/ipc-spec">IPC and Simulation Methodology</a> covers sampling and the sources of error; this page covers how correlation is actually done.</p>

<h3 id="sec-what">What Validation Means</h3>
<p>Two different questions, and teams often need both:</p>
<ul>
<li><strong>Absolute accuracy:</strong> does the model predict the IPC the chip will achieve? Needed for performance projections and commitments to customers.</li>
<li><strong>Relative accuracy:</strong> when the design changes (bigger ROB, new prefetcher), does the model predict the direction and size of the change? This is what design decisions depend on, and a model can have it while being off in absolute terms, as long as its errors don't depend on the change being evaluated.</li>
</ul>

<h3 id="sec-errors">Kinds of Error</h3>
<ul>
<li><strong>Specification error:</strong> the model implements what the documents say, and the documents (or the modeler's reading of them) differ from the RTL: a queue size, an arbitration policy, a latency.</li>
<li><strong>Abstraction error:</strong> details deliberately left out (bank conflicts, exact predictor update timing, replay mechanisms) that turn out to matter for some workload.</li>
<li><strong>Bugs:</strong> the model doesn't do what its author intended. A model that is "too fast" often has a bug that lets something bypass a limit.</li>
<li><strong>Reference error:</strong> the thing you compare against is also imperfect: an emulator with a fake memory system, silicon with different firmware settings, or performance counters with known inaccuracies.</li>
</ul>
<p>Desikan, Burger, and Keckler's 2001 study of an Alpha 21264 simulator showed how these stack up: simulators that hadn't been checked against the real chip had large errors, and matching the chip on microbenchmarks didn't guarantee matching it on full applications.</p>

<h3 id="sec-micro">Microbenchmarks Structure by Structure</h3>
<p>Comparing SPEC IPC first tells you the model is wrong but not where. Correlation starts with microbenchmarks that each isolate one parameter, run on both the model and the reference:</p>
<div class="tbl"><table>
<tr><th>Parameter</th><th>Microbenchmark</th><th>What the curve shows</th></tr>
<tr><td>Cache and TLB latencies and sizes</td><td>Pointer chase through a randomly linked array, sweeping the array size</td><td>Steps in latency at each capacity; the step heights are the latencies</td></tr>
<tr><td>Bandwidth at each level</td><td>Streaming loads (and separately stores) over arrays sized for each level</td><td>Plateaus in bytes per cycle</td></tr>
<tr><td>ROB size</td><td>Two independent cache-missing loads separated by N filler instructions, sweeping N</td><td>Time per iteration doubles once N exceeds the window: the misses stop overlapping</td></tr>
<tr><td>Physical registers, load queue, store queue, scheduler</td><td>The same, with filler that consumes only that resource (register writes, loads, stores, dependent instructions)</td><td>The knee moves to that structure's size</td></tr>
<tr><td>Execution ports and latencies</td><td>Long chains of one instruction (latency) and many independent copies (throughput)</td><td>Cycles per instruction for each</td></tr>
<tr><td>Branch predictor</td><td>Patterns of increasing period or history length; many branches to fill the BTB</td><td>Where the misprediction rate jumps</td></tr>
<tr><td>Memory-level parallelism</td><td>K independent pointer chases interleaved, sweeping K</td><td>Throughput rises with K until MSHRs or queues saturate</td></tr>
</table></div>
<p>The window-size technique was popularized by Henry Wong's measurements of reorder buffer capacity on real x86 cores; the same benchmarks run on the model expose a misconfigured structure in minutes.</p>

<h3 id="sec-metrics">Error Metrics</h3>
<ul>
<li><strong>Per-workload error:</strong> (model − reference) / reference. Report the mean of the absolute values (mean absolute percentage error), and the worst case; a small mean can hide one workload that is 40% off.</li>
<li><strong>Bias:</strong> the mean of the signed errors. A model that is consistently 8% optimistic is easier to use than one that is ±8% at random.</li>
<li><strong>Speedup error:</strong> for a design change, compare predicted and measured speedup per workload. This is the error that matters for decisions.</li>
<li><strong>Rank correlation:</strong> do the workloads (or design options) come out in the same order? Spearman's rank correlation summarizes it.</li>
<li><strong>Event-level error:</strong> MPKI, miss rates, and stall counts per structure. Matching IPC with wrong event counts means errors are canceling, and they won't cancel after the next design change.</li>
</ul>

<h3 id="sec-process">A Correlation Process</h3>
<ol start="0">
<li><strong>Align configurations:</strong> same binary, same inputs, same compiler flags, same memory configuration and frequency, prefetchers and SMT set the same.</li>
<li><strong>Microbenchmarks first,</strong> until every structure's latency, size, and bandwidth match.</li>
<li><strong>Then small kernels</strong> (loops from real code) that combine two or three effects.</li>
<li><strong>Then full workloads,</strong> compared with a top-down breakdown on both sides, so a gap is attributed to front end, bad speculation, or a back-end resource.</li>
<li><strong>Fix the largest gap, rerun everything,</strong> and keep the whole suite as a regression, so a later model change can't silently break a parameter that was already correlated.</li>
<li><strong>Record what remains:</strong> known gaps and their direction go into every report the model produces.</li>
</ol>
<p class="refs">References: Desikan, Burger, and Keckler, "Measuring Experimental Error in Microprocessor Simulation," ISCA 2001 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1 (measuring and reporting performance) · Henry Wong, "Measuring Reorder Buffer Capacity" (blog.stuffedcow.net, 2013)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A model and the silicon give these IPCs on four workloads: A 2.10 vs 2.00, B 1.32 vs 1.20, C 0.62 vs 0.80, D 3.04 vs 3.20 (model first). Compute each error, the mean absolute percentage error, and the bias. Is the workload ranking preserved?</p>`,
        a: `<ol start="0"><li>A: (2.10 − 2.00) / 2.00 = +5%. B: (1.32 − 1.20) / 1.20 = +10%. C: (0.62 − 0.80) / 0.80 = −22.5%. D: (3.04 − 3.20) / 3.20 = −5%.</li><li>Mean absolute error: (5 + 10 + 22.5 + 5) / 4 ≈ <strong>10.6%</strong>.</li><li>Bias: (5 + 10 − 22.5 − 5) / 4 ≈ <strong>−3.1%</strong>: small on average, because errors in both directions cancel.</li><li>Ranking: silicon D &gt; A &gt; B &gt; C; model D &gt; A &gt; B &gt; C. <strong>Preserved.</strong></li><li>C is the one to investigate: the lowest-IPC workload is usually memory-bound, so a 22% pessimistic error points at the memory system (MLP, prefetcher, or DRAM latency) rather than the core.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Design the microbenchmark that measures a core's reorder buffer size, explain what curve you expect, and say what could make the measured value differ from the real ROB size.</p>`,
        a: `<p>Build a loop body of: a load that misses to DRAM, N filler instructions that don't depend on it, then a second independent DRAM-missing load, using random pointers so prefetchers can't help. Sweep N. While both loads fit in the window (N + 2 ≤ ROB entries), their misses overlap and each iteration costs about one DRAM latency; once N exceeds the window, the second load can't enter until the first retires, and the time per iteration roughly doubles. The knee is the ROB size.</p><p>Pitfalls: the filler must not consume a smaller resource first. Instructions that write registers can exhaust the physical register file first, so the usual filler is NOPs, which take a ROB entry but no register or execution port. Know the micro-op count of the filler: long NOPs and fused pairs may count differently than you expect. And with SMT, the ROB may be split between threads, so run with the sibling thread idle.</p>`
      }
    ]
  }
},

{
  id: "perf-power",
  region: "perf",
  title: "Power and Energy Modeling",
  sections: [
    { id: "basics", label: "Where Power Goes" },
    { id: "events", label: "Event-Based Energy Models" },
    { id: "costs", label: "What Operations Cost" },
    { id: "dvfs", label: "Voltage and Frequency" },
    { id: "metrics", label: "Metrics and Power Limits" }
  ],
  body: `
<p>Every modern chip is power-limited: a phone by its battery and skin temperature, a server by its socket power and cooling. A feature that adds 2% IPC and 3% power can make the chip slower once the power limit forces a lower clock. So performance models are paired with power models, and design decisions are made on performance per watt.</p>

<h3 id="sec-basics">Where Power Goes</h3>
<div class="math">\\[ P = \\underbrace{\\alpha \\, C \\, V^2 f}_{\\text{dynamic}} + \\underbrace{V \\, I_{leak}}_{\\text{static}} \\]</div>
<ul>
<li><strong>Dynamic power</strong> is spent charging and discharging capacitance C when signals switch, at activity factor α (the fraction of capacitance switched per cycle), supply voltage V, and frequency f.</li>
<li><strong>Static (leakage) power</strong> flows whenever a block is powered, switching or not. It grows steeply with temperature and with lower threshold voltages, which is why idle blocks are clock-gated (stops dynamic power) and, for longer idle periods, power-gated (stops leakage too, at the cost of wake-up time and lost state).</li>
</ul>
<p>The circuit side of these terms is on <a href="#/transistors">Transistor Physics and Energy</a>.</p>

<h3 id="sec-events">Event-Based Energy Models</h3>
<p>Architects estimate dynamic energy from the same event counts the performance model already produces:</p>
<div class="math">\\[ E = \\sum_{\\text{events } e} N_e \\, E_e \\; + \\; P_{static} \\, T \\]</div>
<p>Each structure has an energy per access (a cache read, a register file write, a scheduler wake-up, an ALU operation), estimated from its size, ports, and technology. Wattch (Brooks, Tiwari, and Martonosi, 2000) attached such estimates to a cycle-level simulator; McPAT (Li et al., 2009) added area, timing, and leakage models for full multicore chips and is still the common academic choice. In industry, the per-event energies are calibrated from RTL power analysis of the actual blocks (gate-level simulation with switching activity), then from silicon.</p>
<p>The accuracy rules are the same as for performance: absolute numbers from analytical tools can be off by a lot, but trends between design points are more trustworthy when the model has been calibrated on the blocks that change.</p>

<h3 id="sec-costs">What Operations Cost</h3>
<p>Horowitz's widely used 45 nm estimates (ISSCC 2014) show where the energy actually goes:</p>
<div class="tbl"><table>
<tr><th>Operation</th><th>Energy</th></tr>
<tr><td>32-bit integer add</td><td>0.1 pJ</td></tr>
<tr><td>32-bit floating-point add</td><td>0.9 pJ</td></tr>
<tr><td>32-bit floating-point multiply</td><td>3.7 pJ</td></tr>
<tr><td>64-bit read from an 8 KB SRAM</td><td>10 pJ</td></tr>
<tr><td>64-bit read from a 32 KB SRAM</td><td>20 pJ</td></tr>
<tr><td>64-bit read from a 1 MB SRAM</td><td>100 pJ</td></tr>
<tr><td>64-bit read from DRAM</td><td>1.3 to 2.6 nJ</td></tr>
</table></div>
<p>Newer nodes lower every number, but the ratios hold: moving data costs far more than computing on it, and a DRAM access costs as much as thousands of additions. In an out-of-order core, the arithmetic itself is a small fraction of the energy per instruction; fetch, decode, rename, scheduling, register file, and data movement take most of it. That is the overhead SIMD, accelerators, and caches near compute all attack.</p>

<h3 id="sec-dvfs">Voltage and Frequency</h3>
<p>Within the usable range, the maximum frequency rises roughly linearly with voltage. So dynamic power grows roughly with f<sup>3</sup> (V<sup>2</sup> × f with V ∝ f), while dynamic energy per operation grows with V<sup>2</sup>, roughly f<sup>2</sup>. That is why:</p>
<ul>
<li>the last few hundred MHz of turbo cost a disproportionate amount of power;</li>
<li>a chip at a fixed power limit gets more total throughput from more cores at a lower clock (if the work is parallel);</li>
<li>below a certain voltage, leakage and the minimum operating voltage stop the savings, and racing to finish then sleeping becomes better.</li>
</ul>

<h3 id="sec-metrics">Metrics and Power Limits</h3>
<ul>
<li><strong>Performance per watt</strong> (equivalently, operations per joule): the main efficiency metric.</li>
<li><strong>Energy-delay product (EDP)</strong> and <strong>ED²P</strong>: weight energy against speed; ED²P is roughly independent of voltage scaling, so it compares designs fairly when either can be retuned in voltage.</li>
<li><strong>Performance at a power limit:</strong> the decision metric for a power-capped part. Model the change, recompute power, and let the frequency drop until power is back at the cap; then compare performance.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1 (trends in power and energy) · Brooks, Tiwari, and Martonosi, "Wattch: A Framework for Architectural-Level Power Analysis and Optimizations," ISCA 2000 · Li et al., "McPAT: An Integrated Power, Area, and Timing Modeling Framework for Multicore and Manycore Architectures," MICRO 2009 · Horowitz, "Computing's Energy Problem (and What We Can Do About It)," ISSCC 2014</p>`,
  practice: {
    guided: [
      {
        q: `<p>A CPU-bound task runs on a core that drops its clock by 20% and its voltage by 10%. Ignoring leakage, how do dynamic power, run time, and dynamic energy for the task change?</p>`,
        a: `<ol start="0"><li>Power ∝ V<sup>2</sup> f: 0.9<sup>2</sup> × 0.8 = 0.81 × 0.8 = <strong>0.648</strong>, a 35% cut.</li><li>Time: a CPU-bound task scales with 1 / f, so 1 / 0.8 = <strong>1.25×</strong> as long.</li><li>Energy = power × time: 0.648 × 1.25 = <strong>0.81</strong>, a 19% saving. It equals the V<sup>2</sup> ratio, as expected: energy per operation depends on voltage, not frequency.</li><li>If the task were memory-bound, its time would grow less than 25%, and the energy saving would be larger.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A larger branch predictor raises IPC by 2% and core power by 1.5%. The part always runs at its power limit, and power scales roughly with f<sup>3</sup>. Is the predictor worth it? At what power increase would it break even?</p>`,
        a: `<p>At the cap, the frequency must drop until power returns to the limit: 1.015 × f<sup>3</sup> = 1, so f falls by a factor of 1.015<sup>−1/3</sup> ≈ 0.995. Performance ∝ IPC × f = 1.02 × 0.995 ≈ <strong>1.015</strong>, so the gain shrinks from 2% to about 1.5%: still worth it.</p><p>Break-even: 1.02 × (1 + p)<sup>−1/3</sup> = 1, so 1 + p = 1.02<sup>3</sup> ≈ 1.061. A feature costing more than about <strong>6% power</strong> for 2% IPC makes a power-capped part slower. In general, with P ∝ f<sup>3</sup>, a feature pays off at the cap when its IPC gain exceeds a third of its power cost. The caveat: if the part is limited by temperature or current rather than average power, or isn't at its limit, the rule changes.</p>`
      }
    ]
  }
}
]);
