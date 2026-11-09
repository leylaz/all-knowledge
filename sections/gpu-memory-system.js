/* Section: GPU Memory System
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gmem"). */

section({
  id: "gmem",
  name: "GPU Memory System",
  cap: "Address spaces, coalescing, and shared-memory banks",
  sections: [
    { id: "spaces", label: "Address Spaces" },
    { id: "balance", label: "Bytes per FLOP" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>A GPU's memory system is built for bandwidth, not latency. Loads take hundreds of cycles to reach HBM, and the hardware relies on many warps and wide, regular accesses to keep megabytes in flight. Most GPU tuning is about making accesses regular enough that the hardware can combine them.</p>
<h3 id="sec-spaces">Address Spaces</h3>
<div class="tbl"><table>
<tr><th>Space</th><th>Scope</th><th>Where it lives</th><th>Use</th></tr>
<tr><td>Registers</td><td>Thread</td><td>SM register file</td><td>Everything the compiler can keep there</td></tr>
<tr><td>Local</td><td>Thread</td><td>Global memory, cached in L1 and L2</td><td>Register spills, arrays indexed at run time</td></tr>
<tr><td>Shared</td><td>Block (cluster on Hopper)</td><td>SM SRAM, shared with L1</td><td>Software-managed tiles</td></tr>
<tr><td>Global</td><td>Whole grid and host</td><td>HBM or GDDR, cached in L2 and optionally L1</td><td>Inputs, outputs, anything shared across blocks</td></tr>
<tr><td>Constant</td><td>Whole grid, read-only</td><td>Global memory with a per-SM constant cache</td><td>Values every thread of a warp reads at once</td></tr>
</table></div>
<p>The L1 is not coherent across SMs. A store by one block becomes visible to another block on a different SM only through L2, after a memory fence or at kernel end. See <a href="#/gpu-tiling/hierarchy">The Memory a Kernel Sees</a> for the sizes on an H100.</p>
<h3 id="sec-balance">Bytes per FLOP</h3>
<p>An H100 SXM delivers 3.35 TB/s of HBM bandwidth and 67 TFLOPS of FP32 on its CUDA cores: about 0.05 bytes per FLOP, or 20 FLOPs for every byte read. Any kernel that does less than that per byte from HBM can't keep the CUDA cores busy, and the tensor cores need around 300 FLOPs per byte (see <a href="#/gen-gpus/roofline">the roofline</a>). On-chip reuse through shared memory, registers, and L2 is what closes that gap.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/gpu-coalescing">Memory Coalescing</a>: how a warp's 32 addresses become sector requests, and how strides and struct layouts waste bandwidth.</li>
<li><a href="#/gpu-smem">Shared Memory and Bank Conflicts</a>: the banked SRAM that kernels stage tiles in, and how to access it without serializing.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>An A100 SXM has 2.04 TB/s of HBM bandwidth, 108 SMs, a 1.41 GHz clock, and 64 FP32 FMA lanes per SM. How many bytes of HBM bandwidth does each SM get per cycle, and how many FP32 FLOPs must a kernel do per 4-byte value loaded from HBM to be compute-bound on the CUDA cores?</p>`,
        a: `<ol><li>Per SM per cycle: 2.04 × 10<sup>12</sup> / (108 × 1.41 × 10<sup>9</sup>) ≈ <strong>13.4 B</strong>.</li><li>FLOPs per SM per cycle: 64 × 2 = 128.</li><li>Ridge point: 128 / 13.4 ≈ 9.6 FLOP/B, so about 9.6 × 4 ≈ <strong>38 FLOPs per float</strong> loaded.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A kernel reads coefficients from a <code>__constant__</code> array. With <code>c[k]</code> (same <code>k</code> in every thread) it's fast. With <code>c[threadIdx.x % 32]</code> it's much slower, even though the array is tiny and always cached. Why, and what would you use instead?</p>`,
        a: `<p>The constant cache is built to broadcast: it serves one address per cycle to every thread of a warp. When the 32 threads ask for 32 different addresses, the request is serialized into 32 accesses, so the load takes about 32× as long. The fix depends on the pattern:</p><ul><li>Per-lane coefficients: put them in shared memory (32 consecutive words hit 32 different banks, so one access serves the warp) or load them through the read-only data path with <code>__ldg</code> / <code>const __restrict__</code>.</li><li>Values that are uniform per warp but vary per warp: constant memory is still right.</li></ul>`
      }
    ]
  }
}, [
{
  id: "gpu-coalescing",
  region: "gmem",
  title: "Memory Coalescing",
  sections: [
    { id: "sectors", label: "Sectors and Lines" },
    { id: "split", label: "How a Warp Request Is Split" },
    { id: "strides", label: "Strides and Offsets" },
    { id: "aos-soa", label: "Arrays of Structures" }
  ],
  body: `
<p>A warp's load instruction carries 32 addresses, one per active thread. The load/store unit groups them by memory segment and sends one request per segment touched. <strong>Coalescing</strong> is the condition where that's as few requests as the data size allows.</p>
<h3 id="sec-sectors">Sectors and Lines</h3>
<ul>
<li><strong>Sector:</strong> 32 bytes, the unit of transfer between L1, L2, and DRAM since Maxwell.</li>
<li><strong>Cache line:</strong> 128 bytes, four sectors sharing one tag. A miss fetches only the sectors that were asked for, not the whole line.</li>
</ul>
<p>So the cost of a warp access is the number of distinct 32-byte sectors its addresses touch, and the efficiency is useful bytes over bytes moved:</p>
<div class="math">\\[ \\text{efficiency} = \\frac{\\text{active threads} \\times \\text{bytes per thread}}{32 \\times \\text{sectors touched}} \\]</div>
<h3 id="sec-split">How a Warp Request Is Split</h3>
<p>For 32 threads loading consecutive, aligned 4-byte floats (<code>x[i]</code>, with i from the thread index), the warp covers exactly 128 bytes: one line, 4 sectors, 100% efficiency. Wider types work the same way: 8-byte doubles cover 256 bytes (8 sectors) and 16-byte <code>float4</code> loads cover 512 bytes (16 sectors), all at 100%. Which thread asks for which address within the range doesn't matter, as long as the set of sectors is the same.</p>
<h3 id="sec-strides">Strides and Offsets</h3>
<div class="tbl"><table>
<tr><th>Access (4-byte floats)</th><th>Bytes spanned</th><th>Sectors</th><th>Efficiency</th></tr>
<tr><td><code>x[i]</code></td><td>128</td><td>4</td><td>100%</td></tr>
<tr><td><code>x[i + 1]</code> (misaligned by one float)</td><td>128, crossing a sector boundary</td><td>5</td><td>80%</td></tr>
<tr><td><code>x[2 * i]</code></td><td>256</td><td>8</td><td>50%</td></tr>
<tr><td><code>x[8 * i]</code> or any larger stride</td><td>1,024 or more</td><td>32</td><td>12.5%</td></tr>
</table></div>
<p>Past a stride of 8 floats (32 bytes) every thread gets its own sector, and the efficiency bottoms out at 4 / 32. Column access to a row-major matrix is the usual way to hit that case.</p>
<h3 id="sec-aos-soa">Arrays of Structures</h3>
<p>An array of 16-byte structs <code>{ float x, y, z, w; }</code> where a kernel reads only <code>x</code> is a stride-4 access: 512 bytes spanned, 16 sectors, 25% efficiency. The usual fix is a structure of arrays (separate <code>x[]</code>, <code>y[]</code>, ... arrays), which makes each field's access unit-stride. If a kernel does use every field, the array of structures is fine, and loading each struct as one <code>float4</code> is better still: one instruction instead of four.</p>
<p class="refs">References: NVIDIA, <em>CUDA C++ Best Practices Guide</em> (coalesced access to global memory) · NVIDIA, <em>Nsight Compute Kernel Profiling Guide</em> (sectors per request) · Kirk and Hwu, <em>Programming Massively Parallel Processors</em>, Chapter 6 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (GPU memory structures)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A particle array stores 24-byte structs (<code>float px, py, pz, vx, vy, vz</code>), starting at an aligned address. A warp's 32 threads each read <code>p[i].px</code> for consecutive i. How many sectors does the warp touch, and what's the efficiency?</p>`,
        a: `<ol><li>Thread i reads byte offset 24i, for i from 0 to 31, so offsets run from 0 to 744.</li><li>Its sector is ⌊24i / 32⌋ = ⌊0.75i⌋. Successive values step by at most 1, so every sector from 0 to ⌊0.75 × 31⌋ = 23 is hit.</li><li>Sectors touched: <strong>24</strong> (768 bytes moved).</li><li>Efficiency = 32 × 4 / 768 = 128 / 768 ≈ <strong>16.7%</strong>.</li></ol>`
      },
      {
        q: `<p>A warp of 32 threads reads 8-byte doubles at <code>d[i + 3]</code>, where <code>d</code> is 256-byte aligned. How many sectors does it touch?</p>`,
        a: `<ol><li>Byte range: from 3 × 8 = 24 to (31 + 3) × 8 + 7 = 279.</li><li>First sector: ⌊24 / 32⌋ = 0. Last: ⌊279 / 32⌋ = 8.</li><li>Sectors 0 to 8: <strong>9 sectors</strong>, 288 bytes for 256 useful, ≈ <strong>89%</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A naive matrix transpose of an 8,192 × 8,192 float matrix reads <code>in[row][col]</code> with consecutive threads on consecutive columns, and writes <code>out[col][row]</code>. On an H100 it reaches a fraction of HBM bandwidth. Quantify the write side's waste and describe the standard fix.</p><p class="given">Assume each warp handles 32 consecutive columns of one row, every partial-sector write is sent as a full 32-byte sector transfer, and L2 can't merge the writes before they're evicted.</p>`,
        a: `<ol><li>Reads: 32 consecutive floats, 4 sectors per warp, 100% efficient.</li><li>Writes: the 32 threads write 32 different rows of <code>out</code>, 8,192 × 4 = 32 KB apart, so each 4-byte write lands in its own sector: 32 sectors, 12.5% efficient.</li><li>Traffic: the matrix is 8,192<sup>2</sup> × 4 B = 256 MB. Reads move 256 MB. Writes move 8× that, about 2 GB. Total ≈ 2.3 GB instead of 512 MB, about <strong>4.5×</strong> the ideal.</li></ol><p>The fix is a shared-memory tile: each block reads a 32 × 32 tile with coalesced loads into shared memory, synchronizes, then each warp reads a column of the tile and writes it as a coalesced row of <code>out</code>. The column read from shared memory then needs padding to avoid bank conflicts (see <a href="#/gpu-smem/padding">Padding and Swizzling</a>). In practice, L2 does merge some partial writes, which is why measured naive transposes do better than this worst case but still far below the tiled version.</p>`
      }
    ]
  }
},

{
  id: "gpu-smem",
  region: "gmem",
  title: "Shared Memory and Bank Conflicts",
  sections: [
    { id: "banks", label: "32 Banks" },
    { id: "conflicts", label: "Conflict Degree" },
    { id: "broadcast", label: "Broadcasts" },
    { id: "padding", label: "Padding and Swizzling" },
    { id: "async", label: "Asynchronous Copies" }
  ],
  body: `
<p>Shared memory is an SRAM in each SM that a block's threads read and write explicitly. It's the GPU's version of a scratchpad: no tags, no misses, about 20 to 30 cycles of latency, and up to 128 bytes per cycle per SM, but only if the accesses spread across its banks.</p>
<h3 id="sec-banks">32 Banks</h3>
<p>Shared memory is split into 32 banks, each 4 bytes wide, with successive 4-byte words in successive banks:</p>
<div class="math">\\[ \\text{bank} = \\left\\lfloor \\frac{\\text{byte address}}{4} \\right\\rfloor \\bmod 32 \\]</div>
<p>Each bank serves one 4-byte word per cycle. A warp access whose 32 words fall in 32 different banks completes in one pass.</p>
<h3 id="sec-conflicts">Conflict Degree</h3>
<p>If several threads hit <em>different words</em> in the same bank, the access is split into as many passes as the busiest bank needs: an n-way bank conflict. For threads reading 4-byte words with a stride of s words, thread t hits bank (s · t) mod 32, which touches 32 / gcd(s, 32) distinct banks:</p>
<div class="math">\\[ \\text{conflict degree} = \\gcd(s, 32) \\]</div>
<ul>
<li><strong>s = 1:</strong> conflict-free.</li>
<li><strong>s = 2:</strong> 2-way. Banks 0, 2, 4, ... each get two threads.</li>
<li><strong>Any odd s:</strong> conflict-free, since gcd(s, 32) = 1.</li>
<li><strong>s = 32</strong> (a column of a <code>float tile[32][32]</code>): 32-way. Every thread hits bank <code>col</code>, and the access takes 32 passes.</li>
</ul>
<p>Profilers report the extra passes as shared-memory "wavefronts" beyond the ideal, and the warp shows up as Short Scoreboard or MIO Throttle stalls (see <a href="#/warp-sched/stall-reasons">Reading Stall Reasons</a>).</p>
<h3 id="sec-broadcast">Broadcasts</h3>
<p>Threads that read the <em>same word</em> don't conflict: the bank reads it once and broadcasts it. So <code>tile[0][k]</code> read by every thread is one pass. That isn't true for atomics: 32 threads doing <code>atomicAdd</code> to one shared address are serialized, which is why histograms with a few hot bins are slow.</p>
<h3 id="sec-padding">Padding and Swizzling</h3>
<ul>
<li><strong>Padding:</strong> declare <code>float tile[32][33]</code>. Element (r, c) is word 33r + c, so a column (fixed c, r from 0 to 31) hits banks (r + c) mod 32: all 32 different. The cost is one wasted word per row, 3% of the tile.</li>
<li><strong>Swizzling:</strong> store element (r, c) at column c ⊕ r (XOR) instead. Both rows and columns stay conflict-free without wasting space. Real layouts swizzle 16-byte chunks rather than single words, so vector loads stay intact. CUTLASS layouts and Hopper's TMA (with its 32-, 64-, and 128-byte swizzle modes) use this form because tensor-core operand loads need dense, aligned tiles.</li>
</ul>
<h3 id="sec-async">Asynchronous Copies</h3>
<p>Classically a kernel staged a tile by loading global memory into registers and storing the registers to shared memory, which costs registers and instruction slots. Ampere added <code>cp.async</code>, which copies global memory straight into shared memory without passing through registers, and Hopper added the Tensor Memory Accelerator (TMA), which copies a whole multi-dimensional tile from one instruction and signals an asynchronous barrier when it lands. Both let a kernel double-buffer: compute on tile k while tile k + 1 is in flight. See <a href="#/hopper/async">TMA and Asynchronous Barriers</a>.</p>
<p class="refs">References: NVIDIA, <em>CUDA C++ Programming Guide</em> (shared memory banks, asynchronous copies, and TMA) · NVIDIA, <em>CUTLASS</em> documentation (swizzled shared-memory layouts) · Kirk and Hwu, <em>Programming Massively Parallel Processors</em>, Chapter 5 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4</p>`,
  practice: {
    guided: [
      {
        q: `<p>A warp reads 4-byte words from shared memory at <code>s[t * k]</code> for thread t. What's the conflict degree for k = 3, 6, 12, and 16?</p>`,
        a: `<ol><li>k = 3: gcd(3, 32) = 1, <strong>conflict-free</strong>.</li><li>k = 6: gcd(6, 32) = 2, <strong>2-way</strong>.</li><li>k = 12: gcd(12, 32) = 4, <strong>4-way</strong>.</li><li>k = 16: gcd(16, 32) = 16, <strong>16-way</strong>. Threads only reach banks 0 and 16.</li></ol>`
      },
      {
        q: `<p>A kernel stores a 64 × 64 float tile as <code>float tile[64][64]</code> and a warp reads 32 consecutive rows of one column. What's the conflict degree, and does padding to <code>[64][65]</code> fix it?</p>`,
        a: `<ol><li>Element (r, c) is word 64r + c, so its bank is (64r + c) mod 32 = c mod 32: the same bank for every row. <strong>32-way</strong>.</li><li>Padded: word 65r + c, bank (65r + c) mod 32 = (r + c) mod 32, since 65 mod 32 = 1.</li><li>For 32 consecutive rows, r + c takes 32 consecutive values, so all 32 banks are different: <strong>conflict-free</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A histogram kernel counts 8-bit pixel values into 256 shared-memory bins with <code>atomicAdd</code>. It's fast on a natural photo and 10× slower on a mostly black image. Explain the slowdown, and design a fix whose cost you can state.</p>`,
        a: `<p>On a black image most threads of a warp increment the same bin. Same-address atomics are serialized, so a warp with 32 identical values takes about 32 passes instead of about 1. (This is not a bank conflict: reads of one word would broadcast, but read-modify-writes can't.)</p><ul><li><strong>Warp aggregation:</strong> use <code>__match_any_sync</code> to find lanes holding equal values, have one leader per group add the group's size with <code>__popc</code>. A uniform warp then does 1 atomic instead of 32. Cost: a few extra instructions per element, which slightly slows the natural-image case.</li><li><strong>Privatized sub-histograms:</strong> give each warp its own 256-bin copy (1 KB per warp, 8 KB for 8 warps) and merge at the end. Cost: shared memory, which may lower occupancy, plus a merge step.</li></ul>`
      },
      {
        q: `<p>An SM's shared memory delivers 128 B per cycle. A tiled FP32 GEMM on an A100 has each thread compute a 4 × 4 output tile and read its A and B fragments from shared memory (4 floats of A and 4 of B per k step). Is shared-memory bandwidth or FP32 issue the limit, assuming conflict-free accesses? What changes with an 8 × 8 thread tile?</p><p class="given">Assume each thread reads its 4 A values and 4 B values from shared memory once per k step with no reuse across threads (no broadcast), and the SM can do 64 FP32 FMAs per cycle.</p>`,
        a: `<ol><li>Per thread per k step: 16 FMAs, and 8 floats = 32 B from shared memory.</li><li>Ratio: 32 / 16 = 2 B per FMA. At 64 FMAs per cycle the SM would need 128 B per cycle, exactly the shared-memory bandwidth, so the two limits tie and any conflict or extra load makes shared memory the bottleneck.</li><li>8 × 8 tile: 64 FMAs per 16 floats = 64 B, so 1 B per FMA: 64 B per cycle, half the bandwidth. FP32 issue becomes the limit.</li></ol><p>This is register blocking: bigger thread tiles raise FMAs per byte read from shared memory, at the cost of more registers per thread (64 accumulators alone) and lower occupancy. In real kernels, broadcast (threads sharing an A row) lowers the shared-memory load further.</p>`
      }
    ]
  }
}
]);
