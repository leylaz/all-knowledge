/* Section: Instruction set architecture
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "isa"). */

section({
  id: "isa",
  name: "Instruction Set Architecture",
  cap: "The contract between hardware and software",
  sections: [{ id: "what-isa", label: "What an ISA Is" }, { id: "not-isa", label: "What the ISA Doesn't Define" }],
  body: `
<h3 id="sec-what-isa">What an ISA Is</h3>
<p>The <strong>instruction set architecture</strong> is the contract between hardware and software. It defines everything software can see and rely on: the instructions, their encodings and exact effects, the registers, data types, memory behavior, and how the processor handles privilege, interrupts, and exceptions. Compilers generate code for an ISA, and any processor that implements that ISA can run the same binaries.</p>
<p>Examples: x86-64 (Intel, AMD), Arm (Armv8 and Armv9, in phones, Apple's Macs, and many servers), and RISC-V (an open standard).</p>
<p>Strictly speaking, "architecture" means exactly this programmer-visible contract. That's why the ISA is the <em>starting point</em> of a chip project's architecture work rather than something it produces (see <a href="#/eda-arch">Architecture and performance modeling</a>).</p>
<h3 id="sec-not-isa">What the ISA Doesn't Define</h3>
<p>The ISA says what instructions do, never how fast or by what mechanism. Everything below is <strong>microarchitecture</strong>, chosen separately by each design team:</p>
<ul>
<li>Pipeline depth and width.</li>
<li>Cache sizes, associativity, and prefetchers.</li>
<li>Branch predictors.</li>
<li>Out-of-order execution, register renaming, and the sizes of the ROB and queues.</li>
<li>How many cycles any instruction takes.</li>
</ul>
<p>That's why Apple's M-series cores and Arm's Cortex cores both run the same Arm binaries while being completely different designs, and why two chips with the same ISA can differ greatly in performance. The rest of this site's Pipeline stages and Out-of-order core sections are about these implementation choices.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Sort each into ISA or microarchitecture:</p><ul><li>(a) RISC-V has 32 integer registers, with x0 always zero</li><li>(b) Zen 4's ROB has 320 entries</li><li>(c) Whether a misaligned load is allowed or faults</li><li>(d) Golden Cove's L1 data cache hits in 5 cycles</li><li>(e) x86 keeps stores in program order as seen by other cores</li></ul>`,
        a: `<ol><li>(a) <strong>ISA</strong>: software names those registers directly.</li><li>(b) <strong>Microarchitecture</strong>: invisible to software except through speed.</li><li>(c) <strong>ISA</strong>: it changes what a program does.</li><li>(d) <strong>Microarchitecture</strong>: a latency, which the ISA never specifies.</li><li>(e) <strong>ISA</strong>: the memory model (x86's TSO) is part of the contract, because correct multithreaded programs depend on it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Apple's Rosetta 2 translates x86-64 binaries to Arm ahead of time, yet Apple's cores also include a hardware TSO mode used only for translated code. Why does memory ordering need hardware help when instruction translation doesn't?</p>`,
        a: `<p>Instructions translate one to one or one to a few: an x86 add becomes an Arm add. Memory ordering doesn't translate locally. x86 programs assume TSO (stores become visible in order, loads aren't reordered with each other), while Arm allows much more reordering. To get TSO from plain Arm code, the translator would have to make almost every load an acquire and every store a release, or insert barriers, on nearly every memory access, because it can't tell which accesses are to shared data. That costs a lot of performance. A per-thread hardware mode that enforces TSO ordering lets translated code use ordinary loads and stores at close to native speed.</p>`
      }
    ]
  }
}, [
{
  id: "isa-defines",
  region: "isa",
  title: "What an ISA Defines",
  sections: [
    { id: "types-regs", label: "Data Types and Registers" },
    { id: "fp", label: "Floating-Point Formats" },
    { id: "abi", label: "ISA vs. ABI" },
    { id: "semantics", label: "Instruction Semantics" },
    { id: "memory", label: "Memory: Endianness, Model, Protection" },
    { id: "system", label: "Privilege, Interrupts, Exceptions" }
  ],
  body: `
<h3 id="sec-types-regs">Data Types and Registers</h3>
<ul>
<li><strong>Integers:</strong> 1, 2, 4, and 8 bytes (8, 16, 32, and 64 bits). The bits themselves aren't signed or unsigned: the ISA defines the representation (two's complement for signed values) and which instructions interpret the bits as <strong>signed or unsigned</strong>, such as signed vs. unsigned comparison or division, and loads that sign-extend vs. zero-extend a smaller value. For example, the byte 0xFF is 255 to an instruction treating it as unsigned, but −1 to one treating it as a signed two's-complement value; loaded as one byte, it becomes 0x000000FF with a zero-extending load or 0xFFFFFFFF with a sign-extending load.</li>
<li><strong>Floating point:</strong> IEEE 754 formats, mainly single and double precision, often with smaller formats too (see <a href="#/isa-defines/fp">Floating-point formats</a> below).</li>
<li><strong>Vector types:</strong> packed groups of integers or floating-point values processed together by SIMD or vector instructions.</li>
<li><strong>General-purpose registers:</strong> how many there are and how wide. RISC-V has 32 (counting x0). 64-bit Arm has 31 (X0–X30); register number 31 means either the zero register (XZR) or the stack pointer, depending on the instruction. x86-64 has 16, and Intel's newer APX extension adds 16 more.</li>
<li><strong>Registers with fixed roles:</strong><ul><li>The program counter (PC)</li><li>A register hardwired to zero in some ISAs (RISC-V's x0, Arm's XZR, MIPS's $zero), which always reads as zero and ignores writes</li><li>In some ISAs a stack pointer. In x86 and Arm the stack pointer is architecturally special (instructions such as <code>push</code> and <code>pop</code> use it implicitly), while in RISC-V using x2 as the stack pointer is mostly an ABI convention.</li></ul></li>
<li><strong>Special registers:</strong><ul><li>Status flags (x86's FLAGS, Arm's condition flags)</li><li>Floating-point control and status (rounding mode, exception flags)</li><li>Control and status registers (CSRs) for privileged state, such as interrupt settings and the page table base (the address of the current page table's root: CR3 on x86, satp on RISC-V, TTBR on Arm), which the OS switches on every context switch</li></ul> Not every ISA has condition flags: RISC-V has none, so its branches compare two registers directly and comparisons like <code>slt</code> write a 0 or 1 into a register. That avoids a shared flags register every instruction might update, which simplifies out-of-order cores.</li>
<li><strong>Vector registers</strong> for SIMD or vector extensions.</li>
</ul>
<h3 id="sec-fp">Floating-Point Formats</h3>
<p>Almost every ISA uses the IEEE 754 standard. A floating-point number works like scientific notation in binary, with three fields:</p>
<ul>
<li><strong>Sign:</strong> 1 bit, positive or negative.</li>
<li><strong>Exponent:</strong> how large or small the number is (the power of 2).</li>
<li><strong>Fraction (mantissa):</strong> the significant digits.</li>
</ul>
<p class="eq">Value = (−1)<sup>sign</sup> × 1.fraction × 2<sup>(exponent − bias)</sup></p>
<p>The bias lets the exponent field represent negative exponents. "Single" and "double" refer to how many bits the number uses:</p>
<div class="tbl"><table>
<tr><th></th><th>Single precision (float)</th><th>Double precision (double)</th></tr>
<tr><td>Total size</td><td>32 bits (4 bytes)</td><td>64 bits (8 bytes)</td></tr>
<tr><td>Sign / exponent / fraction</td><td>1 / 8 / 23 bits</td><td>1 / 11 / 52 bits</td></tr>
<tr><td>Exponent bias</td><td>127</td><td>1023</td></tr>
<tr><td>Precision</td><td>About 7 decimal digits</td><td>About 15–16 decimal digits</td></tr>
<tr><td>Range</td><td>About 10<sup>−38</sup> to 10<sup>38</sup></td><td>About 10<sup>−308</sup> to 10<sup>308</sup></td></tr>
</table></div>
<p>More exponent bits give a wider <em>range</em>; more fraction bits give more <em>precision</em>. For example, 1.0 in single precision is sign 0, exponent 127 (meaning 2<sup>0</sup>), fraction 0: the bit pattern 0x3F800000.</p>
<p><strong>Special values.</strong> The formats reserve encodings for ±0, ±infinity (from overflow or dividing by zero), NaN ("not a number," from operations such as 0 ÷ 0), and subnormals (tiny numbers near zero with reduced precision).</p>
<p><strong>Not every decimal fits exactly.</strong> 0.1 in binary repeats forever, so it's stored as the nearest representable value. That's why floating-point results often differ slightly from what you'd expect.</p>
<p><strong>Why it matters for hardware:</strong></p>
<ul>
<li><strong>Doubles cost twice the memory and bandwidth,</strong> and fewer fit in a vector register: a 256-bit vector holds 8 singles but only 4 doubles.</li>
<li><strong>Scientific computing</strong> usually needs double precision; <strong>graphics and AI</strong> tolerate much less.</li>
<li><strong>Newer ISAs add smaller formats:</strong><ul><li>Half precision (FP16: 1/5/10 bits)</li><li>Bfloat16 (1/8/7 bits: the same range as single precision with less precision, popular for AI training)</li><li>8-bit formats for AI inference</li></ul> Halving the bits doubles how many numbers fit through the same memory bandwidth and vector units, which matters for bandwidth-bound AI workloads (see <a href="#/gen-gpus/roofline">the roofline model</a>).</li>
</ul>
<p>Every format from FP128 down to FP4, how the mantissa sets precision, BF16, TF32, and how the hardware computes with them: <a href="#/r/arith">Computer Arithmetic</a>.</p>
<h3 id="sec-abi">ISA vs. ABI</h3>
<p>The ISA defines only some register roles, such as the zero register and the PC. Conventions like "the first function argument goes in a0," "the return value goes in a0," or "these registers must be preserved across a call" come from the <strong>ABI</strong> (application binary interface), a separate agreement between compilers, libraries, and operating systems. Two programs compiled for the same ISA but different ABIs can't call each other's functions correctly.</p>
<h3 id="sec-semantics">Instruction Semantics</h3>
<p>For every instruction, the ISA defines the exact effect on the architectural state: which registers and memory it reads and writes, what happens on overflow, which condition flags change, how floating-point results are rounded, and which exceptions it can raise. It also defines the instruction <a href="#/isa-encoding">encoding</a> and the <a href="#/isa-addressing">addressing modes</a> operands can use.</p>
<p>The encoding says what an instruction <em>is</em>; the semantics say what it <em>does</em>. For unusual cases, the ISA defines what happens: whether the instruction raises an exception or produces a defined result. Divide by zero shows that ISAs genuinely differ, which is exactly why this must be specified:</p>
<div class="tbl"><table>
<tr><th>Case</th><th>What happens</th></tr>
<tr><td>Integer divide by zero on x86</td><td>Raises an exception; the operating system usually terminates the program</td></tr>
<tr><td>Integer divide by zero on RISC-V</td><td>No exception: the quotient is all ones (−1) and the remainder equals the dividend; software checks for zero if it cares</td></tr>
<tr><td>Integer divide by zero on Arm (64-bit)</td><td>No exception: the result is 0</td></tr>
<tr><td>Floating-point divide by zero (IEEE 754, all three)</td><td>Result is ±infinity and a divide-by-zero flag is set; whether the flag causes a trap depends on settings software controls</td></tr>
<tr><td>Floating-point overflow (IEEE 754)</td><td>Result is ±infinity and an overflow flag is set</td></tr>
</table></div>
<p>Each behavior is correct for its own ISA. What matters is that the ISA specifies it, so every implementation of that ISA behaves the same way.</p>
<h3 id="sec-memory">Memory: Endianness, Consistency, and Protection</h3>
<ul>
<li><strong>Endianness:</strong> whether a multi-byte value is stored with its least significant byte first (<strong>little-endian</strong>) or its most significant byte first (<strong>big-endian</strong>), where “first” means the lowest memory address. For the 32-bit value 0x12345678 stored at address 0x100:
<div class="tbl"><table>
<tr><th>Address</th><th>Little-endian</th><th>Big-endian</th></tr>
<tr><td>0x100</td><td>78</td><td>12</td></tr>
<tr><td>0x101</td><td>56</td><td>34</td></tr>
<tr><td>0x102</td><td>34</td><td>56</td></tr>
<tr><td>0x103</td><td>12</td><td>78</td></tr>
</table></div>
Little-endian puts the “little end” at the lowest address, so the bytes look reversed in memory; big-endian stores them in the order you'd write the number. It shows up when reading part of a value (a 1-byte load from 0x100 returns 0x78 on a little-endian machine but 0x12 on a big-endian one) and when sharing data between machines: network protocols use big-endian (“network byte order”), so little-endian machines swap bytes when sending and receiving, and binary file formats must specify their byte order. Registers have no endianness; it only describes how bytes are laid out in memory. x86, RISC-V, and Arm (by default) are little-endian; older ISAs such as SPARC and PowerPC were traditionally big-endian.</li>
<li><strong>Memory consistency model:</strong> the rules for the order in which one core's loads and stores become visible to other cores. x86 uses a fairly strong model (TSO), while Arm and RISC-V use weaker ones that allow more reordering. The ISA also defines the atomic instructions and fences programs use to enforce ordering (see <a href="#/c11-ordering">C11 memory ordering</a>).</li>
<li><strong>Virtual memory:</strong> the ISA defines how virtual addresses are translated to physical ones (see <a href="#/virtual-memory">Virtual and physical memory</a>):
<ul>
<li><strong>Page sizes:</strong> a base size, usually 4 KB, plus larger “huge pages” (2 MB and 1 GB on x86-64). 64-bit Arm also allows 16 KB and 64 KB base pages; Apple uses 16 KB.</li>
<li><strong>Page table format:</strong> how many levels the multilevel page table has, and the layout of each entry.</li>
<li><strong>Page table entry contents:</strong><ul><li>The <strong>physical frame number</strong> (where the page actually lives, the translation itself)</li><li>A <strong>valid (present) bit</strong> (if it's 0, an access causes a page fault)</li><li><strong>Permission bits</strong> (read, write, execute)</li><li>A <strong>user/supervisor bit</strong> (which privilege levels may access the page)</li><li><strong>Accessed and dirty bits</strong>, set by hardware when the page is read or written, which the OS uses to pick pages to evict and to know which must be written back</li><li><strong>Memory attributes</strong>, such as whether the page may be cached (device registers usually can't) and a “global” bit for kernel pages shared by every process</li></ul></li>
<li><strong>Who walks the table:</strong> on x86, Arm, and RISC-V, hardware walks the page table itself on a TLB miss, which is why the ISA must fix the format. Some older ISAs, such as MIPS, let the OS handle TLB misses in software, so the OS chose the table format and the ISA only defined the TLB.</li>
</ul></li>
<li><strong>Memory protection:</strong> per-page permission bits (readable, writable, executable) and a user/supervisor bit controlling which privilege levels may access each page, so user programs can't touch kernel memory. Protection also works in the other direction: modern ISAs let the OS stop the <em>kernel</em> from accidentally executing or accessing <em>user</em> memory unless it explicitly allows it (SMEP and SMAP on x86, PXN and PAN on Arm, and a similar control on RISC-V), which blocks a whole class of security exploits.</li>
</ul>
<h3 id="sec-system">Privilege, Interrupts, and Exceptions</h3>
<ul>
<li><strong>Privilege levels:</strong> user vs. kernel (and often hypervisor and firmware levels), and which instructions and registers each level may use.</li>
<li><strong>System instructions:</strong> how software enters the operating system (<code>ecall</code> in RISC-V, <code>svc</code> in Arm, <code>syscall</code> in x86-64) and returns from it.</li>
<li><strong>Interrupts and exceptions:</strong> what causes them, which registers record the cause and the address to resume at, where the handler is found, and the guarantee that exceptions are precise (see <a href="#/exceptions">Faults, traps, interrupts, and system calls</a>).</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Classify each as defined by the ISA, the ABI, or the microarchitecture:</p><ul><li>(a) x0 always reads as zero</li><li>(b) The first function argument goes in register a0</li><li>(c) A 64 KB L1 data cache</li><li>(d) TSO memory ordering</li><li>(e) 4-wide decode</li><li>(f) The page table format</li><li>(g) The branch predictor design</li></ul>`,
        a: `<ol type="a"><li>ISA (RISC-V).</li><li>ABI: a software calling convention.</li><li>Microarchitecture.</li><li>ISA: the memory consistency model (x86).</li><li>Microarchitecture.</li><li>ISA (the hardware page walker and the OS must agree on it).</li><li>Microarchitecture.</li></ol>`
      },
      {
        q: `<p>Encode −2.5 as an IEEE 754 single-precision number.</p>`,
        a: `<ol><li>Sign: negative, so 1.</li><li>2.5 = 1.25 × 2<sup>1</sup>, so the stored exponent is 1 + 127 = 128 = 1000 0000.</li><li>Fraction: the part after the leading 1 is .25 = binary .01, so the 23-bit fraction is 0100 0000 0000 0000 0000 000.</li><li>Bits: 1 10000000 01000000000000000000000 = <strong>0xC0200000</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What happens when a program divides an integer by zero on x86, RISC-V, and Arm?</p>`,
        a: `<p>x86 raises an exception, and the OS usually terminates the program. RISC-V raises no exception: the quotient is defined as all ones (−1) and the remainder equals the dividend. 64-bit Arm also raises no exception and returns 0. All three are correct for their ISA; the point is that the ISA's semantics define the outcome so every implementation agrees. Floating-point division by zero is defined by IEEE 754 on all three: the result is ±infinity and a flag is set.</p>`
      },
      {
        q: `<p>Why is bfloat16 popular for AI training instead of FP16?</p>`,
        a: `<p>bfloat16 keeps single precision's 8 exponent bits, so it has the same range: training values such as gradients rarely overflow or underflow, which FP16's 5-bit exponent can't guarantee without extra loss scaling. It gives up precision (7 fraction bits instead of FP16's 10), which neural networks tolerate well. It's also easy to convert from single precision, since it's just the top 16 bits.</p>`
      },
      {
        q: `<p>Two processors implement the same ISA. Why can one run a program 2× faster than the other?</p>`,
        a: `<p>The ISA only fixes what each instruction does, not how it's implemented. The faster core may be wider, have a larger instruction window, better branch prediction, bigger or smarter caches and prefetchers, more memory bandwidth, or a higher clock frequency. The same binary executes the same instructions on both, so the difference is entirely in CPI and cycle time (see <a href="#/pipelining">the iron law</a>).</p>`
      },
      {
        q: `<p>Why does the ISA need to define a memory consistency model?</p>`,
        a: `<p>Multithreaded programs depend on the order in which one core's loads and stores become visible to other cores. Without a defined model, the same correct program could fail on one implementation and work on another. The model tells hardware designers which reorderings are allowed (for example, a store buffer letting loads pass earlier stores) and tells programmers and compilers which fences or atomic instructions they need to enforce order.</p>`
      }
    ]
  }
},

{
  id: "isa-encoding",
  region: "isa",
  title: "Instruction Encoding",
  sections: [{ id: "fields", label: "Fields and Formats" }, { id: "fixed-variable", label: "Fixed vs. Variable Length" }, { id: "load-store", label: "Load-Store vs. Register-Memory" }],
  body: `
<h3 id="sec-fields">Fields and Formats</h3>
<p>Every instruction has a defined bit-level layout, its <strong>encoding</strong>, made of fields:</p>
<ul>
<li><strong>Opcode</strong> (and sometimes extra function fields): which operation it is.</li>
<li><strong>Register specifiers:</strong> which registers are sources and which is the destination.</li>
<li><strong>Immediate:</strong> a constant or offset encoded directly in the instruction.</li>
</ul>
<p>Instructions are grouped into a few <strong>formats</strong> that share a layout. For example, a RISC-V I-type instruction (used by <code>addi</code> and loads):</p>
<div class="tbl"><table>
<tr><th>Bits 31–20</th><th>19–15</th><th>14–12</th><th>11–7</th><th>6–0</th></tr>
<tr><td>immediate (12 bits)</td><td>rs1 (source)</td><td>funct3</td><td>rd (destination)</td><td>opcode</td></tr>
</table></div>
<p>RISC encodings keep register fields at the same positions in every format, so the register file can be read while the instruction is still being decoded (fixed-field decoding). RISC-V even scatters the bits of some immediates across the instruction to keep the register fields in place. See the MIPS decoding example on the <a href="#/stage-id">ID stage</a> page.</p>
<p><strong>Where the addressing mode lives.</strong> In RISC ISAs, the addressing mode usually isn't a separate field: it's implied by the opcode and format (for example, every load uses base + offset). x86 encodes it explicitly, in extra bytes (called ModRM and SIB) that can specify modes such as base + index × scale + displacement.</p>
<h3 id="sec-fixed-variable">Fixed vs. Variable Length</h3>
<ul>
<li><strong>Fixed length</strong> (RISC-V, 64-bit Arm): every instruction is 4 bytes. Limited exceptions: RISC-V has an optional compressed extension with 2-byte instructions, and older 32-bit Arm code can use Thumb, a mix of 2- and 4-byte instructions.</li>
<li><strong>Variable length</strong> (x86): instructions are 1 to 15 bytes.</li>
</ul>
<p><strong>Why variable length makes fetch and decode hard.</strong> The difficulty isn't just that instructions have different numbers of bytes. It's that the decoder can't tell where the next instruction starts until it has worked out the current one's length from its prefixes, opcode, and operand bytes. Finding boundaries is therefore sequential, which makes decoding several instructions per cycle difficult, and an instruction can straddle two fetch blocks or cache lines. With fixed length, boundaries are always known (every 4 bytes, and the next PC is PC + 4), so several decoders can work on several instructions at once (see the <a href="#/stage-if">IF stage</a> page).</p>
<p><strong>How x86 cores cope:</strong></p>
<ul>
<li><strong>Predecode bits</strong> stored in the instruction cache mark where instructions begin.</li>
<li><strong>Micro-op caches</strong> hold already-decoded instructions, so hot code skips decoding.</li>
<li><strong>Parallel length decoders</strong> examine several possible starting points at once.</li>
</ul>
<p><strong>In one sentence:</strong> variable-length encodings like x86's make wide fetch and decode hard because the hardware has to find each instruction's length before it can locate the next one, while fixed-length encodings like RISC-V's and Arm's put every instruction at a known position.</p>
<h3 id="sec-load-store">Load-Store vs. Register-Memory</h3>
<p>This is a separate choice from addressing modes: which instructions are allowed to touch memory.</p>
<ul>
<li><strong>Load-store</strong> (RISC-V, Arm): only loads and stores access memory; arithmetic works only on registers. This keeps the pipeline simple: one ALU stage can compute either an address or a result, never both (see the <a href="#/stage-ex">EX stage</a>).</li>
<li><strong>Register-memory</strong> (x86): arithmetic instructions can read or write memory directly, as in <code>add eax, [rbx+8]</code>. Modern x86 cores split such instructions into simpler micro-ops internally.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A RISC-V I-type instruction has a 7-bit opcode, a 5-bit destination register, a 3-bit function field, a 5-bit source register, and a 12-bit immediate. Check that it fills 32 bits, and give the immediate's range.</p>`,
        a: `<ol><li>7 + 5 + 3 + 5 + 12 = <strong>32 bits</strong>.</li><li>5-bit register fields can name 2<sup>5</sup> = 32 registers.</li><li>The 12-bit immediate is signed (two's complement): <strong>−2,048 to +2,047</strong>. Larger constants need two instructions (for example, <code>lui</code> to set the upper bits, then <code>addi</code>).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What are the trade-offs between fixed-length and variable-length instruction encodings?</p>`,
        a: `<p><strong>Fixed length</strong> (RISC-V, Arm): the next instruction's address is always known, fields sit at fixed positions so register reads can start before decode finishes, and wide fetch and decode are simple. The cost is lower code density: simple instructions waste bits, and large constants need extra instructions. <strong>Variable length</strong> (x86, 1 to 15 bytes): denser code and room for rich instructions, but the hardware must find instruction boundaries before decoding, which makes wide decode hard and costs power. That's why x86 cores add predecode bits and micro-op caches. Many fixed-length ISAs add a compressed 16-bit subset (RISC-V's C extension) to recover density.</p>`
      }
    ]
  }
},

{
  id: "isa-addressing",
  region: "isa",
  title: "Addressing Modes",
  sections: [{ id: "modes", label: "The Modes" }, { id: "pc-rel", label: "PC-Relative" }, { id: "base-offset", label: "Base + Offset" }, { id: "summary", label: "In One Paragraph" }],
  body: `
<p>An <strong>addressing mode</strong> is how an instruction specifies where its operand comes from: a constant in the instruction, a register, or a location in memory or code computed from a register or the PC plus an offset.</p>
<h3 id="sec-modes">The Modes</h3>
<div class="tbl"><table>
<tr><th>Mode</th><th>Example (RISC-V)</th><th>Where the operand comes from</th></tr>
<tr><td>Immediate</td><td><code>addi x5, x6, 10</code></td><td>The constant 10, encoded in the instruction</td></tr>
<tr><td>Register</td><td><code>add x5, x6, x7</code></td><td>The register file</td></tr>
<tr><td>PC-relative</td><td><code>beq x5, x6, loop</code></td><td>An address computed as the PC plus an offset encoded in the instruction</td></tr>
<tr><td>Base + offset</td><td><code>lw x5, 8(x6)</code></td><td>Memory at the address x6 + 8</td></tr>
<tr><td>Register indirect, indexed, absolute, and others</td><td>Mostly in CISC ISAs such as x86</td><td>Memory, located other ways (for example, base + index × scale)</td></tr>
</table></div>
<p>In RISC ISAs, the addressing mode is implied by the opcode rather than encoded separately; x86 encodes it in extra bytes (see <a href="#/isa-encoding/fields">Fields and formats</a>).</p>
<h3 id="sec-pc-rel">PC-Relative</h3>
<p>PC-relative addressing always includes an offset: the instruction encodes it, and the hardware adds it to the PC to compute an address.</p>
<ul>
<li><strong>For branches and jumps,</strong> the result is the address to fetch next. The offset is signed, so it can point backward (a loop) or forward.</li>
<li><strong>For PC-relative data accesses</strong> (such as RISC-V's <code>auipc</code> or x86-64's RIP-relative loads), the result is a memory address, and the data is then read from memory there. The PC is the starting point for the address, not the source of the data.</li>
<li><strong>Which PC?</strong> ISAs differ: RISC-V adds the offset to the branch's own address, while MIPS adds it (counted in instructions, so multiplied by 4) to PC + 4, as in the loop example on the <a href="#/stage-id">ID stage</a> page.</li>
</ul>
<p>"Offset" is the right word rather than "increment," since branch offsets are often negative. The PC is implicit rather than an encoded operand: the instruction encodes only the offset. For branches, the result is called the <strong>branch target</strong>; “effective address” is reserved for the memory address of a load or store. Because a direct branch's target needs only the PC and the encoded offset, decode can compute it early (see <a href="#/branch-hazards/btb">The BTB and decode redirects</a>).</p>
<h3 id="sec-base-offset">Base + Offset</h3>
<p>A register supplies a <strong>base address</strong>, and the instruction supplies an <strong>offset</strong>. When the instruction accesses memory, the location is the base register's value plus the offset:</p>
<p class="eq">Effective address = base register + offset</p>
<p>The result is called the <strong>effective address</strong>. In a load-store ISA, this is how almost every load and store finds its memory location, and the ALU computes it in the <a href="#/stage-ex">EX stage</a>, for both loads and stores.</p>
<h3 id="sec-summary">In One Paragraph</h3>
<p>An addressing mode is how an instruction specifies where its operand comes from. With an immediate, the value is encoded in the instruction. With register addressing, it comes from the register file. With PC-relative addressing, the instruction encodes an offset that's added to the PC, giving a branch target or a memory address. With base plus offset, a register supplies a base address and the instruction supplies an offset; their sum is the effective address used by loads and stores.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Name the addressing mode and compute the address for each RISC-V instruction:</p><ul><li>(a) <code>lw x5, -12(x8)</code> with x8 = 0x2000</li><li>(b) A <code>beq</code> at address 0x400 with an offset of +0x20, when it's taken</li><li>(c) <code>addi x5, x6, 10</code></li></ul>`,
        a: `<ol type="a"><li>Base + offset: effective address = 0x2000 − 12 = <strong>0x1FF4</strong>; the load reads memory there.</li><li>PC-relative: RISC-V adds the offset to the branch's own address, so the target is 0x400 + 0x20 = <strong>0x420</strong>.</li><li>Immediate (for the constant 10) and register (for x6): no memory address at all.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do RISC ISAs offer only a few addressing modes when CISC ISAs offer many?</p>`,
        a: `<p>Every addressing mode adds work to the address-generation hardware and complicates decode and pipelining. With only immediate, register, PC-relative, and base + offset, a load-store pipeline computes every memory address with a single add in one stage. Compilers can build more complex addressing (such as base + index × scale) from a couple of simple instructions. CISC ISAs like x86 encode those patterns in one instruction, which helps code density, but the hardware has to support them, usually with more complex address-generation units or by splitting instructions into micro-ops.</p>`
      }
    ]
  }
},

{
  id: "isa-x86",
  region: "isa",
  title: "x86-64 Instructions to Know",
  sections: [
    { id: "syntax", label: "Reading the Syntax" },
    { id: "regs", label: "Registers and Operand Sizes" },
    { id: "move", label: "Moving Data" },
    { id: "alu", label: "Arithmetic, Logic, and Flags" },
    { id: "ctrl", label: "Branches, Calls, and Returns" },
    { id: "idioms", label: "Idioms the Core Recognizes" },
    { id: "vector", label: "Vector Instructions" }
  ],
  body: `
<p>A few dozen x86-64 instructions cover nearly everything in compiler output and in the hot loops a profiler points at. This page lists them with the details that matter for reading assembly and for reasoning about how the core runs them. The listings use Intel syntax, like the rest of this site.</p>
<h3 id="sec-syntax">Reading the Syntax</h3>
<ul>
<li><strong>Intel syntax</strong> (Intel's manuals, <code>objdump -M intel</code>, <code>gcc -masm=intel</code>) puts the destination first: <code>add rax, rbx</code> means rax = rax + rbx.</li>
<li><strong>AT&amp;T syntax</strong> (the default for GCC, the GNU assembler, and objdump on Linux) puts the source first, marks registers with %, immediates with $, and puts the operand size in a suffix: <code>add rax, 10</code> is <code>addq $10, %rax</code>.</li>
<li><strong>Memory operands</strong> have the form base + index × scale + displacement, with a scale of 1, 2, 4, or 8 and a signed 32-bit displacement. Intel writes <code>[rbx+rcx*8+16]</code> and AT&amp;T writes <code>16(%rbx,%rcx,8)</code>. RIP-relative operands such as <code>[rip+table]</code> reach globals in position-independent code (see <a href="#/isa-addressing/pc-rel">PC-relative addressing</a>).</li>
<li><strong>Operand size:</strong> when no register fixes it, Intel syntax spells it out: <code>mov DWORD PTR [rdi], 0</code> stores 4 bytes.</li>
<li><strong>One memory operand:</strong> most instructions allow at most one, so copying memory to memory takes a load and a store. String instructions such as <code>rep movsb</code> are the exception.</li>
</ul>
<h3 id="sec-regs">Registers and Operand Sizes</h3>
<div class="tbl"><table>
<tr><th>64-bit</th><th>32-bit</th><th>16-bit</th><th>8-bit</th><th>Role in the System V ABI</th></tr>
<tr><td>rax</td><td>eax</td><td>ax</td><td>al</td><td>Return value</td></tr>
<tr><td>rbx</td><td>ebx</td><td>bx</td><td>bl</td><td>Callee-saved</td></tr>
<tr><td>rcx</td><td>ecx</td><td>cx</td><td>cl</td><td>Argument 4, and the count for variable shifts</td></tr>
<tr><td>rdx</td><td>edx</td><td>dx</td><td>dl</td><td>Argument 3, and the high half for <code>mul</code> and <code>div</code></td></tr>
<tr><td>rsi</td><td>esi</td><td>si</td><td>sil</td><td>Argument 2</td></tr>
<tr><td>rdi</td><td>edi</td><td>di</td><td>dil</td><td>Argument 1</td></tr>
<tr><td>rbp</td><td>ebp</td><td>bp</td><td>bpl</td><td>Frame pointer, or callee-saved</td></tr>
<tr><td>rsp</td><td>esp</td><td>sp</td><td>spl</td><td>Stack pointer</td></tr>
<tr><td>r8, r9</td><td>r8d, r9d</td><td>r8w, r9w</td><td>r8b, r9b</td><td>Arguments 5 and 6</td></tr>
<tr><td>r10, r11</td><td>r10d, r11d</td><td>r10w, r11w</td><td>r10b, r11b</td><td>Caller-saved scratch</td></tr>
<tr><td>r12 to r15</td><td>r12d to r15d</td><td>r12w to r15w</td><td>r12b to r15b</td><td>Callee-saved</td></tr>
</table></div>
<ul>
<li><strong>A 32-bit write zeroes bits 63 to 32.</strong> <code>mov eax, 1</code> sets all of rax. Compilers use the 32-bit form whenever the value fits, because it needs no REX prefix and is a byte shorter.</li>
<li><strong>An 8- or 16-bit write keeps the rest of the register.</strong> The result depends on the register's old value, which is a real input that renaming can't remove. Compilers read bytes and words with <code>movzx</code> or <code>movsx</code> instead.</li>
<li><strong>Other state:</strong> rip (the program counter), rflags (CF carry, ZF zero, SF sign, OF overflow, plus PF and AF), 16 vector registers (32 with AVX-512, plus the mask registers k0 to k7), and the legacy x87 floating-point stack.</li>
</ul>
<h3 id="sec-move">Moving Data</h3>
<div class="tbl"><table>
<tr><th>Instruction</th><th>What it does</th><th>Worth knowing</th></tr>
<tr><td><code>mov dst, src</code></td><td>Copies a register, an immediate, or memory (on one side only)</td><td>Register-to-register moves are often eliminated at rename</td></tr>
<tr><td><code>movzx</code>, <code>movsx</code>, <code>movsxd</code></td><td>Copy a narrower value with zero or sign extension</td><td>The clean way to read bytes and words. <code>movsxd</code> sign-extends 32 bits to 64</td></tr>
<tr><td><code>lea dst, [address]</code></td><td>Computes the address expression and writes it, with no memory access and no flags</td><td>Used as a three-operand add and for multiplies by 3, 5, and 9</td></tr>
<tr><td><code>push src</code>, <code>pop dst</code></td><td>rsp −= 8 then store, or load then rsp += 8</td><td>The front end's stack engine does the rsp updates</td></tr>
<tr><td><code>cmovcc dst, src</code></td><td>Copies if the condition holds</td><td>Replaces a branch with a data dependence on the flags</td></tr>
<tr><td><code>xchg</code></td><td>Swaps two operands</td><td>With a memory operand it is implicitly locked: an atomic swap and a full barrier</td></tr>
</table></div>
<h3 id="sec-alu">Arithmetic, Logic, and Flags</h3>
<p>Most arithmetic is two-operand and destructive: <code>add rax, rbx</code> overwrites rax, so keeping both inputs costs an extra <code>mov</code> or an <code>lea</code>. Intel's APX extension adds three-operand forms. Nearly every arithmetic instruction also writes the flags.</p>
<div class="tbl"><table>
<tr><th>Instruction</th><th>What it does</th><th>Worth knowing</th></tr>
<tr><td><code>add</code>, <code>sub</code></td><td>Add or subtract</td><td>Set all the arithmetic flags</td></tr>
<tr><td><code>inc</code>, <code>dec</code></td><td>Add or subtract 1</td><td>Leave CF unchanged, so a later reader of CF also depends on an older instruction</td></tr>
<tr><td><code>imul dst, src</code>, <code>imul dst, src, imm</code></td><td>Low half of a product</td><td>The common multiply. One-operand <code>mul</code> and <code>imul</code> give the full 128-bit product in rdx:rax</td></tr>
<tr><td><code>div</code>, <code>idiv</code></td><td>Divide rdx:rax by the operand: quotient in rax, remainder in rdx</td><td>The slowest common integer instruction, so compilers turn division by a constant into a multiply and a shift</td></tr>
<tr><td><code>and</code>, <code>or</code>, <code>xor</code>, <code>not</code>, <code>neg</code></td><td>Bitwise operations, and two's-complement negation</td><td>The bitwise three clear CF and OF</td></tr>
<tr><td><code>shl</code>, <code>shr</code>, <code>sar</code></td><td>Shift left, logical right, arithmetic right</td><td>A variable shift count must be in cl</td></tr>
<tr><td><code>cmp a, b</code></td><td>Computes a − b, sets the flags, discards the result</td><td>Usually fused with the following branch</td></tr>
<tr><td><code>test a, b</code></td><td>Computes a AND b, sets the flags, discards the result</td><td><code>test eax, eax</code> checks for zero or negative in 2 bytes</td></tr>
<tr><td><code>lock add</code>, <code>lock xadd</code>, <code>lock cmpxchg</code></td><td>Atomic read-modify-write on memory</td><td>Also a full memory barrier on x86, so far slower than the plain instruction</td></tr>
</table></div>
<h3 id="sec-ctrl">Branches, Calls, and Returns</h3>
<p>A conditional jump tests the flags left by the last instruction that wrote them. Signed and unsigned comparisons use different conditions:</p>
<div class="tbl"><table>
<tr><th>After <code>cmp a, b</code></th><th>Signed</th><th>Unsigned</th></tr>
<tr><td>a = b</td><td><code>je</code> (also <code>jz</code>)</td><td><code>je</code></td></tr>
<tr><td>a ≠ b</td><td><code>jne</code></td><td><code>jne</code></td></tr>
<tr><td>a &lt; b</td><td><code>jl</code></td><td><code>jb</code></td></tr>
<tr><td>a ≤ b</td><td><code>jle</code></td><td><code>jbe</code></td></tr>
<tr><td>a &gt; b</td><td><code>jg</code></td><td><code>ja</code></td></tr>
<tr><td>a ≥ b</td><td><code>jge</code></td><td><code>jae</code></td></tr>
</table></div>
<p>The signed conditions read SF and OF, and the unsigned ones read CF. The same condition codes name <code>setcc</code> (write 0 or 1 to a byte register) and <code>cmovcc</code>.</p>
<ul>
<li><strong><code>jmp label</code></strong> is a direct, PC-relative jump. <code>jmp rax</code> and <code>jmp [table+rax*8]</code> are indirect, as in switch jump tables.</li>
<li><strong><code>call target</code></strong> pushes the address of the next instruction and jumps. <strong><code>ret</code></strong> pops that address and jumps to it, and the return address stack predicts where it goes.</li>
<li><strong><code>call rax</code></strong> and <strong><code>call [rax+16]</code></strong> are indirect calls, as for C++ virtual functions and calls through the <a href="#/comp-plt">PLT</a>.</li>
<li><strong>Branch or <code>cmov</code>:</strong> a <code>cmov</code> always waits for both inputs and the flags, while a predicted branch lets the core run ahead. <code>cmov</code> wins when the branch is hard to predict, and the branch wins when it's predictable and one input is slow, such as a cache miss.</li>
</ul>
<h3 id="sec-idioms">Idioms the Core Recognizes</h3>
<div class="tbl"><table>
<tr><th>Idiom</th><th>What the core does with it</th></tr>
<tr><td><code>xor eax, eax</code> (also <code>sub eax, eax</code>, <code>pxor xmm0, xmm0</code>)</td><td>A zeroing idiom: recognized at rename as independent of the old value, so it needs no execution unit, and it takes 2 bytes against 5 for <code>mov eax, 0</code>. It writes the flags, so compilers use <code>mov</code> when the flags must survive.</td></tr>
<tr><td><code>mov rax, rbx</code></td><td>Move elimination: rename points rax at rbx's physical register, with zero latency. Most cores do this often but not every time.</td></tr>
<tr><td><code>cmp</code> or <code>test</code> followed by <code>jcc</code></td><td>Macro-fusion: the pair decodes into one micro-op. Intel cores also fuse <code>add</code>, <code>sub</code>, <code>and</code>, <code>inc</code>, and <code>dec</code> with some conditions.</td></tr>
<tr><td><code>add eax, [rdi]</code></td><td>Micro-fusion: the load and the add stay one micro-op through rename and split only for execution.</td></tr>
<tr><td><code>lea eax, [rdi+rdi*2]</code>, <code>lea eax, [rdi+rsi]</code></td><td>Arithmetic on the address unit: 3 × rdi, or a three-operand add that leaves the flags alone. On older Intel cores (Sandy Bridge to Skylake), an <code>lea</code> with three components took 3 cycles instead of 1.</td></tr>
<tr><td><code>nop DWORD PTR [rax+rax*1+0x0]</code></td><td>A multi-byte no-op, used to align loop heads in a single instruction.</td></tr>
<tr><td><code>pause</code></td><td>A spin-wait hint: it slows the spin loop and avoids a pipeline flush when the lock is finally released.</td></tr>
</table></div>
<h3 id="sec-vector">Vector Instructions</h3>
<ul>
<li><strong>SSE:</strong> 16 xmm registers of 128 bits. Scalar floating point uses them too: <code>addsd</code> adds one double and <code>addss</code> one float. x87 survives mostly for <code>long double</code>.</li>
<li><strong>AVX and AVX2:</strong> 256-bit ymm registers and the VEX encoding, which has non-destructive three-operand forms: <code>vaddps ymm0, ymm1, ymm2</code>.</li>
<li><strong>AVX-512:</strong> 32 zmm registers of 512 bits, plus mask registers that turn individual lanes on or off.</li>
<li><strong>Suffixes:</strong> <code>ps</code> is packed single, <code>pd</code> packed double, <code>ss</code> and <code>sd</code> scalar. Integer vector instructions start with p, as in <code>vpaddd</code>.</li>
<li><strong>Loads and stores:</strong> <code>vmovups</code> takes any alignment, <code>vmovaps</code> faults on a misaligned address, and <code>vbroadcastss</code> copies one float into every lane.</li>
<li><strong>FMA:</strong> <code>vfmadd231ps ymm0, ymm1, ymm2</code> computes ymm0 = ymm1 × ymm2 + ymm0. The digits give the order: operands 2 and 3 are multiplied, and operand 1 is added.</li>
<li><strong><code>vzeroupper</code></strong> at the end of AVX code clears the upper halves of the vector registers, which avoids a transition penalty when legacy SSE code runs next. Compilers insert it.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A compiler turns <code>x * 45</code> into:</p><pre><code>lea  rax, [rdi+rdi*8]
lea  rax, [rax+rax*4]</code></pre><p>(a) What is in rax when rdi = 7? (b) On a core where a two-component <code>lea</code> has 1-cycle latency and <code>imul</code> has 3-cycle latency, how much latency does this save over <code>imul rax, rdi, 45</code>?</p>`,
        a: `<ol type="a"><li>The first <code>lea</code> computes rdi + 8 × rdi = 9 × 7 = 63. The second computes rax + 4 × rax = 5 × 63 = <strong>315</strong>, which is 45 × 7.</li><li>The two <code>lea</code>s are dependent, so the result is ready after 1 + 1 = 2 cycles, against 3 for <code>imul</code>: <strong>1 cycle saved</strong>. The cost is one more instruction, and a compiler only does this when the constant factors into 3, 5, or 9 in a step or two.</li></ol>`
      },
      {
        q: `<p>rax holds 0xFFFF_FFFF_FFFF_FFFF before each of these instructions, and the byte at [rdi] is 0x80. Give rax after each one:</p><ul><li>(a) <code>mov eax, 1</code></li><li>(b) <code>mov ax, 1</code></li><li>(c) <code>mov al, 1</code></li><li>(d) <code>movsx eax, BYTE PTR [rdi]</code></li></ul><p>(e) With ecx = 0xFFFF_FFFF and edx = 2, the code runs <code>cmp ecx, edx</code>. Is <code>jl</code> taken? Is <code>jb</code> taken?</p>`,
        a: `<ol type="a"><li>A 32-bit write zeroes the upper half: <strong>0x0000_0000_0000_0001</strong>.</li><li>A 16-bit write keeps bits 63 to 16: <strong>0xFFFF_FFFF_FFFF_0001</strong>.</li><li>An 8-bit write keeps bits 63 to 8: <strong>0xFFFF_FFFF_FFFF_FF01</strong>.</li><li>0x80 sign-extends to eax = 0xFFFF_FF80, and the 32-bit write zeroes the upper half: <strong>0x0000_0000_FFFF_FF80</strong>.</li><li>Signed, ecx is −1 and −1 &lt; 2, so <strong><code>jl</code> is taken</strong>. Unsigned, ecx is 4,294,967,295, which is greater than 2, so <strong><code>jb</code> is not taken</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>For <code>int lt(int a, int b) { return a &lt; b; }</code>, GCC emits:</p><pre><code>xor   eax, eax
cmp   edi, esi
setl  al
ret</code></pre><p>Why does it zero eax at all, why with <code>xor</code>, and why must the <code>xor</code> come before the <code>cmp</code> rather than after it?</p>`,
        a: `<ul><li><strong>Why zero eax:</strong> <code>setl</code> writes only al. The function returns all 32 bits of eax, so bits 31 to 8 must be 0. Writing al alone would also merge with rax's old value, a dependence on whatever last wrote rax.</li><li><strong>Why <code>xor</code>:</strong> it is 2 bytes, and it is a zeroing idiom. Rename sees that the result doesn't depend on eax's old value, so it breaks the dependence and needs no execution unit. Intel cores also record that the upper bits are known zero, so the later write to al needs no merge micro-op.</li><li><strong>Why before the <code>cmp</code>:</strong> <code>xor</code> writes the flags. Placed between <code>cmp</code> and <code>setl</code>, it would overwrite the comparison result, and <code>setl</code> would read the flags of the <code>xor</code>. The alternative, <code>setl al</code> then <code>movzx eax, al</code>, adds a micro-op after the comparison, on the path to the return value.</li></ul>`
      },
      {
        q: `<p>This loop computes a single-precision dot product:</p><pre><code>.L3: vmovups      ymm0, YMMWORD PTR [rdi+rax]
     vfmadd231ps  ymm1, ymm0, YMMWORD PTR [rsi+rax]
     add          rax, 32
     cmp          rax, rdx
     jne          .L3</code></pre><p>The core:</p><ul><li>Renames 6 micro-ops per cycle.</li><li>Fuses <code>cmp</code> with <code>jne</code>, and keeps a load folded into an FMA as one micro-op through rename.</li><li>Does 3 loads per cycle.</li><li>Has 2 fully pipelined FMA units with 4-cycle latency.</li></ul><p>(a) How many micro-ops does rename see per iteration? (b) How many cycles does an iteration take, and what limits it? (c) If the loop is unrolled with several independent accumulators, what is the best throughput in FMAs per cycle, and how many accumulators does it take to reach it?</p>`,
        a: `<ol type="a"><li><code>vmovups</code> is 1, the FMA with its folded load is 1, <code>add</code> is 1, and the fused <code>cmp</code>/<code>jne</code> is 1: <strong>4 micro-ops</strong>.</li><li>Each iteration's FMA needs the previous one's ymm1, so the loop-carried chain is <strong>4 cycles per iteration</strong>. The other limits are far lower:<ul><li>Rename: 4 / 6 ≈ 0.67 cycles.</li><li>Loads: 2 / 3 ≈ 0.67 cycles.</li><li>FMA units: 1 / 2 = 0.5 cycles.</li></ul>The loop is <strong>latency-bound</strong> at 0.25 FMAs per cycle, which is 8 lanes × 2 FLOPs × 0.25 = 4 FLOPs per cycle.</li><li>Each FMA still needs 2 loads (one from each array), and the core does 3 loads per cycle, so loads cap it at <strong>1.5 FMAs per cycle</strong>, below the 2 the FMA units could take. Rename doesn't bind: unrolled 6 times, an iteration is 6 <code>vmovups</code> + 6 FMAs with folded loads + <code>add</code> + fused <code>cmp</code>/<code>jne</code> = 14 micro-ops, 14 / 6 ≈ 2.3 cycles, against 12 / 3 = 4 cycles of loads. Each accumulator can start one FMA every 4 cycles, so reaching 1.5 per cycle takes 1.5 × 4 = <strong>6 accumulators</strong>, a 6× speedup (24 FLOPs per cycle). Adding more doesn't help, because loads become the limit.</li></ol>`
      }
    ]
  }
}
]);
