/* Section: GPU Kernels
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gk"). */

section({
  id: "gk",
  name: "GPU Kernels",
  cap: "Kernels, the thread hierarchy, launches, and fused GEMMs",
  sections: [
    { id: "host-device", label: "Host and Device" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>A GPU runs <strong>kernels</strong>: functions the CPU launches over thousands to millions of threads at once. Everything on this tab follows from that model. The kernel author writes the code for one thread, the hardware runs threads 32 at a time in warps, and performance comes from keeping enough warps resident that some are always ready while others wait on memory.</p>
<h3 id="sec-host-device">Host and Device</h3>
<ul>
<li><strong>The host (CPU)</strong> allocates device memory, copies inputs over PCIe or NVLink (or relies on unified memory), and enqueues kernel launches into a <em>stream</em>.</li>
<li><strong>The device (GPU)</strong> pulls launches from its streams in order, spreads each kernel's thread blocks across its SMs, and signals completion.</li>
<li><strong>Launches are asynchronous:</strong> the CPU returns from a launch in a few microseconds and keeps going. It only waits when it asks for a result (<code>cudaDeviceSynchronize</code>, a blocking copy, or an event).</li>
</ul>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/gpu-why">Why GPU Kernels Exist</a>: the workloads GPUs are built for, how they differ from CPUs, and a first kernel next to the CPU loop it replaces.</li>
<li><a href="#/gpu-launch">Grids, Blocks, and Threads</a>: indexing, how blocks are placed on SMs, the thread hierarchy they form, and what a launch costs.</li>
<li><a href="#/gpu-tiling">Tiled Matrix Multiply in Shared Memory</a>: the naive matrix multiply, why it is load-bound, and how shared-memory tiles with <code>__syncthreads</code> fix it.</li>
<li><a href="#/gpu-kernels">GPU Kernels and Tensor Cores</a>: a matrix-multiply kernel from the inside, epilogue fusion, and what Tensor Cores compute.</li>
</ul>
<p>The rest of the tab goes down a level: <a href="#/r/gsm">CUDA Cores and the SM</a> for the hardware a block runs on, <a href="#/r/gwarp">Warps and SIMT</a> for how its threads are issued, <a href="#/r/gmem">GPU Memory System</a> for how its loads are served, and <a href="#/r/gperf">GPU Performance Modeling</a> for predicting how fast all of it runs. For shipping hardware, see <a href="#/hopper">NVIDIA Hopper</a> and <a href="#/blackwell">NVIDIA Blackwell</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A SAXPY kernel (<code>y[i] = a * x[i] + y[i]</code>) runs over 10,000,000 floats with 256-thread blocks, one element per thread. How many blocks does the launch need, and how many threads in the last block do useful work?</p>`,
        a: `<ol><li>Blocks = ⌈10,000,000 / 256⌉ = ⌈39,062.5⌉ = <strong>39,063</strong>.</li><li>The first 39,062 blocks cover 39,062 × 256 = 9,999,872 elements.</li><li>The last block has 10,000,000 − 9,999,872 = <strong>128</strong> elements, so 128 of its 256 threads do work and the rest fail the <code>if (i &lt; n)</code> bounds check.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague moves a 4,096-element elementwise kernel from the CPU to an H100 (132 SMs, up to 64 resident warps per SM) and sees no speedup. They launch 256-thread blocks. Explain what the GPU is doing and what you'd change.</p>`,
        a: `<p>The launch has 4,096 / 256 = 16 blocks, so only 16 of 132 SMs (12%) get any work, and each of those holds 8 warps out of a possible 64. That's 128 warps for a machine that can hold 132 × 64 = 8,448. Worse, the whole kernel is a few hundred nanoseconds of work against a launch overhead of several microseconds, so launch latency dominates. Fixes, in order of impact:</p><ul><li>Fuse it into a neighboring kernel so it costs no launch at all.</li><li>Batch many such small operations into one launch.</li><li>If it must stand alone, capture the sequence in a CUDA Graph to cut per-launch CPU overhead.</li></ul><p>Changing the block size doesn't help: there's simply not enough parallel work to fill the GPU.</p>`
      }
    ]
  }
}, [
{
  id: "gpu-why",
  region: "gk",
  title: "Why GPU Kernels Exist",
  sections: [
    { id: "workloads", label: "Workloads Made of Independent Pieces" },
    { id: "cpu-vs-gpu", label: "A Few Big Cores or Many Simple Lanes" },
    { id: "first-kernel", label: "A Loop Becomes a Kernel" },
    { id: "in-use", label: "Kernels in Use Today" }
  ],
  body: `
<p>A CPU core is built to finish one instruction stream as fast as possible: it predicts branches, renames registers, and reorders hundreds of instructions to dodge every stall. That machinery costs most of the core's area and power, and it buys nothing when a workload is millions of small, identical, independent jobs. GPUs exist for those workloads, and a <strong>kernel</strong> is how you hand one to the GPU: the code for one small job, run once per job by the GPU's threads. This page starts with the workloads, then shows how the hardware differs and what a kernel looks like.</p>

<h3 id="sec-workloads">Workloads Made of Independent Pieces</h3>
<p>Three kinds of workload keep GPUs busy. Each splits into a huge number of pieces that don't depend on each other.</p>
<div class="tbl"><svg viewBox="0 0 680 236" role="img" aria-label="Three workloads made of independent pieces. Left, a neural-network layer as a matrix multiply: X, tokens by 4,096, times W, 4,096 by 14,336, gives Y, tokens by 14,336. One row of X and one column of W are highlighted, and they produce one highlighted element of Y. Middle, a game frame drawn as a grid of pixels with one pixel highlighted: a 4K frame has 8.3 million pixels, each shaded on its own. Right, a simulation grid with one cell and its four neighbors highlighted: each cell's new value depends only on its neighbors' old values." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="font-size:12px;font-weight:600;fill:var(--ink)"><text x="10" y="24">Neural-network layer</text><text x="300" y="24">Game frame</text><text x="500" y="24">Physics simulation</text></g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"><rect x="10" y="50" width="36" height="100"/><rect x="66" y="82" width="90" height="36"/><rect x="186" y="50" width="90" height="100"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="10" y="90" width="36" height="8"/><rect x="118" y="82" width="8" height="36"/></g>
<rect x="238" y="90" width="8" height="8" style="fill:var(--pad);stroke:var(--pad)"/>
<g text-anchor="middle" style="font-size:14px;fill:var(--muted)"><text x="56" y="105">×</text><text x="171" y="105">=</text></g>
<g text-anchor="middle" style="font-size:11px;font-weight:600;fill:var(--ink)"><text x="28" y="166">X</text><text x="111" y="134">W</text><text x="231" y="166">Y</text></g>
<g style="font-size:10px;fill:var(--muted)"><text x="10" y="186">X: tokens × 4,096</text><text x="10" y="200">W: 4,096 × 14,336 weights</text><text x="10" y="214">Each output is a dot product of a row of X</text><text x="10" y="228">and a column of W, independent of the rest.</text></g>
<rect x="300" y="40" width="170" height="110" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"/>
<path d="M310,40V150M320,40V150M330,40V150M340,40V150M350,40V150M360,40V150M370,40V150M380,40V150M390,40V150M400,40V150M410,40V150M420,40V150M430,40V150M440,40V150M450,40V150M460,40V150M300,50H470M300,60H470M300,70H470M300,80H470M300,90H470M300,100H470M300,110H470M300,120H470M300,130H470M300,140H470" style="fill:none;stroke:var(--rule);stroke-width:.6"/>
<rect x="380" y="90" width="10" height="10" style="fill:var(--pad);stroke:var(--pad)"/>
<g style="font-size:10px;fill:var(--muted)"><text x="300" y="172">3,840 × 2,160 = 8.3 million</text><text x="300" y="186">pixels per 4K frame. One</text><text x="300" y="200">thread shades each pixel,</text><text x="300" y="214">60 times a second.</text></g>
<rect x="500" y="40" width="160" height="110" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"/>
<path d="M520,40V150M540,40V150M560,40V150M580,40V150M600,40V150M620,40V150M640,40V150M500,62H660M500,84H660M500,106H660M500,128H660" style="fill:none;stroke:var(--rule);stroke-width:.8"/>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="580" y="62" width="20" height="22"/><rect x="560" y="84" width="20" height="22"/><rect x="600" y="84" width="20" height="22"/><rect x="580" y="106" width="20" height="22"/></g>
<rect x="580" y="84" width="20" height="22" style="fill:var(--pad);stroke:var(--pad)"/>
<g style="font-size:10px;fill:var(--muted)"><text x="500" y="172">Each cell's new value (gold)</text><text x="500" y="186">needs only its neighbors'</text><text x="500" y="200">old values (blue), so every</text><text x="500" y="214">cell updates at once.</text></g>
</svg></div>
<ul>
<li><strong>Neural networks:</strong> a layer multiplies a matrix of activations by a matrix of weights. In Llama 3 8B, each MLP up-projection multiplies tokens × 4,096 activations by a 4,096 × 14,336 weight matrix, and every one of the outputs is its own dot product. The whole model costs about 2 FLOPs per parameter per token, about 16 GFLOP per generated token.</li>
<li><strong>Graphics:</strong> a game shades every pixel of every frame with the same short program (a <em>pixel shader</em>), and each pixel's color depends only on its own inputs. A 4K display at 60 Hz needs 3,840 × 2,160 pixels/frame × 60 frames/s ≈ 498 million pixels/s, before counting the extra passes for lighting, shadows, and post-processing.</li>
<li><strong>Simulation:</strong> weather models, molecular dynamics, and fluid solvers update every cell or particle from its neighbors' values at the previous time step, so all of one step's updates can run at once.</li>
</ul>
<p>The pattern is <strong>data parallelism</strong>: the same operation on many data elements. Hennessy &amp; Patterson's Chapter 4 calls it data-level parallelism and covers the three ways hardware exploits it: vector machines, SIMD extensions such as AVX-512, and GPUs.</p>

<h3 id="sec-cpu-vs-gpu">A Few Big Cores or Many Simple Lanes</h3>
<p>Given a fixed die and power budget, a CPU spends most of it on making one thread fast. A GPU spends most of it on arithmetic lanes, keeps each lane's control simple, and hides latency by having many threads to switch between instead of by reordering instructions.</p>
<div class="tbl"><svg viewBox="0 0 680 282" role="img" aria-label="Schematic die comparison, not to scale. Left, a CPU die with 8 large cores in two rows around a shared L3 cache band. Each core is mostly control, out-of-order machinery, and private caches, with a small gold patch for its arithmetic units. Right, a GPU die with 32 small SMs in four rows around a shared L2 cache band. Each SM is mostly gold arithmetic lanes with a thin strip of control at the top." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="font-size:12px;font-weight:600;fill:var(--ink)"><text x="20" y="26">CPU: a few big out-of-order cores</text><text x="350" y="26">GPU: many SMs full of simple lanes</text></g>
<rect x="20" y="36" width="298" height="206" style="fill:none;stroke:var(--muted);stroke-width:1.2;stroke-dasharray:5 4"/>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1"><rect x="28" y="44" width="66" height="70"/><rect x="100" y="44" width="66" height="70"/><rect x="172" y="44" width="66" height="70"/><rect x="244" y="44" width="66" height="70"/><rect x="28" y="164" width="66" height="70"/><rect x="100" y="164" width="66" height="70"/><rect x="172" y="164" width="66" height="70"/><rect x="244" y="164" width="66" height="70"/></g>
<g style="fill:var(--pad);fill-opacity:.7;stroke:none"><rect x="34" y="94" width="18" height="14"/><rect x="106" y="94" width="18" height="14"/><rect x="178" y="94" width="18" height="14"/><rect x="250" y="94" width="18" height="14"/><rect x="34" y="214" width="18" height="14"/><rect x="106" y="214" width="18" height="14"/><rect x="178" y="214" width="18" height="14"/><rect x="250" y="214" width="18" height="14"/></g>
<g text-anchor="middle" style="font-size:9px;fill:var(--muted)"><text x="61" y="62">fetch, predict</text><text x="61" y="74">rename, ROB</text><text x="61" y="86">L1, L2</text><text x="133" y="62">fetch, predict</text><text x="133" y="74">rename, ROB</text><text x="133" y="86">L1, L2</text><text x="205" y="62">fetch, predict</text><text x="205" y="74">rename, ROB</text><text x="205" y="86">L1, L2</text><text x="277" y="62">fetch, predict</text><text x="277" y="74">rename, ROB</text><text x="277" y="86">L1, L2</text></g>
<rect x="28" y="120" width="282" height="38" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="169" y="143" text-anchor="middle" style="font-size:11px;fill:var(--ink)">Shared L3 cache</text>
<rect x="350" y="36" width="310" height="206" style="fill:none;stroke:var(--muted);stroke-width:1.2;stroke-dasharray:5 4"/>
<g style="fill:var(--pad);fill-opacity:.55;stroke:var(--muted);stroke-width:.8"><rect x="358" y="44" width="34" height="28"/><rect x="396" y="44" width="34" height="28"/><rect x="434" y="44" width="34" height="28"/><rect x="472" y="44" width="34" height="28"/><rect x="510" y="44" width="34" height="28"/><rect x="548" y="44" width="34" height="28"/><rect x="586" y="44" width="34" height="28"/><rect x="624" y="44" width="34" height="28"/><rect x="358" y="78" width="34" height="28"/><rect x="396" y="78" width="34" height="28"/><rect x="434" y="78" width="34" height="28"/><rect x="472" y="78" width="34" height="28"/><rect x="510" y="78" width="34" height="28"/><rect x="548" y="78" width="34" height="28"/><rect x="586" y="78" width="34" height="28"/><rect x="624" y="78" width="34" height="28"/><rect x="358" y="172" width="34" height="28"/><rect x="396" y="172" width="34" height="28"/><rect x="434" y="172" width="34" height="28"/><rect x="472" y="172" width="34" height="28"/><rect x="510" y="172" width="34" height="28"/><rect x="548" y="172" width="34" height="28"/><rect x="586" y="172" width="34" height="28"/><rect x="624" y="172" width="34" height="28"/><rect x="358" y="206" width="34" height="28"/><rect x="396" y="206" width="34" height="28"/><rect x="434" y="206" width="34" height="28"/><rect x="472" y="206" width="34" height="28"/><rect x="510" y="206" width="34" height="28"/><rect x="548" y="206" width="34" height="28"/><rect x="586" y="206" width="34" height="28"/><rect x="624" y="206" width="34" height="28"/></g>
<g style="fill:var(--surface);stroke:none"><rect x="359" y="45" width="32" height="5"/><rect x="397" y="45" width="32" height="5"/><rect x="435" y="45" width="32" height="5"/><rect x="473" y="45" width="32" height="5"/><rect x="511" y="45" width="32" height="5"/><rect x="549" y="45" width="32" height="5"/><rect x="587" y="45" width="32" height="5"/><rect x="625" y="45" width="32" height="5"/><rect x="359" y="79" width="32" height="5"/><rect x="397" y="79" width="32" height="5"/><rect x="435" y="79" width="32" height="5"/><rect x="473" y="79" width="32" height="5"/><rect x="511" y="79" width="32" height="5"/><rect x="549" y="79" width="32" height="5"/><rect x="587" y="79" width="32" height="5"/><rect x="625" y="79" width="32" height="5"/><rect x="359" y="173" width="32" height="5"/><rect x="397" y="173" width="32" height="5"/><rect x="435" y="173" width="32" height="5"/><rect x="473" y="173" width="32" height="5"/><rect x="511" y="173" width="32" height="5"/><rect x="549" y="173" width="32" height="5"/><rect x="587" y="173" width="32" height="5"/><rect x="625" y="173" width="32" height="5"/><rect x="359" y="207" width="32" height="5"/><rect x="397" y="207" width="32" height="5"/><rect x="435" y="207" width="32" height="5"/><rect x="473" y="207" width="32" height="5"/><rect x="511" y="207" width="32" height="5"/><rect x="549" y="207" width="32" height="5"/><rect x="587" y="207" width="32" height="5"/><rect x="625" y="207" width="32" height="5"/></g>
<rect x="358" y="114" width="300" height="50" style="fill:var(--surface);stroke:var(--muted);stroke-width:1"/>
<text x="508" y="135" text-anchor="middle" style="font-size:11px;fill:var(--ink)">Shared L2 cache</text>
<text x="508" y="151" text-anchor="middle" style="font-size:10px;fill:var(--muted)">(an H100 has 132 SMs, 32 drawn)</text>
<rect x="20" y="256" width="14" height="12" style="fill:var(--pad);fill-opacity:.7"/><text x="40" y="266" style="font-size:11px;fill:var(--ink)">Arithmetic lanes</text>
<rect x="160" y="256" width="14" height="12" style="fill:var(--surface);stroke:var(--muted)"/><text x="180" y="266" style="font-size:11px;fill:var(--ink)">Control, scheduling, and caches</text>
<text x="660" y="266" text-anchor="end" style="font-size:10px;fill:var(--muted)">Schematic, not to scale</text>
</svg></div>
<div class="tbl"><table>
<tr><th></th><th>AMD EPYC 9654 (Zen 4, one socket)</th><th>NVIDIA H100 SXM</th></tr>
<tr><td>Cores</td><td>96 cores</td><td>132 SMs</td></tr>
<tr><td>FP32 lanes</td><td>96 cores × 16 FMA lanes/core = 1,536</td><td>132 SMs × 128 lanes/SM = 16,896</td></tr>
<tr><td>Peak FP32</td><td>About 7.4 TFLOP/s at the 2.4 GHz base clock</td><td>About 67 TFLOP/s at 1.98 GHz</td></tr>
<tr><td>Memory bandwidth</td><td>461 GB/s (12 channels of DDR5-4800)</td><td>3.35 TB/s (HBM3)</td></tr>
<tr><td>Threads resident at once</td><td>192 (2 per core)</td><td>270,336 (2,048 per SM)</td></tr>
<tr><td>How a stall is hidden</td><td>Run later independent instructions from a 320-entry reorder buffer</td><td>Switch to another ready warp the next cycle</td></tr>
<tr><td>Power</td><td>360 W</td><td>700 W</td></tr>
</table></div>
<p>The GPU has about 9× the FP32 throughput and 7× the memory bandwidth, but only if it has hundreds of thousands of threads to run. On a single thread with branchy, dependent code, a Zen 4 core at 3.7 GHz is many times faster than one GPU thread, which runs in order at under 2 GHz and shares its instruction stream with 31 others. That's the trade: GPUs give up single-thread speed to get throughput.</p>

<h3 id="sec-first-kernel">A Loop Becomes a Kernel</h3>
<p>Here's SAXPY (\\(y \\leftarrow a x + y\\)), the "hello world" of data parallelism, written for each machine. The CPU version is a loop. The GPU version is the loop body, plus one line that works out which iteration this thread is:</p>
<div class="code-pair">
<figure><figcaption>CPU: one thread runs every iteration</figcaption>
<pre><code>void saxpy(int n, float a,
           const float *x, float *y) {
  for (int i = 0; i &lt; n; i++)
    y[i] = a * x[i] + y[i];
}



<span class="cm">// one call, one thread</span>
saxpy(n, 2.0f, x, y);</code></pre></figure>
<figure><figcaption>GPU: one thread per iteration</figcaption>
<pre><code>__global__ void saxpy(int n, float a,
                      const float *x, float *y) {
  <span class="cm">// which iteration am I?</span>
  int i = blockIdx.x * blockDim.x + threadIdx.x;
  if (i &lt; n)
    y[i] = a * x[i] + y[i];
}

<span class="cm">// launch n threads, in groups of 256</span>
saxpy&lt;&lt;&lt;(n + 255) / 256, 256&gt;&gt;&gt;(n, 2.0f, x, y);</code></pre></figure>
</div>
<ul>
<li><strong><code>__global__</code></strong> marks a function that runs on the GPU and is launched from the CPU.</li>
<li><strong>The loop is gone.</strong> The launch line <code>&lt;&lt;&lt;blocks, threads per block&gt;&gt;&gt;</code> asks for enough threads to cover all \\(n\\) elements, and each thread computes its own \\(i\\) from built-in coordinates. <a href="#/gpu-launch">Grids, Blocks, and Threads</a> covers that indexing in detail.</li>
<li><strong>The <code>if (i &lt; n)</code> check</strong> is there because threads come in groups of 256, so the last group can hang past the end of the array.</li>
<li><strong>No ordering is promised.</strong> The iterations must be independent, because the GPU runs them in whatever order and grouping it likes. A loop with a dependence between iterations (such as a running sum) needs a different algorithm, such as a tree-shaped reduction.</li>
</ul>

<h3 id="sec-in-use">Kernels in Use Today</h3>
<p>Most GPU time in the world goes to a short list of kernels, nearly all written by specialists and called through libraries:</p>
<ul>
<li><strong>GEMMs (cuBLAS, CUTLASS):</strong> matrix multiplies for every linear layer of every neural network. Most of this tab's story is about how these get fast.</li>
<li><strong>Attention (FlashAttention):</strong> one fused kernel for a transformer's attention, built so that the large matrix of attention scores never leaves the chip.</li>
<li><strong>Convolutions (cuDNN):</strong> the core of image and video models, often rewritten internally as GEMMs.</li>
<li><strong>Collectives (NCCL):</strong> kernels that move and sum data between GPUs over NVLink and the network, such as the all-reduce that combines gradients in data-parallel training.</li>
<li><strong>Graphics shaders:</strong> pixel shaders for every frame of a game, and compute shaders for culling, physics, and post-processing. Upscalers such as DLSS run a small neural network per frame on the same Tensor Cores the GEMM libraries use.</li>
</ul>
<p>The next page sorts these into a few shapes of computation and shows which ones the hardware is fast at.</p>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 4 · Kirk, Hwu, and El Hajj, <em>Programming Massively Parallel Processors</em> (4th ed.), Chapters 1 and 2 · NVIDIA, <em>H100 Tensor Core GPU Architecture</em> whitepaper · AMD, EPYC 9654 product specifications · Meta, Llama 3 8B model configuration</p>`,
  practice: {
    guided: [
      {
        q: `<p>An Intel Xeon Platinum 8480+ has 56 cores, each with 2 AVX-512 FMA units (16 FP32 lanes per unit), at a 2.0 GHz base clock. An A100 has 108 SMs with 64 FP32 lanes per SM at a 1.41 GHz boost clock. Find each chip's peak FP32 throughput. Then, if an FP32 FMA takes 4 cycles on both, how many independent FMAs must each chip have in flight every cycle to keep all its lanes busy?</p>`,
        a: `<ol><li>Xeon lanes: 56 cores × 2 units/core × 16 lanes/unit = 1,792 lanes. Peak = 1,792 lanes × 2 FLOP/FMA × 2.0 × 10<sup>9</sup> cycles/s ≈ <strong>7.17 TFLOP/s</strong>.</li><li>A100 lanes: 108 SMs × 64 lanes/SM = 6,912 lanes. Peak = 6,912 lanes × 2 FLOP/FMA × 1.41 × 10<sup>9</sup> cycles/s ≈ <strong>19.5 TFLOP/s</strong>.</li><li>In flight (Little's law, lanes × latency): Xeon 1,792 lanes × 4 cycles = <strong>7,168 FMAs</strong>, A100 6,912 lanes × 4 cycles = <strong>27,648 FMAs</strong>.</li></ol><p>The CPU finds its 7,168 inside a few threads, by reordering and by SIMD. The GPU needs nearly 4× as many just to cover FMA latency, and far more to cover memory latency of several hundred cycles, which is why it wants hundreds of thousands of threads.</p>`
      }
    ],
    interview: [
      {
        q: `<p>A photo app applies 3 × 3 filters to a 6,000 × 4,000 RGBA8 image (4 B/pixel). The choices are a Ryzen 9 7950X, which streams the image at 70 GB/s, or an RTX 4090 (1,008 GB/s) behind a PCIe 4.0 x16 link. For one filter, which is faster? How many filters in a row, with the image staying on the GPU between them, before the GPU wins, and what is the speedup at 20 filters?</p><p class="given">Assume each filter is memory-bound on both chips and reads and writes the image once (neighboring pixels come from cache), the GPU reaches its full bandwidth, and PCIe moves 25 GB/s each way, one direction at a time.</p>`,
        a: `<ol><li>Image size: 6,000 × 4,000 pixels × 4 B/pixel = 96 MB. One filter moves 96 MB read + 96 MB written = 192 MB.</li><li>CPU per filter: 192 MB / 70 GB/s ≈ 2.74 ms.</li><li>GPU per filter: 192 MB / 1,008 GB/s ≈ 0.19 ms. Transfers: 96 MB / 25 GB/s ≈ 3.84 ms up and 3.84 ms back, 7.68 ms in all.</li><li>One filter: CPU 2.74 ms against GPU 7.68 ms + 0.19 ms = 7.87 ms. <strong>The CPU wins by 2.9×</strong>, because PCIe is 40× slower than the GPU's own memory.</li><li>Break-even for \\(F\\) filters: 2.74 ms × F = 7.68 ms + 0.19 ms × F, so F = 7.68 ms / 2.55 ms ≈ 3.0. The GPU wins from <strong>4 filters</strong> on.</li><li>At 20 filters: CPU 20 × 2.74 ms ≈ 54.9 ms, GPU 7.68 ms + 20 × 0.19 ms ≈ 11.5 ms, a <strong>4.8× speedup</strong>, still well short of the 14× bandwidth ratio because the transfers are 2/3 of the GPU time.</li></ol><p>The lesson is the one that shapes real GPU software: keep data resident on the GPU and run long chains of kernels on it, because a kernel's speed doesn't matter if every call pays for a round trip over PCIe.</p>`
      }
    ]
  }
},

{
  id: "gpu-launch",
  region: "gk",
  title: "Grids, Blocks, and Threads",
  sections: [
    { id: "indexing", label: "Computing an Index" },
    { id: "grid-stride", label: "Grid-Stride Loops" },
    { id: "placement", label: "How Blocks Reach the SMs" },
    { id: "hierarchy", label: "The Thread Hierarchy" },
    { id: "launch-cost", label: "Launch Overhead, Streams, and Graphs" }
  ],
  body: `
<p>A kernel launch names a grid shape and a block shape. The <strong>grid</strong> is every thread the launch creates, split into equal <strong>blocks</strong> of up to 1,024 <strong>threads</strong>. The hardware turns that into blocks on SMs and warps on schedulers, and each thread works out which data it owns from its coordinates. This page builds up the levels one at a time, then puts them side by side in <a href="#/gpu-launch/hierarchy">The Thread Hierarchy</a>.</p>
<h3 id="sec-indexing">Computing an Index</h3>
<p>Each thread reads its position from built-in variables: <code>threadIdx</code> within its block, <code>blockIdx</code> within the grid, and the shapes <code>blockDim</code> and <code>gridDim</code>. For a 2D image:</p>
<pre><code>__global__ void scale(float *img, int w, int h, float s) {
  int x = blockIdx.x * blockDim.x + threadIdx.x;   <span class="cm">// column</span>
  int y = blockIdx.y * blockDim.y + threadIdx.y;   <span class="cm">// row</span>
  if (x &lt; w &amp;&amp; y &lt; h) img[y * w + x] *= s;
}

dim3 block(32, 8);                                 <span class="cm">// 256 threads, 8 warps</span>
dim3 grid((w + 31) / 32, (h + 7) / 8);
scale&lt;&lt;&lt;grid, block&gt;&gt;&gt;(img, w, h, 2.0f);</code></pre>
<p>Warps are formed from the block's <em>linear</em> thread id, with x varying fastest:</p>
<div class="math">\\[ \\text{tid} = t_x + t_y \\cdot D_x + t_z \\cdot D_x D_y, \\qquad \\text{warp} = \\lfloor \\text{tid} / 32 \\rfloor \\]</div>
<p>That's why the block above is 32 wide: each warp is one full row segment, so its 32 threads touch 32 consecutive floats and the load coalesces (see <a href="#/gpu-coalescing">Memory Coalescing</a>). A block of 8 × 32 would give each warp four rows of 8 floats, scattered across four separate lines.</p>
<h3 id="sec-grid-stride">Grid-Stride Loops</h3>
<p>Instead of one thread per element, a kernel can launch a fixed grid sized to the GPU and have each thread walk the array:</p>
<pre><code>for (int i = blockIdx.x * blockDim.x + threadIdx.x; i &lt; n; i += gridDim.x * blockDim.x)
  y[i] = a * x[i] + y[i];</code></pre>
<ul>
<li><strong>It works for any n</strong> without recomputing the launch shape.</li>
<li><strong>It amortizes per-thread setup</strong> (index math, loading constants) over several elements.</li>
<li><strong>Each iteration still coalesces:</strong> on every pass, neighboring threads touch neighboring elements.</li>
</ul>
<p>A common choice is a small multiple of (number of SMs × blocks that fit per SM), so the grid fills the GPU exactly.</p>
<h3 id="sec-placement">How Blocks Reach the SMs</h3>
<p>A hardware block scheduler hands blocks to SMs as long as an SM has room for another block's threads, registers, and shared memory (see <a href="#/gpu-occupancy">Occupancy and Per-SM Resources</a>). A block stays on its SM for its whole life, and when it finishes, the next one takes its place. If every block takes the same time, the grid runs in <strong>waves</strong>:</p>
<div class="math">\\[ \\text{waves} = \\left\\lceil \\frac{\\text{blocks}}{\\text{SMs} \\times \\text{blocks per SM}} \\right\\rceil, \\qquad \\text{wave efficiency} = \\frac{\\text{blocks}}{\\text{waves} \\times \\text{SMs} \\times \\text{blocks per SM}} \\]</div>
<p>On an H100 with 132 SMs and 4 blocks resident per SM, one wave is 528 blocks. A grid of 600 blocks takes 2 waves, and the second wave has only 72 blocks, so wave efficiency is 600 / 1,056 ≈ 57%. This <strong>tail effect</strong> is why GEMM libraries pick tile sizes with the SM count in mind, and why "stream-K" and split-K kernels divide the work more finely than one tile per block.</p>
<p>Inside the SM, the block's warps are divided among four sub-partitions. Each sub-partition has its own warp scheduler and 32 FP32 lanes, and each cycle its scheduler can issue one instruction from one ready warp, which all 32 threads of that warp execute together (see <a href="#/r/gwarp">Warps and SIMT</a>). Threads of one warp can exchange registers directly with shuffles. Threads of one block, which may sit in different sub-partitions, go through the SM's shared memory and <code>__syncthreads</code>.</p>
<p>Hopper adds an optional level between the block and the grid: the <strong>thread block cluster</strong>. A kernel declared with <code>__cluster_dims__(2, 1, 1)</code>, or launched with a cluster attribute, groups neighboring blocks, and the hardware guarantees that a cluster's blocks run at the same time on SMs in the same GPC. That lets them read and write each other's shared memory (distributed shared memory) and wait at a cluster-wide barrier, which ordinary blocks can't do.</p>
<h3 id="sec-hierarchy">The Thread Hierarchy</h3>
<p>Put together, the levels nest. The figure shows a small launch of the 32 × 8 blocks from <a href="#/gpu-launch/indexing">Computing an Index</a>: a 4 × 2 grid, launched with clusters of 2 blocks. Block (3,0) is enlarged. Each of its rows is one warp, because x varies fastest and a row is exactly 32 threads wide.</p>
<div class="tbl"><svg viewBox="0 0 680 252" role="img" aria-label="The thread hierarchy for one launch. On the left, a grid with gridDim (4, 2) holds 8 blocks in two rows, labeled block (0,0) to block (3,1). Adjacent pairs of blocks are outlined as clusters 0 to 3, each of 2 blocks. Block (3,0) is highlighted and enlarged on the right: it has blockDim (32, 8), drawn as 8 rows of 32 thread cells. Each row, with one value of threadIdx.y, is one warp, labeled warp 0 to warp 7. Warp 2 is shaded, covering linear thread ids 64 to 95, and inside it thread (5, 2), with linear id 69, is marked." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="14" y="24" style="font-size:12px;font-weight:600;fill:var(--ink)">Grid: gridDim = (4, 2)</text>
<rect x="14" y="32" width="304" height="206" style="fill:none;stroke:var(--muted);stroke-width:1.2;stroke-dasharray:5 4"/>
<g style="fill:none;stroke:var(--pad);stroke-width:1.2;stroke-dasharray:3 3"><rect x="26" y="44" width="136" height="88"/><rect x="174" y="44" width="136" height="88"/><rect x="26" y="140" width="136" height="88"/><rect x="174" y="140" width="136" height="88"/></g>
<g style="font-size:10px;fill:var(--pad)"><text x="32" y="56">Cluster 0</text><text x="180" y="56">Cluster 1</text><text x="32" y="152">Cluster 2</text><text x="180" y="152">Cluster 3</text></g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1"><rect x="34" y="64" width="56" height="56"/><rect x="98" y="64" width="56" height="56"/><rect x="182" y="64" width="56" height="56"/><rect x="34" y="160" width="56" height="56"/><rect x="98" y="160" width="56" height="56"/><rect x="182" y="160" width="56" height="56"/><rect x="246" y="160" width="56" height="56"/></g>
<rect x="246" y="64" width="56" height="56" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g text-anchor="middle" style="font-size:10px;fill:var(--muted)"><text x="62" y="88">Block</text><text x="126" y="88">Block</text><text x="210" y="88">Block</text><text x="62" y="184">Block</text><text x="126" y="184">Block</text><text x="210" y="184">Block</text><text x="274" y="184">Block</text></g>
<g text-anchor="middle" style="font-size:11px;fill:var(--ink)"><text x="62" y="102">(0,0)</text><text x="126" y="102">(1,0)</text><text x="210" y="102">(2,0)</text><text x="62" y="198">(0,1)</text><text x="126" y="198">(1,1)</text><text x="210" y="198">(2,1)</text><text x="274" y="198">(3,1)</text></g>
<g text-anchor="middle" style="font-size:11px;font-weight:600;fill:var(--ink)"><text x="274" y="88">Block</text><text x="274" y="102">(3,0)</text></g>
<path d="M302,64 L370,32 M302,120 L370,238" style="fill:none;stroke:var(--trace);stroke-width:1;stroke-dasharray:4 3"/>
<rect x="370" y="32" width="296" height="206" style="fill:none;stroke:var(--trace);stroke-width:1.5"/>
<text x="378" y="50" style="font-size:12px;font-weight:600;fill:var(--ink)">Block (3,0): blockDim = (32, 8)</text>
<rect x="384" y="60" width="224" height="128" style="fill:var(--trace-soft)"/>
<rect x="384" y="92" width="224" height="16" style="fill:var(--pad-soft)"/>
<rect x="419" y="92" width="7" height="16" style="fill:var(--pad)"/>
<path d="M391,60 V188 M398,60 V188 M405,60 V188 M412,60 V188 M419,60 V188 M426,60 V188 M433,60 V188 M440,60 V188 M447,60 V188 M454,60 V188 M461,60 V188 M468,60 V188 M475,60 V188 M482,60 V188 M489,60 V188 M496,60 V188 M503,60 V188 M510,60 V188 M517,60 V188 M524,60 V188 M531,60 V188 M538,60 V188 M545,60 V188 M552,60 V188 M559,60 V188 M566,60 V188 M573,60 V188 M580,60 V188 M587,60 V188 M594,60 V188 M601,60 V188 M384,76 H608 M384,92 H608 M384,108 H608 M384,124 H608 M384,140 H608 M384,156 H608 M384,172 H608" style="fill:none;stroke:var(--muted);stroke-width:.5"/>
<rect x="384" y="60" width="224" height="128" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<rect x="384" y="92" width="224" height="16" style="fill:none;stroke:var(--pad);stroke-width:1.5"/>
<g style="font-size:10px;fill:var(--muted)"><text x="614" y="72">warp 0</text><text x="614" y="88">warp 1</text><text x="614" y="120">warp 3</text><text x="614" y="136">warp 4</text><text x="614" y="152">warp 5</text><text x="614" y="168">warp 6</text><text x="614" y="184">warp 7</text></g>
<text x="614" y="104" style="font-size:10px;font-weight:600;fill:var(--pad)">warp 2</text>
<text x="608" y="201" text-anchor="end" style="font-size:10px;fill:var(--muted)">threadIdx.x = 0 → 31</text>
<path d="M422.5,108 V212" style="fill:none;stroke:var(--pad);stroke-width:1"/>
<text x="428" y="216" style="font-size:11px;fill:var(--ink)"><tspan style="font-weight:600">Thread (5, 2):</tspan> tid = 5 + 2 × 32 = 69</text>
<text x="428" y="231" style="font-size:11px;fill:var(--ink)"><tspan style="font-weight:600">Warp 2:</tspan> threadIdx.y = 2, tids 64 to 95</text>
</svg></div>
<div class="tbl"><table>
<tr><th>Level</th><th>Runs on</th><th>Can cooperate through</th><th>Limits (compute capability 9.0, Hopper)</th></tr>
<tr><td>Thread</td><td>One lane of a sub-partition</td><td>Its own registers</td><td>Up to 255 registers</td></tr>
<tr><td>Warp (32 threads)</td><td>One sub-partition's scheduler</td><td>Shuffles, votes, <code>__syncwarp</code></td><td>Fixed at 32</td></tr>
<tr><td>Block</td><td>One SM, for its whole life</td><td>Shared memory, <code>__syncthreads</code></td><td>Up to 1,024 threads</td></tr>
<tr><td>Cluster (Hopper and later)</td><td>A group of SMs in one GPC</td><td>Distributed shared memory</td><td>Up to 8 blocks portably (16 opt-in)</td></tr>
<tr><td>Grid</td><td>The whole GPU</td><td>Global memory and atomics only</td><td>Up to 2<sup>31</sup> − 1 blocks in x, 65,535 in y and z</td></tr>
</table></div>
<p>The key constraint: blocks in a grid can't wait for each other. The hardware may run them in any order and at any time, so a grid-wide dependency needs either a second kernel launch or a cooperative launch that guarantees every block is resident. Clusters are the one exception, and only within a cluster.</p>
<h3 id="sec-launch-cost">Launch Overhead, Streams, and Graphs</h3>
<ul>
<li><strong>Launch cost:</strong> a few microseconds of CPU time per launch through the driver, and around a microsecond or more of GPU-side gap between back-to-back dependent kernels. For a kernel that does 5 µs of work, that's a large fraction.</li>
<li><strong>Streams:</strong> launches in one stream run in order. Independent streams can overlap kernels with each other and with copies, which lets a small kernel share the GPU with another.</li>
<li><strong>CUDA Graphs:</strong> record a whole sequence of launches once and replay it with one call. The driver validates and sets up the work at capture time, so each replayed kernel costs much less CPU time. LLM decode loops, which launch hundreds of small kernels per token, rely on this.</li>
</ul>
<p class="refs">References: NVIDIA, <em>CUDA C++ Programming Guide</em> (programming model, thread hierarchy, and compute capability tables) · Kirk and Hwu, <em>Programming Massively Parallel Processors</em>, Chapters 2 to 4 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (GPU programming)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A kernel launches 1,000 blocks on an A100 (108 SMs). Its resource use allows 2 blocks per SM, and every block takes the same time. How many waves does it run in, and what is the wave efficiency?</p>`,
        a: `<ol><li>One wave = 108 × 2 = 216 blocks.</li><li>Waves = ⌈1,000 / 216⌉ = ⌈4.63⌉ = <strong>5</strong>.</li><li>Efficiency = 1,000 / (5 × 216) = 1,000 / 1,080 ≈ <strong>92.6%</strong>. The last wave has 1,000 − 4 × 216 = 136 blocks, so 80 of the 216 slots sit idle during it.</li></ol>`
      },
      {
        q: `<p>A kernel uses a 3D block of 16 × 4 × 4 threads. Which warp does thread (t<sub>x</sub>, t<sub>y</sub>, t<sub>z</sub>) = (5, 3, 2) belong to, and how many distinct values of t<sub>y</sub> does one warp span?</p>`,
        a: `<ol><li>D<sub>x</sub> = 16 and D<sub>x</sub>D<sub>y</sub> = 64.</li><li>tid = 5 + 3 × 16 + 2 × 64 = 5 + 48 + 128 = 181.</li><li>Warp = ⌊181 / 32⌋ = <strong>5</strong> (warp 0 is the first).</li><li>A warp is 32 consecutive tids, which is two full rows of 16 in x, so each warp spans <strong>2</strong> values of t<sub>y</sub> (and one value of t<sub>z</sub>, since 64 is a multiple of 32).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An FP16 GEMM with M = N = 3,072 runs on an H100 (132 SMs) with one block per SM. Option A uses 128 × 128 output tiles. Option B uses 256 × 128 tiles, which do twice the work per tile but, thanks to better operand reuse, take only 1.6× as long as an A tile. Which finishes first, and how far is the better one from perfect load balance?</p><p class="given">Assume every tile of one shape takes the same time, and the K dimension is the same for both.</p>`,
        a: `<ol><li>Option A: (3,072 / 128)<sup>2</sup> = 24 × 24 = 576 tiles. Waves = ⌈576 / 132⌉ = ⌈4.36⌉ = 5. Time = 5t, where t is one A-tile time.</li><li>Option B: (3,072 / 256) × (3,072 / 128) = 12 × 24 = 288 tiles. Waves = ⌈288 / 132⌉ = ⌈2.18⌉ = 3. Time = 3 × 1.6t = <strong>4.8t</strong>.</li><li>So B wins by 4%, even though its wave efficiency (288 / 396 ≈ 73%) is worse than A's (576 / 660 ≈ 87%): its per-FLOP speed more than makes up for the bigger tail.</li><li>Perfect balance with B-tile efficiency: total work = 288 × 1.6t = 460.8t, spread over 132 SMs = <strong>3.49t</strong>. B is 4.8 / 3.49 ≈ 1.38× from ideal.</li></ol><p>A stream-K kernel closes most of that gap by giving each SM an equal share of the K-loop iterations across all tiles, at the cost of fixing up partial tiles that two SMs both contributed to.</p>`
      },
      {
        q: `<p>An LLM decode step for a 32-layer model launches about 14 kernels per layer, each doing about 6 µs of GPU work at batch size 1. Launching from Python through a framework costs about 12 µs of CPU time per kernel, and back-to-back dependent kernels leave about 1 µs of gap on the GPU even when the CPU stays ahead. Estimate the step time with and without CUDA Graphs.</p><p class="given">Assume a CUDA Graph replay brings CPU cost to about 0.5 µs per kernel and leaves the 1 µs GPU-side gap unchanged.</p>`,
        a: `<ol><li>Kernels per step: 32 × 14 = 448. Each takes 6 µs + 1 µs gap = 7 µs on the GPU, so the GPU alone needs 448 × 7 µs ≈ 3.14 ms.</li><li>Without graphs: the CPU needs 12 µs per kernel, longer than the GPU's 7 µs, so the GPU drains its queue and waits for each launch. The CPU is the bottleneck: step ≈ 448 × 12 µs ≈ <strong>5.38 ms</strong>.</li><li>With graphs: CPU cost drops to 448 × 0.5 µs ≈ 0.22 ms, so the GPU is the bottleneck: step ≈ <strong>3.14 ms</strong>, a 1.7× speedup.</li></ol><p>The remaining 448 µs of GPU-side gaps (14% of the step) don't go away with graphs. Fusing kernels so there are fewer of them removes those gaps and some HBM traffic too.</p>`
      }
    ]
  }
},

{
  id: "gpu-tiling",
  region: "gk",
  title: "Tiled Matrix Multiply in Shared Memory",
  sections: [
    { id: "hierarchy", label: "The Memory a Kernel Sees" },
    { id: "naive", label: "The Naive Kernel" },
    { id: "naive-cost", label: "Where the Naive Kernel Spends Its Time" },
    { id: "tiling", label: "Tiling Through Shared Memory" },
    { id: "phases", label: "Load, Synchronize, Compute" },
    { id: "bounds", label: "Bounds Checks and the Barrier Rule" },
    { id: "savings", label: "What Tiling Saves and What It Doesn't" }
  ],
  body: `
<p>A matrix multiply written the obvious way, one thread per output element, spends nearly all its time loading operands. The classic fix is <strong>tiling</strong>: a thread block copies a square tile of each input into shared memory, synchronizes, and then every thread reuses that tile many times. This page builds the tiled kernel from the naive one on plain CUDA cores, so every step is visible. <a href="#/gpu-kernels/gemm">How a GEMM Kernel Works</a> takes the same idea to Tensor Cores and production tile sizes.</p>

<h3 id="sec-hierarchy">The Memory a Kernel Sees</h3>
<p>Each level of the hierarchy is shared by a different group of threads, and that scope decides who can reuse what.</p>
<div class="tbl"><svg viewBox="0 0 680 340" role="img" aria-label="The GPU memory hierarchy as a kernel sees it. Inside the GPU chip, SM 0 holds two resident blocks, block (0,0) and block (1,0), each of 256 threads in 8 warps. SM 1 holds block (2,0) and has a free slot for the next block. Each SM has a register file split into private per-thread slices and a shared memory and L1 array split into one slice per resident block. Below the SMs, an L2 cache of 50 megabytes is shared by all 132 SMs. Outside the chip, global memory in HBM holds 80 gigabytes at 3.35 terabytes per second." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<rect x="10" y="10" width="660" height="262" style="fill:none;stroke:var(--muted);stroke-width:1.2;stroke-dasharray:5 4"/>
<text x="20" y="27" style="font-size:11px;fill:var(--muted)">GPU chip (H100)</text>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"><rect x="30" y="38" width="270" height="180"/><rect x="320" y="38" width="270" height="180"/></g>
<g text-anchor="middle" style="font-size:13px;font-weight:600;fill:var(--ink)"><text x="165" y="56">SM 0</text><text x="455" y="56">SM 1</text></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="44" y="66" width="116" height="62"/><rect x="170" y="66" width="116" height="62"/><rect x="334" y="66" width="116" height="62"/></g>
<rect x="460" y="66" width="116" height="62" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3"/>
<g text-anchor="middle" style="font-size:12px;font-weight:600;fill:var(--ink)"><text x="102" y="86">Block (0,0)</text><text x="228" y="86">Block (1,0)</text><text x="392" y="86">Block (2,0)</text></g>
<g text-anchor="middle" style="font-size:11px;fill:var(--muted)">
<text x="102" y="103">256 threads</text><text x="102" y="118">8 warps</text>
<text x="228" y="103">256 threads</text><text x="228" y="118">8 warps</text>
<text x="392" y="103">256 threads</text><text x="392" y="118">8 warps</text>
<text x="518" y="96">free slot</text><text x="518" y="111">for the next block</text>
</g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1"><rect x="44" y="138" width="242" height="30"/><rect x="44" y="176" width="242" height="30"/><rect x="334" y="138" width="242" height="30"/><rect x="334" y="176" width="242" height="30"/></g>
<g text-anchor="middle" style="font-size:11px;font-weight:600;fill:var(--ink)"><text x="165" y="151">Register file, 256 KB</text><text x="165" y="189">Shared memory / L1, 256 KB</text><text x="455" y="151">Register file, 256 KB</text><text x="455" y="189">Shared memory / L1, 256 KB</text></g>
<g text-anchor="middle" style="font-size:10px;fill:var(--muted)"><text x="165" y="163">a private slice per thread</text><text x="165" y="201">a slice per resident block</text><text x="455" y="163">a private slice per thread</text><text x="455" y="201">a slice per resident block</text></g>
<g text-anchor="middle" style="font-size:12px;fill:var(--muted)"><text x="630" y="122">…</text><text x="630" y="140">132 SMs</text></g>
<g style="stroke:var(--muted);stroke-width:1.2"><path d="M165,218 V230 M455,218 V230 M200,260 V292 M345,260 V292 M490,260 V292"/></g>
<rect x="30" y="230" width="630" height="30" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"/>
<text x="345" y="250" text-anchor="middle" style="font-size:12px;fill:var(--ink)">L2 cache, 50 MB, shared by every SM</text>
<rect x="30" y="292" width="630" height="34" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="345" y="314" text-anchor="middle" style="font-size:12px;font-weight:600;fill:var(--ink)">Global memory (HBM), 80 GB at 3.35 TB/s, visible to every thread</text>
</svg></div>
<div class="tbl"><table>
<tr><th>Level</th><th>Shared by</th><th>Size (H100)</th><th>Load-to-use latency (V100, measured)</th></tr>
<tr><td>Registers</td><td>One thread</td><td>256 KB per SM</td><td>No load needed. A dependent FMA waits about 4 cycles.</td></tr>
<tr><td>Shared memory</td><td>One block</td><td>Up to 228 KB per SM</td><td>About 19 cycles</td></tr>
<tr><td>L1 cache</td><td>One SM</td><td>Whatever of the 256 KB isn't shared memory</td><td>About 28 cycles</td></tr>
<tr><td>L2 cache</td><td>Every SM</td><td>50 MB</td><td>About 193 cycles</td></tr>
<tr><td>HBM</td><td>Every SM</td><td>80 GB</td><td>Several hundred cycles</td></tr>
</table></div>
<p>Two points that simplified pictures often blur:</p>
<ul>
<li><strong>A block is not an SM.</strong> A block runs on one SM for its whole life, but one SM holds several blocks at once (up to 32 on Hopper), and each block sees only its own slice of shared memory. How many fit is the subject of <a href="#/gpu-occupancy">Occupancy and Per-SM Resources</a>.</li>
<li><strong>A thread is not a CUDA core.</strong> A thread is a software context: a program counter (per warp) and a slice of registers. Its warp's instructions issue onto the SM's lanes, and an SM holds up to 2,048 threads against 128 FP32 lanes. See <a href="#/cuda-cores/lane">A Lane, Not a Core</a>.</li>
</ul>
<p>Shared memory is fast but not instant: about 19 cycles is still several dependent FMAs' worth. What makes it valuable is that it's on-chip, wide (32 banks, 128 B per cycle per SM), and controlled by the program, so a block can stage data there once and then read it many times.</p>

<h3 id="sec-naive">The Naive Kernel</h3>
<p>Each thread computes one element of \\(C = AB\\), where \\(A\\) is \\(M \\times K\\), \\(B\\) is \\(K \\times N\\), and all three are row-major FP32. The host side is the standard sequence: allocate, copy in, launch, copy out.</p>
<pre><code>#include &lt;stdio.h&gt;
#include &lt;stdlib.h&gt;
#include &lt;cuda_runtime.h&gt;

__global__ void matmul_naive(float *C, const float *A, const float *B, int M, int N, int K) {
  int row = blockIdx.y * blockDim.y + threadIdx.y;
  int col = blockIdx.x * blockDim.x + threadIdx.x;
  if (row &lt; M &amp;&amp; col &lt; N) {
    float sum = 0.0f;
    for (int k = 0; k &lt; K; k++)
      sum += A[row * K + k] * B[k * N + col];        <span class="cm">// 2 global loads per FMA</span>
    C[row * N + col] = sum;
  }
}

int main(void) {
  const int M = 1024, N = 1024, K = 1024;
  size_t bytes_a = (size_t)M * K * sizeof(float);
  size_t bytes_b = (size_t)K * N * sizeof(float);
  size_t bytes_c = (size_t)M * N * sizeof(float);

  float *h_a = (float *)malloc(bytes_a), *h_b = (float *)malloc(bytes_b), *h_c = (float *)malloc(bytes_c);
  for (int i = 0; i &lt; M * K; i++) h_a[i] = 1.0f;
  for (int i = 0; i &lt; K * N; i++) h_b[i] = 1.0f;

  float *d_a, *d_b, *d_c;
  cudaMalloc(&amp;d_a, bytes_a);
  cudaMalloc(&amp;d_b, bytes_b);
  cudaMalloc(&amp;d_c, bytes_c);
  cudaMemcpy(d_a, h_a, bytes_a, cudaMemcpyHostToDevice);
  cudaMemcpy(d_b, h_b, bytes_b, cudaMemcpyHostToDevice);

  dim3 block(16, 16);                                <span class="cm">// 256 threads = 8 warps</span>
  dim3 grid((N + 15) / 16, (M + 15) / 16);           <span class="cm">// 64 × 64 blocks</span>
  matmul_naive&lt;&lt;&lt;grid, block&gt;&gt;&gt;(d_c, d_a, d_b, M, N, K);
  cudaMemcpy(h_c, d_c, bytes_c, cudaMemcpyDeviceToHost);   <span class="cm">// waits for the kernel</span>

  printf("C[0] = %.1f (expect %d)\\n", h_c[0], K);      <span class="cm">// all-ones inputs: every C entry is K</span>
  cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
  free(h_a); free(h_b); free(h_c);
  return 0;
}</code></pre>
<p>The access pattern is reasonable. With a 16 × 16 block, a warp is two rows of 16 threads (see <a href="#/gpu-launch/indexing">Computing an Index</a>). On each iteration all 32 threads read the same 16 consecutive floats of \\(B\\), 64 B in 2 sectors, and just 2 distinct floats of \\(A\\), each broadcast to 16 threads. Nothing is uncoalesced. The problem is volume.</p>

<h3 id="sec-naive-cost">Where the Naive Kernel Spends Its Time</h3>
<p>Every FMA needs two loads, and nothing a thread loads is ever reused by that thread. For \\(M = N = K = 1{,}024\\):</p>
<ul>
<li><strong>Per output element:</strong> 1,024 iterations × 2 loads/iteration = 2,048 loads = 8 KB requested, for 2,048 FLOPs.</li>
<li><strong>Whole grid:</strong> 1,048,576 elements × 8 KB/element = 8 GiB of load requests for \\(2 \\times 1{,}024^3 \\approx 2.15\\) GFLOP. That's 0.25 FLOP/B against the loads.</li>
<li><strong>Most of it doesn't reach HBM:</strong> the three matrices are 4 MiB each and fit in L2 together, and neighboring warps hit the same lines in L1. Every one of those requests still costs a load instruction, an L1 or L2 lookup, and a trip back through the load path.</li>
<li><strong>Issue becomes the limit:</strong> an SM's 32 load/store units handle about one warp-wide load per cycle, while its four schedulers can issue four warp-wide FMAs per cycle. At two loads per FMA, the kernel tops out near 1/8 of FP32 peak <em>even if every load hits L1</em>. In practice L2 latency and bandwidth pull it lower still.</li>
</ul>
<p>Threads in the same block load the same data over and over. The 16 threads in one row of the block all read the same row of \\(A\\), and the 16 threads in one column all read the same column of \\(B\\). Tiling turns that overlap into reuse.</p>

<h3 id="sec-tiling">Tiling Through Shared Memory</h3>
<p>Split the K dimension into <strong>phases</strong> of width \\(T\\) (the tile size, 16 here). In each phase, the block's \\(T \\times T\\) threads cooperatively copy one \\(T \\times T\\) tile of \\(A\\) and one of \\(B\\) into shared memory, one element per thread per tile. Then each thread runs \\(T\\) FMAs out of shared memory. The block's output tile walks along a row of tiles in \\(A\\) and down a column of tiles in \\(B\\):</p>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="Tiling a matrix multiply through shared memory. A is drawn as a 4 by 4 grid of tiles, B as a 4 by 4 grid of tiles above C, and C as a 4 by 4 grid. Block (1,2) owns one output tile of C, in tile row 1 and tile column 2. Its row of A tiles and column of B tiles are shaded and numbered phase 0 to phase 3. The phase 1 tiles are highlighted in the same color as the a_tile and b_tile arrays in the block's shared memory. In each phase every thread loads one element of each phase 1 tile, synchronizes, does T fused multiply-adds from shared memory, and synchronizes again." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"><rect x="40" y="176" width="128" height="128"/><rect x="200" y="24" width="128" height="128"/><rect x="200" y="176" width="128" height="128"/></g>
<g style="fill:var(--trace-soft);stroke:none"><rect x="40" y="208" width="128" height="32"/><rect x="264" y="24" width="32" height="128"/></g>
<g style="fill:var(--pad);fill-opacity:.55;stroke:none"><rect x="72" y="208" width="32" height="32"/><rect x="264" y="56" width="32" height="32"/></g>
<rect x="264" y="208" width="32" height="32" style="fill:var(--pad-soft);stroke:none"/>
<g style="stroke:var(--rule);stroke-width:1;fill:none"><path d="M40,208H168M40,240H168M40,272H168M72,176V304M104,176V304M136,176V304"/><path d="M200,56H328M200,88H328M200,120H328M232,24V152M264,24V152M296,24V152"/><path d="M200,208H328M200,240H328M200,272H328M232,176V304M264,176V304M296,176V304"/></g>
<g style="fill:none;stroke:var(--trace);stroke-width:1.5"><rect x="40" y="208" width="128" height="32"/><rect x="264" y="24" width="32" height="128"/></g>
<rect x="264" y="208" width="32" height="32" style="fill:none;stroke:var(--pad);stroke-width:2.5"/>
<g text-anchor="middle" style="font-size:11px;fill:var(--ink)"><text x="56" y="228">p0</text><text x="88" y="228">p1</text><text x="120" y="228">p2</text><text x="152" y="228">p3</text><text x="280" y="44">p0</text><text x="280" y="76">p1</text><text x="280" y="108">p2</text><text x="280" y="140">p3</text></g>
<g text-anchor="middle" style="font-size:13px;font-weight:600;fill:var(--ink)"><text x="104" y="322">A (M × K)</text><text x="264" y="16">B (K × N)</text><text x="264" y="322">C (M × N)</text></g>
<g style="font-size:11px;fill:var(--muted)"><text x="336" y="222">output tile of</text><text x="336" y="236">block (1,2)</text></g>
<rect x="430" y="24" width="230" height="128" style="fill:var(--surface);stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3"/>
<text x="545" y="42" text-anchor="middle" style="font-size:11px;font-weight:600;fill:var(--ink)">Shared memory of block (1,2)</text>
<g style="fill:var(--pad);fill-opacity:.55;stroke:var(--pad);stroke-width:1.2"><rect x="450" y="54" width="64" height="64"/><rect x="576" y="54" width="64" height="64"/></g>
<g text-anchor="middle" style="font-size:12px;font-family:var(--mono);fill:var(--ink)"><text x="482" y="90">a_tile</text><text x="608" y="90">b_tile</text></g>
<g text-anchor="middle" style="font-size:10px;fill:var(--muted)"><text x="482" y="136">T × T floats</text><text x="608" y="136">T × T floats</text></g>
<g style="font-size:11px;fill:var(--ink)">
<text x="430" y="186" style="font-weight:600">Phase 1 (highlighted), every thread:</text>
<text x="430" y="206">1. Load one element of A's phase-1 tile</text>
<text x="430" y="220">    and one of B's into shared memory.</text>
<text x="430" y="240">2. <tspan style="font-family:var(--mono)">__syncthreads()</tspan></text>
<text x="430" y="260">3. Do T FMAs from shared memory.</text>
<text x="430" y="280">4. <tspan style="font-family:var(--mono)">__syncthreads()</tspan>, go to phase 2.</text>
</g>
</svg></div>
<p>Each element loaded into shared memory is now read by \\(T\\) threads instead of being loaded \\(T\\) separate times: thread \\((t_y, t_x)\\) reads row \\(t_y\\) of <code>a_tile</code> and column \\(t_x\\) of <code>b_tile</code>, and every other thread in the same row or column reads the same values. The two tiles take \\(2 \\times 16 \\times 16 \\times 4\\) B = 2 KB per block, small enough that shared memory never limits occupancy here.</p>

<h3 id="sec-phases">Load, Synchronize, Compute</h3>
<p>Every phase runs the same three steps:</p>
<ol>
<li><strong>Load:</strong> thread \\((t_y, t_x)\\) copies <code>A[row][phase·T + t_x]</code> into <code>a_tile[t_y][t_x]</code> and <code>B[phase·T + t_y][col]</code> into <code>b_tile[t_y][t_x]</code>. Consecutive \\(t_x\\) read consecutive addresses in both, so the loads coalesce.</li>
<li><strong>Synchronize:</strong> <code>__syncthreads()</code> waits until every thread in the block has stored its elements.</li>
<li><strong>Compute:</strong> each thread runs <code>sum += a_tile[t_y][i] * b_tile[i][t_x]</code> for \\(i = 0 \\ldots T-1\\), then hits a second <code>__syncthreads()</code> before the next phase's load.</li>
</ol>
<p>Both barriers are needed, for opposite hazards:</p>
<ul>
<li><strong>The first is read-after-write.</strong> Thread \\((t_y, t_x)\\) reads <code>a_tile[t_y][i]</code> for every \\(i\\), and those were written by 16 other threads, half of them in a different warp. Without the barrier, a warp can start computing before another warp's loads have landed.</li>
<li><strong>The second is write-after-read.</strong> Without it, a warp that finishes computing can start the next phase's load and overwrite a tile entry that a slower warp still needs for the current phase.</li>
</ul>
<p>The inner loop is also free of bank conflicts (see <a href="#/gpu-smem/banks">32 Banks</a>). Across a warp, <code>b_tile[i][t_x]</code> hits 16 consecutive words in 16 different banks, shared by both rows of the warp. <code>a_tile[t_y][i]</code> hits two words 16 words apart, in different banks, each broadcast to 16 threads.</p>

<h3 id="sec-bounds">Bounds Checks and the Barrier Rule</h3>
<p>When \\(M\\), \\(N\\), or \\(K\\) is not a multiple of \\(T\\), the edge blocks hang off the matrix and the last phase reads past column \\(K - 1\\). The kernel handles both cases by zero-filling any tile element that falls outside its matrix:</p>
<pre><code>#define TILE 16

__global__ void matmul_tiled(float *C, const float *A, const float *B, int M, int N, int K) {
  __shared__ float a_tile[TILE][TILE];
  __shared__ float b_tile[TILE][TILE];
  int tx = threadIdx.x, ty = threadIdx.y;
  int row = blockIdx.y * TILE + ty;
  int col = blockIdx.x * TILE + tx;
  float sum = 0.0f;

  for (int phase = 0; phase &lt; (K + TILE - 1) / TILE; phase++) {
    int a_col = phase * TILE + tx;                   <span class="cm">// column of A this thread loads</span>
    int b_row = phase * TILE + ty;                   <span class="cm">// row of B this thread loads</span>
    a_tile[ty][tx] = (row &lt; M &amp;&amp; a_col &lt; K) ? A[row * K + a_col] : 0.0f;
    b_tile[ty][tx] = (b_row &lt; K &amp;&amp; col &lt; N) ? B[b_row * N + col] : 0.0f;
    __syncthreads();                                 <span class="cm">// tiles complete before anyone reads</span>

    for (int i = 0; i &lt; TILE; i++)
      sum += a_tile[ty][i] * b_tile[i][tx];
    __syncthreads();                                 <span class="cm">// everyone done before the next load</span>
  }
  if (row &lt; M &amp;&amp; col &lt; N) C[row * N + col] = sum;
}

<span class="cm">// same launch shape as the naive kernel</span>
dim3 block(TILE, TILE);
dim3 grid((N + TILE - 1) / TILE, (M + TILE - 1) / TILE);
matmul_tiled&lt;&lt;&lt;grid, block&gt;&gt;&gt;(d_c, d_a, d_b, M, N, K);</code></pre>
<ul>
<li><strong>Why zeros are safe:</strong> in the last phase, the padded columns of <code>a_tile</code> (\\(a\\_col \\ge K\\)) line up exactly with the padded rows of <code>b_tile</code> (\\(b\\_row \\ge K\\)), so each extra term is \\(0 \\times 0 = 0\\) and the sum is exact.</li>
<li><strong>The barrier rule:</strong> CUDA allows <code>__syncthreads()</code> inside a condition only if the condition is the same for every thread in the block. So threads outside \\(C\\) can't return early. They stay in the loop, load their tile elements (or zeros), reach both barriers, and skip only the final store.</li>
<li><strong>Out-of-range threads still matter:</strong> a thread with \\(row \\ge M\\) but \\(col &lt; N\\) loads a real element of \\(B\\) into <code>b_tile</code>, which the in-range threads above it need.</li>
<li><strong>Cost:</strong> the checks are two compares and a select per load, a few instructions per phase against \\(T\\) FMAs. When the dimensions are multiples of \\(T\\), every check passes and the kernel does the same work as the unchecked version. Libraries often go further and pick a specialized kernel when the dimensions are tile-aligned.</li>
</ul>

<h3 id="sec-savings">What Tiling Saves and What It Doesn't</h3>
<p>Per phase, each thread issues 2 global loads and runs \\(T\\) FMAs, so global loads per output element drop by a factor of \\(T\\):</p>
<div class="math">\\[ \\text{loads per element: } 2K \\ \\to\\ \\frac{2K}{T}, \\qquad \\text{AI}_\\text{global} = \\frac{2T \\ \\text{FLOP}}{2 \\times 4 \\ \\text{B}} = \\frac{T}{4} \\ \\text{FLOP/B} \\]</div>
<p>For \\(K = 1{,}024\\) and \\(T = 16\\), each element needs 2,048 / 16 = 128 global loads instead of 2,048, and intensity against global loads goes from 0.25 to 4 FLOP/B. The grid's load requests fall from 8 GiB to 512 MiB.</p>
<p>What tiling does <em>not</em> change is the inner loop's instruction mix: it still does two loads per FMA, now from shared memory instead of L1. The compiler can merge consecutive <code>a_tile[t_y][i]</code> reads into 128-bit loads, but <code>b_tile[i][t_x]</code> stays one load per FMA, so the kernel remains limited by load issue rather than by the FP32 lanes. Two changes fix that, and they're how real GEMMs are built:</p>
<ul>
<li><strong>Register blocking:</strong> each thread computes a small patch of outputs, say 8 × 8, keeping its 64 accumulators in registers. Per step of \\(i\\) it loads 8 values of \\(A\\) and 8 of \\(B\\) and does 64 FMAs, so loads per FMA fall from 2 to 0.25. The price is registers, which lowers occupancy (see <a href="#/gpu-occupancy/lower-occupancy">When Higher Occupancy Doesn't Help</a>).</li>
<li><strong>Bigger block tiles and pipelining:</strong> a 128 × 128 block tile multiplies global reuse, and double-buffering the tiles (asynchronous copies, see <a href="#/gpu-smem/async">Asynchronous Copies</a>) overlaps the next phase's load with this phase's math. Tensor Cores then replace the FMA loop entirely (see <a href="#/gpu-kernels/gemm">How a GEMM Kernel Works</a>).</li>
</ul>
<p class="refs">References: NVIDIA, <em>CUDA C++ Programming Guide</em> (shared memory and <code>__syncthreads</code>) · Kirk, Hwu, and El Hajj, <em>Programming Massively Parallel Processors</em> (4th ed.), Chapter 5 · Jia et al., “Dissecting the NVIDIA Volta GPU Architecture via Microbenchmarking” (2018), for the latencies · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 · <a href="https://www.youtube.com/watch?v=xewKxorikwE">Video walkthrough of naive and tiled CUDA matrix multiply</a></p>`,
  practice: {
    guided: [
      {
        q: `<p>A tiled FP32 matrix multiply with \\(T = 32\\) runs on an A100 80 GB (19.5 TFLOP/s FP32, 2.04 TB/s HBM) for \\(M = N = K = 4{,}096\\). How many threads and how much shared memory does each block use? How many global loads does each output element need, naive and tiled? What is the arithmetic intensity against global loads, and how does it compare to the ridge point?</p>`,
        a: `<ol><li>Threads: 32 × 32 = <strong>1,024 threads/block</strong>, the most a block can have. Shared memory: 2 tiles × 32 × 32 floats/tile × 4 B/float = <strong>8 KB/block</strong>.</li><li>Naive: 2 loads/FMA × 4,096 FMAs = <strong>8,192 loads/element</strong>.</li><li>Tiled: 4,096 / 32 = 128 phases, each with 2 loads, so 128 phases × 2 loads/phase = <strong>256 loads/element</strong>, 32× fewer.</li><li>Per phase each thread does 32 FMAs × 2 FLOP/FMA = 64 FLOP against 2 loads × 4 B/load = 8 B: <strong>8 FLOP/B</strong>.</li><li>Ridge = 19.5 × 10<sup>12</sup> FLOP/s / 2.04 × 10<sup>12</sup> B/s ≈ <strong>9.6 FLOP/B</strong>. Even if every tile load went to HBM, the kernel would sit just under the ridge, at most 8 / 9.6 ≈ 83% of peak. Neighboring blocks load the same tiles, so L2 hits push the effective intensity higher. The real limit is the inner loop's two shared-memory loads per FMA.</li></ol>`
      },
      {
        q: `<p>The bounds-checked tiled kernel with \\(T = 32\\) runs with \\(M = 1{,}000\\), \\(N = 600\\), \\(K = 300\\). How many blocks does the grid have, how many phases does each block run, how many columns of <code>a_tile</code> are zero-filled in the last phase, and how many threads skip the final store?</p>`,
        a: `<ol><li>Grid: ⌈600 / 32⌉ = 19 blocks in x and ⌈1,000 / 32⌉ = 32 blocks in y, so 19 × 32 = <strong>608 blocks</strong>.</li><li>Phases: ⌈300 / 32⌉ = ⌈9.375⌉ = <strong>10 phases</strong>.</li><li>The last phase (phase 9) covers k = 288 to 319, and only k = 288 to 299 exist. That leaves 12 real columns and <strong>20 zero-filled columns</strong> of <code>a_tile</code>, matched by 20 zero-filled rows of <code>b_tile</code>.</li><li>Threads: 608 blocks × 1,024 threads/block = 622,592 threads for 1,000 × 600 = 600,000 outputs, so <strong>22,592 threads</strong> skip the store. All of them still load and reach both barriers in every phase.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague "cleans up" the bounds-checked tiled kernel by adding <code>if (row &gt;= M || col &gt;= N) return;</code> as its first line and dropping the check on the final store. On tile-aligned sizes it works. On a 1,000 × 600 output it sometimes hangs and otherwise gives wrong values in in-range elements near the edges. Explain both failures.</p>`,
        a: `<ul><li><strong>The hang:</strong> in an edge block, the returning threads never reach <code>__syncthreads()</code>. CUDA allows a barrier in conditional code only if every thread in the block takes the same path, so this is undefined behavior. It can deadlock, or the barrier can release early because the exited threads are no longer counted, and then the next problem shows.</li><li><strong>The wrong values:</strong> the tiles are filled cooperatively. A thread with row ≥ M but col &lt; N was responsible for loading <code>b_tile[t_y][t_x]</code>, a real element of B that every in-range thread in column \\(t_x\\) multiplies against. Once it returns, that slot holds whatever the previous phase or another block left there, so in-range outputs in the bottom edge blocks pick up garbage terms. The same goes for <code>a_tile</code> slots owned by threads with col ≥ N.</li><li><strong>Why aligned sizes hide it:</strong> with M and N multiples of T, no thread returns, so the code is identical to the correct version.</li></ul><p>The fix is the original structure: every thread runs every phase, loads a real element or a zero, and only the final store is guarded.</p>`
      },
      {
        q: `<p>You extend the tiled kernel so each 128-thread block computes a 64 × 64 tile of C, each thread owning an 8 × 4 patch of outputs in registers. Each phase stages a 64 × 16 slice of A and a 16 × 64 slice of B (FP32) in shared memory. On an A100 80 GB (164 KB shared memory, 65,536 registers, 2,048 threads, and 32 blocks per SM, ridge ≈ 9.6 FLOP/B), find the shared-memory loads per FMA in the inner loop, the arithmetic intensity against global loads, and the blocks per SM at 64 registers per thread. Is the resulting occupancy a problem?</p><p class="given">Assume scalar shared-memory loads, and ignore the 1 KB of shared memory the driver reserves per block.</p>`,
        a: `<ol><li><strong>Inner loop:</strong> per step along k, a thread loads 8 values of A (one per output row) and 4 of B (one per output column), 12 loads, and does 8 × 4 = 32 FMAs. That's 12 loads / 32 FMAs = <strong>0.375 loads/FMA</strong>, against 2 loads/FMA for the one-output-per-thread kernel, 5.3× fewer.</li><li><strong>Global intensity:</strong> per phase the block does 2 FLOP/FMA × 64 × 64 × 16 FMAs = 131,072 FLOP and loads (64 × 16 + 16 × 64) floats × 4 B/float = 8,192 B. That's 131,072 FLOP / 8,192 B = <strong>16 FLOP/B</strong>, above the 9.6 FLOP/B ridge even with no L2 reuse at all.</li><li><strong>Blocks per SM:</strong><ul><li>Registers: 128 threads/block × 64 registers/thread = 8,192 registers/block, so 65,536 / 8,192 = 8 blocks.</li><li>Shared memory: 2,048 floats × 4 B/float = 8 KB/block, so ⌊164 KB / 8 KB⌋ = 20 blocks.</li><li>Threads: 2,048 / 128 = 16 blocks.</li><li>Block limit: 32.</li></ul>Registers win: <strong>8 blocks</strong>, 8 blocks × 4 warps/block = 32 of 64 warps, <strong>50% occupancy</strong>.</li><li><strong>Not a problem:</strong> each thread has 32 independent accumulators, so every step along k gives each warp 32 FMAs with no dependences among them. Each scheduler holds 8 warps × 32 independent FMAs, far more than the roughly 4-cycle FMA latency needs. Doubling occupancy would mean halving the per-thread patch, which brings back the shared-memory load pressure this design removed.</li></ol>`
      }
    ]
  }
},

{
  id: "gpu-kernels",
  region: "gk",
  title: "GPU Kernels and Tensor Cores",
  sections: [{ id: "kernels", label: "What a Kernel Is" }, { id: "memory", label: "Where the Data Lives" }, { id: "gemm", label: "How a GEMM Kernel Works" }, { id: "epilogue", label: "Epilogues and Fusion" }, { id: "tensor-cores", label: "Tensor Cores" }, { id: "stack", label: "Who Writes These Kernels" }],
  body: `
<p>The hardware views across these notes keep saying that some piece of work is done “by a kernel” or “on Tensor Cores.” This page covers both: what a GPU kernel is, how a matrix-multiply kernel is organized, what an epilogue is, and what Tensor Cores actually compute. For the thread hierarchy and launches, see <a href="#/gpu-launch">Grids, Blocks, and Threads</a>. For the SM and warps, see <a href="#/cuda-cores">What a CUDA Core Is</a> and <a href="#/warp-sched">Warp Scheduling and Latency Hiding</a>. For the roofline model, see <a href="#/gen-gpus/roofline">GPUs for Generative AI</a>.</p>

<h3 id="sec-kernels">What a Kernel Is</h3>
<p>A <strong>kernel</strong> is a function that runs on the GPU. The CPU launches it, and thousands of GPU threads run it at once. Every thread runs the same code; each uses its own index to pick the data it's responsible for.</p>
<ul>
<li><strong>Grid, blocks, warps, threads.</strong> A launch creates a <em>grid</em> of thread <em>blocks</em>. Each block runs on one SM, and its threads can cooperate through that SM's fast shared memory. The SM executes a block's threads in <em>warps</em> of 32.</li>
<li><strong>A model is a sequence of kernels.</strong> A forward pass is a chain of launches: a matrix multiply, then a normalization, then an activation, and so on. Each launch costs a few microseconds of overhead, and every kernel that writes its result to HBM forces the next kernel to read it back.</li>
</ul>
<p>Here's a minimal CUDA kernel: the bias + ReLU step from <a href="#/nn-basics/nn-hw">Neural network basics</a>, run as its own kernel.</p>
<pre><code><span class="cm">// y[i] = max(0, x[i] + b[i % n]) over a batch of rows of length n</span>
__global__ void bias_relu(const float *x, const float *b, float *y, int n, int total) {
  int i = blockIdx.x * blockDim.x + threadIdx.x;   <span class="cm">// this thread's element</span>
  if (i &lt; total) y[i] = fmaxf(0.0f, x[i] + b[i % n]);
}

<span class="cm">// launch enough 256-thread blocks to cover every element</span>
bias_relu&lt;&lt;&lt;(total + 255) / 256, 256&gt;&gt;&gt;(x, b, y, n, total);</code></pre>
<p>Each element costs 2 FLOPs (an add and a max) but moves 8 bytes (read <code>x</code>, write <code>y</code>; <code>b</code> stays in cache):</p>
<div class="math">\\[ \\text{AI} = \\frac{2 \\text{ FLOPs}}{8 \\text{ B}} = 0.25 \\ \\text{FLOP/B} \\]</div>
<p>That's far below the ridge point of any GPU, so on its own this kernel is purely memory-bound. That's why it's usually folded into the matrix multiply before it (see <a href="#/gpu-kernels/epilogue">Epilogues and Fusion</a>).</p>

<h3 id="sec-memory">Where the Data Lives</h3>
<p>Fast kernels are mostly about moving data down this hierarchy once and reusing it many times. Rough numbers for an NVIDIA H100 (SXM):</p>
<div class="tbl"><table>
<tr><th>Level</th><th>Shared by</th><th>Size</th><th>Notes</th></tr>
<tr><td>Registers</td><td>One thread</td><td>256 KB per SM</td><td>Where GEMM accumulators live</td></tr>
<tr><td>Shared memory / L1</td><td>One block</td><td>Up to 228 KB per SM</td><td>Software-managed; holds the tiles being multiplied</td></tr>
<tr><td>L2 cache</td><td>Whole GPU</td><td>50 MB</td><td>Catches reuse between neighboring blocks</td></tr>
<tr><td>HBM</td><td>Whole GPU</td><td>80 GB</td><td>About 3.35 TB/s; the bottleneck for memory-bound kernels</td></tr>
</table></div>
<p>Two rules follow from this:</p>
<ul>
<li><strong>Coalesce:</strong> the 32 threads of a warp should touch consecutive addresses, so one wide memory transaction serves the whole warp instead of 32 separate ones.</li>
<li><strong>Reuse:</strong> load a tile into shared memory or registers once and use each value many times before discarding it. This is cache blocking from CPU code, managed by hand.</li>
</ul>

<h3 id="sec-gemm">How a GEMM Kernel Works</h3>
<p>A matrix multiply (GEMM) of an \\(M \\times K\\) matrix by a \\(K \\times N\\) matrix is the kernel everything else is built around. A naive kernel gives each thread one element of \\(C\\) and loops over \\(K\\), reading \\(A\\) and \\(B\\) from HBM every time: about 2 FLOPs per 4 bytes in FP16, far below the ridge. The first fix, shared-memory tiles on CUDA cores, is worked through in <a href="#/gpu-tiling">Tiled Matrix Multiply in Shared Memory</a>. Real GEMM kernels use <strong>tiling</strong>:</p>
<ol>
<li><strong>Block tile:</strong> each thread block owns one \\(B_M \\times B_N\\) tile of \\(C\\), for example 128 × 128.</li>
<li><strong>K loop:</strong> the block walks along \\(K\\) in steps of \\(B_K\\). At each step it copies a \\(B_M \\times B_K\\) slice of \\(A\\) and a \\(B_K \\times B_N\\) slice of \\(B\\) from HBM into shared memory.</li>
<li><strong>Warp tiles:</strong> each warp multiplies its part of those slices on Tensor Cores.</li>
<li><strong>Accumulators stay in registers</strong> for the whole K loop. \\(C\\) is written to HBM only once, at the end, in the <em>epilogue</em>.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 340" role="img" aria-label="Tiling a matrix multiply. Matrix A is M by K on the left, B is K by N on top, and C is M by N at the bottom right. One block tile of C, B_M by B_N, is highlighted. Its row panel of A and column panel of B are shaded, and within them the current B_K slices are highlighted: at each K step the block copies one slice of A and one slice of B into shared memory and accumulates their product." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"><rect x="100" y="160" width="120" height="140"/><rect x="250" y="20" width="300" height="120"/><rect x="250" y="160" width="300" height="140"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="100" y="200" width="120" height="40"/><rect x="340" y="20" width="60" height="120"/></g>
<g style="fill:var(--pad);fill-opacity:.45;stroke:var(--pad);stroke-width:1.5"><rect x="140" y="200" width="30" height="40"/><rect x="340" y="60" width="60" height="30"/></g>
<rect x="340" y="200" width="60" height="40" style="fill:var(--pad);stroke:var(--pad);stroke-width:1.5"/>
<g text-anchor="middle" style="font-size:13px;font-weight:600;fill:var(--ink)"><text x="160" y="318">A (M × K)</text><text x="400" y="14">B (K × N)</text><text x="400" y="318">C (M × N)</text></g>
<g style="font-size:11px;fill:var(--muted)">
<text x="92" y="224" text-anchor="end">row panel</text>
<text x="408" y="40" text-anchor="start">column panel</text>
<text x="155" y="194" text-anchor="middle">B<tspan baseline-shift="sub" style="font-size:8px">M</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">K</tspan> slice</text>
<text x="408" y="79" text-anchor="start">B<tspan baseline-shift="sub" style="font-size:8px">K</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">N</tspan> slice</text>
<text x="408" y="224" text-anchor="start">block tile B<tspan baseline-shift="sub" style="font-size:8px">M</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">N</tspan></text>
<text x="408" y="238" text-anchor="start">(accumulates in registers)</text>
</g>
<g style="stroke:var(--pad);stroke-width:1.2;stroke-dasharray:4 3;fill:none"><path d="M170,220 L340,220"/><path d="M370,90 L370,200"/></g>
<text x="565" y="170" style="font-size:11px;fill:var(--muted)" text-anchor="start">Each K step: copy</text>
<text x="565" y="184" style="font-size:11px;fill:var(--muted)" text-anchor="start">both gold slices to</text>
<text x="565" y="198" style="font-size:11px;fill:var(--muted)" text-anchor="start">shared memory,</text>
<text x="565" y="212" style="font-size:11px;fill:var(--muted)" text-anchor="start">multiply on Tensor</text>
<text x="565" y="226" style="font-size:11px;fill:var(--muted)" text-anchor="start">Cores, add into the</text>
<text x="565" y="240" style="font-size:11px;fill:var(--muted)" text-anchor="start">tile. Then slide</text>
<text x="565" y="254" style="font-size:11px;fill:var(--muted)" text-anchor="start">both slices along K.</text>
</svg></div>
<p>Per K step, the block does \\(2 B_M B_N B_K\\) FLOPs and loads \\((B_M + B_N) B_K\\) FP16 values at 2 bytes each, so the arithmetic intensity of its HBM traffic is:</p>
<div class="math">\\[ \\text{AI} = \\frac{2\\,B_M B_N B_K}{2\\,(B_M + B_N)\\,B_K} = \\frac{B_M B_N}{B_M + B_N} \\ \\text{FLOP/B} \\]</div>
<p>A 128 × 128 tile gives 64 FLOP/byte. Neighboring blocks load the same slices of \\(A\\) and \\(B\\), so L2 hits raise the effective intensity above that. Bigger tiles mean more reuse, limited by how much shared memory and how many registers each SM has. Fast kernels also <strong>pipeline</strong> the K loop: while the Tensor Cores work on one slice, the next one is already being copied in (on Hopper, by the Tensor Memory Accelerator, TMA).</p>

<h3 id="sec-epilogue">Epilogues and Fusion</h3>
<p>When the K loop finishes, the block's results are still sitting in registers. Anything elementwise that comes next can be applied right there, before \\(C\\) is written to HBM. That final stage is the <strong>epilogue</strong>. BLAS bakes the simplest one into the GEMM definition:</p>
<div class="math">\\[ C \\leftarrow \\alpha AB + \\beta C \\]</div>
<ul>
<li><strong>Bias for free:</strong> preload \\(C\\) with the bias and set \\(\\beta = 1\\), and the bias add rides along with the GEMM.</li>
<li><strong>Fused epilogues:</strong> cuBLASLt and CUTLASS can also apply ReLU or GELU, add a residual, or rescale to FP8 in the epilogue.</li>
<li><strong>What fusion saves:</strong> a whole kernel launch and an HBM round trip for every fused operation. The bias + ReLU kernel above disappears entirely, along with its 8 bytes per element.</li>
<li><strong>The extreme case:</strong> fusing an entire attention computation into one kernel, so the large score matrix never touches HBM. That's FlashAttention (see the practice problems in <a href="#/gen-gpus">GPUs for generative AI</a>).</li>
</ul>

<h3 id="sec-tensor-cores">Tensor Cores</h3>
<p>A <strong>Tensor Core</strong> is a unit inside each SM that performs a small matrix multiply-accumulate (MMA) as a single operation:</p>
<div class="math">\\[ D = A \\cdot B + C \\]</div>
<p>\\(A\\) and \\(B\\) are small low-precision tiles (FP16, BF16, FP8); \\(C\\) and \\(D\\) are usually FP32 accumulators. A whole warp issues the instruction together. For example, the PTX instruction <code>mma.sync.m16n8k16</code> (available since Ampere) multiplies a 16 × 16 tile of \\(A\\) by a 16 × 8 tile of \\(B\\) and adds the result to a 16 × 8 tile of \\(C\\):</p>
<div class="math">\\[ m \\times n \\times k = 16 \\times 8 \\times 16 = 2{,}048 \\text{ FMAs} = 4{,}096 \\text{ FLOPs per warp instruction} \\]</div>
<p>A regular FP32 FMA instruction does 32 FMAs per warp, one per thread. One Tensor Core instruction does 64 times that work with a single fetch, decode, and issue. Peak dense throughput on an H100 (SXM):</p>
<div class="tbl"><table>
<tr><th>Math</th><th>Runs on</th><th>Peak dense TFLOP/s</th></tr>
<tr><td>FP32</td><td>Regular CUDA cores</td><td>67</td></tr>
<tr><td>TF32</td><td>Tensor Cores</td><td>495</td></tr>
<tr><td>FP16 / BF16</td><td>Tensor Cores</td><td>989</td></tr>
<tr><td>FP8</td><td>Tensor Cores</td><td>1,979</td></tr>
</table></div>
<h4>How They've Evolved</h4>
<ul>
<li><strong>Volta (V100, 2017):</strong> the first Tensor Cores; FP16 inputs with FP32 accumulation.</li>
<li><strong>Ampere (A100):</strong> added BF16, TF32, and 2:4 structured sparsity.</li>
<li><strong>Hopper (H100):</strong> added FP8, and warpgroup MMA (<code>wgmma</code>), where four warps (128 threads) issue one larger MMA that reads its inputs straight from shared memory. The TMA copies tiles in asynchronously.</li>
<li><strong>Blackwell (B200):</strong> added FP6 and FP4, and <code>tcgen05</code> MMA instructions whose accumulators live in a dedicated tensor memory instead of the register file.</li>
</ul>
<h4>Why They're So Much Faster</h4>
<ul>
<li><strong>Amortized control:</strong> one instruction launches thousands of FMAs, so the energy of fetching, decoding, and scheduling instructions is spread thin.</li>
<li><strong>Reuse inside the unit:</strong> in an \\(m \\times n \\times k\\) MMA, each value of \\(A\\) is used \\(n\\) times and each value of \\(B\\) is used \\(m\\) times without another register-file read. Reading operands costs more energy than the multiply itself.</li>
<li><strong>Low precision:</strong> a multiplier's area grows roughly with the square of its mantissa width, so FP16 and FP8 multipliers are much smaller than FP32 ones, and many more fit in the same area.</li>
<li><strong>FP32 accumulation</strong> keeps long sums accurate even when the inputs are low precision.</li>
</ul>
<p>The catch: Tensor Cores only speed up matrix multiplies of reasonable size. Elementwise work, reductions, and softmax still run on the regular CUDA cores. And if tiles can't be delivered fast enough, the Tensor Cores sit idle. Tiling, the TMA, and fusion exist to keep them fed.</p>

<h3 id="sec-stack">Who Writes These Kernels</h3>
<ul>
<li><strong>Vendor libraries:</strong> cuBLAS and cuBLASLt for GEMMs, cuDNN for convolutions and attention. Most frameworks call these underneath.</li>
<li><strong>Templates:</strong> CUTLASS, NVIDIA's C++ templates for building custom GEMMs and epilogues.</li>
<li><strong>Kernel languages:</strong> Triton lets you write block-level kernels in Python while its compiler handles warps, shared memory, and Tensor Cores. PyTorch's <code>torch.compile</code> generates Triton kernels.</li>
<li><strong>Profiling:</strong> Nsight Compute reports a kernel's achieved FLOP/s, memory throughput, and where it sits on the roofline: the GPU version of the counter-based analysis in <a href="#/perf-stats">Performance statistics</a>.</li>
</ul>
<p class="refs">Textbook connection: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 4, Data-Level Parallelism in Vector, SIMD, and GPU Architectures (the GPU programming and memory model), and Chapter 7, Domain-Specific Architectures (matrix units like the TPU's). H100 figures are from NVIDIA's H100 specifications; the <code>mma</code> shapes are from NVIDIA's PTX ISA documentation.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A CUTLASS-style GEMM kernel uses 256 × 128 block tiles with \\(B_K = 64\\) in FP16. Per K step, how many FLOPs does a block do, how many bytes does it load, and what's the arithmetic intensity? What changes with 128 × 64 tiles? Compare both with an A100's ridge point (312 TFLOP/s FP16, 2.04 TB/s).</p>`,
        a: `<ol><li>FLOPs: \\(2 \\times 256 \\times 128 \\times 64 = 4{,}194{,}304\\).</li><li>Bytes: \\((256 + 128) \\times 64\\) values \\(\\times\\) 2 B \\(= 49{,}152\\) B.</li><li>Intensity: \\(4{,}194{,}304 / 49{,}152 \\approx\\) <strong>85 FLOP/byte</strong>, matching \\(B_M B_N / (B_M + B_N) = 256 \\cdot 128 / 384\\).</li><li>With 128 × 64 tiles: \\(128 \\cdot 64 / 192 \\approx\\) <strong>43 FLOP/byte</strong>. Smaller tiles, less reuse.</li><li>A100 ridge: \\(312 / 2.04 \\approx\\) <strong>153 FLOP/byte</strong>. Neither tile reaches it from HBM alone; L2 hits between neighboring blocks make up the difference, which is why tile scheduling order (rasterization) matters.</li></ol>`
      },
      {
        q: `<p>During prefill, Llama 3 8B's MLP up-projection multiplies 2,048 tokens × 4,096 hidden by a 4,096 × 14,336 weight matrix. How many <code>mma.sync.m16n8k16</code> instructions is that, and how long would it take at an A100's FP16 peak of 312 TFLOP/s? How long at 75% of peak, which is typical for real kernels?</p>`,
        a: `<ol><li>Shape: \\(M = 2{,}048\\), \\(N = 14{,}336\\), \\(K = 4{,}096\\). FMAs: \\(MNK \\approx 1.20 \\times 10^{11}\\).</li><li>Each instruction does 2,048 FMAs, so \\(MNK / 2{,}048 = 14{,}336 \\times 4{,}096 \\approx\\) <strong>58.7 million</strong> warp-level MMA instructions.</li><li>FLOPs: \\(2MNK \\approx 2.41 \\times 10^{11}\\). At 312 TFLOP/s: about <strong>770 µs</strong>. At 75% of peak: 770 / 0.75 ≈ <strong>1.03 ms</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>In BERT-large (hidden size 1,024), the feed-forward up-projection produces a 4,096-wide output per token, followed by a bias add and GELU. For a batch of 32 sequences × 512 tokens in FP16 on an A100 (2.04 TB/s, 312 TFLOP/s), estimate what fusing the bias and GELU into the GEMM's epilogue saves.</p>`,
        a: `<ol><li>Tokens: \\(32 \\times 512 = 16{,}384\\). Output: \\(16{,}384 \\times 4{,}096 \\times 2\\) B ≈ <strong>134 MB</strong>.</li><li>Unfused: the bias kernel reads and writes it (268 MB), and the GELU kernel does the same (268 MB): about <strong>537 MB</strong> of extra HBM traffic, plus two extra launches.</li><li>At 2.04 TB/s that's about <strong>263 µs</strong>.</li><li>The GEMM itself (\\(2 \\times 16{,}384 \\times 1{,}024 \\times 4{,}096\\) FLOPs) takes about 440 µs at peak. So the unfused elementwise kernels add roughly 60% on top, and fusion removes nearly all of it.</li></ol>`
      },
      {
        q: `<p>A large FP16 GEMM runs about 16× faster on an A100's Tensor Cores (312 TFLOP/s) than the same math in FP32 on CUDA cores (19.5 TFLOP/s). Why? And why does a 256 × 256 × 64 GEMM (one attention head's \\(QK^\\top\\) for a 256-token sequence with head dimension 64) see almost none of that speedup? Assume the kernel uses 128 × 128 output tiles, the A100 has 108 SMs, and a kernel launch costs about 3 µs.</p>`,
        a: `<p>The big GEMM is compute-bound, so its speed tracks peak throughput: \\(312 / 19.5 = 16\\times\\). That gap comes from amortizing instruction overhead over thousands of FMAs, reusing operands inside the unit, and smaller low-precision multipliers.</p><p>The small GEMM is \\(2 \\times 256 \\times 256 \\times 64 \\approx 8.4\\) MFLOP: about 27 ns of work at peak. With 128 × 128 tiles it's only 4 blocks, so 4 of the A100's 108 SMs have anything to do, and the 3 µs launch alone is over 100× the 27 ns of math. Fixes: batch all heads and sequences into one launch (batched GEMM), or fuse the whole attention computation into one kernel, as FlashAttention does.</p>`
      }
    ]
  }
}
]);
