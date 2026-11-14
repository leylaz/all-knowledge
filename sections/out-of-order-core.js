/* Section: Out-of-order core
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "core"). */

section({
  id: "core",
  name: "Out-of-Order Core",
  cap: "Renaming, the window, scheduling, memory ordering",
  sections: [
    { id: "pipeline-pass", label: "The Pipeline in One Pass" },
    { id: "questions-that-matter", label: "The Questions That Matter" }
  ],
  body: `
<p>An out-of-order core fetches and decodes in order, executes in dataflow order, and commits in order. The middle of the pipeline is where the performance lives.</p>
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
<p>At rename, sources read the RAT, the destination takes a register from the free list, and the <em>previous</em> mapping is saved in the ROB entry. At commit, that previous register is freed, because no instruction younger than this one can still name it.</p>
<h3 id="sec-rat-hardware">The RAT in Hardware</h3>
<p>Rename handles a group of W instructions per cycle (W is the rename width). For each instruction it must do three things in the same cycle:</p>
<ol><li>Look up the physical register for each source.</li><li>Look up the current mapping of the destination, so the ROB entry can save it as the "previous" register to free at commit.</li><li>Pop a physical register from the free list and write the new mapping for the destination.</li></ol>
<p>There are two ways to build the table.</p>
<ul>
<li><strong>SRAM (indexed) RAT:</strong> one entry per architectural register, holding a physical register number of ⌈log₂(PRF size)⌉ bits. A source lookup is a plain read indexed by the architectural register number. The MIPS R10000 and most current cores work this way.</li>
<li><strong>CAM RAT:</strong> one entry per <em>physical</em> register, holding the architectural register it currently names plus a valid bit. A lookup searches every entry for a valid match, and the matching row number is the physical register. Renaming a destination sets the new row's valid bit and clears the old row's. The Alpha 21264 used this form. A checkpoint is only the vector of valid bits (one bit per physical register), which is cheap, but the search width grows with the physical register file, so it stopped scaling once PRFs reached hundreds of entries.</li>
</ul>
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
  id: "scheduler",
  region: "core",
  title: "Scheduler Queues",
  sections: [
    { id: "wakeup-select", label: "Wakeup and Select" },
    { id: "speculative-wakeup", label: "Speculative Wakeup" },
    { id: "unified-distributed", label: "Unified vs. Distributed" }
  ],
  body: `
<p>Renamed instructions wait in issue queues until their operands are ready.</p>
<h3 id="sec-wakeup-select">Wakeup and Select</h3>
<p><strong>Wakeup:</strong> a producer's destination tag is broadcast and waiting entries set ready bits. <strong>Select:</strong> pick ready entries up to the issue width per port, often oldest first. For back-to-back dependent issue, wakeup plus select must fit in one cycle. The circuits, the CDB, how cost grows with the register file, and how issue lines up with bypassing are on <a href="#/wakeup">Wakeup and Bypass Timing</a>.</p>
<h3 id="sec-speculative-wakeup">Speculative Wakeup</h3>
<p>Dependents of a load are woken assuming an L1 hit; on a miss they're replayed. How a core re-runs only the instructions that used a bad value is on <a href="#/replay">Selective Replay</a>.</p>
<h3 id="sec-unified-distributed">Unified vs. Distributed</h3>
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
  id: "wakeup",
  region: "core",
  title: "Wakeup and Bypass Timing",
  sections: [
    { id: "entry", label: "What an Entry Holds" },
    { id: "broadcast", label: "Broadcasting a Tag" },
    { id: "match", label: "The Match Circuit" },
    { id: "cdb", label: "Tomasulo's Common Data Bus" },
    { id: "cost", label: "Cost as the Register File Grows" },
    { id: "select", label: "Select and the Critical Loop" },
    { id: "bypass", label: "Issuing Before the Value Exists" },
    { id: "latency", label: "Multi-Cycle Producers and Loads" },
    { id: "dispatch", label: "The Dispatch Race" },
    { id: "matrix", label: "Matrix Schedulers" },
    { id: "pipelined", label: "When the Loop Doesn't Fit in a Cycle" }
  ],
  body: `
<p>A renamed instruction sits in an issue queue until its sources are ready. <strong>Wakeup</strong> is the hardware that tells it so. <strong>Select</strong> picks which ready entries go this cycle. This page goes through both at the circuit level, then shows how the scheduler issues a consumer <em>before</em> its operand exists, so the operand arrives through the bypass network just in time. The short version is on <a href="#/scheduler">Scheduler Queues</a>, and in-order forwarding is on <a href="#/data-hazards/forwarding">Data Hazards</a>.</p>
<h3 id="sec-entry">What an Entry Holds</h3>
<p>Each issue-queue (reservation station) entry holds:</p>
<ul><li><code>valid</code>: the entry is in use</li><li><code>op</code>: the operation (often kept in a separate payload RAM that is read only after select)</li><li><code>src0_tag</code>, <code>src1_tag</code>: the physical register numbers of the sources, ⌈log₂(PRF size)⌉ bits each</li><li><code>src0_rdy</code>, <code>src1_rdy</code>: one ready bit per source</li><li><code>dst_tag</code>: the destination physical register</li></ul>
<p>The ready bits are sticky flip-flops. Once set, they stay set until the entry is freed, squashed, or cancelled by a load replay.</p>
<h3 id="sec-broadcast">Broadcasting a Tag</h3>
<ul>
<li>There is one <strong>tag bus</strong> per issue slot, so a machine that issues W instructions per cycle has W tag buses. Each carries a producer's <code>dst_tag</code> and a valid bit, and runs past every entry in the queue.</li>
<li>Every source field has one comparator per bus. The queue has entries × 2 sources × W buses comparators, and all of them evaluate every cycle.</li>
<li>The update rule for each source is <code>src_rdy_next = src_rdy | match_bus0 | match_bus1 | …</code>.</li>
<li>The tag goes out when the producer is <em>selected</em>, not when it finishes. That is what lets a dependent instruction issue in the very next cycle (see <a href="#/wakeup/bypass">Issuing Before the Value Exists</a>).</li>
</ul>
<h3 id="sec-match">The Match Circuit</h3>
<p>Each comparator is a CAM match line:</p>
<ol><li>At the start of the cycle the match line is precharged high.</li><li>Each tag bit drives an XOR of the bus bit and the stored bit. The XOR output gates a pull-down transistor on the match line.</li><li>Any mismatched bit discharges the line. The line stays high only if every bit matches, and the bus valid bit gates the result.</li><li>The W match lines for a source are ORed together and with the current ready bit, and the result is written into the ready flip-flop.</li><li>The entry's request is <code>valid & src0_rdy & src1_rdy</code>.</li></ol>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="Wakeup logic for one source of one issue queue entry, with two tag buses. Tag bus 0 carries p17 with valid set, and tag bus 1 carries p33 with valid set. The entry's stored source tag is p17. Comparator 0 compares bus 0 with the stored tag and outputs 1, a match. Comparator 1 compares bus 1 with the stored tag and outputs 0. Both outputs and the current ready bit go into an OR gate, whose output is written into the src0 ready flip-flop. The flip-flop feeds back into the OR gate and forward into an AND gate with the entry's valid bit and src1 ready bit, which produces the entry's request to select. Notes below say each comparator is a precharged match line discharged by any mismatched bit, and that the queue has entries times 2 sources times W buses comparators." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrWK" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke-width:1.5">
<rect x="20" y="30" width="150" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="20" y="90" width="150" height="34" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="20" y="150" width="150" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="230" y="48" width="70" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="230" y="126" width="70" height="40" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="350" y="82" width="60" height="50" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="450" y="87" width="80" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="570" y="80" width="90" height="54" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M170,47 H200 V60 H228" marker-end="url(#arrWK)"/>
<path d="M170,107 H200 V78 H228" marker-end="url(#arrWK)"/>
<path d="M200,107 V136 H228" marker-end="url(#arrWK)"/>
<path d="M170,167 H200 V154 H228" marker-end="url(#arrWK)"/>
<path d="M300,68 H325 V98 H348" marker-end="url(#arrWK)"/>
<path d="M300,146 H325 V116 H348" marker-end="url(#arrWK)"/>
<path d="M410,107 H448" marker-end="url(#arrWK)"/>
<path d="M530,107 H568" marker-end="url(#arrWK)"/>
<path d="M540,107 V190 H380 V134" marker-end="url(#arrWK)"/>
<path d="M615,175 V136" marker-end="url(#arrWK)"/>
<path d="M660,107 H676"/>
</g>
<g style="fill:var(--ink);font-size:12px">
<text x="30" y="52" style="font-family:var(--mono);font-size:11px">bus 0: p17, valid</text>
<text x="30" y="112" style="font-family:var(--mono);font-size:11px">src0_tag: p17</text>
<text x="30" y="172" style="font-family:var(--mono);font-size:11px">bus 1: p33, valid</text>
<text x="265" y="73" text-anchor="middle" style="font-weight:600">=</text>
<text x="265" y="151" text-anchor="middle" style="font-weight:600">=</text>
<text x="380" y="112" text-anchor="middle" style="font-weight:600">OR</text>
<text x="490" y="104" text-anchor="middle" style="font-weight:600">src0_rdy</text>
<text x="490" y="119" text-anchor="middle">flip-flop</text>
<text x="615" y="102" text-anchor="middle" style="font-weight:600">AND</text>
<text x="615" y="120" text-anchor="middle">request</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="306" y="62">1</text><text x="306" y="140">0</text>
<text x="390" y="204">old ready bit</text>
<text x="575" y="190">valid, src1_rdy</text>
<text x="20" y="20">tag buses from select (one per issue slot)</text>
</g>
<g style="fill:var(--ink);font-size:11px">
<text x="20" y="236">Each "=" is a match line: precharged high, pulled low by any mismatched bit (one XOR per tag bit).</text>
<text x="20" y="254">One entry has 2 sources × W buses comparators. The whole queue has entries × 2 × W.</text>
<text x="20" y="272">All of them evaluate every cycle that any bus is valid.</text>
</g>
</svg></div>
<h3 id="sec-cdb">Tomasulo's Common Data Bus</h3>
<p>The tag bus descends from the Common Data Bus (CDB) of Tomasulo's algorithm in the IBM 360/91, as described in Hennessy and Patterson, chapter 3. There, the names were reservation-station numbers rather than physical registers. Each reservation station holds:</p>
<ul><li><strong>Op:</strong> the operation</li><li><strong>Vj, Vk:</strong> the source values, once known</li><li><strong>Qj, Qk:</strong> the reservation station that will produce each source, or 0 if the value is already in V</li><li><strong>Busy:</strong> the station is in use</li></ul>
<p>Each register in the register file also has a status field Qi: the reservation station that will write it, or 0 if the register holds the current value.</p>
<p>When a result is ready:</p>
<ol>
<li>The functional unit requests the CDB. If two units finish in the same cycle, one must wait, because there is only one bus.</li>
<li>The winner drives the tag (its reservation-station number) <em>and the full result value</em> onto the CDB in the same cycle.</li>
<li>Every reservation station compares Qj and Qk with the tag. On a match it latches the value into Vj or Vk and clears the Q field.</li>
<li>Every register whose Qi matches latches the value and clears Qi. Store buffers waiting for data do the same.</li>
<li>A station whose Qj and Qk are both 0 can start executing in the next cycle.</li>
</ol>
<p>Three consequences follow, and modern cores changed all three.</p>
<ul>
<li><strong>Wakeup and data travel together.</strong> A consumer can't start until the producer has finished and won the bus, so every dependence costs the producer's latency plus the CDB cycle. Modern cores broadcast the tag early, at select time, and deliver the value later through the bypass network.</li>
<li><strong>One result per cycle.</strong> A single CDB is a structural hazard once several units can finish together. Adding CDBs multiplies both the comparators and the value wires.</li>
<li><strong>Every entry stores values.</strong> Each source needs a 64-bit (or 256-bit or 512-bit for vector) latch writable from every CDB, and each CDB runs its full value width past every entry. This "value-capture" scheduler survived into Intel's P6 family. Cores built around a physical register file, like the Pentium 4 and Intel cores from Sandy Bridge on, keep only tags in the queue and broadcast only tags, so each bus is ⌈log₂(PRF size)⌉ bits wide instead of a full value width.</li>
</ul>
<p>So in a PRF-based core the old CDB has split in two: narrow <strong>tag buses</strong> driven at select time for wakeup, and wide <strong>result buses</strong> driven at the end of execution, which feed the bypass network and the PRF write ports.</p>
<h3 id="sec-cost">Cost as the Register File Grows</h3>
<p>Let N be the number of queue entries, W the number of tag buses, P the PRF size, and b = ⌈log₂ P⌉ the tag width.</p>
<ul>
<li><strong>Tag storage:</strong> N entries × 2 sources × b bits.</li>
<li><strong>Comparators:</strong> N × 2 × W comparators, each b bits wide, so N × 2 × W × b XOR cells.</li>
<li><strong>Ready table (scoreboard):</strong> one bit per physical register, P bits in all, set by every tag bus (W write ports) and read at dispatch (2 read ports per dispatched instruction).</li>
<li><strong>Delay:</strong> Palacharla, Jouppi, and Smith (ISCA 1997) split wakeup delay into tag drive, tag match, and the OR of the match lines. Tag drive dominates in large windows. The bus is a wire whose length grows with N, and each entry gets taller with W (one bus track and one comparator per bus), and wire RC delay grows with the square of length, so tag drive grows faster than linearly in N, and faster still at larger W. Tag match grows only slightly with b.</li>
<li><strong>Energy:</strong> almost every comparison mismatches, and a mismatch discharges a precharged match line, so nearly all N × 2 × W match lines burn energy every cycle that buses are active. Gating the comparators of empty entries and of sources that are already ready (Folegnani and González, ISCA 2001) removes much of that.</li>
</ul>
<p>The PRF size enters only through b, which grows with log₂ P. For a 64-entry queue with 4 tag buses (512 comparators):</p>
<div class="tbl"><table>
<tr><th>PRF size</th><th>Tag width b</th><th>XOR cells (N × 2 × W × b)</th><th>Relative</th></tr>
<tr><td>64 registers</td><td>6 bits</td><td>3,072</td><td>1.00×</td></tr>
<tr><td>128 registers</td><td>7 bits</td><td>3,584</td><td>1.17×</td></tr>
<tr><td>256 registers</td><td>8 bits</td><td>4,096</td><td>1.33×</td></tr>
<tr><td>512 registers</td><td>9 bits</td><td>4,608</td><td>1.50×</td></tr>
</table></div>
<p>Doubling the PRF adds one bit per comparator, a modest increase. Doubling the queue or the issue width doubles the comparator count and lengthens or loads every bus. The cost of more registers falls elsewhere: on the PRF's own ports and bitlines (<a href="#/prf-sizing">Sizing the Physical Register File</a>), on the ready table, and on every structure that stores a tag (RAT, ROB, payload RAM).</p>
<h3 id="sec-select">Select and the Critical Loop</h3>
<ul>
<li>Every entry whose request is high competes. A priority encoder or tree arbiter grants up to one request per functional unit (or per port) each cycle.</li>
<li>Priority is usually oldest first. A compacting queue keeps entries in age order so position gives age. A non-compacting queue keeps an N × N age matrix.</li>
<li>The granted entry reads its payload (op, destination) and drives its <code>dst_tag</code> onto a tag bus, which closes the loop.</li>
</ul>
<p>The loop select → tag bus → match → ready bit → request → select must fit in one cycle for dependent single-cycle instructions to issue back to back. Its delay grows with N and W, which is why large windows are split into several smaller queues, each with its own select logic.</p>
<h3 id="sec-bypass">Issuing Before the Value Exists</h3>
<p>The scheduler never checks a value. A ready bit doesn't mean "my operand is in a register." It means "if I issue now, my operand will be at my functional unit's input when I reach execute." The scheduler knows each producer's latency and broadcasts its tag exactly early enough to make that true. The value then arrives through a bypass path instead of the register file.</p>
<p>Take a pipeline with four stages after the queue: select (S), register read (RR), execute (EX), and writeback (WB), which writes the PRF. A is a single-cycle add. B and D both read A's result p20. B wins select in cycle 1. D loses select in cycle 1 to an older instruction and goes in cycle 2.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>Cycle 0</th><th>Cycle 1</th><th>Cycle 2</th><th>Cycle 3</th><th>Cycle 4</th></tr>
<tr><td><code>A: p20 = p5 + p6</code></td><td>S, broadcast p20</td><td>RR</td><td>EX, p20 computed</td><td>WB, p20 written to PRF</td><td></td></tr>
<tr><td><code>B: p21 = p20 + p7</code></td><td>woken at the end of the cycle</td><td>S, broadcast p21</td><td>RR, PRF still holds stale p20</td><td>EX, p20 from the EX → EX bypass</td><td>WB</td></tr>
<tr><td><code>D: p22 = p20 + p8</code></td><td>woken at the end of the cycle</td><td>requests, loses select</td><td>S</td><td>RR, A writes p20 this cycle</td><td>EX, p20 from the WB → EX bypass</td></tr>
</table></div>
<ul>
<li><strong>B</strong> is selected one cycle after A. It reaches EX in cycle 3, right after A's result leaves the ALU at the end of cycle 2. Its register read in cycle 2 returns garbage for p20, and the bypass mux replaces it with A's ALU output.</li>
<li><strong>D</strong> reads the PRF in cycle 3, the same cycle A writes it. Either the file writes in the first half of the cycle and reads in the second, or a second bypass level carries A's value from the writeback latch.</li>
<li>Any consumer that reads the PRF in cycle 4 or later finds p20 there.</li>
</ul>
<p>Each functional unit's input has a mux with one input from the PRF and one per (functional unit × bypass level). There are two ways to drive its select lines.</p>
<ol><li><strong>Tag compare at register read:</strong> compare the consumer's source tags with the destination tags in every unit's EX and WB latches, and take the newest match. This is the same forwarding unit an in-order pipeline uses.</li><li><strong>Timing known at issue:</strong> the scheduler knows which bus woke the source and how many cycles ago, which maps directly to one bypass input. A source that was ready long before needs the PRF.</li></ol>
<p>The bypass network's cost grows as (functional units)² × levels × value width in wires, because every unit's result must reach every unit's input. Wide cores cluster their units: the Alpha 21264 split its integer units into two clusters, and a value crossing between them cost one extra cycle.</p>
<h3 id="sec-latency">Multi-Cycle Producers and Loads</h3>
<ul>
<li><strong>Fixed latency L:</strong> broadcast the tag L − 1 cycles after select. For a 3-cycle multiply selected in cycle 0: RR in cycle 1, EX in cycles 2 to 4. The tag goes out in cycle 0 + (3 − 1) = 2, the consumer is selected in cycle 3, reads registers in cycle 4, and executes in cycle 5, right after the result appears. Single-cycle ops are the case L − 1 = 0. The delay is a shift register on the bus side or a countdown in each consumer entry.</li>
<li><strong>Variable latency (dividers):</strong> the unit announces a few cycles ahead when it will finish, and the tag goes out then.</li>
<li><strong>Loads:</strong> the latency isn't known at select, because the access may miss. The scheduler assumes an L1 hit (4 cycles to use on AMD Zen 4) and wakes dependents speculatively. If the load misses, the dependents already issued in its shadow are cancelled: their ready bits clear, they stay in the queue, and the load's fill re-broadcasts the tag later. How cores limit the damage is on <a href="#/replay">Selective Replay</a>.</li>
</ul>
<h3 id="sec-dispatch">The Dispatch Race</h3>
<p>A new entry initializes its ready bits from the ready table, which reflects broadcasts up to the end of the previous cycle. A broadcast in the <em>same</em> cycle would miss the entry, because its tags aren't in the CAM yet. Dispatch therefore also compares the incoming source tags with the current cycle's tag buses and ORs the result into the initial ready bits. A source whose producer is in the same dispatch group simply starts not ready.</p>
<h3 id="sec-matrix">Matrix Schedulers</h3>
<ul>
<li>Instead of tags, keep an N × N bit matrix. Row = consumer entry, column = producer entry.</li>
<li>At dispatch, set the bits for the queue entries the new instruction depends on. This needs a map from physical register to the queue entry that produces it.</li>
<li>When an entry is granted, clear its column: one wire per entry, no tag compare.</li>
<li>An entry is ready when its row is all zeros, a wide NOR.</li>
</ul>
<p>The matrix costs N² bits regardless of P, while the CAM costs N × 2 × W × b. They cross at N = 2 × W × b entries. For the 64-entry, 4-bus queue with a 256-entry PRF above, both come to 4,096 cells, and the matrix grows faster with N. That is one reason matrix schedulers are built as several small queues. The design is from Goshima et al. (MICRO 2001) and is widely reported in Intel and AMD cores.</p>
<h3 id="sec-pipelined">When the Loop Doesn't Fit in a Cycle</h3>
<p>If wakeup and select take two cycles, a dependent single-cycle instruction issues every other cycle and a chain runs at half speed. Stark, Brown, and Patt (MICRO 2000) recover most of the loss with speculative wakeup from grandparents: an instruction becomes a candidate when its parents' parents have issued, betting that the parents will be selected next. A wrong bet costs a cancel, the same mechanism loads already need.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A fused multiply-add with a 4-cycle latency (Intel Golden Cove and AMD Zen 4 both list 4 cycles) is selected in cycle 10. A dependent FMA uses its result as the addend. When must the producer broadcast its tag, and in which cycles is the consumer selected, read, and executed?</p><p class="given">Assume the pipeline after the queue is one select stage, one register-read stage, then execute, the consumer is selected in the first cycle it is ready, and wakeup and select fit in one cycle.</p>`,
        a: `<ol><li>Producer: select in cycle 10, register read in cycle 11, execute in cycles 12 to 15. The result exists at the end of cycle 15.</li><li>The consumer must execute in cycle 16, so it must read registers in cycle 15 and be selected in cycle 14. It must be woken by the end of cycle 13.</li><li>Broadcast cycle = select cycle + (latency − 1) = cycle 10 + (4 cycles − 1 cycle) = <strong>cycle 13</strong>.</li><li>Consumer: selected in cycle 14, register read in cycle 15 (the PRF doesn't have the value yet), execute in cycle 16 with the addend taken from the FMA unit's bypass.</li><li>If the tag went out at writeback (cycle 16) instead, the consumer would be selected in cycle 17 and execute in cycle 19, 3 cycles later on every link of the chain.</li></ol>`
      },
      {
        q: `<p>Intel Golden Cove is reported to have a 97-entry scheduler and a 280-entry integer PRF. Count the wakeup comparators and XOR cells, then compare two upgrades: growing the PRF to 512 entries, or doubling the scheduler to 194 entries.</p><p class="given">Assume 8 tag buses, two sources per entry, and one comparator per source per bus.</p>`,
        a: `<ol><li>Tag width: ⌈log₂ 280⌉ = 9 bits.</li><li>Comparators: 97 entries × 2 sources/entry × 8 buses = 1,552 comparators.</li><li>XOR cells: 1,552 comparators × 9 bits = <strong>13,968</strong>.</li><li>PRF to 512: ⌈log₂ 512⌉ = 9 bits, the same width. Comparator count and size are <strong>unchanged</strong>. The cost goes to the PRF itself and the ready table (512 bits instead of 280 bits).</li><li>Scheduler to 194: 194 entries × 2 sources/entry × 8 buses × 9 bits = <strong>27,936</strong> XOR cells, 2× the logic, plus tag buses twice as long, so wakeup delay grows faster than 2×.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You are choosing between a CAM scheduler and a matrix scheduler for one queue. Derive the queue size at which their cell counts cross, evaluate it for a design, and say what the cell counts leave out.</p><p class="given">Assume 8 tag buses, a 280-entry PRF, two sources per entry, and that the CAM costs one XOR cell per tag bit per comparator while the matrix costs one bit per (consumer, producer) pair.</p>`,
        a: `<ol><li>CAM: N entries × 2 sources × 8 buses × ⌈log₂ 280⌉ bits = N × 2 × 8 × 9 = 144 × N cells.</li><li>Matrix: N × N bits.</li><li>Crossover: N² = 144 × N, so N = <strong>144 entries</strong>. Below that the matrix is smaller. At 97 entries: matrix 97 × 97 = 9,409 bits versus CAM 97 × 144 = 13,968 cells.</li><li>What the counts leave out:<ul><li>The CAM also stores 2 tags per entry (97 entries × 2 sources × 9 bits = 1,746 bits) and needs the ready table at dispatch.</li><li>The matrix needs a map from physical register to producing queue entry at dispatch, plus the ready table for producers that have already left the queue.</li><li>Delay: the CAM's tag buses lengthen with N, and the matrix's per-row NOR widens with N. The matrix's N² growth is why it is split into several small queues.</li><li>The matrix has no tag width, so it doesn't care how big the PRF gets.</li></ul></li></ol>`
      },
      {
        q: `<p>A chain of 12 dependent single-cycle adds runs through a scheduler. How long does the chain take if tags are broadcast at select, versus at writeback as in the original Tomasulo CDB, and what hardware does the first option require?</p><p class="given">Assume the pipeline after the queue is select, register read, execute, and writeback, each one cycle, the adds never lose select, and wakeup plus select fit in one cycle.</p>`,
        a: `<ol><li>Broadcast at select: each add is selected the cycle after its producer, so the chain issues at 1 cycle/add. 12 adds × 1 cycle/add = <strong>12 cycles</strong> from the first add's execute to the end of the last add's execute.</li><li>Broadcast at writeback: a producer selected in cycle t writes back in cycle t + 3, and its consumer is selected in cycle t + 4. That is 4 cycles/add, so 12 adds × 4 cycles/add = <strong>48 cycles</strong>, 4× slower.</li><li>Hardware for the first option:<ul><li>An EX → EX bypass, because the consumer's register read happens before the producer has a result.</li><li>A WB → EX bypass (or write-before-read in the PRF), for consumers that lose select by one cycle.</li><li>Mux control for the bypass, by tag compares at register read or by timing known at issue.</li><li>A cancel mechanism for producers whose latency turns out longer than assumed, such as loads that miss.</li></ul></li></ol>`
      }
    ]
  }
},

{
  id: "exec-units",
  region: "core",
  title: "Execution Units",
  sections: [
    { id: "units", label: "The Units" },
    { id: "math", label: "The Math" },
    { id: "power-performance-area", label: "Power, Performance, Area" }
  ],
  body: `
<p>Execution units do the actual work. The scheduler sends ready instructions to ports, and each port feeds one or more units.</p>
<h3 id="sec-units">The Units</h3>
<div class="tbl"><table>
<tr><th>Unit</th><th>Does</th><th>Typical latency</th><th>Notes</th></tr>
<tr><td>ALU</td><td>Add, subtract, logic, shifts, compares</td><td>1 cycle</td><td>Several per core; small and cheap</td></tr>
<tr><td>Branch unit</td><td>Resolves branches, triggers recovery</td><td>1 cycle</td><td>Often shares a port with an ALU</td></tr>
<tr><td><a href="#/int-units/mul">Integer multiplier</a></td><td>Multiply</td><td>3–4 cycles</td><td>Pipelined</td></tr>
<tr><td><a href="#/int-units/div">Integer divider</a></td><td>Divide</td><td>~10–40 cycles</td><td>Iterative, usually not pipelined</td></tr>
<tr><td><a href="#/fp-units">FPU / FMA</a></td><td>FP add, multiply, fused multiply-add</td><td>3–5 cycles</td><td>Pipelined; large area</td></tr>
<tr><td>FP divide/sqrt</td><td>Division, square root</td><td>~10–30 cycles</td><td>Iterative</td></tr>
<tr><td>Vector / SIMD</td><td>Same op on many lanes</td><td>Like scalar FP</td><td>Area and power scale with width</td></tr>
<tr><td>Load unit (LDU)</td><td>Address generation + L1D access</td><td>~4–5 cycles load-to-use</td><td>Also searches the SQ</td></tr>
<tr><td>Store unit (STU)</td><td>Store address and store data</td><td>Writes the SQ</td><td>Address and data often split into separate ports</td></tr>
</table></div>
<p>Number formats, rounding, BF16 and the other ML types, and the inside of the FMA pipeline have their own section: <a href="#/r/arith">Computer Arithmetic</a>.</p>
<h3 id="sec-math">The Math</h3>
<ul>
<li><strong>Port demand:</strong> ops per cycle of a type = IPC × fraction of that type. Keep utilization well below 100% to avoid queueing.</li>
<li><strong>Throughput vs. latency:</strong> a pipelined unit with latency L can accept a new op each cycle; to keep it busy, you need L independent operations in flight (e.g., 4-cycle FMA × 2 units = 8 independent accumulations).</li>
<li><strong>Bypass network:</strong> with P producers and C consumer operands, there are about P × C forwarding paths, so it grows roughly with the square of the unit count.</li>
</ul>
<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul>
<li><strong>More units:</strong> more peak throughput, but each adds a scheduler select port, PRF read and write ports, and bypass paths. Those structures, not the units themselves, are often the limit.</li>
<li><strong>Wider SIMD:</strong> large throughput gains for vectorizable code, but area and power scale with width, and some designs lower frequency when wide vector units are active. Power-gate them when idle.</li>
<li><strong>Lower latency:</strong> helps dependent chains (pointer chasing benefits most from a faster load-to-use path) but may cost frequency or more area.</li>
<li><strong>Specialized units</strong> (crypto, matrix engines) are very efficient for their task and idle otherwise; that's acceptable because idle silicon can be power-gated ("dark silicon").</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A workload has 35% loads and 10% stores, and the target IPC is 4. Demand is bursty, and a port busy more than about 70% of the time causes noticeable queueing. How many load and store ports does it need?</p>`,
        a: `<ol><li>Loads per cycle: 0.35 × 4 = 1.4. Stores per cycle: 0.10 × 4 = 0.4.</li><li>Average demand fits in 2 load ports and 1 store port.</li><li>Two load ports would be busy 1.4 / 2 = 70% of the time, right at the queueing threshold. So designers often provision 3 load ports, or 2 load plus 2 store, for headroom.</li></ol>`
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
  id: "lsq",
  region: "core",
  title: "Load and Store Queues",
  sections: [
    { id: "stores", label: "Stores" },
    { id: "loads", label: "Loads" },
    { id: "catching-violations", label: "Catching Violations" },
    { id: "store-coalescing", label: "Store Coalescing" }
  ],
  body: `
<p>The LQ and SQ track memory operations in program order so they can execute out of order without breaking memory semantics.</p>
<h3 id="sec-stores">Stores</h3>
<p>Stores don't write the cache until they commit; after retirement they drain from the store buffer into L1. What happens to a retired store while it waits, including losing its line to another core, is on <a href="#/senior-stores">Senior Stores and Coherence</a>.</p>
<h3 id="sec-loads">Loads</h3>
<p>A load searches the SQ for older stores to the same address and forwards data when one fully covers it. If an older store's address is unknown, the load waits or speculates.</p>
<h3 id="sec-catching-violations">Catching Violations</h3>
<p>When a store's address resolves, it searches the LQ for younger loads to the same address that already executed; a hit means flush and re-execute.</p>
<p>Invalidations from other cores also search the LQ, to keep loads in the order the memory model requires (see <a href="#/consistency/impl">Speculating Past the Model</a>).</p>
<h3 id="sec-store-coalescing">Store Coalescing</h3>
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
        q: `<p>A 4-byte store to 0x100 is followed by an 8-byte load from 0x100. Can the store forward? On this core, a load that can't forward waits about 15 cycles for the store to commit and write the cache.</p>`,
        a: `<p>Not fully: the store covers only half the load. Most designs block the load until the store commits and writes the cache, then read the merged line. This "store-forwarding stall" costs about 15 cycles here. More complex designs merge store bytes with cache data. Compilers try to avoid narrow-store, wide-load patterns.</p>`
      },
      {
        q: `<p>Why does an x86 core check the load queue against coherence invalidations?</p>`,
        a: `<p>TSO requires loads to appear in program order. If a younger load executed early and the line is then invalidated by another core's write before an older load completes, the younger load may hold a value that is stale relative to the older one. The core detects this on the invalidation and squashes the younger load. Weaker models such as ARM allow more load-load reordering, but same-address ordering still must hold.</p>`
      }
    ]
  }
},

{
  id: "replay",
  region: "core",
  title: "Selective Replay",
  sections: [
    { id: "refetch", label: "Squash and Refetch" },
    { id: "setting", label: "Where the Idea Came From" },
    { id: "reexec", label: "Re-execution Recovery" },
    { id: "results", label: "What It Bought" },
    { id: "hold", label: "The Cost: Holding Entries" },
    { id: "later", label: "Replay in Later Cores" },
    { id: "takeaways", label: "Takeaways" }
  ],
  body: `
<p>When a speculative value turns out to be wrong, every instruction that used it must run again with the right value. There are two ways to get there. The core can squash everything younger and refetch it, or it can re-execute only the instructions that actually consumed the bad value. Tyson and Austin (MICRO 1997) built and measured the second approach, which they called <strong>re-execution recovery</strong>. Later work calls the same idea <strong>selective replay</strong>.</p>

<h3 id="sec-refetch">Squash and Refetch</h3>
<p>Squash recovery treats a bad load value like a mispredicted branch. In Tyson and Austin's words, "Mis-speculated loads may be treated the same as mis-speculated branches."</p>
<ul>
<li><strong>What happens:</strong> The core throws away the load and every younger instruction, restores the rename map, and restarts fetch at the load's PC.</li>
<li><strong>Why it's correct:</strong> Every instruction that could have used the bad value is younger than the load, so it's in the squashed set.</li>
<li><strong>Why it's expensive:</strong> Most of the squashed instructions never touched the bad value. They get refetched, decoded, renamed, and executed again anyway. On top of that, the front end has to refill before the first refetched instruction even reaches the scheduler.</li>
<li><strong>Why designers like it:</strong> It reuses the branch recovery hardware, so it costs almost nothing extra.</li>
</ul>

<h3 id="sec-setting">Where the Idea Came From</h3>
<p>Tyson and Austin needed cheap recovery for <strong>memory renaming</strong>, which makes a load look like a register read:</p>
<ol>
<li>At decode, the load's PC indexes a <strong>store/load cache</strong>. That cache returns an index into a <strong>value file</strong>, which is shared by a load and the store predicted to produce its data.</li>
<li>At rename, the load reads the value file. It gets the value that store last wrote, or the store's LSQ entry if the store is still in flight. Dependents then start right away, before the load has computed its address.</li>
<li>The load still accesses memory as usual. When the real value returns, the core compares it with the predicted one. A mismatch is a mis-speculation.</li>
<li>Confidence counters at decode decide which loads get renamed at all.</li>
</ol>
<p>So the error here is a wrong value, not a store-load ordering violation found by an address search. The recovery problem is the same, though: one load handed a bad value to a tree of dependents. One difference matters. In memory renaming, the verifying memory access has already produced the correct value, so the load itself doesn't need to run again. After an ordering violation, the load has to re-read memory first.</p>

<h3 id="sec-reexec">Re-execution Recovery</h3>
<p>Tyson and Austin leave every instruction in place and use the scheduler's own wakeup network to find the dependents. In their words, the approach "leverages dependence information stored in the reservation stations of not-yet retired instruction[s] to permit re-execution of only those instructions dependent on a speculative load value."</p>
<ol>
<li>The verifying access returns a value that doesn't match the prediction.</li>
<li>The core puts the correct value on the result bus under the load's destination tag, just like a normal completion.</li>
<li>Every waiting instruction whose operand tag matches captures the new value and re-executes. It then broadcasts its new result, which re-triggers its own dependents, and so on down the chain.</li>
<li>Memory dependences need extra help. When a store re-executes, the LSQ rechecks it against younger loads and re-issues any that read from it. A load whose address operand was regenerated also re-executes.</li>
</ol>
<p>Nothing is refetched, and younger instructions that never used the load's value keep their results.</p>
<p><strong>An instruction can run more than twice.</strong> No instruction knows how many of its operands will be regenerated, so it simply re-executes each time a new one arrives. If both operands of an add come from the bad load through chains of different lengths, the add runs once with the first corrected operand and again with the second. The paper says an instruction "may possibly re-execute multiple times, once for every re-generated operand that arrives."</p>
<p><strong>When it's safe to let go.</strong> An instruction can't free its reservation station entry when it issues, because a corrected operand might still arrive. The paper's rule is retirement: "At retirement, any re-executed instruction will be the oldest instruction in the machine, thus it cannot receive any more re-generated values, and the instruction may be safely retired."</p>

<div class="tbl"><table>
<tr><th></th><th>Squash and refetch</th><th>Selective replay</th></tr>
<tr><td>What runs again</td><td>The load and every younger instruction</td><td>Only instructions downstream of the bad value</td></tr>
<tr><td>Front end</td><td>Refetch, decode, and rename again</td><td>Not involved</td></tr>
<tr><td>Extra hardware</td><td>Almost none (branch recovery path)</td><td>Re-broadcast on the result bus, LSQ recheck for re-executed stores</td></tr>
<tr><td>Scheduler entries</td><td>Freed at issue</td><td>Held until the instruction can't be replayed</td></tr>
<tr><td>Penalty grows with</td><td>Front-end depth and window occupancy</td><td>Depth of the dependence chain</td></tr>
</table></div>

<h3 id="sec-results">What It Bought</h3>
<p>The simulator was SimpleScalar's sim-outorder: 8-wide issue and commit, a 256-entry RUU ("re-order buffer that implements renamed register storage and holds results of pending instructions"), and a 128-entry LSQ. Store forwarding took 1 cycle, and a branch mispredict cost 8 cycles. The workload was 10 SPEC95 programs.</p>
<ul>
<li><strong>Squash recovery hurt:</strong> With a moderate confidence threshold (their SQ-422), many programs saw only small speedups and CC1 slowed down by more than 5%. As they put it, "Many of the programs had more data mis-speculations than branch mis-predictions!"</li>
<li><strong>Raising the threshold only partly helped:</strong> A stricter threshold (SQ-844) mis-speculated less, but CC1 still gained very little.</li>
<li><strong>Re-execution fixed it:</strong> The same threshold with re-execution (RE-422) sped up every program, by as much as 14% for M88ksim and over 6% on average.</li>
<li><strong>Most squashed work was independent:</strong> Re-execution used less than 1/3 of the execution bandwidth squash recovery did. So, on average, fewer than 1 in 3 of the instructions in flight after a mis-speculation depended on the bad load.</li>
<li><strong>Cheap recovery allows bolder speculation:</strong> With re-execution, they could rename lower-confidence loads too (RE-211), and that did better for most programs. Going further (thresholds 111 and 000) raised mis-speculation too much.</li>
<li><strong>Slower forwarding raises the payoff:</strong> With a 3-cycle store forward, renaming with re-execution gained up to 41% for M88ksim and more than 16% overall.</li>
</ul>
<p>The lesson goes beyond renaming: <strong>recovery cost sets how aggressively you can speculate.</strong> When a wrong guess is cheap, the predictor can accept a lower hit rate in exchange for covering more instructions.</p>

<h3 id="sec-hold">The Cost: Holding Entries</h3>
<p>In sim-outorder, the RUU is both the reorder buffer and the reservation stations. Every instruction keeps its RUU entry until commit no matter what, so holding it for possible re-execution costs no capacity. That's why the cost never shows up in Tyson and Austin's results.</p>
<p>Real cores split the two. The ROB is large and cheap per entry. The issue queue is small, because every entry compares its operand tags on every wakeup broadcast. The Alpha 21264 has a 20-entry integer queue and a 15-entry FP queue, and it frees an entry as soon as its instruction issues. Selective replay breaks that: an entry has to stay from dispatch all the way to the point where it can no longer be replayed.</p>
<p>Little's law shows the size of the cost. Occupancy equals dispatch rate × time per entry. Under early deallocation, time per entry is dispatch-to-issue, often a handful of cycles. Under replay-until-retire, it's dispatch-to-retire, which includes every cache miss ahead of the instruction in program order. The queue either grows, which hurts the wakeup and select timing loop, or fills and stalls dispatch. This is the argument Chrysos and Emer make on the <a href="#/mdp-metrics/bounds">Memory Dependence Prediction</a> page. They keep early deallocation and use a predictor good enough that violations, and their full squash cost, almost never happen.</p>
<p>The way out is to shorten how long an entry has to wait. An instruction only needs its entry until every older speculative value it could depend on has been confirmed. If confirmation comes a few cycles after issue, the hold is short too.</p>

<h3 id="sec-later">Replay in Later Cores</h3>
<p>That short-hold version is exactly where replay ended up: <a href="#/scheduler/speculative-wakeup">speculative wakeup</a> on load hits. The scheduler wakes a load's dependents as if the load will hit in L1, so they issue in time to catch its data on the bypass. If the load misses, those dependents read garbage and must issue again. The hit/miss answer arrives a few cycles after the load issues, so entries are held only that long, not until retire.</p>
<p>Kim and Lipasti (HPCA 2004) compare the ways to do this:</p>
<ul>
<li><strong>Squashing replay:</strong> Re-issue everything that issued in the load's shadow, dependent or not. It's simple, but it wastes issue slots.</li>
<li><strong>Selective replay:</strong> Re-issue only the load's dependence chain, Tyson and Austin's idea applied to scheduling. It needs a way to tell which instructions depend on which in-flight loads.</li>
</ul>
<p>Store-load ordering violations, the hard case Chrysos and Emer studied, are still usually handled by a full squash. The load has to re-read memory, the violation shows up long after issue, and a good dependence predictor keeps violations rare.</p>

<h3 id="sec-takeaways">Takeaways</h3>
<ul>
<li>Replay re-runs only the instructions downstream of a bad value, from the scheduler, without going back to fetch. Refetch re-runs everything younger.</li>
<li>Tyson and Austin re-broadcast the correct value on the result bus and let the normal wakeup network find the dependents. An instruction may run once per regenerated operand.</li>
<li>In their study, fewer than 1 in 3 in-flight instructions depended on a mis-speculated load. Re-execution turned a slowdown into speedups on every program and allowed lower-confidence speculation.</li>
<li>The price is scheduler occupancy. An entry must stay until no corrected operand can reach it. Their RUU model hid this cost, but in a core with a small issue queue that frees entries at issue, it's real.</li>
<li>Replay works best when confirmation comes quickly, as with load hit speculation. For rare, late-detected errors such as ordering violations, prediction plus squash is usually the better trade.</li>
</ul>
<p class="refs">References: Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997 · Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Kim and Lipasti, "Understanding Scheduling Replay Schemes," HPCA 2004 · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core finds that a load got a wrong value. At that moment 180 younger instructions are in flight, and 40 of them depend on the load, directly or through other instructions. The longest dependence chain after the load is 7 single-cycle instructions. A refetch reaches the scheduler 13 cycles after the redirect. Compare the work wasted and the time to recover under squash and refetch versus selective replay. Ignore overlap with other work.</p>`,
        a: `<ol><li>Squash: all 180 younger instructions are thrown away and must be fetched again. The first one reaches the scheduler after 13 cycles. Re-dispatching all of them at 6 instructions/cycle takes 180 instructions / 6 instructions/cycle = 30 cycles. So the window is back where it was after about 13 cycles + 30 cycles = <strong>43 cycles</strong>, and <strong>180 instructions</strong> run a second time.</li><li>Replay: the correct value is broadcast, and only the 40 dependents issue again. The last one gets its correct value once the longest chain re-executes: 7 instructions × 1 cycle/instruction = <strong>7 cycles</strong>. The wasted work is <strong>40 issue slots</strong>.</li><li>Replay re-executes 40 instructions / 180 instructions ≈ 22% of what squash does, and it never touches the front end. The other 140 instructions keep their results.</li><li>What replay costs instead: all 180 instructions had to keep their scheduler entries after issuing, since any of them could have been a dependent until the load was checked.</li></ol>`
      },
      {
        q: `<p>A load L writes r1 with a wrong value. Three instructions use it:</p><ul><li>I1: add r2 = r1 + 8 (1 cycle)</li><li>I2: mul r3 = r1 × r6 (3 cycles)</li><li>I3: sub r4 = r2 − r3 (1 cycle)</li></ul><p>All three have already executed with the wrong r1. Using Tyson and Austin's re-execution recovery, the correct r1 is broadcast at the end of cycle 0. Each instruction issues the cycle after an operand arrives, and its result is broadcast at the end of its last execute cycle. Trace the replay. How many times does I3 execute during recovery?</p>`,
        a: `<ol><li>Cycle 0: the correct r1 goes out on the result bus. I1 and I2 both match the tag and capture it.</li><li>Cycle 1: I1 and I2 issue. I1 finishes and broadcasts the new r2 at the end of cycle 1. I2 needs 3 cycles (cycles 1, 2, and 3).</li><li>Cycle 2: I3 captures the new r2 and issues. Its r3 is still the stale value from the first wrong execution, so it broadcasts another wrong r4.</li><li>Cycle 3: I2 finishes and broadcasts the correct r3 at the end of the cycle.</li><li>Cycle 4: I3 captures r3 and issues again, now with both operands correct. It broadcasts the correct r4.</li><li>I3 executes <strong>2 times</strong> during recovery, once per regenerated operand. Any consumer of r4 also runs twice, so the extra work can multiply down the chain. A design that waited for both operands would need to know in advance which operands will be regenerated, and the paper notes that's "non-trivial."</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A core dispatches 6 µops/cycle into a 96-entry unified issue queue. On average a µop spends 8 cycles between dispatch and issue, and 30 cycles between issue and retire. Find the average issue queue occupancy when entries are freed at issue, and when they're held until retire for selective replay. What sustained dispatch rate can the second design support? Then propose a fix.</p>`,
        a: `<ol><li>Freed at issue: by Little's law, occupancy = 6 µops/cycle × 8 cycles = <strong>48 entries</strong>. The 96-entry queue is half full on average, with room for bursts.</li><li>Held until retire: occupancy = 6 µops/cycle × (8 cycles + 30 cycles) = 6 µops/cycle × 38 cycles = <strong>228 entries</strong>, which is more than the 96 entries available.</li><li>So the queue fills and dispatch stalls. The sustained rate falls to 96 entries / 38 cycles ≈ <strong>2.53 µops/cycle</strong>, about 42% of the 6 µops/cycle width. The issue-to-retire time also gets longer, because a full queue hides fewer misses.</li><li>Fix: hold each entry only until every older speculative value it could depend on is confirmed, not until retire. If confirmation comes 4 cycles after issue, occupancy = 6 µops/cycle × (8 cycles + 4 cycles) = 72 entries, which fits. Errors confirmed later than that, such as ordering violations, fall back to a full squash. Growing the queue to 228 entries is the other option, but it slows the wakeup and select loop.</li></ol>`
      },
      {
        q: `<p>Renaming a load correctly saves 3 cycles on the critical path. A wrong rename costs 22 cycles with squash recovery or 4 cycles with selective replay. Above what mis-speculation rate does renaming a load class stop paying, under each recovery scheme? How does this change the confidence threshold a designer picks?</p>`,
        a: `<ol><li>With mis-speculation rate p, renaming pays when the expected gain beats the expected loss: (1 − p) × 3 cycles > p × cost.</li><li>Squash: (1 − p) × 3 cycles = p × 22 cycles gives p = 3 cycles / (3 cycles + 22 cycles) = <strong>12%</strong>.</li><li>Replay: (1 − p) × 3 cycles = p × 4 cycles gives p = 3 cycles / (3 cycles + 4 cycles) ≈ <strong>42.9%</strong>.</li><li>With squash, only load classes that are wrong less than 12% of the time are worth renaming, so the confidence threshold must be strict and coverage stays low. With replay, classes that are wrong up to about 42.9% of the time still pay, so a lower threshold covers far more loads. This is the pattern Tyson and Austin saw when re-execution let them move to a lower-confidence setting.</li><li>Caveat: replay cost isn't really constant. It grows with the depth of the dependence chain and with issue queue pressure, so measure it per load class rather than assuming one number.</li></ol>`
      },
      {
        q: `<p>Tyson and Austin's re-execution recovery gave speedups on every program in their simulator. A colleague wants to add the same scheme to a core with small, separate integer and FP issue queues that free entries at issue, and to use it for store-load ordering violations too. What would you warn them about?</p>`,
        a: `<p>First, the result doesn't carry over directly. Their simulator used an RUU, where reservation stations and ROB entries are the same, so holding an entry until retire cost no capacity. In a core that frees issue queue entries at issue, every entry that might be replayed has to stay much longer. The queue either grows, which hurts the wakeup and select cycle time, or fills and stalls dispatch. That's the reason Chrysos and Emer kept early deallocation.</p><p>Second, ordering violations are a harder case than value mis-speculation. In memory renaming, the verifying memory access already holds the correct value, so the core only re-broadcasts it. After an ordering violation, the load must read memory again, or get the store's forwarded data, before anything can re-execute. The violation also shows up only when the older store's address resolves, which can be long after the load issued. Entries would need to stay for that whole time.</p><p>Third, memory dependences complicate the chain. A re-executed store can change data or addresses that younger loads already used, so the LSQ has to recheck it and possibly replay more loads. A re-executed address computation can send a load to a new address.</p><p>Better plan: use selective replay where errors are confirmed quickly, as with L1 hit speculation. For ordering violations, use a strong dependence predictor so they're rare, and squash when one does happen. Measure squash rate × squash cost against the IPC lost to a larger or more crowded queue before committing either way.</p>`
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
<li>Model load and store bandwidth in bytes, not instructions; wide vectors usually hit the L1 or L2 bandwidth bound before the FMA bound (see the bytes-per-cycle rows on <a href="#/perf-bounds/mem-bounds">Memory Bounds</a>).</li>
<li>Include the frequency behavior of the part being modeled.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (data-level parallelism in vector, SIMD, and GPU architectures) · Stephens et al., "The ARM Scalable Vector Extension," IEEE Micro, 2017 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> · RISC-V International, <em>RISC-V "V" Vector Extension</em>, version 1.0</p>`,
  practice: {
    guided: [
      {
        q: `<p>70% of a program's run time is in loops that vectorize perfectly with 8 lanes, and the rest stays scalar. What is the speedup? If running the vector code also lowers the clock by 10% for the whole program, what is it then?</p>`,
        a: `<ol><li>Amdahl: speedup = 1 / (0.3 + 0.7 / 8) = 1 / (0.3 + 0.0875) = 1 / 0.3875 ≈ <strong>2.58×</strong>.</li><li>With a 10% lower clock everywhere: 2.58 × 0.9 ≈ <strong>2.32×</strong>.</li><li>Even perfect 8-lane vectors give well under 8×: the 30% that stays scalar becomes 77% of the new run time (0.3 / 0.3875).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A dot product of two 1 GB double-precision arrays runs on a core with two 512-bit FMA units and two 512-bit load ports at 3 GHz, and the core can draw about 15 GB/s from DRAM. Is the FMA width worth anything here? What would make it matter?</p>`,
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
}
]);
