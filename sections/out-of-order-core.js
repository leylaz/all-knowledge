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
  id: "mdp",
  region: "core",
  title: "Memory Dependence Prediction",
  sections: [
    { id: "why", label: "Why Predict Memory Dependences" },
    { id: "metrics", label: "Metrics" },
    { id: "bounds", label: "Never, Always, and Perfect" },
    { id: "window", label: "Why Window Size Matters" },
    { id: "simple-wait-bits", label: "Simple: Wait Bits" },
    { id: "earlier", label: "Other Early Predictors" },
    { id: "store-sets", label: "Store Sets: The Concept" },
    { id: "ideal", label: "How Well Ideal Store Sets Do" },
    { id: "impl", label: "The SSIT and LFST" },
    { id: "assignment", label: "Store Set Assignment and Merging" },
    { id: "feedback", label: "Clearing Stale Entries" },
    { id: "table-sizes", label: "Table Sizes" },
    { id: "applu", label: "Where Store Sets Fall Short" },
    { id: "takeaways", label: "Takeaways" }
  ],
  body: `
<p>Most loads never touch the bytes an older in-flight store is about to write, so letting them run ahead is almost always the right call. The rare exception is costly: a load that reads too early returns stale data, and the core must squash it along with every younger instruction. A memory dependence predictor learns which loads are the exceptions. It remembers the stores each load has collided with in the past and holds that load back only until those stores have issued, while every other load runs freely. This page follows Chrysos and Emer's store sets paper (ISCA 1998) section by section. Window-size data comes from Moshovos, Breach, Vijaykumar, and Sohi (ISCA 1997), real hardware from the Alpha 21264 hardware reference manual, and background from Hennessy and Patterson (chapter 3).</p>

<h3 id="sec-why">Why Predict Memory Dependences</h3>
<p>An out-of-order core must respect two kinds of data dependence:</p>
<ul>
<li><strong>Register dependences:</strong> one instruction writes a register and a later one reads it. Decode finds these by comparing register fields, and renaming turns them into tags the scheduler can wait on.</li>
<li><strong>Memory dependences:</strong> a store writes a location and a later load reads it. These can't be found at decode, because the addresses don't exist yet. A store's address is known only after its address operands are ready and its address-generation µop has run, which can be many cycles after decode.</li>
</ul>
<p>So when a load's own address is ready, the scheduler often sees older stores with unknown addresses. It has two simple choices, and both are bad:</p>
<ul>
<li><strong>Make the load wait for every older store.</strong> This can never break memory order. But most loads don't read anything those stores write, so most of them end up <strong>falsely dependent</strong>: they wait for stores they have nothing to do with, and the wait lands on the critical path whenever later work needs the load's value.</li>
<li><strong>Let the load go.</strong> This is usually right. When an older store turns out to write bytes the load read, the load got a stale value. That's a <strong>memory-order violation</strong>, and the load plus every younger instruction must be squashed and re-executed (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>).</li>
</ul>
<p>Chrysos and Emer give a memory dependence predictor two goals:</p>
<ol>
<li>Predict which loads would cause a violation if they executed early.</li>
<li>Delay those loads only as long as needed to avoid the violation, and no longer.</li>
</ol>
<p>A wrong prediction fails one of these goals. Missing goal 1 causes a violation. Missing goal 2 causes a false dependence. Their predictor uses <strong>store sets</strong>: a load's store set is every store it has ever depended on. The core finds a load's store set by starting with naive speculation (every load goes early) and adding a store to the set each time that store catches the load in a violation. After that, the load waits only for in-flight stores in its set. The paper's question is whether this simple history-based rule can get close to perfect dependence knowledge in an 8-wide, 128-entry-queue core, and whether it can be built cheaply.</p>

<h3 id="sec-metrics">Metrics</h3>
<p>The two failure modes give the two counts used throughout the paper and this page:</p>
<ul>
<li><strong>Memory-order violations</strong> per 1,000 instructions (or per committed load). Like branch mispredictions per 1,000 instructions, the count matters only together with the penalty per event.</li>
<li><strong>False dependences</strong> per 1,000 instructions: the number of times a load was made to wait for a store whose address turned out not to overlap.</li>
<li><strong>IPC compared with a perfect predictor:</strong> the only measure that combines both. A false dependence off the critical path costs nothing, and one on it costs its full delay, so counts alone can mislead.</li>
</ul>
<p>The paper also sorts every dynamic load into one of four bins: not predicted (empty store set, ran freely), predicted correctly, falsely dependent, or caused a violation.</p>

<h3 id="sec-bounds">Never, Always, and Perfect</h3>
<p>Before building a predictor, the paper measures what is at stake. It runs two policies that cost almost no hardware and compares them with an oracle. The two policies bound the problem from both sides:</p>
<ul>
<li><strong>No speculation</strong> isolates the cost of false dependences, because it has no violations.</li>
<li><strong>Naive speculation</strong> isolates the cost of violations, because it has no false dependences.</li>
<li><strong>Perfect prediction</strong> has neither, so the gap between it and each policy is what that failure mode costs.</li>
</ul>

<p><strong>The simulated machine.</strong> The model is roughly twice an Alpha 21264 (caches and issue width) and runs the Alpha instruction set:</p>
<ul>
<li>128-entry instruction queue, sized by doubling it until performance stopped improving</li>
<li>Up to 8 instructions issued per cycle</li>
<li>4 data cache ports, usable by any mix of loads and stores</li>
<li>128 KB 2-way instruction cache and 128 KB 2-way write-back data cache</li>
<li>8 MB direct-mapped write-back unified L2</li>
<li>Aggressive fetch that fetches several basic blocks per cycle, steered by a McFarling-style choosing branch predictor</li>
</ul>
<p>The core detects violations with a table of the addresses of all loads that executed speculatively, which each store checks when it executes (the load queue search on <a href="#/lsq/catching-violations">Load and Store Queues</a>). It recovers by <strong>trapping</strong>: it squashes the offending load and every younger instruction, whether or not they depend on the load, and refetches starting at the load, beginning the cycle after detection. The workload is SPEC95, compiled with full optimization, run for 100 million instructions after skipping initialization and warming the caches.</p>

<p><strong>No speculation.</strong> Every load waits until all older stores have issued. Since a store must wait for both its address and its data registers before it issues, a load can also end up waiting on a store's data even when the address is known and different. (A footnote suggests splitting stores into an address operation and a data operation to shorten this wait, but the paper doesn't model it.) The rightmost column of the table below counts false dependences: times a load waited for nothing. At 129 to 275 per 1,000 instructions, and with only about 170 to 310 loads per 1,000 instructions in these programs, false dependences are about as common as loads themselves. Some benchmarks run more than 2× slower than with perfect prediction.</p>

<p><strong>Naive speculation.</strong> Loads issue as soon as their register operands are ready, with no predictor. Violations range from 0 to 24 per 1,000 instructions, which is 0 to 7% of dynamic loads. To turn counts into cost, the paper defines the <strong>memory trap penalty</strong>: the cycles between the first fetch of the violating load and its refetch after the violation is detected. That is roughly the number of cycles in which the front end fetched no useful instructions. It varies from load to load, because it depends on how long the conflicting store takes to execute and expose the violation.</p>
<div class="tbl"><table>
<tr><th rowspan="2">SPEC95 program</th><th colspan="2">Naive speculation</th><th>No speculation</th></tr>
<tr><th>Violations per 1,000 instructions</th><th>Memory trap penalty (cycles)</th><th>False dependences per 1,000 instructions</th></tr>
<tr><td>go</td><td>6</td><td>13</td><td>157</td></tr>
<tr><td>m88ksim</td><td>20</td><td>12</td><td>168</td></tr>
<tr><td>gcc</td><td>5</td><td>15</td><td>187</td></tr>
<tr><td>compress</td><td>11</td><td>15</td><td>129</td></tr>
<tr><td>xlisp</td><td>11</td><td>14</td><td>179</td></tr>
<tr><td>ijpeg</td><td>23</td><td>15</td><td>150</td></tr>
<tr><td>perl (primes)</td><td>20</td><td>15</td><td>215</td></tr>
<tr><td>perl (scrabble)</td><td>10</td><td>15</td><td>185</td></tr>
<tr><td>vortex</td><td>7</td><td>19</td><td>215</td></tr>
<tr><td>tomcatv</td><td>4</td><td>22</td><td>264</td></tr>
<tr><td>swim</td><td>2</td><td>36</td><td>224</td></tr>
<tr><td>mgrid</td><td>0</td><td>18</td><td>262</td></tr>
<tr><td>applu</td><td>18</td><td>22</td><td>212</td></tr>
<tr><td>apsi</td><td>7</td><td>35</td><td>247</td></tr>
<tr><td>fpppp</td><td>10</td><td>17</td><td>275</td></tr>
<tr><td>wave5</td><td>24</td><td>21</td><td>188</td></tr>
<tr><td>turb3d</td><td>6</td><td>16</td><td>213</td></tr>
</table></div>
<p>A rough product of the two naive-speculation columns shows why violations can't be ignored. wave5 loses about 24 violations per 1,000 instructions × 21 cycles per violation ≈ 504 cycles per 1,000 instructions of fetch time. At this machine's IPC of a few instructions per cycle, 1,000 instructions take only a few hundred cycles, so the lost fetch time is comparable to the program's whole run time.</p>
<p><strong>Why not replay only the dependents?</strong> Tyson and Austin proposed re-executing just the violating load and the instructions that depend on it, instead of squashing everything younger. Replay is not refetch. A squash throws away the load and every younger instruction, and fetch restarts at the load's PC, so even instructions that never touched the load's value go back through fetch, decode, rename, and issue. A replay leaves every instruction in the window. The load's correct value is broadcast again, and only the instructions that consumed the wrong one issue again, straight from the issue queue, with no trip through the front end. That would cut the trap penalty, but it has a cost the paper cares about: an instruction that might be replayed has to stay in the issue queue until it retires. The 21264 instead frees issue queue entries as soon as instructions issue, so newer instructions can compete for issue slots sooner. A smaller queue then finds as much ILP as a larger one would, which helps cycle time. Chrysos and Emer choose to keep early deallocation and make violations so rare that their penalty doesn't matter. The full replay mechanism and its costs are on <a href="#/replay">Selective Replay</a>.</p>

<p><strong>Perfect prediction.</strong> An oracle makes each load wait for exactly the store it depends on, and for nothing else. The paper's Figure 3.1 compares the three policies. Approximate IPC values read from that bar chart:</p>
<div class="tbl"><table>
<tr><th>Program</th><th>No speculation (IPC)</th><th>Naive speculation (IPC)</th><th>Perfect (IPC)</th></tr>
<tr><td>fpppp</td><td>≈ 2.0</td><td>≈ 3.3</td><td>≈ 5.7</td></tr>
<tr><td>turb3d</td><td>≈ 2.5</td><td>≈ 4.2</td><td>≈ 6.1</td></tr>
<tr><td>ijpeg</td><td>≈ 1.8</td><td>≈ 2.0</td><td>≈ 4.6</td></tr>
<tr><td>perl (primes)</td><td>≈ 2.1</td><td>≈ 2.2</td><td>≈ 5.1</td></tr>
<tr><td>vortex</td><td>≈ 2.8</td><td>≈ 3.5</td><td>≈ 5.1</td></tr>
<tr><td>swim</td><td>≈ 2.1</td><td>≈ 3.7</td><td>≈ 3.9</td></tr>
<tr><td>mgrid</td><td>≈ 3.3</td><td>≈ 5.2</td><td>≈ 5.2</td></tr>
</table></div>
<p>The conclusions:</p>
<ul>
<li>Naive speculation usually beats no speculation, so loads should be allowed to pass stores.</li>
<li>Most programs still run far below perfect under naive speculation. ijpeg and perl (primes), with 20 or more violations per 1,000 instructions, barely improve on no speculation and run at less than half of perfect.</li>
<li>Programs with almost no violations (mgrid at 0, swim at 2 per 1,000 instructions) are already near perfect with naive speculation. For them, the only job of a predictor is to do no harm.</li>
<li>So the opportunity is the whole gap between naive speculation and perfect, and a predictor must close it without adding false dependences.</li>
</ul>

<h3 id="sec-window">Why Window Size Matters</h3>
<p>Chrysos and Emer state that dependence prediction matters more for wider cores with larger windows, but they measure only one machine. Four effects all grow with the window:</p>
<ol>
<li><strong>Exposure:</strong> a store and a later load can conflict only if both are in flight at once, so only dependences whose distance in dynamic instructions is shorter than the window matter. A larger window exposes more store-load pairs.</li>
<li><strong>Unknown older stores:</strong> the more instructions in flight, the more older stores a ready load sees with unresolved addresses, so the chance that at least one of them aliases goes up.</li>
<li><strong>Cost per violation:</strong> a violation squashes the load and everything younger. A larger window holds more younger work to throw away and takes longer to refill.</li>
<li><strong>Cost of waiting conservatively:</strong> a load that waits for all older stores waits for more unrelated stores, so both no speculation and simple wait bits get worse.</li>
</ol>
<p>Moshovos et al. measured the first effect directly. Their "unrealistic out-of-order" model holds a perfect continuous window of n instructions and counts every true store-to-load dependence closer than n instructions as a misspeculation. That's a worst case, the number of violations blind speculation could cause. The table converts their counts (Table 3, divided by the committed instruction counts in their Table 1) to violations per 1,000 instructions for SPECint92:</p>
<div class="tbl"><table>
<tr><th>Window (instructions)</th><th>compress</th><th>espresso</th><th>gcc</th><th>sc</th><th>xlisp</th></tr>
<tr><td>8</td><td>0.00045</td><td>0.08</td><td>3.78</td><td>6.80</td><td>8.22</td></tr>
<tr><td>32</td><td>33.7</td><td>2.37</td><td>21.5</td><td>25.9</td><td>35.1</td></tr>
<tr><td>128</td><td>59.0</td><td>18.2</td><td>45.6</td><td>61.2</td><td>80.1</td></tr>
<tr><td>512</td><td>82.9</td><td>28.8</td><td>68.8</td><td>80.9</td><td>107.9</td></tr>
</table></div>
<p>What the data shows:</p>
<ul>
<li><strong>Most dependences span more than a few instructions.</strong> compress has almost no dependences within 8 instructions but about 34 per 1,000 instructions within 32, and those 24 extra instructions of window can hold many unrelated stores. A 1990s core with a window of a few tens of instructions saw few violations, which is why blind speculation was good enough then.</li>
<li><strong>The rate keeps climbing into hundreds of instructions.</strong> From 128 to 512 instructions, every program gains another 10 to 28 dependences per 1,000 instructions.</li>
<li><strong>More static pairs appear too.</strong> An <em>event</em> is one dynamic store-to-load dependence that the table above counts: a load at run time reads a value written by an older store fewer than n instructions back. A <em>static pair</em> is one (store PC, load PC) combination in the program's code, such as:
<pre><code>p-&gt;count = x;   // store at PC 0x4a10
...
y = p-&gt;count;   // load at PC 0x4a1c</code></pre>
<p>Every time this code runs with the two instructions close enough together, it produces another event, even though the predictor has already seen the pair. A loop that runs 1,000,000 times can produce 1,000,000 events from this single pair. The pair counts below are measured over the whole gcc run, not inside one window, which holds only a store or two and a load at a time:</p>
<ol>
<li>Collect every event, every dynamic dependence with a store-to-load distance under n instructions.</li>
<li>Group the events by their (store PC, load PC) pair.</li>
<li>Sort the pairs from most to fewest events.</li>
<li>Take pairs from the top until they cover 99.9% of all events, and count them.</li>
</ol>
<p>That count goes from 255 pairs at a window of 8 instructions to 8,001 pairs at 512 instructions (their Table 4). gcc is large, and at a window of 8 instructions its close-range dependences come from 255 code locations, such as register spills and reloads or a struct field written and read back. At a window of 512 instructions, pairs farther apart also count, such as a store in a caller and a load in a callee, or a store in one loop iteration and a load several iterations later. A predictor indexed by PC therefore needs more entries for a larger window.</p></li>
<li><strong>But the pairs have temporal locality.</strong> A small cache of recent conflicting pairs captures most events. With a 512-instruction window, a 512-entry cache misses less than 4% of the time for every program (their Table 5). This is the premise store sets also rely on: a few static pairs, repeated many times.</li>
</ul>
<p>On a real out-of-order model (a Multiscalar processor with 4 or 8 processing units, which form 4 or 8 sequential tasks in flight), blind speculation's violations per committed load rise with the larger configuration in every program. For example, compress goes from 0.073 to 0.136 violations per committed load and sc goes from 0.021 to 0.039 (their Table 9). Their own predictor cuts these to 0.00083 and 0.00205 for compress.</p>
<p>They also compared four policies, using perfect knowledge of which loads have dependences:</p>
<ul>
<li><strong>NEVER:</strong> no speculation</li>
<li><strong>ALWAYS:</strong> blind speculation</li>
<li><strong>WAIT:</strong> loads that have a true dependence wait until every older store address is known, and other loads go early</li>
<li><strong>PSYNC:</strong> loads that have a true dependence wait for exactly the right store, and other loads go early</li>
</ul>
<p>The gap between PSYNC and ALWAYS grows from the 4-unit to the 8-unit machine. And WAIT, which is what a wait bit does, loses to plain blind speculation on compress and sc: when the producing store is far back with many unrelated stores in between, waiting for all of them takes longer than an occasional violation. That's the motivation for a predictor that names <em>which</em> store to wait for, and store sets do exactly that. In 145.fpppp the window grew to a few thousand instructions (one loop iteration of about 1,000 instructions per task), and the dependence working set overflowed their prediction tables.</p>
<p><strong>For scale:</strong> the 21264 has at most 80 instructions in flight, and the store sets machine has a 128-entry queue. Current cores are much larger: Intel's Golden Cove has a 512-entry ROB with 192 load buffer and 114 store buffer entries, so a load near the young end can have around a hundred older stores in flight. Hennessy and Patterson's ILP limit study makes the same point from the other side: in an ideal machine, weakening alias analysis (so loads must wait for stores that might alias) is one of the largest limits on ILP once the window is large.</p>

<h3 id="sec-simple-wait-bits">Simple: Wait Bits</h3>
<p>The Alpha 21264 shipped the simplest useful predictor, the <strong>store-wait (stWait) table</strong>:</p>
<ul>
<li>1,024 entries of 1 bit, indexed by the load's PC</li>
<li>When a load causes a store-load order trap, its bit is set as the load is refetched</li>
<li>The issue queue won't issue a load whose bit is set while any older store in the queue is still unissued</li>
<li>Every bit is cleared unconditionally every 16,384 cycles (or every 65,536 cycles if a control bit is set), so loads whose behavior changed get to speculate again</li>
</ul>
<p>A load with its bit set behaves like the no speculation policy: it waits for <em>every</em> older store, which is Moshovos's WAIT. In an 80-instruction window, with few older stores in flight, that's cheap. In a larger window, it forces a flagged load to wait behind many unrelated stores, and a single conflict is enough to flag the load until the next clear.</p>

<h3 id="sec-earlier">Other Early Predictors</h3>
<p>Store sets built on several earlier ideas, which the paper surveys:</p>
<ul>
<li><strong>Memory reference tagging (Steely, Sager, and Fite, DEC patent):</strong> a general framework that gives loads and stores that caused violations the same tag and orders memory operations that share a tag. Store sets' SSID is a "common tag" of this kind.</li>
<li><strong>Store barrier cache (Hesson et al., IBM patent):</strong> a store that caused a violation sets a bit in the store barrier cache. When a store with that bit set is fetched, all later loads wait until the store executes. The store becomes a barrier, which is conservative for loads that never touch its address.</li>
<li><strong>Dependence prediction and synchronization (Moshovos et al., ISCA 1997):</strong> the first published work to show that memory dependences are a problem for out-of-order machines. They pointed out that a dependent load should wait only as long as necessary and that false dependences must be avoided. Their design keeps two fully associative tables: one holds the store-load pairs that caused violations, and the other synchronizes later instances of those pairs.</li>
<li><strong>Using prediction for communication:</strong> Moshovos and Sohi (MICRO 1997) used dependence prediction to forward store data straight to dependent loads. Tyson and Austin (MICRO 1997) combined dependence prediction with value prediction to get values to a load's consumers early. These goals are different from scheduling, but they could use the same predictor.</li>
</ul>
<p>Store sets started from a remark in the Moshovos and Sohi forwarding paper. The idea is to replace a list of (load, store) pairs with a set per load, built from direct-mapped tables.</p>

<h3 id="sec-store-sets">Store Sets: The Concept</h3>
<p>Store sets rest on two premises:</p>
<ol>
<li>The history of memory-order violations predicts future memory dependences well.</li>
<li>A predictor must handle both a load that depends on several stores and several loads that depend on the same store.</li>
</ol>
<p>Every static load gets a <strong>store set</strong>: the store PCs it has ever depended on. Stores and loads are identified by PC. At program start every set is empty, so every load speculates. When a load and a store execute in the wrong order and cause a violation, the store's PC is added to the load's set. The next time that load is fetched, the core checks which stores in its set were recently fetched but haven't issued, and makes the load depend on them. Loads that never violate have empty sets and run as early as possible. And if a store in set A causes a violation with a different load, it joins that load's set too.</p>
<p>The paper's example, with PCs in bytes:</p>
<div class="tbl"><table>
<tr><th>PC</th><th>Instruction</th><th>Store set</th></tr>
<tr><td>0</td><td>store C</td><td></td></tr>
<tr><td>4</td><td>store A</td><td></td></tr>
<tr><td>8</td><td>store B</td><td></td></tr>
<tr><td>12</td><td>store C</td><td></td></tr>
<tr><td>28</td><td>load B</td><td>{PC 8}</td></tr>
<tr><td>32</td><td>load D</td><td>{ } (empty)</td></tr>
<tr><td>36</td><td>load C</td><td>{PC 0, PC 12}</td></tr>
<tr><td>40</td><td>load B</td><td>{PC 8}</td></tr>
</table></div>
<p>The load at PC 36 depends on two stores, and the loads at PC 28 and PC 40 both depend on the store at PC 8. The second case (many loads, one store) is common: it's one writer and several readers of a value. The first case (one load, many stores) is less common but real:</p>
<ul>
<li><strong>Stores on different paths:</strong> <code>if (expr) x = a; else x = b; ... c = x;</code> The load of x depends on whichever store ran.</li>
<li><strong>Packed fields:</strong> separate stores write the red, green, and blue fields of a color word, and one load reads the whole word.</li>
<li><strong>Write-after-write chains:</strong> if repeated stores to one location are treated as dependences, a load depends on a series of stores, for example several spills to the same stack slot.</li>
</ul>
<p>To test whether both kinds of flexibility matter, the paper ran three idealized configurations:</p>
<ol>
<li><strong>Each store in only one set, each set unbounded:</strong> a store that causes a violation moves to the set of the load it conflicted with last. Two loads can't share a store.</li>
<li><strong>Each set holds one store, and a store can be in any number of sets:</strong> a new violation replaces the store in the load's set. A load can't depend on two stores.</li>
<li><strong>"Infinite":</strong> no limits on set size or on how many sets a store is in.</li>
</ol>
<p>Run time relative to the infinite configuration (the paper's Figure 5.1, read from the chart):</p>
<div class="tbl"><table>
<tr><th>Program</th><th>Only one load per store</th><th>At most one store per load</th></tr>
<tr><td>perl (primes)</td><td>≈ 1.47×</td><td>≈ 1.30×</td></tr>
<tr><td>wave5</td><td>≈ 1.43×</td><td>≈ 1.08×</td></tr>
<tr><td>m88ksim</td><td>≈ 1.30×</td><td>≈ 1.15×</td></tr>
<tr><td>vortex</td><td>≈ 1.24×</td><td>≈ 1.00×</td></tr>
<tr><td>xlisp</td><td>≈ 1.24×</td><td>≈ 1.02×</td></tr>
</table></div>
<p>Either limit costs a lot of performance on some programs, and preventing loads from sharing a store hurts more. In a side experiment, the second configuration was allowed 2, 4, or 8 stores per load. Eight stores per load (an 8-way associative set) lost nothing, and 4 was nearly as good, with only perl (primes) losing much. Section 6 of the paper keeps both kinds of flexibility while using direct-mapped tables.</p>

<h3 id="sec-ideal">How Well Ideal Store Sets Do</h3>
<p>Using the infinite configuration, the paper classifies each dynamic load (its Figure 5.2). Violations almost vanish in every program. The cost shows up as false dependences in a few programs: applu and xlisp have the most (roughly 25 to 30 per 1,000 instructions), and vortex, gcc, go, and swim have a few.</p>
<p>The cause is that a store set only grows. Once a store PC is in a load's set, every later instance of the load waits for every in-flight instance of that store for the rest of the run. If the pair touches the same address only occasionally, the core pays many false dependences to avoid a few violations. That suggests tracking a <strong>working</strong> store set: the stores the load has depended on <em>recently</em>.</p>
<p>The paper uses a fix borrowed from branch prediction: a 2-bit saturating counter on each store in a set.</p>
<ul>
<li>On a violation, the counter is set to its maximum, 3.</li>
<li>After a load has been forced to wait for a store in its set, the two addresses are compared. If they really overlapped, the counter goes up by 1. If they didn't, it goes down by 1.</li>
<li>The load waits for the store only while the counter's high bit is set.</li>
</ul>
<p>This lowers false dependences, at the risk of letting violations come back for patterns that a 2-bit counter can't follow. In practice, violations stayed rare (Figure 5.3), and applu was the only program left with many false dependences.</p>
<p>Results (Figure 5.4): infinite store sets come close to perfect on every program. The worst is applu, at 10 to 14% below perfect, which is the program with the most false dependences. The counters help xlisp and applu slightly, but not by enough to clearly justify them. In a few programs, "perfect" was slightly <em>slower</em> than store sets. That's a modeling artifact: the perfect configuration also stops wrong-path execution after a branch mispredict, and wrong-path loads have both a prefetching benefit and a cache-thrashing cost, worth about ±2%. The conclusion: if hardware can approximate infinite store sets, it gets nearly perfect performance.</p>

<h3 id="sec-impl">The SSIT and LFST</h3>
<p>Infinite store sets need two kinds of flexibility that are expensive in hardware: a load waiting on several stores, and a store in several sets. The implementation adds three restrictions and recovers most of what they lose:</p>
<ul>
<li><strong>Finite, direct-mapped, untagged tables.</strong> Unrelated loads may share a set by aliasing, which can add false dependences.</li>
<li><strong>A store is in at most one store set at a time</strong> (like configuration 1). Merging (next section) lets two loads that depend on the same store share one set.</li>
<li><strong>Stores in one set execute in program order.</strong> A load in a set with several stores would need to wait for all of them, but hardware doesn't know which will finish last, and a load with several dependence tags makes the scheduler more complex. Instead, each store depends on the previous fetched store in its set, and each load depends on the last fetched store in its set. The stores form an in-order chain, and the load waits on the end of the chain, so it waits for all of them with one dependence.</li>
</ul>
<p>The in-order chain has a second benefit. If two stores in a set both write address X and a load of X follows, the load really depends only on the second store. Because the two stores execute in order, the core doesn't need any write-after-write detection to work this out.</p>
<p>The hardware is two tables:</p>
<div class="tbl"><table>
<tr><th>Table</th><th>Indexed by</th><th>Entry holds</th><th>Purpose</th></tr>
<tr><td>Store Set Identifier Table (SSIT)</td><td>Load or store PC (low bits, no tag)</td><td>A valid bit and a store set identifier (SSID)</td><td>Gives a load and the stores in its set a common tag</td></tr>
<tr><td>Last Fetched Store Table (LFST)</td><td>SSID</td><td>A valid bit and the inum of the most recently fetched store in that set</td><td>Says which in-flight store the next load or store of the set must wait for</td></tr>
</table></div>
<p>An <strong>inum</strong> is a hardware tag that uniquely names one in-flight instruction instance, such as its ROB index. Both tables are read in the front end, so the dependence is known by the time the instruction enters the scheduler:</p>
<ul>
<li><strong>A load is fetched:</strong> it reads SSIT[load PC]. If the SSID is valid, it reads LFST[SSID]. If that entry is valid, the load becomes dependent on that store's inum, the same way it would wait on a register tag.</li>
<li><strong>A store is fetched:</strong> it reads SSIT[store PC]. If the SSID is valid, it reads LFST[SSID] and, if that entry is valid, becomes dependent on that earlier store (the in-order chain). Then it writes its own inum into LFST[SSID], since it is now the last fetched store of the set.</li>
<li><strong>A store issues:</strong> it checks LFST[SSID] and invalidates the entry if it still holds this store's inum. Later loads and stores then won't wait for a store that has already issued.</li>
</ul>
<p>Stores on different control paths fit naturally. Only the store that is actually fetched updates the LFST, so the load always waits for the store on the path taken, and the two stores never wait for each other because they're never both fetched.</p>
<p><strong>Recovery.</strong> After a branch mispredict, jump mispredict, or violation, the SSIT doesn't change, because it holds learned history, not in-flight state. The LFST may point to squashed stores. A load that waits for a store that will never issue would hang (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>). Ideally each LFST entry would roll back to the last surviving store that wrote it. The paper modeled that but argues that simply invalidating entries that name aborted stores is enough.</p>
<p><strong>A full example.</strong></p>
<ol>
<li>At program start every SSIT entry is invalid, so loads and stores get no dependence information and every load speculates.</li>
<li>A load causes a violation with a store. The core allocates SSID X (the paper derives it by XOR-hashing the load PC) and writes X into two SSIT entries: one indexed by the load PC and one indexed by the store PC.</li>
<li>Next time the store is fetched, it finds SSID X, reads LFST[X], and finds no in-flight store, so it doesn't wait. It writes its inum into LFST[X].</li>
<li>The load is fetched, finds SSID X, reads LFST[X], and gets the store's inum. The scheduler makes the load wait for that store.</li>
<li>Later the same load violates with a second store. X is copied into the second store's SSIT entry, so three SSIT entries now point at X. From then on, when both stores and the load are fetched, the second store waits for the first and the load waits for the second.</li>
</ol>
<p>Why only one SSID per store? Letting an SSIT entry hold two SSIDs would need extra LFST read ports, and a load could then depend on two stores, which makes the scheduler larger. The cost is a new problem, covered next.</p>
<p><strong>Two loads waiting on one store, step by step.</strong> Suppose load0 and store0 already share SSID X, and then load1 violates with store0. Store0 has a set and load1 doesn't, so load1 joins store0's set (rule 3 in the next section). Now SSIT[load0 PC], SSIT[load1 PC], and SSIT[store0 PC] all hold X. The paper gives the table operations. Where it is silent about the hardware, the steps below say so and give the usual design. The example core renames 4 instructions per cycle and uses ROB indices as inums. Its LFST has 128 entries, the size in the DEC patent's preferred embodiment, so an SSID is 7 bits.</p>
<ol>
<li><strong>Store0 is fetched and renamed.</strong> The paper says only that "recently fetched" loads and stores access the SSIT. It names no pipeline stage, and the related DEC patent (US 6,108,770) places the assignment of instruction identifiers in a stage after decode and before the instruction queue, which is rename and allocate in a modern core. The paper calls the SSIT "a PC indexed table" without saying virtual or physical. In practice it's the virtual fetch PC, which the front end already has, and an untagged predictor costs only performance when it indexes wrong.
<ul>
<li><strong>SSIT read:</strong> it needs only the PC, so it can start at fetch or decode. Store0 gets SSID X.</li>
<li><strong>LFST read:</strong> LFST[X] is invalid, so store0 depends on no earlier store.</li>
<li><strong>LFST write:</strong> store0 writes its inum into LFST[X]. The paper defines an inum as "a hardware pointer that uniquely identifies the instance of each instruction in flight", and a ROB index fits. The write doesn't happen at fetch, before store0 has an inum. It happens in the stage that assigns inums, in program order. A ROB index is known at allocation, because the ROB fills in order: the slots of a rename group get tail, tail + 1, and so on.</li>
</ul>
<p><strong>A load in the same rename group.</strong> If store0 and load0 are renamed in the same cycle, load0 can't read store0's inum from the LFST, because store0 is writing it in that same cycle. The paper doesn't cover this. Rename needs a check inside the group, built the same way as the check that finds register dependences between instructions renamed together. For each load or store in slot j, the logic:</p>
<ol>
<li>Compares slot j's SSID with the SSID of every older slot in the group that holds a store. A 4-wide group has 6 pairs of slots, so it needs 6 comparators of 7 bits each.</li>
<li>Picks the youngest matching older slot with a priority encoder. That store is the last fetched store of the set as slot j sees it.</li>
<li>Chooses the dependence with a mux: the matching slot's inum (tail + its slot number) if there is a match, and otherwise the value read from LFST[SSID].</li>
<li>Writes the LFST once per set. If two stores of one set are in the group, only the younger one writes its inum, the same way only the youngest writer of an architectural register updates the RAT.</li>
</ol>
<p>Stores use the same logic to find the older store they chain behind. The figure shows the check for load0 in slot 2, with the ROB tail at entry 40:</p>
<div class="tbl"><svg viewBox="0 0 680 340" role="img" aria-label="Same-group check for load0. A rename group holds store0 in slot 0 with SSID X and inum 40, an add in slot 1 with no SSID and inum 41, load0 in slot 2 with SSID X and inum 42, and load9 in slot 3 with SSID Y and inum 43. Load0's SSID is compared with slot 0 and slot 1. Slot 0 is a store with SSID X, so it matches. Slot 1 does not. A priority select picks slot 0, the youngest older match. The LFST read for X returns invalid. A mux picks the bypassed inum 40 over the LFST value, so load0 depends on inum 40. Separately, store0 writes inum 40 into LFST X, and if two stores of one set are in a group only the younger writes.">
<defs><marker id="arrMD1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Rename group, ROB tail = 40 (each slot's inum is tail + slot number)</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="10" y="28" width="159" height="64" rx="3"/><rect x="177" y="28" width="159" height="64" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="344" y="28" width="159" height="64" rx="3"/><rect x="511" y="28" width="159" height="64" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="89" y="48" style="font-weight:600">Slot 0: store0</text><text x="89" y="65">SSID X</text><text x="89" y="82">inum 40</text>
<text x="256" y="48" style="font-weight:600">Slot 1: add</text><text x="256" y="65">no SSID</text><text x="256" y="82">inum 41</text>
<text x="423" y="48" style="font-weight:600">Slot 2: load0</text><text x="423" y="65">SSID X</text><text x="423" y="82">inum 42</text>
<text x="590" y="48" style="font-weight:600">Slot 3: load9</text><text x="590" y="65">SSID Y</text><text x="590" y="82">inum 43</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M60,92 V124" marker-end="url(#arrMD1)"/><path d="M230,92 V124" marker-end="url(#arrMD1)"/>
<path d="M400,92 V110 H120 V124" marker-end="url(#arrMD1)"/><path d="M300,110 V124" marker-end="url(#arrMD1)"/>
<path d="M470,92 V124" marker-end="url(#arrMD1)"/>
<path d="M90,168 V198" marker-end="url(#arrMD1)"/><path d="M270,168 V198" marker-end="url(#arrMD1)"/>
<path d="M520,168 V260" marker-end="url(#arrMD1)"/>
<path d="M350,218 H460 V260" marker-end="url(#arrMD1)"/>
<path d="M490,296 V314" marker-end="url(#arrMD1)"/>
</g>
<text x="310" y="105" style="fill:var(--muted);font-size:11px">load0's SSID X</text>
<g style="stroke-width:1.5">
<rect x="10" y="126" width="160" height="42" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="190" y="126" width="160" height="42" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="400" y="126" width="160" height="42" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="10" y="200" width="340" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="10" y="262" width="340" height="56" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<path d="M420,262 H560 L540,296 H440 Z" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="90" y="143">Slot 0 a store with</text><text x="90" y="159">SSID X? Yes</text>
<text x="270" y="143">Slot 1 a store with</text><text x="270" y="159">SSID X? No</text>
<text x="480" y="143">LFST[X] read</text><text x="480" y="159">invalid</text>
<text x="180" y="223">Priority select: youngest older match is slot 0</text>
<text x="490" y="284">mux</text>
<text x="180" y="280">LFST write: LFST[X] gets inum 40 (store0)</text>
<text x="180" y="296">With two stores of one set in a group,</text>
<text x="180" y="311">only the younger one writes</text>
<text x="490" y="332" style="font-weight:600">load0 depends on inum 40</text>
</g>
<text x="358" y="212" style="fill:var(--muted);font-size:11px">match, inum 40</text>
</svg></div>
</li>
<li><strong>Load0 is renamed and dispatched.</strong> It reads SSIT[load0 PC] and gets X, then reads LFST[X] (or the bypass) and gets store0's inum, 40. The paper says only that the scheduler imposes the dependence "in a similar manner to the way it imposes register dependence constraints", and that each load specifies exactly one dependence. That one-dependence rule keeps the hardware cheap. The usual design gives each issue queue entry one extra source field for a store inum, with a valid bit and a ready bit, next to the two register source tags. The figure shows the queue just after load0 is dispatched. Store0 is still waiting for its data register p17, so load0's mem ready bit is 0.
<div class="tbl"><svg viewBox="0 0 680 400" role="img" aria-label="The issue queue and its neighbors. Rename and allocate, which holds the RAT, SSIT, and LFST, allocates ROB entry 42 for load0 and dispatches entries into the issue queue. Each entry has fields v, op, dest, src1 with ready bit r, src2 with ready bit r, mem, mv, mr, and inum. Store0, inum 40, has src1 p12 ready, src2 p17 not ready, and no mem dependence. An add, inum 41, has dest p20, src1 p5 ready, src2 p6 not ready. Load0, inum 42, has dest p21, src1 p12 ready, mem 40 with mv 1 and mr 0. Ready entries send requests to select logic, which grants them. Granted entries go to payload RAM and register file read, then execute in ALUs and AGUs, then loads and stores enter the load and store queues. Select drives the wakeup buses, carrying destination tags and store inums, back to every issue queue entry.">
<defs><marker id="arrMD2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M610,40 V24 H350 V38" marker-end="url(#arrMD2)"/>
<path d="M80,110 V148" marker-end="url(#arrMD2)"/>
<path d="M150,75 H168" marker-end="url(#arrMD2)"/>
<path d="M530,56 H548" marker-end="url(#arrMD2)"/><path d="M550,74 H532" marker-end="url(#arrMD2)"/>
<path d="M610,84 V102" marker-end="url(#arrMD2)"/><path d="M610,148 V166" marker-end="url(#arrMD2)"/><path d="M610,212 V230" marker-end="url(#arrMD2)"/>
</g>
<text x="360" y="18" style="fill:var(--muted);font-size:11px">wakeup buses: destination tags and store inums</text>
<g style="stroke-width:1.5">
<rect x="10" y="40" width="140" height="70" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="10" y="150" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="170" y="40" width="360" height="170" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="550" y="40" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="104" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="168" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="232" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<rect x="392" y="66" width="84" height="116" style="fill:var(--pad-soft);stroke:none"/>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M178,86 H514 M178,110 H514 M178,134 H514 M178,158 H514"/>
<path d="M196,66 V182 M240,66 V182 M276,66 V182 M316,66 V182 M334,66 V182 M374,66 V182 M392,66 V182 M432,66 V182 M454,66 V182 M476,66 V182"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="80" y="62" style="font-weight:600">Rename and</text><text x="80" y="78" style="font-weight:600">allocate</text><text x="80" y="98">RAT, SSIT, LFST</text>
<text x="80" y="173" style="font-weight:600">ROB</text><text x="80" y="192">entry 42: load0</text>
<text x="610" y="66" style="font-weight:600">Select logic</text>
<text x="610" y="122">Payload RAM,</text><text x="610" y="138">register read</text>
<text x="610" y="186" style="font-weight:600">Execute</text><text x="610" y="202">ALUs, AGUs</text>
<text x="610" y="250">Load and</text><text x="610" y="266">store queues</text>
</g>
<text x="178" y="58" style="fill:var(--pad);font-size:12px;font-weight:600">Issue queue</text>
<g style="fill:var(--muted);font-size:10px;font-weight:600" text-anchor="middle">
<text x="187" y="80">v</text><text x="218" y="80">op</text><text x="258" y="80">dest</text><text x="296" y="80">src1</text><text x="325" y="80">r</text><text x="354" y="80">src2</text><text x="383" y="80">r</text><text x="412" y="80">mem</text><text x="443" y="80">mv</text><text x="465" y="80">mr</text><text x="495" y="80">inum</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="187" y="102">1</text><text x="218" y="102">st</text><text x="258" y="102">-</text><text x="296" y="102">p12</text><text x="325" y="102">1</text><text x="354" y="102">p17</text><text x="383" y="102">0</text><text x="412" y="102">-</text><text x="443" y="102">0</text><text x="465" y="102">-</text><text x="495" y="102">40</text>
<text x="187" y="126">1</text><text x="218" y="126">add</text><text x="258" y="126">p20</text><text x="296" y="126">p5</text><text x="325" y="126">1</text><text x="354" y="126">p6</text><text x="383" y="126">0</text><text x="412" y="126">-</text><text x="443" y="126">0</text><text x="465" y="126">-</text><text x="495" y="126">41</text>
<text x="187" y="150">1</text><text x="218" y="150">ld</text><text x="258" y="150">p21</text><text x="296" y="150">p12</text><text x="325" y="150">1</text><text x="354" y="150">-</text><text x="383" y="150">-</text><text x="412" y="150">40</text><text x="443" y="150">1</text><text x="465" y="150">0</text><text x="495" y="150">42</text>
<text x="346" y="176">...</text>
</g>
<text x="178" y="200" style="fill:var(--muted);font-size:11px">store0's data p17 isn't ready, so load0 waits (mr = 0)</text>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="300">v: entry valid</text>
<text x="10" y="318">op: operation</text>
<text x="10" y="336">dest: destination physical register</text>
<text x="10" y="354">src1, src2: source physical register tags</text>
<text x="10" y="372">r: that source's ready bit</text>
<text x="300" y="300">mem: inum of the store to wait for (from the LFST)</text>
<text x="300" y="318">mv: mem valid (a store dependence was predicted)</text>
<text x="300" y="336">mr: mem ready (that store has issued)</text>
<text x="300" y="354">inum: this entry's own ROB index</text>
<text x="300" y="372">Requests select when both r = 1 and (mv = 0 or mr = 1)</text>
</g>
</svg></div>
<p>Around the queue, rename allocates the ROB entry (whose index is the inum) and a load or store queue entry, then dispatches the instruction into a free queue entry. Every cycle, entries whose operands are all ready send requests to select, and select grants the oldest few. Granted entries read their operands from the payload RAM and register file, execute, and loads and stores then work in the load and store queues. Select also drives the wakeup buses back to every entry, which is how waiting entries learn that their producers have issued.</p>
</li>
<li><strong>Load1 is fetched and renamed, later.</strong> It reads SSIT[load1 PC], gets X, reads LFST[X], and gets the same inum, 40. Its entry looks like load0's, with mem = 40, mv = 1, and mr = 0. Loads only read the LFST and never write it, so any number of loads can wait on one store, each holding its own copy of the tag. This is why merging works with such simple tables.</li>
<li><strong>Store0 issues.</strong> The loads wait for the store to <em>issue</em>, not to complete or commit. In the paper's model, a store issues once its address and data registers are both ready. Here that happens when p17 arrives. Three things follow.
<ul>
<li><strong>Broadcast:</strong> the paper doesn't describe it beyond the comparison with register dependences. In the usual design, select places store0's inum on a tag bus, just as it places an ALU instruction's destination tag. The bus wires run past every entry in the queue, because in a unified queue any entry can hold a load or store. Each entry compares the bus tag with its mem field and ANDs the result with mv and the bus valid bit, so only entries with a predicted store dependence can set mr. Every other entry, including all non-memory instructions, ignores the bus. Cores with a separate scheduler for memory operations put these comparators only in that scheduler.</li>
<li><strong>Which wires:</strong> either a separate memory tag bus, with one extra comparator per entry, or the existing register tag buses. A store writes no register, so its slot on the register bus is free, and a type bit tells the entries whether the tag is a physical register or an inum. A scheduler built as a dependence matrix instead raises the store's column wire, and no comparator is needed.</li>
<li><strong>Dependents of the loads:</strong> an instruction that uses load0's result doesn't get a memory bit. It waits on load0's destination tag, p21, through ordinary register wakeup when load0 is scheduled. The memory dependence links only the store and the loads that predicted it.</li>
</ul>
<p>The figure shows the broadcast reaching four entries:</p>
<div class="tbl"><svg viewBox="0 0 680 320" role="img" aria-label="Store0's inum broadcast. Select logic grants store0 and drives inum 40 onto a memory tag bus that runs past four issue queue entries. Load0, inum 42, holds mem 40 and mv 1, so its comparator matches, the AND with mv passes, and mr is set to 1, making load0 ready. Load1, inum 47, holds mem 40 and mv 1, so mr is set to 1, but it still waits for its address register p30. An add, inum 44, has mv 0, so the comparator result is ignored and it waits only on registers. Store8, inum 45, from another set, holds mem 38 and mv 1, so its comparator does not match and mr stays 0.">
<defs><marker id="arrMD3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:4 3"><rect x="130" y="2" width="120" height="292" rx="4"/><rect x="260" y="2" width="120" height="292" rx="4"/><rect x="390" y="2" width="120" height="292" rx="4"/><rect x="520" y="2" width="120" height="292" rx="4"/></g>
<rect x="10" y="50" width="110" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="65" y="68" style="font-weight:600">Select logic</text><text x="65" y="84">grants store0</text></g>
<path d="M120,72 H660" style="fill:none;stroke:var(--trace);stroke-width:3"/>
<text x="130" y="64" style="fill:var(--trace);font-size:11px;font-weight:600">memory tag bus: inum 40, valid</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M142,72 V140 H158" marker-end="url(#arrMD3)"/><path d="M272,72 V140 H288" marker-end="url(#arrMD3)"/><path d="M402,72 V140 H418" marker-end="url(#arrMD3)"/><path d="M532,72 V140 H548" marker-end="url(#arrMD3)"/>
<path d="M171,112 V125" marker-end="url(#arrMD3)"/><path d="M301,112 V125" marker-end="url(#arrMD3)"/><path d="M431,112 V125" marker-end="url(#arrMD3)"/><path d="M561,112 V125" marker-end="url(#arrMD3)"/>
<path d="M171,153 V166" marker-end="url(#arrMD3)"/><path d="M301,153 V166" marker-end="url(#arrMD3)"/><path d="M431,153 V166" marker-end="url(#arrMD3)"/><path d="M561,153 V166" marker-end="url(#arrMD3)"/>
<path d="M217,112 V166" marker-end="url(#arrMD3)"/><path d="M347,112 V166" marker-end="url(#arrMD3)"/><path d="M477,112 V166" marker-end="url(#arrMD3)"/><path d="M607,112 V166" marker-end="url(#arrMD3)"/>
<path d="M190,192 V208" marker-end="url(#arrMD3)"/><path d="M320,192 V208" marker-end="url(#arrMD3)"/><path d="M450,192 V208" marker-end="url(#arrMD3)"/><path d="M580,192 V208" marker-end="url(#arrMD3)"/>
<path d="M190,236 V252" marker-end="url(#arrMD3)"/><path d="M320,236 V252" marker-end="url(#arrMD3)"/><path d="M450,236 V252" marker-end="url(#arrMD3)"/><path d="M580,236 V252" marker-end="url(#arrMD3)"/>
</g>
<g style="stroke-width:1.5">
<rect x="135" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="265" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="395" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="525" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1">
<rect x="150" y="86" width="44" height="26" rx="2"/><rect x="200" y="86" width="34" height="26" rx="2"/>
<rect x="280" y="86" width="44" height="26" rx="2"/><rect x="330" y="86" width="34" height="26" rx="2"/>
<rect x="410" y="86" width="44" height="26" rx="2"/><rect x="460" y="86" width="34" height="26" rx="2"/>
<rect x="540" y="86" width="44" height="26" rx="2"/><rect x="590" y="86" width="34" height="26" rx="2"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<circle cx="171" cy="140" r="13"/><circle cx="301" cy="140" r="13"/><circle cx="431" cy="140" r="13"/><circle cx="561" cy="140" r="13"/>
<rect x="150" y="168" width="84" height="24" rx="3"/><rect x="280" y="168" width="84" height="24" rx="3"/><rect x="410" y="168" width="84" height="24" rx="3"/><rect x="540" y="168" width="84" height="24" rx="3"/>
</g>
<g style="stroke-width:1.5">
<rect x="140" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="270" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="400" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="530" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="190" y="30" style="font-weight:600">load0, inum 42</text><text x="320" y="30" style="font-weight:600">load1, inum 47</text><text x="450" y="30" style="font-weight:600">add, inum 44</text><text x="580" y="30" style="font-weight:600">store8, inum 45</text>
<g style="font-family:var(--mono);font-size:11px"><text x="172" y="103">40</text><text x="217" y="103">1</text><text x="302" y="103">40</text><text x="347" y="103">1</text><text x="432" y="103">-</text><text x="477" y="103">0</text><text x="562" y="103">38</text><text x="607" y="103">1</text></g>
<text x="171" y="144">=</text><text x="301" y="144">=</text><text x="431" y="144">=</text><text x="561" y="144">=</text>
<g style="font-size:11px"><text x="192" y="184">AND mv</text><text x="322" y="184">AND mv</text><text x="452" y="184">AND mv</text><text x="582" y="184">AND mv</text></g>
<text x="190" y="228">mr = 1</text><text x="320" y="228">mr = 1</text><text x="450" y="228">unused</text><text x="580" y="228">mr stays 0</text>
</g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle">
<text x="190" y="268">ready: requests</text><text x="190" y="283">select next cycle</text>
<text x="320" y="268">still waits for</text><text x="320" y="283">address reg p30</text>
<text x="450" y="268">waits only on</text><text x="450" y="283">its registers</text>
<text x="580" y="268">waits for</text><text x="580" y="283">store inum 38</text>
</g>
<text x="10" y="312" style="fill:var(--muted);font-size:11px">In each entry: mem (left box) and mv (right box). This comparator sits beside the entry's 2 register-tag comparators.</text>
</svg></div>
<ul>
<li><strong>LFST invalidation:</strong> "After a store instruction issues, it accesses the LFST and invalidates the entry if it still refers to itself." A load fetched after this sees no valid store and doesn't wait. If a newer store of set X had already overwritten the entry, the entry stays, so later loads wait for that newer store.</li>
</ul>
<p><strong>Split stores.</strong> Many cores, Intel's since the P6, split a store into a store-address µop (STA) and a store-data µop (STD) that issue independently. The paper's footnote says it doesn't model this. A load that predicted a dependence almost always reads the bytes the store writes, so it needs both halves: the address to match the store in the store queue, and the data to forward. Waiting on both separately would take two mem fields and two comparators per entry, the extra scheduler cost the one-dependence rule avoids. Two designs keep one tag per load:</p>
<ul>
<li><strong>Wake on the later half:</strong> the store queue entry has an address-valid bit and a data-valid bit. When the second of the two is set, the store queue broadcasts the store's inum. The load still has one mem field and one comparator, and it issues only once forwarding can succeed.</li>
<li><strong>Wake on the STA, then block:</strong> the load waits only for the store address. Once it issues, the store queue search tells it whether it really aliases. If it doesn't, it reads the cache and is done, so false dependences cost less. If it does and the data isn't ready, the load can't forward. It is blocked in the load queue until the STD writes the data, then reissues. The cost is that reissue for loads that truly alias.</li>
</ul>
</li>
</ol>

<h3 id="sec-assignment">Store Set Assignment and Merging</h3>
<p>When a violation hits a store that already has a valid SSID, what should happen? If the store simply takes the load's SSID, overwriting its old one, it leaves its old set. Two loads that depend on the same store can then fight over it, much like two addresses thrashing in one cache set. The paper's example:</p>
<ul>
<li>Load PC 1's set is {store PC X, store PC Y, store PC Z}</li>
<li>Load PC 2's set is {store PC J, store PC K}</li>
</ul>
<p>Now load PC 1 violates with store PC J. Store J moves into set 1, which removes it from set 2. The next time load PC 2 runs, nothing makes it wait for store J, so it violates with J and pulls J back into set 2. Then load PC 1 violates again, and so on. The two loads take turns trapping forever, and the predictor never stabilizes. This is <strong>oscillation</strong>.</p>
<p>The fix is a set of <strong>store set assignment rules</strong>, applied when a store-load pair causes a violation:</p>
<ol>
<li>If neither the load nor the store has a store set, allocate one and assign it to both.</li>
<li>If the load has a store set and the store doesn't, the store joins the load's set.</li>
<li>If the store has a store set and the load doesn't, the load joins the store's set.</li>
<li>If both have store sets, declare one set the "winner." Whichever of the two instructions belongs to the loser's set is moved into the winner's set.</li>
</ol>
<p>Rule 4 needs an arbitration that always picks the same winner between the same two sets. The paper picks the set with the smaller SSID. With this rule, oscillation becomes <strong>merging</strong>. Walking through the example again with set 1 as the winner:</p>
<ol>
<li>Load PC 1 violates with store J (in set 2). Rule 4: set 1 wins, so store J moves to set 1.</li>
<li>Load PC 2 violates with store J (now in set 1). Rule 4 again: set 1 wins again, so this time load PC 2 moves to set 1.</li>
<li>Load PC 2 later violates with store K, which is still alone in set 2 (no load points to it). Set 1 wins, so K moves to set 1.</li>
<li>Now both loads and all of their stores are in set 1, and no more violations happen.</li>
</ol>
<p>The sets converge after a fixed number of traps. Merging can add false dependences, since load PC 1 now also waits for stores J and K. The paper found no measurable cost from this. Without merging (each store simply takes the SSID of the latest load it violated with), IPC drops by an average of 12%. Examples from the paper's Figure 6.2, read from the chart:</p>
<ul>
<li>perl (primes): about 3.5 IPC without merging vs. 5.1 with it</li>
<li>wave5: about 2.6 IPC vs. 3.7</li>
<li>xlisp: about 2.9 IPC vs. 3.4</li>
</ul>

<h3 id="sec-feedback">Clearing Stale Entries</h3>
<p>The SSIT only ever gains valid entries. Since it has no tags, every load and store that indexes an entry uses whatever it finds there. That causes two problems:</p>
<ul>
<li><strong>Aliasing:</strong> a load that needs a store set and one that doesn't can map to the same entry, so the second one picks up false dependences.</li>
<li><strong>Staleness:</strong> with nothing to invalidate entries, the whole SSIT eventually fills with valid SSIDs, and those impose essentially random ordering on whatever program runs later.</li>
</ul>
<p>As with the infinite predictor, the answer is to track a working set. The paper tried two methods:</p>
<ol>
<li><strong>Cyclic clearing:</strong> every so often (every 1,000,000 cycles in the experiments), clear all SSIT valid bits, and the table retrains from scratch. Each real dependence then costs one violation to relearn, which is cheap at this interval.</li>
<li><strong>2-bit counters:</strong> one per SSIT entry, used only by store entries as in the infinite predictor. A store's counter starts at its maximum when it first gets an SSIT entry, and dependences are enforced while the high bit is set. When the scheduler enforces a predicted dependence, the store and load addresses are compared: no overlap decrements the counter, overlap increments it.</li>
</ol>
<p>With large tables (16K SSIT entries and 512 LFST entries), the counters reduced applu's false dependences, but xlisp got worse instead of better. This is destructive aliasing: a load that doesn't need a set decrements the counter in an SSIT entry that another load relies on, so that load's real dependence stops being enforced and its violations come back. xlisp loses about as much as applu gains, and the counters need extra storage plus address comparators, so the paper uses cyclic clearing. That needs only two counters: one that times the clearing interval and one that sweeps through the SSIT, invalidating entries.</p>

<h3 id="sec-table-sizes">Table Sizes</h3>
<p>All size experiments use cyclic clearing. Performance is relative to the large configuration of 16K SSIT entries and 512 LFST entries. Values below are read from the paper's charts.</p>
<p><strong>SSIT size</strong> (LFST kept large), Figure 6.4:</p>
<div class="tbl"><table>
<tr><th>SSIT entries</th><th>8K</th><th>4K</th><th>2K</th><th>1K</th><th>512</th><th>256</th><th>128</th></tr>
<tr><td>Integer average</td><td>1.00</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.97</td><td>≈ 0.94</td><td>≈ 0.82</td></tr>
<tr><td>Floating-point average</td><td>1.00</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.97</td><td>≈ 0.88</td><td>≈ 0.77</td></tr>
<tr><td>Worst program</td><td>1.00</td><td>1.00</td><td>≈ 0.96</td><td>≈ 0.95</td><td>≈ 0.87</td><td>≈ 0.59</td><td>≈ 0.46</td></tr>
</table></div>
<p>A 4K-entry SSIT costs nothing, and 1K entries are still acceptable. The program most sensitive to SSIT size is fpppp (Figure 6.5). Its false dependences go from almost none at 4K entries to about 28 per 1,000 instructions at 512 and about 215 per 1,000 instructions at 128. Its IPC falls to about 0.46 of the large table's, close to the no-speculation level from the bounds section. The cause is aliasing: in a small untagged SSIT, loads and stores that need no ordering share entries with ones that do. Tags would let the SSIT shrink, at the cost of a tag array and comparators.</p>
<p><strong>LFST size</strong> (SSIT kept large), Figure 6.6:</p>
<div class="tbl"><table>
<tr><th>LFST entries</th><th>128</th><th>64</th><th>32</th><th>16</th><th>8</th><th>4</th><th>2</th></tr>
<tr><td>Integer average</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.98</td><td>≈ 0.96</td><td>≈ 0.95</td><td>≈ 0.90</td></tr>
<tr><td>Worst program</td><td>1.00</td><td>≈ 0.96</td><td>≈ 0.96</td><td>≈ 0.91</td><td>≈ 0.85</td><td>≈ 0.82</td><td>≈ 0.70</td></tr>
</table></div>
<p>The LFST can be much smaller than the SSIT. Fewer LFST entries means fewer distinct store sets, so unrelated loads and stores share sets. But two loads that share an SSID only collide if their stores are in flight at the same time, and often they aren't. 128 entries give full performance, which also makes each SSID only 7 bits (128 sets = 2<sup>7</sup>), so the SSIT shrinks too.</p>
<p><strong>The final design:</strong> a 4K-entry SSIT, a 128-entry LFST, and clearing the SSIT every 1,000,000 cycles. Each SSIT entry holds a 7-bit SSID plus a valid bit, so the SSIT holds 4,096 entries × (7 bits + 1 bit) = 32,768 bits = 4 KB (my arithmetic, the paper gives entry counts only). Compared with perfect prediction (Figure 6.7), every program is close except applu, which loses 14% because the design has no 2-bit counters. Compared with a 32K-entry store barrier cache (one entry per possible store in a 128 KB instruction cache), store sets are 34% faster on average and up to 100% faster. Approximate IPC from the chart:</p>
<div class="tbl"><table>
<tr><th>Program</th><th>Store barrier cache (IPC)</th><th>Store sets (IPC)</th><th>Perfect (IPC)</th></tr>
<tr><td>fpppp</td><td>≈ 3.5</td><td>≈ 5.6</td><td>≈ 5.7</td></tr>
<tr><td>ijpeg</td><td>≈ 2.2</td><td>≈ 4.3</td><td>≈ 4.6</td></tr>
<tr><td>wave5</td><td>≈ 2.2</td><td>≈ 3.7</td><td>≈ 3.7</td></tr>
<tr><td>applu</td><td>≈ 1.8</td><td>≈ 2.8</td><td>≈ 3.3</td></tr>
</table></div>

<h3 id="sec-applu">Where Store Sets Fall Short</h3>
<p>applu shows the limit of the approach. Under infinite store sets it had many false dependences, and even with 2-bit counters it kept some false dependences plus about 1.75 violations per 1,000 instructions. That's a small rate, but each trap is expensive. Nearly all of these events came from a few loads with a <em>recurring pattern</em> of dependence. The loop, from applu's routines blts and buts:</p>
<pre><code>do ip = 1, 4
  tmp1 = 1.0d+00 / tmat(ip,ip)
  do m = ip+1, 5
    tmp = tmp1 * tmat(m,ip)
    do l = ip+1, 5
      tmat(m,l) = tmat(m,l) - tmp * tmat(ip,l)</code></pre>
<p>In the innermost statement, the store to <code>tmat(m,l)</code> (PC B) and the load of <code>tmat(ip,l)</code> (PC A) sometimes touch the same element. With ip = 3, the inner loops produce this order of dynamic instances:</p>
<div class="tbl"><table>
<tr><th>PC</th><th>Access</th><th>Iteration</th></tr>
<tr><td>A</td><td>load tmat(3,4)</td><td>ip = 3, m = 4, l = 4 (V)</td></tr>
<tr><td>B</td><td>store tmat(4,4)</td><td>V</td></tr>
<tr><td>A</td><td>load tmat(3,5)</td><td>ip = 3, m = 4, l = 5 (W)</td></tr>
<tr><td>B</td><td>store tmat(4,5)</td><td>W</td></tr>
<tr><td>A</td><td>load tmat(3,4)</td><td>ip = 3, m = 5, l = 4 (X)</td></tr>
<tr><td>B</td><td>store tmat(5,4)</td><td>X</td></tr>
<tr><td>A</td><td>load tmat(3,5)</td><td>ip = 3, m = 5, l = 5 (Y)</td></tr>
<tr><td>B</td><td>store tmat(5,5)</td><td>Y</td></tr>
<tr><td>A</td><td>load tmat(4,5)</td><td>ip = 4, m = 5, l = 5 (Z)</td></tr>
<tr><td>B</td><td>store tmat(5,5)</td><td>Z</td></tr>
</table></div>
<p>The load in iteration Z reads tmat(4,5), which the store in iteration W wrote. Many iterations are in flight at once, so if those two run out of order, there's a violation, and store PC B joins load PC A's store set. From then on, every instance of load A waits for the most recent in-flight instance of store B, even though only a few specific iterations actually depend on each other. Store sets know only PCs, not which dynamic instance or iteration distance matters. The loop gets serialized and runs about 2× slower than with perfect prediction.</p>
<p>The paper offers two ways out:</p>
<ul>
<li><strong>Compiler:</strong> fully unroll the triply nested loop. Each load and store in each iteration then has its own PC, so a load's set holds exactly the store it conflicts with. After manual unrolling, applu matched perfect prediction.</li>
<li><strong>Hardware (future work):</strong> a predictor that learns patterns of which instances conflict. Moshovos et al.'s scheme already moves in this direction: it names a dependence by its store-load pair plus the dynamic distance between instances, instead of by PC alone.</li>
</ul>

<h3 id="sec-takeaways">Takeaways</h3>
<ul>
<li>Not speculating costs up to more than 2× in run time from false dependences, and naive speculation leaves much of the gap open because of violation traps. The cost of both grows with window size.</li>
<li>Memory dependences come from a few static store-load pairs that repeat, so learning from past violations works.</li>
<li>A good predictor must let one load wait for several stores and several loads share one store. Dropping either costs up to about 45% run time on some programs.</li>
<li>The SSIT and LFST get both with direct-mapped tables. The tricks are one SSID per store, an in-order chain of stores within a set, and merging sets by the smaller SSID.</li>
<li>Untagged tables need a way to forget. Periodic clearing is cheap and works as well as per-entry confidence counters, which suffer from aliasing.</li>
<li>4K SSIT entries and 128 LFST entries got within a few percent of perfect on a 128-entry-window, 8-wide machine. The failure mode that's left is iteration-specific dependences, which PC-indexed sets serialize.</li>
</ul>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Moshovos, Breach, Vijaykumar, and Sohi, "Dynamic Speculation and Synchronization of Data Dependences," ISCA 1997 · Moshovos and Sohi, "Streamlining Inter-operation Memory Communication via Data Dependence Prediction," MICRO 1997 · Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997 · Compaq, Alpha 21264/EV67 Microprocessor Hardware Reference Manual (stWait table) · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>With store sets, load L (PC 0x40) causes a violation with store S (PC 0x80). Trace what happens the next time both are fetched.</p>`,
        a: `<ol><li>After the violation, the SSIT assigns both PCs the same set, say set 5.</li><li>S is fetched: it looks up set 5 and records itself in LFST[5] as the latest store of the set.</li><li>L is fetched: it looks up set 5, reads LFST[5], and takes a dependence on S.</li><li>L issues only after S issues. When S issues, LFST[5] is cleared if it still points to S.</li></ol>`
      },
      {
        q: `<p>A store set predictor uses the paper's assignment rules, with the smaller SSID winning rule 4. Two loads and three stores have these SSIT entries:</p><ul><li>Load L1 (PC 0x4a0) and store S1 (PC 0x400) have SSID 3</li><li>Load L2 (PC 0x4c8) and store S2 (PC 0x410) have SSID 9</li><li>Store S3 (PC 0x430) has SSID 9 too (it once conflicted with L2)</li></ul><p>Then these violations happen in order:</p><ol><li>L1 violates with S2</li><li>L2 violates with S2</li><li>L2 violates with S3</li></ol><p>Give the SSIDs after each violation. Then show what would happen if, instead, a store always took the SSID of the load it just violated with.</p>`,
        a: `<ol><li>L1 (SSID 3) violates with S2 (SSID 9). Both have sets, so rule 4 applies: SSID 3 wins over SSID 9. The instruction in the losing set, S2, moves to SSID 3. Now L1, S1, and S2 have SSID 3. L2 and S3 still have SSID 9.</li><li>L2 (SSID 9) violates with S2 (SSID 3). Rule 4 again picks SSID 3, so this time L2 moves to SSID 3. Now L1, L2, S1, and S2 have SSID 3, and S3 is the only instruction left with SSID 9.</li><li>L2 (SSID 3) violates with S3 (SSID 9). SSID 3 wins, so S3 moves to SSID 3. All five instructions are in one set, and both loads now wait for the last fetched of S1, S2, and S3. No further violations occur among them.</li><li>With "the store takes the load's SSID" instead: after violation 1, S2 has SSID 3. Violation 2 moves S2 back to SSID 9. The next instance of L1 no longer waits for S2, so it violates again and S2 returns to SSID 3, and so on. L1 and L2 take turns trapping on S2 forever. That's the oscillation the rules prevent.</li></ol>`
      },
      {
        q: `<p>A 6-wide core with a 352-entry ROB runs a workload. With perfect memory dependence prediction, its CPI is 0.40 cycles/instruction. Three alternatives were measured:</p><ul><li><strong>Naive speculation:</strong> 2.6 violations per 1,000 instructions, each costing 26 cycles from the load's first fetch to its refetch</li><li><strong>No speculation:</strong> 140 false dependences per 1,000 instructions. 30% of them are on the critical path, and each of those delays it by 9 cycles on average</li><li><strong>Store sets:</strong> 0.05 violations per 1,000 instructions at 26 cycles each, plus 4 false dependences per 1,000 instructions with the same 30% critical fraction and 9-cycle delay</li></ul><p>Assume the penalties add to the perfect CPI with no overlap. Find the CPI of each policy and its slowdown relative to perfect.</p>`,
        a: `<ol><li>Naive speculation: CPI = 0.40 cycles/instruction + (2.6 violations / 1,000 instructions) × 26 cycles/violation = 0.40 cycles/instruction + 0.0676 cycles/instruction = <strong>0.4676 cycles/instruction</strong>, which is 0.4676 / 0.40 = 1.169, so <strong>16.9% slower</strong>.</li><li>No speculation: CPI = 0.40 cycles/instruction + (140 false dependences / 1,000 instructions) × 0.30 × 9 cycles/false dependence = 0.40 cycles/instruction + 0.378 cycles/instruction = <strong>0.778 cycles/instruction</strong>, which is 0.778 / 0.40 = 1.945, so <strong>94.5% slower</strong>.</li><li>Store sets: CPI = 0.40 cycles/instruction + (0.05 violations / 1,000 instructions) × 26 cycles/violation + (4 false dependences / 1,000 instructions) × 0.30 × 9 cycles/false dependence = 0.40 cycles/instruction + 0.0013 cycles/instruction + 0.0108 cycles/instruction = <strong>0.4121 cycles/instruction</strong>, which is 0.4121 / 0.40 = 1.030, so <strong>3.0% slower</strong>.</li><li>The pattern matches the paper. No speculation is the worst, naive speculation leaves a noticeable gap, and a predictor gets most of the way to perfect by trading a large drop in violations for a few false dependences.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your new predictor cuts ordering violations by 80% but IPC drops 1%. What happened?</p>`,
        a: `<p>Probably false dependences: loads waiting for stores they never alias with. Measure loads delayed by the predictor whose store didn't actually overlap. Likely causes are PC aliasing in the tables, store sets merging into large sets, or no periodic clearing, so old conflicts keep loads conservative forever.</p>`
      },
      {
        q: `<p>A core uses a 2,048-entry, 1-bit wait table indexed by load PC and cleared every 32,768 cycles. A flagged load waits for all older stores. The next generation grows the ROB from 224 to 512 entries and the store queue from 72 to 114 entries. Simulation shows memory-order violations rising from 0.3 to 1.1 per 1,000 instructions, and the IPC gain is well below what the larger window should give. Explain both effects and propose a change.</p>`,
        a: `<p>Violations rise because a larger window exposes store-load pairs that are farther apart. A pair can conflict only if both are in flight together, and Moshovos et al. found the count of such dependences keeps rising as the window grows into the hundreds of instructions. Each violation also costs more, since more younger work is squashed and refilling a 512-entry window takes longer.</p><p>The IPC shortfall has a second cause: the wait table's remedy also gets worse. A flagged load waits for every older store, and with up to 114 stores in flight it often waits behind dozens of unrelated ones. That's Moshovos's WAIT policy, which can lose even to blind speculation when the producing store is far away. A 32,768-cycle clear also means a single conflict flags the load for a long time.</p><p>The fix is a predictor that names the store: store sets (SSIT plus LFST) or a store-distance predictor, so a flagged load waits only for the latest in-flight store of its set. Size the SSIT for the larger number of static pairs a bigger window exposes. Then measure false dependences on the critical path, not just violation counts.</p>`
      },
      {
        q: `<p>Size a store set predictor for a core with a 256-entry ROB, where an inum is the 8-bit ROB index. The SSIT has 2,048 entries and the LFST has 64 entries. Each entry in both tables has a valid bit. How many bytes do the SSIT and LFST need? Compare that with a 2,048-entry, 1-bit wait table, and explain what happens if you cut the SSIT to 256 entries to save area.</p>`,
        a: `<ol><li>The SSID must name one of 64 LFST entries: log<sub>2</sub>(64 entries) = 6 bits.</li><li>SSIT: 2,048 entries × (6 bits + 1 valid bit) = 14,336 bits = 14,336 bits / 8 bits/byte = <strong>1,792 bytes</strong>.</li><li>LFST: 64 entries × (8 bits + 1 valid bit) = 576 bits = 576 bits / 8 bits/byte = <strong>72 bytes</strong>.</li><li>Total: 1,792 bytes + 72 bytes = <strong>1,864 bytes</strong>. The wait table is 2,048 entries × 1 bit = 2,048 bits = 2,048 bits / 8 bits/byte = <strong>256 bytes</strong>. So the store set predictor is about 7.3× larger, and it also needs an LFST read on fetch and an invalidate path on store issue.</li><li>Cutting the SSIT to 256 entries saves area, 256 entries × (6 bits + 1 valid bit) = 1,792 bits = 224 bytes, but the table is untagged. Many unrelated loads and stores then share entries and inherit SSIDs they don't need, so false dependences rise sharply. In the store sets paper, fpppp lost more than 40% of its IPC at 256 entries. If area must shrink, add partial tags or shrink the LFST first, since the LFST tolerates sharing much better.</li></ol>`
      },
      {
        q: `<p>A loop runs <code>for (i = 3; i &lt; n; i++) a[i] = a[i-3] * k;</code> on a core with a store set predictor. Each iteration's load-to-store chain takes 9 cycles (load-to-use plus multiply). Once the store has joined the load's store set, what is the steady-state throughput in iterations per cycle, and what would perfect prediction give? Assume no other limit applies.</p>`,
        a: `<ol><li>True dependences: the load in iteration i reads a[i-3], written by the store in iteration i-3. So there are 3 independent chains: i ≡ 0, 1, 2 (mod 3).</li><li>Perfect prediction: each load waits only for the store 3 iterations back. The 3 chains overlap, each finishing one iteration every 9 cycles, so throughput = 3 chains × 1 iteration / 9 cycles = <strong>0.333 iterations/cycle</strong>.</li><li>Store sets: the load and store have one SSID, and a load waits for the <em>last fetched</em> store of its set, which is the store from iteration i-1, not i-3. Every iteration now waits for the previous one: load i waits for store i-1, which waits for load i-1's value. That's one chain, so throughput = 1 iteration / 9 cycles = <strong>0.111 iterations/cycle</strong>, 3× slower.</li><li>This is the applu failure: the predictor knows which PCs conflict but not which instances. Fixes are unrolling by 3 (each copy gets its own PCs and its own set) or a predictor that records dependence distance.</li></ol>`
      },
      {
        q: `<p>A store set predictor clears its SSIT valid bits every T cycles. After each clear, 350 active store-load pairs must each cause one violation to relearn, at 24 cycles per violation. Find the overhead as a fraction of run time for T = 2,000,000 cycles and T = 50,000 cycles. What limits how large T can be?</p>`,
        a: `<ol><li>Relearning cost per clear: 350 pairs × 1 violation/pair × 24 cycles/violation = 8,400 cycles.</li><li>T = 2,000,000 cycles: 8,400 cycles / 2,000,000 cycles = <strong>0.42%</strong>.</li><li>T = 50,000 cycles: 8,400 cycles / 50,000 cycles = <strong>16.8%</strong>, far too high.</li><li>T can't grow without limit, because clearing is the only way stale entries leave the untagged SSIT. Between clears, pairs that stopped conflicting (a phase change, or a store that conflicts only rarely) and aliased entries keep adding false dependences. The best T balances that growing false-dependence cost against the relearning cost, which falls as 1/T. The paper's 1,000,000-cycle interval sits in that range for SPEC95.</li></ol>`
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
<p>Little's law shows the size of the cost. Occupancy equals dispatch rate × time per entry. Under early deallocation, time per entry is dispatch-to-issue, often a handful of cycles. Under replay-until-retire, it's dispatch-to-retire, which includes every cache miss ahead of the instruction in program order. The queue either grows, which hurts the wakeup and select timing loop, or fills and stalls dispatch. This is the argument Chrysos and Emer make on the <a href="#/mdp/bounds">Memory Dependence Prediction</a> page. They keep early deallocation and use a predictor good enough that violations, and their full squash cost, almost never happen.</p>
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
<li><strong>Memory dependence predictor:</strong> entries that point at squashed stores must be cleared or checked for validity, or a load could wait forever for a store that will never issue (see <a href="#/mdp/impl">The SSIT and LFST</a>).</li>
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
