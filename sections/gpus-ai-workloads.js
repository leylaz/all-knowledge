/* Section: GPUs for AI Workloads
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gai"). */

section({
  id: "gai",
  name: "GPUs for AI Workloads",
  cap: "Where GEMMs, attention, and decode land on a GPU",
  sections: [
    { id: "map", label: "Workloads and Their Bounds" }
  ],
  body: `
<p>AI workloads reduce to a few kinds of GPU work, and each kind hits a different limit. Knowing which one a step is in tells you which of this tab's mechanisms matters for it.</p>
<h3 id="sec-map">Workloads and Their Bounds</h3>
<div class="tbl"><table>
<tr><th>Work</th><th>Usual bound</th><th>What moves it</th></tr>
<tr><td>Large GEMMs (training, prefill)</td><td>Tensor-core throughput</td><td><ul><li>Lower precision</li><li>Tile shapes that fill every SM (<a href="#/gpu-launch/placement">waves</a>)</li></ul></td></tr>
<tr><td>Decode at small batch</td><td>HBM bandwidth (reading weights)</td><td><ul><li>Batching</li><li>Weight quantization</li></ul></td></tr>
<tr><td>Elementwise and normalization</td><td>HBM bandwidth</td><td>Fusion into a neighboring GEMM (<a href="#/gpu-kernels/epilogue">epilogues</a>)</td></tr>
<tr><td>Attention over long sequences</td><td>HBM traffic for the score matrix, unless tiled</td><td>Tiling in shared memory (FlashAttention)</td></tr>
<tr><td>Multi-GPU layers</td><td>NVLink or network bandwidth</td><td>Overlapping communication with compute</td></tr>
</table></div>
<p>The page below works through each one: <a href="#/gen-gpus">GPUs for Generative AI</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Llama 3 8B in FP16 runs on an RTX 4090 with 1.01 TB/s of memory bandwidth. Estimate the decode upper bound in tokens per second at batch size 1, ignoring the KV cache.</p>`,
        a: `<ol><li>Weights: 8 × 10<sup>9</sup> × 2 bytes = 16 GB, read once per token.</li><li>Time per token ≥ 16 GB / 1.01 TB/s ≈ 15.8 ms.</li><li>Upper bound ≈ <strong>63 tokens/s</strong>. The 24 GB card holds the weights with about 8 GB left for the KV cache and activations.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>At what batch size does FP16 decode stop being memory-bound on an H100, and why do real servers see the crossover at a different point?</p><p class="given">Assume 989 TFLOP/s of dense FP16 tensor throughput and 3.35 TB/s of HBM bandwidth, 2 FLOPs per parameter per sequence per token, and that weights are read once per step for the whole batch.</p>`,
        a: `<ol><li>Ridge point: 989 / 3.35 ≈ 295 FLOP/B.</li><li>Per step, each parameter costs 2 bytes and 2B FLOPs for batch B, so the intensity is about B FLOP/B.</li><li>Crossover: <strong>B ≈ 295</strong>.</li></ol><p>In practice the KV cache moves it. Each sequence reads its own KV cache every step, and that traffic grows with batch size and context length without any reuse across the batch, so attention stays memory-bound at any batch size. Long contexts can also run out of HBM capacity for the KV cache well before batch 295. Quantized weights (FP8 or 4-bit) lower the bytes per parameter, which lowers the crossover batch if compute stays at FP16 rates or raises the ridge if compute moves to FP8.</p>`
      }
    ]
  }
}, [
{
  id: "gen-gpus",
  region: "gai",
  title: "GPUs for Generative AI",
  sections: [
    { id: "gpu-arch", label: "GPU Architecture" },
    { id: "roofline", label: "Roofline" },
    { id: "llm-bound", label: "LLM Inference" },
    { id: "diff-gpu", label: "Diffusion on GPUs" },
    { id: "scaling-past-gpu", label: "Scaling Past One GPU" },
    { id: "energy-question", label: "The Energy Question" },
    { id: "perf-modeling", label: "Connecting to Performance Modeling" }
  ],
  body: `
<p>Generative models are huge piles of matrix math repeated many times. GPUs became the standard platform because they deliver enormous parallel arithmetic and memory bandwidth, and their software stack makes that usable.</p>
<h3 id="sec-gpu-arch">GPU Architecture in Brief</h3>
<p>Three features of the hardware matter most for AI. Each has its own page on this tab:</p>
<ul>
<li><strong>Latency hiding by parallelism:</strong> thousands of resident threads in warps of 32, instead of big caches and out-of-order execution. See <a href="#/warp-sched">Warp Scheduling and Latency Hiding</a>.</li>
<li><strong>Tensor Cores:</strong> small matrix multiply-accumulates at low precision (FP16, BF16, FP8), providing most of the FLOP/s for AI. See <a href="#/gpu-kernels/tensor-cores">Tensor Cores</a>.</li>
<li><strong>HBM plus on-chip reuse:</strong> several TB/s from stacked DRAM, and large register files and shared memory so kernels reuse data instead of rereading it. See <a href="#/r/gmem">GPU Memory System</a>.</li>
</ul>
<h3 id="sec-roofline">The Roofline Model</h3>
<p>Whether a kernel is limited by arithmetic or by memory depends on its <strong>arithmetic intensity</strong>, the FLOPs done per byte moved from memory:</p>
<p class="eq">Attainable FLOP/s = min( peak FLOP/s, memory bandwidth × arithmetic intensity )</p>
<p>The <strong>ridge point</strong> is peak FLOP/s ÷ bandwidth. Kernels below it are memory-bound; above it, compute-bound. For a GPU with about 1,000 TFLOP/s of FP16 and 3.35 TB/s, the ridge is about 300 FLOP/byte.</p>
<ul><li><strong>Large matrix multiply (N × N × N):</strong> intensity ≈ N/3 FLOP/byte in FP16, so big GEMMs are compute-bound.</li><li><strong>Elementwise operations</strong> (activations, normalization): a few FLOPs per byte, so memory-bound. Fusing them into the matrix-multiply kernel avoids extra memory trips.</li></ul>
<h3 id="sec-llm-bound">LLM Inference: Prefill vs. Decode</h3>
<p>Prefill runs every prompt token through the network at once, so its matrix multiplies are large and compute-bound. Decode generates one token at a time and reads every weight for each one, at about 1 FLOP per byte in FP16, so it's memory-bound:</p>
<p class="eq">Tokens/s per sequence ≤ <span class="frac"><span>memory bandwidth</span><span>model size in bytes</span></span></p>
<p>Batching, the KV cache, and quantization all move this bound. They're covered in <a href="#/llm-phases">Prefill and Decode</a>, <a href="#/llm-kvcache">The KV Cache</a>, and <a href="#/llm-faster">Making Inference Faster</a>.</p>
<h3 id="sec-diff-gpu">Diffusion on GPUs</h3>
<p>Each denoising step runs a convolution- or attention-heavy network over the entire latent at once: large, regular, parallel work that keeps Tensor Cores busy (compute-bound). The cost is the sequential chain of steps, so latency = steps × time per step. Random noise for each step comes from fast parallel generators, a small cost next to the network itself.</p>
<h3 id="sec-scaling-past-gpu">Scaling Past One GPU</h3>
<p>Big models are split across GPUs with tensor parallelism (each layer's matrices divided among GPUs) and pipeline parallelism (different layers on different GPUs), connected by high-bandwidth links. Communication between GPUs then becomes another bottleneck to model.</p>
<h3 id="sec-energy-question">The Energy Question</h3>
<p>Moving data costs far more energy than computing on it, and GPUs spend energy enforcing exact, deterministic arithmetic even for workloads like sampling that are inherently random. That's the motivation for alternative hardware: more on-chip memory, lower precision, specialized accelerators, and probabilistic or thermodynamic designs that compute with physical noise.</p>
<h3 id="sec-perf-modeling">Connecting to Performance Modeling</h3>
<p>The same questions from CPU work apply: what's the bottleneck (compute, memory bandwidth, latency, communication), what's the arithmetic intensity, how well are the units utilized (occupancy, warp divergence, memory coalescing), and how does a design change move the workload on the roofline? <a href="#/r/gperf">GPU Performance Modeling</a> covers the models that answer them.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 70-billion-parameter LLM stored in FP16 runs on a GPU with 3.35 TB/s of memory bandwidth. Estimate the maximum tokens per second at batch size 1, and the aggregate rate at batch size 32 (ignore the KV cache).</p>`,
        a: `<ol><li>Weights: 70 × 10<sup>9</sup> × 2 bytes = 140 GB, all read once per generated token.</li><li>Time per token ≥ 140 GB / 3.35 TB/s ≈ 42 ms, so at most <strong>about 24 tokens/s</strong>.</li><li>At batch 32, the same weight read serves 32 sequences per step, so the step still takes about 42 ms while it stays memory-bound: about 32 × 24 ≈ <strong>760 tokens/s</strong> in aggregate.</li><li>Real numbers are lower (KV cache traffic, imperfect bandwidth use), and a 140 GB model needs more than one GPU's memory anyway.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A GPU offers about 1,000 TFLOP/s (FP16) and 3.35 TB/s. Is a 4096 × 4096 × 4096 FP16 matrix multiply compute-bound or memory-bound? What about LLM decode at batch 1?</p>`,
        a: `<p>Ridge point = 1,000 × 10<sup>12</sup> / 3.35 × 10<sup>12</sup> ≈ <strong>300 FLOP/byte</strong>.</p><p>GEMM: 2N<sup>3</sup> FLOPs over about 3N<sup>2</sup> × 2 bytes moved gives an intensity of N/3 ≈ 1,365 FLOP/byte, well above the ridge, so it's <strong>compute-bound</strong>. Decode at batch 1: about 2 FLOPs per parameter per token and 2 bytes per parameter, so about 1 FLOP/byte, far below the ridge, so it's <strong>memory-bound</strong>, using well under 1% of peak FLOP/s.</p>`
      },
      {
        q: `<p>Why does FlashAttention speed up attention without changing the math?</p>`,
        a: `<p>Standard attention writes the full N × N score matrix to GPU memory (HBM), reads it back for softmax, and reads it again to multiply by V: huge memory traffic for long sequences. FlashAttention splits Q, K, and V into tiles that fit in on-chip shared memory, computes softmax incrementally (tracking running maximums and sums), and never writes the full N × N matrix to HBM. Same results, far fewer bytes moved, so higher arithmetic intensity. It's a memory-hierarchy optimization, the same idea as cache blocking in CPU code.</p>`
      }
    ]
  }
}
]);
