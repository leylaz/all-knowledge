/* Section: Pipeline stages
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "pipe"). */

section({
  id: "pipe",
  name: "Pipeline Stages",
  cap: "Pipelining, the iron law, and IF, ID, EX, MEM, WB",
  body: `<p>Every pipeline does the same basic jobs for each instruction: fetch it, figure out what it is and gather its operands, compute, access memory if needed, and write the result. This section has a page for each of those jobs. Each page starts with how the classic 5-stage in-order pipeline does it; other designs, including out-of-order cores, split or extend the same jobs across more stages.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Trace <code>lw r1, 8(r2)</code> through the classic 5-stage pipeline. What does each stage do for this instruction?</p>`,
        a: `<ol start="0"><li><strong>IF:</strong> fetch the instruction at PC; PC becomes PC + 4.</li><li><strong>ID:</strong> decode it, read <code>r2</code> from the register file, and sign-extend the offset 8.</li><li><strong>EX:</strong> the ALU adds <code>r2</code> + 8 to form the effective address.</li><li><strong>MEM:</strong> read data memory at that address.</li><li><strong>WB:</strong> write the loaded value into <code>r1</code>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An <code>add</code> has nothing to do in MEM, yet it still spends a cycle there. Why not let it skip straight to WB?</p>`,
        a: `<p>If an add skipped MEM, it could reach WB in the same cycle as the load ahead of it, and both would need the single register-file write port: a structural hazard. Instructions could also write back out of order, creating WAW problems. Making every instruction take the same path keeps exactly one writeback per cycle and keeps writes in program order, at the cost of a slightly longer latency for some instructions.</p>`
      }
    ]
  }
}, [
{
  id: "pipelining",
  region: "pipe",
  title: "Pipelining and the Iron Law",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “What Is Pipelining?” and “Basic Performance Issues in Pipelining”; Chapter 1, Section 1.9 Quantitative Principles of Computer Design: “The Processor Performance Equation”.`,
  sections: [{ id: "depth", label: "Pipeline Depth" }, { id: "best-depth", label: "Finding the Best Depth" }],
  body: `
<p>Pipelining splits instruction processing into stages so multiple instructions are in flight at once. It raises throughput, not the latency of any single instruction.</p>
<h3>The Iron Law</h3>
<p><strong>Execution time = instruction count (IC) × cycles per instruction (CPI) × cycle time.</strong></p>
<ul>
<li><strong>IC</strong> is influenced by the ISA, compiler, and algorithm.
<ul>
<li><strong>ISA:</strong> it sets how much work one instruction can do. Memory operands, complex addressing modes, fused operations like FMA, and wide SIMD instructions each replace several simpler instructions, so a richer ISA can need fewer instructions for the same task.</li>
<li><strong>Compiler:</strong> optimizations add or remove instructions. Loop unrolling removes repeated increment and branch instructions, vectorization processes many elements per instruction, inlining removes call and return overhead, and poor register allocation adds spill loads and stores.</li>
<li><strong>Algorithm:</strong> it sets how much work there is in the first place. An O(n log n) sort runs far fewer instructions than an O(n²) one on large inputs, and the choice of data structure changes how many steps each operation takes.</li>
</ul></li>
<li><strong>CPI</strong> is set by the microarchitecture and the workload. IPC = 1 / CPI; a 4-wide core peaks at IPC 4 (CPI 0.25).
<ul>
<li><strong>Microarchitecture:</strong>
<ul>
<li><strong>Width</strong> (fetch, issue, commit) sets the floor: CPI can never go below 1 / width.</li>
<li><strong>Pipeline structure</strong> sets how many stages separate where a result or branch outcome is produced from where it's needed. That distance is the stall penalty for each hazard.</li>
<li><strong>Branch predictor accuracy</strong> sets how often that mispredict penalty is paid.</li>
<li><strong>Caches, TLBs, and prefetchers</strong> set the miss rate and miss latency, usually the biggest CPI contributors.</li>
<li><strong>Window size</strong> (ROB, physical registers, LQ/SQ, issue queue) sets how much miss latency can be overlapped with other work.</li>
<li><strong>Execution units and their latencies</strong> set structural stalls (too few ports) and how long dependent chains take.</li>
</ul></li>
<li><strong>Workload:</strong>
<ul>
<li><strong>Instruction mix:</strong> more loads, divides, or long-latency FP operations raise CPI.</li>
<li><strong>Dependence chains:</strong> long chains limit instruction-level parallelism, so a wide core sits idle.</li>
<li><strong>Branch predictability:</strong> data-dependent branches mispredict more often.</li>
<li><strong>Working set and access pattern:</strong> poor locality raises miss rates; dependent misses (pointer chasing) can't overlap.</li>
<li><strong>Code footprint:</strong> large code misses in the instruction cache and branch predictor, starving the frontend.</li>
</ul></li>
</ul></li>
<li><strong>Cycle time</strong> (1 / frequency) is set by the critical path, pipeline depth, and circuit technology.
<ul>
<li><strong>Critical path</strong> (see <a href="#/timing">Critical path and flip-flop timing</a>)<strong>:</strong> the slowest stage sets the clock for the whole pipeline. Its delay is clock-to-Q + the longest logic path + setup time + skew and jitter, so one slow structure (a large issue queue's wakeup-select loop, a big L1 lookup) can cap frequency for the entire core.</li>
<li><strong>Pipeline depth:</strong> splitting logic into more stages shortens each one, so cycle time ≈ total logic delay / stages + latch overhead. The fixed overhead per stage means returns diminish, and stages added between where results are produced and where they're needed raise hazard penalties (see <a href="#/stall-perf/hazard-basics">Hazards and their penalties</a>).</li>
<li><strong>Circuit technology:</strong> the process node and transistor type (FinFET, gate-all-around) set how fast each gate switches. Supply voltage matters too: higher voltage switches faster but costs power roughly with V², and cell choices (fast, leaky low-threshold cells vs. slow, low-leakage cells) trade speed for power.</li>
</ul></li>
</ul>
<p>Any change must be judged on the product. A compiler change that cuts IC 10% but raises CPI 15% is a loss.</p>
<h3>CPI as a Sum</h3>
<p>CPI = CPI<sub>base</sub> + Σ (event frequency per instruction × penalty). For example, with 20% branches, a 5% mispredict rate, and a 15-cycle penalty, branches add 0.2 × 0.05 × 15 = 0.15 CPI. The same structure gives a CPI stack.</p>
<h3 id="sec-depth">Depth: The Math</h3>
<p>Three variables: t<sub>p</sub> is the total logic delay for one instruction's work, t<sub>o</sub> is the latch overhead each stage adds (clock-to-Q, setup, skew, jitter), and N is the number of stages.</p>
<p><strong>Cycle time</strong> (time per clock cycle, the clock period). This formula assumes the stages are <strong>perfectly balanced</strong>: each stage does exactly 1/N of the logic, and each pays one latch overhead:</p>
<p class="eq">Cycle time = <span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + t<sub>o</sub></p>
<p>If the stages aren't balanced, the slowest stage sets the clock for all of them, so the cycle time is longer:</p>
<p class="eq">Cycle time = (logic delay of the slowest stage) + t<sub>o</sub></p>
<p><strong>Time per instruction under ideal conditions.</strong> If the stages are perfectly balanced and there are no hazards or stalls, the pipeline finishes one instruction every cycle (CPI = 1), so the time per instruction on the pipelined processor equals the cycle time:</p>
<p class="eq">Time per instruction<sub>ideal</sub> = <span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + t<sub>o</sub></p>
<p><strong>Unpipelined cycle time</strong> (N = 1, all the logic in one cycle):</p>
<p class="eq">Cycle time<sub>unpipelined</sub> = t<sub>p</sub> + t<sub>o</sub></p>
<p><strong>Ideal speedup over unpipelined</strong>, assuming no hazards (CPI = 1 for both), so speedup is just the ratio of cycle times:</p>
<p class="eq">Speedup = <span class="frac"><span>t<sub>p</sub> + t<sub>o</sub></span><span><span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + t<sub>o</sub></span></span></p>
<p><strong>The ceiling.</strong> As N goes to infinity, the t<sub>p</sub>/N term shrinks to zero:</p>
<p class="eq">Speedup → <span class="frac"><span>t<sub>p</sub> + t<sub>o</sub></span><span>t<sub>o</sub></span></span> = <span class="frac"><span>t<sub>p</sub></span><span>t<sub>o</sub></span></span> + 1</p>
<p>So the limit is not N: the latch overhead alone eventually fills the whole cycle. With t<sub>p</sub> = 10 ns and t<sub>o</sub> = 0.5 ns, that ceiling is 21× no matter how many stages you add.</p>
<p><strong>Real speedup with hazards (CPI ≠ 1).</strong> Speedup is really a ratio of time per instruction, and time per instruction = CPI × cycle time:</p>
<p class="eq">Speedup = <span class="frac"><span>CPI<sub>unpipelined</sub> × cycle time<sub>unpipelined</sub></span><span>CPI<sub>pipelined</sub> × cycle time<sub>pipelined</sub></span></span></p>
<p>The unpipelined design runs one instruction at a time, so it has no hazards and its CPI is 1. Substituting both cycle times:</p>
<p class="eq">Speedup = <span class="frac"><span>t<sub>p</sub> + t<sub>o</sub></span><span>CPI × (<span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + t<sub>o</sub>)</span></span></p>
<p>The ideal formula above is the special case CPI = 1. Real CPI comes from hazards, and each hazard's stall depends on how many stages separate where a result is produced from where it's needed (see <a href="#/stall-perf/hazard-basics">Hazards and their penalties</a>). <a href="#/pipelining/best-depth">Finding the best depth</a> shows how that distance changes as stages are added.</p>
<p><strong>Example: 1 stage vs. 5 stages.</strong> Take t<sub>p</sub> = 10 ns of logic and t<sub>o</sub> = 0.5 ns of latch overhead per stage. The 5-stage pipeline is the classic IF, ID, EX, MEM, WB design with forwarding.</p>
<div class="tbl"><table>
<tr><th></th><th>1 stage (unpipelined)</th><th>5 stages</th></tr>
<tr><td>Cycle time</td><td>10 / 1 + 0.5 = 10.5 ns</td><td>10 / 5 + 0.5 = 2.5 ns</td></tr>
<tr><td>Frequency</td><td>1 / 10.5 ns ≈ 95 MHz</td><td>1 / 2.5 ns = 400 MHz</td></tr>
<tr><td>Latency of one instruction</td><td>1 × 10.5 = 10.5 ns</td><td>5 × 2.5 = 12.5 ns</td></tr>
<tr><td>Ideal throughput (CPI = 1)</td><td>One instruction every 10.5 ns ≈ 95 million instructions/s</td><td>One instruction every 2.5 ns = 400 million instructions/s</td></tr>
<tr><td>Ideal speedup</td><td>1×</td><td>10.5 / 2.5 = <strong>4.2×</strong></td></tr>
<tr><td>Hazard stalls</td><td>None: only one instruction is in flight</td><td><strong>Branches</strong> resolve in EX, 2 stages after fetch, so a mispredict costs 2 cycles. With 20% branches and 10% of them mispredicted: 0.2 × 0.1 × 2 = 0.04.<br><strong>Load-use:</strong> load data is ready at the end of MEM, 1 stage after a dependent instruction needs it in EX, so 1 stall cycle. With 30% loads and a third of them followed by a dependent: 0.3 × 1/3 × 1 = 0.10.</td></tr>
<tr><td>Real throughput with hazards. Average time per instruction = CPI × cycle time; throughput is its inverse.</td><td>CPI = 1: 10.5 ns per instruction ≈ 95 million instructions/s</td><td>CPI = 1 + 0.04 + 0.10 = 1.14: 1.14 × 2.5 = 2.85 ns per instruction ≈ 351 million instructions/s</td></tr>
<tr><td>Real speedup</td><td>1×</td><td>10.5 / 2.85 ≈ <strong>3.7×</strong></td></tr>
</table></div>
<p>Three takeaways. The speedup is 4.2×, not 5×, because each of the five stages pays the 0.5 ns overhead. Hazards cut it further to about 3.7×. And each individual instruction actually takes <em>longer</em> (12.5 ns vs. 10.5 ns); pipelining wins only because five instructions are in flight at once.</p>
<div class="prob"><div class="q"><p><strong>Try it: the speedup ceiling.</strong> A design has t<sub>p</sub> = 9 ns of logic and t<sub>o</sub> = 0.6 ns of latch overhead per stage.</p><ol type="a"><li>What is the maximum possible ideal speedup over unpipelined as N goes to infinity?</li><li>How many stages does it take to reach 90% of that ceiling?</li><li>At that depth, what fraction of each cycle is latch overhead, and how long does one instruction take from start to finish?</li><li>Now add hazards. Branches resolve after 40% of the logic, the logic is split evenly across stages, and 2% of instructions are mispredicted branches. At that depth, how many stages separate fetch from branch resolution, and what is the CPI?</li><li>What is the real speedup at that depth?</li><li>Using <a href="#/pipelining/best-depth">Finding the best depth</a>, what depth gives the best real speedup, and what are its CPI and speedup?</li></ol></div>
<details><summary>Walk through the solution</summary><div class="a"><ol type="a">
<li><strong>Ceiling:</strong> as N → ∞, t<sub>p</sub>/N → 0, so speedup → (t<sub>p</sub> + t<sub>o</sub>) / t<sub>o</sub> = 9.6 / 0.6 = <strong>16×</strong>.</li>
<li><strong>90% of the ceiling</strong> is 14.4×. Solve 9.6 / (9/N + 0.6) = 14.4: the cycle must be 9.6 / 14.4 ≈ 0.667 ns, so 9/N = 0.0667 and <strong>N = 135 stages</strong>.</li>
<li><strong>Overhead fraction:</strong> 0.6 / 0.667 = <strong>90%</strong> of every cycle is overhead; only 0.067 ns does logic. <strong>Latency:</strong> 9 + 135 × 0.6 = <strong>90 ns</strong> per instruction, versus 9.6 ns unpipelined.</li>
<li><strong>Distance and CPI:</strong> each stage does 9 / 135 ≈ 0.0667 ns of logic, and fetch to branch resolution is 40% of the logic (3.6 ns), so it spans 3.6 / 0.0667 = <strong>54 stages</strong>: a 54-cycle mispredict penalty. CPI = 1 + 0.02 × 54 = <strong>2.08</strong> (IPC ≈ 0.48). In time, each mispredict costs 54 × 0.667 ≈ 36 ns: only 3.6 ns of that is logic, and 32.4 ns is latch overhead from all the stages inside the span.</li>
<li><strong>Real speedup:</strong> time per instruction = 2.08 × 0.667 ≈ 1.39 ns, so real speedup = 9.6 / 1.39 ≈ <strong>6.9×</strong>, far below the 16× ceiling.</li>
<li><strong>Best depth:</strong> γ = 0.02 × 0.4 = 0.008, so N<sub>opt</sub> = √(9 / (0.008 × 0.6)) = √1875 ≈ <strong>43</strong>. At N = 43: cycle ≈ 0.809 ns, the span is 0.4 × 43 ≈ 17 stages, CPI ≈ 1 + 0.02 × 17.2 ≈ <strong>1.34</strong>, time ≈ 1.09 ns, so real speedup ≈ <strong>8.8×</strong>.</li>
</ol><p>Takeaway: the ceiling is the most pipelining could ever give, but past about 43 stages here, every extra stage inside the fetch-to-resolve span costs more in mispredicts than it saves in cycle time.</p></div></details></div>
<h3>Hazards</h3>
<p>Hazard penalties for the classic 5-stage pipeline and out-of-order cores are covered under Pipeline stages: <a href="#/stall-perf/hazard-basics">where penalties come from</a>, <a href="#/structural-hazards/struct-table">structural hazards</a>, <a href="#/data-hazards/reg-table">data hazards</a>, <a href="#/branch-hazards/control-table">branch hazards</a>, and <a href="#/stall-perf/memory-stalls">memory stalls and flushes</a>.</p>
<h3 id="sec-best-depth">Finding the Best Depth</h3>
<p>Adding stages shortens the cycle, but stages that land inside a hazard's span also lengthen its penalty. The best depth is where those effects balance.</p>
<p><strong>Step 0: write CPI from hazard distances.</strong> For each hazard type i, let h<sub>i</sub> be how often it happens per instruction and d<sub>i</sub> the number of stages it spans:</p>
<p class="eq">CPI = 1 + Σ h<sub>i</sub> × d<sub>i</sub></p>
<p><strong>Step 1: decide how distances change with depth.</strong> This depends on where stages are added, so it's a design choice, not a law. To get a formula, assume the pipeline is deepened by splitting all the logic evenly. Then a hazard whose span covers a fraction f<sub>i</sub> of the logic (for example, fetch to branch resolution is 40% of the logic) spans about f<sub>i</sub> × N stages:</p>
<p class="eq">d<sub>i</sub> ≈ f<sub>i</sub> × N</p>
<p>Only under this even-split assumption does CPI become 1 + γN, with γ = Σ h<sub>i</sub> f<sub>i</sub>. For example, if 2% of instructions are mispredicted branches spanning 40% of the logic, and 10% are load-use pairs spanning 20%, then γ = 0.02 × 0.4 + 0.1 × 0.2 = 0.028. At N = 5 this gives a 2-cycle branch penalty and a 1-cycle load-use stall, matching the classic 5-stage pipeline above.</p>
<p><strong>Step 2: write time per instruction</strong> (CPI × cycle time) and multiply it out:</p>
<p class="eq">T(N) = (1 + γN) × (<span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + t<sub>o</sub>) = <span class="frac"><span>t<sub>p</sub></span><span>N</span></span> + γt<sub>o</sub>N + (t<sub>o</sub> + γt<sub>p</sub>)</p>
<ul>
<li><strong>t<sub>p</sub> / N shrinks</strong> as N grows: the benefit of shorter stages.</li>
<li><strong>γt<sub>o</sub>N grows</strong> as N grows: the latch overhead of stages placed inside hazard spans, paid on every hazard.</li>
<li><strong>t<sub>o</sub> + γt<sub>p</sub> is constant:</strong> γt<sub>p</sub> is the logic delay inside hazard spans, which you pay however the logic is split.</li>
</ul>
<p><strong>Step 3: find where the curve bottoms out.</strong> A shrinking term plus a growing term makes a U-shaped curve, with its minimum where the two terms are equal:</p>
<p class="eq"><span class="frac"><span>t<sub>p</sub></span><span>N</span></span> = γt<sub>o</sub>N</p>
<p class="eq">N<sub>opt</sub> = √<span class="frac"><span>t<sub>p</sub></span><span>γt<sub>o</sub></span></span></p>
<p>Calculus gives the same answer: dT/dN = −t<sub>p</sub>/N<sup>2</sup> + γt<sub>o</sub> = 0.</p>
<p><strong>Step 4: plug in numbers.</strong> With t<sub>p</sub> = 10 ns, t<sub>o</sub> = 0.5 ns, and γ = 0.028:</p>
<p class="eq">N<sub>opt</sub> = √<span class="frac"><span>10</span><span>0.028 × 0.5</span></span> = √714 ≈ 27 stages</p>
<p>Check the balance: at N = 27, t<sub>p</sub>/N ≈ 0.37 ns and γt<sub>o</sub>N ≈ 0.38 ns.</p>
<div class="tbl"><table>
<tr><th>N</th><th>Cycle time (ns)</th><th>CPI (even split)</th><th>Time per instruction (ns)</th></tr>
<tr><td>5</td><td>2.50</td><td>1.14</td><td>2.85</td></tr>
<tr><td>10</td><td>1.50</td><td>1.28</td><td>1.92</td></tr>
<tr><td>20</td><td>1.00</td><td>1.56</td><td>1.56</td></tr>
<tr><td><strong>27</strong></td><td>0.87</td><td>1.76</td><td><strong>1.53 (minimum)</strong></td></tr>
<tr><td>40</td><td>0.75</td><td>2.12</td><td>1.59</td></tr>
<tr><td>60</td><td>0.67</td><td>2.68</td><td>1.79</td></tr>
</table></div>
<p><strong>What moves the best depth:</strong></p>
<ul>
<li><strong>More total logic (larger t<sub>p</sub>):</strong> deeper; there's more work worth splitting.</li>
<li><strong>More latch overhead (larger t<sub>o</sub>):</strong> shallower; each stage costs more.</li>
<li><strong>More frequent hazards or wider spans (larger γ):</strong> shallower. Better branch prediction lowers h; resolving branches earlier shrinks f.</li>
<li><strong>Where stages go:</strong> stages added outside hazard spans don't raise γ at all, so designers place extra stages where they cost the least.</li>
<li><strong>Out-of-order execution:</strong> hides much of the latency-type hazards (load-use, FP latency), shrinking their effective share of γ. Flush-type hazards remain, which is why out-of-order cores can be deeper than in-order ones but still invest heavily in branch prediction.</li>
</ul>
<p>The curve is flat near its minimum (20 to 40 stages are within about 4% here), so designers can choose a shallower pipeline with little performance loss. They usually do, because this model ignores power: every extra stage adds flip-flops, clock load, and wasted wrong-path work.</p>
<h3>Deep vs. Shallow: PPA</h3>
<div class="tbl"><table>
<tr><th></th><th>Deeper pipeline</th><th>Shallower pipeline</th></tr>
<tr><td>Performance</td><td><ul><li>Higher frequency</li><li>Bigger mispredict and load-use penalties</li><li>Needs better prediction</li></ul></td><td><ul><li>Lower frequency</li><li>Cheaper mispredicts</li><li>Higher IPC per cycle</li></ul></td></tr>
<tr><td>Power</td><td><ul><li>More latches and clock load</li><li>Higher f often needs higher V</li><li>More wasted wrong-path work</li></ul></td><td><ul><li>Fewer latches</li><li>Can run at lower V for the same throughput</li></ul></td></tr>
<tr><td>Area</td><td>More pipeline registers and bypass paths; larger windows to cover longer latencies</td><td>Less overhead</td></tr>
</table></div>
<p>History: very deep designs (around 30 stages in some mid-2000s desktop chips) hit a power wall. Modern high-performance cores sit closer to 12–20 stages and get their performance from width and large windows.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Total logic delay is 10 ns and each pipeline latch adds 0.5 ns. 2% of instructions are mispredicted branches, and branches resolve after 40% of the logic. Assume the logic is split evenly across stages. Find the mispredict penalty and time per instruction for N = 5, 10, 20, 30, 50, 60, and 90, and the best depth.</p>`,
        a: `<ol start="0"><li>The penalty is the number of stages between fetch and branch resolution. With an even split, 40% of the logic spans 0.4N stages.</li><li>CPI = 1 + 0.02 × 0.4N. Cycle time = 10 / N + 0.5 ns. Time per instruction = CPI × cycle time:</li></ol>
<div class="tbl"><table><tr><th>N</th><th>Cycle (ns)</th><th>Penalty (cycles)</th><th>CPI</th><th>ns / instr</th></tr>
<tr><td>5</td><td>2.50</td><td>2</td><td>1.04</td><td>2.60</td></tr>
<tr><td>10</td><td>1.50</td><td>4</td><td>1.08</td><td>1.62</td></tr>
<tr><td>20</td><td>1.00</td><td>8</td><td>1.16</td><td>1.16</td></tr>
<tr><td>30</td><td>0.83</td><td>12</td><td>1.24</td><td>1.03</td></tr>
<tr><td><strong>50</strong></td><td>0.70</td><td>20</td><td>1.40</td><td><strong>0.98</strong></td></tr>
<tr><td>60</td><td>0.67</td><td>24</td><td>1.48</td><td>0.99</td></tr>
<tr><td>90</td><td>0.61</td><td>36</td><td>1.72</td><td>1.05</td></tr></table></div>
<p>Best depth: γ = 0.02 × 0.4 = 0.008, so N<sub>opt</sub> = √(10 / (0.008 × 0.5)) = <strong>50</strong>. The penalty grows here only because every new stage lands inside the fetch-to-resolve span; stages added after resolution wouldn't change it. Gains flatten well before 50 while power keeps climbing, which is why real cores stop much shallower.</p>`
      }
    ],
    interview: [
      {
        q: `<p>Derive the performance-optimal pipeline depth and explain why power-aware designs choose fewer stages.</p>`,
        a: `<p>Let t<sub>p</sub> be total logic delay and t<sub>o</sub> the latch overhead per stage. Each hazard type i occurs h<sub>i</sub> times per instruction and costs d<sub>i</sub> cycles, the number of stages between where its result is produced and where it's needed, so CPI = 1 + Σ h<sub>i</sub>d<sub>i</sub>.</p><p>To get a closed form, assume the logic is split evenly as N grows, so a hazard spanning a fraction f<sub>i</sub> of the logic spans f<sub>i</sub>N stages. Then CPI = 1 + γN with γ = Σ h<sub>i</sub>f<sub>i</sub>, and time per instruction T(N) = (t<sub>p</sub>/N + t<sub>o</sub>)(1 + γN) = t<sub>p</sub>/N + γt<sub>o</sub>N + t<sub>o</sub> + γt<sub>p</sub>. Setting dT/dN = −t<sub>p</sub>/N² + γt<sub>o</sub> = 0 gives <strong>N<sub>opt</sub> = √(t<sub>p</sub> / (γt<sub>o</sub>))</strong>. State the assumption: stages added outside hazard spans don't raise γ.</p><p>Power changes the answer: more stages means more latches and clock load, higher frequency (power ∝ f, often with higher voltage), and more energy wasted on flushed instructions. Optimizing performance per watt, or performance at a fixed power budget, lands at a much smaller N.</p>`
      },
      {
        q: `<p>A change raises IPC by 10% but lengthens the critical path by 5%. Net effect?</p>`,
        a: `<p>Time ∝ CPI × cycle time = (1 / 1.10) × 1.05 ≈ 0.955, so about <strong>4.7% faster</strong>, assuming the instruction count is unchanged. If the slower path forces a lower voltage-frequency point for the whole core, the power picture changes too.</p>`
      },
      {
        q: `<p>Option A cuts instruction count by 20% but raises CPI from 1.0 to 1.2. Option B leaves instruction count alone, raises the clock frequency by 10%, but CPI rises from 1.0 to 1.08. Which is faster?</p>`,
        a: `<p>Use the iron law, comparing time relative to the baseline (IC × CPI × cycle time):</p><ul><li><strong>A:</strong> 0.8 × 1.2 × 1 = 0.96, so 4% faster.</li><li><strong>B:</strong> 1 × 1.08 × (1 / 1.1) ≈ 0.982, so 1.8% faster.</li></ul><p><strong>A wins.</strong> A large CPI increase can still be worth it if it removes enough instructions.</p>`
      },
      {
        q: `<p>Why doesn't doubling a core's width (from 4-wide to 8-wide) double its IPC? The workload has a branch every 5 to 6 instructions.</p>`,
        a: `<ul><li><strong>Limited parallelism:</strong> dependence chains mean there often aren't 8 independent instructions ready.</li><li><strong>Branches:</strong> a branch every 5–6 instructions limits how many useful instructions can be fetched per cycle, and mispredicts waste twice as many slots at twice the width.</li><li><strong>Memory:</strong> misses stall a wide core just as long as a narrow one.</li><li><strong>Cost grows faster than width:</strong> rename, wakeup-select, register file ports, and the bypass network grow roughly with the square of width, which can lower frequency or add pipeline stages.</li></ul><p>Real gains from widening are typically well under 2× and highly workload dependent.</p>`
      },
      {
        q: `<p>A core uses 10 W: 30% in the clock network and flip-flops, 70% in logic. Deepening the pipeline raises frequency 20% at the same voltage, adds 33% more flip-flops, and lowers IPC by 8%. What happens to performance, power, and performance per watt?</p>`,
        a: `<ol start="0"><li><strong>Logic power:</strong> 7 W × 1.2 (frequency) = 8.4 W.</li><li><strong>Clock and flip-flop power:</strong> 3 W × 1.33 (more flip-flops) × 1.2 = 4.8 W.</li><li><strong>Total:</strong> 13.2 W, up 32%.</li><li><strong>Performance:</strong> 1.2 × 0.92 = 1.104, up 10.4%.</li><li><strong>Performance per watt:</strong> 1.104 / 1.32 ≈ 0.84, about <strong>16% worse</strong>.</li></ol><p>A 10% performance gain for 32% more power is why power-limited designs avoid deep pipelines. If the design also needed a voltage increase to hit the higher frequency, it would look even worse.</p>`
      }
    ]
  }
},

{
  id: "stage-if",
  region: "pipe",
  title: "Instruction Fetch (IF)",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “A Simple Implementation of a RISC Instruction Set”.`,
  sections: [
    { id: "classic", label: "In the Classic 5-Stage Pipeline" },
    { id: "parts", label: "The Parts of the Fetch Stage" },
    { id: "icache", label: "The Instruction Cache and ITLB" },
    { id: "miss", label: "When Fetch Misses" },
    { id: "branches", label: "Fetch and Branches" },
    { id: "exceptions", label: "Exceptions in Fetch" },
    { id: "smc", label: "Self-Modifying Code" },
    { id: "wide", label: "Fetch in Wider Cores" }
  ],
  body: `
<p>Instruction fetch (IF) is the first stage: it reads the instruction at the program counter and decides which address to fetch next. In the classic pipeline that is one cache read and one add. Everything else on this page (the instruction cache, the ITLB, misses, branches, and exceptions) is what it takes to keep that read going every cycle.</p>

<h3 id="sec-classic">In the Classic 5-Stage Pipeline</h3>
<ul>
<li>The program counter (PC) is sent to instruction memory, which returns the instruction at that address.</li>
<li>The PC is advanced to the next sequential instruction by adding 4, because every instruction is 4 bytes long.</li>
</ul>
<p>Hennessy and Patterson write the stage as two register transfers (Appendix C.3). The fetched instruction and the incremented PC go into the IF/ID pipeline register, and the PC is loaded with either PC + 4 or the target of a taken branch that has reached the stage where it's resolved:</p>
<pre><code>IF/ID.IR       ← Mem[PC]
IF/ID.NPC, PC  ← if ((EX/MEM.opcode == branch) and EX/MEM.cond)
                    EX/MEM.ALUOutput      <span class="cm"># branch target</span>
                 else
                    PC + 4</code></pre>
<p>In that version, branches complete in MEM. The aggressive design on the <a href="#/stage-id">ID page</a> moves the comparison and target adder into ID, so the mux takes the target from ID instead and a taken branch costs 1 cycle instead of 3.</p>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="The IF stage datapath. A next-PC mux chooses among PC plus 4, a branch target from ID, and an exception vector, and loads the PC register. The PC goes to the instruction cache, with the ITLB looked up in parallel, and to an adder that adds 4. The instruction goes into the IR field of the IF/ID pipeline register, and PC plus 4 goes into its NPC field and back to the mux." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrIF" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<polygon points="150,95 180,110 180,175 150,190" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="165" y="86" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Next-PC mux</text>
<text x="12" y="119" style="fill:var(--muted);font-size:11px">branch target from ID</text>
<text x="12" y="154" style="fill:var(--muted);font-size:11px">exception vector</text>
<rect x="205" y="120" width="50" height="45" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="230" y="147" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">PC</text>
<rect x="320" y="35" width="150" height="60" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="395" y="60" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">Instruction cache</text>
<text x="395" y="79" text-anchor="middle" style="fill:var(--muted);font-size:11px">ITLB lookup in parallel</text>
<rect x="320" y="150" width="80" height="45" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="360" y="177" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">Add 4</text>
<rect x="590" y="25" width="40" height="225" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="610" y="17" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">IF/ID</text>
<text x="610" y="69" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">IR</text>
<text x="610" y="176" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">NPC</text>
<text x="529" y="58" text-anchor="middle" style="fill:var(--muted);font-size:11px">instruction</text>
<text x="460" y="165" text-anchor="middle" style="fill:var(--muted);font-size:11px">PC + 4</text>
<text x="340" y="292" text-anchor="middle" style="fill:var(--muted);font-size:11px">PC + 4 (the default: predict not taken)</text>
<circle cx="285" cy="142" r="3" style="fill:var(--muted)"/>
<circle cx="520" cy="172" r="3" style="fill:var(--muted)"/>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M10,125 H148" marker-end="url(#arrIF)"/>
<path d="M10,160 H148" marker-end="url(#arrIF)"/>
<path d="M180,142 H203" marker-end="url(#arrIF)"/>
<path d="M255,142 H285"/>
<path d="M285,142 V65 H318" marker-end="url(#arrIF)"/>
<path d="M285,142 V172 H318" marker-end="url(#arrIF)"/>
<path d="M470,65 H588" marker-end="url(#arrIF)"/>
<path d="M400,172 H588" marker-end="url(#arrIF)"/>
<path d="M520,172 V300 H165 V188" marker-end="url(#arrIF)"/>
</g>
<text x="340" y="322" text-anchor="middle" style="fill:var(--muted);font-size:11px">The cache read and the add happen in parallel. The mux picks the next PC before the cycle ends.</text>
</svg></div>

<h3 id="sec-parts">The Parts of the Fetch Stage</h3>
<ul>
<li><strong>Program counter (PC).</strong> A register holding the address of the instruction being fetched. It's written every cycle unless the stage is stalled, in which case it holds its value so the same fetch is retried.</li>
<li><strong>Incrementer.</strong> A dedicated adder that computes PC + 4. It's separate from the ALU, which belongs to EX, because both are needed in the same cycle (a structural hazard otherwise).</li>
<li><strong>Next-PC mux.</strong> Chooses what the PC becomes: PC + 4, a branch or jump target from a later stage, a predicted target from a BTB (if there is one), or the exception handler's address. Its select lines come from later stages, so they're among the latest-arriving signals in the cycle.</li>
<li><strong>Instruction memory.</strong> In any real pipeline, this is a separate L1 instruction cache, so IF and MEM can access memory in the same cycle (see the next section).</li>
<li><strong>Instruction TLB (ITLB).</strong> Translates the PC's virtual page to a physical page, looked up in parallel with the cache read.</li>
<li><strong>IF/ID pipeline register.</strong> Holds the instruction (IR) and PC + 4 (NPC) for ID. ID needs NPC to compute branch targets relative to the branch (see <a href="#/pipe-problems/pipe-regs">Pipeline Registers</a>). On a squash, it's loaded with a no-op instead.</li>
</ul>

<h3 id="sec-icache">The Instruction Cache and ITLB</h3>
<p><strong>Why it's split from the data cache.</strong> With one memory, a load or store in MEM and a fetch in IF would collide every time, a structural hazard that would stall fetch on about a third of cycles in typical code. Separate instruction and data caches double the memory bandwidth, and each can be placed next to the logic that uses it (H&amp;P Appendix C.2 and Appendix B). Unified caches remain the norm from L2 outward.</p>
<p><strong>What's different about it.</strong></p>
<ul>
<li><strong>Read-only from the pipeline's side.</strong> Fetch never writes it, so it needs no dirty bits or write policy, and an evicted line is simply dropped.</li>
<li><strong>Lower miss rates.</strong> For the same size, instruction caches miss far less often than data caches, because code is reused in loops and runs sequentially (H&amp;P Appendix B compares them). Large server binaries are the exception (see <a href="#/fe-targets/footprint">Large Code Footprints</a>).</li>
<li><strong>Sequential use of a line.</strong> A 64-byte line holds 16 fixed-length 4-byte instructions, so one miss serves the next 16 fetches if no branch leaves the line. Many designs keep the last line read in a <em>line buffer</em> and skip the array read while fetch stays in it, which saves energy.</li>
<li><strong>Way prediction</strong> (H&amp;P Chapter 2) works well here for the same reason: consecutive fetches usually hit the same way, so the cache can read one way instead of all of them.</li>
</ul>
<p><strong>Typical sizes.</strong> Intel Golden Cove and AMD Zen 4 each have a 32 KB, 8-way instruction cache with 64-byte lines. Apple's large cores use much larger ones (192 KB on the M1's Firestorm cores).</p>
<p><strong>The ITLB.</strong> Fetch uses virtual addresses, so every fetch needs a translation and a permission check (the page must be executable). Like the data side, the L1 instruction cache is usually <strong>virtually indexed, physically tagged</strong>: the set is chosen with page-offset bits, which don't need translation, while the ITLB translates the rest in parallel, and the physical tag is compared at the end. For 32 KB, 8 ways, and 64-byte lines there are 64 sets, so offset plus index is 6 + 6 = 12 bits, exactly a 4 KB page offset. That's why so many L1 caches are 32 KB and 8-way (see <a href="#/dcache">Data Cache</a> and <a href="#/tlb">TLBs and Page Walks</a>). An ITLB miss stalls fetch until the second-level TLB or a page walk supplies the translation. Large code footprints spread over many pages make ITLB misses common, which is why huge pages for code help.</p>

<h3 id="sec-miss">When Fetch Misses</h3>
<p>On an instruction cache miss, IF can't hand ID an instruction:</p>
<ol start="0">
<li>The PC and IF/ID hold their values, and ID receives a bubble (a no-op) each cycle. Instructions already in ID through WB keep moving and drain.</li>
<li>The cache sends a request to the next level. When the line returns, it's written into the cache, the fetch is retried, and the pipeline refills behind it.</li>
</ol>
<p>Each miss costs about its full miss penalty, so instruction misses add to CPI as instruction misses per instruction × miss penalty, alongside data misses (H&amp;P Appendix B). Since instructions are used in order, the cache optimizations from H&amp;P Chapter 2 fit fetch especially well:</p>
<ul>
<li><strong>Critical word first and early restart.</strong> Return the word fetch asked for first and restart the pipeline as soon as it arrives, instead of waiting for the whole line.</li>
<li><strong>Next-line prefetching.</strong> On a miss, also fetch the next sequential line. H&amp;P describe the common form: the requested line goes into the cache, and the next one into an <strong>instruction stream buffer</strong> (Jouppi, 1990), which is checked on the next miss and moved into the cache only if used, so a wrong prefetch doesn't evict anything.</li>
<li><strong>Branch-directed prefetching.</strong> Wider cores go further, using the branch predictor's future fetch addresses as the prefetch list (see <a href="#/fe-decoupled/fdip">Fetch-Directed Prefetching</a>).</li>
</ul>

<h3 id="sec-branches">Fetch and Branches</h3>
<p>IF has to pick the next PC before the current instruction is even decoded, so it can't know whether it just fetched a branch. The classic pipeline simply fetches PC + 4 every cycle, which amounts to predicting every branch not taken. When a branch turns out to be taken, the stage that resolves it sends the target to the next-PC mux, and the instructions fetched after the branch are squashed by loading no-ops into the pipeline registers (see <a href="#/branch-hazards">Branch Hazards</a>).</p>
<p>To predict taken branches without waiting for decode, IF looks up a <strong>branch target buffer (BTB)</strong> with the PC in the same cycle as the cache read. A hit supplies a predicted target, which the next-PC mux uses for the following fetch (see <a href="#/branch-hazards/btb">The BTB and Decode Redirects</a>). A return address stack does the same for returns. In H&amp;P's terms (Chapter 3), these turn fetch into an <em>integrated instruction fetch unit</em>: branch prediction, instruction prefetch, and instruction memory access and buffering, run as one unit.</p>

<h3 id="sec-exceptions">Exceptions in Fetch</h3>
<p>H&amp;P list three exceptions that can occur in IF (Appendix C.4):</p>
<ul>
<li><strong>Page fault on instruction fetch.</strong> The ITLB and page walk find no valid mapping for the PC's page.</li>
<li><strong>Misaligned access.</strong> The PC isn't a multiple of 4, for example after a jump through a bad register value.</li>
<li><strong>Memory protection violation.</strong> The page is mapped but not executable, or not accessible at the current privilege level.</li>
</ul>
<p>The fetch can't complete, but the stage doesn't take the exception right away. It marks the instruction as faulting and passes it down the pipeline, and the exception is taken when that instruction reaches WB. That ordering matters because faults can happen out of order in time. A load followed by an add: the add can page-fault in IF a cycle before the load page-faults in MEM, even though the load is older. Handling exceptions only at WB, in program order, guarantees the load's fault is taken first, which is what makes them <em>precise</em> (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). When the handler returns, fetch restarts at the faulting PC.</p>
<p>A fetch fault on a wrong path, such as a mispredicted branch target in an unmapped page, must not be taken at all. Marking and carrying it handles this too: the squash removes the faulting instruction before it reaches WB.</p>

<h3 id="sec-smc">Self-Modifying Code</h3>
<p>Because the instruction cache is separate, a store that writes code goes to the data cache, and the instruction cache (and any instructions already fetched) may still hold the old bytes. JIT compilers, dynamic linkers, and debuggers setting breakpoints all write code, so ISAs define what happens:</p>
<ul>
<li><strong>x86</strong> keeps the instruction side coherent in hardware. The core detects stores to lines that are cached or already in flight in the front end, and flushes the pipeline from the modified instruction onward. That flush is expensive, so code that writes near code it's running is slow.</li>
<li><strong>Arm</strong> leaves it to software: clean the data cache line to the point of unification (<code>DC CVAU</code>), wait for it (<code>DSB</code>), invalidate the instruction cache line (<code>IC IVAU</code>), wait again (<code>DSB</code>), and then execute an instruction synchronization barrier (<code>ISB</code>) so instructions fetched before the change are discarded.</li>
<li><strong>RISC-V</strong> provides <code>FENCE.I</code>, which makes the hart's earlier stores visible to its own later instruction fetches.</li>
</ul>

<h3 id="sec-wide">Fetch in Wider Cores</h3>
<p>A superscalar core has to fetch several instructions per cycle, and that turns this one-read stage into the front end. The problems, each covered in the Front End section:</p>
<ul>
<li><strong>Fetch blocks.</strong> Fetch reads an aligned window (16 or 32 bytes) per cycle. A block that crosses a line boundary, or a taken branch in the middle of one, cuts delivery short (see <a href="#/fe-decoupled/blocks">Fetch Blocks and Taken Branches</a>).</li>
<li><strong>Prediction before decode.</strong> The predictor must find branches and their targets from the fetch address alone, through multi-level BTBs, a return stack, and an indirect predictor (see <a href="#/fe-targets">Branch Targets</a>).</li>
<li><strong>Decoupling.</strong> A queue of predicted fetch addresses lets the predictor run ahead of the instruction cache and drive prefetching (see <a href="#/fe-decoupled">Decoupled Fetch and the Fetch Target Queue</a>).</li>
<li><strong>Variable-length instructions.</strong> On x86, the next PC isn't PC + a constant, so finding instruction boundaries takes length decoding, predecode bits stored with the cache, and micro-op caches that skip fetch and decode on hot code (see <a href="#/fe-decode">Decoders and the Micro-op Cache</a>).</li>
<li><strong>Instruction buffering.</strong> A queue between fetch and decode absorbs bubbles from misses and taken branches, so decode keeps busy while fetch catches up. Loop buffers go further: Intel's loop stream detector replays a tight loop from the decoded micro-op queue, letting fetch and decode idle.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>: Appendix C.1 to C.4 (the pipeline, its implementation, and exceptions), Appendix B (split caches and miss rates), Chapter 2 (way prediction, critical word first, instruction prefetching), Chapter 3 (branch-target buffers and integrated instruction fetch units) · Jouppi, "Improving Direct-Mapped Cache Performance by the Addition of a Small Fully-Associative Cache and Prefetch Buffers," ISCA 1990 · Arm, <em>Arm Architecture Reference Manual</em> (cache maintenance and <code>ISB</code>) · RISC-V, <em>Unprivileged ISA Specification</em> (<code>FENCE.I</code>)</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Starting at PC = 0x2000, the pipeline fetches one instruction per cycle. The instruction at 0x2008 is a taken branch to 0x3000, resolved at the end of ID. The fetch of 0x2000 happens in cycle 0. Which addresses are fetched in cycles 0–4, and which fetch is wasted?</p>`,
        a: `<ol start="0"><li>Cycle 0: 0x2000. Cycle 1: 0x2004. Cycle 2: 0x2008 (the branch). Each time, IF sets PC to PC + 4.</li><li>Cycle 3: the branch is in ID, while IF fetches 0x200C. At the end of cycle 3, ID writes 0x3000 into the PC.</li><li>Cycle 4: 0x3000.</li><li>The fetch of <strong>0x200C</strong> in cycle 3 is squashed: the 1-cycle taken-branch penalty.</li></ol>`
      },
      {
        q: `<p>An in-order core runs a server workload at a CPI of 1.1 without instruction cache misses. The instruction cache misses 20 times per 1000 instructions. 80% of those misses hit in the L2 at 13 cycles, and the rest hit in the LLC at 40 cycles. Each miss stalls fetch for its full latency. What is the CPI, and what share of time goes to instruction misses? An instruction stream buffer then turns half of the L2-hit misses into hits. What speedup does it give?</p>`,
        a: `<ol start="0"><li>Misses per instruction: 20 / 1000 = 0.02.</li><li>Average penalty per miss: 0.8 × 13 + 0.2 × 40 = 10.4 + 8 = 18.4 cycles.</li><li>Added CPI: 0.02 × 18.4 = 0.368, so CPI = 1.1 + 0.368 = <strong>1.468</strong>.</li><li>Share of time: 0.368 / 1.468 ≈ <strong>25%</strong>.</li><li>The stream buffer removes 0.02 × 0.4 × 13 = 0.104 CPI, giving 1.364. Speedup: 1.468 / 1.364 ≈ <strong>1.076</strong>, about 8%.</li><li>It only helps the cheaper misses, the sequential ones that hit in the L2. The LLC misses, at more than twice the cost per miss, are untouched, and they need a prefetcher that follows branches.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is instruction fetch simple in MIPS but hard on x86?</p>`,
        a: `<p>MIPS instructions are always 4 bytes, so the next PC is PC + 4 before the instruction is even looked at, and fetching several instructions per cycle just means reading consecutive 4-byte words. x86 instructions are 1 to 15 bytes long, so the hardware can't know where the next instruction starts until it has worked out the current one's length. Wide x86 front ends need length-decoding logic, predecode bits stored in the instruction cache, and micro-op caches that store already-decoded instructions to skip this work on hot code.</p>`
      },
      {
        q: `<p>A colleague proposes replacing the split L1 instruction and data caches with one unified L1 of the same total size and two read ports, arguing it adapts to workloads with big code or big data. What do you lose, and when would the unified cache win?</p>`,
        a: `<p>What's lost:</p><ul><li><strong>Latency and energy.</strong> Two ports on one larger array make each access slower and more expensive than a read from a smaller single-ported array, and both are in critical loops (fetch every cycle, and load-to-use).</li><li><strong>Placement.</strong> Split caches sit next to the fetch unit and the load/store unit. A unified one is far from at least one of them, adding wire delay.</li><li><strong>Isolation.</strong> A data-streaming loop can evict hot code, turning a data-side problem into fetch stalls that nothing downstream can hide.</li><li><strong>Simplicity.</strong> The instruction side is read-only and can use its own line size, predecode bits, and way prediction tuned for sequential access.</li></ul><p>It wins on capacity: when code or data alone exceeds its half while the other half sits underused, the unified cache's miss rate is lower. That trade favors unified caches from L2 outward, where latency matters less and port conflicts are rarer, which is exactly how real hierarchies are built.</p>`
      }
    ]
  }
},

{
  id: "stage-id",
  region: "pipe",
  title: "Instruction Decode / Register Fetch (ID)",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “A Simple Implementation of a RISC Instruction Set”.`,
  body: `
<h3>In the Classic 5-Stage Pipeline</h3>
<ul>
<li><strong>Decode and read registers together.</strong> The instruction is decoded while the register file reads the source registers it names.</li>
<li><strong>Branch comparison.</strong> As the registers come out of the register file, they are compared for equality, in case the instruction is a branch.</li>
<li><strong>Sign extension.</strong> The instruction's offset field is sign-extended in case the instruction needs it.</li>
<li><strong>Branch target.</strong> The possible branch target is computed by adding the sign-extended offset to the incremented PC.</li>
<li><strong>Early branch completion (aggressive designs).</strong> If the comparison says the branch is taken, the target can be written into the PC at the end of this stage, completing the branch here instead of later. This shortens the branch penalty; see <a href="#/branch-hazards/control-table">Branch hazards</a>.</li>
</ul>
<p><strong>Fixed-field decoding.</strong> Reading registers in parallel with decoding works because RISC encodings keep the register specifier fields at the same bit positions in every instruction. The register file can be indexed from those bits before the hardware knows what kind of instruction it has. Sometimes that reads a register the instruction doesn't use. That doesn't hurt performance, but it wastes energy, so power-sensitive designs may avoid unneeded reads. The immediate field also sits at a fixed position, which is why the sign-extended immediate can be prepared in this stage whether or not it turns out to be needed.</p>
<p><strong>Example: decoding a load.</strong> Take the MIPS instruction <code>lw $t0, -8($s1)</code>, encoded as <code>0x8E28FFF8</code>. Its 32 bits split into fixed fields, and each field goes straight to the hardware that needs it, all in the same cycle:</p>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="The 32-bit instruction word for lw $t0, -8($s1) split into fields: opcode 100011 goes to the control decoder, rs 10001 and rt 01000 go to the register file read ports, and the 16-bit immediate goes to the sign extender, which produces 0xFFFFFFF8." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="104" y="28" text-anchor="middle" style="fill:var(--muted);font-size:11px">bits 31–26</text>
<text x="203" y="28" text-anchor="middle" style="fill:var(--muted);font-size:11px">25–21</text>
<text x="293" y="28" text-anchor="middle" style="fill:var(--muted);font-size:11px">20–16</text>
<text x="482" y="28" text-anchor="middle" style="fill:var(--muted);font-size:11px">15–0</text>
<rect x="50" y="36" width="108" height="50" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="158" y="36" width="90" height="50" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<rect x="248" y="36" width="90" height="50" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<rect x="338" y="36" width="288" height="50" style="fill:var(--pad-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="104" y="57" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-family:var(--mono)">100011</text>
<text x="104" y="76" text-anchor="middle" style="fill:var(--muted);font-size:11px">opcode: lw</text>
<text x="203" y="57" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-family:var(--mono)">10001</text>
<text x="203" y="76" text-anchor="middle" style="fill:var(--muted);font-size:11px">rs = $s1 (17)</text>
<text x="293" y="57" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-family:var(--mono)">01000</text>
<text x="293" y="76" text-anchor="middle" style="fill:var(--muted);font-size:11px">rt = $t0 (8)</text>
<text x="482" y="57" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-family:var(--mono)">1111 1111 1111 1000</text>
<text x="482" y="76" text-anchor="middle" style="fill:var(--muted);font-size:11px">immediate = −8</text>
<line x1="104" y1="86" x2="104" y2="146" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr2)"/>
<line x1="203" y1="86" x2="270" y2="146" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr2)"/>
<line x1="293" y1="86" x2="330" y2="146" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr2)"/>
<line x1="482" y1="86" x2="535" y2="146" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr2)"/>
<rect x="20" y="150" width="175" height="60" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="107" y="172" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">Control decoder</text>
<text x="107" y="190" text-anchor="middle" style="fill:var(--muted);font-size:11px">ALU adds for the address,</text>
<text x="107" y="203" text-anchor="middle" style="fill:var(--muted);font-size:11px">read memory, write rt</text>
<rect x="215" y="150" width="185" height="60" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="307" y="172" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">Register file</text>
<text x="307" y="190" text-anchor="middle" style="fill:var(--muted);font-size:11px">read port 1: $s1 (the base)</text>
<text x="307" y="203" text-anchor="middle" style="fill:var(--muted);font-size:11px">read port 2: $t0 (not needed)</text>
<rect x="420" y="150" width="240" height="60" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="540" y="172" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">Sign extend</text>
<text x="540" y="190" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0xFFF8 → 0xFFFFFFF8</text>
<text x="540" y="203" text-anchor="middle" style="fill:var(--muted);font-size:11px">(−8 as a 32-bit value)</text>
<text x="340" y="238" text-anchor="middle" style="fill:var(--muted);font-size:11px">All three happen in parallel: the fields sit at fixed bit positions, so nothing waits for decode to finish.</text>
</svg></div>
<p>Notice the register file also reads <code>$t0</code>, because the rt field is always read. For a load, rt is the destination, so that read is wasted: exactly the unneeded read described above. The formats line up so that this works for every instruction type:</p>
<div class="tbl"><table>
<tr><th>Format</th><th>Bits 31–26</th><th>25–21</th><th>20–16</th><th>15–11</th><th>10–6</th><th>5–0</th></tr>
<tr><td>R-type: <code>add $t0, $s1, $s2</code> (<code>0x02324020</code>)</td><td>opcode 000000</td><td>rs = $s1</td><td>rt = $s2</td><td>rd = $t0</td><td>shamt 0</td><td>funct 100000 (add)</td></tr>
<tr><td>I-type: <code>lw $t0, -8($s1)</code> (<code>0x8E28FFF8</code>)</td><td>opcode 100011</td><td>rs = $s1</td><td>rt = $t0</td><td colspan="3">immediate 0xFFF8 (−8)</td></tr>
<tr><td>I-type branch: <code>bne $t1, $zero, loop</code> (<code>0x1520FFFC</code>)</td><td>opcode 000101</td><td>rs = $t1</td><td>rt = $zero</td><td colspan="3">offset 0xFFFC (−4 instructions)</td></tr>
</table></div>
<p>rs and rt are always in bits 25–21 and 20–16, so the register file can start reading before the opcode is decoded. The immediate is always in bits 15–0, so it can be sign-extended speculatively.</p>
<p><strong>Example: what ID does for a branch.</strong> Here's a loop that counts <code>$t1</code> down to zero:</p>
<pre><code>0x1000  loop: lw   $t0, 0($a0)       # load an element
0x1004        addi $a0, $a0, 4       # advance the pointer
0x1008        addi $t1, $t1, -1      # decrement the counter
0x100C        bne  $t1, $zero, loop  # repeat while $t1 != 0
0x1010        ...                     # code after the loop</code></pre>
<p>Say <code>$t1</code> is 3 when the <code>bne</code> at 0x100C reaches ID. IF has already set PC + 4 = 0x1010. In ID, these happen in parallel:</p>
<ol start="0">
<li><strong>Branch comparison:</strong> the register file reads <code>$t1</code> = 3 and <code>$zero</code> = 0, and the comparator checks equality. 3 ≠ 0, so the <code>bne</code> condition is true: the branch is taken.</li>
<li><strong>Sign extension:</strong> the 16-bit offset field is 0xFFFC. Its top bit is 1, so it's negative, and sign extension copies that 1 into the upper 16 bits: <code>0xFFFC → 0xFFFFFFFC</code>, which is −4. (Zero-extending instead would give 0x0000FFFC = +65,532, sending the branch far forward instead of back to the loop.)</li>
<li><strong>Branch target:</strong> MIPS offsets count instructions, not bytes, so the offset is multiplied by 4 (shifted left 2): −4 × 4 = −16 (<code>0xFFFFFFF0</code>). Target = PC + 4 + offset = 0x1010 − 16 = <strong>0x1000</strong>, the <code>loop</code> label. Some ISAs count the offset in bytes and skip the shift.</li>
<li><strong>Early completion (aggressive design):</strong> since the branch is taken, 0x1000 is written into the PC at the end of ID. The instruction already fetched from 0x1010 is squashed, so the taken branch costs 1 cycle instead of 2.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 262" role="img" aria-label="Branch logic in the ID stage. PC plus 4, 0x1010, goes to an adder. The offset 0xFFFC is sign-extended to 0xFFFFFFFC, multiplied by 4 to get 0xFFFFFFF0, and added to give the target 0x1000. Registers $t1 equals 3 and $zero equals 0 go to an equality comparator, which finds them not equal, so bne is taken and the PC is set to 0x1000." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arr3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke:var(--trace);stroke-width:1.5">
<rect x="10" y="24" width="150" height="36" rx="4" style="fill:var(--surface)"/>
<rect x="10" y="90" width="150" height="36" rx="4" style="fill:var(--surface)"/>
<rect x="10" y="165" width="150" height="36" rx="4" style="fill:var(--surface)"/>
<rect x="10" y="215" width="150" height="36" rx="4" style="fill:var(--surface)"/>
<rect x="200" y="86" width="150" height="44" rx="4" style="fill:var(--trace-soft)"/>
<rect x="380" y="86" width="130" height="44" rx="4" style="fill:var(--trace-soft)"/>
<rect x="540" y="20" width="130" height="44" rx="4" style="fill:var(--trace-soft)"/>
<rect x="200" y="180" width="150" height="44" rx="4" style="fill:var(--trace-soft)"/>
<rect x="440" y="180" width="230" height="44" rx="4" style="fill:var(--pad-soft);stroke:var(--pad)"/>
</g>
<text x="85" y="47" text-anchor="middle" style="fill:var(--ink);font-size:12px">PC + 4 = 0x1010</text>
<text x="85" y="113" text-anchor="middle" style="fill:var(--ink);font-size:12px">offset field = 0xFFFC</text>
<text x="85" y="188" text-anchor="middle" style="fill:var(--ink);font-size:12px">rs: $t1 = 3</text>
<text x="85" y="238" text-anchor="middle" style="fill:var(--ink);font-size:12px">rt: $zero = 0</text>
<text x="275" y="104" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Sign extend</text>
<text x="275" y="121" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0xFFFFFFFC (−4)</text>
<text x="445" y="104" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">× 4 (shift left 2)</text>
<text x="445" y="121" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0xFFFFFFF0 (−16)</text>
<text x="605" y="38" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Add</text>
<text x="605" y="55" text-anchor="middle" style="fill:var(--muted);font-size:11px">target = 0x1000</text>
<text x="275" y="198" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Compare: equal?</text>
<text x="275" y="215" text-anchor="middle" style="fill:var(--muted);font-size:11px">3 ≠ 0, so bne is taken</text>
<text x="555" y="198" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Taken: PC ← 0x1000</text>
<text x="555" y="215" text-anchor="middle" style="fill:var(--muted);font-size:11px">at the end of ID (aggressive design)</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M160,42 H538" marker-end="url(#arr3)"/>
<path d="M160,108 H198" marker-end="url(#arr3)"/>
<path d="M350,108 H378" marker-end="url(#arr3)"/>
<path d="M510,108 H590 V66" marker-end="url(#arr3)"/>
<path d="M160,183 H180 V195 H198" marker-end="url(#arr3)"/>
<path d="M160,233 H180 V210 H198" marker-end="url(#arr3)"/>
<path d="M350,202 H438" marker-end="url(#arr3)"/>
<path d="M645,64 V178" marker-end="url(#arr3)"/>
</g>
</svg></div>
<p>If <code>$t1</code> had reached 0 instead, the comparison would find the registers equal, <code>bne</code> would not be taken, the computed target would be ignored, and fetch would simply continue at 0x1010.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Decode the MIPS instruction <code>0x02324020</code>.</p>`,
        a: `<ol start="0"><li>Binary: 000000 10001 10010 01000 00000 100000.</li><li>Opcode 000000 means R-type, so the funct field picks the operation: 100000 is <code>add</code>.</li><li>rs = 10001 = 17 ($s1), rt = 10010 = 18 ($s2), rd = 01000 = 8 ($t0), shamt = 0.</li><li>Result: <strong><code>add $t0, $s1, $s2</code></strong>. In ID, the register file reads $s1 and $s2 while decode works out that it's an add.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>How can the classic pipeline read source registers in the same cycle it decodes the instruction, before it even knows what the instruction is?</p>`,
        a: `<p>RISC encodings put the register specifier fields at the same bit positions in every instruction format (fixed-field decoding), so the register file can be indexed straight from those bits while decode runs in parallel. Some reads turn out to be unneeded. That costs no performance, but it wastes energy, so power-sensitive designs may suppress reads that decode shows aren't needed. ISAs with variable-length or variable-format encodings (like x86) can't do this and need dedicated decode stages first.</p>`
      },
      {
        q: `<p>An aggressive design completes branches at the end of ID instead of EX. What does it need, and what does it gain?</p>`,
        a: `<p>It needs the equality comparator and the branch target adder in ID, so the branch condition and target are known one stage earlier. That cuts the taken-branch penalty from 2 cycles to 1 (the distance from IF to where the branch is resolved shrinks by a stage). The costs: ID's critical path gets longer (register read plus compare), and a branch that depends on the instruction just before it may now need to stall, since that result isn't forwarded to ID until later.</p>`
      }
    ]
  }
},

{
  id: "stage-ex",
  region: "pipe",
  title: "Execution / Effective Address (EX)",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “A Simple Implementation of a RISC Instruction Set”.`,
  body: `
<h3>In the Classic 5-Stage Pipeline</h3>
<p>The ALU works on the operands prepared in ID and does one of three things, depending on the instruction type:</p>
<ul>
<li><strong>Memory reference (load or store):</strong> adds the base register and the offset to form the effective address.</li>
<li><strong>Register-register ALU instruction:</strong> performs the operation given by the ALU opcode on the two values read from the register file.</li>
<li><strong>Register-immediate ALU instruction:</strong> performs the operation on the first register value and the sign-extended immediate.</li>
</ul>
<p>In a load-store architecture, address calculation and execution share one stage, because no instruction ever needs to compute a data address and operate on data at the same time.</p>
<h3>Inside the ALU: An Add, Gate by Gate</h3>
<p>An ALU add is built from <strong>full adders</strong>, one per bit. Each full adder takes one bit from each operand (A and B) plus a carry-in from the bit to its right, and produces a sum bit and a carry-out:</p>
<p class="eq">Sum = A ⊕ B ⊕ C<sub>in</sub></p>
<p class="eq">C<sub>out</sub> = (A · B) + (C<sub>in</sub> · (A ⊕ B))</p>
<p>Here ⊕ is XOR, · is AND, and + is OR. The diagram shows the gates for bit 0 of 5 + 3 (binary 0101 + 0011), where A = 1, B = 1, and the carry-in is 0. Wire values are shown in gold.</p>
<div class="tbl"><svg viewBox="0 0 680 300" role="img" aria-label="Gate-level full adder. A equals 1 and B equals 1 go into an XOR gate, which outputs 0, and an AND gate, which outputs 1. The XOR output and carry-in 0 go into a second XOR gate, giving sum 0, and a second AND gate, giving 0. The two AND outputs go into an OR gate, giving carry-out 1." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M45,50 H150"/><path d="M100,50 V160 H150"/>
<path d="M45,70 H150"/><path d="M115,70 V180 H150"/>
<path d="M45,265 H280 V80 H330"/><path d="M280,180 H330"/>
<path d="M196,60 H330"/><path d="M300,60 V160 H330"/>
<path d="M376,70 H430"/>
<path d="M190,170 H230 V200 H502"/>
<path d="M370,170 H440 V220 H502"/>
<path d="M547,210 H600"/>
</g>
<g style="fill:var(--muted)"><circle cx="100" cy="50" r="3"/><circle cx="115" cy="70" r="3"/><circle cx="280" cy="180" r="3"/><circle cx="300" cy="60" r="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<path d="M150,40 Q165,60 150,80 Q180,80 196,60 Q180,40 150,40 Z"/><path d="M144,40 Q159,60 144,80" style="fill:none"/>
<path d="M330,50 Q345,70 330,90 Q360,90 376,70 Q360,50 330,50 Z"/><path d="M324,50 Q339,70 324,90" style="fill:none"/>
<path d="M150,150 H170 A20,20 0 0 1 170,190 H150 Z"/>
<path d="M330,150 H350 A20,20 0 0 1 350,190 H330 Z"/>
<path d="M502,190 Q517,210 502,230 Q532,230 547,210 Q532,190 502,190 Z"/>
</g>
<text x="12" y="54" style="fill:var(--ink);font-size:13px;font-weight:600">A</text>
<text x="12" y="74" style="fill:var(--ink);font-size:13px;font-weight:600">B</text>
<text x="12" y="269" style="fill:var(--ink);font-size:13px;font-weight:600">C<tspan dy="3" style="font-size:10px">in</tspan></text>
<text x="173" y="30" text-anchor="middle" style="fill:var(--muted);font-size:11px">XOR</text>
<text x="353" y="40" text-anchor="middle" style="fill:var(--muted);font-size:11px">XOR</text>
<text x="168" y="208" text-anchor="middle" style="fill:var(--muted);font-size:11px">AND</text>
<text x="348" y="208" text-anchor="middle" style="fill:var(--muted);font-size:11px">AND</text>
<text x="522" y="248" text-anchor="middle" style="fill:var(--muted);font-size:11px">OR</text>
<g style="fill:var(--pad);font-size:12px;font-weight:600">
<text x="60" y="45">1</text><text x="60" y="65">1</text><text x="60" y="260">0</text>
<text x="215" y="55">0</text><text x="200" y="165">1</text><text x="385" y="165">0</text>
</g>
<text x="436" y="74" style="fill:var(--ink);font-size:13px;font-weight:600">Sum = 0</text>
<text x="606" y="214" style="fill:var(--ink);font-size:13px;font-weight:600">C<tspan dy="3" style="font-size:10px">out</tspan><tspan dy="-3"> = 1</tspan></text>
<text x="215" y="80" style="fill:var(--muted);font-size:10px">A ⊕ B</text>
<text x="196" y="190" style="fill:var(--muted);font-size:10px">A · B</text>
<text x="376" y="190" style="fill:var(--muted);font-size:10px">C<tspan dy="2" style="font-size:8px">in</tspan><tspan dy="-2"> · (A ⊕ B)</tspan></text>
<text x="340" y="292" text-anchor="middle" style="fill:var(--muted);font-size:11px">1 + 1 = binary 10: the sum bit is 0 and a 1 carries into the next bit.</text>
</svg></div>
<p>A 32- or 64-bit adder chains these together: each bit's carry-out becomes the next bit's carry-in. This is a <strong>ripple-carry adder</strong>. Here are all four bits of 5 + 3:</p>
<div class="tbl"><svg viewBox="0 0 680 230" role="img" aria-label="Four full adders chained right to left computing 0101 plus 0011. Bit 0: 1 plus 1 gives sum 0, carry 1. Bit 1: 0 plus 1 plus carry 1 gives sum 0, carry 1. Bit 2: 1 plus 0 plus carry 1 gives sum 0, carry 1. Bit 3: 0 plus 0 plus carry 1 gives sum 1, carry 0. Result 1000, which is 8." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arr4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="70" y="80" width="100" height="64" rx="4"/><rect x="220" y="80" width="100" height="64" rx="4"/><rect x="370" y="80" width="100" height="64" rx="4"/><rect x="520" y="80" width="100" height="64" rx="4"/>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="120" y="108">Full adder</text><text x="270" y="108">Full adder</text><text x="420" y="108">Full adder</text><text x="570" y="108">Full adder</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="120" y="126">bit 3</text><text x="270" y="126">bit 2</text><text x="420" y="126">bit 1</text><text x="570" y="126">bit 0</text></g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M105,36 V78" marker-end="url(#arr4)"/><path d="M135,36 V78" marker-end="url(#arr4)"/>
<path d="M255,36 V78" marker-end="url(#arr4)"/><path d="M285,36 V78" marker-end="url(#arr4)"/>
<path d="M405,36 V78" marker-end="url(#arr4)"/><path d="M435,36 V78" marker-end="url(#arr4)"/>
<path d="M555,36 V78" marker-end="url(#arr4)"/><path d="M585,36 V78" marker-end="url(#arr4)"/>
<path d="M120,144 V180" marker-end="url(#arr4)"/><path d="M270,144 V180" marker-end="url(#arr4)"/><path d="M420,144 V180" marker-end="url(#arr4)"/><path d="M570,144 V180" marker-end="url(#arr4)"/>
<path d="M660,112 H622" marker-end="url(#arr4)"/><path d="M520,112 H472" marker-end="url(#arr4)"/><path d="M370,112 H322" marker-end="url(#arr4)"/><path d="M220,112 H172" marker-end="url(#arr4)"/><path d="M70,112 H30" marker-end="url(#arr4)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="105" y="28">A=0</text><text x="135" y="28">B=0</text>
<text x="255" y="28">A=1</text><text x="285" y="28">B=0</text>
<text x="405" y="28">A=0</text><text x="435" y="28">B=1</text>
<text x="555" y="28">A=1</text><text x="585" y="28">B=1</text></g>
<g style="fill:var(--pad);font-size:12px;font-weight:600" text-anchor="middle">
<text x="645" y="104">0</text><text x="496" y="104">1</text><text x="346" y="104">1</text><text x="196" y="104">1</text><text x="48" y="104">0</text></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="120" y="198">S=1</text><text x="270" y="198">S=0</text><text x="420" y="198">S=0</text><text x="570" y="198">S=0</text></g>
<text x="48" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">C<tspan dy="2" style="font-size:8px">out</tspan></text>
<text x="645" y="130" text-anchor="middle" style="fill:var(--muted);font-size:10px">C<tspan dy="2" style="font-size:8px">in</tspan></text>
<text x="340" y="222" text-anchor="middle" style="fill:var(--muted);font-size:11px">0101 (5) + 0011 (3) = 1000 (8). Carries in gold ripple right to left.</text>
</svg></div>
<p><strong>The timing problem.</strong> Each bit's sum can't settle until its carry-in arrives, and the carry passes through about two gate levels (an AND and an OR) per bit. A 64-bit ripple-carry adder needs on the order of 128 gate delays in the worst case, far too slow for a single-cycle add at high frequency. Real ALUs use <strong>carry-lookahead</strong> or <strong>parallel-prefix</strong> adders (such as Kogge-Stone), which compute all carries in about log<sub>2</sub>(64) = 6 levels by combining "generate" (A · B) and "propagate" (A ⊕ B) signals across groups of bits. That trade costs more gates and wiring (area and power) for a much shorter critical path. See <a href="#/timing">Critical path and flip-flop timing</a>.</p>
<p><strong>The rest of the ALU.</strong> The same adder also subtracts: to compute A − B, the ALU inverts every bit of B and sets the first carry-in to 1, which adds the two's complement of B. Logic operations (AND, OR, XOR) and shifts are computed by separate circuits in parallel, and a multiplexer controlled by the ALU opcode from ID selects which result leaves the stage.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>How does the ALU compute 5 − 3 using the same 4-bit adder?</p>`,
        a: `<ol start="0"><li>Invert every bit of B: 3 = 0011 becomes 1100.</li><li>Set the first carry-in to 1.</li><li>Add: 0101 + 1100 + 1 = 1 0010.</li><li>Drop the carry-out of the top bit: <strong>0010 = 2</strong>. Inverting and adding 1 forms the two's complement of 3, which is −3.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can a load-store architecture compute effective addresses and do ALU operations in the same EX stage?</p>`,
        a: `<p>In a load-store ISA, only loads and stores touch memory, and they don't do arithmetic on the data; ALU instructions don't touch memory. So no instruction needs both an address calculation and a data operation, and one ALU in one stage serves both. An ISA with memory operands (like <code>add r1, [r2+8]</code>) needs an address calculation, a memory read, and an ALU operation in sequence, which takes more stages or cracking into micro-ops.</p>`
      },
      {
        q: `<p>Why don't real 64-bit ALUs use ripple-carry adders, and what does the alternative cost? Each bit of a ripple-carry adder adds about 2 gate delays to the carry path.</p>`,
        a: `<p>A ripple-carry adder's worst case passes a carry through all 64 bits, about 64 × 2 = 128 gate delays, which would set a very long critical path. Parallel-prefix adders compute every carry in about log<sub>2</sub>(64) = 6 combining levels using generate and propagate signals, so the add fits in one short cycle. The cost is many more gates and long wires between bit positions, which means more area and more switching power. Designers sometimes use cheaper, slower adders where timing allows, such as in address generation units with smaller offsets.</p>`
      }
    ]
  }
},

{
  id: "stage-mem",
  region: "pipe",
  title: "Memory Access (MEM)",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “A Simple Implementation of a RISC Instruction Set”.`,
  body: `
<h3>In the Classic 5-Stage Pipeline</h3>
<ul>
<li><strong>Load:</strong> memory is read at the effective address computed in EX.</li>
<li><strong>Store:</strong> the data from the second source register (read in ID) is written to memory at the effective address.</li>
<li>Other instructions pass through this stage without doing anything.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Trace <code>sw $t3, 12($a0)</code> through MEM. Where does each piece of data come from?</p>`,
        a: `<ol start="0"><li>The effective address, <code>$a0</code> + 12, was computed by the ALU in EX.</li><li>The data to store is <code>$t3</code>, read from the register file back in ID (the second source register) and carried down the pipeline.</li><li>In MEM, data memory writes <code>$t3</code> at that address.</li><li>Nothing happens in WB: a store writes no register.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>In the classic 5-stage pipeline with a blocking cache, a load misses in MEM. What happens to the pipeline, and how does an out-of-order core differ?</p>`,
        a: `<p>The whole pipeline freezes: the load can't leave MEM, so the instructions in EX, ID, and IF can't advance either, and the machine stalls for the full miss latency. An out-of-order core keeps executing independent instructions while the miss is outstanding, and with non-blocking caches it can even overlap several misses, so much of the latency is hidden until the reorder buffer fills.</p>`
      }
    ]
  }
},

{
  id: "stage-wb",
  region: "pipe",
  title: "Write-Back (WB)",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “A Simple Implementation of a RISC Instruction Set”.`,
  body: `
<h3>In the Classic 5-Stage Pipeline</h3>
<ul>
<li><strong>Register-register ALU instruction or load:</strong> the result is written into the register file. For a load it comes from the memory system; for an ALU instruction it comes from the ALU.</li>
<li>Stores and branches write no register, so they have nothing to do here.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Which of these do real work in WB: <code>add $t0, $s1, $s2</code>, <code>lw $t1, 0($a0)</code>, <code>sw $t2, 4($a0)</code>, <code>beq $t3, $t4, L</code>?</p>`,
        a: `<ul><li><code>add</code>: <strong>yes</strong>, writes the ALU result to <code>$t0</code>.</li><li><code>lw</code>: <strong>yes</strong>, writes the loaded value to <code>$t1</code>.</li><li><code>sw</code>: no, it writes memory (in MEM), not a register.</li><li><code>beq</code>: no, it only changes the PC.</li></ul>`
      }
    ],
    interview: [
      {
        q: `<p>Why does the classic pipeline write the register file in the first half of the cycle and read it in the second half?</p>`,
        a: `<p>An instruction in WB and an instruction three behind it in ID are in the pipeline at the same time. Writing first lets the ID instruction read the value WB is writing in that same cycle. Without it, that instruction would need one more stall cycle, or another forwarding path. It removes a structural and data hazard for the price of splitting the cycle into two phases, which the fast register file access makes possible.</p>`
      }
    ]
  }
},

{
  id: "pipe-problems",
  region: "pipe",
  title: "Pipeline Problems and Solutions",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.1 Introduction: “The Classic Five-Stage Pipeline for a RISC Processor”.`,
  sections: [{ id: "resources", label: "Resource Conflicts" }, { id: "observations", label: "Three Design Choices" }, { id: "pipe-regs", label: "Pipeline Registers" }],
  body: `
<p>Splitting an instruction into five stages is only the start. Once several instructions overlap, they can get in each other's way. The first job is to check, for every clock cycle, that no two instructions try to use the same piece of hardware for different things at the same time. Later pages handle the other problems overlap creates: data and control hazards.</p>
<h3 id="sec-resources">Resource Conflicts</h3>
<p>A datapath resource can do only one thing per cycle. For example, a single ALU can't compute one instruction's effective address while also doing another instruction's subtraction. So the pipeline must be designed so that overlapping instructions never need the same resource in the same cycle.</p>
<p>A RISC instruction set makes this check fairly easy: every instruction follows the same path, and each major unit is used in exactly one stage. Read down any column of the table below and each resource appears once, because each instruction is in a different stage.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>Cycle 0</th><th>1</th><th>2</th><th>3</th><th style="background:var(--pad-soft)">4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
<tr><td>i</td><td>Instr mem</td><td>Reg read</td><td>ALU</td><td>Data mem</td><td style="background:var(--pad-soft)">Reg write</td><td></td><td></td><td></td><td></td></tr>
<tr><td>i+1</td><td></td><td>Instr mem</td><td>Reg read</td><td>ALU</td><td style="background:var(--pad-soft)">Data mem</td><td>Reg write</td><td></td><td></td><td></td></tr>
<tr><td>i+2</td><td></td><td></td><td>Instr mem</td><td>Reg read</td><td style="background:var(--pad-soft)">ALU</td><td>Data mem</td><td>Reg write</td><td></td><td></td></tr>
<tr><td>i+3</td><td></td><td></td><td></td><td>Instr mem</td><td style="background:var(--pad-soft)">Reg read</td><td>ALU</td><td>Data mem</td><td>Reg write</td><td></td></tr>
<tr><td>i+4</td><td></td><td></td><td></td><td></td><td style="background:var(--pad-soft)">Instr mem</td><td>Reg read</td><td>ALU</td><td>Data mem</td><td>Reg write</td></tr>
</table></div>
<p>In cycle 4 (highlighted), all five instructions are in flight and every resource is busy with exactly one of them. The only resource that appears twice is the register file, which is handled by the second design choice below.</p>
<h3 id="sec-observations">Three Design Choices That Avoid Conflicts</h3>
<p><strong>0. Separate instruction and data memories.</strong> IF reads an instruction every cycle, and MEM may read or write data in the same cycle. With one shared memory, those would collide whenever a load or store reaches MEM. Separate instruction and data caches remove the conflict.</p>
<p>This has a cost: if the pipelined processor runs at the same clock as the unpipelined one, it finishes five times as many instructions per unit time, so the memory system has to supply about five times the bandwidth. Higher performance moves pressure onto memory.</p>
<p><strong>1. The register file is used in two stages.</strong> It is read in ID and written in WB, which are different uses by different instructions, so the diagram below draws it in two places. Every cycle, it must handle two reads (the two source registers of the instruction in ID) and one write (the result of the instruction in WB). When the same register is written and read in one cycle, the write happens in the first half of the cycle and the reads in the second half, so the reader gets the new value. This split also removes one of the data hazards covered later.</p>
<p><strong>2. The PC needs its own hardware.</strong> To start a new instruction every cycle, IF must increment the PC and store it every cycle, so it needs its own adder for PC + 4 rather than borrowing the ALU. ID needs another adder for the branch target. There is still a problem: a branch doesn't update the PC until the end of ID, after the next instruction has already been fetched. That is a control hazard; see <a href="#/branch-hazards">Branch hazards</a>.</p>
<div class="tbl"><svg viewBox="0 0 700 270" role="img" aria-label="Pipelined datapath. IF has the PC, a PC plus 4 adder, and instruction memory. ID has the register file read ports, a sign extender, and a branch target adder. EX has the ALU. MEM has data memory. WB writes back to the register file. Pipeline registers IF/ID, ID/EX, EX/MEM, and MEM/WB sit between the stages." style="width:100%;min-width:600px;max-width:700px;display:block;font-family:var(--sans)">
<defs><marker id="arr5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="75" y="16">IF</text><text x="220" y="16">ID</text><text x="365" y="16">EX</text><text x="510" y="16">MEM</text><text x="645" y="16">WB</text></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="140" y="26" width="14" height="214"/><rect x="285" y="26" width="14" height="214"/><rect x="430" y="26" width="14" height="214"/><rect x="575" y="26" width="14" height="214"/></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="147" y="256">IF/ID</text><text x="292" y="256">ID/EX</text><text x="437" y="256">EX/MEM</text><text x="582" y="256">MEM/WB</text></g>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5">
<rect x="20" y="115" width="36" height="40" rx="3"/><rect x="72" y="95" width="56" height="80" rx="3"/><rect x="72" y="36" width="56" height="32" rx="3"/>
<rect x="172" y="95" width="96" height="80" rx="3"/><rect x="172" y="190" width="96" height="30" rx="3"/><rect x="172" y="36" width="96" height="32" rx="3"/>
<path d="M330,95 L390,115 L390,155 L330,175 L330,145 L342,135 L330,125 Z"/>
<rect x="462" y="95" width="96" height="80" rx="3"/>
<rect x="606" y="95" width="80" height="80" rx="3" style="stroke-dasharray:4 3"/>
</g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle">
<text x="38" y="139">PC</text><text x="100" y="132">Instr</text><text x="100" y="146">memory</text><text x="100" y="56">+4</text>
<text x="220" y="125">Register file</text><text x="220" y="140">2 reads</text><text x="220" y="154" style="fill:var(--muted)">(2nd half of cycle)</text>
<text x="220" y="209">Sign extend</text><text x="220" y="56">Branch target adder</text>
<text x="362" y="139">ALU</text>
<text x="510" y="132">Data</text><text x="510" y="146">memory</text>
<text x="646" y="125">Register file</text><text x="646" y="140">1 write</text><text x="646" y="154" style="fill:var(--muted)">(1st half)</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M56,135 H70" marker-end="url(#arr5)"/>
<path d="M38,115 V52 H70" marker-end="url(#arr5)"/>
<path d="M100,36 V28 H10 V135 H18" marker-end="url(#arr5)"/>
<path d="M128,135 H170" marker-end="url(#arr5)"/>
<path d="M268,135 H328" marker-end="url(#arr5)"/>
<path d="M268,205 H310 V160 H328" marker-end="url(#arr5)"/>
<path d="M390,135 H460" marker-end="url(#arr5)"/>
<path d="M558,135 H604" marker-end="url(#arr5)"/>
</g>
<text x="350" y="232" text-anchor="middle" style="fill:var(--muted);font-size:10px">The dashed register file in WB is the same register file as in ID, drawn twice because it's used in two stages.</text>
</svg></div>
<h3 id="sec-pipe-regs">Pipeline Registers</h3>
<p>Avoiding resource conflicts isn't enough: instructions in different stages must also not interfere with each other's values. If stages were wired directly together, a stage's inputs would change partway through a cycle as the stage before it moved on to the next instruction.</p>
<p>The fix is a <strong>pipeline register</strong> between each pair of stages, named for the stages it connects: IF/ID, ID/EX, EX/MEM, and MEM/WB (the gold bars in the diagram). At the end of every clock cycle, each stage's results are captured in the pipeline register after it, and that register is the next stage's input for the whole following cycle. Each stage therefore works on one instruction's values at a time.</p>
<ul>
<li><strong>They carry everything a later stage needs.</strong> For example, a store's data is read in ID but not used until MEM, so it rides through ID/EX and EX/MEM. The destination register number and the control signals decoded in ID travel the same way.</li>
<li><strong>They cost time.</strong> Their clock-to-Q and setup times are the latch overhead t<sub>o</sub> in the cycle-time formula; see <a href="#/pipelining/depth">Depth: the math</a> and <a href="#/timing">Critical path and flip-flop timing</a>.</li>
<li><strong>They cost power and area.</strong> Every pipeline register is clocked every cycle, so more stages means more flip-flops and more clock power.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p><strong>Setup.</strong> A classic 5-stage pipeline (IF, ID, EX, MEM, WB) runs at 1 GHz with full forwarding. With no stalls, it finishes one instruction per cycle, so the <strong>base CPI is 1 for every instruction type</strong>: each instruction still takes 5 cycles from fetch to write-back, but a new one completes every cycle.</p>
<p>This version has a <strong>single memory with one port</strong> for both instructions and data, so it can do only one access per cycle. The instruction mix:</p>
<ul><li>25% loads; 40% of loads are immediately followed by an instruction that uses the loaded value.</li><li>10% stores.</li><li>15% branches, resolved in ID with predict not-taken; 60% of branches are taken.</li><li>50% ALU instructions.</li></ul>
<p>Assume each stall comes from exactly one cause and stalls don't overlap.</p>
<ol type="a"><li>How many structural stall cycles per instruction does the single memory cause?</li><li>How many load-use stall cycles per instruction?</li><li>How many branch stall cycles per instruction?</li><li>What is the overall CPI, the time per instruction, and the throughput in instructions per second?</li><li>What fraction of all stall cycles comes from the single memory?</li><li>A redesign with separate instruction and data caches removes the structural hazard, but extra wiring makes the clock 5% slower. Which design is faster, and by how much?</li></ol>`,
        a: `<ol type="a">
<li><strong>Structural stalls.</strong> Every load or store uses the memory in MEM during the same cycle that a later instruction needs it for IF, so the fetch waits 1 cycle. Loads + stores = 25% + 10% = 35%, so 0.35 × 1 = <strong>0.35</strong> stall cycles per instruction.</li>
<li><strong>Load-use stalls.</strong> With forwarding, a load followed by a dependent instruction costs 1 cycle: 0.25 × 0.4 × 1 = <strong>0.10</strong>.</li>
<li><strong>Branch stalls.</strong> With predict not-taken and resolution in ID, only taken branches cost 1 cycle: 0.15 × 0.6 × 1 = <strong>0.09</strong>.</li>
<li><strong>Overall.</strong> CPI = base + stalls = 1 + 0.35 + 0.10 + 0.09 = <strong>1.54</strong>. At 1 GHz (1 ns cycle), time per instruction = 1.54 × 1 ns = <strong>1.54 ns</strong>, so throughput = 1 / 1.54 ns ≈ <strong>649 million instructions per second</strong> (versus 1 billion with no stalls).</li>
<li><strong>Share of stalls.</strong> Total stalls = 0.54 cycles per instruction, so the single memory causes 0.35 / 0.54 ≈ <strong>65%</strong> of them.</li>
<li><strong>Split caches.</strong> CPI drops to 1 + 0.10 + 0.09 = 1.19, but the cycle becomes 1.05 ns. Time per instruction = 1.19 × 1.05 ≈ 1.25 ns, versus 1.54 ns. The split-cache design is 1.54 / 1.25 ≈ <strong>1.23× faster</strong>, despite its slower clock. This is why every real pipeline separates instruction and data caches at L1.</li>
</ol>`
      },
      {
        q: `<p>In the resource table on this page, instruction i is fetched in cycle 0 and a new instruction is fetched every cycle. Which instruction uses each resource in cycle 5?</p>`,
        a: `<ul><li>Instruction memory (IF): instruction i+5, the next one to enter.</li><li>Register file read (ID): i+4.</li><li>ALU (EX): i+3.</li><li>Data memory (MEM): i+2.</li><li>Register file write (WB): i+1.</li></ul><p>Each resource still has exactly one user (the register file has one reader and one writer, in different halves of the cycle).</p>`
      }
    ],
    interview: [
      {
        q: `<p>Why does the pipelined processor need about five times the memory bandwidth of the unpipelined one, if both run at the same clock?</p>`,
        a: `<p>An unpipelined (multi-cycle) design at the same clock spends 5 cycles per instruction, so it fetches one instruction, and makes at most one data access, every 5 cycles. The pipeline finishes an instruction every cycle, so it must fetch an instruction every cycle and may also make a data access in the same cycle. Delivering 5× the instructions per unit time requires roughly 5× the bandwidth, plus enough ports or separate caches to serve fetch and data access at once. Higher performance shifts the burden onto the memory system.</p>`
      },
      {
        q: `<p>What does the ID/EX pipeline register need to hold for a <code>sw $t3, 12($a0)</code>?</p>`,
        a: `<ul><li>The value of <code>$a0</code> (the base, for the ALU).</li><li>The sign-extended offset 12 (the ALU's second input).</li><li>The value of <code>$t3</code>: the store data isn't used until MEM, but it must travel with the instruction through ID/EX and EX/MEM.</li><li>Control signals decoded in ID: ALU operation = add, memory write = yes, register write = no.</li></ul><p>The general rule: anything a later stage needs must be carried forward in every pipeline register in between, because the register file and the instruction itself have moved on to other instructions.</p>`
      },
      {
        q: `<p>What would go wrong if the pipeline had no registers between stages?</p>`,
        a: `<p>Each stage's inputs would change mid-cycle as the previous stage started working on the next instruction, so a stage could compute with a mix of values from two different instructions. Pipeline registers capture each stage's results at the clock edge and hold them steady for the whole next cycle, so each stage sees one instruction's values at a time. They are also where the latch overhead in the cycle-time formula comes from.</p>`
      }
    ]
  }
},

{
  id: "stall-perf",
  region: "pipe",
  title: "Performance of Pipelines with Stalls",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.2 The Major Hurdle of Pipelining—Pipeline Hazards: “Performance of Pipelines With Stalls”.`,
  sections: [
    { id: "hazard-basics", label: "Hazards and Their Penalties" },
    { id: "memory-stalls", label: "Memory-System Stalls" },
    { id: "flushes", label: "Flushes and Other Penalties" },
    { id: "adding-stages", label: "How Adding Stages Changes Penalties" }
  ],
  body: `
<p>Stalls are the price of hazards: cycles in which some instructions in the pipeline can't move forward. While an instruction is stalled, every instruction <em>behind</em> it in a simple in-order pipeline stalls too, but instructions ahead of it keep going so the pipeline can drain the problem. No new instructions are fetched during the stall, so it shows up directly as lost throughput.</p>
<h3>Speedup with Stalls</h3>
<p>Start from time per instruction (CPI × clock cycle):</p>
<p class="eq">Speedup = <span class="frac"><span>CPI<sub>unpipelined</sub> × Clock<sub>unpipelined</sub></span><span>CPI<sub>pipelined</sub> × Clock<sub>pipelined</sub></span></span></p>
<p>The ideal pipelined CPI is 1, so stalls simply add to it:</p>
<p class="eq">CPI<sub>pipelined</sub> = 1 + stall cycles per instruction</p>
<p><strong>Case 0: the unpipelined machine is multi-cycle</strong> (same clock, one stage per cycle, so its CPI equals the pipeline depth):</p>
<p class="eq">Speedup = <span class="frac"><span>Pipeline depth</span><span>1 + stall cycles per instruction</span></span></p>
<p><strong>Case 1: the unpipelined machine is single-cycle</strong> (CPI = 1, longer clock). With perfectly balanced stages and no overhead, Clock<sub>unpipelined</sub> / Clock<sub>pipelined</sub> = depth, which gives the same result:</p>
<p class="eq">Speedup = <span class="frac"><span>1</span><span>1 + stall cycles per instruction</span></span> × <span class="frac"><span>Clock<sub>unpipelined</sub></span><span>Clock<sub>pipelined</sub></span></span> ≈ <span class="frac"><span>Pipeline depth</span><span>1 + stall cycles per instruction</span></span></p>
<p>Either way, <strong>with no stalls, speedup equals the depth</strong>, and every average stall cycle per instruction cuts into it. With latch overhead or unbalanced stages, the clock ratio is smaller than the depth, so real speedup is lower still.</p>
<h3>Example</h3>
<p>A 5-stage pipeline averages 0.2 stall cycles per instruction from load-use hazards and 0.1 from branches:</p>
<p class="eq">Speedup = <span class="frac"><span>5</span><span>1 + 0.2 + 0.1</span></span> = <span class="frac"><span>5</span><span>1.3</span></span> ≈ 3.85</p>
<h3 id="sec-hazard-basics">Hazards and Their Penalties</h3>
<p>A hazard is anything that stops the next instruction from proceeding in its planned cycle. Each one adds (frequency per instruction × penalty) to CPI.</p>
<p><strong>Where the penalty comes from.</strong> A stall is set by distance, not by total pipeline depth:</p>
<p class="eq">Stall cycles = (stage where the result becomes available) − (stage where it's needed)</p>
<p>Forwarding shrinks that distance by delivering a result as soon as it's computed instead of after it's written back. For flush-type hazards (mispredicts, ordering violations), the penalty is the number of stages between where the wrong work entered (usually fetch) and where the problem is detected, because all of that work is thrown away.</p>
<p><strong>In-order vs. out-of-order.</strong> In a classic 5-stage in-order pipeline, a stall stops everything behind the stalled instruction, so the full distance is paid. An out-of-order core lets independent instructions run around a stalled one, so latency-type penalties (load-use, FP latency, cache misses) are partly or fully hidden when there is independent work. Flush-type penalties can't be hidden: the wrong-path work is discarded. Out-of-order numbers in the tables on this page and on the <a href="#/structural-hazards/struct-table">structural</a>, <a href="#/data-hazards/reg-table">data</a>, and <a href="#/branch-hazards/control-table">branch</a> hazard pages are typical for modern high-performance cores and vary by design.</p>
<h3 id="sec-memory-stalls">Memory-System Stalls</h3>
<div class="tbl"><table>
<tr><th>Event</th><th>Typical latency</th><th>Classic 5-stage (blocking caches)</th><th>Out-of-order core</th></tr>
<tr><td>L1 miss, L2 hit</td><td>~10–15 cycles</td><td>The whole pipeline stalls for the full latency</td><td>Mostly hidden by independent work</td></tr>
<tr><td>L2 miss, last-level cache hit</td><td>~30–60 cycles</td><td>Full stall</td><td>Partly hidden</td></tr>
<tr><td>Last-level miss to DRAM</td><td>~80–120 ns: hundreds of cycles</td><td>Full stall</td><td>Overlapped with other misses; exposed once the ROB fills</td></tr>
<tr><td>Instruction cache miss</td><td>Like data misses</td><td>Full stall</td><td>Fetch stalls; the back end drains already-fetched work</td></tr>
<tr><td>TLB miss (page walk)</td><td>~20–100+ cycles</td><td>Full stall</td><td>Partly hidden; several walks can overlap</td></tr>
<tr><td>Page fault</td><td>Microseconds (minor) to milliseconds (major)</td><td colspan="2">Not hidden in either: the OS handles it</td></tr>
</table></div>
<h3 id="sec-flushes">Pipeline Flushes and Other Penalties</h3>
<div class="tbl"><table>
<tr><th>Event</th><th>What happens</th><th>Classic 5-stage (in-order)</th><th>Out-of-order core</th></tr>
<tr><td>Exception or interrupt</td><td>Flush, switch to the kernel handler, return</td><td>Flush the few stages behind (up to ~4), plus handler time</td><td>Flush the whole window: dozens to hundreds of cycles, plus handler time</td></tr>
<tr><td>Memory-ordering clear</td><td>Another core wrote a line a speculative load already read</td><td>Doesn't apply: loads aren't speculative</td><td>A full flush</td></tr>
<tr><td>Self-modifying code</td><td>A store hits code that's already in the pipeline</td><td>Flush the few younger stages</td><td>A full flush</td></tr>
<tr><td>Serializing instructions and fences</td><td>The pipeline or store buffer must drain</td><td>Little cost: execution is already in order</td><td>Tens of cycles or more</td></tr>
<tr><td>Microcode assists</td><td>Rare cases (such as denormal FP values on some x86 cores) run microcode</td><td>A multi-cycle stall</td><td>~100+ cycles</td></tr>
</table></div>
<h3 id="sec-adding-stages">How Adding Stages Changes Penalties</h3>
<p>Because a penalty is a distance, adding stages raises it only when the new stages land between the two points involved:</p>
<ul>
<li>A new stage in decode or rename sits between fetch and branch resolution, so it adds 1 cycle to every mispredict, but leaves load-use latency unchanged.</li>
<li>A new stage in the L1 data cache access adds 1 cycle to load-to-use latency, and lengthens mispredicts only for branches that depend on a load.</li>
<li>A new stage after branches resolve, such as an extra writeback or commit stage, changes neither.</li>
</ul>
<p>In time rather than cycles, a hazard costs the logic delay between its two points plus the latch overhead of the stages in between. Splitting that same logic into more stages raises the penalty in cycles, but in nanoseconds it adds only the extra latch overhead.</p>
<p>The next three pages cover where those stall cycles come from: structural hazards, data hazards, and branch hazards.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An unpipelined single-cycle processor has a 10 ns clock. The 5-stage pipelined version has balanced stages plus 0.2 ns of latch overhead per stage. Stalls average 0.25 cycles per instruction. What is the speedup?</p>`,
        a: `<ol start="0"><li>Pipelined clock = 10 / 5 + 0.2 = 2.2 ns.</li><li>Pipelined CPI = 1 + 0.25 = 1.25.</li><li>Unpipelined time per instruction = 1 × 10 = 10 ns. Pipelined = 1.25 × 2.2 = 2.75 ns.</li><li>Speedup = 10 / 2.75 ≈ <strong>3.6×</strong>, versus 5× ideal.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 5-stage pipeline has 20% loads, half of which are followed immediately by a dependent instruction (1 stall each), and 15% branches, of which 60% are taken (1 stall each, predict not-taken). What's the speedup over an unpipelined multi-cycle version at the same clock?</p>`,
        a: `<ol start="0"><li>Load-use stalls per instruction: 0.2 × 0.5 × 1 = 0.10.</li><li>Branch stalls per instruction: 0.15 × 0.6 × 1 = 0.09.</li><li>CPI = 1 + 0.10 + 0.09 = 1.19.</li><li>The multi-cycle version takes 5 cycles per instruction at the same clock, so speedup = 5 / 1.19 ≈ <strong>4.2×</strong>.</li></ol>`
      },
      {
        q: `<p>Even with zero stalls, why is real pipeline speedup below the pipeline depth?</p>`,
        a: `<p>Two reasons from the clock side: stages are never perfectly balanced, so the slowest stage sets the clock, and every stage pays latch overhead (clock-to-Q, setup, skew, jitter). Both make the pipelined clock longer than unpipelined clock ÷ depth. Stalls then reduce speedup further on the CPI side.</p>`
      }
    ]
  }
},

{
  id: "structural-hazards",
  region: "pipe",
  title: "Structural Hazards",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.2 The Major Hurdle of Pipelining—Pipeline Hazards: “Structural Hazards”.`,
  sections: [{ id: "struct-table", label: "Penalty Table" }],
  body: `
<p>A <strong>structural hazard</strong> occurs when the hardware can't support every combination of instructions that overlap in the pipeline: two instructions need the same resource in the same cycle.</p>
<h3>Common Causes</h3>
<ul>
<li><strong>A shared resource:</strong> a single memory for both instructions and data, so a load or store in MEM collides with IF.</li>
<li><strong>A unit that isn't fully pipelined:</strong> an instruction that occupies a unit for several cycles (such as a divider) blocks the next instruction that needs it.</li>
<li><strong>Too few ports:</strong> more register file reads or writes in a cycle than the file supports.</li>
</ul>
<h3>What a Stall Looks Like</h3>
<p>With a single memory port, the load's data access in cycle 4 collides with instruction i+3's fetch. The fetch waits one cycle, leaving a bubble (a cycle where no new instruction enters):</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr>
<tr><td>Load</td><td>IF</td><td>ID</td><td>EX</td><td style="background:var(--pad-soft)"><strong>MEM</strong></td><td>WB</td><td></td><td></td><td></td><td></td></tr>
<tr><td>i+1</td><td></td><td>IF</td><td>ID</td><td>EX</td><td>MEM</td><td>WB</td><td></td><td></td><td></td></tr>
<tr><td>i+2</td><td></td><td></td><td>IF</td><td>ID</td><td>EX</td><td>MEM</td><td>WB</td><td></td><td></td></tr>
<tr><td>i+3</td><td></td><td></td><td></td><td style="background:var(--pad-soft)"><strong>stall</strong></td><td>IF</td><td>ID</td><td>EX</td><td>MEM</td><td>WB</td></tr>
</table></div>
<p>Every later instruction is also pushed back one cycle, so the stall costs a full cycle of throughput.</p>
<h3>Why Designers Sometimes Accept Them</h3>
<p>Eliminating a structural hazard means duplicating or pipelining hardware, which costs area and power and may lengthen the clock. If the conflict is rare, the stalls cost less than the fix. See the guided problem for how to weigh a faster clock against added stalls.</p>
<h3 id="sec-struct-table">Structural Hazards: Not Enough Hardware</h3>
<div class="tbl"><table>
<tr><th>Hazard</th><th>What happens</th><th>Classic 5-stage (in-order)</th><th>Out-of-order core</th><th>Reduced by</th></tr>
<tr><td>Single memory port</td><td>Instructions and data share one memory, so a load or store in MEM blocks fetch</td><td>1 cycle</td><td>Doesn't occur: separate L1 instruction and data caches</td><td>Split instruction and data caches</td></tr>
<tr><td>Execution unit busy</td><td>A multi-cycle operation occupies the unit another instruction needs</td><td>The whole pipeline waits for the unit</td><td>Only instructions needing that unit wait (1+ cycles); others issue to other ports</td><td>More ports, smarter port assignment</td></tr>
<tr><td>Non-pipelined unit busy</td><td>A divide or square root occupies its unit for many cycles</td><td>Everything behind waits: ~10–40 cycles</td><td>Only the next divide waits; independent work continues</td><td>Pipelined or duplicated units</td></tr>
<tr><td>Register file port conflict</td><td>More operand reads or writes than ports</td><td>None: writes happen in the first half of the cycle, reads in the second</td><td>1 cycle when reads exceed ports</td><td>More ports, bypassing, register caches</td></tr>
<tr><td>Cache bank conflict</td><td>Two accesses map to the same bank in one cycle</td><td>Rare: only one memory access per cycle</td><td>1 cycle (one access replays)</td><td>More banks, address hashing, data padding</td></tr>
<tr><td>Writeback conflict</td><td>Units with different latencies finish in the same cycle</td><td>1 cycle, only with multi-cycle units</td><td>1 cycle</td><td>More writeback ports, scheduling around it</td></tr>
<tr><td>Window resource full</td><td>ROB, issue queue, LQ, SQ, physical registers, or MSHRs run out, so dispatch stops</td><td>Doesn't apply: no window</td><td>Until an entry frees: often tens to hundreds of cycles behind a miss</td><td>Larger structures, fewer long-latency stalls</td></tr>
</table></div>
<h3>In Out-of-Order Cores</h3>
<p>Structural conflicts still happen (busy ports, bank conflicts, a full ROB or load queue), but only the instructions that need the busy resource wait; independent instructions issue elsewhere. See <a href="#/structural-hazards/struct-table">the table above</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A pipeline with one memory port stalls 1 cycle for every load or store. 35% of instructions are loads or stores. Without the hazard, CPI would be 1. Dropping the second port lets the clock run 8% faster. Which design is faster?</p>`,
        a: `<ol start="0"><li>With the hazard: CPI = 1 + 0.35 = 1.35, cycle time = T / 1.08. Time per instruction = 1.35 × T / 1.08 = 1.25T.</li><li>Without the hazard: time per instruction = 1 × T = T.</li><li>The design <strong>without</strong> the hazard is <strong>1.25× faster</strong>, despite its slower clock.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>If structural hazards cost performance, why would a designer ever allow one?</p>`,
        a: `<p>Removing it costs area, power, or latency: a second memory port, a duplicated or fully pipelined unit, more register file ports. If the hazard occurs rarely, the stalls cost less than the hardware. Classic examples are a non-pipelined floating-point divider (divides are rare) and limited register file ports in wide cores, where adding ports grows area roughly with the square of the port count. The decision is made by measuring how often the conflict happens on real workloads.</p>`
      },
      {
        q: `<p>Why can a structural hazard sometimes lower total runtime even though it adds stalls? Consider a single memory port that stalls 1 cycle per load or store but lets the clock run 8% faster, with 35% of instructions being loads or stores in one workload and 3% in another. The base CPI is 1.</p>`,
        a: `<p>Because runtime is CPI × cycle time. If removing the resource (or keeping it simpler) shortens the critical path enough, the faster clock can outweigh the stall cycles. It only wins when the hazard is rare: with 35% memory instructions, an 8% faster clock loses (1.35 / 1.08 = 1.25); with 3%, it would win (1.03 / 1.08 ≈ 0.95).</p>`
      }
    ]
  }
},

{
  id: "data-hazards",
  region: "pipe",
  title: "Data Hazards",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.2 The Major Hurdle of Pipelining—Pipeline Hazards: “Data Hazards,” “Minimizing Data Hazard Stalls by Forwarding,” and “Data Hazards Requiring Stalls”.`,
  sections: [
    { id: "forwarding", label: "Forwarding" },
    { id: "load-use", label: "Stalls: Load-Use" },
    { id: "scheduling", label: "Compiler Scheduling" },
    { id: "reg-table", label: "Register Hazard Table" },
    { id: "mem-table", label: "Memory Hazard Table" }
  ],
  body: `
<p>A <strong>data hazard</strong> occurs when overlapping changes the order of reading and writing operands, so an instruction could see a value different from what sequential execution would give.</p>
<h3>Three Kinds</h3>
<ul>
<li><strong>RAW (read after write):</strong> an instruction reads a register before an earlier instruction has written it. This is the common case: a true dependence.</li>
<li><strong>WAW (write after write):</strong> two writes to the same register complete in the wrong order.</li>
<li><strong>WAR (write after read):</strong> a later instruction writes a register before an earlier one has read it.</li>
</ul>
<p>In the classic 5-stage pipeline, only RAW can happen: all reads are in ID and all writes in WB, in order. WAW and WAR appear with multi-cycle units or out-of-order execution.</p>
<h3>The Problem</h3>
<pre><code>add $t0, $s1, $s2   # writes $t0 in WB (cycle 5)
sub $t1, $t0, $s3   # reads $t0 in ID (cycle 3): too early
and $t2, $t0, $s4   # reads in cycle 4: too early
or  $t3, $t0, $s5   # reads in cycle 5: OK (write in first half, read in second)
xor $t4, $t0, $s6   # reads in cycle 6: OK</code></pre>
<p>Without help, <code>sub</code> would have to stall 2 cycles until <code>add</code> writes back.</p>
<h3 id="sec-forwarding">Forwarding</h3>
<p>The value <code>sub</code> needs is computed at the end of <code>add</code>'s EX stage, long before WB. <strong>Forwarding</strong> (also called bypassing) sends results straight from the pipeline registers back to the ALU inputs:</p>
<ul>
<li><strong>EX/MEM → ALU:</strong> the result of the instruction one ahead. <code>sub</code> in cycle 4 gets <code>add</code>'s result this way.</li>
<li><strong>MEM/WB → ALU:</strong> the result of the instruction two ahead. <code>and</code> in cycle 5 gets it this way.</li>
<li><strong>Register file split cycle:</strong> the instruction three ahead is writing in the same cycle, so <code>or</code> reads the new value normally.</li>
</ul>
<div class="tbl"><table>
<tr><th>Instruction</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr>
<tr><td><code>add $t0</code></td><td>IF</td><td>ID</td><td style="background:var(--pad-soft)">EX: result ready</td><td>MEM</td><td>WB</td><td></td><td></td><td></td><td></td></tr>
<tr><td><code>sub</code></td><td></td><td>IF</td><td>ID</td><td style="background:var(--trace-soft)">EX ← EX/MEM</td><td>MEM</td><td>WB</td><td></td><td></td><td></td></tr>
<tr><td><code>and</code></td><td></td><td></td><td>IF</td><td>ID</td><td style="background:var(--trace-soft)">EX ← MEM/WB</td><td>MEM</td><td>WB</td><td></td><td></td></tr>
<tr><td><code>or</code></td><td></td><td></td><td></td><td>IF</td><td style="background:var(--trace-soft)">ID (reads new value)</td><td>EX</td><td>MEM</td><td>WB</td><td></td></tr>
</table></div>
<p><strong>The hardware:</strong> comparators check whether a source register of the instruction in EX matches the destination register of the instruction in EX/MEM or MEM/WB (and that instruction actually writes a register). If so, a multiplexer in front of each ALU input picks the forwarded value instead of the one read in ID. If both match, the more recent result (EX/MEM) wins. Forwarding also feeds the data memory input, so a store can save a value produced just before it.</p>
<div class="prob"><div class="q"><p><strong>Optional: the comparator and multiplexer as logic gates.</strong></p></div>
<details><summary>Show the gate-level diagrams</summary><div class="a">
<p><strong>0. The comparator: is this the register being forwarded?</strong> Register numbers are 5 bits. An XNOR gate outputs 1 when its two inputs are equal, so one XNOR per bit plus an AND of all five outputs tells you whether the two register numbers match. Here the instruction in EX/MEM writes <code>$t0</code> (register 8, binary 01000) and the instruction in EX reads <code>$t0</code> as its rs:</p>
<div class="tbl"><svg viewBox="0 0 680 345" role="img" aria-label="Five XNOR gates compare EX/MEM.rd and ID/EX.rs bit by bit; both are 01000, so every XNOR outputs 1. A five-input AND combines them into equal = 1. A second AND combines equal, RegWrite = 1, and rd not zero = 1, giving forward from EX/MEM = 1." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:var(--muted);font-size:11px">
<text x="10" y="18">EX/MEM.rd bit</text><text x="10" y="31">ID/EX.rs bit</text></g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M110,47 H180"/><path d="M110,63 H180"/>
<path d="M110,97 H180"/><path d="M110,113 H180"/>
<path d="M110,147 H180"/><path d="M110,163 H180"/>
<path d="M110,197 H180"/><path d="M110,213 H180"/>
<path d="M110,247 H180"/><path d="M110,263 H180"/>
<path d="M234,55 H290 V125 H330"/>
<path d="M234,105 H280 V137 H330"/>
<path d="M234,155 H280 V150 H330"/>
<path d="M234,205 H280 V163 H330"/>
<path d="M234,255 H290 V175 H330"/>
<path d="M390,150 H440 V182 H470"/>
<path d="M80,330 H455 V195 H470"/>
<path d="M60,310 H430 V208 H470"/>
<path d="M530,195 H560"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<path d="M180,35 Q195,55 180,75 Q210,75 226,55 Q210,35 180,35 Z"/><path d="M174,35 Q189,55 174,75" style="fill:none"/><circle cx="230" cy="55" r="4"/>
<path d="M180,85 Q195,105 180,125 Q210,125 226,105 Q210,85 180,85 Z"/><path d="M174,85 Q189,105 174,125" style="fill:none"/><circle cx="230" cy="105" r="4"/>
<path d="M180,135 Q195,155 180,175 Q210,175 226,155 Q210,135 180,135 Z"/><path d="M174,135 Q189,155 174,175" style="fill:none"/><circle cx="230" cy="155" r="4"/>
<path d="M180,185 Q195,205 180,225 Q210,225 226,205 Q210,185 180,185 Z"/><path d="M174,185 Q189,205 174,225" style="fill:none"/><circle cx="230" cy="205" r="4"/>
<path d="M180,235 Q195,255 180,275 Q210,275 226,255 Q210,235 180,235 Z"/><path d="M174,235 Q189,255 174,275" style="fill:none"/><circle cx="230" cy="255" r="4"/>
<path d="M330,110 H350 A40,40 0 0 1 350,190 H330 Z"/>
<path d="M470,170 H500 A25,25 0 0 1 500,220 H470 Z"/>
</g>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="51">bit 4</text><text x="10" y="101">bit 3</text><text x="10" y="151">bit 2</text><text x="10" y="201">bit 1</text><text x="10" y="251">bit 0</text></g>
<g style="fill:var(--pad);font-size:11px;font-weight:600">
<text x="120" y="43">0</text><text x="120" y="59">0</text>
<text x="120" y="93">1</text><text x="120" y="109">1</text>
<text x="120" y="143">0</text><text x="120" y="159">0</text>
<text x="120" y="193">0</text><text x="120" y="209">0</text>
<text x="120" y="243">0</text><text x="120" y="259">0</text>
<text x="244" y="51">1</text><text x="244" y="101">1</text><text x="244" y="151">1</text><text x="244" y="201">1</text><text x="244" y="251">1</text>
<text x="400" y="146">1</text><text x="160" y="306">1</text><text x="160" y="326">1</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="203" y="290">XNOR: 1 if bits match</text><text x="360" y="206">AND: all match</text><text x="495" y="236">AND</text></g>
<text x="398" y="140" style="fill:var(--muted);font-size:10px">equal</text>
<g style="fill:var(--ink);font-size:11px"><text x="10" y="314">rd ≠ 0</text><text x="10" y="334">RegWrite</text><text x="190" y="344" style="fill:var(--muted);font-size:10px">(EX/MEM control bit)</text></g>
<text x="566" y="191" style="fill:var(--ink);font-size:12px;font-weight:600">Forward from</text>
<text x="566" y="206" style="fill:var(--ink);font-size:12px;font-weight:600">EX/MEM = 1</text>
</svg></div>
<p>The final AND adds two conditions: the instruction ahead must actually write a register (its RegWrite control bit), and its destination must not be register 0, which always reads as zero. The "rd ≠ 0" signal is itself just an OR of rd's five bits. The forwarding unit has four of these comparators: rs and rt of the instruction in EX, each checked against the destination in EX/MEM and in MEM/WB.</p>
<p><strong>1. The multiplexer: pick the forwarded value.</strong> A 2-to-1 multiplexer outputs input A when the select signal S is 0 and input B when S is 1:</p>
<p class="eq">Out = (A · <span style="text-decoration:overline">S</span>) + (B · S)</p>
<p>Here A is the stale value read from the register file in ID, B is the forwarded value, and S is the comparator's output from above:</p>
<div class="tbl"><svg viewBox="0 0 680 230" role="img" aria-label="One bit of a 2-to-1 multiplexer. S = 1 goes through a NOT gate to give 0, which ANDs with A = 0 to give 0. S = 1 ANDs with B = 1 to give 1. An OR of the two AND outputs gives Out = 1, the forwarded value." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M150,50 H300"/>
<path d="M150,130 H300"/>
<path d="M150,190 H220"/>
<path d="M190,190 V150 H300"/>
<path d="M258,190 H270 V70 H300"/>
<path d="M340,60 H400 V90 H452"/>
<path d="M340,140 H400 V110 H452"/>
<path d="M497,100 H530"/>
</g>
<circle cx="190" cy="190" r="3" style="fill:var(--muted)"/>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<path d="M220,175 L250,190 L220,205 Z"/><circle cx="254" cy="190" r="4"/>
<path d="M300,40 H320 A20,20 0 0 1 320,80 H300 Z"/>
<path d="M300,120 H320 A20,20 0 0 1 320,160 H300 Z"/>
<path d="M452,80 Q467,100 452,120 Q482,120 497,100 Q482,80 452,80 Z"/>
</g>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="46">A: register file</text><text x="10" y="59" style="fill:var(--muted)">(stale value)</text>
<text x="10" y="126">B: forwarded</text><text x="10" y="139" style="fill:var(--muted)">(from EX/MEM)</text>
<text x="10" y="186">S: forward select</text><text x="10" y="199" style="fill:var(--muted)">(comparator output)</text></g>
<g style="fill:var(--pad);font-size:11px;font-weight:600">
<text x="160" y="45">0</text><text x="160" y="125">1</text><text x="160" y="185">1</text><text x="276" y="105">0</text><text x="350" y="55">0</text><text x="350" y="135">1</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="236" y="222">NOT</text><text x="315" y="95">AND</text><text x="315" y="175">AND</text><text x="472" y="138">OR</text></g>
<text x="278" y="64" style="fill:var(--muted);font-size:10px">S̄</text>
<text x="536" y="104" style="fill:var(--ink);font-size:12px;font-weight:600">Out = 1 (forwarded)</text>
</svg></div>
<p>S = 1 blocks the stale register-file bit (its AND gets 0) and passes the forwarded bit. A 32-bit operand uses 32 of these side by side, all sharing the same S.</p>
<p><strong>Putting them together.</strong> Each ALU input really needs a 3-to-1 choice: the register file value, the EX/MEM result, or the MEM/WB result. That's built from two 2-to-1 levels. The first picks between the register file value and MEM/WB using the MEM/WB comparator; the second picks between that result and EX/MEM using the EX/MEM comparator. Because EX/MEM is chosen last, it automatically wins when both match, which gives the most recent value priority.</p>
</div></details></div>
<div class="prob"><div class="q"><p><strong>Optional: rs and rt, and counting the forwarding paths.</strong></p></div>
<details><summary>Show the explanation and diagram</summary><div class="a">
<p><strong>What rs, rt, and rd are.</strong> They are the register fields in a MIPS instruction. rs (bits 25–21) is always a source. rt (bits 20–16) is a second source in some instructions and the destination in others. rd (bits 15–11) is the destination in R-type instructions only.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>rs</th><th>rt</th><th>rd</th></tr>
<tr><td><code>add $t0, $s1, $s2</code></td><td>$s1: first source</td><td>$s2: second source</td><td>$t0: destination</td></tr>
<tr><td><code>lw $t0, 8($s1)</code></td><td>$s1: base address</td><td>$t0: destination</td><td>none</td></tr>
<tr><td><code>sw $t0, 8($s1)</code></td><td>$s1: base address</td><td>$t0: data to store</td><td>none</td></tr>
<tr><td><code>beq $t0, $t1, L</code></td><td>$t0: compared</td><td>$t1: compared</td><td>none</td></tr>
</table></div>
<p>So "rs and rt of the instruction in EX" means its source registers. The forwarding unit compares them with the destination register of the instructions in EX/MEM and MEM/WB.</p>
<p><strong>The forwarding paths in the 5-stage pipeline.</strong> Gold dashed wires are forwarding paths; grey wires are the normal datapath.</p>
<div class="tbl">
<svg viewBox="0 0 700 370" role="img" aria-label="Forwarding paths in the 5-stage pipeline. Paths 1 and 2 carry EX/MEM to the ALU's two input multiplexers. Paths 3 and 4 carry MEM/WB to the same two multiplexers. Path 5 carries MEM/WB to the data memory's write-data input. Paths 6 and 7 carry EX/MEM back to the branch comparator in ID when branches resolve in ID." style="width:100%;min-width:600px;max-width:700px;display:block;font-family:var(--sans)">
<defs><marker id="arr7" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker>
<marker id="arr8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--pad)"/></marker></defs>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle"><text x="75" y="364">ID</text><text x="270" y="364">EX</text><text x="480" y="364">MEM</text><text x="640" y="364">WB</text></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="150" y="40" width="14" height="300"/><rect x="380" y="40" width="14" height="300"/><rect x="560" y="40" width="14" height="300"/></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="157" y="352">ID/EX</text><text x="387" y="352">EX/MEM</text><text x="567" y="352">MEM/WB</text></g>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5">
<rect x="20" y="130" width="100" height="70" rx="3"/>
<rect x="45" y="55" width="50" height="34" rx="3"/>
<path d="M195,95 L215,103 L215,147 L195,155 Z"/>
<path d="M195,185 L215,193 L215,237 L195,245 Z"/>
<path d="M245,110 L305,130 L305,190 L245,210 L245,175 L257,160 L245,145 Z"/>
<rect x="455" y="110" width="90" height="80" rx="3"/>
<path d="M425,240 L441,246 L441,274 L425,280 Z"/>
</g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle">
<text x="70" y="161">Register</text><text x="70" y="175">file</text>
<text x="70" y="76">=</text>
<text x="205" y="88">A</text><text x="205" y="258" style="fill:var(--muted)">B</text>
<text x="275" y="164">ALU</text>
<text x="500" y="146">Data</text><text x="500" y="160">memory</text>
<text x="640" y="155">to register</text><text x="640" y="169">file write</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M120,145 H148" marker-end="url(#arr7)"/><path d="M120,185 H148" marker-end="url(#arr7)"/>
<path d="M164,145 H178 V108 H193" marker-end="url(#arr7)"/>
<path d="M164,185 H178 V198 H193" marker-end="url(#arr7)"/>
<path d="M215,125 H230 V128 H243" marker-end="url(#arr7)"/>
<path d="M215,215 H230 V192 H243" marker-end="url(#arr7)"/>
<path d="M222,215 V300 H378" marker-end="url(#arr7)"/>
<path d="M394,300 H410 V250 H423" marker-end="url(#arr7)"/>
<path d="M441,260 H500 V192" marker-end="url(#arr7)"/>
<path d="M305,160 H378" marker-end="url(#arr7)"/>
<path d="M394,150 H453" marker-end="url(#arr7)"/>
<path d="M545,150 H558" marker-end="url(#arr7)"/>
<path d="M574,160 H600" marker-end="url(#arr7)"/>
<path d="M70,130 V91" marker-end="url(#arr7)"/>
</g>
<g style="fill:none;stroke:var(--pad);stroke-width:1.8;stroke-dasharray:5 3">
<path d="M400,150 V30 H186 V120 H193" marker-end="url(#arr8)"/>
<path d="M406,150 V320 H186 V214 H193" marker-end="url(#arr8)"/>
<path d="M584,160 V22 H172 V135 H193" marker-end="url(#arr8)"/>
<path d="M590,160 V328 H172 V228 H193" marker-end="url(#arr8)"/>
<path d="M596,160 V290 H418 V270 H423" marker-end="url(#arr8)"/>
<path d="M412,150 V14 H62 V53" marker-end="url(#arr8)"/>
<path d="M412,14 H78 V53" marker-end="url(#arr8)"/>
</g>
<g style="fill:var(--muted)"><circle cx="222" cy="215" r="2.5"/><circle cx="400" cy="150" r="2.5"/><circle cx="406" cy="150" r="2.5"/><circle cx="412" cy="150" r="2.5"/><circle cx="584" cy="160" r="2.5"/><circle cx="590" cy="160" r="2.5"/><circle cx="596" cy="160" r="2.5"/></g>
<g style="font-size:10px;font-weight:700" text-anchor="middle">
<circle cx="290" cy="30" r="8" style="fill:var(--pad)"/><text x="290" y="34" style="fill:var(--surface)">1</text>
<circle cx="290" cy="320" r="8" style="fill:var(--pad)"/><text x="290" y="324" style="fill:var(--surface)">2</text>
<circle cx="340" cy="22" r="8" style="fill:var(--pad)"/><text x="340" y="26" style="fill:var(--surface)">3</text>
<circle cx="340" cy="328" r="8" style="fill:var(--pad)"/><text x="340" y="332" style="fill:var(--surface)">4</text>
<circle cx="500" cy="290" r="8" style="fill:var(--pad)"/><text x="500" y="294" style="fill:var(--surface)">5</text>
<circle cx="62" cy="30" r="8" style="fill:var(--pad)"/><text x="62" y="34" style="fill:var(--surface)">6</text>
<circle cx="78" cy="44" r="8" style="fill:var(--pad)"/><text x="78" y="48" style="fill:var(--surface)">7</text>
</g>
</svg>
</div>
<div class="tbl"><table>
<tr><th>#</th><th>From</th><th>To</th><th>Example</th></tr>
<tr><td>1</td><td>EX/MEM</td><td>ALU input A (rs)</td><td><code>add $t0, ...</code> then <code>sub $t1, $t0, $s3</code></td></tr>
<tr><td>2</td><td>EX/MEM</td><td>ALU input B (rt)</td><td><code>add $t0, ...</code> then <code>sub $t1, $s3, $t0</code></td></tr>
<tr><td>3</td><td>MEM/WB</td><td>ALU input A (rs)</td><td>The producer is two instructions ahead, or a load one ahead after its stall</td></tr>
<tr><td>4</td><td>MEM/WB</td><td>ALU input B (rt)</td><td>Same, for the second operand</td></tr>
<tr><td>5</td><td>MEM/WB</td><td>Data memory write data</td><td><code>lw $t0, ...</code> then <code>sw $t0, 0($a1)</code></td></tr>
<tr><td>6, 7</td><td>EX/MEM</td><td>Branch comparator in ID (both inputs)</td><td>Only when branches resolve in ID: a branch comparing a value computed shortly before it</td></tr>
</table></div>
<p>That gives <strong>4</strong> paths to the ALU, <strong>5</strong> with store-data forwarding, and <strong>7</strong> if branches resolve in ID. The output of multiplexer B also travels on to EX/MEM as a store's data, so an <code>add</code> followed by a store of its result uses path 2. The instruction three ahead needs no path, because the register file writes in the first half of the cycle and reads in the second.</p>
<p><strong>How the count scales.</strong> A path is needed from every place a not-yet-written result can sit to every operand input that might need it:</p>
<p class="eq">Paths ≈ (result sources) × (operand inputs) = (W × S) × 2W = 2SW<sup>2</sup></p>
<p>where W is the number of execution units that produce results and S is the number of pipeline stages a result passes through before it's written to the register file (S = 2 in the 5-stage pipeline: EX/MEM and MEM/WB). Each unit has 2 operand inputs. Every path also needs a comparator to decide when to use it, and each operand's multiplexer must choose among 1 + S × W values.</p>
<div class="tbl"><table>
<tr><th>Execution units (W)</th><th>Bypass stages (S)</th><th>Paths ≈ 2SW²</th><th>Inputs per operand mux</th></tr>
<tr><td>1</td><td>2</td><td>4</td><td>3</td></tr>
<tr><td>2</td><td>2</td><td>16</td><td>5</td></tr>
<tr><td>4</td><td>2</td><td>64</td><td>9</td></tr>
<tr><td>4</td><td>3</td><td>96</td><td>13</td></tr>
<tr><td>8</td><td>3</td><td>384</td><td>25</td></tr>
</table></div>
<ul>
<li><strong>More execution units: quadratic growth.</strong> Every new unit's result must reach every unit's inputs, so doubling W quadruples the paths. The units are also physically farther apart, so the wires get longer, and bigger multiplexers add gate levels. The bypass network often ends up on the critical path of back-to-back dependent execution.</li>
<li><strong>More pipeline depth: linear growth.</strong> Deeper pipelines usually add stages between producing a result and writing it to the register file (for example, a separate register-write stage), so S grows and every unit needs another set of paths. Multi-cycle units that finish in different stages add even more source points.</li>
<li><strong>Power, performance, area:</strong> the wires are long and switch whenever results are produced, so the bypass network costs significant energy and routing area, and its delay limits frequency.</li>
<li><strong>How designers contain it:</strong> clustering (full bypass within a group of units and an extra cycle to cross groups, as in the Alpha 21264's two integer clusters), partial bypass (only the common paths; rare cases wait for the register file), separate integer and floating-point networks, and shortening the time to register-file write so S stays small.</li>
</ul>
<p>Out-of-order cores have the same network: wakeup uses tag broadcasts in the scheduler instead of per-stage comparators, but values still flow through the bypass network for back-to-back issue. See <a href="#/scheduler">Scheduler queues</a> and <a href="#/exec-units">Execution units</a>.</p>
</div></details></div>


<h3 id="sec-load-use">Data Hazards That Need a Stall: Load-Use</h3>
<p>A load's value isn't available until the end of MEM, but the next instruction wants it at the start of EX, in the same cycle. Forwarding can't send data backward in time, so the pipeline must stall one cycle. Hardware that detects this and stalls is called a <strong>pipeline interlock</strong>.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
<tr><td><code>lw $t0, 0($a0)</code></td><td>IF</td><td>ID</td><td>EX</td><td style="background:var(--pad-soft)">MEM: data ready</td><td>WB</td><td></td><td></td><td></td></tr>
<tr><td><code>sub $t1, $t0, $s3</code></td><td></td><td>IF</td><td>ID</td><td style="background:var(--pad-soft)"><strong>stall</strong></td><td style="background:var(--trace-soft)">EX ← MEM/WB</td><td>MEM</td><td>WB</td><td></td></tr>
<tr><td>next</td><td></td><td></td><td>IF</td><td style="background:var(--pad-soft)"><strong>stall</strong></td><td>ID</td><td>EX</td><td>MEM</td><td>WB</td></tr>
</table></div>
<p>The interlock is detected in ID: if the instruction in EX is a load whose destination matches a source of the instruction in ID, the PC and IF/ID are held, and a no-op is inserted into ID/EX.</p>
<h3 id="sec-scheduling">Compiler Scheduling</h3>
<p>The compiler can often hide load-use stalls by moving an independent instruction between a load and its use. For <code>x = y + z; w = u − v;</code>:</p>
<div class="tbl"><table>
<tr><th>Naive order (2 stalls)</th><th>Scheduled (0 stalls)</th></tr>
<tr><td><pre><code>lw  $t1, y
lw  $t2, z
add $t3, $t1, $t2  # stall
sw  $t3, x
lw  $t4, u
lw  $t5, v
sub $t6, $t4, $t5  # stall
sw  $t6, w</code></pre></td><td><pre><code>lw  $t1, y
lw  $t2, z
lw  $t4, u
add $t3, $t1, $t2
lw  $t5, v
sw  $t3, x
sub $t6, $t4, $t5
sw  $t6, w</code></pre></td></tr>
</table></div>
<p>In the scheduled version, each loaded value is used at least two instructions later, so forwarding covers it. The cost: it uses more registers (<code>$t4</code> is live longer).</p>
<h3 id="sec-reg-table">Data Hazards Through Registers</h3>
<div class="tbl"><table>
<tr><th>Hazard</th><th>What happens</th><th>Classic 5-stage (in-order)</th><th>Out-of-order core</th><th>Reduced by</th></tr>
<tr><td>RAW, single-cycle ALU</td><td>A consumer needs a result that isn't computed yet: a true dependence</td><td>0 with forwarding (EX to EX); 2 cycles without, waiting for WB</td><td>0: results are bypassed for back-to-back issue</td><td>Forwarding/bypass</td></tr>
<tr><td>RAW, long-latency op</td><td>The producer is a multiply or FP operation that takes several cycles</td><td>Latency − 1 cycles; the whole pipeline waits</td><td>~3–5 cycles for the dependent only; hidden if there is independent work</td><td>Out-of-order execution, compiler scheduling</td></tr>
<tr><td>Load-use</td><td>A RAW on a load's result</td><td>1 cycle: data is ready at the end of MEM, needed at the start of EX</td><td>~4–5 cycles load-to-use for dependents; hidden if there is independent work</td><td>Out-of-order scheduling, compiler scheduling</td></tr>
<tr><td>Write after read (WAR)</td><td>A later instruction overwrites a register an earlier one still needs</td><td>Can't occur: reads in ID always precede later writes in WB</td><td>None: removed by renaming</td><td>Register renaming</td></tr>
<tr><td>Write after write (WAW)</td><td>Two writes to the same register could complete out of order</td><td>Can't occur with a single writeback stage; a stall with multi-cycle units</td><td>None: removed by renaming</td><td>Register renaming, scoreboarding</td></tr>
<tr><td>Speculative wakeup replay</td><td>Dependents were woken assuming a load would hit, but it missed</td><td>Doesn't apply</td><td>A few cycles plus wasted issue slots</td><td>Hit/miss prediction, selective replay</td></tr>
</table></div>
<h3 id="sec-mem-table">Data Hazards Through Memory</h3>
<div class="tbl"><table>
<tr><th>Hazard</th><th>What happens</th><th>Classic 5-stage (in-order)</th><th>Out-of-order core</th><th>Reduced by</th></tr>
<tr><td>Store-to-load forwarding</td><td>A load reads data from an older in-flight store</td><td>Doesn't apply: stores write memory in order in MEM, so later loads see them</td><td>About the same as an L1 hit when it works</td><td>Store queue forwarding</td></tr>
<tr><td>Store-forwarding stall</td><td>The store only partly covers the load (size or alignment mismatch)</td><td>Doesn't apply</td><td>~10–15+ cycles: the load waits for the store to reach the cache</td><td>Matching load and store sizes in code</td></tr>
<tr><td>Unknown store address</td><td>A load must wait for an older store's address</td><td>Doesn't apply: memory operations run in order</td><td>Waits until the address is known, or speculates</td><td>Memory dependence prediction</td></tr>
<tr><td>Memory ordering violation</td><td>A load ran early and an older store turns out to write the same address</td><td>Doesn't apply</td><td>Full flush, like a mispredict: ~15–20+ cycles plus re-execution</td><td>Memory dependence prediction</td></tr>
<tr><td>Cache-line or page split</td><td>A misaligned access spans two lines or two pages</td><td>An extra access: a cycle or more</td><td>An extra access: a few cycles; more for page splits</td><td>Aligned data</td></tr>
</table></div>
<h3>In Out-of-Order Cores</h3>
<p>Renaming removes WAR and WAW; RAW dependences remain, but independent instructions run while a dependent one waits, and load-to-use latency (4–5 cycles) is often hidden. See <a href="#/data-hazards/reg-table">the tables above</a> and <a href="#/renaming">Register renaming</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>With forwarding, how many stall cycles does this code take in the 5-stage pipeline? Which forwarding paths are used?</p><pre><code>lw   $t0, 0($a0)
add  $t1, $t0, $s1
sw   $t1, 4($a0)
lw   $t2, 8($a0)
sw   $t2, 12($a0)</code></pre>`,
        a: `<ol start="0"><li><code>lw</code> → <code>add</code>: load-use hazard. <strong>1 stall</strong>, then MEM/WB forwards <code>$t0</code> to the ALU.</li><li><code>add</code> → <code>sw</code>: <code>$t1</code> is the store's data. The store needs it in MEM, and it's forwarded from the add's result, so no stall.</li><li><code>lw $t2</code> → <code>sw $t2</code>: the store needs <code>$t2</code> only as data in MEM, so it's forwarded from MEM/WB to the data memory input with no stall.</li><li>Total: <strong>1 stall cycle</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Write the condition the ID stage checks to detect a load-use hazard, and say what the pipeline does when it's true.</p>`,
        a: `<p>Stall if the instruction in EX (held in ID/EX) is a load, and its destination register equals either source register of the instruction in ID (held in IF/ID):</p><pre><code>ID/EX.MemRead and
  (ID/EX.rt == IF/ID.rs or ID/EX.rt == IF/ID.rt)</code></pre><p>When true: keep the PC and IF/ID unchanged so the same instructions are fetched and decoded again next cycle, and put a no-op (all control signals zero) into ID/EX. The bubble moves down the pipeline; one cycle later, MEM/WB forwards the loaded value.</p>`
      },
      {
        q: `<p>Why can forwarding remove the stall for ALU-to-ALU dependences but not for load-use?</p>`,
        a: `<p>An ALU result exists at the end of EX, exactly when the next instruction's EX begins, so it can be forwarded without waiting. A load's value exists only at the end of MEM, one cycle after the dependent instruction's EX would start. Forwarding can move data to another stage but can't send it back in time, so one stall is unavoidable unless the compiler moves an independent instruction into that slot.</p>`
      },
      {
        q: `<p>Why can't WAR and WAW hazards occur in the classic 5-stage integer pipeline, and when do they appear?</p>`,
        a: `<p>All register reads happen in ID and all writes in WB, in program order. A later instruction always reads after earlier instructions read (no WAR), and writes reach WB in order (no WAW). They appear when instructions can write at different stages (multi-cycle units with different latencies) or execute out of order; renaming removes them in out-of-order cores.</p>`
      },
      {
        q: `<p>In a classic 5-stage pipeline (IF, ID, EX, MEM, WB), how many stall cycles does this sequence take with full forwarding, if <code>lw</code> is fetched in cycle 0? Without any forwarding (the register file writes in the first half of a cycle and reads in the second half)?</p><pre><code>lw  r1, 0(r2)
add r3, r1, r4
sub r5, r3, r6</code></pre>`,
        a: `<p><strong>With forwarding: 1 stall.</strong> The load's data is ready at the end of MEM (cycle 3), but <code>add</code> wants it at the start of EX in cycle 3, so it waits one cycle (the load-use hazard). <code>sub</code> gets <code>r3</code> forwarded from <code>add</code>'s EX output with no stall.</p><p><strong>Without forwarding: 4 stalls.</strong> <code>lw</code> writes <code>r1</code> in WB (cycle 4), so <code>add</code> can't read it in ID until cycle 4: 2 stalls. <code>add</code> then writes <code>r3</code> in WB (cycle 7), so <code>sub</code> can't decode until cycle 7: 2 more stalls.</p>`
      },
      {
        q: `<p>Timing forces load-to-use latency from 4 to 5 cycles. 30% of instructions are loads, 40% of loads have a dependent instruction right behind them, and out-of-order execution hides 75% of the extra cycle. Base CPI is 0.5. How much faster must the clock get to break even?</p>`,
        a: `<ol start="0"><li>Added CPI = 0.3 × 0.4 × 1 cycle × (1 − 0.75) = 0.03.</li><li>New CPI = 0.53, which is 0.53 / 0.5 = 1.06×, so 6% slower per cycle.</li><li>The clock must get at least <strong>6% faster</strong> to break even.</li></ol>`
      },
      {
        q: `<p>In an in-order pipeline, a 4-cycle FP multiply writes <code>f2</code>, and the very next instruction, a 1-cycle FP move, also writes <code>f2</code>. What can go wrong, and how do designs handle it?</p>`,
        a: `<p><strong>WAW hazard:</strong> the move finishes first, then the multiply overwrites <code>f2</code> with the older value, so later instructions see the wrong result. <strong>Imprecise exceptions:</strong> if the multiply faults after the move has already written, the machine state no longer matches any point in program order.</p><p>Fixes:</p><ul><li>A scoreboard that stalls issue while an older instruction has a pending write to the same register</li><li>Padding all units to the same writeback stage</li><li>In-order commit through a reorder buffer or history buffer</li></ul><p>Out-of-order cores avoid the WAW entirely with register renaming.</p>`
      }
    ]
  }
},

{
  id: "branch-hazards",
  region: "pipe",
  title: "Branch Hazards",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix C.2 The Major Hurdle of Pipelining—Pipeline Hazards: “Branch Hazards,” “Reducing Pipeline Branch Penalties,” “Performance of Branch Schemes,” and “Reducing the Cost of Branches Through Prediction”.`,
  sections: [
    { id: "schemes", label: "Reducing Branch Penalties" },
    { id: "delay-slot", label: "Scheduling the Delay Slot" },
    { id: "branch-perf", label: "Performance of Branch Schemes" },
    { id: "dynamic", label: "Dynamic Prediction" },
    { id: "btb", label: "The BTB and Decode Redirects" },
    { id: "btb-hit", label: "What Happens on a BTB Hit" },
    { id: "control-table", label: "Control Hazard Table" }
  ],
  body: `
<p>A <strong>branch hazard</strong> (control hazard) occurs because the pipeline fetches the next instruction before it knows whether a branch is taken or where it goes. In the classic 5-stage pipeline with branches resolved in ID, a taken branch costs one cycle: the instruction fetched right after it has to be redone at the target.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
<tr><td>Branch (taken)</td><td>IF</td><td style="background:var(--pad-soft)">ID: resolved</td><td>EX</td><td>MEM</td><td>WB</td><td></td><td></td></tr>
<tr><td>Next sequential</td><td></td><td style="background:var(--pad-soft)">IF (wasted)</td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>Branch target</td><td></td><td></td><td>IF</td><td>ID</td><td>EX</td><td>MEM</td><td>WB</td></tr>
</table></div>
<p>One cycle sounds small, but branches are frequent, and the penalty grows with the distance from fetch to where branches resolve.</p>
<h3 id="sec-schemes">Reducing Branch Penalties</h3>
<ul>
<li><strong>Freeze or flush:</strong> stall fetch until the branch resolves. Simple, but every branch pays the penalty.</li>
<li><strong>Predict not taken:</strong> keep fetching sequentially. If the branch turns out taken, turn the fetched instructions into no-ops and fetch the target. Untaken branches cost nothing. The hardware must make sure nothing changes machine state until the branch outcome is known.</li>
<li><strong>Predict taken:</strong> start fetching at the target. It only helps if the target is known before the outcome; in the 5-stage pipeline both are known in ID, so it gains nothing there.</li>
<li><strong>Delayed branch:</strong> the instruction right after the branch (the <em>delay slot</em>) always executes, taken or not. The compiler fills the slot with a useful instruction: ideally one from before the branch (always useful), otherwise one from the target (useful when taken; must be harmless when not) or from the fall-through path (useful when not taken). Some ISAs added canceling branches that nullify the slot instruction if the prediction is wrong. See <a href="#/branch-hazards/delay-slot">Scheduling the branch delay slot</a>.</li>
</ul>
<h3 id="sec-delay-slot">Scheduling the Branch Delay Slot</h3>
<p>With a delayed branch, the instruction right after the branch always executes, whether or not the branch is taken. The compiler's job is to put a useful instruction there; if it can't find a safe one, it fills the slot with a <code>nop</code>, and the slot is wasted. There are three places to take the instruction from:</p>
<div class="tbl"><svg viewBox="0 0 700 330" role="img" aria-label="Three ways to fill a branch delay slot. (a) From before: an independent add before the branch moves into the slot after it. (b) From target: the branch depends on the add, so the sub at the branch target L1 is copied into the slot and the branch now targets L2, the instruction after it. (c) From fall-through: the or after the slot moves into the slot." style="width:100%;min-width:620px;max-width:700px;display:block;font-family:var(--sans)">
<defs><marker id="arr9" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="117.5" y="20" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">(a) From before</text>
<rect x="10" y="34" width="215" height="75" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="18" y="48" style="fill:var(--muted);font-size:10px">Before</text>
<rect x="14" y="52" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1;stroke-dasharray:3 2"/>
<text x="52" y="64" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="52" y="81" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s2, $zero, L1</text>
<text x="52" y="98" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">[delay slot]</text>
<path d="M117.5,115 V139" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr9)"/>
<rect x="10" y="145" width="215" height="58" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="18" y="159" style="fill:var(--muted);font-size:10px">After</text>
<text x="52" y="175" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s2, $zero, L1</text>
<rect x="14" y="180" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="52" y="192" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="349.5" y="20" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">(b) From target</text>
<rect x="242" y="34" width="215" height="109" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="250" y="48" style="fill:var(--muted);font-size:10px">Before</text>
<rect x="246" y="52" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1;stroke-dasharray:3 2"/>
<text x="252" y="64" style="fill:var(--trace);font-size:11px;font-family:var(--mono);font-weight:600">L1:</text>
<text x="284" y="64" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">sub $t4, $t5, $t6</text>
<text x="284" y="81" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">...</text>
<text x="284" y="98" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="284" y="115" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s1, $zero, L1</text>
<text x="284" y="132" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">[delay slot]</text>
<path d="M349.5,149 V173" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr9)"/>
<rect x="242" y="179" width="215" height="109" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="250" y="193" style="fill:var(--muted);font-size:10px">After</text>
<text x="252" y="209" style="fill:var(--trace);font-size:11px;font-family:var(--mono);font-weight:600">L1:</text>
<text x="284" y="209" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">sub $t4, $t5, $t6</text>
<text x="252" y="226" style="fill:var(--trace);font-size:11px;font-family:var(--mono);font-weight:600">L2:</text>
<text x="284" y="226" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">...</text>
<text x="284" y="243" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="284" y="260" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s1, $zero, L2</text>
<rect x="246" y="265" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="284" y="277" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">sub $t4, $t5, $t6</text>
<text x="581.5" y="20" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">(c) From fall-through</text>
<rect x="474" y="34" width="215" height="92" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="482" y="48" style="fill:var(--muted);font-size:10px">Before</text>
<text x="516" y="64" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="516" y="81" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s1, $zero, L1</text>
<text x="516" y="98" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">[delay slot]</text>
<rect x="478" y="103" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1;stroke-dasharray:3 2"/>
<text x="516" y="115" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">or  $t7, $t8, $t9</text>
<path d="M581.5,132 V156" style="fill:none;stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr9)"/>
<rect x="474" y="162" width="215" height="75" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="482" y="176" style="fill:var(--muted);font-size:10px">After</text>
<text x="516" y="192" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">add $s1, $s2, $s3</text>
<text x="516" y="209" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">beq $s1, $zero, L1</text>
<rect x="478" y="214" width="207" height="16" rx="2" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="516" y="226" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">or  $t7, $t8, $t9</text>
<text x="350" y="322" text-anchor="middle" style="fill:var(--muted);font-size:11px">Dashed gold: the instruction chosen. Solid gold: where it ends up, in the delay slot.</text>
</svg></div>
<ul>
<li><strong>(a) From before the branch.</strong> Move an independent instruction from just before the branch into the slot. In the example, the <code>add</code> writes <code>$s1</code>, which the branch doesn't read, so it can move. The instruction does useful work either way, so this always helps and is the first choice. It's impossible when the branch depends on the instruction, as in (b) and (c), where the branch tests the <code>$s1</code> that the <code>add</code> computes.</li>
<li><strong>(b) From the branch target.</strong> Copy the instruction at the target into the slot, and change the branch to jump to the instruction after it (<code>L2</code>). It's copied rather than moved because other code may also jump to <code>L1</code>. If the branch isn't taken, the copied instruction still executes, so it must be harmless on the fall-through path: here, <code>$t4</code> must not be needed there. This helps when the branch is taken, so it suits branches that are usually taken, such as loop back-edges.</li>
<li><strong>(c) From the fall-through path.</strong> Move the instruction that would follow the branch into the slot. If the branch is taken, that instruction still executes, so it must be harmless at the target: here, <code>$t7</code> must not be needed after <code>L1</code>. This helps when the branch is usually not taken.</li>
</ul>
<div class="tbl"><table>
<tr><th>Strategy</th><th>Requirement</th><th>Helps when</th></tr>
<tr><td>(a) From before</td><td>The branch must not depend on the moved instruction</td><td>Always</td></tr>
<tr><td>(b) From target</td><td>Must be safe to execute if the branch is not taken; may need a copy</td><td>The branch is taken</td></tr>
<tr><td>(c) From fall-through</td><td>Must be safe to execute if the branch is taken</td><td>The branch is not taken</td></tr>
</table></div>
<p><strong>Limits.</strong> Strategies (b) and (c) depend on the compiler guessing the branch direction, and their safety requirements often rule out every candidate. <strong>Canceling (nullifying) branches</strong> relax this: the branch carries a predicted direction, and if the prediction is wrong, the slot instruction is turned into a no-op. Then a (b)- or (c)-style instruction no longer has to be harmless on the other path; a wrong guess just wastes the slot, like a nop.</p>
<p>Delay slots stopped making sense as pipelines got deeper and wider: one slot hides only one cycle of a 10–20 cycle penalty, and a core fetching several instructions per cycle would need several slots. Dynamic branch prediction handles the problem without baking the pipeline's structure into the ISA.</p>
<h3 id="sec-branch-perf">Performance of Branch Schemes</h3>
<p class="eq">Pipeline speedup = <span class="frac"><span>Pipeline depth</span><span>1 + branch frequency × branch penalty</span></span></p>
<p>With several kinds of branches, sum each kind's frequency × penalty to get the stall cycles per instruction. The interview problem below works this out for a deeper pipeline where stalling, predict taken, and predict not-taken all give different penalties.</p>
<h3 id="sec-dynamic">Dynamic Prediction</h3>
<p>Static schemes use the same guess for every branch. A <strong>branch-prediction buffer</strong> (branch history table) instead keeps a small amount of history per branch, indexed by low-order bits of the branch's address.</p>
<ul>
<li><strong>1-bit:</strong> remember the last outcome. A loop branch mispredicts twice per loop run: at the exit, and again on the first iteration next time.</li>
<li><strong>2-bit saturating counter:</strong> the prediction flips only after two mispredictions in a row, so a single unusual outcome (like a loop exit) doesn't change it.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 200" role="img" aria-label="Two-bit predictor state machine with four states in a row: strongly taken, weakly taken, weakly not taken, strongly not taken. A taken outcome moves one state toward strongly taken; a not-taken outcome moves one state toward strongly not taken. The first two states predict taken, the last two predict not taken." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arr6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<rect x="10" y="20" width="320" height="140" rx="6" style="fill:var(--trace-soft);stroke:none"/>
<rect x="350" y="20" width="320" height="140" rx="6" style="fill:var(--pad-soft);stroke:none"/>
<text x="170" y="40" text-anchor="middle" style="fill:var(--trace);font-size:12px;font-weight:600">Predict taken</text>
<text x="510" y="40" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">Predict not taken</text>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"><circle cx="90" cy="100" r="40"/><circle cx="250" cy="100" r="40"/><circle cx="430" cy="100" r="40"/><circle cx="590" cy="100" r="40"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle">
<text x="90" y="96">Strongly</text><text x="90" y="110">taken (11)</text>
<text x="250" y="96">Weakly</text><text x="250" y="110">taken (10)</text>
<text x="430" y="96">Weakly not</text><text x="430" y="110">taken (01)</text>
<text x="590" y="96">Strongly not</text><text x="590" y="110">taken (00)</text></g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M122,78 Q170,58 218,78" marker-end="url(#arr6)"/>
<path d="M218,122 Q170,142 122,122" marker-end="url(#arr6)"/>
<path d="M282,78 Q340,58 398,78" marker-end="url(#arr6)"/>
<path d="M398,122 Q340,142 282,122" marker-end="url(#arr6)"/>
<path d="M462,78 Q510,58 558,78" marker-end="url(#arr6)"/>
<path d="M558,122 Q510,142 462,122" marker-end="url(#arr6)"/>
<path d="M60,128 Q40,175 75,140" marker-end="url(#arr6)"/>
<path d="M620,128 Q640,175 605,140" marker-end="url(#arr6)"/>
</g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="170" y="60">NT</text><text x="170" y="150">T</text><text x="340" y="60">NT</text><text x="340" y="150">T</text><text x="510" y="60">NT</text><text x="510" y="150">T</text>
<text x="30" y="172">T</text><text x="650" y="172">NT</text></g>
<text x="340" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px">T = branch taken, NT = not taken. Each outcome moves the counter one step.</text>
</svg></div>
<p>A buffer can mispredict because of a wrong guess or because two branches share an entry (aliasing), since only some address bits index it. Larger buffers help little past a few thousand entries; better accuracy comes from using the history of other branches (correlating and tournament predictors, and modern TAGE-style predictors).</p>
<h3 id="sec-btb">The BTB and Decode Redirects</h3>
<p>Real pipelines don't wait until ID to learn about branches. A <strong>branch target buffer (BTB)</strong> is a small cache, indexed by the fetch PC, that remembers where branches are and where they went.</p>
<p><strong>When it's probed: in instruction fetch.</strong> Each cycle, the BTB is looked up with the PC of the block being fetched, at the same time as the instruction cache is read. That timing is the point of a BTB: it predicts the next PC <em>before</em> the hardware even knows the block contains a branch.</p>
<ul>
<li><strong>BTB hit:</strong> the BTB says “there's a branch here, and its target is X.” Combined with the direction predictor, fetch can redirect to X on the very next cycle, with no decode needed.</li>
<li><strong>BTB miss:</strong> fetch assumes there's no taken branch and continues sequentially. If there really was a taken branch, it's discovered only in decode.</li>
</ul>
<p><strong>A BTB miss, cycle by cycle:</strong></p>
<ol start="0">
<li><strong>Cycle 0:</strong> fetch group A is fetched, and the BTB misses, so fetch continues sequentially.</li>
<li><strong>Cycle 1:</strong> group A is in decode, and group B (the next sequential block) is in fetch. Decode finds a branch in A.</li>
<li>If the branch is an unconditional direct jump, or a conditional branch predicted taken, decode computes the target and redirects fetch. Group B is flushed, along with any instructions after the branch within group A. If the branch is predicted not taken, the sequential instructions were the right ones, and nothing is flushed.</li>
<li><strong>Cycle 2:</strong> fetch starts at the branch target. Cycle 1's fetch was wasted: that's the bubble.</li>
</ol>
<p>In a deeper front end with several fetch stages before decode, more groups are in flight when decode redirects, so the BTB-miss penalty is several cycles rather than one.</p>
<p><strong>How decode knows the target depends on the kind of branch:</strong></p>
<div class="tbl"><table>
<tr><th>Kind of branch</th><th>Target</th><th>Can decode redirect?</th></tr>
<tr><td>Direct jump (unconditional)</td><td>PC-relative: the branch's PC plus the offset encoded in the instruction (the PC is implicit, not an operand)</td><td>Yes, always</td></tr>
<tr><td>Conditional branch</td><td>PC-relative, so the target is known; the <em>direction</em> isn't, since the condition needs register values</td><td>Only if the direction predictor says taken</td></tr>
<tr><td>Indirect jump or return</td><td>Base + offset: comes from a register value, which decode doesn't have yet</td><td>Generally no; the target is predicted instead by the BTB, an indirect target predictor, or (for returns) a return-address stack, and checked once the register value is known</td></tr>
</table></div>
<p>For branches, the computed address is called the <strong>branch target</strong>; “effective address” is the term for a load's or store's memory address.</p>
<p><strong>Resolution and mispredicts.</strong> A conditional branch is resolved when its condition is evaluated, typically in execute. A mispredict in <em>either</em> direction flushes everything fetched after the branch on the wrong path: predicted taken but actually not taken means refetching the fall-through instructions; predicted not taken but actually taken means fetching from the target. That full mispredict penalty is much larger than the decode-redirect bubble. A mispredict doesn't flush the whole pipeline: instructions <em>older</em> than the branch are still valid and keep going; only the instructions fetched after the branch on the wrong path are flushed.</p>
<p><strong>In one paragraph:</strong> on a BTB miss, fetch continues sequentially and decode discovers the branch a cycle later. For an unconditional direct jump, decode adds the offset encoded in the instruction to the branch's own PC to get the branch target, flushes the sequentially fetched instructions, and restarts fetch at the target. For a conditional branch, decode can compute the target the same way but doesn't know the condition, so it follows the direction predictor: if predicted taken, it flushes the sequential instructions and redirects to the target; if predicted not taken, fetch continues. When the condition is evaluated later in the pipeline, a mispredict in either direction flushes the wrong-path instructions and fetch restarts on the correct path. Indirect jumps take their target from a register that decode doesn't have yet, so the front end predicts the target and checks it later.</p>
<h3 id="sec-btb-hit">What Happens on a BTB Hit</h3>
<p>Usually little or no stall, but a hit doesn't guarantee a free ride.</p>
<ul>
<li><strong>Best case, no bubble:</strong> if the BTB answers in the same cycle it's probed, fetch redirects to the target on the very next cycle. The only cost is fetch bandwidth: the slots after the branch in that fetch block are thrown away, because the instructions after a taken branch aren't on the path.</li>
<li><strong>A small bubble if the lookup is slow:</strong> large BTBs can't answer in one cycle. If the hit comes from a bigger second-level BTB that takes two cycles, fetch has already started on the next sequential block, which is discarded: a one- or two-cycle bubble. That's why cores keep a tiny, fast first-level BTB for the hottest branches.</li>
</ul>
<p><strong>A hit can still be wrong,</strong> and then a penalty is paid after all:</p>
<ul>
<li><strong>Wrong direction:</strong> the BTB says <em>where</em> a branch goes; the direction predictor says <em>whether</em> it goes. If a conditional branch was predicted taken but isn't (or the reverse), it's caught at execute: the full mispredict penalty.</li>
<li><strong>Wrong target:</strong> an indirect jump whose target changed (such as a virtual function call made through different objects) gets a stale target from the BTB. Its real target comes from a register, so the error is caught at execute: the full mispredict penalty.</li>
<li><strong>Aliasing:</strong> BTBs often store only part of the address tag to save space, so occasionally an entry belongs to a <em>different</em> branch. For a direct branch, decode notices the computed target doesn't match and redirects early (a small bubble); otherwise the error is caught later.</li>
</ul>
<p><strong>A stall unrelated to prediction:</strong> even with a perfect prediction, if the target's code isn't in the instruction cache, fetch stalls on the miss. Decoupled front ends, where the predictor runs ahead and prefetches target blocks, exist largely to hide this.</p>
<div class="tbl"><table>
<tr><th>Situation</th><th>Cost</th></tr>
<tr><td>BTB hit, fast lookup, correct prediction</td><td>No bubble; only the slots after the branch in its fetch block are lost</td></tr>
<tr><td>BTB hit from a slower second-level BTB</td><td>1–2 cycle bubble</td></tr>
<tr><td>BTB hit, direct branch with a wrong (aliased) target</td><td>Decode redirect: a small bubble</td></tr>
<tr><td>BTB hit, wrong direction or wrong indirect target</td><td>Full mispredict penalty</td></tr>
<tr><td>Target not in the instruction cache</td><td>Instruction cache miss stall</td></tr>
</table></div>
<p><strong>Decoupled front ends.</strong> Many high-performance cores run the branch predictor and BTB <em>ahead</em> of instruction cache fetch, producing a queue of predicted fetch addresses that the instruction cache works through, and that can also drive instruction prefetching. The classic 5-stage pipeline has no BTB at all, which is why it computes branch targets in ID.</p>
<h3 id="sec-control-table">Control Hazards</h3>
<div class="tbl"><table>
<tr><th>Hazard</th><th>What happens</th><th>Classic 5-stage (in-order)</th><th>Out-of-order core</th><th>Reduced by</th></tr>
<tr><td>Conditional branch mispredict</td><td>Wrong direction predicted; everything fetched after it is flushed</td><td>2 cycles if resolved in EX, 1 if resolved in ID</td><td>Fetch-to-resolve distance: ~10–20 cycles; can't be hidden</td><td>Better predictors, resolving earlier, branchless code</td></tr>
<tr><td>Indirect target mispredict</td><td>Wrong target for a jump through a register (virtual calls, switch tables, interpreters)</td><td>Same as a branch mispredict</td><td>Same as a full mispredict</td><td>Indirect target predictors</td></tr>
<tr><td>Return mispredict</td><td>The return address stack overflows or is corrupted</td><td>Same as a branch mispredict</td><td>Same as a full mispredict</td><td>Deeper return stacks</td></tr>
<tr><td>BTB miss on a taken branch</td><td>Fetch didn't know a branch was there and kept going sequentially</td><td>Covered by the branch rows (usually no BTB)</td><td>A few cycles: decode catches it and redirects</td><td>Larger BTBs</td></tr>
<tr><td>Taken-branch bubble</td><td>Even a correct prediction takes time to redirect fetch</td><td>1 cycle if the target is computed in ID</td><td>0–2 cycles per taken branch</td><td>Faster first-level predictors, loop buffers</td></tr>
</table></div>
<h3>In Out-of-Order Cores</h3>
<p>Branches resolve 10–20 cycles after fetch, and a wide core loses width × penalty instruction slots per mispredict, so accurate dynamic prediction is essential. Delay slots don't help at those depths. See <a href="#/branch-hazards/control-table">the table above</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A loop branch is taken 9 times, then not taken once, and the loop runs many times. What accuracy does a 1-bit predictor get on it? A 2-bit predictor?</p>`,
        a: `<ol start="0"><li><strong>1-bit:</strong> it mispredicts the final not-taken exit, which flips it to "not taken," so it also mispredicts the first branch of the next run. 2 misses per 10: <strong>80%</strong>.</li><li><strong>2-bit:</strong> the single not-taken exit moves it from strongly taken to weakly taken, still predicting taken, so the next run's first branch is correct. 1 miss per 10: <strong>90%</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A deeper pipeline learns branch targets at the end of stage 2 and branch outcomes at the end of stage 3, counting fetch as stage 0. The base CPI is 1. 4% of instructions are unconditional branches, 6% are untaken conditional branches, and 10% are taken conditional branches. Compare CPI added by stalling, predict taken, and predict not-taken.</p>`,
        a: `<p>Penalties (cycles): unconditional = 2 (until the target is known) in every scheme. Stall: 3 for any conditional branch. Predict taken: 2 if taken (wait for target), 3 if not taken (wrong). Predict not-taken: 0 if not taken, 3 if taken.</p><ul><li><strong>Stall:</strong> 0.04×2 + 0.06×3 + 0.10×3 = <strong>0.56</strong></li><li><strong>Predict taken:</strong> 0.04×2 + 0.06×3 + 0.10×2 = <strong>0.46</strong></li><li><strong>Predict not-taken:</strong> 0.04×2 + 0.06×0 + 0.10×3 = <strong>0.38</strong></li></ul><p>Predict not-taken is best here: 1.56 / 1.38 ≈ 1.13× faster than stalling.</p>`
      },
      {
        q: `<p>Why did branch delay slots disappear from modern ISAs?</p>`,
        a: `<p>A delay slot hard-codes one pipeline's branch penalty into the ISA. Deeper and superscalar pipelines have penalties of many cycles and fetch several instructions per cycle, so one slot hides almost nothing, but every future implementation must still support it, which complicates exceptions and decode. Dynamic branch prediction hides the penalty better without exposing the pipeline. MIPS and SPARC had delay slots; RISC-V and ARMv8 don't.</p>`
      },
      {
        q: `<p>A 5-stage pipeline resolves branches in EX (2-cycle penalty) and predicts not-taken. 20% of instructions are branches and 60% of branches are taken. What's the CPI? If you move branch resolution to ID (1-cycle penalty), but the extra comparator lengthens the cycle by 5%, is it worth it?</p>`,
        a: `<ol start="0"><li>Predict not-taken means every taken branch pays the penalty. CPI = 1 + 0.2 × 0.6 × 2 = <strong>1.24</strong>.</li><li>Resolving in ID: CPI = 1 + 0.2 × 0.6 × 1 = <strong>1.12</strong>.</li><li>Relative time: 1.12 × 1.05 = 1.176 versus 1.24, so it's about <strong>5% faster</strong> despite the slower clock.</li></ol>`
      },
      {
        q: `<p>A workload's CPI stack is base 0.4, branch mispredicts 0.3, memory stalls 0.5. A new branch predictor halves mispredicts but needs an extra pipeline stage, raising the mispredict penalty from 15 to 16 cycles. The frequency doesn't change. What's the speedup?</p>`,
        a: `<ol start="0"><li>New branch component: 0.3 × 0.5 (half the mispredicts) × 16/15 (bigger penalty) = 0.16.</li><li>New CPI = 0.4 + 0.16 + 0.5 = 1.06, versus 1.2 before.</li><li>Speedup = 1.2 / 1.06 ≈ <strong>1.13×</strong>.</li></ol><p>In an interview, add that the extra stage may also lengthen other front-end penalties, such as BTB-miss redirects, so check those too.</p>`
      },
      {
        q: `<p>A 4-wide core takes 20 cycles to resolve a mispredicted branch and has 10 mispredicts per 1000 instructions. Roughly how much front-end work is wasted?</p>`,
        a: `<p>Each mispredict can fetch and decode up to width × resolution time = 4 × 20 = <strong>80 wrong-path instructions</strong>. At 10 per 1000 instructions, that's up to 800 wasted instructions per 1000 useful ones, so fetch, decode, and rename could do nearly twice the work they need to. That is an upper bound (the front end doesn't always run at full width), but it shows why branch prediction is an energy problem, not just a performance one, and why the cost grows with both depth and width.</p>`
      },
      {
        q: `<p>Two cores have the same 5 mispredicts per 1000 instructions and a 15-cycle penalty. One is 4-wide with a base CPI of 0.5, and the other is 8-wide with a base CPI of 0.25. How much does branch misprediction slow each one down?</p>`,
        a: `<ol start="0"><li>Mispredict CPI = 5 / 1000 × 15 = 0.075 for both.</li><li>4-wide: 0.5 → 0.575, a <strong>15%</strong> slowdown.</li><li>8-wide: 0.25 → 0.325, a <strong>30%</strong> slowdown.</li></ol><p>The same mispredict rate hurts a faster core twice as much in relative terms, because each mispredict throws away more issue slots (width × penalty). That's why wider and deeper cores need much better branch predictors.</p>`
      }
    ]
  }
}
]);
