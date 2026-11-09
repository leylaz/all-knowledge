/* Section: Threads and Launches
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gthr"). */

section({
  id: "gthr",
  name: "Threads and Launches",
  cap: "Grids, blocks, and warps, how blocks reach the SMs, and what a launch costs",
  sections: [
    { id: "why", label: "Why a Thread Hierarchy" },
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>The story pages in <a href="#/r/gk">GPU Kernels</a> launch kernels with a line like <code>kernel&lt;&lt;&lt;blocks, threads&gt;&gt;&gt;</code> and move on. This region explains what that line asks for: how threads are named and grouped, how the hardware places the groups on SMs, and what each launch costs.</p>
<h3 id="sec-why">Why a Thread Hierarchy</h3>
<ul>
<li><strong>Naming:</strong> every thread runs the same code, so it needs coordinates to find its own data.</li>
<li><strong>Scaling:</strong> blocks are independent, so the hardware can run them in any order on any number of SMs. The same launch runs on a laptop GPU and on an H100, just in more or fewer waves.</li>
<li><strong>Cooperation:</strong> threads in one block share an SM, so they can share fast on-chip memory and wait for each other. Threads in different blocks can't, except through global memory or a later launch.</li>
</ul>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/gpu-launch">Grids, Blocks, and Threads</a>: indexing, grid-stride loops, how blocks are placed on SMs, the thread hierarchy they form, and what a launch costs.</li>
</ul>`,
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
  id: "gpu-launch",
  region: "gthr",
  title: "Grids, Blocks, and Threads",
  sections: [
    { id: "indexing", label: "Computing an Index" },
    { id: "grid-stride", label: "Grid-Stride Loops" },
    { id: "placement", label: "How Blocks Reach the SMs" },
    { id: "hierarchy", label: "The Thread Hierarchy" },
    { id: "launch-cost", label: "Launch Overhead, Streams, and Graphs" }
  ],
  body: `
<p>A kernel is written for one thread, but an H100 holds 270,336 threads at once across 132 SMs, and a large launch creates millions. The programmer needs a way to name each thread's share of the data, and the hardware needs freedom to run those threads wherever and whenever it has room, on a GPU with 20 SMs or 132. It also needs to know which threads will cooperate, because cooperation (sharing data, waiting at a barrier) only works between threads on the same SM. The grid and block structure answers all three: coordinates for naming, independent blocks for placement, and threads within a block for cooperation.</p>
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
}
]);
