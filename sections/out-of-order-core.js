/* Section: Out-of-order core
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "core"). */

section({
  id: "core",
  name: "Out-of-Order Core",
  cap: "Renaming, the window, retirement, recovery",
  sections: [
    { id: "pipeline-pass", label: "The Pipeline in One Pass" },
    { id: "questions-that-matter", label: "The Questions That Matter" }
  ],
  body: `
<p>An out-of-order core fetches and decodes in order, executes in dataflow order, and commits in order. The middle of the pipeline is where the performance lives. This region covers the window itself: renaming, the reorder buffer, and recovery. Scheduling and execution have their own region, <a href="#/r/sched">Scheduling and Execution</a>, and the load and store queues are in <a href="#/r/mdep">Memory Ordering</a>.</p>
<h3 id="sec-pipeline-pass">The Pipeline in One Pass</h3>
<ol>
<li><strong>Fetch and decode:</strong> branch prediction steers fetch; instructions are decoded (and on some ISAs cracked into micro-ops).</li>
<li><strong>Rename:</strong> architectural registers map to physical registers, removing false dependences.</li>
<li><strong>Dispatch:</strong> each instruction gets a ROB entry, an issue queue entry, and an LQ or SQ entry if it touches memory. Running out of any of these stalls dispatch.</li>
<li><strong>Issue and execute:</strong> ready instructions are picked and sent to functional units.</li>
<li><strong>Writeback:</strong> results are written and dependents woken.</li>
<li><strong>Commit:</strong> instructions retire in order from the ROB head; stores drain to the cache after this.</li>
</ol>
<h3 id="sec-questions-that-matter">The Questions That Matter</h3>
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
        q: `<p>A dot product runs on Zen 2 (FMA latency 5 cycles, 2 FMA pipes) with 4 independent accumulators, all data in L1. The code uses AVX2, which has 16 YMM registers. What FMA throughput does it reach on an in-order and on an out-of-order version of the core? How many accumulators would reach peak?</p>`,
        a: `<ol><li>Each accumulator is a chain with one FMA every 5 cycles, so 4 chains give at most 4 / 5 = <strong>0.8 FMAs per cycle</strong>.</li><li>That's a dependence bound, so it holds for both cores. The out-of-order core finds no extra independent FMAs, since every FMA is on one of the 4 chains.</li><li>Peak is 2 per cycle, so the kernel reaches 40% of it on either core.</li><li>To reach peak: accumulators ≥ pipes × latency = 2 × 5 = <strong>10</strong>. That fits in AVX2's 16 YMM registers with room left for operands.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An integer loop has independent iterations of 8 instructions, one of which is a load. At 4-wide, with no stalls, one iteration takes 2 cycles. The compiler software-pipelined it so each load's consumer issues 4 cycles after the load, matching Zen 4's L1 load-to-use latency. 30% of the loads, at unpredictable points, hit in L2 instead (14 cycles). Estimate cycles per iteration on an in-order core and on Zen 4's out-of-order core (320-entry ROB).</p>`,
        a: `<p><strong>In-order:</strong> an L2 hit makes the consumer wait 14 − 4 = 10 extra cycles, and everything behind it waits too. Average: 2 + 0.3 × 10 = <strong>5 cycles per iteration</strong>.</p><p><strong>Out-of-order:</strong> by Little's law, hiding 14 cycles at IPC 4 takes a window of about 4 × 14 = 56 instructions, or 7 iterations, far below 320. About 7 × 0.3 ≈ 2 L2 hits are in flight at a time, well within the miss-handling resources. So the misses overlap with independent work and the loop runs close to <strong>2 cycles per iteration</strong>.</p><p>That's a 2.5× gap from a modest, unpredictable latency. The same loop with all loads hitting L1 would run at 2 cycles per iteration on both cores. The out-of-order core's advantage comes entirely from latency the compiler couldn't plan for.</p>`
      }
    ]
  }
},

{
  id: "renaming",
  region: "core",
  title: "Register Renaming",
  sections: [
    { id: "pieces", label: "Pieces" },
    { id: "lifecycle-mapping", label: "Lifecycle of a Mapping" },
    { id: "free-at-rename", label: "Why Not Free at Rename" },
    { id: "rat-hardware", label: "The RAT in Hardware" },
    { id: "same-group", label: "Same-Group Dependences" },
    { id: "rat-cost", label: "What Renaming Costs" },
    { id: "recovery", label: "Recovery" },
    { id: "limits", label: "What Limits It" }
  ],
  body: `
<p>Programs reuse a small set of architectural registers, which creates false dependences: write-after-read (WAR) and write-after-write (WAW). Renaming gives every destination a fresh physical register, so only true read-after-write (RAW) dependences remain.</p>
<h3 id="sec-pieces">Pieces</h3>
<ul><li><strong>Register alias table (RAT):</strong> maps each architectural register to its current physical register.</li><li><strong>Free list:</strong> physical registers available for new destinations.</li><li><strong>Retirement RAT:</strong> the committed, non-speculative mapping.</li></ul>
<h3 id="sec-lifecycle-mapping">Lifecycle of a Mapping</h3>
<p>At rename, sources read the RAT, the destination takes a register from the free list, and the <em>previous</em> mapping is saved in the ROB entry. At commit, that previous register is freed, because no instruction younger than this one can still name it. The next section explains why it can't be freed any sooner.</p>
<h3 id="sec-free-at-rename">Why Not Free at Rename</h3>
<p>When I2 renames r1 from p7 to p40, every instruction renamed after I2 reads r1 as p40, so no new instruction will ever name p7 again. It's tempting to put p7 back on the free list right away. It can't go yet, because two things can still need its value until I2 commits:</p>
<ol>
<li><strong>Older readers.</strong> Instructions between p7's producer and I2 were renamed with p7 as a source and may not have issued yet. If p7 goes back on the free list, a younger instruction can pop it and write it first. p7's ready bit then wakes the older reader with the wrong value. When the original producer finally writes p7, it also clobbers the new owner's value.</li>
<li><strong>Recovery.</strong> If a branch older than I2 mispredicts, the RAT goes back to r1→p7. The same happens if I2 or anything older faults. The restored mapping is only useful if p7 still holds r1's old value. Precise exceptions depend on this: the handler must see r1 as it was before I2.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="Cycle timeline of four instructions when p7 is freed as soon as I2 renames r1. I0, ld r1 from [r6], has destination p7. It renames in cycle 0 and misses in the L1, so its data comes back from the L2 and it writes p7 in cycle 16. I1, add r2 = r1 + 1, reads p7. It renames in cycle 0 and waits for p7. I2, mul r1 = r3 times 2, renames in cycle 0 to p40 and, in this broken design, puts p7 on the free list. I3, add r4 = r5 + 1, renames in cycle 2, pops p7, executes in cycle 3, and writes p7 in cycle 4. That write sets p7 ready, so I1 wakes and reads p7 in cycle 5, getting I3's value instead of the load's, though it should have read in cycle 17. In cycle 16 the load writes p7 too, so I3's own consumers now read the load's value.">
<defs><marker id="arrFR1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--accent-red)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Freeing p7 when I2 renames: a younger instruction reuses it</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M160,52 V222"/><path d="M188,52 V222"/><path d="M216,52 V222"/><path d="M244,52 V222"/><path d="M272,52 V222"/><path d="M300,52 V222"/><path d="M328,52 V222"/><path d="M356,52 V222"/><path d="M384,52 V222"/><path d="M412,52 V222"/><path d="M440,52 V222"/><path d="M468,52 V222"/><path d="M496,52 V222"/><path d="M524,52 V222"/><path d="M552,52 V222"/><path d="M580,52 V222"/><path d="M608,52 V222"/><path d="M636,52 V222"/><path d="M664,52 V222"/>
</g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="174" y="44">0</text><text x="202" y="44">1</text><text x="230" y="44">2</text><text x="258" y="44">3</text><text x="286" y="44">4</text><text x="314" y="44">5</text><text x="342" y="44">6</text><text x="370" y="44">7</text><text x="398" y="44">8</text><text x="426" y="44">9</text><text x="454" y="44">10</text><text x="482" y="44">11</text><text x="510" y="44">12</text><text x="538" y="44">13</text><text x="566" y="44">14</text><text x="594" y="44">15</text><text x="622" y="44">16</text><text x="650" y="44">17</text>
</g>
<text x="152" y="44" text-anchor="end" style="fill:var(--muted);font-size:10px">cycle</text>
<g style="stroke-width:1.5">
<rect x="160" y="56" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="188" y="56" width="420" height="30" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="608" y="56" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="160" y="100" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="188" y="100" width="112" height="30" style="fill:none;stroke:var(--muted);stroke-dasharray:4 3"/>
<rect x="300" y="100" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="636" y="100" width="28" height="30" style="fill:none;stroke:var(--accent-green);stroke-width:2;stroke-dasharray:4 3"/>
<rect x="160" y="144" width="28" height="30" style="fill:var(--surface);stroke:var(--accent-red);stroke-width:2"/>
<rect x="216" y="188" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="244" y="188" width="28" height="30" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="272" y="188" width="28" height="30" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
</g>
<path d="M286,188 C286,162 314,160 314,134" marker-end="url(#arrFR1)" style="fill:none;stroke:var(--accent-red);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)">
<text x="10" y="69">I0 ld r1,[r6]</text><text x="10" y="113">I1 add r2,r1,1</text><text x="10" y="157">I2 mul r1,r3,2</text><text x="10" y="201">I3 add r4,r5,1</text>
</g>
<g style="fill:var(--muted);font-size:10px">
<text x="10" y="82">dest p7</text><text x="10" y="126">src p7</text><text x="10" y="170">dest p40, old p7</text><text x="10" y="214">dest p7 (reused)</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle">
<text x="174" y="75">R</text><text x="622" y="75">W</text>
<text x="174" y="119">R</text><text x="314" y="119">rd</text><text x="650" y="119">rd</text>
<text x="174" y="163">R</text>
<text x="230" y="207">R</text><text x="258" y="207">X</text><text x="286" y="207">W</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="398" y="75">load in flight (L1 miss, L2 hit)</text>
<text x="244" y="119">wait</text>
</g>
<text x="630" y="119" text-anchor="end" style="fill:var(--accent-green);font-size:10px">should read here</text>
<text x="196" y="163" style="fill:var(--accent-red);font-size:11px">r1 → p40, and p7 goes on the free list ✗</text>
<text x="312" y="207" style="fill:var(--muted);font-size:11px">pops p7 in cycle 2 and writes it in cycle 4</text>
<g style="fill:var(--accent-red);font-size:11px">
<text x="10" y="244">✗ Cycle 4: I3's write sets p7 ready, so I1 wakes and reads I3's value, not the load's.</text>
<text x="10" y="262">✗ Cycle 16: the load writes p7 too, so I3's own consumers now read the load's value.</text>
</g>
<text x="10" y="286" style="fill:var(--muted);font-size:10px">R rename · X execute · W write p7 · rd read p7</text>
</svg></div>
<p>The second case needs no slow load. Here I0 has already written p7, and the branch I1 is predicted not taken but is really taken, so I2 and I3 are on the wrong path:</p>
<pre><code>I0: add r1, r2, r3    # r1 → p7, writes 5
I1: beq r4, r0, L     # predicted not taken, actually taken
I2: mul r1, r3, 2     # r1 → p40, old mapping p7
I3: ld  r5, [r6]      # wrong path</code></pre>
<div class="tbl"><svg viewBox="0 0 680 276" role="img" aria-label="Three snapshots of the RAT, the physical registers, and the free list when p7 is freed at rename and a branch then mispredicts. Snapshot 1, I2 renames r1: the RAT maps r1 to p40, p7 holds 5, p40 has no value yet, and the ROB entry of I2 saves old mapping p7. Snapshot 2, p7 freed at rename: the wrong-path load I3 pops p7 from the free list and writes 0x3F00 into it. Snapshot 3, the branch was taken, so recovery restores r1 to p7, but p7 now holds 0x3F00 and r1's real value, 5, is gone. With free at commit, I2 is squashed and never commits, so p7 is never freed, still holds 5 after the restore, and only p40 goes back to the free list.">
<defs><marker id="arrFR2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Freeing p7 at rename, then the branch mispredicts</text>
<g style="stroke-width:1.5">
<rect x="10" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="235" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="460" y="30" width="210" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
</g>
<g style="stroke-width:1;fill:var(--surface);stroke:var(--rule)">
<rect x="60" y="64" width="150" height="22"/><rect x="60" y="98" width="150" height="22"/><rect x="60" y="122" width="150" height="22"/><rect x="60" y="156" width="150" height="22"/>
<rect x="285" y="64" width="150" height="22"/><rect x="285" y="122" width="150" height="22"/><rect x="285" y="156" width="150" height="22"/>
<rect x="510" y="122" width="150" height="22"/><rect x="510" y="156" width="150" height="22"/>
</g>
<rect x="285" y="98" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<rect x="510" y="64" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="510" y="98" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:2"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M221,126 H233" marker-end="url(#arrFR2)"/><path d="M446,126 H458" marker-end="url(#arrFR2)"/>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600">
<text x="20" y="50">1. I2 renames r1</text>
<text x="245" y="50" style="fill:var(--accent-red)">2. p7 freed at rename ✗</text>
<text x="470" y="50">3. beq was taken: undo</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="20" y="79">RAT</text><text x="20" y="113">PRF</text><text x="20" y="171">free</text>
<text x="245" y="79">RAT</text><text x="245" y="113">PRF</text><text x="245" y="171">free</text>
<text x="470" y="79">RAT</text><text x="470" y="113">PRF</text><text x="470" y="171">free</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="135" y="79">r1 → p40</text><text x="135" y="113">p7 = 5</text><text x="135" y="137">p40 = (not yet)</text><text x="135" y="171">p41, p42, …</text>
<text x="360" y="79">r1 → p40</text><text x="360" y="113" style="fill:var(--accent-red);font-weight:600">p7 = 0x3F00</text><text x="360" y="137">p40 = 10</text><text x="360" y="171">p7 popped by I3</text>
<text x="585" y="79" style="font-weight:600">r1 → p7 (restored)</text><text x="585" y="113" style="fill:var(--accent-red);font-weight:600">p7 = 0x3F00 ✗</text><text x="585" y="137">p40 freed</text><text x="585" y="171">p40, p41, …</text>
</g>
<g style="fill:var(--muted);font-size:10px">
<text x="20" y="198">ROB entry of I2 saves old = p7</text><text x="20" y="212">beq predicted not taken</text>
<text x="245" y="198">wrong-path I3 pops p7</text><text x="245" y="212">and writes 0x3F00 into it</text>
<text x="470" y="198">r1 should read 5, but that</text><text x="470" y="212">value is gone</text>
</g>
<text x="10" y="246" style="fill:var(--accent-green);font-size:11px;font-weight:600">✓ Free at commit: I2 is squashed and never commits, so p7 is never freed.</text>
<text x="10" y="264" style="fill:var(--muted);font-size:11px">p7 still holds 5 when the RAT goes back to r1 → p7, and only p40 returns to the free list.</text>
</svg></div>
<p>Both needs are gone once I2 commits. Every older instruction has committed by then, so every older reader has read p7. A committed instruction can't be squashed, so nothing will restore r1→p7. The ROB entry holds p7 until then. Rename reads the old mapping (the extra W RAT read ports counted below) and stores it in the entry, and commit pushes it onto the free list.</p>
<div class="tbl"><svg viewBox="0 0 680 212" role="img" aria-label="Lifetime of p7 on a time axis. I0 renames and p7 is allocated, then I0 writes p7. Until I2 renames r1 to p40, the RAT names p7. After that, only older readers and rollback still need it. I1, the last older reader, reads p7. Later I2 completes and every older branch has resolved, so I2 can no longer be squashed. Then I2 commits. Freeing at I2's rename is too early. Early-release schemes free p7 once both the last read and the no-squash point have passed, which needs per-register reader counts. Freeing at I2's commit is what most cores do.">
<defs><marker id="arrFR3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">Lifetime of p7</text>
<rect x="50" y="80" width="250" height="20" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="300" y="80" width="320" height="20" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:10px" text-anchor="middle">
<text x="175" y="94">the RAT names p7</text>
<text x="460" y="94">only older readers and rollback need it</text>
</g>
<path d="M30,110 H660" marker-end="url(#arrFR3)" style="fill:none;stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1">
<path d="M50,60 V114"/><path d="M150,60 V114"/><path d="M300,60 V114"/><path d="M420,60 V114"/><path d="M520,60 V114"/><path d="M620,60 V114"/>
</g>
<g style="fill:var(--ink);font-size:10px" text-anchor="middle">
<text x="50" y="40">I0 renames</text><text x="50" y="54">p7 allocated</text>
<text x="150" y="40">I0 writes</text><text x="150" y="54">p7</text>
<text x="300" y="40">I2 renames</text><text x="300" y="54">r1 → p40</text>
<text x="420" y="40">I1 reads p7</text><text x="420" y="54">(last reader)</text>
<text x="520" y="40">I2 can't be</text><text x="520" y="54">squashed</text>
<text x="620" y="40">I2</text><text x="620" y="54">commits</text>
</g>
<text x="652" y="128" text-anchor="end" style="fill:var(--muted);font-size:10px">time</text>
<path d="M300,150 V116" marker-end="url(#arrFR1)" style="fill:none;stroke:var(--accent-red);stroke-width:1.5"/>
<path d="M520,150 V116" marker-end="url(#arrFR3)" style="fill:none;stroke:var(--muted);stroke-width:1.5"/>
<path d="M620,150 V116" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<path d="M614,124 L620,116 L626,124" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="font-size:10px" text-anchor="middle">
<text x="300" y="166" style="fill:var(--accent-red);font-weight:600">free at rename ✗</text><text x="300" y="180" style="fill:var(--accent-red)">too early</text>
<text x="520" y="166" style="fill:var(--muted);font-weight:600">early release</text><text x="520" y="180" style="fill:var(--muted)">needs reader counts</text>
<text x="620" y="166" style="fill:var(--accent-green);font-weight:600">free at commit ✓</text><text x="620" y="180" style="fill:var(--accent-green)">what most cores do</text>
</g>
</svg></div>
<p>Commit is a safe point, not the earliest one. The earliest is when the last older reader has read p7 <em>and</em> I2 can no longer be squashed, whichever comes later. Early-release schemes aim for that point. They keep a per-register count of pending readers and check that the overwriting instruction is non-speculative (Moudgill, Pingali, and Vassiliadis, 1993, and Ergin et al., 2004). That lowers register pressure, but the counters and the extra recovery cases cost area and verification effort. Most cores free at commit and buy a larger PRF instead.</p>
<h3 id="sec-rat-hardware">The RAT in Hardware</h3>
<p>Rename handles a group of W instructions per cycle (W is the rename width). For each instruction it must do three things in the same cycle:</p>
<ol><li>Look up the physical register for each source.</li><li>Look up the current mapping of the destination, so the ROB entry can save it as the "previous" register to free at commit.</li><li>Pop a physical register from the free list and write the new mapping for the destination.</li></ol>
<p>There are two ways to build the table.</p>
<ul>
<li><strong>SRAM (indexed) RAT:</strong> one entry per architectural register, holding a physical register number of ⌈log₂(PRF size)⌉ bits. A source lookup is a plain read indexed by the architectural register number. The MIPS R10000 and most current cores work this way.</li>
<li><strong>CAM RAT:</strong> one entry per <em>physical</em> register, holding the architectural register it currently names plus a valid bit. A lookup searches every entry for a valid match, and the matching row number is the physical register. Renaming a destination sets the new row's valid bit and clears the old row's. The Alpha 21264 used this form. A checkpoint is only the vector of valid bits (one bit per physical register), which is cheap, but the search width grows with the physical register file, so it stopped scaling once PRFs reached hundreds of entries.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 270" role="img" aria-label="SRAM RAT lookup. The table has one row per architectural register, r0 to r15, each holding a physical register number: r0 holds p3, r1 p7, r2 p8, r3 p9, r4 p10, r5 p11, and r15 p30. Slot source r3 goes into a decoder, which raises the word line for row r3. The row is read out and the source is renamed to p9. The table is 16 rows of 8 bits for a 192-entry PRF, and a checkpoint copies all of it.">
<defs><marker id="arrRS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="105" width="80" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="110" y="36" width="50" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="200" y="36" width="130" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="201" y="109" width="128" height="22" style="fill:var(--trace-soft);stroke:none"/>
<rect x="400" y="105" width="70" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M200,60 H330"/><path d="M200,84 H330"/><path d="M200,108 H330"/><path d="M200,132 H330"/><path d="M200,156 H330"/><path d="M200,180 H330"/><path d="M200,204 H330"/><path d="M240,36 V228"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M90,120 H108" marker-end="url(#arrRS)"/>
<path d="M160,120 H198" marker-end="url(#arrRS)"/>
<path d="M330,120 H398" marker-end="url(#arrRS)"/>
</g>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">SRAM RAT: one row per architectural register</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="220" y="52">r0</text><text x="220" y="76">r1</text><text x="220" y="100">r2</text><text x="220" y="124">r3</text><text x="220" y="148">r4</text><text x="220" y="172">r5</text><text x="220" y="196">⋮</text><text x="220" y="220">r15</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="285" y="52">p3</text><text x="285" y="76">p7</text><text x="285" y="100">p8</text><text x="285" y="124" style="font-weight:600">p9</text><text x="285" y="148">p10</text><text x="285" y="172">p11</text><text x="285" y="196">⋮</text><text x="285" y="220">p30</text>
<text x="50" y="124">src r3</text>
<text x="435" y="124" style="font-weight:600">p9</text>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="135" y="124" style="font-weight:600">dec</text>
<text x="365" y="112">read</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="180" y="110" text-anchor="middle" style="font-size:9px">word line</text>
<text x="200" y="248">16 rows × 8 bits = 128 bits (192-entry PRF)</text>
<text x="200" y="264">checkpoint: copy all 128 bits</text>
<text x="490" y="102">lookup = one indexed read</text>
<text x="490" y="118">rename dest = write the row</text>
<text x="490" y="134">old value of the row goes</text>
<text x="490" y="150">to the ROB as "previous"</text>
</g>
</svg></div>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="CAM RAT lookup. The table has one row per physical register, p0 to p191, each holding an architectural register name and a valid bit. Rows shown: p0 holds r0 valid, p7 holds r1 not valid, p8 holds r2 valid, p9 holds r3 valid, p40 holds r1 valid, and p191 is free and not valid. Slot source r1 is broadcast to every row. Only p40 matches, because p7 also names r1 but its valid bit is clear. An encoder turns the one-hot match lines into the row number p40. Renaming r1 to p40 set the valid bit of p40 and cleared the valid bit of p7. The valid column, 192 bits, is the whole checkpoint, and every lookup compares all 192 rows.">
<defs><marker id="arrRC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="121" width="80" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="150" y="40" width="180" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="151" y="161" width="178" height="22" style="fill:var(--trace-soft);stroke:none"/>
<rect x="370" y="40" width="50" height="192" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="460" y="121" width="70" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M150,64 H330"/><path d="M150,88 H330"/><path d="M150,112 H330"/><path d="M150,136 H330"/><path d="M150,160 H330"/><path d="M150,184 H330"/><path d="M150,208 H330"/>
<path d="M190,40 V232"/><path d="M240,40 V232"/><path d="M270,40 V232"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M90,136 H110"/><path d="M110,52 V220"/>
<path d="M110,52 H148" marker-end="url(#arrRC)"/><path d="M110,76 H148" marker-end="url(#arrRC)"/><path d="M110,100 H148" marker-end="url(#arrRC)"/><path d="M110,124 H148" marker-end="url(#arrRC)"/><path d="M110,172 H148" marker-end="url(#arrRC)"/><path d="M110,220 H148" marker-end="url(#arrRC)"/>
<path d="M330,52 H368" marker-end="url(#arrRC)"/><path d="M330,76 H368" marker-end="url(#arrRC)"/><path d="M330,100 H368" marker-end="url(#arrRC)"/><path d="M330,124 H368" marker-end="url(#arrRC)"/><path d="M330,220 H368" marker-end="url(#arrRC)"/>
<path d="M420,136 H458" marker-end="url(#arrRC)"/>
</g>
<path d="M330,172 H368" marker-end="url(#arrRC)" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<text x="10" y="18" style="fill:var(--pad);font-size:12px;font-weight:600">CAM RAT: one row per physical register</text>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="170" y="34">row</text><text x="215" y="34">arch</text><text x="255" y="34">v</text><text x="300" y="34">match</text>
</g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="170" y="56">p0</text><text x="170" y="80">p7</text><text x="170" y="104">p8</text><text x="170" y="128">p9</text><text x="170" y="152">⋮</text><text x="170" y="176">p40</text><text x="170" y="200">⋮</text><text x="170" y="224">p191</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="215" y="56">r0</text><text x="215" y="80">r1</text><text x="215" y="104">r2</text><text x="215" y="128">r3</text><text x="215" y="152">⋮</text><text x="215" y="176" style="font-weight:600">r1</text><text x="215" y="200">⋮</text><text x="215" y="224">–</text>
<text x="255" y="56">1</text><text x="255" y="80">0</text><text x="255" y="104">1</text><text x="255" y="128">1</text><text x="255" y="152">⋮</text><text x="255" y="176" style="font-weight:600">1</text><text x="255" y="200">⋮</text><text x="255" y="224">0</text>
<text x="300" y="56">0</text><text x="300" y="80">0</text><text x="300" y="104">0</text><text x="300" y="128">0</text><text x="300" y="152">⋮</text><text x="300" y="176" style="font-weight:600">1</text><text x="300" y="200">⋮</text><text x="300" y="224">0</text>
<text x="50" y="140">src r1</text>
<text x="495" y="140" style="font-weight:600">p40</text>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="395" y="140" style="font-weight:600">enc</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="104" y="44" text-anchor="end">broadcast</text>
<text x="545" y="124">rename r1 → p40:</text>
<text x="545" y="140">set p40 v, clear p7 v</text>
<text x="150" y="252">v column = 192 bits = the whole checkpoint</text>
<text x="150" y="268">every lookup compares all 192 rows</text>
<g style="font-size:10px"><text x="10" y="176">p7 also names r1</text>
<text x="10" y="190">but its v = 0, so</text>
<text x="10" y="204">it doesn't match</text></g>
</g>
</svg></div>
<p>Port count for an SRAM RAT with two sources per instruction:</p>
<ul><li>Read ports: 2W for sources plus W for the destinations' old mappings, 3W in all.</li><li>Write ports: W, one per new destination mapping.</li></ul>
<p>A 4-wide renamer therefore needs a 12-read, 4-write table. The table itself is tiny (16 x86-64 integer registers × 8 bits for a 192-entry PRF = 128 bits), but those 16 ports dominate the cell, and the free list must also hand out W registers per cycle.</p>
<h3 id="sec-same-group">Same-Group Dependences</h3>
<p>The RAT is read at the start of the cycle and written at the end. If slot 0 of a group writes r1 and slot 2 reads r1, the RAT read for slot 2 returns r1's mapping from <em>before</em> the group, which is stale. The renamer fixes this with comparisons on architectural register names, which are known right after decode, so they run in parallel with the RAT read.</p>
<p>Take this group, with r1→p7, r2→p8, r3→p9, r4→p10, r5→p11, r6→p12 in the RAT and p40 to p43 at the head of the free list:</p>
<pre><code>slot 0: r1 = r2 + r3     new dest p40
slot 1: r4 = r1 + r5     new dest p41
slot 2: r1 = r4 + r1     new dest p42
slot 3: r6 = r1 + r2     new dest p43</code></pre>
<p>Each slot's free-list register is known at the start of the cycle (the free list pops W at once), so the comparisons only have to pick which one to use.</p>
<ol>
<li><strong>Source check (RAW inside the group).</strong> Each source of slot i is compared with the destination of every older slot 0 to i − 1. A priority selector picks the <em>youngest</em> older match, and a mux chooses that slot's new physical register over the RAT read. With no match, the RAT read wins. Slot 3's source r1 matches slot 0 and slot 2. The youngest is slot 2, so slot 3 reads p42, not p7 (stale) and not p40 (overwritten).</li>
<li><strong>Old-mapping check (for the ROB).</strong> The "previous" register saved in slot 2's ROB entry must be p40, the register slot 0 just gave r1, not p7 from the RAT. This uses the same destination-versus-older-destination compares. If slot 2 saved p7, p7 would be freed twice (once by slot 0's commit, once by slot 2's) and p40 would leak.</li>
<li><strong>Write check (WAW inside the group).</strong> Slot 0 and slot 2 both write r1 in the same cycle. Only the youngest writer may update the RAT, so slot 0's write enable is suppressed. Any slot whose destination matches a <em>younger</em> slot's destination is suppressed. The same comparator outputs serve this check and the old-mapping check, read in the other direction.</li>
</ol>
<p>After the group: slot 1 reads p40 and p11, slot 2 reads p41 and p40, slot 3 reads p42 and p8. The RAT ends with r1→p42, r4→p41, r6→p43, and the ROB saves old mappings p7, p10, p40, p12.</p>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="Same-group source check for slot 3. The rename group holds slot 0: r1 = r2 + r3 with new destination p40, slot 1: r4 = r1 + r5 with p41, slot 2: r1 = r4 + r1 with p42, and slot 3: r6 = r1 + r2 with p43. Slot 3's source r1 is compared with the destinations of slots 0, 1, and 2. Slots 0 and 2 match, slot 1 does not. A priority select picks slot 2, the youngest older match. A mux has four inputs: p40, p41, and p42 from the free list and p7 from the RAT read. The priority select drives the mux, which outputs p42 as slot 3's first source." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrRN" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="10" y="30" width="230" height="130" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="10" y="215" width="220" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="10" y="275" width="220" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="290" y="44" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="290" y="86" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="290" y="128" width="80" height="28" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="410" y="44" width="100" height="112" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<path d="M550,80 L600,105 L600,235 L550,260 Z" style="fill:var(--surface);stroke:var(--pad)"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M240,58 H288" marker-end="url(#arrRN)"/><path d="M240,100 H288" marker-end="url(#arrRN)"/><path d="M240,142 H288" marker-end="url(#arrRN)"/>
<path d="M370,58 H408" marker-end="url(#arrRN)"/><path d="M370,100 H408" marker-end="url(#arrRN)"/><path d="M370,142 H408" marker-end="url(#arrRN)"/>
<path d="M510,100 H575 V90" marker-end="url(#arrRN)"/>
<path d="M230,240 H548" marker-end="url(#arrRN)"/>
<path d="M230,300 H520 V120 H548" marker-end="url(#arrRN)"/><path d="M520,160 H548" marker-end="url(#arrRN)"/><path d="M520,200 H548" marker-end="url(#arrRN)"/>
<path d="M600,170 H650" marker-end="url(#arrRN)"/>
</g>
<text x="18" y="22" style="fill:var(--pad);font-size:12px;font-weight:600">Rename group</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)">
<text x="20" y="62">0: r1 = r2 + r3  p40</text>
<text x="20" y="90">1: r4 = r1 + r5  p41</text>
<text x="20" y="118">2: r1 = r4 + r1  p42</text>
<text x="20" y="146">3: r6 = r1 + r2  p43</text>
<text x="330" y="62" text-anchor="middle">r1 = r1?</text>
<text x="330" y="104" text-anchor="middle">r1 = r4?</text>
<text x="330" y="146" text-anchor="middle">r1 = r1?</text>
<text x="20" y="254">read r1 → p7</text>
<text x="20" y="314">pops p40 p41 p42 p43</text>
<text x="526" y="156">p40</text><text x="526" y="196">p41</text><text x="526" y="236">p42</text><text x="470" y="236">p7</text>
<text x="612" y="162">p42</text>
</g>
<g style="fill:var(--ink);font-size:12px">
<text x="20" y="234" style="font-weight:600">RAT (SRAM)</text>
<text x="20" y="294" style="font-weight:600">Free list</text>
<text x="460" y="80" text-anchor="middle" style="font-weight:600">Priority</text>
<text x="460" y="96" text-anchor="middle">youngest</text>
<text x="460" y="112" text-anchor="middle">older match</text>
<text x="460" y="136" text-anchor="middle">→ slot 2</text>
<text x="575" y="175" text-anchor="middle" style="font-weight:600">mux</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="290" y="36">slot 3 src r1 vs</text>
<text x="376" y="54">1</text><text x="376" y="96">0</text><text x="376" y="138">1</text>
<text x="250" y="54">s0</text><text x="250" y="96">s1</text><text x="250" y="138">s2</text>
<text x="604" y="186">slot 3 src</text>
</g>
</svg></div>
<h3 id="sec-rat-cost">What Renaming Costs</h3>
<p>Let W be the rename width, A the number of architectural registers, and P the PRF size.</p>
<ul>
<li><strong>RAT storage:</strong> A × ⌈log₂ P⌉ bits for an SRAM RAT, about P × (⌈log₂ A⌉ + 1) bits for a CAM RAT. Both are small. Storage is never the problem.</li>
<li><strong>RAT ports:</strong> 3W read plus W write. Cell area grows roughly with the square of the port count (each port adds a wordline and a bitline), so the RAT cell grows about as W². Going from 4-wide (16 ports) to 6-wide (24 ports) makes each cell about (24 ports / 16 ports)² ≈ 2.25× larger.</li>
<li><strong>Same-group comparators:</strong> each comparator is ⌈log₂ A⌉ bits wide.
<ul><li>Source checks: slot i compares each of its 2 sources with i older destinations, so 2 × (0 + 1 + … + (W − 1)) = W(W − 1) comparators.</li><li>Destination checks: one per pair of slots, W(W − 1)/2 comparators, shared by the old-mapping and WAW checks.</li><li>Total: 1.5 × W(W − 1). For a 4-wide group with 16 architectural registers, that is 1.5 × 4 × 3 = 18 comparators of 4 bits each.</li></ul></li>
<li><strong>Delay:</strong> the comparisons overlap the RAT read, but the priority mux after them has W inputs for the youngest slot and sits on the critical path. Its depth grows with log₂ W, and its wiring grows with W².</li>
<li><strong>Checkpoints:</strong> each one is a full copy of the SRAM RAT (A × ⌈log₂ P⌉ bits) or of the CAM valid vector (P bits). A branch in the middle of a group needs a checkpoint of the state <em>after that branch</em>, which is the RAT plus only the older slots' writes, so checkpoint logic must also see the per-slot write enables.</li>
</ul>
<p>Since the comparator count grows as W² and the port count's area cost also grows as W², wide cores split rename across two pipeline stages, or rename a wide group as two half-groups with a bypass between them.</p>
<h3 id="sec-recovery">Recovery</h3>
<p>On a misprediction, restore the RAT from a branch checkpoint, walk the ROB backward undoing mappings, or copy the retirement RAT. How every other structure recovers too is in <a href="#/flush-recovery">Pipeline Flush and Recovery</a>.</p>
<h3 id="sec-limits">What Limits It</h3>
<ul><li>Free-list size bounds instructions in flight</li><li>Rename width bounds throughput, and the RAT ports and same-group comparators grow as its square</li><li>Checkpoints bound branch depth</li></ul>
<p>After rename, each instruction waits in an issue queue until its sources are ready. The hardware that tracks readiness is on <a href="#/wakeup">Wakeup and Bypass Timing</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Initial RAT: r1→p1, r2→p2, r3→p3. Free list: p10, p11, p12. Rename:</p><pre><code>I0: r1 = r2 + r3
I1: r2 = r1 * r3
I2: r1 = r2 - r1</code></pre><p>Give the renamed instructions, the final RAT, and which register each instruction frees at commit.</p>`,
        a: `<ol><li>I0: sources p2, p3. r1 gets p10 (old p1). <code>p10 = p2 + p3</code></li><li>I1: sources r1 = p10, r3 = p3. r2 gets p11 (old p2). <code>p11 = p10 * p3</code></li><li>I2: sources r2 = p11, r1 = p10. r1 gets p12 (old p10). <code>p12 = p11 - p10</code></li><li>Final RAT: r1→p12, r2→p11, r3→p3.</li><li>At commit: I0 frees p1, I1 frees p2, I2 frees p10.</li><li>The WAW on r1 (I0, I2), the WAR on r1 (I1 reads, I2 writes), and the WAR on r2 (I0 reads, I1 writes) are gone. Only RAW edges remain: I0→I1, I0→I2, I1→I2.</li></ol>`
      },
      {
        q: `<p>A 6-wide renamer (AMD Zen 4's rename width) gets these six instructions in one cycle:</p><pre><code>s0: r3 = r1 + r2
s1: r1 = r3 + r3
s2: r3 = r1 + r4
s3: r5 = r3 + r1
s4: r3 = r5 + r2
s5: r2 = r3 + r1</code></pre><p class="given">Assume the RAT holds r1→p3, r2→p9, r3→p14, r4→p21, r5→p30 at the start of the cycle, and the free list pops p50, p51, p52, p53, p54, p55 to slots 0 to 5 in order. Each instruction has one destination and two sources.</p><p>Give every slot's physical sources, the old mapping each ROB entry saves, which RAT writes are suppressed, and the RAT at the end of the cycle.</p>`,
        a: `<ol><li>s0: no older slots, so sources come from the RAT: p3, p9. Dest p50. Old r3 mapping from the RAT: p14.</li><li>s1: both sources are r3, which matches s0's destination, so both read p50. Dest p51. Old r1: no older slot writes r1, so the RAT's p3.</li><li>s2: r1 matches s1 (p51), r4 has no match (RAT p21). Dest p52. Old r3: s0 writes r3, so the old mapping is p50, not the RAT's p14.</li><li>s3: r3 matches s0 and s2, and the youngest is s2, so p52. r1 matches s1, so p51. Dest p53. Old r5: RAT p30.</li><li>s4: r5 matches s3 (p53), r2 has no match (RAT p9). Dest p54. Old r3: youngest older writer is s2, so p52.</li><li>s5: r3 matches s0, s2, and s4. The youngest is s4, so p54. r1 matches s1, so p51. Dest p55. Old r2: RAT p9.</li><li>Write check: r3 is written by s0, s2, and s4, so s0's and s2's RAT writes are suppressed and only s4 writes r3.</li><li>Final RAT: r1→p51, r2→p55, r3→p54, r4→p21, r5→p53.</li><li>Check: the old mappings saved are p14, p3, p50, p30, p52, p9. Each of p14, p3, p30, p9 was live before the group, and p50 and p52 are freed by s2's and s4's commits, after s0 and s2 have both committed. Every register is freed exactly once.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>32 architectural integer registers, 180 physical. How many instructions with integer destinations can be in flight at most? And why not free the old mapping when the new producer writes back?</p>`,
        a: `<p>32 physical registers always hold committed state, so at most 180 − 32 = <strong>148</strong> in-flight destinations.</p><p>Freeing at writeback is unsafe for two reasons: older in-flight instructions may still need to read the old register, and if the new producer is squashed, the old mapping must be restored. Once the redefining instruction commits, neither can happen.</p>`
      },
      {
        q: `<p>An AArch64 core widens rename from 6 to 8 instructions per cycle. Estimate how the same-group comparator logic and the RAT cell area grow, and name what sets the cycle time.</p><p class="given">Assume 32 architectural integer registers (5-bit names), two sources and one destination per instruction, an SRAM RAT, and cell area proportional to the square of the port count.</p>`,
        a: `<ol><li>Comparators: 1.5 × W(W − 1). 6-wide: 1.5 × 6 slots × 5 slots = 45 comparators. 8-wide: 1.5 × 8 slots × 7 slots = 84 comparators, which is 84 comparators / 45 comparators ≈ <strong>1.87×</strong>.</li><li>In bits: 45 comparators × 5 bits = 225 bit compares versus 84 comparators × 5 bits = 420 bit compares.</li><li>RAT ports: 3W read + W write. 6-wide: 18 + 6 = 24 ports. 8-wide: 24 + 8 = 32 ports. Cell area: (32 ports / 24 ports)² ≈ <strong>1.78×</strong> per entry.</li><li>Cycle time: the comparisons overlap the RAT read, so the critical path is RAT read (or compare) → priority select → mux. The youngest slot's mux grows from 6 inputs (5 older slots + RAT) to 8 inputs (7 older slots + RAT), adding about one gate level, and the wires from every slot's destination to every younger slot's mux grow with W². Designs that can't fit this in one cycle split rename into two stages or rename two half-groups back to back.</li></ol>`
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
  sections: [
    { id: "math", label: "The Math" },
    { id: "benefit", label: "Benefit" },
    { id: "cost-power-performance", label: "Cost: Power, Performance, Area" },
    { id: "typical-workload-effects", label: "Typical Workload Effects" }
  ],
  body: `
<p>The physical register file (PRF) holds every renamed value. Its size limits how many instructions with destinations can be in flight.</p>
<h3 id="sec-math">The Math</h3>
<p>Registers needed ≈ architectural registers + in-flight destinations. By Little's law, in-flight destinations = rename rate × average lifetime (from rename until the next writer of the same architectural register commits). A practical target: PRF ≥ arch regs + (ROB size × fraction of instructions with a destination of that class).</p>
<h3 id="sec-benefit">Benefit</h3>
<p>More registers let the window grow before rename stalls, exposing more memory-level parallelism. Once the PRF stops being the first resource to fill, extra registers buy nothing. IPC versus PRF size is a saturating curve, and the knee depends on the workload.</p>
<h3 id="sec-cost-power-performance">Cost: Power, Performance, Area</h3>
<ul>
<li><strong>Area:</strong> grows with entries × width × (ports)². A wide core needs many ports, so the PRF is one of the densest and largest structures in the core.</li>
<li><strong>Latency:</strong> more entries means longer wordlines and bitlines. Past a point, register read takes an extra pipeline stage, which lengthens the mispredict penalty and needs more bypassing.</li>
<li><strong>Power:</strong> every read and write charges long bitlines; energy per access rises with entries and ports. Leakage rises with area.</li>
</ul>
<h3 id="sec-typical-workload-effects">Typical Workload Effects</h3>
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
  sections: [
    { id: "order-retirement", label: "Why In-Order Retirement" },
    { id: "size-window", label: "Size and the Window" },
    { id: "worth-measuring", label: "Worth Measuring" }
  ],
  body: `
<p>The ROB is a circular buffer holding in-flight instructions in program order. Entries are allocated at dispatch, marked done at writeback, and retired from the head in order once complete.</p>
<h3 id="sec-order-retirement">Why In-Order Retirement</h3>
<p>It makes exceptions precise. A faulting instruction just flags its entry; the fault is taken at the head, and everything younger is flushed (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>).</p>
<h3 id="sec-size-window">Size and the Window</h3>
<p>ROB size sets the instruction window, and so how much memory-level parallelism the core can find. A long-latency load at the head blocks retirement until the ROB fills and dispatch stalls.</p>
<h3 id="sec-worth-measuring">Worth Measuring</h3>
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
  sections: [
    { id: "math", label: "The Math" },
    { id: "benefit", label: "Benefit" },
    { id: "cost-power-performance", label: "Cost: Power, Performance, Area" },
    { id: "typical-workload-effects", label: "Typical Workload Effects" }
  ],
  body: `
<p>The ROB size sets the maximum instruction window: how far past a stalled instruction the core can look for independent work.</p>
<h3 id="sec-math">The Math</h3>
<ul>
<li><strong>Window to hide latency L at throughput IPC:</strong> W ≈ IPC × L (Little's law).</li>
<li><strong>Mispredict horizon:</strong> average instructions between mispredicts = 1 / (branch fraction × mispredict rate).</li>
<li><strong>Memory-level parallelism:</strong> independent misses that fit in the window can overlap, so effective cost per miss ≈ latency / MLP.</li>
</ul>
<h3 id="sec-benefit">Benefit</h3>
<p>Larger ROBs find more independent misses and more instruction-level parallelism around long-latency operations. The gain is largest for workloads with independent misses and predictable control flow.</p>
<h3 id="sec-cost-power-performance">Cost: Power, Performance, Area</h3>
<ul>
<li><strong>The ROB itself is cheap:</strong> it's a RAM-like FIFO indexed by position.</li>
<li><strong>Everything around it must grow:</strong> PRF, LQ and SQ (CAM searches), issue queue, checkpoints, and free lists. If they don't, the ROB never fills and the extra entries are wasted.</li>
<li><strong>Power:</strong> more in-flight instructions means more wrong-path work thrown away on a mispredict, plus larger structures searched each cycle.</li>
<li><strong>Performance side effects:</strong> larger LSQ and IQ CAMs can lengthen critical paths. Recovery by ROB walk takes longer with more entries.</li>
</ul>
<h3 id="sec-typical-workload-effects">Typical Workload Effects</h3>
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
  id: "flush-recovery",
  region: "core",
  title: "Pipeline Flush and Recovery",
  sections: [
    { id: "triggers", label: "What Triggers a Flush" },
    { id: "squash-point", label: "Marking the Squash Point" },
    { id: "front-end", label: "Clearing the Front End" },
    { id: "rename", label: "Restoring the Rename Map and Free List" },
    { id: "prf", label: "Why the Register File Needs No Restore" },
    { id: "rob", label: "The Reorder Buffer" },
    { id: "scheduler", label: "Scheduler Queues and Execution Pipes" },
    { id: "lsq", label: "Load and Store Queues" },
    { id: "checkpoints", label: "Checkpointing" },
    { id: "compare", label: "Three Kinds of Flush Side by Side" },
    { id: "exceptions", label: "Flushing for Faults, Traps, and Interrupts" },
    { id: "cost", label: "What a Flush Costs" }
  ],
  body: `
<p>An out-of-order core runs far ahead of the last instruction it knows is correct. When a guess turns out wrong, or an instruction can't complete, the core must remove every instruction younger than some point, the <strong>squash point</strong>, and put every structure back the way it was when that point was renamed. Two facts make this cheap. Nothing past the squash point has committed, so architectural state (committed registers, memory) is untouched. And with renaming, speculative values live in physical registers that no committed mapping points to. So recovery is bookkeeping: maps, pointers, and valid bits, never data. Main sources: Hennessy and Patterson (chapter 3, hardware speculation and the reorder buffer), Smith and Pleszkun's paper on precise interrupts (1988), Yeager's description of the MIPS R10000 (IEEE Micro, 1996), the BOOM documentation, and Akkary, Rajwar, and Srinivasan on checkpoint processing and recovery (MICRO 2003).</p>

<h3 id="sec-triggers">What Triggers a Flush</h3>
<div class="tbl"><table>
<tr><th>Event</th><th>Detected by</th><th>Recovery starts</th><th>First instruction removed</th><th>Fetch restarts at</th></tr>
<tr><td>Branch mispredict</td><td>The branch unit, at execute</td><td>Right away on most current cores, or when the branch reaches the ROB head on simpler ones</td><td>The instruction after the branch</td><td>The correct target</td></tr>
<tr><td>Memory-ordering violation (a store finds a younger load to the same address that already ran)</td><td>The store's search of the load queue</td><td>Usually when the load reaches the ROB head</td><td>The load</td><td>The load's PC</td></tr>
<tr><td>Memory-ordering clear under TSO (another core writes a line that an executed, uncommitted load read)</td><td>A snoop or eviction hitting the load queue</td><td>When the load reaches the ROB head</td><td>The load</td><td>The load's PC</td></tr>
<tr><td>Self-modifying code (a store hits a line that is in the pipeline as instructions)</td><td>The store's address check against the instruction side</td><td>When the store commits</td><td>The instruction after the store</td><td>That instruction's PC, fetched again</td></tr>
<tr><td>Fault or trap (page fault, illegal instruction, system call)</td><td>The unit that finds it, which only flags the ROB entry</td><td>When the entry reaches the ROB head</td><td>The faulting instruction</td><td>The handler</td></tr>
<tr><td>Interrupt</td><td>The interrupt controller</td><td>At a boundary the core picks</td><td>The oldest uncommitted instruction</td><td>The handler</td></tr>
</table></div>
<p>Intel's performance counters call every flush except a branch mispredict a <strong>machine clear</strong> (<code>MACHINE_CLEARS.MEMORY_ORDERING</code>, <code>MACHINE_CLEARS.SMC</code>, and so on). The distinction that matters most for the hardware is whether the squash point is at the ROB head (everything uncommitted goes) or somewhere in the middle (older instructions keep running).</p>

<h3 id="sec-squash-point">Marking the Squash Point</h3>
<p>Every structure needs a way to tell, in parallel and in about a cycle, which of its entries are younger than the squash point. Two schemes are common:</p>
<ul>
<li><strong>Age by ROB index:</strong> each micro-op carries its ROB index plus a wrap bit. An entry is younger than the squash point if its index comes after the squash index in circular order. The wrap bit is what lets a comparator tell "after" from "before" once the indices wrap around the end of the ROB.</li>
<li><strong>Branch masks:</strong> each unresolved branch gets a tag, one of N bits. Every micro-op carries a mask with the bits of all unresolved branches older than it. When branch k mispredicts, every entry with bit k set is killed. When branch k resolves correctly, bit k is cleared in every mask and the tag is free again. The MIPS R10000 (4 tags) and BOOM work this way. The number of tags caps unresolved branches in flight: when they run out, rename stalls at the next branch.</li>
</ul>
<p>Branch masks only cover branches. A squash point at a load or at the ROB head needs either age comparison or a full flush.</p>

<h3 id="sec-front-end">Clearing the Front End</h3>
<p>Everything between fetch and rename is younger than everything in the back end, so the front end is flushed wholesale, with no age checks: the fetch target queue, fetch and decode buffers, the micro-op queue, and the rename stage's pipeline latches. Then fetch is redirected to the new PC, which comes from the branch unit (the correct target), from the ROB (the load's PC for an ordering violation), or from the trap logic (the handler).</p>
<p>The branch predictor's speculative state is repaired too:</p>
<ul>
<li><strong>Global history:</strong> restored to its value at the branch, with the correct outcome shifted in (see <a href="#/fe-direction/update">Speculative History and Repair</a>).</li>
<li><strong>Return address stack:</strong> the top pointer is restored, and often the one entry a wrong-path call overwrote (see <a href="#/fe-targets/ras">The Return Address Stack</a>).</li>
<li><strong>Not restored:</strong> the predictor tables, caches, and TLBs. Tables usually update at resolution or retirement anyway. Lines that wrong-path loads brought into the cache stay there, which is what Spectre-style attacks read.</li>
</ul>

<h3 id="sec-rename">Restoring the Rename Map and Free List</h3>
<p>The rename map (RAT) is the one structure whose contents, not just pointers, change with every renamed instruction, so it is the hard part of recovery (see <a href="#/renaming">Register Renaming</a>). There are three ways back:</p>
<ol>
<li><strong>Checkpoint:</strong> a full copy of the RAT is saved when a branch is renamed. Recovery copies it back in one cycle. Fast, but each checkpoint costs area and the number of checkpoints limits unresolved branches.</li>
<li><strong>ROB walk:</strong> every ROB entry with a destination holds its architectural register, its new physical register, and the physical register it replaced. Walking from the tail back to the squash point, each entry writes its old mapping back into the RAT and returns its new register to the free list. Walking youngest first means the last write to each architectural register comes from the oldest squashed instruction, which holds the mapping from just before the squash point. No extra storage, but it takes (squashed entries ÷ walk width) cycles. A variant starts from the retirement RAT and walks forward from the ROB head to the squash point, re-applying mappings, which is faster when the squash point is near the head.</li>
<li><strong>Copy the retirement RAT:</strong> the retirement RAT always holds the committed mapping. If the squash point is the ROB head, so every uncommitted instruction goes, copying it into the speculative RAT is the whole recovery. This is how exceptions, interrupts, and commit-time recoveries work.</li>
</ol>
<p>The free list must give back every register the squashed instructions took:</p>
<ul>
<li><strong>FIFO free list (R10000):</strong> rename takes registers from the head, and commit returns them at the tail. The checkpoint saves the head pointer, and restoring it puts the squashed registers back in one step. Registers freed at commit in the meantime were added at the tail, so they aren't lost.</li>
<li><strong>Bit-vector free list (BOOM):</strong> each checkpoint keeps a mask of registers allocated since that branch. Recovery ORs the mask back into the free vector.</li>
<li><strong>Retirement copy:</strong> on a full flush, the free registers are exactly those the retirement RAT doesn't point to, minus any that committed instructions haven't freed yet.</li>
</ul>

<h3 id="sec-prf">Why the Register File Needs No Restore</h3>
<p>No data is copied back into the physical register file. Committed values live in registers the retirement RAT points to, and no in-flight instruction can write those, since every writer gets a fresh register. Squashed values sit in registers that simply return to the free list. Older designs without a merged register file had to restore data: Smith and Pleszkun's history buffer saved old values and copied them back on a fault, and a future file needed the architectural file copied over it. Renaming with a merged physical file is what reduced recovery to resetting maps.</p>
<p>One thing does need care: a squashed instruction already in an execution pipe must not write its destination. That register may have been reallocated by the time the result arrives, and the write would corrupt the new owner's value or set its ready bit early. So kill information (the branch mask or age) travels with every micro-op down the execute pipes, and writeback, the ready-bit update, and the wakeup broadcast are all gated on it.</p>

<h3 id="sec-rob">The Reorder Buffer</h3>
<p>The ROB is a circular buffer, so recovery is a pointer move: the tail is set to the entry just after the branch (for a mispredict) or to the load (for an ordering violation). Entries between the new and old tail are now free. For a flush at the head, the tail is set equal to the head and the ROB is empty. The squashed entries' contents are only used if recovery walks them first.</p>

<h3 id="sec-scheduler">Scheduler Queues and Execution Pipes</h3>
<p>Issue queue entries are not in program order, so they can't be freed by moving a pointer. Each entry compares its branch mask or age against the squash point and clears its valid bit, all entries in parallel (see <a href="#/scheduler">Scheduler Queues</a>). Surviving older entries keep waiting and issuing as before. Some more details:</p>
<ul>
<li><strong>In-flight operations:</strong> micro-ops already issued are killed in their pipes, as above. A long iterative operation, such as a divide, is aborted so the unit frees up.</li>
<li><strong>Speculative wakeups:</strong> dependents woken by a squashed load's speculative wakeup are squashed too, since they are younger still.</li>
<li><strong>Distributed queues:</strong> every per-port queue receives the same kill signal in the same cycle. That signal fans out to every entry in the core, which is one reason recovery logic is timing-critical.</li>
</ul>

<h3 id="sec-lsq">Load and Store Queues</h3>
<p>The load and store queues are allocated in program order at dispatch, so, like the ROB, they recover by moving tail pointers. Each checkpoint (or the branch's own ROB entry) records the LQ and SQ tails at the time the branch was renamed (see <a href="#/lsq">Load and Store Queues</a>). Then:</p>
<ul>
<li><strong>Squashed loads</strong> are dropped. If one has a cache miss outstanding, the MSHR usually still completes the fill and installs the line, but nothing is woken up. The load acted as a prefetch.</li>
<li><strong>Squashed stores</strong> never wrote the cache, so they just disappear.</li>
<li><strong>Committed stores</strong> waiting in the store buffer are architectural. They are older than any squash point and keep draining to the cache, even across an exception or interrupt.</li>
<li><strong>Memory dependence predictor:</strong> entries that point at squashed stores must be cleared or checked for validity, or a load could wait forever for a store that will never issue (see <a href="#/mdp-ssit/impl">The SSIT and LFST</a>).</li>
</ul>
<p>An ordering violation's squash point is the load itself, so the load and everything after it run again, this time reading the store's value.</p>

<h3 id="sec-checkpoints">Checkpointing</h3>
<p>A checkpoint is everything that recovery to one point needs that can't be found by moving a pointer:</p>
<div class="tbl"><table>
<tr><th>State</th><th>What is saved</th><th>Size</th></tr>
<tr><td>Rename map</td><td>A full copy of the speculative RAT</td><td>Architectural registers × log<sub>2</sub>(physical registers) bits per register class</td></tr>
<tr><td>Free list</td><td>The head pointer, or a mask of registers allocated since the checkpoint</td><td>A pointer, or one bit per physical register</td></tr>
<tr><td>ROB, LQ, SQ</td><td>The tail pointers (the ROB tail is implied by the branch's own index)</td><td>A pointer plus a wrap bit each</td></tr>
<tr><td>Branch predictor</td><td>The global history pointer, the RAS top pointer, sometimes the overwritten RAS entry</td><td>Tens of bits</td></tr>
</table></div>
<p>The rename map dominates. For x86-64's 16 integer registers and a 280-entry integer register file (Golden Cove's size), the integer map alone is 16 × 9 = 144 bits, and the vector map adds as much again. The copy must be written in a single cycle, so each checkpoint is a full-width, shadow copy wired next to the RAT, not a slow RAM.</p>
<p>Where to take checkpoints is the design choice:</p>
<ul>
<li><strong>At every branch:</strong> recovery is always one cycle, but checkpoints run out in branch-dense code and stall rename. The R10000 had 4, which limited it to 4 unresolved branches.</li>
<li><strong>Only at low-confidence branches:</strong> a confidence estimator picks the branches likely to mispredict. A mispredict at an uncheckpointed branch restores the nearest checkpoint and walks the few ROB entries between it and the branch, or, in Akkary and colleagues' design, re-executes from the older checkpoint.</li>
<li><strong>No checkpoints:</strong> every recovery walks the ROB. Cheapest in area, slowest to recover, and the walk time grows with the window.</li>
</ul>
<p>Intel added a Branch Order Buffer in Nehalem so that rename state could be recovered as soon as a mispredicted branch executed, rather than waiting for it to retire. Recovering early matters because the branch may sit behind a long-latency load for hundreds of cycles.</p>

<h3 id="sec-compare">Three Kinds of Flush Side by Side</h3>
<div class="tbl"><table>
<tr><th>Structure</th><th>Branch mispredict (recovered at execute)</th><th>Memory-ordering violation (recovered at commit)</th><th>Fault, trap, or interrupt</th></tr>
<tr><td>Front end</td><td>Flushed, redirected to the correct target</td><td>Flushed, redirected to the load</td><td>Flushed, redirected to the handler</td></tr>
<tr><td>Rename map</td><td>From the branch's checkpoint, or a ROB walk</td><td>Copy of the retirement RAT</td><td>Copy of the retirement RAT</td></tr>
<tr><td>Free list</td><td>From the checkpoint, or returned during the walk</td><td>Rebuilt from the committed state</td><td>Rebuilt from the committed state</td></tr>
<tr><td>ROB</td><td>Tail moved to just after the branch</td><td>Emptied (the load is at the head)</td><td>Emptied</td></tr>
<tr><td>Issue queues and pipes</td><td>Younger entries killed, older keep going</td><td>All killed</td><td>All killed</td></tr>
<tr><td>LQ and SQ</td><td>Tails restored</td><td>Emptied</td><td>Emptied</td></tr>
<tr><td>Store buffer (committed stores)</td><td>Keeps draining</td><td>Keeps draining</td><td>Keeps draining</td></tr>
<tr><td>Predictor history</td><td>Restored from the branch's checkpoint, outcome shifted in</td><td>Restored to the state at the load</td><td>Restored to the committed state</td></tr>
</table></div>
<p>A recovery at the ROB head is simpler, because every structure resets to empty or to its committed copy, but it waits for everything older to retire. A recovery in the middle is faster, but needs checkpoints or a walk plus selective kills everywhere.</p>

<h3 id="sec-exceptions">Flushing for Faults, Traps, and Interrupts</h3>
<p>A faulting instruction does nothing at first: the unit that finds the problem writes an exception code into its ROB entry. If an older branch turns out mispredicted, the ordinary branch flush removes that entry and the fault never happened. Only when the entry reaches the ROB head is the exception taken, which is what makes it precise (see <a href="#/exceptions/out-order-core">Making the Exception Precise</a>). At that point:</p>
<ol>
<li><strong>Flush everything uncommitted:</strong> the front end, ROB, issue queues, execute pipes, and LQ and SQ, including the faulting instruction itself.</li>
<li><strong>Restore committed state:</strong> the speculative RAT is overwritten by the retirement RAT, and the free list and predictor history are rebuilt from committed state. No checkpoint is needed, since the squash point is the head.</li>
<li><strong>Keep committed stores:</strong> the store buffer goes on draining, since those stores are architectural.</li>
<li><strong>Enter the handler:</strong> the core saves the resume PC and the cause, records the old privilege level, raises privilege, and jumps to the trap vector. That user-to-kernel transition is described in <a href="#/exceptions/hardware-sequence">The Hardware Sequence</a> and <a href="#/exceptions/privilege-levels">Privilege Levels</a>. The way back, <code>sret</code>, <code>eret</code>, or <code>iretq</code>, is in <a href="#/exceptions/return">Returning to User Mode</a>.</li>
</ol>
<p>Because the flush removes every instruction fetched under the old privilege level, no instruction ever runs in kernel mode with user-mode assumptions, or the reverse. Mode changes on return are handled the same way: the return instruction usually serializes, draining the window so that fetch restarts at the resume PC under the new mode. An interrupt has no faulting instruction, so the core picks a boundary, flushes everything uncommitted, and saves the oldest uncommitted PC as the resume point. For the full list of events that trap and what the kernel does with each, see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>.</p>

<h3 id="sec-cost">What a Flush Costs</h3>
<ul>
<li><strong>Resolution time:</strong> from fetching the branch to discovering the mispredict. This grows when the branch waits behind slow operands.</li>
<li><strong>Recovery time:</strong> about 1 cycle with a checkpoint, or squashed entries ÷ walk width with a walk. Fetch can be redirected at once, so the walk is hidden as long as it finishes before the first correct-path instructions reach rename.</li>
<li><strong>Refill time:</strong> the front-end depth, from fetch to rename. The minimum mispredict penalty on recent x86 cores is roughly 15 to 20 cycles.</li>
<li><strong>Lost work:</strong> on a mispredict, everything after the branch. On a commit-time flush, the whole window, which can be hundreds of micro-ops on a large core. An exception adds the handler on top (see <a href="#/exceptions/performance-trade-offs">Performance Trade-Offs</a>).</li>
</ul>
<p>In a model, count flushes by cause, the squashed micro-ops per flush, and the cycles from detection until the first correct-path micro-op is renamed. Separating these tells you whether to fix prediction, resolution latency, or recovery itself.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A core with 8-wide rename recovers from mispredicts by walking the ROB backward from the tail, undoing 8 entries per cycle. Fetch is redirected the moment the mispredict is detected, and the first correct-path micro-ops reach rename 11 cycles later. A branch mispredicts with 136 younger micro-ops in the ROB and 40 older ones ahead of it. How many cycles does recovery add beyond the refill? How would a forward walk from the retirement RAT, or a checkpoint, change that?</p>`,
        a: `<ol><li>Backward walk: 136 / 8 = 17 cycles. Rename can't accept correct-path micro-ops until the map is restored.</li><li>The refill takes 11 cycles and overlaps the walk, so the walk adds 17 − 11 = <strong>6 cycles</strong>.</li><li>Forward walk: start from the retirement RAT and re-apply the 40 older entries: 40 / 8 = 5 cycles. That finishes before the refill, so it adds <strong>0 cycles</strong>. But it only works if those older entries' mappings are still readable in the ROB, and a design would pick the shorter direction each time.</li><li>Checkpoint: about 1 cycle, also hidden under the refill, so <strong>0 cycles</strong>.</li><li>Takeaway: a walk is free when the squashed region is small, and costs cycles only when the window behind the branch is large. That's when a big ROB makes mispredicts more expensive.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A load on a mispredicted path has already issued and will write its destination register 3 cycles from now. The mispredict is recovered this cycle, and the load's physical register goes back on the free list. What can go wrong, and how do designs prevent it?</p>`,
        a: `<p>The register can be reallocated to a correct-path instruction within those 3 cycles. When the squashed load then writes back, it overwrites the new owner's value (if the new owner already wrote) or sets its ready bit and broadcasts its tag early, waking dependents that then read a wrong value. Either way, wrong-path work corrupts correct-path state.</p><p>Prevention:</p><ul><li><strong>Kill tags in the pipes:</strong> the branch mask or ROB age travels with the micro-op, and the recovery kill signal also reaches every execute stage, so the writeback, the ready-bit update, and the wakeup are suppressed. This is the usual fix.</li><li><strong>Delay reuse:</strong> squashed registers return to the free list only after the execute pipes have drained, which costs a few cycles of free-list capacity.</li><li><strong>Generation bits:</strong> each register has a version number that the write must match, at the cost of wider tags.</li></ul>`
      },
      {
        q: `<p>A RISC-V core has 32 integer and 32 FP architectural registers (x0 is hardwired to zero and isn't renamed), 128 integer and 128 FP physical registers, a bit-vector free list, a 32-entry load queue and a 32-entry store queue. It checkpoints at every branch and supports 20 checkpoints. How much storage do the checkpoints take, leaving out predictor state? Assume integer code has a branch about every 5 to 6 instructions. Is 20 enough for a 96-entry ROB?</p>`,
        a: `<ol><li>Each map entry names one of 128 registers: 7 bits. Mapped registers: 31 integer + 32 FP = 63, so 63 × 7 = 441 bits.</li><li>Allocation masks for the free list: 128 + 128 = 256 bits.</li><li>LQ and SQ tails: 5 bits plus a wrap bit each, 12 bits.</li><li>Per checkpoint: 441 + 256 + 12 = 709 bits. For 20: 709 × 20 = 14,180 bits, about <strong>1.7 KiB</strong> of flip-flops, each written in one cycle.</li><li>With a branch every 5 to 6 instructions, a full 96-entry ROB holds about 16 to 19 branches. 20 checkpoints rarely run out, though branch-dense code (a branch every 4 instructions would be 24) would stall rename before the ROB fills.</li></ol>`
      },
      {
        q: `<p>Most cores recover from a branch mispredict as soon as the branch executes, but recover from a memory-ordering violation only when the offending load reaches the ROB head. Why the difference, and what does the commit-time approach cost?</p>`,
        a: `<p>The squash point of an ordering violation is a load, and loads have no checkpoints. Checkpointing every load would multiply the checkpoint storage several times over, and branch masks only name branches. Recovering in the middle of the window would need a ROB walk plus age comparisons in every structure. At the ROB head, recovery is trivial: copy the retirement RAT and empty everything. Ordering violations are rare (and the memory dependence predictor makes them rarer), so a slow but simple path is a good trade.</p><p>The cost: the core keeps executing wrong-value work until the load reaches the head, which may take many cycles behind older misses. Then the whole window is thrown away, including correct work older than the load's dependents, and the front end refills from scratch. On TSO cores, snoop-triggered clears behave the same way, which is why heavy cross-core sharing shows up as memory-ordering machine clears (see <a href="#/consistency/impl">Speculating Past the Model</a>).</p>`
      },
      {
        q: `<p>On an x86-64 core running Linux, a user-mode (ring 3) load at the ROB head page-faults on a not-present page while 150 younger micro-ops are in flight and 3 committed stores sit in the store buffer. Walk through what each structure does before the handler's first instruction is fetched. Why does the core not use a branch checkpoint here?</p>`,
        a: `<ol><li>The fault flag in the ROB entry is acted on only now, because the load is the oldest instruction, so it can't be on a wrong path.</li><li>Front end, ROB, issue queues, execute pipes, LQ, and SQ: all flushed, including the faulting load. The 150 younger micro-ops are discarded.</li><li>Rename: the retirement RAT is copied into the speculative RAT, and the free list is rebuilt to match. No checkpoint is needed, because the squash point is the head and the retirement RAT is the exact state there. A branch checkpoint would describe some later point, so it would be wrong anyway.</li><li>Store buffer: the 3 committed stores keep draining. They are architectural and older than the fault.</li><li>Predictor history is reset to the committed state.</li><li>The trap sequence runs: the core reads IDT entry 14, writes the faulting address into CR2, loads RSP from TSS.RSP0, and pushes SS, RSP, RFLAGS, CS, the load's RIP, and error code 0x4 (not present, read, user mode). It then clears IF, loads the kernel CS so the CPL becomes 0, and fetches from the gate's handler address (see <a href="#/exceptions/hardware-sequence">The Hardware Sequence</a>). The six pushes are stores, so they queue in the store buffer behind the 3 committed stores.</li><li>After the handler maps the page, <code>iretq</code> returns to ring 3, fetch restarts at the load, and the 150 micro-ops are fetched and executed again.</li></ol>`
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
<ol>
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
<tr><td>Meltdown, rogue data cache load</td><td>A load from kernel memory forwards its data to dependents before the permission fault is taken (on affected cores)</td><td><a href="#/tlb">Translation Lookaside Buffers</a></td></tr>
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
        a: `<ol><li>Threshold: between the two clusters, with margin for noise on both sides; the midpoint is (45 + 320) / 2 ≈ <strong>180 cycles</strong>. In practice it is set from a histogram of measured hits and misses.</li><li>Time per bit: 100 + 2,000 + up to 320 ≈ 2,420 cycles.</li><li>Rate: 4 × 10<sup>9</sup> / 2,420 ≈ <strong>1.65 million bits per second</strong>, before error correction.</li><li>This is why these channels matter: even with large overheads, a timing channel moves data fast enough to leak keys or memory contents in seconds.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A database server makes about 300,000 system calls per second per core on a 3 GHz part that needs KPTI. Each kernel entry and exit adds about 400 cycles with PCID support, and about 1,500 without (TLB refills included). Estimate the overhead both ways. What would you tell a team modeling this server's next-generation core?</p>`,
        a: `<p>With PCID: 300,000 × 400 = 120 million cycles per second, <strong>4%</strong> of 3 billion. Without: 300,000 × 1,500 = 450 million, <strong>15%</strong>. For the modeling team: system-call and interrupt rates, and the mitigations active on the deployed system, are workload parameters as important as cache miss rates for this server. If the new core fixes Meltdown in hardware, KPTI can be turned off and that 4 to 15% comes back, which may be worth more than many microarchitectural features; the model should include it explicitly, and the benchmarks should run with the mitigation settings customers will use.</p>`
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
        a: `<ol><li>Throughput: alone, the core does one thread at a time; running A then B for equal times averages (2.0 + 0.8) / 2 = 1.4 IPC. Together: 1.5 + 0.6 = 2.1 IPC, so <strong>1.5×</strong> versus time-slicing. (Against A alone it is 2.1 / 2.0 = 1.05×, which is why "throughput gain" needs a stated baseline.)</li><li>Weighted speedup: 1.5 / 2.0 + 0.6 / 0.8 = 0.75 + 0.75 = <strong>1.5</strong>: the pair gets 1.5 cores' worth of progress from one core.</li><li>Slowdowns: A runs at 75% of its alone speed (1.33× slower); B at 75% too. Equal slowdowns, so neither is starved.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A latency-critical web service gets 25% more requests per second with SMT on, but its 99th-percentile latency rises 40%. The team asks you whether to keep SMT on. What do you measure and recommend?</p>`,
        a: `<p>Both numbers are expected: SMT trades per-thread speed for throughput, and tail latency is set by the slowest requests, which now share a core. Measure what the service is actually held to. If it must meet a latency target at a given load, compare the maximum load that meets the target with SMT on and off; SMT often wins there anyway, because without it the extra load queues up and the tail grows even more. Check what the co-runner is: if the sibling thread runs batch work, its cache and memory pressure may cause most of the tail, and the fix is scheduling (pair the service's threads with each other, or isolate cores), not disabling SMT. If the target can't be met with SMT on at the needed load, disable it only on the cores that serve requests and keep it for background work.</p>`
      }
    ]
  }
}
]);
