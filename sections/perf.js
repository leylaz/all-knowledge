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

<h3 id="sec-accounting">Where to Count: Rename and Retire</h3>
<p>If every stage counts its own stalls, the totals add up to far more than 100% of cycles, because one miss is counted at five stages. Good accounting picks one point in the pipeline and charges each lost slot there exactly once:</p>
<ul>
<li><strong>Rename/allocate is the usual accounting point.</strong> It sits on the boundary between front end and back end, so a slot that goes unused there is either <em>front-end bound</em> (the queue in front of rename was empty) or <em>back-end bound</em> (some back-end resource was full). Slots that are used are later sorted into <em>retiring</em> or <em>bad speculation</em> depending on whether their instructions retired. This is exactly Intel's top-down method (see <a href="#/perf-bottlenecks/topdown">The top-down method</a>).</li>
<li><strong>Retire is where back-end stalls get explained.</strong> Rename can only say "the ROB was full." The ROB head says why: a load that missed in L2, a divide, a fence. So back-end slots counted at rename are assigned a cause by looking at the ROB head (or the oldest waiting instruction) in the same cycle.</li>
<li><strong>The two can disagree, and that's expected.</strong> A retire-side counter starts counting as soon as a missing load reaches the ROB head, but rename keeps working until the ROB fills, so part of that time isn't lost. Rename-side stalls measure lost throughput; retire-side stalls measure how long the oldest instruction blocked. Use rename-side counts for CPI stacks and retire-side observations to name the cause.</li>
</ul>

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

<h3 id="sec-silicon">Finding the Cause on Silicon</h3>
<p>Hardware has only a few counters that can run at once, so the work is done in rounds, from the top level down:</p>
<ol start="0">
<li><strong>Top-down level 1</strong> from a few counters: slots offered at rename, micro-ops not delivered by the front end, micro-ops issued, micro-ops retired, and recovery cycles after flushes. On Intel these are events such as <code>IDQ_UOPS_NOT_DELIVERED</code>, <code>UOPS_ISSUED.ANY</code>, <code>UOPS_RETIRED.RETIRE_SLOTS</code>, and <code>INT_MISC.RECOVERY_CYCLES</code> (names vary by generation); Arm's PMU defines <code>STALL_FRONTEND</code> and <code>STALL_BACKEND</code>, and AMD documents its own pipeline-utilization breakdown for Zen. Tools like Linux <code>perf stat --topdown</code>, pmu-tools <code>toplev</code>, and VTune compute this.</li>
<li><strong>Drill into the largest category.</strong> For back-end bound, split memory from core with counters such as "cycles stalled with an L1/L2/L3 miss outstanding" (Intel <code>CYCLE_ACTIVITY.STALLS_L3_MISS</code> and similar), resource-stall counts by structure, port utilization, and divider-active cycles. For front-end bound, split latency (instruction cache and TLB misses, redirects) from bandwidth (decoder and micro-op cache limits).</li>
<li><strong>Find the code.</strong> Precise sampling (Intel PEBS, AMD IBS, Arm SPE) tags a sample with the PC and often the load latency or data source of the instruction that caused the event, without the "skid" of ordinary sampling, which can blame an instruction several places after the real one.</li>
<li><strong>Confirm with a microbenchmark</strong> that isolates the suspected cause (a pointer chase, a divide chain, a partial-overlap store-forward), then compare its counter signature against the real workload.</li>
</ol>

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
<p>Try it: the calculator below takes the main bound from each table that follows and adds the serialized penalties. Change one number at a time and watch which row becomes the bottleneck.</p>
<div class="calc" data-calc="bounds"></div>

<h3 id="sec-fe-bounds">Front-End Bounds</h3>
<p>The front end limits how fast micro-ops enter the machine; when it binds, the back end sits idle however wide it is.</p>
<div class="tbl"><table>
<tr><th>Bottleneck</th><th>Bound (cycles/iteration)</th><th>Why</th><th>Binds when</th></tr>
<tr><td>Fetch bandwidth</td><td>Bytes<sub>iter</sub> / F<sub>bytes</sub></td><td>Fetch reads F<sub>bytes</sub> per cycle from the instruction cache, often 16 to 32 B</td><td>Long x86 encodings, loops of large instructions</td></tr>
<tr><td>Taken branches</td><td>N<sub>tk</sub> / T<sub>tk</sub></td><td>Most cores follow 1 taken branch per cycle (some recent cores 2), and fetch stops at each one; each fetch block also rounds up, Σ ⌈block size / W<sub>fetch</sub>⌉</td><td>Tiny loops, branchy code</td></tr>
<tr><td>Decode width</td><td>N<sub>i</sub> / W<sub>dec</sub></td><td>Decoders handle at most W<sub>dec</sub> instructions per cycle</td><td>The legacy decode path on x86 (micro-op cache misses)</td></tr>
<tr><td>Complex decode</td><td>N<sub>complex</sub> / P<sub>complex</sub></td><td>Instructions that crack into several micro-ops often decode on only one decoder</td><td>Microcoded or multi-micro-op instructions in a hot loop</td></tr>
<tr><td>Micro-op cache delivery</td><td>N<sub>u</sub> / W<sub>uc</sub></td><td>The micro-op cache supplies W<sub>uc</sub> micro-ops per cycle and replaces decode when the loop fits</td><td>Loops that fit in the micro-op cache</td></tr>
<tr><td>Loop buffer</td><td>N<sub>u</sub> / W<sub>lsd</sub></td><td>Small loops replay from a buffer at its width</td><td>Very small loops</td></tr>
<tr><td>Instruction cache misses</td><td>N<sub>i</sub> · m<sub>I</sub> · L<sub>I</sub> (roughly additive)</td><td>Each miss starves the back end once the fetch queue drains</td><td>Large code footprints (databases, JITs)</td></tr>
<tr><td>Instruction TLB misses</td><td>N<sub>i</sub> · m<sub>ITLB</sub> · L<sub>walk</sub> (roughly additive)</td><td>Same, with page-walk latency</td><td>Huge binaries without large pages</td></tr>
</table></div>
<p><strong>Branch mispredicts are serializing.</strong> A mispredict flushes everything younger than the branch, and the useful-work gap is the time for the branch to resolve plus the time to refill the pipeline:</p>
<div class="math">\\[ T_{mp} = N_{br} \\, m_{br} \\, (L_{resolve} + L_{refill}) \\]</div>
<p>This adds to the max of the other bounds, since nothing useful overlaps it. \\(L_{refill}\\) is roughly the front-end depth, about 10 to 20 cycles on modern cores. \\(L_{resolve}\\) is how long the branch waits for its operands: a branch that depends on a DRAM miss resolves only when the miss returns, and its flush also throws away the other misses queued behind it, destroying memory-level parallelism.</p>
<p><strong>Front-end decoupling.</strong> The fetch queue (or micro-op queue) absorbs short bubbles, so short front-end stalls overlap with back-end work; long ones (instruction cache misses to L3 or DRAM, mispredicts) don't. Treat stalls shorter than the queue's drain time as hidden and longer ones as additive.</p>

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
}
]);
