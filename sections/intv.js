/* Section: CPU Performance Interview Prep (public).
   Reasoning questions for CPU modeling / performance architecture interviews.
   Every question is a card; the answer is hidden behind "Show answer".
   Questions are numbered from 0 within each page. */
(function () {
let QN = 0, QP = "";
const reset = page => { QN = 0; QP = page; return ""; };
const LVL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const Q = (q, a, lvl) => `
<div class="prob" data-qid="${QP}-${QN}"><div class="q"><p class="qn">Q${QN++}${lvl ? ` <span class="lvl ${lvl}">${LVL[lvl]}</span>` : ""}</p>${q}</div>
<details><summary>Show answer</summary><div class="a">${a}</div></details></div>`;

section({
  id: "intv",
  name: "CPU Performance Interview Prep",
  cap: "Reasoning questions for CPU modeling and performance architecture roles, with answers to reveal",
  sections: [
    { id: "how", label: "How to Use These Pages" },
    { id: "answer", label: "How to Answer Out Loud" },
    { id: "rate", label: "Rate Yourself" },
    { id: "order", label: "Study Order" },
    { id: "numbers", label: "Numbers Worth Knowing" }
  ],
  body: `
<h3 id="sec-how">How to Use These Pages</h3>
<p>Each page is one interview topic. Questions are written to test reasoning, not recall: most give you a scenario, a measurement, or a design change and ask what happens, why, and how you would prove it. Answer each one out loud before opening the answer. The answers are what a strong candidate would say, including the traps an interviewer is fishing for.</p>
<p>Questions are numbered from 0 on every page. Instructions in code examples are numbered from I0, and cycles from cycle 0.</p>

<h3 id="sec-answer">How to Answer Out Loud</h3>
<p>Aim for 30 to 90 seconds per question. For any performance question, use the same four beats:</p>
<ol start="0">
<li><strong>Predict:</strong> say what you expect to happen (faster, slower, no change, and roughly how much).</li>
<li><strong>Mechanism:</strong> explain the causal chain: which structure fills, which instruction waits on what.</li>
<li><strong>Conditions:</strong> say when your prediction would be wrong (what kind of workload, what other limit).</li>
<li><strong>Evidence:</strong> name the counter or experiment that would confirm or refute it.</li>
</ol>
<p class="callout">Interviewers for modeling roles care most about beat 3. “I’d expect X, and I’d check it with Y” beats a perfect definition.</p>

<h3 id="sec-rate">Rate Yourself</h3>
<ul>
<li><strong>Green:</strong> you can explain the mechanism, work an example, and discuss the performance consequences.</li>
<li><strong>Yellow:</strong> you know the concept but stumble on details or interactions. Spend most of your time here.</li>
<li><strong>Red:</strong> you can’t answer without looking it up. Fix these first if they are foundational (renaming, dependences, retirement, cache misses).</li>
</ul>
<p>Every question is tagged <strong>Easy</strong>, <strong>Medium</strong>, or <strong>Hard</strong>. Across the section the split is about 20% easy, 35% medium, and 45% hard, and each page follows roughly the same mix. Hard questions involve multi-step math, a trap, or an open-ended trade-off; the numbers in the trickiest answers were checked with a small cycle-level simulation or a script.</p>

<h3 id="sec-order">Study Order</h3>
<ol start="0">
<li><strong>Fundamentals:</strong> <a href="#/intv-pipeline">Pipeline Flow and Width</a>, <a href="#/intv-renaming">Renaming and Dependences</a>, <a href="#/intv-rob">The ROB and Retirement</a>, <a href="#/intv-sched">Scheduling and Execution</a>, <a href="#/intv-arith">Arithmetic and Floating Point</a>.</li>
<li><strong>Interactions:</strong> <a href="#/intv-branch">Branch Prediction and Speculation</a>, <a href="#/intv-lsq">Loads, Stores and Memory Ordering</a>, <a href="#/intv-diag">Diagnosing Bottlenecks</a>.</li>
<li><strong>Your own experience:</strong> <a href="#/intv-sim">Building a Performance Model in C</a>, <a href="#/intv-design">Open-Ended Design Problems</a>. Connect every answer here to a decision or bug from your own simulator.</li>
</ol>

<h3 id="sec-numbers">Numbers Worth Knowing</h3>
<p>Interview answers land better with real numbers. These are public figures for three well-documented cores; the questions on these pages use them.</p>
<div class="tbl"><table>
<tr><th></th><th>Intel Skylake (2015)</th><th>AMD Zen 4 (2022)</th><th>Intel Golden Cove (2021)</th></tr>
<tr><td>Rename / dispatch width</td><td>4</td><td>6</td><td>6</td></tr>
<tr><td>ROB entries</td><td>224</td><td>320</td><td>512</td></tr>
<tr><td>Load / store queue</td><td>72 / 56</td><td>88 / 64</td><td>192 / 114</td></tr>
<tr><td>Integer / FP physical registers</td><td>180 / 168</td><td>224 / 192</td><td>280 / 332</td></tr>
<tr><td>Loads per cycle</td><td>2</td><td>3</td><td>3</td></tr>
<tr><td>FMA units, latency</td><td>2, 4 cycles</td><td>2, 4 cycles</td><td>2, 4 cycles</td></tr>
<tr><td>L1D / L2 load-to-use</td><td>4–5 / about 12 cycles</td><td>4 / about 14 cycles</td><td>5 / about 15 cycles</td></tr>
</table></div>
<p>Rules of thumb: DRAM latency is about 80–100 ns, which is 400–500 cycles at 5 GHz. A branch misprediction costs about 15–20 cycles on recent big cores when the branch resolves promptly. A cache line is 64 bytes.</p>
<p class="refs">Sources:</p><ul class="refs"><li>Intel 64 and IA-32 Architectures Optimization Reference Manual</li><li>AMD Software Optimization Guide for the Zen 4 microarchitecture</li><li>Intel Architecture Day 2021</li><li>Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 3</li></ul>`
}, [
{
  id: "intv-pipeline",
  title: "Pipeline Flow and Width",
  sections: [
    { id: "order", label: "Stages and Ordering" },
    { id: "width", label: "Width and Throughput" },
    { id: "stalls", label: "Stalls, Flushes and Recovery" }
  ],
  body: reset("intv-pipeline") + `
<p>Background: <a href="#/pipelining">Pipelining and the Iron Law</a>, <a href="#/r/core">Out-of-Order Core</a>, <a href="#/stall-perf">Performance of Pipelines with Stalls</a>.</p>
<h3 id="sec-order">Stages and Ordering</h3>` +
Q(`<p>A 4-wide in-order core and a 4-wide out-of-order core run the same binary at the same frequency. Describe one kind of code where they perform almost the same, and one where the out-of-order core is several times faster. Explain the mechanism in each case.</p>`,
`<p><strong>Almost the same:</strong> (a) code limited by a single dependence chain, such as a loop-carried running sum or a hash computed byte by byte. The chain’s latency is the floor for both cores, and out-of-order has nothing independent to pull forward. (b) Compute kernels whose data sits in L1 and that the compiler has already scheduled and unrolled, so independent instructions are adjacent in program order. Latencies are fixed and known at compile time, so static scheduling is as good as dynamic.</p>
<p><strong>Far apart:</strong> code with unpredictable-latency events followed by independent work, for example a loop probing a hash table with independent keys. On an in-order core the first instruction that uses a missing load stalls everything behind it, so misses are serviced one at a time. The out-of-order core keeps renaming and executing past the stalled consumer, reaches the next iteration’s load, and issues that miss too. Overlapping several 400-cycle DRAM misses is where the factor of several comes from: it is memory-level parallelism, not ALU parallelism.</p>
<p>The underlying point: the compiler can’t know at compile time whether a load hits or misses, so only dynamic scheduling can adapt to it.</p>`, "medium") +
Q(`<p>Why isn’t “make the in-order pipeline deeper and clock it faster” a substitute for out-of-order execution? Use the Iron Law.</p>`,
`<p>Time = instructions × CPI × cycle time. Deepening the pipeline shrinks cycle time, but:</p>
<ul>
<li><strong>CPI goes up.</strong> Dependent instructions now wait more <em>cycles</em> (load-to-use, multi-cycle ALUs), and the branch misprediction penalty grows with the number of stages before the branch resolves.</li>
<li><strong>Memory doesn’t speed up.</strong> DRAM latency is fixed in nanoseconds, so a faster clock makes every miss cost more cycles, and an in-order core still waits for each one serially.</li>
<li><strong>Diminishing frequency returns.</strong> Each pipeline latch adds fixed overhead (setup, clock-to-Q, skew), so halving the logic per stage doesn’t double frequency, while power climbs with frequency and latch count.</li>
</ul>
<p>Historical evidence: the Pentium 4’s Prescott core used about 31 stages to chase frequency; Intel abandoned that direction for the shorter, wider, out-of-order Core microarchitecture.</p>`, "easy") +
Q(`<p>Which stages of an out-of-order pipeline run in program order and which don’t? Then explain why rename <em>must</em> be in order, even though it looks like a simple table lookup.</p>`,
`<p>In order: fetch, decode, rename, and dispatch (allocation of ROB, queue, and LSQ entries). Out of order: issue, execute, and writeback. In order again: commit/retirement.</p>
<p>Rename must be in order because each source operand must map to the physical register of the <em>most recent older</em> writer of that architectural register. “Most recent older” is defined by program order, so rename has to process instructions in that order. Within one rename group it gets harder: if I0 writes r1 and I2 in the same group reads r1, I2 must take I0’s new physical register, not the one in the table. So the hardware compares every source in the group against every older destination in the group, which grows roughly with the square of the rename width.</p>`, "medium") +
Q(`<p>A colleague’s report says “issue stalled 30% of cycles.” What do you need to ask before you can interpret this, and why do the two possible meanings lead to completely different fixes?</p>`,
`<p>Ask which convention they use, because “issue” and “dispatch” are swapped between communities:</p>
<ul>
<li><strong>Intel terminology:</strong> “issue” is the in-order hand-off from rename into the back end (the <code>UOPS_ISSUED</code> event), and “dispatch” is sending a uop from the scheduler to an execution port (<code>UOPS_DISPATCHED</code>).</li>
<li><strong>Much of the academic literature:</strong> “dispatch” is the in-order insert into the issue queue, and “issue” is the out-of-order send to a functional unit.</li>
</ul>
<p>If it means the in-order hand-off stalled, the back end is full: some resource (ROB, scheduler, load or store queue, physical registers) ran out, and you need a breakdown by resource. If it means nothing left the scheduler, either no instruction was ready (dependences, cache misses) or ready instructions lost port arbitration. Different counters, different fixes. In an interview, define your terms before you use them.</p>`, "easy") +
Q(`<p>An instruction can sit in each of these states for a long time: waiting to issue, executing, completed but not retired, and retired but not finished. Give a concrete example for each.</p>`,
`<ul>
<li><strong>Waiting to issue:</strong> an add whose source comes from a load that missed to DRAM. It sits in the scheduler for hundreds of cycles.</li>
<li><strong>Executing:</strong> a 64-bit integer divide on a non-pipelined divider (tens of cycles), or the load itself while its miss is outstanding.</li>
<li><strong>Completed but not retired:</strong> any instruction younger than the stalled load. It finished long ago but must wait until everything older has retired, to keep exceptions precise.</li>
<li><strong>Retired but not finished:</strong> a store. It retires from the ROB once its address and data are known, then waits in the store buffer until it can write the L1, which may take a whole cache miss.</li>
</ul>`, "easy") +
Q(`<p>A hash-table probe loop: each iteration is one load that misses to DRAM (400 cycles, address independent of other iterations) plus 20 single-cycle instructions that all use the loaded value. Compare time per iteration on:</p><ul><li>(a) A 2-wide in-order core that stalls on first use of a missing load</li><li>(b) A 6-wide out-of-order core with a 512-entry ROB and 16 L1D miss buffers (MSHRs)</li><li>(c) A 4-wide out-of-order core with a 224-entry ROB and 12 MSHRs</li></ul><p>Assume the physical register file, scheduler, and load queue are big enough never to fill before the ROB. Ignore DRAM bandwidth, then say when you can’t.</p>`,
`<ol start="0">
<li><strong>(a) In-order:</strong> the load issues, the first dependent stalls for the full miss, then the 20 dependents go 2 per cycle: about 400 + 10 = <strong>410 cycles per iteration</strong>. The next iteration’s load is behind the dependents in program order, so misses never overlap.</li>
<li><strong>(b) 6-wide OoO:</strong> three bounds, take the largest.
<ul>
<li>Width: 21 / 6 = 3.5 cycles.</li>
<li>Window: 512 / 21 ≈ 24.4 iterations fit in the ROB, so about 25 misses can be outstanding: 400 / 25 = 16 cycles.</li>
<li>MSHRs: at most 16 misses in flight: 400 / 16 = <strong>25 cycles</strong>. This binds.</li>
</ul>
About 25 cycles per iteration: <strong>16× faster</strong> than in-order.</li>
<li><strong>(c) 4-wide OoO:</strong><ul><li>Width 21 / 4 = 5.25</li><li>Window: 224 / 21 ≈ 10.7 iterations, so about 11 misses in flight: 400 / 11 ≈ <strong>36 cycles</strong></li><li>MSHRs: 400 / 12 ≈ 33</li></ul> The ROB binds: about 36 cycles, <strong>11× faster</strong>. Here more MSHRs would do nothing, but a bigger ROB would.</li>
</ol>
<p>A cycle-level simulation of exactly this loop gives 25.3, 36.3, and (with unlimited MSHRs on the 512-entry core) 16.2 cycles per iteration.</p>
<p><strong>Why the register assumption matters:</strong> 20 of every 21 instructions write a register. On a real Golden Cove (280 integer registers, 16 architectural) only about 264 / (20/21) ≈ 277 instructions fit before the free list empties, about 13 misses in flight, so case (b) would be register-bound at roughly 400 / 13 ≈ 31 cycles. On Skylake (180 registers) the limit is about 172 instructions, 8 misses, 50 cycles. In a real core, check the register file before the ROB.</p>
<p><strong>Bandwidth:</strong> case (b) pulls one 64-byte line every 25 cycles, 64 B × 5 GHz / 25 ≈ 12.8 GB/s per core. One core is fine, but eight cores doing this want about 100 GB/s, more than a dual-channel DDR5 desktop delivers, so on a full chip the memory bus, not the core, becomes the limit.</p>`, "hard") +
Q(`<p>Model time per instruction as a function of pipeline depth <em>k</em>:</p>
<p class="eq">T(<em>k</em>) = (CPI<sub>0</sub> + <em>h</em>·<em>k</em>) × (<em>t</em><sub>L</sub> / <em>k</em> + <em>t</em><sub>o</sub>)</p>
<p>where <em>t</em><sub>L</sub> = 3,400 ps of total logic delay, <em>t</em><sub>o</sub> = 20 ps of latch and clock-skew overhead per stage, CPI<sub>0</sub> = 0.40 without hazards, and <em>h</em> = 0.02 cycles of hazard stall per instruction per stage (mispredicts and dependent-operation stalls get longer with depth). Today <em>k</em> = 19. (a) Derive the optimal depth. (b) How much faster is it, at what clock frequency? (c) Why does nobody build it?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Expand: T = CPI<sub>0</sub><em>t</em><sub>L</sub>/<em>k</em> + CPI<sub>0</sub><em>t</em><sub>o</sub> + <em>h</em><em>t</em><sub>L</sub> + <em>h</em><em>t</em><sub>o</sub><em>k</em>. Set dT/d<em>k</em> = −CPI<sub>0</sub><em>t</em><sub>L</sub>/<em>k</em>² + <em>h</em><em>t</em><sub>o</sub> = 0:
<p class="eq"><em>k</em>* = √(CPI<sub>0</sub><em>t</em><sub>L</sub> / (<em>h</em><em>t</em><sub>o</sub>)) = √(0.40 × 3,400 / (0.02 × 20)) = √3,400 ≈ <strong>58 stages</strong></p>
Substituting back gives a neat minimum: T* = (√(CPI<sub>0</sub><em>t</em><sub>o</sub>) + √(<em>h</em><em>t</em><sub>L</sub>))² = (√8 + √68)² ≈ 122.6 ps.</li>
<li><strong>(b)</strong> At <em>k</em> = 19: cycle = 3,400/19 + 20 = 198.9 ps (5.0 GHz), CPI = 0.78, T = 155.2 ps. At <em>k</em> = 58: cycle = 78.6 ps (<strong>12.7 GHz</strong>), CPI = 1.56, T = 122.6 ps: <strong>1.27× faster</strong>. The curve is very flat near the optimum: <em>k</em> = 30 gives 133.3 ps (1.16×) and <em>k</em> = 40 gives 126.0 ps, so most of the gain comes early, and half of the remaining stages buy only a few percent.</li>
<li><strong>(c)</strong> The model counts only time. Dynamic power is roughly C·V²·f: the latch and clock-tree capacitance grows with <em>k</em>, and <em>f</em> grows 2.5×, so power rises several-fold for a 27% gain, far past any thermal limit. The model also assumes <em>h</em> is constant, but some loops can’t be pipelined at all (single-cycle ALU-plus-bypass and wakeup–select loops), so their stall cost grows faster than linearly with depth. And CPI doubles, so the processor spends more of its time and energy on wrong-path and stalled work. Because the time curve is flat, a much shallower pipeline loses little performance and saves a lot of power, which is why real cores sit around 15–20 stages and why Prescott’s 31-stage design was abandoned.</li>
</ol>`, "hard") +
Q(`<p>Adding a pipeline stage to the load path lets the clock rise from 5.0 to 5.3 GHz, but load-to-use latency grows from 4 to 5 cycles and the mispredict penalty from 17 to 18 cycles. A latency sweep on your workload shows each extra cycle of load-to-use latency adds 0.035 to CPI. The workload runs at CPI 0.50 with 6 mispredicts per 1,000 instructions. Is the change worth it? At what frequency would it break even?</p>`,
`<ol start="0">
<li>New CPI = 0.50 + 0.035 (load latency) + 6/1,000 × 1 (one more cycle per mispredict) = <strong>0.541</strong>.</li>
<li>Time per instruction: before 0.50 / 5.0 GHz = 0.1000 ns; after 0.541 / 5.3 GHz = 0.1021 ns. The change is about <strong>2% slower</strong>: the 6% frequency gain is eaten by an 8.2% CPI increase.</li>
<li>Break-even frequency: 5.0 × 0.541 / 0.50 = <strong>5.41 GHz</strong>.</li>
</ol>
<p>Things to say next: the 0.035 sensitivity must come from representative workloads (pointer-chasing code is far more latency-sensitive than streaming code, so some workloads lose much more), and the extra stage also costs power and area.</p>`, "medium") +
Q(`<p>Widening a core from 4 to 6 wide raises IPC by 12% and core power by 30% at the same frequency and voltage. Compute the change in energy per instruction, performance per watt, energy × delay (ED), and energy × delay² (ED²). Which metric should decide, and for which kinds of product would you accept the change?</p>`,
`<p>Let delay per instruction D ∝ 1/IPC and energy per instruction E = power × D.</p>
<ul>
<li>E: 1.30 / 1.12 = <strong>1.161</strong>, 16% more energy per instruction.</li>
<li>Performance per watt: 1.12 / 1.30 = <strong>0.862</strong>, 14% worse.</li>
<li>ED = 1.161 / 1.12 = <strong>1.036</strong>, 3.6% worse.</li>
<li>ED² = 1.161 / 1.12² = <strong>0.925</strong>, 7.5% better.</li>
</ul>
<p>Why ED² matters: with voltage–frequency scaling, energy per operation scales roughly with V² and delay roughly with 1/V, so E × D² stays roughly constant as you move along one design’s voltage curve. A design that wins on ED² can therefore be run at a lower voltage to match the other design’s power and still come out faster. So for a core that will be voltage-scaled (laptops, servers under a power cap), the wider core is the better design point even though it loses at equal voltage.</p>
<p>Where you’d reject it: when energy per task is the constraint at a fixed operating point (a phone’s efficiency core, or throughput servers where perf/W at fixed voltage sets cost). Where you’d accept it: single-thread performance products. The interview point is that the answer depends on the metric, and you should say which one and why.</p>`, "hard") +
Q(`<p>A 6-wide core with a 512-entry ROB supports two hardware threads (SMT) and splits the ROB evenly, 256 entries each. Thread M is memory-bound: one independent DRAM miss (400 cycles) every 64 instructions, everything else easy. Thread C is limited by a dependence chain to IPC 2.0 and needs only a few dozen ROB entries. Estimate the throughput of M alone, C alone, M+M, C+C, and M+C. When does SMT pay off?</p>`,
`<p>M is window-limited: by Little’s law, IPC ≈ ROB entries / miss latency.</p>
<ul>
<li><strong>M alone</strong> (512 entries): 512 / 400 ≈ <strong>1.28</strong>.</li>
<li><strong>C alone:</strong> <strong>2.0</strong>.</li>
<li><strong>M+M:</strong> each thread gets 256 entries: 256 / 400 = 0.64 each, <strong>1.28 total</strong>. No gain: the two threads split the very resource that limited one thread.</li>
<li><strong>C+C:</strong> 2.0 each, <strong>4.0 total</strong> (within the 6-wide limit, and each needs few entries): a 2× gain, because a chain-bound thread leaves most of the machine idle.</li>
<li><strong>M+C:</strong> 0.64 + 2.0 = <strong>2.64</strong>. Weighted speedup = 0.64/1.28 + 2.0/2.0 = 1.5: M runs at half speed, C at full speed.</li>
</ul>
<p>A cycle-level simulation of thread M gives 1.28 with 512 entries and 0.64 with 256, matching the estimate.</p>
<p>SMT pays off when threads are limited by latency or dependences that leave execution resources idle, and not when they are limited by a structure that SMT divides (ROB, load queue, MSHRs, cache capacity, bandwidth). Statically partitioned structures (as on Intel cores) make M+M a wash; dynamically shared ones can help the M+C mix further by giving M more of the window, at the risk of one thread starving the other.</p>`, "hard") +
`<h3 id="sec-width">Width and Throughput</h3>` +
Q(`<p>Golden Cove allocates 6 uops per cycle. A benchmark runs at IPC 1.2 on it. Is the core “80% idle”? How would you find where the other 4.8 instructions per cycle went?</p>`,
`<p>“80% of allocation slots unused” is fair; “80% idle” is not, because the unused slots are spread across many causes and the core may be busy with stalled long-latency work. Width is a peak: sustained IPC is set by whichever stage is narrowest <em>on average</em>, after stalls.</p>
<p>Use slot accounting at the allocation stage (Intel’s Top-Down method): each cycle has 6 slots, and each slot is one of: <strong>retiring</strong> (useful), <strong>bad speculation</strong> (filled with uops later squashed, or lost to recovery), <strong>front-end bound</strong> (the back end could accept a uop but none was delivered), or <strong>back-end bound</strong> (the back end couldn’t accept one, split into memory-bound and core-bound). IPC 1.2 means about 20% retiring, if instructions and uops are roughly one to one. Then drill into the largest category: for memory-bound, which cache level; for front-end, i-cache/iTLB misses versus decode bandwidth.</p>
<p>Note: IPC counts instructions while slots count uops, so fusion and cracking change the mapping.</p>`, "medium") +
Q(`<p>You double issue width from 4 to 8, but fetch, decode, rename, and retire stay 4-wide. What happens to IPC? Can it improve at all?</p>`,
`<p>Sustained IPC still can’t exceed 4: on average no more than 4 instructions per cycle enter or leave the window. But it can still help somewhat. The back end is bursty: when a long-latency load returns, dozens of waiting instructions become ready at once. Wider issue drains that backlog faster, the scheduler and ROB empty sooner, and the front end stalls less, so average IPC moves closer to 4. Wider issue also reduces port conflicts between ready instructions.</p>
<p>The gain is usually small, and the cost is large: wakeup and select logic, register file read ports, and the bypass network all grow superlinearly with issue width. Real cores do run issue wider than rename (Golden Cove dispatches to 12 ports from 6-wide allocation), but because instructions need specific port types, not to exceed the rename rate.</p>`, "medium") +
Q(`<p>Four instructions all read the result of the same load and are otherwise independent. Can they issue in the same cycle? How does the load’s cache behavior change the answer?</p>`,
`<p>Yes. They depend on the same producer, not on each other, so once the load’s result is available all four wake up together, and they can issue together if there are four suitable ports and the bypass network can deliver the value to all of them.</p>
<p>The subtlety is <em>when</em> they wake. Schedulers wake load consumers speculatively, assuming an L1 hit (for example, issuing them so they meet the data exactly 5 cycles after the load on Golden Cove). If the load misses, those consumers issued too early and must be cancelled and replayed. So on a miss they don’t just wait; they waste issue slots first. That replay traffic is one reason a single missing load can cost more than its own latency.</p>`, "medium") +
Q(`<p>On Skylake (2 FMA units, 4-cycle latency, fully pipelined, 2 loads per cycle), a dot product is written as <code>for (i) acc = fma(a[i], b[i], acc);</code> with AVX2 vectors. What throughput does it get? How many accumulators would reach the FMA peak? And would it then actually reach the peak?</p>`,
`<ol start="0">
<li><strong>One accumulator:</strong> every FMA depends on the previous one through <code>acc</code>, so it runs at 1 FMA per 4 cycles, 0.25 per cycle, which is 8 times below the peak of 2 per cycle.</li>
<li><strong>Accumulators needed:</strong> latency × throughput = 4 cycles × 2 per cycle = <strong>8 independent accumulators</strong> to keep both pipelines full (Little’s law).</li>
<li><strong>The trap:</strong> each FMA needs two loads (<code>a[i]</code> and <code>b[i]</code>), and Skylake does 2 loads per cycle. So the loop can sustain only <strong>1 FMA per cycle</strong>, half the FMA peak, even with 8 accumulators. It’s load-bound. Matrix multiply reaches the FMA peak only because register blocking reuses each loaded value in several FMAs.</li>
<li>If the arrays don’t fit in L1, the L2 or DRAM bandwidth caps it lower still.</li>
</ol>
<p>Also: the compiler won’t split the accumulator for you without permission (for example <code>-ffast-math</code> or <code>-fassociative-math</code>), because FP addition isn’t associative and the result would change.</p>`, "medium") +
Q(`<p>Integer multiply on Skylake has 3-cycle latency and a throughput of 1 per cycle. Explain how both can be true. Then: a loop performs 1,000 <em>independent</em> 64-bit divides on a core whose divider takes 14 cycles and is not pipelined. Roughly how long does it take, and what would you change?</p>`,
`<p>The multiplier is pipelined into 3 stages: each multiply takes 3 cycles start to finish, but a new one can enter every cycle, so up to 3 are in flight. Latency matters for dependent chains; reciprocal throughput matters for independent work.</p>
<p>The divider is not pipelined, so independence doesn’t help: one divide at a time, about 1,000 × 14 = <strong>14,000 cycles</strong>, while the rest of the window fills with instructions waiting for divide results. Options: divide by a constant becomes a multiply by a precomputed reciprocal and a shift (compilers do this automatically), hoist a common divisor and multiply by its reciprocal in FP if precision allows, or, as a hardware designer, add a second divider or a higher-radix divider if workloads justify the area.</p>`, "easy") +
Q(`<p>A core with a fixed 4-byte instruction encoding fetches one aligned 32-byte block (8 instructions) per cycle and stops at the first taken branch in the block. A hot loop is 10 instructions (40 bytes) ending in a taken backward branch. The predictor supplies the target with no bubble, and decode keeps up. (a) What is the fetch-limited IPC if the loop starts at byte offset 0, 24, or 28 within a block? (b) Repeat with a 1-cycle bubble after every taken branch. (c) What alignment rule should the compiler follow, and when doesn’t alignment matter?</p>`,
`<p>A loop starting at offset <em>s</em> occupies bytes <em>s</em> to <em>s</em> + 39, and each fetch cycle covers one 32-byte block, so cycles per iteration = number of blocks touched.</p>
<ol start="0">
<li><strong>(a)</strong> Offset 0: blocks [0, 32) and [32, 64), 8 + 2 instructions: 2 cycles, IPC <strong>5</strong>. Offset 24: [24, 32) gives 2 instructions, [32, 64) gives 8: still 2 cycles, IPC <strong>5</strong>. Offset 28: [28, 32) gives 1, [32, 64) gives 8, [64, 68) gives 1: 3 cycles, IPC <strong>3.33</strong>.</li>
<li><strong>(b)</strong> Add a cycle per iteration: 10 / 3 = <strong>3.33</strong>, 3.33, and 10 / 4 = <strong>2.5</strong>.</li>
<li><strong>(c)</strong> The loop touches 2 blocks when <em>s</em> + 40 ≤ 64, i.e. <em>s</em> ≤ 24, and 3 blocks otherwise. In general a loop of <em>B</em> bytes needs ⌈<em>B</em>/32⌉ blocks at best and one more if it straddles an extra boundary; aligning the loop head to a 32-byte boundary always gets the minimum (compilers do this with options like <code>-falign-loops=32</code>, padding with no-ops). Alignment stops mattering when the loop is fed from a decoded-uop cache or loop buffer instead of the fetch unit, or when the back end is slower than even the worst-case fetch rate (here, IPC below 2.5).</li>
</ol>`, "hard") +
Q(`<p>A core has 6-wide dispatch, 8-wide retire, a 320-entry ROB, and unlimited execution ports. A loop iteration has 12 instructions: a load with an independent address, one instruction using the loaded value, one floating-point add on a loop-carried chain (4-cycle latency, one per iteration), and 9 independent single-cycle instructions. Every 4th iteration’s load misses in L2. Assume physical registers, the scheduler, and the load queue never fill before the ROB. (a) What is the IPC if those misses hit in L3 at 50 cycles? (b) If they go to DRAM at 400 cycles? (c) What ROB size would restore full speed with DRAM misses, and what else would have to grow? (d) How many MSHRs does each case need, and what happens with only 5?</p>`,
`<ol start="0">
<li><strong>Bounds that don’t depend on memory:</strong> width: 12 / 6 = 2 cycles per iteration; recurrence: the FP add chain allows one iteration per 4 cycles. So IPC ≤ 12 / 4 = <strong>3</strong>.</li>
<li><strong>(a) L3, 50 cycles.</strong> By Little’s law the window must hold IPC × (time an instruction waits to retire). Instructions behind a miss wait about 50 cycles, so 3 × 50 = 150 entries < 320. The ROB isn’t the limit: IPC = <strong>3</strong>.</li>
<li><strong>(b) DRAM, 400 cycles.</strong> Now 3 × 400 = 1,200 entries would be needed, but only 320 exist, so the ROB limits: IPC ≈ 320 / 400 = <strong>0.8</strong>. More precisely, misses come every 48 instructions, and the window advances in whole miss-to-miss chunks: when a miss at the head returns, retirement runs up to the next miss, and dispatch can reach 7 misses (336 instructions) further. So about 336 instructions retire per 400 cycles: IPC ≈ <strong>0.84</strong>. A cycle-level simulation of this loop gives 0.83.</li>
<li><strong>(c)</strong> About 3 × 400 = <strong>1,200 ROB entries</strong> (simulation: IPC 2.99 at 1,200). Everything else must scale with it: about 1,200 / 12 = 100 loads in flight in the load queue, physical registers for roughly 1,000 destinations, and enough MSHRs (next part). The ROB alone would just move the limit.</li>
<li><strong>(d) MSHRs</strong> = misses in flight = (misses per cycle) × latency = (IPC / 48) × latency. (a): 3 / 48 × 50 ≈ 3.1, so 4. (b): about 7 (the 7 misses in the window). (c): 3 / 48 × 400 = <strong>25</strong>. With only 5 MSHRs in case (b), throughput = 5 misses per 400 cycles × 48 instructions per miss = <strong>0.6 IPC</strong>; with 16 MSHRs and a 1,200-entry ROB, 16 × 48 / 400 = <strong>1.92</strong>. Both match simulation (0.60 and 1.89).</li>
</ol>
<p>The pattern to remember: on memory-bound code, IPC ≈ min(window / latency, MSHRs × instructions-per-miss / latency, the compute bounds).</p>`, "hard") +
Q(`<p>A front end delivers up to 8 uops per cycle from a uop cache and ends each fetch at a taken branch. There is a taken branch every 9 uops. 70% of taken branches are predicted by a small zero-bubble BTB; 30% need the main BTB, which adds a 3-cycle bubble. (a) How many uops per cycle does the front end deliver? (b) What if the main-BTB bubble were 1 cycle? (c) What if fetch were 16 uops wide? (d) Would a bigger uop queue between the front end and rename help?</p>`,
`<ol start="0">
<li><strong>(a)</strong> The trap is granularity. A 9-uop block needs <strong>2</strong> fetch cycles (8, then 1), not 9/8 = 1.125, because fetch can’t continue past the taken branch into the next block. Expected bubble: 0.3 × 3 = 0.9 cycles. So 9 uops per 2.9 cycles = <strong>3.10 uops/cycle</strong>. The naive answer, 9 / (1.125 + 0.9) = 4.44, is 43% too high.</li>
<li><strong>(b)</strong> 2 + 0.3 = 2.3 cycles: <strong>3.91</strong>.</li>
<li><strong>(c)</strong> 1 + 0.9 = 1.9 cycles: <strong>4.74</strong>. Wider fetch helps here mainly because the 9-uop blocks now fit in one cycle.</li>
<li><strong>(d)</strong> No. A queue absorbs short-term bursts but can’t raise the <em>average</em> delivery rate. If the back end could consume 6 per cycle, the core is front-end bound at 3.1 no matter how big the queue is. The real fixes are fewer bubbles (bigger zero-bubble BTB, overriding predictors) and fetching past taken branches; some recent cores can follow more than one taken branch per cycle for exactly this reason.</li>
</ol>`, "hard") +
Q(`<p>A front end has a uop cache that delivers 8 uops per cycle and legacy decoders that deliver 4 instructions (about 4.4 uops) per cycle. Switching from one to the other costs 2 cycles each way, and code that misses the uop cache comes in runs averaging 10 uops. Compute the delivered uops per cycle at an 80% and a 90% uop-cache hit rate (by uops). What fraction of front-end time is switching overhead at 80%, and what does that tell you about where to optimize?</p>`,
`<p>Per 100 uops:</p>
<ul>
<li><strong>80% hit:</strong><ul><li>80 / 8 = 10 cycles</li><li>20 / 4.4 = 4.55 cycles</li><li>20 / 10 = 2 legacy runs, each entered and left: 4 switches × 2 = 8 cycles</li></ul> Total 22.55 cycles: <strong>4.43 uops/cycle</strong>.</li>
<li><strong>90% hit:</strong><ul><li>90 / 8 = 11.25</li><li>10 / 4.4 = 2.27</li><li>1 run: 2 switches × 2 = 4</li></ul> Total 17.52: <strong>5.71 uops/cycle</strong>.</li>
</ul>
<p>At 80%, switching is 8 / 22.55 = <strong>35%</strong> of front-end time, more than the slow decoding itself (20%). Without the switch penalty, 80% would give 100 / 14.55 = 6.87 uops/cycle. So the lesson is that how <em>often</em> you fall out of the uop cache matters more than how slowly the legacy path decodes: longer runs, fewer transitions. Code layout that keeps hot code together (fewer, longer legacy runs) or a larger uop cache both attack the switch count.</p>`, "hard") +
Q(`<p>The front end delivers 6 uops per cycle, except that an L1 instruction-cache miss every 500 uops stops delivery for 14 cycles (an L2 hit). A uop queue decouples the front end from rename. (a) If the back end averages 4 uops per cycle, how many queue entries hide the miss completely? (b) If the back end could average 5.5 uops per cycle, how big must the queue be?</p>`,
`<ol start="0">
<li><strong>(a)</strong> During the 14-cycle gap the back end drains 14 × 4 = <strong>56 uops</strong>, so the queue needs 56 entries buffered. Check that it refills between misses: it refills at 6 − 4 = 2 uops per cycle, so 28 cycles, and misses come every 500 / 4 = 125 cycles. It refills in time, so 56 entries hide the misses completely.</li>
<li><strong>(b)</strong> Trap: no queue is big enough. The front end’s <em>average</em> rate is 500 uops per (500/6 + 14) = 97.3 cycles = <strong>5.14 uops/cycle</strong>, below the 5.5 the back end wants. Equivalently, each gap drains 77 uops and refilling at 0.5 per cycle would take 154 cycles, but the queue never fills, so the front end runs at full speed and the next miss arrives after 500 / 6 ≈ 83 cycles. The queue empties for good and the core runs at 5.14.</li>
</ol>
<p>General rule: a buffer hides variability only when the average supply exceeds the average demand. Size it from the burst (drain during the gap), then check the refill time against the gap interval.</p>`, "hard") +
Q(`<p>Each instruction depends on the instruction immediately before it with probability 0.3 (independently), and on nothing else. Results are bypassed, so a dependent instruction can issue the cycle after its producer. An in-order core issues instructions in order each cycle and stops at the first instruction that depends on one issued in the same cycle. What is the expected IPC for 2-wide, 4-wide, and 8-wide issue? What limit does it approach, and what would an out-of-order core do?</p>`,
`<p>Each cycle starts fresh at the next instruction (its producer, if any, issued in an earlier cycle), so the number issued per cycle is a run of independent instructions: the cycle issues <em>k</em> &lt; <em>w</em> instructions with probability 0.7<sup><em>k</em>−1</sup> × 0.3, and <em>w</em> with probability 0.7<sup><em>w</em>−1</sup>.</p>
<ul>
<li><strong>2-wide:</strong> 1 × 0.3 + 2 × 0.7 = <strong>1.70</strong>.</li>
<li><strong>4-wide:</strong> 1 × 0.3 + 2 × 0.21 + 3 × 0.147 + 4 × 0.343 = <strong>2.53</strong>.</li>
<li><strong>8-wide:</strong> <strong>3.14</strong> (same formula).</li>
</ul>
<p>As width grows, this approaches the mean run length 1 / 0.3 = <strong>3.33</strong>: doubling width from 4 to 8 gains only 24%. An out-of-order core isn’t limited to consecutive instructions: here every dependence chain is short (the chance that a chain continues is only 0.3), so with a reasonable window it can find <em>w</em> ready instructions almost every cycle and get close to the full width. This is the classic argument for why wide in-order issue doesn’t pay.</p>`, "hard") +
Q(`<p>An integer back end has 6 single-cycle ALUs. A result can be bypassed from either of the 2 pipeline stages after execution, before it is readable from the register file. (a) How many sources does each ALU input select from, and how many bypass paths are there in total? (b) Same for 4 ALUs. (c) Split the 6 ALUs into two clusters of 3 with full bypass inside a cluster and one extra cycle to cross (as the Alpha 21264 did). How many fast paths remain? (d) If dependent instructions land in different clusters half the time, how fast does a chain of dependent adds run, and how do designs avoid that?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Sources per input: 6 ALUs × 2 stages = 12 bypass values, plus the register file: a <strong>13-to-1 mux</strong> per input. Paths: 12 inputs (6 ALUs × 2 operands) × 12 sources = <strong>144</strong>.</li>
<li><strong>(b)</strong> 8 inputs × 8 sources = <strong>64</strong>. 1.5× the ALUs costs 2.25× the paths: the bypass network grows with the square of width, and the long wires are slow as well as large.</li>
<li><strong>(c)</strong> Per cluster: 6 inputs × 6 sources = 36; two clusters: <strong>72</strong> fast paths, half of the full network. Cross-cluster values arrive a cycle later.</li>
<li><strong>(d)</strong> Each dependence link costs 1 cycle half the time and 2 cycles the other half: 1.5 cycles on average, so a chain runs at 2/3 of its speed, a 33% loss for chain-bound code. Designs steer an instruction to the cluster of its producer (or its most critical producer) at dispatch, which recovers most of the loss but risks load imbalance between clusters, so steering heuristics balance both.</li>
</ol>`, "hard") +
Q(`<p>A loop issues one integer divide every 20 instructions; apart from that, the core would run it at IPC 4. The divider has 14-cycle latency and is not pipelined. (a) Does the divider limit performance, and to what IPC? (b) How many dividers would it take to reach IPC 4? (c) Now divides are one per 80 instructions, so divider utilization is 0.7. Using the M/D/1 queueing formula W = ρ·S / (2(1 − ρ)), what is the average wait for the divider? Is that the right model for a loop?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Demand: 4 / 20 = 0.2 divides per cycle. Capacity: 1 / 14 = 0.071. Utilization would be 2.8, so the divider binds: one divide per 14 cycles means 20 instructions per 14 cycles, <strong>IPC 1.43</strong>.</li>
<li><strong>(b)</strong> Two dividers: 20 instructions per 7 cycles = 2.86, still bound. Three: capacity 3/14 = 0.214 ≥ 0.2, so <strong>3 dividers</strong> reach IPC 4, at 93% utilization. A pipelined divider (or a higher-radix one with a shorter initiation interval) is usually cheaper than three copies.</li>
<li><strong>(c)</strong> 4 / 80 = 0.05 divides per cycle × 14 = ρ = 0.7. W = 0.7 × 14 / (2 × 0.3) ≈ <strong>16.3 cycles</strong> average wait, plus 14 of service. But M/D/1 assumes random (Poisson) arrivals. In a loop the divides arrive like clockwork, one every 20 cycles, and a deterministic arrival stream with ρ &lt; 1 never queues at all: the wait is <strong>0</strong>. Queueing formulas are useful for irregular code (divides clustered by data-dependent control flow); for loops, think in terms of steady-state throughput. Either way, out-of-order execution hides the wait as long as enough independent work fits in the window: about (16 + 14) × 4 = 120 instructions here.</li>
</ol>`, "hard") +
Q(`<p>Traversing a linked list: each node visit is one load of the next pointer (5-cycle L1 hit) plus 3 single-cycle instructions that use the node but don’t feed the next pointer. The core is 6-wide with 3 load ports. (a) What IPC does one list get? (b) If the program traverses <em>k</em> independent lists interleaved, how many does it take to reach full width? (c) Now the lists are in DRAM (400 cycles per node) and the core has 16 L1 miss buffers. What IPC do 8 lists get, and what is the most possible?</p>`,
`<ol start="0">
<li><strong>(a)</strong> The loop-carried chain is the pointer load: 5 cycles per node, 4 instructions per node, so IPC = 4 / 5 = <strong>0.8</strong>, no matter how wide the core is.</li>
<li><strong>(b)</strong> <em>k</em> independent chains give 4<em>k</em> / 5 IPC until another limit binds. Width: 4<em>k</em> / 5 ≤ 6, so <em>k</em> = 7.5. Loads: <em>k</em> per 5 cycles ≤ 3 per cycle, so up to 15 lists. So <strong>8 lists</strong> reach the 6-wide limit (7 lists give 5.6).</li>
<li><strong>(c)</strong> Each list now yields 4 instructions per 400 cycles = 0.01 IPC. 8 lists: <strong>0.08</strong>. More lists help linearly until the 16 miss buffers fill: at most 16 × 0.01 = <strong>0.16 IPC</strong>. The ROB is not the limit (by Little’s law, 0.16 × 400 = 64 entries). Past that point only lower latency, prefetching (hard for pointers), or restructuring the data (arrays instead of lists) helps.</li>
</ol>`, "hard") +
Q(`<p>Loads are 30% of instructions and hit in the L1 92% of the time. The scheduler issues load-dependent instructions assuming a hit; on a miss, an average of 2.4 dependents (direct and indirect) have already issued and must be cancelled and reissued. On a 6-wide issue machine running at IPC 2.5, what fraction of issue bandwidth is wasted? When would this matter?</p>`,
`<ol start="0">
<li>Misses per 1,000 instructions: 1,000 × 0.30 × 0.08 = 24. Wasted issues: 24 × 2.4 = 57.6 per 1,000 instructions.</li>
<li>Cycles per 1,000 instructions: 1,000 / 2.5 = 400, so issue capacity is 400 × 6 = 2,400 slots. Waste: 57.6 / 2,400 = <strong>2.4% of capacity</strong>, or 57.6 / 1,057.6 = 5.4% of the issues actually performed.</li>
</ol>
<p>Usually negligible for performance. It matters when the core is port-bound (the wasted slots steal from useful work), for energy (every replay reads registers and toggles units), and when replays repeat: an instruction replayed again on an L2 miss or a bank conflict can multiply the waste. That is why cores add hit/miss predictors for loads that usually miss.</p>`, "medium") +
`<h3 id="sec-stalls">Stalls, Flushes and Recovery</h3>` +
Q(`<p>Renaming removes false dependences and branch prediction hides control dependences. Give one structural, one data, and one control hazard that still costs cycles on a modern out-of-order core.</p>`,
`<ul>
<li><strong>Structural:</strong><ul><li>Two ready divides and one divider</li><li>Three ready loads and two load ports</li><li>A full ROB, scheduler, or load queue blocking allocation</li></ul></li>
<li><strong>Data:</strong> true read-after-write dependences through registers, which renaming can’t remove, and through memory: a load that needs a value from an older store whose address isn’t known yet.</li>
<li><strong>Control:</strong> branch mispredictions, plus indirect branches whose target is mispredicted, and taken branches that cost a fetch bubble when the target isn’t available in time.</li>
</ul>`, "easy") +
Q(`<p>A stall and a flush both lose cycles. Why does a single flush usually cost more than a short stall? Give a case where a stall costs far more than a flush.</p>`,
`<p>A stall pauses: work already in flight is kept and resumes. A flush discards every instruction younger than the faulting point, so the core throws away completed work and must refill the pipeline from fetch, which costs the front-end depth (about 15–20 cycles) plus the time to rebuild a full window of independent work.</p>
<p>But a stall can be much worse: a load at the ROB head missing to DRAM stalls retirement for 400+ cycles, while a mispredicted branch that resolves quickly costs about 17. Which matters more depends on frequency: a workload with 5 mispredicts per 1,000 instructions loses about 85 cycles per 1,000 instructions to flushes, while 1 DRAM miss per 1,000 instructions that isn’t overlapped loses about 400.</p>`, "easy") +
Q(`<p>A load on a mispredicted path touches an unmapped address and would page-fault. What must the core do? What went wrong in Meltdown?</p>`,
`<p>Nothing visible. The fault is recorded in the load’s ROB entry and raised only if that instruction reaches the ROB head as the oldest instruction. Here the branch resolves first, the load is squashed, and the fault disappears with it. That’s what “precise exceptions” buys: architectural state looks as if instructions ran one at a time in order.</p>
<p>Meltdown: on some cores a load to a kernel address that would fault still returned data to dependent instructions transiently, before the fault was raised at retirement. Those instructions were squashed, but they had already touched cache lines indexed by the secret data, and the attacker recovered it by timing cache accesses. Architectural state was precise; microarchitectural state (the cache) wasn’t restored. Fixed cores don’t forward data from faulting loads.</p>`, "medium") +
Q(`<p>After a change to your model, IPC drops 8% across several benchmarks. How do you determine whether the regression came from the front end, the scheduler, the execution units, or retirement?</p>`,
`<ol start="0">
<li><strong>Make it reproducible:</strong> same binaries, same simulation points, same warm-up; confirm the drop isn’t noise by checking that all simulation points move the same way.</li>
<li><strong>Slot accounting before and after:</strong> compare front-end bound, bad speculation, back-end bound, and retiring. The category that grew is where to look.</li>
<li><strong>Drill down:</strong> front end: fetch bubbles, i-cache or BTB misses, decode-queue empty cycles. Scheduler: queue-full stalls by queue, and cycles with ready-but-not-issued instructions. Execution: per-port utilization, divider busy. Retirement: cycles where the ROB head is complete but retirement bandwidth was exhausted (rare), versus head-not-complete cycles classified by the head instruction’s type.</li>
<li><strong>Find the instructions:</strong> diff per-PC stall counts between the two runs to find the code that got slower, then build a microbenchmark that isolates it.</li>
<li>Bisect the change itself if it bundled several modifications.</li>
</ol>`, "medium") +
Q(`<p>Skylake is 4-wide. Over 10<sup>9</sup> cycles you measure, using the classic Top-Down event names: <code>UOPS_ISSUED.ANY</code> = 2.6 × 10<sup>9</sup>, <code>UOPS_RETIRED.RETIRE_SLOTS</code> = 2.2 × 10<sup>9</sup>, <code>INT_MISC.RECOVERY_CYCLES</code> = 5 × 10<sup>7</sup>, <code>IDQ_UOPS_NOT_DELIVERED.CORE</code> = 7 × 10<sup>8</sup>, and 2.0 × 10<sup>9</sup> instructions retired. (a) Compute the four top-level categories and the IPC. (b) Estimate the most that perfect branch prediction could speed this up, and explain why the real gain would be smaller. (c) What does the gap between uops and instructions tell you?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Slots = 4 × 10<sup>9</sup>.
<ul>
<li>Retiring = 2.2 / 4 = <strong>55%</strong>.</li>
<li>Bad speculation = (issued − retired + 4 × recovery cycles) / slots = (2.6 − 2.2 + 0.2) / 4 = 0.6 / 4 = <strong>15%</strong>. The first part is uops that issued and were squashed; the second is the slots lost while the machine recovered.</li>
<li>Front-end bound = 0.7 / 4 = <strong>17.5%</strong> (slots where the back end could take a uop and none was delivered).</li>
<li>Back-end bound = the rest: 100 − 55 − 15 − 17.5 = <strong>12.5%</strong>.</li>
</ul>
IPC = 2.0 × 10<sup>9</sup> / 10<sup>9</sup> = <strong>2.0</strong>.</li>
<li><strong>(b)</strong> If all bad-speculation slots became useful, cycles would drop by at most 15%: speedup ≤ 1 / (1 − 0.15) ≈ <strong>1.18×</strong>. The real gain is smaller because the freed slots don’t automatically become retiring: some would turn into back-end-bound slots (the correct path may stall on the same cache misses the wrong path was hiding, especially for branches that depend on misses), and some front-end stalls (fetch redirects) shift too. Wrong-path loads sometimes prefetch useful data, which perfect prediction would lose. Top-Down gives a ceiling, not a forecast; a simulator run with a perfect predictor gives the real number.</li>
<li><strong>(c)</strong> 2.2 × 10<sup>9</sup> retired uops for 2.0 × 10<sup>9</sup> instructions is 1.1 uops per instruction: some instructions need several (fused-domain) uops, such as read-modify-write memory instructions like <code>add [mem], reg</code>, string instructions, and microcoded instructions, and these outweigh what macro-fusion of compare-and-branch pairs saves. (A load folded into an ALU instruction stays one slot thanks to micro-fusion.) So IPC (2.0) understates the work the back end does (2.2 uops per cycle), and comparing IPC across binaries with different uop mixes is misleading.</li>
</ol>`, "hard"),
},
{
  id: "intv-renaming",
  title: "Renaming and Dependences",
  sections: [
    { id: "deps", label: "Finding Dependences" },
    { id: "mech", label: "Rename Mechanics" },
    { id: "recover", label: "Recovery and Reclamation" },
    { id: "sizing", label: "Sizing and Performance" }
  ],
  body: reset("intv-renaming") + `
<p>Background: <a href="#/renaming">Register Renaming</a>, <a href="#/prf-sizing">Sizing the Physical Register File</a>.</p>
<h3 id="sec-deps">Finding Dependences</h3>` +
Q(`<p>List every register RAW, WAR, and WAW dependence in this sequence. Which survive renaming? After renaming, which instructions still have to wait for the load?</p>
<pre><code>I0: ld   r1, 0(r2)
I1: add  r3, r1, r4
I2: mul  r1, r5, r6
I3: sub  r7, r1, r3
I4: st   r7, 8(r2)</code></pre>`,
`<ul>
<li><strong>RAW (true):</strong> I0→I1 (r1), I1→I3 (r3), I2→I3 (r1), I3→I4 (r7).</li>
<li><strong>WAR:</strong> I1 reads r1, then I2 writes r1 (I1→I2).</li>
<li><strong>WAW:</strong> I0 and I2 both write r1.</li>
</ul>
<p>Renaming removes the WAR and WAW: I2 gets its own physical register, so it can execute immediately, even while I0’s load is still missing. Only the RAW dependences survive.</p>
<p>Who waits for the load:</p><ul><li>I1 directly</li><li>I3 through I1 (via r3, even though the r1 that I3 reads now comes from I2, not I0)</li><li>I4 through I3</li></ul><p>The critical path is load → add → sub → store data. A common mistake is to say I3 depends on I0 through r1; it doesn’t, because I2 redefined r1 in between.</p>`, "easy") +
Q(`<p>Why can’t renaming remove a RAW dependence, while it can remove WAR and WAW? Phrase the answer in terms of what information flows.</p>`,
`<p>A RAW dependence is a real flow of a <em>value</em>: the consumer needs the number the producer computes, so it can’t start until that number exists. WAR and WAW are conflicts over a <em>name</em>: two instructions happen to use the same architectural register as storage for unrelated values. Renaming gives each value its own storage, so the name conflict disappears. No amount of storage makes a value exist before it is computed. Only value prediction, which guesses it, can break a RAW, at the cost of recovery when wrong.</p>`, "easy") +
Q(`<p>An unrolled loop has 8 copies of this body, each with its own address, and every load misses to DRAM (400 cycles):</p>
<pre><code>ld  r1, [r5 + 8i]
add r2, r1, r6
st  r2, [r7 + 8i]</code></pre>
<p>Estimate the time for all 8 copies on (a) a CDC 6600-style scoreboard machine, which issues in order and stalls issue on a WAW hazard, with no renaming; (b) an out-of-order core with renaming and a large window. (c) How would a compiler rescue the scoreboard machine, and why isn’t that enough in general?</p>`,
`<ol start="0">
<li><strong>(a) Scoreboard:</strong> copy 1’s <code>ld r1</code> has a WAW hazard with copy 0’s <code>ld r1</code>, which is still outstanding, so issue stalls, and in-order issue blocks everything behind it. Each copy’s load waits for the previous copy’s load to finish: about 8 × 400 = <strong>3,200 cycles</strong>. (A scoreboard also stalls a write on a WAR hazard, which would bite next if the registers were reused differently.)</li>
<li><strong>(b) Renaming:</strong> each <code>ld r1</code> gets a fresh physical register, so all 8 loads issue within a few cycles and their misses overlap: about 400 + a few cycles, roughly <strong>8× faster</strong> (given at least 8 miss buffers).</li>
<li><strong>(c)</strong> The compiler can allocate different registers to each copy (r1, r8, r9, …), which removes the WAW and lets the scoreboard overlap the misses too. But that needs 16 architectural registers for 8 copies instead of 2, it only works for code the compiler can see and unroll, and the compiler doesn’t know which loads will miss. Renaming does the same thing dynamically, for any code, with as many “registers” as the physical register file has.</li>
</ol>`, "hard") +
`<h3 id="sec-mech">Rename Mechanics</h3>` +
Q(`<p>Rename the sequence from Q0. Initial map: r<em>n</em> → p<em>n</em> for every architectural register. Free list, in order: p32, p33, p34, p35. Give each renamed instruction, the final map, and the physical register each instruction frees when it commits. What happens to the next instruction that writes a register?</p>`,
`<ol start="0">
<li>I0: r1 gets p32, old mapping p1. <code>ld p32, 0(p2)</code>. Frees <strong>p1</strong> at commit.</li>
<li>I1: sources r1→p32, r4→p4; r3 gets p33, old p3. <code>add p33, p32, p4</code>. Frees <strong>p3</strong>.</li>
<li>I2: sources p5, p6; r1 gets p34, old <strong>p32</strong>. <code>mul p34, p5, p6</code>. Frees <strong>p32</strong>.</li>
<li>I3: sources r1→p34, r3→p33; r7 gets p35, old p7. <code>sub p35, p34, p33</code>. Frees <strong>p7</strong>.</li>
<li>I4: a store has no destination register: <code>st p35, 8(p2)</code>. Frees nothing.</li>
</ol>
<p>Final map: r1→p34, r3→p33, r7→p35, everything else unchanged. The free list is now empty, so the next instruction with a destination stalls at rename until a commit returns a register.</p>
<p>Check yourself: I2 frees p32 even though I1 reads p32. That’s safe because I1 is older than I2 and commits first, so by the time I2 commits, I1 has long since read p32.</p>`, "easy") +
Q(`<p>A 6-wide rename stage renames six instructions per cycle. Why isn’t that just six independent map-table lookups in parallel? What extra logic is needed? Which table is being read, how many read and write ports does it need, and why?</p>`,
`<p><strong>The table</strong> is the rename map table, also called the register alias table (RAT). It has one entry per architectural register (16 integer registers on x86-64, 31 on Arm64), and each entry holds the number of the physical register that currently holds that architectural register’s newest value (9 bits for a 280-entry register file). It is tiny but very heavily ported, so it is usually built from flip-flops or a custom multiported array.</p>
<p><strong>Ports.</strong> Each of the <em>n</em> instructions in a rename group can need, in the same cycle:</p>
<ul>
<li>Two reads for its two source registers, to learn which physical registers to wait on: <strong>2<em>n</em></strong> read ports.</li>
<li>One read of its <em>destination</em> register’s current mapping, which is the “old mapping” saved in the ROB so it can be freed when this instruction commits: <strong><em>n</em></strong> more read ports.</li>
<li>One write to point its destination at the newly allocated physical register: <strong><em>n</em></strong> write ports.</li>
</ul>
<p>So the table needs <strong>3<em>n</em> read ports and <em>n</em> write ports</strong>: 18 reads and 6 writes for 6-wide rename. The ports are sized for the worst case: in a given cycle some reads are overridden by the in-group bypass described next, and when two slots write the same register only one write lands, but the hardware can’t know that in advance. (Instructions with three sources, or ISAs that rename flags separately, add more ports.)</p>
<p><strong>Intra-group dependences.</strong> Instructions in the same group can depend on each other. If slot 0 writes r1 and slot 3 reads r1, slot 3 must get slot 0’s <em>newly allocated</em> register, which isn’t in the table yet. So every source in slot <em>k</em> is compared with the destinations of slots 0 to <em>k</em>−1, and the youngest matching older slot wins (a priority mux). Likewise, every destination is compared with the older destinations in the group: if two slots write the same register, only the younger one’s mapping is written into the table, and the younger one’s old mapping must be the older slot’s new register, not the table’s current entry.</p>
<p><strong>Scaling.</strong> The comparators grow with <em>n</em>², and although the port count grows only linearly, every port adds a wordline and a bitline to every cell, so the table’s area grows roughly with the square of the port count. That double quadratic growth is one reason rename width has grown slowly (4 on Skylake, 6 on Golden Cove and Zen 4). The next questions put numbers on it.</p>`, "medium") +
Q(`<p>Several in-flight instructions write r5. A new instruction reads r5. How does it know which one to wait for, and how does it learn when that value is ready?</p>`,
`<p>At rename, the map table holds the physical register of the <em>youngest</em> writer of r5 renamed so far, which by construction is the most recent older writer in program order. The consumer copies that physical register number as its source tag. The other writers of r5 are invisible to it.</p>
<p>For readiness, the consumer checks a ready bit per physical register at rename (the value may already be done), and if it isn’t ready it waits in the scheduler, watching for that tag to be broadcast on a wakeup bus when the producer is about to write back. Because the tag names a unique physical register, there is no ambiguity about which producer it was waiting for.</p>`, "easy") +
Q(`<p>A 4-wide rename group, with initial map r1→p1, r2→p2, r3→p3 and free list p40, p41, p42, p43 (in that order):</p>
<pre><code>I0: add r1, r2, r3
I1: sub r2, r1, r1
I2: mul r1, r2, r1
I3: add r3, r1, r2</code></pre>
<p>Rename all four in one cycle. For each instruction give its renamed form and its old mapping. Which map-table entries are actually written at the end of the cycle? How many intra-group comparisons does the hardware make, and which ones match?</p>`,
`<ol start="0">
<li><strong>I0:</strong> sources come from the table: r2→p2, r3→p3. Destination r1 gets p40; old mapping <strong>p1</strong> (from the table). <code>add p40, p2, p3</code></li>
<li><strong>I1:</strong> both sources are r1, which I0 writes in the same group, so both take <strong>p40</strong>, not the table’s p1. Destination r2 gets p41; old mapping p2. <code>sub p41, p40, p40</code></li>
<li><strong>I2:</strong> source r2 comes from I1 (<strong>p41</strong>); source r1 comes from I0 (<strong>p40</strong>). Destination r1 gets p42, and its old mapping is <strong>p40</strong>, I0’s new register, not the table’s p1. <code>mul p42, p41, p40</code></li>
<li><strong>I3:</strong> source r1 matches <em>both</em> I0 and I2; the priority mux picks the youngest older writer, I2: <strong>p42</strong>. Source r2 comes from I1: p41. Destination r3 gets p43; old mapping p3. <code>add p43, p42, p41</code></li>
</ol>
<p><strong>Table writes:</strong> r1 is written by I0 and I2, so only I2’s mapping is written. Final table: r1→<strong>p42</strong>, r2→p41, r3→p43. p40 never appears in the table, yet it is live: I1 and I2 read it, and it is freed when I2 commits. At commit, I0 frees p1, I1 frees p2, I2 frees p40, I3 frees p3.</p>
<p><strong>Comparisons:</strong> sources: slot <em>k</em> compares its 2 sources against <em>k</em> older destinations: 2 × (0 + 1 + 2 + 3) = 12. Destinations: slot <em>k</em> compares against <em>k</em> older destinations: 0 + 1 + 2 + 3 = 6. Total <strong>18</strong>.</p><p>Matches:</p><ul><li>I1’s two sources vs. I0 (2)</li><li>I2’s r2 vs. I1 and r1 vs. I0 (2)</li><li>I3’s r1 vs. I0 and I2, and r2 vs. I1 (3)</li><li>I2’s destination vs. I0’s (1)</li></ul><p>That’s 8 matches. The classic bug: giving I3 the I0 match because it was found first.</p>`, "hard") +
Q(`<p>Generalize the previous question to <em>n</em>-wide rename where every instruction has two sources and one destination. (a) How many intra-group comparators are needed for <em>n</em> = 4, 6, and 8? (b) How many map-table ports? (c) If the area of a multiported array grows with the square of its port count, how much bigger is the 6-wide and the 8-wide map table than the 4-wide one, for the same number of entries? (d) Name two ways designers avoid paying this.</p>`,
`<ol start="0">
<li><strong>(a) Comparators.</strong> Sources: slot <em>k</em> has 2 sources × <em>k</em> older destinations, summed over <em>k</em> = 0 … <em>n</em>−1: 2 · <em>n</em>(<em>n</em>−1)/2 = <em>n</em>(<em>n</em>−1). Destinations: <em>n</em>(<em>n</em>−1)/2. Total <strong>3<em>n</em>(<em>n</em>−1)/2</strong>: <strong>18</strong> for 4-wide, <strong>45</strong> for 6-wide, <strong>84</strong> for 8-wide. Each compares two architectural register numbers (4 bits for 16 registers, 5 for 32). Going from 4 to 8 wide multiplies the comparators by 84 / 18 ≈ 4.7.</li>
<li><strong>(b) Ports:</strong> 3<em>n</em> reads + <em>n</em> writes = 4<em>n</em>: 16, 24, and 32 ports.</li>
<li><strong>(c) Area:</strong> (24 / 16)² = <strong>2.25×</strong> for 6-wide, (32 / 16)² = <strong>4×</strong> for 8-wide. Access time also grows, because longer wordlines and bitlines are slower, and rename is often a timing-critical stage.</li>
<li><strong>(d) Ways around it:</strong><ul><li>Rename in two half-groups across two pipeline stages or two clock phases (costing latency, which lengthens the mispredict penalty)</li><li>Replicate the table (duplicate copies each serving a subset of read ports, all receiving every write)</li><li>Handle some instructions without full rename-table reads (moves and zero idioms, or instructions without destinations, which need no old-mapping read)</li><li>Use a CAM-style table with one entry per <em>physical</em> register, as the Alpha 21264 did, which changes the trade-off</li></ul> Each of these is a real interview follow-up.</li>
</ol>`, "hard") +
Q(`<p>x86 <code>inc</code> writes every arithmetic flag except the carry flag. Why does that create a dependence problem for renaming, and how do cores avoid it? Then answer the same question for writing <code>al</code> and later reading <code>rax</code>, and explain why writing <code>eax</code> doesn’t have the problem.</p>`,
`<p><strong>Flags:</strong> if all flags are renamed as one unit, <code>inc</code> has to produce a complete flags value: its own ZF, SF, OF, and so on, plus the <em>old</em> carry flag. So it must read the previous flags producer, a false dependence that can serialize <code>inc</code> behind an unrelated long-latency instruction. Cores rename flags in groups, with the carry flag separate from the rest, so <code>inc</code> writes only its group. A later instruction that reads flags from both groups (for example <code>ja</code>, which tests CF and ZF) then needs both sources, handled with a merge uop or a second source operand.</p>
<p><strong>Partial registers:</strong> writing <code>al</code> leaves bits 8–63 of <code>rax</code> unchanged. Either <code>al</code> is renamed separately and a later read of <code>rax</code> needs a merge (older Intel cores stalled for several cycles; newer ones insert a merge uop), or the write to <code>al</code> is treated as a read-modify-write of <code>rax</code>, which adds a dependence on the old value.</p>
<p><strong>Why <code>eax</code> is fine:</strong> x86-64 defines that writing a 32-bit register zero-extends into the full 64-bit register, so the write fully defines <code>rax</code> and needs no old value. That rule was chosen precisely to avoid this dependence; 8- and 16-bit writes kept the old behavior for compatibility.</p>`, "medium") +
Q(`<p>A 6-wide rename stage can take at most 4 registers from the free list per cycle. Each instruction needs a destination register with probability 0.7, independently. Rename handles instructions in order and stops at the first one that would need a fifth register. (a) Give a quick upper bound on throughput. (b) A colleague computes the expected number renamed per cycle for a fresh group of 6 random instructions and gets 5.41. Why is the true steady-state rate lower, and what is it?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Registers needed: 0.7 per instruction; supplied: at most 4 per cycle. So throughput ≤ 4 / 0.7 = <strong>5.71</strong>, and ≤ 6 from the width.</li>
<li><strong>(b)</strong> The instruction that ends a group early is, by construction, one that needs a register. So the next cycle does <em>not</em> start with a random instruction; it starts with one known to need a register, and such cycles average only 5.23. A two-state Markov chain (does this cycle start with a known register writer or not?) gives a stationary probability of 0.47 for the “known writer” state, so the steady-state rate is 0.53 × 5.41 + 0.47 × 5.23 ≈ <strong>5.33</strong>. A direct simulation of 2 million random instructions agrees (5.33).</li>
</ol>
<p>The general lesson: when a stall condition is caused by the next item, that item carries into the next cycle, and treating cycles as independent overestimates throughput. Here the 4-register limit costs about 11% of rename bandwidth.</p>`, "hard") +
`<h3 id="sec-recover">Recovery and Reclamation</h3>` +
Q(`<p>When exactly can the old physical register of an overwritten mapping be freed? Why not when the new producer writes back? Why not as soon as the last reader has read it?</p>`,
`<p>When the instruction that overwrote the mapping <strong>commits</strong>. Only then is it certain that (a) every reader of the old value, all of which are older, has read it, and (b) the overwriting instruction won’t be squashed.</p>
<ul>
<li><strong>Not at writeback:</strong> the overwriting instruction might still be squashed by an older mispredict or exception. Recovery restores the old mapping, so the old value must still be there.</li>
<li><strong>Not at last read:</strong> the same problem (squash or precise exception needs the old value), plus the hardware doesn’t easily know who the last reader is: readers are older and may not have issued. Early-release schemes using reader counts exist in research, but they add complexity and still need care for recovery.</li>
</ul>`, "medium") +
Q(`<p>Your model frees a physical register one cycle too early in a rare corner case. What symptoms would you expect in a timing-only model (no values) versus a model that carries real values?</p>`,
`<p>With real values: silent data corruption. The register gets reallocated and overwritten while some reader still needs the old value, or after a squash restores a mapping to it. The program computes wrong results, and you catch it only by comparing committed values against a functional reference.</p>
<p>In a timing-only model the symptom is much quieter: dependences come out wrong. A consumer may wake on the new producer’s broadcast of the reused tag and issue too early, or a restored mapping points at a register marked “ready” by an unrelated instruction. IPC goes up slightly and plausibly, which is the dangerous part. This is why timing models need invariant checks (see the next question) and why carrying values, or cross-checking dependence edges against a functional model, is worth the cost.</p>`, "medium") +
Q(`<p>How would you detect a physical register leak or a double free in a C cycle-level model?</p>`,
`<ol start="0">
<li><strong>Explicit state per register:</strong> keep an enum per physical register (FREE, SPECULATIVE, COMMITTED) and assert on every transition: allocate only from FREE, free only from a state that allows it. A double free trips the assert immediately at the bad call site.</li>
<li><strong>Conservation invariant every cycle (debug builds):</strong> free-list size + registers mapped by the committed map + destinations of in-flight instructions = total registers, with every register counted exactly once.</li>
<li><strong>Drain check:</strong> after a full pipeline flush or at the end of simulation, the free list must hold exactly total − architectural registers.</li>
<li><strong>Symptom check:</strong> a leak shows up as a free list that shrinks over simulated time, rename stalls that rise with run length, and eventually a deadlock. Plot free-list occupancy over time.</li>
</ol>
<p>Typical culprits: forgetting to return the destinations of squashed instructions, or returning them twice when two flushes overlap.</p>`, "medium") +
Q(`<p>A branch near the ROB head mispredicts with 300 younger instructions in flight. Your model restores the rename map by walking the ROB backward and undoing mappings, 8 per cycle. What does recovery cost, and how do checkpoints change that? What limits checkpoints?</p>`,
`<p>Walking 300 entries at 8 per cycle takes about 38 cycles before rename can resume on the correct path. Some of that overlaps the front-end refill (about 15–20 cycles), but the rest adds directly to the misprediction penalty, and it is worst exactly when the window is full.</p>
<p><strong>Checkpoints</strong> copy the whole map table at each branch at rename time; recovery is a single-cycle copy back. The squashed instructions’ physical registers must still be returned, but with a circular free list that’s just restoring the head pointer saved with the checkpoint.</p>
<p>Limits: each checkpoint is a full copy of the table, so there are only a handful. When they run out, rename stalls at the next branch, or the design falls back to a walk. Common compromises: checkpoint only low-confidence branches, or rebuild from the committed map plus a forward walk. Being able to model all three lets you measure the penalty difference instead of guessing.</p>`, "medium") +
Q(`<p>A core checkpoints the rename map at every branch and has 8 checkpoints. A checkpoint is freed when its branch <em>resolves</em> (not when it commits). One instruction in 6 is a branch, and branches resolve on average 20 cycles after rename. (a) What is the highest sustainable IPC before rename starts stalling for checkpoints? (b) The core is meant to sustain IPC 4. How many checkpoints does it need? (c) A designer proposes checkpointing only low-confidence branches, which are 10% of branches but cause 80% of mispredicts. What happens to the checkpoint requirement, and what does it cost?</p>`,
`<ol start="0">
<li><strong>(a) Little’s law:</strong> unresolved branches in flight = branch rate × time to resolve = (IPC / 6) × 20 = 3.33 × IPC. With 8 checkpoints, 3.33 × IPC ≤ 8, so <strong>IPC ≤ 2.4</strong>. Above that, rename stalls whenever a ninth branch arrives.</li>
<li><strong>(b)</strong> At IPC 4: (4 / 6) × 20 ≈ <strong>13.3</strong> branches in flight on average, so at least 14 checkpoints, and in practice more, because Little’s law gives the <em>average</em>. A branch that depends on a load missing to DRAM holds its checkpoint for 400+ cycles, and a few of those at once eat most of the pool. Size for the tail, not the mean.</li>
<li><strong>(c)</strong> Checkpointed branches in flight drop to 10% of 13.3 ≈ <strong>1.3</strong> on average, so a handful of checkpoints is plenty. The cost is the other 20% of mispredicts: their branches have no checkpoint, so recovery falls back to a slower method (walking the ROB, or rebuilding from the committed map), adding cycles to those mispredicts. Estimate the trade-off as (mispredicts on unchecked branches per 1,000 instructions) × (extra recovery cycles), against the rename stalls that 8 checkpoints-for-every-branch would cause. The confidence estimator’s quality decides whether this wins.</li>
</ol>`, "hard") +
Q(`<p>Most designs keep the free list as a circular FIFO: allocate from the head, return freed registers at the tail. A branch checkpoint saves the head pointer, and recovery simply restores it. Why does that correctly return exactly the registers allocated by squashed instructions? Why would a free list kept as a stack (allocate and free at the top) break this scheme?</p>`,
`<p>Between the checkpoint and the mispredict, the head advanced past exactly the registers allocated by instructions younger than the branch, which are exactly the instructions being squashed. Meanwhile, registers freed in that time (by commits of instructions <em>older</em> than the branch) were appended at the tail, so they don’t sit between the saved head and the current head. Restoring the head re-adds exactly the squashed instructions’ registers, without touching any register freed in the meantime. None of the squashed instructions could have freed anything, because they are younger than the unresolved branch and can’t commit.</p>
<p>With a stack, a register freed after the checkpoint is pushed on top, mixed in with the registers allocated after it. Resetting the top pointer would then either lose the freed register or hand out a register that is still in use. Recovering a stack needs an explicit walk.</p>`, "medium") +
Q(`<p>Initial map r1→p1, r2→p2, r3→p3. The free list is a circular FIFO holding, from the head, p10, p11, p12, p13, p14.</p>
<pre><code>I0: add r1, r1, r2
I1: beq r1, r3, L     ; checkpoint taken here
I2: sub r2, r1, r3
I3: add r1, r2, r2
I4: mul r1, r1, r1</code></pre>
<p>All five are renamed, then I0 commits, then I1 is found to be mispredicted. (a) Give the map and the free list just before recovery. (b) Recover using the checkpoint. (c) Recover instead by walking the ROB and undoing mappings: in which order must you walk, and what goes wrong in the other order? (d) Rename the first correct-path instruction, <code>I5: sub r3, r1, r2</code>.</p>`,
`<ol start="0">
<li><strong>Renaming:</strong> I0: r1→p10 (old p1). Checkpoint at I1: map {r1: p10, r2: p2, r3: p3}, head at p11. I2: r2→p11 (old p2). I3: r1→p12 (old p10). I4: r1→p13 (old p12).</li>
<li><strong>(a)</strong> Map: r1→<strong>p13</strong>, r2→p11, r3→p3. I0’s commit freed p1 (its old mapping), appended at the tail, so the free list is p14, p1.</li>
<li><strong>(b)</strong> Copy the checkpoint: r1→p10, r2→p2, r3→p3. Restore the head to where p11 was: the free list is now p11, p12, p13, p14, p1. The squashed registers are back, and p1, freed after the checkpoint, is kept.</li>
<li><strong>(c)</strong> Walk <strong>youngest first</strong>: undo I4 (r1←p12, free p13), I3 (r1←p10, free p12), I2 (r2←p2, free p11). Result: r1→p10, r2→p2, r3→p3, correct. Oldest first goes wrong because r1 was written twice in the squashed region: I2 (r2←p2), I3 (r1←p10), then I4 sets r1←<strong>p12</strong>, a register that belonged to a squashed instruction and is also being returned to the free list. r1 would end up pointing at a free register, which corrupts it as soon as p12 is reallocated.</li>
<li><strong>(d)</strong> I5 reads r1→p10 and r2→p2; r3 gets the head of the free list, <strong>p11</strong>, with old mapping p3: <code>sub p11, p10, p2</code>.</li>
</ol>`, "hard") +
Q(`<p>Recovery walks the ROB at 8 entries per cycle, overlapped with the 15-cycle front-end refill, so it costs extra only when the walk takes longer than 15 cycles. At a mispredict, the number of younger instructions to undo is uniformly distributed from 0 to 300 (mean 150). (a) A colleague estimates the extra cost from the mean. What do they get? (b) What is the true average extra cost? (c) At 5 mispredicts per 1,000 instructions and IPC 3, how much time does this add?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Mean walk: 150 / 8 = 18.75 cycles, so extra = 18.75 − 15 = <strong>3.75 cycles</strong> per mispredict.</li>
<li><strong>(b)</strong> The walk time X = N/8 is uniform on 0 to 37.5 cycles, and the extra cost is max(0, X − 15). Its average is (1 / 37.5) ∫ from 15 to 37.5 of (x − 15) dx = 22.5² / (2 × 37.5) = <strong>6.75 cycles</strong>, 1.8× the estimate. The cost function is convex (zero below 15, linear above), so by Jensen’s inequality the average of the cost is larger than the cost of the average: long walks cost a lot and short walks don’t give anything back.</li>
<li><strong>(c)</strong> 5 × 6.75 = 33.75 extra cycles per 1,000 instructions, against 1,000 / 3 = 333 base cycles: about <strong>10% more time</strong>. That’s a strong case for checkpoints, at least on low-confidence branches.</li>
</ol>
<p>Whenever a cost has a threshold (a buffer that overflows, a walk that outlasts a refill, a queue that fills), compute it over the distribution, not from the mean.</p>`, "hard") +
`<h3 id="sec-sizing">Sizing and Performance</h3>` +
Q(`<p>Skylake has 180 integer physical registers, 16 architectural integer registers, and a 224-entry ROB. In a phase where almost every instruction writes an integer register, how many instructions can be in flight? What does that imply when a load misses to DRAM?</p>`,
`<p>The committed state permanently holds about 16 registers (in practice a few more for internal temporaries), so roughly 180 − 16 = <strong>164</strong> registers are available for in-flight destinations. If nearly every instruction writes one, rename stalls on an empty free list at about 164 instructions in flight, well before the ROB’s 224. The effective window is about 164.</p>
<p>During a DRAM miss the core fills those 164 slots, then rename stops even though the ROB has space and the execution units are idle. Doubling the ROB alone would gain nothing here; the register file is the binding limit. The counter to check is rename stall cycles due to no free registers, versus ROB-full stall cycles. Stores, branches, and compares that write only flags don’t consume integer registers, which is why designers can size the PRF below the ROB.</p>`, "medium") +
Q(`<p>You double the physical register file. Which workloads benefit, and which see nothing? What does it cost?</p>`,
`<p><strong>Benefit:</strong> workloads that stall rename on an empty free list, usually ones with long-latency misses followed by lots of independent work (high memory-level parallelism), where a larger effective window overlaps more misses. Vector-heavy FP code benefits if the FP/vector file was the one running out.</p>
<p><strong>No benefit:</strong> code limited by a dependence chain, front-end bound code (the window rarely fills), code with frequent mispredicts (the window is flushed before it fills), or code where the ROB, scheduler, or load queue fills first.</p>
<p><strong>Cost:</strong> the register file is heavily multi-ported (about two reads per issue port plus a write per result). Area grows with entries times ports squared, and access time grows with size. A slower register file may need an extra pipeline stage, which lengthens the misprediction penalty and adds bypass complexity. Power rises on every access, not just when the extra entries are used.</p>`, "medium") +
Q(`<p>Can renaming improve performance on a workload dominated by a long chain of true dependences? Give a case where it helps and one where it doesn’t.</p>`,
`<p>Renaming never shortens a chain of true dependences; the chain’s latency is a hard floor. It helps only by letting <em>other</em> work run alongside.</p>
<ul>
<li><strong>Doesn’t help:</strong> a single pointer-chasing linked-list walk, where each load’s address comes from the previous load. There is nothing else to overlap.</li>
<li><strong>Helps:</strong> several independent chains that the compiler wrote with the same registers (for example, an unrolled loop that reuses r1 in every copy). Without renaming, WAR and WAW conflicts would serialize the chains; with renaming they run in parallel.</li>
</ul>
<p>Rename can shorten some chains in a different way: move elimination and zero idioms (<code>mov</code> handled by remapping, <code>xor r,r</code> recognized as zero) execute at rename with zero latency, removing links from the chain.</p>`, "easy") +
Q(`<p>A core with 32 architectural integer and 32 architectural vector registers has 280 integer and 332 vector physical registers and a 512-entry ROB. In a hot loop, 55% of instructions write an integer register, 20% write a vector register, and 25% write no register. (a) How many instructions can be in flight, and which structure limits it? (b) How many integer physical registers would make the ROB the limit? (c) A colleague says a physical register is held until its last reader has read it, so you need extra registers on top of your answer. Is that right?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Physical registers in use = committed mappings (one per architectural register, always) + one per in-flight instruction with a destination. Integer: (280 − 32) / 0.55 = 248 / 0.55 ≈ <strong>451</strong> instructions. Vector: (332 − 32) / 0.20 = <strong>1,500</strong>. ROB: 512. The integer register file limits the window to about <strong>451</strong>, so 61 ROB entries are never used in this loop.</li>
<li><strong>(b)</strong> 32 + 0.55 × 512 = 313.6, so <strong>314</strong> integer registers. (A phase where every instruction writes an integer register would need 32 + 512 = 544, which is why designers size for typical mixes and accept stalls in dense phases.)</li>
<li><strong>(c) No.</strong> With free-at-commit, a register is held from rename of its producer until the <em>next writer</em> of the same architectural register commits. At any instant, every register in use is either a committed mapping (32 of them) or the destination of an in-flight instruction, so the formula above is exact; when the producer commits, its register becomes the committed mapping and the previous one is freed, keeping the count. Readers never extend the lifetime beyond this, because all readers of a value are older than the next writer and commit before it. Two things do change the count: early-release schemes free registers sooner (lowering it), and move elimination (next question) lets two architectural registers share one physical register, which breaks this simple accounting.</li>
</ol>`, "hard") +
Q(`<p>A loop has 12 instructions per iteration on a 6-wide core. Its loop-carried chain is <code>add r3, r1, r4</code> → <code>mov r1, r3</code> → <code>add r5, r1, r6</code> → <code>mov r1, r5</code> (then back to the first add in the next iteration). All other instructions are independent, and adds and moves take 1 cycle when executed. (a) What IPC does the loop reach without move elimination, and with it? (b) Move elimination breaks the rule that a physical register is freed when the next writer of its architectural register commits. Show how, and what hardware fixes it.</p>`,
`<ol start="0">
<li><strong>(a) Without elimination:</strong> the chain is 4 operations of 1 cycle = 4 cycles per iteration, so IPC = 12 / 4 = <strong>3</strong>. <strong>With elimination:</strong> each <code>mov</code> is done at rename by pointing r1 at the source’s physical register, with zero latency, so the chain is 2 cycles. But the width bound is also 12 / 6 = 2 cycles, because the eliminated moves still use rename slots and ROB entries. So IPC = 12 / max(2, 2) = <strong>6</strong>, a 2× speedup, now limited by width rather than the chain.</li>
<li><strong>(b)</strong> After <code>mov r1, r3</code> is eliminated, r1 and r3 both map to the same physical register, say p50. Later, when an instruction that overwrites r3 commits, the normal rule frees r3’s old register, p50, but r1 still maps to it. If p50 is reallocated, r1 is silently corrupted.</li>
</ol>
<p>The fix is a <strong>reference count</strong> per physical register (or a small table tracking registers with multiple mappings): elimination increments it, each commit of an overwriting instruction decrements it, and the register is freed only at zero. Recovery must also restore the counts for squashed eliminations. Because this tracking hardware is limited, real cores eliminate only some moves: when it is full, the move simply executes on an ALU. That variability is why microbenchmarks of move latency on recent cores sometimes show a mix of 0 and 1 cycles.</p>`, "hard") +
Q(`<p>A 6-wide issue stage reads source operands from the physical register file. After bypassing, each issued instruction needs 0, 1, or 2 register-file reads with probability 0.30, 0.45, and 0.25, independently. (a) How many reads per cycle are needed on average at full issue? (b) The design has only 8 read ports instead of 12. In what fraction of full-issue cycles is that not enough? With 10 ports? (c) What happens in those cycles, and roughly what do the fewer ports save?</p>`,
`<ol start="0">
<li><strong>(a)</strong> 0 × 0.30 + 1 × 0.45 + 2 × 0.25 = 0.95 reads per instruction, so <strong>5.7</strong> per cycle at 6-wide issue, under half of the 12 worst-case reads.</li>
<li><strong>(b)</strong> The total reads for 6 instructions is a sum of 6 independent variables; convolving the distribution gives P(more than 8) = <strong>6.1%</strong> and P(more than 10) = <strong>0.29%</strong>. (For comparison, P(more than 6) is 33%, so 6 ports would be too few.)</li>
<li><strong>(c)</strong> In an over-subscribed cycle, port arbitration lets the oldest instructions through and holds (or replays) the rest for a cycle, losing at least one issue slot. Since full-issue cycles are themselves a minority at typical IPC 2–3, the overall loss with 8 ports is usually well under 1%. The savings: with 6 write ports, the file goes from 18 to 14 ports, and since area grows roughly with ports², it shrinks to about (14 / 18)² ≈ 60%, with shorter access time too. This is why real register files have fewer read ports than 2 × issue width.</li>
</ol>`, "hard") +
Q(`<p>A Golden Cove-like core has 280 integer physical registers and a 512-entry ROB; x86-64 has 16 architectural integer registers per thread. In a phase where 60% of instructions write an integer register: (a) how many instructions can be in flight with one thread, and what limits it? (b) With two SMT threads, each statically given half the ROB, what limits each thread now? (Ignore flags and microcode temporaries.)</p>`,
`<ol start="0">
<li><strong>(a)</strong> Registers in use = committed mappings + in-flight destinations. (280 − 16) / 0.6 = <strong>440</strong> instructions, fewer than the 512 ROB entries, so the register file binds.</li>
<li><strong>(b)</strong> Each thread needs its own committed mappings: 2 × 16 = 32. In-flight capacity: (280 − 32) / 0.6 ≈ <strong>413</strong> instructions total, about 207 per thread if they share evenly, below each thread’s 256-entry ROB share. So under SMT the register file still binds, and more tightly per thread. A larger ROB partition would do nothing for either thread.</li>
</ol>
<p>The broader point: when you evaluate a structure size for an SMT core, recompute every other structure’s limit per thread. Fixed per-thread costs (architectural state) come out of the shared pool before any of it is available for the window.</p>`, "hard"),
},
{
  id: "intv-rob",
  title: "The ROB and Retirement",
  sections: [
    { id: "basics", label: "Why the ROB Exists" },
    { id: "retire", label: "Retirement and Commit" },
    { id: "sizing", label: "Sizing the ROB" }
  ],
  body: reset("intv-rob") + `
<p>Background: <a href="#/rob">Reorder Buffer</a>, <a href="#/rob-sizing">Sizing the Reorder Buffer</a>, <a href="#/latency-tolerance">Memory Latency Tolerance</a>.</p>
<h3 id="sec-basics">Why the ROB Exists</h3>` +
Q(`<p>Tomasulo’s algorithm already executes instructions out of order with reservation stations. What two problems does adding a reorder buffer solve that Tomasulo alone can’t?</p>`,
`<ol start="0">
<li><strong>Precise exceptions.</strong> Without a ROB, instructions update registers as they finish, so when one faults, younger instructions may already have changed state and older ones may not have finished. There is no clean point to restart from. The ROB holds results (or mappings) until every older instruction has finished, then commits them in order.</li>
<li><strong>Speculation recovery.</strong> To execute past unresolved branches, the core must be able to undo everything after a mispredicted branch. With a ROB, nothing past the branch has committed, so recovery just discards the younger entries.</li>
</ol>
<p>A third, in physical-register designs: the ROB entry is where the overwritten mapping waits until it can be freed at commit.</p>`, "easy") +
Q(`<p>List the fields of a ROB entry in a physical-register-file design (Skylake, Zen 4, Golden Cove style). For each, say what goes wrong without it.</p>`,
`<ul>
<li><strong>Completed bit:</strong> retirement can’t tell whether the head is done.</li>
<li><strong>Exception or fault code:</strong> faults couldn’t be deferred until the instruction is oldest, so speculative faults would be raised wrongly.</li>
<li><strong>Architectural destination and old physical register:</strong> needed to free the old register at commit, and to undo mappings in a ROB-walk recovery.</li>
<li><strong>New physical register:</strong> needed to update the committed map at retirement and to undo or redo mappings.</li>
<li><strong>PC (or a compressed form):</strong> needed to report the faulting address and restart after an exception or interrupt.</li>
<li><strong>Type and LSQ index:</strong> a store must tell its store-queue entry that it is now committed and may drain; a load releases its load-queue entry.</li>
<li><strong>Branch information:</strong> mispredict flag and checkpoint ID, for recovery and predictor update at retirement.</li>
</ul>
<p>Notably absent: the result value. In these designs values live in the physical register file; the original P6-style ROB held values, which made the ROB itself a large multi-ported register file.</p>`, "medium") +
Q(`<p>An interrupt arrives while 400 instructions are in flight. Where does the core take it, what happens to the 400 instructions, and roughly what does that cost beyond the handler itself?</p>`,
`<p>At an instruction boundary in retirement order. The simplest and most common approach is to let the oldest instruction(s) retire, then flush everything younger and redirect fetch to the handler. The architectural state is exactly “everything up to the boundary done, nothing after.”</p>
<p>All 400 in-flight instructions, many of them already executed, are discarded and must be refetched and re-executed after the handler returns. So the cost is like a misprediction with a full window: lost completed work, plus refilling the pipeline twice (into the handler and back out). Alternatives like waiting for a long-latency head instruction to finish would delay the interrupt by the miss latency, so designs bound it.</p>`, "medium") +
Q(`<p>What happens when the ROB is full? Does fetch stop immediately?</p>`,
`<p>Allocation (rename/dispatch) stalls: no new instruction can enter the back end without a ROB entry. Fetch and decode keep running until the queues between them and rename fill up, then they stall too. Execution and retirement continue normally; the stall ends as soon as the head retires and frees entries. A full ROB is usually a symptom (the head is waiting on something slow), not a cause.</p>`, "easy") +
`<h3 id="sec-retire">Retirement and Commit</h3>` +
Q(`<p>On Golden Cove (512-entry ROB, 6-wide allocation), a load at the ROB head misses to DRAM: 80 ns at 5 GHz. The code behind it is independent of the load and would otherwise run at the full 6 per cycle. Assume no other structure (physical registers, load queue, scheduler) fills before the ROB. How many cycles does allocation stall, and what is the effective IPC over the miss? Then: what if a second, independent miss is 50 instructions behind the first? What if its address depends on the first load?</p><p>(e) When the miss finally returns, how long does it take to retire the backlog at 8 per cycle, and does allocation stall while it drains?</p>`,
`<ol start="0">
<li>Miss latency: 80 ns × 5 GHz = <strong>400 cycles</strong>.</li>
<li>The ROB fills in 512 / 6 ≈ <strong>85 cycles</strong>, then allocation stalls for about 400 − 85 = <strong>315 cycles</strong> until the load returns and retirement restarts.</li>
<li>About 512 instructions get through in about 400 cycles: effective IPC ≈ <strong>1.3</strong>, against a peak of 6.</li>
<li><strong>Independent second miss 50 instructions later:</strong> it issues a few cycles after the first, so the two latencies overlap almost completely. Total cost is about the same as one miss. That’s memory-level parallelism, and it is what a big ROB is for.</li>
<li><strong>Dependent second miss:</strong> it can’t even start until the first returns, so the cost is about 2 × 400 cycles. A bigger ROB does nothing for it.</li>
</ol>
<p>Takeaway: a ROB can’t hide a 400-cycle miss (that would need about 400 × 6 = 2,400 entries); its value is in overlapping misses with each other.</p>
<p><strong>(e)</strong> 512 / 8 = <strong>64 cycles</strong> to retire the backlog. Allocation doesn’t wait for the whole drain: from the first retirement cycle, 8 entries free per cycle while allocation needs only 6, so dispatch resumes almost immediately and never stalls on the ROB during the drain (everything behind the head is already complete). With 6-wide retirement it also wouldn’t stall, but there would be no slack: any retirement hiccup, such as a store waiting for store-buffer space, would stall allocation directly.</p>`, "hard") +
Q(`<p>Your stats show the ROB is often full of completed instructions, yet IPC is low. What is happening, and how would you quantify it?</p>`,
`<p>Head-of-line blocking: retirement is strictly in order, so one unfinished instruction at the head (usually a load miss, sometimes a long divide or a serializing instruction) holds back every completed instruction behind it. Completed work doesn’t count until it retires, and the full ROB stops allocation.</p>
<p>To quantify it, count cycles where the head is not complete, and for each, record the head’s type and state (a load waiting on L2, L3, or DRAM, a divide, a store, or a fence) and how many younger entries are complete. The breakdown of head-stall cycles by cause tells you what to fix. If the completed count is high during those stalls, the core is extracting plenty of parallelism and the problem is purely the long-latency head event.</p>`, "easy") +
Q(`<p>How do stores differ from arithmetic instructions at retirement? Why does a store that misses in the L1 usually <em>not</em> stall retirement, and when does it?</p>`,
`<p>A store retires once its address and data are known; it does not wait to write the cache. At commit it becomes a “senior” store in the store buffer and drains to the L1 afterwards, in order on x86. So a store miss is absorbed by the store buffer, and retirement continues.</p>
<p>It stalls when the store buffer fills: a stream of stores missing in the cache (for example, a large <code>memset</code> to cold memory, where each line needs a read-for-ownership) drains slower than stores retire. Then allocation stalls on store-buffer or store-queue entries. Fences and atomics also wait for the store buffer to drain. Arithmetic instructions have no post-retirement work at all.</p>`, "medium") +
Q(`<p>Golden Cove retires up to 8 instructions per cycle but allocates only 6. Why would a designer make retirement wider than allocation, when sustained IPC can’t exceed 6 anyway?</p>`,
`<p>Because retirement is bursty. While a load miss sits at the head, hundreds of younger instructions complete but can’t retire. When the load returns, that backlog has to drain, and the ROB entries it holds are what allocation is waiting for. Retiring 8 per cycle drains it faster, freeing ROB entries, physical registers, and load-queue entries sooner, so allocation resumes sooner. The average stays at or below 6; the peak shortens recovery after every stall.</p>
<p>Retirement is also comparatively cheap to widen: it reads the ROB in order and updates the committed map, with no wakeup or select logic.</p>`, "medium") +
`<h3 id="sec-sizing">Sizing the ROB</h3>` +
Q(`<p>You double the ROB from 256 to 512 entries and a benchmark gets no faster. Give four distinct explanations and the statistic that separates each.</p>`,
`<ol start="0">
<li><strong>Another structure fills first:</strong> physical registers, scheduler, load queue, or store queue. Check allocation-stall cycles by resource; ROB-full cycles stay near zero.</li>
<li><strong>Dependence-bound misses:</strong> pointer chasing, where each miss depends on the last. Check average outstanding L1D misses (MLP): it stays near 1 no matter the window size.</li>
<li><strong>The window never fills:</strong> front-end bound code or frequent mispredicts. Check the ROB occupancy histogram and instructions between mispredicts. At 10 mispredicts per 1,000 instructions, there are about 100 instructions between flushes, so a 512-entry window is never filled with useful work.</li>
<li><strong>Memory bandwidth is saturated:</strong> more misses in flight just queue at the DRAM controller. Check DRAM bandwidth utilization against the achievable peak, and whether average miss latency rises as the ROB grows.</li>
</ol>
<p>A fifth, simulator-specific one: the workload fits in cache in the simulated region, so there are no long-latency events to overlap. Check that the simulation points are representative.</p>`, "hard") +
Q(`<p>Design an experiment to choose the ROB size for a new core.</p>`,
`<ol start="0">
<li><strong>Workloads:</strong> a diverse suite (SPEC CPU int and FP, plus server and client traces), with several simulation points per benchmark and proper warm-up of caches and predictors.</li>
<li><strong>Sweep:</strong> for example 192, 256, 320, 384, 512, 640 entries. Run two variants: (a) other window structures scaled in proportion (registers, scheduler, LSQ), and (b) only the ROB grown. Variant (b) alone mostly measures whichever other structure becomes the limit.</li>
<li><strong>Measure:</strong> IPC per benchmark, plus ROB-full cycles and MLP, to explain each curve.</li>
<li><strong>Find the knee:</strong> plot geomean speedup against size, and the marginal gain per added entry. Also report the spread: a few memory-bound benchmarks may keep gaining while most flatten.</li>
<li><strong>Cost:</strong> weigh against area, power, and whether a larger ROB (and the scaled structures) still meets timing or forces a slower clock or extra stage.</li>
</ol>`, "medium") +
Q(`<p>A workload spends a large fraction of cycles with a full ROB. How do you tell whether the root cause is a long-latency load, a dependence chain, insufficient execution throughput, or something else?</p>`,
`<p>Look at what the core is doing during the ROB-full cycles:</p>
<ul>
<li><strong>Head instruction state:</strong> a load waiting on memory points to latency. An ALU instruction waiting on operands points to a chain.</li>
<li><strong>Scheduler contents:</strong> many <em>ready</em> instructions that aren’t issuing point to execution throughput (port contention, divider busy). Few ready instructions point to dependences or memory.</li>
<li><strong>Outstanding misses:</strong> high MLP with a full ROB means memory latency is the limit and the window is doing its job.</li>
</ul>
<p>Then confirm with simulator ablations, which is the advantage of having a model: make every load hit L1 (if ROB-full cycles vanish, it was memory), give unlimited functional units (if they vanish, it was throughput), or remove the latency of the suspect chain’s operations.</p>`, "hard") +
Q(`<p>Using Little’s law, how many ROB entries would a 6-wide core need to fully hide an L2 hit (about 15 cycles) and a DRAM miss (about 400 cycles)? What does this tell you about where performance on memory-bound code really comes from?</p><p>Then make it concrete: one independent DRAM miss every 100 instructions on a 6-wide core with a 512-entry ROB, where no other structure fills first. Estimate the IPC with Little’s law, and explain why a cycle-level simulation gives about 1.45.</p>`,
`<p>Entries needed ≈ throughput × latency to cover:</p>
<ul>
<li>L2 hit: 6 × 15 = <strong>90 entries</strong>, easily covered by a 320- or 512-entry ROB.</li>
<li>DRAM: 6 × 400 = <strong>2,400 entries</strong>, far beyond any real ROB.</li>
</ul>
<p>So no realistic window hides DRAM latency. Performance on memory-bound code comes from <em>overlapping</em> misses with each other (MLP: the window must be big enough to reach the next independent miss), from prefetching (turning DRAM misses into cache hits), and from keeping the working set in cache. A bigger ROB helps only to the extent that it exposes more independent misses.</p>
<p><strong>Concrete case:</strong> Little’s law with the raw ROB size gives 512 / 400 = <strong>1.28</strong>. The simulation gives more because the window advances in whole miss-to-miss chunks: when the miss at the head returns, retirement runs on to the next miss 100 instructions later, so dispatch can reach 612 instructions past the old head and pick up one more miss. On average about 6 misses (600 instructions) overlap per 400-cycle latency: 600 / 400 = 1.5, minus small pipeline effects, giving the simulated <strong>1.45</strong>. Little’s law with the raw window slightly underestimates when misses are spread at a spacing comparable to the window; round the window up to the next miss.</p>`, "hard") +
Q(`<p>A memory-bound loop has one independent DRAM miss every 120 instructions. The core runs at 5 GHz with 90 ns DRAM latency and 64-byte lines. Compare a 320-entry ROB (Zen 4) with a 512-entry ROB (Golden Cove), assuming the window is always full of useful work and misses are evenly spaced. For each, estimate:</p><ul><li>Outstanding misses</li><li>Miss throughput (misses per cycle)</li><li>Effective penalty per miss</li><li>Demand DRAM bandwidth</li><li>The IPC ceiling</li></ul><p>Golden Cove tracks up to 16 outstanding L1D misses (fill buffers) and Zen 4 up to 24 (miss address buffers). Is either a limit?</p>`,
`<p>DRAM latency is 90 ns × 5 GHz = 450 cycles. A miss can be outstanding only while its load is in the window, so outstanding ≈ ROB size / instructions between misses. Then Little’s law gives throughput = outstanding / latency, and the effective penalty per miss is latency / outstanding = 1 / throughput.</p>
<div class="tbl"><table>
<tr><th>ROB</th><th>Outstanding</th><th>Throughput</th><th>Effective penalty</th><th>Demand bandwidth</th><th>IPC ceiling</th></tr>
<tr><td>320</td><td>320 / 120 ≈ 2.67</td><td>2.67 / 450 ≈ 0.0059</td><td>≈ 169 cycles</td><td>≈ 1.9 GB/s</td><td>≈ 0.71</td></tr>
<tr><td>512</td><td>512 / 120 ≈ 4.27</td><td>4.27 / 450 ≈ 0.0095</td><td>≈ 105 cycles</td><td>≈ 3.0 GB/s</td><td>≈ 1.14</td></tr>
</table></div>
<ul>
<li><strong>Bandwidth:</strong> throughput × 64 B × 5 × 10<sup>9</sup> cycles per second, for example 0.0059 × 64 × 5 × 10<sup>9</sup> ≈ 1.9 GB/s.</li>
<li><strong>IPC ceiling:</strong> throughput × 120 instructions per miss, which reduces to ROB size / latency (320 / 450 and 512 / 450). The core retires at most one window of instructions per miss latency.</li>
<li><strong>Miss buffers:</strong> even the smaller pool, Golden Cove’s 16, allows 16 × 64 B / 90 ns ≈ 11.4 GB/s, and 4.3 outstanding is far below 16 (2.7 is even further below Zen 4’s 24). Neither design is MSHR-limited, so the window is the limit and the larger ROB is worth about 1.6×.</li>
</ul>
<p>Caveats: this is idealized. Real misses cluster, mispredicts cut the window short, and the load queue or physical registers may fill before the ROB. As the Little’s-law question above shows, a cycle-level simulation lands slightly higher because the window advances in whole miss-to-miss chunks.</p>`, "hard") +
Q(`<p>Your statistics say average ROB occupancy is 180 of 512 entries, so a colleague argues the ROB is oversized and could be cut to 256. But the ROB is also full in 25% of cycles. Reconcile the two numbers, and say what they do and don’t tell you about shrinking or growing the ROB.</p>`,
`<p>If the ROB is full (512) in 25% of cycles, the other 75% average x where 0.25 × 512 + 0.75 × x = 180, so x ≈ <strong>69</strong>. The occupancy is bimodal: nearly full during memory-bound phases (a miss at the head, the window filling behind it), and mostly empty during the rest (refilling after mispredicts, compute phases with short lifetimes).</p>
<p>Shrinking to 256 would cap exactly the memory-bound phases, which are where a large window earns its keep by overlapping misses; the average hides that. Growing it helps only if, in those full phases, more independent misses lie beyond the current window. What you need is the occupancy histogram, the stall cycles attributed to a full ROB with the head instruction’s type, average outstanding misses during full-ROB phases, and ultimately a sweep. Never size a structure from its average occupancy.</p>`, "hard") +
Q(`<p>A core would sustain IPC 4 if nothing missed, and has a 320-entry ROB. Loads are 25% of instructions: 90% hit in L1, 8% hit in L2 (14 cycles), 2% go to DRAM (400 cycles). (a) Which misses can the ROB hide? (b) Estimate the IPC if DRAM misses are isolated and never overlap. (c) Estimate it if DRAM misses come in independent clusters of 4 close together.</p>`,
`<ol start="0">
<li><strong>(a)</strong> A full window holds about 320 / 4 = 80 cycles of work, so latencies well under 80 cycles are hidden when the work behind them is independent. L2 hits (14) are hidden; DRAM misses (400) are not.</li>
<li><strong>(b)</strong> DRAM misses per 1,000 instructions: 250 × 0.02 = 5. Each exposes about 400 − 80 = 320 cycles: 1,600 cycles. Base: 1,000 / 4 = 250 cycles. Total 1,850 cycles: <strong>IPC ≈ 0.54</strong>.</li>
<li><strong>(c)</strong> Four misses close together overlap, so each cluster costs about one exposure: 5 / 4 = 1.25 clusters × 320 = 400 cycles. Total 650 cycles: <strong>IPC ≈ 1.54</strong>, nearly 3× better with the same miss count.</li>
</ol>
<p>The 80-cycle estimate assumes the miss reaches the ROB head with the window otherwise flowing; a miss that arrives while the ROB is already stalled hides less. The big lesson stands: miss count alone doesn’t predict performance; their clustering (MLP) does.</p>`, "hard") +
Q(`<p>Mispredicted branches occur at 5 per 1,000 instructions, scattered randomly. When the ROB is full, how many entries hold correct-path instructions on average for a 256-, 512-, and 1,024-entry ROB? What does that imply for growing the ROB?</p>`,
`<p>From the head, the distance X to the first mispredicted branch is roughly geometric with mean D = 1,000 / 5 = 200 instructions; everything beyond it is wrong-path. Correct-path entries = min(X, W), and</p>
<p class="eq">E[min(X, W)] = D (1 − (1 − 1/D)<sup>W</sup>) ≈ D (1 − e<sup>−W/D</sup>)</p>
<ul>
<li>256 entries: 200 × (1 − e<sup>−1.28</sup>) ≈ <strong>144</strong></li>
<li>512 entries: 200 × (1 − e<sup>−2.56</sup>) ≈ <strong>185</strong></li>
<li>1,024 entries: 200 × (1 − e<sup>−5.12</sup>) ≈ <strong>199</strong></li>
</ul>
<p>Doubling 512 to 1,024 adds only about 14 useful entries (7%); the other 498 hold mostly wrong-path work that burns energy. A window much beyond about 3 × D is wasted, so window size has to grow together with prediction accuracy. Caveats: mispredicts cluster in real code (making long correct-path stretches more likely), and memory-bound phases with few branches benefit from big windows regardless.</p>`, "hard"),
},
{
  id: "intv-sched",
  title: "Scheduling and Execution",
  sections: [
    { id: "ready", label: "Readiness and Selection" },
    { id: "trace", label: "Tracing a Schedule" },
    { id: "tradeoffs", label: "Scheduler Trade-Offs" },
    { id: "ilp", label: "Execution Units and ILP" }
  ],
  body: reset("intv-sched") + `
<p>Background: <a href="#/scheduler">Scheduler Queues</a>, <a href="#/exec-units">Execution Units</a>.</p>
<h3 id="sec-ready">Readiness and Selection</h3>` +
Q(`<p>Give four different reasons an instruction whose operands are all ready doesn’t issue this cycle.</p>`,
`<ul>
<li><strong>Lost arbitration:</strong> an older ready instruction wants the same port, and the select logic picks the oldest.</li>
<li><strong>Unit busy:</strong> it needs a non-pipelined unit (a divider) that is still working on an earlier operation.</li>
<li><strong>Issue width exhausted:</strong> the scheduler already picked its maximum this cycle.</li>
<li><strong>Port restrictions:</strong> its queue feeds only certain ports, and those are taken, even though other ports are idle. On Skylake, shifts and branches can only use ports 0 and 6.</li>
<li><strong>Writeback conflict:</strong> issuing now would make it finish in the same cycle as an already-scheduled longer-latency operation on a shared result bus.</li>
</ul>`, "easy") +
Q(`<p>Explain wakeup and select. Why is the wakeup–select loop considered one of the critical timing paths of an out-of-order core? What happens to performance if it is split over two cycles?</p>`,
`<p><strong>Wakeup:</strong> when an instruction is selected, its destination tag is broadcast to every scheduler entry; each entry compares the tag with its source tags (a CAM) and marks matching sources ready. <strong>Select:</strong> among entries with all sources ready, a priority circuit picks up to <em>n</em> per port group.</p>
<p>For two dependent single-cycle operations to issue in back-to-back cycles, the first must be selected, broadcast its tag, wake the second, and the second must be selected, all within one cycle. That loop runs through the whole scheduler, so its delay grows with the number of entries and the number of broadcast tags (issue width).</p>
<p>If it takes two cycles, every chain of dependent 1-cycle operations runs at half speed: an add chain gets one add every 2 cycles. Integer code is full of short chains, so the loss is large. That’s why designers keep scheduler queues small and split, and pipeline only the parts outside this loop.</p>`, "medium") +
Q(`<p>Schedulers usually prefer the oldest ready instruction. Why is that a good default? Describe a case where it picks the wrong instruction.</p>`,
`<p>Why it works: the oldest instructions are the ones blocking retirement and the ones that have been waiting longest, so they are likely on the critical path; age order also guarantees no instruction starves.</p>
<p>When it fails: an old instruction off the critical path (say, an add whose result is used only by a store) beats a younger load whose address leads to a cache miss, delaying the miss by a cycle and every instruction that depends on it by hundreds. Criticality-aware schedulers prioritize loads and branches, or instructions predicted to be critical. Real hardware also only approximates age (age matrices or position-based priority in a compacting queue), since exact ordering across many entries is costly.</p>`, "medium") +
Q(`<p>Can a completely full scheduler deadlock, with every entry waiting and nothing able to issue? Argue from the dispatch order. Then describe how real designs can deadlock anyway.</p>`,
`<p><strong>Not from operand dependences alone.</strong> Dispatch is in order, so every instruction in the scheduler depends only on older instructions. Take the oldest instruction in the scheduler: all its producers are older still, so they have either completed or already issued and are executing. Its operands will therefore become ready in bounded time, it will issue, and the machine makes progress.</p>
<p><strong>Deadlock comes from resources, not data:</strong> it happens when an older instruction needs a resource that only younger instructions can release, and they release it only at retirement, which waits on the older instruction. Examples: younger loads holding all the miss-tracking or load-buffer entries until they retire while the oldest load needs one; a replay queue full of younger instructions; any structure allocated out of order and freed in order. The standard fixes are to guarantee forward progress for the oldest instruction (reserve an entry for it, or let it bypass the shared resource) or to flush younger instructions to free the resource. Interviewers like this question because it tests whether you know <em>why</em> in-order dispatch matters.</p>`, "hard") +
Q(`<p>Some Intel cores bind each uop to a specific execution port when it is allocated, not when it issues. Take two equivalent ALU ports, and assume each cycle exactly two ALU uops become ready, with nothing else waiting. (a) If binding picks a port at random, what is the throughput? (b) Does alternating ports at allocation fix it? (c) Why bind early at all?</p>`,
`<ol start="0">
<li><strong>(a)</strong> The two ready uops are on the same port with probability 1/2, in which case only one issues. Expected issue: 2 × 1/2 + 1 × 1/2 = <strong>1.5 per cycle</strong>, a 25% loss against the 2 the hardware could do.</li>
<li><strong>(b)</strong> Only partly. Alternating balances the <em>allocation</em> order, but instructions become ready in dataflow order, not allocation order: two uops that become ready in the same cycle may still have been bound to the same port. Real designs balance using counts of pending uops per port at allocation time, which reduces but does not eliminate collisions.</li>
<li><strong>(c)</strong> With early binding, each port’s select logic only arbitrates among its own uops, a small independent circuit. Late binding needs a select that considers every port for every ready uop in the same cycle, which is larger and harder to fit in the one-cycle wakeup–select loop. Early binding trades some throughput for a faster, simpler scheduler.</li>
</ol>`, "hard") +
`<h3 id="sec-trace">Tracing a Schedule</h3>` +
Q(`<p>Integer adds take 1 cycle, a result can be used by a dependent instruction in the next cycle (full bypass), and the core can issue two adds per cycle, oldest first. All four instructions are in the scheduler with ready sources at cycle 0.</p>
<pre><code>I0: r1 = r2 + r3
I1: r4 = r5 + r6
I2: r7 = r1 + r4
I3: r8 = r9 + r10</code></pre>
<p>(a) Give the issue cycle of each. (b) Does 4-wide issue help? (c) Replace I0 with a load whose result is available 10 cycles after it issues. (d) What changes without the bypass, if a result can be read only two cycles after issue?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Cycle 0: I0, I1, and I3 are ready; oldest first picks I0 and I1. Cycle 1: I2 (both producers finished) and I3. Done in 2 cycles.</li>
<li><strong>(b)</strong> No. Cycle 0: I0, I1, I3; cycle 1: I2. Still 2 cycles, because I0 → I2 is a chain of two 1-cycle operations. The critical path, not the width, sets the floor.</li>
<li><strong>(c)</strong> Cycle 0: I0 (load) and I1. Cycle 1: I3. I2 waits for the load until <strong>cycle 10</strong>. Width is irrelevant; the load latency dominates. With 2-wide issue, I3 was ready at cycle 0 but lost to I1, which costs nothing here because I3 isn’t on the critical path.</li>
<li><strong>(d)</strong> In (a), I2 issues at cycle 2 instead of 1: 3 cycles total. Every link in a dependence chain gets one cycle longer, which is why bypass networks are worth their wiring cost.</li>
</ol>
<p>Note on select policy: if select had picked I3 over I1 in cycle 0, I2 would slip to cycle 2. Policy matters when the critical path competes with off-path work.</p>`, "medium") +
Q(`<p>Sum 8 FP values with 4-cycle adds. How many cycles as a straight chain, and as a tree? Why doesn’t the compiler make the tree for you?</p>`,
`<p>Chain: 7 dependent adds × 4 cycles = <strong>28 cycles</strong>. Tree: log₂ 8 = 3 levels, 4 + 2 + 1 adds, but only 3 × 4 = <strong>12 cycles</strong> of latency, if all 4 first-level adds can start in the same cycle. With 2 pipelined FP adders (as on Skylake) the first level needs two issue cycles, and the late pair delays its branch of the tree by one cycle: <strong>13 cycles</strong>, still more than 2× faster than the chain.</p>
<p>The compiler won’t do it by default because FP addition isn’t associative: (a + b) + c can round differently from a + (b + c), so reassociating changes the result. It needs explicit permission (<code>-ffast-math</code>, <code>-fassociative-math</code>, or an OpenMP reduction). For integers it is allowed and compilers do it.</p>`, "easy") +
Q(`<p>After issue, the pipeline is: register read (R), execute (E), writeback (W). The register file is written at the end of W and a read in the same cycle doesn’t see the new value. A single-cycle producer issues in cycle t. For dependent consumers issued in cycles t+1, t+2, and t+3, where does each get its operand? How many bypass levels does the design need? How many if register read takes 2 cycles?</p>`,
`<p>Producer: R at t+1, E at t+2, W at t+3; the value is readable from the register file by reads in t+4 or later.</p>
<ul>
<li><strong>Issued t+1:</strong> R at t+2, E at t+3. Needs the value at the start of t+3: from the producer’s execute output (bypass level 1).</li>
<li><strong>Issued t+2:</strong> R at t+3, too early to see the register file write at the end of t+3. E at t+4: takes the value from the writeback-stage latch (bypass level 2).</li>
<li><strong>Issued t+3:</strong> R at t+4: reads the register file normally.</li>
</ul>
<p>So <strong>2 bypass levels</strong>. With a 2-cycle register read (R1, R2): producer E at t+3, W at t+4, readable from t+5. Consumers issued at t+1, t+2, and t+3 execute at t+4, t+5, and t+6, and all of them read the register file too early (at t+2, t+3, and t+4), so they need <strong>3 bypass levels</strong>; only the consumer issued at t+4 reads the file. Every extra register-read stage adds a bypass level, and each level multiplies the mux inputs by the number of producing units, one reason designers fight to keep register read to one cycle.</p>`, "hard") +
Q(`<p>A loop computes the sequence x = a·x + b 1,000 times (64-bit integers, wrapping on overflow). Multiply takes 3 cycles, add 1 cycle; there is one fully pipelined multiplier and the core is 4-wide. (a) How many cycles does it take? (b) Restructure it using the recurrence two steps at a time. How many cycles now, and what must be precomputed? (c) How far can you push this, and what limits it?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Each step is a multiply then an add on the loop-carried chain: 4 cycles per step, about <strong>4,000 cycles</strong>, with the multiplier busy only a quarter of the time.</li>
<li><strong>(b)</strong> Two steps at once: x<sub>n+2</sub> = a(a·x<sub>n</sub> + b) + b = A·x<sub>n</sub> + B with A = a² and B = a·b + b, precomputed once. Run two independent chains, one for even and one for odd indices (starting from x<sub>0</sub> and x<sub>1</sub>): each chain advances one step per 4 cycles, so 2 values per 4 cycles: about <strong>2,000 cycles</strong>. Wrapping 64-bit arithmetic is a ring, so the algebra is exact.</li>
<li><strong>(c)</strong> With <em>k</em> interleaved chains (A = a<sup><em>k</em></sup>, B = b(a<sup><em>k</em>−1</sup> + … + 1)), you get <em>k</em> values per 4 cycles until the multiplier saturates at one multiply per cycle, at <em>k</em> = 4: about <strong>1,000 cycles</strong>. Width isn’t the limit (2 instructions per value, 4-wide). This is the general trick for latency-bound recurrences: trade more total work or precomputation for independent chains.</li>
</ol>`, "hard") +
`<h3 id="sec-tradeoffs">Scheduler Trade-Offs</h3>` +
Q(`<p>The scheduler is full in 30% of cycles. Does that mean it’s too small? What would you check before recommending a bigger one?</p>`,
`<p>Not necessarily. A full scheduler often means it is full of instructions waiting on a long-latency load. The real problem is then memory latency; the scheduler is just where the waiting happens. Check:</p>
<ul>
<li><strong>Who is waiting on what:</strong> the fraction of entries waiting (directly or through a chain) on an outstanding miss. Mostly yes: memory-bound.</li>
<li><strong>Ready but not issuing:</strong> many ready entries means port contention or execution throughput, not capacity.</li>
<li><strong>Is it the binding limit:</strong> when it’s full, are the ROB and LSQ also nearly full? If the scheduler is the <em>first</em> thing to fill and stalls allocation while the ROB has room, growing it can expose more independent work, including the next miss.</li>
<li><strong>Imbalance:</strong> with split queues, one queue can be full while others are empty, which is a steering problem, not a size problem.</li>
</ul>
<p>The decisive test is the sweep: grow it in the model and see whether the scheduler-full cycles turn into useful work or just move to another full structure.</p>`, "medium") +
Q(`<p>You grow the scheduler and IPC improves only on memory-intensive benchmarks. What does that tell you?</p>`,
`<p>On those benchmarks the scheduler was clogged by instructions dependent on cache misses. Those instructions occupy entries for hundreds of cycles, so a larger scheduler lets more independent instructions, including future loads, enter behind them. More loads in flight means more misses overlapped (higher MLP), which is where the gain comes from. Confirm it: average outstanding misses should rise with the scheduler size.</p>
<p>Compute-bound benchmarks didn’t gain because their instructions spend only a few cycles in the scheduler; by Little’s law, a short wait time needs few entries. Also check that the ROB, registers, and LQ were big enough that the scheduler was the first limit on the memory-bound ones.</p>`, "medium") +
Q(`<p>The ROB holds an instruction from allocation to retirement; the scheduler holds it from allocation to issue. Use Little’s law to explain why Skylake has a 224-entry ROB but only a 97-entry scheduler.</p>`,
`<p>Occupancy = throughput × time in the structure. At the same throughput, the ROB holds each instruction for its whole lifetime (including waiting to retire behind a miss), while the scheduler holds it only until its operands are ready and it issues. Many instructions issue within a few cycles of allocation and then leave the scheduler while staying in the ROB for a long time, so the average scheduler residency is much shorter.</p>
<p>Cost pushes the same way: each scheduler entry compares against every broadcast tag every cycle and sits inside the wakeup–select timing loop, while a ROB entry is RAM accessed at the head and tail. A scheduler as big as the ROB would cost far more in area, power, and timing. The weak point: during a long miss, dependent instructions sit in the scheduler as long as in the ROB, which is exactly when the scheduler fills.</p>`, "medium") +
Q(`<p>How would you model a scheduler that issues up to 4 instructions per cycle, but at most 2 integer ALU operations, 2 loads, and 1 store, plus one non-pipelined 14-cycle divider shared with ALU port 0?</p>`,
`<p>Each cycle, walk the ready instructions in age order and greedily assign them, with a counter per resource class and a busy-until cycle for the divider:</p>
<pre><code>int n = 0, alu = 0, ld = 0, st = 0;
for (each ready entry e, oldest first) {
    if (n == 4) break;
    switch (e-&gt;cls) {
    case ALU:   if (alu == 2) continue; alu++; break;
    case LOAD:  if (ld == 2)  continue; ld++;  break;
    case STORE: if (st == 1)  continue; st++;  break;
    case DIV:   if (div_busy_until &gt; now || alu == 2) continue;
                alu++; div_busy_until = now + 14; break;
    }
    issue(e); n++;
}</code></pre>
<p>Points worth saying out loud:</p><ul><li><code>continue</code>, not <code>break</code>, when a class is full, so younger instructions of other classes can still go</li><li>A divide occupies an ALU port slot only in the cycle it issues</li><li>Skipping an instruction must not reorder anything</li><li>If real hardware binds instructions to specific ports at allocation (as Intel cores do), model that binding, because it can leave a ready instruction waiting for a busy port while an equivalent port is free</li></ul>`, "medium") +
Q(`<p>At IPC 4, instructions spend this long in the scheduler between dispatch and issue: 70% about 2 cycles, 25% about 10 cycles (waiting on L1 or L2 hits), and 5% about 400 cycles (waiting, directly or through a chain, on DRAM misses). (a) What is the average occupancy? (b) How much of it is the 5%? (c) What happens with a 60-entry scheduler, and what does that suggest about scheduler design?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Average wait: 0.7 × 2 + 0.25 × 10 + 0.05 × 400 = 1.4 + 2.5 + 20 = 23.9 cycles. Little’s law: 4 × 23.9 ≈ <strong>96 entries</strong>, close to Skylake’s 97-entry scheduler.</li>
<li><strong>(b)</strong> 4 × 0.05 × 400 = <strong>80 entries</strong>, 84% of the scheduler, held by the 5% of instructions waiting on DRAM and doing nothing.</li>
<li><strong>(c)</strong> 60 entries can support at most 60 / 23.9 ≈ <strong>2.5 IPC</strong> with this mix. Since the long waiters dominate the occupancy, scheduler size is really set by miss handling. That motivates designs that move miss-dependent instructions out of the scheduler into a cheap buffer and bring them back when the data arrives, rather than growing the expensive wakeup CAM.</li>
</ol>`, "hard") +
`<h3 id="sec-ilp">Execution Units and ILP</h3>` +
Q(`<p>Skylake has four integer ALU ports, but shifts and branches can only use two of them (ports 0 and 6). A tight loop is about half shifts and branches. What is the best-case IPC, and how would you detect this limit with counters?</p>`,
`<p>If half the instructions can only use 2 ports, those ports must carry 0.5 × IPC instructions per cycle, so 0.5 × IPC ≤ 2, giving IPC ≤ 4, which matches the core’s 4-wide limit. So at exactly half, the restriction is just barely not binding. If shifts and branches are 60% of the loop, the bound is 2 / 0.6 ≈ 3.3. And because the taken branch can only use port 6, a loop with one taken branch per iteration can’t run faster than one iteration per cycle.</p>
<p>Detection: per-port dispatch counters (for example, uops dispatched on port 0 and port 6 approaching 1 per cycle each) while other ALU ports sit idle, with plenty of ready instructions in the scheduler. That pattern means port contention rather than a lack of independent work.</p>`, "hard") +
Q(`<p>Two programs execute the same number of instructions, but one runs at IPC 3.2 and the other at 0.9. Name the properties of the instruction stream that could explain this, and for each, the counter that would show it.</p>`,
`<ul>
<li><strong>Dependences:</strong> long chains versus independent work. Shown by low ready counts in the scheduler with idle ports.</li>
<li><strong>Memory behavior:</strong> working set fitting in L1 versus streaming from DRAM, and dependent versus independent misses. Shown by misses per 1,000 instructions per level and average outstanding misses.</li>
<li><strong>Branches:</strong> predictable loops versus data-dependent branches. Shown by mispredicts per 1,000 instructions.</li>
<li><strong>Instruction mix:</strong> cheap adds versus divides, gathers, or microcoded instructions. Shown by per-port utilization and microcode-sequencer cycles.</li>
<li><strong>Code footprint:</strong> a tight loop in the op cache versus a large server binary missing in the i-cache and BTB. Shown by front-end-bound slots and i-cache misses.</li>
</ul>`, "easy") +
Q(`<p>When can an in-order core be competitive with an out-of-order core? Give two concrete examples.</p>`,
`<ul>
<li><strong>Latency hidden by threads instead of reordering:</strong> GPU streaming multiprocessors issue in order, but switch between many warps every cycle, so while one warp waits on memory, others run. Throughput-oriented in-order cores with fine-grained multithreading (like Sun’s Niagara) used the same idea for server work.</li>
<li><strong>Predictable, well-scheduled code:</strong> DSP and media kernels with known latencies and data in local memory, where the compiler can schedule statically.</li>
<li><strong>Efficiency per watt or per mm²:</strong> Arm’s little cores (Cortex-A55, A520) lose on single-thread speed but win on energy per task for background work, which is why phones pair them with big out-of-order cores.</li>
<li><strong>Bandwidth-bound streaming:</strong> if both cores saturate DRAM bandwidth, the out-of-order core’s extra parallelism has nothing to buy.</li>
</ul>`, "easy") +
Q(`<p>On Skylake, FMAs use ports 0 and 1, vector shuffles only port 5, scalar shifts ports 0 and 6, taken branches only port 6, and simple integer ALU operations any of ports 0, 1, 5, and 6. A loop iteration has 2 FMAs, 2 shuffles, 1 shift, 1 taken branch, and 2 simple ALU operations (8 uops). (a) What is the minimum cycles per iteration? Give a valid port assignment. (b) Add a third shuffle. Now what? (c) How would you see this in counters, and fix it?</p>`,
`<ol start="0">
<li><strong>(a)</strong> 8 uops on 4 ALU ports need at least 2 cycles (and the 4-wide front end also needs 2). Port 5 must run both shuffles: 2 cycles. Assignment over 2 cycles:<ul><li>Port 0: FMA, shift</li><li>Port 1: FMA, ALU</li><li>Port 5: shuffle, shuffle</li><li>Port 6: branch, ALU</li></ul> <strong>2 cycles, 4 uops per cycle.</strong></li>
<li><strong>(b)</strong> Three shuffles need port 5 for <strong>3 cycles</strong>, and nothing else can help. 9 uops in 3 cycles = 3 per cycle, while the front end could deliver them in 2.25 cycles and the other three ports sit idle a third of the time.</li>
<li><strong>(c)</strong> Per-port dispatch counters show port 5 at about 1 uop per cycle and the others well below, with ready uops waiting. Fixes: replace a shuffle with an instruction that runs elsewhere (a blend, or a broadcast folded into a load), restructure the data layout so fewer shuffles are needed, or move to a core with shuffle units on more ports.</li>
</ol>`, "hard") +
Q(`<p>A dot-product loop does, per element, 2 loads, 1 FMA into an accumulator, 1 index increment, and 1 fused compare-and-branch: 5 uops. The core is Zen 4-like: 6-wide, 3 loads per cycle, 2 FMA pipes with 4-cycle latency. (a) What is the resource bound in cycles per element? (b) The recurrence bound with one accumulator? (c) Unrolled by 8 with 8 accumulators (one index increment and one branch per 8 elements): cycles per element, and which resource binds?</p>`,
`<ol start="0">
<li><strong>(a)</strong><ul><li>Loads: 2 / 3 = 0.67 cycles</li><li>FMA: 1 / 2 = 0.5</li><li>Width: 5 / 6 = 0.83</li></ul> Resource bound = <strong>0.83 cycles per element</strong> (width).</li>
<li><strong>(b)</strong> Every FMA depends on the previous one through the accumulator: <strong>4 cycles per element</strong>, nearly 5× worse than the resource bound.</li>
<li><strong>(c)</strong> Per 8 elements: 16 loads, 8 FMAs, 1 add, 1 branch = 26 uops. Width: 26 / 6 = 4.33 cycles. Loads: 16 / 3 = 5.33. FMA: 8 / 2 = 4. Recurrence: each accumulator is updated once per 8 elements: 4 cycles. The maximum is <strong>5.33 cycles per 8 elements = 0.67 per element</strong>, load-bound. The FMA units are 75% busy at best; only reusing loaded values across several FMAs (as matrix multiply does) reaches the FMA peak.</li>
</ol>
<p>This is the same calculation compilers do for modulo scheduling: the initiation interval is the maximum of the resource bound and the recurrence bound.</p>`, "hard") +
Q(`<p>A loop sums the elements above a threshold: <code>if (x[i] &gt; t) s += x[i];</code>. On random data the branch is taken 50% of the time, unpredictably; a mispredict costs 17 cycles. (a) Estimate cycles per element for the branchy version and for a branchless version <code>s += (x[i] &gt; t) ? x[i] : 0</code> using a conditional move. (b) What if the data is sorted? (c) For a running maximum, <code>m = (x[i] &gt; m) ? x[i] : m</code>, explain why the branchless version can be about 2× <em>slower</em> than the branch even on random data.</p>`,
`<ol start="0">
<li><strong>(a)</strong> Branchy: 0.5 × 17 = <strong>8.5 cycles of mispredicts per element</strong>, about 9 cycles in total. Branchless: the select depends only on x[i], not on s, so it’s off the loop-carried chain; the chain is just the add, 1 cycle per element, and throughput is about 1 cycle per element: roughly <strong>9× faster</strong>.</li>
<li><strong>(b)</strong> Sorted data makes the branch almost perfectly predictable, so both versions run at about 1 cycle per element.</li>
<li><strong>(c)</strong> In the max loop the conditional move is <em>on</em> the chain: compare m, then select into m: 2 cycles per element. On random data the running maximum changes rarely (about ln <em>n</em> times over <em>n</em> elements), so the branch is almost always not taken and well predicted, and the predicted branch breaks the dependence: the core doesn’t wait for m to know what to do next. That gives about 1 cycle per element, 2× faster than the branchless version. Branchless code wins when the branch is unpredictable and the select is off the critical path; it loses when the branch is predictable and the select sits on a loop-carried chain.</li>
</ol>`, "hard"),
},
{
  id: "intv-arith",
  title: "Arithmetic and Floating Point",
  sections: [
    { id: "fmt", label: "Formats and Numerics" },
    { id: "units", label: "Arithmetic Units" },
    { id: "model", label: "Arithmetic in Performance Models" }
  ],
  body: reset("intv-arith") + `
<p>Background: <a href="#/r/arith">Computer Arithmetic</a>, especially <a href="#/fp-rounding">Rounding, Exceptions, and Error</a>, <a href="#/int-units">Integer Arithmetic Units</a>, and <a href="#/fp-units">Floating-Point Units and the FMA Pipeline</a>. Latencies below are from Agner Fog’s instruction tables.</p>
<h3 id="sec-fmt">Formats and Numerics</h3>` +
Q(`<p>A colleague stores 64-bit event IDs in a <code>float</code> column to save space, arguing that “FP32 has about 7 significant digits, so 123,456,789 only loses its last digit or two.” What is actually stored for 123,456,789, and is the argument sound for IDs?</p>`,
`<ol start="0">
<li>2<sup>26</sup> = 67,108,864 ≤ 123,456,789 &lt; 2<sup>27</sup>, so the ULP is 2<sup>26 − 23</sup> = 8.</li>
<li>123,456,789 / 8 = 15,432,098.625, which rounds to 15,432,099, so the stored value is <strong>123,456,792</strong>, off by 3.</li>
<li>The relative error (2.4 × 10<sup>−8</sup>) is as small as promised, so for a measurement the argument is fine. For an ID it isn’t: every float here stands for 8 neighboring integers, so 123,456,789 and 123,456,790 become the same key. IDs need exact integers, and FP32 is exact only up to 2<sup>24</sup>.</li>
</ol>`, "easy") +
Q(`<p>Activations are quantized to FP8 E4M3 with one scale per tensor, chosen so the largest magnitude maps to 448. Most values lie within ±1, but one channel has an outlier of 300. What happens to activations of 0.002 and 0.0005, with and without the outlier? What would you change?</p>`,
`<p>E4M3 facts: smallest normal 2<sup>−6</sup> = 0.015625, subnormal spacing 2<sup>−9</sup> ≈ 0.00195, 3 fraction bits (at most 6.25% relative error for a normal number).</p>
<ol start="0">
<li><strong>With the outlier:</strong> scale s = 300 / 448 ≈ 0.67, so a value x is stored as x / 0.67.
<ul><li>0.002 → 0.00299, a subnormal: 0.00299 / 0.00195 = 1.53 rounds to 2 spacings = 0.0039, which dequantizes to 0.0026. That’s <strong>31% high</strong>.</li>
<li>0.0005 → 0.00075, below half the smallest subnormal (0.00098), so it becomes <strong>0</strong>.</li></ul></li>
<li><strong>Without it:</strong> s = 1 / 448. 0.002 → 0.896 and 0.0005 → 0.224, both normal, so both are within 6.25%.</li>
<li><strong>Fixes:</strong> finer-grained scales (per channel, or per 32-element block as in the MX formats), so one outlier only affects its own block. Alternatively, clip outliers, or keep the few outlier channels in BF16 and the rest in FP8.</li>
</ol>
<p>The general point: a per-tensor scale spends the format’s 15 binades of range on the outlier, and everything small falls into the subnormals or to zero.</p>`, "hard") +
`<h3 id="sec-units">Arithmetic Units</h3>` +
Q(`<p>Why does one FMA count as 2 FLOPs in peak-performance figures? A kernel does only FP additions, perfectly vectorized and with enough independent chains. What fraction of the advertised peak can it reach?</p>`,
`<p>An FMA does a multiply and an add, so peak FLOPS = FMA pipes × lanes × 2 × frequency. An addition is 1 FLOP per vector lane per issue slot, whether it runs on the FMA pipe as a × 1 + b (Skylake) or on separate adder pipes (Zen 4, which has 2 FADD pipes next to its 2 FMA pipes). Either way, add-only code reaches at most <strong>half the peak</strong>. The same holds for multiply-only code. Peak FLOPS figures describe dense linear algebra, not general FP code.</p>`, "easy") +
Q(`<p>On Golden Cove, a vector FP add has 2-cycle latency when its result feeds another add, and 3 cycles otherwise. How would you represent this in a cycle-level model, which code would show the difference, and how would you measure it?</p>`,
`<ul>
<li><strong>Model:</strong> latency is a property of the producer–consumer pair, not of the producer alone. Give the adder a fast bypass to its own inputs: when an add’s consumer is also an add, wake it after 2 cycles, otherwise after 3. In a scheduler model this means the wakeup delay depends on the consumer’s opcode class, so it’s easiest to model as an extra cycle on the general bypass path.</li>
<li><strong>Where it shows:</strong> latency-bound add chains, such as a reduction with too few accumulators or a scalar running sum. A single-accumulator FP sum runs 1.5× faster (2 vs. 3 cycles per element). Throughput-bound code with many independent chains doesn’t change.</li>
<li><strong>Measurement:</strong> time a long dependent chain of <code>vaddps</code> (expect 2 cycles each), then a chain alternating <code>vaddps</code> and a 1-cycle op such as <code>vandps</code> or a move into another domain. Subtract the known cost of the other op to get the add-to-other latency.</li>
</ul>`, "medium") +
Q(`<p>A hash-table benchmark does independent lookups, each with about 8 cycles of other work and one <code>hash % nbuckets</code> on 64-bit operands, where <code>nbuckets</code> is a prime near 1,000,000. Estimate the cost per lookup on Skylake (64-bit <code>DIV</code>: latency 35–88, reciprocal throughput 21–83) and Ice Lake (latency 15, reciprocal throughput 10). How would you fix it?</p>`,
`<ol start="0">
<li><strong>Which limit applies:</strong> lookups are independent, so the divide’s latency overlaps and the divider’s <em>throughput</em> is the bound, unless the ROB fills first.</li>
<li><strong>Skylake:</strong> a random 64-bit hash divided by about 2<sup>20</sup> gives a quotient of about 44 bits, toward the slow end of the range. Expect roughly 60–80 cycles per lookup set by the divider, against 8 cycles of other work: <strong>about 8–10× slower</strong> than without the modulo.</li>
<li><strong>Ice Lake:</strong> about 10 cycles per lookup, slightly above the 8 cycles of other work. The divide goes from dominant to roughly breaking even.</li>
<li><strong>Fixes:</strong>
<ul><li>Use a power-of-two table and <code>hash &amp; (n − 1)</code>, with a hash good enough that the low bits are random.</li>
<li>Use Lemire’s range reduction, <code>((uint64_t)h32 * n) &gt;&gt; 32</code>: one multiply, 3-cycle latency, fully pipelined.</li>
<li>Precompute a reciprocal for the fixed divisor (libdivide or Lemire’s fastmod), turning the modulo into two or three multiplies.</li>
<li>At minimum, use 32-bit operands: Skylake’s 32-bit <code>DIV</code> has 26-cycle latency and a reciprocal throughput of 6.</li></ul></li>
<li><strong>Modeling lesson:</strong> a model calibrated on Skylake would overestimate this benchmark’s run time on Ice Lake by several times. Divider latency and throughput should be per-core parameters, ideally a function of quotient length.</li>
</ol>`, "hard") +
Q(`<p>On Zen 4, 256-bit FMAs have 4-cycle latency and issue 2 per cycle, while 512-bit FMAs are double-pumped: 4-cycle latency, 1 per cycle. (a) Compare peak FP32 FLOPs per cycle and the minimum number of accumulators for each width. (b) An SGEMM micro-kernel nevertheless often runs faster with AVX-512 on Zen 4. Give the reasons, with numbers.</p>`,
`<ol start="0">
<li><strong>(a)</strong> AVX2: 2 × 8 lanes × 2 = 32 FLOPs per cycle. AVX-512: 1 × 16 × 2 = <strong>32 FLOPs per cycle, the same</strong>. Accumulators = latency × issue rate: 4 × 2 = 8 ymm registers, versus 4 × 1 = 4 zmm registers.</li>
<li><strong>(b) More registers, bigger tile:</strong> AVX2 has 16 architectural vector registers, AVX-512 has 32. With a tile of 2 B vectors and broadcast A values, AVX2 fits a 6 × 2-vector tile (12 accumulators + 2 B + 1 broadcast = 15 registers), doing 12 FMAs per 2 B loads and 6 broadcasts: 8 loads per 12 FMAs, or 0.67. AVX-512 fits 14 × 2 (28 + 2 + 1 = 31 registers): 16 loads per 28 FMAs, or 0.57. Fewer loads per FLOP leaves more slack on the load ports and the L1.</li>
<li><strong>Half the instructions per FLOP:</strong> at peak, AVX2 issues 2 FMAs plus about 1.3 loads per cycle, AVX-512 1 FMA plus about 0.6 loads. That leaves much more of Zen 4’s 6-wide rename and its scheduler and ROB capacity for loop overhead, prefetches, and packing code, so the kernel stays closer to peak.</li>
<li><strong>Masking</strong> handles matrix edges without scalar cleanup loops.</li>
<li><strong>What doesn’t change:</strong> peak FLOPs and memory bandwidth. Memory-bound kernels gain little, and the gain on compute-bound kernels is modest, not 2×.</li>
</ol>`, "hard") +
`<h3 id="sec-model">Arithmetic in Performance Models</h3>` +
Q(`<p>At <code>-O3</code> without <code>-ffast-math</code>, GCC does not vectorize <code>float s = 0; for (i = 0; i &lt; n; i++) s += x[i];</code>. Why not? On Zen 4 (FP add latency 3, two 256-bit FP add pipes), how large is the gap to a fully vectorized sum when x is in L1? How can the programmer close it without <code>-ffast-math</code>?</p>`,
`<ul>
<li><strong>Why:</strong> FP addition isn’t associative. Vectorizing splits the sum into lanes and adds them in a different order, which can change the result, and C requires the source order unless reassociation is allowed.</li>
<li><strong>Gap:</strong> the scalar loop is one chain, 1 add every 3 cycles. A vectorized loop with at least 2 × 3 = 6 vector accumulators reaches 2 adds × 8 lanes = 16 elements per cycle. That’s <strong>48× faster</strong>. In practice, loading 64 bytes per cycle becomes the limit first.</li>
<li><strong>Without <code>-ffast-math</code>:</strong> write the reassociation explicitly (several accumulators in the source, combined at the end), use <code>#pragma omp simd reduction(+:s)</code>, or allow <code>-fassociative-math</code> for just that file. All of these give a fixed, deterministic order, unlike <code>-ffast-math</code>, which also enables FTZ and drops NaN and infinity handling for the whole program.</li>
</ul>`, "medium") +
Q(`<p>Kahan summation computes, per element, <code>y = x[i] - c; t = s + y; c = (t - s) - y; s = t;</code>. With FP add latency 3 (Zen 4), what is its throughput as written, compared with a naive single-accumulator sum? How do you get compensated accuracy at close to vectorized speed?</p>`,
`<ol start="0">
<li><strong>Find the loop-carried cycle.</strong> c<sub>i</sub> → y<sub>i+1</sub> = x − c<sub>i</sub> → t<sub>i+1</sub> = s<sub>i</sub> + y<sub>i+1</sub> → t<sub>i+1</sub> − s<sub>i</sub> → c<sub>i+1</sub> = (t − s) − y. That’s <strong>4 dependent adds per element</strong>, and s is on the cycle too, since s<sub>i+1</sub> = t<sub>i+1</sub>.</li>
<li><strong>As written:</strong> 4 × 3 = <strong>12 cycles per element</strong>, versus 3 for the naive sum, which is itself latency bound. So Kahan is 4× slower than a naive scalar sum and about 200× slower than a vectorized one.</li>
<li><strong>Fix:</strong> run independent Kahan sums in parallel, one per vector lane and several vectors deep, and combine them at the end (with a final compensated combination). Each element then costs 4 adds of throughput, not latency: 4 adds × 1/16 cycle each at 16 adds per cycle = 0.25 cycles per element. That’s about 4× slower than a vectorized naive sum, and usually hidden behind memory bandwidth.</li>
<li><strong>Alternative:</strong> for FP32 data, accumulate in FP64 lanes. That’s one add per element plus a conversion, and accurate enough for most uses.</li>
<li><strong>Trap:</strong> under <code>-ffast-math</code>, the compiler may simplify <code>(t - s) - y</code> to 0 and delete the compensation.</li>
</ol>`, "hard") +
Q(`<p>Your C cycle-level simulator reports IPC 1.8231 on an x86 build and 1.8226 on an Arm build, for the same trace and configuration. The code has no undefined behavior and no threads. What are the likely causes, and how do you make results bit-identical?</p>`,
`<ul>
<li><strong>FMA contraction:</strong> GCC defaults to <code>-ffp-contract=fast</code> in GNU C mode, so on AArch64 (where FMA is always available) it fuses <code>a * b + c</code>. A baseline x86-64 build has no FMA instruction, so it can’t. Different rounding in a float used for a decision (a replacement policy score, a predictor confidence, a throttle threshold) flips that decision, and the difference cascades into different timing.</li>
<li><strong>libm:</strong> <code>exp</code>, <code>log</code>, and <code>pow</code> aren’t required to be correctly rounded, and glibc versions and platforms differ in the last bit.</li>
<li><strong>Reductions and statistics:</strong> a different summation order (vectorized on one target, not the other) only changes the reported stats, but if those feed back into the model, as in adaptive policies, they change behavior too.</li>
<li><strong>Fix:</strong> make everything that steers the model integer or fixed point (counters, saturating confidences, fixed-point weights), keep floating point for reported statistics only, build with <code>-ffp-contract=off</code>, and avoid libm in decision paths. Then add a regression test that compares a hash of the per-cycle state across platforms.</li>
</ul>`, "medium"),
},
{
  id: "intv-branch",
  title: "Branch Prediction and Speculation",
  sections: [
    { id: "cost", label: "The Cost of a Mispredict" },
    { id: "predictors", label: "Predictor Structures" },
    { id: "spec", label: "Speculation and Recovery" },
    { id: "eval", label: "Evaluating a Predictor" }
  ],
  body: reset("intv-branch") + `
<p>Background: <a href="#/branch-hazards">Branch Hazards</a>, <a href="#/stage-if">Instruction Fetch</a>.</p>
<h3 id="sec-cost">The Cost of a Mispredict</h3>` +
Q(`<p>A workload runs at IPC 3.0 if every branch were predicted correctly. 20% of instructions are branches, prediction accuracy is 97%, and each mispredict costs 17 cycles. What is the real IPC? What would raising accuracy to 98% buy?</p><p>Then: suppose 4 of the 6 MPKI resolve promptly (17-cycle penalty), but 2 MPKI are branches that depend on L2 misses and resolve 60 cycles later than usual. What is the IPC now?</p>`,
`<ol start="0">
<li>Mispredicts per 1,000 instructions (MPKI): 1,000 × 0.20 × 0.03 = <strong>6</strong>.</li>
<li>Extra cycles per instruction: 6 × 17 / 1,000 = 0.102.</li>
<li>CPI: 1/3.0 + 0.102 = 0.333 + 0.102 = 0.435, so IPC ≈ <strong>2.30</strong>, a 23% loss.</li>
<li>At 98%: MPKI = 4, extra CPI = 0.068, CPI = 0.401, IPC ≈ <strong>2.49</strong>, about 8% faster.</li>
</ol>
<p>The lesson: one point of accuracy is worth about 8% here, and the higher the base IPC, the more each mispredict costs relative to useful work. That’s why predictor research chases fractions of a percent. Also quote MPKI, not accuracy: accuracy hides how many branches there are.</p>
<p><strong>Late-resolving branches:</strong> 4 × 17 + 2 × (17 + 60) = 68 + 154 = 222 extra cycles per 1,000 instructions. CPI = 0.333 + 0.222 = 0.555, so IPC ≈ <strong>1.80</strong> (versus 2.30 when all mispredicts resolve promptly). In this simple additive model, the 2 late MPKI cost more than twice what the other 4 do, which is why improving prediction on branches that depend on cache misses is worth the most.</p>`, "hard") +
Q(`<p>Why can a predictor with 99% accuracy still cost a lot of performance? Give two separate reasons.</p>`,
`<ol start="0">
<li><strong>The penalty isn’t fixed.</strong> The quoted 15–20 cycles assumes the branch resolves soon after it’s fetched. A branch whose condition depends on a load that misses to DRAM resolves hundreds of cycles later, and the whole time the core is fetching the wrong path. The cost is resolution time plus refill, so a few mispredicts on miss-dependent branches can dominate.</li>
<li><strong>Branch density and averages.</strong> 99% of a branch every 5 instructions is still 2 MPKI. And the 1% isn’t spread evenly: a few hard, data-dependent branches (for example in a sort, a decision tree, or a compression loop) can mispredict 30% of the time and account for nearly all the losses.</li>
</ol>
<p>Also, a mispredict wastes more than cycles: a full window of wrong-path work costs energy and can pollute caches and predictors.</p>`, "medium") +
Q(`<p>A branch depends on a load that misses to DRAM (400 cycles), and it is mispredicted. Compare the cost with the same branch predicted correctly. Is there any upside to the wrong-path execution?</p>`,
`<p><strong>Predicted correctly:</strong> the core keeps fetching the right path during the miss, fills the window with useful work, and can issue later independent misses in parallel. Some of the 400 cycles is hidden.</p>
<p><strong>Mispredicted:</strong> the core fills the ROB with wrong-path work for the full 400 cycles, then throws it away and refills from the correct target. The miss latency itself would have been paid either way (if the window filled anyway); what the mispredict really costs is the lost overlap: the useful work and the extra parallel misses the correct path would have contributed, plus the refill.</p>
<p>Upside: wrong-path loads often touch lines the correct path will need soon (for example, the other side of an if-else reading the same data structure), so they act as prefetches. They can also pollute the cache. Simulators that don’t execute the wrong path (trace-driven ones) miss both effects.</p>`, "hard") +
Q(`<p>Why do cores predict branches at all? Suppose a branch occurs every 5 instructions and takes 15 cycles from fetch to resolution. What IPC would a core get if it stopped fetching at every branch until it resolved?</p>`,
`<p>Each group of 5 instructions would cost at least 15 cycles, so IPC ≤ 5 / 15 = <strong>0.33</strong>, no matter how wide the core. Prediction lets fetch continue down the likely path, and the cost becomes (mispredicts × penalty) instead of (branches × resolution time). With 95% accuracy, only 1 in 20 branches pays the 15 cycles.</p>`, "easy") +
`<h3 id="sec-predictors">Predictor Structures</h3>` +
Q(`<p>A loop branch is taken 3 times then not taken once, repeating (pattern T T T N). What is the misprediction rate with (a) a 1-bit last-outcome predictor, (b) a 2-bit saturating counter, (c) a predictor using the branch’s own last 4 outcomes as history?</p>`,
`<ol start="0">
<li><strong>1-bit:</strong> it predicts the last outcome. It mispredicts the N (last was T) and then the first T after it (last was N): <strong>2 of 4, 50%</strong>.</li>
<li><strong>2-bit:</strong> in steady state the counter sits at strongly taken. The N moves it to weakly taken (mispredict), the next T is still predicted taken (correct) and moves it back: <strong>1 of 4, 25%</strong>. The hysteresis costs one mispredict per loop exit instead of two.</li>
<li><strong>History of 4:</strong> each position in the pattern has a distinct recent history (for example, after T T T the next is always N), so each history pattern indexes its own counter and learns: <strong>about 0%</strong> after warm-up. In general, loops with a fixed trip count up to about the history length become perfectly predictable.</li>
</ol>`, "easy") +
Q(`<p>Give a code example where global history predicts much better than local history, and one where local history does better. How do modern predictors such as TAGE get both?</p>`,
`<p><strong>Global wins (correlated branches):</strong></p>
<pre><code>if (x &gt; 0)  a();   // B0
if (x &gt; 5)  b();   // B1: if B0 was not taken, B1 is never taken</code></pre>
<p>B1’s outcome is partly determined by B0’s, which only global history sees.</p>
<p><strong>Local wins:</strong> a branch with its own regular pattern (an inner loop with trip count 7) sitting among noisy, data-dependent branches. The noise fills the global history with random bits, so the pattern’s history keeps changing, while its own local history is perfectly regular.</p>
<p><strong>TAGE</strong> uses several tables indexed by global history of geometrically increasing lengths (for example 5, 15, 44, 130 branches), with tags, and uses the longest matching one. Short histories learn fast and handle simple branches; long histories capture distant correlations, including loop patterns once the history is long enough. Many designs add a small loop predictor or statistical corrector for the cases TAGE handles poorly.</p>`, "medium") +
Q(`<p>A C++ program spends much of its time in virtual calls through a vtable, and in a recursive function 100 calls deep. Which predictor structures matter for each, and what goes wrong in each case?</p><p>Make the recursion concrete: a function calls itself from a single call site, 100 levels deep, and the return-address stack is a 32-entry circular buffer. How many of the 100 returns mispredict? What changes for a tree walk that recurses from two call sites (left child and right child, equally likely)?</p>`,
`<p><strong>Virtual calls:</strong> the direction is always taken; the hard part is the <em>target</em>. A plain BTB remembers only the last target, so a call site that alternates between object types mispredicts on every switch. Indirect-target predictors (ITTAGE-style) index by global history and the call site, so if the type sequence correlates with recent branches, they learn it. A truly random mix of types stays unpredictable.</p>
<p><strong>Deep recursion:</strong> returns are predicted by the return-address stack: push on call, pop on return. It has a fixed number of entries (typically a few dozen). At depth 100 it overflows and the oldest entries are overwritten, so the first returns on the way back up are correct, but once you pass the stack’s depth the remaining returns mispredict, unless they all go to the same place, in which case the BTB may still guess right. Mispredicts on the wrong path can also corrupt the stack if it isn’t repaired on recovery.</p>
<p><strong>Single call site:</strong> every return except the outermost goes to the same address (the instruction after the recursive call). After 100 pushes, all 32 entries hold that address. The first 32 returns pop correct entries; after that the circular pointer wraps onto overwritten entries, which hold the same address, so those predictions are correct too. Only the <strong>last</strong> return, to the original caller, mispredicts: <strong>1 of 100</strong>. Counting “overflow means 68 mispredicts” is the trap.</p>
<p><strong>Two call sites:</strong> the 32 deepest returns are still correct. For the 67 returns below that, the wrapped entry holds the address pushed at a deeper level, which matches the correct one only by chance, 50% of the time: about 33 mispredicts. Plus the final return: about <strong>34 of 100</strong>. Real cores also checkpoint or repair the stack pointer on mispredicts, because wrong-path calls and returns corrupt it.</p>`, "hard") +
Q(`<p>A new predictor improves accuracy but needs 2 cycles to produce a prediction instead of 1. Could the core get slower? How would real designs avoid the problem, and how would you decide?</p>`,
`<p>Yes. Fetch needs the next fetch address every cycle. With a 2-cycle predictor, every taken branch costs a bubble while fetch waits for the target. In integer code with a taken branch every 8–10 instructions, on a 6-wide fetch that’s a bubble every second fetch block or so, which can cost several percent of front-end bandwidth.</p>
<p>Designs avoid it with an <strong>overriding</strong> arrangement: a small, fast predictor (a tiny BTB plus a simple direction predictor) gives a prediction in one cycle, and the big, accurate predictor checks it a cycle or two later and redirects fetch only when they disagree, at a small re-steer penalty.</p>
<p>To decide, compare cycles saved (MPKI reduction × misprediction penalty) against cycles lost (taken branches per 1,000 instructions × bubble cycles, times the fraction of time the core is front-end bound). The bubbles only hurt when the front end is the bottleneck; the mispredicts hurt everywhere. Run full timing simulation, not just a predictor-accuracy simulation.</p>`, "hard") +
Q(`<p>Which structure predicts each kind of control transfer: a conditional direct branch, an unconditional direct jump, an indirect jump or call, and a function return?</p>`,
`<ul>
<li><strong>Conditional direct branch:</strong> the direction predictor (taken or not), plus the BTB for the target, so fetch can redirect before the instruction is even decoded.</li>
<li><strong>Unconditional direct jump:</strong> always taken; only the target is needed, from the BTB.</li>
<li><strong>Indirect jump or call:</strong> the target varies; an indirect target predictor (often indexed with history), or the BTB’s last target.</li>
<li><strong>Return:</strong> the return-address stack.</li>
</ul>`, "easy") +
Q(`<p>A taken direct branch is not in the BTB. What happens, and why is that usually cheaper than a direction mispredict?</p>`,
`<p>Fetch doesn’t know a branch is there, so it continues sequentially. When the instruction is decoded, the front end sees a direct branch, computes its target from the encoding, and (if predicted or known taken) redirects fetch from decode. That costs the depth of the front end up to decode, a handful of cycles, instead of waiting until the branch executes and flushing the back end. Indirect branches are the exception: their target is only known at execution, so a BTB miss on one costs a full mispredict.</p>`, "easy") +
Q(`<p>A TAGE-like predictor has a base table of 4K 2-bit counters plus 4 tagged tables of 1K entries, each entry with a 3-bit counter, a 2-bit “useful” counter, and a 9-bit tag. (a) What is the total storage? (b) Why tags? If 300 hot branches hash into one untagged 1K-entry table, what fraction of them share an entry with at least one other? (c) What does a 9-bit tag buy?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Base: 4,096 × 2 = 8,192 bits. Tagged: 4 × 1,024 × (3 + 2 + 9) = 57,344 bits. Total <strong>65,536 bits = 8 KB</strong>.</li>
<li><strong>(b)</strong> For a given branch, the chance that none of the other 299 lands in its entry is (1 − 1/1,024)<sup>299</sup> ≈ e<sup>−0.29</sup>, so about <strong>25%</strong> of branches share an entry. And that understates the pressure: with history-indexed tables, each branch occupies one entry per distinct history pattern, so the effective number of “contexts” is far larger than 300. Shared untagged entries interfere destructively: one branch trains the counter the other way.</li>
<li><strong>(c)</strong> With a tag, a lookup that lands on another branch’s entry usually sees a tag mismatch and falls back to a shorter table instead of using the wrong counter. A random 9-bit tag matches by accident only 1 time in 512 (about 0.2%). Aliasing turns from silent wrong predictions into misses and reallocations.</li>
</ol>`, "hard") +
Q(`<p>An inner loop always runs exactly 7 iterations (numbered 0 to 6). Its body contains one other branch that is always taken, and the outer loop has no branches besides the inner loop and its own backward branch (always taken), so global history holds only these three branches. What is the minimum global-history length that lets a predictor indexed by history and PC predict the loop’s exit perfectly? What happens with one bit less?</p>`,
`<p>Just before the loop branch in iteration <em>j</em>, the outcomes since the previous loop exit (the last not-taken, N) are: the outer loop’s taken backward branch, <em>j</em> full iterations (body T, loop T), and this iteration’s body T, so 2<em>j</em> + 2 taken outcomes.</p>
<ul>
<li>At iteration 6 (the exit), there are 14 T’s since the last N.</li>
<li>Iterations 0–5 must look different from iteration 6, so each must still have that old N in its history. The hardest is iteration 5, with 12 T’s since the N: it needs a history of at least <strong>13 bits</strong>.</li>
</ul>
<p>With 13 bits, iterations 0–5 each see the N at a different position, and iteration 6 sees 13 T’s, a unique pattern, so after training every prediction is correct. With 12 bits, iteration 5 also sees 12 T’s and shares iteration 6’s pattern, so the two collide and at least one of them mispredicts every time the loop runs. If the trip count varies, no history length helps; that’s what dedicated loop predictors (iteration counters) are for.</p>`, "hard") +
Q(`<p>A bytecode interpreter dispatches with a single indirect jump at the top of its loop (<code>goto *table[op]</code>). The program being interpreted is a loop over a fixed sequence of 8 different opcodes. (a) With a BTB that remembers only each jump’s last target, what is the misprediction rate? (b) “Threaded” dispatch puts a copy of the indirect jump at the end of every handler. Now? (c) What does a history-based indirect predictor do for the single-jump version?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Consecutive opcodes are always different, so the last target is always wrong: <strong>100%</strong> mispredicted.</li>
<li><strong>(b)</strong> Each handler’s own jump always goes to the same successor in this program, so each site’s last target is right: about <strong>0%</strong> after warm-up. Mispredicts return only for opcodes that appear in several places with different successors.</li>
<li><strong>(c)</strong> A predictor that hashes recent branch history (or the path of recent targets) with the jump address sees a different history at each position in the sequence, so it can predict the single shared jump almost perfectly too. Modern indirect predictors largely erased the old advantage of threaded code; measurements on recent cores confirm interpreters mispredict far less than folklore says.</li>
</ol>`, "hard") +
`<h3 id="sec-spec">Speculation and Recovery</h3>` +
Q(`<p>What state must be restored after a branch mispredict? Separate architectural from microarchitectural state, and say which microarchitectural state is usually <em>not</em> restored.</p>`,
`<p><strong>Architectural:</strong> nothing needs restoring, because nothing past the branch has committed. That’s the point of in-order retirement.</p>
<p><strong>Microarchitectural, restored:</strong> the rename map (from a checkpoint or a walk), the free list, the ROB tail, scheduler and LSQ entries of squashed instructions, the global branch history register, the return-address stack (top pointer and possibly the overwritten entry), and the fetch PC.</p>
<p><strong>Not restored:</strong> caches, TLBs, and prefetcher state touched by wrong-path loads, and usually the predictor tables themselves (they update at resolution or retirement). This leftover state is what Spectre-style attacks read.</p>`, "medium") +
Q(`<p>Two branches are unresolved. The younger one resolves first and is mispredicted. Do you recover now, or wait for the older one? What do you need so that recovery squashes only the right instructions?</p>`,
`<p>Recover now. Waiting would leave the core fetching down a path already known to be wrong. If the older branch later turns out mispredicted too, its recovery squashes everything after it, including the instructions fetched after the first recovery, so recovering early never produces a wrong result; it only risks some wasted work.</p>
<p>To squash precisely, every in-flight instruction carries a <strong>branch mask</strong> (one bit per unresolved branch it is younger than), or recovery compares sequence numbers. On a mispredict, every scheduler, execution-pipe, and LSQ entry with the branch’s bit set is invalidated, and when a branch resolves correctly its bit is cleared everywhere and its checkpoint freed. Sequence-number comparison works too, but needs care with wrap-around.</p>`, "medium") +
Q(`<p>Why can a larger instruction window make each misprediction more expensive?</p>`,
`<ul>
<li><strong>More wasted work:</strong> a bigger window speculates further past an unresolved branch, so a mispredict throws away more completed work and energy.</li>
<li><strong>Later resolution:</strong> in a big, busy window the branch may sit longer before it issues, because older work competes for ports, so it resolves later.</li>
<li><strong>Slower recovery:</strong> a ROB-walk recovery takes longer with more instructions to undo, and larger structures may need extra pipeline stages, which add directly to the refill penalty.</li>
</ul>
<p>So a bigger window pays off only if the branch predictor is good enough that the window is actually filled with correct-path work. At high MPKI the average distance between mispredicts is shorter than the window, and the extra entries are mostly wrong-path.</p>`, "medium") +
Q(`<p>The front end delivers 6 uops per cycle when not stalled. A mispredicted branch resolves on average 25 cycles after it is fetched, there are 8 mispredicts per 1,000 instructions, and the correct path averages 1.1 uops per instruction. What fraction of fetched uops could be wrong-path? Why is that an upper bound, and why does it matter even when it doesn’t cost time?</p>`,
`<ol start="0">
<li>Correct-path uops per 1,000 instructions: 1,100.</li>
<li>Wrong-path uops per mispredict: at most 6 × 25 = 150, so 8 × 150 = 1,200 per 1,000 instructions.</li>
<li>Wrong-path fraction: up to 1,200 / 2,300 ≈ <strong>52%</strong> of everything fetched.</li>
</ol>
<p>It’s an upper bound because the front end doesn’t always run at full speed on the wrong path: it can stall when the back end fills up, miss in the i-cache, or hit another branch, and the ROB caps how much is in flight. But even the real number is large. Wrong-path work mostly overlaps with the correct path’s stall time, so its cost shows up less in time than in energy: fetching, decoding, renaming, and often executing hundreds of uops that are thrown away. That’s why better prediction often saves more power than performance.</p>`, "hard") +
Q(`<p>A short if–else has 3 instructions on each side. The branchy version executes the branch plus one side (4 instructions); the if-converted version executes both sides plus a select (7 instructions). The core runs this code at 4 instructions per cycle, and a mispredict costs 17 cycles. Above what misprediction rate does if-conversion win (a) if the select is off the critical path, and (b) if it adds 1 cycle to a loop-carried chain? (c) Why do compilers often choose wrong?</p>`,
`<p>Branchy: 4 / 4 = 1 cycle + <em>p</em> × 17. If-converted: 7 / 4 = 1.75 cycles, plus 1 cycle if the select lengthens the critical chain.</p>
<ol start="0">
<li><strong>(a)</strong> 1 + 17<em>p</em> = 1.75, so <em>p</em> = <strong>4.4%</strong>.</li>
<li><strong>(b)</strong> 1 + 17<em>p</em> = 2.75, so <em>p</em> = <strong>10.3%</strong>.</li>
<li><strong>(c)</strong> The compiler doesn’t know the misprediction rate. Profiles give taken frequencies, not mispredict rates: a branch taken 50% of the time can be perfectly predictable if it alternates, and a 90/10 branch with random outcomes mispredicts about 10%. The right choice also depends on the core (penalty, width) and on whether the select lands on a critical chain, which static heuristics see poorly.</li>
</ol>`, "hard") +
`<h3 id="sec-eval">Evaluating a Predictor</h3>` +
Q(`<p>Design an experiment to evaluate a new branch predictor. Why report both MPKI and IPC?</p>`,
`<ol start="0">
<li><strong>Workloads:</strong> SPEC CPU int (branch-heavy), plus server and browser traces with large code footprints, where BTB capacity and indirect branches matter.</li>
<li><strong>Warm-up:</strong> large predictors need tens of millions of instructions to train. Use long warm-up or continuous traces, or you’ll undercount a big predictor’s benefit.</li>
<li><strong>Fast step:</strong> a trace-driven predictor simulator for MPKI across many configurations and storage budgets, against a baseline such as a TAGE of the same storage.</li>
<li><strong>Timing step:</strong> full cycle-level simulation of the most promising points, with the predictor’s real latency and update timing.</li>
<li><strong>Costs:</strong> storage in KB, access latency, energy per prediction.</li>
</ol>
<p>Both, because MPKI treats all mispredicts as equal. In timing, a mispredict on a branch that resolves in 10 cycles costs much less than one on a branch waiting for a DRAM miss, and a predictor that adds fetch latency can lose IPC despite better MPKI.</p>`, "medium") +
Q(`<p>How would you tell a branch-prediction bottleneck from a memory bottleneck, given that the two interact?</p>`,
`<p>First pass: slot accounting. Bad speculation (slots spent on squashed work plus recovery) versus back-end memory-bound slots. Then MPKI and the average resolution time of mispredicted branches, against misses per 1,000 instructions per cache level.</p>
<p>The interaction: a mispredicted branch that depends on a miss is both. To separate them, use the simulator’s ability to idealize: run with a perfect predictor, with a perfect cache, and with both. If perfect prediction gains 5%, perfect cache 30%, and both 50%, the effects are not additive, and the interaction (branches waiting on misses) is itself a target, for example for prefetching the data the branch depends on.</p>`, "medium"),
},
{
  id: "intv-lsq",
  title: "Loads, Stores and Memory Ordering",
  sections: [
    { id: "basics", label: "Why Loads and Stores Are Special" },
    { id: "fwd", label: "Store-to-Load Forwarding" },
    { id: "mdp", label: "Memory Dependence Speculation" },
    { id: "stores", label: "Stores After Retirement" },
    { id: "mlp", label: "Capacity and Memory-Level Parallelism" }
  ],
  body: reset("intv-lsq") + `
<p>Background: <a href="#/lsq">Load and Store Queues</a>, <a href="#/mdp">Memory Dependence Prediction</a>, <a href="#/dcache">Data Cache</a>.</p>
<h3 id="sec-basics">Why Loads and Stores Are Special</h3>` +
Q(`<p>Register dependences are known at rename. Why aren’t memory dependences, and what two separate correctness problems does that create for an out-of-order core?</p>`,
`<p>A register dependence is visible in the instruction encoding: the names match. A memory dependence depends on <em>addresses</em>, which are computed at execution time, possibly from loads that haven’t returned. So at rename the core can’t know whether a load reads what an older store writes.</p>
<ol start="0">
<li><strong>Single-thread correctness:</strong> a load must return the value of the youngest older store to the same bytes, or memory if none. If it executes before an older store whose address is unknown, it may read stale data. That’s what the store queue (search for older stores) and violation detection solve.</li>
<li><strong>Multi-core ordering:</strong> the consistency model limits which reorderings other cores may observe. On x86 (TSO), loads must appear to execute in order with respect to each other. Cores still execute loads out of order, but they watch for invalidations of lines read by speculatively completed loads and replay if another core wrote one before the load would have been allowed to execute.</li>
</ol>`, "medium") +
Q(`<p>What does a load-queue entry track, and what does a store-queue entry track? For each field, which mechanism uses it?</p>`,
`<p><strong>Load queue:</strong> address and size (for violation checks when older stores resolve, and for snoop checks under TSO), age or ROB index (to know which stores are older), a “has executed” bit, and where its data came from (forwarded from which store, or from the cache). Plus memory-dependence predictor info if the load was told to wait for a specific store.</p>
<p><strong>Store queue:</strong> address and size (searched by younger loads for forwarding and conflicts), data (forwarded to loads, written to the cache after commit), address-valid and data-valid bits (stores often split into separate address and data operations), age, and a committed (“senior”) bit marking stores that have retired and are waiting to drain.</p>`, "easy") +
Q(`<p>Why is the store queue usually smaller than the load queue? Use Skylake’s 72 / 56 or Golden Cove’s 192 / 114 as examples.</p>`,
`<p>Typical code executes roughly twice as many loads as stores (often 25–30% loads and 10–15% stores), so for the same window of instructions, fewer store entries are needed. Store-queue entries are also costlier: they hold data as well as addresses, and every load searches them for forwarding. Stores also keep their entries after retirement until they drain to the cache, which is why the store queue isn’t even smaller.</p>`, "easy") +
Q(`<p>On a TSO machine (x86), a load executed early and is waiting to retire. 16 older loads are ahead of it, and 5 of them haven’t executed yet. An invalidation arrives for the line this load read. What must happen, and why? What if all 16 older loads had already executed?</p>`,
`<p>TSO requires loads to appear to execute in program order. This load got its value before some older loads got theirs. If another core wrote the line, an older load could later read a value that is <em>newer</em> than what this younger load saw, which would make the younger load appear to execute first: a visible load–load reordering. So the core must squash this load and everything younger and re-execute from it (Intel calls this a memory-ordering machine clear).</p>
<p>If every older load had already executed, all of them and this load obtained their values before the remote write, which is equivalent to executing them in order before the write. No reordering is visible, so no squash is needed (some implementations squash anyway for simplicity). The point to make: out-of-order loads are allowed; what TSO forbids is <em>observable</em> reordering, and the snoop of the load queue is how the core detects it.</p>`, "hard") +
`<h3 id="sec-fwd">Store-to-Load Forwarding</h3>` +
Q(`<p>On a recent x86 core, which of these loads can be satisfied by store-to-load forwarding, and what happens to the one that can’t?</p>
<pre><code>I0: mov qword [rax], rcx      ; 8-byte store
I1: mov edx, dword [rax+4]    ; 4-byte load, upper half of I0
I2: mov word [rbx], si        ; 2-byte store
I3: mov r8, qword [rbx]       ; 8-byte load covering I2 and 6 more bytes</code></pre>`,
`<p><strong>I1 forwards.</strong> The load is completely contained in the older store, so the store queue can supply the bytes by shifting out the upper half. Modern Intel and AMD cores handle this contained case for common sizes and offsets (exact rules vary by core).</p>
<p><strong>I3 can’t forward.</strong> Only 2 of its 8 bytes come from the store; the other 6 must come from the cache, and the store-queue forwarding path can’t merge two sources. The load waits until I2 commits and writes the L1, then reads the merged line. This is a store-forwarding stall: roughly 10–20 cycles more than a successful forward, and potentially much more if I2 is stuck behind a miss in the store buffer.</p>
<p>Where this shows up in practice: code that writes a struct field by field and then reads it back with one wide (vectorized) load.</p>`, "medium") +
Q(`<p>A load’s address is known, but an older store’s address is not. Describe three policies the core could use and the performance risk of each.</p><p>Then put numbers on it:</p><ul><li>30% of instructions are loads</li><li>2% of loads truly depend on an older store whose address is unknown when the load is ready</li><li>A violation costs 20 cycles</li><li>Waiting conservatively delays the 30% of loads that sit behind an unresolved store by 6 cycles each, fully exposed</li></ul><p>A predictor catches 95% of the true dependences and falsely delays 1% of loads. Compare the three policies in cycles per 1,000 instructions.</p>`,
`<ol start="0">
<li><strong>Conservative: wait</strong> until every older store address is known. Never wrong, but loads sit behind slow address computations even when they’d almost never conflict. Loads are often on the critical path, so this costs a lot.</li>
<li><strong>Always speculate:</strong> issue the load now. When the older store’s address resolves, it searches the load queue for younger loads that already executed to overlapping bytes; a hit is an ordering violation, and the core squashes from the load and refetches. Fast when conflicts are rare; each violation costs about a mispredict.</li>
<li><strong>Predict:</strong> a memory dependence predictor (for example, store sets) learns which loads have conflicted with which stores, and makes only those loads wait for those specific stores, speculating everywhere else.</li>
</ol>
<p>Modern cores use the third. Its two failure modes are a missed dependence (a violation and flush) and a false dependence (a load delayed for nothing).</p>
<p><strong>Numbers</strong> (300 loads per 1,000 instructions):</p>
<ul>
<li>Always speculate: 300 × 0.02 × 20 = <strong>120 cycles</strong>.</li>
<li>Always wait: 300 × 0.30 × 6 = <strong>540 cycles</strong>.</li>
<li>Predict: missed dependences 300 × 0.02 × 0.05 × 20 = 6, plus false dependences 300 × 0.01 × 6 = 18: <strong>24 cycles</strong>. (Correctly predicted true dependences must wait anyway, so they cost nothing extra.)</li>
</ul>
<p>The predictor is 5× better than speculating blindly and over 20× better than waiting, which is why every modern core has one. The “fully exposed” assumption makes waiting look worse than it is, but not enough to change the ranking.</p>`, "hard") +
Q(`<p>When an ordering violation is detected, why does the core squash and refetch starting from the <em>load</em>, not from the store?</p>`,
`<p>The store did nothing wrong: its address and data are correct. The load read a stale value, and every instruction after it may have used that value directly or indirectly. Restarting at the load re-executes it (now it will forward from the store or read the updated cache) and everything after it. Instructions between the store and the load didn’t depend on the bad value, so in principle they could be kept, but squashing from the load is simplest and matches how branch recovery works. Some designs re-execute only the load’s dependents (selective replay), at significant complexity.</p>`, "easy") +
Q(`<p>A store to address A is in the store queue, not yet written to the cache, and a younger load reads A. Where must the load get its data, and why can’t it simply read the cache?</p>`,
`<p>From the store, through store-to-load forwarding. The cache still holds the old value, because the store only writes the cache after it retires (and after any older stores drain). Reading the cache would return stale data and break single-thread program order. The load searches the store queue for the youngest older store to the same bytes and takes its data; only if no older store matches does it use the cache.</p>`, "easy") +
Q(`<p>A loop compiled at -O0 keeps its counter in memory: each iteration loads it, adds 1, and stores it back. Store-to-load forwarding takes about 5 cycles on this Skylake-class core. (a) How many cycles per iteration does this chain cost, and what IPC does an 8-instruction iteration get? (b) At -O2 the counter lives in a register. What limits the loop now? (c) What is memory renaming, and what would it do here?</p>`,
`<ol start="0">
<li><strong>(a)</strong> The loop-carried chain runs through memory: load (about 5 cycles, forwarded from the previous iteration’s store) plus add (1): about <strong>6 cycles per iteration</strong>, so IPC = 8 / 6 ≈ <strong>1.33</strong>.</li>
<li><strong>(b)</strong> The chain is a 1-cycle add, so the loop becomes width-bound: 8 instructions at 4 per cycle = 2 cycles per iteration. A 3× speedup, not 6×: removing the chain moves the bottleneck to width.</li>
<li><strong>(c)</strong> Memory renaming predicts that a load will read the value of a specific older store and connects the load’s result directly to the store’s source register at rename, like an eliminated move. The store-forwarding latency disappears from the chain, which returns to the 1-cycle add. Some recent x86 cores do this for stack accesses, which is exactly where unoptimized and register-starved code spills and reloads.</li>
</ol>`, "hard") +
Q(`<p>On many Intel cores, a load first checks older stores using only address bits 11:0. A loop computes <code>a[i] = b[i] * k</code> over float arrays. When (a − b) mod 4096 is a small positive number such as 32 bytes, the loop runs about 2× slower than when it is 2,048. Explain, and say how you would confirm it.</p>`,
`<p>The store to a[i] has the same low 12 address bits as the load of b[j] whenever b + 4j ≡ a + 4i (mod 4096), i.e., j = i + (a − b)/4 = i + 8 here. So the load of b[i+8], which out-of-order execution runs early, finds an older, still-buffered store (to a[i]) whose low 12 bits match. The quick check flags a possible dependence, and the load waits for the full address comparison, a few cycles, before it can proceed. That happens on nearly every iteration. With an offset of 2,048 bytes, a matching store would be 512 iterations old and long since drained, so nothing matches.</p>
<p>This is called <strong>4K aliasing</strong>. Confirm it with the Intel event <code>LD_BLOCKS_PARTIAL.ADDRESS_ALIAS</code>, or by sweeping the offset between the arrays and watching the slowdown appear only for small positive offsets mod 4096. Fix it by padding or aligning allocations so the arrays aren’t a multiple of 4 KB apart. The partial compare exists because full-address comparison across the whole store queue is expensive (next question).</p>`, "hard") +
`<h3 id="sec-mdp">Memory Dependence Speculation</h3>` +
Q(`<p>You built a new memory dependence predictor. What statistics would you collect to evaluate it, and what upper and lower bounds would you compare it against?</p>`,
`<ul>
<li><strong>Violations per 1,000 instructions:</strong> missed dependences, each costing a flush.</li>
<li><strong>False dependences:</strong> loads made to wait on a store that turned out not to alias, and the cycles they lost.</li>
<li><strong>Average load issue delay</strong> caused by the predictor.</li>
<li><strong>Storage, training, and reset behavior:</strong> store-set style predictors are periodically cleared so stale dependences don’t accumulate; measure sensitivity to that interval.</li>
<li><strong>IPC</strong>, the final judge.</li>
</ul>
<p>Bounds: an <strong>oracle</strong> (perfect disambiguation: loads wait exactly when they truly alias) is the upper bound; <strong>always wait</strong> and <strong>always speculate</strong> are the lower bounds. Report how much of the gap between the best simple policy and the oracle the predictor closes. If the oracle gains only 1% on your workloads, no predictor is worth much there.</p>`, "medium") +
Q(`<p>A Golden Cove-class core has a 192-entry load queue, a 114-entry store queue, and handles up to 3 loads and 2 stores per cycle. (a) How many address comparisons per cycle are needed if every load searches the whole store queue and every store, when its address resolves, searches the whole load queue? (b) Why is each comparison more than a simple equality test? (c) Name techniques that cut the cost.</p>`,
`<ol start="0">
<li><strong>(a)</strong> 3 × 114 + 2 × 192 = 342 + 384 = <strong>726 comparisons per cycle</strong>.</li>
<li><strong>(b)</strong> Each check must<ul><li>Test byte-range <em>overlap</em> (address plus size), not equality</li><li>Must restrict itself to entries on the correct side in age (older stores for a load, younger loads for a store)</li><li>A load must select the <em>youngest</em> matching older store, which adds a priority encoder</li></ul> Full physical addresses are 40+ bits wide.</li>
<li><strong>(c)</strong><ul><li>Compare a few low address bits first and do the full compare only on a match (which is exactly what causes 4K aliasing)</li><li>Split the queues into banks by address bits so a search touches only one bank</li><li>Filter with a small table or Bloom filter that says whether any in-flight store could match</li><li>Search only the relevant age range</li><li>Skip load-queue searches for stores when no younger load has executed yet</li></ul></li>
</ol>`, "hard") +
`<h3 id="sec-stores">Stores After Retirement</h3>` +
Q(`<p>When does a store become visible to other cores? Why isn’t that the same moment it retires?</p>`,
`<p>At retirement the store becomes architecturally committed: it will definitely happen, and the core has promised the program it happened. But it becomes <em>visible to other cores</em> only when it writes into the coherent L1 cache, which requires the line in a writable state (Modified or Exclusive). That may take a whole read-for-ownership miss. Until then it sits in the store buffer, visible only to this core’s own later loads through forwarding.</p>
<p>Separating the two keeps store misses off the retirement critical path. The price is that this core can see its own store before others can, which is exactly the store-to-load reordering that TSO allows and that a fence (<code>MFENCE</code>) or a locked instruction forbids.</p>`, "medium") +
Q(`<p>A <code>memset</code> of 64 MB of cold memory runs much slower than the core’s store bandwidth suggests. Explain the mechanism and two ways to speed it up.</p>`,
`<p>Each store to a new line misses in the cache. With write-allocate, the core must first fetch the line (read for ownership) before the store can drain from the store buffer. The store buffer fills with stores waiting on those fetches, allocation stalls on store-queue entries, and throughput drops to however many line fetches can be in flight. DRAM traffic also doubles: each line is read once and later written back.</p>
<p>Fixes:</p>
<ul>
<li><strong>Non-temporal (streaming) stores</strong> write full lines straight to memory through write-combining buffers, skipping the read and not polluting the cache.</li>
<li><strong>Full-line-write optimizations:</strong> some cores detect stores that will overwrite a whole line (for example <code>rep stosb</code> with fast string support) and claim ownership without reading the old data.</li>
<li>Prefetching for ownership early also helps when the data must stay cached.</li>
</ul>`, "hard") +
Q(`<p>What is store coalescing? When does it help, and what does x86’s memory model forbid it from doing?</p>`,
`<p>Coalescing merges several committed stores to the same cache line into one L1 write. It helps when code writes a line with many small stores (byte-by-byte copies, filling a struct): fewer L1 write-port uses, fewer cache-array accesses (less energy), and only one ownership request per line.</p>
<p>Under x86 TSO, stores must become visible in program order. Merging two stores that are consecutive in program order is fine, since they become visible together. But merging two stores to line A with a store to line B in between would make the second A store visible before the B store, which TSO forbids. So x86 cores coalesce only consecutive stores (or use a combining scheme that preserves order). Weaker models such as Arm’s allow much more merging.</p>`, "medium") +
Q(`<p>Why is a locked instruction or a full fence expensive on x86, and what decides how expensive?</p>`,
`<p>A fence like <code>MFENCE</code>, or a <code>lock</code>-prefixed read-modify-write, must make all older stores globally visible before any later load can be considered performed. In practice the store buffer must drain first. The cost is therefore the time to drain whatever is in it: a few tens of cycles when the stores hit in L1, hundreds if some are waiting on cache misses. A locked operation also needs the line in exclusive state, which may mean a coherence miss if another core recently wrote it (a contended lock bouncing between cores).</p>
<p>Implementations reduce the cost by letting later loads execute speculatively and watching for conflicting invalidations instead of fully stalling, but the store-buffer drain remains the core cost.</p>`, "medium") +
Q(`<p>Stores are 10% of instructions on a core running at IPC 3. Committed stores drain to the L1 in order, one per cycle when they hit. 5% of stores miss and need an ownership fetch from L3 (50 cycles), and a missing store blocks the drain until its line arrives. (a) Can the store buffer keep up? (b) What changes if the core issues ownership requests (RFOs) early, as soon as a store’s address is known?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Stores arrive at 3 × 0.1 = 0.3 per cycle. Average drain time per store: 1 + 0.05 × 50 = 3.5 cycles, so the drain capacity is 1 / 3.5 ≈ 0.286 stores per cycle. That’s less than 0.3, so the store buffer fills and stays full: IPC is capped near 0.286 / 0.1 ≈ <strong>2.86</strong>, and lower in practice because misses arrive in bursts.</li>
<li><strong>(b)</strong> With early RFOs, the ownership fetches for several buffered stores overlap with each other and with the drain of the stores ahead of them. When a missing store reaches the head, its line is often already there, so the effective drain time approaches 1 cycle per store and the cap disappears. TSO still requires stores to become visible in order; it doesn’t forbid fetching ownership early.</li>
</ol>`, "hard") +
`<h3 id="sec-mlp">Capacity and Memory-Level Parallelism</h3>` +
Q(`<p>An Intel Skylake-class core can track about 10–12 outstanding L1D misses (fill buffers). With 80 ns DRAM latency and 64-byte lines, what bandwidth can one core pull from DRAM through demand misses alone? Measured single-core bandwidth on such chips is noticeably higher. Why?</p>`,
`<p>Little’s law: bandwidth = bytes in flight / latency = 12 × 64 B / 80 ns ≈ <strong>9.6 GB/s</strong> (8 GB/s with 10 buffers).</p>
<p>The measured figure is higher because the L2’s hardware prefetchers fetch ahead into the L2 (and L3), and those requests are tracked by the L2’s own miss queue, not the L1 fill buffers. Many L1 misses then become L2 hits with about 12-cycle latency, so each fill buffer turns over far faster. Same law, much shorter latency. That’s also why disabling prefetchers in a single-core streaming benchmark drops bandwidth toward the Little’s-law bound.</p>`, "hard") +
Q(`<p>Your model reports these counters for a 50M-cycle interval on a 5 GHz core that retires 60M instructions:</p><ul><li>Cycles with at least one L2 miss outstanding: 30M</li><li>Sum over all cycles of the number of outstanding L2 misses: 69M miss-cycles</li><li>L2 misses completed: 180K</li></ul><p>(a) Compute the MLP, the average miss latency, the miss throughput, and the effective penalty per miss. (b) A colleague computes MLP as 69M / 50M. Why is that misleading? (c) What is the most time these misses could be costing?</p>`,
`<ol start="0">
<li><strong>(a)</strong>
<ul>
<li>MLP = 69M / 30M = <strong>2.3</strong> misses in flight, averaged over cycles that have at least one.</li>
<li>Average latency = 69M miss-cycles / 180K misses ≈ <strong>383 cycles</strong> (about 77 ns at 5 GHz, so mostly DRAM).</li>
<li>Throughput = 180K / 30M = <strong>0.006 misses per cycle</strong> while misses are in flight. Little’s law check: 0.006 × 383 ≈ 2.3.</li>
<li>Effective penalty = latency / MLP = 383 / 2.3 ≈ <strong>167 cycles</strong> = 1 / throughput.</li>
</ul></li>
<li><strong>(b)</strong> 69M / 50M = 1.38 mixes in the 20M cycles with no miss in flight. It measures how memory-bound the interval is, not how well misses overlap. A program with perfect overlap during short bursts would look serialized. Average MLP only over cycles with at least one miss outstanding.</li>
<li><strong>(c)</strong> Misses × effective penalty = 180K × 167 ≈ 30M cycles, exactly the cycles with a miss in flight. That is <strong>60%</strong> of the interval, an upper bound on the miss cost, because the core may still retire independent work during some of those cycles. The actual cost is the ROB-full (or other full-resource) stall cycles with a missing load at the head.</li>
</ol>`, "medium") +
Q(`<p>Growing the load queue helps one workload a lot and another not at all. Give an explanation, and say how you would tell a load-queue capacity bottleneck from a memory-bandwidth bottleneck.</p><p>Then quantify the streaming case: one core wants 20 GB/s from DRAM with 90 ns latency and 64-byte lines. How many lines must be in flight, and roughly how many load-queue entries would demand loads need if the program uses 8-byte loads and nothing prefetches?</p>`,
`<p>The first workload has many independent loads, and with more load-queue entries the window reaches more of them, so more misses overlap. The second either has few loads in flight anyway (compute-bound, or dependent pointer-chasing loads), or was already limited by something else: the miss buffers, the ROB, or DRAM bandwidth.</p>
<p>To tell capacity from bandwidth:</p>
<ul>
<li><strong>Load-queue bound:</strong> frequent allocation stalls on a full load queue, with DRAM bandwidth well below its achievable peak and average miss latency near the unloaded value.</li>
<li><strong>Bandwidth bound:</strong> DRAM utilization near the achievable peak (often 70–80% of the theoretical number), and average miss latency rising as you add more parallelism, because requests are queueing. More entries only make the queue longer.</li>
</ul>
<p><strong>Streaming numbers:</strong> bytes in flight = 20 GB/s × 90 ns = 1,800 bytes ≈ 28 lines, so about <strong>29 lines</strong> must be outstanding. Each line is touched by 8 consecutive 8-byte loads, and every load from the oldest outstanding line to the newest occupies a load-queue entry until it retires: about 29 × 8 ≈ <strong>230 entries</strong>, more than Skylake’s 72 or Golden Cove’s 192. Demand loads alone can’t sustain it; hardware prefetchers, which track lines without load-queue entries, are what make single-core streaming bandwidth possible.</p>`, "hard") +
Q(`<p>How would you test a load/store queue model for correctness when accesses overlap in address or size?</p>`,
`<ol start="0">
<li><strong>Directed tests:</strong> every combination of store size and load size (1, 2, 4, 8, 16, 32, 64 bytes) and relative offset, including partial overlap, exact match, containment both ways, and accesses that cross a cache line or a page boundary.</li>
<li><strong>Ordering scenarios:</strong><ul><li>Load before the older store’s address resolves, then aliasing</li><li>Several older stores to the same address (the youngest older must win)</li><li>Stores with address known but data not</li></ul></li>
<li><strong>Golden reference:</strong> run random load/store streams over a small address range (to force collisions) and check every load’s value against an in-order functional model. Even a timing-only model can track byte-level “which store produced this byte” and compare that.</li>
<li><strong>Invariants:</strong><ul><li>Retired stores drain in order</li><li>No load completes with data from a younger store</li><li>Violations always trigger a flush from the load</li></ul></li>
</ol>`, "medium"),
},
{
  id: "intv-diag",
  title: "Diagnosing Bottlenecks",
  sections: [
    { id: "chains", label: "Following the Causal Chain" },
    { id: "shift", label: "Bottlenecks That Move" },
    { id: "metrics", label: "When the Metric Misleads" },
    { id: "sweeps", label: "Experiments and Attribution" }
  ],
  body: reset("intv-diag") + `
<p>Background: <a href="#/perf-stats">Performance Statistics</a>, <a href="#/perf-stalls">Stall Causes</a>, <a href="#/perf-bottlenecks">Bottleneck Types</a>.</p>
<h3 id="sec-chains">Following the Causal Chain</h3>` +
Q(`<p>On Zen 4, a load misses in L2 and hits in L3 (about 50 cycles). Many younger instructions are independent of it. Walk through what happens to the scheduler, the ROB, and retirement, cycle by cycle in broad strokes.</p><p>Put a number on it: when the load issues, the ROB holds 200 entries and the load is the oldest. Dispatch continues at 6 per cycle. How many cycles until the ROB fills, and for how many of the 50 cycles is dispatch stalled?</p>`,
`<ol start="0">
<li><strong>The load issues</strong> and misses L1 and L2; a miss buffer tracks it. Dependents that were speculatively woken for an L1 hit are cancelled and go back to waiting.</li>
<li><strong>Independent instructions keep flowing:</strong> allocation continues at up to 6 per cycle, independent work issues and completes, and the load’s dependents accumulate in the scheduler.</li>
<li><strong>Retirement stalls</strong> as soon as the load reaches the ROB head; completed instructions pile up behind it.</li>
<li><strong>Does the ROB fill?</strong> At 6 per cycle, 320 entries take about 53 cycles, roughly the L3 latency. So for an L3 hit the ROB may just barely fill, depending on how early the load was in the window and on whether the scheduler or physical registers fill first with waiting dependents.</li>
<li><strong>Data returns:</strong> the dependents wake and issue, the load completes, and retirement drains the backlog at up to 8 per cycle.</li>
</ol>
<p>Net: an L3 hit is <em>mostly</em> hidden on a big core when the work behind it is independent. A DRAM miss (400+ cycles) is not.</p>
<p><strong>Numbers:</strong> 320 − 200 = 120 free entries at 6 per cycle: the ROB is full after <strong>20 cycles</strong>, and dispatch is stalled for the remaining <strong>~30 cycles</strong> (180 lost dispatch slots). If the load had been younger rather than at the head, older instructions would keep retiring, the ROB would fill later, and less of the latency would be exposed. Whether the 30 cycles cost time depends on whether the core had other work left to finish; they’re an upper bound on the damage.</p>`, "hard") +
Q(`<p>Raising L3 latency in your model from 50 to 70 cycles drops IPC by 6%. Explain the causal chain from the latency change to the IPC number, and say which statistics you would look at to confirm each link.</p>`,
`<ol start="0">
<li><strong>Loads that hit L3 take 20 cycles longer.</strong> Check: the L3 hits per 1,000 instructions (the change only matters in proportion to them).</li>
<li><strong>Part of the extra latency isn’t hidden</strong> by the window: where the work behind the load was enough to cover 50 cycles but not 70, the ROB, scheduler, or registers now fill. Check: full-resource stall cycles rise, attributed to loads waiting on L3.</li>
<li><strong>Chains through L3 hits get longer</strong> directly: if each load in a pointer chase hits L3, each step costs 20 more cycles with nothing to overlap. Check: average outstanding misses near 1 during those phases.</li>
<li><strong>Fewer cycles retire instructions</strong>, so IPC (instructions / cycles) drops.</li>
</ol>
<p>A rough sanity check: if the exposed portion of each L3 hit grew by about 15 of the 20 cycles, and there are about 4 L3 hits per 1,000 instructions at an IPC around 2 (500 cycles per 1,000 instructions), that’s 60 extra cycles per 500, about 12% more time. A 6% drop means more of the latency was hidden than that. Doing this arithmetic out loud is what interviewers want.</p>`, "hard") +
Q(`<p>A workload has a large ROB, plenty of physical registers, and a big scheduler, yet IPC is 0.8. List what you would investigate next, in order.</p>`,
`<ol start="0">
<li><strong>Is the window even full?</strong> ROB occupancy histogram. If it’s mostly empty, the problem is upstream: front end or mispredicts.</li>
<li><strong>Front end:</strong> i-cache and iTLB misses, BTB misses, op-cache hit rate, decode stalls. Large server and browser binaries are often front-end bound.</li>
<li><strong>Bad speculation:</strong> MPKI and wasted slots. A window flushed every 100 instructions never fills.</li>
<li><strong>If the window is full:</strong> what’s at the head (memory-level parallelism, which cache level), dependence chains (few ready instructions), port contention (many ready, not issuing).</li>
<li><strong>Memory system:</strong> DRAM bandwidth utilization and loaded latency; TLB misses and page walks.</li>
<li><strong>Odd events:</strong> microcode assists, serializing instructions, store-forwarding stalls, memory-ordering machine clears.</li>
</ol>`, "medium") +
Q(`<p>Reducing average memory latency by 30% speeds up one workload by 25% and another by 2%. Both have long serial dependence chains. How can that be?</p>`,
`<p>It depends on whether the loads are <em>on</em> the chain.</p>
<ul>
<li><strong>Chain through memory (25%):</strong> pointer chasing, where each load’s address comes from the previous load. Every miss is on the critical path with nothing to overlap, so time scales almost directly with memory latency.</li>
<li><strong>Chain through arithmetic (2%):</strong> for example a long floating-point recurrence, where the loads feeding it have addresses computable far ahead (array indices). The out-of-order window and prefetchers get those loads in early, so memory latency is already hidden and the arithmetic chain’s latency sets the pace. Faster memory changes nothing on the critical path.</li>
</ul>
<p>The general rule: an improvement helps only to the extent it shortens the critical path. Stating “it’s a dependence chain, so memory doesn’t matter” without asking what the chain is made of is the trap.</p>`, "hard") +
Q(`<p>Build a CPI stack:</p><ul><li>Base CPI 0.30</li><li>20 L2 misses per 1,000 instructions that hit L3 and expose 15 of their 50 cycles</li><li>3 DRAM misses per 1,000 instructions that expose 250 cycles each</li><li>5 mispredicts per 1,000 instructions at 17 cycles</li></ul><p>(a) What is the total CPI? (b) Rank the speedups from halving DRAM misses, perfect branch prediction, and cutting L3 latency to 40 cycles (assume the hidden part of an L3 hit stays 35 cycles).</p>`,
`<ol start="0">
<li><strong>(a)</strong> 0.30 + 0.020 × 15 + 0.003 × 250 + 0.005 × 17 = 0.30 + 0.30 + 0.75 + 0.085 = <strong>1.435</strong> (IPC ≈ 0.70).</li>
<li><strong>(b)</strong>
<ul>
<li>Halve DRAM misses: −0.375, CPI 1.06: <strong>1.35×</strong>.</li>
<li>L3 latency 40: exposed portion drops from 15 to 5 cycles: −0.20, CPI 1.235: <strong>1.16×</strong>.</li>
<li>Perfect prediction: −0.085, CPI 1.35: <strong>1.06×</strong>.</li>
</ul></li>
</ol>
<p>Caveats worth saying: the components aren’t truly additive (a mispredict that depends on a miss is counted in both), and “exposed” cycles shift when other components change. Use the stack to rank where to look, then confirm with idealized simulations.</p>`, "hard") +
Q(`<p>Your model of a Zen 4-class core shows dispatch stalled on a full ROB in 35% of cycles, and in most of those cycles the ROB head is a load that missed L2. A colleague proposes growing the ROB from 320 to 512 entries. What do you measure before agreeing, and which results would change your recommendation?</p>`,
`<p>The symptom says memory latency the window can’t hide. Whether a bigger window helps depends on whether more independent misses lie beyond it.</p>
<ol start="0">
<li><strong>MLP and latency:</strong> average outstanding misses over cycles with at least one in flight, average miss latency, and from them the throughput. MLP near 1 points to dependent misses, which a bigger ROB can’t fix.</li>
<li><strong>Misses by level:</strong> L2 versus LLC versus DRAM, with latency per level. LLC hits (about 50 cycles) are a different problem from DRAM misses (400+).</li>
<li><strong>Address dependence:</strong> does each missing load’s address come from an earlier missing load (pointer chasing)? If so, the fix is lower latency, prefetching, or a data-structure change.</li>
<li><strong>A sweep:</strong> grow the ROB with the load queue, physical registers, and scheduler scaled together, and track MLP, latency, IPC, and the stall reason. Growing only the ROB just moves the stall to the next structure.</li>
<li><strong>If MLP plateaus:</strong> MSHR occupancy against its maximum, DRAM bandwidth against its peak, and mispredicts on branches that depend on missing loads (they cut the window short).</li>
<li><strong>Prefetching:</strong> if the miss addresses are regular, a prefetcher may buy more than 192 extra entries.</li>
</ol>
<p>Agree only if MLP rises with the window and IPC follows. Otherwise the area belongs elsewhere.</p>`, "medium") +
`<h3 id="sec-shift">Bottlenecks That Move</h3>` +
Q(`<p>The front end delivers fewer instructions than the back end can execute. Which back-end improvements won’t help, and which might still help a little?</p>`,
`<p><strong>Won’t help:</strong> more execution units, wider issue, a bigger scheduler, a bigger ROB or register file, wider retirement. The back end is already waiting for instructions, and more capacity just sits empty.</p>
<p><strong>Might help a little:</strong> anything that cuts the number of instructions the front end must deliver or the stalls that waste delivered ones: faster branch resolution (shorter mispredict penalty means less front-end refill time), and back-end changes that reduce flushes, like a better memory dependence predictor. The real fixes are in the front end: a bigger op cache or i-cache, a better BTB, instruction prefetching, wider decode, or code layout optimizations (profile-guided ordering of hot code).</p>`, "easy") +
Q(`<p>Physical-register pressure can show up in naive statistics as a <em>front-end</em> problem. Explain how, and how a good accounting method avoids the mistake.</p>`,
`<p>When the free list empties, rename stalls. The decoded-uop queue between decode and rename fills, decode stalls, and then fetch stalls. A counter that just measures “cycles the fetch unit didn’t fetch” rises and blames the front end.</p>
<p>Slot accounting at the allocation stage avoids it: a slot counts as front-end bound only if the back end <em>could have accepted</em> a uop and the front end didn’t supply one. Here, allocation is blocked by the back end (no free registers), so those slots count as back-end bound. Attribute each lost slot once, at the boundary where the decision is made, and back-pressure can’t be mistaken for its own cause.</p>`, "medium") +
Q(`<p>Why does improving one component often just move the bottleneck elsewhere? Give a concrete example with numbers.</p><p>Then: the application spends 40% of its time in this loop and the rest doesn’t change. What is the application-level speedup from the third load port?</p>`,
`<p>Performance is limited by the most constrained resource at each moment; relieving it exposes the next one. Example on Skylake (4-wide, 2 load ports): a loop iteration has 10 instructions, 6 of them independent loads. The load ports need 6 / 2 = 3 cycles per iteration; the 4-wide pipeline needs 10 / 4 = 2.5. Loads are the bottleneck: 3 cycles per iteration, IPC 3.3.</p>
<p>Add a third load port (as Golden Cove did). Loads now need 2 cycles, but the width needs 2.5, so the loop runs at 2.5 cycles per iteration: a 20% speedup, not the 50% that “50% more load bandwidth” suggests. The bottleneck moved to width, and the next step is a wider front end and rename.</p>
<p>Amdahl’s law is the same idea: speeding up a part that takes fraction <em>f</em> of the time by <em>s</em> gives an overall speedup of 1 / ((1 − <em>f</em>) + <em>f</em>/<em>s</em>). Bottleneck analysis should list the top two or three limits, not just the first.</p>
<p><strong>Application level:</strong> the loop speeds up by 3 / 2.5 = 1.2×. Amdahl: 1 / (0.6 + 0.4 / 1.2) = 1 / 0.933 ≈ <strong>1.07×</strong>. A 50% increase in load bandwidth became a 7% application speedup, after the bottleneck moved and after Amdahl.</p>`, "hard") +
Q(`<p>Retirement bandwidth is reported as the limiting factor. Would more execution units help? How often is retirement truly the limit?</p>`,
`<p>No. More execution units make instructions complete sooner, but they still can’t leave faster than retirement allows, and allocation is ultimately gated by retirement freeing entries.</p>
<p>True retirement limits are rare, because designers make retirement at least as wide as allocation (Golden Cove: 8 versus 6). A “retirement bound” report usually really means the ROB head is <em>not complete</em> (a stalled load or long-latency operation), which is a latency problem, not a bandwidth one. The distinguishing counter: cycles where the head is complete and at least <em>W</em> completed instructions are waiting, but only <em>W</em> could retire. If that’s rare, retirement width isn’t the problem.</p>`, "medium") +
Q(`<p>What is MPKI, and why do performance engineers prefer it to a miss rate?</p>`,
`<p>Misses (or mispredicts) per 1,000 instructions. It normalizes by work rather than by accesses, so it plugs straight into a CPI estimate: CPI contribution ≈ MPKI × penalty / 1,000. A miss rate per access hides how often the program accesses the structure: a 10% L2 miss rate means little if L2 is rarely accessed, and a 1% L1 miss rate can matter a lot if loads are frequent.</p>`, "easy") +
`<h3 id="sec-metrics">When the Metric Misleads</h3>` +
Q(`<p>A change raises IPC by 10%, but execution time barely improves. Give three explanations.</p>`,
`<ol start="0">
<li><strong>More instructions:</strong> the change (or a recompile) added instructions, such as software prefetches, spills, or extra checks. IPC rises because the added instructions are cheap; time doesn’t.</li>
<li><strong>Spin-waiting:</strong> in multithreaded code, threads spinning on a lock execute tight, high-IPC loops that do no useful work. More spinning means higher IPC and the same or worse time.</li>
<li><strong>Frequency:</strong> the change runs hotter or uses wider vector units, and the chip lowers its clock. IPC per cycle goes up; cycles per second go down.</li>
</ol>
<p>Rule: compare execution time (or work per second) when the instruction count or frequency can change. IPC is a valid comparison only for the same binary, same input, same instruction count.</p>`, "easy") +
Q(`<p>Compiler A produces 10% fewer instructions than compiler B for the same program but runs 5% slower. How?</p>`,
`<ul>
<li><strong>Longer dependence chains:</strong> fewer instructions packed into a serial chain (complex addressing, read-modify-write memory operands, fewer unrolled independent accumulators) can take more cycles than more instructions spread over parallel chains.</li>
<li><strong>Expensive instructions:</strong> one <code>div</code> replacing a multiply-and-shift sequence is fewer instructions and many more cycles.</li>
<li><strong>Branches versus conditional moves:</strong> a branchy version can be shorter but mispredict on unpredictable data, or a <code>cmov</code> version can add a dependence that a well-predicted branch would avoid.</li>
<li><strong>Code layout:</strong> alignment of hot loops, op-cache and i-cache fit, taken-branch density.</li>
</ul>
<p>Instruction count is one factor of the Iron Law; CPI is another, and they trade off.</p>`, "medium") +
Q(`<p>A model predicts a 7% IPC gain from a feature, but the silicon measurement shows none. List the explanations you would investigate.</p>`,
`<ul>
<li><strong>The feature isn’t really on:</strong> disabled by microcode or firmware, a different stepping, or a chicken bit set by default.</li>
<li><strong>The implementation differs from the model:</strong> timing closure forced an extra pipeline stage, a smaller structure, or restrictions the model didn’t have.</li>
<li><strong>The model misses a limit</strong> that silicon has and that the new feature runs into: a structure modeled as unlimited, a TLB or page-walk effect, bank conflicts, power or thermal throttling.</li>
<li><strong>Workload differences:</strong> the model used simulation points or traces that overweight the phases where the feature helps; different inputs, compiler versions, or OS effects (interrupts, page placement).</li>
<li><strong>Measurement:</strong> frequency changes during the measurement, turbo, noise larger than the effect, warm-up.</li>
</ul>
<p>The way to localize it: compare the model’s and silicon’s performance counters for the feature’s targeted event (for example, the stall cycles it was meant to remove). If silicon’s counter didn’t move, the feature isn’t working as modeled.</p>`, "medium") +
Q(`<p>What does “front-end bound” mean in Top-Down analysis, and what are its two main subcategories?</p>`,
`<p>A slot is front-end bound when the back end could have accepted a uop but the front end didn’t deliver one. It splits into <strong>latency</strong> (the front end delivered nothing for a while: i-cache or iTLB misses, branch redirect bubbles) and <strong>bandwidth</strong> (it delivered some uops but fewer than the width: decoder limits, uop-cache-to-legacy switches, taken-branch fetch breaks).</p>`, "easy") +
Q(`<p>Three benchmarks each run 10<sup>9</sup> instructions, at IPC 1.0, 2.0, and 4.0. (a) What is the IPC of the suite run back to back? (b) A change makes the first benchmark 2× faster and the third 2× slower. Compute the arithmetic mean of the speedups, the geometric mean, and the change in total time. Which would you report?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Cycles: 1.0 + 0.5 + 0.25 = 1.75 × 10<sup>9</sup> for 3 × 10<sup>9</sup> instructions: IPC ≈ <strong>1.71</strong>, the harmonic mean, not the arithmetic mean 2.33. Averaging IPCs overweights the fast benchmarks, which take the least time.</li>
<li><strong>(b)</strong> New IPCs are 2, 2, 2, so cycles = 1.5 × 10<sup>9</sup>.
<ul>
<li>Arithmetic mean of speedups: (2 + 1 + 0.5) / 3 = <strong>1.17</strong>.</li>
<li>Geometric mean: (2 × 1 × 0.5)<sup>1/3</sup> = <strong>1.00</strong>.</li>
<li>Total time: 1.75 / 1.5 = <strong>1.17×</strong> faster, because the slow benchmark dominates total time.</li>
</ul></li>
</ol>
<p>The arithmetic mean of ratios is biased toward big speedups (a 2× gain and a 2× loss don’t cancel) and shouldn’t be used. The geometric mean treats every benchmark equally regardless of runtime, which is why SPEC uses it. Total time is right only if the suite literally represents the real workload mix. Report the geomean plus the distribution, and say which benchmarks moved.</p>`, "hard") +
`<h3 id="sec-sweeps">Experiments and Attribution</h3>` +
Q(`<p>You doubled the ROB and the scheduler together and performance improved by 9%. How do you find out which change caused it?</p><p>Here are the numbers: baseline IPC 2.00, ROB doubled 2.02, scheduler doubled 2.04, both doubled 2.18. Quantify the interaction.</p>`,
`<p>Run the full factorial: baseline, ROB only, scheduler only, both. If ROB-only gives 1%, scheduler-only gives 2%, and both give 9%, the changes interact: each one was hiding the other’s benefit, because whichever structure was smaller filled first. Then confirm with the stall breakdown: in the baseline, which structure was full when allocation stalled, and what happened to those stalls in each variant? Report the interaction honestly; saying “the scheduler gave 2%” would be wrong for the combined design.</p>
<p><strong>Numbers:</strong> the main effects are +0.02 (ROB) and +0.04 (scheduler). If they were independent, both together would give about 2.06. The interaction term is 2.18 − 2.02 − 2.04 + 2.00 = <strong>0.12 IPC</strong>: two-thirds of the total 0.18 gain exists only when both structures grow together.</p>`, "hard") +
Q(`<p>More MSHRs improved performance by 12% without changing the cache hit rate at all. How?</p><p>Put numbers on it: 8 MSHRs, 80 ns DRAM latency, 64-byte lines, and a core that could generate 16 independent misses at once. What bandwidth can one core pull before and after doubling the MSHRs?</p>`,
`<p>The hit rate measures how often you miss; MSHRs determine how many misses can be in flight at once. With too few, a core that has found several independent misses must wait for one to finish before starting the next, so they’re serialized. More MSHRs let those misses overlap (higher MLP), which reduces the time per miss without changing the number of misses. By Little’s law, outstanding misses = miss rate × latency, so if the core can generate more concurrent misses than the MSHRs allow, the MSHRs cap the achievable bandwidth. Confirm with MSHR-full cycles in the baseline and average outstanding misses before and after.</p>
<p><strong>Numbers:</strong> before: 8 × 64 B / 80 ns = <strong>6.4 GB/s</strong>; after: 16 × 64 B / 80 ns = <strong>12.8 GB/s</strong>, assuming DRAM isn’t saturated and latency doesn’t rise with the extra load. Miss-bound phases run up to twice as fast with exactly the same hit rate.</p>`, "hard") +
Q(`<p>You sweep the ROB from 224 to 512 entries, scaling the load queue, physical registers, and scheduler with it. Three memory-bound workloads respond like this:</p><ul><li><strong>A:</strong> MLP 1.05 → 1.08, IPC +1%</li><li><strong>B:</strong> MLP 1.6 → 3.1, IPC +52%, average miss latency 380 → 420 cycles</li><li><strong>C:</strong> MLP 2.9 → 3.0, IPC +2%</li></ul><p>Diagnose each one, quantify what happened to B, and say what you would check next for C.</p>`,
`<ul>
<li><strong>A: latency-bound.</strong> MLP near 1 before and after means the misses are dependent (pointer chasing), so the window has nothing to overlap. The fixes are lower latency, prefetching, or a different data structure. First confirm the ROB is still the stall reason after the sweep, rather than the load queue, registers, or scheduler.</li>
<li><strong>B: window-limited.</strong> The program had latent MLP that the small window couldn’t reach. Effective penalty per miss went from 380 / 1.6 ≈ 238 to 420 / 3.1 ≈ 135 cycles, a 1.75× drop. MLP grew 1.94×, but latency rose 10.5% from extra queueing, which ate part of the gain. Latency rose far less than MLP did, so the limit is the window, not bandwidth. If latency had risen in proportion to MLP, the misses would only be queueing and the real limit would be MSHRs or DRAM bandwidth.</li>
<li><strong>C: MLP above 1 but flat.</strong> Something other than the window caps parallel misses. Check, in order:
<ul>
<li><strong>MSHRs or fill buffers full:</strong> occupancy pinned at the maximum, with MSHR-full stall cycles.</li>
<li><strong>DRAM bandwidth saturated:</strong> bandwidth near the achievable peak and loaded latency rising.</li>
<li><strong>Window cut short elsewhere:</strong> mispredicted branches that depend on missing loads, or another structure (load queue, registers, scheduler) filling first.</li>
<li><strong>Program MLP exhausted:</strong> none of the above is saturated, and the dependence structure itself allows only about 3 misses at once.</li>
</ul></li>
</ul>`, "hard") +
Q(`<p>How would you use configuration sweeps to understand interactions between ROB size, issue width, cache latency, and MSHR count, without running every combination?</p>`,
`<ol start="0">
<li><strong>Screening:</strong> a two-level fractional factorial or Plackett–Burman design picks a small set of runs (about 8–12 for 4 to 7 parameters) that estimates which parameters matter most.</li>
<li><strong>Focus:</strong> run a full factorial or a finer grid on the two or three that matter, to see interactions (for example ROB × MSHRs: a larger ROB finds more misses only if MSHRs can hold them).</li>
<li><strong>Per workload class:</strong> fit and report separately for memory-bound and compute-bound workloads; averaging them hides the interactions.</li>
<li><strong>Explain every interaction with a mechanism</strong> backed by stall counters, not just a regression coefficient.</li>
</ol>
<p>One-factor-at-a-time sweeps around one baseline miss interactions completely, which is the most common methodology mistake.</p>`, "medium") +
Q(`<p>How do you know whether a bottleneck you found is real, or an artifact of how the simulator works?</p>`,
`<ul>
<li><strong>Microbenchmarks with known answers:</strong><ul><li>A chain of dependent adds should take exactly <em>N</em> × latency</li><li>Independent adds should hit the width limit</li><li>A ROB-fill test with a long load should stall for latency − ROB/width</li></ul> If the model is off, the bottleneck may be a modeling bug.</li>
<li><strong>Check against hardware</strong> where possible: measure the same microbenchmark and counters on a real core with similar parameters.</li>
<li><strong>Look for modeling patterns:</strong> an extra bubble from the order in which pipeline stages are updated within a cycle, a structure freed a cycle late, a resource modeled as shared that’s really per-port.</li>
<li><strong>Vary the suspect detail:</strong> if the bottleneck disappears when you change something that shouldn’t matter architecturally (stage update order, event tie-breaking), it’s the simulator.</li>
</ul>`, "medium") +
Q(`<p>You measure IPC on 30 sampled intervals: mean 1.82, standard deviation 0.40. A design change moves the mean to 1.88. (a) What is the 95% confidence interval on the baseline mean? Can you claim the 3% improvement from these two means? (b) You run both designs on the <em>same</em> 30 intervals; the per-interval differences have mean 0.06 (as they must, if the 1.88 came from these same intervals) and standard deviation 0.05. Now?</p>`,
`<ol start="0">
<li><strong>(a)</strong> Standard error: 0.40 / √30 = 0.073. With the t-distribution (29 degrees of freedom, t ≈ 2.05): ±0.15, about <strong>±8%</strong> of the mean. A 0.06 difference is far inside that, so comparing the two means alone can’t establish a 3% gain.</li>
<li><strong>(b)</strong> Paired: standard error 0.05 / √30 = 0.0091. Interval 0.06 ± 2.05 × 0.0091 = 0.06 ± 0.019, i.e. 0.041 to 0.079, clearly above zero. <strong>Significant.</strong> The estimate is the same 0.06 as in (a); only its uncertainty shrank.</li>
</ol>
<p>Pairing removes the large between-interval variation (some phases are just slower), leaving only the variation in the <em>effect</em>. Always compare designs on the same samples and analyze the per-sample differences. With a deterministic simulator, the remaining variation reflects real workload differences in the effect, not noise.</p>`, "hard"),
},
{
  id: "intv-sim",
  title: "Building a Performance Model in C",
  sections: [
    { id: "kinds", label: "Kinds of Simulators" },
    { id: "struct", label: "Structure and Data" },
    { id: "cycle", label: "Getting the Cycle Right" },
    { id: "verify", label: "Verification and Trust" }
  ],
  body: reset("intv-sim") + `
<p>Background: <a href="#/ipc-spec">IPC and Simulation Methodology</a>. These questions are where your own simulator is the best answer: for each one, have a specific decision or bug from your work ready.</p>
<h3 id="sec-kinds">Kinds of Simulators</h3>` +
Q(`<p>What is the difference between a functional and a timing simulator, and between trace-driven and execution-driven timing simulation? Name two effects a trace-driven model of an out-of-order core can’t capture.</p>`,
`<p>A <strong>functional</strong> simulator computes what the program does (architectural state, instruction by instruction) with no notion of cycles. A <strong>timing</strong> simulator models when things happen in the microarchitecture.</p>
<p><strong>Trace-driven:</strong> a functional run records the committed instruction stream (PCs, addresses, branch outcomes), and the timing model replays it. <strong>Execution-driven:</strong> the timing model drives a functional model as it goes, so it can follow whatever path the timing model chooses.</p>
<p>A trace contains only the correct path, so a trace-driven model can’t:</p>
<ul>
<li><strong>Execute wrong-path instructions:</strong> after a mispredict, it can only stall for the penalty. It misses wrong-path cache prefetching and pollution and wrong-path resource use.</li>
<li><strong>Change behavior with timing:</strong> in multithreaded code, the order of lock acquisitions, spin-loop iteration counts, and which thread wins a race depend on timing, but the trace fixes them.</li>
</ul>
<p>Trace-driven is still common because it’s simpler and faster, and fine for studies insensitive to these effects (for example, many cache studies).</p>`, "medium") +
Q(`<p>What is warm-up in simulation, and why is it needed?</p>`,
`<p>Before measuring a sample, the caches, TLBs, branch predictors, and prefetchers must hold the state they would have had if the whole program had run up to that point. Starting them empty (cold) makes every early access miss and every branch mispredict, biasing the sample toward lower IPC. Warm-up runs instructions (often functionally, which is faster) to fill these structures before statistics are collected.</p>`, "easy") +
Q(`<p>What is a SimPoint?</p>`,
`<p>A representative interval of a program. SimPoint splits the execution into fixed-size intervals, describes each by which basic blocks it executes (a basic-block vector), clusters similar intervals, and picks one interval per cluster, weighted by cluster size. Simulating a handful of these in detail approximates the whole program at a tiny fraction of the cost.</p>`, "easy") +
`<h3 id="sec-struct">Structure and Data</h3>` +
Q(`<p>How would you represent an instruction’s lifecycle and the main structures (ROB, scheduler, physical register file, load/store queues) in a C cycle-level model? Justify each data structure choice.</p>`,
`<ul>
<li><strong>Instruction record:</strong> a struct holding a global sequence number (for age comparisons), decoded fields, source and destination physical registers, state (allocated, ready, issued, complete, retired), and per-stage timestamps for statistics and debugging. Allocate them from a pool sized to the window, never <code>malloc</code> per instruction.</li>
<li><strong>ROB:</strong> a circular array with head and tail indices, matching the hardware’s FIFO. Retirement is O(retire width) per cycle.</li>
<li><strong>Scheduler:</strong> an array of entries with a valid bitmask and a ready bitmask (for example, <code>uint64_t</code> words). Selection scans ready bits in age order. For speed, keep a per-physical-register list of waiting consumers so a wakeup touches only those entries, not the whole queue.</li>
<li><strong>Physical registers:</strong> an array of ready bits and ready-cycles, plus a free list as a circular buffer of register numbers (head/tail pointers make checkpointing it trivial).</li>
<li><strong>Load/store queues:</strong> circular arrays in age order, so “all older stores” is a range walk from the load’s position back to the head.</li>
<li><strong>Timed events:</strong> a calendar queue or a small array of buckets indexed by cycle modulo a horizon, for completions.</li>
</ul>`, "medium") +
Q(`<p>How do you model a multi-cycle or variable-latency operation (a divide, or a load whose latency depends on which cache level hits) without blocking unrelated instructions?</p><p>With about 2,000 pending completion events, compare a binary heap with a calendar queue (an array of buckets indexed by cycle modulo a horizon).</p>`,
`<p>Don’t simulate the waiting; schedule its end. At issue, compute the completion cycle (now + latency, or for a load, now + the latency returned by the cache model) and insert a completion event into a time-ordered event structure. Each cycle, process only events due this cycle: write back, set ready bits, wake consumers. Unrelated instructions are never touched by the waiting operation.</p>
<p>Resource occupancy is modeled separately:</p><ul><li>A pipelined unit is “busy” only in its issue cycle</li><li>A non-pipelined divider has a busy-until cycle</li><li>A load miss occupies an MSHR until its fill returns</li></ul><p>For loads, the scheduler must handle speculative wakeup: consumers may have been woken for an L1 hit and must be replayed when the cache model reports a miss.</p>
<p><strong>Event structures:</strong> a binary heap costs O(log n) per insert and remove, about 11 levels at 2,000 events; with ~6 completions per cycle that’s on the order of 130 sift steps per simulated cycle. A calendar queue inserts in O(1) into bucket[(now + latency) mod H] and each cycle just drains the current bucket. The catch: the horizon H must exceed the longest latency (400+ cycles for DRAM), or long events go to an overflow list that is re-sorted when their time comes.</p>`, "hard") +
`<h3 id="sec-cycle">Getting the Cycle Right</h3>` +
Q(`<p>In what order should you update pipeline stages within one simulated cycle, and what subtle error does each choice introduce?</p>`,
`<p>The usual answer is <strong>reverse pipeline order</strong>: retire, writeback, issue, dispatch, rename, decode, fetch. Each stage then consumes what the stage before it produced in the <em>previous</em> cycle, so an instruction can’t travel through several stages in one simulated cycle.</p>
<p>The subtlety is resources freed and used in the same cycle. If retire runs first and frees ROB entries, dispatch later in the same cycle can reuse them immediately. That models hardware where freeing and allocating happen in the same cycle, which may be optimistic. If the real design takes a cycle for the freed count to reach allocation, you’ll overestimate throughput whenever the ROB is full. Forward order has the opposite risk: instructions skipping stages unless every stage uses latches.</p>
<p>The robust approach is explicit <strong>current/next state</strong> (double-buffered latches between stages, or a “visible from cycle X” timestamp on every resource), so the result doesn’t depend on update order at all, and each same-cycle interaction is a deliberate modeling decision.</p>`, "hard") +
Q(`<p>Several instructions finish in the same cycle and there are fewer writeback ports than results, or two events tie. How do you handle this, and why does the tie-breaking rule matter for your workflow even if it barely affects IPC?</p>`,
`<p>Model writeback ports as a limited resource: results beyond the limit wait (or, as in many real designs, the scheduler avoids the conflict up front by reserving a writeback slot at issue). Break ties by age: oldest sequence number first.</p>
<p>Determinism is the reason it matters: if ties are broken by something incidental (hash-table iteration order, pointer values, a random number without a fixed seed), two runs of the same configuration can differ. Then you can’t use exact-match regression testing, you can’t bisect a performance change to a single code commit, and small effects disappear in run-to-run noise. A cycle-level model should give bit-identical results for the same inputs.</p>`, "medium") +
Q(`<p>How do you make sure stall statistics don’t double-count lost cycles, so that the categories add up to something meaningful?</p><p>Then try it on a 4-wide machine over 4 cycles. Cycle 0: 4 uops allocated, one of which is later squashed. Cycle 1: nothing allocated because the ROB is full. Cycle 2: the front end delivered only 2 uops, which allocate and later retire, while the back end had room. Cycle 3: nothing allocated; the ROB is full and the front end also had nothing. Classify all 16 slots.</p>`,
`<p>Attribute each lost <em>slot</em> exactly once, at one point in the pipeline, with a priority order. Top-down style: at allocation, each cycle has <em>W</em> slots; a slot that allocates a uop that will retire is “retiring”; one that allocates a uop that will be squashed is “bad speculation” (retroactively, when the squash happens); an empty slot is “back-end bound” if allocation was blocked by a full resource, otherwise “front-end bound.” When several resources are full at once, pick by a fixed priority (for example ROB, then registers, then scheduler, then LSQ) or by which one was full first, and document the choice.</p>
<p>Then assert the identity: the categories sum to <em>W</em> × cycles. Per-stage counters such as “cycles fetch stalled” and “cycles rename stalled” are still useful for drilling down, but they overlap and must never be added together.</p>
<p><strong>Worked slots:</strong> cycle 0: 3 retiring, 1 bad speculation. Cycle 1: 4 back-end bound. Cycle 2: 2 retiring, 2 front-end bound. Cycle 3: 4 <strong>back-end</strong> bound: when the back end can’t accept uops, the slot is back-end bound regardless of what the front end had, otherwise it would be counted twice. Totals: retiring 5, bad speculation 1, front-end 2, back-end 8 = 16. (Recovery cycles after the squash would also count as bad speculation.)</p>`, "hard") +
Q(`<p>Your model reports IPC 6.3 on a 6-wide core, or a negative average occupancy. Where do you look first?</p>`,
`<ul>
<li><strong>Units:</strong> are you counting uops or instructions? With macro-fusion two instructions are one uop, so instruction IPC can legitimately exceed the uop width; check which one is limited by 6.</li>
<li><strong>Window of measurement:</strong> instruction and cycle counters reset at different times (for example, instructions counted from the start, cycles only after warm-up).</li>
<li><strong>Integer types:</strong> an unsigned occupancy counter decremented one time too many wraps to about 4 billion; summed into an average and cast to a signed type, it can come out negative. Use asserts on every decrement.</li>
<li><strong>Double increments:</strong> squashed instructions counted as committed, or retirement counted per entry and per group.</li>
<li><strong>Real bugs:</strong> a resource never released (an occupancy that grows forever) or a structure exceeding its configured size. Add assertions that occupancy is between 0 and capacity every cycle in debug builds.</li>
</ul>`, "medium") +
Q(`<p>Your simulator runs at 150,000 instructions per second. A profile shows 60% of host time in scheduler wakeup, which scans all 97 entries for every broadcast tag every cycle. You replace it with per-register lists of waiting consumers, making wakeup about 10× cheaper. What speedup do you expect, and what should you check before celebrating?</p>`,
`<p>Amdahl: 1 / (0.4 + 0.6 / 10) = 1 / 0.46 ≈ <strong>2.17×</strong>, about 326,000 instructions per second. Before celebrating:</p><ol start="0"><li>The output must be bit-identical, cycle counts and all, on the regression suite</li><li>Wakeup’s worst case changed: one register with hundreds of waiters (a load feeding a long fan-out) now costs a long list walk</li><li>The profile has moved: the remaining 40% is now 87% of the time, so the next optimization target is elsewhere</li></ol>`, "hard") +
Q(`<p>A microbenchmark of 1,000 dependent single-cycle adds takes 3,000 cycles in your model, while 1,000 independent adds on the 4-wide model take 250. What is the most likely bug, and how do the two numbers point to it?</p>`,
`<p>Throughput is right (independent adds hit the 4-wide limit) but each dependent add costs 3 cycles instead of 1. So execution is fine and the problem is <em>when a consumer is considered ready</em>: most likely readiness is set when the producer reaches writeback (or the register file), 2 stages after execution, instead of when its result is available on the bypass. Fix it so a consumer can issue <em>latency</em> cycles after its producer issues, then rerun the chain test, and also test load-to-use chains and multi-cycle operations, which may have the same off-by-N error.</p>`, "hard") +
Q(`<p>In 40% of simulated cycles the whole core is stalled waiting on DRAM, in stretches averaging 300 cycles. Simulating a stalled cycle costs 1 µs of host time; an active cycle costs 3 µs. You add “skip to the next event” for fully stalled stretches, at about 1 µs per skip. What speedup do you get? What can go wrong?</p>`,
`<p>Per 1,000 cycles: before, 600 × 3 + 400 × 1 = 2,200 µs. After, 600 × 3 + (400 / 300) × 1 ≈ 1,801 µs: only <strong>1.22×</strong>. Active cycles dominate host time, so that’s where to optimize next.</p>
<p>Risks: something may still happen during a “stall”: prefetchers issuing requests, the DRAM model scheduling refresh or reordering, timers and interrupts, other cores in a multicore model. Skip only to the earliest pending event of <em>any</em> component. Statistics must also be credited for the skipped cycles (occupancy histograms, stall counters), or they silently drift.</p>`, "hard") +
Q(`<p>Why should a simulator use a fixed random seed for anything random (replacement policies, arbitration ties, synthetic traffic)?</p>`,
`<p>So runs are reproducible: the same configuration gives exactly the same cycle count. That makes regression testing by exact comparison possible, lets you bisect a performance change to a single commit, and ensures a small difference between two configurations is the design and not a different random draw. To study sensitivity to randomness, run several fixed seeds deliberately.</p>`, "easy") +
`<h3 id="sec-verify">Verification and Trust</h3>` +
Q(`<p>How would you verify that your model never retires out of order, and that dependences and speculative recovery are correct?</p>`,
`<ol start="0">
<li><strong>Retirement order:</strong> number every instruction at fetch and assert that retired numbers strictly increase. They skip over squashed instructions, so also check against the functional model that no correct-path instruction was skipped (see the next point).</li>
<li><strong>Co-simulation:</strong> compare the retired stream (PC, destination value, memory address and data) against a functional reference, instruction by instruction. The first mismatch points at the bug.</li>
<li><strong>Dependences:</strong> for a timing-only model, also record which producer each source was satisfied by, and check it against the functional model’s last writer of that register.</li>
<li><strong>Recovery:</strong> directed tests with forced mispredicts at every possible point (immediately after a branch, with nested branches, during a fill), plus random mispredict injection: performance should drop but the retired stream must be unchanged.</li>
<li><strong>Invariants:</strong> free-list conservation, occupancy bounds, and empty structures after a full flush.</li>
</ol>`, "medium") +
Q(`<p>You optimized the simulator to run 3× faster. How do you prove you didn’t change what it models?</p>`,
`<p>The simulator is deterministic, so a speed optimization must produce <strong>bit-identical output</strong>: same cycle count, same statistics, same retired-instruction trace, for every test in a regression suite (microbenchmarks plus short slices of real workloads across several configurations). Any difference at all is a behavior change, even if IPC moves by 0.01%.</p>
<p>Keep speed and modeling changes in separate commits. And measure simulator speed separately from modeled performance: report it as simulated instructions (or cycles) per second of wall-clock time, and profile it with a host profiler such as <code>perf</code>. A faster simulator never means a faster modeled core.</p>`, "easy") +
Q(`<p>A modeling change improves every benchmark by almost exactly the same percentage. Why should that make you suspicious, and what would you check?</p>`,
`<p>Real microarchitectural changes help workloads in proportion to how much they stress the changed mechanism, so gains vary widely: a bigger ROB helps memory-bound code and does nothing for compute-bound code. A uniform gain suggests something global changed:</p>
<ul>
<li>The clock or cycle accounting (for example, a cycle counter that now skips idle cycles).</li>
<li>A configuration parameter applied everywhere (a latency, a frequency, a warm-up length).</li>
<li>The measurement window (statistics reset at a different point, or a different instruction count per run).</li>
<li>A bug that removes a constant overhead, such as a stray bubble in every pipeline stage.</li>
</ul>
<p>Check that instruction counts are unchanged per benchmark, then compare stall breakdowns: a real improvement removes a specific category, and the removed amount should match the gain.</p>`, "medium") +
Q(`<p>What evidence would convince you that a modeled improvement is real rather than an artifact of the implementation?</p>`,
`<ul>
<li><strong>Mechanism:</strong> the stall category the feature targets drops, and the drop accounts for the speedup.</li>
<li><strong>Variation that makes sense:</strong> the gain correlates with a workload property you can name (MLP, MPKI, footprint), and workloads without that property don’t move.</li>
<li><strong>Bounds:</strong> it stays below the oracle version of the feature (perfect predictor, infinite structure).</li>
<li><strong>Microbenchmarks:</strong> a targeted microbenchmark shows exactly the expected effect.</li>
<li><strong>No functional change:</strong> the retired-instruction trace is identical.</li>
<li><strong>Robustness:</strong> it holds across simulation points, warm-up lengths, and nearby configurations, not just one point.</li>
</ul>`, "medium") +
Q(`<p>What are the trade-offs between modeling every microarchitectural detail and using a simplified model? Which simplifications can speed up large design sweeps without invalidating the conclusions, and how would you check?</p><p>Put numbers on sampling: a 2-trillion-instruction run, a detailed simulator at 200,000 instructions per second, and functional fast-forward at 50 million per second. Compare full detailed simulation with 10 SimPoints of 100 million instructions each, with and without saved checkpoints.</p>`,
`<p>Detail costs simulation speed and development time, and adds its own bugs; too little detail can hide exactly the effect you’re studying. The right level depends on the question.</p>
<p>Simplifications that usually preserve conclusions for core-level sweeps:</p>
<ul>
<li><strong>Sampling:</strong> SimPoint (simulate representative intervals, weighted) or SMARTS-style statistical sampling, with fast functional warm-up of caches and predictors between samples.</li>
<li><strong>Simpler models for parts not under study:</strong> a fixed-latency or queueing memory model when studying the core; a perfect or simple branch predictor when studying the memory hierarchy, if the interaction isn’t the point.</li>
<li><strong>Trace-driven</strong> instead of execution-driven, if wrong-path and timing-dependent behavior don’t matter for the question.</li>
</ul>
<p>Validate the simplified model against the detailed one on a subset of configurations. What must hold is the <em>ranking</em> of design points and the approximate size of differences, not the absolute IPC. Document every simplification next to the results.</p>
<p><strong>Numbers:</strong> full detailed simulation: 2 × 10<sup>12</sup> / 2 × 10<sup>5</sup> = 10<sup>7</sup> s, about <strong>116 days</strong>. SimPoints: 10<sup>9</sup> detailed instructions / 2 × 10<sup>5</sup> = 5,000 s, about <strong>1.4 hours</strong>, plus fast-forwarding to the sample points: up to 2 × 10<sup>12</sup> / 5 × 10<sup>7</sup> = 40,000 s (11 hours) in one pass. With saved checkpoints each sample starts from a stored state plus a short warm-up, and the 10 samples run in parallel: under 10 minutes of wall-clock time each.</p>`, "hard") +
Q(`<p>IPC varies across sampled intervals with a coefficient of variation of 0.6. With SMARTS-style random sampling, how many samples do you need for ±3% at 95% confidence? For ±1%? Why not just make each sample very short to save time?</p>`,
`<p>For relative error e at 95% confidence: n = (1.96 × CV / e)². ±3%: (1.96 × 0.6 / 0.03)² = 39.2² ≈ <strong>1,537 samples</strong>. ±1%: 9× as many, about <strong>13,800</strong>: precision costs quadratically.</p>
<p>Samples can be short (SMARTS used about 1,000 instructions), but only because it keeps caches and predictors warm functionally between samples and runs a short detailed warm-up before each one. Without that, short samples start with cold microarchitectural state and are biased low, and no number of samples fixes a bias.</p>`, "hard") +
Q(`<p>Two runs of the same configuration differ by 0.3% in IPC after 10 billion simulated cycles. How do you find the first point where they diverge, quickly?</p>`,
`<ol start="0">
<li>Have the simulator print a hash of its state every N cycles (for example, a hash of the committed instruction stream plus key structures, every 1 million cycles). Run both, and compare the logs to find the first interval where the hashes differ: one pass, not a long search.</li>
<li>Rerun only that interval (from a checkpoint, if you have them) with a per-cycle hash or a full trace, and find the first differing cycle and structure.</li>
<li>Look for the usual causes: uninitialized memory (run under Valgrind or MemorySanitizer), iteration over hash tables or other unordered containers, sorting or comparing by pointer value, time-based seeds, and data races in a multithreaded simulator.</li>
</ol>
<p>Nondeterminism is a bug: until it’s fixed, no 0.3% result from this simulator can be trusted.</p>`, "hard"),
},
{
  id: "intv-design",
  title: "Open-Ended Design Problems",
  sections: [
    { id: "build", label: "Design It" },
    { id: "spend", label: "Where to Spend Area" },
    { id: "process", label: "Running an Investigation" }
  ],
  body: reset("intv-design") + `
<p>These have no single right answer. Interviewers grade the structure: state assumptions, size things with numbers, name the trade-offs, and say what experiment would decide. Use the other pages as building blocks.</p>
<h3 id="sec-build">Design It</h3>` +
Q(`<p>Sketch a 4-wide out-of-order core. Which stages and structures does it need, how would you size the main structures, and what are the key throughput constraints?</p>`,
`<p><strong>Pipeline:</strong> branch prediction and fetch (16–32 bytes per cycle, BTB, return stack), decode (plus a decoded-uop cache on x86), rename (map table, free list, checkpoints), dispatch into ROB, scheduler, and LQ/SQ, issue and register read, execute with bypass, writeback, retire.</p>
<p><strong>Sizing with Little’s law:</strong> entries ≈ throughput × time held. To cover an L2 hit of about 12 cycles plus the dozen-cycle depth from dispatch to completion, and to reach the next independent miss, the window needs a few hundred entries. Skylake is a real 4-wide reference: 224-entry ROB, 97-entry unified scheduler, 180 integer and 168 FP physical registers, 72 loads and 56 stores in flight. Physical registers ≈ architectural + most of the ROB; LQ and SQ ≈ ROB × the fraction of loads (about 25–30%) and stores (about 10–15%).</p>
<p><strong>Throughput constraints:</strong></p><ul><li>Fetch bandwidth and taken branches per cycle</li><li>Rename (12 map-table reads per cycle, 8 for sources and 4 for the old mappings, plus 4 writes and intra-group dependence checks)</li><li>Scheduler wakeup–select in one cycle</li><li>Register file ports (about 8 reads and 4 writes)</li><li>Bypass network wiring (grows with the square of the number of execution units)</li><li>2 loads and 1 store per cycle for the L1D</li><li>Retirement at least 4 wide</li></ul><p>Then name the experiment that would size each structure: a sweep with stall breakdowns.</p>`, "hard") +
Q(`<p>You are designing the scheduler for a core with several execution-unit types (integer ALU, multiply, divide, load, store, FP/vector). Unified or distributed queues? How do you steer instructions and choose what issues each cycle?</p><p>Then quantify stranded capacity: a unified 96-entry scheduler versus 4 queues of 24 entries where loads may enter only one of the four. In a phase where 60% of instructions are loads waiting on misses, how many instructions can be in the scheduler before dispatch stalls in each design?</p>`,
`<p><strong>Unified</strong> (Skylake’s 97-entry scheduler): any entry can go to any suitable port, so capacity is never stranded, but every entry must be checked against every port, and wakeup–select spans a big structure, which is hard to make fast. <strong>Distributed</strong> (Zen 4 has four integer scheduler queues, each feeding one ALU and one address-generation unit, plus separate FP schedulers): smaller, faster queues, but capacity can be stranded (one queue full while another is empty), and steering decisions at dispatch are final.</p>
<p><strong>Steering:</strong> pick a queue at dispatch by instruction type, then balance by occupancy, and where possible place dependent instructions near their producers to shorten bypass paths.</p>
<p><strong>Selection:</strong> oldest-ready per port, with priority tweaks for loads and branches that feed long-latency events. Model per-port binding if the hardware binds at dispatch. To evaluate, count stranded-capacity stalls (allocation blocked by one full queue while others have room) and ready-but-not-issued cycles.</p>
<p><strong>Numbers:</strong> unified: 96 instructions. Distributed: the load queue fills after 24 loads, which takes 24 / 0.6 = <strong>40 instructions</strong>; dispatch then stalls with the other three queues holding only 16 instructions between them. The effective window in this phase drops from 96 to 40, which is why real designs let loads go to several queues or size the address-generation queues for load-heavy phases.</p>`, "hard") +
Q(`<p>What are the main things a performance architect trades off when deciding whether to add a feature?</p>`,
`<p>Performance (on which workloads, and how robustly), power (dynamic and leakage, and whether it fits the power budget), area (cost per die, and what else the area could buy), timing (whether it lengthens a critical path or forces an extra stage), and complexity (design and verification effort, schedule risk, bugs). A feature that wins on performance alone often loses once the other four are counted.</p>`, "easy") +
Q(`<p>When does performance per watt matter more than performance per mm², and vice versa?</p>`,
`<p>Performance per watt dominates when power is the binding limit: phones and laptops (battery and heat) and data centers (power and cooling costs, and chips that hit their power cap with all cores busy). Performance per mm² dominates when cost per chip is the limit and power isn’t: high-volume, cost-sensitive parts, or deciding how many cores fit on a die. Many server designs care about both, since more cores per die also need more power.</p>`, "easy") +
`<h3 id="sec-spend">Where to Spend Area</h3>` +
Q(`<p>You can spend the same extra area on either a larger ROB (with the registers and queues to match) or a larger L2. How do you decide?</p><p>Then decide with numbers: growing the L2 from 1 MB to 2 MB raises its latency from 14 to 16 cycles and cuts L2 misses from 10 to 6 per 1,000 instructions. Each L2 miss that hits L3 exposes about 30 cycles, and each L2 hit exposes 30% of its latency (30 L2 hits per 1,000 instructions). Growing the ROB from 320 to 384 instead hides about 64 / 6 ≈ 11 more cycles of each isolated DRAM miss (2 per 1,000 instructions). Which wins?</p>`,
`<p>Gather evidence for each:</p>
<ul>
<li><strong>For the L2:</strong> the miss-rate curve versus capacity. If L2 MPKI drops sharply between the current and larger size, working sets sit just above the current capacity. Note that a larger L2 is usually slower (for example, about 12 versus about 15 cycles in recent generations), which costs every L2 hit.</li>
<li><strong>For the ROB:</strong> ROB-full stall cycles and MLP. A bigger window helps only if there are independent misses further ahead to overlap.</li>
</ul>
<p>Then run both equal-area configurations on the full suite and compare distributions, not just geomean. Typically the L2 wins for workloads with working sets near the threshold, and the ROB wins for streaming or high-MLP code, which a bigger L2 can’t hold anyway. The decision also depends on the product: server workloads with big footprints favor cache. And check the interaction: with a bigger L2 there are fewer long misses to hide, so the ROB matters less.</p>
<p><strong>Numbers (cycles per 1,000 instructions):</strong></p>
<ul>
<li>L2 cost: 2 extra cycles × 30 hits × 0.3 = 18 cycles.</li>
<li>L2 benefit: 4 misses become hits, each saving 30 − 0.3 × 16 = 25.2 cycles: about 101 cycles.</li>
<li>Net L2: about <strong>83 cycles saved</strong>.</li>
<li>ROB: 2 × 11 ≈ <strong>21 cycles saved</strong>.</li>
</ul>
<p>The L2 wins by about 4× for this workload. For a streaming workload whose working set is far larger than 2 MB, the L2 benefit would vanish and only its latency cost would remain.</p>`, "hard") +
Q(`<p>A workload is limited by dependent loads (pointer chasing). Would you prioritize a larger ROB, more MSHRs, a lower-latency cache, or a better prefetcher? What evidence would you need?</p>`,
`<p><strong>Lower latency first, and possibly a smarter prefetcher; not the ROB or MSHRs.</strong> In a dependent chain, each miss must finish before the next address is known, so MLP is about 1. More MSHRs have nothing to hold, and a larger ROB fills with work that waits on the same chain. What shortens the critical path is making each step faster: a lower-latency or larger cache level that holds the structure, a better TLB (pointer chasing over a large heap often adds page walks), or a prefetcher that can predict the next pointer.</p>
<p>Normal stride prefetchers fail on pointer chasing. Content-directed prefetchers (which scan fetched lines for values that look like pointers) or correlation prefetchers (which remember that miss A was followed by miss B) can help on repeated traversals.</p>
<p>Evidence:</p><ul><li>Average outstanding misses near 1</li><li>Loads whose addresses come from other loads (load-to-load dependence in the trace)</li><li>Which cache level the chain hits</li><li>TLB miss rates</li><li>Whether the traversal repeats (which decides whether correlation prefetching can work)</li></ul><p>Simulate the idealized version of each option to bound its benefit before designing it.</p>`, "hard") +
Q(`<p>Someone proposes increasing retirement width from 6 to 8 without changing anything else. How would you evaluate it?</p><p>Then bound it: a counter shows that in 3% of cycles the ROB head has at least 8 completed uops and retirement width is the only limit. At IPC 2.5, what is the most 8-wide retirement could gain?</p>`,
`<p>Sustained IPC can’t exceed allocation width, so the only possible benefit is faster draining after head-of-ROB stalls, which frees entries sooner. Measure first: how often is retirement-width the binding limit? Count cycles where the ROB head is complete and more than 6 completed instructions are waiting to retire, and how often allocation is stalled on a full ROB at the same time. If that’s rare, the proposal can’t help much.</p>
<p>Then simulate it on memory-bound workloads, where post-miss bursts happen most, and weigh against cost: wider map-table updates at commit, more free-list returns per cycle, more ROB read ports. Expect a small gain, concentrated in memory-bound code.</p>
<p><strong>Bound:</strong> in those cycles at most 2 extra uops retire: 0.03 × 2 = 0.06 extra uops per cycle, about 2.4% of 2.5. That’s a ceiling, reached only if every early retirement turns into earlier allocation (that is, the ROB was full at the time). The real gain is likely well below 2%.</p>`, "hard") +
Q(`<p>If you could add only one new performance counter to diagnose an unknown bottleneck, what would it be, and why?</p>`,
`<p>A good answer: <strong>allocation-slot accounting by cause</strong>: every cycle, each of the <em>W</em> allocation slots is labelled retiring, bad speculation, front-end bound, or back-end bound (with back-end split by which resource was full). Unlike most counters, its categories add up to the total, so it tells you where to look first instead of what one structure did.</p>
<p>Alternative strong answer: <strong>ROB-head stall cycles by the head instruction’s type and state</strong> (L1, L2, L3, DRAM miss, TLB miss, divide, store, fence), since most back-end-bound time traces to what’s blocking the head. Either way, justify by how it narrows the search, and admit what it can’t see (for example, slot accounting doesn’t say <em>which</em> load is the problem).</p>`, "medium") +
`<h3 id="sec-process">Running an Investigation</h3>` +
Q(`<p>You have two weeks to explain a 15% performance regression in a new CPU configuration. How would you structure the investigation?</p>`,
`<ol start="0">
<li><strong>Days 0–1, reproduce and scope:</strong> confirm the 15% is real (not noise, warm-up, or a binary or input change). Which benchmarks regress, and by how much? A regression concentrated in a few benchmarks is much easier than a uniform one.</li>
<li><strong>Days 1–3, list the differences:</strong> diff the two configurations parameter by parameter. If there are several changes, bisect: apply them one at a time (or in halves) to find which ones cause it, and check for interactions.</li>
<li><strong>Days 3–6, localize:</strong> compare slot accounting and stall breakdowns between old and new on the worst benchmarks; find the category that grew, then the code (per-PC stall differences).</li>
<li><strong>Days 6–9, explain:</strong> build a microbenchmark that reproduces the effect and explain the mechanism end to end.</li>
<li><strong>Days 9–14, fix and confirm:</strong> propose a fix, rerun the full suite to check it recovers the loss without new regressions, and write it up: cause, evidence, fix, residual risk.</li>
</ol>
<p>Share an interim finding by the middle of the period; don’t go dark for two weeks.</p>`, "medium") +
Q(`<p>A manager asks you to prove that a proposed optimization improves every workload. How do you respond, and what would you propose instead?</p>`,
`<p>Be direct: you can’t prove it for all workloads. Some workload can almost always be constructed where it hurts (a prefetcher that pollutes the cache, a predictor that thrashes, a larger structure that adds a cycle of latency). What you can show is how likely and how large a regression is, on workloads that matter.</p>
<p>Propose:</p><ul><li>A broad, representative suite (SPEC CPU, server and client traces, the customers’ key workloads)</li><li>Report the distribution of speedups including the worst case, not just the geomean</li><li>Deliberately test adversarial cases suggested by the mechanism</li><li>Explain the mechanism so the reasons it helps are clear</li><li>Add guardrails if regressions exist, such as throttling the feature when it detects it isn’t helping (as prefetchers do with accuracy feedback)</li></ul><p>Agree up front on the acceptance criterion, for example “geomean gain above 2% and no workload worse than −1%.”</p>`, "medium"),
}
]);
})();
