/* Section: CUDA Cores and the SM
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gsm"). */

section({
  id: "gsm",
  name: "CUDA Cores and the SM",
  cap: "What a CUDA core is, SM sub-partitions, and occupancy",
  sections: [
    { id: "sm-vs-core", label: "An SM Next to a CPU Core" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>The streaming multiprocessor (SM) is the GPU's unit of replication, the way a core is a CPU's. An H100 has 132 of them, an A100 108, an RTX 4090 128. Everything a thread block needs lives inside one SM: warp schedulers, register file, execution lanes, tensor cores, shared memory, and L1.</p>
<h3 id="sec-sm-vs-core">An SM Next to a CPU Core</h3>
<div class="tbl"><table>
<tr><th></th><th>CPU core (Zen 5)</th><th>SM (H100)</th></tr>
<tr><td>Threads resident</td><td>2 (SMT)</td><td>Up to 2,048 (64 warps)</td></tr>
<tr><td>Instructions issued per cycle</td><td>Up to 8 micro-ops from one or two threads</td><td>4 warp instructions, one per sub-partition, each for 32 threads</td></tr>
<tr><td>How a stall is hidden</td><td>Out-of-order window of 448 micro-ops</td><td>Another warp issues next cycle</td></tr>
<tr><td>Register file</td><td>Physical registers renamed onto 16 architectural ones (x86-64 GPRs)</td><td>256 KB, statically split among resident threads</td></tr>
<tr><td>FP32 lanes</td><td>32 FMA lanes (two 512-bit FMA pipes)</td><td>128 lanes, the "CUDA cores"</td></tr>
<tr><td>Branch prediction</td><td>Large TAGE-style predictor</td><td>None</td></tr>
</table></div>
<p>The SM spends its transistors on lanes and registers instead of on finding parallelism in one thread. That works only when the program supplies thousands of threads, which is the bargain the CUDA model makes.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/cuda-cores">What a CUDA Core Is</a>: the lane behind the marketing number, how lanes are grouped into sub-partitions, and how to count peak throughput.</li>
<li><a href="#/gpu-occupancy">Occupancy and Per-SM Resources</a>: how registers, shared memory, and thread limits decide how many blocks an SM holds.</li>
</ul>
<p>For the full H100 SM diagram, see <a href="#/hopper/sm">Inside the SM</a> on the Hopper page. For a kernel that puts the SM's registers and shared memory to work, see <a href="#/gpu-tiling">Tiling Through Shared Memory</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An RTX 4090 has 128 SMs, each with 128 FP32 lanes, and a 2.52 GHz boost clock. How many CUDA cores does NVIDIA list, and what is the peak FP32 rate?</p>`,
        a: `<ol><li>CUDA cores = 128 SMs × 128 lanes = <strong>16,384</strong>.</li><li>Each lane does one FMA per cycle, which counts as 2 FLOPs.</li><li>Peak = 16,384 × 2 × 2.52 × 10<sup>9</sup> ≈ <strong>82.6 TFLOPS</strong> FP32.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A product sheet says a GPU has 16,384 "cores" and a 16-core desktop CPU has 16. Is the GPU 1,000 times more parallel? Make the comparison on equal terms.</p>`,
        a: `<p>No. A CUDA core is one FP32 lane with no fetch, decode, or program counter of its own. The equal-terms comparison is either lanes to lanes or SMs to cores.</p><ul><li><strong>Lanes:</strong> a Zen 5 core has two 512-bit FMA pipes, 32 FP32 FMA lanes, so a 16-core Ryzen 9 9950X has 512 "CUDA cores" by NVIDIA's count. The ratio is 16,384 / 512 = 32×, and with clocks (2.52 GHz against about 5 GHz) the peak FP32 ratio is closer to 16×.</li><li><strong>Independent instruction streams:</strong> the 4090's 128 SMs × 4 schedulers = 512 warp schedulers against the CPU's 16 cores × 2 SMT threads = 32 hardware threads that can each issue a different instruction.</li></ul><p>The real difference is how latency is hidden: the GPU keeps up to 128 × 48 = 6,144 warps resident to cover memory stalls, while the CPU covers them inside a few hundred-entry out-of-order windows.</p>`
      }
    ]
  }
}, [
{
  id: "cuda-cores",
  region: "gsm",
  title: "What a CUDA Core Is",
  sections: [
    { id: "lane", label: "A Lane, Not a Core" },
    { id: "partitions", label: "SM Sub-Partitions" },
    { id: "issue", label: "Issuing to the Lanes" },
    { id: "shared-datapath", label: "Shared FP32 and INT32 Datapaths" },
    { id: "peak", label: "Counting Peak Throughput" }
  ],
  body: `
<p>NVIDIA's "CUDA core" count is the number of FP32 lanes on the chip. It's a useful number for peak arithmetic, and a misleading one for anything else.</p>
<h3 id="sec-lane">A Lane, Not a Core</h3>
<p>A CUDA core is a pipelined FP32 (and, depending on the generation, INT32) arithmetic unit that produces one thread's result per cycle. It has no instruction fetch, no decoder, no program counter, and no register file of its own. In CPU terms it is one lane of a SIMD unit. Hennessy &amp; Patterson make the same point: what NVIDIA calls a CUDA core is a SIMD lane, and the SM is a multithreaded SIMD processor.</p>
<h3 id="sec-partitions">SM Sub-Partitions</h3>
<p>Since Volta, every SM is split into four sub-partitions (SMSPs). Each has its own warp scheduler, register file slice, and lanes, and each warp is assigned to one sub-partition for its whole life.</p>
<div class="tbl"><table>
<tr><th>SM</th><th>FP32 lanes per SM</th><th>INT32</th><th>FP64 lanes per SM</th><th>Tensor cores per SM</th></tr>
<tr><td>Volta (V100)</td><td>64</td><td>64 separate lanes</td><td>32</td><td>8</td></tr>
<tr><td>Ampere (A100)</td><td>64</td><td>64 separate lanes</td><td>32</td><td>4</td></tr>
<tr><td>Ampere (GA102) and Ada (AD102)</td><td>128, half shared with INT32</td><td>64, on the shared half</td><td>2</td><td>4</td></tr>
<tr><td>Hopper (H100)</td><td>128</td><td>64 separate lanes</td><td>64</td><td>4</td></tr>
</table></div>
<p>Data-center parts keep many FP64 lanes for HPC. Consumer parts keep 2 per SM, enough to run FP64 code correctly but at 1/64 of the FP32 rate.</p>
<h3 id="sec-issue">Issuing to the Lanes</h3>
<p>A warp instruction covers 32 threads. If the sub-partition has 32 lanes of that type, the instruction issues in one cycle. If it has 16, the instruction occupies the unit for 2 cycles, and the scheduler issues something else (to a different unit) on the second cycle. Each scheduler issues at most one warp instruction per cycle, so on Volta and A100 (16 FP32 lanes per sub-partition) a warp of pure FP32 code issues at half the scheduler's rate, and interleaved integer address math fills the other half for free.</p>
<p>Special-function units are much narrower. The CUDA guide lists 16 results per cycle per SM for <code>__sinf</code>, <code>__expf</code>, reciprocal, and reciprocal square root on compute capability 7.x through 9.0, so one such warp instruction keeps a sub-partition's 4 SFU lanes busy for 8 cycles.</p>
<h3 id="sec-shared-datapath">Shared FP32 and INT32 Datapaths</h3>
<p>GA102 (RTX 30 series) doubled the FP32 count by making the second 16-lane datapath in each sub-partition run either FP32 or INT32. The doubled peak only shows up when there's no integer work. Take NVIDIA's Turing-era estimate of 36 integer instructions per 100 FP32 instructions in games, per sub-partition:</p>
<ul>
<li><strong>Turing-style split (16 FP32 + 16 INT32):</strong> each path issues 0.5 warp instructions per cycle. FP32 takes 100 / 0.5 = 200 cycles, INT32 36 / 0.5 = 72 cycles in parallel. Total: 200 cycles.</li>
<li><strong>GA102 (16 FP32 + 16 FP32/INT32):</strong> all 136 instructions share 1 warp instruction per cycle, with the 36 INT32 on the flexible path. Total: 136 cycles.</li>
</ul>
<p>That's 200 / 136 ≈ 1.47× faster, not the 2× the lane count suggests.</p>
<h3 id="sec-peak">Counting Peak Throughput</h3>
<div class="math">\\[ \\text{Peak FLOP/s} = \\text{SMs} \\times \\text{lanes per SM} \\times 2 \\times f_{\\text{clock}} \\]</div>
<p>The 2 is for the fused multiply-add. For a V100 (80 SMs, 64 FP32 lanes, 1.53 GHz): 80 × 64 × 2 × 1.53 × 10<sup>9</sup> ≈ 15.7 TFLOPS FP32, NVIDIA's listed figure. CUDA cores are no longer where most of the FLOPs are, though. On an H100 the tensor cores deliver 989 TFLOPS of dense FP16 against 67 TFLOPS of FP32 on the CUDA cores, so for matrix math the CUDA cores mostly run the epilogue, the address math, and everything that isn't a matrix multiply (see <a href="#/gpu-kernels/tensor-cores">Tensor Cores</a>).</p>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (multithreaded SIMD processors and the GPU-to-vector terminology map) · NVIDIA, <em>CUDA C++ Programming Guide</em> (arithmetic instruction throughput table) · NVIDIA, <em>Volta</em>, <em>Ampere GA100</em>, <em>Ampere GA102</em>, <em>Turing</em>, and <em>Hopper</em> architecture whitepapers</p>`,
  practice: {
    guided: [
      {
        q: `<p>An A100 SXM has 108 SMs with 64 FP32 lanes and 32 FP64 lanes each, and a 1.41 GHz boost clock. Compute its peak FP32 and FP64 rates on the CUDA cores.</p>`,
        a: `<ol><li>FP32: 108 × 64 × 2 × 1.41 × 10<sup>9</sup> ≈ <strong>19.5 TFLOPS</strong>.</li><li>FP64: 108 × 32 × 2 × 1.41 × 10<sup>9</sup> ≈ <strong>9.7 TFLOPS</strong>, half the FP32 rate.</li><li>Both match NVIDIA's datasheet. (A100's tensor cores also run FP64 at 19.5 TFLOPS, double the CUDA-core rate.)</li></ol>`
      },
      {
        q: `<p>A shader on an RTX 3080 (GA102 SM) runs 50 integer instructions for every 100 FP32 instructions. How many cycles does one sub-partition need per 100 FP32 instructions, compared with a Turing-style split of 16 FP32 and 16 INT32 lanes?</p>`,
        a: `<ol><li>Turing-style: FP32 needs 100 / 0.5 = 200 cycles, INT32 50 / 0.5 = 100 cycles on the other path in parallel. Total: <strong>200 cycles</strong>.</li><li>GA102: all 150 instructions share 1 warp instruction per cycle, so the best case is 150 cycles. It's reachable: the paths split the work 75 and 75, with the FP-only path taking 75 FP32 and the flexible path taking all 50 INT32 plus the other 25 FP32. Total: <strong>150 cycles</strong>.</li><li>Speedup: 200 / 150 ≈ 1.33×. More integer work shrinks the benefit of the shared datapath.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A kernel on an H100 computes <code>y = __expf(x) * a + b</code> per element: one SFU instruction and one FMA per element, plus about 4 integer and load/store instructions. Assuming the data is already in registers and there are enough warps, which unit limits throughput per SM per cycle, and what's the element rate per SM?</p><p class="given">Assume the H100 rates from the CUDA guide per SM per cycle: 128 FP32 FMAs, 16 SFU results, and 64 INT32 operations. Assume the 4 SMSP schedulers each issue 1 warp instruction per cycle and the load/store instructions issue at the INT32 rate.</p>`,
        a: `<ol><li>Per element: 1 SFU op, 1 FMA, 4 integer or LD/ST ops, so 6 thread-instructions.</li><li>SFU bound: 16 elements per cycle.</li><li>FMA bound: 128 per cycle. INT bound: 64 / 4 = 16 per cycle.</li><li>Issue bound: 4 schedulers × 32 threads = 128 thread-instructions per cycle, / 6 ≈ 21 elements per cycle.</li><li>The SFU and the integer lanes tie at <strong>16 elements per SM per cycle</strong>, about 8 times below what the FMA lanes could do.</li></ol><p>Two ways out: compute some of the exponentials with a polynomial on the idle FMA lanes (some recent attention kernels do this for part of the softmax), and cut integer overhead with wider vector loads and unrolling so each address calculation covers several elements.</p>`
      }
    ]
  }
},

{
  id: "gpu-occupancy",
  region: "gsm",
  title: "Occupancy and Per-SM Resources",
  sections: [
    { id: "limits", label: "The Four Limits" },
    { id: "worked", label: "Working Out Blocks per SM" },
    { id: "granularity", label: "Allocation Granularity" },
    { id: "lower-occupancy", label: "When Higher Occupancy Doesn't Help" },
    { id: "spills", label: "Register Spills" }
  ],
  body: `
<p><strong>Occupancy</strong> is the number of warps resident on an SM divided by the maximum it can hold. Resident warps are the pool the schedulers choose from each cycle, so occupancy sets how much memory latency the SM can cover by switching (see <a href="#/warp-sched">Warp Scheduling and Latency Hiding</a>).</p>
<h3 id="sec-limits">The Four Limits</h3>
<p>A block is placed on an SM only if all of its resources fit at once, and it holds them until it finishes. Four resources can run out first:</p>
<div class="tbl"><table>
<tr><th>Per SM</th><th>A100 (8.0)</th><th>RTX 4090 (8.9)</th><th>H100 (9.0)</th></tr>
<tr><td>Warps (threads)</td><td>64 (2,048)</td><td>48 (1,536)</td><td>64 (2,048)</td></tr>
<tr><td>Blocks</td><td>32</td><td>24</td><td>32</td></tr>
<tr><td>32-bit registers</td><td>65,536</td><td>65,536</td><td>65,536</td></tr>
<tr><td>Shared memory</td><td>164 KB</td><td>100 KB</td><td>228 KB</td></tr>
</table></div>
<p>A thread may use at most 255 registers, and on compute capability 8.0 and later the runtime reserves 1 KB of shared memory per block for system use.</p>
<h3 id="sec-worked">Working Out Blocks per SM</h3>
<p>Take an H100 kernel with 256-thread blocks, 64 registers per thread, and 48 KB of shared memory per block. Each limit allows:</p>
<ul>
<li><strong>Threads:</strong> 2,048 / 256 = 8 blocks.</li>
<li><strong>Registers:</strong> 64 × 256 = 16,384 per block, 65,536 / 16,384 = 4 blocks.</li>
<li><strong>Shared memory:</strong> 48 + 1 = 49 KB per block, ⌊228 / 49⌋ = 4 blocks.</li>
<li><strong>Blocks:</strong> 32.</li>
</ul>
<p>The minimum is 4 blocks, 32 warps, so occupancy is 32 / 64 = 50%. Registers and shared memory are both binding, so cutting just one of them won't raise it.</p>
<h3 id="sec-granularity">Allocation Granularity</h3>
<p>Registers are allocated per warp in units of 256, which works out to rounding each thread's count up to a multiple of 8. A kernel using 70 registers is charged 72: 72 × 256 = 18,432 registers per block, and ⌊65,536 / 18,432⌋ = 3 blocks instead of 4. Two extra registers per thread cost a quarter of the occupancy. Nsight Compute's occupancy section and the CUDA occupancy calculator apply these rules, including a few smaller ones (warp allocation per sub-partition and shared-memory carveout steps) that this page leaves out.</p>
<h3 id="sec-lower-occupancy">When Higher Occupancy Doesn't Help</h3>
<p>Occupancy is a means, not a goal. Volkov's 2010 GTC talk, "Better Performance at Lower Occupancy," showed kernels hitting near-peak throughput at 25% occupancy or less. Two things substitute for more warps:</p>
<ul>
<li><strong>Instruction-level parallelism:</strong> if each warp has 4 independent loads in flight instead of 1, it covers the same latency as 4 warps would.</li>
<li><strong>Register blocking:</strong> a GEMM thread that keeps an 8 × 8 tile of accumulators in registers uses over 100 registers, which lowers occupancy, but each value it loads feeds 8 FMAs instead of 1.</li>
</ul>
<p>Once there are enough warps (and enough independent work per warp) to cover latency, more occupancy only adds cache pressure: more resident threads share the same L1.</p>
<h3 id="sec-spills">Register Spills</h3>
<p>Forcing fewer registers (with <code>__launch_bounds__</code> or <code>-maxrregcount</code>) can make the compiler spill values to <em>local memory</em>, which is per-thread but lives in the global address space. Spills that hit in L1 are cheap. Spills that miss go to L2 or HBM and can cost more than the occupancy they bought. The compiler reports spill bytes with <code>-Xptxas -v</code>.</p>
<p class="refs">References: NVIDIA, <em>CUDA C++ Programming Guide</em> (compute capability tables and shared-memory reservation) · NVIDIA, <em>CUDA C++ Best Practices Guide</em> (occupancy and register pressure) · Volkov, "Better Performance at Lower Occupancy," GTC 2010 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4</p>`,
  practice: {
    guided: [
      {
        q: `<p>An A100 kernel uses 128-thread blocks, 40 registers per thread, and 20 KB of shared memory per block. What is its occupancy, and which limit binds?</p>`,
        a: `<ol><li>Threads: 2,048 / 128 = 16 blocks.</li><li>Registers: 40 is already a multiple of 8. 40 × 128 = 5,120 per block, ⌊65,536 / 5,120⌋ = 12 blocks.</li><li>Shared memory: 20 + 1 = 21 KB, ⌊164 / 21⌋ = 7 blocks.</li><li>Blocks: 32.</li><li>Minimum: <strong>7 blocks</strong> = 28 warps, so occupancy = 28 / 64 = <strong>43.75%</strong>, bound by shared memory.</li></ol>`
      },
      {
        q: `<p>An RTX 4090 kernel uses 512-thread blocks and 34 registers per thread, with no shared memory. What is its occupancy?</p>`,
        a: `<ol><li>Registers round up to 40 per thread: 34 × 32 = 1,088 per warp, rounded up to a multiple of 256 is 1,280 = 40 × 32.</li><li>Registers: 40 × 512 = 20,480 per block, ⌊65,536 / 20,480⌋ = 3 blocks.</li><li>Threads: 1,536 / 512 = 3 blocks.</li><li>Both give <strong>3 blocks</strong> = 48 warps = <strong>100%</strong> occupancy.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An H100 kernel uses 128-thread blocks and 96 registers per thread, and is limited by registers. Capping it at 64 registers adds spill code that grows each warp's instructions between global loads from 40 to 44 issue cycles (the spills hit in L1). Global loads take 500 cycles. Is the cap worth it?</p><p class="given">Model each scheduler as in <a href="#/warp-sched/model">A First-Order Model</a>: a warp issues C cycles of instructions, then waits L cycles for its load. Assume blocks are spread evenly across the 4 sub-partitions and nothing else limits occupancy.</p>`,
        a: `<ol><li>96 registers: 96 × 128 = 12,288 per block, ⌊65,536 / 12,288⌋ = 5 blocks = 20 warps = 5 per scheduler.</li><li>64 registers: 8,192 per block, 8 blocks = 32 warps = 8 per scheduler.</li><li>Uncapped: issue utilization = min(1, 5 × 40 / (40 + 500)) = 200 / 540 ≈ 37%, all useful.</li><li>Capped: utilization = min(1, 8 × 44 / (44 + 500)) = 352 / 544 ≈ 64.7%, of which 40 / 44 is useful work: 58.8%.</li><li>Useful throughput ratio: 58.8 / 37.0 ≈ <strong>1.59×</strong>, so yes.</li></ol><p>The answer flips if the spills miss L1: each spill reload then adds hundreds of cycles of latency to the warp's critical path, effectively raising L. Check spill traffic with Nsight Compute's local-memory counters before trusting the cap.</p>`
      },
      {
        q: `<p>Why can a GEMM kernel at 12.5% occupancy run near peak while a stencil kernel at 100% occupancy is far from it? Explain in terms of what each warp does between stalls.</p>`,
        a: `<p>Latency hiding needs enough <em>independent instructions in flight</em>, not necessarily enough warps. A GEMM thread holds a large register tile of accumulators and issues long runs of independent FMAs (and, on recent GPUs, asynchronous tensor-core MMAs and bulk copies that run without a warp waiting on them). With software pipelining, the next tile's loads are already in flight while the current tile is being multiplied. A few warps per scheduler are enough to keep the units busy.</p><p>A stencil does a few FLOPs per value loaded, so every warp quickly stalls on a load, and the kernel is memory-bandwidth-bound. 100% occupancy lets it reach the bandwidth limit, but no amount of occupancy raises its compute utilization above its arithmetic intensity times bandwidth (the <a href="#/gen-gpus/roofline">roofline</a>).</p>`
      }
    ]
  }
}
]);
