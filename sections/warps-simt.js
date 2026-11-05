/* Section: Warps and SIMT
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gwarp"). */

section({
  id: "gwarp",
  name: "Warps and SIMT",
  cap: "Warp scheduling, latency hiding, divergence, and shuffles",
  sections: [
    { id: "what-warp", label: "What a Warp Is" },
    { id: "simt-simd", label: "SIMT Compared with SIMD and SMT" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>A <strong>warp</strong> is the GPU's real unit of execution: 32 threads that share one program counter (logically, see <a href="#/warp-divergence/its">Independent Thread Scheduling</a>) and issue one instruction together. Threads are what the programmer writes, warps are what the hardware schedules.</p>
<h3 id="sec-what-warp">What a Warp Is</h3>
<ul>
<li><strong>Formed from consecutive thread ids:</strong> threads 0 to 31 of a block are warp 0, 32 to 63 warp 1, and so on. A block whose size isn't a multiple of 32 leaves lanes idle in its last warp.</li>
<li><strong>Fixed to one sub-partition:</strong> a warp's registers live in one SMSP's register file slice, and that sub-partition's scheduler is the only one that issues it.</li>
<li><strong>Active mask:</strong> each warp instruction carries a 32-bit mask of the threads it applies to. Bounds checks and branches turn lanes off without changing what the warp issues.</li>
</ul>
<h3 id="sec-simt-simd">SIMT Compared with SIMD and SMT</h3>
<ul>
<li><strong>Against SIMD:</strong> hardware-wise a warp is a 32-wide SIMD instruction stream with masking. The difference is the programming model. In SIMT each thread has its own registers and its own addresses (so every load is a gather and every store a scatter), and the hardware manages the masks for branches. With AVX-512 the compiler or programmer manages masks and lanes. Hennessy &amp; Patterson describe the GPU as a multithreaded SIMD processor for exactly this reason.</li>
<li><strong>Against SMT:</strong> a CPU core with <a href="#/smt">simultaneous multithreading</a> holds 2 threads and fills issue slots from both in one cycle. An SM sub-partition holds up to 16 warps and issues from one of them per cycle: fine-grained multithreading, with far more contexts so that each can stall for hundreds of cycles.</li>
</ul>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/warp-sched">Warp Scheduling and Latency Hiding</a>: how a scheduler picks a warp, how many warps it takes to cover memory latency, and what the profiler's stall reasons mean.</li>
<li><a href="#/warp-divergence">Divergence and Warp-Level Primitives</a>: what happens when threads of one warp branch differently, and how warps exchange data without shared memory.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A kernel is launched with 200-thread blocks. How many warps does each block have, how many lanes are active in the last one, and what fraction of the block's lanes do useful work?</p>`,
        a: `<ol><li>Warps = ⌈200 / 32⌉ = <strong>7</strong>.</li><li>The first 6 warps cover 192 threads, so the last has 200 − 192 = <strong>8</strong> active lanes.</li><li>Lane utilization = 200 / (7 × 32) = 200 / 224 ≈ <strong>89%</strong>. Every instruction the last warp issues costs a full issue slot for 8 threads of work, and the 7th warp still occupies a scheduler slot and its registers.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is a warp 32 threads? Argue what would get better and worse with 8-thread or 128-thread warps.</p>`,
        a: `<ul><li><strong>Narrower (8):</strong> divergence costs less, since fewer threads share a path, and irregular code wastes fewer lanes. But each issued instruction does 4× less work, so fetch, decode, scheduling, and dependency tracking cost 4× more per thread. Memory coalescing gets weaker too: 8 threads × 4 B = 32 B per request, one sector, so the memory system sees 4× more requests.</li><li><strong>Wider (128):</strong> control overhead per thread drops, and one load of 4-byte values covers 512 B. But divergence and partially full warps waste more lanes, the register file must deliver 128 operands per port per cycle, and the scheduler has fewer, fatter warps to choose from for the same thread count.</li></ul><p>32 is a balance point: one warp's 4-byte loads fill one 128-byte cache line, which ties the warp width to the memory system's line size. AMD chose 64 (GCN) and later supports both 32 and 64 (RDNA), which shows the trade-off is real rather than fundamental.</p>`
      }
    ]
  }
}, [
{
  id: "warp-sched",
  region: "gwarp",
  title: "Warp Scheduling and Latency Hiding",
  sections: [
    { id: "issue", label: "One Warp Instruction per Cycle" },
    { id: "dependencies", label: "Tracking Dependencies" },
    { id: "model", label: "A First-Order Model" },
    { id: "policies", label: "Scheduling Policies" },
    { id: "stall-reasons", label: "Reading Stall Reasons" }
  ],
  body: `
<p>A GPU core has no out-of-order window. It hides latency by holding many warps and issuing whichever one is ready. This page is about how many warps that takes and how the scheduler chooses among them.</p>
<h3 id="sec-issue">One Warp Instruction per Cycle</h3>
<p>Each of an SM's four sub-partition schedulers issues at most one warp instruction per cycle, in program order for that warp. A warp is <em>eligible</em> if its next instruction is fetched and decoded, its operands are ready, and the unit it needs is free. Each cycle the scheduler picks one eligible warp. If none is eligible, the slot is lost: that's the GPU's version of a stall cycle.</p>
<h3 id="sec-dependencies">Tracking Dependencies</h3>
<ul>
<li><strong>Fixed-latency instructions</strong> (FP32, INT32, most ALU work, about 4 to 6 cycles on recent GPUs): since Kepler, the compiler encodes how many cycles the scheduler must wait before the warp's next instruction in control bits next to each instruction. No hardware scoreboard is needed.</li>
<li><strong>Variable-latency instructions</strong> (global and shared memory, SFU, texture): the instruction sets one of a small number of per-warp dependency barriers (6 on Volta, per Jia et al.'s microbenchmarks), and a later instruction that needs the result waits on that barrier. This is the "scoreboard" the profiler refers to.</li>
</ul>
<p>So one warp can have several independent loads outstanding, and it stalls only at the first instruction that uses one of them.</p>
<h3 id="sec-model">A First-Order Model</h3>
<p>Suppose every warp alternates between C cycles of issuing instructions and L cycles waiting for a load. With W warps per scheduler, the fraction of issue slots used is:</p>
<div class="math">\\[ U = \\min\\left(1, \\frac{W \\cdot C}{C + L}\\right), \\qquad W_{\\text{needed}} = \\frac{C + L}{C} \\]</div>
<p>This is <a href="#/perf-bounds/bounds">Little's law</a> applied to warps: L / C stalled warps are in flight for every one issuing. With C = 20 and L = 480, a scheduler needs 25 warps, but an H100 sub-partition holds at most 64 / 4 = 16. At full occupancy U = 16 × 20 / 500 = 64%, so the kernel is latency-bound even at 100% occupancy. The ways out:</p>
<ul>
<li><strong>More independent work per warp:</strong> issue several loads before using any of them (unrolling), which raises C per wait.</li>
<li><strong>Fewer long waits:</strong> stage data through shared memory with asynchronous copies (<code>cp.async</code>, TMA) so the wait overlaps compute on the previous tile.</li>
<li><strong>Shorter L:</strong> better locality, so loads hit in L1 or L2.</li>
</ul>
<p>The model ignores bandwidth. If W·C/(C+L) is high but the loads together exceed what HBM can deliver, L itself grows with queueing until the kernel sits on the memory roofline.</p>
<h3 id="sec-policies">Scheduling Policies</h3>
<ul>
<li><strong>Loose round-robin (LRR):</strong> rotate through eligible warps. Fair, but all warps reach their long-latency loads at about the same time, so they all stall together.</li>
<li><strong>Greedy-then-oldest (GTO):</strong> keep issuing the same warp until it stalls, then switch to the oldest eligible one. Warps drift apart, which spreads loads out, and the running warp keeps its working set in L1. Rogers, O'Connor, and Aamodt showed GTO beats LRR on cache-sensitive workloads, and that throttling the number of warps that can issue (cache-conscious wavefront scheduling) helps further when warps thrash L1.</li>
<li><strong>Two-level scheduling</strong> (Narasiman et al.): split warps into fetch groups and run one group until it stalls, so groups hit their loads at different times.</li>
</ul>
<p>NVIDIA doesn't document its production policy, so simulators such as GPGPU-Sim and Accel-Sim default to GTO-like policies that correlate well with measured hardware.</p>
<h3 id="sec-stall-reasons">Reading Stall Reasons</h3>
<p>Nsight Compute samples each warp's state and reports why it wasn't issued. The main reasons map directly onto the mechanisms above:</p>
<div class="tbl"><table>
<tr><th>Stall reason</th><th>Waiting for</th><th>Usual fix</th></tr>
<tr><td>Long Scoreboard</td><td>A global, local, or texture load (L1TEX)</td><td>More warps or ILP, better locality, async copies</td></tr>
<tr><td>Short Scoreboard</td><td>Shared memory or an SFU result (MIO)</td><td>Fix bank conflicts, fewer transcendental ops</td></tr>
<tr><td>Wait</td><td>A fixed-latency dependency</td><td>More independent instructions between dependent ones</td></tr>
<tr><td>Barrier</td><td>Other warps at <code>__syncthreads</code></td><td>Balance work across warps, fewer barriers</td></tr>
<tr><td>Math Pipe Throttle</td><td>A busy execution pipe</td><td>Usually good news: the kernel is compute-bound</td></tr>
<tr><td>LG Throttle and MIO Throttle</td><td>A full memory-instruction queue</td><td>Fewer, wider memory instructions</td></tr>
<tr><td>Not Selected</td><td>Nothing: eligible but another warp was picked</td><td>None needed: there's spare parallelism</td></tr>
</table></div>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (multithreaded SIMD instruction scheduling) · Jia, Maggioni, Staiger, and Scarpazza, "Dissecting the NVIDIA Volta GPU Architecture via Microbenchmarking," 2018 · Rogers, O'Connor, and Aamodt, "Cache-Conscious Wavefront Scheduling," MICRO 2012 · Narasiman et al., "Improving GPU Performance via Large Warps and Two-Level Warp Scheduling," MICRO 2011 · NVIDIA, <em>Nsight Compute Kernel Profiling Guide</em> (warp stall reasons)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A kernel on an A100 runs at full occupancy (64 warps per SM, 16 per scheduler). Each warp issues 12 cycles of instructions, then waits 600 cycles on a global load. What fraction of issue slots does it use? Then the loop is unrolled 4 times so each warp issues 4 independent loads (and 48 cycles of instructions) before one wait. What does it use now, and how many warps per scheduler would be enough?</p>`,
        a: `<ol><li>Before: U = min(1, 16 × 12 / (12 + 600)) = 192 / 612 ≈ <strong>31%</strong>. It would need (12 + 600) / 12 = 51 warps per scheduler.</li><li>After: C = 48, so U = min(1, 16 × 48 / (48 + 600)) = min(1, 768 / 648) = <strong>100%</strong>.</li><li>Warps needed: (48 + 600) / 48 = 13.5, so <strong>14 per scheduler</strong>, 56 per SM. The kernel could now give up some occupancy (for more registers per thread) without losing throughput.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An A100 streams a large array from HBM with one 4-byte load per thread per loop iteration. How many warp-level loads must each SM have in flight to reach full bandwidth, and can 64 warps per SM get there with one outstanding load each? What changes with 16-byte (<code>float4</code>) loads?</p><p class="given">Assume 2.04 TB/s of HBM bandwidth, 108 SMs, a loaded memory latency of 450 ns, and that every load is fully coalesced.</p>`,
        a: `<ol><li>Bytes in flight (Little's law): 2.04 × 10<sup>12</sup> × 450 × 10<sup>−9</sup> ≈ 918 KB across the GPU.</li><li>Per SM: 918 / 108 ≈ 8.5 KB.</li><li>A warp load of 4-byte values moves 32 × 4 = 128 B, so each SM needs 8,500 / 128 ≈ <strong>66 loads in flight</strong>. With 64 warps and one load each, it falls just short, and any time warps spend issuing (not waiting) lowers it further.</li><li>With <code>float4</code>, each warp load moves 512 B: 8,500 / 512 ≈ <strong>17 loads</strong>. Now 17 warps with one outstanding load each would do, or fewer warps with unrolling.</li></ol><p>That's why bandwidth-bound kernels use vector loads and unrolling: they reach the memory roofline at modest occupancy instead of needing more warps than the SM can hold.</p>`
      },
      {
        q: `<p>A kernel's warps each read a private 2 KB region of memory repeatedly. With 48 warps per SM and a 128 KB L1, a round-robin scheduler gets a 20% L1 hit rate, and limiting issue to 16 warps raises the hit rate to 85% and speeds the kernel up. Why can fewer active warps be faster, and what's the risk?</p>`,
        a: `<p>48 warps × 2 KB = 96 KB of working set, plus everything else in L1, and round-robin touches all of it in a short window, so lines are evicted before their warp returns to them. Restricting issue to 16 warps (32 KB) lets each active warp's data survive in L1 until it's reused. Hits replace hundreds of cycles of L2 or HBM latency, so 16 warps with mostly hits hide latency better than 48 warps with mostly misses. This is the result behind cache-conscious wavefront scheduling.</p><p>The risk is that fewer warps leave less parallelism for the latency that remains: if the working set already fits, throttling only removes latency hiding. A good policy throttles adaptively, based on detected lost locality, rather than to a fixed count.</p>`
      }
    ]
  }
},

{
  id: "warp-divergence",
  region: "gwarp",
  title: "Divergence and Warp-Level Primitives",
  sections: [
    { id: "divergence", label: "What Divergence Costs" },
    { id: "stack", label: "The Reconvergence Stack" },
    { id: "its", label: "Independent Thread Scheduling" },
    { id: "efficiency", label: "Measuring SIMD Efficiency" },
    { id: "primitives", label: "Shuffles and Votes" }
  ],
  body: `
<p>All 32 threads of a warp issue the same instruction. When they disagree about a branch, the warp runs each path with the threads that didn't take it switched off.</p>
<h3 id="sec-divergence">What Divergence Costs</h3>
<pre><code>if (x[i] &gt; 0) { <span class="cm">/* path A: 40 instructions */</span> }
else          { <span class="cm">/* path B: 60 instructions */</span> }</code></pre>
<p>If all 32 threads agree, the warp issues 40 or 60 instructions. If even one disagrees, it issues 100: path A with some lanes masked, then path B with the rest. Divergence only happens <em>within</em> a warp. Two warps taking different paths cost nothing extra, which is why branching on <code>warp_id</code> or <code>blockIdx</code> is free and branching on <code>threadIdx.x % 2</code> is the worst case.</p>
<h3 id="sec-stack">The Reconvergence Stack</h3>
<p>Pre-Volta NVIDIA GPUs track divergence with a per-warp stack. At a divergent branch the hardware pushes an entry for each path, recording its active mask, its starting PC, and the <em>reconvergence point</em>, the branch's immediate post-dominator (the first instruction every path must reach). The warp runs the top entry until it reaches the reconvergence PC, pops it, runs the next path, and finally continues with the full mask. Hennessy &amp; Patterson describe the same mechanism as a branch synchronization stack, and Fung et al. analyzed it in their work on dynamic warp formation.</p>
<p>The stack has a known weakness: the paths of a divergent warp run one after the other, never interleaved. If thread 0 spins waiting for a lock that thread 1 holds, and the hardware chose to run thread 0's path first, thread 1 never runs and the warp deadlocks.</p>
<h3 id="sec-its">Independent Thread Scheduling</h3>
<p>Volta gave every thread its own program counter and call stack. The scheduler still issues one instruction for a group of threads at a time, but it can switch between divergent paths before they reconverge, so the spin-lock above now makes progress. A convergence optimizer regroups threads that are at the same PC. Two consequences for code:</p>
<ul>
<li><strong>Don't assume lockstep:</strong> threads of a warp are no longer guaranteed to be converged at any point, so warp-synchronous code that exchanged data through shared memory without a barrier must add <code>__syncwarp()</code>.</li>
<li><strong>Name the participants:</strong> the warp intrinsics take an explicit mask (<code>__shfl_sync</code>, <code>__ballot_sync</code>), and every named thread must execute the call.</li>
</ul>
<h3 id="sec-efficiency">Measuring SIMD Efficiency</h3>
<p>SIMD efficiency is the fraction of lanes doing useful work, averaged over issued instructions:</p>
<div class="math">\\[ E = \\frac{\\sum_{\\text{instr}} \\text{active lanes}}{32 \\times \\text{warp instructions issued}} \\]</div>
<p>In the example above, if 12 threads take path A and 20 take path B: useful lane-instructions = 12 × 40 + 20 × 60 = 1,680, issued = 100 warp instructions, so E = 1,680 / 3,200 = 52.5%. Nsight Compute reports this as average active threads per warp instruction.</p>
<h3 id="sec-primitives">Shuffles and Votes</h3>
<p>Threads in a warp can read each other's registers directly, without shared memory or a barrier:</p>
<pre><code><span class="cm">// sum v across the warp: 5 steps for 32 lanes</span>
for (int off = 16; off &gt; 0; off /= 2)
  v += __shfl_down_sync(0xffffffff, v, off);
<span class="cm">// lane 0 now holds the warp's total</span></code></pre>
<ul>
<li><strong>Shuffles</strong> (<code>__shfl_sync</code>, <code>_up</code>, <code>_down</code>, <code>_xor</code>): each lane reads a register from another lane. Reductions and scans take log<sub>2</sub>(32) = 5 steps.</li>
<li><strong>Votes</strong> (<code>__ballot_sync</code>, <code>__any_sync</code>, <code>__all_sync</code>): combine one predicate per lane into a 32-bit mask or a single bit. <code>__popc(__ballot_sync(mask, pred))</code> counts how many lanes passed a filter, the core of stream compaction.</li>
<li><strong>Match and reduce</strong> (Volta and Ampere): <code>__match_any_sync</code> groups lanes holding equal values, and <code>__reduce_add_sync</code> does an integer warp reduction in hardware.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (conditional branching in GPUs) · Fung, Sham, Yuan, and Aamodt, "Dynamic Warp Formation and Scheduling for Efficient GPU Control Flow," MICRO 2007 · NVIDIA, <em>Volta</em> architecture whitepaper (independent thread scheduling) · NVIDIA, <em>CUDA C++ Programming Guide</em> (warp shuffle, vote, and match functions)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A sparse matrix-vector kernel assigns one thread per row of a CSR matrix. In one warp, 31 rows have 4 nonzeros and 1 row has 100. Each nonzero takes one loop iteration. What is the warp's SIMD efficiency over the loop?</p>`,
        a: `<ol><li>The warp keeps looping until its longest row is done: <strong>100 iterations</strong>.</li><li>Useful lane-iterations = 31 × 4 + 1 × 100 = 224.</li><li>Issued lane-iterations = 32 × 100 = 3,200.</li><li>E = 224 / 3,200 = <strong>7%</strong>. For 96 of the 100 iterations only one lane is active.</li></ol>`
      },
      {
        q: `<p>A block of 512 threads sums one float per thread. Count the steps and barriers for a warp-shuffle reduction compared with a classic shared-memory tree reduction.</p>`,
        a: `<ol><li>Shuffle version: each of the 16 warps reduces with 5 shuffles, lane 0 of each writes its partial to shared memory, one <code>__syncthreads</code>, then warp 0 reduces the 16 partials in log<sub>2</sub>(16) = 4 shuffles. Total: <strong>9 shuffle steps, 1 barrier</strong>.</li><li>Tree version: log<sub>2</sub>(512) = 9 halving steps, each a shared-memory read, an add, and a write, with a <code>__syncthreads</code> after each step: <strong>9 steps, 9 barriers</strong>, and the last 5 steps leave most of the block idle at a barrier.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>This code works on an A100 but hangs on a Pascal GPU. Explain why, and say what the A100 does differently.</p><pre><code>__device__ int lock = 0;
__global__ void k(int *counter) {
  while (atomicCAS(&amp;lock, 0, 1) != 0) ;   // spin
  (*counter)++;
  atomicExch(&amp;lock, 0);
}</code></pre>`,
        a: `<p>All 32 threads of a warp hit the <code>atomicCAS</code>. One wins and leaves the loop, and 31 lose and stay in it. That's a divergent branch inside a warp. On Pascal, the reconvergence stack runs one path at a time and only switches at the reconvergence point. If the hardware keeps running the 31 spinning threads first, the winner never reaches the code that releases the lock, and the loop never ends because only the winner can end it.</p><p>From Volta onward, independent thread scheduling lets the scheduler interleave the two paths, so the winner eventually runs its increment and release, and the next thread acquires the lock. The A100 makes it correct, not fast: the critical section still serializes 32 threads per warp. A warp-aggregated version (elect one leader with <code>__ballot_sync</code>, add 32 at once) is the real fix.</p>`
      },
      {
        q: `<p>A ray tracer's warps have 30% SIMD efficiency because rays in a warp hit different materials, each with its own shading code. Propose hardware or software techniques that raise efficiency, and give each one's cost.</p>`,
        a: `<ul><li><strong>Sort or bin rays by material between passes</strong> (software): write ray records to per-material queues and launch shading per queue, so each warp shades one material. Cost: extra memory traffic for the queues and an extra kernel phase.</li><li><strong>Shader execution reordering</strong> (hardware, NVIDIA Ada and later): the program calls a reorder point, and the hardware regroups threads across warps by a coherence key such as material id. Cost: the reorder itself takes time and moves thread state, and it only pays off when shading is long enough.</li><li><strong>Dynamic warp formation</strong> (research, Fung et al.): at a divergent branch, merge threads from different warps that took the same path into new warps. Cost: threads must be able to move between register file lanes, which constrains register file design, and memory coalescing can get worse because merged threads are no longer neighbors.</li></ul>`
      }
    ]
  }
}
]);
