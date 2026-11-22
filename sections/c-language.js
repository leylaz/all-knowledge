/* Section: C Language
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "clang"). */

section({
  id: "clang",
  name: "C Language",
  cap: "What C compiles to, the rules of the language, and writing it for speed",
  sections: [{ id: "pages", label: "How the Pages Fit Together" }],
  body: `
<p>C is the language closest to the machine that still runs everywhere, which is why kernels, runtimes, and many trace-driven performance models are written in it. Almost every C construct maps to a small, predictable set of instructions and bytes. Knowing that mapping lets you read a simulator's hot loop and predict its cost, and knowing where the mapping breaks (undefined behavior, aliasing, padding) explains most of the surprises.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/c-hood">C Under the Hood</a>: where each variable lives, how types and structs are laid out in bytes, pointers as addresses, the x86-64 calling convention, what <code>malloc</code> does, and how the optimizer uses undefined behavior.</li>
<li><a href="#/c-syntax">Syntax and Semantics</a>: reading declarations, integer promotions and conversions, precedence and sequencing traps, qualifiers, aggregates, the preprocessor, and what each standard from C89 to C23 added.</li>
<li><a href="#/c-fast">Writing Fast C</a>: measuring, aliasing and <code>restrict</code>, data layout, branches, arithmetic that costs more than it looks, inlining and whole-program builds, and allocation in hot paths.</li>
</ul>
<p>Related pages: the toolchain from parsing to loading in <a href="#/r/comp">Compilers and the Toolchain</a>, atomics and cache-line layout in <a href="#/r/conc">Concurrency in C</a>, and SIMD intrinsics in <a href="#/r/avx">AVX and SIMD</a>. The same view of C++ is in <a href="#/r/cpph">C++ Under the Hood</a>, and its library in <a href="#/r/stl">Using C++ and the STL</a>.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A trace-driven model stores each instruction as <code>struct Rec { uint64_t pc; long target; int op; };</code> and writes the array straight to disk with <code>fwrite</code>. A 1,000,000,000-instruction SimPoint trace is captured on Linux x86-64 and read on Windows x64 with the same source. How big is each record on each platform, how big is the file, and what goes wrong?</p>`,
        a: `<ol>
<li>Linux x86-64 is LP64, so <code>long</code> is 8 B. Offsets: <code>pc</code> at 0 B (8 B), <code>target</code> at 8 B (8 B), <code>op</code> at 16 B (4 B). The struct's alignment is 8 B, so 4 B of tail padding round it to <strong>24 B</strong>.</li>
<li>Windows x64 is LLP64, so <code>long</code> is 4 B. Offsets: <code>pc</code> at 0 B, <code>target</code> at 8 B (4 B), <code>op</code> at 12 B (4 B). Total <strong>16 B</strong>, with no padding.</li>
<li>File written on Linux: 1,000,000,000 records × 24 B/record = 24,000,000,000 B = 24 GB.</li>
<li>Read on Windows, every <code>fread</code> of 16 B/record takes two thirds of a Linux record, so from the second record on, fields land in the wrong places. The Windows reader sees 24,000,000,000 B / 16 B/record = 1,500,000,000 garbage records instead of 1,000,000,000.</li>
<li>Fix: use fixed-width types (<code>int64_t target</code>, <code>int32_t op</code>), add a <code>_Static_assert(sizeof(struct Rec) == 24, "trace format")</code>, and write the fields in a defined byte order rather than dumping the struct.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague says "C is portable assembly, so the compiler emits what I wrote." Give three concrete cases where an optimizing compiler's output does not follow the source line by line, and say why each is legal.</p>`,
        a: `<ul>
<li><strong>Code deleted because of undefined behavior:</strong> <code>if (x + 1 &lt; x)</code> on a signed <code>int</code> becomes <code>if (0)</code>, because signed overflow is undefined, so the compiler may assume it never happens.</li>
<li><strong>Loads and stores removed or merged:</strong> a value read through a pointer in a loop stays in a register, and repeated stores become one, under the as-if rule. Only <code>volatile</code> accesses and atomics are observable in their own right.</li>
<li><strong>Loops rewritten:</strong> a loop over an array is vectorized, unrolled, or replaced by a call to <code>memset</code> or <code>memcpy</code>, and a loop that computes a closed-form sum is replaced by the formula. The output only has to match the abstract machine's observable behavior.</li>
<li><strong>Layout the source doesn't show:</strong> struct padding, the order of locals on the stack, and whether a local exists in memory at all are the compiler's choice.</li>
</ul>
<p>The common reason is the as-if rule: the standard defines an abstract machine, and only its observable behavior (I/O, <code>volatile</code> accesses, and synchronization) has to be preserved.</p>`
      }
    ]
  }
}, [
{
  id: "c-hood",
  region: "clang",
  title: "C Under the Hood",
  sections: [
    { id: "where", label: "Where Variables Live" },
    { id: "types", label: "Types as Bytes" },
    { id: "structs", label: "Struct Layout and Padding" },
    { id: "pointers", label: "Pointers and Arrays as Addresses" },
    { id: "abi", label: "Calls and the x86-64 ABI" },
    { id: "malloc", label: "What malloc Does" },
    { id: "ub", label: "Undefined Behavior and the Optimizer" }
  ],
  body: `
<p>This page follows a C program from source to the bytes and instructions it becomes on Linux x86-64 with GCC or Clang. The toolchain steps themselves (preprocess, compile, assemble, link, load) are covered in <a href="#/r/comp">Compilers and the Toolchain</a>. Two commands show most of what follows: <code>gcc -O2 -S -masm=intel f.c</code> prints the assembly, and <a href="https://godbolt.org">Compiler Explorer</a> shows it next to the source.</p>

<h3 id="sec-where">Where Variables Live</h3>
<p>A running process's address space holds a few regions, and every C object lands in one of them:</p>
<div class="tbl"><table>
<tr><th>C object</th><th>Region</th><th>Notes</th></tr>
<tr><td>Function code</td><td><code>.text</code></td><td>Read and execute only, shared between processes running the same binary</td></tr>
<tr><td>String literals, <code>const</code> globals</td><td><code>.rodata</code></td><td>Writing to <code>"abc"[0]</code> faults, because the page is read-only</td></tr>
<tr><td>Globals and <code>static</code> locals with a nonzero initializer</td><td><code>.data</code></td><td>Initial values are stored in the file</td></tr>
<tr><td>Globals and <code>static</code> locals that are zero or uninitialized</td><td><code>.bss</code></td><td>Only the size is stored, and the loader maps zero pages, so a 1 GiB zero array costs nothing in the file</td></tr>
<tr><td>Automatic (local) variables</td><td>Registers, or the stack</td><td>At <code>-O2</code> most locals never touch memory. One whose address is taken (<code>&amp;x</code>) must live on the stack.</td></tr>
<tr><td><code>malloc</code> results</td><td>Heap (<code>brk</code> area) or separate <code>mmap</code> regions</td><td>See <a href="#/c-hood/malloc">What malloc Does</a></td></tr>
</table></div>
<p>The main thread's stack is 8 MiB by default on Linux (<code>ulimit -s</code>) and 1 MiB on Windows. A large local array, such as a simulator's <code>uint64_t table[1 &lt;&lt; 20]</code> (8 MiB), overflows it and crashes with a segmentation fault on first touch. Make such arrays <code>static</code> or allocate them.</p>

<h3 id="sec-types">Types as Bytes</h3>
<p>The standard fixes only minimum ranges. The actual sizes come from the platform's data model:</p>
<div class="tbl"><table>
<tr><th>Type</th><th>Linux, macOS (LP64)</th><th>Windows x64 (LLP64)</th></tr>
<tr><td><code>char</code>, <code>short</code>, <code>int</code></td><td>1 B, 2 B, 4 B</td><td>1 B, 2 B, 4 B</td></tr>
<tr><td><code>long</code></td><td>8 B</td><td>4 B</td></tr>
<tr><td><code>long long</code>, pointers, <code>size_t</code></td><td>8 B</td><td>8 B</td></tr>
<tr><td><code>float</code>, <code>double</code></td><td>4 B, 8 B (IEEE 754)</td><td>4 B, 8 B</td></tr>
<tr><td><code>long double</code></td><td>16 B (x87 80-bit value plus padding)</td><td>8 B (same as <code>double</code> in MSVC)</td></tr>
</table></div>
<ul>
<li><strong>Signedness of <code>char</code></strong> is the platform's choice: signed on x86, unsigned on Arm and RISC-V Linux. Code that stores a byte above 127 in a <code>char</code> and compares it with 0 behaves differently across hosts.</li>
<li><strong>Integers are two's complement</strong> everywhere in practice, and C23 finally requires it. Signed overflow is still undefined behavior.</li>
<li><strong>Byte order</strong> is little-endian on x86 and on Arm and RISC-V as normally configured: the least significant byte sits at the lowest address.</li>
<li><strong>Use <code>&lt;stdint.h&gt;</code></strong> (<code>uint32_t</code>, <code>int64_t</code>, <code>uintptr_t</code>) whenever the width matters, which in a hardware model is almost always.</li>
</ul>

<h3 id="sec-structs">Struct Layout and Padding</h3>
<p>Each member sits at an offset that is a multiple of its own alignment (on x86-64 usually its size), and the whole struct's size is rounded up to a multiple of its largest member's alignment so that arrays of it stay aligned. Members are never reordered.</p>
<pre><code>struct A { char tag; double v; int n; };   // sizeof = 24
//   tag at 0, 7 B padding, v at 8, n at 16, 4 B tail padding

struct B { double v; int n; char tag; };   // sizeof = 16
//   v at 0, n at 8, tag at 12, 3 B tail padding</code></pre>
<ul>
<li><strong>Sort members from largest to smallest alignment</strong> to remove interior padding. <code>offsetof(struct A, n)</code> and <code>sizeof</code> show the result, and <code>pahole</code> prints the holes of every struct in a binary.</li>
<li><strong>Size against cache lines matters more than bytes.</strong> An entry that grows from 64 B to 72 B makes every other array element straddle two 64 B lines.</li>
<li><strong><code>__attribute__((packed))</code></strong> removes padding but makes the compiler emit unaligned accesses, and taking a pointer to a packed member is a portability hazard. Use it for wire formats, not hot structures.</li>
<li><strong><code>_Alignas(64)</code></strong> (or <code>alignas</code> in C23) pads a struct to a cache line, which is how <a href="#/false-sharing">False Sharing and Cache-Line Isolation</a> separates per-thread counters.</li>
<li><strong>Bit-fields</strong> (<code>unsigned valid : 1;</code>) pack flags, but their order, straddling, and signedness are implementation-defined, and each write is a read-modify-write of the containing word.</li>
</ul>

<h3 id="sec-pointers">Pointers and Arrays as Addresses</h3>
<p>A pointer is a 64-bit address plus a type that scales arithmetic. <code>p + i</code> adds <code>i * sizeof(*p)</code> bytes, and <code>a[i]</code> is defined as <code>*(a + i)</code>. That maps straight onto x86's scaled addressing mode:</p>
<pre><code>int get(const int *a, long i) { return a[i]; }
//   mov eax, DWORD PTR [rdi+rsi*4]       one load, no separate multiply</code></pre>
<ul>
<li><strong>Arrays decay to pointers</strong> in almost every expression and in every function parameter. <code>void f(int a[64])</code> is really <code>void f(int *a)</code>, so <code>sizeof a</code> inside <code>f</code> is 8 B, not 256 B.</li>
<li><strong>Multidimensional arrays are row-major:</strong> <code>int m[R][C]</code> puts <code>m[r][c]</code> at byte offset (r × C + c) × 4. Walking <code>c</code> in the inner loop touches consecutive bytes, and walking <code>r</code> there jumps C × 4 B each step (see <a href="#/cache-patterns">Cache Access Patterns</a>).</li>
<li><strong>An array of pointers is not a 2D array.</strong> <code>int **m</code> needs a dependent load per row, and rows sit wherever <code>malloc</code> put them.</li>
<li><strong>Function pointers</strong> compile to an indirect <code>call rax</code>, which the branch target buffer must predict. A simulator that dispatches each simulated instruction through a table of function pointers has one indirect branch per simulated instruction, and its targets are as predictable as the simulated program's opcode sequence.</li>
<li><strong>Pointer arithmetic is only defined inside one array</strong> (plus one past the end). Comparing pointers into different objects with <code>&lt;</code>, or forming an address far outside the object, is undefined, even though the hardware would compute something.</li>
</ul>

<h3 id="sec-abi">Calls and the x86-64 ABI</h3>
<p>The System V AMD64 ABI (Linux, macOS, BSD) decides where arguments and results go:</p>
<div class="tbl"><table>
<tr><th>What</th><th>System V (Linux)</th><th>Windows x64</th></tr>
<tr><td>Integer and pointer arguments</td><td><code>rdi</code>, <code>rsi</code>, <code>rdx</code>, <code>rcx</code>, <code>r8</code>, <code>r9</code>, then the stack</td><td><code>rcx</code>, <code>rdx</code>, <code>r8</code>, <code>r9</code>, then the stack</td></tr>
<tr><td>Floating-point arguments</td><td><code>xmm0</code> to <code>xmm7</code></td><td><code>xmm0</code> to <code>xmm3</code>, sharing slots with the integer ones</td></tr>
<tr><td>Return value</td><td><code>rax</code> (and <code>rdx</code>), or <code>xmm0</code> (and <code>xmm1</code>)</td><td><code>rax</code> or <code>xmm0</code></td></tr>
<tr><td>Callee-saved registers</td><td><code>rbx</code>, <code>rbp</code>, <code>r12</code> to <code>r15</code></td><td>Those plus <code>rdi</code>, <code>rsi</code>, <code>xmm6</code> to <code>xmm15</code></td></tr>
<tr><td>Stack extras</td><td>128 B red zone below <code>rsp</code> that leaf functions may use without moving <code>rsp</code></td><td>32 B shadow space the caller reserves for the first four arguments</td></tr>
</table></div>
<ul>
<li><strong>Structs of 16 B or less</strong> are passed and returned in registers, split into 8 B pieces. Larger structs are copied to the stack for arguments and returned through a hidden pointer the caller passes in <code>rdi</code>.</li>
<li><strong><code>rsp</code> must be 16 B aligned at each <code>call</code></strong>, which is why compilers sometimes adjust the stack by 8 B for no visible reason.</li>
<li><strong>Every vector register is caller-saved on Linux.</strong> A call inside a vectorized loop forces the live vectors to be spilled and reloaded around it.</li>
<li>A non-inlined call costs a <code>call</code> and <code>ret</code> (predicted by the return stack buffer), saving and restoring any callee-saved registers the callee uses, and lost optimization across the boundary. That last cost is usually the biggest. Stack frames and spills are covered in <a href="#/comp-regalloc">Register Allocation, Spills, and Stack Frames</a>.</li>
</ul>

<h3 id="sec-malloc">What malloc Does</h3>
<p>glibc's allocator (ptmalloc) is what most Linux C programs use:</p>
<ul>
<li><strong>Chunks with headers:</strong> each allocation is preceded by an 8 B size field, and results are 16 B aligned. <code>malloc(1)</code> occupies a 32 B chunk, the minimum.</li>
<li><strong>Thread cache first:</strong> since glibc 2.26, each thread keeps a <em>tcache</em> of recently freed chunks (64 size classes up to 1,032 B, 7 chunks each by default). A hit costs a few dozen instructions and no lock.</li>
<li><strong>Arenas and bins next:</strong> misses fall back to per-arena free lists, and arenas are locked.</li>
<li><strong>Large requests go to <code>mmap</code>:</strong> by default anything from 128 KiB up (the threshold adapts upward) gets its own mapping, and <code>free</code> returns it to the kernel with <code>munmap</code>. Each such pair is two system calls plus page faults on first touch.</li>
<li><strong><code>calloc</code> of a fresh <code>mmap</code> region skips the memset</strong>, because the kernel hands out zeroed pages anyway, so it can be much cheaper than <code>malloc</code> followed by <code>memset</code>.</li>
</ul>
<p>For a performance model, the lesson is that <code>malloc</code> in the per-cycle path (one per simulated instruction or per cache miss) costs real time and scatters related objects across memory. Preallocated arrays and free lists, as the hardware itself uses, avoid both (see <a href="#/c-fast/alloc">Allocation in Hot Paths</a>).</p>

<h3 id="sec-ub">Undefined Behavior and the Optimizer</h3>
<p>Undefined behavior (UB) means the standard places no requirement on the result. Optimizers treat it as a promise that it never happens, and they use that promise to generate faster code:</p>
<div class="tbl"><table>
<tr><th>UB</th><th>What the optimizer concludes</th><th>Effect</th></tr>
<tr><td>Signed overflow</td><td><code>x + 1 &gt; x</code> is always true</td><td><code>int f(int x) { return x + 1 &gt; x; }</code> compiles to <code>mov eax, 1</code>. Loop counters can be widened to 64 bits and trip counts computed in advance.</td></tr>
<tr><td>Null dereference</td><td>A pointer that was dereferenced is non-null</td><td>A later <code>if (!p)</code> check is deleted. A 2009 Linux kernel bug in the <code>tun</code> driver became exploitable this way.</td></tr>
<tr><td>Strict aliasing violation</td><td>An <code>int *</code> and a <code>float *</code> never point to the same object</td><td>Reading a <code>float</code>'s bits through <code>*(uint32_t *)&amp;f</code> may see a stale value. <code>memcpy(&amp;u, &amp;f, 4)</code> is defined and compiles to one <code>movd</code>.</td></tr>
<tr><td>Shift by the type's width or more</td><td>Shift counts are always in range</td><td>x86 hardware masks a 32-bit shift count to 5 bits, so <code>x &lt;&lt; 32</code> with a run-time count returns <code>x</code>, while a constant-folded one may return 0.</td></tr>
<tr><td>Out-of-bounds access</td><td>Indices stay in bounds</td><td>A loop that reads <code>a[i]</code> for <code>i</code> up to 64 on a 64-element array may be compiled as if it ran forever, or not at all.</td></tr>
<tr><td>Data race</td><td>No other thread writes a non-atomic variable</td><td>A spin loop on a plain <code>int flag</code> becomes an infinite loop that reads the flag once (see <a href="#/c11-ordering">C11 Memory Ordering</a>).</td></tr>
</table></div>
<p>Tools catch most of it: <code>-fsanitize=undefined,address</code> while testing, <code>-Wall -Wextra</code> always, and <code>-fwrapv</code> or <code>-fno-strict-aliasing</code> when old code depends on the hardware behavior (both cost some optimization).</p>
<p class="refs">References: ISO/IEC 9899:2024 (C23), sections 6.2.5 (types), 6.3 (conversions), and 6.5 (expressions) · H. J. Lu et al., <em>System V Application Binary Interface, AMD64 Architecture Processor Supplement</em> · Microsoft, <em>x64 calling convention</em> · glibc, <em>malloc/malloc.c</em> and the <code>mallopt</code> manual page · Bryant and O'Hallaron, <em>Computer Systems: A Programmer's Perspective</em>, 3rd ed., chapters 3 and 9 · Chris Lattner, "What Every C Programmer Should Know About Undefined Behavior," LLVM blog, 2011</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Golden Cove's 512-entry ROB declares each entry as</p><pre><code>struct RobEntry {
    uint64_t pc;
    uint8_t  valid;
    uint32_t dst_preg;
    uint8_t  done;
    uint16_t lsq_idx;
    uint64_t seq;
};</code></pre><p>on Linux x86-64. Lay out the struct, find its size, and find the size after reordering the members. How many 64 B cache lines does the whole ROB occupy in each case?</p>`,
        a: `<ol>
<li><code>pc</code>: offset 0 B, 8 B. <code>valid</code>: offset 8 B, 1 B.</li>
<li><code>dst_preg</code> needs 4 B alignment, so 3 B of padding (offsets 9 B to 11 B) put it at offset 12 B, ending at 16 B.</li>
<li><code>done</code>: offset 16 B. <code>lsq_idx</code> needs 2 B alignment, so 1 B of padding puts it at 18 B, ending at 20 B.</li>
<li><code>seq</code> needs 8 B alignment, so 4 B of padding put it at 24 B, ending at 32 B. The struct's alignment is 8 B and 32 B is a multiple of it, so <strong>sizeof = 32 B</strong>, of which 8 B are padding.</li>
<li>Reordered by alignment: <code>pc</code> (0 B), <code>seq</code> (8 B), <code>dst_preg</code> (16 B), <code>lsq_idx</code> (20 B), <code>valid</code> (22 B), <code>done</code> (23 B), ending at 24 B, a multiple of 8 B, so <strong>sizeof = 24 B</strong> with no padding.</li>
<li>Original: 512 entries × 32 B/entry = 16,384 B, and 16,384 B / 64 B/line = <strong>256 lines</strong>.</li>
<li>Reordered: 512 entries × 24 B/entry = 12,288 B, and 12,288 B / 64 B/line = <strong>192 lines</strong>, 25% fewer for a ROB walk at commit or flush.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>In a trace reader compiled with GCC <code>-O3</code> for x86-64, changing the loop counter in</p><pre><code>for (unsigned i = 0; i != n; i += 2) sum += rec[i].latency;</code></pre><p>from <code>unsigned</code> to <code>int</code> (with <code>n</code> also changed to <code>int</code> and <code>!=</code> to <code>&lt;</code>) makes the loop measurably faster. Explain why, in terms of what the compiler may assume.</p>`,
        a: `<p>The loop's speed depends on whether the compiler can turn <code>rec[i]</code> into a 64-bit pointer that simply advances by 2 records each iteration.</p>
<ul>
<li><strong>With <code>unsigned</code>:</strong> unsigned arithmetic wraps by definition, so <code>i</code> may go from 4,294,967,294 back to 0. And with <code>i += 2</code> and <code>i != n</code>, an odd <code>n</code> makes the loop wrap around and never hit <code>n</code> exactly. The compiler has to keep a 32-bit <code>i</code>, zero-extend it to 64 bits for every address, and can't compute the trip count in advance, which also blocks vectorization and unrolling with a known count.</li>
<li><strong>With <code>int</code> and <code>&lt;</code>:</strong> signed overflow is undefined, so the compiler assumes <code>i</code> never wraps. It widens <code>i</code> to a 64-bit induction variable (or a pointer), computes the trip count as (n + 1) / 2, and is free to vectorize or unroll.</li>
<li>The same effect comes from using <code>size_t</code> (64-bit, so wrapping is impossible in practice) with <code>&lt;</code>. That is the usual fix in code that must stay unsigned.</li>
</ul>
<p>To confirm it, compare the <code>-S</code> output for a <code>mov eax, eax</code> (zero extension) inside the loop, or check GCC's <code>-fopt-info-vec-missed</code> report.</p>`
      },
      {
        q: `<p>A cache model's hot function is <code>struct Res access(struct Req r)</code>, called once per simulated memory access. <code>struct Req</code> holds a 64-bit address, a 64-bit PC, and a 32-bit flags word, and <code>struct Res</code> holds a 32-bit way and a 32-bit latency. On Linux x86-64, how is each passed, and what would you change if the call shows up in a profile?</p>`,
        a: `<ul>
<li><strong><code>struct Req</code></strong> is 8 B + 8 B + 4 B = 20 B, padded to 24 B. That is over 16 B, so the System V ABI classifies it as MEMORY: the caller copies all 24 B to its stack before the call and the callee loads the fields back. That is 3 stores and up to 3 loads per call, plus store-to-load forwarding latency on the path.</li>
<li><strong><code>struct Res</code></strong> is 4 B + 4 B = 8 B, so it comes back in <code>rax</code> alone, with no memory traffic.</li>
<li><strong>Changes:</strong> pass <code>const struct Req *</code>, or pass the three fields as scalar arguments (they go in <code>rdi</code>, <code>rsi</code>, <code>edx</code>). Better still, make the function <code>static inline</code> in a header, or build with LTO, so the call and the copy disappear and the optimizer sees the caller's values.</li>
</ul>`
      }
    ]
  }
},

{
  id: "c-syntax",
  region: "clang",
  title: "Syntax and Semantics",
  sections: [
    { id: "decl", label: "Reading Declarations" },
    { id: "conv", label: "Integer Promotions and Conversions" },
    { id: "ops", label: "Precedence and Sequencing" },
    { id: "qual", label: "Storage Classes and Qualifiers" },
    { id: "agg", label: "Structs, Unions, Enums, and Initializers" },
    { id: "pre", label: "The Preprocessor" },
    { id: "std", label: "C Standards from C89 to C23" }
  ],
  body: `
<p>C's grammar is small, but a few rules (declarator syntax, implicit conversions, and unsequenced side effects) account for most of the bugs in otherwise simple code. This page covers those rules with the cases that show up in simulator code.</p>

<h3 id="sec-decl">Reading Declarations</h3>
<p>A declaration mirrors how the name is used: <code>int *p</code> says that <code>*p</code> is an <code>int</code>. Read it from the name outward, going right first (arrays <code>[]</code> and calls <code>()</code> bind tighter than <code>*</code>), then left, and let parentheses override:</p>
<div class="tbl"><table>
<tr><th>Declaration</th><th>Reads as</th></tr>
<tr><td><code>int *a[8]</code></td><td>array of 8 pointers to <code>int</code></td></tr>
<tr><td><code>int (*a)[8]</code></td><td>pointer to an array of 8 <code>int</code>s (one row of an <code>int m[][8]</code>)</td></tr>
<tr><td><code>int (*fp)(int)</code></td><td>pointer to a function taking <code>int</code> and returning <code>int</code></td></tr>
<tr><td><code>void (*tbl[256])(Cpu *)</code></td><td>array of 256 pointers to functions taking <code>Cpu *</code> (an opcode dispatch table)</td></tr>
<tr><td><code>const char *s</code></td><td>pointer to <code>const char</code>: the characters can't change through <code>s</code></td></tr>
<tr><td><code>char *const s</code></td><td><code>const</code> pointer to <code>char</code>: <code>s</code> itself can't change</td></tr>
</table></div>
<p>A <code>typedef</code> names each layer and makes the rest readable: <code>typedef void Exec(Cpu *); Exec *tbl[256];</code>.</p>

<h3 id="sec-conv">Integer Promotions and Conversions</h3>
<p>C never does arithmetic in a type narrower than <code>int</code>. Two rules decide the type of every expression:</p>
<ul>
<li><strong>Integer promotion:</strong> <code>char</code>, <code>short</code>, their unsigned forms, <code>uint8_t</code>, <code>uint16_t</code>, <code>_Bool</code>, and bit-fields are converted to <code>int</code> before any operator touches them.</li>
<li><strong>Usual arithmetic conversions:</strong> when two operands still differ, the one with lower rank is converted to the other's type. If one is unsigned and at least as wide, the signed one becomes unsigned.</li>
</ul>
<pre><code>uint8_t a = 200, b = 100;
int     s = a + b;      // 300: both promoted to int
uint8_t c = a + b;      // 44: 300 converted back to 8 bits (300 - 256)

int x = -1; unsigned u = 1;
x &lt; u                   // false: -1 converts to 4294967295u
-1 &lt; sizeof(int)        // false for the same reason (size_t is unsigned)

uint32_t m = 1 &lt;&lt; 31;  // UB: 1 is an int and 2^31 doesn't fit
uint32_t k = 1u &lt;&lt; 31; // fine</code></pre>
<ul>
<li><strong>Right-shifting a negative <code>int</code></strong> is implementation-defined. GCC and Clang use an arithmetic shift (<code>sar</code>), which rounds toward minus infinity, unlike division, which rounds toward zero.</li>
<li><strong>Converting an out-of-range value to a signed type</strong> is implementation-defined (GCC wraps). Converting a floating-point value that doesn't fit into any integer type is undefined.</li>
<li><strong><code>-Wconversion -Wsign-compare</code></strong> flag most of these silently changing conversions.</li>
</ul>

<h3 id="sec-ops">Precedence and Sequencing</h3>
<p>A few precedence levels sit where few people expect them:</p>
<div class="tbl"><table>
<tr><th>Written</th><th>Parsed as</th><th>Probably meant</th></tr>
<tr><td><code>x &amp; MASK == 0</code></td><td><code>x &amp; (MASK == 0)</code></td><td><code>(x &amp; MASK) == 0</code></td></tr>
<tr><td><code>a &lt;&lt; 2 + 1</code></td><td><code>a &lt;&lt; 3</code></td><td><code>(a &lt;&lt; 2) + 1</code></td></tr>
<tr><td><code>*p++</code></td><td><code>*(p++)</code>: read <code>*p</code>, then advance <code>p</code></td><td>usually that</td></tr>
<tr><td><code>flags &amp; F_A | F_B</code></td><td><code>(flags &amp; F_A) | F_B</code></td><td><code>flags &amp; (F_A | F_B)</code></td></tr>
<tr><td><code>c ? a : b + 1</code></td><td><code>c ? a : (b + 1)</code></td><td>depends</td></tr>
</table></div>
<p>Evaluation order is a separate question from precedence. Between two <em>sequence points</em> (roughly, the end of a full expression, <code>&amp;&amp;</code>, <code>||</code>, <code>?:</code>, the comma operator, and a function call), the order in which operands are evaluated is unspecified, and modifying an object twice, or reading it apart from computing its new value, is undefined:</p>
<pre><code>i = i++ + 1;          // UB: i modified twice
a[i] = i++;           // UB: read of i unsequenced with its increment
f(g(), h());          // fine, but g and h may run in either order
x = p &amp;&amp; p-&gt;valid;    // fine: &amp;&amp; is a sequence point and short-circuits</code></pre>

<h3 id="sec-qual">Storage Classes and Qualifiers</h3>
<div class="tbl"><table>
<tr><th>Keyword</th><th>Meaning</th><th>Under the hood</th></tr>
<tr><td><code>static</code> (file scope)</td><td>Internal linkage, visible only in this file</td><td>The compiler knows every caller, so it can inline or drop the function and change its calling convention</td></tr>
<tr><td><code>static</code> (in a function)</td><td>One instance for the whole program, initialized once</td><td>Lives in <code>.data</code> or <code>.bss</code>, not the stack</td></tr>
<tr><td><code>extern</code></td><td>Declares an object defined elsewhere</td><td>Resolved by the linker</td></tr>
<tr><td><code>const</code></td><td>Can't be modified through this name</td><td>A promise about this access path only, not that the object never changes</td></tr>
<tr><td><code>volatile</code></td><td>Every access is observable</td><td>Each read and write is emitted as written. Meant for memory-mapped I/O and <code>setjmp</code>, not for threads (use <code>_Atomic</code>).</td></tr>
<tr><td><code>restrict</code></td><td>For this pointer's lifetime, the object is reached only through it</td><td>Lets loads and stores be reordered and vectorized (see <a href="#/c-fast/alias">Aliasing and restrict</a>)</td></tr>
<tr><td><code>inline</code></td><td>Allows a definition in every file that includes it</td><td>A hint only. Write <code>static inline</code> in headers.</td></tr>
<tr><td><code>_Thread_local</code></td><td>One instance per thread</td><td>Addressed through the <code>fs</code> segment base on x86-64 Linux</td></tr>
<tr><td><code>_Atomic</code></td><td>Accesses are atomic and ordered</td><td>See <a href="#/c11-ordering">C11 Memory Ordering</a></td></tr>
</table></div>

<h3 id="sec-agg">Structs, Unions, Enums, and Initializers</h3>
<pre><code>typedef struct {
    uint64_t pc;
    uint8_t  op;
    uint8_t  src[3];
    int16_t  dst;
} Uop;

Uop u = { .pc = 0x401000, .op = OP_LOAD, .dst = -1 };   // designated: the rest are zeroed
Uop *q = &amp;(Uop){ .op = OP_NOP };                       // compound literal: an unnamed object

typedef struct {
    uint32_t n;
    uint64_t data[];          // flexible array member, sized at malloc time
} Trace;
Trace *t = malloc(sizeof *t + n * sizeof t-&gt;data[0]);

union Bits { double d; uint64_t u; };   // reading the other member: allowed in C, not in C++

enum Op { OP_NOP, OP_ALU, OP_LOAD, OP_STORE, OP_BR, OP_COUNT };</code></pre>
<ul>
<li>Designated initializers also work for arrays: <code>int lat[OP_COUNT] = { [OP_LOAD] = 5, [OP_ALU] = 1 };</code>.</li>
<li>An enum constant is an <code>int</code>, and an enum variable may hold values outside the listed ones. Ending the list with a <code>COUNT</code> member gives an array size that stays correct when an entry is added.</li>
<li>Struct assignment (<code>a = b</code>) copies all the bytes, but <code>==</code> on structs isn't allowed. <code>memcmp</code> compares padding bytes too, which may hold garbage.</li>
</ul>

<h3 id="sec-pre">The Preprocessor</h3>
<p>The preprocessor works on tokens before the compiler sees anything. <code>gcc -E</code> shows its output.</p>
<pre><code>#define SQR(x) x * x            // SQR(a + 1) becomes a + 1 * a + 1
#define SQR(x) ((x) * (x))      // fixed, but SQR(i++) still increments twice
static inline int sqr(int x) { return x * x; }   // no surprises, same code

#define LOG(...) fprintf(stderr, __VA_ARGS__)   // variadic macro
#define STR(x) #x                               // stringize
#define CAT(a, b) a##b                          // paste tokens</code></pre>
<p><strong>X-macros</strong> keep one list of entries and expand it several ways, which suits an opcode table in a simulator: the enum, the name strings, and the latencies can never fall out of sync.</p>
<pre><code>#define OPS(X) \\
    X(ADD,  1) \\
    X(MUL,  3) \\
    X(LOAD, 5)

#define AS_ENUM(name, lat) OP_##name,
#define AS_NAME(name, lat) #name,
#define AS_LAT(name, lat)  lat,
enum Op { OPS(AS_ENUM) OP_COUNT };
static const char *op_name[] = { OPS(AS_NAME) };
static const uint8_t op_lat[] = { OPS(AS_LAT) };</code></pre>
<ul>
<li><strong>Include guards</strong> (<code>#ifndef FOO_H</code> / <code>#define FOO_H</code> / <code>#endif</code>) or <code>#pragma once</code> stop double inclusion.</li>
<li><strong><code>#if</code> on configuration</strong> (<code>#if ROB_SIZE &gt; 256</code>) removes code entirely, so a compile-time configuration costs nothing at run time.</li>
<li><strong><code>_Generic</code></strong> (C11) picks an expression by type: <code>#define popc(x) _Generic((x), uint32_t: __builtin_popcount, uint64_t: __builtin_popcountll)(x)</code>.</li>
</ul>

<h3 id="sec-std">C Standards from C89 to C23</h3>
<div class="tbl"><table>
<tr><th>Standard</th><th>What it added</th></tr>
<tr><td>C89 / C90</td><td>The first ANSI and ISO standard: prototypes, <code>const</code>, <code>volatile</code>, <code>void *</code></td></tr>
<tr><td>C99</td><td><ul><li><code>//</code> comments and declarations anywhere, including in <code>for</code></li><li><code>&lt;stdint.h&gt;</code>, <code>long long</code>, <code>_Bool</code></li><li><code>inline</code>, <code>restrict</code></li><li>Designated initializers, compound literals, flexible array members, variable-length arrays</li></ul></td></tr>
<tr><td>C11</td><td><ul><li><code>_Atomic</code>, <code>&lt;stdatomic.h&gt;</code>, <code>&lt;threads.h&gt;</code>, <code>_Thread_local</code>, and a memory model</li><li><code>_Static_assert</code>, <code>_Alignas</code>, <code>_Alignof</code>, <code>_Generic</code>, <code>_Noreturn</code></li><li>Anonymous structs and unions</li><li>Variable-length arrays made optional</li></ul></td></tr>
<tr><td>C17</td><td>Defect fixes only</td></tr>
<tr><td>C23</td><td><ul><li><code>bool</code>, <code>true</code>, <code>false</code>, <code>alignas</code>, <code>static_assert</code>, and <code>thread_local</code> as keywords</li><li><code>nullptr</code>, <code>constexpr</code> objects, <code>typeof</code>, and <code>auto</code> type inference</li><li><code>[[nodiscard]]</code>, <code>[[maybe_unused]]</code>, and other attributes</li><li>Binary literals (<code>0b1010</code>) and digit separators (<code>1'000'000</code>)</li><li><code>_BitInt(N)</code>, <code>#embed</code>, <code>&lt;stdbit.h&gt;</code> (portable popcount and bit scans), and <code>unreachable()</code></li><li>Two's complement required, and old-style K&amp;R function definitions removed</li></ul></td></tr>
</table></div>
<p>GCC 14 and Clang 18 accept <code>-std=c23</code> (earlier versions spell it <code>-std=c2x</code>), and GCC 15 made C23 the default.</p>
<p class="refs">References: ISO/IEC 9899:2024 (C23) and the N3096 working draft · Kernighan and Ritchie, <em>The C Programming Language</em>, 2nd ed. · Jens Gustedt, <em>Modern C</em> · SEI CERT C Coding Standard, rules INT30-C to INT36-C (integer conversions and overflow) and EXP30-C (evaluation order)</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Given <code>uint8_t a = 250, b = 10;</code>, evaluate each expression and give its type:</p><ol><li><code>a + b</code></li><li><code>(uint8_t)(a + b)</code></li><li><code>a + b &gt; 255</code></li><li><code>a - b &gt; 0u</code> with <code>a = 10, b = 250</code></li></ol>`,
        a: `<ol>
<li>Both operands are promoted to <code>int</code> before the add, so the result is 250 + 10 = <strong>260</strong>, type <code>int</code>.</li>
<li>Converting 260 to an 8-bit unsigned type keeps it modulo 256: 260 − 256 = <strong>4</strong>, type <code>uint8_t</code>.</li>
<li>The comparison is done in <code>int</code>: 260 &gt; 255 is true, so the value is <strong>1</strong>, type <code>int</code>. Had the sum been stored in a <code>uint8_t</code> first, the test would read 4 &gt; 255 and be false.</li>
<li>10 − 250 in <code>int</code> is −240. Comparing an <code>int</code> with an <code>unsigned int</code> converts −240 to 4,294,967,296 − 240 = 4,294,967,056, which is greater than 0, so the value is <strong>1</strong> (true), type <code>int</code>.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A branch predictor model folds history with</p><pre><code>uint16_t a = 50000, b = 50000;
uint32_t h = a * b;</code></pre><p>It prints the expected 2,500,000,000 on one build and something else after an unrelated change elsewhere in the function. Both operands are unsigned and so is the result. What is wrong?</p>`,
        a: `<ul>
<li>Integer promotion converts both <code>uint16_t</code> operands to <code>int</code>, because <code>int</code> (32 bits) can hold every <code>uint16_t</code> value. The multiply is a <em>signed</em> 32-bit multiply.</li>
<li>50,000 × 50,000 = 2,500,000,000, which is more than <code>INT_MAX</code> = 2,147,483,647. That is signed overflow, which is undefined behavior.</li>
<li>Usually the hardware <code>imul</code> wraps and the conversion to <code>uint32_t</code> gives the expected bits, which is why it "works". But the optimizer may assume the product is at most <code>INT_MAX</code> and therefore non-negative, and fold later comparisons or range checks on <code>h</code> accordingly. An unrelated change can expose that.</li>
<li>Fix: make the arithmetic unsigned before it happens, as in <code>uint32_t h = (uint32_t)a * b;</code>. Then <code>b</code> is converted to <code>uint32_t</code> as well, and unsigned overflow is defined. <code>-fsanitize=undefined</code> reports the original at run time.</li>
</ul>`
      },
      {
        q: `<p>What is <code>dispatch</code> in <code>int (*(*dispatch)[16])(uint32_t);</code>? How would you write it readably, and how do you call the function in slot 3?</p>`,
        a: `<p>Read from the name: <code>dispatch</code> is a pointer (<code>*dispatch</code>) to an array of 16 (<code>[16]</code>) pointers (<code>*</code>) to functions taking a <code>uint32_t</code> (<code>(uint32_t)</code>) and returning <code>int</code>.</p>
<pre><code>typedef int Handler(uint32_t);     // a function type
typedef Handler *Table[16];        // array of 16 function pointers
Table *dispatch;                   // pointer to such an array

int r = (*dispatch)[3](insn);      // dereference, index, call</code></pre>
<p><code>(*dispatch)</code> is needed because <code>[]</code> binds tighter than <code>*</code>. <code>dispatch[3]</code> would index a hypothetical array of tables. In machine terms the call is two loads (the table address, then slot 3 at byte offset 3 × 8 B = 24 B) and an indirect <code>call</code>.</p>`
      }
    ]
  }
},

{
  id: "c-fast",
  region: "clang",
  title: "Writing Fast C",
  sections: [
    { id: "measure", label: "Measure Before Changing Code" },
    { id: "alias", label: "Aliasing and restrict" },
    { id: "layout", label: "Data Layout for the Cache" },
    { id: "branch", label: "Branches" },
    { id: "arith", label: "Arithmetic That Costs More Than It Looks" },
    { id: "calls", label: "Inlining, LTO, and PGO" },
    { id: "alloc", label: "Allocation in Hot Paths" }
  ],
  body: `
<p>The compiler already does the transformations in <a href="#/comp-opt">Compiler Optimizations</a>. Writing fast C is mostly about not blocking them: giving the optimizer the facts it needs (no aliasing, known trip counts, visible callees) and laying out data the way the cache wants it. The examples come from the hot loops of a cycle-level simulator.</p>

<h3 id="sec-measure">Measure Before Changing Code</h3>
<ul>
<li><strong>Build the way you'll run:</strong> <code>-O2</code> or <code>-O3</code>, plus <code>-march=native</code> if the binary only runs on this host (it enables AVX2 or AVX-512, BMI, and so on). <code>-g</code> adds debug info without changing the code.</li>
<li><strong>Find the hot spots:</strong> <code>perf record -g ./sim</code> and <code>perf report</code> on Linux, or VTune. Then <code>perf stat -e cycles,instructions,branch-misses,cache-misses</code> tells you whether a hot function is limited by the front end, mispredictions, or memory (see <a href="#/perf-bounds">Bounds</a>).</li>
<li><strong>Read the assembly of the hot loop:</strong> <code>perf annotate</code> or Compiler Explorer. Look for spills to <code>[rsp+N]</code>, calls that weren't inlined, and scalar code where you expected vectors.</li>
<li><strong>Ask the compiler what it didn't do:</strong> <code>-fopt-info-vec-missed</code> (GCC) and <code>-Rpass-missed=loop-vectorize</code> (Clang) say why a loop didn't vectorize.</li>
<li><strong>Benchmark with care:</strong> pin the thread (<code>taskset</code>), fix the frequency or report cycles rather than time, repeat runs, and make sure the result is used so the work isn't deleted.</li>
</ul>

<h3 id="sec-alias">Aliasing and restrict</h3>
<p>If two pointers might point to overlapping memory, every store through one may change what the other reads. The compiler must then keep loads and stores in source order and reload values after each store.</p>
<pre><code>void add(float *dst, const float *a, const float *b, int n) {
    for (int i = 0; i &lt; n; i++) dst[i] = a[i] + b[i];
}</code></pre>
<p>Here <code>dst</code> might overlap <code>a</code> or <code>b</code>. GCC either keeps the loop scalar or vectorizes it behind a run-time overlap check, with a scalar copy as the fallback. Adding <code>restrict</code> to all three pointers promises no overlap, so the check and the fallback copy disappear:</p>
<pre><code>void add(float *restrict dst, const float *restrict a,
         const float *restrict b, int n);</code></pre>
<ul>
<li><strong>Strict aliasing helps automatically:</strong> pointers to different types (<code>float *</code> and <code>int *</code>) are assumed not to alias. But <code>char *</code> and <code>unsigned char *</code> may alias anything, so a loop that writes through a <code>uint8_t *</code> forces reloads of everything else.</li>
<li><strong>Copy to a local:</strong> reading a field like <code>cpu-&gt;rob_size</code> inside a loop that also writes through other pointers forces a reload each iteration. Copying it into a local first lets it stay in a register.</li>
<li><strong>Accumulate in a local:</strong> <code>for (...) stats-&gt;hits += f(i);</code> may store to memory each iteration. Summing into a local and storing once at the end avoids that.</li>
</ul>

<h3 id="sec-layout">Data Layout for the Cache</h3>
<p>A hot loop that touches one field of many records wastes most of every cache line it loads if the records are stored whole. That is the choice between an <em>array of structs</em> (AoS) and a <em>struct of arrays</em> (SoA):</p>
<pre><code>// AoS: one struct per cache block, all fields together
struct Line { uint64_t tag; uint8_t valid, dirty, lru; uint32_t fill_cycle; };
struct Line l2[SETS][WAYS];

// SoA: each field in its own array, so a tag search reads only tags
struct L2 {
    uint64_t tag[SETS][WAYS];
    uint8_t  valid[SETS][WAYS];
    uint8_t  lru[SETS][WAYS];
    uint32_t fill_cycle[SETS][WAYS];
};</code></pre>
<ul>
<li><strong>Use SoA</strong> for fields a loop scans across many entries (tags, ready bits, source tags), which also makes them vectorizable (see <a href="#/r/avx">AVX and SIMD</a>).</li>
<li><strong>Use AoS</strong> for fields always used together on one entry.</li>
<li><strong>Split hot and cold fields:</strong> keep the per-cycle fields in a small struct and move debug strings and statistics to a parallel array.</li>
<li><strong>Use indices instead of pointers:</strong> a <code>uint32_t</code> index into an array is half the size of a pointer, survives <code>realloc</code>, and keeps linked structures (free lists, LRU stacks) inside one block of memory.</li>
<li><strong>Walk memory in order:</strong> loop over the last index of a row-major array innermost.</li>
</ul>

<h3 id="sec-branch">Branches</h3>
<p>A predictable branch is nearly free, and an unpredictable one costs a pipeline flush of 15 to 20 cycles on current big cores. Data-dependent conditions in simulators (is this way valid, did this tag match, is this operand ready) are often unpredictable.</p>
<pre><code>// branchy: one branch per element, mispredicts when cond is random
for (i = 0; i &lt; n; i++) if (v[i] &lt; t) count++;

// branchless: the comparison becomes data (setl / adc), no branch to miss
for (i = 0; i &lt; n; i++) count += v[i] &lt; t;

// select without a branch: compiles to cmov
int lat = hit ? L1_LAT : MISS_LAT;</code></pre>
<ul>
<li><strong>Branchless isn't always faster:</strong> it turns a control dependency into a data dependency, so when the branch is well predicted, the branchy code can win by not waiting on the data.</li>
<li><strong><code>__builtin_expect(x, 0)</code></strong> (C23 offers no standard spelling, and C++20 has <code>[[unlikely]]</code>) moves the unlikely path out of line. It changes layout, not the hardware predictor.</li>
<li><strong>Lookup tables</strong> replace a chain of <code>if</code>s or a <code>switch</code> with one load, which is good when the table stays in L1.</li>
<li><strong>Bit tricks</strong> replace loops over flags: <code>__builtin_ctz(mask)</code> finds the first ready entry, <code>__builtin_popcount(mask)</code> counts them, and <code>mask &amp;= mask - 1</code> clears the lowest set bit.</li>
</ul>

<h3 id="sec-arith">Arithmetic That Costs More Than It Looks</h3>
<div class="tbl"><table>
<tr><th>Code</th><th>Cost</th><th>Cheaper form</th></tr>
<tr><td><code>x / y</code>, <code>x % y</code> with run-time <code>y</code></td><td>A hardware divide: Agner Fog lists 35 to 88 cycles of latency for a 64-bit <code>div</code> on Skylake, and about 15 cycles on Ice Lake</td><td>Make <code>y</code> a power of two and use a shift or mask, or keep it a compile-time constant</td></tr>
<tr><td><code>x / 10</code> with constant divisor</td><td>A multiply by a magic constant and a shift: <code>x * 0xCCCCCCCD &gt;&gt; 35</code> for unsigned 32-bit</td><td>Already done by the compiler</td></tr>
<tr><td><code>x / 2</code> on a signed <code>int</code></td><td>Shift plus a fix-up for negative values (3 or 4 instructions)</td><td>Use <code>unsigned</code> when the value can't be negative, then it is one shift</td></tr>
<tr><td><code>idx = (idx + 1) % size</code> in a ring buffer</td><td>A divide per step if <code>size</code> isn't a constant</td><td><code>if (++idx == size) idx = 0;</code>, or a power-of-two size with <code>&amp; (size - 1)</code></td></tr>
<tr><td><code>double</code> where <code>float</code> or integers suffice</td><td>Half as many lanes per vector</td><td>Use the narrowest type that holds the range</td></tr>
<tr><td><code>pow(x, 2)</code>, <code>fabs</code> through a non-inlined call</td><td>A library call</td><td><code>x * x</code>, and <code>-fno-math-errno</code> so the compiler can inline math builtins</td></tr>
</table></div>
<p>Floating-point reductions don't vectorize by default, because reordering a sum changes its rounding. <code>-ffast-math</code> (or just <code>-fassociative-math -fno-signed-zeros -fno-trapping-math</code>) permits it. Without them, GCC keeps strict left-to-right order: on a Haswell target it loads 8 floats at a time and then adds them one by one with 8 dependent <code>vaddss</code> instructions.</p>

<h3 id="sec-calls">Inlining, LTO, and PGO</h3>
<ul>
<li><strong><code>static inline</code> in a header</strong> lets every caller inline a small hot function, such as a set-index or tag computation.</li>
<li><strong>Link-time optimization</strong> (<code>-flto</code>) inlines across <code>.c</code> files, so splitting the simulator into many files no longer costs calls in the per-cycle loop.</li>
<li><strong>Profile-guided optimization</strong> (<code>-fprofile-generate</code>, run on representative traces, then <code>-fprofile-use</code>) lays out hot paths as fall-through, inlines what is actually hot, and orders <code>switch</code> cases by frequency. Gains of 10% to 30% are common for branchy, interpreter-like code, which describes most simulators.</li>
<li><strong>Function attributes</strong> such as <code>__attribute__((hot))</code>, <code>cold</code>, <code>noinline</code>, and <code>always_inline</code> override the heuristics where measurement says they are wrong.</li>
</ul>

<h3 id="sec-alloc">Allocation in Hot Paths</h3>
<ul>
<li><strong>Allocate at configuration time:</strong> every hardware structure has a fixed capacity, so its storage can be allocated once, when the model is built. ROB, queues, MSHRs, and caches all fit this.</li>
<li><strong>Free lists over <code>malloc</code>:</strong> for objects created and destroyed every cycle (in-flight µops, memory requests), keep a pool array plus a free list of indices. Allocate and free are then a push and a pop.</li>
<li><strong>Arenas for phase-lifetime data:</strong> bump-pointer allocate everything for one phase (a trace chunk, a sampling interval) and free it all at once by resetting the pointer.</li>
<li><strong>Grow geometrically:</strong> when a dynamic array must grow, double its capacity, so the total copying stays linear in the final size.</li>
</ul>
<p class="refs">References: GCC manual, "Options That Control Optimization" and "Common Function Attributes" · Agner Fog, <em>Optimizing Software in C++</em> and <em>Instruction Tables</em> · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., section 2.3 (compiler optimizations that reduce miss rate, including loop interchange and blocking) · Ulrich Drepper, "What Every Programmer Should Know About Memory," 2007</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Golden Cove's 97-entry scheduler stores each entry as a 32 B struct (<code>uint64_t pc</code>, <code>uint16_t src1, src2, dst</code>, <code>uint8_t rdy1, rdy2</code>, <code>uint32_t opcode</code>, <code>uint64_t seq</code>). Each wakeup compares a destination tag against <code>src1</code> and <code>src2</code> of every entry. The array starts on a 64 B boundary. How many 64 B lines does one wakeup scan touch, and how many after moving <code>src1</code> and <code>src2</code> into their own arrays (each 64 B aligned)?</p>`,
        a: `<ol>
<li>AoS: the scan touches every entry, so it touches the whole array: 97 entries × 32 B/entry = 3,104 B.</li>
<li>3,104 B / 64 B/line = 48.5, so <strong>49 lines</strong>, of which only the 4 B of tags per 32 B entry are used: 4 B / 32 B = 12.5% of the bytes loaded.</li>
<li>SoA: <code>src1</code> is 97 entries × 2 B/entry = 194 B, and 194 B / 64 B/line = 3.03, so 4 lines. <code>src2</code> is the same, 4 lines.</li>
<li>Total: 4 lines + 4 lines = <strong>8 lines</strong>, about 6 times fewer (49 lines / 8 lines ≈ 6.1). The two arrays also hold 16 tags per 32 B vector register, so the compare can be vectorized.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A cache model counts, for 4,000,000 accesses, how many have a reuse distance under a threshold: <code>for (i) if (dist[i] &lt; T) near++;</code>. The compiler emitted a conditional branch, and about half the distances fall under <code>T</code> in random order. The host is a Golden Cove P-core at 4.9 GHz, the loop runs at 1 cycle per element when the branch is predicted, and a misprediction costs 17 cycles. Estimate the loop's time branchy and branchless, and say when the branchy version would win.</p>`,
        a: `<ol>
<li>Random 50/50 outcomes mispredict about half the time: 4,000,000 elements × 0.5 mispredicts/element = 2,000,000 mispredicts.</li>
<li>Branchy cycles: 4,000,000 elements × 1 cycle/element + 2,000,000 mispredicts × 17 cycles/mispredict = 4,000,000 cycles + 34,000,000 cycles = 38,000,000 cycles. Time: 38,000,000 cycles / 4.9 GHz ≈ <strong>7.76 ms</strong>.</li>
<li>Branchless (<code>near += dist[i] &lt; T;</code>, a compare and an add with carry or <code>setl</code>): 4,000,000 elements × 1 cycle/element = 4,000,000 cycles, and 4,000,000 cycles / 4.9 GHz ≈ <strong>0.82 ms</strong>, about 9.5 times faster. With AVX2 the compiler can also vectorize it, 8 elements per compare.</li>
<li>The branchy version wins when the outcome is predictable, for example if <code>dist</code> is sorted, or nearly all distances fall on one side of <code>T</code>. Then mispredictions vanish and the branch adds no data dependency.</li>
</ol>`
      },
      {
        q: `<p>A simulator spends 40% of its time in <code>void tick(Core *c)</code>, which loops over the ROB reading <code>c-&gt;rob[i]</code>, <code>c-&gt;cycle</code>, and <code>c-&gt;rob_size</code>, and incrementing <code>c-&gt;stats.retired</code> and <code>c-&gt;stats.stall[reason]</code>. <code>perf annotate</code> shows reloads of <code>c-&gt;cycle</code> and <code>c-&gt;rob_size</code> every iteration. Why, and how do you fix it without changing behavior?</p>`,
        a: `<ul>
<li>The compiler keeps <code>c-&gt;cycle</code> and <code>c-&gt;rob_size</code> in registers only if it can prove that nothing in the loop writes them. The loop stores integers every iteration (<code>c-&gt;stats.retired</code>, <code>c-&gt;stats.stall[reason]</code>, and possibly ROB entry fields), and any store the compiler can't separate from those two fields counts as a possible write.</li>
<li>Typical culprits: a store through another pointer of the same integer type, a store through a <code>char *</code> or <code>uint8_t *</code> (character types may alias anything), or a call to a function that isn't inlined and can reach <code>c</code>. Any one of them forces a reload after it.</li>
<li><strong>Fix:</strong> copy the read-only values into locals before the loop (<code>uint64_t now = c-&gt;cycle; int n = c-&gt;rob_size;</code>), count into local variables or a local array, and add them to <code>c-&gt;stats</code> once after the loop. The behavior is the same because nothing in the loop legitimately changes <code>cycle</code> or <code>rob_size</code>.</li>
<li>Check the result in the assembly: the loop should have no loads from <code>[rdi+offset of cycle]</code> and one store per counter after the loop.</li>
</ul>`
      }
    ]
  }
}
]);
