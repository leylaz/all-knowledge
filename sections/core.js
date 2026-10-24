/* Section: Out-of-order core
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "core"). */

/* Bit-field bars for the Floating-Point Units page, drawn to scale. */
function fpBar(name, segs, of) {
  const w = segs.reduce((a, s) => a + s[1], 0) / of * 100;
  return '<div class="bfrow"><b>' + name + '</b><div class="bf" style="width:' + w + '%">' +
    segs.map(s => '<span class="' + s[0] + '" style="flex-grow:' + s[1] + '">' + (s[2] || s[1]) + '</span>').join("") +
    '</div></div>';
}
const FP_BARS = '<div class="bfs">' +
  fpBar("FP32", [["s", 1], ["e", 8], ["f", 23]], 32) +
  fpBar("TF32", [["s", 1], ["e", 8], ["f", 10], ["x", 13, "unused 13"]], 32) +
  fpBar("BF16", [["s", 1], ["e", 8], ["f", 7]], 32) +
  fpBar("FP16", [["s", 1], ["e", 5], ["f", 10]], 32) +
  fpBar("FP8 E5M2", [["s", 1], ["e", 5], ["f", 2]], 32) +
  fpBar("FP8 E4M3", [["s", 1], ["e", 4], ["f", 3]], 32) +
  fpBar("FP4 E2M1", [["s", 1], ["e", 2], ["f", 1]], 32) +
  '</div><p class="bfkey">Widths to scale (32 bits = full width).<i style="background:var(--pad-soft);border:1px solid var(--pad)"></i>sign<i style="background:var(--trace-soft);border:1px solid var(--trace)"></i>exponent<i style="background:var(--code-bg);border:1px solid var(--rule)"></i>fraction (stored mantissa bits)</p>';

section({
  id: "core",
  name: "Out-of-Order Core",
  cap: "Renaming, the window, scheduling, memory ordering",
  body: `
<p>An out-of-order core fetches and decodes in order, executes in dataflow order, and commits in order. The middle of the pipeline is where the performance lives.</p>
<h3>The Pipeline in One Pass</h3>
<ol>
<li><strong>Fetch and decode:</strong> branch prediction steers fetch; instructions are decoded (and on some ISAs cracked into micro-ops).</li>
<li><strong>Rename:</strong> architectural registers map to physical registers, removing false dependences.</li>
<li><strong>Dispatch:</strong> each instruction gets a ROB entry, an issue queue entry, and an LQ or SQ entry if it touches memory. Running out of any of these stalls dispatch.</li>
<li><strong>Issue and execute:</strong> ready instructions are picked and sent to functional units.</li>
<li><strong>Writeback:</strong> results are written and dependents woken.</li>
<li><strong>Commit:</strong> instructions retire in order from the ROB head; stores drain to the cache after this.</li>
</ol>
<h3>The Questions That Matter</h3>
<p>How big is the window, which resource fills first, and how much memory-level parallelism can the window expose? Most core studies reduce to a stall breakdown by resource.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 4-wide core has a 128-entry ROB. A load at the ROB head misses to DRAM with 200 cycles of latency. Everything behind it would otherwise run at IPC 4. Roughly how many cycles does the core stall?</p>`,
        a: `<ol><li>While the load waits, younger instructions keep dispatching at 4 per cycle.</li><li>The ROB fills after about 128 / 4 = 32 cycles.</li><li>Dispatch then stalls until the load completes and retires: about 200 − 32 = <strong>168 stall cycles</strong>.</li><li>Takeaway: a bigger ROB hides more of the miss, but only if the work behind the load is independent of it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Doubling the ROB from 128 to 256 entries gains 3% IPC on 505.mcf but 15% on another benchmark. Explain the difference and say what you would measure.</p>`,
        a: `<p>mcf chases pointers: the next miss address depends on the previous load, so a bigger window finds no extra independent misses and memory-level parallelism stays near 1. The other benchmark has independent misses that a larger window can overlap.</p><p>Also check that the ROB was actually the limiter. Measure dispatch stall cycles by resource (ROB full, IQ full, LQ/SQ full, out of physical registers), the average number of outstanding L1/L2 misses, and MSHR occupancy. If the LQ or physical register file fills first, growing only the ROB does nothing.</p>`
      },
      {
        q: `<p>Why is the issue queue usually much smaller than the ROB?</p>`,
        a: `<p>The IQ only holds instructions that haven't issued, and every entry must compare against every broadcast result tag each cycle (a CAM), with wakeup and select on the critical timing path. Cost grows with entries times tags. The ROB is a FIFO accessed by index (RAM-like), so it scales far more cheaply.</p>`
      }
    ]
  }
}, [
{
  id: "ooo-tradeoffs",
  region: "core",
  title: "When Out-of-Order Execution Pays Off",
  sections: [
    { id: "what", label: "What Dynamic Scheduling Buys" },
    { id: "pays", label: "Where It Pays Off" },
    { id: "little", label: "Where It Buys Little" },
    { id: "cost", label: "What It Costs" },
    { id: "static", label: "The Static Alternative" },
    { id: "measure", label: "Telling the Regimes Apart" }
  ],
  body: `
<p>An out-of-order core spends a large share of its area and power on rename, the issue queue, the ROB, and the LSQ. That spending pays off on some code and buys almost nothing on other code. Knowing which is which is most of what it takes to predict how a core change will move IPC.</p>
<h3 id="sec-what">What Dynamic Scheduling Buys</h3>
<p>The core executes in dataflow order: an instruction issues when its operands are ready, not when its turn comes in program order (Hennessy &amp; Patterson, Ch. 3, Tomasulo's algorithm and hardware speculation). A compiler can reorder instructions too, but only using what it knows at compile time. Dynamic scheduling helps exactly where run-time behavior differs from what the compiler could predict.</p>
<h3 id="sec-pays">Where It Pays Off</h3>
<ul>
<li><strong>Unpredictable latency:</strong> a load can hit L1 in about 5 cycles or go to DRAM in 400+. On an in-order core, the first instruction that uses a missing load stalls everything behind it, so misses are serviced one at a time. An out-of-order core keeps going, reaches later independent loads, and overlaps their misses. This <strong>memory-level parallelism</strong> is the largest single source of out-of-order speedup.</li>
<li><strong>Renaming past the architectural registers:</strong> physical registers remove WAR and WAW hazards, so the hardware effectively unrolls loops further than the compiler can with 16 or 32 architectural registers (see <a href="#/renaming">Register Renaming</a>).</li>
<li><strong>Speculation across branches:</strong> with good prediction, the window spans many basic blocks. Static schedulers can only move work across branches with trace or superblock scheduling plus fix-up code.</li>
<li><strong>Run-time memory disambiguation:</strong> a compiler must assume that a store might alias a later load. The core lets the load go early and checks afterwards (see <a href="#/mdp">Memory Dependence Prediction</a>).</li>
<li><strong>Portability:</strong> one binary runs well across microarchitectures with different latencies and port counts, without being rescheduled for each.</li>
</ul>
<h3 id="sec-little">Where It Buys Little</h3>
<p>A <strong>loop-carried chain</strong> is a dependence that crosses iterations: a value one iteration writes and the next iteration reads, such as the accumulator in <code>s += a[i]</code> or the pointer in <code>p = p-&gt;next</code>. Follow that value through every iteration and you get one chain, and each link can start only after the previous one finishes. Its latency per iteration is the sum of the latencies on that path, and that sum is a floor on time per iteration no matter how wide the core or how large the window. Register renaming doesn't break it, because renaming removes only false (WAR, WAW) dependences, and this one is true (RAW). Values that each iteration recomputes from scratch, such as a freshly loaded <code>a[i]</code>, aren't on the chain; they can run ahead. For example, with a 3-cycle FP add (Zen 3), <code>s += a[i]</code> takes at least 3 cycles per element even though the core has 2 FP add pipes. Keeping both pipes busy needs 3 × 2 = 6 adds in flight, so 6 independent partial sums.</p>
<ul>
<li><strong>A single dependence chain:</strong> pointer chasing, a loop-carried sum into one accumulator, a hash computed byte by byte. The chain's latency is the floor for every core, and there's nothing independent to pull forward.</li>
<li><strong>Compiler-scheduled compute kernels on L1-resident data:</strong> latencies are fixed and known, so the compiler can unroll and interleave independent work in program order. An in-order core then issues without stalls and both cores hit the same port-throughput ceiling (see <a href="#/comp-opt/static-sched">Static Scheduling and Compute Kernels</a>).</li>
<li><strong>Port-saturated code:</strong> if the FMA or load ports are already busy every cycle, a bigger window finds work it has nowhere to send.</li>
<li><strong>Mispredict-bound code:</strong> when branches mispredict often, much of the window is wrong-path work that gets flushed (see <a href="#/rob-sizing">Sizing the Reorder Buffer</a>).</li>
<li><strong>Bandwidth-bound streaming:</strong> once DRAM bandwidth is saturated, exposing more misses only lengthens queues.</li>
</ul>
<h3 id="sec-cost">What It Costs</h3>
<ul>
<li><strong>Area and power:</strong> the issue queue and LSQ are CAMs searched every cycle, and the rename tables and PRF are heavily multi-ported. Energy per instruction is several times that of a simple in-order pipeline, which is why Arm's efficiency cores (Cortex-A510, A520) stay in-order.</li>
<li><strong>Pipeline depth:</strong> rename, dispatch, and the wakeup/select loop add stages between fetch and execute, which raises the branch-mispredict penalty.</li>
<li><strong>Wasted work:</strong> every mispredict throws away the speculative work in the window, and the energy spent on it.</li>
<li><strong>Verification and complexity:</strong> recovery, memory ordering, and speculative wakeup are hard to get right and are a source of side channels such as Spectre.</li>
</ul>
<h3 id="sec-static">The Static Alternative</h3>
<p>VLIW and EPIC designs move scheduling into the compiler. Itanium is the well-known case: it ran dense floating-point kernels well, where schedules are predictable, but fell behind on integer code dominated by cache misses and hard-to-predict branches, which is exactly where static scheduling lacks information. DSPs and GPUs stay in-order because their workloads are mostly kernels. GPUs hide memory latency by switching among many threads instead of reordering one thread's instructions.</p>
<h3 id="sec-measure">Telling the Regimes Apart</h3>
<ul>
<li><strong>Run the same binary on an in-order and an out-of-order model:</strong> a small IPC gap means the code is chain-bound, port-bound, or already statically scheduled.</li>
<li><strong>Measure average outstanding L1D misses (MLP):</strong> MLP well above 1 on the out-of-order model, against near 1 on the in-order one, accounts for most of the gap.</li>
<li><strong>Check port utilization and the critical path:</strong> if the dataflow critical path or a saturated port already sets the cycle count, window and scheduler changes won't move IPC.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A dot product runs on Zen 2 (FMA latency 5 cycles, 2 FMA pipes) with 4 independent accumulators, all data in L1. What FMA throughput does it reach on an in-order and on an out-of-order version of the core? How many accumulators would reach peak?</p>`,
        a: `<ol><li>Each accumulator is a chain with one FMA every 5 cycles, so 4 chains give at most 4 / 5 = <strong>0.8 FMAs per cycle</strong>.</li><li>That's a dependence bound, so it holds for both cores. The out-of-order core finds no extra independent FMAs, since every FMA is on one of the 4 chains.</li><li>Peak is 2 per cycle, so the kernel reaches 40% of it on either core.</li><li>To reach peak: accumulators ≥ pipes × latency = 2 × 5 = <strong>10</strong>. That fits in AVX2's 16 YMM registers with room left for operands.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An integer loop has independent iterations of 8 instructions. At 4-wide, with no stalls, one iteration takes 2 cycles. The compiler software-pipelined it so each load's consumer issues 4 cycles after the load, matching Zen 4's L1 load-to-use latency. 30% of the loads, at unpredictable points, hit in L2 instead (14 cycles). Estimate cycles per iteration on an in-order core and on Zen 4's out-of-order core (320-entry ROB).</p>`,
        a: `<p><strong>In-order:</strong> an L2 hit makes the consumer wait 14 − 4 = 10 extra cycles, and everything behind it waits too. Average: 2 + 0.3 × 10 = <strong>5 cycles per iteration</strong>.</p><p><strong>Out-of-order:</strong> by Little's law, hiding 14 cycles at IPC 4 takes a window of about 4 × 14 = 56 instructions, or 7 iterations, far below 320. About 7 × 0.3 ≈ 2 L2 hits are in flight at a time, well within the miss-handling resources. So the misses overlap with independent work and the loop runs close to <strong>2 cycles per iteration</strong>.</p><p>That's a 2.5× gap from a modest, unpredictable latency. The same loop with all loads hitting L1 would run at 2 cycles per iteration on both cores. The out-of-order core's advantage comes entirely from latency the compiler couldn't plan for.</p>`
      }
    ]
  }
},

{
  id: "renaming",
  region: "core",
  title: "Register Renaming",
  body: `
<p>Programs reuse a small set of architectural registers, which creates false dependences: write-after-read (WAR) and write-after-write (WAW). Renaming gives every destination a fresh physical register, so only true read-after-write (RAW) dependences remain.</p>
<h3>Pieces</h3>
<ul><li><strong>Register alias table (RAT):</strong> maps each architectural register to its current physical register.</li><li><strong>Free list:</strong> physical registers available for new destinations.</li><li><strong>Retirement RAT:</strong> the committed, non-speculative mapping.</li></ul>
<h3>Lifecycle of a Mapping</h3>
<p>At rename, sources read the RAT, the destination takes a register from the free list, and the <em>previous</em> mapping is saved in the ROB entry. At commit, that previous register is freed, because no instruction younger than this one can still name it.</p>
<h3>Recovery</h3>
<p>On a misprediction, restore the RAT from a branch checkpoint, walk the ROB backward undoing mappings, or copy the retirement RAT.</p>
<h3>What Limits It</h3>
<p>Free-list size bounds instructions in flight; rename width bounds throughput; checkpoints bound branch depth.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Initial RAT: r1→p1, r2→p2, r3→p3. Free list: p10, p11, p12. Rename:</p><pre><code>I1: r1 = r2 + r3
I2: r2 = r1 * r3
I3: r1 = r2 - r1</code></pre><p>Give the renamed instructions, the final RAT, and which register each instruction frees at commit.</p>`,
        a: `<ol><li>I1: sources p2, p3. r1 gets p10 (old p1). <code>p10 = p2 + p3</code></li><li>I2: sources r1 = p10, r3 = p3. r2 gets p11 (old p2). <code>p11 = p10 * p3</code></li><li>I3: sources r2 = p11, r1 = p10. r1 gets p12 (old p10). <code>p12 = p11 - p10</code></li><li>Final RAT: r1→p12, r2→p11, r3→p3.</li><li>At commit: I1 frees p1, I2 frees p2, I3 frees p10.</li><li>The WAW on r1 (I1, I3) and the WAR on r1 (I2 reads, I3 writes) are gone. Only RAW edges remain: I1→I2, I1→I3, I2→I3.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>32 architectural integer registers, 180 physical. How many instructions with integer destinations can be in flight at most? And why not free the old mapping when the new producer writes back?</p>`,
        a: `<p>32 physical registers always hold committed state, so at most 180 − 32 = <strong>148</strong> in-flight destinations.</p><p>Freeing at writeback is unsafe for two reasons: older in-flight instructions may still need to read the old register, and if the new producer is squashed, the old mapping must be restored. Once the redefining instruction commits, neither can happen.</p>`
      },
      {
        q: `<p>Compare RAT checkpoints and ROB walk for misprediction recovery.</p>`,
        a: `<p>Checkpoints restore the whole RAT in about a cycle but cost area per checkpoint and cap unresolved branches in flight. A ROB walk costs no extra storage but takes cycles proportional to the number of squashed instructions. Many designs mix them: checkpoint at low-confidence branches, walk otherwise.</p>`
      }
    ]
  }
},

{
  id: "prf-sizing",
  region: "core",
  title: "Sizing the Physical Register File",
  body: `
<p>The physical register file (PRF) holds every renamed value. Its size limits how many instructions with destinations can be in flight.</p>
<h3>The Math</h3>
<p>Registers needed ≈ architectural registers + in-flight destinations. By Little's law, in-flight destinations = rename rate × average lifetime (from rename until the next writer of the same architectural register commits). A practical target: PRF ≥ arch regs + (ROB size × fraction of instructions with a destination of that class).</p>
<h3>Benefit</h3>
<p>More registers let the window grow before rename stalls, exposing more memory-level parallelism. Once the PRF stops being the first resource to fill, extra registers buy nothing. IPC versus PRF size is a saturating curve, and the knee depends on the workload.</p>
<h3>Cost: Power, Performance, Area</h3>
<ul>
<li><strong>Area:</strong> grows with entries × width × (ports)². A wide core needs many ports, so the PRF is one of the densest and largest structures in the core.</li>
<li><strong>Latency:</strong> more entries means longer wordlines and bitlines. Past a point, register read takes an extra pipeline stage, which lengthens the mispredict penalty and needs more bypassing.</li>
<li><strong>Power:</strong> every read and write charges long bitlines; energy per access rises with entries and ports. Leakage rises with area.</li>
</ul>
<h3>Typical Workload Effects</h3>
<ul><li><strong>Pointer chasing:</strong> little gain; dependent misses don't overlap.</li><li><strong>Independent misses (streaming without good prefetch, irregular but independent loads):</strong> large gain until another structure fills.</li><li><strong>Compute-bound:</strong> modest gain; short-lived values recycle registers quickly.</li><li><strong>FP and vector code:</strong> wide vector registers make each entry costly, so the vector PRF is often the tighter limit.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A core has 32 architectural integer registers and a 200-entry ROB. About 60% of instructions write an integer register. How many integer physical registers avoid rename stalls when the ROB is full?</p>`,
        a: `<ol><li>Destinations in flight with a full ROB: 0.6 × 200 = 120.</li><li>Committed state needs 32.</li><li>Total: 32 + 120 = <strong>152</strong>. Fewer than that, and rename stalls before the ROB fills, so the PRF, not the ROB, sets the window.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Going from 6-wide to 8-wide issue raises the integer PRF from 12 read and 6 write ports to 16 read and 8 write ports. Estimate the area change per register and suggest mitigations.</p>`,
        a: `<p>Each port adds a wordline and a bitline per cell, so cell area grows roughly with the square of the port count: (24 / 18)² ≈ <strong>1.78×</strong> per entry, before adding entries. Latency and energy per access grow too.</p><p>Mitigations: split the PRF into clusters or banks (with cross-cluster delay), replicate read ports in copies of the file (writes go to all copies), take operands from the bypass network instead of the file, and add a small register cache in front of a larger, slower PRF.</p>`
      }
    ]
  }
},

{
  id: "rob",
  region: "core",
  title: "Reorder Buffer",
  body: `
<p>The ROB is a circular buffer holding in-flight instructions in program order. Entries are allocated at dispatch, marked done at writeback, and retired from the head in order once complete.</p>
<h3>Why In-Order Retirement</h3>
<p>It makes exceptions precise. A faulting instruction just flags its entry; the fault is taken at the head, and everything younger is flushed.</p>
<h3>Size and the Window</h3>
<p>ROB size sets the instruction window, and so how much memory-level parallelism the core can find. A long-latency load at the head blocks retirement until the ROB fills and dispatch stalls.</p>
<h3>Worth Measuring</h3>
<ul><li>Average occupancy</li><li>Cycles stalled on a full ROB</li><li>What instruction sits at the head during those stalls</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A 64-entry circular ROB has head = 60 (oldest) and tail = 10 (next free slot). How many entries are occupied? A branch in entry 2 mispredicts; what is the new tail and how many entries are flushed?</p>`,
        a: `<ol><li>Occupied: entries 60–63 (4) and 0–9 (10) = <strong>14</strong>.</li><li>Everything younger than entry 2 is flushed: entries 3–9 = <strong>7</strong>.</li><li>New tail = <strong>3</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A load on a mispredicted path page-faults. Why doesn't the OS ever see that fault?</p>`,
        a: `<p>Faults are only recorded in the ROB entry and taken when the instruction reaches the head. The older branch resolves first and squashes the wrong-path load, along with its fault flag, before it can reach the head.</p>`
      },
      {
        q: `<p>Why do many cores recover from a mispredict as soon as the branch executes, instead of waiting for it to reach the ROB head?</p>`,
        a: `<p>Waiting can cost dozens of cycles if older long-latency instructions are ahead of the branch. Early recovery redirects fetch immediately, but requires restoring rename state at the branch (checkpoints or a partial walk) and selectively flushing only younger instructions.</p>`
      }
    ]
  }
},

{
  id: "rob-sizing",
  region: "core",
  title: "Sizing the Reorder Buffer",
  body: `
<p>The ROB size sets the maximum instruction window: how far past a stalled instruction the core can look for independent work.</p>
<h3>The Math</h3>
<ul>
<li><strong>Window to hide latency L at throughput IPC:</strong> W ≈ IPC × L (Little's law).</li>
<li><strong>Mispredict horizon:</strong> average instructions between mispredicts = 1 / (branch fraction × mispredict rate).</li>
<li><strong>Memory-level parallelism:</strong> independent misses that fit in the window can overlap, so effective cost per miss ≈ latency / MLP.</li>
</ul>
<h3>Benefit</h3>
<p>Larger ROBs find more independent misses and more instruction-level parallelism around long-latency operations. The gain is largest for workloads with independent misses and predictable control flow.</p>
<h3>Cost: Power, Performance, Area</h3>
<ul>
<li><strong>The ROB itself is cheap:</strong> it's a RAM-like FIFO indexed by position.</li>
<li><strong>Everything around it must grow:</strong> PRF, LQ and SQ (CAM searches), issue queue, checkpoints, and free lists. If they don't, the ROB never fills and the extra entries are wasted.</li>
<li><strong>Power:</strong> more in-flight instructions means more wrong-path work thrown away on a mispredict, plus larger structures searched each cycle.</li>
<li><strong>Performance side effects:</strong> larger LSQ and IQ CAMs can lengthen critical paths. Recovery by ROB walk takes longer with more entries.</li>
</ul>
<h3>Typical Workload Effects</h3>
<ul><li><strong>Pointer chasing:</strong> little gain (dependent misses).</li><li><strong>Streaming and independent misses:</strong> large gain, until MSHRs or bandwidth saturate.</li><li><strong>Branch-heavy code:</strong> little gain; the window is mostly wrong path.</li><li><strong>Compute-bound:</strong> small gain beyond what covers FP latencies.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>20% of instructions are branches with a 5% mispredict rate. On average, how many instructions are fetched between mispredicts? What does that say about very large ROBs?</p>`,
        a: `<ol><li>Mispredicts per instruction = 0.2 × 0.05 = 0.01.</li><li>Average distance between mispredicts = 1 / 0.01 = <strong>100 instructions</strong>.</li><li>Entries far beyond the next unresolved mispredicted branch are often on the wrong path. A large window pays off mostly on code with predictable branches, like loops with long-latency misses.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>To fully hide a 200-cycle DRAM miss at a sustained IPC of 4, how big must the window be? Why don't designers build that?</p>`,
        a: `<p>By Little's law, the window needed is IPC × latency = 4 × 200 = <strong>800 instructions</strong>. Building it means scaling the ROB, PRF, LQ, SQ, issue queue, and checkpoints together, which is costly in area and power, and the structures with CAMs (IQ, LSQ) hurt timing. Branch mispredicts limit how much of that window is useful anyway. So designers combine a window of several hundred entries with prefetching and other latency-tolerance techniques.</p>`
      }
    ]
  }
},

{
  id: "scheduler",
  region: "core",
  title: "Scheduler Queues",
  body: `
<p>Renamed instructions wait in issue queues until their operands are ready.</p>
<h3>Wakeup and Select</h3>
<p><strong>Wakeup:</strong> a producer's destination tag is broadcast and waiting entries set ready bits. <strong>Select:</strong> pick ready entries up to the issue width per port, often oldest first. For back-to-back dependent issue, wakeup plus select must fit in one cycle.</p>
<h3>Speculative Wakeup</h3>
<p>Dependents of a load are woken assuming an L1 hit; on a miss they're replayed.</p>
<h3>Unified vs. Distributed</h3>
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
  id: "lsq",
  region: "core",
  title: "Load and Store Queues",
  body: `
<p>The LQ and SQ track memory operations in program order so they can execute out of order without breaking memory semantics.</p>
<h3>Stores</h3>
<p>Stores don't write the cache until they commit; after retirement they drain from the store buffer into L1.</p>
<h3>Loads</h3>
<p>A load searches the SQ for older stores to the same address and forwards data when one fully covers it. If an older store's address is unknown, the load waits or speculates.</p>
<h3>Catching Violations</h3>
<p>When a store's address resolves, it searches the LQ for younger loads to the same address that already executed; a hit means flush and re-execute.</p>
<h3>Store Coalescing</h3>
<p>Merging retired stores to the same line saves L1 write bandwidth, but must not make stores visible in an order the memory model forbids.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Store queue, oldest first: St A (0x100, 8 bytes, data ready), St B (address unknown), St C (0x108, 4 bytes, data ready). A younger 8-byte load L reads 0x100. Walk through what happens.</p>`,
        a: `<ol><li>L searches older stores, youngest first. St C covers 0x108–0x10B: no overlap with 0x100–0x107.</li><li>St B's address is unknown. L must wait, or speculate past it based on the memory dependence predictor.</li><li>If it speculates, St A fully covers L, so A's data is forwarded.</li><li>If B later resolves to 0x104, it overlaps L: ordering violation, flush L and everything younger, re-execute.</li><li>If B resolves to 0x200, the speculation was correct.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 4-byte store to 0x100 is followed by an 8-byte load from 0x100. Can the store forward?</p>`,
        a: `<p>Not fully: the store covers only half the load. Most designs block the load until the store commits and writes the cache, then read the merged line. This "store-forwarding stall" can cost 10+ cycles. More complex designs merge store bytes with cache data. Compilers try to avoid narrow-store, wide-load patterns.</p>`
      },
      {
        q: `<p>Why does an x86 core check the load queue against coherence invalidations?</p>`,
        a: `<p>TSO requires loads to appear in program order. If a younger load executed early and the line is then invalidated by another core's write before an older load completes, the younger load may hold a value that is stale relative to the older one. The core detects this on the invalidation and squashes the younger load. Weaker models such as ARM allow more load-load reordering, but same-address ordering still must hold.</p>`
      }
    ]
  }
},

{
  id: "mdp",
  region: "core",
  title: "Memory Dependence Prediction",
  body: `
<p>Should a load issue before older stores whose addresses are unknown? Always waiting loses parallelism; always speculating triggers costly flushes. A predictor learns which loads tend to conflict.</p>
<h3>Simple: Wait Bits</h3>
<p>A table indexed by load PC; a load that caused a violation waits next time. Bits are cleared periodically.</p>
<h3>Store Sets</h3>
<p>Chrysos and Emer's scheme: a store set ID table groups a load with the stores it conflicted with, and a last-fetched-store table makes the load wait only for the most recent in-flight store of its set.</p>
<h3>Metrics</h3>
<ul><li>Ordering violations per thousand instructions</li><li>False dependences: loads made to wait for nothing</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>With store sets, load L (PC 0x40) causes a violation with store S (PC 0x80). Trace what happens the next time both are fetched.</p>`,
        a: `<ol><li>After the violation, the SSIT assigns both PCs the same set, say set 5.</li><li>S is fetched: it looks up set 5 and records itself in LFST[5] as the latest store of the set.</li><li>L is fetched: it looks up set 5, reads LFST[5], and takes a dependence on S.</li><li>L issues only after S issues. When S issues, LFST[5] is cleared if it still points to S.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your new predictor cuts ordering violations by 80% but IPC drops 1%. What happened?</p>`,
        a: `<p>Probably false dependences: loads waiting for stores they never alias with. Measure loads delayed by the predictor whose store didn't actually overlap. Likely causes are PC aliasing in the tables, store sets merging into large sets, or no periodic clearing, so old conflicts keep loads conservative forever.</p>`
      }
    ]
  }
},

{
  id: "exec-units",
  region: "core",
  title: "Execution Units",
  body: `
<p>Execution units do the actual work. The scheduler sends ready instructions to ports, and each port feeds one or more units.</p>
<h3>The Units</h3>
<div class="tbl"><table>
<tr><th>Unit</th><th>Does</th><th>Typical latency</th><th>Notes</th></tr>
<tr><td>ALU</td><td>Add, subtract, logic, shifts, compares</td><td>1 cycle</td><td>Several per core; small and cheap</td></tr>
<tr><td>Branch unit</td><td>Resolves branches, triggers recovery</td><td>1 cycle</td><td>Often shares a port with an ALU</td></tr>
<tr><td>Integer multiplier</td><td>Multiply</td><td>3–4 cycles</td><td>Pipelined</td></tr>
<tr><td>Integer divider</td><td>Divide</td><td>~10–40 cycles</td><td>Iterative, usually not pipelined</td></tr>
<tr><td><a href="#/fp-units">FPU / FMA</a></td><td>FP add, multiply, fused multiply-add</td><td>3–5 cycles</td><td>Pipelined; large area</td></tr>
<tr><td>FP divide/sqrt</td><td>Division, square root</td><td>~10–30 cycles</td><td>Iterative</td></tr>
<tr><td>Vector / SIMD</td><td>Same op on many lanes</td><td>Like scalar FP</td><td>Area and power scale with width</td></tr>
<tr><td>Load unit (LDU)</td><td>Address generation + L1D access</td><td>~4–5 cycles load-to-use</td><td>Also searches the SQ</td></tr>
<tr><td>Store unit (STU)</td><td>Store address and store data</td><td>Writes the SQ</td><td>Address and data often split into separate ports</td></tr>
</table></div>
<p>For number formats (FP64 down to FP4, the mantissa, BF16, TF32) and the inside of the FMA pipeline, see <a href="#/fp-units">Floating-Point Units</a>.</p>
<h3>The Math</h3>
<ul>
<li><strong>Port demand:</strong> ops per cycle of a type = IPC × fraction of that type. Keep utilization well below 100% to avoid queueing.</li>
<li><strong>Throughput vs. latency:</strong> a pipelined unit with latency L can accept a new op each cycle; to keep it busy, you need L independent operations in flight (e.g., 4-cycle FMA × 2 units = 8 independent accumulations).</li>
<li><strong>Bypass network:</strong> with P producers and C consumer operands, there are about P × C forwarding paths, so it grows roughly with the square of the unit count.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul>
<li><strong>More units:</strong> more peak throughput, but each adds a scheduler select port, PRF read and write ports, and bypass paths. Those structures, not the units themselves, are often the limit.</li>
<li><strong>Wider SIMD:</strong> large throughput gains for vectorizable code, but area and power scale with width, and some designs lower frequency when wide vector units are active. Power-gate them when idle.</li>
<li><strong>Lower latency:</strong> helps dependent chains (pointer chasing benefits most from a faster load-to-use path) but may cost frequency or more area.</li>
<li><strong>Specialized units</strong> (crypto, matrix engines) are very efficient for their task and idle otherwise; that's acceptable because idle silicon can be power-gated ("dark silicon").</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A workload has 35% loads and 10% stores, and the target IPC is 4. How many load and store ports does it need?</p>`,
        a: `<ol><li>Loads per cycle: 0.35 × 4 = 1.4. Stores per cycle: 0.10 × 4 = 0.4.</li><li>Average demand fits in 2 load ports and 1 store port.</li><li>Demand is bursty, though, and an AGU or port that's busy more than about 70% of the time causes queueing. So designers often provision 3 load ports, or 2 load plus 2 store, for headroom.</li></ol>`
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
  id: "fp-units",
  region: "core",
  title: "Floating-Point Units",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Appendix J, Computer Arithmetic (floating-point representation, multiplication and addition, rounding); Chapter 7, Domain-Specific Architectures, for bfloat16 on Google’s TPU. Patterson &amp; Hennessy, <em>Computer Organization and Design</em>, Section 3.5, Floating Point.`,
  sections: [
    { id: "role", label: "What the FPU Does" },
    { id: "anatomy", label: "Anatomy of a Float: Sign, Exponent, Mantissa" },
    { id: "formats", label: "Every Format, Side by Side" },
    { id: "bf16", label: "BF16 (bfloat16)" },
    { id: "tf32", label: "TF32 and “BF32”" },
    { id: "fp8", label: "FP8, FP6, FP4 and Block Scaling" },
    { id: "fma", label: "Inside the FMA Pipeline" },
    { id: "hw", label: "Area, Throughput and ISA Support" }
  ],
  body: `
<h3 id="sec-role">What the FPU Does</h3>
<p>The floating-point unit executes FP add, multiply, fused multiply-add (FMA), compare, convert, and (in a separate iterative unit) divide and square root. In a modern core the scalar FPU and the SIMD units are the same hardware: a scalar FP add is just one lane of a vector pipe. The format a number uses decides almost everything about the unit: how wide the multiplier is, how far the aligner shifts, how many lanes fit in a vector register, and how many bytes cross the memory system per operation.</p>

<h3 id="sec-anatomy">Anatomy of a Float: Sign, Exponent, Mantissa</h3>
<p>Every binary floating-point format has the same three fields. For FP32, bit 31 is the sign, bits 30–23 are the exponent, and bits 22–0 are the fraction.</p>
<ul>
<li><strong>Sign (S):</strong> 1 bit. 0 is positive.</li>
<li><strong>Exponent (E):</strong> <em>e</em> bits, stored with a <strong>bias</strong> of 2<sup>e−1</sup> − 1 (127 for 8 bits, 15 for 5 bits) so that negative exponents need no separate sign.</li>
<li><strong>Fraction (F):</strong> <em>f</em> bits, the digits after the binary point.</li>
</ul>
<p class="eq">Normal value = (−1)<sup>S</sup> × 1.F × 2<sup>E − bias</sup></p>
<p><strong>Mantissa vs. significand vs. fraction.</strong> IEEE 754 calls the full number 1.F the <em>significand</em>; the stored field F is the <em>fraction</em>; “mantissa” is the older word and people use it for either. The leading 1 is not stored (the <strong>hidden bit</strong>): any normalized binary number starts with 1, so storing it would waste a bit. So the <strong>precision</strong> is <em>p</em> = <em>f</em> + 1 bits. FP32 stores 23 fraction bits but has 24 bits of precision. Hardware re-inserts the hidden bit when it unpacks an operand, so an FP32 multiplier is 24 × 24 bits, not 23 × 23.</p>
<p><strong>The exponent field’s two reserved values:</strong></p>
<div class="tbl"><table>
<tr><th>Exponent field</th><th>Fraction</th><th>Meaning</th></tr>
<tr><td>All zeros</td><td>0</td><td>±0 (two zeros: they compare equal, but 1/−0 = −∞)</td></tr>
<tr><td>All zeros</td><td>≠ 0</td><td>Subnormal: (−1)<sup>S</sup> × 0.F × 2<sup>1 − bias</sup>. Hidden bit is 0, so precision drops gradually toward zero</td></tr>
<tr><td>1 to all-ones − 1</td><td>Any</td><td>Normal number</td></tr>
<tr><td>All ones</td><td>0</td><td>±∞</td></tr>
<tr><td>All ones</td><td>≠ 0</td><td>NaN (on most ISAs, fraction bit <em>f</em>−1 set = quiet NaN)</td></tr>
</table></div>
<p>The small ML formats bend these rules (FP8 E4M3 has no infinity; FP6 and FP4 have neither infinity nor NaN) to spend every encoding on numbers. The x87 80-bit format is the odd one out the other way: it stores the integer bit explicitly.</p>
<p><strong>What the mantissa width buys you:</strong></p>
<ul>
<li><strong>Spacing (ULP).</strong> Between 2<sup>k</sup> and 2<sup>k+1</sup> the representable numbers are evenly spaced, one <em>unit in the last place</em> apart: ULP = 2<sup>k − f</sup>. The spacing doubles at every power of two, so <em>absolute</em> error grows with magnitude while <em>relative</em> error stays roughly constant.</li>
<li><strong>Machine epsilon</strong> ε = 2<sup>−f</sup>, the gap between 1.0 and the next number. Round to nearest makes each operation’s relative error at most ε/2 (the <em>unit roundoff</em>).</li>
<li><strong>Decimal digits</strong> ≈ <em>p</em> × log<sub>10</sub>2 ≈ 0.301 <em>p</em>.</li>
<li><strong>Exact integers.</strong> Every integer from 0 to 2<sup>p</sup> is exact; past that, odd integers start to disappear. FP32: up to 16,777,216 (2<sup>24</sup>). FP16: 2,048. BF16: only 256. FP64: 2<sup>53</sup> ≈ 9.0 × 10<sup>15</sup>.</li>
</ul>
<p><strong>Worked example: −6.5 in three formats.</strong> 6.5 = 110.1<sub>2</sub> = 1.101<sub>2</sub> × 2<sup>2</sup>, so S = 1 and the fraction starts 101.</p>
<div class="tbl"><table>
<tr><th>Format</th><th>Exponent field</th><th>Bits (S | E | F)</th><th>Hex</th></tr>
<tr><td>FP32</td><td>2 + 127 = 129</td><td><code>1 | 10000001 | 10100000000000000000000</code></td><td><code>0xC0D00000</code></td></tr>
<tr><td>BF16</td><td>2 + 127 = 129</td><td><code>1 | 10000001 | 1010000</code></td><td><code>0xC0D0</code></td></tr>
<tr><td>FP16</td><td>2 + 15 = 17</td><td><code>1 | 10001 | 1010000000</code></td><td><code>0xC680</code></td></tr>
</table></div>
<p>BF16 is literally the top 16 bits of the FP32 pattern. FP16 needs a re-biased exponent.</p>

<h3 id="sec-formats">Every Format, Side by Side</h3>
${FP_BARS}
<div class="tbl"><table>
<tr><th>Format</th><th>S / E / F bits</th><th>Bias</th><th>Precision <em>p</em></th><th>ε = 2<sup>−f</sup></th><th>≈ Digits</th><th>Max normal</th><th>Min normal</th><th>Main use</th></tr>
<tr><td>FP128 (quad, binary128)</td><td>1 / 15 / 112</td><td>16383</td><td>113</td><td>1.9 × 10<sup>−34</sup></td><td>34</td><td>1.19 × 10<sup>4932</sup></td><td>3.36 × 10<sup>−4932</sup></td><td>Error-sensitive science; hardware only on IBM POWER9 and later, software elsewhere</td></tr>
<tr><td>x87 extended (80-bit)</td><td>1 / 15 / 64*</td><td>16383</td><td>64</td><td>1.1 × 10<sup>−19</sup></td><td>19</td><td>1.19 × 10<sup>4932</sup></td><td>3.36 × 10<sup>−4932</sup></td><td><code>long double</code> on x86 Linux; *includes an explicit integer bit</td></tr>
<tr><td>FP64 (double, binary64)</td><td>1 / 11 / 52</td><td>1023</td><td>53</td><td>2.2 × 10<sup>−16</sup></td><td>15.9</td><td>1.80 × 10<sup>308</sup></td><td>2.23 × 10<sup>−308</sup></td><td>HPC, simulation, finance</td></tr>
<tr><td>FP32 (single, binary32)</td><td>1 / 8 / 23</td><td>127</td><td>24</td><td>1.19 × 10<sup>−7</sup></td><td>7.2</td><td>3.40 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>General compute; ML master weights and accumulators</td></tr>
<tr><td>TF32 (TensorFloat-32)</td><td>1 / 8 / 10 (19 of 32 bits)</td><td>127</td><td>11</td><td>9.8 × 10<sup>−4</sup></td><td>3.3</td><td>≈ 3.40 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>NVIDIA tensor-core matmul input (A100 onward); never stored</td></tr>
<tr><td>FP16 (half, binary16)</td><td>1 / 5 / 10</td><td>15</td><td>11</td><td>9.8 × 10<sup>−4</sup></td><td>3.3</td><td>65,504</td><td>6.1 × 10<sup>−5</sup></td><td>Graphics, inference, mixed-precision training with loss scaling</td></tr>
<tr><td>BF16 (bfloat16)</td><td>1 / 8 / 7</td><td>127</td><td>8</td><td>7.8 × 10<sup>−3</sup></td><td>2.4</td><td>3.39 × 10<sup>38</sup></td><td>1.18 × 10<sup>−38</sup></td><td>ML training and inference</td></tr>
<tr><td>FP8 E5M2</td><td>1 / 5 / 2</td><td>15</td><td>3</td><td>0.25</td><td>0.9</td><td>57,344</td><td>6.1 × 10<sup>−5</sup></td><td>Gradients (range matters more than precision)</td></tr>
<tr><td>FP8 E4M3</td><td>1 / 4 / 3</td><td>7</td><td>4</td><td>0.125</td><td>1.2</td><td>448</td><td>0.015625</td><td>Weights and activations; no ∞, one NaN pattern per sign</td></tr>
<tr><td>FP6 E3M2</td><td>1 / 3 / 2</td><td>3</td><td>3</td><td>0.25</td><td>0.9</td><td>28</td><td>0.25</td><td>OCP MX block formats; no ∞ or NaN</td></tr>
<tr><td>FP6 E2M3</td><td>1 / 2 / 3</td><td>1</td><td>4</td><td>0.125</td><td>1.2</td><td>7.5</td><td>1</td><td>OCP MX block formats; no ∞ or NaN</td></tr>
<tr><td>FP4 E2M1</td><td>1 / 2 / 1</td><td>1</td><td>2</td><td>0.5</td><td>0.6</td><td>6</td><td>1</td><td>Inference weights (MXFP4, NVFP4); no ∞ or NaN</td></tr>
</table></div>
<p><strong>How to read the table:</strong> exponent bits set the range (FP32, TF32, and BF16 share 8 exponent bits and so share FP32’s range); fraction bits set the precision (TF32 and FP16 share 10 fraction bits and so share FP16’s precision). TF32 is literally “FP32 range, FP16 precision,” and BF16 is “FP32 range, less precision than FP16.” FP16’s 5-bit exponent is why it overflows at 65,504.</p>
<p>FP4 is small enough to list every value: ±{0, 0.5, 1, 1.5, 2, 3, 4, 6}. Its 16 bit patterns encode 15 distinct values (+0 and −0 are both zero).</p>

<h3 id="sec-bf16">BF16 (bfloat16)</h3>
<p>Google Brain designed bfloat16 for the TPU (the “b” is for Brain). The design rule: keep FP32’s 8-bit exponent, cut the fraction from 23 to 7 bits. Three consequences make it the default ML training format:</p>
<ul>
<li><strong>Same range as FP32.</strong> Tiny gradients don’t underflow and big activations don’t overflow, so training needs no loss scaling (FP16 does).</li>
<li><strong>Conversion is almost free.</strong> BF16 → FP32 appends 16 zero bits. FP32 → BF16 rounds and keeps the top 16 bits. No exponent re-biasing, no range checks.</li>
<li><strong>The multiplier is tiny.</strong> An 8 × 8-bit significand multiplier versus 24 × 24 for FP32 (see the area table below).</li>
</ul>
<p>The cost is precision: 8 bits, about 2.4 decimal digits. Neural networks tolerate that in individual multiplies, but not in long sums or in small weight updates. Two consequences:</p>
<ul>
<li><strong>Accumulate in FP32.</strong> Every BF16 matrix unit (AVX-512 <code>VDPBF16PS</code>, Arm <code>BFMMLA</code>, Intel AMX, GPU tensor cores) multiplies BF16 pairs but adds into FP32.</li>
<li><strong>Keep FP32 master weights.</strong> A weight near 1.0 has a BF16 ULP of 2<sup>−7</sup>, so any update smaller than half of that (2<sup>−8</sup> ≈ 0.0039) rounds away completely. Optimizers keep an FP32 copy (or use stochastic rounding) and cast to BF16 for the forward and backward passes.</li>
</ul>
<p><strong>FP32 → BF16 in C,</strong> with round to nearest, ties to even:</p>
<pre><code>uint16_t fp32_to_bf16(float f) {
    uint32_t x;
    memcpy(&amp;x, &amp;f, sizeof x);
    if ((x &amp; 0x7FFFFFFF) &gt; 0x7F800000)    <span class="cm">// NaN: keep it NaN (force quiet bit)</span>
        return (uint16_t)((x &gt;&gt; 16) | 0x0040);
    x += 0x7FFF + ((x &gt;&gt; 16) &amp; 1);        <span class="cm">// add just under half an ULP, plus 1 if the kept LSB is odd</span>
    return (uint16_t)(x &gt;&gt; 16);           <span class="cm">// a carry out of the fraction bumps the exponent, as it should</span>
}</code></pre>
<p><strong>Example:</strong> 1/3 in FP32 is <code>0x3EAAAAAB</code>. The dropped half <code>0xAAAB</code> is above <code>0x8000</code>, so it rounds up to <code>0x3EAB</code> = 0.333984375. Plain truncation would give <code>0x3EAA</code> = 0.33203125, more than twice the error, and always biased toward zero, which adds up in training.</p>
<p><strong>Subnormals:</strong> the format has them, but many BF16 instructions flush subnormal inputs and outputs to zero and always round to nearest even, ignoring the FP control register. That’s cheap and rarely matters given the 10<sup>−38</sup> range.</p>

<h3 id="sec-tf32">TF32 and “BF32”</h3>
<p><strong>TF32 is a compute mode, not a storage format.</strong> NVIDIA introduced it with the A100’s tensor cores: tensors stay FP32 in memory and registers, the tensor core reads only the sign, 8 exponent bits, and the top 10 fraction bits of each input, multiplies at that precision, and accumulates in FP32. Code written for FP32 gets several times the throughput with no changes. The price is FP16-level precision in the products. Frameworks make it opt-in for matmuls (in PyTorch, <code>torch.set_float32_matmul_precision("high")</code>).</p>
<p><strong>“BF32” is not an IEEE or industry storage format.</strong> The name shows up as the same trick on Intel CPUs: Intel’s PyTorch extension offers a BF32 FP32-math mode, and oneDNN has an equivalent “fpmath mode” of bf16. Tensors stay FP32, but matmul and convolution inputs are converted to BF16 and run on AMX or AVX-512 BF16 units with FP32 accumulation. It’s Intel’s counterpart to TF32, with 8 bits of precision instead of 11.</p>
<p><strong>Getting FP32 accuracy from BF16 hardware.</strong> Split each FP32 value into a sum of BF16 pieces, x ≈ x<sub>0</sub> + x<sub>1</sub> + x<sub>2</sub>, where x<sub>0</sub> is x rounded to BF16, x<sub>1</sub> is the remainder rounded to BF16, and so on. Then multiply the pieces and drop the smallest cross terms: three BF16 products (“bf16x3”) give close to FP32 accuracy, six give about full FP32. On Google TPUs, JAX exposes these as precision levels. It trades matmul throughput for accuracy without needing FP32 multipliers.</p>

<h3 id="sec-fp8">FP8, FP6, FP4 and Block Scaling</h3>
<p>Below 16 bits the range is too small to use the raw numbers directly, so every low-precision format comes with <strong>scale factors</strong>: store x / s in FP8 or FP4 and keep s separately.</p>
<ul>
<li><strong>FP8 comes in two flavors</strong> (NVIDIA, Arm, and Intel’s 2022 proposal, first in hardware on the H100). E4M3 has more precision and is used for weights and activations; E5M2 has more range and is used for gradients. Hopper-style FP8 training uses one FP32 scale per tensor, chosen from recent maximum values.</li>
<li><strong>Finer scaling helps.</strong> One outlier forces a per-tensor scale to squash everything else toward zero. Fine-grained schemes give each small block its own scale: DeepSeek-V3 trained in FP8 with one scale per 1 × 128 tile of activations and per 128 × 128 block of weights.</li>
<li><strong>OCP Microscaling (MX) formats</strong> standardize this: a block of 32 elements (FP8, FP6, FP4, or INT8) shares one 8-bit power-of-two scale (E8M0: exponent only, no sign or fraction). MXFP4 therefore costs 4 + 8/32 = 4.25 bits per value.</li>
<li><strong>NVFP4</strong> (Blackwell) uses 16-element blocks with an FP8 E4M3 scale (finer than a power of two), plus one FP32 scale per tensor: 4 + 8/16 = 4.5 bits per value.</li>
</ul>
<p>Hardware handles the scale cheaply: power-of-two scales just add to the exponent, and per-block scales are applied once per block of products inside the dot product, not per element.</p>

<h3 id="sec-fma">Inside the FMA Pipeline</h3>
<p>A fused multiply-add computes a × b + c with <strong>one</strong> rounding at the end, which is both more accurate and faster than a separate multiply and add. It counts as two FLOPs, which is why peak-FLOPS figures assume FMAs. Most FPUs build add and multiply out of the FMA datapath (a + b = a × 1 + b). The stages:</p>
<ol start="0">
<li><strong>Unpack:</strong> split the fields, insert the hidden bit (1 for normals, 0 for subnormals), detect zero, ∞, and NaN.</li>
<li><strong>Multiply significands:</strong> a <em>p</em> × <em>p</em> partial-product array (Booth recoding plus a Wallace or Dadda compressor tree), leaving the 2<em>p</em>-bit product in carry-save form. In parallel, add the exponents (E<sub>a</sub> + E<sub>b</sub> − bias) and compute how far to shift c.</li>
<li><strong>Align c:</strong> shift c’s significand to line up with the product. The aligner is about 3<em>p</em> bits wide, because c can sit far above or below the product.</li>
<li><strong>Add:</strong> a 3-input carry-save step, then a carry-propagate adder about 3<em>p</em> bits wide. A leading-zero anticipator (LZA) predicts the normalization shift in parallel with the add.</li>
<li><strong>Normalize:</strong> shift left by the LZA count (cancellation when a × b ≈ −c can remove many leading bits), or right by one on carry-out.</li>
<li><strong>Round:</strong> using the guard, round, and sticky bits and the current rounding mode (round to nearest even by default); handle overflow to ∞, underflow to subnormal or zero, and set the exception flags.</li>
</ol>
<p>These steps pipeline into about 4 cycles at high frequency: Intel Skylake runs FP add, multiply, and FMA all at 4 cycles; AMD Zen 4 runs add and multiply at 3 and FMA at 4. Divide and square root use a separate iterative unit (radix-4 SRT or Newton–Raphson style), which is why they take 10–30 cycles and usually aren’t fully pipelined.</p>

<h3 id="sec-hw">Area, Throughput and ISA Support</h3>
<p>The significand multiplier dominates FMA area, and it grows roughly with <em>p</em><sup>2</sup>. The aligner, adder, and normalizer grow roughly linearly with <em>p</em>, and the exponent logic is small.</p>
<div class="tbl"><table>
<tr><th>Format</th><th>Multiplier (<em>p</em> × <em>p</em>)</th><th>Partial-product bits</th><th>Relative to FP32</th></tr>
<tr><td>FP64</td><td>53 × 53</td><td>2,809</td><td>4.9×</td></tr>
<tr><td>FP32</td><td>24 × 24</td><td>576</td><td>1×</td></tr>
<tr><td>TF32, FP16</td><td>11 × 11</td><td>121</td><td>0.21×</td></tr>
<tr><td>BF16</td><td>8 × 8</td><td>64</td><td>0.11×</td></tr>
<tr><td>FP8 E4M3</td><td>4 × 4</td><td>16</td><td>0.028×</td></tr>
<tr><td>FP8 E5M2</td><td>3 × 3</td><td>9</td><td>0.016×</td></tr>
<tr><td>FP4 E2M1</td><td>2 × 2</td><td>4</td><td>0.007×</td></tr>
</table></div>
<ul>
<li><strong>Why GPUs cut FP64:</strong> a 53 × 53 multiplier is about 5 FP32 multipliers’ worth of area. Data-center GPUs pay for it; consumer GPUs run FP64 at a small fraction of FP32 speed (1/64 on recent NVIDIA GeForce parts).</li>
<li><strong>Multi-precision datapaths:</strong> one 24 × 24 array can be partitioned into several smaller multipliers, so the same FMA hardware runs one FP32 lane, two FP16 lanes, or more BF16 or FP8 lanes. In SIMD units, halving the width doubles the lanes in a fixed-width register, so throughput doubles per halving even though the multiplier shrinks about 4×. Register-file and operand bandwidth, not multiplier area, sets the pace.</li>
<li><strong>Bandwidth is the other half:</strong> halving the bits also halves the bytes per value, doubling effective memory bandwidth and cache capacity (see <a href="#/gen-gpus/roofline">the roofline model</a>). For memory-bound inference, that matters more than the FLOPs.</li>
</ul>
<p><strong>Who supports what:</strong></p>
<div class="tbl"><table>
<tr><th>Platform</th><th>Formats beyond FP32 / FP64</th></tr>
<tr><td>x86</td><td>x87 80-bit; F16C (FP16 ↔ FP32 conversion only); AVX-512 BF16 (<code>VDPBF16PS</code> dot product into FP32; Cooper Lake, Zen 4); AVX-512 FP16 full arithmetic (Sapphire Rapids); AMX tiles with BF16 (Sapphire Rapids) and FP16 (Granite Rapids)</td></tr>
<tr><td>Arm</td><td>FP16 arithmetic (Armv8.2); BF16 <code>BFDOT</code>, <code>BFMMLA</code>, <code>BFCVT</code> (Armv8.6); FP8 in recent Armv9 extensions</td></tr>
<tr><td>RISC-V</td><td>Q (quad), Zfh (half), Zfbfmin and Zvfbfmin (BF16 conversions), Zvfbfwma (vector BF16 widening multiply-add into FP32)</td></tr>
<tr><td>IBM POWER</td><td>Hardware binary128 (POWER9 onward)</td></tr>
<tr><td>NVIDIA GPUs</td><td>FP16 tensor cores (Volta); TF32 and BF16 (Ampere); FP8 E4M3 and E5M2 (Hopper); FP6, FP4, MX formats, and NVFP4 (Blackwell)</td></tr>
<tr><td>Google TPU</td><td>BF16 matrix units with FP32 accumulation (TPU v2 onward); INT8 and FP8 on later generations</td></tr>
</table></div>
<p class="refs">Further reading: IEEE 754-2019, the standard; David Goldberg, “What Every Computer Scientist Should Know About Floating-Point Arithmetic” (ACM Computing Surveys, 1991); Kalamkar et al., “A Study of BFLOAT16 for Deep Learning Training” (2019); Micikevicius et al., “Mixed Precision Training” (ICLR 2018) and “FP8 Formats for Deep Learning” (2022); Open Compute Project, “OCP Microscaling Formats (MX) v1.0 Specification” (2023); NVIDIA, “NVIDIA A100 Tensor Core GPU Architecture” whitepaper, for TF32; DeepSeek-AI, “DeepSeek-V3 Technical Report” (2024), for fine-grained FP8 training.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Llama 3 sets its RoPE base frequency <code>rope_theta</code> to 500,000. What value does that constant actually have if it’s stored in FP16? In BF16? In FP32?</p>`,
        a: `<ol start="0"><li><strong>FP16:</strong> the largest finite value is 65,504, so 500,000 overflows to <strong>+∞</strong>. Every frequency computed from it is garbage.</li><li><strong>BF16:</strong> 2<sup>18</sup> = 262,144 ≤ 500,000 &lt; 2<sup>19</sup>, so the exponent is 18 and the spacing is 2<sup>18 − 7</sup> = 2,048. 500,000 / 2,048 = 244.14, which rounds to 244, so BF16 stores 244 × 2,048 = <strong>499,712</strong> (0.06% low).</li><li><strong>FP32:</strong> 500,000 &lt; 2<sup>24</sup>, and every integer below 2<sup>24</sup> is exact, so it is stored <strong>exactly</strong>.</li><li>Takeaway: this is why position-encoding frequencies are computed in FP32 even when the model runs in BF16. BF16’s range was fine, but its precision wasn’t.</li></ol>`
      },
      {
        q: `<p>DeepSeek-V3 has 671 billion parameters and was released with FP8 weights that carry one FP32 scale per 128 × 128 block. Can the weights fit on one 8 × H200 server (141 GB of HBM per GPU) in FP8? In BF16? How much memory is left for the KV cache and activations?</p>`,
        a: `<ol start="0"><li>Server memory: 8 × 141 = 1,128 GB.</li><li>BF16: 671 × 10<sup>9</sup> × 2 bytes = 1,342 GB. <strong>Doesn’t fit</strong>; it needs two servers or more aggressive quantization.</li><li>FP8: 671 GB for the values. The scales add 4 bytes per 128 × 128 = 16,384 values, about 0.02%, so roughly 671 GB total. <strong>Fits.</strong></li><li>Left over: about 1,128 − 671 ≈ <strong>457 GB</strong> for the KV cache, activations, and runtime buffers (in practice somewhat less after framework overhead).</li><li>Takeaway: the number format decides how many GPUs a deployment needs, which matters more for cost than the FLOPs it saves.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Mixed-precision training in FP16 needs loss scaling, but BF16 training usually doesn’t. Explain why, using a gradient value of 2 × 10<sup>−8</sup>.</p>`,
        a: `<p>FP16 has a 5-bit exponent: its smallest normal is 6.1 × 10<sup>−5</sup> and its smallest subnormal is 2<sup>−24</sup> ≈ 5.96 × 10<sup>−8</sup>. A gradient of 2 × 10<sup>−8</sup> is less than half the smallest subnormal, so it rounds to <strong>zero</strong>, and many small gradients vanish the same way. Loss scaling multiplies the loss by a large factor (for example 2<sup>16</sup>) before the backward pass, which lifts the gradient to about 1.3 × 10<sup>−3</sup>, comfortably representable; the optimizer divides the factor back out in FP32, and dynamic schemes lower the factor whenever a gradient overflows to ∞.</p><p>BF16 has FP32’s 8-bit exponent, with normals down to 1.18 × 10<sup>−38</sup>, so 2 × 10<sup>−8</sup> is an ordinary normal number. It loses precision (8 bits) but not the value. The trade-off: FP16 has 3 more bits of precision, so with loss scaling it can be slightly more accurate per operation.</p>`
      },
      {
        q: `<p>A naive kernel computes a dot product over K = 8,192 (Llama 3 70B’s hidden size) where every product is about 1.0, but it keeps the running sum in BF16. What does it return, and how do real matrix units avoid this?</p>`,
        a: `<p>It returns about <strong>256</strong>, not 8,192. From 128 to 256 the BF16 spacing is 2<sup>7 − 7</sup> = 1, so adding 1 is exact. At 256 the spacing becomes 2<sup>8 − 7</sup> = 2. 256 + 1 = 257 is exactly halfway between 256 and 258, and ties go to the even significand, which is 256. Every later addition rounds back to 256, so the sum stalls (this is called swamping).</p><p>Real hardware multiplies in BF16 (or FP8) but accumulates in FP32, where the stall point is 2<sup>24</sup>. Long reductions also sum in blocks or trees (for example per tile, then across tiles), which keeps the partial sums similar in size and reduces rounding error further.</p>`
      },
      {
        q: `<p>H100 SXM dense tensor-core peaks are about 67 TFLOPS for FP64, 495 for TF32, 989 for BF16, and 1,979 for FP8. A BF16 multiplier is about 9× smaller than an FP32 one and an FP8 E4M3 multiplier about 4× smaller than BF16. Why does throughput only double per format step instead of tracking multiplier area? And why is the FP64 gap so large?</p>`,
        a: `<p>Throughput is set by how many operands per cycle the tensor core can be fed, not by multiplier area. Register-file and shared-memory bandwidth is fixed in bytes per cycle, so halving the bytes per value doubles the values delivered, and so the multiplies performed. The datapath is also built as partitionable arrays: the wide multiplier array splits into 2× as many narrower multipliers per step, keeping the same wiring, accumulators, and operand routing. The spare area from smaller multipliers is spent on wider accumulators, scaling logic, and more formats, not on more lanes that couldn’t be fed.</p><p>FP64 goes the other way: a 53 × 53 multiplier is about 5× an FP32 one and about 23× a TF32 or FP16 one (2,809 vs. 121 partial-product bits), so NVIDIA provides far fewer FP64 lanes. That’s where the roughly 7× gap to TF32 comes from. A performance model of a new tensor unit should therefore model operand bandwidth per cycle first and multiplier count second.</p>`
      }
    ]
  }
},

{
  id: "smt",
  region: "core",
  title: "Simultaneous Multithreading",
  sections: [
    { id: "idea", label: "The Idea" },
    { id: "sharing", label: "Shared, Partitioned, and Replicated" },
    { id: "fetch", label: "Fetch Policy" },
    { id: "gains", label: "What It Gains and Costs" },
    { id: "model", label: "Measuring and Modeling SMT" }
  ],
  body: `
<p>A wide out-of-order core rarely fills its issue slots from one thread: dependences, mispredicts, and cache misses leave most of them empty. <strong>Simultaneous multithreading (SMT)</strong> runs two or more hardware threads on one core at the same time, so one thread's idle slots can be filled with another's work.</p>

<h3 id="sec-idea">The Idea</h3>
<p>Tullsen, Eggers, and Levy (1995) compared three ways to use a superscalar core's slots: coarse-grained multithreading (switch threads on a long stall), fine-grained multithreading (switch every cycle), and SMT (issue from several threads in the same cycle). Only SMT fills both kinds of waste: <em>vertical</em> waste (cycles where nothing issues) and <em>horizontal</em> waste (cycles where only some slots are used). Intel shipped it as Hyper-Threading in 2002; AMD's Zen cores, IBM's POWER (up to 8 threads per core), and some Arm Neoverse cores also use it.</p>
<p>The extra hardware is modest: a second copy of the architectural state (register mapping table, PC, some control registers), thread IDs on shared structures, and policies for sharing. The physical register file, caches, execution units, and most queues are already there.</p>

<h3 id="sec-sharing">Shared, Partitioned, and Replicated</h3>
<div class="tbl"><table>
<tr><th>Policy</th><th>Typical structures</th><th>Why</th></tr>
<tr><td>Replicated</td><td>Architectural register map, PC, return stack, some predictor history</td><td>Each thread needs its own copy for correctness</td></tr>
<tr><td>Statically partitioned when both threads run</td><td>ROB, load and store queues, micro-op queue (on Intel cores; AMD statically splits several queues too)</td><td>Guarantees each thread a share, so one stalled thread can't fill the whole structure</td></tr>
<tr><td>Competitively shared</td><td>Schedulers, physical registers, caches, TLBs, branch predictor tables</td><td>Better use when threads differ, at the risk of one thread crowding out the other</td></tr>
</table></div>
<p>When only one thread is active, partitioned structures recombine, so single-thread performance is close to that of a core without SMT.</p>

<h3 id="sec-fetch">Fetch Policy</h3>
<p>Which thread fetches each cycle decides who gets the shared back end. Round-robin is simple but lets a thread stuck on a miss fill the queues with instructions that can't issue. Tullsen et al.'s <strong>ICOUNT</strong> policy (1996) fetches from the thread with the fewest instructions in the front end and queues, which favors threads that are making progress and keeps either from clogging the scheduler. Many later policies refine this by also throttling threads with outstanding long misses.</p>

<h3 id="sec-gains">What It Gains and Costs</h3>
<ul>
<li><strong>Throughput:</strong> typically 10 to 30% more total work per core on server and mixed workloads, more when threads are often stalled on memory, little or none when one thread already saturates the execution units (dense floating-point kernels).</li>
<li><strong>Per-thread latency:</strong> each thread runs slower than it would alone, because it shares the core. Latency-sensitive services sometimes turn SMT off for this reason.</li>
<li><strong>Cache and TLB contention:</strong> two working sets share L1, L2, and the TLBs; when they don't fit, both threads can lose.</li>
<li><strong>Security:</strong> threads on one core share microarchitectural state, which has enabled cross-thread side channels (see <a href="#/side-channels">Speculative Side Channels</a>); some systems disable SMT or schedule only mutually trusting threads together.</li>
</ul>

<h3 id="sec-model">Measuring and Modeling SMT</h3>
<ul>
<li><strong>Report both throughput and fairness.</strong> Weighted speedup sums each thread's IPC with SMT divided by its IPC alone; it counts each thread's progress relative to what it could do. Harmonic speedup or the maximum slowdown shows whether one thread is being starved.</li>
<li><strong>Pick co-runner pairs deliberately:</strong> memory-bound with compute-bound, two memory-bound, two identical threads. Gains depend heavily on the pairing.</li>
<li><strong>Model the partitioning rules exactly,</strong> including when a structure switches between partitioned and shared modes, and thread-aware arbitration at every shared port.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 (multithreading: exploiting thread-level parallelism to improve uniprocessor throughput) · Tullsen, Eggers, and Levy, "Simultaneous Multithreading: Maximizing On-Chip Parallelism," ISCA 1995 · Tullsen et al., "Exploiting Choice: Instruction Fetch and Issue on an Implementable Simultaneous Multithreading Processor," ISCA 1996 · Marr et al., "Hyper-Threading Technology Architecture and Microarchitecture," Intel Technology Journal, 2002</p>`,
  practice: {
    guided: [
      {
        q: `<p>Thread A alone runs at IPC 2.0 and thread B alone at IPC 0.8. Together on one SMT core, A runs at 1.5 and B at 0.6. Compute the total throughput gain, the weighted speedup, and each thread's slowdown.</p>`,
        a: `<ol start="0"><li>Throughput: alone, the core does one thread at a time; running A then B for equal times averages (2.0 + 0.8) / 2 = 1.4 IPC. Together: 1.5 + 0.6 = 2.1 IPC, so <strong>1.5×</strong> versus time-slicing. (Against A alone it is 2.1 / 2.0 = 1.05×, which is why "throughput gain" needs a stated baseline.)</li><li>Weighted speedup: 1.5 / 2.0 + 0.6 / 0.8 = 0.75 + 0.75 = <strong>1.5</strong>: the pair gets 1.5 cores' worth of progress from one core.</li><li>Slowdowns: A runs at 75% of its alone speed (1.33× slower); B at 75% too. Equal slowdowns, so neither is starved.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A latency-critical web service gets 25% more requests per second with SMT on, but its 99th-percentile latency rises 40%. The team asks you whether to keep SMT on. What do you measure and recommend?</p>`,
        a: `<p>Both numbers are expected: SMT trades per-thread speed for throughput, and tail latency is set by the slowest requests, which now share a core. Measure what the service is actually held to. If it must meet a latency target at a given load, compare the maximum load that meets the target with SMT on and off; SMT often wins there anyway, because without it the extra load queues up and the tail grows even more. Check what the co-runner is: if the sibling thread runs batch work, its cache and memory pressure may cause most of the tail, and the fix is scheduling (pair the service's threads with each other, or isolate cores), not disabling SMT. If the target can't be met with SMT on at the needed load, disable it only on the cores that serve requests and keep it for background work.</p>`
      }
    ]
  }
},

{
  id: "simd",
  region: "core",
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
<li>Model load and store bandwidth in bytes, not instructions; wide vectors usually hit the L1 or L2 bandwidth bound before the FMA bound (see the bytes-per-cycle rows on <a href="#/perf-stage-stalls/mem-bounds">Memory Bounds</a>).</li>
<li>Include the frequency behavior of the part being modeled.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (data-level parallelism in vector, SIMD, and GPU architectures) · Stephens et al., "The ARM Scalable Vector Extension," IEEE Micro, 2017 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> · RISC-V International, <em>RISC-V "V" Vector Extension</em>, version 1.0</p>`,
  practice: {
    guided: [
      {
        q: `<p>70% of a program's run time is in loops that vectorize perfectly with 8 lanes, and the rest stays scalar. What is the speedup? If running the vector code also lowers the clock by 10% for the whole program, what is it then?</p>`,
        a: `<ol start="0"><li>Amdahl: speedup = 1 / (0.3 + 0.7 / 8) = 1 / (0.3 + 0.0875) = 1 / 0.3875 ≈ <strong>2.58×</strong>.</li><li>With a 10% lower clock everywhere: 2.58 × 0.9 ≈ <strong>2.32×</strong>.</li><li>Even perfect 8-lane vectors give well under 8×: the 30% that stays scalar becomes 77% of the new run time (0.3 / 0.3875).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A dot product of two 1 GB double-precision arrays runs on a core with two 512-bit FMA units at 3 GHz, and the core can draw about 15 GB/s from DRAM. Is the FMA width worth anything here? What would make it matter?</p>`,
        a: `<p>Each element pair is 16 bytes and gives one FMA (2 FLOPs). At 15 GB/s, the core gets about 0.94 billion pairs per second, about 1.9 GFLOP/s. The FMA units could do 32 double-precision FLOPs per cycle × 3 GHz = 96 GFLOP/s. The loop uses about 2% of the compute: it's entirely memory-bound, and 128-bit vectors would run it at the same speed. The width matters only when arithmetic intensity rises: data that fits in L1 or L2, or reuse such as a matrix multiply that loads each element once and uses it many times. Then the bound becomes the load ports and L1 bandwidth (two 512-bit loads per cycle feeds exactly one FMA's worth per cycle without reuse), and finally the FMA units.</p>`
      }
    ]
  }
},

{
  id: "side-channels",
  region: "core",
  title: "Speculative Side Channels",
  sections: [
    { id: "channel", label: "Timing Channels Through the Cache" },
    { id: "transient", label: "Transient Execution" },
    { id: "variants", label: "The Main Variants" },
    { id: "mitigations", label: "Mitigations and What They Cost" },
    { id: "design", label: "Designing for It" }
  ],
  body: `
<p>Speculation is architecturally invisible: squashed instructions never change registers or memory. But they do change <em>microarchitectural</em> state, such as which lines are in the cache, and that state can be measured by timing. Since 2018, this gap has been the source of a family of vulnerabilities that changed how cores are designed and added real costs that performance models must include.</p>

<h3 id="sec-channel">Timing Channels Through the Cache</h3>
<p>A cache hit and a miss differ by hundreds of cycles, which a program can measure with a cycle counter. That makes the cache a channel: whether a line is cached encodes a bit. The standard techniques:</p>
<ul>
<li><strong>Flush+Reload:</strong> with memory shared between two parties (a shared library page, for example), flush a line, wait, then time a reload. Fast means someone touched it.</li>
<li><strong>Prime+Probe:</strong> without shared memory, fill a cache set with your own lines, wait, then time re-accessing them. Slow means someone else's line evicted one of yours.</li>
</ul>
<p>On their own, these leak access patterns of code that touches memory based on secrets (the reason crypto code is written to be constant-time). Combined with speculation, they leak data the program never architecturally reads.</p>

<h3 id="sec-transient">Transient Execution</h3>
<p>The general pattern (Kocher et al., 2019; Lipp et al., 2018):</p>
<ol start="0">
<li>The core speculates past something: a predicted branch, a predicted target, an access whose permission check finishes later.</li>
<li>On the wrong path, an instruction reads a value the program isn't allowed to use.</li>
<li>A dependent load uses that value to form an address, bringing a value-dependent line into the cache.</li>
<li>The speculation is squashed and the registers are restored, but the cache line stays.</li>
<li>A timing measurement recovers which line was loaded, and so the value.</li>
</ol>
<p>Each step is a normal performance feature. The flaw is only in the combination.</p>

<h3 id="sec-variants">The Main Variants</h3>
<div class="tbl"><table>
<tr><th>Variant</th><th>What is speculated</th><th>Related page</th></tr>
<tr><td>Spectre v1, bounds check bypass</td><td>A conditional branch guarding an array index is predicted "in bounds" when it isn't</td><td><a href="#/fe-direction">Branch Direction Predictors</a></td></tr>
<tr><td>Spectre v2, branch target injection</td><td>An indirect branch's target, from predictor entries trained by another context</td><td><a href="#/fe-targets/indirect">Indirect Branches</a></td></tr>
<tr><td>Return-based variants (Retbleed, Inception)</td><td>Return targets from the return stack or BTB</td><td><a href="#/fe-targets/ras">The Return Address Stack</a></td></tr>
<tr><td>Meltdown, rogue data cache load</td><td>A load from kernel memory forwards its data to dependents before the permission fault is taken (on affected cores)</td><td><a href="#/tlb">TLBs and Page Walks</a></td></tr>
<tr><td>Spectre v4, speculative store bypass</td><td>A load predicted not to alias an older store reads stale data</td><td><a href="#/mdp">Memory Dependence Prediction</a></td></tr>
<tr><td>Microarchitectural data sampling (MDS) and relatives</td><td>Faulting or assisted loads forward stale data from fill buffers, store buffers, or load ports</td><td><a href="#/dcache">Data Cache</a></td></tr>
</table></div>

<h3 id="sec-mitigations">Mitigations and What They Cost</h3>
<ul>
<li><strong>Kernel page-table isolation (KPTI):</strong> the kernel is unmapped while user code runs, so a Meltdown-style load has nothing to read. Each system call and interrupt switches page tables; with PCID-tagged TLBs the cost is a few hundred cycles per entry and exit, without them a TLB flush too. Cores fixed in hardware don't need it.</li>
<li><strong>Speculation barriers and index masking</strong> for Spectre v1: an <code>lfence</code> after a bounds check (serializing, tens of cycles) or, more cheaply, masking the index so a mispredicted path can only reach in-bounds memory.</li>
<li><strong>Retpolines and hardware controls</strong> for Spectre v2: replacing indirect branches with a construct the predictor can't steer, or hardware modes (enhanced IBRS) that keep predictor entries from crossing privilege levels, plus predictor flushes (IBPB) on context switches between untrusted processes.</li>
<li><strong>Buffer clearing</strong> for MDS: overwriting the affected buffers on every kernel exit (<code>verw</code>), and on affected parts, disabling SMT where untrusted threads could share a core.</li>
<li><strong>Speculative store bypass disable:</strong> turning off memory dependence prediction for a process, so loads wait for older store addresses.</li>
</ul>
<p>The costs land unevenly: system-call-heavy and context-switch-heavy workloads (databases, networking, virtualization) pay the most; compute loops pay almost nothing. A performance model that omits the mitigations the deployed system will use mispredicts exactly those workloads.</p>

<h3 id="sec-design">Designing for It</h3>
<ul>
<li><strong>Close specific paths in hardware:</strong> newer cores check permissions before forwarding loaded data, tag predictor entries by privilege level and context, and clear buffers on domain changes.</li>
<li><strong>Restrict what speculative instructions can do:</strong> research designs such as speculative taint tracking (Yu et al., 2019) let speculative loads execute but block their results from forming new addresses until the speculation resolves, at a modest IPC cost.</li>
<li><strong>Treat the predictor and caches as shared state:</strong> partitioning or flushing them between security domains is now a design requirement, and its cost belongs in the performance model like any other.</li>
</ul>
<p class="refs">References: Kocher et al., "Spectre Attacks: Exploiting Speculative Execution," IEEE S&amp;P 2019 · Lipp et al., "Meltdown: Reading Kernel Memory from User Space," USENIX Security 2018 · Yarom and Falkner, "FLUSH+RELOAD: A High Resolution, Low Noise, L3 Cache Side-Channel Attack," USENIX Security 2014 · Yu et al., "Speculative Taint Tracking (STT)," MICRO 2019</p>`,
  practice: {
    guided: [
      {
        q: `<p>A timing experiment reloads one line per measurement: about 45 cycles when the line is in L3 and 320 when it comes from DRAM, on a 4 GHz core. Each measurement also needs a flush (about 100 cycles) and a 2,000-cycle wait. Where should the hit/miss threshold go, and how many bits per second can this channel carry?</p>`,
        a: `<ol start="0"><li>Threshold: between the two clusters, with margin for noise on both sides; the midpoint is (45 + 320) / 2 ≈ <strong>180 cycles</strong>. In practice it is set from a histogram of measured hits and misses.</li><li>Time per bit: 100 + 2,000 + up to 320 ≈ 2,420 cycles.</li><li>Rate: 4 × 10<sup>9</sup> / 2,420 ≈ <strong>1.65 million bits per second</strong>, before error correction.</li><li>This is why these channels matter: even with large overheads, a timing channel moves data fast enough to leak keys or memory contents in seconds.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A database server makes about 300,000 system calls per second per core on a 3 GHz part that needs KPTI. Each kernel entry and exit adds about 400 cycles with PCID support, and about 1,500 without (TLB refills included). Estimate the overhead both ways. What would you tell a team modeling this server's next-generation core?</p>`,
        a: `<p>With PCID: 300,000 × 400 = 120 million cycles per second, <strong>4%</strong> of 3 billion. Without: 300,000 × 1,500 = 450 million, <strong>15%</strong>. For the modeling team: system-call and interrupt rates, and the mitigations active on the deployed system, are workload parameters as important as cache miss rates for this server. If the new core fixes Meltdown in hardware, KPTI can be turned off and that 4 to 15% comes back, which may be worth more than many microarchitectural features; the model should include it explicitly, and the benchmarks should run with the mitigation settings customers will use.</p>`
      }
    ]
  }
}
]);
