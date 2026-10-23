/* Section: Out-of-order core
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "core"). */

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
<tr><td>FPU / FMA</td><td>FP add, multiply, fused multiply-add</td><td>3–5 cycles</td><td>Pipelined; large area</td></tr>
<tr><td>FP divide/sqrt</td><td>Division, square root</td><td>~10–30 cycles</td><td>Iterative</td></tr>
<tr><td>Vector / SIMD</td><td>Same op on many lanes</td><td>Like scalar FP</td><td>Area and power scale with width</td></tr>
<tr><td>Load unit (LDU)</td><td>Address generation + L1D access</td><td>~4–5 cycles load-to-use</td><td>Also searches the SQ</td></tr>
<tr><td>Store unit (STU)</td><td>Store address and store data</td><td>Writes the SQ</td><td>Address and data often split into separate ports</td></tr>
</table></div>
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
}
]);
