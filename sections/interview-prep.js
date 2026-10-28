/* Section: CPU Performance Interview Prep (public).
   Reasoning questions for CPU modeling / performance architecture interviews.
   Every question is a card; the answer is hidden behind "Show answer".
   Each page has a Conceptual tab and a Math tab, numbered from 1. */
(function () {
const LVL = { easy: "Easy", medium: "Medium", hard: "Hard" };
/* Q() makes a conceptual card and M() one whose answer rests on a multi-step
   calculation. Each returns a placeholder, and tabbed() later sorts a page's
   cards into a Conceptual tab (shown first) and a Math tab, repeating the
   topic headings in each, and numbers the cards from 1 within each tab. */
const CARDS = [];
const card = tab => (q, a, lvl) => `\u0000${CARDS.push({ tab, q, a, lvl }) - 1}\u0000`;
const Q = card("c"), M = card("m");
const TABS = [["c", "Conceptual"], ["m", "Math"]];
const render = (qid, n, c) => `
<div class="prob" data-qid="${qid}"><div class="q"><p class="qn">Q${n}${c.lvl ? ` <span class="lvl ${c.lvl}">${LVL[c.lvl]}</span>` : ""}</p>${c.q}</div>
<details><summary>Show answer</summary><div class="a">${c.a}</div></details></div>`;
function tabbed(page) {
  const [intro, ...parts] = page.body.split(/(?=<h3 id="sec-)/);
  const sections = [], panels = [];
  for (const [tab, name] of TABS) {
    let n = 0, html = "";
    sections.push({ group: name });
    for (const part of parts) {
      const [, id, label] = part.match(/^<h3 id="sec-([^"]+)">(.*?)<\/h3>/);
      const cards = [...part.matchAll(/\u0000(\d+)\u0000/g)].map(m => CARDS[m[1]]).filter(c => c.tab === tab);
      if (!cards.length) continue;
      const sid = tab === "c" ? id : "m-" + id;
      sections.push({ id: sid, label });
      html += `\n<h3 id="sec-${sid}">${label}</h3>` + cards.map(c => { n++; return render(`${page.id}-${tab}${n}`, n, c); }).join("");
    }
    panels.push({ tab, name, n, html });
  }
  const body = intro + `<div class="tabs" role="tablist">${panels.map((p, i) =>
    `<button type="button" class="tab-btn" role="tab" data-tab="${p.tab}" aria-selected="${i === 0}">${p.name} (${p.n})</button>`).join("")}</div>` +
    panels.map((p, i) => `<div class="tab-panel" role="tabpanel" data-tab="${p.tab}"${i ? " hidden" : ""}>${p.html}</div>`).join("");
  return Object.assign({}, page, { sections, body, tabs: true });
}

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
<p>Every page has two tabs. <strong>Conceptual</strong>, shown first, holds questions you answer by reasoning about mechanisms. <strong>Math</strong> holds questions whose answer rests on a multi-step calculation. The topic headings repeat in each tab, and questions are numbered from 1 within each tab. Instructions in code examples are numbered from I0, and cycles from cycle 0.</p>
<p class="callout">Terminology: questions about Intel cores or a generic core use Intel's term, uop, meaning a fused-domain uop (the unit rename and retire count) unless the question says unfused. Questions about AMD cores count macro-ops, AMD's equivalent. The note in the <a href="#/r/fe">Front End overview</a> maps the terms across Intel, AMD, and Arm.</p>

<h3 id="sec-answer">How to Answer Out Loud</h3>
<p>Aim for 30 to 90 seconds per question. For any performance question, use the same four beats:</p>
<ol>
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
<p>Every question is tagged <strong>Easy</strong>, <strong>Medium</strong>, or <strong>Hard</strong>. The Conceptual tab on each page is about 20% easy, 35% medium, and 45% hard. The Math tab is about 20% medium and 80% hard. Hard questions involve multi-step math, a trap, or an open-ended trade-off. The numbers in the trickiest answers were checked with a small cycle-level simulation or a script.</p>

<h3 id="sec-order">Study Order</h3>
<ol>
<li><strong>Fundamentals:</strong> <a href="#/intv-pipeline">Pipeline Flow and Width</a>, <a href="#/intv-renaming">Renaming and Dependences</a>, <a href="#/intv-rob">The ROB and Retirement</a>, <a href="#/intv-sched">Scheduling and Execution</a>, <a href="#/intv-arith">Arithmetic and Floating Point</a>.</li>
<li><strong>Interactions:</strong> <a href="#/intv-branch">Branch Prediction and Speculation</a>, <a href="#/intv-fe">Front End and Fetch</a>, <a href="#/intv-lsq">Loads, Stores and Memory Ordering</a>, <a href="#/intv-mem">Caches, TLBs and DRAM</a>, <a href="#/intv-coh">Coherence and Consistency</a>, <a href="#/intv-diag">Diagnosing Bottlenecks</a>.</li>
<li><strong>Your own experience:</strong> <a href="#/intv-sim">Building a Performance Model in C</a>, <a href="#/intv-design">Open-Ended Design Problems</a>. Connect every answer here to a decision or bug from your own simulator.</li>
</ol>

<h3 id="sec-numbers">Numbers Worth Knowing</h3>
<p>Interview answers land better with real numbers. These are public figures for four well-documented cores, and the questions on these pages use them.</p>
<div class="tbl"><table>
<tr><th></th><th>Intel Skylake (2015)</th><th>AMD Zen 4 (2022)</th><th>Intel Golden Cove (2021)</th><th>AMD Zen 5 (2024)</th></tr>
<tr><td>Rename / dispatch width</td><td>4</td><td>6</td><td>6</td><td>8</td></tr>
<tr><td>ROB entries</td><td>224</td><td>320</td><td>512</td><td>448</td></tr>
<tr><td>Load / store queue</td><td>72 / 56</td><td>88 / 64</td><td>192 / 114</td><td>64 uncompleted / 104</td></tr>
<tr><td>Integer / FP physical registers</td><td>180 / 168</td><td>224 / 192</td><td>280 / 332</td><td>240 / 384</td></tr>
<tr><td>Loads per cycle</td><td>2</td><td>3</td><td>3</td><td>4 (2 vector)</td></tr>
<tr><td>FMA units, latency</td><td>2, 4 cycles</td><td>2, 4 cycles</td><td>2, 4 cycles</td><td>2 (512-bit), 4 cycles</td></tr>
<tr><td>L1D / L2 load-to-use</td><td>4–5 / about 12 cycles</td><td>4 / about 14 cycles</td><td>5 / about 15 cycles</td><td>4 / at least 14 cycles</td></tr>
<tr><td>L2 TLB entries (4 KB pages)</td><td>1,536</td><td>3,072</td><td>2,048</td><td>4,096</td></tr>
</table></div>
<p>Rules of thumb: DRAM latency is about 80–100 ns, which is 400–500 cycles at 5 GHz. A branch misprediction costs about 15–20 cycles on recent big cores when the branch resolves promptly. A cache line is 64 bytes.</p>
<p class="refs">Sources:</p><ul class="refs"><li>Intel 64 and IA-32 Architectures Optimization Reference Manual</li><li>AMD Software Optimization Guide for the Zen 4 microarchitecture</li><li>AMD Software Optimization Guide for the Zen 5 microarchitecture (publication 58455)</li><li>Intel Architecture Day 2021</li><li>Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 3</li></ul>`
}, [
{
  id: "intv-pipeline",
  title: "Pipeline Flow and Width",
  body: `
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
Q(`<p>An instruction can sit in each of these states for a long time: waiting to issue, executing, completed but not retired, and retired but not finished. Give a concrete example for each.</p>`,
`<ul>
<li><strong>Waiting to issue:</strong> an add whose source comes from a load that missed to DRAM. It sits in the scheduler for hundreds of cycles.</li>
<li><strong>Executing:</strong> a 64-bit integer divide on a non-pipelined divider (tens of cycles), or the load itself while its miss is outstanding.</li>
<li><strong>Completed but not retired:</strong> any instruction younger than the stalled load. It finished long ago but must wait until everything older has retired, to keep exceptions precise.</li>
<li><strong>Retired but not finished:</strong> a store. It retires from the ROB once its address and data are known, then waits in the store buffer until it can write the L1, which may take a whole cache miss.</li>
</ul>`, "easy") +
M(`<p>A hash-table probe loop: each iteration is one load that misses to DRAM (400 cycles, address independent of other iterations) plus 20 single-cycle instructions that all use the loaded value. Compare time per iteration on:</p><ul><li>(a) A 2-wide in-order core that stalls on first use of a missing load</li><li>(b) A 6-wide out-of-order core with a 512-entry ROB and 16 L1D miss buffers (MSHRs)</li><li>(c) A 4-wide out-of-order core with a 224-entry ROB and 12 MSHRs</li></ul><p>Assume the physical register file, scheduler, and load queue are big enough never to fill before the ROB. Ignore DRAM bandwidth, then say when you can’t. For that, the cores run at 5 GHz, and an 8-core desktop chip has dual-channel DDR5-5600 (89.6 GB/s peak). Finally, redo (b) and (c) if the 6-wide core has 280 integer physical registers and the 4-wide core 180, each with 16 architectural registers.</p>`,
`<ol>
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
<p><strong>Why the register assumption matters:</strong> 20 of every 21 instructions write a register. With 280 integer registers (16 architectural), only about 264 / (20/21) ≈ 277 instructions fit before the free list empties, about 13 misses in flight, so case (b) would be register-bound at roughly 400 / 13 ≈ 31 cycles. With 180 registers, case (c) is limited to about 164 / (20/21) ≈ 172 instructions, 8 misses, 50 cycles. In a real core, check the register file before the ROB.</p>
<p><strong>Bandwidth:</strong> case (b) pulls one 64-byte line every 25 cycles, 64 B × 5 GHz / 25 ≈ 12.8 GB/s per core. One core is fine, but eight cores doing this want about 100 GB/s, more than the 89.6 GB/s that dual-channel DDR5-5600 delivers, so on a full chip the memory bus, not the core, becomes the limit.</p>`, "hard") +
M(`<p>Model time per instruction as a function of pipeline depth <em>k</em>:</p>
<p class="eq">T(<em>k</em>) = (CPI<sub>0</sub> + <em>h</em>·<em>k</em>) × (<em>t</em><sub>L</sub> / <em>k</em> + <em>t</em><sub>o</sub>)</p>
<p>where <em>t</em><sub>L</sub> = 3,400 ps of total logic delay, <em>t</em><sub>o</sub> = 20 ps of latch and clock-skew overhead per stage, CPI<sub>0</sub> = 0.40 without hazards, and <em>h</em> = 0.02 cycles of hazard stall per instruction per stage (mispredicts and dependent-operation stalls get longer with depth). Today <em>k</em> = 19. (a) Derive the optimal depth. (b) How much faster is it, at what clock frequency? (c) Why does nobody build it?</p>`,
`<ol>
<li><strong>(a)</strong> Expand: T = CPI<sub>0</sub><em>t</em><sub>L</sub>/<em>k</em> + CPI<sub>0</sub><em>t</em><sub>o</sub> + <em>h</em><em>t</em><sub>L</sub> + <em>h</em><em>t</em><sub>o</sub><em>k</em>. Set dT/d<em>k</em> = −CPI<sub>0</sub><em>t</em><sub>L</sub>/<em>k</em>² + <em>h</em><em>t</em><sub>o</sub> = 0:
<p class="eq"><em>k</em>* = √(CPI<sub>0</sub><em>t</em><sub>L</sub> / (<em>h</em><em>t</em><sub>o</sub>)) = √(0.40 × 3,400 / (0.02 × 20)) = √3,400 ≈ <strong>58 stages</strong></p>
Substituting back gives a neat minimum: T* = (√(CPI<sub>0</sub><em>t</em><sub>o</sub>) + √(<em>h</em><em>t</em><sub>L</sub>))² = (√8 + √68)² ≈ 122.6 ps.</li>
<li><strong>(b)</strong> At <em>k</em> = 19: cycle = 3,400/19 + 20 = 198.9 ps (5.0 GHz), CPI = 0.78, T = 155.2 ps. At <em>k</em> = 58: cycle = 78.6 ps (<strong>12.7 GHz</strong>), CPI = 1.56, T = 122.6 ps: <strong>1.27× faster</strong>. The curve is very flat near the optimum: <em>k</em> = 30 gives 133.3 ps (1.16×) and <em>k</em> = 40 gives 126.0 ps, so most of the gain comes early, and half of the remaining stages buy only a few percent.</li>
<li><strong>(c)</strong> The model counts only time. Dynamic power is roughly C·V²·f: the latch and clock-tree capacitance grows with <em>k</em>, and <em>f</em> grows 2.5×, so power rises several-fold for a 27% gain, far past any thermal limit. The model also assumes <em>h</em> is constant, but some loops can’t be pipelined at all (single-cycle ALU-plus-bypass and wakeup–select loops), so their stall cost grows faster than linearly with depth. And CPI doubles, so the processor spends more of its time and energy on wrong-path and stalled work. Because the time curve is flat, a much shallower pipeline loses little performance and saves a lot of power, which is why real cores sit around 15–20 stages and why Prescott’s 31-stage design was abandoned.</li>
</ol>`, "hard") +
M(`<p>Adding a pipeline stage to the load path lets the clock rise from 5.0 to 5.3 GHz, but load-to-use latency grows from 4 to 5 cycles and the mispredict penalty from 17 to 18 cycles. A latency sweep on your workload shows each extra cycle of load-to-use latency adds 0.035 to CPI. The workload runs at CPI 0.50 with 6 mispredicts per 1,000 instructions. Is the change worth it? At what frequency would it break even?</p>`,
`<ol>
<li>New CPI = 0.50 + 0.035 (load latency) + 6/1,000 × 1 (one more cycle per mispredict) = <strong>0.541</strong>.</li>
<li>Time per instruction: before 0.50 / 5.0 GHz = 0.1000 ns; after 0.541 / 5.3 GHz = 0.1021 ns. The change is about <strong>2% slower</strong>: the 6% frequency gain is eaten by an 8.2% CPI increase.</li>
<li>Break-even frequency: 5.0 × 0.541 / 0.50 = <strong>5.41 GHz</strong>.</li>
</ol>
<p>Things to say next: the 0.035 sensitivity must come from representative workloads (pointer-chasing code is far more latency-sensitive than streaming code, so some workloads lose much more), and the extra stage also costs power and area.</p>`, "medium") +
M(`<p>Widening a core from 4 to 6 wide raises IPC by 12% and core power by 30% at the same frequency and voltage. Compute the change in energy per instruction, performance per watt, energy × delay (ED), and energy × delay² (ED²). Which metric should decide, and for which kinds of product would you accept the change?</p>`,
`<p>Let delay per instruction D ∝ 1/IPC and energy per instruction E = power × D.</p>
<ul>
<li>E: 1.30 / 1.12 = <strong>1.161</strong>, 16% more energy per instruction.</li>
<li>Performance per watt: 1.12 / 1.30 = <strong>0.862</strong>, 14% worse.</li>
<li>ED = 1.161 / 1.12 = <strong>1.036</strong>, 3.6% worse.</li>
<li>ED² = 1.161 / 1.12² = <strong>0.925</strong>, 7.5% better.</li>
</ul>
<p>Why ED² matters: with voltage–frequency scaling, energy per operation scales roughly with V² and delay roughly with 1/V, so E × D² stays roughly constant as you move along one design’s voltage curve. A design that wins on ED² can therefore be run at a lower voltage to match the other design’s power and still come out faster. So for a core that will be voltage-scaled (laptops, servers under a power cap), the wider core is the better design point even though it loses at equal voltage.</p>
<p>Where you’d reject it: when energy per task is the constraint at a fixed operating point (a phone’s efficiency core, or throughput servers where perf/W at fixed voltage sets cost). Where you’d accept it: single-thread performance products. The interview point is that the answer depends on the metric, and you should say which one and why.</p>`, "hard") +
M(`<p>A 6-wide core with a 512-entry ROB supports two hardware threads (SMT) and splits the ROB evenly, 256 entries each. Thread M is memory-bound: one independent DRAM miss (400 cycles) every 64 instructions, everything else easy. Thread C is limited by a dependence chain to IPC 2.0 and needs only a few dozen ROB entries. Estimate the throughput of M alone, C alone, M+M, C+C, and M+C. When does SMT pay off?</p>`,
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
Q(`<p>An in-order core issues in order but lets a long operation (a 20-cycle FP divide) complete after younger, shorter instructions have already written their results. How can it still take a precise exception if the divide faults? Name the classic mechanisms and what each costs.</p>`,
`<p>The problem: by the time the divide reports a fault, younger instructions have already overwritten registers, so the state the handler sees isn’t the state “just before the divide.”</p>
<ul>
<li><strong>Early fault detection:</strong> decide in the first cycle or two whether the operation can fault (check the operands for divide by zero, or for values that could overflow or underflow), and stall younger instructions only when it might. Cheap, and it is what many in-order FP pipelines do, but it is conservative for FP, where the check can only say “might fault.”</li>
<li><strong>Reorder buffer:</strong> results wait in a buffer and are written to the register file in order. Exact, but it adds a structure and a bypass path from the buffer.</li>
<li><strong>History buffer:</strong> write the register file immediately, but log each overwritten value. On a fault, walk the log backward to restore it. The fast path costs nothing, recovery is slow.</li>
<li><strong>Future file:</strong> keep two register files, one updated out of order for execution and one updated in order for exceptions. Doubles the register storage.</li>
</ul>
<p>The last three are the Smith and Pleszkun schemes. The choice is about where you pay: area in the common case (reorder buffer, future file) or time at recovery (history buffer). Out-of-order cores generalize the reorder buffer, because they need in-order commit for branch mispredicts anyway.</p>`, "hard") +
Q(`<p>x86 cores split some instructions into several uops and then fuse others back together: micro-fusion keeps a load and an ALU operation in one slot, macro-fusion merges a compare and a branch. Which stages count fused uops and which count unfused ones on a recent Intel core? Show how a model that counts the wrong unit finds the wrong bottleneck.</p>`,
`<p><strong>Fused domain:</strong> decode, the uop cache, the allocation queue, rename and allocation, and retirement count a micro-fused load plus ALU op as one slot. Macro-fused <code>cmp</code> plus <code>jne</code> is one uop everywhere.</p>
<p><strong>Unfused domain:</strong> the scheduler and the execution ports see the two halves separately: the load goes to a load port and the ALU part to an ALU port. Some addressing modes, such as indexed addresses on several Intel generations, are un-laminated at rename and take two rename slots as well.</p>
<p><strong>How a model goes wrong:</strong></p>
<ul>
<li>Counting unfused uops at rename makes a loop full of <code>add rax, [rsi+8]</code> look rename-bound at width 6, when in reality rename has room and the load ports are the limit.</li>
<li>Counting fused uops at the ports hides port pressure: the model issues the load and the add as one operation and reports idle load ports.</li>
<li>Ignoring macro-fusion overcounts branches against the taken-branch and port limits, and overcounts uops in the ROB, so window-limited code looks worse than it is.</li>
</ul>
<p>The rule: track both counts per instruction, and apply each structure’s limit in the unit that structure actually uses. Validate with the hardware’s own counters, which on Intel report both <code>UOPS_ISSUED</code> (fused) and <code>UOPS_DISPATCHED</code> (unfused).</p>`, "hard") +
Q(`<p>A branch can be repaired as soon as it executes and is found mispredicted, or only when it reaches the head of the ROB. Both are correct. What does each cost, and why do modern cores repair at execute even though it is much harder?</p>`,
`<p><strong>Repair at retire:</strong> by the time the branch is at the head, every older instruction has committed, so recovery is just “flush everything and restore the retirement map.” No checkpoints and no selective squash. The cost is time: the wrong path keeps fetching while the branch waits to reach the head, behind any older cache miss. A branch that resolves 30 cycles after fetch but sits behind a 250-cycle DRAM miss wastes about 250 cycles instead of about 20.</p>
<p><strong>Repair at execute:</strong> redirect fetch the moment the branch resolves. The penalty becomes front-end refill plus resolution time, independent of what is ahead of it in the ROB. It needs:</p>
<ul>
<li>A way to restore the rename map to the branch’s point: checkpoints or a ROB walk</li>
<li>Selective squash of only the instructions younger than the branch, in the ROB, scheduler, load and store queues</li>
<li>Correct handling when an older branch resolves later and turns out mispredicted too, or when the branch itself was on a wrong path</li>
<li>Restored predictor history and return-address stack</li>
</ul>
<p>Since mispredicts often depend on loads that miss, many of them resolve while an older miss blocks retirement. Repairing at execute removes that waiting time, which is why the complexity is worth paying. Exceptions, which are rare, are still usually handled at retire.</p>`, "hard") +
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
M(`<p>On Skylake (2 FMA units, 4-cycle latency, fully pipelined, 2 loads per cycle), a dot product is written as <code>for (i) acc = fma(a[i], b[i], acc);</code> with AVX2 vectors. What throughput does it get? How many accumulators would reach the FMA peak? And would it then actually reach the peak?</p>`,
`<ol>
<li><strong>One accumulator:</strong> every FMA depends on the previous one through <code>acc</code>, so it runs at 1 FMA per 4 cycles, 0.25 per cycle, which is 8 times below the peak of 2 per cycle.</li>
<li><strong>Accumulators needed:</strong> latency × throughput = 4 cycles × 2 per cycle = <strong>8 independent accumulators</strong> to keep both pipelines full (Little’s law).</li>
<li><strong>The trap:</strong> each FMA needs two loads (<code>a[i]</code> and <code>b[i]</code>), and Skylake does 2 loads per cycle. So the loop can sustain only <strong>1 FMA per cycle</strong>, half the FMA peak, even with 8 accumulators. It’s load-bound. Matrix multiply reaches the FMA peak only because register blocking reuses each loaded value in several FMAs.</li>
<li>If the arrays don’t fit in L1, the L2 or DRAM bandwidth caps it lower still.</li>
</ol>
<p>Also: the compiler won’t split the accumulator for you without permission (for example <code>-ffast-math</code> or <code>-fassociative-math</code>), because FP addition isn’t associative and the result would change.</p>`, "medium") +
Q(`<p>Integer multiply on Skylake has 3-cycle latency and a throughput of 1 per cycle. Explain how both can be true. Then: a loop performs 1,000 <em>independent</em> 64-bit divides on a core whose divider takes 14 cycles and is not pipelined. Roughly how long does it take, and what would you change?</p>`,
`<p>The multiplier is pipelined into 3 stages: each multiply takes 3 cycles start to finish, but a new one can enter every cycle, so up to 3 are in flight. Latency matters for dependent chains; reciprocal throughput matters for independent work.</p>
<p>The divider is not pipelined, so independence doesn’t help: one divide at a time, about 1,000 × 14 = <strong>14,000 cycles</strong>, while the rest of the window fills with instructions waiting for divide results. Options: divide by a constant becomes a multiply by a precomputed reciprocal and a shift (compilers do this automatically), hoist a common divisor and multiply by its reciprocal in FP if precision allows, or, as a hardware designer, add a second divider or a higher-radix divider if workloads justify the area.</p>`, "easy") +
M(`<p>A core with a fixed 4-byte instruction encoding fetches one aligned 32-byte block (8 instructions) per cycle and stops at the first taken branch in the block. A hot loop is 10 instructions (40 bytes) ending in a taken backward branch. The predictor supplies the target with no bubble, and decode keeps up. (a) What is the fetch-limited IPC if the loop starts at byte offset 0, 24, or 28 within a block? (b) Repeat with a 1-cycle bubble after every taken branch. (c) What alignment rule should the compiler follow, and when doesn’t alignment matter?</p>`,
`<p>A loop starting at offset <em>s</em> occupies bytes <em>s</em> to <em>s</em> + 39, and each fetch cycle covers one 32-byte block, so cycles per iteration = number of blocks touched.</p>
<ol>
<li><strong>(a)</strong> Offset 0: blocks [0, 32) and [32, 64), 8 + 2 instructions: 2 cycles, IPC <strong>5</strong>. Offset 24: [24, 32) gives 2 instructions, [32, 64) gives 8: still 2 cycles, IPC <strong>5</strong>. Offset 28: [28, 32) gives 1, [32, 64) gives 8, [64, 68) gives 1: 3 cycles, IPC <strong>3.33</strong>.</li>
<li><strong>(b)</strong> Add a cycle per iteration: 10 / 3 = <strong>3.33</strong>, 3.33, and 10 / 4 = <strong>2.5</strong>.</li>
<li><strong>(c)</strong> The loop touches 2 blocks when <em>s</em> + 40 ≤ 64, i.e. <em>s</em> ≤ 24, and 3 blocks otherwise. In general a loop of <em>B</em> bytes needs ⌈<em>B</em>/32⌉ blocks at best and one more if it straddles an extra boundary; aligning the loop head to a 32-byte boundary always gets the minimum (compilers do this with options like <code>-falign-loops=32</code>, padding with no-ops). Alignment stops mattering when the loop is fed from a decoded-uop cache or loop buffer instead of the fetch unit, or when the back end is slower than even the worst-case fetch rate (here, IPC below 2.5).</li>
</ol>`, "hard") +
M(`<p>A core has 6-wide dispatch, 8-wide retire, a 320-entry ROB, and unlimited execution ports. A loop iteration has 12 instructions: a load with an independent address, one instruction using the loaded value, one floating-point add on a loop-carried chain (4-cycle latency, one per iteration), and 9 independent single-cycle instructions. Every 4th iteration’s load misses in L2. Assume physical registers, the scheduler, and the load queue never fill before the ROB. (a) What is the IPC if those misses hit in L3 at 50 cycles? (b) If they go to DRAM at 400 cycles? (c) What ROB size would restore full speed with DRAM misses, and what else would have to grow? (d) How many MSHRs does each case need, and what happens with only 5?</p>`,
`<ol>
<li><strong>Bounds that don’t depend on memory:</strong> width: 12 / 6 = 2 cycles per iteration; recurrence: the FP add chain allows one iteration per 4 cycles. So IPC ≤ 12 / 4 = <strong>3</strong>.</li>
<li><strong>(a) L3, 50 cycles.</strong> By Little’s law the window must hold IPC × (time an instruction waits to retire). Instructions behind a miss wait about 50 cycles, so 3 × 50 = 150 entries < 320. The ROB isn’t the limit: IPC = <strong>3</strong>.</li>
<li><strong>(b) DRAM, 400 cycles.</strong> Now 3 × 400 = 1,200 entries would be needed, but only 320 exist, so the ROB limits: IPC ≈ 320 / 400 = <strong>0.8</strong>. More precisely, misses come every 48 instructions, and the window advances in whole miss-to-miss chunks: when a miss at the head returns, retirement runs up to the next miss, and dispatch can reach 7 misses (336 instructions) further. So about 336 instructions retire per 400 cycles: IPC ≈ <strong>0.84</strong>. A cycle-level simulation of this loop gives 0.83.</li>
<li><strong>(c)</strong> About 3 × 400 = <strong>1,200 ROB entries</strong> (simulation: IPC 2.99 at 1,200). Everything else must scale with it: about 1,200 / 12 = 100 loads in flight in the load queue, physical registers for roughly 1,000 destinations, and enough MSHRs (next part). The ROB alone would just move the limit.</li>
<li><strong>(d) MSHRs</strong> = misses in flight = (misses per cycle) × latency = (IPC / 48) × latency. (a): 3 / 48 × 50 ≈ 3.1, so 4. (b): about 7 (the 7 misses in the window). (c): 3 / 48 × 400 = <strong>25</strong>. With only 5 MSHRs in case (b), throughput = 5 misses per 400 cycles × 48 instructions per miss = <strong>0.6 IPC</strong>; with 16 MSHRs and a 1,200-entry ROB, 16 × 48 / 400 = <strong>1.92</strong>. Both match simulation (0.60 and 1.89).</li>
</ol>
<p>The pattern to remember: on memory-bound code, IPC ≈ min(window / latency, MSHRs × instructions-per-miss / latency, the compute bounds).</p>`, "hard") +
M(`<p>A front end delivers up to 8 uops per cycle from a uop cache and ends each fetch at a taken branch. There is a taken branch every 9 uops. 70% of taken branches are predicted by a small zero-bubble BTB; 30% need the main BTB, which adds a 3-cycle bubble. (a) How many uops per cycle does the front end deliver? (b) What if the main-BTB bubble were 1 cycle? (c) What if fetch were 16 uops wide? (d) Would a bigger uop queue between the front end and rename help?</p>`,
`<ol>
<li><strong>(a)</strong> The trap is granularity. A 9-uop block needs <strong>2</strong> fetch cycles (8, then 1), not 9/8 = 1.125, because fetch can’t continue past the taken branch into the next block. Expected bubble: 0.3 × 3 = 0.9 cycles. So 9 uops per 2.9 cycles = <strong>3.10 uops/cycle</strong>. The naive answer, 9 / (1.125 + 0.9) = 4.44, is 43% too high.</li>
<li><strong>(b)</strong> 2 + 0.3 = 2.3 cycles: <strong>3.91</strong>.</li>
<li><strong>(c)</strong> 1 + 0.9 = 1.9 cycles: <strong>4.74</strong>. Wider fetch helps here mainly because the 9-uop blocks now fit in one cycle.</li>
<li><strong>(d)</strong> No. A queue absorbs short-term bursts but can’t raise the <em>average</em> delivery rate. If the back end could consume 6 per cycle, the core is front-end bound at 3.1 no matter how big the queue is. The real fixes are fewer bubbles (bigger zero-bubble BTB, overriding predictors) and fetching past taken branches; some recent cores can follow more than one taken branch per cycle for exactly this reason.</li>
</ol>`, "hard") +
M(`<p>A front end has a uop cache that delivers 8 uops per cycle and legacy decoders that deliver 4 instructions (about 4.4 uops) per cycle. Switching from one to the other costs 2 cycles each way, and code that misses the uop cache comes in runs averaging 10 uops. Compute the delivered uops per cycle at an 80% and a 90% uop-cache hit rate (by uops). What fraction of front-end time is switching overhead at 80%, and what does that tell you about where to optimize?</p>`,
`<p>Per 100 uops:</p>
<ul>
<li><strong>80% hit:</strong><ul><li>80 / 8 = 10 cycles</li><li>20 / 4.4 = 4.55 cycles</li><li>20 / 10 = 2 legacy runs, each entered and left: 4 switches × 2 = 8 cycles</li></ul> Total 22.55 cycles: <strong>4.43 uops/cycle</strong>.</li>
<li><strong>90% hit:</strong><ul><li>90 / 8 = 11.25</li><li>10 / 4.4 = 2.27</li><li>1 run: 2 switches × 2 = 4</li></ul> Total 17.52: <strong>5.71 uops/cycle</strong>.</li>
</ul>
<p>At 80%, switching is 8 / 22.55 = <strong>35%</strong> of front-end time, more than the slow decoding itself (20%). Without the switch penalty, 80% would give 100 / 14.55 = 6.87 uops/cycle. So the lesson is that how <em>often</em> you fall out of the uop cache matters more than how slowly the legacy path decodes: longer runs, fewer transitions. Code layout that keeps hot code together (fewer, longer legacy runs) or a larger uop cache both attack the switch count.</p>`, "hard") +
M(`<p>The front end delivers 6 uops per cycle, except that an L1 instruction-cache miss every 500 uops stops delivery for 14 cycles (an L2 hit). A uop queue decouples the front end from rename. (a) If the back end averages 4 uops per cycle, how many queue entries hide the miss completely? (b) If the back end could average 5.5 uops per cycle, how big must the queue be?</p>`,
`<ol>
<li><strong>(a)</strong> During the 14-cycle gap the back end drains 14 × 4 = <strong>56 uops</strong>, so the queue needs 56 entries buffered. Check that it refills between misses: it refills at 6 − 4 = 2 uops per cycle, so 28 cycles, and misses come every 500 / 4 = 125 cycles. It refills in time, so 56 entries hide the misses completely.</li>
<li><strong>(b)</strong> Trap: no queue is big enough. The front end’s <em>average</em> rate is 500 uops per (500/6 + 14) = 97.3 cycles = <strong>5.14 uops/cycle</strong>, below the 5.5 the back end wants. Equivalently, each gap drains 77 uops and refilling at 0.5 per cycle would take 154 cycles, but the queue never fills, so the front end runs at full speed and the next miss arrives after 500 / 6 ≈ 83 cycles. The queue empties for good and the core runs at 5.14.</li>
</ol>
<p>General rule: a buffer hides variability only when the average supply exceeds the average demand. Size it from the burst (drain during the gap), then check the refill time against the gap interval.</p>`, "hard") +
M(`<p>Each instruction depends on the instruction immediately before it with probability 0.3 (independently), and on nothing else. Results are bypassed, so a dependent instruction can issue the cycle after its producer. An in-order core issues instructions in order each cycle and stops at the first instruction that depends on one issued in the same cycle. What is the expected IPC for 2-wide, 4-wide, and 8-wide issue? What limit does it approach, and what would an out-of-order core do?</p>`,
`<p>Each cycle starts fresh at the next instruction (its producer, if any, issued in an earlier cycle), so the number issued per cycle is a run of independent instructions: the cycle issues <em>k</em> &lt; <em>w</em> instructions with probability 0.7<sup><em>k</em>−1</sup> × 0.3, and <em>w</em> with probability 0.7<sup><em>w</em>−1</sup>.</p>
<ul>
<li><strong>2-wide:</strong> 1 × 0.3 + 2 × 0.7 = <strong>1.70</strong>.</li>
<li><strong>4-wide:</strong> 1 × 0.3 + 2 × 0.21 + 3 × 0.147 + 4 × 0.343 = <strong>2.53</strong>.</li>
<li><strong>8-wide:</strong> <strong>3.14</strong> (same formula).</li>
</ul>
<p>As width grows, this approaches the mean run length 1 / 0.3 = <strong>3.33</strong>: doubling width from 4 to 8 gains only 24%. An out-of-order core isn’t limited to consecutive instructions: here every dependence chain is short (the chance that a chain continues is only 0.3), so with a reasonable window it can find <em>w</em> ready instructions almost every cycle and get close to the full width. This is the classic argument for why wide in-order issue doesn’t pay.</p>`, "hard") +
M(`<p>An integer back end has 6 single-cycle ALUs. A result can be bypassed from either of the 2 pipeline stages after execution, before it is readable from the register file. (a) How many sources does each ALU input select from, and how many bypass paths are there in total? (b) Same for 4 ALUs. (c) Split the 6 ALUs into two clusters of 3 with full bypass inside a cluster and one extra cycle to cross (as the Alpha 21264 did). How many fast paths remain? (d) If dependent instructions land in different clusters half the time, how fast does a chain of dependent adds run, and how do designs avoid that?</p>`,
`<ol>
<li><strong>(a)</strong> Sources per input: 6 ALUs × 2 stages = 12 bypass values, plus the register file: a <strong>13-to-1 mux</strong> per input. Paths: 12 inputs (6 ALUs × 2 operands) × 12 sources = <strong>144</strong>.</li>
<li><strong>(b)</strong> 8 inputs × 8 sources = <strong>64</strong>. 1.5× the ALUs costs 2.25× the paths: the bypass network grows with the square of width, and the long wires are slow as well as large.</li>
<li><strong>(c)</strong> Per cluster: 6 inputs × 6 sources = 36; two clusters: <strong>72</strong> fast paths, half of the full network. Cross-cluster values arrive a cycle later.</li>
<li><strong>(d)</strong> Each dependence link costs 1 cycle half the time and 2 cycles the other half: 1.5 cycles on average, so a chain runs at 2/3 of its speed, a 33% loss for chain-bound code. Designs steer an instruction to the cluster of its producer (or its most critical producer) at dispatch, which recovers most of the loss but risks load imbalance between clusters, so steering heuristics balance both.</li>
</ol>`, "hard") +
M(`<p>A loop issues one integer divide every 20 instructions; apart from that, the core would run it at IPC 4. The divider has 14-cycle latency and is not pipelined. (a) Does the divider limit performance, and to what IPC? (b) How many dividers would it take to reach IPC 4? (c) Now divides are one per 80 instructions, so divider utilization is 0.7. Using the M/D/1 queueing formula W = ρ·S / (2(1 − ρ)), what is the average wait for the divider? Is that the right model for a loop?</p>`,
`<ol>
<li><strong>(a)</strong> Demand: 4 / 20 = 0.2 divides per cycle. Capacity: 1 / 14 = 0.071. Utilization would be 2.8, so the divider binds: one divide per 14 cycles means 20 instructions per 14 cycles, <strong>IPC 1.43</strong>.</li>
<li><strong>(b)</strong> Two dividers: 20 instructions per 7 cycles = 2.86, still bound. Three: capacity 3/14 = 0.214 ≥ 0.2, so <strong>3 dividers</strong> reach IPC 4, at 93% utilization. A pipelined divider (or a higher-radix one with a shorter initiation interval) is usually cheaper than three copies.</li>
<li><strong>(c)</strong> 4 / 80 = 0.05 divides per cycle × 14 = ρ = 0.7. W = 0.7 × 14 / (2 × 0.3) ≈ <strong>16.3 cycles</strong> average wait, plus 14 of service. But M/D/1 assumes random (Poisson) arrivals. In a loop the divides arrive like clockwork, one every 20 cycles, and a deterministic arrival stream with ρ &lt; 1 never queues at all: the wait is <strong>0</strong>. Queueing formulas are useful for irregular code (divides clustered by data-dependent control flow); for loops, think in terms of steady-state throughput. Either way, out-of-order execution hides the wait as long as enough independent work fits in the window: about (16 + 14) × 4 = 120 instructions here.</li>
</ol>`, "hard") +
M(`<p>Traversing a linked list: each node visit is one load of the next pointer (5-cycle L1 hit) plus 3 single-cycle instructions that use the node but don’t feed the next pointer. The core is 6-wide with 3 load ports. (a) What IPC does one list get? (b) If the program traverses <em>k</em> independent lists interleaved, how many does it take to reach full width? (c) Now the lists are in DRAM (400 cycles per node) and the core has 16 L1 miss buffers. What IPC do 8 lists get, and what is the most possible?</p>`,
`<ol>
<li><strong>(a)</strong> The loop-carried chain is the pointer load: 5 cycles per node, 4 instructions per node, so IPC = 4 / 5 = <strong>0.8</strong>, no matter how wide the core is.</li>
<li><strong>(b)</strong> <em>k</em> independent chains give 4<em>k</em> / 5 IPC until another limit binds. Width: 4<em>k</em> / 5 ≤ 6, so <em>k</em> = 7.5. Loads: <em>k</em> per 5 cycles ≤ 3 per cycle, so up to 15 lists. So <strong>8 lists</strong> reach the 6-wide limit (7 lists give 5.6).</li>
<li><strong>(c)</strong> Each list now yields 4 instructions per 400 cycles = 0.01 IPC. 8 lists: <strong>0.08</strong>. More lists help linearly until the 16 miss buffers fill: at most 16 × 0.01 = <strong>0.16 IPC</strong>. The ROB is not the limit (by Little’s law, 0.16 × 400 = 64 entries). Past that point only lower latency, prefetching (hard for pointers), or restructuring the data (arrays instead of lists) helps.</li>
</ol>`, "hard") +
M(`<p>Loads are 30% of instructions and hit in the L1 92% of the time. The scheduler issues load-dependent instructions assuming a hit; on a miss, an average of 2.4 dependents (direct and indirect) have already issued and must be cancelled and reissued. On a 6-wide issue machine running at IPC 2.5, what fraction of issue bandwidth is wasted? When would this matter?</p>`,
`<ol>
<li>Misses per 1,000 instructions: 1,000 × 0.30 × 0.08 = 24. Wasted issues: 24 × 2.4 = 57.6 per 1,000 instructions.</li>
<li>Cycles per 1,000 instructions: 1,000 / 2.5 = 400, so issue capacity is 400 × 6 = 2,400 slots. Waste: 57.6 / 2,400 = <strong>2.4% of capacity</strong>, or 57.6 / 1,057.6 = 5.4% of the issues actually performed.</li>
</ol>
<p>Usually negligible for performance. It matters when the core is port-bound (the wasted slots steal from useful work), for energy (every replay reads registers and toggles units), and when replays repeat: an instruction replayed again on an L2 miss or a bank conflict can multiply the waste. That is why cores add hit/miss predictors for loads that usually miss.</p>`, "medium") +
Q(`<p>You widen every stage of a 4-wide core to 8 wide (fetch, rename, issue, retire) and add the ports to match. SPECint IPC rises by about 20%, not 2×. List the limits that eat the rest, roughly in order of how much they cost on typical integer code.</p>`,
`<ol>
<li><strong>Branch mispredicts:</strong> with about 5 mispredicts per 1,000 instructions, the window refills from empty every 200 instructions. A wider machine reaches the next mispredict sooner but pays the same refill time each time, so more of its time is spent refilling.</li>
<li><strong>Taken branches in fetch:</strong> integer code has a taken branch every 6 to 10 instructions. A front end that follows one taken branch per cycle can’t deliver 8 instructions per cycle on average, whatever its byte width. That’s why Zen 5 predicts two taken branches per cycle.</li>
<li><strong>Dependence chains:</strong> short chains of 1-cycle operations limit how many instructions are ready each cycle. Width helps only if the window holds enough independent chains.</li>
<li><strong>Memory latency:</strong> misses stall retirement no matter the width. A wider core fills the ROB sooner and then waits just as long.</li>
<li><strong>Window size:</strong> if the ROB, scheduler, and registers weren’t scaled too, they fill faster at 8 wide and cap the lookahead.</li>
<li><strong>Port and bypass effects:</strong> more ports means more bypass paths. Designs often split them into clusters with an extra cycle between them, which adds latency to dependent pairs.</li>
</ol>
<p>The underlying point: width helps only the fraction of cycles where more than 4 instructions are ready and available. On integer code that fraction is small, so going wider pays off only together with a better predictor, a larger window, and a front end that handles several taken branches per cycle.</p>`, "hard") +
Q(`<p>Golden Cove allocates 6 uops per cycle but has 12 execution ports. Why would a designer build twice as many ports as the machine can sustain, when the extra ports sit idle most of the time?</p>`,
`<ul>
<li><strong>Ports are specialized.</strong> Of the 12, five are ALU ports, three are load ports, and four handle stores (two address, two data). A loop that is mostly loads can use only the three load ports. The question for each workload is whether its own mix has enough ports, not whether the total does.</li>
<li><strong>Bursts.</strong> When a miss returns, dozens of waiting instructions become ready at once. Sustained throughput is limited to 6, but draining a burst at up to 12 per cycle shortens the time the instructions after the miss are delayed. The scheduler empties faster and stalls less.</li>
<li><strong>Collisions.</strong> Uops are often bound to a port early. With exactly as many ports as uops per cycle, two ready uops on the same port lose a cycle. Extra ports make collisions rarer.</li>
<li><strong>Latency of specific operations.</strong> Separate store-data ports, or a dedicated branch port, keep those uops from taking an ALU slot that a dependent chain needs.</li>
<li><strong>Cost is moderate.</strong> An ALU is small. The expensive parts are register file read ports and the bypass network, and designers limit those by giving some ports fewer sources or by reading values from the bypass instead.</li>
</ul>
<p>So the port count is sized for the peak, and the allocation width for the sustained rate. Little’s law ties them together: average issue can’t exceed 6, but the extra ports keep the scheduler occupancy, and therefore the waiting time, low.</p>`, "hard") +
Q(`<p>A tight loop is 5 instructions ending in a taken branch, fully independent across iterations. The core is 8 wide, but its front end can follow only one taken branch per cycle. What limits IPC? How do a loop buffer, a uop cache, and a predictor that handles two taken branches per cycle each change the answer?</p>`,
`<p><strong>The limit:</strong> fetch stops at a taken branch, so each cycle delivers at most one iteration: 5 instructions. IPC is capped at 5 regardless of width, and lower if the 5 instructions straddle a fetch-block boundary.</p>
<ul>
<li><strong>Loop buffer</strong> (Intel’s loop stream detector, which on some cores is the allocation queue replaying the loop): it removes the fetch and decode stages from the loop, saves power, and on some designs can deliver uops from two iterations in one cycle, which raises the cap. On designs that still stop at the taken branch inside the buffer, it saves power but not bandwidth.</li>
<li><strong>Uop cache:</strong> it removes decode limits and alignment problems for x86, but a uop cache line still ends at a taken branch, so the one-taken-branch limit stays.</li>
<li><strong>Two taken branches per cycle</strong> (Zen 5 does this): two iterations per cycle, 10 instructions, so the 8-wide back end becomes the limit.</li>
<li><strong>Software:</strong> unrolling the loop by 2 makes the body 9 instructions and 1 taken branch, which helps every front end. It costs code size and can spill out of the uop cache.</li>
</ul>
<p>For a model: the taken-branch limit has to be modeled explicitly. A model that only counts bytes or instructions per cycle overestimates IPC on small loops, which are exactly the kernels that dominate many benchmarks.</p>`, "hard") +
`<h3 id="sec-stalls">Stalls, Flushes and Recovery</h3>` +
Q(`<p>Renaming removes false dependences and branch prediction hides control dependences. Give one structural, one data, and one control hazard that still costs cycles on a modern out-of-order core.</p>`,
`<ul>
<li><strong>Structural:</strong><ul><li>Two ready divides and one divider</li><li>Three ready loads and two load ports</li><li>A full ROB, scheduler, or load queue blocking allocation</li></ul></li>
<li><strong>Data:</strong> true read-after-write dependences through registers, which renaming can’t remove, and through memory: a load that needs a value from an older store whose address isn’t known yet.</li>
<li><strong>Control:</strong> branch mispredictions, plus indirect branches whose target is mispredicted, and taken branches that cost a fetch bubble when the target isn’t available in time.</li>
</ul>`, "easy") +
Q(`<p>A stall and a flush both lose cycles. Why does a single flush usually cost more than a short stall? Give a case where a stall costs far more than a flush. Use a core whose mispredict costs about 17 cycles and whose DRAM latency is 400 cycles, running a workload with 5 mispredicts and 1 non-overlapped DRAM miss per 1,000 instructions.</p>`,
`<p>A stall pauses: work already in flight is kept and resumes. A flush discards every instruction younger than the faulting point, so the core throws away completed work and must refill the pipeline from fetch, which costs the front-end depth plus the time to rebuild a full window of independent work.</p>
<p>But a stall can be much worse: a load at the ROB head missing to DRAM stalls retirement for 400 cycles, while a mispredicted branch that resolves quickly costs about 17. Which matters more depends on frequency: 5 mispredicts per 1,000 instructions lose 5 × 17 = 85 cycles per 1,000 instructions to flushes, while 1 DRAM miss per 1,000 instructions that isn’t overlapped loses 400.</p>`, "easy") +
Q(`<p>A load on a mispredicted path touches an unmapped address and would page-fault. What must the core do? What went wrong in Meltdown?</p>`,
`<p>Nothing visible. The fault is recorded in the load’s ROB entry and raised only if that instruction reaches the ROB head as the oldest instruction. Here the branch resolves first, the load is squashed, and the fault disappears with it. That’s what “precise exceptions” buys: architectural state looks as if instructions ran one at a time in order.</p>
<p>Meltdown: on some cores a load to a kernel address that would fault still returned data to dependent instructions transiently, before the fault was raised at retirement. Those instructions were squashed, but they had already touched cache lines indexed by the secret data, and the attacker recovered it by timing cache accesses. Architectural state was precise; microarchitectural state (the cache) wasn’t restored. Fixed cores don’t forward data from faulting loads.</p>`, "medium") +
Q(`<p>After a change to your model, IPC drops 8% across several benchmarks. How do you determine whether the regression came from the front end, the scheduler, the execution units, or retirement?</p>`,
`<ol>
<li><strong>Make it reproducible:</strong> same binaries, same simulation points, same warm-up; confirm the drop isn’t noise by checking that all simulation points move the same way.</li>
<li><strong>Slot accounting before and after:</strong> compare front-end bound, bad speculation, back-end bound, and retiring. The category that grew is where to look.</li>
<li><strong>Drill down:</strong> front end: fetch bubbles, i-cache or BTB misses, decode-queue empty cycles. Scheduler: queue-full stalls by queue, and cycles with ready-but-not-issued instructions. Execution: per-port utilization, divider busy. Retirement: cycles where the ROB head is complete but retirement bandwidth was exhausted (rare), versus head-not-complete cycles classified by the head instruction’s type.</li>
<li><strong>Find the instructions:</strong> diff per-PC stall counts between the two runs to find the code that got slower, then build a microbenchmark that isolates it.</li>
<li>Bisect the change itself if it bundled several modifications.</li>
</ol>`, "medium") +
M(`<p>Skylake is 4-wide. Over 10<sup>9</sup> cycles you measure, using the classic Top-Down event names: <code>UOPS_ISSUED.ANY</code> = 2.6 × 10<sup>9</sup>, <code>UOPS_RETIRED.RETIRE_SLOTS</code> = 2.2 × 10<sup>9</sup>, <code>INT_MISC.RECOVERY_CYCLES</code> = 5 × 10<sup>7</sup>, <code>IDQ_UOPS_NOT_DELIVERED.CORE</code> = 7 × 10<sup>8</sup>, and 2.0 × 10<sup>9</sup> instructions retired. (a) Compute the four top-level categories and the IPC. (b) Estimate the most that perfect branch prediction could speed this up, and explain why the real gain would be smaller. (c) What does the gap between uops and instructions tell you?</p>`,
`<ol>
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
</ol>`, "hard") +
Q(`<p>Skylake’s branch mispredict penalty is usually quoted as 15 to 20 cycles, and measured penalties on real code range much wider. Why isn’t the penalty a constant? List what makes it longer or shorter, and how a model should charge it.</p>`,
`<p>The penalty runs from fetching the branch until the correct path delivers useful work again. It has three parts, and only the first is fixed:</p>
<ul>
<li><strong>Refill:</strong> the cycles from redirect until correct-path instructions reach the scheduler. Shorter if they come from the uop cache, longer if they need the legacy decoders, longer still if the target misses in the instruction cache or BTB.</li>
<li><strong>Resolution time:</strong> how long the branch waits before it executes. If its condition depends on a load that misses in L1, resolution waits for the load. This is often the largest part, and it varies per branch.</li>
<li><strong>Lost overlap:</strong> squashed instructions that were independent of the branch, and might have issued a miss early, must be refetched. On the other hand, wrong-path loads can prefetch useful lines, which shortens later work.</li>
</ul>
<p>What makes the effective penalty small: a back end that is stalled anyway (a miss at the ROB head), because the refill overlaps the miss. What makes it large: a branch that depends on a long chain, or a mispredict that empties a full window of independent work.</p>
<p><strong>In a model:</strong> don’t charge a fixed number of cycles. Model the redirect at the cycle the branch executes, refill the front end through the real fetch path, and let the timing fall out. A fixed charge is fine only for a first-order analytical model, and then it should be calibrated per workload class.</p>`, "hard") +
Q(`<p>Besides branch mispredicts, Intel cores report “machine clears”: memory-ordering clears, self-modifying-code clears, and FP assists. What triggers each, why does one usually cost more than a mispredict, and how should a model represent them?</p>`,
`<ul>
<li><strong>Memory-ordering clear:</strong> a load executed early, and before it retired another core wrote that line (on x86, TSO requires loads to appear in order). Also triggered by a memory-dependence mispredict, where a load ran ahead of an older store to the same address.</li>
<li><strong>Self-modifying code:</strong> a store hits a line that is in the instruction pipeline. Every in-flight instruction that might be stale must be refetched.</li>
<li><strong>FP assist:</strong> an operation with a denormal input or output, or another rare case, is handed to microcode, which needs the pipeline flushed and restarted through the microcode sequencer.</li>
</ul>
<p><strong>Why a clear costs more:</strong> it is usually detected late, at or near retirement, not when the instruction executes. Everything younger is squashed, often a full window, and the restart comes from the instruction itself, so even the instruction that caused it re-executes. A clear also typically flushes from a point where no checkpoint exists, so recovery may use the slower retirement-map restore.</p>
<p><strong>In a model:</strong> model each as a flush at the offending instruction, triggered at the cycle it is detected (retire, or snoop arrival for ordering clears), with the real refetch path. Count them separately from mispredicts, because they have different fixes: false sharing or locking for ordering clears, code layout for self-modifying code, flush-to-zero or input fixes for FP assists. A model that ignores ordering clears looks optimistic on multithreaded code with contended lines.</p>`, "hard") +
Q(`<p>Queues sit between the pipeline stages: a fetch queue, the decode queue, the allocation queue. Retirement stalls for 300 cycles on a miss. How long until fetch stops, what do the queues buy you, and when do they buy nothing?</p>`,
`<p><strong>Back-pressure:</strong> retirement stops, so the ROB fills, then allocation stops, then the allocation queue fills, then decode stops, then the fetch queue fills, and fetch stops. Fetch keeps running for as long as it takes to fill everything behind it: roughly (ROB space left + queue entries) divided by fetch rate. On a Golden Cove-like core (512-entry ROB, 144-entry allocation queue, 6-wide allocation) whose ROB is half full when the miss reaches the head, that is about (256 + 144) / 6 ≈ 67 cycles, after which the front end is idle for the rest of the miss.</p>
<p><strong>What queues buy:</strong> they decouple stages whose rates <em>vary</em>. Fetch is bursty (taken branches, instruction cache misses), and so is allocation (stalls on full structures). A queue lets one side keep working while the other is briefly stalled, so throughput approaches the average rate of the slowest stage instead of its worst cycle. They also let the front end run ahead: when the miss returns, a full allocation queue feeds the back end immediately instead of waiting for fetch and decode latency.</p>
<p><strong>When they buy nothing:</strong></p>
<ul>
<li>When one stage is slower <em>on average</em>, the queue in front of it is always full and the one after it is always empty. Throughput is the slowest stage’s rate, whatever the queue sizes.</li>
<li>After a mispredict, everything in the queues is wrong-path and is flushed. Deep queues add nothing and can lengthen the refill if they add pipeline stages.</li>
</ul>
<p>Sizing rule: make a queue deep enough to cover the typical burst on either side, measured from occupancy histograms. Beyond that, extra entries cost area and power and add nothing.</p>`, "hard"),
},
{
  id: "intv-renaming",
  title: "Renaming and Dependences",
  body: `
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
M(`<p>An unrolled loop has 8 copies of this body, each with its own address, and every load misses to DRAM (400 cycles):</p>
<pre><code>ld  r1, [r5 + 8i]
add r2, r1, r6
st  r2, [r7 + 8i]</code></pre>
<p>Estimate the time for all 8 copies on (a) a CDC 6600-style scoreboard machine, which issues in order and stalls issue on a WAW hazard, with no renaming; (b) an out-of-order core with renaming and a large window. (c) How would a compiler rescue the scoreboard machine, and why isn’t that enough in general?</p>`,
`<ol>
<li><strong>(a) Scoreboard:</strong> copy 1’s <code>ld r1</code> has a WAW hazard with copy 0’s <code>ld r1</code>, which is still outstanding, so issue stalls, and in-order issue blocks everything behind it. Each copy’s load waits for the previous copy’s load to finish: about 8 × 400 = <strong>3,200 cycles</strong>. (A scoreboard also stalls a write on a WAR hazard, which would bite next if the registers were reused differently.)</li>
<li><strong>(b) Renaming:</strong> each <code>ld r1</code> gets a fresh physical register, so all 8 loads issue within a few cycles and their misses overlap: about 400 + a few cycles, roughly <strong>8× faster</strong> (given at least 8 miss buffers).</li>
<li><strong>(c)</strong> The compiler can allocate different registers to each copy (r1, r8, r9, …), which removes the WAW and lets the scoreboard overlap the misses too. But that needs 16 architectural registers for 8 copies instead of 2, it only works for code the compiler can see and unroll, and the compiler doesn’t know which loads will miss. Renaming does the same thing dynamically, for any code, with as many “registers” as the physical register file has.</li>
</ol>`, "hard") +
Q(`<p>On x86-64, <code>mov al, [rsi]</code> writes only the low 8 bits of <code>rax</code>, while <code>mov eax, [rsi]</code> zeroes the upper 32 bits. Why does the partial write create a dependence that renaming can’t simply remove? Describe three ways cores have handled it, and explain why the 64-bit ISA made 32-bit writes zero the upper half.</p>`,
`<p><strong>The dependence:</strong> after <code>mov al, [rsi]</code>, the full <code>rax</code> is the new low byte plus the old upper 56 bits. Whoever reads <code>rax</code> next needs both, so the new value depends on the old one. Renaming gives the write a new physical register, but that register is only partly filled.</p>
<ul>
<li><strong>Stall and merge late (P6 family):</strong> rename <code>al</code> separately. A later read of the full register stalls until the partial write retires, then reads the merged value. Fast for code that only uses <code>al</code>, painful (several cycles) for code that mixes widths.</li>
<li><strong>Insert a merge uop (Sandy Bridge and later for some cases):</strong> rename the partial register separately, and when the full register is read, insert an extra uop that combines the two physical registers. Costs one uop and possibly a cycle, but no stall.</li>
<li><strong>Don’t rename the partial register (Haswell and later for <code>al</code>):</strong> treat the write as a read-modify-write of the whole register. No merge, but every byte write now waits for the previous value of <code>rax</code>: a false dependence that can serialize a loop which only meant to write bytes.</li>
</ul>
<p><strong>Why 32-bit writes zero the upper half:</strong> if they merged, every 32-bit instruction (most integer code) would depend on the previous 64-bit value, and renaming would gain nothing. Zeroing makes the 32-bit write a full write. Arm64 made the same choice for <code>W</code> registers. Compilers avoid the remaining problem with <code>movzx</code> for byte loads, which writes the whole register.</p>`, "hard") +
Q(`<p>Renaming removes false dependences through registers, but not through memory. A loop spills a value to the stack and reloads it a few instructions later. What does that cost on a core without special support, and how can a core “rename” memory? What has to be checked for it to be safe?</p>`,
`<p><strong>The cost:</strong> the reload depends on the store through memory. At best it gets the data by store-to-load forwarding, which takes about 4 to 5 cycles on recent x86 cores, on top of the store’s own wait for its data. A register move would have cost 0 or 1 cycle. In a loop-carried chain, a spill and reload can double the time per iteration.</p>
<p><strong>Memory renaming:</strong> predict at rename that the load reads what a specific older store wrote, and connect the load’s destination to the physical register holding the store’s data, as if the load were a move. Dependents then wake up as soon as the store’s data is ready, without waiting for address generation or the forwarding path. AMD’s Zen 2 does this for some stack accesses, tracking accesses relative to <code>rsp</code> at decode, where the offset alone shows whether two accesses match.</p>
<p><strong>What must be checked:</strong></p>
<ul>
<li>The load’s real address and size must match the store’s. The load still executes, or at least computes its address, and compares, and a mismatch is handled like a memory-dependence mispredict: flush and replay from the load.</li>
<li>No other store, including one from another core, may have written the location in between. Intervening stores must be checked, and for other cores the load must still be ordered like a normal load.</li>
<li>Stack-pointer changes (calls, pushes, frame setup) must be tracked so the offset comparison stays valid.</li>
</ul>
<p>It is a prediction like any other: big gains on spill-heavy code (register-starved x86 loops, function prologues), and a flush when it is wrong.</p>`, "hard") +
Q(`<p>A load misses to DRAM and a long chain depends on its value. Value prediction would guess the value at rename and let the chain run. When can that work, what must the core do to recover, and why has it rarely shipped despite decades of papers?</p>`,
`<p><strong>When it can work:</strong> many loads return the same value as last time (constants, flags, loop-invariant pointers) or a value with a fixed stride. Predictors like last-value, stride, and context-based ones (VTAGE, using branch history) find these. Only high-confidence predictions are used, typically with accuracy above 99%, because a wrong one is expensive.</p>
<p><strong>What recovery needs:</strong></p>
<ul>
<li>The load still executes and its real value is compared with the prediction.</li>
<li>If they differ, every instruction that consumed the wrong value must be undone. The simple way is a flush from the instruction after the load, like a mispredict. Selective replay of only the dependents is cheaper in lost work but much harder to build.</li>
<li>Rename must write the predicted value into the physical register, which needs extra register-file write ports at rename, or a separate structure.</li>
</ul>
<p><strong>Why it rarely ships:</strong></p>
<ul>
<li>The loads worth predicting, ones that miss and feed a long chain, are often the least predictable ones (pointer chasing to new nodes).</li>
<li>The gain is modest on most suites, a few percent, while the hardware touches rename, the register file, and recovery, all timing-critical areas.</li>
<li>Memory consistency gets harder: a predicted value must still be consistent with what other cores wrote, so the comparison has to happen at the right point in the ordering rules.</li>
</ul>
<p>A restricted form does ship widely: zero idioms and move elimination are value “prediction” with 100% accuracy, decided by the instruction encoding alone.</p>`, "hard") +
`<h3 id="sec-mech">Rename Mechanics</h3>` +
Q(`<p>Rename the sequence from Q1. Initial map: r<em>n</em> → p<em>n</em> for every architectural register. Free list, in order: p32, p33, p34, p35. Give each renamed instruction, the final map, and the physical register each instruction frees when it commits. What happens to the next instruction that writes a register?</p>`,
`<ol>
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
`<ol>
<li><strong>I0:</strong> sources come from the table: r2→p2, r3→p3. Destination r1 gets p40; old mapping <strong>p1</strong> (from the table). <code>add p40, p2, p3</code></li>
<li><strong>I1:</strong> both sources are r1, which I0 writes in the same group, so both take <strong>p40</strong>, not the table’s p1. Destination r2 gets p41; old mapping p2. <code>sub p41, p40, p40</code></li>
<li><strong>I2:</strong> source r2 comes from I1 (<strong>p41</strong>); source r1 comes from I0 (<strong>p40</strong>). Destination r1 gets p42, and its old mapping is <strong>p40</strong>, I0’s new register, not the table’s p1. <code>mul p42, p41, p40</code></li>
<li><strong>I3:</strong> source r1 matches <em>both</em> I0 and I2; the priority mux picks the youngest older writer, I2: <strong>p42</strong>. Source r2 comes from I1: p41. Destination r3 gets p43; old mapping p3. <code>add p43, p42, p41</code></li>
</ol>
<p><strong>Table writes:</strong> r1 is written by I0 and I2, so only I2’s mapping is written. Final table: r1→<strong>p42</strong>, r2→p41, r3→p43. p40 never appears in the table, yet it is live: I1 and I2 read it, and it is freed when I2 commits. At commit, I0 frees p1, I1 frees p2, I2 frees p40, I3 frees p3.</p>
<p><strong>Comparisons:</strong> sources: slot <em>k</em> compares its 2 sources against <em>k</em> older destinations: 2 × (0 + 1 + 2 + 3) = 12. Destinations: slot <em>k</em> compares against <em>k</em> older destinations: 0 + 1 + 2 + 3 = 6. Total <strong>18</strong>.</p><p>Matches:</p><ul><li>I1’s two sources vs. I0 (2)</li><li>I2’s r2 vs. I1 and r1 vs. I0 (2)</li><li>I3’s r1 vs. I0 and I2, and r2 vs. I1 (3)</li><li>I2’s destination vs. I0’s (1)</li></ul><p>That’s 8 matches. The classic bug: giving I3 the I0 match because it was found first.</p>`, "hard") +
M(`<p>Generalize the 4-wide rename-group question in the Conceptual tab to <em>n</em>-wide rename where every instruction has two sources and one destination. (a) How many intra-group comparators are needed for <em>n</em> = 4, 6, and 8? (b) How many map-table ports? (c) If the area of a multiported array grows with the square of its port count, how much bigger is the 6-wide and the 8-wide map table than the 4-wide one, for the same number of entries? (d) Name two ways designers avoid paying this.</p>`,
`<ol>
<li><strong>(a) Comparators.</strong> Sources: slot <em>k</em> has 2 sources × <em>k</em> older destinations, summed over <em>k</em> = 0 … <em>n</em>−1: 2 · <em>n</em>(<em>n</em>−1)/2 = <em>n</em>(<em>n</em>−1). Destinations: <em>n</em>(<em>n</em>−1)/2. Total <strong>3<em>n</em>(<em>n</em>−1)/2</strong>: <strong>18</strong> for 4-wide, <strong>45</strong> for 6-wide, <strong>84</strong> for 8-wide. Each compares two architectural register numbers (4 bits for 16 registers, 5 for 32). Going from 4 to 8 wide multiplies the comparators by 84 / 18 ≈ 4.7.</li>
<li><strong>(b) Ports:</strong> 3<em>n</em> reads + <em>n</em> writes = 4<em>n</em>: 16, 24, and 32 ports.</li>
<li><strong>(c) Area:</strong> (24 / 16)² = <strong>2.25×</strong> for 6-wide, (32 / 16)² = <strong>4×</strong> for 8-wide. Access time also grows, because longer wordlines and bitlines are slower, and rename is often a timing-critical stage.</li>
<li><strong>(d) Ways around it:</strong><ul><li>Rename in two half-groups across two pipeline stages or two clock phases (costing latency, which lengthens the mispredict penalty)</li><li>Replicate the table (duplicate copies each serving a subset of read ports, all receiving every write)</li><li>Handle some instructions without full rename-table reads (moves and zero idioms, or instructions without destinations, which need no old-mapping read)</li><li>Use a CAM-style table with one entry per <em>physical</em> register, as the Alpha 21264 did, which changes the trade-off</li></ul> Each of these is a real interview follow-up.</li>
</ol>`, "hard") +
Q(`<p>x86 <code>inc</code> writes every arithmetic flag except the carry flag. Why does that create a dependence problem for renaming, and how do cores avoid it? Then answer the same question for writing <code>al</code> and later reading <code>rax</code>, and explain why writing <code>eax</code> doesn’t have the problem.</p>`,
`<p><strong>Flags:</strong> if all flags are renamed as one unit, <code>inc</code> has to produce a complete flags value: its own ZF, SF, OF, and so on, plus the <em>old</em> carry flag. So it must read the previous flags producer, a false dependence that can serialize <code>inc</code> behind an unrelated long-latency instruction. Cores rename flags in groups, with the carry flag separate from the rest, so <code>inc</code> writes only its group. A later instruction that reads flags from both groups (for example <code>ja</code>, which tests CF and ZF) then needs both sources, handled with a merge uop or a second source operand.</p>
<p><strong>Partial registers:</strong> writing <code>al</code> leaves bits 8–63 of <code>rax</code> unchanged. Either <code>al</code> is renamed separately and a later read of <code>rax</code> needs a merge (older Intel cores stalled for several cycles; newer ones insert a merge uop), or the write to <code>al</code> is treated as a read-modify-write of <code>rax</code>, which adds a dependence on the old value.</p>
<p><strong>Why <code>eax</code> is fine:</strong> x86-64 defines that writing a 32-bit register zero-extends into the full 64-bit register, so the write fully defines <code>rax</code> and needs no old value. That rule was chosen precisely to avoid this dependence; 8- and 16-bit writes kept the old behavior for compatibility.</p>`, "medium") +
M(`<p>A 6-wide rename stage can take at most 4 registers from the free list per cycle. Each instruction needs a destination register with probability 0.7, independently. Rename handles instructions in order and stops at the first one that would need a fifth register. (a) Give a quick upper bound on throughput. (b) A colleague computes the expected number renamed per cycle for a fresh group of 6 random instructions and gets 5.41. Why is the true steady-state rate lower, and what is it?</p>`,
`<ol>
<li><strong>(a)</strong> Registers needed: 0.7 per instruction; supplied: at most 4 per cycle. So throughput ≤ 4 / 0.7 = <strong>5.71</strong>, and ≤ 6 from the width.</li>
<li><strong>(b)</strong> The instruction that ends a group early is, by construction, one that needs a register. So the next cycle does <em>not</em> start with a random instruction; it starts with one known to need a register, and such cycles average only 5.23. A two-state Markov chain (does this cycle start with a known register writer or not?) gives a stationary probability of 0.47 for the “known writer” state, so the steady-state rate is 0.53 × 5.41 + 0.47 × 5.23 ≈ <strong>5.33</strong>. A direct simulation of 2 million random instructions agrees (5.33).</li>
</ol>
<p>The general lesson: when a stall condition is caused by the next item, that item carries into the next cycle, and treating cycles as independent overestimates throughput. Here the 4-register limit costs about 11% of rename bandwidth.</p>`, "hard") +
Q(`<p>Older designs (P6, the Pentium Pro family) kept speculative results in the ROB and copied them into a separate architectural register file at retirement. Modern cores use one merged physical register file and only update a map at retirement. Compare the two at retirement, at mispredict recovery, and in register-file ports and area.</p>`,
`<p><strong>ROB plus architectural file (P6 style):</strong></p>
<ul>
<li>Retirement copies each result from the ROB into the architectural file: data movement and write ports on every retired instruction.</li>
<li>Recovery is simple: the architectural file is always correct, so discard the ROB and point every register back at it.</li>
<li>A source operand may be in the ROB or in the architectural file, so reads need both, and the ROB must be a multi-ported register file sized for every in-flight instruction, including those (stores, branches) that write no register.</li>
<li>A value is written twice: once into the ROB, once at retirement.</li>
</ul>
<p><strong>Merged physical register file (MIPS R10000, Alpha 21264, every big core today):</strong></p>
<ul>
<li>Retirement moves no data: it updates the retirement map and frees the previous physical register.</li>
<li>Recovery needs the rename map restored to the branch’s point: checkpoints, a ROB walk, or a copy of the retirement map.</li>
<li>Only instructions that write a register use an entry, so the register file can be smaller than the ROB. With SIMD registers of 256 or 512 bits, not storing them in the ROB saves a lot of area.</li>
<li>Freeing registers needs more care: the previous mapping is freed only when the overwriting instruction retires.</li>
</ul>
<p>The switch happened because wider and wider retirement made the copy expensive, and large vector registers made a value-holding ROB enormous. The merged file moved complexity from data paths into control (maps and free lists), which scales better.</p>`, "hard") +
Q(`<p>Two SMT threads share one rename stage and one physical register file. What has to be replicated per thread, what can be shared, and what goes wrong when one thread stalls on a DRAM miss while holding many physical registers?</p>`,
`<p><strong>Per thread:</strong> the speculative rename map, the retirement map, the branch checkpoints (they snapshot one thread’s map), and the return-address stack and global history on the prediction side. Both threads use architectural register r1, but they mean different values, so their maps must be separate.</p>
<p><strong>Shared:</strong> the physical register file and its free list. Physical register names are global, so one free list serves both threads, and any free register can go to either.</p>
<p><strong>The problem:</strong> a thread that misses to DRAM keeps renaming until something fills. Every instruction behind the miss holds a physical register until it retires, and none can retire until the miss returns. If nothing limits it, that thread takes most of the free list, and the other thread, which could be making progress, stalls at rename for lack of registers. Total throughput falls below what the second thread would get alone.</p>
<p><strong>Fixes:</strong></p>
<ul>
<li>Cap each thread at a share of the registers (static partitioning or a high-water mark), at the cost of some peak single-thread performance.</li>
<li>Fetch policies such as ICOUNT, which favor the thread with fewer instructions in flight, so a stalled thread naturally gets fewer new instructions.</li>
<li>Stall or flush a thread that has a long-latency miss at its ROB head, freeing its registers for the other thread and refetching later.</li>
</ul>
<p>In a model, check per-thread register occupancy over time. A thread holding most of the file while making no progress is the signature of this problem.</p>`, "hard") +
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
`<ol>
<li><strong>Explicit state per register:</strong> keep an enum per physical register (FREE, SPECULATIVE, COMMITTED) and assert on every transition: allocate only from FREE, free only from a state that allows it. A double free trips the assert immediately at the bad call site.</li>
<li><strong>Conservation invariant every cycle (debug builds):</strong> free-list size + registers mapped by the committed map + destinations of in-flight instructions = total registers, with every register counted exactly once.</li>
<li><strong>Drain check:</strong> after a full pipeline flush or at the end of simulation, the free list must hold exactly total − architectural registers.</li>
<li><strong>Symptom check:</strong> a leak shows up as a free list that shrinks over simulated time, rename stalls that rise with run length, and eventually a deadlock. Plot free-list occupancy over time.</li>
</ol>
<p>Typical culprits: forgetting to return the destinations of squashed instructions, or returning them twice when two flushes overlap.</p>`, "medium") +
Q(`<p>A branch near the ROB head mispredicts with 300 younger instructions in flight. Your model restores the rename map by walking the ROB backward and undoing mappings, 8 per cycle, while the front end takes 15 cycles to refill. What does recovery cost, and how do checkpoints change that? What limits checkpoints?</p>`,
`<p>Walking 300 entries at 8 per cycle takes about 38 cycles before rename can resume on the correct path. The first 15 overlap the front-end refill, but the remaining 23 or so add directly to the misprediction penalty, and it is worst exactly when the window is full.</p>
<p><strong>Checkpoints</strong> copy the whole map table at each branch at rename time; recovery is a single-cycle copy back. The squashed instructions’ physical registers must still be returned, but with a circular free list that’s just restoring the head pointer saved with the checkpoint.</p>
<p>Limits: each checkpoint is a full copy of the table, so there are only a handful. When they run out, rename stalls at the next branch, or the design falls back to a walk. Common compromises: checkpoint only low-confidence branches, or rebuild from the committed map plus a forward walk. Being able to model all three lets you measure the penalty difference instead of guessing.</p>`, "medium") +
M(`<p>A core checkpoints the rename map at every branch and has 8 checkpoints. A checkpoint is freed when its branch <em>resolves</em> (not when it commits). One instruction in 6 is a branch, and branches resolve on average 20 cycles after rename, but a branch that depends on a load missing to DRAM waits for its 400-cycle latency. (a) What is the highest sustainable IPC before rename starts stalling for checkpoints? (b) The core is meant to sustain IPC 4. How many checkpoints does it need? (c) A designer proposes checkpointing only low-confidence branches, which are 10% of branches but cause 80% of mispredicts. What happens to the checkpoint requirement, and what does it cost?</p>`,
`<ol>
<li><strong>(a) Little’s law:</strong> unresolved branches in flight = branch rate × time to resolve = (IPC / 6) × 20 = 3.33 × IPC. With 8 checkpoints, 3.33 × IPC ≤ 8, so <strong>IPC ≤ 2.4</strong>. Above that, rename stalls whenever a ninth branch arrives.</li>
<li><strong>(b)</strong> At IPC 4: (4 / 6) × 20 ≈ <strong>13.3</strong> branches in flight on average, so at least 14 checkpoints, and in practice more, because Little’s law gives the <em>average</em>. A branch that depends on a load missing to DRAM holds its checkpoint for over 400 cycles, and a few of those at once eat most of the pool. Size for the tail, not the mean.</li>
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
`<ol>
<li><strong>Renaming:</strong> I0: r1→p10 (old p1). Checkpoint at I1: map {r1: p10, r2: p2, r3: p3}, head at p11. I2: r2→p11 (old p2). I3: r1→p12 (old p10). I4: r1→p13 (old p12).</li>
<li><strong>(a)</strong> Map: r1→<strong>p13</strong>, r2→p11, r3→p3. I0’s commit freed p1 (its old mapping), appended at the tail, so the free list is p14, p1.</li>
<li><strong>(b)</strong> Copy the checkpoint: r1→p10, r2→p2, r3→p3. Restore the head to where p11 was: the free list is now p11, p12, p13, p14, p1. The squashed registers are back, and p1, freed after the checkpoint, is kept.</li>
<li><strong>(c)</strong> Walk <strong>youngest first</strong>: undo I4 (r1←p12, free p13), I3 (r1←p10, free p12), I2 (r2←p2, free p11). Result: r1→p10, r2→p2, r3→p3, correct. Oldest first goes wrong because r1 was written twice in the squashed region: I2 (r2←p2), I3 (r1←p10), then I4 sets r1←<strong>p12</strong>, a register that belonged to a squashed instruction and is also being returned to the free list. r1 would end up pointing at a free register, which corrupts it as soon as p12 is reallocated.</li>
<li><strong>(d)</strong> I5 reads r1→p10 and r2→p2; r3 gets the head of the free list, <strong>p11</strong>, with old mapping p3: <code>sub p11, p10, p2</code>.</li>
</ol>`, "hard") +
M(`<p>Recovery walks the ROB at 8 entries per cycle, overlapped with the 15-cycle front-end refill, so it costs extra only when the walk takes longer than 15 cycles. At a mispredict, the number of younger instructions to undo is uniformly distributed from 0 to 300 (mean 150). (a) A colleague estimates the extra cost from the mean. What do they get? (b) What is the true average extra cost? (c) At 5 mispredicts per 1,000 instructions and IPC 3, how much time does this add?</p>`,
`<ol>
<li><strong>(a)</strong> Mean walk: 150 / 8 = 18.75 cycles, so extra = 18.75 − 15 = <strong>3.75 cycles</strong> per mispredict.</li>
<li><strong>(b)</strong> The walk time X = N/8 is uniform on 0 to 37.5 cycles, and the extra cost is max(0, X − 15). Its average is (1 / 37.5) ∫ from 15 to 37.5 of (x − 15) dx = 22.5² / (2 × 37.5) = <strong>6.75 cycles</strong>, 1.8× the estimate. The cost function is convex (zero below 15, linear above), so by Jensen’s inequality the average of the cost is larger than the cost of the average: long walks cost a lot and short walks don’t give anything back.</li>
<li><strong>(c)</strong> 5 × 6.75 = 33.75 extra cycles per 1,000 instructions, against 1,000 / 3 = 333 base cycles: about <strong>10% more time</strong>. That’s a strong case for checkpoints, at least on low-confidence branches.</li>
</ol>
<p>Whenever a cost has a threshold (a buffer that overflows, a walk that outlasts a refill, a queue that fills), compute it over the distribution, not from the mean.</p>`, "hard") +
Q(`<p>Many cores recover from a branch mispredict at execute using rename checkpoints, but recover from an exception or interrupt at retirement by copying the retirement map. Why use two different mechanisms instead of one?</p>`,
`<p><strong>Branches are frequent and their timing matters.</strong> At several mispredicts per 1,000 instructions, recovery time is a direct cost. Checkpoints taken at rename let the core restore the map in a cycle or two the moment the branch resolves, without waiting for it to reach the head of the ROB. They are worth their area because they are used constantly.</p>
<p><strong>Exceptions are rare and must be precise.</strong> A page fault or interrupt happens maybe once per millions of instructions, and the handler that follows costs thousands of cycles anyway. Recovering at retirement is easy to get right: every older instruction has committed, the retirement map is exactly the architectural state, and copying it to the speculative map (and freeing everything younger) is correct by construction. Spending checkpoints on every instruction that might fault (every load, store, and FP operation) would need far more checkpoints than any design can afford.</p>
<p><strong>Other events land on one side or the other by the same logic:</strong></p>
<ul>
<li>Memory-ordering violations and memory-dependence mispredicts are fairly frequent but don’t align with checkpoints, so cores often recover from the load by a ROB walk or wait until it is at the head.</li>
<li>Branches that run out of checkpoints (more unresolved branches than checkpoints) fall back to a walk or to retire-time recovery.</li>
</ul>
<p>The general rule: frequent events get fast, specialized recovery, rare events get the simplest correct one.</p>`, "hard") +
Q(`<p>The core has 8 rename checkpoints. Branch B2 mispredicts and recovers, and before the correct path has renamed more than a few instructions, an older branch B1 also resolves as mispredicted. What must happen to the checkpoints of the branches between B1 and B2, and to B2’s? What goes wrong in a model that frees checkpoints only at retirement?</p>`,
`<p><strong>At B2’s recovery:</strong> restore B2’s checkpoint, and free every checkpoint taken after B2: those branches were on B2’s wrong path. Checkpoints of branches older than B2 stay, because those branches are still unresolved.</p>
<p><strong>At B1’s recovery:</strong> B1 is older, so everything after it is wrong path, including B2 and the few correct-path instructions renamed after B2’s recovery. Restore B1’s checkpoint and free every checkpoint taken after B1: the branches between B1 and B2, B2’s own checkpoint, and any checkpoints taken on the path after B2’s recovery. B2’s recovery turns out to have been wasted work, but it was still the right thing to do at the time, since the core couldn’t know B1 would mispredict.</p>
<p>The implementation is usually a circular buffer of checkpoints in age order, so “free everything younger than X” is just resetting the tail pointer to X. That is the same reason the free list is a FIFO.</p>
<p><strong>The bug if checkpoints are freed only at retirement:</strong> squashed branches never retire, so their checkpoints are never freed. The pool slowly drains, and rename stalls on “no free checkpoint” more and more often, a performance bug that looks like a branch-heavy code problem rather than a leak. The check that catches it: at any cycle, the number of allocated checkpoints must equal the number of unresolved branches in the ROB that hold one.</p>`, "hard") +
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
M(`<p>A core with 32 architectural integer and 32 architectural vector registers has 280 integer and 332 vector physical registers and a 512-entry ROB. In a hot loop, 55% of instructions write an integer register, 20% write a vector register, and 25% write no register. (a) How many instructions can be in flight, and which structure limits it? (b) How many integer physical registers would make the ROB the limit? (c) A colleague says a physical register is held until its last reader has read it, so you need extra registers on top of your answer. Is that right?</p>`,
`<ol>
<li><strong>(a)</strong> Physical registers in use = committed mappings (one per architectural register, always) + one per in-flight instruction with a destination. Integer: (280 − 32) / 0.55 = 248 / 0.55 ≈ <strong>451</strong> instructions. Vector: (332 − 32) / 0.20 = <strong>1,500</strong>. ROB: 512. The integer register file limits the window to about <strong>451</strong>, so 61 ROB entries are never used in this loop.</li>
<li><strong>(b)</strong> 32 + 0.55 × 512 = 313.6, so <strong>314</strong> integer registers. (A phase where every instruction writes an integer register would need 32 + 512 = 544, which is why designers size for typical mixes and accept stalls in dense phases.)</li>
<li><strong>(c) No.</strong> With free-at-commit, a register is held from rename of its producer until the <em>next writer</em> of the same architectural register commits. At any instant, every register in use is either a committed mapping (32 of them) or the destination of an in-flight instruction, so the formula above is exact; when the producer commits, its register becomes the committed mapping and the previous one is freed, keeping the count. Readers never extend the lifetime beyond this, because all readers of a value are older than the next writer and commit before it. Two things do change the count: early-release schemes free registers sooner (lowering it), and move elimination (next question) lets two architectural registers share one physical register, which breaks this simple accounting.</li>
</ol>`, "hard") +
M(`<p>A loop has 12 instructions per iteration on a 6-wide core. Its loop-carried chain is <code>add r3, r1, r4</code> → <code>mov r1, r3</code> → <code>add r5, r1, r6</code> → <code>mov r1, r5</code> (then back to the first add in the next iteration). All other instructions are independent, and adds and moves take 1 cycle when executed. (a) What IPC does the loop reach without move elimination, and with it? (b) Move elimination breaks the rule that a physical register is freed when the next writer of its architectural register commits. Show how, and what hardware fixes it.</p>`,
`<ol>
<li><strong>(a) Without elimination:</strong> the chain is 4 operations of 1 cycle = 4 cycles per iteration, so IPC = 12 / 4 = <strong>3</strong>. <strong>With elimination:</strong> each <code>mov</code> is done at rename by pointing r1 at the source’s physical register, with zero latency, so the chain is 2 cycles. But the width bound is also 12 / 6 = 2 cycles, because the eliminated moves still use rename slots and ROB entries. So IPC = 12 / max(2, 2) = <strong>6</strong>, a 2× speedup, now limited by width rather than the chain.</li>
<li><strong>(b)</strong> After <code>mov r1, r3</code> is eliminated, r1 and r3 both map to the same physical register, say p50. Later, when an instruction that overwrites r3 commits, the normal rule frees r3’s old register, p50, but r1 still maps to it. If p50 is reallocated, r1 is silently corrupted.</li>
</ol>
<p>The fix is a <strong>reference count</strong> per physical register (or a small table tracking registers with multiple mappings): elimination increments it, each commit of an overwriting instruction decrements it, and the register is freed only at zero. Recovery must also restore the counts for squashed eliminations. Because this tracking hardware is limited, real cores eliminate only some moves: when it is full, the move simply executes on an ALU. That variability is why microbenchmarks of move latency on recent cores sometimes show a mix of 0 and 1 cycles.</p>`, "hard") +
M(`<p>A 6-wide issue stage reads source operands from the physical register file. After bypassing, each issued instruction needs 0, 1, or 2 register-file reads with probability 0.30, 0.45, and 0.25, independently. (a) How many reads per cycle are needed on average at full issue? (b) The design has only 8 read ports instead of 12. In what fraction of full-issue cycles is that not enough? With 10 ports? (c) What happens in those cycles, and roughly what do the fewer ports save?</p>`,
`<ol>
<li><strong>(a)</strong> 0 × 0.30 + 1 × 0.45 + 2 × 0.25 = 0.95 reads per instruction, so <strong>5.7</strong> per cycle at 6-wide issue, under half of the 12 worst-case reads.</li>
<li><strong>(b)</strong> The total reads for 6 instructions is a sum of 6 independent variables; convolving the distribution gives P(more than 8) = <strong>6.1%</strong> and P(more than 10) = <strong>0.29%</strong>. (For comparison, P(more than 6) is 33%, so 6 ports would be too few.)</li>
<li><strong>(c)</strong> In an over-subscribed cycle, port arbitration lets the oldest instructions through and holds (or replays) the rest for a cycle, losing at least one issue slot. Since full-issue cycles are themselves a minority at typical IPC 2–3, the overall loss with 8 ports is usually well under 1%. The savings: with 6 write ports, the file goes from 18 to 14 ports, and since area grows roughly with ports², it shrinks to about (14 / 18)² ≈ 60%, with shorter access time too. This is why real register files have fewer read ports than 2 × issue width.</li>
</ol>`, "hard") +
M(`<p>A Golden Cove-like core has 280 integer physical registers and a 512-entry ROB; x86-64 has 16 architectural integer registers per thread. In a phase where 60% of instructions write an integer register: (a) how many instructions can be in flight with one thread, and what limits it? (b) With two SMT threads, each statically given half the ROB, what limits each thread now? (Ignore flags and microcode temporaries.)</p>`,
`<ol>
<li><strong>(a)</strong> Registers in use = committed mappings + in-flight destinations. (280 − 16) / 0.6 = <strong>440</strong> instructions, fewer than the 512 ROB entries, so the register file binds.</li>
<li><strong>(b)</strong> Each thread needs its own committed mappings: 2 × 16 = 32. In-flight capacity: (280 − 32) / 0.6 ≈ <strong>413</strong> instructions total, about 207 per thread if they share evenly, below each thread’s 256-entry ROB share. So under SMT the register file still binds, and more tightly per thread. A larger ROB partition would do nothing for either thread.</li>
</ol>
<p>The broader point: when you evaluate a structure size for an SMT core, recompute every other structure’s limit per thread. Fixed per-thread costs (architectural state) come out of the shared pool before any of it is available for the window.</p>`, "hard") +
Q(`<p>For the next core you can afford either 32 more integer physical registers or 32 more vector registers (512-bit). How do you decide? Why is each vector register so much more expensive, and why does the answer depend on the workload mix more than for almost any other structure?</p>`,
`<p><strong>Cost:</strong> a 512-bit register is 8 times the bits of a 64-bit one, and the vector file has many read ports (an FMA needs 3 sources) on wide data paths. 32 vector registers cost roughly as much area and read energy as a few hundred integer ones. The vector file is also often on the critical timing path of the FP pipeline, so adding entries can add a cycle of latency.</p>
<p><strong>Who benefits:</strong></p>
<ul>
<li>Integer registers limit the window on almost all code, since most instructions write an integer register. Extra ones help any workload that stalls on a full integer free list: pointer-heavy server code, compilers, interpreters.</li>
<li>Vector registers limit only code that keeps many vector instructions in flight: HPC kernels, media, and ML inference on the CPU, especially when vector loads miss and the window must hold many results waiting to be consumed.</li>
</ul>
<p><strong>How to decide:</strong> sweep both in the model on the product’s target suites, and measure allocation stalls per register class during the phases that matter. Weight each suite by the product’s market: a server core runs mostly integer code, a workstation or HPC part runs more vector code. Also check the per-class stall histograms, since a register class that is the limit only in short bursts may not justify the area.</p>
<p>Golden Cove’s 280 integer and 332 vector registers show the choice Intel made for a core expected to run vector code at full width. Cores aimed at mostly integer markets have kept vector files relatively smaller.</p>`, "hard") +
Q(`<p>Widening rename from 6 to 8 also means more instructions read the physical register file each cycle. Why does the register file’s port count become a timing and area problem, and what do designs do to need fewer read ports than “2 per instruction times issue width”?</p>`,
`<p><strong>The problem:</strong> each read port adds a wordline and a bitline to every cell, so the cell area grows roughly with the square of the port count, and access time grows with it. An 8-wide issue with up to 3 sources per uop would need about 24 read ports on a file of several hundred entries, which no design can afford at full speed.</p>
<p><strong>Ways around it:</strong></p>
<ul>
<li><strong>Read from the bypass:</strong> a source produced in the last few cycles comes from the bypass network, not the file. A large share of operands are read this way, so the file can have fewer ports than the worst case, plus an arbiter that delays the occasional uop that needs more.</li>
<li><strong>Fewer ports per execution unit:</strong> not every port needs 3 sources. Store data, branches, and simple ALUs need fewer.</li>
<li><strong>Banking:</strong> split the file into banks with fewer ports each, and stall or replay on a bank conflict. Works if conflicts are rare and the bank choice spreads registers evenly.</li>
<li><strong>Replication:</strong> two copies of the file, each feeding half the execution units (the Alpha 21264 did this for its integer clusters). Doubles the write cost and adds a cycle to cross between copies.</li>
<li><strong>Register caching:</strong> a small, fast cache of recently written registers in front of a larger, slower file.</li>
</ul>
<p>In a model, register-file read port limits are often left out. That is fine when the design reads mostly from the bypass, and wrong on code with many long-lived values (loop-invariant constants read every iteration), which always come from the file.</p>`, "hard") +
Q(`<p>Rename stalls on a workload even though the ROB is half empty and plenty of physical registers are free. Give four resources other than the ROB and register file that rename must allocate, the kind of code that runs out of each, and the statistic that shows it.</p>`,
`<ul>
<li><strong>Load queue or store queue entries:</strong> allocated at rename and held until retirement (loads) or until the store is written to the cache (stores). Memcpy-like or store-heavy code, especially when stores miss and the store queue drains slowly. Shown by allocation stalls with “store queue full” or “load queue full” as the reason.</li>
<li><strong>Scheduler entries:</strong> held until issue. Code whose instructions wait a long time for operands, typically dependents of a miss sitting in a full scheduler. Shown by scheduler occupancy pinned at its limit while the ROB isn’t full.</li>
<li><strong>Branch checkpoints:</strong> one per unresolved branch on designs that checkpoint every branch. Branch-dense code (a branch every 4 or 5 instructions) whose branches depend on slow loads, so many stay unresolved. Shown by stalls on “no free checkpoint” and the count of unresolved branches.</li>
<li><strong>Flag or condition registers:</strong> on designs that rename flags separately, x86 code where almost every instruction writes flags can exhaust them before integer registers. Shown by stalls on that free list.</li>
<li><strong>Allocation-group restrictions:</strong> some designs can allocate only a limited number of one kind per cycle (for example, at most 2 or 3 loads or 1 or 2 stores). Code dense in that kind stalls even with space everywhere. Shown by rename slots lost while the queue ahead holds instructions.</li>
</ul>
<p>The general method: record the reason for every rename stall cycle, choosing the first resource that blocked the oldest instruction in the rename group, and sum by reason. A total of “rename stalled” without reasons hides all of these.</p>`, "hard"),
},
{
  id: "intv-rob",
  title: "The ROB and Retirement",
  body: `
<p>Background: <a href="#/rob">Reorder Buffer</a>, <a href="#/rob-sizing">Sizing the Reorder Buffer</a>, <a href="#/latency-tolerance">Memory Latency Tolerance</a>.</p>
<h3 id="sec-basics">Why the ROB Exists</h3>` +
Q(`<p>Tomasulo’s algorithm already executes instructions out of order with reservation stations. What two problems does adding a reorder buffer solve that Tomasulo alone can’t?</p>`,
`<ol>
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
Q(`<p>Checkpoint-based designs (Checkpoint Processing and Recovery, kilo-instruction processors) drop the ROB’s one-entry-per-instruction tracking and instead take a checkpoint every few dozen instructions, committing a whole block at once. What does that buy for a window of thousands of instructions, and what does it give up?</p>`,
`<p><strong>What it buys:</strong></p>
<ul>
<li><strong>No huge in-order structure.</strong> A ROB of several thousand entries is too large to allocate, search, and retire at speed. A few dozen checkpoints, each with a counter of unfinished instructions, track the same window.</li>
<li><strong>Bulk commit.</strong> When a checkpoint’s counter reaches zero and all older ones have committed, the whole block commits at once, which is far wider than any per-instruction retirement.</li>
<li><strong>Early register release.</strong> A physical register can be freed as soon as its value has been read by all consumers and it has been overwritten, tracked by reference counts, instead of waiting for in-order retirement. That keeps the register file small for a large window.</li>
</ul>
<p><strong>What it gives up:</strong></p>
<ul>
<li><strong>Exact recovery points.</strong> On a mispredict or exception the core can only return to a checkpoint, not to the faulting instruction. It must then re-execute the instructions between the checkpoint and the fault, in a special precise mode, to deliver a precise exception. Mispredicts on branches without a checkpoint lose more work.</li>
<li><strong>Simplicity.</strong> Stores can’t be released until their block commits, so the store queue must hold the whole window’s stores or use a hierarchical store queue. Memory-ordering checks must cover a much larger window.</li>
<li><strong>Checkpoint placement matters:</strong> take them at low-confidence branches to limit the re-execution cost, which needs a confidence estimator.</li>
</ul>
<p>The idea targets memory-bound code, where a window of thousands of instructions covers several DRAM misses. No mainstream core uses it fully, but parts of it (checkpointed rename, reference-counted registers for move elimination) appear in shipping designs.</p>`, "hard") +
`<h3 id="sec-retire">Retirement and Commit</h3>` +
M(`<p>On Golden Cove (512-entry ROB, 6-wide allocation), a load at the ROB head misses to DRAM: 80 ns at 5 GHz. The code behind it is independent of the load and would otherwise run at the full 6 per cycle. Assume no other structure (physical registers, load queue, scheduler) fills before the ROB. How many cycles does allocation stall, and what is the effective IPC over the miss? Then: what if a second, independent miss is 50 instructions behind the first? What if its address depends on the first load?</p><p>(e) When the miss finally returns, how long does it take to retire the backlog at 8 per cycle, and does allocation stall while it drains?</p>`,
`<ol>
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
Q(`<p>An x86 instruction that decodes into 4 uops must retire as a unit. Why? Then explain how <code>rep movsb</code>, which can copy megabytes, can still be interrupted and resumed, and what the ROB has to do for that.</p>`,
`<p><strong>Why atomic:</strong> architecturally, an instruction either happened or didn’t. If an interrupt or fault could land between the uops of <code>add [rdi], rax</code>, the handler might see the load and add done but the store not, a state no sequence of whole instructions could produce, and on return the instruction would re-execute its load and double-count. So the ROB marks the last uop of each instruction, and retirement commits uops only up to an instruction boundary. A fault on any uop flushes the whole instruction.</p>
<p><strong>Why <code>rep movsb</code> is different:</strong> the architecture defines each iteration as a restartable unit. After each chunk, the registers <code>rcx</code> (count left), <code>rsi</code>, and <code>rdi</code> (pointers) are architecturally updated. An interrupt can be taken at a chunk boundary with the instruction pointer still pointing at the <code>rep movsb</code>. On return it re-executes and continues from where the registers say.</p>
<p><strong>What the ROB does:</strong> the instruction is expanded by the microcode sequencer into a loop of uops. Each group that updates <code>rcx</code>, <code>rsi</code>, and <code>rdi</code> is treated as its own retirement unit, so retirement can stop between groups. Fast string implementations move whole cache lines per iteration, so the boundaries are coarser than one byte, but the architectural state at each boundary is still exactly “some number of bytes copied.”</p>
<p>The same pattern covers other long instructions, such as gathers on some implementations, where completed elements are recorded in the mask register so a fault partway through can resume.</p>`, "hard") +
Q(`<p>Your model retires up to 8 uops per cycle. The real core’s retirement also stops at certain instructions even when everything is complete. Which instructions or events limit retirement besides width, and how do you find out whether they matter for a workload?</p>`,
`<ul>
<li><strong>Taken branches per cycle:</strong> some designs retire at most one or two taken branches per cycle, because each updates the retirement-side branch state.</li>
<li><strong>Stores:</strong> retirement may be limited in how many stores it can commit per cycle into the post-retirement store buffer.</li>
<li><strong>Serializing instructions:</strong> <code>cpuid</code>, writes to some control registers, <code>lfence</code> in its serializing role, and microcoded instructions that must drain the pipeline retire alone and stop younger instructions from executing until they do.</li>
<li><strong>Instructions with side effects at retirement:</strong> those that update rarely renamed state (segment registers, some FP control words, MXCSR on many cores) may require retirement to stop and the pipeline to restart.</li>
<li><strong>Exceptions and assists:</strong> a uop marked as needing an assist or a fault stops retirement and triggers a flush.</li>
<li><strong>Multi-uop instruction boundaries:</strong> if the last uop of an instruction falls outside this cycle’s retirement width, the earlier uops wait too.</li>
</ul>
<p><strong>How to find out:</strong> on silicon, compare retired uops per cycle with the retirement width over time, and look for cycles where the ROB head is complete but retirement is below width. Microbenchmarks that mix each suspect instruction with independent work measure its effect. In the model, record the reason for every retirement slot left unused while the head is complete. If such cycles are rare, retirement isn’t worth modeling in more detail, and the plain width limit is enough.</p>`, "hard") +
`<h3 id="sec-sizing">Sizing the ROB</h3>` +
Q(`<p>You double the ROB from 256 to 512 entries and a benchmark gets no faster. Give four distinct explanations and the statistic that separates each.</p>`,
`<ol>
<li><strong>Another structure fills first:</strong> physical registers, scheduler, load queue, or store queue. Check allocation-stall cycles by resource; ROB-full cycles stay near zero.</li>
<li><strong>Dependence-bound misses:</strong> pointer chasing, where each miss depends on the last. Check average outstanding L1D misses (MLP): it stays near 1 no matter the window size.</li>
<li><strong>The window never fills:</strong> front-end bound code or frequent mispredicts. Check the ROB occupancy histogram and instructions between mispredicts. At 10 mispredicts per 1,000 instructions, there are about 100 instructions between flushes, so a 512-entry window is never filled with useful work.</li>
<li><strong>Memory bandwidth is saturated:</strong> more misses in flight just queue at the DRAM controller. Check DRAM bandwidth utilization against the achievable peak, and whether average miss latency rises as the ROB grows.</li>
</ol>
<p>A fifth, simulator-specific one: the workload fits in cache in the simulated region, so there are no long-latency events to overlap. Check that the simulation points are representative.</p>`, "hard") +
Q(`<p>Design an experiment to choose the ROB size for a new core.</p>`,
`<ol>
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
M(`<p>Using Little’s law, how many ROB entries would a 6-wide core need to fully hide an L2 hit (about 15 cycles) and a DRAM miss (about 400 cycles)? What does this tell you about where performance on memory-bound code really comes from?</p><p>Then make it concrete: one independent DRAM miss every 100 instructions on a 6-wide core with a 512-entry ROB, where no other structure fills first. Estimate the IPC with Little’s law, and explain why a cycle-level simulation gives about 1.45.</p>`,
`<p>Entries needed ≈ throughput × latency to cover:</p>
<ul>
<li>L2 hit: 6 × 15 = <strong>90 entries</strong>, easily covered by a 320- or 512-entry ROB.</li>
<li>DRAM: 6 × 400 = <strong>2,400 entries</strong>, far beyond any real ROB.</li>
</ul>
<p>So no realistic window hides DRAM latency. Performance on memory-bound code comes from <em>overlapping</em> misses with each other (MLP: the window must be big enough to reach the next independent miss), from prefetching (turning DRAM misses into cache hits), and from keeping the working set in cache. A bigger ROB helps only to the extent that it exposes more independent misses.</p>
<p><strong>Concrete case:</strong> Little’s law with the raw ROB size gives 512 / 400 = <strong>1.28</strong>. The simulation gives more because the window advances in whole miss-to-miss chunks: when the miss at the head returns, retirement runs on to the next miss 100 instructions later, so dispatch can reach 612 instructions past the old head and pick up one more miss. On average about 6 misses (600 instructions) overlap per 400-cycle latency: 600 / 400 = 1.5, minus small pipeline effects, giving the simulated <strong>1.45</strong>. Little’s law with the raw window slightly underestimates when misses are spread at a spacing comparable to the window; round the window up to the next miss.</p>`, "hard") +
M(`<p>A memory-bound loop has one independent DRAM miss every 120 instructions. The core runs at 5 GHz with 90 ns DRAM latency and 64-byte lines. Compare a 320-entry ROB (Zen 4) with a 512-entry ROB (Golden Cove), assuming the window is always full of useful work and misses are evenly spaced. For each, estimate:</p><ul><li>Outstanding misses</li><li>Miss throughput (misses per cycle)</li><li>Effective penalty per miss</li><li>Demand DRAM bandwidth</li><li>The IPC ceiling</li></ul><p>Golden Cove tracks up to 16 outstanding L1D misses (fill buffers) and Zen 4 up to 24 (miss address buffers). Is either a limit?</p>`,
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
M(`<p>Your statistics say average ROB occupancy is 180 of 512 entries, so a colleague argues the ROB is oversized and could be cut to 256. But the ROB is also full in 25% of cycles. Reconcile the two numbers, and say what they do and don’t tell you about shrinking or growing the ROB.</p>`,
`<p>If the ROB is full (512) in 25% of cycles, the other 75% average x where 0.25 × 512 + 0.75 × x = 180, so x ≈ <strong>69</strong>. The occupancy is bimodal: nearly full during memory-bound phases (a miss at the head, the window filling behind it), and mostly empty during the rest (refilling after mispredicts, compute phases with short lifetimes).</p>
<p>Shrinking to 256 would cap exactly the memory-bound phases, which are where a large window earns its keep by overlapping misses; the average hides that. Growing it helps only if, in those full phases, more independent misses lie beyond the current window. What you need is the occupancy histogram, the stall cycles attributed to a full ROB with the head instruction’s type, average outstanding misses during full-ROB phases, and ultimately a sweep. Never size a structure from its average occupancy.</p>`, "hard") +
M(`<p>A core would sustain IPC 4 if nothing missed, and has a 320-entry ROB. Loads are 25% of instructions: 90% hit in L1, 8% hit in L2 (14 cycles), 2% go to DRAM (400 cycles). (a) Which misses can the ROB hide? (b) Estimate the IPC if DRAM misses are isolated and never overlap. (c) Estimate it if DRAM misses come in independent clusters of 4 close together.</p>`,
`<ol>
<li><strong>(a)</strong> A full window holds about 320 / 4 = 80 cycles of work, so latencies well under 80 cycles are hidden when the work behind them is independent. L2 hits (14) are hidden; DRAM misses (400) are not.</li>
<li><strong>(b)</strong> DRAM misses per 1,000 instructions: 250 × 0.02 = 5. Each exposes about 400 − 80 = 320 cycles: 1,600 cycles. Base: 1,000 / 4 = 250 cycles. Total 1,850 cycles: <strong>IPC ≈ 0.54</strong>.</li>
<li><strong>(c)</strong> Four misses close together overlap, so each cluster costs about one exposure: 5 / 4 = 1.25 clusters × 320 = 400 cycles. Total 650 cycles: <strong>IPC ≈ 1.54</strong>, nearly 3× better with the same miss count.</li>
</ol>
<p>The 80-cycle estimate assumes the miss reaches the ROB head with the window otherwise flowing; a miss that arrives while the ROB is already stalled hides less. The big lesson stands: miss count alone doesn’t predict performance; their clustering (MLP) does.</p>`, "hard") +
M(`<p>Mispredicted branches occur at 5 per 1,000 instructions, scattered randomly. When the ROB is full, how many entries hold correct-path instructions on average for a 256-, 512-, and 1,024-entry ROB? What does that imply for growing the ROB?</p>`,
`<p>From the head, the distance X to the first mispredicted branch is roughly geometric with mean D = 1,000 / 5 = 200 instructions; everything beyond it is wrong-path. Correct-path entries = min(X, W), and</p>
<p class="eq">E[min(X, W)] = D (1 − (1 − 1/D)<sup>W</sup>) ≈ D (1 − e<sup>−W/D</sup>)</p>
<ul>
<li>256 entries: 200 × (1 − e<sup>−1.28</sup>) ≈ <strong>144</strong></li>
<li>512 entries: 200 × (1 − e<sup>−2.56</sup>) ≈ <strong>185</strong></li>
<li>1,024 entries: 200 × (1 − e<sup>−5.12</sup>) ≈ <strong>199</strong></li>
</ul>
<p>Doubling 512 to 1,024 adds only about 14 useful entries (7%); the other 498 hold mostly wrong-path work that burns energy. A window much beyond about 3 × D is wasted, so window size has to grow together with prediction accuracy. Caveats: mispredicts cluster in real code (making long correct-path stretches more likely), and memory-bound phases with few branches benefit from big windows regardless.</p>`, "hard") +
Q(`<p>IBM’s POWER4 and POWER5 tracked instructions in groups of up to 5 in the global completion table, one entry per group, instead of one ROB entry per instruction. What does grouping save, what does it cost in effective window size, and how would you model it?</p>`,
`<p><strong>What it saves:</strong> one table entry, one completion check, and one set of recovery state per group instead of per instruction. With up to 5 instructions per group, the completion table needs about a fifth of the entries of a ROB covering the same instructions, and completion commits a whole group per cycle, which gives wide commit cheaply.</p>
<p><strong>What it costs:</strong></p>
<ul>
<li><strong>Partly filled groups.</strong> Groups are formed at decode under rules: a group ends at a branch, some instructions must start or be alone in a group, and cracked instructions take several slots. Real groups average fewer than 5 instructions, so the effective window is smaller than “entries × 5.”</li>
<li><strong>Coarse completion.</strong> A group completes only when all its instructions finish, so a long-latency instruction holds back the others in its group, though they would block retirement anyway.</li>
<li><strong>Coarse recovery.</strong> A flush inside a group, such as from a load that violates ordering, may have to discard and refetch the whole group.</li>
</ul>
<p><strong>How to model it:</strong> form groups in the decode model using the real rules, allocate a completion-table entry per group, and count group-size statistics. Report the effective window as instructions in flight, not entries, and compare it with a per-instruction ROB of the same nominal capacity on the same suite. The difference is exactly what grouping costs. IBM kept groups through POWER8 and moved to per-instruction tracking in POWER9’s completion table, as windows grew and the grouping loss grew with them.</p>`, "hard"),
},
{
  id: "intv-sched",
  title: "Scheduling and Execution",
  body: `
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
M(`<p>Some Intel cores bind each uop to a specific execution port when it is allocated, not when it issues. Take two equivalent ALU ports, and assume each cycle exactly two ALU uops become ready, with nothing else waiting. (a) If binding picks a port at random, what is the throughput? (b) Does alternating ports at allocation fix it? (c) Why bind early at all?</p>`,
`<ol>
<li><strong>(a)</strong> The two ready uops are on the same port with probability 1/2, in which case only one issues. Expected issue: 2 × 1/2 + 1 × 1/2 = <strong>1.5 per cycle</strong>, a 25% loss against the 2 the hardware could do.</li>
<li><strong>(b)</strong> Only partly. Alternating balances the <em>allocation</em> order, but instructions become ready in dataflow order, not allocation order: two uops that become ready in the same cycle may still have been bound to the same port. Real designs balance using counts of pending uops per port at allocation time, which reduces but does not eliminate collisions.</li>
<li><strong>(c)</strong> With early binding, each port’s select logic only arbitrates among its own uops, a small independent circuit. Late binding needs a select that considers every port for every ready uop in the same cycle, which is larger and harder to fit in the one-cycle wakeup–select loop. Early binding trades some throughput for a faster, simpler scheduler.</li>
</ol>`, "hard") +
Q(`<p>Between rename and retirement, an out-of-order core tracks a load in several structures at once. Name them, and say when the load enters and leaves each one.</p>`,
`<ul>
<li><strong>ROB:</strong> enters at allocation, in program order. Leaves at retirement, in program order, after it and every older instruction have completed.</li>
<li><strong>Scheduler (reservation station):</strong> enters at allocation. Leaves when it issues to a load port, once its address operands are ready. On most designs it may stay a few cycles longer, in case it has to replay.</li>
<li><strong>Load queue:</strong> enters at allocation. Leaves at retirement, because until then an older store’s address check or, on x86, a snoop from another core may still find an ordering violation.</li>
<li><strong>Physical register file:</strong> its destination register is taken from the free list at rename. The value is written when the data returns. The register itself is freed later, when the next instruction that writes the same architectural register retires.</li>
<li><strong>Fill buffer or MSHR:</strong> only if it misses in the L1D. Allocated when the miss is sent, freed when the line arrives.</li>
</ul>
<p>Each structure can be the one that fills first, which is why a stall needs the name of the full structure, not just “the back end is full.” A store follows a similar path, but it leaves the store queue only after it has been written to the cache, which is after retirement.</p>`, "easy") +
Q(`<p>The scheduler wakes a load’s dependents assuming an L1 hit (5 cycles), so they issue just in time to catch the data on the bypass. Then the load misses. What happens to the dependents already issued, and what are the replay options? What does a model that wakes dependents only when data really arrives get wrong?</p>`,
`<p><strong>The problem:</strong> by the time the hit or miss is known, the dependents have issued and may be in register read or execute. Their operand is garbage, so they must be cancelled and issued again later. Their dependents, if already woken, must be cancelled too.</p>
<p><strong>Replay options:</strong></p>
<ul>
<li><strong>Keep the entry until it is safe:</strong> a dependent stays in the scheduler for a few cycles after issue and is re-armed if a cancel signal arrives. Simple, but scheduler entries are held longer, which reduces effective capacity.</li>
<li><strong>Non-selective replay:</strong> cancel everything issued in the shadow of the load (the cycles between its issue and the hit signal), dependent or not. Simple control, but independent instructions are wasted and retried.</li>
<li><strong>Selective replay:</strong> track which instructions depend on the load, through dependence vectors or poison bits, and replay only those. Less waste, more logic.</li>
<li><strong>Replay queue</strong> (Pentium 4): cancelled uops loop back through a replay path until the data is there. That design was known for “replay storms,” where uops replayed many times and burned issue slots.</li>
</ul>
<p>Designs also predict hit or miss per load, and delay dependents of loads predicted to miss.</p>
<p><strong>What the idealized model gets wrong:</strong> it never wastes issue slots or port cycles on cancelled uops, and it never holds scheduler entries for safety. It is optimistic on code with frequent L1 misses, or with variable-latency loads such as bank conflicts and misaligned accesses. It is also wrong about load-to-use latency, since without speculative wakeup the dependents would issue several cycles later even on a hit.</p>`, "hard") +
Q(`<p>Compare a CAM-based scheduler, where each result tag is broadcast to all entries, with a dependence-matrix scheduler, where each entry has a bit vector of the entries it waits on. How does each scale with entries and issue width, what does each need at dispatch, and where does each lose?</p>`,
`<p><strong>CAM (tag broadcast):</strong> each entry stores its source tags (physical register numbers). Each cycle, the tags of up to <em>w</em> issued instructions are broadcast and compared against every source in every entry.</p>
<ul>
<li>Comparators: entries × sources × <em>w</em>. Each comparator is a full tag width (8 or 9 bits for a few hundred registers). Energy is spent on every broadcast, at every entry.</li>
<li>Dispatch writes the tags, nothing else. Very flexible: the entry doesn’t care where its producer is.</li>
</ul>
<p><strong>Dependence matrix:</strong> each entry has one bit per other entry, set if it waits on that entry. When an entry issues, its column is cleared, and an entry is ready when its row is all zeros.</p>
<ul>
<li>Storage: entries², but each bit is a simple wire and gate, not a comparator, so wakeup is fast and low energy.</li>
<li>Dispatch must translate source registers into scheduler entry numbers, which needs a table from physical register to the entry of its producer, and producers that already issued or left the scheduler must be marked ready.</li>
<li>Scaling: entries² grows quickly, so matrices are used for small queues (a few dozen entries) or split per execution cluster.</li>
</ul>
<p>Matrices are also used as <strong>age matrices</strong> for selecting the oldest ready entry, even in schedulers that use CAMs for wakeup. In short: CAM energy grows with width, matrix area grows with entries squared, so wide machines with many small queues favor matrices, and large unified queues favor CAMs or a mix.</p>`, "hard") +
`<h3 id="sec-trace">Tracing a Schedule</h3>` +
Q(`<p>Integer adds take 1 cycle, a result can be used by a dependent instruction in the next cycle (full bypass), and the core can issue two adds per cycle, oldest first. All four instructions are in the scheduler with ready sources at cycle 0.</p>
<pre><code>I0: r1 = r2 + r3
I1: r4 = r5 + r6
I2: r7 = r1 + r4
I3: r8 = r9 + r10</code></pre>
<p>(a) Give the issue cycle of each. (b) Does 4-wide issue help? (c) Replace I0 with a load whose result is available 10 cycles after it issues. (d) What changes without the bypass, if a result can be read only two cycles after issue?</p>`,
`<ol>
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
M(`<p>A loop computes the sequence x = a·x + b 1,000 times (64-bit integers, wrapping on overflow). Multiply takes 3 cycles, add 1 cycle; there is one fully pipelined multiplier and the core is 4-wide. (a) How many cycles does it take? (b) Restructure it using the recurrence two steps at a time. How many cycles now, and what must be precomputed? (c) How far can you push this, and what limits it?</p>`,
`<ol>
<li><strong>(a)</strong> Each step is a multiply then an add on the loop-carried chain: 4 cycles per step, about <strong>4,000 cycles</strong>, with the multiplier busy only a quarter of the time.</li>
<li><strong>(b)</strong> Two steps at once: x<sub>n+2</sub> = a(a·x<sub>n</sub> + b) + b = A·x<sub>n</sub> + B with A = a² and B = a·b + b, precomputed once. Run two independent chains, one for even and one for odd indices (starting from x<sub>0</sub> and x<sub>1</sub>): each chain advances one step per 4 cycles, so 2 values per 4 cycles: about <strong>2,000 cycles</strong>. Wrapping 64-bit arithmetic is a ring, so the algebra is exact.</li>
<li><strong>(c)</strong> With <em>k</em> interleaved chains (A = a<sup><em>k</em></sup>, B = b(a<sup><em>k</em>−1</sup> + … + 1)), you get <em>k</em> values per 4 cycles until the multiplier saturates at one multiply per cycle, at <em>k</em> = 4: about <strong>1,000 cycles</strong>. Width isn’t the limit (2 instructions per value, 4-wide). This is the general trick for latency-bound recurrences: trade more total work or precomputation for independent chains.</li>
</ol>`, "hard") +
Q(`<p>On several Intel cores, an integer result consumed by a vector or FP instruction, or the reverse, arrives a cycle or more later than within the same domain. Why does a cross-domain bypass delay exist, and how should a scheduler and a model handle it?</p>`,
`<p><strong>Why:</strong> execution units are grouped into clusters (integer, vector/FP, sometimes load/store), each with its own bypass network. Bypassing every result to every unit in the same cycle would need long wires across the core and a huge mux at every input. So results within a cluster bypass in the same cycle, and results that cross clusters go through an extra latch stage or the register file, costing one or more cycles. Physical distance and data width (64-bit integer, 256- or 512-bit vector) make the vector-integer crossing the worst.</p>
<p><strong>In the scheduler:</strong> wakeup must use a latency that depends on both the producer and the consumer. The producer broadcasts its tag, and a consumer in another cluster treats it as ready one or more cycles later. Some designs avoid the extra logic by adding a uop that moves the value between domains, which costs a slot as well as latency.</p>
<p><strong>In a model:</strong> store the latency per (producer class, consumer class) pair, not per producer. A model with one latency per instruction class gets integer-vector mixes wrong. Examples: <code>movq xmm0, rax</code> or <code>vmovd</code> chains, vectorized code that extracts lane values to compute addresses, and integer instructions used in vector algorithms. Microbenchmark each crossing on the target core (a chain of alternating domains), since vendors don’t always document it.</p>`, "hard") +
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
M(`<p>At IPC 4, instructions spend this long in the scheduler between dispatch and issue: 70% about 2 cycles, 25% about 10 cycles (waiting on L1 or L2 hits), and 5% about 400 cycles (waiting, directly or through a chain, on DRAM misses). (a) What is the average occupancy? (b) How much of it is the 5%? (c) What happens with a 60-entry scheduler, and what does that suggest about scheduler design?</p>`,
`<ol>
<li><strong>(a)</strong> Average wait: 0.7 × 2 + 0.25 × 10 + 0.05 × 400 = 1.4 + 2.5 + 20 = 23.9 cycles. Little’s law: 4 × 23.9 ≈ <strong>96 entries</strong>, close to Skylake’s 97-entry scheduler.</li>
<li><strong>(b)</strong> 4 × 0.05 × 400 = <strong>80 entries</strong>, 84% of the scheduler, held by the 5% of instructions waiting on DRAM and doing nothing.</li>
<li><strong>(c)</strong> 60 entries can support at most 60 / 23.9 ≈ <strong>2.5 IPC</strong> with this mix. Since the long waiters dominate the occupancy, scheduler size is really set by miss handling. That motivates designs that move miss-dependent instructions out of the scheduler into a cheap buffer and bring them back when the data arrives, rather than growing the expensive wakeup CAM.</li>
</ol>`, "hard") +
Q(`<p>An issue queue can be <em>collapsing</em> (entries shift toward the bottom as older ones issue, so position equals age) or <em>non-collapsing</em> (entries stay where they were written, in any free slot). How does each find the oldest ready instruction, and what does each cost in power, timing, and capacity?</p>`,
`<p><strong>Collapsing queue:</strong></p>
<ul>
<li>Age is position, so a simple priority encoder from the bottom finds the oldest ready entry. Selection is fast and exactly age-ordered.</li>
<li>Every issue shifts all younger entries down, moving their tags, operand state, and payload. Wires and muxes for shifting by up to <em>w</em> positions per cycle cost power and area, and the shifting must finish in the same cycle as wakeup and select.</li>
<li>Capacity is used fully: no holes.</li>
</ul>
<p><strong>Non-collapsing queue:</strong></p>
<ul>
<li>Entries are written into free slots, so position says nothing about age. Age needs an age matrix (one bit per pair of entries: “i is older than j”), or a coarse timestamp per entry, or a priority scheme that only approximates age.</li>
<li>No data moves after dispatch, so power is much lower, and the queue can be larger.</li>
<li>Selection is more complex if exact age order is wanted, and approximations (random or position-based priority) can occasionally pick a younger instruction over a critical older one.</li>
</ul>
<p>The Alpha 21264 used a collapsing queue. Most later designs use non-collapsing queues with age matrices or approximate age, because shifting energy grew too large with wider and deeper queues. In a model, “oldest first” selection is often assumed. If the target uses approximate age, check that the difference doesn’t matter for the workloads, for example by also simulating random selection among ready entries.</p>`, "hard") +
Q(`<p>Oldest-first selection ignores which instructions are on the critical path. How could a core predict criticality cheaply at run time, what would it do with the prediction, and why have criticality-based schedulers given smaller gains than the idea suggests?</p>`,
`<p><strong>Predicting criticality:</strong></p>
<ul>
<li>Heuristics based on observable events: an instruction that was the oldest in the ROB when it completed (it blocked retirement), loads that missed, instructions feeding a mispredicted branch, or instructions with many dependents.</li>
<li>Token-passing predictors (Fields, Rubin, and Bodík, 2001) that approximate the critical path in the dependence graph and train a table indexed by PC.</li>
<li>A small table of PCs with saturating counters, updated at retirement.</li>
</ul>
<p><strong>Using it:</strong> select predicted-critical instructions before older non-critical ones, steer them to the faster cluster or a port without bypass delay, issue their loads first to the memory system, or give their misses priority in the MSHRs and DRAM queue.</p>
<p><strong>Why gains are small:</strong></p>
<ul>
<li>Oldest-first is already a good proxy: the oldest instruction blocks retirement and is often critical.</li>
<li>The scheduler rarely has more ready instructions than ports. Priority matters only in cycles with contention, which are a minority on most code.</li>
<li>The critical path moves. Speeding one chain makes another chain critical, so the gain is bounded by the slack of the next path.</li>
<li>Prediction costs a table lookup at rename and storage, and a wrong prediction can starve a truly critical instruction.</li>
</ul>
<p>Typical reported gains are a few percent. The idea pays off more for resource arbitration far from the core (DRAM scheduling, cache bank arbitration), where contention is common and the latencies at stake are large.</p>`, "hard") +
`<h3 id="sec-ilp">Execution Units and ILP</h3>` +
M(`<p>Skylake has four integer ALU ports, but shifts and branches can only use two of them (ports 0 and 6). A tight loop is about half shifts and branches. What is the best-case IPC, and how would you detect this limit with counters?</p>`,
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
M(`<p>On Skylake, FMAs use ports 0 and 1, vector shuffles only port 5, scalar shifts ports 0 and 6, taken branches only port 6, and simple integer ALU operations any of ports 0, 1, 5, and 6. A loop iteration has 2 FMAs, 2 shuffles, 1 shift, 1 taken branch, and 2 simple ALU operations (8 uops). (a) What is the minimum cycles per iteration? Give a valid port assignment. (b) Add a third shuffle. Now what? (c) How would you see this in counters, and fix it?</p>`,
`<ol>
<li><strong>(a)</strong> 8 uops on 4 ALU ports need at least 2 cycles (and the 4-wide front end also needs 2). Port 5 must run both shuffles: 2 cycles. Assignment over 2 cycles:<ul><li>Port 0: FMA, shift</li><li>Port 1: FMA, ALU</li><li>Port 5: shuffle, shuffle</li><li>Port 6: branch, ALU</li></ul> <strong>2 cycles, 4 uops per cycle.</strong></li>
<li><strong>(b)</strong> Three shuffles need port 5 for <strong>3 cycles</strong>, and nothing else can help. 9 uops in 3 cycles = 3 per cycle, while the front end could deliver them in 2.25 cycles and the other three ports sit idle a third of the time.</li>
<li><strong>(c)</strong> Per-port dispatch counters show port 5 at about 1 uop per cycle and the others well below, with ready uops waiting. Fixes: replace a shuffle with an instruction that runs elsewhere (a blend, or a broadcast folded into a load), restructure the data layout so fewer shuffles are needed, or move to a core with shuffle units on more ports.</li>
</ol>`, "hard") +
M(`<p>A dot-product loop does, per element, 2 loads, 1 FMA into an accumulator, 1 index increment, and 1 fused compare-and-branch: 5 macro-ops (AMD's unit for dispatch width). The core is Zen 4-like: 6-wide, 3 loads per cycle, 2 FMA pipes with 4-cycle latency. (a) What is the resource bound in cycles per element? (b) The recurrence bound with one accumulator? (c) Unrolled by 8 with 8 accumulators (one index increment and one branch per 8 elements): cycles per element, and which resource binds?</p>`,
`<ol>
<li><strong>(a)</strong><ul><li>Loads: 2 / 3 = 0.67 cycles</li><li>FMA: 1 / 2 = 0.5</li><li>Width: 5 / 6 = 0.83</li></ul> Resource bound = <strong>0.83 cycles per element</strong> (width).</li>
<li><strong>(b)</strong> Every FMA depends on the previous one through the accumulator: <strong>4 cycles per element</strong>, nearly 5× worse than the resource bound.</li>
<li><strong>(c)</strong> Per 8 elements: 16 loads, 8 FMAs, 1 add, 1 branch = 26 macro-ops. Width: 26 / 6 = 4.33 cycles. Loads: 16 / 3 = 5.33. FMA: 8 / 2 = 4. Recurrence: each accumulator is updated once per 8 elements: 4 cycles. The maximum is <strong>5.33 cycles per 8 elements = 0.67 per element</strong>, load-bound. The FMA units are 75% busy at best; only reusing loaded values across several FMAs (as matrix multiply does) reaches the FMA peak.</li>
</ol>
<p>This is the same calculation compilers do for modulo scheduling: the initiation interval is the maximum of the resource bound and the recurrence bound.</p>`, "hard") +
M(`<p>A loop sums the elements above a threshold: <code>if (x[i] &gt; t) s += x[i];</code>. On random data the branch is taken 50% of the time, unpredictably; a mispredict costs 17 cycles. (a) Estimate cycles per element for the branchy version and for a branchless version <code>s += (x[i] &gt; t) ? x[i] : 0</code> using a conditional move. (b) What if the data is sorted? (c) For a running maximum, <code>m = (x[i] &gt; m) ? x[i] : m</code>, explain why the branchless version can be about 2× <em>slower</em> than the branch even on random data.</p>`,
`<ol>
<li><strong>(a)</strong> Branchy: 0.5 × 17 = <strong>8.5 cycles of mispredicts per element</strong>, about 9 cycles in total. Branchless: the select depends only on x[i], not on s, so it’s off the loop-carried chain; the chain is just the add, 1 cycle per element, and throughput is about 1 cycle per element: roughly <strong>9× faster</strong>.</li>
<li><strong>(b)</strong> Sorted data makes the branch almost perfectly predictable, so both versions run at about 1 cycle per element.</li>
<li><strong>(c)</strong> In the max loop the conditional move is <em>on</em> the chain: compare m, then select into m: 2 cycles per element. On random data the running maximum changes rarely (about ln <em>n</em> times over <em>n</em> elements), so the branch is almost always not taken and well predicted, and the predicted branch breaks the dependence: the core doesn’t wait for m to know what to do next. That gives about 1 cycle per element, 2× faster than the branchless version. Branchless code wins when the branch is unpredictable and the select is off the critical path; it loses when the branch is predictable and the select sits on a loop-carried chain.</li>
</ol>`, "hard") +
Q(`<p>Limit studies such as Wall’s (1991) found ILP in the tens or even hundreds with perfect branch prediction, perfect alias analysis, and unlimited renaming and window. Real cores get IPC around 2 on integer code. Which idealizations account for most of the gap, and in what order?</p>`,
`<p>Relax them one at a time from the ideal, on typical integer code:</p>
<ol>
<li><strong>Branch prediction:</strong> the biggest single factor. With an unlimited window, ILP comes from instructions far ahead. A mispredict every few hundred instructions limits the useful window to that distance, so even a good real predictor cuts the ideal ILP drastically.</li>
<li><strong>Window size:</strong> real windows hold a few hundred instructions, not thousands. Much of the ideal ILP is from distant independent work, out of reach.</li>
<li><strong>Memory latency:</strong> limit studies typically assume 1-cycle memory. Real misses stall retirement and fill the window, and dependent misses serialize.</li>
<li><strong>Memory disambiguation:</strong> without perfect alias knowledge, loads wait for or speculate past older stores. Modern dependence predictors recover most of this loss.</li>
<li><strong>Finite registers:</strong> renaming with a few hundred registers limits the window like the ROB does.</li>
<li><strong>Fetch and width limits:</strong> fetch past taken branches, decode width, and ports. These matter only once the larger limits are removed.</li>
</ol>
<p>The lesson H&amp;P draw: ILP exists, but the cost of exposing it (prediction, window, memory) grows faster than the gain, which is why industry turned to multiple cores and threads in the mid-2000s. In an interview, the useful skill is to say which assumption your model makes that a limit study does not, and how much it matters for your workload.</p>`, "hard") +
Q(`<p>Going from 4 to 8 integer ALUs does almost nothing for most integer code, but going from 2 to 3 loads per cycle (Zen 2 to Zen 3, Sunny Cove to Golden Cove) gave measurable gains. Why the asymmetry?</p>`,
`<p><strong>ALUs:</strong> integer code has about 1 ALU operation per instruction or less, and IPC is around 2 to 3. Four ALUs are rarely all busy. Cycles with more than 4 ready ALU operations are uncommon, because dependence chains and the front end limit how many are available. Extra ALUs help in bursts after a miss returns and little otherwise.</p>
<p><strong>Load ports:</strong></p>
<ul>
<li>Loads are frequent, often 25% to 35% of instructions, so at IPC 4 there are more than 1 load per cycle on average, and bursts of 3 or more are common.</li>
<li>Loads are on the critical path of most code: addresses come from loads (pointer chasing, indirect array access), and branches depend on loaded values. Delaying a load by one cycle for a port delays its whole dependent chain.</li>
<li>A load port is a whole pipeline: an address generator, a TLB port, an L1D port (more banks or more read ports), store-queue search, and a fill path. That is why they are scarce and why adding one changes measured throughput.</li>
<li>Loads also need ports for retries, and a store-forwarding or bank-conflict replay takes a port slot again.</li>
</ul>
<p><strong>What to measure:</strong> per-port utilization and the distribution of ready instructions per port class per cycle. If the load ports are busy and there are cycles with ready loads left waiting, another port helps. If the ALUs are rarely all busy, more of them won’t.</p>`, "hard") +
`<h3 id="sec-smt">SMT and SIMD</h3>` +
Q(`<p>An SMT core statically partitions the ROB and the load and store queues between two threads, but competitively shares the schedulers and physical registers. Explain the reasoning for each choice, and what happens to single-thread performance when only one thread runs.</p>`,
`<ul>
<li><strong>Partitioned:</strong> these structures free entries only at in-order retirement. A thread stuck on a DRAM miss would fill a shared ROB or load queue with entries that can’t leave and starve the other thread completely. A static split guarantees each thread a share.</li>
<li><strong>Shared:</strong> scheduler entries leave when they issue, so a stalled thread holds few of them for long, and physical registers, caches, and predictor tables gain from adapting to threads with different needs. The fetch policy and per-thread watermarks keep either thread from taking everything.</li>
<li><strong>One thread:</strong> the partitioned structures recombine, so single-thread performance is close to that of the same core without SMT.</li>
</ul>`, "medium") +
Q(`<p>Why does the ICOUNT fetch policy (fetch from the thread with the fewest instructions in the front end and queues) beat round-robin? In what situation can one thread still hurt the other under ICOUNT?</p>`,
`<p>Round-robin gives a thread stuck on a miss the same fetch bandwidth as one making progress, and the stuck thread fills the queues with instructions that can’t issue. ICOUNT favors the thread whose instructions are leaving the queues, so it adapts automatically and keeps either thread from clogging the scheduler.</p>
<p>The gap: ICOUNT counts instructions waiting in the front end and queues, not resources held downstream. A thread with an outstanding DRAM miss can keep its queue count low while its instructions pile up in the ROB, load queue, and physical registers behind the miss, holding shared registers for hundreds of cycles. Later policies add throttling or flushing for threads with outstanding long misses, and caps on per-thread register use.</p>`, "hard") +
Q(`<p>Zen 4 executes AVX-512 on 256-bit units, splitting each 512-bit operation into two halves. If peak FLOPs don’t change, what does a program gain by compiling with AVX-512, and what must a performance model capture?</p>`,
`<p>Gains:</p>
<ul>
<li>Half as many instructions to fetch, decode, rename, and retire for the same work.</li>
<li>32 vector registers, for fewer spills and more accumulators.</li>
<li>Mask registers, which vectorize loops with conditions and handle remainders without separate code.</li>
<li>New instructions (VNNI dot products, compress and expand, ternary logic).</li>
<li>No separate AVX-512 clock limit on Zen 4.</li>
</ul>
<p>The model has to count each 512-bit operation as two passes through its pipe for the port bounds but one slot for rename and retire, count load and store bandwidth in bytes, and include the frequency behavior of the specific part.</p>`, "medium") +
Q(`<p>On Intel’s Skylake-SP, enabling AVX-512 in one library makes a mostly scalar web service slower overall, even though the library’s hot loop got faster. Explain the mechanism, and how you would model it.</p>`,
`<p>Heavy 512-bit instructions move the core to a lower frequency license, and the lower clock persists for a while after the last such instruction. Scalar code running between occasional AVX-512 calls therefore also runs slower, and with SMT so does the sibling thread. If the vector code is a small share of the run time, the gain on it is outweighed by the frequency loss on everything else.</p>
<p>In the model, make frequency a function of the instruction mix over a time window, with the license levels, the transition delay, and the hold time, applied to the whole core rather than just the vector code. Compare in seconds, not cycles. Mitigations: use 256-bit vectors, which have a milder license, or batch the AVX-512 work so the low-clock periods are few and long.</p>`, "hard") +
M(`<p>Three candidate pairs could share one SMT core. IPC alone and IPC together:</p>
<ul>
<li>Pair X: A alone 2.4, B alone 0.6. Together: A 2.0, B 0.5.</li>
<li>Pair Y: A alone 2.4, C alone 2.2. Together: A 1.3, C 1.2.</li>
<li>Pair Z: B alone 0.6, D alone 0.5. Together: B 0.45, D 0.42.</li>
</ul>
<p>Compute each pair’s weighted speedup and maximum slowdown. Which pairings would you schedule, and why does combined IPC mislead?</p>`,
`<ol>
<li><strong>X:</strong> 2.0 / 2.4 + 0.5 / 0.6 = 0.83 + 0.83 = <strong>1.67</strong>. Slowdowns 1.20× and 1.20×. Combined IPC 2.5.</li>
<li><strong>Y:</strong> 1.3 / 2.4 + 1.2 / 2.2 = 0.54 + 0.55 = <strong>1.09</strong>. Slowdowns 1.85× and 1.83×. Combined IPC also 2.5.</li>
<li><strong>Z:</strong> 0.45 / 0.6 + 0.42 / 0.5 = 0.75 + 0.84 = <strong>1.59</strong>. Slowdowns 1.33× and 1.19×. Combined IPC 0.87.</li>
<li>Schedule X (compute-heavy with memory-bound) and Z (two memory-bound threads that overlap their stalls). Y, two threads that both want the execution units, is barely better than time-slicing, with both threads almost 2× slower.</li>
<li>Combined IPC ranks X and Y equal and Z last, because it weights high-IPC threads more. Weighted speedup measures progress relative to what each thread could do alone, and Z gets 59% more progress than running its threads one after the other.</li>
</ol>`, "medium") +
M(`<p>A loop does 4 operations per element. Then, for 1% of elements (unpredictably), it runs a 60-operation path, and for the rest a 2-operation path. Charge one issue slot per scalar or vector operation at 4 slots per cycle either way, plus 15 cycles per mispredict.</p>
<ul>
<li>(a) Scalar code with a branch (1 slot) that mispredicts on 1% of elements: cycles per element?</li>
<li>(b) 16-lane masked code that runs both paths for every vector and blends them (2 slots): cycles per element and speedup?</li>
<li>(c) Masked code that skips the long path when no lane needs it (a test and a branch, 1 slot) and mispredicts each time it doesn’t skip?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Slots: 4 + 0.01 × 60 + 0.99 × 2 + 1 = 7.58, so 7.58 / 4 = 1.90 cycles, plus 0.01 × 15 = 0.15: <strong>2.05 cycles per element</strong>.</li>
<li><strong>(b)</strong> Per vector: 4 + 60 + 2 + 2 = 68 slots for 16 elements, 4.25 per element, 1.06 cycles. Speedup 2.05 / 1.06 ≈ <strong>1.9×</strong>, though 16 lanes promised up to 16×, because every element now pays for the rare path.</li>
<li><strong>(c)</strong> P(no lane takes the long path) = 0.99<sup>16</sup> ≈ 0.85. Per vector: 4 + 2 + 2 + 1 + 0.15 × 60 = 17.9 slots, 1.12 per element, 0.28 cycles. Mispredicts: 0.15 × 15 / 16 ≈ 0.14 cycles per element. Total ≈ 0.42 cycles, a speedup of about <strong>4.9×</strong>.</li>
<li>Rare, expensive paths are where masked SIMD loses most. Better still: compress the rare elements into a list and run the long path on them in a separate pass.</li>
</ol>`, "hard") +
Q(`<p>Some cloud providers disable SMT on shared hosts, or only let one tenant’s threads share a physical core. What can one SMT thread learn about another through shared core resources, and which mitigations cost what?</p>`,
`<p><strong>Leaks through contention (timing):</strong></p>
<ul>
<li><strong>Port contention</strong> (PortSmash, 2018): a spy thread issues instructions to one port and times them. When the victim uses that port, the spy slows down. Repeated measurements recover a pattern of instructions, such as the sequence of operations in a cryptographic scalar multiplication, which reveals key bits.</li>
<li><strong>Shared caches, TLBs, and predictors:</strong> L1D and L1I contents, BTB entries, and TLB entries are shared, so prime-and-probe attacks work with much finer timing than across cores.</li>
</ul>
<p><strong>Leaks through shared buffers (data):</strong> the MDS family (RIDL, Fallout, ZombieLoad, 2019) showed that on some Intel cores, faulting or assisted loads could transiently receive stale data from fill buffers, load ports, or the store buffer, including data belonging to the sibling thread.</p>
<p><strong>Mitigations:</strong></p>
<ul>
<li><strong>Disable SMT:</strong> removes all sibling leaks, at the cost of the 15% to 30% throughput that SMT typically gives on server work.</li>
<li><strong>Core scheduling</strong> (Linux, since 5.14): only threads that trust each other share a core. Keeps most SMT gains, but the scheduler sometimes leaves a sibling idle.</li>
<li><strong>Buffer clearing</strong> (<code>VERW</code> at privilege changes) for MDS: protects against kernel-to-user leaks, not against a concurrently running sibling.</li>
<li><strong>Constant-time code:</strong> removes secret-dependent port use and memory access, the only defense the software can apply itself.</li>
</ul>
<p>For an architect: any resource shared dynamically between threads is a channel. Partitioning closes some of them but costs the flexibility that makes SMT pay off.</p>`, "hard"),
},
{
  id: "intv-arith",
  title: "Arithmetic and Floating Point",
  body: `
<p>Background: <a href="#/r/arith">Computer Arithmetic</a>, especially <a href="#/fp-rounding">Rounding, Exceptions, and Error</a>, <a href="#/int-units">Integer Arithmetic Units</a>, and <a href="#/fp-units">Floating-Point Units and the FMA Pipeline</a>. Latencies below are from Agner Fog’s instruction tables.</p>
<h3 id="sec-fmt">Formats and Numerics</h3>` +
M(`<p>A colleague stores 64-bit event IDs in a <code>float</code> column to save space, arguing that “FP32 has about 7 significant digits, so 123,456,789 only loses its last digit or two.” What is actually stored for 123,456,789, and is the argument sound for IDs?</p>`,
`<ol>
<li>2<sup>26</sup> = 67,108,864 ≤ 123,456,789 &lt; 2<sup>27</sup>, so the ULP is 2<sup>26 − 23</sup> = 8.</li>
<li>123,456,789 / 8 = 15,432,098.625, which rounds to 15,432,099, so the stored value is <strong>123,456,792</strong>, off by 3.</li>
<li>The relative error (2.4 × 10<sup>−8</sup>) is as small as promised, so for a measurement the argument is fine. For an ID it isn’t: every float here stands for 8 neighboring integers, so 123,456,789 and 123,456,790 become the same key. IDs need exact integers, and FP32 is exact only up to 2<sup>24</sup>.</li>
</ol>`, "easy") +
M(`<p>Activations are quantized to FP8 E4M3 with one scale per tensor, chosen so the largest magnitude maps to 448. Most values lie within ±1, but one channel has an outlier of 300. What happens to activations of 0.002 and 0.0005, with and without the outlier? What would you change?</p>`,
`<p>E4M3 facts: smallest normal 2<sup>−6</sup> = 0.015625, subnormal spacing 2<sup>−9</sup> ≈ 0.00195, 3 fraction bits (at most 6.25% relative error for a normal number).</p>
<ol>
<li><strong>With the outlier:</strong> scale s = 300 / 448 ≈ 0.67, so a value x is stored as x / 0.67.
<ul><li>0.002 → 0.00299, a subnormal: 0.00299 / 0.00195 = 1.53 rounds to 2 spacings = 0.0039, which dequantizes to 0.0026. That’s <strong>31% high</strong>.</li>
<li>0.0005 → 0.00075, below half the smallest subnormal (0.00098), so it becomes <strong>0</strong>.</li></ul></li>
<li><strong>Without it:</strong> s = 1 / 448. 0.002 → 0.896 and 0.0005 → 0.224, both normal, so both are within 6.25%.</li>
<li><strong>Fixes:</strong> finer-grained scales (per channel, or per 32-element block as in the MX formats), so one outlier only affects its own block. Alternatively, clip outliers, or keep the few outlier channels in BF16 and the rest in FP8.</li>
</ol>
<p>The general point: a per-tensor scale spends the format’s 15 binades of range on the outlier, and everything small falls into the subnormals or to zero.</p>`, "hard") +
Q(`<p>Why does DSP code saturate rather than let fixed-point overflow wrap? Why is −1 × −1 the special case in Q15?</p>`,
`<p>Wrapping turns a large positive value into a large negative one: in audio, a loud sample becomes a loud click of the opposite sign, and in control code an output flips. Saturation clamps to the largest value, a small error instead of a huge one.</p>
<p>Q15 covers [−1, 1): −1 is representable but +1 isn’t. So −1 × −1 = +1 is the one product that overflows, and it saturates to 32,767 / 32,768 ≈ 0.99997. Arm’s SQRDMULH and x86’s PADDSW do this in hardware.</p>`, "easy") +
M(`<p>A FIR filter multiplies Q15 samples by Q15 coefficients and sums 64 products.</p>
<ul>
<li>(a) What format is each product, and how many bits does the exact sum need?</li>
<li>(b) How many guard bits does a 40-bit DSP accumulator give, and how many taps can it sum with no chance of overflow?</li>
<li>(c) Why do Arm’s SDOT and x86’s VPDPBUSD accumulate INT8 products into 32 bits?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Q15 × Q15 is Q30. Its magnitude is at most 1, which is 2<sup>30</sup> in Q30 units, so a signed product needs 32 bits. The sum of 64 can reach 64 × 2<sup>30</sup> = 2<sup>36</sup>, which needs <strong>38 bits</strong> signed.</li>
<li><strong>(b)</strong> 40 − 32 = <strong>8 guard bits</strong>. The largest positive value is 2<sup>39</sup> − 1, so it can sum up to <strong>511</strong> worst-case products (512 of them would reach exactly 2<sup>39</sup>).</li>
<li><strong>(c)</strong> An INT8 product fits in 16 bits (at most 255 × 128 = 32,640 for u8 × s8). A matrix multiply sums thousands of them: 4,096 products need about 16 + 12 = 28 bits. 32-bit accumulators hold that with headroom, while the older 16-bit path (VPMADDUBSW) saturates and silently gives wrong answers.</li>
</ol>`, "medium") +
Q(`<p>An audio filter’s state decays toward zero, and after the input goes silent the loop becomes 50 to 100 times slower on some x86 cores. Explain the mechanism. What do flush-to-zero (FTZ) and denormals-are-zero (DAZ) do, what do they cost in accuracy, and why does a performance model need to know about this at all?</p>`,
`<p><strong>Mechanism:</strong> as the state decays it becomes subnormal (below about 1.2 × 10<sup>−38</sup> in single precision): the exponent is at its minimum and the leading bit is 0, so the value has to be normalized and denormalized around each operation. Many cores handle the common normal case in the fast pipeline and send subnormal inputs or outputs to a microcode assist, which flushes the pipeline and runs a slow path. Assists cost on the order of 100 cycles or more each, so a loop where every operation hits one runs dozens of times slower. Recent cores handle more cases in hardware (additions are often fast, some multiplies still assist), so the effect depends on the operation and the core.</p>
<p><strong>FTZ and DAZ</strong> (bits in MXCSR on x86, FZ in FPCR on Arm): FTZ replaces subnormal results with zero, and DAZ treats subnormal inputs as zero. Both remove the slow path entirely. The cost is a loss of gradual underflow: <em>x − y</em> can become 0 even when <em>x ≠ y</em>, and very small values lose all precision instead of some. That is acceptable in audio, graphics, and most ML, and not acceptable in some scientific code that relies on IEEE 754 underflow behavior. Compilers set them with <code>-ffast-math</code> or at program start.</p>
<p><strong>Why a model cares:</strong> a trace-driven or timing-only model doesn’t see values, so it can’t know when assists happen. It will show the silent-input phase running as fast as the rest, while the real core is 50 times slower. Either count assists from a functional model or hardware counters (Intel reports FP assists as a machine-clear cause) and charge them, or document that the model assumes FTZ/DAZ.</p>`, "hard") +
Q(`<p>FP8 training uses two formats: E4M3 (4 exponent bits, 3 mantissa bits, maximum about 448) and E5M2 (5 and 2, maximum about 57,344). Why use E4M3 for weights and activations and E5M2 for gradients? Why can’t either be used without scaling factors, and what does the scaling cost in hardware or software?</p>`,
`<p><strong>The trade-off:</strong> with 8 bits, every exponent bit added is a mantissa bit lost. E4M3 has about 18 binades of range, counting subnormals, and 3 bits of precision (relative step 1/8). E5M2 has about 32 binades and 2 bits (step 1/4).</p>
<ul>
<li><strong>Weights and activations</strong> have a fairly narrow range within a tensor, and their precision directly affects the forward-pass result, so E4M3’s extra mantissa bit matters more than range.</li>
<li><strong>Gradients</strong> span many orders of magnitude within one tensor and across training steps, with rare large values that must not overflow. Range matters more than precision, because each step’s error averages out over many updates.</li>
</ul>
<p><strong>Why scaling is needed:</strong> 448 or 57,344 as a maximum, and minimum normals near 2<sup>−6</sup> and 2<sup>−14</sup>, don’t match where a tensor’s values actually sit. Values would overflow to the maximum or underflow to zero. A scale factor per tensor (or per block of 32 or so values in microscaling formats like MXFP8) maps the tensor’s largest value near the top of the format’s range before converting, and multiplies back afterward.</p>
<p><strong>Costs:</strong></p>
<ul>
<li>Choosing the scale needs the tensor’s maximum absolute value. Computing it exactly means an extra pass. “Delayed scaling” uses the maximum from previous iterations instead, at the risk of overflow when values jump.</li>
<li>Matrix units must accept a scale per operand (or per block) and apply it in the higher-precision accumulator. The accumulation itself stays in FP32 or at least BF16.</li>
<li>Block scaling adds 8 bits of scale per block, a few percent of storage, and logic in the datapath.</li>
</ul>`, "hard") +
`<h3 id="sec-units">Arithmetic Units</h3>` +
Q(`<p>Why does one FMA count as 2 FLOPs in peak-performance figures? A kernel does only FP additions, perfectly vectorized and with enough independent chains. What fraction of the advertised peak can it reach?</p>`,
`<p>An FMA does a multiply and an add, so peak FLOPS = FMA pipes × lanes × 2 × frequency. An addition is 1 FLOP per vector lane per issue slot, whether it runs on the FMA pipe as a × 1 + b (Skylake) or on separate adder pipes (Zen 4, which has 2 FADD pipes next to its 2 FMA pipes). Either way, add-only code reaches at most <strong>half the peak</strong>. The same holds for multiply-only code. Peak FLOPS figures describe dense linear algebra, not general FP code.</p>`, "easy") +
Q(`<p>On Golden Cove, a vector FP add has 2-cycle latency when its result feeds another add, and 3 cycles otherwise. How would you represent this in a cycle-level model, which code would show the difference, and how would you measure it?</p>`,
`<ul>
<li><strong>Model:</strong> latency is a property of the producer–consumer pair, not of the producer alone. Give the adder a fast bypass to its own inputs: when an add’s consumer is also an add, wake it after 2 cycles, otherwise after 3. In a scheduler model this means the wakeup delay depends on the consumer’s opcode class, so it’s easiest to model as an extra cycle on the general bypass path.</li>
<li><strong>Where it shows:</strong> latency-bound add chains, such as a reduction with too few accumulators or a scalar running sum. A single-accumulator FP sum runs 1.5× faster (2 vs. 3 cycles per element). Throughput-bound code with many independent chains doesn’t change.</li>
<li><strong>Measurement:</strong> time a long dependent chain of <code>vaddps</code> (expect 2 cycles each), then a chain alternating <code>vaddps</code> and a 1-cycle op such as <code>vandps</code> or a move into another domain. Subtract the known cost of the other op to get the add-to-other latency.</li>
</ul>`, "medium") +
M(`<p>A hash-table benchmark does independent lookups, each with about 8 cycles of other work and one <code>hash % nbuckets</code> on 64-bit operands, where <code>nbuckets</code> is a prime near 1,000,000. Estimate the cost per lookup on Skylake (64-bit <code>DIV</code>: latency 35–88, reciprocal throughput 21–83) and Ice Lake (latency 15, reciprocal throughput 10). Skylake’s 32-bit DIV has 26-cycle latency and a reciprocal throughput of 6. How would you fix it?</p>`,
`<ol>
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
M(`<p>On Zen 4, 256-bit FMAs have 4-cycle latency and issue 2 per cycle, while 512-bit FMAs are double-pumped: 4-cycle latency, 1 per cycle. (a) Compare peak FP32 FLOPs per cycle and the minimum number of accumulators for each width. (b) An SGEMM micro-kernel nevertheless often runs faster with AVX-512 on Zen 4. AVX2 has 16 architectural vector registers and AVX-512 has 32. Give the reasons, with numbers.</p>`,
`<ol>
<li><strong>(a)</strong> AVX2: 2 × 8 lanes × 2 = 32 FLOPs per cycle. AVX-512: 1 × 16 × 2 = <strong>32 FLOPs per cycle, the same</strong>. Accumulators = latency × issue rate: 4 × 2 = 8 ymm registers, versus 4 × 1 = 4 zmm registers.</li>
<li><strong>(b) More registers, bigger tile:</strong> AVX2 has 16 architectural vector registers, AVX-512 has 32. With a tile of 2 B vectors and broadcast A values, AVX2 fits a 6 × 2-vector tile (12 accumulators + 2 B + 1 broadcast = 15 registers), doing 12 FMAs per 2 B loads and 6 broadcasts: 8 loads per 12 FMAs, or 0.67. AVX-512 fits 14 × 2 (28 + 2 + 1 = 31 registers): 16 loads per 28 FMAs, or 0.57. Fewer loads per FLOP leaves more slack on the load ports and the L1.</li>
<li><strong>Half the instructions per FLOP:</strong> at peak, AVX2 issues 2 FMAs plus about 1.3 loads per cycle, AVX-512 1 FMA plus about 0.6 loads. That leaves much more of Zen 4’s 6-wide rename and its scheduler and ROB capacity for loop overhead, prefetches, and packing code, so the kernel stays closer to peak.</li>
<li><strong>Masking</strong> handles matrix edges without scalar cleanup loops.</li>
<li><strong>What doesn’t change:</strong> peak FLOPs and memory bandwidth. Memory-bound kernels gain little, and the gain on compute-bound kernels is modest, not 2×.</li>
</ol>`, "hard") +
Q(`<p>Why can a 64-bit multiplier accept a new operation every cycle while a divider can’t? Why does a model calibrated on Skylake badly mispredict a hash-table benchmark on Ice Lake or Zen 4?</p>`,
`<p>A multiply sums independent partial products in a tree, which pipelines naturally into stages: 3-cycle latency, one new multiply per cycle. A divide produces quotient digits one step at a time, and each step needs the remainder from the step before. That recurrence reuses the same hardware every iteration, so a new divide can’t start until the unit is free, or at best partly overlaps.</p>
<p>Divider designs vary widely between cores. Agner Fog measures 64-bit DIV at 35 to 88 cycles on Skylake, 15 on Ice Lake, and 10 to 18 on Zen 4. A hash table with a prime bucket count does one divide per lookup, so on Skylake the divider dominates, and on the newer cores it matters far less. A model that keeps Skylake’s divider overstates the cost on newer cores and overstates what replacing the divide (with a multiply by a reciprocal, or a power-of-two table) would gain.</p>`, "medium") +
Q(`<p>A 64-bit integer divide on Skylake takes roughly 35 to 88 cycles depending on the operands, while on Ice Lake it takes about 15 regardless. What makes divide latency data-dependent, what kind of hardware change removes most of it, and how should a model charge divides?</p>`,
`<p><strong>Why it varies:</strong> dividers are iterative: each step produces a fixed number of quotient bits (radix 2 gives 1 bit per step, radix 4 gives 2, radix 16 gives 4). A divider that can skip leading zero bits, or exit early when the remaining quotient bits are known, takes time proportional to the number of significant quotient bits. A 64-by-32 divide with a small quotient finishes much faster than a full 128-by-64 divide. On older Intel cores, 64-bit divides also went partly through microcode, adding uops and latency.</p>
<p><strong>What removes it:</strong> a higher-radix divider, more quotient bits per cycle using SRT-style digit selection with redundant remainders, so each step is fast and the number of steps for 64 bits is small. Ice Lake’s faster divider is the visible result. Once there are only a dozen or so steps, early exit saves little, and latency becomes nearly constant. Newer cores also pipeline parts of the divider, allowing a new divide to start before the previous one finishes, although throughput stays far below a multiply’s.</p>
<p><strong>In a model:</strong></p>
<ul>
<li>A timing-only model doesn’t know operand values, so use a latency distribution measured per workload or a fixed typical value, and say so. A model with values can compute the exact latency from the operand sizes using the target core’s rule.</li>
<li>Model the divider as a non-pipelined (or partly pipelined) resource, so back-to-back independent divides queue.</li>
<li>Calibrate per core. A model calibrated on one generation can be several times wrong on another for divide-heavy code (hashing with modulo, some compression, address calculations with non-power-of-two sizes).</li>
</ul>`, "hard") +
Q(`<p>With FMA units, an add is just an FMA with a multiplier of 1. Yet Zen 4 has separate FP add pipes alongside its FMA pipes, and Golden Cove added fast adders with lower latency than its FMA. Why keep dedicated adders when FMA can do the job?</p>`,
`<p><strong>Latency:</strong> an FMA pipeline is built for the full multiply, align, add, normalize, and round sequence, typically 4 cycles. An add that goes through it pays the same latency. A dedicated adder skips the multiplier array and can take 2 or 3 cycles. Code dominated by dependent additions (reductions, prefix sums, accumulations in physics and finance) runs up to twice as fast on the shorter pipeline.</p>
<p><strong>Throughput:</strong> extra add pipes give more FP operations per cycle in mixed code without the area of more full FMA units. Many kernels have more adds than multiplies, such as sums after products, or complex arithmetic. Zen 4’s two FMA plus two FADD pipes can sustain 4 FP vector operations per cycle when the mix allows.</p>
<p><strong>Area and power:</strong> the multiplier array is most of an FMA unit’s area and switching energy. An adder is much smaller. Using the FMA for every add powers the multiplier for a multiply by 1.</p>
<p><strong>Accuracy is unaffected:</strong> FMA with multiplier 1 and a dedicated add give identical IEEE results (one rounding in both cases), so the choice is purely about performance.</p>
<p><strong>For a model:</strong> FP add and FMA need separate latencies and port sets. A model that treats all FP arithmetic as FMA-latency misses half the speedup of add chains on these cores, and one that treats all adds as fast-adder latency is optimistic on cores without fast adders.</p>`, "hard") +
`<h3 id="sec-model">Arithmetic in Performance Models</h3>` +
M(`<p>At <code>-O3</code> without <code>-ffast-math</code>, GCC does not vectorize <code>float s = 0; for (i = 0; i &lt; n; i++) s += x[i];</code>. Why not? On Zen 4 (FP add latency 3, two 256-bit FP add pipes), how large is the gap to a fully vectorized sum when x is in L1? How can the programmer close it without <code>-ffast-math</code>?</p>`,
`<ul>
<li><strong>Why:</strong> FP addition isn’t associative. Vectorizing splits the sum into lanes and adds them in a different order, which can change the result, and C requires the source order unless reassociation is allowed.</li>
<li><strong>Gap:</strong> the scalar loop is one chain, 1 add every 3 cycles. A vectorized loop with at least 2 × 3 = 6 vector accumulators reaches 2 adds × 8 lanes = 16 elements per cycle. That’s <strong>48× faster</strong>. In practice, loading 64 bytes per cycle becomes the limit first.</li>
<li><strong>Without <code>-ffast-math</code>:</strong> write the reassociation explicitly (several accumulators in the source, combined at the end), use <code>#pragma omp simd reduction(+:s)</code>, or allow <code>-fassociative-math</code> for just that file. All of these give a fixed, deterministic order, unlike <code>-ffast-math</code>, which also enables FTZ and drops NaN and infinity handling for the whole program.</li>
</ul>`, "medium") +
M(`<p>Kahan summation computes, per element, <code>y = x[i] - c; t = s + y; c = (t - s) - y; s = t;</code>. With FP add latency 3 and two 256-bit FP add pipes (16 FP32 adds per cycle, as on Zen 4), what is its throughput as written, compared with a naive single-accumulator sum? How do you get compensated accuracy at close to vectorized speed?</p>`,
`<ol>
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
</ul>`, "medium") +
Q(`<p>Why did inference accelerators favor INT8 before FP8 arrived, and why did many LLM deployments move to FP8 anyway?</p>`,
`<p>An integer multiply-accumulate needs no alignment shifter, normalizer, or rounding, so it is much smaller and lower power than a floating-point one of the same width, and INT32 accumulation is exact. Integer-only pipelines requantize between layers with a fixed-point multiplier and a shift, with no floating point at all.</p>
<p>But INT8’s evenly spaced codes suit narrow, well-behaved distributions. LLM activations have large outliers, so one INT8 scale per tensor either clips the outliers or wastes most of the codes on them. FP8’s spacing grows with magnitude, so it keeps relative precision across a wide range, and training in FP8 keeps the same format end to end. Hardware followed, with FP8 tensor cores on Hopper and Blackwell.</p>`, "medium") +
M(`<p>A CPU socket with 12 channels of DDR5-4800 (460.8 GB/s peak, about 80% sustained) generates tokens from Llama 3 8B (8.03 billion parameters) one at a time, so every token reads all of the weights once. The socket has 96 Zen 4 cores at 3.5 GHz, each with two 256-bit FMA pipes.</p>
<ul>
<li>(a) What is the upper bound on tokens per second with BF16 weights, with INT8 weights and per-channel scales, and with INT4 weights in groups of 128 that each carry an FP16 scale and an FP16 zero point?</li>
<li>(b) At the INT4 rate, how much of the socket’s FP32 compute do the matrix-vector products use?</li>
<li>(c) What breaks this estimate for long contexts and for larger batches?</li>
</ul>`,
`<ol>
<li>Sustained bandwidth ≈ 0.8 × 460.8 ≈ 369 GB/s.</li>
<li><strong>(a)</strong> BF16: 8.03 × 10<sup>9</sup> × 2 B = 16.1 GB per token, about <strong>23 tokens/s</strong>. INT8: 8.03 GB, about <strong>46 tokens/s</strong>. INT4: 4 + 32 / 128 = 4.25 bits per weight, 8.03 × 10<sup>9</sup> × 4.25 / 8 ≈ 4.27 GB, about <strong>86 tokens/s</strong>.</li>
<li><strong>(b)</strong> Each token needs about 2 FLOPs per parameter, 16.1 GFLOP, so 86 tokens/s needs about 1.4 TFLOP/s. Peak is 96 × 3.5 GHz × 2 pipes × 8 FP32 lanes × 2 ≈ 10.8 TFLOP/s, so about <strong>13%</strong>: firmly memory-bound, with room for the dequantization work.</li>
<li><strong>(c)</strong> Long contexts: each token also reads the whole KV cache, which grows with context length and can exceed the weights. Larger batches: the weights are read once for every token in the batch, so the cost per token falls until the socket becomes compute-bound. Both change which bound applies.</li>
</ol>`, "hard") +
Q(`<p>Your model treats every 256-bit vector instruction as one class: latency 4, any of 2 vector ports. List the effects this misses on real x86 cores, and say for each which kind of code it would make the model wrong on.</p>`,
`<ul>
<li><strong>Port restrictions:</strong> shuffles and permutes often run on only one port (port 5 on many Intel cores). Code heavy in shuffles (transposes, string processing, some crypto) is limited to one per cycle. The model says two.</li>
<li><strong>Latency differences by operation:</strong> lane-crossing permutes take about 3 cycles, simple logic ops 1, FP adds 2 to 4, FMA 4, divides and square roots tens of cycles and not fully pipelined. Dependent chains of cheap ops run faster than modeled, divide-heavy code much slower.</li>
<li><strong>Bypass delays:</strong> integer-vector versus FP-vector domains, and transfers to and from general-purpose registers, add cycles.</li>
<li><strong>Width splitting:</strong> some cores execute wide vectors as two halves (Zen 4 runs 512-bit operations on 256-bit units). Throughput halves for those operations.</li>
<li><strong>Upper-lane power-up:</strong> on Skylake-era cores, the upper 128 bits of the vector units are power-gated when idle. The first 256-bit instructions after a quiet period run at reduced throughput for roughly 10 microseconds while the lanes power up. Short bursts of AVX code run slower than steady-state.</li>
<li><strong>Frequency licenses:</strong> heavy 256- and 512-bit use can lower the core clock on some Intel server parts, affecting surrounding scalar code too. The model reports cycles, which hides it.</li>
<li><strong>Memory side:</strong> 32-byte loads that cross a cache line cost two accesses, gathers expand into many uops and loads, and masked stores have their own costs.</li>
</ul>
<p>Fix: model per-operation latency and port sets from the vendor’s tables or measurements, add domain bypass delays, and treat frequency effects in a separate time model. Validate with microbenchmarks for each class before trusting kernel-level results.</p>`, "hard"),
},
{
  id: "intv-branch",
  title: "Branch Prediction and Speculation",
  body: `
<p>Background: <a href="#/branch-hazards">Branch Hazards</a>, <a href="#/stage-if">Instruction Fetch</a>.</p>
<h3 id="sec-cost">The Cost of a Mispredict</h3>` +
M(`<p>A workload runs at IPC 3.0 if every branch were predicted correctly. 20% of instructions are branches, prediction accuracy is 97%, and each mispredict costs 17 cycles. What is the real IPC? What would raising accuracy to 98% buy?</p><p>Then: suppose 4 of the 6 MPKI resolve promptly (17-cycle penalty), but 2 MPKI are branches that depend on L2 misses and resolve 60 cycles later than usual. What is the IPC now?</p>`,
`<ol>
<li>Mispredicts per 1,000 instructions (MPKI): 1,000 × 0.20 × 0.03 = <strong>6</strong>.</li>
<li>Extra cycles per instruction: 6 × 17 / 1,000 = 0.102.</li>
<li>CPI: 1/3.0 + 0.102 = 0.333 + 0.102 = 0.435, so IPC ≈ <strong>2.30</strong>, a 23% loss.</li>
<li>At 98%: MPKI = 4, extra CPI = 0.068, CPI = 0.401, IPC ≈ <strong>2.49</strong>, about 8% faster.</li>
</ol>
<p>The lesson: one point of accuracy is worth about 8% here, and the higher the base IPC, the more each mispredict costs relative to useful work. That’s why predictor research chases fractions of a percent. Also quote MPKI, not accuracy: accuracy hides how many branches there are.</p>
<p><strong>Late-resolving branches:</strong> 4 × 17 + 2 × (17 + 60) = 68 + 154 = 222 extra cycles per 1,000 instructions. CPI = 0.333 + 0.222 = 0.555, so IPC ≈ <strong>1.80</strong> (versus 2.30 when all mispredicts resolve promptly). In this simple additive model, the 2 late MPKI cost more than twice what the other 4 do, which is why improving prediction on branches that depend on cache misses is worth the most.</p>`, "hard") +
Q(`<p>Why can a predictor with 99% accuracy still cost a lot of performance? Give two separate reasons.</p>`,
`<ol>
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
Q(`<p>You estimate that a better predictor removes 2 mispredicts per 1,000 instructions, at 20 cycles each, so it should save 40 cycles per 1,000 instructions. The simulator shows only about half that. Give the mechanisms that make the real saving smaller than mispredicts × penalty, and one that can make it larger.</p>`,
`<p><strong>Why the saving is smaller:</strong></p>
<ul>
<li><strong>Overlap with misses:</strong> many removed mispredicts happened while a cache miss blocked retirement. The refill overlapped the miss, so the mispredict cost little. Removing it saves little.</li>
<li><strong>The removed mispredicts were cheap ones:</strong> branches that resolve quickly cost only the refill. The expensive ones, which depend on slow loads, are often the hard-to-predict data-dependent branches that the new predictor doesn’t fix.</li>
<li><strong>Another limit takes over:</strong> with fewer flushes, the window fills further and hits the next limit (ROB, memory bandwidth, a dependence chain). Part of the time saved goes to waiting on it.</li>
<li><strong>Wrong-path prefetching is lost:</strong> wrong-path loads often touch lines the correct path needs soon after, especially for if-else branches that rejoin. Removing the mispredict removes that free prefetch.</li>
<li><strong>A slower predictor:</strong> if the new predictor has more latency, its override bubbles or extra pipeline stage eat part of the gain.</li>
</ul>
<p><strong>Why it can be larger:</strong> a mispredict also squashes independent work that would have issued useful misses. On memory-bound code, a correct prediction lets the core reach the next miss sooner, raising memory-level parallelism. Removing one mispredict can then save more than its refill penalty.</p>
<p>The point for an interview: “mispredicts × penalty” is an upper bound on a first-order model. The real gain needs simulation, or at least an interval model that knows what each mispredict overlapped with.</p>`, "hard") +
`<h3 id="sec-predictors">Predictor Structures</h3>` +
Q(`<p>A loop branch is taken 3 times then not taken once, repeating (pattern T T T N). What is the misprediction rate with (a) a 1-bit last-outcome predictor, (b) a 2-bit saturating counter, (c) a predictor using the branch’s own last 4 outcomes as history?</p>`,
`<ol>
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
M(`<p>A new predictor improves accuracy but needs 2 cycles to produce a prediction instead of 1. The workload is integer code with a taken branch every 8 to 10 instructions, and fetch is 6 wide. Could the core get slower? How would real designs avoid the problem, and how would you decide?</p>`,
`<p>Yes. Fetch needs the next fetch address every cycle. With a 2-cycle predictor, every taken branch costs a bubble while fetch waits for the target. With a taken branch every 8 to 10 instructions and 6-wide fetch that’s a bubble every second fetch block or so, which can cost several percent of front-end bandwidth.</p>
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
M(`<p>A TAGE-like predictor has a base table of 4K 2-bit counters plus 4 tagged tables of 1K entries, each entry with a 3-bit counter, a 2-bit “useful” counter, and a 9-bit tag. (a) What is the total storage? (b) Why tags? If 300 hot branches hash into one untagged 1K-entry table, what fraction of them share an entry with at least one other? (c) What does a 9-bit tag buy?</p>`,
`<ol>
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
`<ol>
<li><strong>(a)</strong> Consecutive opcodes are always different, so the last target is always wrong: <strong>100%</strong> mispredicted.</li>
<li><strong>(b)</strong> Each handler’s own jump always goes to the same successor in this program, so each site’s last target is right: about <strong>0%</strong> after warm-up. Mispredicts return only for opcodes that appear in several places with different successors.</li>
<li><strong>(c)</strong> A predictor that hashes recent branch history (or the path of recent targets) with the jump address sees a different history at each position in the sequence, so it can predict the single shared jump almost perfectly too. Modern indirect predictors largely erased the old advantage of threaded code; measurements on recent cores confirm interpreters mispredict far less than folklore says.</li>
</ol>`, "hard") +
Q(`<p>In TAGE, why does the predictor sometimes ignore the longest matching table and use the next-longest match instead? Why are the “useful” counters decayed periodically?</p>`,
`<p>The provider is the matching entry with the longest history. An entry that was just allocated, after a mispredict, starts with a weak counter and hasn’t learned anything yet, often for a situation that won’t repeat. While it is new and weak, the alternate prediction (a shorter history that is already trained) is more often right, so TAGE uses it. A small global counter tracks whether that choice is paying off.</p>
<p>Useful counters protect entries that have earned their place (the provider was right when the alternate was wrong) from replacement. Without decay, entries that were useful in an old program phase would stay protected forever, allocation would find no victims in the long-history tables, and the predictor would stop learning new patterns. Periodic decay lets stale entries be replaced.</p>`, "medium") +
M(`<p>You have a 32 KB budget for a direction predictor.</p>
<ul>
<li>(a) gshare with 2-bit counters: how many entries, and how many history bits can it use?</li>
<li>(b) A perceptron predictor with 8-bit weights, 63 history bits, and a bias weight: how many perceptrons fit?</li>
<li>(c) A server workload has about 4,000 hot static branches. Which design suffers more from aliasing, and what can each learn that the other can’t?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> 32 KB × 8 = 262,144 bits / 2 = 131,072 = 2<sup>17</sup> entries, a 17-bit index, so at most <strong>17 history bits</strong> XORed with the PC.</li>
<li><strong>(b)</strong> Each perceptron is 64 × 8 = 512 bits, so 262,144 / 512 = <strong>512 perceptrons</strong>.</li>
<li><strong>(c)</strong> The perceptron puts about 4,000 / 512 ≈ 8 branches on each row, and branches with different correlations fight over the same weights: much heavier aliasing. gshare spreads each branch over many counters, one per history pattern.</li>
<li>What each can learn: the perceptron sees 63 bits of history but learns only linearly separable functions of it. gshare learns any function of its 17 bits, one counter per pattern, but nothing older. Hashed perceptrons and TAGE are the ways to get long history without either limit.</li>
</ol>`, "medium") +
Q(`<p>What is static branch prediction, and why does “backward taken, forward not taken” work as well as it does? Where is static prediction still used in modern cores?</p>`,
`<p><strong>Static prediction</strong> decides the direction from the instruction itself, without any history. The classic rule is backward taken, forward not taken (BTFN):</p>
<ul>
<li>A branch whose target is at a lower address (backward) is usually a loop’s closing branch, which is taken on every iteration except the last.</li>
<li>A forward branch is often a check for a rare case (error handling, a bounds check), which is usually not taken. Compilers lay out code so that the common path falls through.</li>
</ul>
<p>On typical code BTFN gets roughly two thirds to three quarters of branches right, much worse than a dynamic predictor’s 95% to 99%, but far better than nothing.</p>
<p><strong>Where it is still used:</strong></p>
<ul>
<li>The first time a branch is seen, when it misses in the BTB and the predictor has no entry. Decode can recognize a backward direct branch and redirect fetch early.</li>
<li>Through compiler layout: <code>__builtin_expect</code> and profile-guided optimization put the likely path first, which helps both static fallbacks and the instruction cache.</li>
<li>Some ISAs have had hint bits in branch instructions, though modern x86 cores ignore the old prefix hints.</li>
</ul>`, "easy") +
Q(`<p>What is a global history register, what goes into it, and why does a predictor that uses it predict better than one that only looks at each branch’s own past?</p>`,
`<p>A <strong>global history register</strong> is a shift register holding the outcomes of the most recent branches the program executed, all branches together: 1 for taken, 0 for not taken, newest at one end. Modern designs keep hundreds or thousands of bits, and often fold in path information such as some bits of each branch’s address or target.</p>
<p>The predictor combines the history with the branch’s address (for example by XOR, as gshare does) to index a table of counters. The same branch then gets different predictions depending on how the program got there.</p>
<p><strong>Why it helps:</strong> branches are correlated. In</p>
<pre><code>if (x &gt; 0) a = 1;
if (x &gt; 5) b = 2;</code></pre>
<p>the second branch is never taken when the first wasn’t. Its own past says nothing about that, but the outcome of the previous branch, which sits in the global history, gives it away. Loop exits, nested conditions, and checks on the same variable all create correlations like this.</p>
<p>The history is updated speculatively with each predicted outcome as the front end runs ahead, and repaired on a mispredict.</p>`, "easy") +
Q(`<p>Zen 1 used a hashed perceptron predictor, and Zen 2 added a TAGE predictor behind it. What kinds of branches does each capture well, where does each fail, and why would a design use both?</p>`,
`<p><strong>Perceptron:</strong> each branch (hashed by address) has a vector of weights, one per history bit. The prediction is the sign of the weighted sum of the history bits. Training adjusts the weights when the prediction was wrong or not confident.</p>
<ul>
<li>Strength: it can use very long histories, since cost grows linearly with history length, and it learns which history bits matter, ignoring the rest. Good when the outcome is correlated with a few specific branches far back.</li>
<li>Weakness: it can only learn <em>linearly separable</em> functions of the history. A branch whose outcome is the XOR of two earlier branches can’t be learned. Computing a large sum also adds latency.</li>
</ul>
<p><strong>TAGE:</strong> several tagged tables indexed by geometrically increasing history lengths, with the longest matching entry providing the prediction.</p>
<ul>
<li>Strength: it memorizes exact history patterns, so any function of the history works, including non-linear ones. Short histories train fast, and long ones catch rare deep correlations.</li>
<li>Weakness: every distinct pattern needs its own entry. Branches whose outcome depends on one bit far back, with noise in between, create many patterns and waste capacity, where a perceptron would need one weight.</li>
</ul>
<p><strong>Why both:</strong> they fail on different branches, so combining them (as a second-level predictor that overrides the first, or as a statistical corrector on top of TAGE) captures more of both kinds. The cost is storage, power, and latency, which is why the larger predictor typically runs a cycle or two behind a fast first-level one.</p>`, "hard") +
Q(`<p>The best academic predictor in recent competitions is TAGE-SC-L: TAGE plus a statistical corrector (SC) and a loop predictor (L). What does each addition fix that TAGE alone gets wrong?</p>`,
`<p><strong>Loop predictor:</strong> a loop that runs exactly <em>N</em> iterations each time is perfectly predictable: taken <em>N</em> − 1 times, then not taken. TAGE can only learn the exit if its history covers all <em>N</em> iterations and the history is clean, which fails for loops of hundreds of iterations, or loops whose bodies contain other branches that fill the history with noise. The loop predictor counts iterations per branch, and once it has seen the same trip count several times in a row, it predicts the exit with high confidence.</p>
<p><strong>Statistical corrector:</strong> TAGE predicts from exact pattern matches. Some branches are biased (taken 80% of the time regardless of history) or correlate weakly with many history bits. TAGE’s weak or newly allocated entries can predict them worse than their plain bias. The corrector is a perceptron-like sum of counters indexed by the branch address, the TAGE prediction, and several short histories. When TAGE’s confidence is low and the corrector strongly disagrees, the corrector’s prediction is used.</p>
<p><strong>The combination:</strong> TAGE handles most branches. The corrector catches the statistically biased ones where TAGE is unsure, and the loop predictor catches long fixed-count loops. Each addition adds only a few percent to the storage but removes a class of mispredicts.</p>
<p>In a commercial design, the loop predictor is the easiest to justify: cheap, and it fixes a predictable case. The statistical corrector is harder because it adds latency on the prediction path.</p>`, "hard") +
Q(`<p>A server binary with tens of megabytes of hot code mispredicts much more in your model than the same predictor does on SPEC CPU, even though most of its branches are individually simple. Explain the role of aliasing, how tagging and hashing reduce it, and what this means for evaluating predictors.</p>`,
`<p><strong>Aliasing:</strong> predictor tables are indexed by a hash of the branch address and history. With many branches, unrelated branches map to the same entry and overwrite each other’s state.</p>
<ul>
<li><strong>Destructive aliasing:</strong> two branches with opposite behavior share a counter, so each one’s update pushes the other toward a wrong prediction.</li>
<li><strong>Constructive or neutral aliasing:</strong> two mostly-taken branches share a counter and agree. No harm, sometimes faster training.</li>
</ul>
<p>SPEC CPU benchmarks mostly have small branch footprints that fit in the tables, so aliasing is rare. A server binary with hundreds of thousands of active branches doesn’t fit, and the predictor degrades toward a cold or contended state.</p>
<p><strong>Reducing it:</strong></p>
<ul>
<li><strong>Tags</strong> (TAGE): an entry is used only if a partial tag of the branch and history matches, so a conflicting branch misses and falls back to a shorter history instead of using wrong state. Costs bits per entry.</li>
<li><strong>Better hashing:</strong> XOR-folding long histories with the address spreads branches over the table. A poor hash concentrates them.</li>
<li><strong>Bias tables and bimodal fallbacks:</strong> keep a small amount of state per branch for the common case where history isn’t needed.</li>
<li><strong>Larger tables or a second level:</strong> more entries, at the cost of latency, often in the BTB as well, since BTB misses grow the same way.</li>
</ul>
<p><strong>For evaluation:</strong> a predictor tuned on SPEC CPU can rank wrongly on servers. Include large-footprint traces (databases, JVMs, web servers) and report MPKI by suite. Also check warm-up: on large-footprint workloads, short traces never warm the predictor, so measured MPKI is inflated.</p>`, "hard") +
Q(`<p>Binary search and branchy sorts have branches whose outcomes depend on data and look random to any history-based predictor. What can hardware do about them, what can software do, and what does each cost?</p>`,
`<p><strong>Software:</strong></p>
<ul>
<li><strong>Branchless code:</strong> replace the branch with a conditional move or arithmetic. In binary search, compute the next index with <code>cmov</code>. The data dependence remains, but there are no mispredicts. Cost: both paths’ work is always done, and the select sits on the dependence chain, so when the branch is predictable this is slower.</li>
<li><strong>Restructuring:</strong> branch-free layouts (Eytzinger order for search trees) also improve cache behavior, and sorts that partition with branchless loops avoid the 50% unpredictable compare.</li>
<li><strong>Prefetching both sides:</strong> in a search, prefetch both possible next elements so that a mispredict at least doesn’t also cost a cache miss.</li>
</ul>
<p><strong>Hardware:</strong></p>
<ul>
<li><strong>Predication or select-on-the-fly:</strong> convert a hard-to-predict short hammock into a select at decode (dynamic predication, studied but rarely shipped). Needs confidence estimation to apply it only to unpredictable branches.</li>
<li><strong>Branch precomputation or runahead:</strong> run the branch’s backward slice (the few instructions that compute its condition) ahead of the main thread, so the outcome is known before fetch reaches the branch. Effective when the slice is short and its inputs are available early. Costs a second execution context and slice-extraction logic.</li>
<li><strong>Faster resolution:</strong> reducing the time from fetch to resolve (shorter pipelines, prioritizing the branch’s inputs) shrinks the cost of each mispredict without removing it.</li>
</ul>
<p>For data-dependent branches, software fixes are usually the practical ones. Hardware can only guess the data, so its options amount to computing the condition earlier.</p>`, "hard") +
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
M(`<p>The front end delivers 6 uops per cycle when not stalled. A mispredicted branch resolves on average 25 cycles after it is fetched, there are 8 mispredicts per 1,000 instructions, and the correct path averages 1.1 uops per instruction. What fraction of fetched uops could be wrong-path? Why is that an upper bound, and why does it matter even when it doesn’t cost time?</p>`,
`<ol>
<li>Correct-path uops per 1,000 instructions: 1,100.</li>
<li>Wrong-path uops per mispredict: at most 6 × 25 = 150, so 8 × 150 = 1,200 per 1,000 instructions.</li>
<li>Wrong-path fraction: up to 1,200 / 2,300 ≈ <strong>52%</strong> of everything fetched.</li>
</ol>
<p>It’s an upper bound because the front end doesn’t always run at full speed on the wrong path: it can stall when the back end fills up, miss in the i-cache, or hit another branch, and the ROB caps how much is in flight. But even the real number is large. Wrong-path work mostly overlaps with the correct path’s stall time, so its cost shows up less in time than in energy: fetching, decoding, renaming, and often executing hundreds of uops that are thrown away. That’s why better prediction often saves more power than performance.</p>`, "hard") +
M(`<p>A short if–else has 3 instructions on each side. The branchy version executes the branch plus one side (4 instructions); the if-converted version executes both sides plus a select (7 instructions). The core runs this code at 4 instructions per cycle, and a mispredict costs 17 cycles. Above what misprediction rate does if-conversion win (a) if the select is off the critical path, and (b) if it adds 1 cycle to a loop-carried chain? (c) Why do compilers often choose wrong?</p>`,
`<p>Branchy: 4 / 4 = 1 cycle + <em>p</em> × 17. If-converted: 7 / 4 = 1.75 cycles, plus 1 cycle if the select lengthens the critical chain.</p>
<ol>
<li><strong>(a)</strong> 1 + 17<em>p</em> = 1.75, so <em>p</em> = <strong>4.4%</strong>.</li>
<li><strong>(b)</strong> 1 + 17<em>p</em> = 2.75, so <em>p</em> = <strong>10.3%</strong>.</li>
<li><strong>(c)</strong> The compiler doesn’t know the misprediction rate. Profiles give taken frequencies, not mispredict rates: a branch taken 50% of the time can be perfectly predictable if it alternates, and a 90/10 branch with random outcomes mispredicts about 10%. The right choice also depends on the core (penalty, width) and on whether the select lands on a critical chain, which static heuristics see poorly.</li>
</ol>`, "hard") +
Q(`<p>The predictor runs dozens of branches ahead of execution. Why must it shift predicted outcomes, not real ones, into the global history? What is saved per branch to repair the history after a mispredict, and why are the counters usually updated at retire instead?</p>`,
`<p>Waiting for real outcomes would leave the history many branches stale: every prediction would be indexed with a history that doesn’t match the path being fetched, and back-to-back branches would see the same history. So predicted outcomes are shifted in speculatively.</p>
<p>Repair: after a mispredict, the history must return to its value at that branch, with the correct outcome shifted in. The history lives in a circular buffer, so each in-flight branch saves only the head pointer (plus TAGE’s folded-history registers, or enough to recompute them), and recovery restores the pointer and inserts the correct bit. The return stack’s top pointer is saved the same way.</p>
<p>Counters and table entries are updated at resolution or retire, using indices saved at prediction time. Updating them speculatively would train the tables on wrong-path branches, for a small gain on tight loops.</p>`, "medium") +
Q(`<p>Spectre v1 uses an ordinary bounds check: <code>if (i &lt; len) y = table[array[i] * 64];</code>. Explain how it leaks memory, why it is a prediction problem rather than a bug in the check, and why index masking is preferred over an <code>lfence</code> after the check.</p>`,
`<p>The attacker trains the branch with in-bounds values of i, then calls it with an out-of-bounds i while <code>len</code> isn’t cached, so the check resolves slowly. The predictor says “in bounds,” and the core speculatively loads <code>array[i]</code>, a secret byte beyond the array, and then <code>table[secret × 64]</code>, which brings a secret-dependent line into the cache. The branch resolves and the registers are restored, but the line stays, and Flush+Reload over <code>table</code> recovers the byte.</p>
<p>The check is architecturally correct. The leak comes from speculation running ahead of it, which is exactly what branch prediction is for.</p>
<p>An <code>lfence</code> after the check stops later instructions until the check resolves: tens of cycles on every call, which hurts in hot code. Index masking computes a mask from the comparison without a branch and ANDs it into the index, so on the wrong path the index becomes in-bounds (often 0) through a data dependency. Speculation can no longer reach outside the array, at the cost of a couple of ALU operations and no stall.</p>`, "medium") +
M(`<p>Your TAGE predictor’s longest history is 1,024 branches. Up to 128 predicted fetch blocks can be in flight between prediction and retirement, and each block shifts in at most 2 history bits.</p>
<ul>
<li>(a) How large must the circular history buffer be, and how many bits does a checkpoint pointer need?</li>
<li>(b) Compare checkpointing a pointer per block with copying the whole history per block.</li>
<li>(c) TAGE computes its indices and tags from folded histories that are updated incrementally. With 12 tables, each with 3 folded registers of 11 bits on average, what else must a checkpoint hold, or what must recovery do instead?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> It must hold the 1,024 bits the longest table reads plus up to 128 × 2 = 256 speculative bits: <strong>1,280 bits</strong>. Indexing 1,280 positions (or 2,048, for power-of-two wraparound) takes an <strong>11-bit pointer</strong>.</li>
<li><strong>(b)</strong> Pointers: 128 × 11 = 1,408 bits, 176 bytes. Full copies: 128 × 1,024 = 131,072 bits, <strong>16 KB</strong>, about 93× more, and each copy would have to be written in the cycle the block is predicted.</li>
<li><strong>(c)</strong> The folded registers are 12 × 3 × 11 = 396 bits per checkpoint. Checkpointing them costs 128 × 396 = 50,688 bits, about <strong>6.2 KB</strong>. The alternative is to undo them: each update shifts a new bit in and the bit at its table’s history length out, so recovery can reverse the updates for the squashed bits by reading them back from the circular buffer, at a few cycles per bit. Recovery sits on the mispredict path, so many designs pay for the checkpoints.</li>
</ol>`, "hard") +
Q(`<p>A trace-driven model can’t fetch wrong-path instructions: after a mispredict it just stalls fetch until the branch resolves. List the effects this misses and say whether each makes the model optimistic or pessimistic.</p>`,
`<ul>
<li><strong>Wrong-path cache prefetching</strong> (model pessimistic): wrong-path loads and instruction fetches often touch lines the correct path needs soon, especially on if-else paths that rejoin. On some workloads this is a significant benefit.</li>
<li><strong>Cache and TLB pollution</strong> (model optimistic): wrong-path accesses evict useful lines and fill MSHRs with requests the core will never use, and can tie up DRAM bandwidth.</li>
<li><strong>Resource contention</strong> (model optimistic): wrong-path uops occupy ports, scheduler entries, and load-queue entries while they run, delaying older correct-path work that is still executing.</li>
<li><strong>Predictor state</strong> (either way): wrong-path branches may update the global history and return-address stack speculatively. If the real design repairs them perfectly, there is no effect. If repair is imperfect (the RAS especially), real accuracy is lower than modeled.</li>
<li><strong>Branch resolution timing</strong> (model optimistic): wrong-path instructions compete with the mispredicted branch’s own inputs, which can delay its resolution.</li>
<li><strong>Power</strong> (model optimistic): wrong-path work is a real fraction of the dynamic energy, often 10% or more on branchy code.</li>
</ul>
<p>Net effect on IPC is usually a few percent and workload-dependent, often close to cancelling. It matters most for studies of caches and prefetchers (where wrong-path accesses change hit rates) and of power. To bound it without a full execution-driven model, some trace models inject synthetic wrong-path loads using addresses from nearby correct-path code.</p>`, "hard") +
Q(`<p>A local-history predictor keeps a separate history per branch in a table. Why is it much harder to update speculatively and repair after a mispredict than a global history register? What do real designs do instead?</p>`,
`<p><strong>Global history</strong> is one shift register. Speculative update is a shift, and repair means restoring the register’s value at the mispredicted branch, which is cheap to checkpoint (or to recover with a pointer into a circular buffer of outcomes).</p>
<p><strong>Local histories</strong> are many entries, one per branch, in a table. A loop branch inside a tight loop may have several instances in flight at once. Problems:</p>
<ul>
<li>To predict instance <em>k</em>, the history must include the predicted outcomes of instances 1 to <em>k</em> − 1, which haven’t resolved. So the table entry must be updated speculatively at prediction time.</li>
<li>On a mispredict, every entry updated by wrong-path branches must be restored. That is an arbitrary set of entries, not one register, so a single checkpoint doesn’t work. You need either an undo log of (entry, old value) per in-flight branch, or per-entry speculative copies.</li>
<li>If updates wait until retirement, in-flight instances read stale history, and a loop with several iterations in flight predicts all of them from the same old pattern.</li>
</ul>
<p><strong>What designs do:</strong></p>
<ul>
<li>Rely on global history, which captures most of what local history would, given long enough histories (TAGE).</li>
<li>Use a loop predictor, a special case of local history, with a small number of entries and speculative iteration counters that are simple to repair: on a mispredict, reset to the retired count.</li>
<li>Accept imperfect repair for the remaining local components, since a few mispredicts after a flush cost less than full repair logic.</li>
</ul>`, "hard") +
`<h3 id="sec-eval">Evaluating a Predictor</h3>` +
Q(`<p>Design an experiment to evaluate a new branch predictor. Why report both MPKI and IPC?</p>`,
`<ol>
<li><strong>Workloads:</strong> SPEC CPU int (branch-heavy), plus server and browser traces with large code footprints, where BTB capacity and indirect branches matter.</li>
<li><strong>Warm-up:</strong> large predictors need tens of millions of instructions to train. Use long warm-up or continuous traces, or you’ll undercount a big predictor’s benefit.</li>
<li><strong>Fast step:</strong> a trace-driven predictor simulator for MPKI across many configurations and storage budgets, against a baseline such as a TAGE of the same storage.</li>
<li><strong>Timing step:</strong> full cycle-level simulation of the most promising points, with the predictor’s real latency and update timing.</li>
<li><strong>Costs:</strong> storage in KB, access latency, energy per prediction.</li>
</ol>
<p>Both, because MPKI treats all mispredicts as equal. In timing, a mispredict on a branch that resolves in 10 cycles costs much less than one on a branch waiting for a DRAM miss, and a predictor that adds fetch latency can lose IPC despite better MPKI.</p>`, "medium") +
Q(`<p>How would you tell a branch-prediction bottleneck from a memory bottleneck, given that the two interact?</p>`,
`<p>First pass: slot accounting. Bad speculation (slots spent on squashed work plus recovery) versus back-end memory-bound slots. Then MPKI and the average resolution time of mispredicted branches, against misses per 1,000 instructions per cache level.</p>
<p>The interaction: a mispredicted branch that depends on a miss is both. To separate them, use the simulator’s ability to idealize: run with a perfect predictor, with a perfect cache, and with both. If perfect prediction gains 5%, perfect cache 30%, and both 50%, the effects are not additive, and the interaction (branches waiting on misses) is itself a target, for example for prefetching the data the branch depends on.</p>`, "medium") +
Q(`<p>A trace-driven predictor study updates the predictor immediately after each branch, but the real design updates at retire. On which code does the study overstate accuracy most? How would you make the study honest without building a full timing model?</p>`,
`<p>It overstates most where several instances of the same branch are in flight before the first one resolves: tight loops, short trip counts, and branches whose behavior changes in phases. With instant updates, iteration n + 1 is predicted with iteration n’s outcome already trained in. In hardware it sees counters from several iterations earlier, and after a phase change it keeps mispredicting until the first wrong prediction retires and retrains the entry.</p>
<p>To make it honest:</p>
<ul>
<li>Keep the history speculative and immediate, as hardware does, but delay table updates by a realistic number of branches through a FIFO of pending updates. The window size divided by the branch spacing is a good first estimate.</li>
<li>Report MPKI with no delay and with the realistic delay, and treat the gap as the study’s error bar.</li>
<li>Where possible, add wrong-path history pollution and repair, which a trace has no record of.</li>
</ul>`, "hard") +
Q(`<p>A new predictor lowers MPKI on your trace suite, but on the real system it gives no gain, and on some workloads raises MPKI. What differences between trace studies and real execution could explain it?</p>`,
`<ul>
<li><strong>Context switches and interrupts:</strong> traces of one user process run uninterrupted. Real systems switch to other processes, the kernel, and interrupt handlers, which overwrite predictor state. A predictor that needs long warm-up (big tables, long histories) loses more on every switch than a small, fast-training one.</li>
<li><strong>SMT sharing:</strong> two threads share the tables. A predictor sized for one thread’s working set thrashes with two.</li>
<li><strong>Kernel and library code:</strong> traces often omit OS code, which has many branches executed rarely, hard on large tables.</li>
<li><strong>Trace length and warm-up:</strong> short traces don’t represent long-run behavior, and warm-up done differently from the real machine can bias results either way.</li>
<li><strong>Update timing:</strong> trace studies often update immediately after each branch, while hardware updates at resolution or retirement, so tight loops see stale state. Predictors relying on fast training are overestimated.</li>
<li><strong>Latency:</strong> a larger predictor may need more cycles, leading to more override bubbles or a split into fast and slow levels. The MPKI gain is real, but cycles are lost elsewhere.</li>
<li><strong>Security mitigations:</strong> predictor flushes or partitioning on privilege changes (against Spectre v2) wipe state frequently on some systems.</li>
</ul>
<p>The fix: evaluate with full-system traces including the OS, with realistic context-switch intervals and SMT pairing, update the predictor at the time the real design would, and measure IPC in a timing model, not only MPKI.</p>`, "hard"),
},
{
  id: "intv-fe",
  title: "Front End and Fetch",
  body: `
<p>Background: <a href="#/r/fe">Front End and Branch Prediction</a>, <a href="#/fe-decoupled">Decoupled Fetch and the Fetch Target Queue</a>, <a href="#/fe-targets">Branch Targets</a>, <a href="#/fe-decode">Decoders and the Op Cache</a>, <a href="#/stage-if/way-pred">Way Prediction</a>.</p>
<h3 id="sec-decouple">Decoupling and Run-Ahead</h3>` +
Q(`<p>In a coupled front end, an instruction cache miss stops the branch predictor too. What changes when a fetch target queue (FTQ) sits between them? Name two front-end losses the queue can’t hide.</p>`,
`<p>The predictor no longer waits for fetch:</p>
<ul>
<li><strong>It runs ahead during misses.</strong> While fetch waits on the instruction cache, the predictor keeps producing fetch blocks, so their addresses are known early and can drive prefetching (FDIP).</li>
<li><strong>Short predictor bubbles disappear.</strong> A second-level BTB lookup or an override costs nothing if the queue still holds blocks for fetch.</li>
</ul>
<p>What it can’t hide:</p>
<ul>
<li><strong>Mispredicts and BTB misses.</strong> Everything queued after a wrong prediction is flushed and the lead drops to 0. A taken branch missing from the BTB is invisible, so the predictor runs down the fall-through path until decode or execute redirects.</li>
<li><strong>Tight loops.</strong> When every block ends in a taken branch, each prediction needs the one before it, the predictor can’t get ahead, and the queue stays nearly empty. Every taken-branch bubble then reaches fetch.</li>
<li><strong>Long misses.</strong> An instruction cache miss longer than the queue’s lead still starves decode.</li>
</ul>`, "easy") +
Q(`<p>A fetch block and a fetch group often cover the same bytes. Define each, then say which unit you’d count in for FTQ occupancy, the prefetch lead, decode starvation, and taken branches followed per cycle.</p>`,
`<ul>
<li><strong>Fetch block:</strong> the unit of prediction. The predictor produces it and it is one FTQ entry, from a start address to the first predicted-taken branch or the block’s size limit. Control flow sets its length.</li>
<li><strong>Fetch group:</strong> the unit of delivery. It is what fetch hands to decode in one cycle: at most one fetch window, and never past the end of the current block. Fetch bandwidth sets its length.</li>
</ul>
<p>Units:</p>
<ul>
<li><strong>FTQ occupancy:</strong> blocks, one per entry.</li>
<li><strong>Lead:</strong> occupancy in blocks divided by blocks consumed per cycle. A block longer than one window holds the FTQ head for several cycles, so it is consumed at less than one per cycle and the lead is longer than the block count suggests.</li>
<li><strong>Decode starvation:</strong> groups, since a bubble is a cycle with no group or a short one. Useful bytes per group against the window size shows how much bandwidth taken branches and misaligned targets waste.</li>
<li><strong>Taken branches per cycle:</strong> blocks, since each taken branch ends one.</li>
</ul>`, "easy") +
Q(`<p>A fast single-cycle predictor is overridden two cycles later by a TAGE predictor when they disagree. In a tight loop the override bubbles show up directly in IPC. On a large server binary with the same override rate, they mostly don’t. Why? How should a model charge an override so it gets both cases right?</p>`,
`<p>The bubble happens at the predictor, not at fetch. Whether it reaches decode depends on how much work is already queued:</p>
<ul>
<li><strong>Tight loop:</strong> every block ends in a taken branch, so each prediction needs the previous one and the FTQ stays nearly empty. A 2-cycle override becomes 2 cycles with nothing to fetch.</li>
<li><strong>Server code:</strong> the predictor is often far ahead, because it kept running during earlier instruction cache misses. Fetch keeps reading older FTQ entries while the predictor redirects, and the override flushes only the blocks predicted after the fast prediction, so the bubble is absorbed.</li>
</ul>
<p>In the model:</p>
<ul>
<li>Charge the override at the predictor as lost prediction cycles, and flush only the blocks predicted since the fast prediction, never the back end.</li>
<li>Let the FTQ, fetch queue, and decode queue absorb it. The accounting at rename then sees it only when it actually starves rename: as front-end latency in cycles with nothing delivered, and as front-end bandwidth otherwise.</li>
<li>Count overrides separately from full mispredicts, since their costs differ by about an order of magnitude.</li>
</ul>`, "hard") +
`<h3 id="sec-fetch">Fetch Bandwidth and Alignment</h3>` +
M(`<p>A hot loop is 12 instructions in 52 bytes, ending in a taken branch to its top. It runs from the legacy decode path, which fetches one aligned 32-byte window per cycle, and rename is 6 wide.</p>
<ul>
<li>(a) How many cycles per iteration does it take at each start offset (0 to 31) within its window?</li>
<li>(b) If the start offset is equally likely to be any byte from 0 to 31, what is the expected cycles per iteration?</li>
<li>(c) What do 16-byte and 32-byte alignment of the loop head give?</li>
</ul>`,
`<ol>
<li>Windows touched = ⌊(offset + 52 − 1) / 32⌋ + 1.</li>
<li><strong>(a)</strong> Offsets 0 to 12 give offset + 51 ≤ 63, so 2 windows. Offsets 13 to 31 give 3 windows. Rename needs 12 / 6 = 2 cycles per iteration, so the loop takes <strong>2 cycles</strong> at offsets 0 to 12 (fetch and rename tie) and <strong>3 cycles</strong> at offsets 13 to 31, where fetch binds.</li>
<li><strong>(b)</strong> (13 × 2 + 19 × 3) / 32 = 83 / 32 ≈ <strong>2.59 cycles</strong>.</li>
<li><strong>(c)</strong> 32-byte alignment always gives offset 0: <strong>2 cycles</strong>, 1.30× faster than the expected unaligned case. 16-byte alignment gives offset 0 or 16 with equal odds: (2 + 3) / 2 = <strong>2.5 cycles</strong>, barely better than chance, because a 52-byte loop fits in 2 windows only at offsets up to 12.</li>
<li>This is how a loop can slow down by a third with no source change, and why aligning loop heads to 32 bytes helps this loop where 16-byte alignment doesn’t.</li>
</ol>`, "medium") +
Q(`<p>The same hot loop runs measurably slower after an unrelated code change shifts its address by a few bytes. How can alignment change front-end throughput on an x86 core? Name the alignment boundaries that matter and what the uop cache and loop buffer change.</p>`,
`<p><strong>Fetch blocks:</strong> the legacy decode path fetches aligned 16- or 32-byte blocks. A loop body that fits in one block when aligned may straddle two after a shift, so each iteration needs an extra fetch cycle, and the taken branch at the end may land in a block with few useful bytes.</p>
<p><strong>The uop cache:</strong> entries are tied to aligned code regions (32 or 64 bytes depending on the core), with a limit on uops and on branches per region. A shift can split the loop over more regions, or push a region over its limit so it can’t be cached and falls back to the slower decoders.</p>
<p><strong>The JCC erratum fix on Skylake-derived cores:</strong> after a microcode update, jumps that cross or end on a 32-byte boundary can’t be cached in the uop cache. A loop branch that moves onto a boundary goes through the legacy decoders every iteration.</p>
<p><strong>Loop buffer:</strong> when the loop fits, uops replay from the allocation queue and fetch alignment no longer matters. But the buffer has a size limit, and a loop just over it becomes alignment-sensitive.</p>
<p><strong>What to do:</strong> compilers align hot loop heads (<code>-falign-loops</code>) and assemblers can pad to avoid boundary-crossing jumps. When benchmarking, randomize or control code layout (link order, environment size), since an alignment effect of a few percent can look like a real change.</p>`, "medium") +
`<h3 id="sec-prefetch">Prefetching and BTB Reach</h3>` +
Q(`<p>Fetch-directed instruction prefetching (FDIP) keeps no tables of its own. Why is that its main strength? Why does it also mean that the BTB, not the prefetcher, decides how much instruction cache latency gets hidden?</p>`,
`<p><strong>Strength:</strong> the branch predictor already is a model of the program’s control flow. FDIP just reads future addresses from the FTQ, filters out lines that are present or in flight, and requests the rest. It needs no extra storage or training, and it follows calls and far taken branches that next-line and stream prefetchers can’t. Engineers at Arm (Ishii et al., 2021) showed that FDIP with a large enough BTB matches far more complex prefetchers on server traces.</p>
<p><strong>Why the BTB decides:</strong> FDIP is accurate exactly as long as the predictor is right, and it reaches only as far as the predictor runs ahead.</p>
<ul>
<li>A taken branch missing from the BTB sends the predictor down the fall-through path. FDIP then issues wrong-path prefetches, and the eventual redirect flushes the FTQ and resets the lead to 0.</li>
<li>So the useful lead is bounded by the FTQ depth and by the distance to the next BTB miss.</li>
<li>The lines FDIP exists to fetch are the ones not in the instruction cache, so the BTB has to know the branches in code that only the L2 holds. Its reach must cover more code than the instruction cache does.</li>
</ul>
<p>That’s why research designs (Confluence, Boomerang, Shotgun) attack BTB capacity and BTB filling rather than the prefetcher itself.</p>`, "medium") +
Q(`<p>Your trace-driven front-end model takes the next PC from the trace after every branch, including taken branches that miss in the BTB. FDIP coverage looks excellent. What is the model getting wrong, and what does fixing it change in the results?</p>`,
`<p>The trace tells the model the correct path when the real predictor couldn’t know it. In hardware, a taken branch missing from the BTB is invisible. The predictor continues sequentially and FDIP prefetches wrong-path lines. Only when decode finds the branch (direct jumps and calls), or execute resolves it (indirect branches and some conditionals), does fetch redirect, with an empty FTQ. The model gives FDIP perfect run-ahead across every BTB miss.</p>
<p><strong>Fix:</strong> after a BTB miss, make the model predict fall-through blocks, send their prefetches through the real filter and L2 request limits, and redirect at decode or execute with the right latency, flushing the FTQ.</p>
<p><strong>What changes:</strong></p>
<ul>
<li>Coverage drops, most of all for the lines just after each redirect target, where the lead is 0.</li>
<li>Wrong-path prefetches use L2 bandwidth and can evict useful lines.</li>
<li>Decode redirect cycles appear as a front-end cost.</li>
<li>A perfect-BTB experiment now shows a real gain that the broken model hid, which can change which structure looks worth growing.</li>
</ul>`, "hard") +
Q(`<p>On a database trace, your model classifies FDIP prefetches as 55% timely, 30% late, and 15% useless. What does each of the last two point at? Which experiments separate the causes, and how would you decide between a deeper FTQ and a larger BTB?</p>`,
`<ul>
<li><strong>Late</strong> (fetch waited for part of the latency): the lead is too short. Either the FTQ sits at its cap (the occupancy histogram is pinned at the maximum), or redirects keep resetting it (the lead is near 0 right after redirects, and BTB misses and mispredicts come close together).</li>
<li><strong>Useless</strong> (wrong path, or evicted before use): wrong-path prefetches after BTB misses or mispredicts, or prefetches so early that the line is gone before fetch arrives.</li>
</ul>
<p>Experiments:</p>
<ol>
<li>Classify each late prefetch by its distance in blocks from the last redirect.</li>
<li>Run a deeper FTQ alone, a larger BTB alone, and both together, and record the late and useless fractions and IPC for each.</li>
<li>Attribute useless prefetches to their cause: after a BTB miss, after a mispredict, or evicted.</li>
</ol>
<p>Decision: if late prefetches cluster just after redirects, the lead never reaches the cap, so a deeper FTQ can’t help and the BTB is the lever. If the FTQ is often full and late prefetches are spread evenly, depth helps, and it’s cheap because entries are small. Useless prefetches that track BTB misses also point at the BTB.</p>`, "hard") +
Q(`<p>In your model, a perfect BTB gains 6% on a server trace and a perfect instruction cache gains 5%, but both together gain 16%. Why is the combination worth more than the sum? What would you tell a team that can afford to improve only one of them?</p>`,
`<p>The two stalls feed each other:</p>
<ul>
<li>A BTB miss is found only when decode sees the branch, which needs the instruction bytes. If that line also misses in the instruction cache, the redirect waits for the miss too.</li>
<li>After the redirect, the FTQ is empty, so the target and the lines after it are fetched with no lead and their misses are fully exposed.</li>
</ul>
<p>With only a perfect BTB, the remaining instruction cache misses still stall. With only a perfect instruction cache, BTB misses still cost redirects, just shorter ones. Removing both also removes the interaction, worth 16 − 6 − 5 = 5% here.</p>
<p>Advice:</p>
<ul>
<li>Ideal structures aren’t options. Evaluate realistic sizes of each, and both together, because part of the interaction carries over.</li>
<li>A larger BTB also lets FDIP hide more instruction cache misses, so the BTB option usually captures part of the cache’s gain. The reverse effect is weaker.</li>
<li>Look for something that hits both: predecoding instruction cache fills into the BTB, or profile-guided layout (BOLT), which shrinks the footprint for both structures.</li>
<li>Attribute stall cycles correctly before deciding: instruction cache misses exposed right after a BTB redirect are part of the BTB’s cost.</li>
</ul>`, "hard") +
M(`<p>After a redirect, your model’s predictor produces 2 fetch blocks per cycle, starting with block 0 in cycle 0, into a 24-entry FTQ. An instruction cache miss that hits in the L2 costs 14 cycles (AMD Zen 4’s L2 latency), and FDIP issues each block’s prefetch in the cycle it is predicted.</p>
<ul>
<li>(a) Every block fits in one 32-byte fetch window, so fetch consumes one block per cycle. Which blocks get the full 14 cycles of lead, and what is the steady-state lead?</li>
<li>(b) Blocks average 48 bytes, so each takes 1.5 fetch cycles on average. Answer the same questions.</li>
<li>(c) Back to (a), but the decode queue is full for the first 20 cycles after the redirect, so fetch reads nothing until cycle 20.</li>
<li>(d) Can any of these fully hide an L3 hit of 50 cycles?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Block k is predicted at about cycle k / 2 and fetched at cycle k, so its lead is about k / 2. Full hiding needs k / 2 ≥ 14, so blocks from about 28 on. Occupancy grows by 1 per cycle (2 in, 1 out) and reaches 24 at cycle 24. After that, the predictor can only add a block when fetch removes one, and the lead stays at 24 / 1 = <strong>24 cycles</strong>.</li>
<li><strong>(b)</strong> Block k is fetched at cycle 1.5k, so its lead is 1.5k − k / 2 = k. Blocks from 14 on are fully hidden. Occupancy grows by 2 − 2/3 = 4/3 per cycle and fills at cycle 18. The steady-state lead is 24 / (2/3) = <strong>36 cycles</strong>. Each entry now holds more fetch time, so the same queue gives a longer lead.</li>
<li><strong>(c)</strong> The predictor fills all 24 entries by cycle 12, then waits. Fetch starts at cycle 20, so block k (k ≤ 23) is fetched at cycle 20 + k, at least 20 cycles after its prediction. <strong>Every block is hidden, including block 0</strong>, whose miss overlapped with the stall. After that, the predictor refills at fetch’s rate and the lead settles at 24 cycles. A back-end stall turns into lead.</li>
<li><strong>(d)</strong> No. The lead never exceeds 24 cycles in (a) or 36 in (b). Hiding 50 cycles needs at least 50 entries at one block per cycle, and the predictor has to stay on the right path long enough to fill them.</li>
</ol>`, "medium") +
M(`<p>A server trace has 9 BTB misses on taken branches per 1,000 instructions. 70% of them are direct jumps and calls that decode redirects, at 8 cycles each. The other 30% are conditional branches that mispredict when they execute, at 17 cycles each. After 40% of the BTB-miss redirects, the target line misses in the instruction cache and hits in the L2 at 14 cycles, fully exposed because the FTQ restarted empty. The CPI without any of these costs is 0.50.</p>
<ul>
<li>(a) What is the CPI, and what share of it do BTB misses cause?</li>
<li>(b) A stall breakdown charges the exposed instruction cache misses to the instruction cache. What fraction of the BTB’s cost does that hide?</li>
<li>(c) Doubling the BTB halves its misses. What speedup does it give? What speedup would a team estimate if it believed the instruction cache misses would stay?</li>
</ul>`,
`<ol>
<li>Decode redirects: 9 × 0.7 = 6.3 per 1,000 instructions × 8 = 50.4 cycles.</li>
<li>Mispredicts: 9 × 0.3 = 2.7 × 17 = 45.9 cycles.</li>
<li>Exposed instruction cache misses: 9 × 0.4 = 3.6 × 14 = 50.4 cycles.</li>
<li><strong>(a)</strong> Total 146.7 cycles per 1,000 instructions, 0.147 CPI. CPI = 0.50 + 0.147 = <strong>0.647</strong>, and BTB misses cause 0.147 / 0.647 ≈ <strong>23%</strong> of it.</li>
<li><strong>(b)</strong> 50.4 / 146.7 ≈ <strong>34%</strong> of the BTB’s cost shows up under the instruction cache.</li>
<li><strong>(c)</strong> Halving every term: CPI = 0.50 + 0.073 = 0.573, a speedup of 0.647 / 0.573 ≈ <strong>1.13</strong>. If only the redirects and mispredicts halved: 0.50 + 0.048 + 0.050 = 0.599, a speedup of about <strong>1.08</strong>. Misattributing the exposed misses makes the BTB look about 40% less valuable than it is.</li>
</ol>`, "hard") +
`<h3 id="sec-decode">Decode and the Op Cache</h3>` +
Q(`<p>Why do x86 cores keep an op cache in front of their decoders, while Arm removed the macro-op cache when the Cortex-A715 dropped 32-bit support?</p>`,
`<p><strong>x86:</strong> instructions are 1 to 15 bytes long, so finding their boundaries takes length decoding and predecode bits, and wide decoders are expensive in power and area. The op cache skips all of that on hot code:</p>
<ul>
<li>More bandwidth: Zen 5 delivers up to 12 instructions per cycle from its op cache, against 4 per thread from its decoders.</li>
<li>No length-changing-prefix stalls or decoder-slot limits.</li>
<li>Less power, since the decoders idle on hits.</li>
<li>A shorter refill path after a mispredict.</li>
</ul>
<p><strong>Arm:</strong> every AArch64 instruction is 4 bytes, so wide decode is cheap. Once the A715 no longer had to decode AArch32 as well, decode was cheap enough that the cache stopped paying for its area and power, and Arm widened the decoders instead. Apple’s cores decode 8 instructions per cycle with no op cache at all.</p>`, "easy") +
Q(`<p>Zen 5 dispatches 8 macro-ops per cycle, but one thread decodes at most 4 instructions per cycle from the instruction cache. What does that imply for loop unrolling, for code that doesn’t fit in the op cache, and for turning on SMT?</p>`,
`<ul>
<li><strong>The op cache is the only path to full width</strong> for one thread. It holds about 6K instructions and delivers up to 12 per cycle. Code running from the decoders is capped at 4, half of dispatch.</li>
<li><strong>Unrolling</strong> helps only while the loop still fits in the op cache under its entry rules (up to 6 instructions per entry, from at most two adjacent lines, with limited immediate slots). Past that, it moves the loop to the decoders and halves delivery.</li>
<li><strong>Large hot code</strong> (beyond about 6K instructions, or 3K per thread with SMT) is front-end bound on one thread.</li>
<li><strong>SMT:</strong> each thread owns one decode cluster, so the core decodes 8 per cycle in total. Decoder-bound code gets hardware that one thread can’t use. For op-cache-resident kernels that saturate the ports, SMT halves the front end per thread, and AMD suggests turning it off for them.</li>
</ul>`, "medium") +
Q(`<p>How many slots does <code>add [rbx], rax</code> take at rename, and how many at the execution ports, on Zen 5 and on an Intel core? What goes wrong if a model uses x86 instruction counts for both the rename bound and the port bounds?</p>`,
`<ul>
<li><strong>Zen 5:</strong> one macro-op through dispatch and retire, carrying two micro-ops: a combined load and store-address operation, and the add.</li>
<li><strong>Intel:</strong> 2 fused-domain µops at rename and retire, and 4 unfused µops at the ports: load, add, store address, and store data.</li>
</ul>
<p>Using instruction counts for everything:</p>
<ul>
<li>Rename and retire bounds are off wherever fusion or cracking changes the count. A compare and branch fuse into one, while read-modify-write and fast path double instructions take more than one.</li>
<li>Port bounds undercount badly for memory-operand instructions, whose load and store micro-ops use their own pipes.</li>
</ul>
<p>The model should track macro-ops (fused µops) per instruction for rename and retire, and micro-ops (unfused µops) per macro-op for the ports, by instruction class.</p>`, "medium") +
M(`<p>On Zen 5, one thread gets up to 12 instructions per cycle from the op cache and 4 per cycle from the decoders, and dispatch takes 8 macro-ops per cycle. Assume one macro-op per instruction and that the two paths average out over time.</p>
<ul>
<li>(a) What op cache hit rate (the fraction of instructions it delivers) lets the front end keep up with dispatch?</li>
<li>(b) Each switch between the two paths costs 1 cycle, and a switch happens every 50 instructions on average. What hit rate is needed now? How many instructions per cycle does the front end deliver at the hit rate from (a)?</li>
</ul>`,
`<ol>
<li>Front-end cycles per instruction: h / 12 + (1 − h) / 4. Dispatch needs at most 1 / 8.</li>
<li><strong>(a)</strong> h / 12 + 1/4 − h / 4 = 1/8, so 1/4 − h / 6 = 1/8 and h = <strong>0.75</strong>.</li>
<li><strong>(b)</strong> Add 1 / 50 = 0.02 cycles per instruction: 1/4 − h / 6 + 0.02 = 1/8, so h / 6 = 0.145 and h = <strong>0.87</strong>.</li>
<li>At h = 0.75 with switches: 0.125 + 0.02 = 0.145 cycles per instruction, about <strong>6.9 instructions per cycle</strong>, 14% below dispatch.</li>
<li>A 75% hit rate sounds high, but it leaves a quarter of a thread’s instructions on a path one third as wide, and switches raise the bar further. In real code the misses and switches cluster in large-footprint phases, which is why the op cache should be modeled as a real cache with its indexing and entry rules, not as a hit rate.</li>
</ol>`, "medium") +
`<h3 id="sec-way">Way Prediction</h3>` +
Q(`<p>For each of these, choose way prediction proper, way selection, or neither, and justify it: (a) the 32 KB, 8-way L1I of a 5 GHz desktop core, (b) the L1I of a low-power in-order core, (c) the 48 KB, 12-way L1D of an out-of-order core.</p>`,
`<ul>
<li><strong>(a) Way prediction proper</strong>, or a next-way field stored with the fetch block and used for timing. In an 8-way parallel read, the tag compare and the select drive set the hit time, and the predictor takes them off the critical path. Fetch predicts well because it stays in a line and leaves it predictably, and a one-cycle bubble is absorbed by the fetch queue and the FTQ. Energy is secondary.</li>
<li><strong>(b) Way selection.</strong> Energy matters most, the cycle has slack, and the guess can come from the previous fetch (same line, or a next-way field) a cycle early. A wrong guess costs a second access, which a small fetch queue mostly absorbs at this core’s low IPC.</li>
<li><strong>(c) Way selection driven by a virtual-address hash</strong>, as AMD’s utag does, with a mismatch turned into an ordinary miss. Reading 12 ways per load costs a lot of energy, and the guess has to be ready before the physical tag. A predictor that sometimes returns data a cycle late would break the scheduler’s fixed load-to-use wakeup and force replays, so a data-side predictor must be very accurate or turn its mistakes into clean misses that the existing miss path already handles.</li>
</ul>`, "hard") +
Q(`<p>A per-set MRU way predictor on an instruction cache mispredicts every access when two hot code lines in the same set are used alternately. Why? Why does storing the next way with the fetch block fix it? Name a case the fetch-block scheme still gets wrong, and explain why a stale prediction is never a correctness problem.</p>`,
`<p><strong>Why MRU fails:</strong> it stores one way per set. Alternating lines A and B in set s flips the field to each line’s way in turn, so the next access, to the other line, always finds the wrong way: 100% mispredicts.</p>
<p><strong>Why the next-way field works:</strong> the guess is stored with the block that leads to the line (in the previous block’s line, or in the BTB or FTQ entry). The block leading to A always names A’s way and the block leading to B names B’s, so both stay right even though they share a set.</p>
<p><strong>Still wrong:</strong></p>
<ul>
<li>A block with several successors (a branch that alternates between taken and not taken, an indirect call, a return) has one field for several possible next lines.</li>
<li>After a refill puts a line in a different way, every field pointing at it mispredicts once before it is retrained.</li>
</ul>
<p><strong>Never incorrect:</strong> the tag check always runs. A wrong guess costs a second access and retrains the field. It never delivers wrong data.</p>`, "hard") +
M(`<p>A 5 GHz core (200 ps cycle) has an 8-way instruction cache with these delays: data array read 150 ps, tag array read 115 ps, tag compare 40 ps, driving the select across the output mux 45 ps, the mux 35 ps, and a way predictor read and decode 60 ps. The predictor is right on 88% of fetches, and a wrong guess costs one extra cycle.</p>
<ul>
<li>(a) How many cycles does a hit take with a parallel read, and with way prediction?</li>
<li>(b) Compare the average hit time in nanoseconds of way prediction at 5 GHz with a parallel-read design that lowers the clock until a hit fits in one cycle.</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Parallel read: max(150, 115 + 40 + 45) + 35 = max(150, 200) + 35 = 235 ps, more than 200, so <strong>2 cycles</strong>. Way prediction: max(150, 60) + 35 = 185 ps, so <strong>1 cycle</strong> with 15 ps to spare.</li>
<li>Average with way prediction: 0.88 × 1 + 0.12 × 2 = 1.12 cycles = <strong>0.224 ns</strong>.</li>
<li><strong>(b)</strong> Fitting the parallel read in one cycle needs 1 / 235 ps ≈ 4.26 GHz, for a hit of <strong>0.235 ns</strong>. (Keeping 5 GHz with 2-cycle hits gives 0.40 ns.)</li>
<li>Way prediction gives slightly faster hits than the slower clock and keeps the whole core at 5 GHz, 17% faster for everything else. The price is a variable hit time, the predictor and its training, and the one-cycle recovery that H&amp;P warn is hard to fit at high clock rates.</li>
</ol>`, "medium") +
M(`<p>A low-power core’s 8-way instruction cache uses way selection. Per way, a tag read costs 1.2 pJ and a data read 5.0 pJ, and the predictor read costs 0.4 pJ. On a wrong guess the other 7 ways are read in a second cycle. Each fetch reads 16 bytes, 4 instructions.</p>
<ul>
<li>(a) Without a confidence bit, the guess is right on 90% of fetches. Find the energy per fetch and the extra fetch cycles per fetch, and compare with an 8-way parallel read.</li>
<li>(b) A confidence bit marks 8% of fetches low-confidence, and those read all 8 ways at once. The rest guess right 97% of the time. Find the same two numbers.</li>
<li>(c) 40% of extra fetch cycles reach decode, and the core’s CPI is 0.8. What does each option cost in performance?</li>
</ul>`,
`<ol>
<li>One way costs 1.2 + 5.0 = 6.2 pJ. A parallel read costs 8 × 6.2 = 49.6 pJ, with no extra cycles.</li>
<li><strong>(a)</strong> Right guess: 0.4 + 6.2 = 6.6 pJ. Wrong guess: 6.6 + 7 × 6.2 = 50.0 pJ. Average: 0.9 × 6.6 + 0.1 × 50.0 = <strong>10.94 pJ</strong>, 78% less than the parallel read. Extra cycles: <strong>0.10 per fetch</strong>.</li>
<li><strong>(b)</strong> Low confidence: 0.4 + 49.6 = 50.0 pJ. High confidence: 0.97 × 6.6 + 0.03 × 50.0 = 7.90 pJ. Average: 0.08 × 50.0 + 0.92 × 7.90 = 4.00 + 7.27 = <strong>11.27 pJ</strong>, 3% more than (a). Extra cycles: 0.92 × 0.03 ≈ <strong>0.028 per fetch</strong>, 72% fewer.</li>
<li><strong>(c)</strong> Per instruction, (a) adds 0.10 / 4 × 0.4 = 0.010 cycles, <strong>1.25%</strong> of a 0.8 CPI. (b) adds 0.028 / 4 × 0.4 ≈ 0.0028 cycles, <strong>0.35%</strong>.</li>
<li>The confidence bit trades 3% of fetch energy for most of the lost cycles, usually a good trade.</li>
</ol>`, "hard"),
},
{
  id: "intv-lsq",
  title: "Loads, Stores and Memory Ordering",
  body: `
<p>Background: <a href="#/lsq">Load and Store Queues</a>, <a href="#/mdp">Memory Dependence Prediction</a>, <a href="#/dcache">Data Cache</a>.</p>
<h3 id="sec-basics">Why Loads and Stores Are Special</h3>` +
Q(`<p>Register dependences are known at rename. Why aren’t memory dependences, and what two separate correctness problems does that create for an out-of-order core?</p>`,
`<p>A register dependence is visible in the instruction encoding: the names match. A memory dependence depends on <em>addresses</em>, which are computed at execution time, possibly from loads that haven’t returned. So at rename the core can’t know whether a load reads what an older store writes.</p>
<ol>
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
Q(`<p>To catch memory-ordering violations, every store that computes its address searches the load queue for younger loads to the same address that already executed. Why is that search expensive in a load queue of about 200 entries? Describe two alternatives that avoid an associative load-queue search and what each gives up.</p>`,
`<p><strong>Why it is expensive:</strong> the search compares the store’s address (and size) against every load-queue entry, filtered by age, in the cycle the store address is ready. With 2 store addresses per cycle and 200 entries, that is 400 address comparisons per cycle in a CAM, plus age logic. The search is on a timing-critical path and burns energy on every store. On TSO machines, incoming invalidations also search the queue.</p>
<p><strong>Alternative 1, value-based replay at retirement</strong> (Cain and Lipasti, 2004): don’t search at all during execution. Before a load retires, re-execute it against the cache and compare the value with the one it used. A mismatch means a violation, so flush from the load. Gives up cache bandwidth (a second access per load, though filters can skip loads that can’t be affected) and adds retirement latency for loads.</p>
<p><strong>Alternative 2, filtering:</strong> keep the search, but rarely do it. A small Bloom filter or a table of hashed addresses of executed, unretired loads tells a store when no younger load could possibly match, so the CAM search is skipped. Gives up some area for the filter, and false positives still search. Most stores need no search.</p>
<p>Others: banked load queues split by address bits, so a store searches only one bank, and age-ordered search only among loads executed out of order with respect to stores, which a dependence predictor makes rare.</p>`, "hard") +
`<h3 id="sec-fwd">Store-to-Load Forwarding</h3>` +
Q(`<p>On a recent x86 core, which of these loads can be satisfied by store-to-load forwarding, and what happens to the one that can’t?</p>
<pre><code>I0: mov qword [rax], rcx      ; 8-byte store
I1: mov edx, dword [rax+4]    ; 4-byte load, upper half of I0
I2: mov word [rbx], si        ; 2-byte store
I3: mov r8, qword [rbx]       ; 8-byte load covering I2 and 6 more bytes</code></pre>`,
`<p><strong>I1 forwards.</strong> The load is completely contained in the older store, so the store queue can supply the bytes by shifting out the upper half. Modern Intel and AMD cores handle this contained case for common sizes and offsets (exact rules vary by core).</p>
<p><strong>I3 can’t forward.</strong> Only 2 of its 8 bytes come from the store; the other 6 must come from the cache, and the store-queue forwarding path can’t merge two sources. The load waits until I2 commits and writes the L1, then reads the merged line. This is a store-forwarding stall: roughly 10–20 cycles more than a successful forward, and potentially much more if I2 is stuck behind a miss in the store buffer.</p>
<p>Where this shows up in practice: code that writes a struct field by field and then reads it back with one wide (vectorized) load.</p>`, "medium") +
M(`<p>A load’s address is known, but an older store’s address is not. Describe three policies the core could use and the performance risk of each.</p><p>Then put numbers on it:</p><ul><li>30% of instructions are loads</li><li>2% of loads truly depend on an older store whose address is unknown when the load is ready</li><li>A violation costs 20 cycles</li><li>Waiting conservatively delays the 30% of loads that sit behind an unresolved store by 6 cycles each, fully exposed</li></ul><p>A predictor catches 95% of the true dependences and falsely delays 1% of loads. Compare the three policies in cycles per 1,000 instructions.</p>`,
`<ol>
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
M(`<p>A loop compiled at -O0 keeps its counter in memory: each iteration loads it, adds 1, and stores it back. Store-to-load forwarding takes about 5 cycles on this 4-wide Skylake-class core. (a) How many cycles per iteration does this chain cost, and what IPC does an 8-instruction iteration get? (b) At -O2 the counter lives in a register. What limits the loop now? (c) What is memory renaming, and what would it do here?</p>`,
`<ol>
<li><strong>(a)</strong> The loop-carried chain runs through memory: load (about 5 cycles, forwarded from the previous iteration’s store) plus add (1): about <strong>6 cycles per iteration</strong>, so IPC = 8 / 6 ≈ <strong>1.33</strong>.</li>
<li><strong>(b)</strong> The chain is a 1-cycle add, so the loop becomes width-bound: 8 instructions at 4 per cycle = 2 cycles per iteration. A 3× speedup, not 6×: removing the chain moves the bottleneck to width.</li>
<li><strong>(c)</strong> Memory renaming predicts that a load will read the value of a specific older store and connects the load’s result directly to the store’s source register at rename, like an eliminated move. The store-forwarding latency disappears from the chain, which returns to the 1-cycle add. Some recent x86 cores do this for stack accesses, which is exactly where unoptimized and register-starved code spills and reloads.</li>
</ol>`, "hard") +
Q(`<p>On many Intel cores, a load first checks older stores using only address bits 11:0. A loop computes <code>a[i] = b[i] * k</code> over float arrays. When (a − b) mod 4096 is a small positive number such as 32 bytes, the loop runs about 2× slower than when it is 2,048. Explain, and say how you would confirm it.</p>`,
`<p>The store to a[i] has the same low 12 address bits as the load of b[j] whenever b + 4j ≡ a + 4i (mod 4096), i.e., j = i + (a − b)/4 = i + 8 here. So the load of b[i+8], which out-of-order execution runs early, finds an older, still-buffered store (to a[i]) whose low 12 bits match. The quick check flags a possible dependence, and the load waits for the full address comparison, a few cycles, before it can proceed. That happens on nearly every iteration. With an offset of 2,048 bytes, a matching store would be 512 iterations old and long since drained, so nothing matches.</p>
<p>This is called <strong>4K aliasing</strong>. Confirm it with the Intel event <code>LD_BLOCKS_PARTIAL.ADDRESS_ALIAS</code>, or by sweeping the offset between the arrays and watching the slowdown appear only for small positive offsets mod 4096. Fix it by padding or aligning allocations so the arrays aren’t a multiple of 4 KB apart. The partial compare exists because full-address comparison across the whole store queue is expensive (next question).</p>`, "hard") +
Q(`<p>Intel cores split each store into a store-address uop and a store-data uop, which can execute at different times. A younger load matches the store’s address, but the store data isn’t ready yet. What happens to the load? Why split stores at all, and what goes wrong in a model that treats a store as one operation?</p>`,
`<p><strong>The load:</strong> it can’t take data that doesn’t exist, and it can’t read the cache, which holds the stale value. It is blocked: marked as waiting on that store-queue entry and retried (or woken) when the store data arrives. It then forwards normally. Its latency is the data’s arrival time plus the forwarding latency.</p>
<p><strong>Why split:</strong></p>
<ul>
<li>The address often depends on different, earlier-ready values than the data. A store <code>a[i] = f(x)</code> has its address ready early and its data late. Computing the address early lets younger loads check for conflicts early: a load that doesn’t match can proceed with confidence instead of speculating.</li>
<li>The two halves use different execution resources: an AGU for the address and a data port for the value, which can be scheduled independently.</li>
<li>An early address also lets the store start a request for ownership (RFO) or a TLB lookup before the data is ready.</li>
</ul>
<p><strong>What a single-operation model gets wrong:</strong></p>
<ul>
<li>It makes the address wait for the data. Loads behind the store wait for the address to be known (or speculate past it), so the model sees more ambiguity and more memory-dependence stalls or violations than the real core.</li>
<li>It mispredicts port usage: one uop where the core uses two ports.</li>
<li>It gets blocked-load timing wrong: in the model, a matching load waits for both halves, while on the real core it waits only for the data if the address was early.</li>
</ul>`, "hard") +
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
M(`<p>A Golden Cove-class core has a 192-entry load queue, a 114-entry store queue, and handles up to 3 loads and 2 stores per cycle. (a) How many address comparisons per cycle are needed if every load searches the whole store queue and every store, when its address resolves, searches the whole load queue? (b) Why is each comparison more than a simple equality test? (c) Name techniques that cut the cost.</p>`,
`<ol>
<li><strong>(a)</strong> 3 × 114 + 2 × 192 = 342 + 384 = <strong>726 comparisons per cycle</strong>.</li>
<li><strong>(b)</strong> Each check must<ul><li>Test byte-range <em>overlap</em> (address plus size), not equality</li><li>Must restrict itself to entries on the correct side in age (older stores for a load, younger loads for a store)</li><li>A load must select the <em>youngest</em> matching older store, which adds a priority encoder</li></ul> Full physical addresses are 40+ bits wide.</li>
<li><strong>(c)</strong><ul><li>Compare a few low address bits first and do the full compare only on a match (which is exactly what causes 4K aliasing)</li><li>Split the queues into banks by address bits so a search touches only one bank</li><li>Filter with a small table or Bloom filter that says whether any in-flight store could match</li><li>Search only the relevant age range</li><li>Skip load-queue searches for stores when no younger load has executed yet</li></ul></li>
</ol>`, "hard") +
Q(`<p>Explain the store sets memory dependence predictor (Chrysos and Emer, 1998): what the store set ID table and last fetched store table hold, how a load learns which store to wait for, and how the predictor fails. Why does it beat a simple “this load must wait for all older stores” bit?</p>`,
`<p><strong>The idea:</strong> each load that has ever conflicted with a store is placed in a <em>store set</em> together with those stores. A load waits only for the most recent in-flight store in its set.</p>
<ul>
<li><strong>Store set ID table (SSIT):</strong> indexed by instruction address, it gives the store set ID for loads and stores that have one.</li>
<li><strong>Last fetched store table (LFST):</strong> indexed by store set ID, it holds the in-flight tag of the most recently renamed store in that set.</li>
</ul>
<p><strong>At rename:</strong> a store looks up its set and becomes the set’s last fetched store, recording a dependence on the previous one (so stores in a set issue in order). A load looks up its set and gets a dependence on the store currently in the LFST. When that store issues, the dependence clears. On a violation, the load and the store are put in the same set, merging sets if needed.</p>
<p><strong>Why it beats a wait bit:</strong> a wait bit (as in the Alpha 21264) makes a load wait for <em>every</em> older store’s address, even if only one store ever conflicted. Store sets wait for one specific store, so the load can still issue past unrelated stores. The difference matters in code with many stores in flight, such as loops that write several arrays.</p>
<p><strong>Failure modes:</strong></p>
<ul>
<li>Sets grow over time through merging, and loads wait on stores they no longer conflict with. Tables are cleared periodically to stop this, which then costs a few relearning violations.</li>
<li>Aliasing in the SSIT puts unrelated instructions in the same set.</li>
<li>A load that conflicts with different stores in different iterations, in a pattern, waits on the last one in the set, which may not be the one it needs this time.</li>
</ul>`, "hard") +
Q(`<p>A load is predicted to depend on an older store. Should it wait until that store’s address is known, until the store’s data is ready, or until all older stores have addresses? Compare the three for latency, recovery risk, and hardware cost.</p>`,
`<ul>
<li><strong>Wait for the specific store’s address:</strong> when it is known, the load compares. If they match, it forwards (if the data is ready, otherwise it waits for it). If they don’t match, it proceeds. Lowest latency for a correct prediction of “no conflict this time.” Needs the predictor to name a specific store (store sets) and a wakeup on that store’s address computation.</li>
<li><strong>Wait for the specific store’s data</strong> (or for the store to issue fully): simpler, since one wakeup event covers address and data, and the load can then forward directly. Slower when the store’s data comes late but the addresses wouldn’t have matched, since the load waits for nothing. Many designs effectively do this because the store executes as a unit or the address and data are close in time.</li>
<li><strong>Wait for all older store addresses:</strong> no prediction of which store is needed, just a bit per load (the Alpha 21264’s wait table). Safest: once all older addresses are known, the load knows exactly what it overlaps. Slowest: one late store address blocks the load, even if that store is unrelated. Cheapest to build.</li>
</ul>
<p><strong>Recovery risk:</strong> the first two can still violate if the predictor named the wrong store (another older store matches). The third can only violate through stores whose addresses were known but compared incorrectly, which is a bug, not a prediction.</p>
<p>The choice depends on how often loads that once conflicted still conflict. Workloads with stable store-load pairs (stack spills and reloads, struct fields) favor the specific-store forms. Workloads with changing pairs (indirect stores through pointers) favor the conservative one. Most real designs combine a precise predictor with a fallback to “wait for all” for loads that keep violating.</p>`, "hard") +
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
M(`<p>Stores are 10% of instructions on a core running at IPC 3. Committed stores drain to the L1 in order, one per cycle when they hit. 5% of stores miss and need an ownership fetch from L3 (50 cycles), and a missing store blocks the drain until its line arrives. (a) Can the store buffer keep up? (b) What changes if the core issues ownership requests (RFOs) early, as soon as a store’s address is known?</p>`,
`<ol>
<li><strong>(a)</strong> Stores arrive at 3 × 0.1 = 0.3 per cycle. Average drain time per store: 1 + 0.05 × 50 = 3.5 cycles, so the drain capacity is 1 / 3.5 ≈ 0.286 stores per cycle. That’s less than 0.3, so the store buffer fills and stays full: IPC is capped near 0.286 / 0.1 ≈ <strong>2.86</strong>, and lower in practice because misses arrive in bursts.</li>
<li><strong>(b)</strong> With early RFOs, the ownership fetches for several buffered stores overlap with each other and with the drain of the stores ahead of them. When a missing store reaches the head, its line is often already there, so the effective drain time approaches 1 cycle per store and the cap disappears. TSO still requires stores to become visible in order; it doesn’t forbid fetching ownership early.</li>
</ol>`, "hard") +
Q(`<p>Non-temporal stores (<code>movntdq</code> on x86) write combine in a buffer and go to memory without first reading the line into the cache. When are they faster than ordinary stores, when are they slower, and what ordering rule do they break that code must fix with <code>sfence</code>?</p>`,
`<p><strong>Ordinary stores</strong> to a line not in the cache must first read it (a read for ownership), so writing 64 bytes moves 128 bytes over the memory bus: the line read in, then written back later. They also evict other data from the cache.</p>
<p><strong>Non-temporal stores</strong> collect a full line in a write-combining buffer and write it directly to memory: no read, no cache pollution.</p>
<p><strong>Faster when:</strong></p>
<ul>
<li>Writing large buffers that won’t be read again soon (larger than the LLC): memset, streaming output, copying big arrays. The bus traffic roughly halves, and on bandwidth-bound code that is close to 2× faster.</li>
<li>The cache holds data that the rest of the program needs, which ordinary stores would evict.</li>
</ul>
<p><strong>Slower when:</strong></p>
<ul>
<li>The data is read soon after: it now comes from DRAM instead of the cache.</li>
<li>Writes are partial or scattered: a partly filled write-combining buffer is flushed as several partial writes, which is inefficient, and there are only about a dozen such buffers.</li>
<li>The buffer is small enough to stay in cache: ordinary stores hit and are cheaper.</li>
</ul>
<p><strong>Ordering:</strong> x86 TSO normally makes stores visible in program order. Non-temporal stores are weakly ordered: they can become visible after later ordinary stores. Code that writes a buffer with non-temporal stores and then sets a flag must put an <code>sfence</code> between them, or another core might see the flag before the data. Libraries such as glibc’s memcpy switch to non-temporal stores above a size threshold related to the cache size.</p>`, "hard") +
`<h3 id="sec-mlp">Capacity and Memory-Level Parallelism</h3>` +
M(`<p>An Intel Skylake-class core can track about 10–12 outstanding L1D misses (fill buffers). With 80 ns DRAM latency and 64-byte lines, what bandwidth can one core pull from DRAM through demand misses alone? Measured single-core bandwidth on such chips is noticeably higher. Why?</p>`,
`<p>Little’s law: bandwidth = bytes in flight / latency = 12 × 64 B / 80 ns ≈ <strong>9.6 GB/s</strong> (8 GB/s with 10 buffers).</p>
<p>The measured figure is higher because the L2’s hardware prefetchers fetch ahead into the L2 (and L3), and those requests are tracked by the L2’s own miss queue, not the L1 fill buffers. Many L1 misses then become L2 hits with about 12-cycle latency, so each fill buffer turns over far faster. Same law, much shorter latency. That’s also why disabling prefetchers in a single-core streaming benchmark drops bandwidth toward the Little’s-law bound.</p>`, "hard") +
M(`<p>Your model reports these counters for a 50M-cycle interval on a 5 GHz core that retires 60M instructions:</p><ul><li>Cycles with at least one L2 miss outstanding: 30M</li><li>Sum over all cycles of the number of outstanding L2 misses: 69M miss-cycles</li><li>L2 misses completed: 180K</li></ul><p>(a) Compute the MLP, the average miss latency, the miss throughput, and the effective penalty per miss. (b) A colleague computes MLP as 69M / 50M. Why is that misleading? (c) What is the most time these misses could be costing?</p>`,
`<ol>
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
M(`<p>Growing the load queue helps one workload a lot and another not at all. Give an explanation, and say how you would tell a load-queue capacity bottleneck from a memory-bandwidth bottleneck.</p><p>Then quantify the streaming case: one core wants 20 GB/s from DRAM with 90 ns latency and 64-byte lines. How many lines must be in flight, and roughly how many load-queue entries would demand loads need if the program uses 8-byte loads and nothing prefetches? Compare with Skylake’s 72-entry and Golden Cove’s 192-entry load queues.</p>`,
`<p>The first workload has many independent loads, and with more load-queue entries the window reaches more of them, so more misses overlap. The second either has few loads in flight anyway (compute-bound, or dependent pointer-chasing loads), or was already limited by something else: the miss buffers, the ROB, or DRAM bandwidth.</p>
<p>To tell capacity from bandwidth:</p>
<ul>
<li><strong>Load-queue bound:</strong> frequent allocation stalls on a full load queue, with DRAM bandwidth well below its achievable peak and average miss latency near the unloaded value.</li>
<li><strong>Bandwidth bound:</strong> DRAM utilization near the achievable peak (measured with a STREAM-like run, since it sits well below the theoretical number), and average miss latency rising as you add more parallelism, because requests are queueing. More entries only make the queue longer.</li>
</ul>
<p><strong>Streaming numbers:</strong> bytes in flight = 20 GB/s × 90 ns = 1,800 bytes ≈ 28 lines, so about <strong>29 lines</strong> must be outstanding. Each line is touched by 8 consecutive 8-byte loads, and every load from the oldest outstanding line to the newest occupies a load-queue entry until it retires: about 29 × 8 ≈ <strong>230 entries</strong>, more than Skylake’s 72 or Golden Cove’s 192. Demand loads alone can’t sustain it; hardware prefetchers, which track lines without load-queue entries, are what make single-core streaming bandwidth possible.</p>`, "hard") +
Q(`<p>How would you test a load/store queue model for correctness when accesses overlap in address or size?</p>`,
`<ol>
<li><strong>Directed tests:</strong> every combination of store size and load size (1, 2, 4, 8, 16, 32, 64 bytes) and relative offset, including partial overlap, exact match, containment both ways, and accesses that cross a cache line or a page boundary.</li>
<li><strong>Ordering scenarios:</strong><ul><li>Load before the older store’s address resolves, then aliasing</li><li>Several older stores to the same address (the youngest older must win)</li><li>Stores with address known but data not</li></ul></li>
<li><strong>Golden reference:</strong> run random load/store streams over a small address range (to force collisions) and check every load’s value against an in-order functional model. Even a timing-only model can track byte-level “which store produced this byte” and compare that.</li>
<li><strong>Invariants:</strong><ul><li>Retired stores drain in order</li><li>No load completes with data from a younger store</li><li>Violations always trigger a flush from the load</li></ul></li>
</ol>`, "medium") +
Q(`<p>Skylake has a 72-entry load queue but only 12 L1D fill buffers, so at most 12 L1D misses can be outstanding at once. Why doesn’t a bigger load queue raise memory-level parallelism past that? How do the L2 hardware prefetchers get around the limit, and what does it mean for modeling a bandwidth-bound loop?</p>`,
`<p><strong>Why the load queue doesn’t help:</strong> each L1D miss to a different line needs a fill buffer until the data returns. Loads to a line already being fetched merge into the existing buffer, but a 13th distinct line must wait for a buffer to free. With about 80 ns latency, 12 outstanding lines give at most 12 × 64 B / 80 ns ≈ 9.6 GB/s per core from DRAM by demand misses alone. The rest of the load queue just holds loads waiting for a buffer.</p>
<p><strong>How prefetchers get around it:</strong> the L2 prefetchers issue their requests from the L2, which has its own, larger set of miss-tracking entries (on the order of 32 or more). Prefetched lines land in the L2 (or LLC), so demand loads then miss the L1 but hit the L2, holding a fill buffer for only about 15 cycles instead of the full DRAM latency. Each buffer then serves many more lines per second.</p>
<p><strong>Consequences:</strong></p>
<ul>
<li>A single core’s streaming bandwidth is limited by fill buffers when prefetching is off, and by the L2’s miss handling and the uncore when it is on. Turning prefetchers off in an experiment can cut bandwidth several times.</li>
<li>Software prefetches to L1 occupy fill buffers too, so they hit the same limit.</li>
<li>In a model, the fill buffers, the L2 miss-tracking entries, and the prefetcher must all be modeled. A model with an unlimited L1 MSHR count, or one that models the load queue as the limit, overestimates single-core bandwidth on random access and gets the effect of prefetching wrong.</li>
</ul>
<p>Later cores raised the count (Golden Cove has 16 fill buffers), still far below load-queue sizes, for the same timing and area reasons.</p>`, "hard"),
},
{
  id: "intv-mem",
  title: "Caches, TLBs and DRAM",
  body: `
<p>Background: <a href="#/r/mem">Memory Hierarchy</a>, <a href="#/r/ctr">Cache Trade-Offs</a>, <a href="#/dcache/way-pred">Way Prediction in the Data Cache</a>, <a href="#/tlb">TLBs and Page Walks</a>, <a href="#/dram-ctrl">DRAM Controllers and Scheduling</a>.</p>
<h3 id="sec-cache">Cache Organization and Policy</h3>` +
Q(`<p>Zen 5 grew its L1D from 32 KB, 8-way to 48 KB, 12-way, keeping 64 sets. Why add ways instead of sets, and what does that cost?</p>`,
`<p>With 64-byte lines and 64 sets, offset plus index is 6 + 6 = 12 bits, exactly the 4 KB page offset. The set is chosen from bits that need no translation, so the cache can be virtually indexed and physically tagged, with the DTLB lookup in parallel and no aliasing. 128 sets would need bit 12, which is translated, so the design would need synonym handling or a slower physically indexed access.</p>
<p>The cost: a parallel read now touches 12 ways of tags and data, which takes more energy per load and a wider output mux on the load-to-use path. That is why the L1D’s utag way predictor matters: a load reads only the predicted way.</p>`, "easy") +
Q(`<p>How would you classify every L1D miss in your model as compulsory, capacity, conflict, or coherence? What does each class tell you to change?</p>`,
`<ul>
<li><strong>Compulsory:</strong> the first reference to the line in the run. Keep a set of every line ever seen.</li>
<li><strong>Capacity:</strong> misses that a fully associative LRU cache of the same size would also take. Run that shadow cache on the same access stream.</li>
<li><strong>Conflict:</strong> misses the real cache takes that the shadow cache doesn’t.</li>
<li><strong>Coherence:</strong> the line was present but invalidated by another core’s write. Record why each line left the cache.</li>
</ul>
<p>What each points to: compulsory misses to prefetching or larger lines, capacity misses to a larger cache or software blocking, conflict misses to associativity, index hashing, or padding, and coherence misses to data layout (false sharing) or fewer shared writes.</p>
<p>Caveat: the split depends on the shadow cache’s policy. A real policy can beat fully associative LRU on scans, giving a negative conflict count, so treat the classes as a guide rather than exact.</p>`, "medium") +
Q(`<p>A database’s 2 MB hot index shares a 32 MB LLC with table scans that stream 64 MB between index lookups. Under LRU, the index keeps missing. Explain why, and describe two replacement policies that fix it.</p>`,
`<p>LRU inserts every scanned line at the most-recently-used position. A 64 MB scan pushes each index line down to LRU and out before its next use, even though the index alone would fit easily.</p>
<ul>
<li><strong>RRIP</strong> (SRRIP, BRRIP, or DRRIP choosing between them by set dueling): new lines are inserted with a “distant re-reference” prediction and are evicted first unless they are hit again. Scan lines are never hit again, so they churn through a small part of each set, while index lines, promoted on every hit, stay.</li>
<li><strong>Insertion policies</strong> (LIP, BIP, and DIP choosing by set dueling): insert new lines at the LRU position (BIP occasionally at MRU), with the same effect.</li>
<li><strong>PC-based predictors</strong> (SHiP, Hawkeye): learn that the scan’s load PCs bring in lines that are never reused, and insert those at low priority.</li>
</ul>
<p>Software options: non-temporal hints on the scan, or way partitioning (Intel’s Cache Allocation Technology) that confines the scanning thread to a few ways.</p>`, "medium") +
Q(`<p>A stride prefetcher with 90% accuracy raises IPC on every benchmark when it runs alone. On a 32-core mix of the same benchmarks, throughput drops. How can an accurate prefetcher hurt, and what would you measure?</p>`,
`<p>Accuracy counts prefetches that were used, not what they cost everyone else:</p>
<ul>
<li><strong>Bandwidth:</strong> with 32 cores, DRAM is near saturation. Prefetches, even useful ones, raise the load, latency climbs up the loaded-latency curve, and every core’s demand misses slow down. A prefetch of data that would have been fetched in time anyway adds traffic and nothing else.</li>
<li><strong>Shared LLC pollution:</strong> prefetched lines evict other cores’ useful data.</li>
<li><strong>Occupancy:</strong> prefetches hold MSHRs and L2 and LLC queue entries that demand misses then wait for.</li>
<li><strong>Timeliness under load:</strong> prefetches issued too early are evicted by other cores’ traffic before use.</li>
</ul>
<p>Measure each core’s slowdown alone versus in the mix, DRAM bandwidth and loaded latency with the prefetcher on and off, LLC misses of each core to lines evicted by another core’s prefetches, and MSHR and queue occupancy by prefetches. Fixes: throttle on bandwidth and pollution feedback (feedback-directed prefetching), insert prefetched lines at low replacement priority, and coordinate throttling across cores.</p>`, "hard") +
M(`<p>A 1 MB, 16-way L2 with 64-byte lines and 48-bit physical addresses stores, per line, the tag plus 4 state bits.</p>
<ul>
<li>(a) How large is the tag array?</li>
<li>(b) A sectored version uses 128-byte lines made of two 64-byte sectors, each with its own 4 state bits. How large is its tag array?</li>
<li>(c) A workload’s hot data is 700 KB of 64-byte records, but only every other record is hot, so each 128-byte block holds one hot sector. Which design holds the hot data?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> 1 MB / 64 B = 16,384 lines, in 16,384 / 16 = 1,024 sets. Offset 6 bits and index 10 bits leave a 48 − 16 = 32-bit tag. 36 bits × 16,384 = 589,824 bits = <strong>72 KB</strong>, 7% of the data array.</li>
<li><strong>(b)</strong> 8,192 tags in 512 sets: offset 7 and index 9 bits leave a 32-bit tag again. 32 + 2 × 4 = 40 bits × 8,192 = 327,680 bits = <strong>40 KB</strong>, saving 32 KB.</li>
<li><strong>(c)</strong> The plain cache holds 16,384 lines, so 700 KB of hot lines fit. The sectored cache has only 8,192 tags, and each hot sector uses a whole one, so it holds at most 8,192 × 64 B = <strong>512 KB</strong> of hot data and misses on the rest. Sectoring saves tag area when access is dense and halves effective capacity when it is sparse.</li>
</ol>`, "medium") +
`<h3 id="sec-way">Way Prediction in the Data Cache</h3>` +
Q(`<p>Two processes on the SMT siblings of an AMD core read a shared-memory buffer mapped at different virtual addresses in each. Profiling shows a high L1D miss rate, though the buffer is only 16 KB. Explain it, say how you’d confirm it, and why AMD chose to treat a utag mismatch as a miss.</p>`,
`<p>The L1D’s utag is a hash of linear (virtual) address bits. One physical line reached through two virtual addresses has two different utags, but only one can be stored with the line. An access through the other mapping finds no matching utag, which counts as an L1 miss: it goes to the L2, and the line is retagged under the new hash. Then the other thread misses on its next access. The line never leaves the L2, so the symptom is L1 misses that all hit in L2 on a tiny buffer.</p>
<p><strong>Confirm:</strong> a microbenchmark that maps the buffer at the same virtual address in both processes (or uses two threads of one process). The misses should vanish. In a model, compute per-line utags from virtual addresses so the effect appears.</p>
<p><strong>Why a miss:</strong> it turns a way mispredict into a clean miss that the existing miss and replay path already handles. The scheduler wakes dependents for a fixed L1 hit latency, and a “late hit in another way” would need a new replay case in a critical timing loop. The costs are alias and collision misses, and the side channel shown in “Take A Way” (2020).</p>`, "hard") +
Q(`<p>Why does a way misprediction cost more in the L1D of an out-of-order core than in its instruction cache? Why don’t stores need a way predictor at all?</p>`,
`<ul>
<li><strong>Data side:</strong> the scheduler wakes a load’s dependents speculatively so they arrive exactly when an L1 hit returns. A late hit means they issued too early, so they are cancelled and replayed, wasting issue slots and port bandwidth. Load-to-use latency also sits on almost every dependency chain.</li>
<li><strong>Instruction side:</strong> a one-cycle fetch bubble is usually absorbed by the fetch queue or the FTQ.</li>
<li><strong>Stores</strong> write the cache only after they commit, off the critical path. They can check the tags first and write just the way that hit, which gets way selection’s energy saving with no prediction.</li>
</ul>`, "medium") +
M(`<p>Two SMT threads alternate reading a shared buffer through different virtual mappings, as in the utag question in the Conceptual tab. Each thread does 350 loads per 1,000 instructions, and 12 of them per 1,000 instructions touch a line last accessed through the other mapping. Each of those becomes a 14-cycle L2 hit instead of a 4-cycle L1 hit, and 30% of the extra latency shows up in run time. Each thread runs at CPI 0.9 without the problem, on a 4.5 GHz core.</p>
<ul>
<li>(a) What does the aliasing cost each thread?</li>
<li>(b) How much extra L2-to-L1 traffic does each thread cause?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Each alias adds (14 − 4) × 0.3 = 3 exposed cycles. 12 per 1,000 instructions gives 36 cycles per 1,000, or 0.036 CPI. CPI rises from 0.9 to 0.936, about <strong>4% slower</strong>.</li>
<li><strong>(b)</strong> Each thread retires 4.5 × 10<sup>9</sup> / 0.936 ≈ 4.8 × 10<sup>9</sup> instructions per second, so 0.012 × 4.8 × 10<sup>9</sup> ≈ 5.8 × 10<sup>7</sup> extra fills, × 64 B ≈ <strong>3.7 GB/s</strong>.</li>
<li>The fix is free: map the buffer at the same virtual address in both processes, or share it between threads of one process.</li>
</ol>`, "medium") +
`<h3 id="sec-tlb">Address Translation</h3>` +
Q(`<p>Why should a model send page-walk reads through the cache hierarchy instead of charging a fixed walk latency? What other walker details set translation throughput?</p>`,
`<p>A walk is a chain of dependent loads, and its cost depends on where the page-table entries are: the upper levels are almost always in the page-walk caches, while the leaf entries sit in L1 or L2 for small footprints and in L3 or DRAM for large random ones. A fixed latency is wrong in both directions, and it misses that page-table lines compete with data for cache capacity and bandwidth (huge pages shrink the tables so they stay cached).</p>
<p>Throughput details:</p>
<ul>
<li>The number of walkers, which caps overlapping TLB misses the way MSHRs cap overlapping cache misses (Intel went from one to two in Broadwell, and Zen 5 has six).</li>
<li>Page-walk cache sizes for each level.</li>
<li>Whether walks start for speculative loads, and any translation prefetching.</li>
<li>The page sizes the production system would really use.</li>
</ul>`, "medium") +
Q(`<p>On silicon, backing a graph-analytics workload with 2 MB pages makes it 15% faster. Your model, which charges a fixed 30 cycles per L2 TLB miss, predicts 1%. What is the model missing?</p>`,
`<ul>
<li><strong>Walk cost isn’t fixed.</strong> A leaf entry is 8 bytes per 4 KB page, so a 48 GB footprint needs about 96 MB of leaf entries, which don’t fit in cache: many walks go to DRAM, hundreds of cycles each. With 2 MB pages there are 512× fewer entries, and they stay cached.</li>
<li><strong>The walk is on the critical path.</strong> The data load can’t issue until its walk finishes, so walk latency adds to every random access.</li>
<li><strong>Walker count.</strong> With few walkers, walks queue, and the walker bound (misses × walk latency / walkers) can be the bottleneck rather than the data MSHRs.</li>
<li><strong>Cache pollution.</strong> Page-table lines evict data and add traffic.</li>
<li><strong>Setup.</strong> The model may hand out the wrong page size for the baseline, or ignore how the OS maps memory.</li>
</ul>
<p>Fix: model walks as loads through the hierarchy, with the real walker count and page-walk caches and page tables built from the real mapping. Validate with a pointer chase over a huge array at each page size.</p>`, "hard") +
M(`<p>A graph kernel does independent random 8-byte reads over a 48 GB array, and every read misses to DRAM (400 cycles). The core keeps up to 16 data misses in flight and has 6 page walkers. The L2 DTLB holds 4,096 entries for 4 KB or 2 MB pages (as on Zen 5), plus a 1,024-entry array for 1 GB pages. A walk finds the upper levels in the page-walk cache and reads only the leaf entry. With 4 KB pages, that entry comes from DRAM 60% of the time and from L3 (50 cycles) otherwise. With 2 MB pages it always hits in L3. Considering only the miss and walk bounds, find the cycles per read with 4 KB, 2 MB, and 1 GB pages.</p>`,
`<ol>
<li>Data bound: 400 / 16 = 25 cycles per read.</li>
<li><strong>4 KB pages:</strong> the reach is 16 MB against 48 GB, so essentially every read walks. Walk = 0.6 × 400 + 0.4 × 50 = 260 cycles. Walker bound: 260 / 6 ≈ 43.3. T = max(25, 43.3) = <strong>43.3 cycles</strong>, bound by the walkers.</li>
<li><strong>2 MB pages:</strong> 48 GB / 2 MB = 24,576 pages against 4,096 entries, so 1 − 4,096 / 24,576 ≈ 83% of reads still miss the TLB. Each walk costs 50 cycles: 0.83 × 50 / 6 ≈ 6.9. T = <strong>25 cycles</strong>, bound by data misses, 1.73× faster.</li>
<li><strong>1 GB pages:</strong> 48 pages, all in the 1,024-entry array, so no walks. T = <strong>25 cycles</strong>, no better than 2 MB here.</li>
<li>2 MB pages win not by hitting in the TLB (83% still miss) but by making walks cheap: their 24,576 leaf entries take 192 KB and stay cached, while 4 KB pages need 12.6 million entries, about 96 MB.</li>
</ol>`, "hard") +
`<h3 id="sec-dram">DRAM and Bandwidth</h3>` +
Q(`<p>Why is a fixed DRAM latency fine for modeling a pointer-chasing benchmark but badly wrong for a bandwidth-heavy one?</p>`,
`<p>Pointer chasing has one miss in flight at a time, so the controller is lightly loaded, requests rarely queue, and latency stays near idle. Bandwidth-heavy code keeps many misses in flight: queues build, bank conflicts multiply, and latency rises steeply as utilization nears 70 to 90% of peak. A fixed latency gives such code no bandwidth ceiling and too low a latency at the same time. Use a DRAM model with banks, row buffers, and timing constraints, and validate its latency-versus-bandwidth curve (with a tool like Intel’s Memory Latency Checker), not just its idle latency.</p>`, "easy") +
Q(`<p>In your model, a kernel that reads one 64-byte line every 8 KB gets a third of the bandwidth of a sequential stream, though both read the same number of lines. Explain it in terms of the DRAM address mapping, and say how controllers avoid it.</p>`,
`<p>The controller takes the channel, bank group, and bank from fixed address bits above the column bits. A power-of-two stride such as 8 KB leaves those bits unchanged, or cycles them through a few values. So every access lands in the same channel and bank, each in a different row: every access is a row conflict (precharge, activate, read) in one bank, serialized by the bank’s row cycle time, while the other banks and channels sit idle. A sequential stream hits open rows and spreads over banks and channels.</p>
<p>Fixes:</p>
<ul>
<li>XOR the bank and channel bits with higher row bits, so strides spread across banks.</li>
<li>Interleave channels on low address bits.</li>
<li>In software, pad arrays so their strides aren’t powers of two.</li>
</ul>
<p>In the model, implement the real controller’s mapping. Row-hit rate and bank spread are very sensitive to it.</p>`, "hard") +
Q(`<p>Your DRAM model shows periodic read-latency spikes of several hundred nanoseconds during a store-heavy phase, though average bandwidth is well below peak. What causes them, and what would you measure or change?</p>`,
`<p><strong>Write drain.</strong> The controller buffers writes and, when the write queue passes a high watermark, switches the bus to writes and drains down to a low watermark. Switching the bus direction costs turnaround time, so writes are drained in batches, and reads wait through each batch. All-bank refresh blocks the rank in the same way.</p>
<p><strong>Measure:</strong> read latency over time against write-queue occupancy, drain start and stop events, and refresh events. The spikes should line up with drains.</p>
<p><strong>Change:</strong></p>
<ul>
<li>Tune the watermarks: smaller batches trade more turnarounds for shorter waits.</li>
<li>Let old reads interrupt a drain, with a cap.</li>
<li>Use DDR5’s same-bank refresh so other banks keep working.</li>
<li>Reduce write traffic upstream: write-combining, and non-temporal stores that avoid read-for-ownership traffic.</li>
</ul>
<p>The spikes matter for tail latency even when the average looks fine.</p>`, "hard") +
M(`<p>DDR5-6000 with 30-38-38 timings (tCL-tRCD-tRP, a common desktop kit) runs its bus clock at 3,000 MHz. Under an open-page policy, a workload’s accesses are 45% row hits, 15% to closed rows, and 40% row conflicts.</p>
<ul>
<li>(a) What is the average device latency?</li>
<li>(b) A closed-page policy precharges after every access, so every access finds its row closed. Assume the precharge is always hidden. Which policy wins here?</li>
<li>(c) In general, when does open-page win?</li>
</ul>`,
`<ol>
<li>Clock period 1 / 3,000 MHz ≈ 0.333 ns, so tCL = 10.0 ns, tRCD = 12.67 ns, and tRP = 12.67 ns.</li>
<li>Row hit 10.0 ns. Closed row tRCD + tCL = 22.67 ns. Conflict tRP + tRCD + tCL = 35.33 ns.</li>
<li><strong>(a)</strong> 0.45 × 10.0 + 0.15 × 22.67 + 0.40 × 35.33 = 4.50 + 3.40 + 14.13 ≈ <strong>22.0 ns</strong>.</li>
<li><strong>(b)</strong> Closed page: always 22.67 ns. Open page wins, but only by about 0.6 ns, 3%.</li>
<li><strong>(c)</strong> Open minus closed = h × (10.0 − 22.67) + c × (35.33 − 22.67) = 12.67 × (c − h), since tRCD = tRP here. Open page wins exactly when <strong>row hits outnumber row conflicts</strong>. Real controllers adapt, closing a row after a timeout or when no queued request targets it.</li>
</ol>`, "medium") +
M(`<p>A Zen 5 core can track 124 outstanding misses, and idle DRAM latency is 90 ns.</p>
<ul>
<li>(a) By Little’s law, how much bandwidth could one core draw?</li>
<li>(b) The core’s chiplet connects to the I/O die over a link that reads 32 bytes per fabric clock at 2.0 GHz. What bounds a single core now, and how many misses does it actually need in flight?</li>
<li>(c) The desktop part has two 64-bit channels of DDR5-6000 and sustains about 80% of peak. How many cores does it take to saturate DRAM?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> 124 × 64 B / 90 ns = 7,936 B / 90 ns ≈ <strong>88 GB/s</strong>.</li>
<li><strong>(b)</strong> The link moves 32 B × 2.0 GHz = <strong>64 GB/s</strong>, below 88, so it binds. At 64 GB/s and 90 ns, Little’s law needs 64 × 90 = 5,760 B in flight, <strong>90 lines</strong>. (Once the link queues, latency rises above 90 ns, and the extra miss slots absorb it.)</li>
<li><strong>(c)</strong> Peak is 2 × 6,000 MT/s × 8 B = 96 GB/s, so about 77 GB/s sustained. One chiplet’s link (64 GB/s) can’t saturate it, but two cores on different chiplets (128 GB/s of link) can. So <strong>2 cores</strong>, if they are on different chiplets.</li>
<li>Real single-core bandwidth is usually lower still, because L2 and L3 miss queues and the prefetchers limit how many of those slots fill. The point stands: on desktop parts, a core or two can saturate memory.</li>
</ol>`, "hard"),
},
{
  id: "intv-coh",
  title: "Coherence and Consistency",
  body: `
<p>Background: <a href="#/r/coh">Coherence</a>, <a href="#/moesi">MOESI, MESIF, and Snoop Filters</a>, <a href="#/coh-transient">Transient States and Protocol Races</a>, <a href="#/consistency">Memory Consistency Models in Hardware</a>.</p>
<h3 id="sec-protocol">Protocols and States</h3>` +
Q(`<p>In MESIF, why does exactly one sharer hold a clean shared line in the F state, and which sharer gets it?</p>`,
`<p>A new reader can get a clean shared line from another cache faster than from memory, but if every sharer answered, all but one reply would be wasted traffic. F names a single responder, and the other sharers stay silent in S. The newest requester usually receives F, and the previous holder drops to S, because the newest copy is the least likely to be evicted soon. If the F copy is evicted, the next request is served by the LLC or memory.</p>`, "easy") +
Q(`<p>A core holding a line in E can write it without telling anyone. Why can’t a core in S? What does the upgrade cost with snooping and with a directory?</p>`,
`<p>E guarantees there are no other copies, so moving to M silently is safe. S means other caches may hold copies, and they must be invalidated before the write, or two cores could see different values (the single-writer invariant).</p>
<ul>
<li><strong>Snooping:</strong> the core broadcasts an upgrade. Every cache checks its tags and drops its copy, and the write proceeds once the request is ordered on the interconnect (and acknowledged, if the interconnect isn’t atomic).</li>
<li><strong>Directory:</strong> the request goes to the line’s home, which sends invalidations to each recorded sharer and tells the requester how many acknowledgments to expect. The sharers acknowledge directly to the requester. The critical path is requester → home → sharer → requester, plus the home’s lookup.</li>
</ul>
<p>That cost is why E exists: private data that is read and then written never needs the upgrade.</p>`, "medium") +
`<h3 id="sec-scale">Snoop Filters and Directories</h3>` +
Q(`<p>When Intel grew the private L2 from 256 KB to 1 MB per core in Skylake-SP, it also changed the shared LLC from inclusive to non-inclusive, with a separate snoop filter. Why do those two changes belong together?</p>`,
`<p>An inclusive LLC holds a copy of every line in the private caches. With 1 MB of L2 per core and 1.375 MB of LLC per core, it would spend most of its capacity duplicating the L2s, leaving little room for shared and victim data. Its evictions would also back-invalidate hot L2 lines often.</p>
<p>A non-inclusive LLC holds mostly L2 victims, so the effective capacity is close to L2 plus LLC. But the LLC tags no longer record what the private caches hold, so a separate snoop filter (tags and presence bits, no data) must track every private line. That costs far less per tracked line than duplicating the data. It has to be sized for all private capacity with associativity to spare, or its own evictions back-invalidate lines that cores are still using.</p>`, "hard") +
M(`<p>A 96-core chip has a 1 MB private L2 per core with 64-byte lines, and a sparse directory with one entry per line held in a private cache. Compare the sharer-tracking bits per entry and in total for:</p>
<ul>
<li>(a) a full bit vector</li>
<li>(b) four limited pointers plus an overflow bit that falls back to broadcast</li>
<li>(c) a coarse vector with one bit per cluster of 8 cores</li>
</ul>
<p>What does each send when a core writes a line that 20 other cores share?</p>`,
`<ol>
<li>Entries: 96 × 1 MB / 64 B = 1,572,864.</li>
<li><strong>(a)</strong> 96 bits each, 1,572,864 × 96 ≈ 151 million bits = <strong>18 MiB</strong>.</li>
<li><strong>(b)</strong> Each pointer names one of 96 cores in 7 bits: 4 × 7 + 1 = 29 bits, about <strong>5.4 MiB</strong>.</li>
<li><strong>(c)</strong> 96 / 8 = 12 bits, <strong>2.25 MiB</strong>.</li>
<li>Write to a line with 20 sharers: (a) sends exactly <strong>20</strong> invalidations. (b) has overflowed its 4 pointers, so it broadcasts to all <strong>95</strong> other cores. (c) invalidates every core in each cluster with a sharer, from 24 messages if the sharers are packed into 3 clusters up to 95 if they are spread over all 12.</li>
<li>Real directories also overprovision entries beyond the private line count, to absorb conflicts in their own sets.</li>
</ol>`, "medium") +
M(`<p>A 64-core chip runs at 3 GHz. Each core runs at IPC 1.5 with 20 L2 misses per 1,000 instructions.</p>
<ul>
<li>(a) With broadcast snooping, how many snoop lookups per cycle must each core’s L2 tags handle, and how many snoop messages cross the network per cycle?</li>
<li>(b) A snoop filter forwards only the 4% of misses to lines that another private cache holds, to 1.5 caches on average. What are the two rates now?</li>
</ul>`,
`<ol>
<li>Misses per core per cycle: 1.5 × 0.02 = 0.03. Chip-wide: 64 × 0.03 = 1.92 per cycle.</li>
<li><strong>(a)</strong> Each core sees every other core’s misses: 63 × 0.03 ≈ <strong>1.9 snoops per cycle</strong>, nearly two tag lookups per cycle on top of its own accesses, far more tag bandwidth than an L2 has to spare. The network carries 1.92 × 63 ≈ <strong>121 snoop messages per cycle</strong>.</li>
<li><strong>(b)</strong> Forwarded probes: 1.92 × 0.04 × 1.5 ≈ <strong>0.12 per cycle</strong> chip-wide, or about <strong>0.002 per core per cycle</strong>, roughly a thousand times fewer.</li>
<li>That is the case for directories and snoop filters at high core counts.</li>
</ol>`, "medium") +
`<h3 id="sec-races">Transient States and Races</h3>` +
Q(`<p>Why can’t a cache that has sent a GetM for a line simply be in M, or stay in I, until the reply arrives?</p>`,
`<p>M is wrong because the cache has no data yet and other caches may still hold copies, so writing would break the single-writer invariant. I is wrong because the cache has a request outstanding: if a forwarded request or an invalidation for the line arrives in the meantime, it must know it is mid-transaction so it can stall, acknowledge, or merge correctly. It needs a transient state, IM<sup>AD</sup> in the primer’s naming: going from I to M, waiting for data and acknowledgments.</p>`, "easy") +
Q(`<p>A cache in IM<sup>A</sup> (it has the data and is waiting for acknowledgments) receives a Fwd-GetM for a later writer and stalls it. Explain how that stall could deadlock the system if every message shares one network, and why separate virtual networks with responses that always sink prevent it.</p>`,
`<p>The stalled Fwd-GetM sits at the head of the cache’s input queue. The acknowledgments the cache needs to reach M arrive on the same queue, behind it, so they can never be consumed. The cache never reaches M, so it never handles the forward, and other caches whose messages back up behind it stall too: deadlock.</p>
<p>With separate virtual networks (requests, forwarded requests, responses), each with its own buffers, the acknowledgments travel on the response network and can’t be blocked by the stalled forward. Responses always sink: consuming one never requires sending a message that could block. So the response network always drains, the transaction completes, and the stalled forward proceeds.</p>`, "hard") +
Q(`<p>Eight cores spin on a lock in a directory-based system. Compare the coherence traffic of test-and-set spinning and test-and-test-and-set spinning, both while the lock is held and at the moment it is released. What does a queue lock change?</p>`,
`<p><strong>Test-and-set:</strong> every spin is an atomic read-modify-write that needs the line in M. While the lock is held, the line moves from spinner to spinner, each attempt an ownership request, an invalidation, and a data transfer. The holder’s releasing store must also get the line back in M, queued behind the spinners’ requests, so even the release is delayed.</p>
<p><strong>Test-and-test-and-set:</strong> spinners use plain loads until the lock looks free, so they all hold the line in S and spin in their own L1 with no traffic while it is held. At release, the holder’s store invalidates all 7 sharers. All 7 then re-read it (7 transfers from the new owner), see it free, and all try the atomic: 7 ownership requests, serialized. One wins, and the rest fail and return to reading. That is a burst of transfers per handoff, but none while the lock is held.</p>
<p><strong>Queue locks</strong> (MCS) give each waiter its own line to spin on, so a handoff is a single transfer. Backoff also shrinks the burst. A performance model needs per-line busy states and serialization at the directory to cost any of these correctly.</p>`, "hard") +
M(`<p>A hot lock line lives at one directory slice. Each acquire is a transaction that keeps the line’s directory entry busy for 60 ns, and requests to a busy line wait. 32 cores each try to acquire the lock about once every 2 µs, at random times.</p>
<ul>
<li>(a) What fraction of the time is the entry busy?</li>
<li>(b) Treating it as an M/D/1 queue, what is the average wait before a transaction starts?</li>
<li>(c) What happens if each core’s rate rises by 10%?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Arrivals: 32 / 2,000 ns = 0.016 per ns. Utilization ρ = 0.016 × 60 = <strong>0.96</strong>.</li>
<li><strong>(b)</strong> For M/D/1, the mean wait is W = ρ S / (2 (1 − ρ)) = 0.96 × 60 / (2 × 0.04) = <strong>720 ns</strong>, twelve times the service time. Each acquire takes about 780 ns, not 60.</li>
<li><strong>(c)</strong> ρ = 1.056, above 1: the queue grows without bound. In practice cores slow down as they wait, and acquisitions saturate at 1 / 60 ns ≈ 16.7 million per second chip-wide.</li>
<li>A model without per-line busy states and queuing at the directory charges 60 ns where the real system pays more than ten times as much.</li>
</ol>`, "hard") +
`<h3 id="sec-order">Consistency Models</h3>` +
Q(`<p>Thread 0 writes data and then sets a flag. Thread 1 waits for the flag and then reads the data. Why can thread 1 see the flag set and still read stale data on Arm, but not on x86? What is the cheapest correct fix on Arm?</p>`,
`<p>x86’s TSO keeps stores in order and loads in order: if the flag is visible, the data is too, and thread 1’s loads stay ordered. Arm’s model lets independent stores become visible out of order and independent loads complete out of order, so either side can break the pattern.</p>
<p>The cheapest fix is a store-release for the flag (<code>stlr</code>) and a load-acquire to read it (<code>ldar</code>, or <code>ldapr</code>). Release orders every earlier access before the flag store, and acquire orders the flag load before every later access. That is cheaper than full <code>dmb</code> barriers on both sides. An address dependency from the flag to the data also orders them at no cost, if the code’s structure allows it.</p>`, "medium") +
Q(`<p>An out-of-order x86 core executes loads out of order, yet TSO requires loads to appear in program order. How does it stay correct? What does it cost when the check fails, and how could the same idea make sequential consistency nearly as fast as TSO?</p>`,
`<p>Loads execute speculatively as soon as their addresses are ready, and the load queue keeps each load’s address until it retires. If an invalidation (another core’s write) or an eviction hits a line that a completed but unretired load has read, while an older load is still incomplete, the reordering might be visible. The core then squashes that load and everything younger and re-executes: a memory-ordering machine clear.</p>
<p>The cost is a full flush, like a mispredict, and it grows with the window size. Counters such as Intel’s MACHINE_CLEARS.MEMORY_ORDERING show it, and frequent clears point at true sharing of hot lines.</p>
<p>For SC, the remaining relaxation in TSO is a load passing an older buffered store. An SC machine can let loads do that speculatively too, and roll back if a conflicting coherence event arrives before the store commits. Gniady, Falsafi, and Vijaykumar (1999) showed that with enough speculation buffering, SC comes close to relaxed models. What costs performance is waiting for order, not order itself.</p>`, "hard") +
Q(`<p>In the IRIW litmus test, two threads each write one location, and two reader threads read both locations in opposite orders. Arm and RISC-V forbid the outcome where the readers disagree on which write came first, while POWER allows it. What property does that reflect, and what hardware arrangement would allow it?</p>`,
`<p>The property is multi-copy atomicity: a store becomes visible to all other cores at the same moment. Then, once each reader’s two loads are ordered (by acquire, a barrier, or a dependency), both readers must agree on the order of the two writes.</p>
<p>POWER isn’t multi-copy atomic: a store can become visible to some cores before others. One arrangement that causes this is cores or hardware threads that share a store buffer or a cache through which stores pass, and forward stores to each other before they are visible to everyone. A reader next to the first writer sees x first, while a reader next to the second writer sees y first. Forbidding the outcome means no core may read a store before it is visible to all, for example by not forwarding between SMT threads from a shared store buffer before commit. The payoff is much simpler reasoning for programmers and tools.</p>`, "hard") +
M(`<p>A producer on an x86 core publishes each message by writing 64 bytes (8 stores) into a ring-buffer slot, then the slot’s ready flag, then executing <code>mfence</code>. At the fence, the store buffer holds those 9 stores. Stores commit to L1 in order, one per cycle when they hit. The slot’s line and the flag’s line both miss, since the consumer read them last, and each needs a 60-cycle ownership transfer. The fence costs 30 cycles on top of the drain.</p>
<ul>
<li>(a) How long does the fence take if each ownership request starts only when its store reaches the head of the buffer, and if both start early?</li>
<li>(b) At 4 GHz, what message rate does the fence allow?</li>
<li>(c) Is the fence needed?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> In order: 60 cycles for the slot’s line, 8 commits, then 60 for the flag’s line and 1 commit, about 129 cycles, plus 30: about <strong>160 cycles</strong>. With both ownership requests started early, they overlap: about 60 + 9 + 30 ≈ <strong>100 cycles</strong>.</li>
<li><strong>(b)</strong> At most 4 × 10<sup>9</sup> / 160 = <strong>25 million</strong> messages per second, or 40 million with early ownership requests, before counting the producer’s own work.</li>
<li><strong>(c)</strong> No. Under TSO, stores become visible in program order, so a consumer that sees the flag and then reads the slot sees the message: the message-passing outcome is forbidden on x86. A fence is needed only to order a store before a later load (the store-buffering pattern, as in Dekker-style locks). Without it, the producer keeps working while the stores drain, and throughput is set by the ownership transfers, which overlap with other work. On Arm, the flag would need a store-release.</li>
</ol>`, "hard") +
`<h3 id="sec-sharing">Sharing Costs</h3>` +
Q(`<p>How would you find false sharing in a C performance model, and on an x86 server with performance counters?</p>`,
`<p><strong>Model:</strong> record, per line, which bytes each core writes. Flag coherence misses (a line invalidated by another core’s write) where the invalidating write and the missing access touch disjoint bytes, and report them by line and PC.</p>
<p><strong>Silicon:</strong> count loads that hit a line modified in another core’s cache (HITM events), and use <code>perf c2c</code> to group them by cache line and by the offsets each thread touches. Different threads hitting disjoint offsets of one hot line is false sharing.</p>
<p><strong>Fix:</strong> pad or align per-thread data to separate lines. Use 128 bytes on Intel cores whose spatial prefetcher fetches lines in pairs.</p>`, "medium") +
M(`<p>Sixteen threads each increment their own 8-byte counter, and the 16 counters are packed into two 64-byte lines, 8 per line. Each thread increments once every 50 ns between other work. A line transfer between cores takes 70 ns, and transfers of one line are serialized.</p>
<ul>
<li>(a) Estimate each thread’s increment rate.</li>
<li>(b) What does padding cost in memory, and what rate does it give?</li>
</ul>`,
`<ol>
<li>Demand per line: 8 threads × 1 / 50 ns = 0.16 increments per ns. The line can move at most once per 70 ns, about 0.014 per ns, so it is saturated more than ten times over.</li>
<li><strong>(a)</strong> With the line saturated, each thread waits for the other 7 transfers before its own: about 8 × 70 = <strong>560 ns per increment</strong>, 11× slower than the 50 ns it wanted.</li>
<li><strong>(b)</strong> One counter per line takes 16 × 64 B = <strong>1 KB</strong> instead of 128 B, and each thread is back to one increment per 50 ns plus an L1 hit. Even 2 KB, with 128-byte padding, is trivial next to an 11× slowdown.</li>
</ol>`, "medium") +
Q(`<p>32 threads each increment one shared 64-bit counter with <code>lock xadd</code> in a loop. Throughput stays flat or falls as you add threads. What limits it, and why do per-thread counters that are summed only when read scale almost perfectly?</p>`,
`<p><strong>What limits it:</strong> each atomic increment needs the line in M state in the incrementing core. With 32 cores contending, every increment moves the line from the previous owner: an invalidation or forward through the directory or snoop filter, then the data transfer. Throughput is about one increment per line transfer, which is tens of nanoseconds on a large server (more across sockets), regardless of how many threads try. Adding threads adds queueing, not throughput, and fairness or retry effects can make it fall.</p>
<p>The locked instruction also acts as a full barrier on x86, so each thread’s own pipeline stalls around it, but the line transfer dominates.</p>
<p><strong>Per-thread counters:</strong> each thread increments its own counter, in its own cache line (padded to 64 bytes, or 128 on cores whose prefetchers fetch line pairs). The line stays in M in that core’s L1, so each increment is an ordinary L1 hit, a few cycles. Reading the total sums all counters, which costs one line transfer per thread but happens rarely.</p>
<p>The trade-off is that the sum is not a single atomic snapshot: it may mix values from slightly different moments. That is fine for statistics and reference counts that are only checked against zero rarely, and not fine where every increment must be totally ordered. Linux’s per-CPU counters and many allocators use this pattern.</p>`, "medium"),
},
{
  id: "intv-diag",
  title: "Diagnosing Bottlenecks",
  body: `
<p>Background: <a href="#/perf-stats">Performance Statistics</a>, <a href="#/perf-stalls">Stall Causes</a>, <a href="#/perf-bottlenecks">Bottleneck Types</a>.</p>
<h3 id="sec-chains">Following the Causal Chain</h3>` +
Q(`<p>On Zen 4 (320-entry ROB, 6-wide dispatch, 8-wide retire), a load misses in L2 and hits in L3 (about 50 cycles). Many younger instructions are independent of it. Walk through what happens to the scheduler, the ROB, and retirement, cycle by cycle in broad strokes.</p><p>Put a number on it: when the load issues, the ROB holds 200 entries and the load is the oldest. Dispatch continues at 6 per cycle. How many cycles until the ROB fills, and for how many of the 50 cycles is dispatch stalled?</p>`,
`<ol>
<li><strong>The load issues</strong> and misses L1 and L2; a miss buffer tracks it. Dependents that were speculatively woken for an L1 hit are cancelled and go back to waiting.</li>
<li><strong>Independent instructions keep flowing:</strong> allocation continues at up to 6 per cycle, independent work issues and completes, and the load’s dependents accumulate in the scheduler.</li>
<li><strong>Retirement stalls</strong> as soon as the load reaches the ROB head; completed instructions pile up behind it.</li>
<li><strong>Does the ROB fill?</strong> At 6 per cycle, 320 entries take about 53 cycles, roughly the L3 latency. So for an L3 hit the ROB may just barely fill, depending on how early the load was in the window and on whether the scheduler or physical registers fill first with waiting dependents.</li>
<li><strong>Data returns:</strong> the dependents wake and issue, the load completes, and retirement drains the backlog at up to 8 per cycle.</li>
</ol>
<p>Net: an L3 hit is <em>mostly</em> hidden on a big core when the work behind it is independent. A DRAM miss (400+ cycles) is not.</p>
<p><strong>Numbers:</strong> 320 − 200 = 120 free entries at 6 per cycle: the ROB is full after <strong>20 cycles</strong>, and dispatch is stalled for the remaining <strong>~30 cycles</strong> (180 lost dispatch slots). If the load had been younger rather than at the head, older instructions would keep retiring, the ROB would fill later, and less of the latency would be exposed. Whether the 30 cycles cost time depends on whether the core had other work left to finish; they’re an upper bound on the damage.</p>`, "hard") +
M(`<p>Raising L3 latency in your model from 50 to 70 cycles drops IPC by 6%. The workload runs at about IPC 2 with about 4 L3 hits per 1,000 instructions. Explain the causal chain from the latency change to the IPC number, and say which statistics you would look at to confirm each link.</p>`,
`<ol>
<li><strong>Loads that hit L3 take 20 cycles longer.</strong> Check: the L3 hits per 1,000 instructions (the change only matters in proportion to them).</li>
<li><strong>Part of the extra latency isn’t hidden</strong> by the window: where the work behind the load was enough to cover 50 cycles but not 70, the ROB, scheduler, or registers now fill. Check: full-resource stall cycles rise, attributed to loads waiting on L3.</li>
<li><strong>Chains through L3 hits get longer</strong> directly: if each load in a pointer chase hits L3, each step costs 20 more cycles with nothing to overlap. Check: average outstanding misses near 1 during those phases.</li>
<li><strong>Fewer cycles retire instructions</strong>, so IPC (instructions / cycles) drops.</li>
</ol>
<p>A rough sanity check: if the exposed portion of each L3 hit grew by about 15 of the 20 cycles, and there are about 4 L3 hits per 1,000 instructions at an IPC around 2 (500 cycles per 1,000 instructions), that’s 60 extra cycles per 500, about 12% more time. A 6% drop means more of the latency was hidden than that. Doing this arithmetic out loud is what interviewers want.</p>`, "hard") +
Q(`<p>A workload has a large ROB, plenty of physical registers, and a big scheduler, yet IPC is 0.8. List what you would investigate next, in order.</p>`,
`<ol>
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
M(`<p>Build a CPI stack:</p><ul><li>Base CPI 0.30</li><li>20 L2 misses per 1,000 instructions that hit L3 and expose 15 of their 50 cycles</li><li>3 DRAM misses per 1,000 instructions that expose 250 cycles each</li><li>5 mispredicts per 1,000 instructions at 17 cycles</li></ul><p>(a) What is the total CPI? (b) Rank the speedups from halving DRAM misses, perfect branch prediction, and cutting L3 latency to 40 cycles (assume the hidden part of an L3 hit stays 35 cycles).</p>`,
`<ol>
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
<ol>
<li><strong>MLP and latency:</strong> average outstanding misses over cycles with at least one in flight, average miss latency, and from them the throughput. MLP near 1 points to dependent misses, which a bigger ROB can’t fix.</li>
<li><strong>Misses by level:</strong> L2 versus LLC versus DRAM, with latency per level. LLC hits (about 50 cycles) are a different problem from DRAM misses (400+).</li>
<li><strong>Address dependence:</strong> does each missing load’s address come from an earlier missing load (pointer chasing)? If so, the fix is lower latency, prefetching, or a data-structure change.</li>
<li><strong>A sweep:</strong> grow the ROB with the load queue, physical registers, and scheduler scaled together, and track MLP, latency, IPC, and the stall reason. Growing only the ROB just moves the stall to the next structure.</li>
<li><strong>If MLP plateaus:</strong> MSHR occupancy against its maximum, DRAM bandwidth against its peak, and mispredicts on branches that depend on missing loads (they cut the window short).</li>
<li><strong>Prefetching:</strong> if the miss addresses are regular, a prefetcher may buy more than 192 extra entries.</li>
</ol>
<p>Agree only if MLP rises with the window and IPC follows. Otherwise the area belongs elsewhere.</p>`, "medium") +
Q(`<p>A loop has one independent DRAM miss per iteration. A colleague sized the ROB to cover the miss and is surprised that rename mostly stalls on a full scheduler, not a full ROB. Why can the scheduler fill first, and what decides which structure binds?</p>`,
`<p>Retire-ordered structures (ROB, load and store queues, physical registers) keep every entry behind the miss until it retires, about the miss latency L. Their bound is entries per iteration × L / capacity.</p>
<p>The scheduler keeps only instructions that haven’t issued. Independent ones leave within a few cycles, but the dependents of the missing load wait about L. Its bound is dependents per iteration × L / scheduler entries. Schedulers are several times smaller than ROBs, so a loop where even a third of the instructions depend on the miss fills the scheduler first.</p>
<p>What binds is the largest E × R / C over all the structures, with the residency R worked out for each. Fixes: fewer instructions that depend on the miss, a larger scheduler, or a queue that holds ops that aren’t ready outside the scheduler, as Zen 5’s floating-point non-scheduling queue does.</p>`, "hard") +
M(`<p>A join loop on a Golden Cove-class core at 5 GHz has one independent DRAM miss per iteration (80 ns, so 400 cycles). Per iteration: 14 µops, 3 loads (one misses), 1 store, 10 µops that write an integer register, and 6 µops that depend on the missing load. The core has 6-wide rename, a 512-entry ROB, a 97-entry scheduler, 280 integer physical registers (16 architectural), a 192-entry load queue, a 114-entry store queue, and 16 L1 fill buffers. Bound each structure, find the bottleneck, and say whether doubling the scheduler helps.</p>`,
`<ol>
<li>A miss is always at the ROB head, so retire-ordered entries stay about 400 cycles. Scheduler entries stay that long only for the 6 dependents.</li>
<li>Bounds in cycles per iteration:
<ul>
<li>Fill buffers: 1 × 400 / 16 = <strong>25.0</strong></li>
<li>Scheduler: 6 × 400 / 97 ≈ <strong>24.7</strong></li>
<li>Integer registers: 10 × 400 / (280 − 16) ≈ 15.2</li>
<li>ROB: 14 × 400 / 512 ≈ 10.9</li>
<li>Load queue: 3 × 400 / 192 ≈ 6.3</li>
<li>Store queue: 1 × (400 + drain) / 114 ≈ 3.5 or a little more</li>
<li>Rename: 14 / 6 ≈ 2.3</li>
</ul></li>
<li>The fill buffers bind at <strong>25 cycles</strong>, with the scheduler just behind. Check: at 25 cycles per iteration the ROB holds 14 × 400 / 25 = 224 entries, under 512, and the scheduler 6 × 400 / 25 = 96, just under 97.</li>
<li>Doubling the scheduler gains <strong>nothing</strong>, because the fill buffers still bind at 25. Doubling the fill buffers alone moves the bound to the scheduler at 24.7, about 1%. Only growing both together gets anywhere: 32 fill buffers and a 194-entry scheduler give the register file’s 15.2, a 1.6× speedup. The structures are balanced, which is how a good design looks.</li>
</ol>`, "hard") +
Q(`<p>What is the difference between latency-bound and throughput-bound code? Give one example of each and one measurement that tells them apart.</p>`,
`<p><strong>Latency-bound:</strong> the time is set by a chain of dependent operations, each waiting for the previous result. Adding execution units or width doesn’t help, and only shorter latencies do. Examples: a linked-list traversal (each load’s address comes from the previous load), or a running sum of floating-point values in one accumulator.</p>
<p><strong>Throughput-bound:</strong> there is plenty of independent work, and the time is set by how many operations a resource can do per cycle (ports, load bandwidth, memory bandwidth). Shorter latency doesn’t help, and only more throughput does. Examples: summing a large array with several accumulators, or streaming copy of a large buffer.</p>
<p><strong>How to tell them apart:</strong></p>
<ul>
<li>Per-port or per-resource utilization: near 100% on one resource suggests throughput-bound, low utilization with stalls suggests latency-bound.</li>
<li>An experiment: double the independent work (unroll with more accumulators, or run two copies on SMT siblings). Latency-bound code runs nearly twice the work in the same time, throughput-bound code takes twice as long.</li>
</ul>`, "easy") +
Q(`<p>Stall counters say “ROB full, head is a load miss” for 40% of cycles. That says where cycles were lost but not what to fix first. How would you build a critical-path analysis from a simulator trace, and what can it tell you that the stall counters can’t?</p>`,
`<p><strong>Building the graph</strong> (after Fields, Bodík, and Hill): for each dynamic instruction create nodes for its key events, typically dispatch (D), execute (E), and commit (C). Add edges with latencies:</p>
<ul>
<li>D to E (wait to issue), E to C (complete before commit)</li>
<li>Data dependences: E of producer to E of consumer, weighted by the producer’s latency</li>
<li>In-order constraints: D to D and C to C of consecutive instructions, with width limits</li>
<li>Resource constraints: C of instruction <em>i</em> to D of instruction <em>i</em> + ROB size (a full ROB), and similarly for other structures</li>
<li>Control: E of a mispredicted branch to D of the next correct-path instruction, weighted by the refill time</li>
</ul>
<p>The longest path through the graph is the execution time. Record the graph from the simulator, then compute the critical path offline.</p>
<p><strong>What it tells you that counters can’t:</strong></p>
<ul>
<li><strong>Slack:</strong> how much each event could be delayed without changing total time. Shortening an event with slack does nothing, which is why removing a large stall category sometimes gains little.</li>
<li><strong>Edge attribution:</strong> how many critical cycles come from memory latency, from the ROB limit, from branch refills, from execution latency. Unlike counters, these sum exactly to total time without double counting.</li>
<li><strong>What-if answers without re-running:</strong> shrink one class of edge latency (say, L2 hit latency by 2 cycles) and recompute the path to estimate the gain, including the point where another path becomes critical.</li>
</ul>
<p>Cost: large traces and graph size, so analyze windows of a few million instructions. Validate the graph by checking that its critical path matches the simulated cycle count.</p>`, "hard") +
Q(`<p>Top-Down reports a store-heavy kernel as “back-end bound, memory bound,” but L1D load misses are low. Name four store-side or memory-pipeline causes that fit, and the counter or experiment that confirms each.</p>`,
`<ul>
<li><strong>Store buffer full:</strong> stores miss and drain slowly, so allocation stalls when the store buffer fills. Confirm with resource-stall counters for the store buffer, and with L1D or L2 RFO (read-for-ownership) miss counts. Fixes: non-temporal stores for big writes, or reducing store misses.</li>
<li><strong>4K aliasing:</strong> loads are falsely matched to older stores whose addresses differ by a multiple of 4096, because the first check uses only the low 12 bits. Confirm with the core’s address-alias counter (<code>LD_BLOCKS_PARTIAL.ADDRESS_ALIAS</code> on Intel), and by shifting one array’s offset by 64 bytes and seeing the stall vanish.</li>
<li><strong>Store-forwarding failures:</strong> a load overlaps an older store but can’t forward (wider than the store, or misaligned with it), so it waits until the store commits. Confirm with blocked-load counters for store forwarding (<code>LD_BLOCKS.STORE_FORWARD</code>).</li>
<li><strong>Split accesses:</strong> loads or stores crossing a cache line need two accesses, and those crossing a page need two translations. Confirm with split-load and split-store counters, and by aligning the data.</li>
<li><strong>Page walks:</strong> large or sparse data causes DTLB misses even though the data is in cache. Confirm with page-walk cycle counters, and by trying 2 MB pages.</li>
<li><strong>Contended lines:</strong> stores to lines other cores also write (true or false sharing) cause coherence misses that don’t look like capacity misses. Confirm with HITM (hit-modified) counters or a cache-to-cache transfer count.</li>
</ul>
<p>The general lesson: “memory bound” in Top-Down includes every stall attributed to the memory pipeline, not only load misses. Drill down to the next level before choosing a fix.</p>`, "hard") +
`<h3 id="sec-shift">Bottlenecks That Move</h3>` +
Q(`<p>The front end delivers fewer instructions than the back end can execute. Which back-end improvements won’t help, and which might still help a little?</p>`,
`<p><strong>Won’t help:</strong> more execution units, wider issue, a bigger scheduler, a bigger ROB or register file, wider retirement. The back end is already waiting for instructions, and more capacity just sits empty.</p>
<p><strong>Might help a little:</strong> anything that cuts the number of instructions the front end must deliver or the stalls that waste delivered ones: faster branch resolution (shorter mispredict penalty means less front-end refill time), and back-end changes that reduce flushes, like a better memory dependence predictor. The real fixes are in the front end: a bigger op cache or i-cache, a better BTB, instruction prefetching, wider decode, or code layout optimizations (profile-guided ordering of hot code).</p>`, "easy") +
Q(`<p>Physical-register pressure can show up in naive statistics as a <em>front-end</em> problem. Explain how, and how a good accounting method avoids the mistake.</p>`,
`<p>When the free list empties, rename stalls. The decoded-uop queue between decode and rename fills, decode stalls, and then fetch stalls. A counter that just measures “cycles the fetch unit didn’t fetch” rises and blames the front end.</p>
<p>Slot accounting at the allocation stage avoids it: a slot counts as front-end bound only if the back end <em>could have accepted</em> a uop and the front end didn’t supply one. Here, allocation is blocked by the back end (no free registers), so those slots count as back-end bound. Attribute each lost slot once, at the boundary where the decision is made, and back-pressure can’t be mistaken for its own cause.</p>`, "medium") +
M(`<p>Why does improving one component often just move the bottleneck elsewhere? Give a concrete example with numbers.</p><p>Then: the application spends 40% of its time in this loop and the rest doesn’t change. What is the application-level speedup from the third load port?</p>`,
`<p>Performance is limited by the most constrained resource at each moment; relieving it exposes the next one. Example on Skylake (4-wide, 2 load ports): a loop iteration has 10 instructions, 6 of them independent loads. The load ports need 6 / 2 = 3 cycles per iteration; the 4-wide pipeline needs 10 / 4 = 2.5. Loads are the bottleneck: 3 cycles per iteration, IPC 3.3.</p>
<p>Add a third load port (as Golden Cove did). Loads now need 2 cycles, but the width needs 2.5, so the loop runs at 2.5 cycles per iteration: a 20% speedup, not the 50% that “50% more load bandwidth” suggests. The bottleneck moved to width, and the next step is a wider front end and rename.</p>
<p>Amdahl’s law is the same idea: speeding up a part that takes fraction <em>f</em> of the time by <em>s</em> gives an overall speedup of 1 / ((1 − <em>f</em>) + <em>f</em>/<em>s</em>). Bottleneck analysis should list the top two or three limits, not just the first.</p>
<p><strong>Application level:</strong> the loop speeds up by 3 / 2.5 = 1.2×. Amdahl: 1 / (0.6 + 0.4 / 1.2) = 1 / 0.933 ≈ <strong>1.07×</strong>. A 50% increase in load bandwidth became a 7% application speedup, after the bottleneck moved and after Amdahl.</p>`, "hard") +
Q(`<p>Retirement bandwidth is reported as the limiting factor. Would more execution units help? How often is retirement truly the limit?</p>`,
`<p>No. More execution units make instructions complete sooner, but they still can’t leave faster than retirement allows, and allocation is ultimately gated by retirement freeing entries.</p>
<p>True retirement limits are rare, because designers make retirement at least as wide as allocation (Golden Cove: 8 versus 6). A “retirement bound” report usually really means the ROB head is <em>not complete</em> (a stalled load or long-latency operation), which is a latency problem, not a bandwidth one. The distinguishing counter: cycles where the head is complete and at least <em>W</em> completed instructions are waiting, but only <em>W</em> could retire. If that’s rare, retirement width isn’t the problem.</p>`, "medium") +
Q(`<p>What is MPKI, and why do performance engineers prefer it to a miss rate?</p>`,
`<p>Misses (or mispredicts) per 1,000 instructions. It normalizes by work rather than by accesses, so it plugs straight into a CPI estimate: CPI contribution ≈ MPKI × penalty / 1,000. A miss rate per access hides how often the program accesses the structure: a 10% L2 miss rate means little if L2 is rarely accessed, and a 1% L1 miss rate can matter a lot if loads are frequent.</p>`, "easy") +
Q(`<p>Rename reports “store queue full” as its top stall reason, but stores are only 8% of instructions. What would you check, and which stage is the real cause?</p>`,
`<p>A full store queue is back-pressure, so ask why stores stay in it. An entry is freed only after its store retires and then writes the L1. Split the occupancy into stores not yet retired and retired (senior) stores waiting to drain:</p>
<ul>
<li><strong>Mostly senior stores:</strong> the drain is slow. Look at store misses, which drain in order under TSO so one miss blocks every store behind it, at fences or locked instructions that wait for the drain, and at bursts beyond the 1 or 2 commits per cycle (memset, memcpy). Fixes: early ownership requests, non-temporal stores for large copies, fewer fences.</li>
<li><strong>Mostly unretired stores:</strong> retirement is blocked, so the cause is whatever sits at the ROB head, usually a load miss. The store queue just happens to be the first structure to fill.</li>
</ul>`, "medium") +
Q(`<p>Top-Down says a workload is 30% “bad speculation.” You fix the worst branches and the run gets 6% faster, not the 30% you hoped. Why do Top-Down fractions not predict speedup, even when the fix fully removes its category?</p>`,
`<ul>
<li><strong>Slots are not time.</strong> Top-Down counts issue slots, not cycles of critical path. A lost slot in a cycle where other slots were used, or where the back end would have stalled anyway, is not a lost cycle.</li>
<li><strong>Overlap:</strong> mispredicts that happened during a memory stall show up as bad-speculation slots, but the stall would have taken the same time. Removing the mispredicts leaves the stall.</li>
<li><strong>The next bottleneck:</strong> with fewer flushes, the window fills further and hits memory or core limits. The slots move from “bad speculation” to “back-end bound” instead of to “retiring.” Amdahl’s law applies with the new limit.</li>
<li><strong>The fix wasn’t free:</strong> branchless code adds instructions and puts selects on the dependence chain, so some of the gain is spent on more retiring work and longer chains.</li>
<li><strong>Attribution conventions:</strong> “bad speculation” includes slots from wrong-path uops and recovery bubbles, estimated by formulas that approximate the real loss, especially on cores where the counters for recovery cycles are coarse.</li>
</ul>
<p>Use Top-Down to choose where to look, not to predict gains. For a prediction, run the idealized experiment (a perfect predictor in a model, or a version of the code with the branch removed on silicon), and measure the actual change in cycles.</p>`, "hard") +
Q(`<p>A workload alternates between a memory-bound phase and a compute-bound phase, about 50 ms each. Whole-run averages say it is “moderately back-end bound” with “moderate MLP,” which describes neither phase. How do you analyze it, and what goes wrong with design decisions made from the averages?</p>`,
`<p><strong>How to analyze:</strong></p>
<ul>
<li>Sample counters over time in short intervals (1 ms or 10 million instructions), and plot IPC, miss rates, and Top-Down categories as time series. Phases show as distinct plateaus.</li>
<li>Classify intervals by behavior (clustering on counter vectors, as SimPoint does with basic-block vectors), and analyze each cluster separately, weighted by its time.</li>
<li>Tie phases to code with sampling profiles per phase, so each one gets the fix that suits it.</li>
</ul>
<p><strong>What goes wrong with averages:</strong></p>
<ul>
<li><strong>Wrong bottleneck:</strong> an average of “40% memory, 40% core” suggests balanced improvements, while each phase needs only one. Halving memory latency speeds the memory phase a lot and the compute phase not at all.</li>
<li><strong>Wrong sizing:</strong> average occupancy of the ROB or MSHRs hides that one phase pins them at the limit, and that phase alone would benefit from a larger structure.</li>
<li><strong>Wrong speedup estimate:</strong> gains combine per phase by time (Amdahl), not by average rates. A 2× speedup on the memory phase gives 1.33× overall, not what an averaged model predicts.</li>
<li><strong>Power and frequency:</strong> the compute phase may hit power limits and lower the clock, while the memory phase doesn’t. Averaged power hides that.</li>
</ul>
<p>In a simulator, make sure the sampled regions cover both phases in the right proportion, or the model only ever sees one of them.</p>`, "hard") +
`<h3 id="sec-metrics">When the Metric Misleads</h3>` +
Q(`<p>A change raises IPC by 10%, but execution time barely improves. Give three explanations.</p>`,
`<ol>
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
M(`<p>Three benchmarks each run 10<sup>9</sup> instructions, at IPC 1.0, 2.0, and 4.0. (a) What is the IPC of the suite run back to back? (b) A change makes the first benchmark 2× faster and the third 2× slower. Compute the arithmetic mean of the speedups, the geometric mean, and the change in total time. Which would you report?</p>`,
`<ol>
<li><strong>(a)</strong> Cycles: 1.0 + 0.5 + 0.25 = 1.75 × 10<sup>9</sup> for 3 × 10<sup>9</sup> instructions: IPC ≈ <strong>1.71</strong>, the harmonic mean, not the arithmetic mean 2.33. Averaging IPCs overweights the fast benchmarks, which take the least time.</li>
<li><strong>(b)</strong> New IPCs are 2, 2, 2, so cycles = 1.5 × 10<sup>9</sup>.
<ul>
<li>Arithmetic mean of speedups: (2 + 1 + 0.5) / 3 = <strong>1.17</strong>.</li>
<li>Geometric mean: (2 × 1 × 0.5)<sup>1/3</sup> = <strong>1.00</strong>.</li>
<li>Total time: 1.75 / 1.5 = <strong>1.17×</strong> faster, because the slow benchmark dominates total time.</li>
</ul></li>
</ol>
<p>The arithmetic mean of ratios is biased toward big speedups (a 2× gain and a 2× loss don’t cancel) and shouldn’t be used. The geometric mean treats every benchmark equally regardless of runtime, which is why SPEC uses it. Total time is right only if the suite literally represents the real workload mix. Report the geomean plus the distribution, and say which benchmarks moved.</p>`, "hard") +
Q(`<p>A design change lets the core run at 5.4 GHz instead of 5.0 GHz, but IPC drops from 2.10 to 1.98 on a suite. Is it a win? Explain how to compare, and why the answer depends on how memory-bound each benchmark is. What must a cycle-level model do to get this right?</p>`,
`<p><strong>Compare time, not IPC:</strong> performance is IPC × frequency for a fixed instruction count. Here 1.98 × 5.4 = 10.69 versus 2.10 × 5.0 = 10.50 billion instructions per second, a 1.8% gain overall. But averages hide the spread.</p>
<p><strong>Why it depends on memory-boundness:</strong> DRAM latency is fixed in nanoseconds. At a higher clock, each miss costs more cycles, so IPC falls further on memory-bound benchmarks:</p>
<ul>
<li>Compute-bound code: IPC barely changes with frequency, so the full 8% clock gain shows up, minus whatever IPC the design change itself costs.</li>
<li>Memory-bound code: time is dominated by nanoseconds of DRAM latency. A faster clock helps only the compute part, and if the change also lowered IPC for core reasons, these benchmarks may get slower.</li>
</ul>
<p>So part of the IPC drop is just the frequency change, and part is the design change itself. Separate them before judging the design.</p>
<p><strong>What the model must do:</strong></p>
<ul>
<li>Express memory and uncore latencies in nanoseconds (or in their own clock domain), and convert to core cycles at the simulated frequency. A model with DRAM fixed at, say, 400 core cycles makes frequency changes look free.</li>
<li>Report time per benchmark, and the geomean of time ratios, not IPC.</li>
<li>Run the old design at the new frequency too, which isolates the design’s own IPC cost.</li>
</ul>`, "hard") +
Q(`<p>A new replacement policy lowers the LLC miss rate by 10%, but the workload gets slower. Give mechanisms by which fewer misses can mean worse performance.</p>`,
`<ul>
<li><strong>Lower memory-level parallelism:</strong> the remaining misses are the ones on dependent chains (pointer chasing), while the misses removed were independent ones that overlapped each other. Time is set by serialized misses, which didn’t change, and less overlap elsewhere can make it worse.</li>
<li><strong>Different misses hurt differently:</strong> the policy keeps lines that are accessed often but are not latency-critical (prefetched streams that the core tolerated well), and evicts lines whose misses stall the core (instruction lines, page-table entries, pointer-chasing data).</li>
<li><strong>Higher hit latency:</strong> a more complex policy may add a pipeline stage to the LLC, or the policy’s metadata update may conflict with lookups. Every hit gets slower, and there are many more hits than misses.</li>
<li><strong>Prefetch interaction:</strong> fewer demand misses because the policy retained prefetched lines, but prefetches are now late or useless, or more bandwidth is spent on them.</li>
<li><strong>Writeback traffic:</strong> the policy evicts more dirty lines, increasing DRAM write traffic and read latency under contention.</li>
<li><strong>Other cores:</strong> in a shared LLC, one core’s miss rate fell because it took capacity from others, whose slowdown outweighs its gain.</li>
<li><strong>Measurement:</strong> the miss rate is per access, and the new policy changed the access count (more prefetches counted as hits), so the rate fell without the miss count falling.</li>
</ul>
<p>The metric to watch is time and stall cycles caused by misses, not miss rate. MPKI and the average latency seen by demand loads are much better proxies than miss rate.</p>`, "hard") +
`<h3 id="sec-sweeps">Experiments and Attribution</h3>` +
M(`<p>You doubled the ROB and the scheduler together and performance improved by 9%. How do you find out which change caused it?</p><p>Here are the numbers: baseline IPC 2.00, ROB doubled 2.02, scheduler doubled 2.04, both doubled 2.18. Quantify the interaction.</p>`,
`<p>Run the full factorial: baseline, ROB only, scheduler only, both. If ROB-only gives 1%, scheduler-only gives 2%, and both give 9%, the changes interact: each one was hiding the other’s benefit, because whichever structure was smaller filled first. Then confirm with the stall breakdown: in the baseline, which structure was full when allocation stalled, and what happened to those stalls in each variant? Report the interaction honestly; saying “the scheduler gave 2%” would be wrong for the combined design.</p>
<p><strong>Numbers:</strong> the main effects are +0.02 (ROB) and +0.04 (scheduler). If they were independent, both together would give about 2.06. The interaction term is 2.18 − 2.02 − 2.04 + 2.00 = <strong>0.12 IPC</strong>: two-thirds of the total 0.18 gain exists only when both structures grow together.</p>`, "hard") +
M(`<p>More MSHRs improved performance by 12% without changing the cache hit rate at all. How?</p><p>Put numbers on it: 8 MSHRs, 80 ns DRAM latency, 64-byte lines, and a core that could generate 16 independent misses at once. What bandwidth can one core pull before and after doubling the MSHRs?</p>`,
`<p>The hit rate measures how often you miss; MSHRs determine how many misses can be in flight at once. With too few, a core that has found several independent misses must wait for one to finish before starting the next, so they’re serialized. More MSHRs let those misses overlap (higher MLP), which reduces the time per miss without changing the number of misses. By Little’s law, outstanding misses = miss rate × latency, so if the core can generate more concurrent misses than the MSHRs allow, the MSHRs cap the achievable bandwidth. Confirm with MSHR-full cycles in the baseline and average outstanding misses before and after.</p>
<p><strong>Numbers:</strong> before: 8 × 64 B / 80 ns = <strong>6.4 GB/s</strong>; after: 16 × 64 B / 80 ns = <strong>12.8 GB/s</strong>, assuming DRAM isn’t saturated and latency doesn’t rise with the extra load. Miss-bound phases run up to twice as fast with exactly the same hit rate.</p>`, "hard") +
M(`<p>You sweep the ROB from 224 to 512 entries, scaling the load queue, physical registers, and scheduler with it. Three memory-bound workloads respond like this:</p><ul><li><strong>A:</strong> MLP 1.05 → 1.08, IPC +1%</li><li><strong>B:</strong> MLP 1.6 → 3.1, IPC +52%, average miss latency 380 → 420 cycles</li><li><strong>C:</strong> MLP 2.9 → 3.0, IPC +2%</li></ul><p>Diagnose each one, quantify what happened to B, and say what you would check next for C.</p>`,
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
`<ol>
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
M(`<p>You measure IPC on 30 sampled intervals: mean 1.82, standard deviation 0.40. A design change moves the mean to 1.88. (a) What is the 95% confidence interval on the baseline mean? Can you claim the 3% improvement from these two means? (b) You run both designs on the <em>same</em> 30 intervals; the per-interval differences have mean 0.06 (as they must, if the 1.88 came from these same intervals) and standard deviation 0.05. Now?</p>`,
`<ol>
<li><strong>(a)</strong> Standard error: 0.40 / √30 = 0.073. With the t-distribution (29 degrees of freedom, t ≈ 2.05): ±0.15, about <strong>±8%</strong> of the mean. A 0.06 difference is far inside that, so comparing the two means alone can’t establish a 3% gain.</li>
<li><strong>(b)</strong> Paired: standard error 0.05 / √30 = 0.0091. Interval 0.06 ± 2.05 × 0.0091 = 0.06 ± 0.019, i.e. 0.041 to 0.079, clearly above zero. <strong>Significant.</strong> The estimate is the same 0.06 as in (a); only its uncertainty shrank.</li>
</ol>
<p>Pairing removes the large between-interval variation (some phases are just slower), leaving only the variation in the <em>effect</em>. Always compare designs on the same samples and analyze the per-sample differences. With a deterministic simulator, the remaining variation reflects real workload differences in the effect, not noise.</p>`, "hard") +
M(`<p>A 128-core server has 12 channels of DDR5-5600 and sustains about 80% of peak. Each core’s L2 can track 48 outstanding misses, and idle DRAM latency is 120 ns. A memory-bound loop keeps every core’s miss slots full.</p>
<ul>
<li>(a) How much bandwidth can one core draw, and how many cores saturate DRAM?</li>
<li>(b) With all 128 cores running, what is the loaded latency?</li>
<li>(c) A per-core model with a fixed 120 ns latency predicts what per-core bandwidth at 128 cores, and what is it really?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Peak: 12 × 5,600 MT/s × 8 B = 537.6 GB/s, so about 430 GB/s sustained. One core: 48 × 64 B / 120 ns = <strong>25.6 GB/s</strong>. Saturation at 430 / 25.6 ≈ <strong>17 cores</strong>.</li>
<li><strong>(b)</strong> Lines in flight: 128 × 48 = 6,144, or 393,216 bytes. Loaded latency = max(120 ns, 393,216 B / 430 GB/s) ≈ <strong>914 ns</strong>.</li>
<li><strong>(c)</strong> The fixed-latency model gives every core 25.6 GB/s, 3.3 TB/s in total, 7.6× more than the DRAM can deliver. Really each core gets 430 / 128 ≈ <strong>3.4 GB/s</strong>, at more than seven times the idle latency.</li>
<li>Past about 17 cores, more cores only add latency. The model needs loaded latency, from a DRAM model with queues, to get any of this right.</li>
</ol>`, "hard") +
Q(`<p>Your model shows perfect branch prediction gains 12%, a perfect L2 gains 20%, and both together 40%. A colleague attributes 12% to branches, 20% to the L2, and 8% to “interaction.” Why is any split of the 40% partly arbitrary, and how would you report it so that a design decision isn’t biased by the order of the experiments?</p>`,
`<p><strong>Why the split is arbitrary:</strong> the gains don’t add. Fixing branches is worth 12% with the real L2 but more with a perfect L2, because with fewer stalls on misses, the window is more often full of useful work for mispredicts to destroy, and vice versa. So “the value of branch prediction” depends on what else has been fixed. Attributing in one order (branches first) gives 12% to branches and the remaining 28% to the L2. The other order gives 20% to the L2 and 20% to branches. Both are correct accounts of a sequence, and neither is <em>the</em> value of each fix.</p>
<p><strong>How to report it:</strong></p>
<ul>
<li>Report the full table: baseline, each fix alone, and both. With two factors that is four runs, and it shows the interaction directly.</li>
<li>If a single number per factor is needed, use the Shapley value: average each factor’s marginal gain over all orders. Here: branches (12 + 20) / 2 = 16%, L2 (20 + 28) / 2 = 24%. It sums to the total and doesn’t depend on the order.</li>
<li>For more factors, use a fractional factorial design (as in the Plackett–Burman approach) to estimate main effects and the important interactions without running every combination.</li>
</ul>
<p><strong>For the decision:</strong> what matters is the gain of the fix you can actually build, in the context of the other fixes you plan. If the next design improves both the predictor and the L2 (partially, not perfectly), simulate that combination directly. The idealized numbers tell you where the potential is, not how to split credit.</p>`, "hard") +
Q(`<p>Each benchmark is represented by 10 SimPoints, and a change shows a 0.8% geomean gain. How do you know if that is real or sampling noise? Explain how statistical sampling (SMARTS-style) gives a confidence interval, and how to design the comparison so the noise largely cancels.</p>`,
`<p><strong>The problem:</strong> SimPoint picks representative intervals by clustering, but gives no error bound. If the chosen intervals don’t represent the change’s effect (for example, the change matters only in a phase that no SimPoint covers), the measured gain can be off by more than 0.8%.</p>
<p><strong>Statistical sampling</strong> (Wunderlich et al., 2003): simulate many short intervals, a few thousand instructions each, chosen systematically across the whole run, with functional warming of caches and predictors between them. Each interval gives a CPI sample. The mean CPI then has a confidence interval from the sample variance: about ±2 × (standard deviation / √n) at 95%. Choose the number of samples to reach the target error, such as ±1% at 99.7%.</p>
<p><strong>Comparing two designs:</strong> sample the <em>same</em> intervals for both and compute the confidence interval of the per-sample <em>difference</em>, not of each CPI separately. Intervals that are slow in one design are usually slow in the other, so the variance of the difference is much smaller than either variance. A 0.8% change can be significant this way, even when each design’s CPI is only known to ±2%.</p>
<p><strong>Other checks:</strong></p>
<ul>
<li>Report per-benchmark gains with their intervals, not only the geomean.</li>
<li>Check for warm-up bias: intervals right after a fast-forward with too short a warm-up show cold-cache behavior that may dominate a small change.</li>
<li>If a few benchmarks drive the geomean, verify those with longer detailed runs.</li>
</ul>`, "hard"),
},
{
  id: "intv-sim",
  title: "Building a Performance Model in C",
  body: `
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
Q(`<p>What is an instruction trace for a CPU timing model? What does each record typically contain, and what can’t a trace tell the model?</p>`,
`<p>A <strong>trace</strong> is a recording of the instructions a program executed, in order, captured once (with a binary instrumentation tool such as Pin or DynamoRIO, a functional simulator, or hardware tracing) and replayed many times into the timing model.</p>
<p><strong>A typical record:</strong></p>
<ul>
<li>The instruction’s address (PC), and its opcode or a decoded class</li>
<li>Source and destination registers, so the model can build dependences</li>
<li>For loads and stores, the memory address and access size</li>
<li>For branches, whether it was taken and its target</li>
<li>Sometimes the instruction bytes or uop breakdown, and markers for system events</li>
</ul>
<p><strong>What it can’t tell the model:</strong></p>
<ul>
<li>Wrong-path instructions: only the correct path was recorded.</li>
<li>Effects that depend on timing: in multithreaded programs, the interleaving of threads and which thread wins a lock, which change if the modeled core is faster or slower.</li>
<li>Values, unless recorded, so value-dependent latencies (divides, denormals) are unknown.</li>
<li>Anything left out of the capture, such as OS code if only user code was traced.</li>
</ul>`, "easy") +
Q(`<p>To run SPEC CPU benchmarks in a detailed model, you fast-forward billions of instructions functionally and simulate short regions in detail. What state must be warmed before each region, how long does warming take, and why do multi-megabyte LLCs make this harder? Compare functional warming with checkpoints of warmed state.</p>`,
`<p><strong>State that needs warming:</strong> anything whose contents depend on long history: caches at every level (and their replacement state), TLBs, branch predictors and BTBs, prefetcher tables, and coherence directories. Pipeline state (ROB, queues) fills in a few thousand cycles and needs no special treatment.</p>
<p><strong>How long:</strong> roughly as long as it takes for the structure’s contents to be replaced. Predictors and L1 caches warm in a few million instructions. A 32 MB LLC holds 512K lines, and lines that are reused only every few hundred million instructions still affect hit rate, so it may need hundreds of millions of instructions of warming, far longer than the detailed region itself.</p>
<p><strong>Functional warming:</strong> during fast-forward, every memory access and branch updates the caches and predictors (but no timing). Always accurate for the current configuration, but it slows fast-forward several times, and it must be redone for every configuration that changes those structures.</p>
<p><strong>Checkpoints of warmed state:</strong> save architectural state plus cache and predictor contents at each region start, once. Fast to start a region, but the saved state is only valid for the configuration it was made with. Changing the LLC size invalidates the cache part. Workarounds: store a larger superset cache (or a memory-access trace for the warm-up window) and reconstruct smaller configurations from it, which works for LRU-like inclusive policies but not for all policies.</p>
<p>Check the warm-up: rerun a region with twice the warming. If the result changes beyond the noise, warming was too short.</p>`, "hard") +
Q(`<p>Compare a cycle-driven simulator (every component is ticked every cycle) with an event-driven one (components schedule future events in a queue). Which is faster for a core model, which for a memory system, and what bugs does each style tend to produce?</p>`,
`<p><strong>Cycle-driven:</strong></p>
<ul>
<li>Simple and predictable: every stage does its work each cycle, in a fixed order, and state changes are easy to reason about.</li>
<li>Efficient when most components have work most cycles, which is true for a busy out-of-order core.</li>
<li>Wasteful when components are mostly idle: a DRAM controller or an idle core still gets ticked. Large multicore models spend most of their time ticking idle parts.</li>
<li>Typical bugs: stage evaluation order effects (an instruction passing two stages in one cycle if a later stage reads an earlier stage’s just-written output).</li>
</ul>
<p><strong>Event-driven:</strong></p>
<ul>
<li>Components schedule events (“this miss completes at cycle 1,234”) and the simulator jumps between event times. Fast when activity is sparse: memory systems, interconnects, idle cores, long latencies.</li>
<li>Overhead per event (priority queue operations) is high relative to the simple per-cycle work of a core pipeline.</li>
<li>Typical bugs: ordering among events at the same time, which depends on insertion order or on tie-breaking rules, and can make results change when unrelated code is edited. Also, events whose target was squashed or freed and that fire anyway.</li>
</ul>
<p><strong>Common practice:</strong> a hybrid. The core is ticked every cycle while it is active, and memory and uncore components use events. gem5 is event-driven throughout but its CPU models schedule a tick event every cycle while active, which is effectively cycle-driven for the core. Whatever the style, define tie-breaking explicitly, so results don’t depend on the order of event insertion.</p>`, "hard") +
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
Q(`<p>You are moving a trace-driven model to execution-driven so it can fetch wrong-path instructions. What does the timing model need from the functional model to fetch and execute down a wrong path, and how do you undo it when the branch resolves?</p>`,
`<p><strong>What it needs:</strong></p>
<ul>
<li>The ability to execute from an arbitrary PC chosen by the timing model’s predictor, not the PC the program would really take.</li>
<li>Speculative state: registers and memory as the wrong path would see them. Wrong-path loads should read the values older correct-path and wrong-path stores produced, so their addresses (and therefore cache effects) are realistic.</li>
<li>Safety: a wrong-path load to an unmapped address, a divide by zero, or a system call must not crash the simulator or change the real program state. Faults must be recorded and suppressed until the instruction would retire.</li>
</ul>
<p><strong>Two common designs:</strong></p>
<ul>
<li><strong>Checkpoint and roll back:</strong> the functional model executes speculatively, and at each predicted branch it saves register state and logs memory writes. On a mispredict it restores the checkpoint and undoes logged writes. Accurate, but it costs memory and time per branch.</li>
<li><strong>Timing-first with a reference model:</strong> the timing model executes instructions itself (it has a full functional core inside), and a separate, simple functional model executes only correct-path instructions at retirement. The two are compared at every retired instruction, and on a mismatch the timing model’s state is reloaded from the reference. Used in GEMS-style simulators. It also finds bugs in the timing model’s execution.</li>
</ul>
<p><strong>Undo:</strong> on a mispredict, squash wrong-path instructions in the timing model, restore register and memory state in the functional model (or reload it), and keep the side effects that real hardware also keeps: cache fills and predictor training by wrong-path accesses. Getting that last split right is the point of the exercise.</p>`, "hard") +
Q(`<p>Profiling shows your multicore simulator spends 60% of its host time in the LLC model. How do you make it much faster without changing any simulated result, and how do you prove you didn’t?</p>`,
`<p><strong>Find out where the time goes first:</strong> a profiler on the simulator (perf, VTune) per function and per source line. Typical culprits in cache models are linear tag searches, replacement-state updates, memory allocation per request, and cache-unfriendly data layout in the simulator itself.</p>
<p><strong>Typical fixes:</strong></p>
<ul>
<li><strong>Data layout:</strong> store the tags of a set contiguously (struct of arrays), so a lookup reads one or two host cache lines instead of chasing pointers to per-line objects. For a 16-way set with 8-byte tags, that is 128 bytes.</li>
<li><strong>Faster search:</strong> SIMD compare of all ways at once, or a small hash map from line address to way for very associative caches.</li>
<li><strong>Avoid allocation:</strong> preallocate request objects in pools instead of calling malloc and free per access.</li>
<li><strong>Cheaper replacement state:</strong> exact LRU with a timestamp per way is a scan. Use per-set age bits or the exact policy the hardware uses, which is often a cheaper tree-PLRU or RRIP anyway.</li>
<li><strong>Skip work:</strong> don’t model idle structures each cycle. Use events for the LLC and DRAM.</li>
<li><strong>Parallelism:</strong> simulate cores on host threads with periodic synchronization, which changes results unless designed carefully, so it belongs in a separate, explicitly approximate mode.</li>
</ul>
<p><strong>Proving equivalence:</strong> run the full regression suite before and after, and require bit-identical outputs: every statistic, not just IPC, and per-access event logs for a few short runs. Any change in a deterministic simulator means a behavior change, which must be explained before merging. Keep the old implementation behind a flag for a while to compare.</p>`, "hard") +
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
M(`<p>Your simulator runs at 150,000 instructions per second. A profile shows 60% of host time in scheduler wakeup, which scans all 97 entries for every broadcast tag every cycle. You replace it with per-register lists of waiting consumers, making wakeup about 10× cheaper. What speedup do you expect, and what should you check before celebrating?</p>`,
`<p>Amdahl: 1 / (0.4 + 0.6 / 10) = 1 / 0.46 ≈ <strong>2.17×</strong>, about 326,000 instructions per second. Before celebrating:</p><ol><li>The output must be bit-identical, cycle counts and all, on the regression suite</li><li>Wakeup’s worst case changed: one register with hundreds of waiters (a load feeding a long fan-out) now costs a long list walk</li><li>The profile has moved: the remaining 40% is now 87% of the time, so the next optimization target is elsewhere</li></ol>`, "hard") +
Q(`<p>A microbenchmark of 1,000 dependent single-cycle adds takes 3,000 cycles in your model, while 1,000 independent adds on the 4-wide model take 250. What is the most likely bug, and how do the two numbers point to it?</p>`,
`<p>Throughput is right (independent adds hit the 4-wide limit) but each dependent add costs 3 cycles instead of 1. So execution is fine and the problem is <em>when a consumer is considered ready</em>: most likely readiness is set when the producer reaches writeback (or the register file), 2 stages after execution, instead of when its result is available on the bypass. Fix it so a consumer can issue <em>latency</em> cycles after its producer issues, then rerun the chain test, and also test load-to-use chains and multi-cycle operations, which may have the same off-by-N error.</p>`, "hard") +
M(`<p>In 40% of simulated cycles the whole core is stalled waiting on DRAM, in stretches averaging 300 cycles. Simulating a stalled cycle costs 1 µs of host time; an active cycle costs 3 µs. You add “skip to the next event” for fully stalled stretches, at about 1 µs per skip. What speedup do you get? What can go wrong?</p>`,
`<p>Per 1,000 cycles: before, 600 × 3 + 400 × 1 = 2,200 µs. After, 600 × 3 + (400 / 300) × 1 ≈ 1,801 µs: only <strong>1.22×</strong>. Active cycles dominate host time, so that’s where to optimize next.</p>
<p>Risks: something may still happen during a “stall”: prefetchers issuing requests, the DRAM model scheduling refresh or reordering, timers and interrupts, other cores in a multicore model. Skip only to the earliest pending event of <em>any</em> component. Statistics must also be credited for the skipped cycles (occupancy histograms, stall counters), or they silently drift.</p>`, "hard") +
Q(`<p>Why should a simulator use a fixed random seed for anything random (replacement policies, arbitration ties, synthetic traffic)?</p>`,
`<p>So runs are reproducible: the same configuration gives exactly the same cycle count. That makes regression testing by exact comparison possible, lets you bisect a performance change to a single commit, and ensures a small difference between two configurations is the design and not a different random draw. To study sensitivity to randomness, run several fixed seeds deliberately.</p>`, "easy") +
Q(`<p>The core runs at 5 GHz, the mesh and LLC at 2.5 GHz, and DDR5-5600 memory at its own clock. How do you model multiple clock domains in a cycle-level simulator, and what errors appear if you just convert every latency to whole core cycles?</p>`,
`<p><strong>How to model it:</strong></p>
<ul>
<li>Keep a global time base fine enough to represent every clock, such as picoseconds, or the least common multiple of the periods. Each domain has its own period and advances on its own clock edges.</li>
<li>Components in a domain are ticked only on their edges. A 2.5 GHz mesh is ticked every other core cycle, and the DRAM controller on its own period.</li>
<li>Crossings between domains go through modeled synchronizers or asynchronous FIFOs, each with a latency of one to a few destination-domain cycles, as on real hardware.</li>
<li>Frequency changes (DVFS, turbo) change a domain’s period at run time, which this structure supports directly.</li>
</ul>
<p><strong>Errors from rounding to core cycles:</strong></p>
<ul>
<li><strong>Quantization:</strong> a 0.4 ns crossing becomes 2 core cycles regardless of where in the slow clock period the request arrived. On real hardware, a request may wait up to a full slow-domain period for the next edge, so latency varies. The average is about right but the distribution is wrong, which matters for queueing.</li>
<li><strong>Wrong bandwidth:</strong> a link that can accept one flit per mesh cycle accepts one every 2 core cycles. If the model lets it accept one per core cycle, bandwidth doubles.</li>
<li><strong>Wrong frequency scaling:</strong> when core frequency changes, latencies that should stay fixed in nanoseconds (the uncore and DRAM) must change in core cycles. A model with latencies hard-coded in core cycles makes faster cores look better than they are.</li>
</ul>
<p>Check with a sweep of core frequency: memory-bound benchmarks should show IPC falling as frequency rises, roughly tracking the share of time spent on fixed-nanosecond latencies.</p>`, "hard") +
`<h3 id="sec-verify">Verification and Trust</h3>` +
Q(`<p>How would you verify that your model never retires out of order, and that dependences and speculative recovery are correct?</p>`,
`<ol>
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
M(`<p>What are the trade-offs between modeling every microarchitectural detail and using a simplified model? Which simplifications can speed up large design sweeps without invalidating the conclusions, and how would you check?</p><p>Put numbers on sampling: a 2-trillion-instruction run, a detailed simulator at 200,000 instructions per second, and functional fast-forward at 50 million per second. Compare full detailed simulation with 10 SimPoints of 100 million instructions each, with and without saved checkpoints.</p>`,
`<p>Detail costs simulation speed and development time, and adds its own bugs; too little detail can hide exactly the effect you’re studying. The right level depends on the question.</p>
<p>Simplifications that usually preserve conclusions for core-level sweeps:</p>
<ul>
<li><strong>Sampling:</strong> SimPoint (simulate representative intervals, weighted) or SMARTS-style statistical sampling, with fast functional warm-up of caches and predictors between samples.</li>
<li><strong>Simpler models for parts not under study:</strong> a fixed-latency or queueing memory model when studying the core; a perfect or simple branch predictor when studying the memory hierarchy, if the interaction isn’t the point.</li>
<li><strong>Trace-driven</strong> instead of execution-driven, if wrong-path and timing-dependent behavior don’t matter for the question.</li>
</ul>
<p>Validate the simplified model against the detailed one on a subset of configurations. What must hold is the <em>ranking</em> of design points and the approximate size of differences, not the absolute IPC. Document every simplification next to the results.</p>
<p><strong>Numbers:</strong> full detailed simulation: 2 × 10<sup>12</sup> / 2 × 10<sup>5</sup> = 10<sup>7</sup> s, about <strong>116 days</strong>. SimPoints: 10<sup>9</sup> detailed instructions / 2 × 10<sup>5</sup> = 5,000 s, about <strong>1.4 hours</strong>, plus fast-forwarding to the sample points: up to 2 × 10<sup>12</sup> / 5 × 10<sup>7</sup> = 40,000 s (11 hours) in one pass. With saved checkpoints each sample starts from a stored state plus a short warm-up, and the 10 samples run in parallel: under 10 minutes of wall-clock time each.</p>`, "hard") +
M(`<p>IPC varies across sampled intervals with a coefficient of variation of 0.6. With SMARTS-style random sampling, how many samples do you need for ±3% at 95% confidence? For ±1%? Why not just make each sample very short to save time?</p>`,
`<p>For relative error e at 95% confidence: n = (1.96 × CV / e)². ±3%: (1.96 × 0.6 / 0.03)² = 39.2² ≈ <strong>1,537 samples</strong>. ±1%: 9× as many, about <strong>13,800</strong>: precision costs quadratically.</p>
<p>Samples can be short (SMARTS used about 1,000 instructions), but only because it keeps caches and predictors warm functionally between samples and runs a short detailed warm-up before each one. Without that, short samples start with cold microarchitectural state and are biased low, and no number of samples fixes a bias.</p>`, "hard") +
Q(`<p>Two runs of the same configuration differ by 0.3% in IPC after 10 billion simulated cycles. How do you find the first point where they diverge, quickly?</p>`,
`<ol>
<li>Have the simulator print a hash of its state every N cycles (for example, a hash of the committed instruction stream plus key structures, every 1 million cycles). Run both, and compare the logs to find the first interval where the hashes differ: one pass, not a long search.</li>
<li>Rerun only that interval (from a checkpoint, if you have them) with a per-cycle hash or a full trace, and find the first differing cycle and structure.</li>
<li>Look for the usual causes: uninitialized memory (run under Valgrind or MemorySanitizer), iteration over hash tables or other unordered containers, sorting or comparing by pointer value, time-based seeds, and data races in a multithreaded simulator.</li>
</ol>
<p>Nondeterminism is a bug: until it’s fixed, no 0.3% result from this simulator can be trusted.</p>`, "hard") +
Q(`<p>Your model is consistently about 10% optimistic on IPC across the suite. Is it fit for deciding whether to double the L2? When would the same model be unfit for that decision?</p>`,
`<p>Design decisions depend on relative accuracy, whether the predicted speedup of the change is right. A bias that doesn’t depend on the change, such as a missing front-end effect, cancels in the ratio, so the model can still be fit.</p>
<p>It is unfit if the error comes from the part the change touches: a fixed DRAM latency, idealized MSHRs, a prefetcher that behaves better than the real one, or an ideal snoop filter. Doubling the L2 interacts with exactly those. Check the event-level errors (L2 MPKI, memory-level parallelism) against the reference, and the speedup error on a similar past change, for example an L2-size sweep on existing silicon using cache partitioning.</p>`, "medium") +
Q(`<p>Design a microbenchmark that measures how many outstanding L1 misses a core can sustain. What curve do you expect, and what can put the knee in the wrong place?</p>`,
`<p>Interleave K independent pointer chases in one loop, each over a randomly linked buffer larger than the L2 (or than the LLC, to reach DRAM), and sweep K. Throughput in lines per nanosecond rises roughly linearly with K, then flattens. The K at the knee is the number of misses the core can keep in flight: the fill buffers for misses served by L2, and the L2’s miss queue for misses that go further.</p>
<p>Pitfalls:</p>
<ul>
<li>Prefetchers: randomize the links and disable prefetchers if you can.</li>
<li>TLB misses: random 4 KB pages make the page walkers the limit. Use huge pages.</li>
<li>The window: K chases times the instructions per step must fit in the ROB, scheduler, and load queue, or the window becomes the knee.</li>
<li>Loaded latency: at high K, bank conflicts and queuing raise latency and bend the curve before the real limit.</li>
<li>SMT: a busy sibling thread shares the fill buffers.</li>
</ul>`, "hard") +
M(`<p>Your model predicts a new prefetcher’s speedups on four workloads as 1.12, 1.03, 1.20, and 0.98. Silicon, with the prefetcher enabled and disabled, measures 1.08, 1.04, 1.11, and 0.95.</p>
<ul>
<li>(a) Compute each speedup error in percentage points, the mean absolute error, and the bias.</li>
<li>(b) Compare the geometric-mean speedups.</li>
<li>(c) Is the ranking preserved? Would the model have made the right call under the rule “ship if the geomean gain is at least 5%”?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> Errors: +4, −1, +9, and −3 points. Mean absolute error <strong>4.25 points</strong>, bias <strong>+2.25 points</strong> (optimistic).</li>
<li><strong>(b)</strong> Predicted: (1.12 × 1.03 × 1.20 × 0.98)<sup>1/4</sup> ≈ <strong>1.079</strong>. Measured: (1.08 × 1.04 × 1.11 × 0.95)<sup>1/4</sup> ≈ <strong>1.043</strong>.</li>
<li><strong>(c)</strong> Ranking: predicted 1.20 > 1.12 > 1.03 > 0.98, measured 1.11 > 1.08 > 1.04 > 0.95, the same order. But the model says ship (+7.9%) and silicon says don’t (+4.3%). A preserved ranking doesn’t make the model fit for a threshold decision. The speedup error does. Start with the third workload (+9 points): the prefetcher’s bandwidth use or pollution is probably modeled too kindly.</li>
</ol>`, "medium") +
Q(`<p>You are validating your model against real hardware using performance counters. Which counters do you trust, which do you treat with care, and why do microbenchmarks come before full applications?</p>`,
`<p><strong>Trustworthy:</strong> retired instructions, core cycles at a fixed frequency (disable turbo and power management for validation), and retired branches and mispredicts. These are architectural or simple, and vendors test them well.</p>
<p><strong>Treat with care:</strong></p>
<ul>
<li><strong>Cache miss counters:</strong> definitions differ per core: whether prefetches are counted, whether a miss to a line already being fetched counts again, and which level a miss is attributed to. Read the vendor’s event descriptions and errata, then confirm the definition with a microbenchmark that has a known answer.</li>
<li><strong>Stall and occupancy counters:</strong> often count a condition per cycle with specific rules (counting only when a particular stage is blocked), not the stall a model would report. They are useful for trends, not for exact matching.</li>
<li><strong>Uop counts:</strong> fused versus unfused domain, and microcoded instructions, must match the model’s definition.</li>
<li><strong>Multiplexed counters:</strong> when more events are measured than there are counters, the tool time-slices and scales them, which adds noise and errors on phase-changing code.</li>
</ul>
<p><strong>Why microbenchmarks first:</strong> each one isolates a single mechanism with a known expected result: a dependent chain for latency, independent operations for throughput, a pointer chase over a sweep of sizes for each cache level, a stream for bandwidth. Disagreements point directly at one parameter. On a full application, errors in many parameters mix and cancel, and you can tune the model to match for the wrong reasons. Once the microbenchmarks match, applications show what the microbenchmarks didn’t cover, such as interactions and unmodeled features.</p>
<p>Report the remaining error per benchmark, and say which features the model doesn’t include.</p>`, "hard") +
`<h3 id="sec-analytic">Analytical Models and Power</h3>` +
Q(`<p>In interval analysis, an isolated long data cache miss costs about the full memory latency, even though the core keeps dispatching useful work into the ROB behind it. Why doesn’t that work reduce the penalty? Why do misses within one ROB of each other cost almost nothing extra?</p>`,
`<p>Behind the miss, dispatch continues until the ROB fills, then stops until the miss returns. That fill time is useful, but it is offset afterward: when the miss returns, the window drains and dispatch has to ramp back up to its steady rate. To first order the two cancel, and the miss costs about its latency.</p>
<p>A second independent miss within one ROB’s worth of instructions of the first is dispatched and issued while the first is still outstanding, so its latency runs in parallel. By the time the first returns, the second is nearly done. Counting only the first miss of each such group is what turns a naive sum of penalties into a usable out-of-order model.</p>`, "medium") +
Q(`<p>When does the roofline model give a misleading answer for a CPU loop, and what would you use instead?</p>`,
`<p>The roofline bounds throughput by min(peak FLOP/s, arithmetic intensity × bandwidth): one compute roof and one memory roof. It misleads when:</p>
<ul>
<li>The loop is latency-bound, through pointer chasing or a dependency chain, so neither roof applies.</li>
<li>The real limit isn’t FLOPs or bytes: the front end, port pressure on shuffles or divides, or loads per cycle rather than bytes.</li>
<li>The data lives in L2 or L3, so the DRAM roof is the wrong roof (add a roof per level).</li>
<li>Concurrency caps bandwidth: one core’s miss slots limit it well below the memory roof.</li>
<li>The code can’t use FMA or full-width SIMD, so the real compute roof is lower.</li>
</ul>
<p>Use per-iteration bounds instead (bandwidth, capacity, and latency bounds for every stage, then the max), with the roofline as one row of the table.</p>`, "medium") +
Q(`<p>How does an event-based energy model estimate dynamic energy from a performance model? Why are its trends more trustworthy than its absolute numbers?</p>`,
`<p>The performance model counts accesses to each structure: cache reads and writes, register file reads and writes, scheduler wakeups, ALU operations, DRAM accesses. Each count is multiplied by an energy per access, estimated from the structure’s size, ports, and technology (Wattch, McPAT) or calibrated from RTL power analysis and silicon. Leakage power times run time is added on top.</p>
<p>Absolute values depend on circuit details and calibration errors that architecture-level tools get wrong, often by a lot. But when the per-event energies are calibrated on the blocks that change between two design points, most of those errors are common to both, so the ratio between them holds up much better.</p>`, "easy") +
M(`<p>A 6-wide core with a 448-entry ROB sustains a dispatch rate of 5 over a 2,000-instruction stretch when nothing goes wrong. In that stretch there are 8 mispredicts (each resolving 6 cycles after dispatch and costing 15 cycles of front-end refill), 3 instruction cache misses to L2 (14 cycles each), and 5 independent DRAM misses (420 cycles each) at instructions 100, 300, 900, 1,000, and 1,700. Treat a miss as overlapped if it falls within one ROB of the first miss in its group.</p>
<ul>
<li>(a) Estimate the cycles and IPC with interval analysis.</li>
<li>(b) How small can the ROB get before this stretch takes more cycles, and what does a 128-entry ROB give?</li>
</ul>`,
`<ol>
<li>Steady state: 2,000 / 5 = 400 cycles.</li>
<li>Mispredicts: 8 × (6 + 15) = 168 cycles. Instruction cache misses: 3 × 14 = 42 cycles.</li>
<li>DRAM groups at 448 entries: {100, 300}, {900, 1,000}, and {1,700}, so 3 × 420 = 1,260 cycles.</li>
<li><strong>(a)</strong> Total ≈ 400 + 168 + 42 + 1,260 = <strong>1,870 cycles</strong>, IPC ≈ <strong>1.07</strong>.</li>
<li><strong>(b)</strong> The groups stay the same as long as the ROB holds more than 200 entries (the gap from 100 to 300), so it can shrink to about <strong>200</strong> with no loss in this model. At 128 entries, 100 and 300 no longer overlap: four groups, 1,680 cycles of memory, 2,290 cycles in total, IPC ≈ 0.87, 22% slower.</li>
<li>A real 128-entry ROB would also lower the steady dispatch rate on code with less ILP, so D<sub>eff</sub> should be re-derived for it too.</li>
</ol>`, "hard") +
M(`<p>A feature raises IPC by 5% and core power by 8% at the same frequency.</p>
<ul>
<li>(a) On a part that always runs at its power limit, with power proportional to f<sup>3</sup>, what is the net performance change, and how does energy per task change?</li>
<li>(b) On a part that isn’t power-limited, how do performance, energy per task, and the energy-delay product change?</li>
<li>(c) Which part should get the feature?</li>
</ul>`,
`<ol>
<li><strong>(a)</strong> The clock must drop until power is back at the cap: f = 1.08<sup>−1/3</sup> ≈ 0.975. Performance: 1.05 × 0.975 ≈ <strong>1.023, +2.3%</strong>. Power stays at the cap, so energy per task scales with time: 1 / 1.023 ≈ 0.977, <strong>2.3% less</strong>.</li>
<li><strong>(b)</strong> Performance <strong>+5%</strong>. Energy per task = power × time = 1.08 / 1.05 ≈ 1.029, <strong>2.9% more</strong>. EDP = 1.029 / 1.05 ≈ 0.980, <strong>2% better</strong>.</li>
<li><strong>(c)</strong> Both. At the cap, it gains 2.3% and also saves energy, since the IPC gain (5%) exceeds a third of the power cost (2.7%). Uncapped, it gains 5% for 2.9% more energy per task, a good trade for a performance part, and a worse one for a battery-powered part that is usually lightly loaded and judged on energy.</li>
</ol>`, "hard") +
Q(`<p>Compare mechanistic analytical models (interval analysis, first-order queueing models) with empirical ones (regression or machine learning trained on simulator or hardware results) for exploring design spaces. Where does each fail, and how would you combine them?</p>`,
`<p><strong>Mechanistic models</strong> derive performance from how the hardware works: base CPI from width and dependences, plus penalties for misses and mispredicts computed from the window and latencies.</p>
<ul>
<li>Strengths: they explain <em>why</em>, generalize to configurations never simulated, and need only a few parameters per workload (miss rates, branch behavior, dependence statistics).</li>
<li>Failures: effects left out of the model, such as interactions between mechanisms (prefetching and bandwidth, wrong-path effects), and queueing under contention, which needs a more detailed model. Errors of 10% or more on complex workloads are common.</li>
</ul>
<p><strong>Empirical models</strong> fit a function from configuration parameters (and workload features) to measured or simulated performance.</p>
<ul>
<li>Strengths: they capture interactions without anyone having to understand them, and once trained, predict in microseconds, which allows searching huge design spaces.</li>
<li>Failures: extrapolation. Outside the range of training configurations, or on workloads unlike the training set, they can be badly wrong without warning. They also need many detailed simulations to train, and they don’t explain their predictions.</li>
</ul>
<p><strong>Combining them:</strong></p>
<ul>
<li>Use the mechanistic model’s outputs (estimated miss penalties, MLP) as features for the empirical one, which then learns only the correction. That needs far fewer training points and extrapolates better.</li>
<li>Use either to prune the design space, then verify the best candidates with detailed simulation.</li>
<li>Check the empirical model’s error on held-out configurations near the edge of the space, not only on random ones.</li>
</ul>`, "hard"),
},
{
  id: "intv-design",
  title: "Open-Ended Design Problems",
  body: `
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
M(`<p>You can spend the same extra area on either a larger ROB (with the registers and queues to match) or a larger L2. How do you decide?</p><p>Then decide with numbers: growing the L2 from 1 MB to 2 MB raises its latency from 14 to 16 cycles and cuts L2 misses from 10 to 6 per 1,000 instructions. Each L2 miss that hits L3 exposes about 30 cycles, and each L2 hit exposes 30% of its latency (30 L2 hits per 1,000 instructions). Growing the ROB from 320 to 384 instead hides about 64 / 6 ≈ 11 more cycles of each isolated DRAM miss (2 per 1,000 instructions). Which wins?</p>`,
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
M(`<p>Someone proposes increasing retirement width from 6 to 8 without changing anything else. How would you evaluate it?</p><p>Then bound it: a counter shows that in 3% of cycles the ROB head has at least 8 completed uops and retirement width is the only limit. At IPC 2.5, what is the most 8-wide retirement could gain?</p>`,
`<p>Sustained IPC can’t exceed allocation width, so the only possible benefit is faster draining after head-of-ROB stalls, which frees entries sooner. Measure first: how often is retirement-width the binding limit? Count cycles where the ROB head is complete and more than 6 completed instructions are waiting to retire, and how often allocation is stalled on a full ROB at the same time. If that’s rare, the proposal can’t help much.</p>
<p>Then simulate it on memory-bound workloads, where post-miss bursts happen most, and weigh against cost: wider map-table updates at commit, more free-list returns per cycle, more ROB read ports. Expect a small gain, concentrated in memory-bound code.</p>
<p><strong>Bound:</strong> in those cycles at most 2 extra uops retire: 0.03 × 2 = 0.06 extra uops per cycle, about 2.4% of 2.5. That’s a ceiling, reached only if every early retirement turns into earlier allocation (that is, the ROB was full at the time). The real gain is likely well below 2%.</p>`, "hard") +
Q(`<p>If you could add only one new performance counter to diagnose an unknown bottleneck, what would it be, and why?</p>`,
`<p>A good answer: <strong>allocation-slot accounting by cause</strong>: every cycle, each of the <em>W</em> allocation slots is labelled retiring, bad speculation, front-end bound, or back-end bound (with back-end split by which resource was full). Unlike most counters, its categories add up to the total, so it tells you where to look first instead of what one structure did.</p>
<p>Alternative strong answer: <strong>ROB-head stall cycles by the head instruction’s type and state</strong> (L1, L2, L3, DRAM miss, TLB miss, divide, store, fence), since most back-end-bound time traces to what’s blocking the head. Either way, justify by how it narrows the search, and admit what it can’t see (for example, slot accounting doesn’t say <em>which</em> load is the problem).</p>`, "medium") +
Q(`<p>Your team’s core, like Arm’s Neoverse V2, has no SMT. Product management asks for 2-way SMT in the next generation. What does it cost, which customers gain, and what evidence would you gather before deciding?</p>`,
`<p>Costs:</p>
<ul>
<li>Replicated architectural state (rename maps, PCs, return stacks, predictor histories), thread IDs and partitioning logic in the ROB and queues, and thread-aware arbitration at every shared port.</li>
<li>Verification: cross-thread interactions, and memory ordering with shared store buffers, are a large new space of bugs.</li>
<li>Security: cross-thread side channels, the mitigations for them, and scheduling restrictions.</li>
<li>Per-thread speed and tail latency, plus a single-thread regression unless the structures grow so that partitioning doesn’t starve one thread.</li>
</ul>
<p>Who gains: stall-heavy server workloads (memory-bound, branchy, front-end bound) typically get 10 to 30% more throughput. Port-saturating dense floating-point code gains little. Some cloud customers want predictable per-core performance and would turn it off.</p>
<p>Evidence: weighted speedup and maximum slowdown on representative co-runner pairs, tail latency for latency-critical services, area and power estimates, and a comparison with spending the same area on more cores per die. And ask the customers whether they would enable it.</p>`, "hard") +
M(`<p>On a server trace, you can spend the same area on one of two options:</p>
<ul>
<li>(A) Double the L1I from 32 KB to 64 KB, which cuts instruction cache misses from 24 to 16 per 1,000 instructions. Every miss hits in the L2 at 14 cycles, and FDIP hides half of that on average.</li>
<li>(B) Double the BTB, which cuts taken-branch BTB misses from 10 to 5 per 1,000 instructions. A BTB miss costs a 9-cycle decode redirect, and 30% of BTB misses also expose an instruction cache miss that FDIP would otherwise have hidden.</li>
</ul>
<p>The current CPI is 0.60. Assume the larger L1I adds no latency. Which option wins, and by how much? What would change your answer?</p>`,
`<ol>
<li><strong>(A)</strong> 8 fewer misses × 14 × 0.5 exposed = 56 cycles per 1,000 instructions. CPI 0.544, a speedup of about <strong>1.10</strong>.</li>
<li><strong>(B)</strong> Each BTB miss avoided saves 9 + 0.3 × 14 = 13.2 cycles. 5 × 13.2 = 66 cycles per 1,000. CPI 0.534, a speedup of about <strong>1.12</strong>.</li>
<li><strong>B wins by about 2 points.</strong></li>
<li>What would change it:
<ul>
<li>The “no latency” assumption. A 64 KB, 8-way L1I has 8 KB per way, larger than a 4 KB page, so it can’t be virtually indexed without aliasing. It needs 16 ways (more energy per fetch) or synonym handling, and possibly an extra cycle on every fetch redirect.</li>
<li>Overlap between the options: some misses A removes are the exposed misses B removes, so their gains don’t add, and evaluating them together matters.</li>
<li>BTB latency: a larger second level costs more bubbles per taken branch found there.</li>
</ul></li>
</ol>`, "hard") +
`<h3 id="sec-process">Running an Investigation</h3>` +
Q(`<p>You have two weeks to explain a 15% performance regression in a new CPU configuration. How would you structure the investigation?</p>`,
`<ol>
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
].map(tabbed));
})();
