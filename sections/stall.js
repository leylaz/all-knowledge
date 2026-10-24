/* Section: Stalls and bottlenecks
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "stall"). */

section({
  id: "stall",
  name: "Stalls and Bottlenecks",
  cap: "Statistics, stall causes, bottleneck types, tracing and bounding stalls",
  body: `
<p>This region is about where the cycles go: what a model counts, every reason a cycle can be lost, how to sort those losses into a few bottleneck types, how to trace a stall from the stage that shows it to the stage that causes it, and how to bound each stage's cost before running anything. For methodology, workloads, benchmarks, and models, see <a href="#/r/perf">Performance Analysis</a>.</p>
<h3>How the Pages Fit Together</h3>
<ul>
<li><a href="#/perf-stats">Performance statistics</a>: what a model counts, and how.</li>
<li><a href="#/perf-stalls">Stall causes</a>: every reason a cycle can be lost, by pipeline area.</li>
<li><a href="#/perf-bottlenecks">Bottleneck types</a>: the top-down categories, and latency-bound vs. throughput-bound.</li>
<li><a href="#/perf-stage-stalls">Stalls by pipeline stage</a>: where each stage stalls and why, and how a stall spreads from the stage that causes it to the stages that show it.</li>
<li><a href="#/perf-find-cause">Finding a stall's cause</a>: the procedure in a model and on silicon.</li>
<li><a href="#/perf-bounds">Bounding each stage</a>: the cycles-per-iteration bound each stage and structure sets, computed before running anything.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Over 4.0 × 10<sup>9</sup> cycles on an Intel Gracemont core (5-wide allocation), the model's per-stage counters report: fetch stalled on a full fetch queue 1.0 × 10<sup>9</sup> cycles, decode stalled on a full queue 1.1 × 10<sup>9</sup>, rename stalled on a full ROB 1.2 × 10<sup>9</sup>, and a missing load at the ROB head 1.3 × 10<sup>9</sup>. In every ROB-full cycle the head is a load that missed. What share of cycles is lost to memory, and which counter do you trust?</p>`,
        a: `<ol start="0"><li>The four counters sum to 4.6 × 10<sup>9</sup>, 115% of cycles, so they can't all be separate losses: one event is being counted at several stages.</li><li>Fetch and decode were stalled on full queues: back-pressure, so follow it downstream to rename, which waits on the full ROB, which waits on the load at the head. The cause is <strong>memory</strong>.</li><li>Rename-side stalls measure lost throughput: 1.2 / 4.0 = <strong>30% of cycles</strong>, charged to memory.</li><li>The retire-side count (1.3 × 10<sup>9</sup>, 32.5%) is larger because it starts as soon as the missing load reaches the head, while rename keeps filling the ROB. Those 0.1 × 10<sup>9</sup> cycles weren't lost. Trust the rename-side number for the CPI stack and the ROB head for the cause.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>In your model, a new L2 prefetcher cuts L2 MPKI by 40%, but IPC rises only 1%. How do you find out why?</p>`,
        a: `<p>Start from whether the removed misses were costing cycles. Top-down level 1 first: if the workload is front-end, core, or bad-speculation bound, memory was never the main loss. If it is memory-bound, look at the ROB head in rename-stalled cycles: how often was an L2 miss actually there, before and after? If the misses overlapped with each other (high memory-level parallelism) or with longer misses to DRAM, removing them hides little, because the window was already waiting on something else. Check timeliness: late prefetches turn misses into hits that still wait most of the latency. Check the cost side: prefetches use MSHRs, queue entries, and bandwidth, so if the loop is bandwidth-bound the prefetcher moves the same bytes and the bound doesn't change. Finally, an idealization run (L2 always hits) gives the upper bound: if that's only a few percent, no prefetcher can do better.</p>`
      }
    ]
  }
}, [
{
  id: "perf-stats",
  region: "stall",
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
<tr><td>Overall</td><td><ul><li>Cycles</li><li>Instructions and micro-ops retired</li><li>IPC and CPI</li><li>Instruction mix (loads, stores, branches, integer, floating point, vector)</li></ul></td></tr>
<tr><td>Front end</td><td><ul><li>Instruction cache accesses, misses, and MPKI</li><li>Instruction TLB misses</li><li>BTB hits and misses</li><li>Fetch bubbles</li><li>Fetch queue occupancy</li><li>Decoded-instruction (micro-op) cache hit rate</li></ul></td></tr>
<tr><td>Branch prediction</td><td><ul><li>Conditional branch mispredicts (accuracy and MPKI)</li><li>Indirect target mispredicts</li><li>Return mispredicts</li><li>Cycles lost to each</li></ul></td></tr>
<tr><td>Rename and dispatch</td><td><ul><li>Stall cycles by cause: ROB full, issue queue full, load queue full, store queue full, out of physical registers (integer and floating point)</li><li>Dispatch width used per cycle</li></ul></td></tr>
<tr><td>Window occupancy</td><td>Average, maximum, and histogram of ROB, issue queue, load queue, store queue, and physical register file occupancy</td></tr>
<tr><td>Issue and execute</td><td><ul><li>Instructions issued per cycle (histogram)</li><li>Utilization of each execution port and unit</li><li>Cycles a ready instruction waited for a busy port</li><li>Replays after load-hit misspeculation</li><li>Divider busy cycles</li></ul></td></tr>
<tr><td>Loads and stores</td><td><ul><li>Store-to-load forwards</li><li>Forwarding failures and their stalls</li><li>Memory-ordering violations and the flushes they cause</li><li>Memory dependence predictor false dependences</li><li>Load latency distribution</li><li>Misaligned and line-split accesses</li><li>Store buffer full cycles</li><li>Coalesced stores</li></ul></td></tr>
<tr><td>Each cache level</td><td><ul><li>Accesses, hits, misses, MPKI</li><li>Miss latency (average and histogram)</li><li>MSHR occupancy and cycles full</li><li>Evictions and writebacks</li><li>Bank conflicts</li></ul></td></tr>
<tr><td>Prefetchers</td><td><ul><li>Prefetches issued, useful, late, and useless</li><li>Accuracy, coverage, and timeliness</li><li>Cache pollution (useful lines evicted by prefetches)</li></ul></td></tr>
<tr><td>TLBs and page walks</td><td><ul><li>Misses at each TLB level</li><li>Page walks</li><li>Walk latency</li><li>Page-walk cache hits</li></ul></td></tr>
<tr><td>Coherence</td><td><ul><li>Invalidations sent and received</li><li>Coherence misses</li><li>Upgrades</li><li>Directory or snoop lookups</li><li>Cycles stalled in transient states</li><li>Lines bouncing between cores</li></ul></td></tr>
<tr><td>Memory (DRAM)</td><td><ul><li>Reads and writes</li><li>Bandwidth used</li><li>Row-buffer hits, misses, and conflicts</li><li>Queueing delay</li><li>Bank utilization</li><li>Memory-level parallelism (average outstanding misses)</li></ul></td></tr>
<tr><td>Retire and recovery</td><td><ul><li>Retire width used per cycle</li><li>Flushes by cause (mispredict, ordering violation, exception) and cycles lost to each</li><li>Which instruction type was at the ROB head while retirement was stalled</li></ul></td></tr>
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
  region: "stall",
  title: "Stall Causes",
  sections: [{ id: "by-area", label: "By Pipeline Area" }, { id: "details", label: "Details That Are Easy to Get Wrong" }],
  body: `

<p>Two kinds of counters are at the heart of a cycle-level model's statistics: <strong>event counts</strong> (how many mispredicts, misses, or flushes happened) and <strong>stall cycles by cause</strong> (how many cycles were lost, and why). The causes, grouped by where in the pipeline they arise:</p>
<h3 id="sec-by-area">Stall Causes by Pipeline Area</h3>
<div class="tbl"><table>
<tr><th>Area</th><th>Stall causes</th></tr>
<tr><td>Front end: no instructions arriving</td><td><ul><li>Instruction cache and instruction TLB misses</li><li>BTB misses</li><li>The bubble after a taken branch</li><li>Decoder limits (complex instructions needing microcode)</li><li>Fetch blocks that cross cache lines</li></ul></td></tr>
<tr><td>Rename and dispatch: no room for new instructions (back-pressure)</td><td><ul><li>ROB full</li><li>Issue queue or scheduler queues full</li><li>Load queue or store queue full</li><li>Out of physical registers</li><li>Out of branch checkpoints (saved snapshots of the rename table)</li><li>Serializing instructions and fences</li><li>Rename width (a throughput limit rather than a stall)</li></ul></td></tr>
<tr><td>Issue and execute</td><td><ul><li>Operands not ready (dependency chains)</li><li>Execution ports or units busy</li><li>A non-pipelined unit such as the divider still occupied</li><li>Register file port conflicts</li><li>Replays after a load was expected to hit but missed</li></ul></td></tr>
<tr><td>Loads and stores</td><td><ul><li>Store-forwarding stalls</li><li>Loads waiting on older stores with unknown addresses</li><li>Cache bank conflicts</li><li>MSHRs full</li><li>Store buffer full</li><li>Misaligned or line-split accesses</li></ul></td></tr>
<tr><td>Memory system and multicore</td><td><ul><li>Cache misses to L2, the last-level cache, and DRAM</li><li>TLB misses and page walks</li><li>DRAM queueing when bandwidth is saturated</li><li>DRAM row conflicts</li><li>Waiting for exclusive ownership of a line</li><li>False sharing</li><li>Atomic operations and fences draining the store buffer</li></ul></td></tr>
<tr><td>Flushes: wasted work rather than waiting</td><td><ul><li>Branch mispredicts</li><li>Memory-ordering violations</li><li>Exceptions and interrupts</li><li>Self-modifying code</li></ul></td></tr>
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
  id: "perf-bottlenecks",
  region: "stall",
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
<p>Each signature below is a first guess, not a diagnosis. The measurements that confirm each one, in order, and the experiment that proves it are on <a href="#/perf-find-cause/by-type">Finding a stall's cause</a>. Each item links to its own steps.</p>
<ul>
<li><strong>Memory latency-bound:</strong> many misses per kilo-instruction (MPKI) with low memory-level parallelism (few misses outstanding at once), and the ROB often full with a missing load at its head. Use MPKI, not miss rate: a high miss rate on a structure that is rarely accessed costs little. <a href="#/perf-find-cause/mem-latency">Steps</a>.</li>
<li><strong>Memory concurrency-bound:</strong> memory-level parallelism already high but flat, miss-status holding registers (MSHRs) full most of the time, while bandwidth stays well below peak and latency stays near idle. <a href="#/perf-find-cause/mem-concurrency">Steps</a>.</li>
<li><strong>Memory bandwidth-bound:</strong> bandwidth use near the platform's achievable peak, and loaded memory latency far above the idle latency because requests queue (see <a href="#/icx-memory/controller">the memory controller</a>). <a href="#/perf-find-cause/mem-bandwidth">Steps</a>.</li>
<li><strong>Core latency-bound:</strong> low MPKI and idle execution ports, but instructions waiting on operands from long-latency operations. <a href="#/perf-find-cause/core-latency">Steps</a>.</li>
<li><strong>Core throughput-bound:</strong> one or more execution ports busy nearly every cycle. <a href="#/perf-find-cause/core-throughput">Steps</a>.</li>
<li><strong>Front-end bound:</strong> high instruction cache or BTB MPKI and an often-empty fetch queue, typical of large code footprints (servers, browsers, compilers). <a href="#/perf-find-cause/front-end">Steps</a>.</li>
<li><strong>Bad speculation:</strong> many branch mispredicts per kilo-instruction and many flushed instructions. <a href="#/perf-find-cause/bad-spec">Steps</a>.</li>
</ul>
<h3 id="sec-dependency">Dependency Stalls on a Load Miss</h3>
<p>When instructions wait on a load that missed, the stall counts as memory-bound, even though it shows up as "operands not ready." How the dependents wait and wake up is on <a href="#/perf-stalls/details">Stall causes</a>; what matters for classification is how much of the miss the core can hide:</p>
<ul>
<li><strong>Worst case:</strong> everything after the load depends on it, so nothing independent is left to run.</li>
<li><strong>Best case, with a limit:</strong> independent instructions keep issuing, but instructions retire in order, so the ROB fills behind the stuck load. A 4-wide core with a 128-entry ROB fills it in about 128 / 4 = 32 cycles and then stalls anyway. The latency is fully hidden only if the miss is short (like an L2 hit) or the work behind it includes other misses that overlap with it.</li>
</ul>
<p>Overlapping independent misses is called <strong>memory-level parallelism</strong>; see <a href="#/latency-tolerance/mlp">What memory-level parallelism means</a>.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Classify each workload into the latency-bound vs. throughput-bound, memory vs. core grid:</p><ul><li>(a) Traversing a large linked list</li><li>(b) Adding two huge arrays element by element</li><li>(c) A loop computing a running sum with floating-point adds into one variable</li><li>(d) A large dense matrix multiplication</li></ul>`,
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
  id: "perf-stage-stalls",
  region: "stall",
  title: "Stalls by Pipeline Stage",
  sections: [
    { id: "symptom-cause", label: "Where a Stall Shows vs. Where It Starts" },
    { id: "stages", label: "Stage by Stage" },
    { id: "accounting", label: "Where to Count: Rename and Retire" }
  ],
  body: `
<p><a href="#/perf-stalls">Stall causes</a> lists every reason a cycle can be lost. This page looks at the same problem by <em>place</em>: which stage of an out-of-order core stops moving work, why that stage in particular, and how an engineer traces a stall seen at one stage back to the stage that caused it.</p>
<p>Two pages build on this one: <a href="#/perf-find-cause">Finding a stall's cause</a> turns the tracing rule into a procedure for models and silicon, and <a href="#/perf-bounds">Bounding each stage</a> puts a number on how many cycles each stage can cost per loop iteration.</p>

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
`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core (Intel Golden Cove allocates 6 micro-ops per cycle) runs for 2.0 × 10<sup>9</sup> cycles. Counters report: 2.4 × 10<sup>9</sup> slots not delivered by the front end, 7.8 × 10<sup>9</sup> micro-ops issued, 6.6 × 10<sup>9</sup> micro-ops retired, and 0.1 × 10<sup>9</sup> recovery cycles after flushes. Compute the top-down level 1 breakdown, and say which stage you would look at next.</p>`,
        a: `<ol start="0"><li>Total slots = 6 × 2.0 × 10<sup>9</sup> = 12.0 × 10<sup>9</sup>.</li><li>Retiring = 6.6 / 12.0 = <strong>55%</strong>.</li><li>Bad speculation = (issued − retired + width × recovery cycles) / slots = (7.8 − 6.6 + 6 × 0.1) / 12.0 = 1.8 / 12.0 = <strong>15%</strong>. Recovery cycles count because rename issues nothing while the pipeline refills.</li><li>Front-end bound = 2.4 / 12.0 = <strong>20%</strong>.</li><li>Back-end bound = 100 − 55 − 15 − 20 = <strong>10%</strong>.</li><li>Front end is the largest loss, so look at fetch and decode: instruction cache and BTB MPKI, and micro-op cache hit rate, to tell latency (misses, redirects) from bandwidth (decoder limits).</li></ol>`
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
      }
    ]
  }
},

{
  id: "perf-find-cause",
  region: "stall",
  title: "Finding a Stall's Cause",
  sections: [
    { id: "model", label: "Finding the Cause in a Model" },
    { id: "silicon", label: "Finding the Cause on Silicon" },
    { group: "Diagnosing Each Stall Type" },
    { id: "by-type", label: "The Shared Procedure" },
    { id: "mem-latency", label: "Memory Latency-Bound" },
    { id: "mem-concurrency", label: "Memory Concurrency-Bound" },
    { id: "mem-bandwidth", label: "Memory Bandwidth-Bound" },
    { id: "core-latency", label: "Core Latency-Bound" },
    { id: "core-throughput", label: "Core Throughput-Bound" },
    { id: "front-end", label: "Front-End Bound" },
    { id: "bad-spec", label: "Bad Speculation" }
  ],
  body: `
<p><a href="#/perf-stage-stalls/symptom-cause">Where a stall shows vs. where it starts</a> gives the rule for tracing a stall to its source. This page is the procedure for applying it in two settings: a performance model, which can see every structure every cycle, and silicon, which has a handful of counters and sampling. The last part goes through each bottleneck type from <a href="#/perf-bottlenecks/diagnose">Telling them apart</a> and gives the steps that confirm it.</p>

<h3 id="sec-model">Finding the Cause in a Model</h3>
<p>A performance model can see every structure every cycle, so it can find causes exactly instead of inferring them:</p>
<ol start="0">
<li><strong>Stall reasons with a fixed priority.</strong> Every cycle, each stage records why it passed fewer than its width, choosing one reason by a fixed order (for example, at rename: ROB full, then the instruction's issue queue, then load queue or store queue, then free registers). Counting only the first missing resource keeps the counts from overlapping. See <a href="#/perf-stalls/details">Details that are easy to get wrong</a>.</li>
<li><strong>Blame propagation.</strong> When rename is stalled on a full ROB, record the class of the instruction at the ROB head (load served by L2, load served by the last-level cache, load served by DRAM, divide, fence) and charge the slot to that class. This turns a symptom counter into a cause counter and produces a CPI stack directly.</li>
<li><strong>Occupancy histograms.</strong> A structure that's full 30% of the time is a bottleneck candidate; one that's never more than half full isn't, however large its stall count looks elsewhere (see <a href="#/perf-stats/tracked">What's tracked, structure by structure</a>).</li>
<li><strong>Pipeline traces.</strong> Record each instruction's cycle at fetch, decode, rename, issue, complete, and retire, and view them in a pipeline viewer (gem5's O3 pipeline view, Konata). A stall shows up as a gap between two stages, and the instruction that every other instruction is lined up behind is visible directly.</li>
<li><strong>Per-PC attribution.</strong> Charge stall cycles to the PC of the instruction responsible (the missing load, the mispredicted branch). A handful of PCs usually accounts for most of the loss.</li>
<li><strong>Idealization experiments.</strong> Confirm a suspected cause by removing it: make the L2 always hit, give the ROB unlimited entries, use a perfect branch predictor. The IPC gained is an upper bound on what fixing that stage can deliver, and if it's small, the stall counter was pointing at a symptom.</li>
</ol>
<details class="ex"><summary>Worked example: deciding what to fix on a pointer-heavy benchmark</summary>
<p><strong>Question.</strong> On SPEC CPU2017 <code>505.mcf_r</code> (network simplex over large linked structures), your model of a 6-wide core with a 512-entry ROB and 16 L1D miss-status holding registers (MSHRs) runs at IPC 0.62 and reports rename stalled on "ROB full" 41% of cycles. The team wants to double the ROB. The model also gives you:</p>
<ul>
<li><strong>Blame propagation</strong> (class of the instruction at the ROB head during the ROB-full cycles):
<ul>
<li>load served by DRAM (missed the last-level cache): 64%</li>
<li>load served by L2: 14%</li>
<li>mispredicted branch still waiting on its operand: 12%</li>
<li>other: 10%</li>
</ul></li>
<li><strong>Misses in flight</strong> while the ROB is full: a histogram with a mean of 1.4, rarely above 3.</li>
<li><strong>Per-PC attribution:</strong> 5 load PCs account for 71% of the ROB-full cycles, and each one loads a pointer field (the next arc or node) that the following load uses as its address.</li>
<li><strong>Idealization experiments:</strong>
<div class="tbl"><table>
<tr><th>Experiment</th><th>IPC</th><th>Gain</th></tr>
<tr><td>Baseline</td><td>0.62</td><td>—</td></tr>
<tr><td>2× ROB (and matching queues)</td><td>0.66</td><td>+6%</td></tr>
<tr><td>Perfect branch prediction</td><td>0.71</td><td>+15%</td></tr>
<tr><td>Last-level cache always hits</td><td>0.95</td><td>+53%</td></tr>
<tr><td>Both of the last two</td><td>1.35</td><td>+118%</td></tr>
</table></div></li>
</ul>
<p>Should the team double the ROB? If not, where should the area go?</p>
<ol start="0">
<li><strong>Blame propagation first.</strong> 64% of the ROB-full cycles have a load served by DRAM at the head, so rename's "ROB full" is a symptom and the cause is mostly DRAM latency.</li>
<li><strong>Is the window the limit, or the misses?</strong> A mean of 1.4 misses in flight, against 16 MSHRs, means the misses are dependent (pointer chasing): each address comes from the previous miss, so a bigger ROB has nothing independent to overlap. A histogram near the MSHR limit would instead say the window was the limit.</li>
<li><strong>Per-PC attribution.</strong> The 5 hot PCs all load the next pointer, which confirms the dependent-miss reading from step 1.</li>
<li><strong>Read the idealization table.</strong> The bigger ROB is worth 6%, so the counter was mostly pointing at a symptom. Memory is the cause (+53%). The two ideals together give far more than the sum of the separate gains (+118% vs. +68%): the mispredicted branches depend on missing loads, so each one resolves late and flushes the misses queued behind it. Fixing either one alone leaves the other in the way.</li>
<li><strong>Recommendation:</strong> don't double the ROB. Spend the area on memory-side help (a prefetcher that can follow pointers, or a lower-latency path to memory) and on predicting branches that depend on loads.</li>
</ol>
</details>
<details class="ex"><summary>Worked example: one streaming kernel, two different memory bottlenecks</summary>
<p><strong>Question.</strong> Your model of an Intel Sapphire Rapids socket (Golden Cove cores with 16 L1 fill buffers and 48 outstanding L2 misses, 8 channels of DDR5-4800, about 100 ns idle DRAM latency) runs SPEC CPU2017 <code>519.lbm_r</code>, a lattice-Boltzmann stencil that streams through two large grids. It is memory-bound both on 1 core and on all 32 cores. Is it the same bottleneck?</p>
<ol start="0">
<li><strong>One core: measure, don't guess.</strong> At L2, the demand-miss MLP is 46, and the occupancy histogram has 81% of busy cycles at exactly 48. Loaded DRAM latency is 110 ns, close to idle. By Little's law the core pulls 46 × 64 B / 110 ns ≈ <strong>27 GB/s</strong>, against a theoretical peak of 8 × 38.4 = 307 GB/s.</li>
<li><strong>Read it.</strong> MSHRs pinned at the maximum, bandwidth under 10% of peak, latency near idle: the core is <strong>concurrency-bound</strong>. It can't keep more misses in flight, and each one isn't slowed by queueing.</li>
<li><strong>Prove it with two experiments.</strong> Doubling the ROB (with matching queues) gains 2%: the window already holds more independent misses than the MSHRs can track. Doubling the L2 MSHRs to 96 gains 71%: MLP rises to 88, latency only to 118 ns, and bandwidth to 88 × 64 B / 118 ns ≈ 48 GB/s, a 78% increase. IPC gains a little less than bandwidth because not every cycle was memory-stalled.</li>
<li><strong>32 cores: same counters, different reading.</strong> Socket DRAM traffic (reads and writebacks) is 236 GB/s, about 77% of theoretical, which is close to what STREAM achieves on this kind of platform. The L2 MSHRs still sit at 48 most of the time, but each core now gets only 236 / 32 ≈ 7.4 GB/s, so by Little's law each miss takes 48 × 64 B / 7.4 GB/s ≈ <strong>415 ns</strong>, four times idle.</li>
<li><strong>Read it.</strong> Bandwidth near the achievable peak and latency rising with load: <strong>bandwidth-bound</strong>. The MSHRs look full only because each miss is held four times longer. The 96-MSHR experiment confirms it: +1% IPC, and the loaded latency roughly doubles.</li>
<li><strong>Recommendation.</strong> For 1-core performance, more L2 miss tracking (or L2 prefetchers that cover more lines in flight) is worth the area. For the socket, only fewer bytes or more bandwidth help. In lbm, each written grid line costs a read for ownership, then a writeback. Non-temporal stores remove the read, cutting traffic from 3 lines to 2 per updated line, which the model should show as up to 1.5× throughput at 32 cores.</li>
</ol>
</details>
<details class="ex"><summary>Worked example: a front-end-bound server trace</summary>
<p><strong>Question.</strong> Your model of an AMD Zen 4 core (6-wide dispatch, 320-entry ROB, 32 KB instruction cache, 6.75K-entry op cache) runs a trace of an OLTP database. Top-down level 1: retiring 34%, front-end bound 31%, bad speculation 9%, back-end bound 26%. Where do you spend effort?</p>
<ol start="0">
<li><strong>Confirm starvation.</strong> In the front-end-bound cycles the ROB averages 90 of 320 entries and no allocation stall is recorded. The back end has room, so rename is starved and the cause is upstream.</li>
<li><strong>Split latency from bandwidth.</strong> 24 of the 31 points are cycles in which the queue in front of rename was empty (fetch latency), and 7 are cycles with some but fewer than 6 micro-ops (fetch bandwidth). Latency dominates.</li>
<li><strong>Blame each empty cycle on what fetch was waiting for.</strong> Instruction cache misses 11 points, BTB-miss redirects from decode 9, instruction TLB misses 2, and 2 points of refill after execute-time mispredicts. Move those last 2 to bad speculation, where they belong. MPKI: instruction cache 28, BTB 14.</li>
<li><strong>Find the code.</strong> Per-PC attribution shows no small set of culprits: the hot code is about 6 MB spread over thousands of functions, which is typical of database and other warehouse-scale code.</li>
<li><strong>Idealization experiments:</strong>
<div class="tbl"><table>
<tr><th>Experiment</th><th>Gain</th></tr>
<tr><td>Perfect instruction cache</td><td>+12%</td></tr>
<tr><td>Perfect BTB</td><td>+15%</td></tr>
<tr><td>Both</td><td>+36%</td></tr>
<tr><td>4× op cache</td><td>+2%</td></tr>
<tr><td>4× BTB (realistic)</td><td>+11%</td></tr>
</table></div></li>
<li><strong>Read the table.</strong> Together the two ideals give more than the sum (+36% vs. +27%). The reason is fetch-directed instruction prefetching (Reinman, Calder, and Austin, MICRO 1999): the branch predictor runs ahead of fetch and prefetches the lines it predicts, but only as far as the BTB knows the branches. Each BTB miss stops the run-ahead, so the next instruction cache miss is exposed (Ishii et al., ISPASS 2021, make the same point for industry cores). The op cache result rules out decode bandwidth.</li>
<li><strong>Recommendation:</strong> a larger or second-level BTB first, since a realistic 4× BTB recovers most of the perfect-BTB gain and also makes the existing instruction prefetcher work. On the software side, profile-guided layout (BOLT) and huge pages for code attack the same misses.</li>
</ol>
</details>
<details class="ex"><summary>Worked example: is bad speculation a predictor problem or a penalty problem?</summary>
<p><strong>Question.</strong> Your model of a 6-wide core with a 64 KB TAGE-class predictor runs SPEC CPU2017 <code>541.leela_r</code> (Go-playing tree search with random playouts) at IPC 1.45. Bad speculation is 30% of slots, and mispredicts are 10.5 per kilo-instruction. The predictor team asks for twice the storage. What does the model say?</p>
<ol start="0">
<li><strong>Cost per mispredict.</strong> CPI = 1 / 1.45 = 0.69. Bad speculation costs 0.30 × 0.69 ≈ 0.21 cycles per instruction, or 207 cycles per kilo-instruction, so each mispredict costs 207 / 10.5 ≈ <strong>20 cycles</strong>.</li>
<li><strong>Where do the 20 cycles go?</strong> The fetch-to-resolve histogram has a median of 14 cycles and almost no tail, plus about 6 cycles of refill. leela's working set fits in the caches, so its branches don't wait on misses. Compare the mcf example above, where branches that waited on DRAM loads made each mispredict cost hundreds of cycles.</li>
<li><strong>Per-PC attribution.</strong> 30 branch PCs cause 70% of the mispredicts, in the playout and pattern-matching code. Their outcomes come from board positions generated at random, so history doesn't predict them well.</li>
<li><strong>Idealization experiments.</strong> 2× predictor storage: +2.5%. Perfect prediction for the top 30 PCs only: +24%. Resolving branches 3 cycles earlier (oldest-first priority for branches in the scheduler, a shorter redirect path): +5%, which matches the estimate 10.5 × 3 / 1000 = 0.03 cycles per instruction off 0.69.</li>
<li><strong>Read it.</strong> The mispredicts aren't caused by capacity or aliasing, since doubling storage barely helps. They're data-dependent branches. The hardware levers are a shorter penalty and less wasted work. The larger lever is software: converting the hot branches to conditional moves or other branchless code.</li>
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
<p><strong>Question.</strong> A key-value store runs on AWS Graviton3 (Arm Neoverse V1, 2.6 GHz). <code>perf stat -e cycles,instructions,stall_frontend,stall_backend</code> over 10 seconds of one core reports:</p>
<ul>
<li>26.0 × 10<sup>9</sup> cycles</li>
<li>23.4 × 10<sup>9</sup> instructions</li>
<li>2.9 × 10<sup>9</sup> <code>STALL_FRONTEND</code> cycles</li>
<li>13.5 × 10<sup>9</sup> <code>STALL_BACKEND</code> cycles</li>
</ul>
<p>Later rounds of counters, over the same 10 seconds, report:</p>
<ul>
<li>10.4 × 10<sup>9</sup> <code>STALL_BACKEND_MEM</code> cycles</li>
<li><code>L2D_CACHE_REFILL</code>: 21 per kilo-instruction</li>
<li><code>DTLB_WALK</code>: 9 per kilo-instruction</li>
<li>Arm SPE samples (<code>perf record -e arm_spe_0//</code>): most of the loads that walked the page table are the bucket load in the probe function</li>
</ul>
<p>The hash table spans tens of GB in 4 KB pages. Walk the procedure and say what you'd change.</p>
<ol start="0">
<li><strong>Level 1.</strong> IPC = 23.4 / 26.0 = 0.90, far below what this wide core can sustain. Arm's <code>STALL_*</code> events count <em>cycles</em> in which nothing was dispatched, not slots: front end 2.9 / 26.0 = 11%, back end 13.5 / 26.0 = 52%. Back end dominates.</li>
<li><strong>Drill into the back end.</strong> <code>STALL_BACKEND_MEM</code> / <code>STALL_BACKEND</code> = 10.4 / 13.5 = 77%, so memory, not core resources. Nine page walks per thousand instructions is very high: tens of GB in 4 KB pages is millions of pages, far beyond what the TLBs cover. The 21 L2 refills per kilo-instruction are the other half of the memory cost.</li>
<li><strong>Find the code.</strong> SPE tags each sampled load with its PC, latency, and whether it walked the page table, so the walks land on one instruction: the bucket load in the probe function.</li>
<li><strong>Confirm.</strong> A microbenchmark that probes a table of the same size at random should reproduce the walk rate with 4 KB pages and drop it to near zero with transparent huge pages. Then rerun the service with huge pages and check that <code>DTLB_WALK</code> and <code>STALL_BACKEND_MEM</code> both fall; if only the first falls, the cache misses were the bigger cost all along.</li>
</ol>
</details>

<h3 id="sec-by-type">Diagnosing Each Stall Type</h3>
<p><a href="#/perf-bottlenecks/diagnose">Telling them apart</a> gives each bottleneck type's signature. A signature is a hypothesis: several types can produce the same symptom (a full ROB, full MSHRs, an empty fetch queue). This part gives, for each type, the measurements that confirm it in order and the experiment that proves it. All of them follow the same shape:</p>
<ol start="0">
<li><strong>Size it.</strong> Charge every slot once at rename (top-down level 1) so you know how much the type is worth before digging.</li>
<li><strong>Name the cause.</strong> Use blame propagation: what is at the ROB head, or what the oldest waiting instruction waits on.</li>
<li><strong>Find the limit.</strong> Find the structure or event that sets the rate, and compare its measured value with its bound (on <a href="#/perf-bounds">Bounding each stage</a>).</li>
<li><strong>Find the code.</strong> Per-PC attribution. A few PCs usually carry most of the loss.</li>
<li><strong>Prove it.</strong> Remove the cause (an idealization) or relieve the limit (a sweep). The gain is an upper bound on what a real fix can deliver. A small gain means you were looking at a symptom.</li>
</ol>
<div class="tbl"><table>
<tr><th>Type</th><th>The measurement that decides it</th><th>The experiment that proves it</th></tr>
<tr><td>Memory latency-bound</td><td>MLP near 1, or near the window bound, with high MPKI</td><td>Make the missing level always hit, then sweep the window</td></tr>
<tr><td>Memory concurrency-bound</td><td>MSHR occupancy pinned at its maximum, bandwidth far below peak</td><td>Double the MSHRs at that level</td></tr>
<tr><td>Memory bandwidth-bound</td><td>Bandwidth near achievable peak, loaded latency far above idle</td><td>Double bandwidth at fixed latency, and halve latency at fixed bandwidth</td></tr>
<tr><td>Core latency-bound</td><td>Cycles per iteration equal to the latency of a loop-carried chain</td><td>Cut that operation's latency to 1 cycle</td></tr>
<tr><td>Core throughput-bound</td><td>One port or unit busy nearly every cycle, with ready instructions waiting for it</td><td>Add a unit, or make it pipelined</td></tr>
<tr><td>Front-end bound</td><td>Queue in front of rename empty while the back end has room</td><td>Perfect instruction cache, BTB, and op cache, separately and together</td></tr>
<tr><td>Bad speculation</td><td>Wasted slots and cycles per mispredict, by PC</td><td>Perfect prediction for the top PCs, and a shorter penalty</td></tr>
</table></div>

<h4 id="sec-mem-latency">Memory Latency-Bound</h4>
<p><strong>Signature:</strong> high MPKI, few misses outstanding at once, and the ROB often full with a missing load at its head. The program pays nearly the full latency for each miss because the misses don't overlap.</p>
<ol start="0">
<li><strong>Confirm the stall is memory.</strong> In the ROB-full cycles, check that the head is a load that missed. On silicon, use "cycles stalled with a miss outstanding" counters (Intel <code>CYCLE_ACTIVITY.STALLS_L3_MISS</code>, Arm <code>STALL_BACKEND_MEM</code>).</li>
<li><strong>Split the misses by level, with the latency of each.</strong> Count L2, last-level, and DRAM misses separately. Use MPKI, not miss rate: a 40% miss rate on a structure touched once per thousand instructions is 0.4 MPKI and costs little, while a 3% miss rate on an L1 data cache seeing 400 loads per thousand instructions is 12 MPKI. An upper bound on what each level costs is <code>MPKI × latency / (1000 × MLP)</code> cycles per instruction. For example, 4 DRAM MPKI at 350 cycles with an MLP of 1.4 costs up to 1.0 cycle per instruction.</li>
<li><strong>Measure misses in flight per cycle, not total misses.</strong> A total miss count says how many misses happened, not how many overlapped, so comparing it to the ROB or load-queue size answers nothing. Count N(t), the number of misses outstanding in cycle t:
<pre><code>/* Count primary demand misses at the level where the loads miss (here, L2). */
uint64_t outstanding = 0, sum_outstanding = 0, busy_cycles = 0, total_cycles = 0;
uint64_t hist[NUM_MSHRS + 1] = {0};      /* hist[0] = cycles with no miss in flight */

/* on primary demand miss allocate:  outstanding++  */
/* on fill:                          outstanding--  */

/* every cycle: */
sum_outstanding += outstanding;
if (outstanding &gt; 0) busy_cycles++;
hist[outstanding]++;                     /* outstanding &lt;= NUM_MSHRS, so this stays in bounds */
total_cycles++;

/* at the end: */
double avg = (double)sum_outstanding / total_cycles;   /* Little's law L */
double mlp = busy_cycles ? (double)sum_outstanding / busy_cycles : 0.0;</code></pre>
MLP divides by <em>busy</em> cycles (cycles with at least one miss in flight), following Chou, Fahs, and Abraham (ISCA 2004). Dividing by all cycles lets the miss-free cycles drag the number down and hide real overlap. Three details change the number:
<ul>
<li>Count primary misses only. A secondary miss to a line already in flight merges into the existing MSHR and adds no parallelism.</li>
<li>Count demand misses separately from prefetches. Prefetches raise N(t) but say nothing about the program's own MLP.</li>
<li>Pick the level where the stalling loads miss. MLP at the L1 fill buffers, L2, and DRAM can all differ.</li>
</ul>
If the model can't afford per-cycle work, Little's law gives the same sum: Σ N(t) equals the sum of every miss's fill cycle minus its issue cycle. Only the busy-cycle counter still has to run every cycle.</li>
<li><strong>Compare measured MLP with the structural bounds.</strong>
<div class="tbl"><table>
<tr><th>Limit</th><th>Most misses it allows in flight</th></tr>
<tr><td>MSHRs at that level</td><td>The number of entries (a hard cap)</td></tr>
<tr><td>Load queue</td><td>The number of entries, and in practice far fewer, since most loads hit</td></tr>
<tr><td>ROB window</td><td>About ROB size × MPKI / 1000</td></tr>
</table></div>
On a Zen 4 core (320-entry ROB) at 10 MPKI, the window holds about 3.2 misses. Measured MLP near 3.2 means the window is the limit. MLP near 1 means the misses are probably dependent. MLP near the MSHR count means the MSHRs are the limit (next section). Reading the histogram: busy cycles piled at N = 1 is latency-bound, piled at N = number of MSHRs is MSHR-limited, and spread in between is partial overlap.</li>
<li><strong>Check whether the misses depend on each other.</strong> In a model, tag each miss with whether its address was computed (directly, or through ALU operations) from an earlier load that missed. A high fraction of dependent misses is pointer chasing, and no window can overlap them. Per-PC attribution usually confirms it: the stalling loads read the next pointer.</li>
<li><strong>Sweep the window.</strong> Scale the ROB together with the load queue, physical registers, issue queue, and branch checkpoints, so you're testing the window and not one structure. Track MLP, average miss latency, IPC, and the dominant stall reason at each point:
<ul>
<li>MLP stays near 1: latency-bound by dependences. First check that rename still stalls on "ROB full" at the larger size. If the stall moved to another structure, you haven't tested a bigger window yet.</li>
<li>MLP rises and IPC rises: the window was the limit. Check that average miss latency didn't rise by the same factor. If MLP doubles and latency doubles, throughput (MLP / latency) is unchanged, and the limit is queueing or bandwidth.</li>
<li>MLP already above 1 and flat: MSHRs, bandwidth, dependences that allow only a few parallel misses, or a window cut short by mispredicted branches that depend on missing loads.</li>
</ul></li>
<li><strong>Prove it.</strong> Make the level always hit for the top PCs (or give them a perfect prefetcher). The IPC gained is the most any latency fix can deliver.</li>
</ol>
<p><strong>Traps.</strong></p>
<ul>
<li>The ROB isn't always the window. Zen 4 has 88 load-queue entries against a 320-entry ROB, so once loads are more than about 27% of instructions, the load queue fills first.</li>
<li>A mispredicted branch that waits on a missing load flushes the misses queued behind it. The useful window is the correct-path part of the ROB, which can be far smaller than its size.</li>
<li>Latency and penalty differ. The penalty per miss is about latency / MLP. A bigger window doesn't make a miss faster, it overlaps more of them.</li>
</ul>
<p><strong>Fixes:</strong> lower latency (a larger or closer cache, a faster path to memory), prefetchers that understand the pattern (including pointer-following ones for linked structures), a bigger window when the misses are independent, and data-layout changes in software.</p>

<h4 id="sec-mem-concurrency">Memory Concurrency-Bound</h4>
<p><strong>Signature:</strong> MLP high but flat as the window grows, MSHRs full most of the time, bandwidth well below the platform's peak, and latency near idle. The core can't keep any more misses in flight. By Little's law, a core's demand bandwidth is at most <code>MSHRs × line size / latency</code>. On Golden Cove, 16 L1 fill buffers × 64 B / 100 ns ≈ 10 GB/s from L1 misses alone, and 48 L2 misses × 64 B / 100 ns ≈ 31 GB/s. That gap is why L2 prefetchers matter so much for one core's bandwidth: they're tracked in the L2's larger queue, not in the L1's.</p>
<ol start="0">
<li><strong>Histogram MSHR occupancy at each level</strong> (L1, L2, last level). The fraction of busy cycles at the maximum is the key number.</li>
<li><strong>Count MSHR-full events:</strong> cycles in which a load couldn't allocate an MSHR, and the replays or retries that follow.</li>
<li><strong>Measure bandwidth and loaded latency.</strong> MSHRs full with latency near idle and bandwidth far below peak means concurrency. MSHRs full with latency rising and bandwidth near peak means bandwidth, and the MSHRs only look full because each miss is held longer (next section).</li>
<li><strong>Find which level runs out.</strong> If the L1 fill buffers are full and the L2 queue isn't, a shorter L1-miss latency also helps: by Little's law, the same buffers turn over faster when the data comes from L2 instead of DRAM. That's what an L2 prefetcher does.</li>
<li><strong>Check what holds the entries.</strong> Prefetches, secondary misses that should have merged, and stores waiting for ownership all occupy MSHRs. Split occupancy by request type.</li>
<li><strong>Prove it.</strong> Double the MSHRs at the limiting level. IPC should rise until the next limit (the window or bandwidth) takes over.</li>
</ol>
<p><strong>Fixes:</strong> more MSHRs at the level that runs out, prefetching into a level with a larger queue, and a lower-latency path so each entry is freed sooner.</p>

<h4 id="sec-mem-bandwidth">Memory Bandwidth-Bound</h4>
<p><strong>Signature:</strong> many misses overlap, bandwidth is near what the platform can actually deliver, and loaded latency is far above idle because requests queue.</p>
<ol start="0">
<li><strong>Measure all the traffic, not just demand reads.</strong> Count demand reads, prefetch reads, reads for ownership, and writebacks. A loop like <code>a[i] = b[i] + c[i]</code> moves four lines per output line with ordinary stores (two reads, a read for ownership of <code>a</code>, a writeback) and three with non-temporal stores.</li>
<li><strong>Compare with the achievable peak, not the theoretical one.</strong> Refresh, bus turnarounds between reads and writes, and row misses mean STREAM typically reaches 70% to 85% of theoretical. Measure the achievable number on the same model or platform.</li>
<li><strong>Check loaded latency against bandwidth.</strong> Plot it as Intel's Memory Latency Checker does: latency stays flat at low bandwidth and climbs steeply near the peak. A workload on the steep part is bandwidth-bound.</li>
<li><strong>Cross-check with Little's law.</strong> Outstanding misses = throughput × latency. When bandwidth is saturated, more misses in flight only raise latency, and throughput stays put.</li>
<li><strong>Find where the queue is.</strong> It's not always DRAM. Check memory-controller read and write queue occupancy, row-buffer hit rate, cycles spent draining writes, and interconnect (mesh or ring) and last-level cache bandwidth.</li>
<li><strong>Check prefetch accuracy</strong> (useful prefetches / prefetches issued). Useless prefetches spend bandwidth. Turning the prefetcher off and seeing IPC rise means it was hurting.</li>
<li><strong>Prove it.</strong> Double the channels or the data rate at fixed latency: IPC should scale. Halve idle latency at fixed bandwidth: IPC should barely move.</li>
</ol>
<p><strong>Traps.</strong></p>
<ul>
<li>One core rarely saturates a server's memory. If a 1-core run looks bandwidth-bound, check concurrency first.</li>
<li>The same workload can be concurrency-bound on 1 core and bandwidth-bound on all of them (see the lbm example above).</li>
</ul>
<p><strong>Fixes:</strong> fewer bytes per result (blocking for reuse, compression, non-temporal stores, smaller data types), more bandwidth (more channels, HBM), and throttling inaccurate prefetchers.</p>

<h4 id="sec-core-latency">Core Latency-Bound</h4>
<p><strong>Signature:</strong> low MPKI, execution ports mostly idle, and the issue queue not empty but with nothing ready. The oldest waiting instruction waits on a long-latency operation that isn't a load.</p>
<ol start="0">
<li><strong>Split zero-issue cycles by producer.</strong> Count cycles with nothing issued while the issue queue is not empty, split by what produces the operand the oldest waiting instruction needs: an FP add, a multiply-add, a divide, a load. Load-to-use waits count as memory even when the load hits L1 (top-down calls it "L1 bound").</li>
<li><strong>Find the chain.</strong> Per-PC attribution on the waiting instruction and its producer. Look for a loop-carried dependence: an accumulator, a running hash, a recurrence.</li>
<li><strong>Compute the chain bound.</strong> Add the latencies around the loop-carried recurrence for one iteration, including any bypass delay between domains. A sum into one FP accumulator on Zen 4 (3-cycle FP add) is bounded at 3 cycles per iteration. If the measured cycles per iteration equal the chain bound, the chain sets the rate.</li>
<li><strong>If there's no loop-carried chain, the window should overlap iterations.</strong> If it doesn't, check issue-queue occupancy: a scheduler full of waiting operations stops dispatch long before the ROB fills, and that is a window limit, not a latency limit.</li>
<li><strong>Prove it.</strong> In the model, cut the operation's latency to 1 cycle. Cycles per iteration should drop to the next bound. On silicon, unroll with k accumulators: time should drop by about k until a throughput bound takes over.</li>
</ol>
<p><strong>Trap:</strong> a non-pipelined divider looks like latency, but a busy divider is a throughput limit. Check the divider-busy fraction before blaming the chain.</p>
<p><strong>Fixes:</strong> lower-latency units, or code that breaks the chain (several accumulators, tree reductions, a reciprocal multiply instead of a divide).</p>

<h4 id="sec-core-throughput">Core Throughput-Bound</h4>
<p><strong>Signature:</strong> one port or unit busy nearly every cycle, with ready instructions waiting for it, while other ports idle.</p>
<ol start="0">
<li><strong>Measure per-port utilization and ready-but-not-issued counts per port.</strong> A port at 95% with ready instructions queued for it is the candidate.</li>
<li><strong>Compute the class bound:</strong> operations of that class per iteration / units that can run it. Compare it with the measured cycles per iteration.</li>
<li><strong>Check port binding.</strong> If two ports can run the same operation and one is at 95% while the other is at 60%, the problem is how operations are assigned, not how many units there are. Intel assigns ports at allocation, so a poor choice can't be fixed later. In a model, compare per-port use with per-class use.</li>
<li><strong>Count occupancy, not issues, for units that aren't fully pipelined.</strong> A divider issued once every 10 cycles is 100% busy. On Zen 4, a 512-bit vector operation runs as two 256-bit halves, so it occupies its unit for two cycles.</li>
<li><strong>Prove it.</strong> Add a unit (or pipeline it). The gain should match the ratio to the next bound.</li>
</ol>
<p><strong>Fixes:</strong> more or wider units, better port assignment, and code that uses cheaper operations or spreads work across unit types.</p>

<h4 id="sec-front-end">Front-End Bound</h4>
<p><strong>Signature:</strong> the queue in front of rename is often below width while the back end has room.</p>
<ol start="0">
<li><strong>Confirm starvation.</strong> Count cycles in which the queue in front of rename holds fewer micro-ops than the width while no back-end resource is full. Exclude the refill cycles after a mispredict or other flush: those belong to bad speculation.</li>
<li><strong>Split latency from bandwidth.</strong> Cycles with the queue empty are fetch <em>latency</em>: fetch delivered nothing. Cycles with some micro-ops but fewer than the width are fetch <em>bandwidth</em>.</li>
<li><strong>For latency, charge each empty cycle to what fetch was waiting for:</strong> an instruction cache miss (and which level it hit), an instruction TLB miss, a BTB miss that decode had to redirect, or a taken-branch bubble. Compute MPKI for each, and use per-PC or per-function attribution to measure the code footprint.</li>
<li><strong>For bandwidth, check what the decoders deliver:</strong> op cache hit rate, switches between the op cache and the legacy decoders, micro-ops from microcode, and the average number of instructions between taken branches. With one taken branch per cycle, a 4-instruction fetch block limits a 6-wide front end to 4.</li>
<li><strong>Check the instruction prefetcher.</strong> Fetch-directed prefetching runs ahead only as far as the BTB knows the branches, so BTB misses also expose instruction cache misses.</li>
<li><strong>Prove it.</strong> Perfect instruction cache, perfect BTB, and an infinite op cache, each alone and then together. A combined gain larger than the sum means the BTB is limiting the prefetcher (see the server-trace example above).</li>
</ol>
<p><strong>Fixes:</strong> larger or multi-level BTBs, instruction prefetching, larger op caches for bandwidth, and in software, profile-guided code layout and huge pages for code.</p>

<h4 id="sec-bad-spec">Bad Speculation</h4>
<p><strong>Signature:</strong> many mispredicts per kilo-instruction, and many more micro-ops issued than retired.</p>
<ol start="0">
<li><strong>Size the waste and split it by cause.</strong> Wasted slots = issued − retired + width × recovery cycles. Split by flush cause: conditional branches, indirect branches, returns, memory-ordering violations, and other machine clears.</li>
<li><strong>Count mispredicts per kilo-instruction by branch type and by PC.</strong></li>
<li><strong>Measure the cost of each mispredict.</strong> Cost = cycles from fetching the branch to resolving it, plus the refill. Histogram the fetch-to-resolve time. A long tail means branches wait on missing loads, which ties bad speculation to memory: fixing either one alone leaves the other in the way.</li>
<li><strong>Classify the hard branches.</strong> If a larger predictor helps, the problem is capacity or aliasing. If it doesn't, the branches depend on data that history can't predict.</li>
<li><strong>For memory-ordering violations,</strong> count them by load and store PC pair and check how the memory dependence predictor (store sets, for example) is trained.</li>
<li><strong>Prove it.</strong> Perfect prediction for the top PCs, a 2× predictor, and a shorter penalty. Combine with a memory idealization to measure the interaction.</li>
</ol>
<p><strong>Fixes:</strong> larger or better predictors for capacity problems, shorter resolution and refill for data-dependent branches, and branchless code in software.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>In your model, rename is stalled 35% of cycles with "ROB full." In those cycles, the instruction at the ROB head is: a load that missed the last-level cache 60% of the time, a floating-point square root 25%, and an instruction that has already completed (retire is just catching up) 15%. Which stage is the cause, and what do you check next?</p>`,
        a: `<ol start="0"><li>Rename is only the symptom; the ROB is full because retirement is blocked, so look at the ROB head.</li><li>60% of the stall (21% of all cycles) is <strong>memory</strong>: last-level misses. Check memory-level parallelism; if it's near 1, the misses are dependent and need lower latency or a smarter prefetcher, and if it's high, check bandwidth.</li><li>25% (about 9% of cycles) is <strong>core latency</strong>: square root chains. Check whether they're dependent on each other and how long the unit stays busy.</li><li>15% (about 5% of cycles) is <strong>retire width</strong>: after a long stall, the ROB drains at retire width. That's a consequence of the other stalls, not a separate problem, unless retire is narrower than rename.</li></ol>`
      },
      {
        q: `<p>Your model of an Intel Golden Cove core (512-entry ROB, 192-entry load queue, 48 outstanding L2 misses, 3.0 GHz) runs a breadth-first search over a large graph. Over 10<sup>9</sup> cycles, the L2 counters report Σ N(t) = 2.1 × 10<sup>9</sup> for primary demand misses, 0.84 × 10<sup>9</sup> busy cycles, 14 L2 MPKI, and an average DRAM latency of 105 ns. Compute the average outstanding misses, MLP, the effective penalty per miss, and the window bound. What limits MLP, and what do you check next?</p>`,
        a: `<ol start="0"><li>Average outstanding = 2.1 × 10<sup>9</sup> / 10<sup>9</sup> = <strong>2.1</strong>.</li><li>MLP = 2.1 / 0.84 = <strong>2.5</strong> misses in flight per busy cycle.</li><li>Latency = 105 ns × 3.0 GHz = 315 cycles. Effective penalty ≈ 315 / 2.5 = <strong>126 cycles</strong> per miss. Throughput = 2.1 / 315 ≈ 0.0067 misses per cycle.</li><li>Window bound = 512 × 14 / 1000 ≈ <strong>7.2</strong>. The load queue allows up to 192, and the MSHRs 48.</li><li>MLP is well below all three, so no structure is the limit. The program's dependence structure or a window cut short by mispredicts is. BFS has both: neighbor loads depend on the edge-list load, and the "visited?" branch depends on a missing load.</li><li>Next: measure the fraction of misses whose address comes from an earlier missing load, and the mispredicts on branches waiting for missing loads, then try perfect prediction for those branches. A bigger ROB is not the first thing to try.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You sample <code>MEM_LOAD_RETIRED.L3_MISS</code> on an Intel core with ordinary (non-precise) sampling, and the profile blames an <code>add</code> two instructions after a load instead of the load itself. Why, and how do you get the right instruction? Would your performance model have the same problem?</p>`,
        a: `<p>Ordinary sampling raises an interrupt when the counter overflows, and the handler records whatever PC the core reaches by the time the interrupt is taken. On a wide out-of-order core that's a few instructions later, and it tends to land on the instruction after a long stall, because that's where retirement resumes: this is <strong>skid</strong>. Use precise sampling, which records the instruction that caused the event: PEBS on Intel (<code>perf record -e mem_load_retired.l3_miss:pp</code>), IBS on AMD, SPE on Arm. Those also give the load's latency and data source. A model has no skid: it charges each event to the PC of the instruction that caused it at the moment it happens, unless you deliberately model sampling to compare with hardware.</p>`
      },
      {
        q: `<p>A colleague doubles the ROB (with matching queues) in a model running a memory-bound workload. Measured DRAM MLP goes from 1.8 to 3.4, but IPC rises only 4%. Average DRAM miss latency went from 280 to 510 cycles. Explain the result, and say how you'd find the real limit.</p>`,
        a: `<ol start="0"><li>Throughput is what matters, and by Little's law it's MLP / latency: before, 1.8 / 280 ≈ 0.0064 misses per cycle. After, 3.4 / 510 ≈ 0.0067. That's about 4% more, matching the IPC gain.</li><li>The bigger window did expose more parallelism, but each miss now waits longer, so the misses queue somewhere. The penalty per miss (latency / MLP) only went from 156 to 150 cycles.</li><li>Find the queue: check DRAM bandwidth against the achievable peak (a STREAM-like run on the same model), memory-controller queue occupancy, and last-level cache and interconnect bandwidth. If bandwidth is far below peak, look for a shared queue in front of DRAM instead, such as the last-level cache's miss tracking or interconnect credits.</li><li>Prove it: double bandwidth at fixed latency. If IPC follows, the workload is bandwidth-bound and the ROB was never the main limit.</li></ol>`
      }
    ]
  }
},

{
  id: "perf-bounds",
  region: "stall",
  title: "Bounding Each Stage",
  sections: [
    { id: "bounds", label: "The Bound Equation" },
    { id: "fe-bounds", label: "Front-End Bounds" },
    { id: "be-bounds", label: "Back-End Bounds" },
    { id: "window-bounds", label: "Window Bounds" },
    { id: "mem-bounds", label: "Memory Bounds" },
    { id: "chip-bounds", label: "Chip-Level Bounds" },
    { id: "procedure", label: "Procedure and Traps" }
  ],
  body: `
<p><a href="#/perf-find-cause">Finding a stall's cause</a> works from measurements. This page works before any run: from a loop's instruction counts and the machine's widths, sizes, and latencies, it bounds how many cycles per iteration each stage and structure can cost, and which one binds.</p>

<h3 id="sec-bounds">The Bound Equation</h3>
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
<p>Notation, all per iteration:</p><ul><li>\\(N_i\\) and \\(N_u\\) instructions and micro-ops</li><li>\\(N_{ld}\\), \\(N_{st}\\), \\(N_{br}\\), \\(N_{tk}\\) loads, stores, branches, and taken branches</li><li>\\(N_k\\) micro-ops that can only run on port class k</li><li>\\(W_x\\) the width of stage x</li><li>\\(P_k\\) the number of ports or units of class k</li><li>\\(C_s\\) the entries in structure s, \\(E_s\\) the entries one iteration uses, and \\(R_s\\) the cycles each entry stays</li><li>\\(L_x\\) a latency and \\(m_x\\) a miss rate per access</li></ul>
<p><strong>Latency vs. throughput.</strong> Latency is how long one iteration takes from start to finish; throughput is how often iterations finish. Out-of-order execution hides latency by overlapping iterations, until a capacity bound (kind 1) or a dependency (kind 2) stops the overlap. The tables below give the bounds for each part of the pipeline, matching the stages on <a href="#/perf-stage-stalls/stages">Stalls by pipeline stage</a>.</p>
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
<p><strong>The machine</strong> (from AMD's optimization guide and Agner Fog's tables):</p><ul><li>Micro-op cache delivers 8 macro-ops per cycle</li><li>Dispatch 6 macro-ops per cycle</li><li>1 taken branch per cycle</li><li>2 FMA pipes, FMA latency 4 cycles</li><li>3 load pipes, but the L1 data cache delivers 2 × 32 B = 64 B per cycle, so at most 2 ymm loads per cycle</li><li>L2 to L1 bandwidth 32 B per cycle</li><li>L2 latency about 12 cycles</li><li>24 L1 miss buffers</li></ul><p>Peak = 2 FMA × 4 doubles × 2 FLOPs = 16 FLOPs per cycle.</p>
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
<p><strong>How to wrap up the answer:</strong></p><ul><li>4 cycles per iteration as written, bound by the FMA latency chain</li><li>4 accumulators make it 4× faster and move the bound to L1 bandwidth at 50% of peak</li><li>Out of L1, L2 bandwidth halves it again</li></ul><p>Nothing in the core's width matters at any point, which is the main lesson of max-of-bounds.</p>
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
<p><strong>Question.</strong> An Intel Skylake core with these resources runs the loop below. Bound it, find the bottleneck, and restructure it.</p><ul><li>4-wide rename</li><li>ALU ports p0, p1, p5, p6</li><li>FMA on p0 and p1 with 4-cycle latency</li><li>Loads on p2 and p3</li><li>Predicted-taken branches only on p6</li></ul>
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
<li><strong>Single-class bounds.</strong><ul><li>Rename 7 / 4 = 1.75</li><li>FMA 3 / 2 = 1.5</li><li>Shifts and branch 3 / 2 = 1.5</li><li>Branch alone 1 / 1 = 1</li><li>Loads 3 / 2 = 1.5</li></ul></li>
<li><strong>Port subsets.</strong> Micro-ops that can run only on {p0, p1, p6}: 3 FMAs + 2 shifts + 1 branch = 6, on 3 ports: <strong>2.0</strong>. All four ALU ports: 7 / 4 = 1.75. The union of two classes binds even though each class alone looks fine, and p5 is idle most of the time.</li>
<li><strong>Dependency.</strong> Each of <code>ymm0</code> to <code>ymm2</code> is updated once per iteration, so B<sub>dep</sub> = 4. T = max(4, 2.0, …) = <strong>4 cycles</strong>: latency-bound, with half the port capacity unused.</li>
<li><strong>Unroll by 3 with 9 accumulators.</strong> Per unrolled iteration: 9 FMAs, 6 shifts, 1 add, 1 branch (17 fused). Bounds:<ul><li>Dependency 4</li><li>{p0, p1, p6} = (9 + 6 + 1) / 3 = 5.33</li><li>Rename 17 / 4 = 4.25</li><li>Loads 9 / 2 = 4.5</li><li>All ALU ports 17 / 4 = 4.25</li></ul> T = 5.33 per 3 iterations = <strong>1.78 cycles per original iteration</strong>, 2.25× faster, now bound by the {p0, p1, p6} subset.</li>
<li><strong>Why not 6 accumulators?</strong> Unroll by 2: dependency 4 per 2 iterations = 2.0 each, while the port subset allows (6 + 4 + 1) / 3 / 2 = 1.83. The accumulator count needed is L<sub>FMA</sub> × (FMAs per cycle at the port bound) = 4 × 3 / 1.78 ≈ 6.7, so 6 is just short.</li>
<li><strong>What binds next:</strong> the p0/p1/p6 subset. Moving shift work onto an instruction that can also use p5 (or onto the vector side) loosens it; past that, loads and rename bind at about 1.5 and 1.42 cycles per original iteration.</li>
</ol>
</details>

<h3 id="sec-window-bounds">Window Bounds</h3>
<p>Every out-of-order structure obeys the same Little's-law bound, \\(E \\cdot R / C\\); what changes is which micro-ops occupy it and for how long. These are the structures that show up at rename as "full" in the <a href="#/perf-stage-stalls/stages">stage table</a>.</p>
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
<li><strong>Bandwidth bounds.</strong><ul><li>Dispatch 5 / 6 = 0.83</li><li>Loads 3 / 3 = 1.0</li><li>FMA 1 / 2 = 0.5</li><li>Taken branches 1</li></ul></li>
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
<li><strong>Consistency.</strong> At T = 14.4:<ul><li>Misses in flight 0.5 × 385 / 14.4 ≈ 13 ≤ 24</li><li>ROB 5 × 385 / 14.4 ≈ 134 ≤ 320</li><li>Load queue ≈ 80 ≤ 88</li></ul> One core is consistent.</li>
<li><strong>Scale to the chip.</strong> DRAM bytes per iteration: 0.5 × 64 B for <code>x</code> + 8 B <code>val</code> + 4 B <code>col</code> = 44 B. One core moves 3.5 GHz / 14.4 × 44 B ≈ 10.7 GB/s; peak is 12 × 4,800 MT/s × 8 B = 460.8 GB/s, so N<sub>sat</sub> ≈ 43 cores. At 96 cores the chip bound is 96 × 44 B × 3.5 GHz / 460.8 GB/s ≈ <strong>32 cycles per nonzero</strong>, so step 5 fails at chip scale: DRAM bandwidth is the real bottleneck. Redo the latency: for the load-queue bound to match 32 − 1.3 ≈ 31 cycles, loaded latency must be about 385 × 31 / 13.1 ≈ 900 cycles (≈ 260 ns). Using idle latency would have overestimated chip throughput by 2.2×.</li>
<li><strong>What binds next.</strong> Reordering the matrix (reverse Cuthill-McKee) so that only 10% of <code>x</code> loads miss cuts traffic to 6.4 + 12 = 18.4 B, and the chip bound to about 13.4 cycles. The per-core load-queue bound doesn't move: a window of 88 / 3 ≈ 29 iterations still holds about 3 misses, and retirement still waits on the oldest, so it stays near 13. Core and chip are then balanced at about 14.7 cycles, 2.2× faster than before at full chip. Further gains need fewer loads per nonzero (narrower column indices, blocked formats) or a core with a larger load queue.</li>
</ol>
</details>
<p class="refs">Further reading:</p><ul class="refs"><li>Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed. (Appendix C for pipelining, Chapter 3 for out-of-order execution and branch prediction, Chapter 2 and Appendix B for caches, MSHRs, prefetching, and DRAM)</li><li>Yasin, "A Top-Down Method for Performance Analysis and Counters Architecture," ISPASS 2014</li><li>Williams, Waterman &amp; Patterson, "Roofline," CACM 2009</li><li>Little, "A Proof for the Queuing Formula: L = λW," Operations Research 1961</li><li>Agner Fog's microarchitecture guide and instruction tables for per-core port, latency, and buffer sizes</li></ul>
`,
  practice: {
    guided: [
      {
        q: `<p>An Intel Skylake core (4-wide rename, 224-entry ROB, 97-entry scheduler, 72-entry load queue, 2 load ports, 10 L1 fill buffers) runs at 4.0 GHz with about 80 ns DRAM latency. A loop does <code>sum += a[idx[i]]</code> over a huge, randomly indexed array: per iteration 6 fused micro-ops, 2 loads (<code>idx[i]</code> hits L1; <code>a[...]</code> misses to DRAM, independent across iterations), and 1 add that depends on the miss. Bound the loop, and say what the stage counters would show.</p>`,
        a: `<ol start="0"><li>L<sub>DRAM</sub> = 80 ns × 4.0 GHz = 320 cycles.</li><li>Bandwidth bounds:<ul><li>Rename 6 / 4 = 1.5</li><li>Load ports 2 / 2 = 1</li><li>The loop-carried chain is the 1-cycle add on <code>sum</code>, so B<sub>dep</sub> = 1</li></ul></li><li>Capacity bounds:<ul><li>Fill buffers 1 × 320 / 10 = <strong>32</strong></li><li>ROB 6 × 320 / 224 ≈ 8.6</li><li>Load queue 2 × 320 / 72 ≈ 8.9</li><li>Scheduler (only the dependent add waits) 1 × 320 / 97 ≈ 3.3</li></ul></li><li>Max = <strong>32 cycles per iteration</strong>, bound by the fill buffers: only 10 misses are ever in flight. The next bound is the load queue at about 8.9, so more fill buffers could help up to about 3.6×.</li><li>Counters: rename still reports "ROB full," because loads waiting for a fill buffer stay in the ROB longer than L<sub>miss</sub> (the window holds about 224 / 6 ≈ 37 iterations, but only 10 of their misses are outstanding). The cause shows at the ROB head (a DRAM-missing load) and in the fill-buffer-full counter (<code>L1D_PEND_MISS.FB_FULL</code>). A hardware stride prefetcher won't help with random indices.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A Xeon Platinum 8480+ (Sapphire Rapids) has 56 cores, each with 16 L1 fill buffers, and 8 channels of DDR5-4800. Idle DRAM latency is about 110 ns (approximate). A random-access, miss-bound loop like a hash probe keeps every fill buffer busy. At how many active cores does DRAM bandwidth saturate? With all 56 cores running at 2.0 GHz, what is the loaded latency and the per-core cycles per miss, and does the MSHR bound agree with the bandwidth bound?</p>`,
        a: `<ol start="0"><li>Peak bandwidth = 8 × 4,800 MT/s × 8 B = <strong>307.2 GB/s</strong>.</li><li>One core sustains 16 × 64 B / 110 ns ≈ 9.3 GB/s, so N<sub>sat</sub> ≈ 307.2 / 9.3 ≈ <strong>33 cores</strong> (fewer in practice, since sustained bandwidth is closer to 70–80% of peak).</li><li>At 56 cores: M = 56 × 16 = 896 lines in flight, so L<sub>loaded</sub> = max(110 ns, 896 × 64 B / 307.2 GB/s) ≈ max(110, 187) = <strong>≈ 187 ns</strong>.</li><li>MSHR bound per core = L<sub>loaded</sub> / 16 ≈ 11.7 ns ≈ <strong>23.3 cycles per miss</strong> at 2.0 GHz, compared with 110 / 16 × 2 ≈ 13.8 cycles at idle latency.</li><li>Bandwidth bound per core = 56 × 64 B × 2.0 GHz / 307.2 GB/s ≈ <strong>23.3 cycles</strong>, the same answer, as Little's law requires. Going from about 33 to 56 cores adds almost no throughput; each core just waits longer. Using idle latency here would overestimate throughput by about 1.7×.</li></ol>`
      }
    ]
  }
}
]);
