/* Section: GPU Performance Modeling
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gperf"). */

section({
  id: "gperf",
  name: "GPU Performance Modeling",
  cap: "What a GPU model must capture, analytical models, and simulators",
  sections: [
    { id: "capture", label: "What a GPU Model Must Capture" },
    { id: "metrics", label: "Metrics" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>Modeling a GPU uses the same tools as modeling a CPU (bounds, analytical models, cycle-level simulators, validation against counters), but the first-order effects are different. A CPU model lives or dies on branch prediction, the out-of-order window, and cache misses on one thread's critical path. A GPU model lives or dies on how much parallelism is resident and how well the memory system turns it into bandwidth.</p>
<h3 id="sec-capture">What a GPU Model Must Capture</h3>
<ul>
<li><strong>Occupancy:</strong> how many warps fit per SM, from registers, shared memory, and thread limits (<a href="#/gpu-occupancy">Occupancy and Per-SM Resources</a>).</li>
<li><strong>Latency hiding:</strong> how many independent memory requests the resident warps keep in flight (<a href="#/warp-sched/model">A First-Order Model</a>).</li>
<li><strong>Memory efficiency:</strong> sectors per request from coalescing, bank conflicts in shared memory, and L2 hit rate.</li>
<li><strong>Control efficiency:</strong> active lanes per warp instruction after divergence.</li>
<li><strong>Bandwidth contention:</strong> queueing in the interconnect, L2 slices, and DRAM channels, which raises latency as load rises.</li>
<li><strong>Whole-kernel effects:</strong> waves and the tail of the last one, and launch gaps between kernels.</li>
</ul>
<h3 id="sec-metrics">Metrics</h3>
<ul>
<li><strong>IPC</strong> is counted in warp instructions per cycle per SM, with a ceiling of 4 on Volta and later (one per sub-partition). Thread-level IPC multiplies by active lanes per instruction.</li>
<li><strong>Speed of light:</strong> Nsight Compute reports each unit's throughput as a percentage of its peak (SM, L1, L2, DRAM). The highest one is usually the bottleneck.</li>
<li><strong>Achieved occupancy</strong> versus theoretical occupancy shows whether blocks actually fill the SMs (tail effects and imbalance lower the achieved number).</li>
</ul>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/gpu-models">Analytical Models and Simulators</a>: the roofline at each memory level, the MWP-CWP model, interval models for warps, and cycle-level simulators such as GPGPU-Sim and Accel-Sim.</li>
</ul>
<p>For CPU-side counterparts, see <a href="#/perf-analytical">Analytical Performance Models</a> and <a href="#/perf-validation">Validating a Performance Model</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Nsight Compute reports 1.8 warp instructions issued per cycle per SM on an H100, with 24 active threads per warp instruction on average. What fraction of the SM's issue slots and of its thread-instruction capacity is used?</p>`,
        a: `<ol><li>Issue slots: 4 per cycle (one per sub-partition), so 1.8 / 4 = <strong>45%</strong>.</li><li>Thread instructions: 1.8 × 24 = 43.2 per cycle.</li><li>Capacity: 4 × 32 = 128 per cycle, so 43.2 / 128 ≈ <strong>33.8%</strong>. Divergence or partial warps cost 24 / 32 = 75% of the issued work.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>On a CPU you can build a CPI stack by charging each cycle to the oldest instruction's reason for not retiring. Why doesn't that carry over to a GPU directly, and how would you build an equivalent stall breakdown for an SM?</p>`,
        a: `<p>A CPU core's stall stack works because one thread's commit point defines whether a cycle did useful work. An SM sub-partition has up to 16 warps, and a cycle is lost only when <em>none</em> of them is eligible. Charging the cycle to one warp is arbitrary, and warps stalled while another issues cost nothing.</p><p>Two workable alternatives:</p><ul><li><strong>Issue-slot accounting:</strong> per scheduler per cycle, either a warp issued (useful) or the slot was lost. Charge each lost slot to the reason of the warp that would have issued next (for example the oldest under a GTO policy), or split it fractionally across all stalled warps' reasons. This gives a stack that sums to total cycles.</li><li><strong>Warp-state sampling</strong> (what Nsight Compute does): sample every warp's state periodically and report the distribution of reasons. It shows where warps spend time, not which stalls cost throughput, so a large Long Scoreboard share only matters when issue slots are also being lost.</li></ul>`
      }
    ]
  }
}, [
{
  id: "gpu-models",
  region: "gperf",
  title: "Analytical Models and Simulators",
  sections: [
    { id: "roofline", label: "Rooflines at Every Level" },
    { id: "mwp-cwp", label: "The MWP-CWP Model" },
    { id: "interval", label: "Interval Models for Warps" },
    { id: "simulators", label: "Cycle-Level Simulators" },
    { id: "validation", label: "Validating a GPU Model" }
  ],
  body: `
<p>GPU models range from a one-line roofline to cycle-level simulation of every warp. The cheap ones answer "what bounds this kernel," the expensive ones answer "what happens if we change the hardware."</p>
<h3 id="sec-roofline">Rooflines at Every Level</h3>
<p>The basic <a href="#/gen-gpus/roofline">roofline</a> uses HBM bandwidth. A <strong>hierarchical roofline</strong> adds a ceiling for each level the kernel's data passes through, each with its own arithmetic intensity (FLOPs per byte moved at that level):</p>
<div class="math">\\[ P \\le \\min\\left(P_{\\text{peak}},\\ \\text{AI}_{\\text{L1}} \\cdot B_{\\text{L1}},\\ \\text{AI}_{\\text{L2}} \\cdot B_{\\text{L2}},\\ \\text{AI}_{\\text{HBM}} \\cdot B_{\\text{HBM}}\\right) \\]</div>
<p>A kernel with good HBM intensity can still be bound by L2 if its blocks reread the same data from L2 many times. Nsight Compute can plot this per kernel. The roofline says nothing about latency: a kernel with too few warps sits below every ceiling.</p>
<h3 id="sec-mwp-cwp">The MWP-CWP Model</h3>
<p>Hong and Kim's model (ISCA 2009) asks whether memory or computation limits an SM's warps by comparing two degrees of parallelism:</p>
<ul>
<li><strong>Memory warp parallelism (MWP):</strong> how many warps can have memory requests in flight at once. It's the smallest of latency over the departure delay between successive warps' requests, the bandwidth limit, and the number of warps N.</li>
<li><strong>Computation warp parallelism (CWP):</strong> how many warps can compute while one waits on memory, (memory cycles + compute cycles) / compute cycles per warp, capped at N.</li>
</ul>
<p>In a simplified form, for one scheduler with N warps, each doing C compute cycles and M memory periods of latency L:</p>
<ul>
<li><strong>CWP ≤ MWP (compute-bound):</strong> memory is fully overlapped, T ≈ N · C + L.</li>
<li><strong>CWP &gt; MWP (memory-bound):</strong> memory periods go MWP at a time, T ≈ M · L · N / MWP + C.</li>
</ul>
<p>Example: N = 8 warps, M = 10, L = 500, and bandwidth allows MWP = 4. With C = 2,000, CWP = (5,000 + 2,000) / 2,000 = 3.5, which is ≤ 4, so T ≈ 8 × 2,000 + 500 = 16,500 cycles. With C = 200, CWP = 26, capped at 8, which exceeds 4: T ≈ 10 × 500 × 8 / 4 + 200 = 10,200 cycles, and adding compute up to the crossover point would be free. The original model also handles synchronization and uncoalesced accesses, which change the departure delay.</p>
<h3 id="sec-interval">Interval Models for Warps</h3>
<p>GPUMech (Huang et al., MICRO 2014) carries <a href="#/perf-analytical">interval analysis</a> over from CPUs. It profiles one representative warp's instruction trace into intervals of issue separated by stall events, then models how the scheduler interleaves many such warps under a given policy (round-robin or GTO), and adds a queueing model for memory contention. That captures effects MWP-CWP averages away, such as warps that all stall together under round-robin.</p>
<h3 id="sec-simulators">Cycle-Level Simulators</h3>
<ul>
<li><strong>GPGPU-Sim</strong> (Bakhoda et al., ISPASS 2009): execution-driven simulation of PTX (and later SASS) with configurable SMs, schedulers, caches, interconnect, and DRAM. The standard research platform for over a decade.</li>
<li><strong>Accel-Sim</strong> (Khairy et al., ISCA 2020): trace-driven simulation of SASS collected on real hardware with NVBit, on top of a reworked GPGPU-Sim performance model, with a microbenchmark-driven tuner that fits the configuration to a specific GPU. Simulating the real machine code instead of PTX removes the compiler mismatch that dominated older error.</li>
<li><strong>Sampling:</strong> full kernels are too long to simulate end to end at large scale, so studies simulate representative kernels or thread-block subsets, the GPU analog of <a href="#/spec-cpu">SimPoint</a>-style sampling on CPUs.</li>
</ul>
<h3 id="sec-validation">Validating a GPU Model</h3>
<ul>
<li><strong>Microbenchmarks first:</strong> pointer chases for latency at each level, streaming kernels for bandwidth, and dependent-instruction chains for pipeline latencies (the method of Jia et al.). These pin down parameters before any workload runs.</li>
<li><strong>Correlate cycles and counters:</strong> compare not just kernel time but L1 and L2 hit rates, DRAM bytes, and instructions issued against Nsight Compute. Right cycles from wrong counters means the errors cancel.</li>
<li><strong>Cover both regimes:</strong> compute-bound and memory-bound kernels stress different parts of the model, and a model tuned only on GEMMs will be wrong on stencils.</li>
</ul>
<p class="refs">References: Hong and Kim, "An Analytical Model for a GPU Architecture with Memory-Level and Thread-Level Parallelism Awareness," ISCA 2009 · Huang, Lee, Kim, and Lee, "GPUMech: GPU Performance Modeling Technique Based on Interval Analysis," MICRO 2014 · Bakhoda, Yuan, Fung, Wong, and Aamodt, "Analyzing CUDA Workloads Using a Detailed GPU Simulator," ISPASS 2009 · Khairy, Shen, Aamodt, and Rogers, "Accel-Sim: An Extensible Simulation Framework for Validated GPU Modeling," ISCA 2020 · Williams, Waterman, and Patterson, "Roofline," CACM 2009 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4</p>`,
  practice: {
    guided: [
      {
        q: `<p>Use the simplified MWP-CWP model for one scheduler with N = 12 warps, each with M = 6 memory periods of L = 400 cycles and C = 600 compute cycles. The departure delay is 25 cycles and bandwidth limits MWP to 6. Is the kernel compute- or memory-bound, and how long does it take? Then repeat with C = 300.</p>`,
        a: `<ol><li>MWP = min(400 / 25, 6, 12) = min(16, 6, 12) = 6.</li><li>C = 600: CWP = (6 × 400 + 600) / 600 = 3,000 / 600 = 5 ≤ 6, so <strong>compute-bound</strong>. T ≈ 12 × 600 + 400 = <strong>7,600 cycles</strong>.</li><li>C = 300: CWP = (2,400 + 300) / 300 = 9, capped at 12, so 9 &gt; 6: <strong>memory-bound</strong>. T ≈ 6 × 400 × 12 / 6 + 300 = <strong>5,100 cycles</strong>.</li><li>Check: the compute-bound formula would give 12 × 300 + 400 = 4,000, less than 5,100, so memory is indeed the binding term. Halving compute saved only 33%.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A kernel on an H100 does 4 FP32 FLOPs per byte read from HBM and 1 FLOP per byte read from L2. Using a hierarchical roofline, which level bounds it and at what rate? What would you change in the kernel?</p><p class="given">Assume 67 TFLOPS of FP32 on the CUDA cores, 3.35 TB/s from HBM, and an effective L2 bandwidth of 7 TB/s. The kernel doesn't use tensor cores, and L1 isn't a limit.</p>`,
        a: `<ol><li>HBM ceiling: 4 × 3.35 = 13.4 TFLOPS.</li><li>L2 ceiling: 1 × 7 = <strong>7 TFLOPS</strong>.</li><li>Compute ceiling: 67 TFLOPS.</li><li>The minimum is L2, so the kernel can reach at most 7 TFLOPS, about 10% of peak, even though HBM traffic alone would allow nearly double.</li></ol><p>The L2 intensity is 4× below the HBM intensity, so each byte from HBM is read from L2 about 4 times: blocks are rereading data that a larger on-chip tile would keep. Fixes: larger shared-memory tiles or register blocking so each block reuses more per L2 read, thread block clusters sharing tiles through distributed shared memory on Hopper, and rasterizing the block order so blocks that share data run together.</p>`
      },
      {
        q: `<p>Your GPU simulator matches hardware within 5% on GEMMs but runs memory-bound kernels 30% faster than the real GPU. List the likely causes in the order you'd check them, with the measurement that tests each.</p>`,
        a: `<ol><li><strong>DRAM timing and scheduling:</strong> compare a streaming kernel's achieved bandwidth, simulated against measured. If simulated bandwidth is too high, fix bank, refresh, and read-write turnaround timing or the controller's scheduling policy.</li><li><strong>Unloaded and loaded latency:</strong> pointer-chase latency at idle and under background load. Too-low loaded latency means missing queueing in the interconnect or L2.</li><li><strong>Coalescer and sector accounting:</strong> compare sectors per request and DRAM bytes against Nsight Compute. A simulator merging at line rather than sector granularity, or the reverse, changes traffic.</li><li><strong>Address mapping:</strong> check per-channel and per-L2-slice traffic balance for strided kernels. An idealized hash spreads traffic that the real GPU concentrates on a few channels (partition camping).</li><li><strong>Outstanding-request limits:</strong> MSHRs per L1 and per L2 slice, and memory-instruction queue depth. Too many allowed in flight inflates memory-level parallelism.</li></ol><p>GEMMs matching says the core pipeline and tensor cores are fine. The error is downstream of the SM.</p>`
      }
    ]
  }
}
]);
