/* Section: AVX and SIMD
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "avx"). */

section({
  id: "avx",
  name: "AVX and SIMD",
  cap: "x86 vector instructions compared with scalar ones, and SIMD inside a performance model",
  sections: [{ id: "pages", label: "How the Pages Fit Together" }],
  body: `
<p>AVX is the family of x86 extensions that operate on 256-bit and 512-bit registers: one instruction adds 8 floats, compares 16 tags, or does 16 multiply-adds. These pages look at AVX from the programmer's side, in C with intrinsics. The hardware side (vector datapaths, register width versus execution width, frequency) is on <a href="#/simd">SIMD and Vector Execution</a>.</p>
<p>A CPU performance modeler meets AVX twice. The workloads being modeled use it, so the model has to time vector instructions correctly. And the model itself is a program full of searches over small arrays (tags, source operands, store addresses), which are exactly the operations SIMD makes cheap.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/avx-vs-scalar">AVX Versus Scalar Instructions</a>: the extensions, one loop written scalar and with intrinsics, a side-by-side comparison, how to write intrinsics, and when vectors don't pay.</li>
<li><a href="#/avx-in-models">AVX in a CPU Performance Model</a>: using SIMD to speed up tag lookup, wakeup, store-to-load forwarding search, and branch predictors, and what a model must capture when the simulated program runs AVX code.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A Sapphire Rapids core has 16 general-purpose registers of 64 bits and 32 AVX-512 registers of 512 bits. How many bytes does each register file hold architecturally, and how many FP64 values fit in the vector registers at once?</p>`,
        a: `<ol>
<li>General-purpose: 16 registers × 64 bits/register = 1,024 bits = 128 B.</li>
<li>Vector: 32 registers × 512 bits/register = 16,384 bits = <strong>2,048 B</strong>, 16 times the general-purpose file.</li>
<li>FP64 values: 512 bits/register / 64 bits/value = 8 values/register, and 32 registers × 8 values/register = <strong>256 values</strong>.</li>
<li>That capacity is why AVX-512 matrix kernels can keep a large block of accumulators in registers, and why the physical vector register file is one of the larger structures in the core.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your manager asks whether the team's cache and core model, written in C, should be rewritten with AVX-512 intrinsics to run faster. What do you check before saying yes?</p>`,
        a: `<ul>
<li><strong>Where the time goes:</strong> profile on real traces. SIMD only helps the searches and scans in the hot functions, and Amdahl's law caps the total gain by their share of run time.</li>
<li><strong>Data layout:</strong> vectors need the searched fields contiguous (struct of arrays). If the structures are arrays of structs, the layout change is the real work, and it often helps even without intrinsics.</li>
<li><strong>Which hosts run the model:</strong> Intel client cores from Alder Lake on have no AVX-512, and AMD has it only from Zen 4. Code must check at run time (<code>__builtin_cpu_supports</code>) and keep an AVX2 or scalar path.</li>
<li><strong>Whether the compiler already vectorizes it:</strong> check <code>-fopt-info-vec</code>. A <code>restrict</code> or a layout change may get the same code without intrinsics.</li>
<li><strong>Correctness and determinism:</strong> the model's results must not change. Integer compares are exact, but reordered floating-point sums in statistics can change the last digits, which breaks regression tests that compare output text.</li>
<li><strong>Maintenance cost:</strong> intrinsics are harder to read and modify. Keep them in a few small functions with a scalar reference version and a test that compares the two.</li>
</ul>`
      }
    ]
  }
}, [
{
  id: "avx-vs-scalar",
  region: "avx",
  title: "AVX Versus Scalar Instructions",
  sections: [
    { id: "ext", label: "The Extensions" },
    { id: "loop", label: "One Loop Three Ways" },
    { id: "compare", label: "Scalar and Vector Side by Side" },
    { id: "intrin", label: "Writing Intrinsics" },
    { id: "masks", label: "Conditions Become Masks" },
    { id: "nopay", label: "When Vectors Don't Pay" },
    { id: "auto", label: "Auto-Vectorization" }
  ],
  body: `
<p>A scalar instruction such as <code>add</code> or <code>addss</code> operates on one value. A vector instruction applies the same operation to every <em>lane</em> of a register: 8 FP32 lanes in a 256-bit <code>ymm</code> register, 16 in a 512-bit <code>zmm</code>. The fetch, decode, rename, scheduling, and retire work is paid once per instruction, so it is shared by all the lanes. That sharing is where SIMD's speed and energy advantage comes from.</p>

<h3 id="sec-ext">The Extensions</h3>
<div class="tbl"><table>
<tr><th>Extension</th><th>First shipped</th><th>Registers</th><th>What it added</th></tr>
<tr><td>SSE, SSE2</td><td>Pentium III (1999), Pentium 4 (2001)</td><td>16 <code>xmm</code> of 128 bits in 64-bit mode</td><td>FP32, then FP64 and integer lanes. SSE2 is part of baseline x86-64, so every 64-bit x86 CPU has it.</td></tr>
<tr><td>SSE3 to SSE4.2</td><td>2004 to 2008</td><td>Same</td><td>Horizontal adds, byte shuffles (<code>pshufb</code>), blends, dot products, string compares</td></tr>
<tr><td>AVX</td><td>Sandy Bridge (2011), AMD Bulldozer (2011)</td><td>16 <code>ymm</code> of 256 bits</td><td>256-bit FP, and the VEX encoding with non-destructive three-operand forms</td></tr>
<tr><td>AVX2, FMA3</td><td>Haswell (2013), AMD Excavator (2015)</td><td>Same</td><td>256-bit integer lanes, gathers, lane-crossing permutes (<code>vpermd</code>), and fused multiply-add</td></tr>
<tr><td>AVX-512</td><td>Knights Landing (2016), Skylake-SP (2017), AMD Zen 4 (2022)</td><td>32 <code>zmm</code> of 512 bits, plus 8 mask registers <code>k0</code> to <code>k7</code></td><td>The EVEX encoding, per-lane masking, scatters, compress and expand, embedded broadcast, and later subsets (VNNI, BF16, FP16)</td></tr>
<tr><td>AVX10</td><td>Granite Rapids (2024)</td><td>Same as AVX-512</td><td>AVX-512's subsets versioned as one numbered level, so software checks one version instead of a dozen feature flags</td></tr>
</table></div>
<p>Intel's hybrid client chips from Alder Lake on disable AVX-512 because their E-cores lack it. They offer AVX-VNNI, a 256-bit VEX encoding of the dot-product instructions, instead.</p>

<h3 id="sec-loop">One Loop Three Ways</h3>
<p>Adding two FP32 arrays, first as plain C:</p>
<pre><code>void add(float *restrict c, const float *restrict a,
         const float *restrict b, int n) {
    for (int i = 0; i &lt; n; i++) c[i] = a[i] + b[i];
}</code></pre>
<p>Compiled for baseline x86-64 without vectorization, each element costs a load, an add with a memory operand, a store, and the loop overhead:</p>
<pre><code>.L4: movss  xmm0, DWORD PTR [rsi+rax*4]     ; load a[i]
     addss  xmm0, DWORD PTR [rdx+rax*4]     ; + b[i]
     movss  DWORD PTR [rdi+rax*4], xmm0     ; store c[i]
     add    rax, 1
     cmp    rax, r8
     jne    .L4                             ; 6 instructions per element</code></pre>
<p>With AVX2 intrinsics (<code>#include &lt;immintrin.h&gt;</code>, compiled with <code>-mavx2</code>), each iteration handles 8 elements, and a scalar loop finishes the remainder:</p>
<pre><code>int i = 0;
for (; i + 8 &lt;= n; i += 8) {
    __m256 va = _mm256_loadu_ps(a + i);
    __m256 vb = _mm256_loadu_ps(b + i);
    _mm256_storeu_ps(c + i, _mm256_add_ps(va, vb));
}
for (; i &lt; n; i++) c[i] = a[i] + b[i];     // tail: at most 7 elements</code></pre>
<pre><code>.L5: vmovups ymm0, YMMWORD PTR [rsi+rax]
     vaddps  ymm0, ymm0, YMMWORD PTR [rdx+rax]
     vmovups YMMWORD PTR [rdi+rax], ymm0
     add     rax, 32
     cmp     rax, r8
     jne     .L5                            ; 6 instructions per 8 elements</code></pre>
<p>The instruction count per element drops by 8 times. Whether time drops by 8 times depends on what limits the loop: here, with all three arrays in L1, the limit is the core's load and store ports, and each vector load or store moves 32 B instead of 4 B. Once the arrays outgrow the caches, memory bandwidth sets the speed for both versions.</p>

<h3 id="sec-compare">Scalar and Vector Side by Side</h3>
<div class="tbl"><table>
<tr><th>Property</th><th>Scalar (<code>addss</code>, <code>add</code>)</th><th>AVX2 (<code>vaddps ymm</code>)</th><th>AVX-512 (<code>vaddps zmm</code>)</th></tr>
<tr><td>FP32 elements per instruction</td><td>1</td><td>8</td><td>16</td></tr>
<tr><td>Latency on Skylake</td><td>4 cycles</td><td>4 cycles</td><td>4 cycles</td></tr>
<tr><td>Throughput on Skylake-SP (2 FMA units)</td><td>2 per cycle</td><td>2 per cycle</td><td>2 per cycle</td></tr>
<tr><td>Encoding length (register form)</td><td>4 B (<code>F3 0F 58 /r</code>)</td><td>4 B (2-byte VEX prefix)</td><td>6 B (4-byte EVEX prefix)</td></tr>
<tr><td>Architectural registers</td><td>16 general-purpose, 16 <code>xmm</code></td><td>16 <code>ymm</code></td><td>32 <code>zmm</code></td></tr>
<tr><td>Bytes per load</td><td>4 B to 8 B</td><td>32 B: crosses a 64 B line on half of the unaligned addresses</td><td>64 B: crosses a line on every unaligned address</td></tr>
<tr><td>Conditionals</td><td>Branches</td><td>Compare to a lane mask, then blend</td><td>Compare into a <code>k</code> mask register that any instruction can apply</td></tr>
<tr><td>Loop tail</td><td>None</td><td>Scalar remainder loop</td><td>One masked iteration</td></tr>
<tr><td>Frequency effect</td><td>None</td><td>Lower turbo under heavy FMA load on Skylake-era Intel</td><td>Larger drop on Skylake-SP, small on Ice Lake and later, none on AMD</td></tr>
<tr><td>Data-dependent addresses</td><td>Native</td><td>Gather: one load per element, slower</td><td>Gather and scatter: one access per element</td></tr>
</table></div>
<p>Latency and throughput per instruction are the same, so the speedup comes entirely from doing more work per instruction. That also means a vector dependency chain is exactly as slow as a scalar one: a sum into one <code>ymm</code> accumulator still waits the full add latency between iterations, and needs several accumulators to reach the throughput limit.</p>

<h3 id="sec-intrin">Writing Intrinsics</h3>
<p>Intrinsics are C functions that the compiler turns into one instruction each (usually), while still doing register allocation and scheduling itself. Their names follow a pattern, <code>_mm&lt;width&gt;_&lt;operation&gt;_&lt;element type&gt;</code>:</p>
<ul>
<li><strong>Width:</strong> <code>_mm_</code> is 128 bits, <code>_mm256_</code> 256 bits, <code>_mm512_</code> 512 bits.</li>
<li><strong>Element type:</strong> <code>ps</code> is packed single (FP32), <code>pd</code> packed double, <code>epi8</code> to <code>epi64</code> signed integers of that width, <code>epu</code> unsigned, and <code>si256</code> the whole register as bits.</li>
<li><strong>Types:</strong> <code>__m256</code> (8 floats), <code>__m256d</code> (4 doubles), <code>__m256i</code> (any integers), and <code>__mmask16</code> (an AVX-512 mask).</li>
</ul>
<div class="tbl"><table>
<tr><th>Intrinsic</th><th>Instruction</th><th>Does</th></tr>
<tr><td><code>_mm256_loadu_ps(p)</code></td><td><code>vmovups</code></td><td>Load 8 floats from any address (<code>load_ps</code> requires 32 B alignment)</td></tr>
<tr><td><code>_mm256_set1_epi32(x)</code></td><td><code>vpbroadcastd</code></td><td>Copy <code>x</code> into all 8 lanes</td></tr>
<tr><td><code>_mm256_fmadd_ps(a, b, c)</code></td><td><code>vfmadd...ps</code></td><td>a × b + c in each lane, rounded once</td></tr>
<tr><td><code>_mm256_cmpeq_epi32(a, b)</code></td><td><code>vpcmpeqd</code></td><td>All ones in each lane where a equals b, zeros elsewhere</td></tr>
<tr><td><code>_mm256_movemask_ps(v)</code></td><td><code>vmovmskps</code></td><td>Top bit of each lane into an ordinary 8-bit integer</td></tr>
<tr><td><code>_mm512_cmpeq_epi32_mask(a, b)</code></td><td><code>vpcmpeqd k</code></td><td>Compare 16 lanes straight into a mask register</td></tr>
<tr><td><code>_mm512_mask_add_ps(src, k, a, b)</code></td><td><code>vaddps zmm{k}</code></td><td>Add only in lanes where <code>k</code> is set, keep <code>src</code> elsewhere</td></tr>
</table></div>
<ul>
<li><strong>Enabling the instructions:</strong> compile with <code>-mavx2 -mfma</code> (or <code>-march=haswell</code>, or <code>-march=native</code>), or mark single functions with <code>__attribute__((target("avx2,fma")))</code>.</li>
<li><strong>Dispatching at run time:</strong> a binary that must also run on older or AVX-512-less hosts checks <code>__builtin_cpu_supports("avx512f")</code> once at startup and picks a function pointer.</li>
<li><strong>Horizontal operations are the slow part:</strong> summing the 8 lanes of one register takes a lane extract and several shuffles and adds. Keep work vertical (lane by lane) inside the loop and reduce once at the end.</li>
</ul>

<h3 id="sec-masks">Conditions Become Masks</h3>
<p>Vector code can't branch per lane, so an <code>if</code> becomes a compare that produces a mask, and the mask selects results:</p>
<pre><code>// scalar: for (i) y[i] = (x[i] &gt; 0) ? x[i] : 0;
__m256 v = _mm256_loadu_ps(x + i);
__m256 m = _mm256_cmp_ps(v, _mm256_setzero_ps(), _CMP_GT_OQ);   // lanes where x &gt; 0
_mm256_storeu_ps(y + i, _mm256_and_ps(v, m));                   // keep those, zero the rest

// AVX-512: compare into k, and the store itself is masked
__mmask16 k = _mm512_cmp_ps_mask(v16, _mm512_setzero_ps(), _CMP_GT_OQ);
_mm512_mask_storeu_ps(y + i, k, v16);   // lanes with k = 0 are not written</code></pre>
<p>A mask can also come back to scalar code as an integer (<code>movemask</code> in AVX2, a <code>k</code> register in AVX-512), where <code>tzcnt</code> finds the first set lane and <code>popcnt</code> counts them. That combination, compare many lanes then bit-scan the mask, is the core of most search code and of the simulator uses on <a href="#/avx-in-models">AVX in a CPU Performance Model</a>. A masked AVX-512 load or store also suppresses faults in masked-off lanes, so a loop's tail can run as one masked iteration without reading past the end of the array.</p>

<h3 id="sec-nopay">When Vectors Don't Pay</h3>
<ul>
<li><strong>The loop is memory-bound:</strong> once bytes from DRAM set the speed, wider arithmetic does nothing (see <a href="#/perf-roofline">The Roofline Model</a>).</li>
<li><strong>Data-dependent addresses:</strong> gathers issue one load per element, and Intel's 2023 microcode fix for the Gather Data Sampling vulnerability made them slower still. AMD's gathers through Zen 4 are microcoded and often no faster than scalar loads.</li>
<li><strong>Short or odd trip counts:</strong> a 5-iteration loop uses 5 of 16 lanes, plus setup and tail code.</li>
<li><strong>Horizontal or serial work:</strong> prefix sums, linked-list walks, and recurrences have no independent lanes.</li>
<li><strong>Frequency and power:</strong> on Skylake-SP, heavy AVX-512 code lowers the core clock (Intel specifies a Xeon Platinum 8180's base clock as 2.5 GHz, 2.1 GHz for heavy AVX2, and 1.7 GHz for heavy AVX-512), and the lower clock lingers after the vector code ends, slowing the scalar code around it.</li>
<li><strong>Upper-lane warm-up:</strong> Skylake powers down the upper 128 bits of its vector units when idle. Agner Fog measured the first 256-bit instructions running at reduced throughput for about 56,000 cycles while they power up.</li>
<li><strong>Mixing SSE and AVX:</strong> legacy SSE instructions after AVX code with dirty upper halves cost a state transition of about 70 cycles on Haswell, and on Skylake a false dependency and an extra blend µop per SSE instruction. Compilers emit <code>vzeroupper</code> at the end of AVX functions to avoid it.</li>
<li><strong>Store forwarding across widths:</strong> a 32 B load that reads data from several recent 4 B stores can't be forwarded and waits for the stores to commit.</li>
</ul>

<h3 id="sec-auto">Auto-Vectorization</h3>
<p>GCC (at <code>-O3</code>, or <code>-O2</code> since GCC 12 with a cheaper cost model) and Clang (at <code>-O2</code>) vectorize loops on their own when they can prove it safe. Intrinsics are the fallback when they can't. The common blockers:</p>
<ul>
<li><strong>Possible aliasing</strong> between output and input pointers (fix with <code>restrict</code>, see <a href="#/c-fast/alias">Aliasing and restrict</a>).</li>
<li><strong>Floating-point reductions</strong>, which need <code>-ffast-math</code> or <code>-fassociative-math</code> because reordering changes rounding.</li>
<li><strong>Calls</strong> to functions that aren't inlined, and early exits (<code>break</code>, <code>return</code>) in the loop body.</li>
<li><strong>Non-unit strides and AoS layouts</strong>, which need shuffles or gathers.</li>
<li><strong>Unknown trip counts</strong> from unsigned counters that might wrap (see <a href="#/c-hood">C Under the Hood</a>).</li>
</ul>
<p>Check the result with <code>-fopt-info-vec-optimized</code> (GCC) or <code>-Rpass=loop-vectorize</code> (Clang), and in the assembly look for <code>ymm</code> or <code>zmm</code> registers in the hot loop.</p>
<p class="refs">References: Intel, <em>Intel 64 and IA-32 Architectures Software Developer's Manual</em>, Vol. 1, chapters 14 and 15, and the <em>Intel Intrinsics Guide</em> · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> · Intel, <em>Xeon Platinum 8180 Processor</em> specification (ark.intel.com) · Agner Fog, <em>The Microarchitecture of Intel, AMD and VIA CPUs</em> and <em>Instruction Tables</em> · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., chapter 4 (SIMD instruction set extensions) · Intel, <em>Intel AVX10 Architecture Specification</em></p>
`,
  practice: {
    guided: [
      {
        q: `<p>An Ice Lake-SP Xeon Platinum 8380 has 40 cores, each with two 512-bit FMA units. Assume all cores hold a 2.3 GHz clock for every instruction mix. What is the peak FP32 rate per core per cycle with scalar FMAs, SSE, AVX2, and AVX-512, and what is the chip's peak with scalar code and with AVX-512?</p>`,
        a: `<ol>
<li>Each FMA counts as 2 FLOPs per lane, and the core issues 2 FMAs per cycle at any width.</li>
<li>Scalar: 2 FMAs/cycle × 1 lane/FMA × 2 FLOPs/lane = <strong>4 FLOPs/cycle</strong>.</li>
<li>SSE (128 bits / 32 bits = 4 lanes): 2 FMAs/cycle × 4 lanes/FMA × 2 FLOPs/lane = <strong>16 FLOPs/cycle</strong>.</li>
<li>AVX2 (8 lanes): 2 FMAs/cycle × 8 lanes/FMA × 2 FLOPs/lane = <strong>32 FLOPs/cycle</strong>.</li>
<li>AVX-512 (16 lanes): 2 FMAs/cycle × 16 lanes/FMA × 2 FLOPs/lane = <strong>64 FLOPs/cycle</strong>.</li>
<li>Chip, scalar: 4 FLOPs/cycle/core × 40 cores × 2.3 GHz = <strong>368 GFLOP/s</strong>.</li>
<li>Chip, AVX-512: 64 FLOPs/cycle/core × 40 cores × 2.3 GHz = <strong>5,888 GFLOP/s</strong>, 16 times the scalar peak. In practice the AVX-512 clock under full load is lower than 2.3 GHz, which is why the question had to state the assumption.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>On Zen 4, FP adds have a 3-cycle latency and two FP add pipes, and the core can do two 32 B vector loads per cycle. A function sums 4,096 FP32 values that are already in L1. Estimate the cycles for: (1) scalar code with one accumulator, (2) AVX2 with one accumulator, and (3) AVX2 with enough accumulators. Why is the best speedup far more than 8 times, and why won't the compiler produce version 3 from the plain C loop by default?</p>`,
        a: `<ol>
<li><strong>Scalar, one accumulator:</strong> each add waits for the previous one. 4,096 adds × 3 cycles/add = <strong>12,288 cycles</strong>.</li>
<li><strong>AVX2, one accumulator:</strong> 4,096 values / 8 values/vector = 512 vector adds, still in one chain: 512 adds × 3 cycles/add = <strong>1,536 cycles</strong>, 8 times faster.</li>
<li><strong>AVX2, enough accumulators:</strong> to keep both pipes busy, the code needs latency × pipes = 3 cycles × 2 adds/cycle = 6 independent chains. Then the adds take 512 adds / 2 adds/cycle = 256 cycles, and the loads take 512 loads / 2 loads/cycle = 256 cycles, so the loop runs in about <strong>256 cycles</strong> plus a short final reduction.</li>
</ol>
<p>The speedup over version 1 is 12,288 cycles / 256 cycles = 48 times: 8 times from the lanes and 6 times from breaking the dependency chain. Scalar code with 6 accumulators would get the 6 times alone (4,096 adds / 2 adds/cycle = 2,048 cycles).</p>
<p>Both changes reorder the additions, and floating-point addition isn't associative, so the result can differ in the last bits. GCC and Clang only do it with <code>-ffast-math</code> or <code>-fassociative-math</code>. Otherwise they keep the strict order, which is version 1's dependency chain even if the loads are vectorized.</p>`
      },
      {
        q: `<p>Give four situations in which replacing a working scalar loop with AVX2 or AVX-512 code makes a program slower overall, and say what you'd measure to confirm each.</p>`,
        a: `<ul>
<li><strong>Frequency license on Skylake-SP:</strong> occasional AVX-512 instructions in a mostly scalar service lower the clock for everything that runs on the core for some time after. Measure core frequency (<code>perf stat -e cycles</code> against time, or the <code>CORE_POWER.LVL*_TURBO_LICENSE</code> events).</li>
<li><strong>Gathers replacing cache-friendly scalar loads:</strong> on Zen 4 or on Intel with the Gather Data Sampling microcode, a gather can cost more than the scalar loads it replaces. Measure µops issued and cycles per element in the loop.</li>
<li><strong>SSE and AVX mixing:</strong> calling an old SSE-compiled library from AVX code without <code>vzeroupper</code> adds transitions or blend µops. Look for the <code>ASSISTS.SSE_AVX_MIX</code> event or extra µops.</li>
<li><strong>Short loops dominated by setup and tails:</strong> trip counts of 3 to 10 elements spend more time broadcasting, masking, and reducing than computing. Compare instructions retired per element.</li>
<li><strong>Store-forwarding failures:</strong> a vector load that reads bytes written by several recent narrow stores stalls until they commit. Look for the loads-blocked-by-store-forwarding event.</li>
</ul>`
      }
    ]
  }
},

{
  id: "avx-in-models",
  region: "avx",
  title: "AVX in a CPU Performance Model",
  sections: [
    { id: "why", label: "Why a Simulator Benefits" },
    { id: "tags", label: "Use Case: Set-Associative Tag Lookup" },
    { id: "wakeup", label: "Use Case: Issue-Queue Wakeup" },
    { id: "lsq", label: "Use Case: Store-to-Load Forwarding Search" },
    { id: "bp", label: "Use Case: Branch Predictor Arithmetic" },
    { id: "modeling", label: "Modeling AVX Code in the Simulated Core" },
    { id: "gain", label: "Measuring the Gain" }
  ],
  body: `
<p>Hardware searches many entries at once: a cache compares the tags of every way in one cycle, an issue queue's CAM compares a broadcast tag against every source operand, and a load searches all older stores in parallel. A cycle-level model written in plain C does those searches one entry at a time, in loops whose early exits mispredict. SIMD lets the model do what the hardware does: compare 8 to 32 entries in one instruction and turn the result into a bit mask.</p>

<h3 id="sec-why">Why a Simulator Benefits</h3>
<ul>
<li><strong>The hot loops are searches over small, fixed arrays</strong> (8 to 32 ways, 64 to 200 queue entries), with integer compares that are exact, so vectorizing them can't change the simulation's results.</li>
<li><strong>Scalar searches mispredict.</strong> Which way hits, or which entry wakes up, is data-dependent, so a loop with an early <code>break</code> mispredicts its exit often. A vector compare plus <code>tzcnt</code> has no data-dependent branch.</li>
<li><strong>It forces a good layout.</strong> Vector code needs the searched field contiguous (struct of arrays, see <a href="#/c-fast/layout">Data Layout for the Cache</a>), which already cuts the cache lines touched.</li>
</ul>

<h3 id="sec-tags">Use Case: Set-Associative Tag Lookup</h3>
<p>Store each set's tags contiguously and its valid bits as a mask. With AVX2, one compare covers 8 ways of 32-bit tags:</p>
<pre><code>// returns the hit way, or -1 on a miss
static inline int lookup8(const uint32_t tags[8], uint32_t valid, uint32_t tag) {
    __m256i t  = _mm256_loadu_si256((const __m256i *)tags);
    __m256i eq = _mm256_cmpeq_epi32(t, _mm256_set1_epi32((int)tag));
    uint32_t hit = (uint32_t)_mm256_movemask_ps(_mm256_castsi256_ps(eq)) &amp; valid;
    return hit ? (int)_tzcnt_u32(hit) : -1;
}</code></pre>
<p>AVX-512 covers 16 ways and applies the valid bits as the compare's mask:</p>
<pre><code>static inline int lookup16(const uint32_t tags[16], uint32_t valid, uint32_t tag) {
    __m512i t = _mm512_loadu_si512(tags);
    uint32_t hit = _mm512_mask_cmpeq_epi32_mask((__mmask16)valid, t,
                                                _mm512_set1_epi32((int)tag));
    return hit ? (int)_tzcnt_u32(hit) : -1;
}</code></pre>
<ul>
<li>The lookup costs about 4 instructions whatever the hit way, and the only branch (hit or miss) follows the cache's hit rate, which is usually predictable.</li>
<li>Tags wider than 32 bits use <code>epi64</code> compares (4 per <code>ymm</code>, 8 per <code>zmm</code>), or store only the low 32 bits of the tag plus a check of the full tag on a hit.</li>
<li>The same compare-and-mask finds an invalid way to fill (compare the valid mask, not the tags) and, with 8-bit or 16-bit LRU ages in a vector, the oldest way (<code>_mm256_max_epu8</code>, then compare against the max).</li>
</ul>

<h3 id="sec-wakeup">Use Case: Issue-Queue Wakeup</h3>
<p>When an instruction produces physical register <em>p</em>, every waiting entry with a source equal to <em>p</em> becomes ready (see <a href="#/wakeup">Wakeup and Bypass Timing</a>). With 16-bit physical register tags in two source arrays, one AVX2 compare covers 16 entries:</p>
<pre><code>// bit i of the result is set if entry i has src1 or src2 == dst
static inline uint32_t wakeup16(const uint16_t *src1, const uint16_t *src2, uint16_t dst) {
    __m256i d  = _mm256_set1_epi16((short)dst);
    __m256i m1 = _mm256_cmpeq_epi16(_mm256_loadu_si256((const __m256i *)src1), d);
    __m256i m2 = _mm256_cmpeq_epi16(_mm256_loadu_si256((const __m256i *)src2), d);
    uint32_t bytes = (uint32_t)_mm256_movemask_epi8(_mm256_or_si256(m1, m2));
    return _pext_u32(bytes, 0x55555555u);   // one bit per 16-bit lane
}</code></pre>
<ul>
<li>The result ORs into a ready-bit mask, and <strong>select</strong> is then bit arithmetic: AND with the "both sources ready" mask, and pick with <code>tzcnt</code> (oldest-first when entries are kept in age order) or with an age matrix.</li>
<li>With AVX-512BW, <code>_mm512_cmpeq_epi16_mask</code> covers 32 entries and returns the mask directly, so the <code>pext</code> step disappears. (<code>pext</code> is fast on Intel and on Zen 3 and later, but microcoded and slow on Zen 1 and Zen 2.)</li>
<li>Several results per cycle (one per execution port) mean several broadcasts, and each is just another compare against the same loaded source vectors.</li>
</ul>

<h3 id="sec-lsq">Use Case: Store-to-Load Forwarding Search</h3>
<p>A load must find the youngest older store to the same address. With store addresses in an array in age order and a mask of stores that are older than the load and have known addresses, AVX-512 compares 8 64-bit addresses at once:</p>
<pre><code>// stores 0..7 oldest first, older = stores older than the load with known addresses
static inline int forward8(const uint64_t addr[8], uint32_t older, uint64_t a) {
    uint32_t m = _mm512_mask_cmpeq_epi64_mask((__mmask8)older,
                     _mm512_loadu_si512(addr), _mm512_set1_epi64((long long)a));
    return m ? 31 - (int)_lzcnt_u32(m) : -1;    // highest set bit = youngest match
}</code></pre>
<p>A real store queue is a ring buffer, so the model rotates the mask so that the oldest entry is bit 0 before the bit scan, and compares the address range (base and size) rather than equality when partial overlaps matter. The structure of the code stays the same: compare everything, mask by age, scan once.</p>

<h3 id="sec-bp">Use Case: Branch Predictor Arithmetic</h3>
<ul>
<li><strong>Perceptron predictors</strong> compute a dot product of a weight vector with the global history (each bit as +1 or −1). With 16-bit weights and history, <code>_mm256_madd_epi16</code> multiplies 16 pairs and adds neighbors into 8 32-bit sums, so 4 instructions plus one horizontal reduction cover a 64-bit history.</li>
<li><strong>TAGE-style predictors</strong> compute an index and a tag hash for each tagged table from folded history. With 8 or 16 tables of 32-bit hashes, one vector of shifts, XORs, and masks computes all the indices at once, and one gather or 8 scalar loads fetch the entries.</li>
<li><strong>Bulk statistics:</strong> per-PC counters, histograms of reuse distance, and confidence counter updates over a table are plain array arithmetic that the compiler can vectorize when the layout allows.</li>
</ul>

<h3 id="sec-modeling">Modeling AVX Code in the Simulated Core</h3>
<p>The other direction: when the simulated workload uses AVX, the model's timing must reflect how the target core executes it. Counting each vector instruction as one generic µop gets most of these wrong:</p>
<div class="tbl"><table>
<tr><th>Effect</th><th>What to model</th><th>Example</th></tr>
<tr><td>Execution width versus register width</td><td>A 512-bit op occupies a 256-bit pipe for 2 cycles, or splits into 2 µops</td><td>Zen 4 double-pumps AVX-512, Zen 5 desktop and server parts execute it at full width, and Zen 1 split each 256-bit op into two 128-bit µops</td></tr>
<tr><td>Port binding</td><td>Which ports accept which widths</td><td>Skylake-SP fuses ports 0 and 1 for one 512-bit op and adds a second 512-bit FMA on port 5 on most server parts</td></tr>
<tr><td>Physical register file</td><td>Separate vector register file capacity, with entries of the full vector width</td><td>Running out of vector registers stalls rename, independently of the integer file</td></tr>
<tr><td>Loads and stores</td><td>Bytes per cycle, cache-line splits, and narrow-store to wide-load forwarding failures</td><td>A misaligned 64 B load always spans two lines, so it uses two cache accesses</td></tr>
<tr><td>Gathers and scatters</td><td>One memory access per active element, plus the µops to assemble them</td><td>A 16-element gather is 16 loads, not 1</td></tr>
<tr><td>Masked operations</td><td>Masked-off lanes don't fault and, for stores, don't write</td><td>A masked tail store near a page boundary must not trigger a page fault in the model either</td></tr>
<tr><td>Frequency</td><td>Clock as a function of the recent instruction mix</td><td>Skylake-SP license levels, transition delay, and hold time</td></tr>
<tr><td>State transitions</td><td>Upper-lane power-up and SSE/AVX mixing penalties</td><td>Skylake's reduced-throughput warm-up period, and <code>vzeroupper</code></td></tr>
</table></div>
<p>The hardware side of these effects is on <a href="#/simd">SIMD and Vector Execution</a> and <a href="#/exec-units">Execution Units</a>.</p>

<h3 id="sec-gain">Measuring the Gain</h3>
<ul>
<li><strong>Profile first:</strong> <code>perf record</code> on a few representative traces shows which searches matter. Only those are worth intrinsics.</li>
<li><strong>Bound it with Amdahl's law:</strong> the speedup is 1 / ((1 − f) + f / s), where f is the share of run time in the vectorized code and s its local speedup.</li>
<li><strong>Keep a scalar reference:</strong> build each SIMD function next to a plain C version and test them against each other on random inputs. Because the compares are exact, the simulator's output must be bit-identical with either version.</li>
<li><strong>Dispatch by host:</strong> choose AVX-512, AVX2, or scalar at startup with <code>__builtin_cpu_supports</code>, so the same binary runs on a laptop and on the simulation farm.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., chapter 3 (dynamic scheduling, the ROB, and load-store ordering) and chapter 4 (SIMD extensions) · Jiménez and Lin, "Dynamic Branch Prediction with Perceptrons," HPCA 2001 · Seznec and Michaud, "A Case for (Partially) TAgged GEometric History Length Branch Prediction," JILP 2006 · Intel, <em>Intel Intrinsics Guide</em> · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em> · Agner Fog, <em>The Microarchitecture of Intel, AMD and VIA CPUs</em></p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Zen 4's L3 (16-way per set) looks up tags with a scalar loop that compares ways in order and stops at the first match. The hit rate is 70%, and a hit is equally likely to be in any way. How many tag compares does an average lookup do, and how does that compare with an AVX-512 lookup?</p>`,
        a: `<ol>
<li>A hit in way w (w = 0 to 15) takes w + 1 compares. Averaged over 16 equally likely ways: (1 compare + 16 compares) / 2 = 8.5 compares per hit.</li>
<li>A miss compares all 16 ways: 16 compares.</li>
<li>Average: 0.7 × 8.5 compares + 0.3 × 16 compares = 5.95 compares + 4.8 compares = <strong>10.75 compares per lookup</strong>, each with a loop branch whose exit point varies, so the exit mispredicts often.</li>
<li>AVX-512: 1 load, 1 broadcast, 1 masked compare into a <code>k</code> register, 1 move to a general register, and 1 <code>tzcnt</code>: <strong>1 compare instruction for all 16 ways</strong>, about 5 instructions in total, and the only branch is hit or miss.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your Zen 4 model times an AVX-512 kernel whose loop body is 8 independent <code>vfmadd231ps zmm</code> instructions, 2 vector loads, and 3 loop-overhead instructions (13 instructions). The model treats a <code>zmm</code> FMA like a <code>ymm</code> one, so it lets 2 issue per cycle. On Zen 4, 256-bit FMAs issue 2 per cycle, but a 512-bit FMA occupies both 256-bit FMA pipes and issues 1 per cycle. FMA latency is 4 cycles at both widths, and the core dispatches up to 6 instructions per cycle. What IPC does the model report, what does the hardware get, and what else should the model check for 512-bit ops on this core?</p>`,
        a: `<ol>
<li><strong>Model:</strong> 8 FMAs / 2 FMAs/cycle = 4 cycles/iteration, so IPC = 13 instructions / 4 cycles = <strong>3.25</strong>.</li>
<li><strong>Hardware:</strong> 8 FMAs / 1 FMA/cycle = 8 cycles/iteration, so IPC = 13 instructions / 8 cycles = <strong>1.625</strong>. The model is 2 times optimistic.</li>
<li>The 8 accumulators are enough in both cases (with a 4-cycle FMA latency, 1 FMA/cycle needs only 4 chains), so the FMA pipes are the bound, and the other 5 instructions fit in the remaining dispatch slots.</li>
</ol>
<p>Other 512-bit effects to check on this core:</p>
<ul>
<li><strong>Loads:</strong> a 64 B load uses the full 2 × 32 B per cycle of load bandwidth, so 2 <code>zmm</code> loads take 2 cycles, and a misaligned one splits across two lines.</li>
<li><strong>Register file:</strong> each <code>zmm</code> result needs a full 512-bit physical register.</li>
<li><strong>Everything else that is double-pumped:</strong> adds, multiplies, and shuffles on <code>zmm</code> registers also take two passes.</li>
<li><strong>Frequency:</strong> Zen 4 has no separate AVX-512 clock license, so the model shouldn't apply Intel-style license drops.</li>
</ul>`
      },
      {
        q: `<p>A profile of your trace-driven core model shows 35% of run time in issue-queue wakeup and select, and 15% in cache tag lookup. Rewriting wakeup with AVX2 makes that code 6 times faster, and the tag lookup gets 3 times faster. What is the overall speedup, and what is the most the model could gain from speeding up these two parts alone?</p>`,
        a: `<ol>
<li>Unchanged share: 1 − 0.35 − 0.15 = 0.5 of the original run time.</li>
<li>New run time, as a fraction of the old: 0.5 + 0.35 / 6 + 0.15 / 3 = 0.5 + 0.0583 + 0.05 = 0.6083.</li>
<li>Speedup: 1 / 0.6083 ≈ <strong>1.64 times</strong>.</li>
<li>Upper bound if the two parts took no time at all: 1 / 0.5 = <strong>2 times</strong>. Further gains have to come from the other half of the run time, so profile again after the change.</li>
</ol>`
      }
    ]
  }
}
]);
