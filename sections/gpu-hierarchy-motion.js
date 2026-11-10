/* Section: GPU Hierarchy in Motion
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gvis").
   The animations themselves live in js/visual.js. */

section({
  id: "gvis",
  name: "GPU Hierarchy in Motion",
  cap: "Threads, warps, blocks, and SMs side by side, with step-through and cycle-by-cycle animations",
  sections: [
    { id: "why", label: "Why Pictures" },
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>The other GPU regions name each level of the hierarchy in turn. This one puts them in one place and animates them, so you can watch a launch spread over the chip and then follow a single sub-partition one cycle at a time.</p>
<h3 id="sec-why">Why Pictures</h3>
<ul>
<li><strong>Two hierarchies at once:</strong> grids, blocks, warps, and threads are software names, while GPUs, SMs, sub-partitions, and lanes are hardware. Most confusion comes from mixing the two, and a picture keeps them apart.</li>
<li><strong>Time matters:</strong> latency hiding and divergence are about what happens on each cycle, which is easier to watch than to read about.</li>
</ul>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/gpu-visual">Threads, Warps, Blocks, and SMs Side by Side</a>: a comparison table, a launch walked down to the lanes, and cycle-level timelines of warp switching and an if/else.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>An RTX 4090 has 128 SMs, each with 4 sub-partitions. Each sub-partition issues 1 warp instruction per cycle and has 32 FP32 lanes, and the boost clock is 2.52 GHz. How many threads can start an FP32 operation per cycle across the GPU, and what peak FP32 rate follows if every one is an FFMA?</p>`,
        a: `<ol><li>Threads per cycle = 128 SMs × 4 sub-partitions/SM × 32 threads/sub-partition = <strong>16,384 threads/cycle</strong>.</li><li>An FFMA is a multiply and an add, 2 FLOPs/thread.</li><li>Peak = 16,384 threads/cycle × 2 FLOPs/thread × 2.52 × 10<sup>9</sup> cycles/s ≈ <strong>82.6 TFLOP/s</strong>, which matches NVIDIA's spec.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An RTX 4090 SM issues at most 4 warp instructions per cycle (1 per sub-partition) but keeps up to 48 warps resident (12 per sub-partition). Why hold so many warps that can't issue? Assume a dependent FFMA must wait 4 cycles for its input and a global load that misses to DRAM takes about 600 cycles.</p>`,
        a: `<p>Resident warps are how a GPU hides latency, in place of the out-of-order window a CPU uses. A sub-partition issues in order within each warp, so a warp whose next instruction waits on a result can't issue, and the scheduler needs another warp that can.</p><ul><li>For a chain of dependent FFMAs, each warp can issue only once every 4 cycles, so 4 cycles / 1 issue per warp = 4 warps per sub-partition keep the slot busy.</li><li>For a 600-cycle load, a warp sits idle for about 600 cycles after it needs the data. If each warp has, say, 20 instructions of independent work per load, covering the gap takes about 600 cycles / 20 instructions per warp = 30 warps, more than the 12 available. Real kernels close the rest of the gap with ILP: several loads in flight per warp before any is used.</li></ul><p>So 12 warps per sub-partition is a buffer of latency-hiding parallelism, not something to issue all at once.</p>`
      }
    ]
  }
}, [
{
  id: "gpu-visual",
  region: "gvis",
  title: "Threads, Warps, Blocks, and SMs Side by Side",
  sections: [
    { id: "compare", label: "The Levels Compared" },
    { id: "journey", label: "From Grid to Lanes" },
    { id: "subpartition", label: "Inside One Sub-Partition" },
    { id: "switching", label: "Warp Switching, Cycle by Cycle" },
    { id: "divergence", label: "An If/Else Splits a Warp" }
  ],
  body: `
<p>A CUDA program is described in software terms (thread, warp, block, grid) and runs on hardware with its own levels (lane, sub-partition, SM, GPU). This page puts the two side by side for an H100 (SM90), walks a launch down from the grid to single lanes, and then steps one sub-partition through two short kernels a cycle at a time. For the details behind each level, see <a href="#/gpu-launch">Grids, Blocks, and Threads</a>, <a href="#/cuda-cores">What a CUDA Core Is</a>, and <a href="#/warp-sched">Warp Scheduling and Latency Hiding</a>.</p>
<h3 id="sec-compare">The Levels Compared</h3>
<p>The software levels, smallest first:</p>
<div class="tbl"><table>
<tr><th>Level</th><th>What it is</th><th>Size on H100</th><th>Runs on</th><th>Shares</th><th>Scheduled by</th><th>Closest CPU idea</th></tr>
<tr><td>Thread</td><td>One run of the kernel, with its own registers</td><td>Up to 255 registers of 32 bits</td><td>One lane per instruction</td><td>Nothing but its own registers</td><td>Never alone: it issues with its warp</td><td>One element of a SIMD vector, not a CPU thread</td></tr>
<tr><td>Warp</td><td>32 threads that issue each instruction together</td><td>32 threads, up to 16 warps per sub-partition</td><td>One sub-partition, for life</td><td>One instruction stream, with an active mask choosing which threads take part</td><td>The sub-partition's warp scheduler, every cycle</td><td>A hardware (SMT) thread running 32-wide SIMD instructions</td></tr>
<tr><td>Block</td><td>Threads that can cooperate</td><td>Up to 1,024 threads (32 warps)</td><td>One SM, for life</td><td>Shared memory (up to 227 KB) and barriers (<code>__syncthreads()</code>)</td><td>The GigaThread engine, once, when an SM has room</td><td>Threads pinned to one core, sharing its L1 and a barrier</td></tr>
<tr><td>Grid</td><td>Every block of one launch</td><td>Up to 2<sup>31</sup> − 1 blocks along x</td><td>The whole GPU, in waves</td><td>Global memory and L2 only</td><td>The launch</td><td>A parallel-for spread over every core of a socket</td></tr>
</table></div>
<p>The hardware levels they land on:</p>
<div class="tbl"><table>
<tr><th>Level</th><th>What it holds</th><th>Count on H100 SXM5</th><th>Limits</th><th>Closest CPU idea</th></tr>
<tr><td>Lane (CUDA core)</td><td>One FP32 ALU</td><td>32 per sub-partition, 128 per SM</td><td>One thread's operation per cycle</td><td>One element slot of a SIMD unit</td></tr>
<tr><td>Sub-partition</td><td>L0 instruction cache, 1 warp scheduler, 1 dispatch unit, a 64 KB register file, and the lanes</td><td>4 per SM</td><td>1 warp instruction issued per cycle, 16 resident warps</td><td>An in-order, single-issue core with 16-way fine-grained multithreading and a 32-wide SIMD unit</td></tr>
<tr><td>SM</td><td>4 sub-partitions plus 256 KB of combined L1 data cache and shared memory</td><td>132</td><td>2,048 threads, 64 warps, 32 blocks, 65,536 registers</td><td>A core with its private L1</td></tr>
<tr><td>GPU</td><td>132 SMs in 8 GPCs, 50 MB of L2, 80 GB of HBM3</td><td>1</td><td>270,336 resident threads</td><td>A whole socket</td></tr>
</table></div>
<p>The mapping is fixed at each level: a grid is spread across SMs block by block, a block lives on one SM, a warp lives on one sub-partition, and each thread of a warp uses the same lane number every time its warp runs on a full-width unit.</p>
<h3 id="sec-journey">From Grid to Lanes</h3>
<p>Click through the steps to follow one launch, <code>scale&lt;&lt;&lt;1320, 256&gt;&gt;&gt;</code>, from the grid down to a single instruction on 32 lanes.</p>
<div class="anim" data-anim="grid-to-lanes"></div>
<h3 id="sec-subpartition">Inside One Sub-Partition</h3>
<p>The timelines below draw one H100 sub-partition in the layout of the classic Fermi SM figure: caches and registers in blue, scheduling in orange, execution units in green. The pieces have moved since Fermi (GF100, 2010). A Fermi SM had 2 schedulers sharing 32 cores, 16 LD/ST units, 4 SFUs, and a 128 KB register file. An H100 SM splits into 4 sub-partitions, and each one alone has about a Fermi SM's worth of lanes:</p>
<ul>
<li>32 FP32 lanes, 16 INT32 lanes, and 16 FP64 lanes</li>
<li>1 fourth-generation Tensor Core</li>
<li>8 LD/ST units and 4 SFU lanes (sine, square root, reciprocal, and other special functions)</li>
<li>A 64 KB register file (16,384 registers of 32 bits)</li>
</ul>
<p>A warp instruction always covers 32 threads, but only the FP32 unit has 32 lanes. Narrower units take the warp in passes, one per cycle: 2 passes on INT32 or FP64, 4 on LD/ST, and 8 on the SFU. The unit is busy for those cycles, so a second instruction for it waits, but the scheduler can still issue to a different unit in the meantime.</p>
<h3 id="sec-switching">Warp Switching, Cycle by Cycle</h3>
<p>Every warp below runs the same six instructions. Step one cycle at a time to see the scheduler pick a warp and the lanes take its threads, or jump to the next cycle where anything changes. The whole-SM view shows all 4 sub-partitions, each with its own scheduler, so the SM can issue up to 4 warp instructions per cycle. Switch to one sub-partition to read every lane and every warp's state. Then raise the load latency: with an L1 hit the warps cover each other's waits, but at HBM latency even 16 warps leave hundreds of idle cycles, because this kernel has only one load's worth of work per warp.</p>
<div class="anim" data-anim="warp-switch"></div>
<p>Things to notice:</p>
<ul>
<li>The <code>IMAD</code>s of different warps can't go back to back, because INT32 needs 2 cycles per warp. The scheduler fills the gap with any warp that has something for a free unit.</li>
<li>After its load, a warp drops out of the picture until the data returns. Nothing is lost: its registers stay put, so switching back costs nothing. That is the whole trick behind latency hiding.</li>
<li>The scheduler sticks with one warp while that warp stays ready, which is why the three dependent <code>FFMA</code>s of a warp are spread out (each waits 4 cycles for the previous result) with other warps' instructions in between.</li>
</ul>
<p>This is a simplified model. NVIDIA doesn't publish the H100's scheduling policy or exact latencies, so the numbers here are typical values, not measurements.</p>
<h3 id="sec-divergence">An If/Else Splits a Warp</h3>
<p>All 32 threads of a warp share one instruction stream. When they disagree on a branch, the warp runs both paths one after the other, with the threads that didn't take the current path masked off. Masked lanes still go through the unit, so their slots are wasted. Set how many of W0's threads take the if, and compare W0 with W1, whose threads all agree. In the whole-SM view they sit in sub-partitions 0 and 1, and the other two have no work.</p>
<div class="anim" data-anim="warp-diverge"></div>
<ul>
<li>At 0 or 32, W0 runs one path only, just like W1. The cost of a branch comes from disagreement, not from the branch itself.</li>
<li>In between, W0 takes the same number of cycles whatever the split, but its SIMT efficiency (useful thread operations over 32 × warp instructions) falls.</li>
<li>The SFU's 8 passes make the if path expensive even when only a few threads want it.</li>
<li>For short paths like these, compilers often use predication instead of a branch. The cycles are the same: both paths still take issue slots.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>An A100 SM has 65,536 registers, a limit of 2,048 threads, and 4 sub-partitions, and the GPU has 108 SMs. A kernel launches 2,000 blocks of 512 threads, using 40 registers per thread. How many blocks fit on an SM, how many warps does each sub-partition hold, and how many waves does the launch take?</p>`,
        a: `<ol><li>Thread limit: 2,048 threads/SM / 512 threads/block = 4 blocks/SM.</li><li>Register limit: 512 threads/block × 40 registers/thread = 20,480 registers/block, and 65,536 registers/SM / 20,480 registers/block = 3.2, so 3 blocks/SM.</li><li>The tighter limit wins: <strong>3 blocks/SM</strong>.</li><li>Warps: 3 blocks/SM × 16 warps/block = 48 warps/SM, and 48 warps/SM / 4 sub-partitions/SM = <strong>12 warps per sub-partition</strong>.</li><li>One wave holds 108 SMs × 3 blocks/SM = 324 blocks. Waves = ⌈2,000 blocks / 324 blocks/wave⌉ = ⌈6.17⌉ = <strong>7 waves</strong>.</li><li>The last wave has 2,000 blocks − 6 waves × 324 blocks/wave = 56 blocks, so it uses barely a sixth of the GPU's block slots.</li></ol>`
      },
      {
        q: `<p>An A100 sub-partition has only 16 FP32 lanes, so an FP32 warp instruction takes 2 cycles in the unit. A warp hits an if/else where 10 threads take the if path (6 FP32 instructions) and the other 22 take the else path (4 FP32 instructions). How many FP32 unit cycles does the branch cost, compared with no divergence, and what is the SIMT efficiency?</p>`,
        a: `<ol><li>Diverged, the warp runs both paths: (6 + 4) instructions × 2 cycles/instruction = <strong>20 cycles</strong>.</li><li>If every thread took the if path it would be 6 instructions × 2 cycles/instruction = 12 cycles. If every thread took the else path it would be 4 instructions × 2 cycles/instruction = 8 cycles.</li><li>Useful thread operations: 10 threads × 6 instructions + 22 threads × 4 instructions = 60 + 88 = 148.</li><li>Thread slots issued: 10 instructions × 32 threads/instruction = 320.</li><li>SIMT efficiency = 148 / 320 ≈ <strong>46%</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Each warp of an H100 kernel loops over this body: one global load, then 12 FP32 instructions that all need the loaded value but are independent of each other. The next iteration's load issues right after the 12th. A sub-partition issues 1 instruction per cycle and holds up to 16 warps. Assume the load takes 300 cycles, ignore LD/ST and FP32 unit contention, and assume the warps stagger perfectly. What fraction of issue cycles does the sub-partition use with 16 warps, how many warps would full issue need, and what code change gets there?</p>`,
        a: `<ul><li>One iteration per warp: the load issues at cycle t, the data arrives at t + 300 cycles, the 12 FP32 instructions issue from t + 300 to t + 311, and the next load issues at t + 312. The period is 312 cycles, with 13 instructions issued.</li><li>Full issue needs 312 cycles/iteration / 13 instructions/iteration per warp = <strong>24 warps</strong>, but only 16 fit.</li><li>With 16 warps: 16 warps × 13 instructions / 312 cycles ≈ <strong>67%</strong> of issue cycles used.</li><li>The fix is more independent work per warp (ILP), not more warps. Unroll by 2 and issue both loads before using either: loads at t and t + 1, 24 FP32 instructions from t + 300 to t + 323, and the next pair of loads at t + 324. That gives 26 instructions per 324 cycles, so full issue needs 324 cycles / 26 instructions per warp ≈ 12.5, so 13 warps, which fits in 16.</li></ul><p>This is Little's law: work in flight = latency × issue rate, and the work can come from more warps or from more independent instructions per warp.</p>`
      },
      {
        q: `<p>A warp runs a loop whose trip count depends on each thread's data: 31 threads need 8 iterations, but 1 thread needs 64. The loop body is 5 instructions. How many warp instructions does the loop issue, what is its SIMT efficiency, and how would you fix it?</p>`,
        a: `<ul><li>A warp keeps looping until its last thread finishes, so it runs 64 iterations × 5 instructions/iteration = <strong>320 warp instructions</strong>. Without the long thread it would be 8 iterations × 5 instructions/iteration = 40.</li><li>Useful thread operations: (31 threads × 8 iterations + 1 thread × 64 iterations) × 5 instructions/iteration = 312 × 5 = 1,560.</li><li>Thread slots: 320 warp instructions × 32 threads/instruction = 10,240. SIMT efficiency = 1,560 / 10,240 ≈ <strong>15%</strong>.</li></ul><p>Fixes:</p><ul><li>Group work by expected trip count (sort or bin the inputs) so threads in a warp finish together.</li><li>Cap the loop and push leftover work to a queue that a second pass, or idle warps, drain.</li><li>Split long items across several threads.</li></ul><p>The branch at the loop's end costs nothing by itself. The cost is the 31 masked lanes riding along for 56 iterations.</p>`
      }
    ]
  }
}
]);
