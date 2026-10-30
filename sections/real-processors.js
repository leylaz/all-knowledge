/* Section: Real processors
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "proc"). */

/* Block-diagram helpers for this section. Boxes take a title and an optional
   sub-label (a string, or an array for two lines); tone picks the fill. */
function procSvg(w, h, minw, label, inner) {
  return `<div class="tbl"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" style="width:100%;min-width:${minw}px;max-width:${w}px;display:block;font-family:var(--sans)">
<defs><marker id="procArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
${inner}</svg></div>`;
}
function procBox(x, y, w, h, title, sub, tone) {
  const fill = { fe: "var(--trace-soft)", ex: "var(--pad-soft)", mem: "var(--surface)" }[tone || "mem"];
  const subs = sub ? [].concat(sub) : [];
  const cx = x + w / 2;
  const top = y + h / 2 - (subs.length * 13) / 2 + 4;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" style="fill:${fill};stroke:var(--trace);stroke-width:1.2"/>`;
  s += `<text x="${cx}" y="${top}" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">${title}</text>`;
  subs.forEach((t, i) => { s += `<text x="${cx}" y="${top + 14 + i * 13}" text-anchor="middle" style="fill:var(--muted);font-size:10.5px">${t}</text>`; });
  return s;
}
function procFrame(x, y, w, h, label) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:none;stroke:var(--pad);stroke-width:1.5;stroke-dasharray:6 4"/>` +
    `<text x="${x + 10}" y="${y + 16}" style="fill:var(--pad);font-size:11.5px;font-weight:600">${label}</text>`;
}
function procArrow(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#procArr)"/>`;
}
function procLine(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--muted);stroke-width:1.5"/>`;
}
function procText(x, y, t, anchor) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor || "middle"}" style="fill:var(--muted);font-size:10.5px">${t}</text>`;
}

section({
  id: "proc",
  name: "Real Processors",
  cap: "Zen 5, Neoverse V2 and Grace, Hopper, Blackwell, and GPU kernels: how shipping chips are organized",
  body: `
<p>The rest of the site covers mechanisms one at a time. This section reads four shipping designs as case studies: how each organizes its front end, execution engine, caches, memory hierarchy, and multi-die package, and what that means for performance.</p>
<ul>
<li><strong>AMD Zen 5:</strong> a very wide x86 out-of-order core, assembled into products from 8-core chiplets around an I/O die.</li>
<li><strong>Arm Neoverse V2 in NVIDIA Grace:</strong> a wide Arm core with a short pipeline, placed 72 at a time on one monolithic die joined by a mesh, with LPDDR5X on the package.</li>
<li><strong>NVIDIA Hopper and Blackwell:</strong> throughput machines that hide latency with thousands of resident threads instead of a reorder buffer, fed by HBM and matrix engines.</li>
</ul>
<div class="tbl"><table>
<tr><th></th><th>Zen 5</th><th>Neoverse V2 (Grace)</th><th>Hopper (H100 SXM)</th><th>Blackwell (B200)</th></tr>
<tr><td>Unit of parallelism</td><td>Core, 2 SMT threads</td><td>Core, 1 thread</td><td>SM, up to 64 warps</td><td>SM, up to 64 warps</td></tr>
<tr><td>How latency is hidden</td><td>448-entry window, prefetch</td><td>320+ window, prefetch</td><td>Warp switching, async copies</td><td>Warp switching, async copies and MMA</td></tr>
<tr><td>Vector / matrix</td><td>4 × 512-bit pipes</td><td>4 × 128-bit SVE2 pipes</td><td>4 tensor cores per SM</td><td>4 tensor cores per SM + TMEM</td></tr>
<tr><td>Last-level cache</td><td>32 MB L3 per 8-core CCX</td><td>114 MB L3 on a mesh</td><td>50 MB L2, two partitions</td><td>126 MB L2, split across two dies</td></tr>
<tr><td>Memory</td><td>DDR5 via the I/O die</td><td>LPDDR5X on package</td><td>HBM3, 3.35 TB/s</td><td>HBM3E, 8 TB/s</td></tr>
<tr><td>Package</td><td>Chiplets (CCDs + IOD)</td><td>Monolithic, two per Superchip</td><td>Monolithic GPU + HBM</td><td>Two dies + HBM, one device</td></tr>
</table></div>
<p>Start with <a href="#/zen5-core">AMD Zen 5 Core</a>, or jump to <a href="#/proc-compare">Comparing the Four Designs</a> for the side-by-side numbers.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An AMD EPYC 9654 (Zen 4, "Genoa") has 96 cores at a 2.4 GHz base clock. Zen 4 has two 256-bit FMA pipes and executes 512-bit operations as two halves. Compute the chip's peak FP64 rate at base clock.</p>`,
        a: `<ol><li>FP64 lanes per 256-bit pipe: 256 / 64 = 4.</li><li>FLOPs per cycle per core: 2 pipes × 4 lanes × 2 (an FMA is a multiply and an add) = 16.</li><li>Chip: 96 cores × 16 × 2.4 × 10<sup>9</sup> ≈ <strong>3.69 TFLOPS</strong> FP64.</li></ol><p>Using 512-bit instructions doesn't change this on Zen 4: each one takes both halves of the datapath.</p>`
      }
    ],
    interview: [
      {
        q: `<p>An H200 GPU reaches 4.8 TB/s of HBM bandwidth with about 300 ns of loaded latency. One CPU core draws about 30 GB/s from DRAM with about 100 ns of latency. Why does the GPU need tens of thousands of threads resident to reach its bandwidth while a CPU core needs only one or two?</p>`,
        a: `<p>Little's law: bytes in flight = bandwidth × latency. The H200 needs 4.8 × 10<sup>12</sup> × 300 × 10<sup>−9</sup> ≈ 1.4 MB in flight. The CPU core needs 30 × 10<sup>9</sup> × 100 × 10<sup>−9</sup> = 3 KB, about 47 lines of 64 bytes, and its out-of-order window plus prefetchers keep that many misses outstanding from a single thread. A GPU SM has no out-of-order window: each warp issues its loads and then waits, so the only way to keep megabytes in flight is to have many warps each with a few loads outstanding (or to use bulk asynchronous copies like TMA, which put many bytes in flight per instruction).</p>`
      }
    ]
  }
}, [
{
  id: "zen5-core",
  region: "proc",
  title: "AMD Zen 5 Core",
  sections: [
    { id: "overview", label: "Overview and Block Diagram" },
    { id: "bp", label: "Branch Prediction" },
    { id: "decode", label: "Fetch, Decode, and the Op Cache" },
    { id: "int", label: "Integer Engine and Retire" },
    { id: "fp", label: "FP and AVX-512 Engine" },
    { id: "ls", label: "Load/Store Unit and L1D" },
    { id: "tlb", label: "TLBs and Page Walks" },
    { id: "l2", label: "Private L2" }, { id: "smt", label: "Two Threads with SMT" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<h3 id="sec-overview">Overview and Block Diagram</h3>
<p>Zen 5 (AMD Family 1Ah, 2024) is the core in Ryzen 9000 ("Granite Ridge") desktops, Ryzen AI 300 ("Strix Point") laptops, and 5th-generation EPYC ("Turin") servers. AMD reports a 16% geomean IPC gain over Zen 4 at fixed frequency. The changes are mostly about width: two fetch/decode pipes and a branch predictor that handles two taken branches per cycle, 8-wide dispatch and retire, six ALUs, four AGUs, full 512-bit floating-point datapaths, and a larger L1 data cache with twice the L1–L2 bandwidth.</p>
${procSvg(760, 650, 620, "Zen 5 core block diagram: branch predictor feeds the L1 instruction cache, ITLB and op cache; two decode pipes and the op cache feed an 8-wide dispatch; integer and floating-point sides each have rename, schedulers and pipes; a 4-pipe load/store unit accesses the 48 KB L1 data cache, backed by a 1 MB L2.",
  procBox(20, 10, 720, 46, "Branch predictor (runs ahead of fetch)", "2 taken branches/cycle · L1 BTB 16K · L2 BTB 8K · TAGE-style direction · 52-entry RAS per thread · 3,072-entry indirect", "fe") +
  procArrow(135, 56, 135, 80) + procArrow(610, 56, 610, 80) +
  procBox(20, 80, 230, 46, "L1I 32 KB, 8-way", "2 × 32 B fetch/cycle", "fe") +
  procBox(265, 80, 200, 46, "ITLB", "L1 64 · L2 2,048 entries", "fe") +
  procBox(480, 80, 260, 46, "Op cache: 6K instructions", "64 sets × 16 ways · 2 × 6/cycle", "fe") +
  procArrow(110, 126, 110, 150) + procArrow(230, 126, 340, 150) +
  procBox(20, 150, 215, 46, "Decode pipe 0", "4 instructions/cycle, 20-entry IBQ", "fe") +
  procBox(250, 150, 215, 46, "Decode pipe 1", "4/cycle · owned by thread 1 in SMT", "fe") +
  procArrow(127, 196, 127, 220) + procArrow(357, 196, 357, 220) + procArrow(610, 126, 610, 220) +
  procBox(20, 220, 720, 46, "Op queue → dispatch: 8 macro-ops/cycle", "retire queue 448 entries (224 per thread in SMT) · 8 retired/cycle", "ex") +
  procArrow(200, 266, 200, 290) + procArrow(565, 266, 565, 290) +
  procBox(20, 290, 360, 46, "Integer rename, 8-wide · 240-entry PRF", "192 flag registers · zero-latency MOV · stack engine", "ex") +
  procBox(390, 290, 350, 46, "FP/vector rename, 6-wide · 384 × 512 b PRF", "96-entry non-scheduling queue (NSQ)", "ex") +
  procArrow(200, 336, 200, 360) + procArrow(565, 336, 565, 360) +
  procBox(20, 360, 360, 40, "ALU scheduler (age matrix) + AGU scheduler", "", "ex") +
  procBox(390, 360, 350, 40, "3 FP schedulers × 38 entries", "", "ex") +
  procArrow(200, 400, 200, 420) + procArrow(565, 400, 565, 420) +
  ["ALU0", "ALU1", "ALU2", "ALU3", "ALU4", "ALU5", "AGU0", "AGU1", "AGU2", "AGU3"].map((t, i) => procBox(20 + i * 36, 420, 32, 40, `<tspan style="font-size:9.5px">${t}</tspan>`, "", "ex")).join("") +
  [["P0", "FMA"], ["P1", "FMA"], ["P2", "FADD"], ["P3", "FADD"], ["ST0", "store"], ["ST1", "store"]].map((p, i) => procBox(390 + i * 58, 420, 52, 40, p[0], p[1], "ex")).join("") +
  procText(20, 478, "ALU0–2: multiply, CRC · ALU3–5: branch, shift, PDEP/PEXT", "start") +
  procText(20, 492, "ALU3: divide · AGU0–3: any load or store address", "start") +
  procText(390, 478, "512-bit datapaths · FADD 2 cycles, FMA 4 cycles", "start") +
  procText(390, 492, "ST0–ST1: store data and FP→integer moves", "start") +
  procBox(20, 520, 450, 46, "Load/store unit: 4 pipes", "≤4 loads (≤2 vector) and ≤2 stores/cycle · STQ 104 · 124 misses", "mem") +
  procBox(480, 520, 260, 46, "L1D 48 KB, 12-way", "4-cycle integer / 7-cycle FP load-to-use", "mem") +
  procArrow(470, 543, 480, 543) + procArrow(610, 566, 610, 590) + procArrow(245, 566, 245, 590) +
  procBox(20, 590, 720, 50, "L2: 1 MB, 16-way, private, inclusive of L1", "≥14-cycle load-to-use · 64 B/cycle to L1I and to L1D, 64 B/cycle of victims back · misses go to the CCX's shared L3", "mem")
)}
<p>Structure sizes below come from AMD's <em>Software Optimization Guide for the AMD Zen5 Microarchitecture</em> (publication 58455) and AMD's Hot Chips 2024 talk; measured latencies are from Agner Fog's manuals.</p>

<h3 id="sec-bp">Branch Prediction</h3>
<p>Prediction is decoupled from fetch (see <a href="#/fe-decoupled">Decoupled Fetch and the Fetch Target Queue</a>): the predictor runs ahead, generating fetch addresses that also act as an instruction prefetcher. Its new headline ability is predicting <strong>two taken branches per cycle</strong>. A BTB entry can hold two branches (a conditional followed by another branch in the same 64-byte line, or a direct jump followed by a branch in the target's line), so one lookup yields two fetch blocks. Agner Fog measures 2 taken or 3 not-taken branches per cycle, including fused compare-and-branch.</p>
<ul>
<li><strong>BTBs:</strong> a 16K-entry L1 BTB predicts direct branches, conditionals, and single-target indirects with zero bubbles; returns and multi-target indirects cost 2 bubbles. An 8K-entry L2 BTB costs 8 bubbles on an L1 BTB miss.</li>
<li><strong>Direction:</strong> a global-history predictor AMD describes as TAGE-based (see <a href="#/fe-direction/tage">TAGE</a>). Branches never seen taken aren't stored in the BTB and are implicitly predicted not taken; always-taken branches are handled by the BTB until they first fall through. Never-taken branches don't update global history, which is why AMD recommends making biased branches fall through.</li>
<li><strong>Returns and indirects:</strong> a 52-entry return address stack per thread and a 3,072-entry indirect target array indexed with global history.</li>
<li><strong>Tracking:</strong> each fetch window (up to one 64-byte line) is tracked in a 128-entry FIFO (64 per thread in SMT) until retirement; when it fills, fetch stalls.</li>
<li><strong>Penalty:</strong> AMD gives 12–18 cycles (15 typical), lower when the correct path is in the op cache; Agner measures 15–25.</li>
</ul>

<h3 id="sec-decode">Fetch, Decode, and the Op Cache</h3>
<p>The 32 KB, 8-way L1I delivers two 32-byte blocks per cycle, which may come from different basic blocks. Each feeds one of two <strong>decode pipes</strong>, each with a 20-entry instruction byte queue, each decoding up to <strong>4 instructions per cycle</strong>. AMD's guide is explicit about the split: with one thread, decode peaks at 4 instructions per cycle; in SMT mode each thread owns a pipe, so the core decodes 8. Only the first of the four slots can decode an instruction longer than 10 bytes, which matters for EVEX-encoded AVX-512 code. (Agner Fog's tests suggest a single thread can use both pipes on the two sides of a branch; the behavior is not fully documented.)</p>
<p>The <strong>op cache</strong> is the path to full width for one thread (see <a href="#/fe-decode/uop-cache">the op cache</a>). It is 64 sets × 16 ways; each entry holds up to 6 instructions or fused pairs from at most two adjacent 64-byte lines, for about <strong>6K instructions</strong>. Unlike Zen 3 and Zen 4, entries store instructions rather than macro-ops, which packs code more densely. Two op cache pipes deliver up to 6 each, 12 per cycle. Entry limits: six 32-bit immediate/displacement slots (64-bit values use two), and a cap of 4 when microcoded instructions are present. The cache is physically tagged, so two threads running the same code share entries. It is <em>modal</em>: the core switches from decoder to op cache only at a taken branch and stays until an op cache miss, so code that bounces between the two pays repeatedly.</p>
<p>Along the way the front end removes work: compare/test + branch fusion, MOV + ALU fusion, zero-cycle register moves, stack-pointer tracking (PUSH/POP don't wait on RSP), and zeroing idioms such as <code>xor eax,eax</code>. Dispatch then sends up to <strong>8 macro-ops per cycle</strong>, with group rules: at most 2 taken branches and 8 immediates, and the eighth op can't be a load or store.</p>

<h3 id="sec-int">Integer Engine and Retire</h3>
<ul>
<li><strong>Rename:</strong> 8 wide into a 240-entry integer physical register file (up to 40 per thread hold architectural and temporary state) plus a separate flags register file with 192 free entries, so flag-writing instructions don't consume integer registers. See <a href="#/prf-sizing">Sizing the Physical Register File</a>.</li>
<li><strong>Schedulers:</strong> a unified ALU scheduler that uses an age matrix to pick oldest-ready first, issuing 6 per cycle, plus an AGU scheduler issuing 4. Making the ALUs more symmetric simplified the picker.</li>
<li><strong>Pipes:</strong> six ALUs. ALU0–2 add 3-cycle, fully pipelined 64 × 64 multipliers and CRC; ALU3–5 handle branches, shifts, and PDEP/PEXT (3 cycles, 3 per cycle); ALU3 holds the divider (about 8 cycles + 1 per 9 quotient bits). Four AGUs generate any load or store address; all six ALUs can send store data, two integer stores per cycle.</li>
<li><strong>Retire:</strong> a 448-entry retire queue (224 per thread in SMT), retiring 8 entries per cycle. One entry can track two adjacent macro-ops, so the effective window can exceed 448. See <a href="#/rob-sizing">Sizing the Reorder Buffer</a>.</li>
</ul>
<p>Agner Fog notes that despite 8-wide dispatch, his tests rarely exceeded about 6 instructions per cycle on one thread: dependencies, port mixes, and the front end usually bind first.</p>

<h3 id="sec-fp">FP and AVX-512 Engine</h3>
<p>The FPU is a coprocessor with its own rename (6 per cycle), a 384-entry × 512-bit register file, and three 38-entry schedulers, each feeding a pair of pipes. When FP dispatch exceeds 6 per cycle or the schedulers are full, ops wait in a 96-entry <strong>non-scheduling queue</strong>; this lets the integer side keep dispatching (and computing load/store addresses for FP ops) at 8 per cycle.</p>
<ul>
<li><strong>Pipes:</strong> four 512-bit execution pipes: P0 and P1 do FMUL/FMA, P2 and P3 do FADD; most vector integer and logical ops run on all four. Two more pipes carry store data and FP→integer moves; FP stores are limited to one per cycle.</li>
<li><strong>Latencies (Agner Fog):</strong> FADD 2 cycles (down from 3), FMUL 3, FMA 4. Simple vector integer ops are 1 cycle on paper, but Agner measures an effective 2 when the scheduler is full, so he lists 2. A result crossing between the integer-vector and FP domains can cost one more cycle.</li>
<li><strong>Peak:</strong> 2 FMA pipes × 8 FP64 lanes × 2 = <strong>32 FP64 FLOPs per cycle per core</strong> (64 FP32). Keeping both FMA pipes busy with a 4-cycle latency needs at least 4 × 2 = 8 independent accumulator chains.</li>
<li><strong>Data paths:</strong> two 512-bit loads and one 512-bit store per cycle. A 512-bit store is a "fastpath double" that uses two dispatch slots and two store queue entries.</li>
<li><strong>Operand-bus contention:</strong> a three-source op (FMA) on P0 or P2 borrows P4's source bus, and on P1 or P3 borrows P5's; the loser stalls. AVX-512 merge masking needs an extra source and can hit this.</li>
<li><strong>Configurable width:</strong> desktop and server Zen 5 have full 512-bit datapaths; the mobile Strix Point cores use 256-bit datapaths, so 512-bit instructions run at half rate there.</li>
</ul>
<p>Compare <a href="#/simd">SIMD and Vector Execution</a> and <a href="#/fp-units">Floating-Point Units and the FMA Pipeline</a> for the general trade-offs.</p>

<h3 id="sec-ls">Load/Store Unit and L1D</h3>
<p>Four load/store pipes allow up to 4 memory ops per cycle: up to 4 loads (at most 2 of them 128-bit or wider) and up to 2 stores (at most one 512-bit). A 512-bit load pairs two pipes for one cycle.</p>
<ul>
<li><strong>Queues:</strong><ul><li>The load queue tracks 64 uncompleted loads (completed loads don't count against a fixed limit)</li><li>The store queue has 104 entries</li><li>The unit tracks <strong>124 outstanding misses</strong>, its memory-level parallelism budget (see <a href="#/latency-tolerance/mlp">MLP</a>)</li></ul></li>
<li><strong>L1D:</strong> 48 KB, 12-way, 64-byte lines, write-back, ECC. Note the geometry: 48 KB / 12 ways = 4 KB per way, so the set index (bits 11:6) lies inside the 4 KB page offset and the cache can be virtually indexed and physically tagged without aliases. AMD grew capacity by adding ways, not sets, for that reason.</li>
<li><strong>Latency:</strong> 4 cycles integer and 7 cycles FP load-to-use for simple addressing; one more for base + index + displacement or a scaled index. A 64-byte line crossing costs at least a cycle and halves throughput.</li>
<li><strong>Way prediction:</strong> a linear-address microtag (utag) picks the way before translation finishes, so a load reads one way instead of twelve. Two virtual aliases of one physical line evict each other's utag and look like L1 misses.</li>
<li><strong>Banks:</strong> address bits 5:3 and the access size select banks; conflicting loads replay. AMD suggests grouping up to 4 loads (2 vector) from each stream when unrolling.</li>
<li><strong>Store-to-load forwarding:</strong> works when one older store contains all the load's bytes. Eligibility uses address bits 11:0, so stores 4 KB apart can falsely block forwarding. Agner measures 2 cycles store→load for integer registers, 9 for vectors up to 256 bits, 11 for 512-bit, and about 12 cycles of penalty for a partial overlap. Zen 5 also "mirrors" memory operands: a load from the same address as a recent store can get its data with no latency at all.</li>
<li><strong>Prefetchers:</strong> into L1: stream, stride (which now also learns a regular "jump" in the stride, the pattern of walking a 2D array), and region; into L2: stream and up/down. Server parts can turn each off through an MSR. See <a href="#/prefetch">Prefetching</a>.</li>
</ul>

<h3 id="sec-tlb">TLBs and Page Walks</h3>
<div class="tbl"><table>
<tr><th>Structure</th><th>Entries</th><th>Organization</th><th>Page sizes</th></tr>
<tr><td>L1 ITLB</td><td>64</td><td>Fully associative</td><td>4 KB, 2 MB, 1 GB</td></tr>
<tr><td>L1 DTLB</td><td>96</td><td>Fully associative</td><td>4 KB, 16 KB (coalesced), 2 MB, 1 GB</td></tr>
<tr><td>L2 ITLB</td><td>2,048</td><td>8-way</td><td>4 KB, 2 MB</td></tr>
<tr><td>L2 DTLB</td><td>4,096 + 1,024</td><td>16-way + 4-way for 1 GB</td><td>4 KB, 16 KB, 2 MB; 1 GB in the side array</td></tr>
</table></div>
<p>With 4 KB pages the L2 DTLB reaches 4,096 × 4 KB = 16 MB, half of one CCX's L3; with 2 MB pages it reaches 8 GB. Four contiguous, aligned 4 KB pages with identical attributes can share one entry (16 KB coalescing). Six hardware page walkers handle misses, backed by a page-walk cache for PDPEs and PDEs and a 64-entry cache for PML4/PML5 entries. See <a href="#/tlb">TLBs and Page Walks</a>.</p>

<h3 id="sec-l2">Private L2</h3>
<p>Each core's L2 is 1 MB, 16-way (associativity doubled from Zen 4), inclusive of its L1s, at no less than 14 cycles. The L1–L2 interface doubled to 64 bytes per cycle each way. L2 victims fill the CCX's shared L3, covered in <a href="#/zen5-soc">AMD Zen 5 Chiplets and SoCs</a>.</p>
<h3 id="sec-smt">Two Threads with SMT</h3>
<p>With two threads (see <a href="#/smt">Simultaneous Multithreading</a>), AMD's guide classifies each structure as competitively shared, watermarked, or statically partitioned. The retire queue and fetch-window tracker split in half, and each thread gets its own decode pipe; caches, branch predictors, and execution units are shared on demand. Two threads running the same code should run at the same linear and physical addresses so they share BTB and op cache entries.</p>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>Stay in the op cache.</strong> One thread decodes 4 instructions per cycle from the L1I but gets up to 8 dispatched from the op cache. Hot code larger than about 6K instructions (about 3K per thread with SMT) is front-end bound. Don't unroll loops past what the op cache holds.</li>
<li><strong>Taken branches are cheaper.</strong> With two taken predictions per cycle, short basic blocks no longer cap fetch at one block per cycle; loop and call-heavy integer code benefits most.</li>
<li><strong>Latency, not throughput, usually binds.</strong> Six ALUs, four AGUs, and four 512-bit pipes mean long dependency chains are the common limit. Break reductions into several accumulators.</li>
<li><strong>Use AVX-512 on desktop and server parts.</strong> Full-width datapaths make 512-bit code twice as productive per instruction as 256-bit, except for stores, which stay at 64 bytes per cycle.</li>
<li><strong>Memory parallelism is large but finite.</strong> 124 outstanding misses × 64 B ≈ 7.9 KB in flight per core: enough for a single core to draw tens of GB/s from DRAM, but streaming code still needs prefetch-friendly patterns.</li>
<li><strong>SMT halves the front end per thread.</strong> Turn it off for op-cache-resident, port-saturating kernels; keep it on for stall-heavy server code.</li>
</ul>
<p class="refs">References: AMD, <a href="https://www.amd.com/en/search/documentation/hub.html"><em>Software Optimization Guide for the AMD Zen5 Microarchitecture</em></a>, publication 58455, rev. 1.00 (2024), Chapter 2 · Cohen and Subramony, <a href="https://hc2024.hotchips.org/assets/program/conference/day2/24_HC2024.AMD.Cohen.Subramony.final.pdf">"Next Generation Zen 5 Core,"</a> Hot Chips 2024 · Agner Fog, <a href="https://www.agner.org/optimize/microarchitecture.pdf"><em>The Microarchitecture of Intel, AMD, and VIA CPUs</em></a>, §3.13 and Chapter 25 · Agner Fog, <a href="https://www.agner.org/optimize/instruction_tables.pdf"><em>Instruction Tables</em></a>, AMD Zen 5 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3 and Appendix B</p>`,
  practice: {
    guided: [
      {
        q: `<p>Zen 4 has a 320-entry retire queue and 6-wide dispatch. A load at the head of the window misses to DRAM; on a desktop Zen 4 at 5.0 GHz, DRAM latency is about 78 ns. How long until dispatch stalls, how many cycles of the miss are exposed, and what changes if three more independent misses dispatch within the same window?</p>`,
        a: `<ol><li>Miss latency in cycles: 78 ns × 5.0 GHz = 390 cycles.</li><li>The load can't retire, so the window fills after 320 / 6 ≈ 53 cycles of full-rate dispatch.</li><li>Exposed stall ≈ 390 − 53 ≈ <strong>337 cycles</strong>.</li><li>Four independent misses issued within those 53 cycles overlap: the window still stalls for about one latency, so the cost is roughly 337 cycles for all four, about 84 per miss. This is why window size and MLP matter more than raw width for memory-bound code.</li></ol>`
      },
      {
        q: `<p>Intel's Golden Cove core fetches 32 bytes per cycle into a 6-wide legacy decoder; its 4K-entry micro-op cache delivers 8 micro-ops per cycle into a 6-wide rename. A hot AVX-512 loop averages 6.5 bytes per instruction. What is the front-end limit on each path?</p>`,
        a: `<ol><li>Legacy path: fetch allows 32 / 6.5 ≈ 4.9 instructions per cycle, below the decoder's 6, so fetch bytes bind at about <strong>4.9 per cycle</strong>.</li><li>Micro-op cache path: 8 per cycle out of the cache, but rename takes 6, so <strong>6 per cycle</strong>.</li><li>Fitting the loop in the micro-op cache is worth about 6 / 4.9 ≈ 1.2× on front-end throughput, before considering other limits.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Apple's M1 performance core has four 128-bit FP/SIMD pipes, all FMA-capable, with a 4-cycle FMA latency, 32 architectural vector registers, and up to 3 loads per cycle. You write an FP32 dot product with one accumulator register. What fraction of peak do you get, and how would you restructure it?</p>`,
        a: `<p>One accumulator is a single dependency chain: one FMA every 4 cycles, while the machine can start 4 per cycle. That is 1 / (4 × 4) = <strong>1/16 of peak</strong>. Little's law: in-flight FMAs needed = latency × throughput = 4 × 4 = 16 independent accumulators. Use 16 vector accumulators (64 FP32 partial sums), sum them at the end; that leaves 16 registers for loaded operands, which is tight but workable. In practice the loop is also bounded by loads: two operands per FMA means 8 loads per cycle for peak, but the core does only 3. So the dot product is load-bound at 3 / 2 = 1.5 FMAs per cycle (37.5% of peak), which needs only 1.5 × 4 = 6 accumulators; a matrix multiply, which reuses each load across many FMAs, is the kernel that can reach FMA peak.</p>`
      },
      {
        q: `<p>Zen 4 executes 512-bit AVX-512 instructions as two 256-bit halves, so peak FLOPs are the same as with AVX2. Why would a compiler still emit 512-bit code for Zen 4?</p>`,
        a: `<ul><li><strong>Front-end and window pressure:</strong> half as many instructions for the same work, so fewer decode/op-cache slots, retire queue entries, and scheduler entries per FLOP. That raises effective lookahead.</li><li><strong>ISA features:</strong> mask registers for predication and tail handling, embedded broadcast, compress/expand, VPTERNLOG, conflict detection, and 32 vector registers, which reduce spills and instruction count beyond the width change.</li><li><strong>Loads:</strong> one 512-bit load replaces two 256-bit loads, easing load-port pressure.</li><li><strong>Forward compatibility:</strong> the same binary doubles throughput on full-width parts such as desktop Zen 5.</li></ul><p>The costs are larger code (EVEX encodings are long) and, on some Intel parts, frequency reductions; Zen 4 doesn't drop clocks for 512-bit code.</p>`
      }
    ]
  }
},

{
  id: "zen5-soc",
  region: "proc",
  title: "AMD Zen 5 Chiplets and SoCs",
  sections: [
    { id: "ccx", label: "CCX and CCD" },
    { id: "l3", label: "The Shared L3" },
    { id: "fabric", label: "Infinity Fabric and the I/O Die" },
    { id: "products", label: "Three Products, Three Topologies" },
    { id: "numa", label: "NUMA and Topology Settings" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<p>AMD builds every Zen 5 product from the same core, but packages it differently. The general case for chiplets is in <a href="#/icx-chiplets">Chiplets and UCIe</a>; this page is the concrete AMD version.</p>

<h3 id="sec-ccx">CCX and CCD</h3>
<ul>
<li><strong>CCX (core complex):</strong> the cores that share one L3. On Zen 5 that's 8 cores and up to 32 MB.</li>
<li><strong>CCD (core complex die):</strong> the silicon die holding a CCX. A Zen 5 CCD (TSMC N4P) holds one 8-core CCX; a dense Zen 5c CCD for servers (N3E) holds 16 cores and 32 MB of L3.</li>
<li><strong>IOD (I/O die):</strong> a separate die on an older, cheaper node (6 nm) with the memory controllers, PCIe/CXL, and the fabric switch. CCDs never connect directly to each other; all traffic between them goes through the IOD.</li>
</ul>
${procSvg(760, 330, 620, "A Zen 5 CCD with eight cores, each with a private 1 MB L2, arranged around a shared 32 MB L3, connected by an Infinity Fabric GMI link to an I/O die that holds memory controllers, PCIe and the fabric switch.",
  procFrame(20, 10, 420, 310, "CCD (N4P): one 8-core CCX") +
  [0, 1, 2, 3].map(i => procBox(36 + i * 100, 36, 92, 52, `Core ${i}`, "1 MB L2", "ex")).join("") +
  [4, 5, 6, 7].map(i => procBox(36 + (i - 4) * 100, 206, 92, 52, `Core ${i}`, "1 MB L2", "ex")).join("") +
  [0, 1, 2, 3].map(i => procLine(82 + i * 100, 88, 82 + i * 100, 110) + procLine(82 + i * 100, 186, 82 + i * 100, 206)).join("") +
  procBox(36, 110, 392, 76, "L3: 32 MB, 16-way, shared victim cache", ["one slice per core · shadow tags for all 8 L2s", "≈46-cycle average load-to-use (AMD)"], "mem") +
  procText(230, 290, "Infinity Fabric (GMI) port: 32 B/cycle reads at the fabric clock") +
  procArrow(440, 165, 500, 165) + procArrow(500, 175, 440, 175) +
  procBox(500, 60, 240, 210, "I/O die (6 nm)", ["DDR5 memory controllers", "PCIe 5.0 / CXL lanes", "Infinity Fabric switch", "(desktop: small RDNA 2 GPU,", "USB, display)"], "fe")
)}

<h3 id="sec-l3">The Shared L3</h3>
<p>The L3 is a 16-way, write-back <strong>victim cache</strong>: it is filled by lines evicted from the cores' L2s, not by demand misses. On an L3 hit, the line is invalidated from the L3 if the access was a store or only one core has read it (so it now lives in that core's L2), but stays if it is code or has been read by several cores. Each core has a slice, and the slices together serve all eight cores.</p>
<p>The L3 keeps <strong>shadow tags</strong> of every L2 in the CCX. On an L2 miss that also misses the L3 data, the shadow tags say whether another core's L2 has the line; if so, the line moves cache-to-cache inside the CCX without leaving the die. These shadow tags are a snoop filter (see <a href="#/moesi/filters">Snoop Filters</a>). AMD reports an average 46-cycle L3 load-to-use latency, 3.5 cycles better than Zen 4, and 320 L3 misses in flight per CCX; Agner Fog measures about 55 cycles.</p>
<p><strong>3D V-Cache</strong> parts (X3D) stack an extra 64 MB SRAM die on the CCD, raising that CCX's L3 to 96 MB at a small latency cost. On Zen 5 X3D the cache die sits under the CCD rather than on top, which improves cooling of the cores.</p>

<h3 id="sec-fabric">Infinity Fabric and the I/O Die</h3>
<p>Each CCD connects to the IOD through a GMI (Global Memory Interconnect) link. AMD's Hot Chips slides give the desktop datapath as 32 bytes per cycle per port at the fabric clock (FCLK); writes are narrower. At a typical 2.0 GHz FCLK, one CCD can read about 32 × 2.0 = 64 GB/s, less than the 89.6 GB/s of two DDR5-5600 channels. One consequence: <strong>a single CCD can't use all of a desktop's DRAM bandwidth</strong>; you need threads on both.</p>
<p>Coherence across CCDs is handled at the IOD's home agents. A line written on CCD 0 and then read on CCD 1 misses CCD 1's L3, goes to the IOD, which probes CCD 0, and the data returns over two GMI hops. That round trip is several times the latency of an L3 hit inside a CCX, which is why core-to-core latency tests on Zen parts show two clear tiers.</p>
${procSvg(760, 260, 620, "Three Zen 5 packages: Granite Ridge with two CCDs and an I/O die; Strix Point, a monolithic die with a 4-core Zen 5 CCX and an 8-core Zen 5c CCX; Turin with up to 16 CCDs around a central I/O die.",
  procText(130, 22, "<tspan style='font-weight:600;fill:var(--ink)'>Granite Ridge (Ryzen 9000)</tspan>") +
  procBox(30, 40, 95, 50, "CCD 0", "8 cores, 32 MB", "ex") + procBox(140, 40, 95, 50, "CCD 1", "8 cores, 32 MB", "ex") +
  procLine(77, 90, 77, 130) + procLine(187, 90, 187, 130) +
  procBox(30, 130, 205, 60, "I/O die", ["2 × DDR5 channels (128-bit)", "28 PCIe 5.0 lanes"], "fe") +
  procText(130, 215, "up to 16 cores in two L3 domains") +
  procText(380, 22, "<tspan style='font-weight:600;fill:var(--ink)'>Strix Point (Ryzen AI 300)</tspan>") +
  procFrame(270, 32, 220, 168, "one N4P die") +
  procBox(280, 56, 95, 62, "CCX 0", ["4 × Zen 5", "16 MB L3"], "ex") +
  procBox(385, 56, 95, 62, "CCX 1", ["8 × Zen 5c", "8 MB L3"], "ex") +
  procBox(280, 128, 200, 62, "GPU · NPU · fabric", ["16 RDNA 3.5 CUs · 50-TOPS NPU", "128-bit LPDDR5X / DDR5"], "fe") +
  procText(380, 215, "256-bit FP datapaths in the cores") +
  procText(630, 22, "<tspan style='font-weight:600;fill:var(--ink)'>Turin (EPYC 9005)</tspan>") +
  Array.from({ length: 8 }, (_, i) => `<rect x="${522 + i * 28}" y="45" width="22" height="28" rx="2" style="fill:var(--pad-soft);stroke:var(--trace)"/><rect x="${522 + i * 28}" y="168" width="22" height="28" rx="2" style="fill:var(--pad-soft);stroke:var(--trace)"/>`).join("") +
  procBox(560, 92, 140, 60, "I/O die", ["12 × DDR5 channels", "128 PCIe 5.0 lanes"], "fe") +
  procText(630, 215, "each square: 1 CCD of 8 Zen 5 cores") +
  procText(630, 230, "or 12 Zen 5c CCDs × 16 cores = 192")
)}

<h3 id="sec-products">Three Products, Three Topologies</h3>
<div class="tbl"><table>
<tr><th></th><th>Granite Ridge</th><th>Strix Point</th><th>Turin</th></tr>
<tr><td>Market</td><td>Desktop (AM5)</td><td>Laptop</td><td>Server (SP5)</td></tr>
<tr><td>Dies</td><td>1–2 CCDs + IOD</td><td>Monolithic</td><td>Up to 16 CCDs (Zen 5) or 12 (Zen 5c) + IOD</td></tr>
<tr><td>Cores and L3</td><td>Up to 16 cores, 32 MB per CCD</td><td>4 Zen 5 (16 MB) + 8 Zen 5c (8 MB)</td><td>Up to 128 Zen 5 or 192 Zen 5c; 32 MB per CCD</td></tr>
<tr><td>Memory</td><td>2 channels DDR5</td><td>128-bit LPDDR5X / DDR5</td><td>12 channels DDR5 per socket</td></tr>
<tr><td>FP datapath</td><td>512-bit</td><td>256-bit</td><td>512-bit</td></tr>
</table></div>
<p>Strix Point mixes core types: Zen 5c runs the same ISA with the same IPC, but is laid out for density and lower clocks. Because the two CCXs have separate L3s, migrating a thread between them loses its cached state, so the OS treats them as different clusters.</p>
<p>Turin's two server variants make a different trade: Zen 5 CCDs give 4 MB of L3 per core, while dense Zen 5c CCDs give 2 MB per core but 50% more cores. A 12-channel DDR5-6000 socket supplies 12 × 8 B × 6000 MT/s = 576 GB/s, which is 4.5 GB/s per core across 128 cores.</p>

<h3 id="sec-numa">NUMA and Topology Settings</h3>
<ul>
<li><strong>NPS (nodes per socket):</strong> EPYC firmware can present the socket as 1, 2, or 4 NUMA nodes, interleaving memory across all channels or only the channels near a quadrant of the IOD. NPS4 lowers average DRAM latency for NUMA-aware software; NPS1 is simplest.</li>
<li><strong>L3 as NUMA:</strong> a BIOS option exposes each CCX as its own NUMA node so the scheduler keeps cooperating threads in one L3.</li>
<li><strong>Two sockets:</strong> sockets connect by xGMI links that reuse PCIe lanes, which is why a 2-socket Turin system has up to 160 lanes rather than 256.</li>
</ul>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>The L3 a thread sees is its CCX's, not the package total.</strong> A 16-core desktop part has 64 MB of L3, but any single thread can use only 32 MB of it.</li>
<li><strong>Place communicating threads in one CCX.</strong> Locks, queues, and shared counters bounce lines through the IOD when they span CCDs.</li>
<li><strong>Spread bandwidth-hungry threads across CCDs</strong>, since each GMI link caps one CCD's share of DRAM bandwidth.</li>
<li><strong>Per-core bandwidth shrinks with core count.</strong> On a full Turin socket, memory-bound code may scale only to a fraction of the cores.</li>
<li><strong>Modeling:</strong> a faithful model needs per-CCX L3s with shadow-tag snoop filtering, a GMI link with separate read and write widths, and an IOD-level home agent; a single shared LLC will badly overstate sharing performance.</li>
</ul>
<p class="refs">References: Cohen and Subramony, <a href="https://hc2024.hotchips.org/assets/program/conference/day2/24_HC2024.AMD.Cohen.Subramony.final.pdf">"Next Generation Zen 5 Core,"</a> Hot Chips 2024 (CCX speeds and feeds, Granite Ridge and Strix Point slides) · AMD, <em>Software Optimization Guide for the AMD Zen5 Microarchitecture</em>, publication 58455, §2.6.4 · AMD, <em>5th Gen AMD EPYC Processor Architecture</em> white paper (2024) · Agner Fog, <a href="https://www.agner.org/optimize/microarchitecture.pdf"><em>The Microarchitecture of Intel, AMD, and VIA CPUs</em></a>, Chapter 25 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 5 (distributed shared memory and directories)</p>`,
  practice: {
    guided: [
      {
        q: `<p>An EPYC 9654 (Zen 4, "Genoa") has 96 cores, 12 channels of DDR5-4800, and a peak of 16 FP64 FLOPs per cycle per core at 2.4 GHz. Compute peak memory bandwidth, bandwidth per core, and the machine balance in FLOPs per byte.</p>`,
        a: `<ol><li>Bandwidth: 12 channels × 8 bytes × 4800 × 10<sup>6</sup> transfers/s = <strong>460.8 GB/s</strong>.</li><li>Per core: 460.8 / 96 = <strong>4.8 GB/s</strong>.</li><li>Peak compute: 96 × 16 × 2.4 × 10<sup>9</sup> = 3.69 TFLOPS.</li><li>Balance: 3,686 / 460.8 ≈ <strong>8.0 FLOPs per byte</strong>. A kernel below that arithmetic intensity is memory-bound on this socket.</li></ol>`
      },
      {
        q: `<p>A Ryzen 9 7950X3D (Zen 4) has two CCDs: CCD 0 has 96 MB of L3 (32 MB plus a stacked 64 MB), CCD 1 has 32 MB and clocks higher. An L3 hit takes about 50 cycles, and a DRAM access about 400. A game's main thread has a 60 MB hot working set. Where should it run, and what happens if the OS places it on CCD 1?</p>`,
        a: `<ol><li>On CCD 0 the working set fits in the 96 MB L3, so most misses from L2 hit L3 at about 50 cycles.</li><li>On CCD 1, only 32 MB fits; (60 − 32) / 60 ≈ 47% of the working set misses to DRAM, each miss costing about 400 cycles, 8× an L3 hit. The CCD's higher clock can't make up for that.</li><li>The L3 on the other CCD doesn't help: a CCD's L3 caches only its own cores' L2 victims, and reaching the other die goes through the IOD.</li><li>So pin the thread (and its helpers) to CCD 0; this is what AMD's driver and the Windows scheduler hints try to do for games.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A single-producer, single-consumer queue gets 4× lower throughput when the two threads are on different CCDs of a Ryzen 9 7950X than when they share a CCX. Walk through what each enqueue/dequeue does to the cache line holding the queue indices, and give two fixes.</p>`,
        a: `<p>Producer writes <code>tail</code>: it needs the line in M state, so the consumer's copy is invalidated. Consumer reads <code>tail</code>: it misses its L2 and its L3; inside one CCX, the L3's shadow tags find the line in the producer's L2 and transfer it on-die. Across CCDs the miss leaves the die, the IOD's home agent probes the other CCD, and the data crosses two GMI hops; every handoff pays that, and both indices ping-pong. Fixes:</p><ol><li>Keep both threads in one CCX (affinity)</li><li>Batch: publish the tail every N items and cache the remote index locally, so lines move once per batch</li><li>Put <code>head</code> and <code>tail</code> on separate cache lines to avoid false sharing</li><li>For cross-CCD pipelines, use larger messages so transfer cost amortizes</li></ol>`
      },
      {
        q: `<p>You can buy EPYC 9684X (Genoa-X: 96 Zen 4 cores, 1,152 MB of L3, i.e. 96 MB per 8-core CCD) or EPYC 9754 (Bergamo: 128 Zen 4c cores, 256 MB of L3, 16 MB per 8-core CCX). Both use 12 channels of DDR5-4800, 460.8 GB/s per socket. Which suits a parallel EDA placement job with a 70 MB per-process working set, and which suits a fleet of small stateless microservices? Justify with the hierarchy.</p>`,
        a: `<p>EDA: each process's 70 MB working set fits in a Genoa-X CCX's 96 MB L3 but not in Bergamo's 16 MB, where it would stream from DRAM at 460.8 / 128 = 3.6 GB/s per core. Genoa-X wins despite fewer cores; place one process per CCX. Microservices: small working sets fit in L2 and a modest L3, and throughput scales with core count and request-level parallelism; Bergamo's 128 / 96 = 1.33× the cores give more requests per second. The general point: per-core L3 and per-core bandwidth, not the package total, decide fit.</p>`
      }
    ]
  }
},

{
  id: "neoverse-v2",
  region: "proc",
  title: "Arm Neoverse V2 Core",
  sections: [
    { id: "overview", label: "Overview and Block Diagram" },
    { id: "fe", label: "Front End" },
    { id: "be", label: "Rename, Issue, and Execute" },
    { id: "ls", label: "Load/Store, L1D, and Prefetch" },
    { id: "l2", label: "Private L2" },
    { id: "ppa", label: "Area, Power, and Gains" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<h3 id="sec-overview">Overview and Block Diagram</h3>
<p>Neoverse V2 is Arm's 2022 high-performance server core (Armv9.0-A, SVE2). Arm licenses it, and NVIDIA (Grace), AWS (Graviton4), and Google (Axion) build chips with it. Arm's stated design principles: a run-ahead branch predictor so a modest instruction cache suffices, register files read <em>after</em> issue, short pipelines for quick misprediction recovery, and pushing width and depth together. Compared with Zen 5 it is about the same width, with narrower vectors and no SMT.</p>
${procSvg(760, 590, 620, "Neoverse V2 core block diagram: a decoupled branch predictor feeds a 64 KB instruction cache and a macro-op cache; a 6-wide decoder and the mop cache feed an 8-wide rename and dispatch; issue queues feed six integer pipes, four 128-bit vector pipes and three load/store pipes; a 64 KB data cache with prefetchers is backed by a private L2.",
  procBox(20, 10, 720, 46, "Branch predictor, decoupled and running ahead", "2 predicted branches/cycle · nano BTB + 2-level main BTB · 8-table TAGE · dedicated indirect predictor", "fe") +
  procArrow(240, 56, 240, 80) + procArrow(610, 56, 610, 80) +
  procBox(20, 80, 445, 46, "L1I: 64 KB, 4-way", "32-entry fetch queue · 16-entry fill buffer · doubled ITLB and I$ bandwidth", "fe") +
  procBox(480, 80, 260, 46, "Mop cache (smaller than V1's)", "up to 8 MOPs/cycle", "fe") +
  procArrow(240, 126, 240, 150) +
  procBox(20, 150, 445, 46, "Decode: 6 instructions/cycle", "24-entry decode queue · instruction fusion, e.g. CMP + CSEL/CSET", "fe") +
  procArrow(240, 196, 240, 220) + procArrow(610, 126, 610, 220) +
  procBox(20, 220, 720, 46, "Rename + dispatch: 8 MOPs/cycle", "320+ instruction window · 6 rename checkpoints (5 vector) · faster rebuild after flushes", "ex") +
  procArrow(200, 266, 200, 290) + procArrow(487, 266, 487, 290) + procArrow(668, 266, 668, 290) +
  procBox(20, 290, 360, 40, "Integer issue queues (22 entries each)", "", "ex") +
  procBox(390, 290, 195, 40, "Vector IQs: 2 × 28", "", "ex") +
  procBox(595, 290, 145, 40, "LS IQs: 3 × 16", "", "ex") +
  procArrow(200, 330, 200, 350) + procArrow(487, 330, 487, 350) + procArrow(668, 330, 668, 350) +
  [["SX0", "ALU · BR"], ["SX1", "ALU · BR"], ["SX2", "ALU · MUL"], ["SX3", "ALU · MUL"], ["SX4", "ALU"], ["SX5", "ALU"]].map((p, i) => procBox(20 + i * 60, 350, 56, 44, p[0], p[1], "ex")).join("") +
  [0, 1, 2, 3].map(i => procBox(390 + i * 49, 350, 45, 44, `VX${i}`, "128 b", "ex")).join("") +
  [["LS0", "ld/st"], ["LS1", "ld/st"], ["LD", "load"]].map((p, i) => procBox(595 + i * 49, 350, 45, 44, p[0], p[1], "ex")).join("") +
  procText(20, 412, "SX2–SX3 also multiply-accumulate; SX2 also divide", "start") +
  procText(20, 426, "result caches · register file read after issue", "start") +
  procText(390, 412, "SVE2 / NEON, FMA on all four", "start") +
  procText(390, 426, "16 FP64 FLOPs/cycle peak", "start") +
  procText(595, 412, "3 memory ops/cycle", "start") +
  procBox(20, 450, 450, 56, "L1D: 64 KB, 4-way · 48-entry L1 DTLB", ["store-to-load forwarding at L1-hit latency (VA-hash match)", "80-entry store queue · read-after-read hazard tracking"], "mem") +
  procBox(480, 450, 260, 56, "Hardware prefetchers", ["stride, SMS, global SMS, best-offset,", "correlated-miss, indirect, table-walk"], "mem") +
  procArrow(245, 506, 245, 530) + procArrow(610, 506, 610, 530) +
  procBox(20, 530, 720, 50, "Private L2: 1 or 2 MB, 8-way, 4 banks (Grace uses 1 MB)", "10-cycle load-to-use · 128 B/cycle total · 96-entry transaction queue · AMBA CHI with 32 B data channels", "mem")
)}
<p>Numbers come from Arm's Hot Chips 2023 presentation (Magnus Bruce) and Chips and Cheese's write-up of it; Arm publishes per-instruction latencies in its <em>Neoverse V2 Software Optimization Guide</em>.</p>

<h3 id="sec-fe">Front End</h3>
<ul>
<li><strong>Decoupled prediction:</strong> the predictor runs ahead of fetch through a fetch queue (doubled from 16 to 32 entries), so its output doubles as an L1I prefetcher and covers I-cache misses. This is what lets a 64 KB L1I serve large server code. See <a href="#/fe-decoupled/fdip">fetch-directed prefetching</a>.</li>
<li><strong>BTBs:</strong> a zero-bubble nano BTB 10× larger than V1's, and a main BTB split into two levels with 50% more entries (Chips and Cheese reports about 12K in total). Two predicted branches per cycle.</li>
<li><strong>Direction:</strong> an 8-table TAGE with tables twice as large as V1's, 2-way associative, using longer history; a dedicated indirect predictor.</li>
<li><strong>Mop cache:</strong> reduced from V1's size, for power and area. Fixed-length 4-byte Arm instructions are cheap to decode, so a decoded-instruction cache is worth less than on x86; Arm's next core, V3, dropped it entirely.</li>
<li><strong>Decode:</strong> 6 instructions per cycle (V1: 5), with a 24-entry decode queue (from 16).</li>
</ul>

<h3 id="sec-be">Rename, Issue, and Execute</h3>
<ul>
<li><strong>Rename:</strong> 8 macro-ops (Arm's MOPs, which are cracked into micro-ops at dispatch) per cycle into physical register files, with an instruction window of more than 320 entries. Six rename checkpoints (five for vector state, up from three) speed recovery after mispredictions.</li>
<li><strong>Distributed issue queues:</strong> one queue per integer pipe (22 entries), two dual-ported vector queues (28 entries each), and three 16-entry load/store queues. Queues hold tags only: operands are read from the register file after issue, and recently produced results come from small <em>result caches</em>. This keeps issue-queue entries small (compare data-capture schedulers in <a href="#/scheduler">Scheduler Queues</a>).</li>
<li><strong>Integer:</strong> six single-cycle ALUs (two more than V1). SX0 and SX1 also execute branches; SX2 and SX3 also do multiply and multiply-accumulate. Some register moves complete at rename with zero latency, and CMP + CSEL/CSET fuse.</li>
<li><strong>Vector:</strong> four 128-bit pipes for SVE2 and NEON. V1 had two 256-bit SVE pipes; V2 narrows SVE to a 128-bit vector length but keeps four pipes, so NEON and SVE code reach the same peak: 4 pipes × 2 FP64 lanes × 2 = 16 FP64 FLOPs per cycle. Predicate throughput doubled.</li>
</ul>

<h3 id="sec-ls">Load/Store, L1D, and Prefetch</h3>
<ul>
<li><strong>Pipes:</strong> two load/store pipes and one load-only pipe, so three memory ops per cycle, with four 8-byte integer result buses and three 16-byte vector result buses.</li>
<li><strong>L1D:</strong> 64 KB, 4-way. That's 16 KB per way, larger than a 4 KB page, so the index uses translated bits; the hardware handles the resulting virtual aliases. With the 64 KB base pages common on Arm servers, the index fits inside the page offset.</li>
<li><strong>Translation:</strong> a fully associative 48-entry L1 DTLB (up from 40), backed by an L2 TLB.</li>
<li><strong>Forwarding:</strong> store-to-load forwarding at L1-hit latency, matched by a virtual-address hash. Read-after-read ordering hazards are tracked through the line's lifetime in L2, which cuts memory-ordering flushes (see <a href="#/lsq">Load and Store Queues</a>).</li>
<li><strong>Prefetchers:</strong> stride, spatial memory streaming (SMS), global SMS for larger offsets, best-offset, correlated-miss cache, a sampling indirect prefetcher for pointer dereferences (<code>A[B[i]]</code>), and a page-table-walk prefetcher. They work on virtual addresses so they can cross pages and prefetch translations, and they throttle by accuracy and timeliness. Prefetches carry a lower QoS priority than demand requests. Arm credits prefetching with the largest single gain over V1, 5.3% on SPECint.</li>
</ul>

<h3 id="sec-l2">Private L2</h3>
<p>The L2 is 1 or 2 MB, 8-way, in four banks, each returning 64 bytes every two cycles (128 bytes per cycle in total). V2's 2 MB L2 has the same 10-cycle load-to-use latency as V1's 1 MB one. It is inclusive of the L1s, has a 96-entry transaction queue (its MLP budget toward the mesh), uses 6-state RRIP replacement with dead-block prediction (separating used-once from reused lines), and passes replacement hints to the system-level cache on copyback. It speaks AMBA CHI.E to the interconnect, with 32-byte data channels and a <code>WriteZero</code> transaction for <code>memset</code> (see <a href="#/icx-coherent/chi">CHI</a>). Grace uses the 1 MB configuration; Graviton4 uses 2 MB.</p>

<h3 id="sec-ppa">Area, Power, and Gains</h3>
<p>Arm's reference implementation: 2.50 mm² with a 2 MB L2 in 5 nm, about 1.4 W at 2.8 GHz, compared with V1's 2.52 mm² with 1 MB L2 in 7 nm. Estimated gains over V1 at equal clock: 13% on SPECint 2017 (speed), 17.3% on SPECrate integer. Arm attributes it in pieces: prefetching 5.3%, issue/execute 3.3%, load/store 3.0%, branch prediction 2.9%, decode/rename 2.8%, and smaller amounts elsewhere.</p>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>Half Zen 5's vector peak per cycle.</strong> 16 versus 32 FP64 FLOPs per cycle; Arm chips compete on cores per watt and memory bandwidth per core instead.</li>
<li><strong>SVE2 at 128 bits.</strong> Vector-length-agnostic code runs, but at VL = 128 there's no width gain over NEON; SVE's benefits are predication, gathers, and first-faulting loads for loops NEON can't vectorize.</li>
<li><strong>Cheap mispredictions, fast L2.</strong> A short pipeline and 10-cycle L2 reward branchy, pointer-heavy code, as long as the working set fits in L2. Beyond L2, latency is set by the chip's mesh, which in Grace is slow (see <a href="#/grace">NVIDIA Grace CPU and Superchips</a>).</li>
<li><strong>Compile for the target.</strong> Use <code>-mcpu=neoverse-v2</code> and LSE atomics (<code>CAS</code>, <code>LDADD</code>) instead of load-exclusive/store-exclusive loops; LSE atomics can execute near the data and scale far better under contention.</li>
</ul>
<p class="refs">References: Bruce, <a href="https://hc2023.hotchips.org/assets/program/conference/day1/CPU1/HC2023.Arm.MagnusBruce.v04.FINAL.pdf">"Arm Neoverse V2 Platform,"</a> Hot Chips 2023 · Chips and Cheese, <a href="https://chipsandcheese.com/p/hot-chips-2023-arms-neoverse-v2">"Hot Chips 2023: Arm's Neoverse V2"</a> · Arm, <em>Neoverse V2 Software Optimization Guide</em> · Seznec, "A New Case for the TAGE Branch Predictor," MICRO 2011 · Somogyi et al., "Spatial Memory Streaming," ISCA 2006 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>AWS Graviton3 uses Neoverse V1: 64 cores at 2.6 GHz, with two 256-bit SVE pipes that both do FMA. Compute its peak FP64 rate, and compare with a V2 core at the same clock, which has four 128-bit FMA pipes.</p>`,
        a: `<ol><li>FP64 lanes per 256-bit pipe: 4.</li><li>Per core: 2 pipes × 4 lanes × 2 = 16 FLOPs per cycle.</li><li>Chip: 64 × 16 × 2.6 × 10<sup>9</sup> ≈ <strong>2.66 TFLOPS</strong> FP64.</li><li>V2 trades two 256-bit pipes for four 128-bit pipes: 4 × 2 × 2 = 16 FLOPs per cycle, the <strong>same peak per core</strong>. The gain is that NEON code (128-bit) can now use all four pipes, and narrower pipes are easier to keep busy.</li></ol>`
      },
      {
        q: `<p>Graviton4 uses V2 with a 2 MB L2: 96 cores at 2.8 GHz, 16 FP64 FLOPs per cycle per core, and 12 channels of DDR5-5600. Compute peak DRAM bandwidth, bandwidth per core, and machine balance.</p>`,
        a: `<ol><li>Bandwidth: 12 × 8 B × 5600 × 10<sup>6</sup> = <strong>537.6 GB/s</strong>; per core 537.6 / 96 = <strong>5.6 GB/s</strong>.</li><li>Peak FP64: 96 × 16 × 2.8 × 10<sup>9</sup> ≈ 4.30 TFLOPS.</li><li>Balance: 4,301 / 537.6 ≈ <strong>8.0 FLOPs per byte</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Apple's M1 performance cores have a 128 KB, 8-way L1 data cache, and macOS on Apple silicon uses 16 KB pages. For comparison, Zen 5 has a 48 KB, 12-way L1 data cache and 4 KB pages. Why do those two numbers go together, and what would break with 4 KB pages?</p>`,
        a: `<p>A VIPT cache indexes with address bits before translation. Bytes per way = 128 KB / 8 = 16 KB, so the index and line offset use the low 14 bits, exactly the page offset of a 16 KB page; virtual and physical index bits agree, so there are no aliases. With 4 KB pages, 2 index bits would come from the virtual page number, and two virtual mappings of one physical page could sit in different sets (synonyms). The hardware would need alias detection or the OS page coloring, or the cache would need 32 ways at that size. Zen 5 hits the same constraint and answers it with more ways: 48 KB / 12 = 4 KB per way.</p>`
      },
      {
        q: `<p>Arm shrank the macro-op cache in V2 and removed it in V3, while x86 cores keep growing theirs. Explain the difference.</p>`,
        a: `<p>A decoded-op cache pays off in proportion to how expensive decode is. x86 instructions are 1 to 15 bytes with prefixes, so finding instruction boundaries and cracking them is costly in power, latency, and width; that is why x86 decoders stay around 4 wide per pipe and the op cache supplies the rest. Arm's fixed 4-byte encoding lets a decoder find all boundaries trivially and scale to 6 or more instructions per cycle at modest cost. Meanwhile a mop cache costs area and power, needs coherence with the I-cache, and adds a mode switch. Once the plain decoder is wide enough to feed rename, the mop cache's marginal benefit is small, so Arm spent the area elsewhere (BTBs, prefetchers).</p>`
      }
    ]
  }
},

{
  id: "grace",
  region: "proc",
  title: "NVIDIA Grace CPU and Superchips",
  sections: [
    { id: "chip", label: "The Grace Die" },
    { id: "scf", label: "Scalable Coherency Fabric" },
    { id: "mem", label: "LPDDR5X on the Package" },
    { id: "c2c", label: "NVLink-C2C and Superchips" },
    { id: "lat", label: "Measured Latency and Bandwidth" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<h3 id="sec-chip">The Grace Die</h3>
<p>Grace is NVIDIA's data-center CPU: one monolithic die with 72 active <a href="#/neoverse-v2">Neoverse V2</a> cores, each with 64 KB L1I, 64 KB L1D, and a 1 MB L2, sharing 114 MB of L3 (NVIDIA's figures cite 117 MB of L3 on the die; the shipping configuration enables 114 MB). It ships in three forms: alone (Grace C1), as two Grace dies on one board (the Grace CPU Superchip, 144 cores), or paired with a GPU (GH200 with Hopper, GB200 with Blackwell).</p>
<p>A quick check on NVIDIA's numbers: the Superchip's quoted 7.1 TFLOPS FP64 is exactly 144 cores × 16 FLOPs per cycle × 3.1 GHz.</p>
${procSvg(760, 330, 620, "A Grace die drawn as a mesh of cache switch nodes, each connecting cores and an L3 slice, with memory controllers, NVLink-C2C and PCIe at the edges; to the right, two Grace dies joined by NVLink-C2C form the Grace CPU Superchip, and a Grace die joined to an H100 forms the GH200 Grace Hopper Superchip.",
  procFrame(20, 10, 440, 310, "Grace die (schematic mesh, not the real grid size)") +
  [0, 1, 2, 3, 4, 5].map(c => procLine(73 + c * 66, 65, 73 + c * 66, 239)).join("") +
  [0, 1, 2, 3].map(r => procLine(73, 65 + r * 58, 403, 65 + r * 58)).join("") +
  [0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5].map(c => {
    const edge = { "0,0": "MC", "3,0": "MC", "0,5": "C2C", "3,5": "PCIe" }[r + "," + c];
    return procBox(50 + c * 66, 50 + r * 58, 46, 30, `<tspan style="font-size:10px">${edge || "C · L3"}</tspan>`, "", edge ? "fe" : "ex");
  }).join("")).join("") +
  procText(240, 278, "Each Cache Switch Node joins cores and an L3 slice to the mesh") +
  procText(240, 294, "72 cores · 114 MB L3 · &gt;3.2 TB/s bisection · LPDDR5X controllers at the edge") +
  procText(615, 22, "<tspan style='font-weight:600;fill:var(--ink)'>Grace CPU Superchip</tspan>") +
  procBox(500, 36, 90, 50, "Grace", "72 cores", "ex") + procBox(640, 36, 90, 50, "Grace", "72 cores", "ex") +
  procArrow(590, 56, 640, 56) + procArrow(640, 66, 590, 66) +
  procText(615, 102, "NVLink-C2C, 900 GB/s") +
  procBox(500, 112, 90, 32, "LPDDR5X", "", "mem") + procBox(640, 112, 90, 32, "LPDDR5X", "", "mem") +
  procLine(545, 86, 545, 112) + procLine(685, 86, 685, 112) +
  procText(615, 182, "<tspan style='font-weight:600;fill:var(--ink)'>Grace Hopper (GH200)</tspan>") +
  procBox(500, 196, 90, 50, "Grace", ["LPDDR5X", "≤480 GB"], "ex") + procBox(640, 196, 90, 50, "H100", ["HBM3", "96 GB"], "fe") +
  procArrow(590, 216, 640, 216) + procArrow(640, 226, 590, 226) +
  procText(615, 264, "NVLink-C2C, cache-coherent") +
  procText(615, 280, "one address space, two NUMA nodes")
)}

<h3 id="sec-scf">Scalable Coherency Fabric</h3>
<p>The cores and L3 slices sit on a 2D mesh NVIDIA calls the <strong>Scalable Coherency Fabric</strong> (SCF). Each mesh stop is a Cache Switch Node (CSN) that routes traffic and connects cores, an L3 slice, and, at the edges, memory controllers and I/O. The L3 is distributed: each physical address hashes to one home slice, so the average L3 access crosses half the mesh. NVIDIA quotes more than 3.2 TB/s of bisection bandwidth. The fabric supports Arm MPAM, which lets software partition L3 capacity and memory bandwidth between workloads. See <a href="#/icx-coherent/mesh">mesh interconnects</a> and <a href="#/directory">Directory-Based Coherence</a> for the general design.</p>

<h3 id="sec-mem">LPDDR5X on the Package</h3>
<p>Instead of DDR5 DIMMs, Grace puts LPDDR5X with ECC on the package next to the die. NVIDIA's numbers per Grace C1: 120, 240, or 480 GB, at up to 512 GB/s (384 GB/s for the 480 GB part), and about 16 W for 500 GB/s. NVIDIA compares it with an eight-channel DDR5 design as up to 53% more bandwidth at one-eighth the power per GB/s. The 480 GB configuration Chips and Cheese tested uses LPDDR5X-6400 on a 480-bit bus: 60 bytes × 6.4 GT/s = 384 GB/s.</p>
<p>The trade-offs: capacity is fixed at purchase (no DIMM slots), LPDDR is designed for bandwidth and power rather than latency, and capacity per socket tops out below what a 12-channel RDIMM server can hold.</p>

<h3 id="sec-c2c">NVLink-C2C and Superchips</h3>
<p>NVLink-C2C is NVIDIA's chip-to-chip link: 900 GB/s total (450 GB/s per direction), about 7× a PCIe 5.0 x16 link, and cache-coherent. In the Grace CPU Superchip it joins two Grace dies into a 2-socket system with two NUMA nodes. In GH200 it joins Grace to a Hopper GPU: the CPU can load from HBM, the GPU can load from LPDDR5X, both through the same page tables (the GPU translates CPU virtual addresses through Address Translation Services), so a pointer from <code>malloc</code> works in a GPU kernel. Each side's memory is a separate NUMA node, so placement still decides speed. Each Grace also provides up to 4 PCIe 5.0 x16 links (8 on the Superchip).</p>

<h3 id="sec-lat">Measured Latency and Bandwidth</h3>
<div class="tbl"><table>
<tr><th>Level (Grace in GH200)</th><th>Measured by Chips and Cheese</th></tr>
<tr><td>L2</td><td>10 cycles (Arm's figure; matches Graviton4 in tests)</td></tr>
<tr><td>L3</td><td>Over 38 ns, more than 125 cycles at 3.4 GHz</td></tr>
<tr><td>Local LPDDR5X</td><td>Over 200 ns</td></tr>
<tr><td>HBM3 across NVLink-C2C (from the CPU)</td><td>Nearly 800 ns</td></tr>
<tr><td>Aggregate L3 bandwidth</td><td>Over 2 TB/s</td></tr>
<tr><td>Single-core DRAM bandwidth</td><td>21 GB/s</td></tr>
</table></div>
<p>The pattern: large shared bandwidth, high latency beyond L2. A mesh-distributed L3 at 38 ns is far from Zen 5's on-CCX L3 (46 cycles, about 9 ns at 5 GHz), and the DRAM latency is roughly double a typical DDR5 server's.</p>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>Bandwidth-bound codes do well.</strong> Machine balance is about 3.57 TFLOPS / 500 GB/s ≈ 7 FLOPs per byte per chip, low for a CPU, so stencils, sparse solvers, and streaming analytics approach their memory roofline.</li>
<li><strong>Latency-bound codes suffer.</strong> Pointer chasing pays 200+ ns per dependent miss; the 1 MB L2 is the last fast level. Use huge pages (64 KB base pages help the TLB too), software prefetch, and layouts that create independent misses.</li>
<li><strong>Single-thread bandwidth is limited by MLP.</strong> At 21 GB/s and 200 ns, one core keeps about 21 × 10<sup>9</sup> × 200 × 10<sup>−9</sup> ≈ 4.2 KB, about 66 lines, in flight; filling the chip's bandwidth needs many cores streaming.</li>
<li><strong>On GH200, place data deliberately.</strong> The GPU can read LPDDR5X coherently, but at C2C speed (450 GB/s per direction) rather than 4 TB/s of HBM, and the CPU sees 800 ns to HBM. Use the coherent path for convenience and irregular access; migrate or prefetch bulk data into the memory of the processor that will use it.</li>
<li><strong>Two-die Superchip is NUMA.</strong> Bind processes and memory per die, as on any 2-socket server.</li>
</ul>
<p class="refs">References: NVIDIA, <a href="https://developer.nvidia.com/blog/nvidia-grace-cpu-superchip-architecture-in-depth">"NVIDIA Grace CPU Superchip Architecture In Depth"</a> (developer blog, 2023) · NVIDIA, <a href="https://docs.nvidia.com/dccpu/grace-perf-tuning-guide/index.html"><em>Grace Performance Tuning Guide</em></a> · Chips and Cheese, <a href="https://chipsandcheese.com/p/grace-hopper-nvidias-halfway-apu">"Grace Hopper, Nvidia's Halfway APU"</a> · NVIDIA, <em>Grace CPU Superchip</em> white paper · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapters 2 and 5</p>`,
  practice: {
    guided: [
      {
        q: `<p>Chips and Cheese measured a Graviton4 core reading DRAM at 28 GB/s with a DRAM latency of about 114 ns. Use Little's law to find how many 64-byte lines that core keeps in flight.</p>`,
        a: `<ol><li>Bytes in flight = bandwidth × latency = 28 × 10<sup>9</sup> B/s × 114 × 10<sup>−9</sup> s ≈ 3,190 bytes.</li><li>Lines: 3,190 / 64 ≈ <strong>50 lines</strong> outstanding.</li><li>That number reflects the core's miss-handling resources (L1 and L2 miss queues) plus prefetchers; to go faster with the same latency, a core needs more outstanding misses, not more ALUs.</li></ol>`
      },
      {
        q: `<p>Compare per-core DRAM bandwidth for a full Graviton4 (96 cores, 537.6 GB/s) and a fully loaded EPYC 9654 (96 cores, 460.8 GB/s). If a stencil needs 6 GB/s per core to keep its FMAs busy, which chip runs it compute-bound?</p>`,
        a: `<ol><li>Graviton4: 537.6 / 96 = 5.6 GB/s per core.</li><li>EPYC 9654: 460.8 / 96 = 4.8 GB/s per core.</li><li>Neither reaches 6 GB/s, so <strong>both are memory-bound</strong> with all cores busy; Graviton4 delivers about 5.6 / 6 ≈ 93% of compute-bound speed, the EPYC about 4.8 / 6 = 80%. Running fewer cores per socket would make each core compute-bound but lose total throughput.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why would a CPU vendor choose on-package LPDDR5X over DDR5 RDIMMs for a data-center part, and what do customers give up?</p>`,
        a: `<p>Gains: much lower energy per bit (short, unterminated traces and low-voltage signaling), high bandwidth per pin and per mm of package edge, smaller board area, and freedom from DIMM signal-integrity limits on channel count. Losses:</p><ul><li>Capacity is fixed when the board is built and lower than a 12-channel, 2-DIMM-per-channel server</li><li>No field replacement of failed memory (so the vendor needs ECC and sparing)</li><li>LPDDR's latency is typically higher than DDR5's</li></ul><p>It suits HPC and AI nodes that are bandwidth- and power-bound and whose capacity needs are known in advance; it suits general-purpose clouds with varied memory sizes less well.</p>`
      },
      {
        q: `<p>A graph traversal runs 1.6× slower per core on Grace than on a Zen 4 EPYC, even though Grace has more DRAM bandwidth per core. A pointer-chase test measures DRAM latency at about 200 ns on Grace and about 125 ns on the EPYC. Build a simple model that explains it, and name two code changes that would narrow the gap.</p>`,
        a: `<p>Graph traversal is latency-bound: each step's address depends on the last load. Time per step ≈ miss rate × memory latency / MLP. With MLP near 1 for a single chain, the ratio of per-step times is the ratio of latencies: 200 / 125 = 1.6, exactly the measured gap. It tracks latency, not bandwidth; bandwidth is mostly idle.</p><p>Fixes:</p><ol><li>Increase MLP by processing many independent traversals (or frontier vertices) interleaved, so several chains have misses in flight, which converts the problem to a bandwidth one where Grace is strong.</li><li>Software prefetch of the next vertices' adjacency data from the frontier.</li><li>Reorder vertices for locality (e.g., by BFS or community order) so more neighbors share lines and pages.</li><li>Use huge pages so TLB walks don't add a second dependent miss.</li></ol>`
      }
    ]
  }
},

{
  id: "gen-gpus",
  region: "proc",
  title: "GPUs for Generative AI",
  sections: [{ id: "gpu-arch", label: "GPU Architecture" }, { id: "roofline", label: "Roofline" }, { id: "llm-bound", label: "LLM Inference" }, { id: "diff-gpu", label: "Diffusion on GPUs" }],
  body: `
<p>Generative models are huge piles of matrix math repeated many times. GPUs became the standard platform because they deliver enormous parallel arithmetic and memory bandwidth, and their software stack makes that usable.</p>
<h3 id="sec-gpu-arch">GPU Architecture in Brief</h3>
<ul>
<li><strong>Streaming multiprocessors (SMs):</strong> a GPU has on the order of 100 of them, each running many threads at once.</li>
<li><strong>SIMT warps:</strong> threads execute in groups of 32 in lockstep. Divergent branches inside a warp serialize, so uniform work runs best.</li>
<li><strong>Latency hiding by parallelism:</strong> instead of big caches and out-of-order execution, a GPU keeps thousands of threads in flight and switches to ready warps while others wait on memory.</li>
<li><strong>Tensor Cores:</strong> units that perform small matrix multiply-accumulates in one operation at low precision (FP16, BF16, FP8), providing most of the FLOP/s for AI. See <a href="#/gpu-kernels/tensor-cores">Tensor Cores</a>.</li>
<li><strong>High-bandwidth memory (HBM):</strong> stacked DRAM next to the GPU, delivering several TB/s.</li>
<li><strong>On-chip memory:</strong> large register files and shared memory let kernels reuse data without going to HBM.</li>
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
<h3>Scaling Past One GPU</h3>
<p>Big models are split across GPUs with tensor parallelism (each layer's matrices divided among GPUs) and pipeline parallelism (different layers on different GPUs), connected by high-bandwidth links. Communication between GPUs then becomes another bottleneck to model.</p>
<h3>The Energy Question</h3>
<p>Moving data costs far more energy than computing on it, and GPUs spend energy enforcing exact, deterministic arithmetic even for workloads like sampling that are inherently random. That's the motivation for alternative hardware: more on-chip memory, lower precision, specialized accelerators, and probabilistic or thermodynamic designs that compute with physical noise.</p>
<h3>Connecting to Performance Modeling</h3>
<p>The same questions from CPU work apply: what's the bottleneck (compute, memory bandwidth, latency, communication), what's the arithmetic intensity, how well are the units utilized (occupancy, warp divergence, memory coalescing), and how does a design change move the workload on the roofline?</p>`,
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
},

{
  id: "hopper",
  region: "proc",
  title: "NVIDIA Hopper GPU (H100)",
  sections: [
    { id: "chip", label: "Chip Organization" },
    { id: "sm", label: "Inside the SM" },
    { id: "tc", label: "Fourth-Generation Tensor Cores" },
    { id: "mem", label: "Memory Hierarchy" },
    { id: "async", label: "TMA and Asynchronous Barriers" },
    { id: "cluster", label: "Thread Block Clusters and DSMEM" },
    { id: "links", label: "NVLink and Scale-Out" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<p>A GPU is organized around the opposite bet from a CPU core: no branch predictor, no out-of-order window, small per-thread resources, and enough resident threads that some are always ready while others wait on memory. <a href="#/gen-gpus">How GPUs Make This Possible</a> and <a href="#/gpu-kernels">GPU Kernels and Tensor Cores</a> cover the programming model; this page is the hardware of NVIDIA's 2022 data-center GPU.</p>

<h3 id="sec-chip">Chip Organization</h3>
<p>GH100 (TSMC 4N, 80 billion transistors, 814 mm²) is built hierarchically: 8 GPCs (graphics processing clusters), each with 9 TPCs of 2 SMs, for 144 SMs on a full die. The H100 SXM5 product enables 132 SMs (66 TPCs) and 5 of 6 HBM3 stacks: 80 GB on ten 512-bit memory controllers.</p>
${procSvg(760, 330, 620, "H100 chip organization: eight GPCs, four above and four below, around an L2 cache split into two partitions joined by a crossbar; HBM3 stacks and memory controllers at the edges, NVLink and PCIe interfaces.",
  procText(380, 22, "HBM3 stacks and 512-bit memory controllers along the die edges (H100 SXM: 5 stacks, 80 GB, 3.35 TB/s)") +
  [0, 1, 2, 3].map(i => procBox(20 + i * 185, 36, 165, 64, `GPC ${i}`, ["9 TPCs × 2 SMs (full die)", "SM-to-SM network"], "ex")).join("") +
  [4, 5, 6, 7].map(i => procBox(20 + (i - 4) * 185, 226, 165, 64, `GPC ${i}`, ["9 TPCs × 2 SMs (full die)", "SM-to-SM network"], "ex")).join("") +
  [0, 1, 2, 3].map(i => procLine(102 + i * 185, 100, 102 + i * 185, 122) + procLine(102 + i * 185, 204, 102 + i * 185, 226)).join("") +
  procBox(20, 122, 355, 82, "L2 partition 0", ["half of the 50 MB L2", "caches lines for its directly attached GPCs"], "mem") +
  procBox(385, 122, 355, 82, "L2 partition 1", ["half of the 50 MB L2", "far-partition data crosses the crossbar"], "mem") +
  procArrow(375, 158, 385, 158) + procArrow(385, 168, 375, 168) +
  procText(380, 315, "NVLink 4: 18 links, 900 GB/s total · PCIe 5.0 x16 · 132 of 144 SMs enabled on H100 SXM")
)}
<p>Peak rates for H100 SXM (NVIDIA datasheet): 989 TFLOPS dense FP16/BF16 tensor, 1,979 TFLOPS dense FP8, 67 TFLOPS FP64 tensor, 67 TFLOPS FP32 and 34 TFLOPS FP64 on the CUDA cores; 3.35 TB/s HBM3. (The launch whitepaper's 1,000 / 2,000 / 3 TB/s figures were preliminary.) The FP32 figure implies the clock: 132 SMs × 128 lanes × 2 FLOPs × 1.98 GHz ≈ 66.9 TFLOPS.</p>

<h3 id="sec-sm">Inside the SM</h3>
${procSvg(760, 400, 620, "An H100 SM: a shared L1 instruction cache above four sub-partitions; each has a warp scheduler, a 64 KB register file, 32 FP32 lanes, 16 INT32 and 16 FP64 lanes, special-function and load/store units, and one tensor core; below them, a 256 KB L1 data cache and shared memory, the Tensor Memory Accelerator, texture units and the SM-to-SM network.",
  procBox(20, 10, 720, 30, "L1 instruction cache", "", "fe") +
  [0, 1, 2, 3].map(i => {
    const x = 20 + i * 185;
    return `<rect x="${x}" y="50" width="165" height="232" rx="3" style="fill:none;stroke:var(--rule);stroke-width:1.2"/>` +
      procBox(x + 8, 58, 149, 24, "Warp scheduler", "", "fe") +
      procBox(x + 8, 88, 149, 24, "Registers: 64 KB", "", "mem") +
      procBox(x + 8, 118, 149, 24, "32 FP32 lanes", "", "ex") +
      procBox(x + 8, 148, 149, 24, "16 INT32 · 16 FP64", "", "ex") +
      procBox(x + 8, 178, 149, 24, "SFU · LD/ST", "", "ex") +
      procBox(x + 8, 208, 149, 50, "Tensor core, 4th gen", ["FP8 · FP16 · BF16", "TF32 · FP64"], "ex") +
      procText(x + 82, 274, `sub-partition ${i}`);
  }).join("") +
  procBox(20, 296, 720, 44, "256 KB L1 data cache / shared memory", "configurable; up to 228 KB as shared memory", "mem") +
  procBox(20, 350, 230, 40, "Tensor Memory Accelerator", "", "fe") +
  procBox(265, 350, 230, 40, "Texture units", "", "mem") +
  procBox(510, 350, 230, 40, "SM-to-SM network (DSMEM)", "", "fe")
)}
<ul>
<li><strong>Four sub-partitions,</strong> each with its own warp scheduler that issues one warp instruction (32 threads) per cycle, a 16,384 × 32-bit register file (64 KB), 32 FP32 lanes, 16 INT32 and 16 FP64 lanes, special-function units, load/store units, and one tensor core. A warp lives in one sub-partition.</li>
<li><strong>Latency hiding by warp switching:</strong> each scheduler holds many warps and picks a ready one every cycle; a warp waiting on memory simply isn't picked. The SM holds up to 64 warps (2,048 threads). This is fine-grained multithreading; compare <a href="#/smt">Simultaneous Multithreading</a>.</li>
<li><strong>Registers limit occupancy:</strong> the 256 KB register file per SM (33 MB across the GPU, two-thirds the size of the L2) is divided among resident threads; a kernel using 255 registers per thread can keep only 256 threads (8 warps) per SM.</li>
<li><strong>Shared memory and L1</strong> are one 256 KB SRAM per SM, split by the kernel's request between explicitly managed shared memory (up to 228 KB) and hardware-managed L1.</li>
</ul>

<h3 id="sec-tc">Fourth-Generation Tensor Cores</h3>
<p>Per SM, clock for clock, H100's tensor cores do twice A100's dense MMA rate for FP16/BF16/TF32/FP64, and four times with the new FP8 formats (E4M3 and E5M2, with FP16 or FP32 accumulation; see <a href="#/fp-ml-formats/fp8">FP8</a>). Hopper adds <code>wgmma</code>: an asynchronous MMA issued by a <em>warpgroup</em> (4 warps, 128 threads, one per sub-partition) that reads its B operand (and optionally A) directly from shared memory, so operand tiles don't have to pass through registers. Accumulators still live in registers. The "Transformer Engine" is software and hardware that choose FP8 or 16-bit per layer and track scaling factors.</p>

<h3 id="sec-mem">Memory Hierarchy</h3>
<div class="tbl"><table>
<tr><th>Level</th><th>Size</th><th>Scope</th><th>Notes</th></tr>
<tr><td>Registers</td><td>256 KB per SM</td><td>Thread</td><td>Highest bandwidth; limits occupancy</td></tr>
<tr><td>L1 / shared memory</td><td>256 KB per SM</td><td>Thread block (or cluster via DSMEM)</td><td>Shared memory is software-managed</td></tr>
<tr><td>L2</td><td>50 MB</td><td>Whole GPU</td><td><ul><li>Two partitions</li><li>Residency controls</li><li>Data compression</li></ul></td></tr>
<tr><td>HBM3</td><td>80 GB</td><td>Whole GPU</td><td>3.35 TB/s; about 300 ns measured latency (Chips and Cheese, GH200 variant)</td></tr>
</table></div>
<p>The L2 uses a partitioned crossbar: each partition caches data for the GPCs directly attached to it, and an SM reaching data homed in the far partition pays extra latency. Programs can mark an address range as persisting in L2 (an access-policy window), useful for a hot lookup table that would otherwise be evicted by streaming data.</p>

<h3 id="sec-async">TMA and Asynchronous Barriers</h3>
<p>The <strong>Tensor Memory Accelerator</strong> is a per-SM copy engine. One thread hands it a descriptor (a 1D–5D tensor's base, shape, strides, and a tile's coordinates), and it moves the whole tile between global and shared memory, doing the address generation that A100 code did with per-thread <code>cp.async</code> instructions. It can multicast one tile to several SMs in a cluster.</p>
<p>Completion is tracked by an <strong>asynchronous transaction barrier</strong> in shared memory, which counts bytes as well as thread arrivals: consumers wait until the expected byte count has landed. Waiting threads sleep rather than spin. Together these enable warp specialization: a producer warp issues TMA loads into a ring of shared-memory buffers while consumer warpgroups run <code>wgmma</code> on full buffers, the structure used by FlashAttention-3 and CUTLASS Hopper kernels.</p>

<h3 id="sec-cluster">Thread Block Clusters and DSMEM</h3>
<p>Hopper adds a level to the CUDA hierarchy: a <strong>cluster</strong> of thread blocks guaranteed to run at the same time on SMs within one GPC. Threads in a cluster can load, store, and perform atomics on each other's shared memory (<strong>distributed shared memory</strong>), over a dedicated SM-to-SM network; NVIDIA reports about 7× faster block-to-block exchange than going through global memory. Clusters let a GEMM share operand tiles across SMs (via TMA multicast) instead of each SM fetching its own copy from L2.</p>

<h3 id="sec-links">NVLink and Scale-Out</h3>
<p>Fourth-generation NVLink gives each H100 18 links and 900 GB/s total, 7× PCIe 5.0 x16. In an HGX H100 board, NVSwitch chips connect 8 GPUs all-to-all at full bandwidth, and the switches can perform reductions in the network (SHARP), halving the data an all-reduce moves. See <a href="#/icx-links/gpu-links">GPU links</a>.</p>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>Bytes in flight:</strong> 3.35 TB/s × about 300 ns ≈ 1 MB must be outstanding to saturate HBM, about 7.6 KB per SM. Per-thread loads need many warps; TMA puts kilobytes in flight per instruction.</li>
<li><strong>Ridge point:</strong> 989 TFLOPS / 3.35 TB/s ≈ 295 FLOPs per byte for dense FP16. GEMMs with large tiles clear it; LLM decode (matrix-vector work, about 1 FLOP per weight byte at FP16) is far below it and runs at memory speed. See <a href="#/llm-phases">Prefill and Decode</a>.</li>
<li><strong>Waves:</strong> work is distributed in waves of (blocks per SM × 132); a grid slightly larger than a wave leaves most SMs idle in the last one.</li>
<li><strong>Locality across the L2 split</strong> matters for latency-sensitive kernels; the far partition is slower.</li>
<li><strong>Modeling:</strong> a GPU model must capture warp scheduling and occupancy limits (registers, shared memory, warps), the async copy and barrier semantics, and the L2's partitioning; an IPC-style single-thread model says nothing useful here.</li>
</ul>
<p class="refs">References: NVIDIA, <a href="https://www.ece.lsu.edu/koppel/gp/refs/gtc22-whitepaper-hopper.pdf"><em>NVIDIA H100 Tensor Core GPU Architecture</em></a> whitepaper (2022) · NVIDIA, <em>H100 Tensor Core GPU</em> datasheet · Chips and Cheese, <a href="https://chipsandcheese.com/p/grace-hopper-nvidias-halfway-apu">"Grace Hopper, Nvidia's Halfway APU"</a> · Shah et al., "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision," 2024 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (GPUs)</p>`,
  practice: {
    guided: [
      {
        q: `<p>An A100 (108 SMs, 1,555 GB/s HBM2, 312 TFLOPS dense FP16 tensor) runs an FP16 GEMM with M = N = K = 4096. Find the ridge point, the GEMM's arithmetic intensity (counting each matrix read or written once), and a lower bound on its time.</p>`,
        a: `<ol><li>Ridge: 312 × 10<sup>12</sup> / 1,555 × 10<sup>9</sup> ≈ <strong>201 FLOPs per byte</strong>.</li><li>FLOPs: 2 × 4096<sup>3</sup> ≈ 1.374 × 10<sup>11</sup>.</li><li>Bytes: three 4096 × 4096 matrices × 2 B ≈ 3 × 33.6 MB ≈ 100.7 MB.</li><li>Intensity: 1.374 × 10<sup>11</sup> / 1.007 × 10<sup>8</sup> ≈ <strong>1,365 FLOPs per byte</strong>, well above the ridge: compute-bound.</li><li>Lower bound: 1.374 × 10<sup>11</sup> / 312 × 10<sup>12</sup> ≈ <strong>0.44 ms</strong>.</li></ol>`
      },
      {
        q: `<p>On an A100 SM (65,536 registers, 64 warps max, up to 164 KB shared memory), a kernel uses 128 registers per thread and 256-thread blocks. How many blocks fit per SM, and what is the occupancy? What if each block also needs 100 KB of shared memory?</p>`,
        a: `<ol><li>Registers per block: 128 × 256 = 32,768, so 65,536 / 32,768 = <strong>2 blocks</strong>.</li><li>Warps: 2 blocks × 8 warps = 16 of 64, <strong>25% occupancy</strong>.</li><li>With 100 KB of shared memory per block, only 1 block fits in 164 KB: 8 warps, 12.5% occupancy. Whether that hurts depends on how much memory parallelism each warp exposes (TMA-style bulk copies or software pipelining can make low occupancy fine).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A kernel on an A100 launches 220 blocks, and at most one block fits per SM. Compute the tail efficiency, and propose two fixes.</p>`,
        a: `<p>One wave is 108 blocks. 220 blocks need 3 waves (108, 108, 4). If every block takes the same time T, total time is 3T while useful work is 220 block-times out of 3 × 108 = 324 slots: efficiency 220 / 324 ≈ <strong>68%</strong>.</p><p>Fixes:</p><ol><li>Resize tiles so the grid is close to a multiple of 108 (e.g., 216 blocks).</li><li>Make blocks smaller so 2 fit per SM and the last wave is a smaller fraction.</li><li>Use a persistent-kernel / stream-K scheme where 108 blocks loop over work units so the tail is split finely.</li><li>Run another kernel concurrently to fill idle SMs.</li></ol>`
      },
      {
        q: `<p>A100 already had <code>cp.async</code> for asynchronous global-to-shared copies and <code>mma.sync</code> for tensor cores. What limits did that leave that TMA and <code>wgmma</code> remove?</p>`,
        a: `<ul><li><strong>Issue slots and registers for addressing:</strong> with <code>cp.async</code> every thread computes addresses and issues its own 16-byte copies, spending instructions and registers that compete with math. TMA does a whole tile from one descriptor.</li><li><strong>Operands through registers:</strong> <code>mma.sync</code> needs A and B fragments in registers, so tiles are loaded shared→registers before each MMA, costing register file bandwidth and capacity. <code>wgmma</code> reads B (and optionally A) from shared memory directly.</li><li><strong>Synchronous MMA:</strong> <code>mma.sync</code> blocks the warp; <code>wgmma</code> is asynchronous, so the warpgroup can issue the next loads while it runs.</li><li><strong>Synchronization cost:</strong> byte-counting transaction barriers let producers and consumers overlap without spin loops.</li></ul><p>Net effect: tensor cores twice as fast per SM needed operand delivery that didn't scale with thread count; Hopper moved data movement off the threads.</p>`
      }
    ]
  }
},

{
  id: "blackwell",
  region: "proc",
  title: "NVIDIA Blackwell GPU (B200)",
  sections: [
    { id: "dies", label: "Two Dies, One GPU" },
    { id: "sm", label: "SM Changes: TMEM and 2-SM MMA" },
    { id: "formats", label: "FP4, FP6, and Microscaling" },
    { id: "mem", label: "Memory and L2" },
    { id: "scale", label: "NVLink 5 and Rack-Scale Systems" },
    { id: "ultra", label: "Blackwell Ultra" },
    { id: "impl", label: "Performance Implications" }
  ],
  body: `
<h3 id="sec-dies">Two Dies, One GPU</h3>
<p>Blackwell's data-center GPU (2024) is two reticle-limited dies on TSMC 4NP, 104 billion transistors each (208 billion total), joined by NV-HBI, a 10 TB/s die-to-die interface. The dies present one CUDA device with one coherent L2, so software doesn't see the split. Each die has 80 SMs in 4 GPCs; B200 enables 148 of the 160. It is the chiplet idea from <a href="#/zen5-soc">AMD Zen 5 Chiplets and SoCs</a> pushed to its limit: instead of a small die per core cluster, two maximal dies joined by a link fast enough to hide the seam.</p>
${procSvg(760, 330, 620, "B200: two GPU dies side by side, each with four GPCs of SMs, half of the L2 and four HBM3E stacks, joined by the 10 TB/s NV-HBI die-to-die interface; NVLink 5 and NVLink-C2C connect to other GPUs and to Grace.",
  procFrame(20, 26, 330, 236, "Die 0 (4NP, 104 B transistors)") +
  procFrame(410, 26, 330, 236, "Die 1") +
  [20, 410].map(x =>
    procBox(x + 12, 50, 306, 58, "4 GPCs · 80 SMs", "74 enabled on B200", "ex") +
    procBox(x + 12, 120, 306, 52, "L2 half", "about 63 MB of the 126 MB total", "mem") +
    [0, 1, 2, 3].map(i => procBox(x + 12 + i * 78, 190, 72, 56, "HBM3E", "24 GB", "fe")).join("") +
    procLine(x + 165, 108, x + 165, 120) + procLine(x + 165, 172, x + 165, 190)
  ).join("") +
  procBox(355, 110, 50, 70, "NV-HBI", "10 TB/s", "fe") +
  procArrow(330, 140, 355, 140) + procArrow(355, 150, 330, 150) + procArrow(405, 140, 430, 140) + procArrow(430, 150, 405, 150) +
  procText(380, 18, "one CUDA device · coherent L2 · 192 GB HBM3E, 8 TB/s") +
  procText(380, 290, "NVLink 5: 18 links × 100 GB/s = 1.8 TB/s per GPU") +
  procText(380, 306, "GB200: NVLink-C2C to a Grace CPU · PCIe for host I/O")
)}

<h3 id="sec-sm">SM Changes: TMEM and 2-SM MMA</h3>
<p>Each SM keeps Hopper's shape (four sub-partitions, 128 CUDA cores, 256 KB of combined L1 and shared memory with up to 228 KB shared) and adds two things around the fifth-generation tensor cores:</p>
${procSvg(760, 246, 620, "A Blackwell SM: four sub-partitions, each with a scheduler and 64 KB register file, a fifth-generation tensor core, and a 64 KB slice of Tensor Memory; below, 256 KB of L1 and shared memory with the TMA, and a note that two SMs in a CTA pair can execute one MMA together.",
  [0, 1, 2, 3].map(i => {
    const x = 20 + i * 185;
    return `<rect x="${x}" y="8" width="165" height="118" rx="3" style="fill:none;stroke:var(--rule);stroke-width:1.2"/>` +
      procBox(x + 8, 14, 149, 26, "Scheduler + 64 KB RF", "", "mem") +
      procBox(x + 8, 46, 149, 34, "Tensor core, 5th gen", "", "ex") +
      procBox(x + 8, 86, 149, 34, "TMEM slice: 64 KB", "", "fe");
  }).join("") +
  procBox(20, 136, 720, 40, "L1 / shared memory: 256 KB (up to 228 KB shared) · TMA", "", "mem") +
  procBox(20, 186, 720, 50, "CTA pair (2-SM MMA)", "one tcgen05.mma spans two SMs; each SM loads half of the B tile into its own shared memory", "fe")
)}
<ul>
<li><strong>Tensor Memory (TMEM):</strong> 256 KB per SM, organized as 128 lanes × 512 columns of 32-bit cells, allocated explicitly by the kernel. MMA accumulators live in TMEM instead of the register file. On Hopper, a 128 × 256 FP32 accumulator tile filled half a warpgroup's register budget; moving it out frees registers and lets tiles grow.</li>
<li><strong>Single-thread, asynchronous MMA:</strong> the <code>tcgen05.mma</code> instructions are issued by one thread (not a whole warpgroup), read A from TMEM or shared memory and B from shared memory, and accumulate into TMEM. MMA becomes a command to a coprocessor, the way TMA made copies one.</li>
<li><strong>CTA pairs:</strong> two SMs in a cluster can execute one MMA together (<code>cta_group::2</code>), each holding half of the B operand, which halves per-SM shared-memory traffic and capacity for B and allows tiles of M = 256.</li>
</ul>

<h3 id="sec-formats">FP4, FP6, and Microscaling</h3>
<p>The fifth-generation tensor cores add 4- and 6-bit floating point. Narrow formats only work with fine-grained scaling, because 4 bits (E2M1) represent just a handful of magnitudes:</p>
<ul>
<li><strong>MXFP8 / MXFP6 / MXFP4</strong> (OCP microscaling): each block of 32 values shares an 8-bit power-of-two scale (E8M0).</li>
<li><strong>NVFP4:</strong> blocks of 16 values share an FP8 (E4M3) scale, plus one FP32 scale per tensor. The smaller block and non-power-of-two scale track the data's range more closely than MXFP4.</li>
</ul>
<p>The hardware applies the block scales inside the MMA, so scaled formats cost no extra instructions. NVIDIA quotes 5 PFLOPS dense FP8 and 10 PFLOPS dense FP4 per GPU for GB200, against Hopper's 2 PFLOPS dense FP8. See <a href="#/fp-ml-formats/fp8">narrow floating-point formats</a>.</p>

<h3 id="sec-mem">Memory and L2</h3>
<p>B200 has 192 GB of HBM3E in 8 stacks (four per die) at 8 TB/s. The L2 is 126 MB. Chips and Cheese found it behaves as two partitions corresponding to the dies, with latency rising sharply when an access is served from the other die's half; reaching most of the capacity without cross-partition penalties took many threads. So the "one GPU" abstraction is coherent but not uniform, like a 2-socket CPU with a very fast link.</p>

<h3 id="sec-scale">NVLink 5 and Rack-Scale Systems</h3>
<p>NVLink 5 doubles per-GPU bandwidth to 1.8 TB/s (18 links × 100 GB/s). The GB200 NVL72 rack puts 72 Blackwell GPUs and 36 Grace CPUs in one NVLink domain through NVLink switch trays, so any GPU can load and store to any other at full NVLink bandwidth. NVIDIA states the fabric scales to 576 GPUs. For large-model inference and training, that rack behaves like one big GPU for tensor- and expert-parallel communication, which across InfiniBand would be an order of magnitude slower.</p>

<h3 id="sec-ultra">Blackwell Ultra</h3>
<p>Blackwell Ultra (B300, 2025) keeps the two-die design with all 160 SMs, raises dense NVFP4 to 15 PFLOPS by trading away FP64 and INT8 tensor throughput, uses 12-high stacks for 288 GB of HBM3E (bandwidth stays at 8 TB/s), doubles the SFU exponential rate for attention softmax (10.7 versus 5 tera-exponentials per second), and moves host I/O to PCIe 6.0. Power rises to as much as 1,400 W per GPU.</p>

<h3 id="sec-impl">Performance Implications</h3>
<ul>
<li><strong>The ridge point keeps climbing.</strong> 5 PFLOPS FP8 / 8 TB/s = 625 FLOPs per byte, more than double Hopper's. More of every workload is memory-bound, so data reuse and narrow formats matter more than raw FLOPs.</li>
<li><strong>Narrow weights speed up decode directly.</strong> Batch-1 decode reads every weight once per token, so time per token ≈ weight bytes / bandwidth: FP4 weights roughly halve it versus FP8.</li>
<li><strong>TMEM changes kernel design.</strong> With accumulators out of registers, kernels use one or a few threads to drive MMAs and spend registers on epilogues and softmax; Hopper kernels need rewriting (CUTLASS 3.8+ and cuDNN do this) to get Blackwell's rate.</li>
<li><strong>Die locality is a second-order effect</strong> for bandwidth-bound kernels but visible in latency-bound ones: keep a block's working set in its die's L2 half when you can.</li>
</ul>
<p class="refs">References: NVIDIA, <a href="https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/">"Inside NVIDIA Blackwell Ultra"</a> (developer blog, 2025) · NVIDIA, <em>Blackwell Architecture Technical Brief</em> (2024) · NVIDIA, <a href="https://docs.nvidia.com/cuda/blackwell-tuning-guide/"><em>Blackwell Tuning Guide</em></a> · Chips and Cheese, <a href="https://chipsandcheese.com/p/nvidias-b200-keeping-the-cuda-juggernaut">"Nvidia's B200: Keeping the CUDA Juggernaut Rolling"</a> · Colfax Research, <a href="https://research.colfax-intl.com/cutlass-tutorial-writing-gemm-kernels-using-tensor-memory-for-nvidia-blackwell-gpus/">"Writing GEMM Kernels Using Tensor Memory for NVIDIA Blackwell GPUs"</a> · OCP, <em>Microscaling Formats (MX) Specification</em> v1.0 (2023)</p>`,
  practice: {
    guided: [
      {
        q: `<p>An H200 has 141 GB of HBM3E at 4.8 TB/s. Estimate the batch-1 decode ceiling in tokens per second for a 70-billion-parameter model with FP8 weights, and say why FP16 weights are impractical on one H200.</p>`,
        a: `<ol><li>FP8 weights: 70 × 10<sup>9</sup> × 1 B = 70 GB, read once per token.</li><li>Ceiling: 4.8 × 10<sup>12</sup> / 70 × 10<sup>9</sup> ≈ <strong>69 tokens per second</strong> (ignoring KV-cache reads, which lower it).</li><li>FP16 weights are 140 GB: they nearly fill the 141 GB, leaving no room for the KV cache or activations, so the model needs two GPUs (and would run at about half the per-GPU token rate anyway).</li></ol>`
      },
      {
        q: `<p>AMD's MI300X has 8 compute dies (XCDs) with 38 active CUs each, a private 4 MB L2 per XCD, a 256 MB Infinity Cache shared by all, and 5.3 TB/s of HBM3. A kernel repeatedly reads a 10 MB lookup table from all CUs. Where does the table live in the hierarchy, and how much L2 capacity does it effectively use?</p>`,
        a: `<ol><li>Each XCD's L2 caches only that XCD's accesses, so the table competes for space in all 8 L2s separately; 10 MB doesn't fit in any 4 MB L2.</li><li>Effective: each XCD keeps at most part of the table, and the same lines are duplicated across XCDs, so total L2 holds at most 4 MB of distinct table data per XCD, the same 4 MB eight times over.</li><li>Most reads therefore hit the 256 MB Infinity Cache, which holds one copy for everyone. Shrinking the table below 4 MB (compression, a narrower type) would move hits into L2.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Compute the storage cost per element, including scales, of NVFP4 and MXFP4, and the weight size of a 405-billion-parameter model in each. Why might NVFP4 give better accuracy despite the extra bits?</p>`,
        a: `<ul><li>NVFP4: 16 values × 4 bits + one 8-bit scale = 72 bits per 16 values = <strong>4.5 bits per value</strong> (the per-tensor FP32 scale is negligible). 405 × 10<sup>9</sup> × 4.5 / 8 ≈ <strong>228 GB</strong>.</li><li>MXFP4: 32 × 4 + 8 = 136 bits per 32 values = <strong>4.25 bits per value</strong>, ≈ <strong>215 GB</strong>.</li></ul><p>Accuracy: a block's scale must accommodate its largest element, so all other elements lose resolution. Smaller blocks (16 versus 32) contain fewer outliers each. And an E4M3 scale can take non-power-of-two values, so the block maximum maps close to FP4's top value instead of wasting up to half the range, as a power-of-two E8M0 scale can.</p>`
      },
      {
        q: `<p>A two-die GPU is presented to software as one device. What would go wrong if the die-to-die link had only the bandwidth of one die's local HBM? For reference, B200 links its two dies at 10 TB/s and has 8 TB/s of total HBM.</p>`,
        a: `<p>With addresses interleaved across both dies' memory, about half of every SM's DRAM traffic is homed on the other die. If each die can draw B from local HBM and the link also carries B, a fully loaded GPU where each die wants its share of the total 2B would push about half of each die's traffic across the link, in each direction, plus L2 coherence traffic and L2 hits served from the far half (which run at L2 bandwidth, several times HBM's). The link would saturate before HBM did, so the "one device" would deliver less than two independent GPUs. Fixes would be NUMA-style placement exposed to software, or making the link several times the HBM bandwidth, which is what B200's 10 TB/s link against 8 TB/s of total HBM does, with L2 locality heuristics on top.</p>`
      }
    ]
  }
},

{
  id: "gpu-kernels",
  region: "proc",
  title: "GPU Kernels and Tensor Cores",
  sections: [{ id: "kernels", label: "What a Kernel Is" }, { id: "memory", label: "Where the Data Lives" }, { id: "gemm", label: "How a GEMM Kernel Works" }, { id: "epilogue", label: "Epilogues and Fusion" }, { id: "tensor-cores", label: "Tensor Cores" }, { id: "stack", label: "Who Writes These Kernels" }],
  body: `
<p>The hardware views across these notes keep saying that some piece of work is done “by a kernel” or “on Tensor Cores.” This page covers both: what a GPU kernel is, how a matrix-multiply kernel is organized, what an epilogue is, and what Tensor Cores actually compute. For GPU basics (SMs, warps, HBM) and the roofline model, see <a href="#/gen-gpus">GPUs for generative AI</a>.</p>

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
<p>A matrix multiply (GEMM) of an \\(M \\times K\\) matrix by a \\(K \\times N\\) matrix is the kernel everything else is built around. A naive kernel gives each thread one element of \\(C\\) and loops over \\(K\\), reading \\(A\\) and \\(B\\) from HBM every time: about 2 FLOPs per 4 bytes in FP16, far below the ridge. Real GEMM kernels use <strong>tiling</strong>:</p>
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
},

{
  id: "proc-compare",
  region: "proc",
  title: "Comparing the Four Designs",
  sections: [
    { id: "table", label: "Side by Side" },
    { id: "balance", label: "Machine Balance" },
    { id: "latency", label: "Latency Ladders" },
    { id: "parallel", label: "How Much Parallelism Each Needs" },
    { id: "package", label: "Packaging Choices" },
    { id: "model", label: "Parameters for a Model" }
  ],
  body: `
<h3 id="sec-table">Side by Side</h3>
<div class="tbl"><table>
<tr><th></th><th>Zen 5 core</th><th>Neoverse V2 core</th><th>H100 SM</th><th>B200 SM</th></tr>
<tr><td>Front end</td><td>2 × 4-wide decode, 6K-instr op cache, 2 taken branches/cycle</td><td>6-wide decode, small mop cache, 2 branches/cycle</td><td>4 warp schedulers, 1 warp-instr/cycle each</td><td>Same, plus single-thread MMA issue</td></tr>
<tr><td>Window / threads</td><td>448 ops, 2 threads</td><td>320+ ops, 1 thread</td><td>64 warps</td><td>64 warps</td></tr>
<tr><td>Vector / matrix per cycle</td><td>32 FP64 FLOPs</td><td>16 FP64 FLOPs</td><td>4 tensor cores</td><td>4 tensor cores, 2× FP8 rate</td></tr>
<tr><td>Private storage</td><td>48 KB L1D, 1 MB L2</td><td>64 KB L1D, 1–2 MB L2</td><td>256 KB RF, 256 KB L1/shared</td><td>256 KB RF, 256 KB TMEM, 256 KB L1/shared</td></tr>
<tr><td>Shared cache</td><td>32 MB L3 per 8 cores</td><td>114 MB L3 (Grace)</td><td>50 MB L2</td><td>126 MB L2</td></tr>
</table></div>

<h3 id="sec-balance">Machine Balance</h3>
<p>Peak compute divided by peak memory bandwidth gives the arithmetic intensity at which a chip stops being memory-bound (the roofline ridge; see <a href="#/perf-analytical/roofline">Roofline</a>).</p>
<div class="tbl"><table>
<tr><th>Chip</th><th>Peak compute</th><th>Memory bandwidth</th><th>FLOPs per byte</th></tr>
<tr><td>Ryzen 9 9950X (16 Zen 5, all-core ~5.0 GHz, DDR5-5600 × 2)</td><td>16 × 32 × 5.0 GHz ≈ 2.56 TFLOPS FP64</td><td>89.6 GB/s</td><td>≈ 29</td></tr>
<tr><td>EPYC 9755 (128 Zen 5, 2.7 GHz base, 12 × DDR5-6000)</td><td>128 × 32 × 2.7 GHz ≈ 11.1 TFLOPS FP64</td><td>576 GB/s</td><td>≈ 19</td></tr>
<tr><td>Grace C1 (72 V2, 3.1 GHz)</td><td>72 × 16 × 3.1 GHz ≈ 3.57 TFLOPS FP64</td><td>≈ 500 GB/s</td><td>≈ 7</td></tr>
<tr><td>H100 SXM</td><td>989 TFLOPS dense FP16 tensor</td><td>3.35 TB/s</td><td>≈ 295</td></tr>
<tr><td>B200 (GB200 figures)</td><td>5 PFLOPS dense FP8 tensor</td><td>8 TB/s</td><td>≈ 625</td></tr>
</table></div>
<p>CPUs sit between about 7 and 30 FLOPs per byte; GPUs, counting their matrix engines, at hundreds. That gap is why the same algorithm (say, attention during decode) is compute-bound on a CPU core and memory-bound on a GPU.</p>

<h3 id="sec-latency">Latency Ladders</h3>
<div class="tbl"><table>
<tr><th>Level</th><th>Zen 5</th><th>Grace (V2)</th><th>H100</th></tr>
<tr><td>L1D</td><td>4 cycles (int), 7 (FP)</td><td>About 4 cycles</td><td>Tens of cycles (shared memory and L1)</td></tr>
<tr><td>L2</td><td>≥14 cycles, private</td><td>10 cycles, private</td><td>Hundreds of cycles, shared, two partitions</td></tr>
<tr><td>L3 / LLC</td><td>46–55 cycles, per CCX</td><td>&gt;125 cycles (&gt;38 ns), mesh</td><td>(L2 is the LLC)</td></tr>
<tr><td>DRAM</td><td>DDR5 via IOD</td><td>&gt;200 ns LPDDR5X</td><td>About 300 ns HBM3</td></tr>
</table></div>
<p>The CPUs spend area making each level fast because one thread waits on it; the GPU accepts long latency at every level and pays for it with threads and asynchronous copies.</p>

<h3 id="sec-parallel">How Much Parallelism Each Needs</h3>
<p>Little's law (bytes in flight = bandwidth × latency) sets how much concurrency each design must expose:</p>
<ul>
<li><strong>Zen 5 core:</strong> 124 outstanding misses × 64 B ≈ 7.9 KB in flight, generated by one or two threads through the out-of-order window and prefetchers.</li>
<li><strong>Grace core:</strong> one core measured at 21 GB/s with 200 ns latency has about 4.2 KB in flight; filling 500 GB/s takes more than 20 such cores.</li>
<li><strong>H100:</strong> 3.35 TB/s × 300 ns ≈ 1 MB in flight across 132 SMs, which is why occupancy and TMA matter.</li>
</ul>

<h3 id="sec-package">Packaging Choices</h3>
<ul>
<li><strong>AMD:</strong> many small dies. Good yield, reuse of one CCD across desktop and server, older node for I/O. Cost: non-uniform latency (two-tier core-to-core, per-CCX L3) and per-CCD bandwidth caps.</li>
<li><strong>Grace:</strong> one large monolithic die, uniform mesh, memory on package; two dies per board as a 2-socket system.</li>
<li><strong>Hopper:</strong> one maximal die plus HBM on an interposer.</li>
<li><strong>Blackwell:</strong> two maximal dies with a link fast enough to present one device, plus HBM. The reticle limit forced the split; the 10 TB/s link hides most of it.</li>
</ul>
<p>Read with <a href="#/icx-chiplets">Chiplets and UCIe</a> and <a href="#/icx-memory/hbm">HBM</a>.</p>

<h3 id="sec-model">Parameters for a Model</h3>
<p>Starting points for configuring a cycle-level model of the two CPU cores (structure sizes from vendor documents; check against your target's revision):</p>
<div class="tbl"><table>
<tr><th>Parameter</th><th>Zen 5</th><th>Neoverse V2</th></tr>
<tr><td>Decode / rename / retire width</td><td>4 per pipe (2 pipes) / 8 / 8</td><td>6 / 8 / 8</td></tr>
<tr><td>ROB</td><td>448 (224 per thread)</td><td>320+</td></tr>
<tr><td>Integer / FP PRF</td><td>240 / 384 × 512 b</td><td>Not published</td></tr>
<tr><td>Load / store queue</td><td>64 uncompleted loads / 104 stores</td><td>Not published / 80 stores</td></tr>
<tr><td>Integer ALUs / AGUs / branch</td><td>6 / 4 / 3</td><td>6 / 3 LS pipes / 2</td></tr>
<tr><td>FP pipes</td><td>4 × 512 b (2 FMA, 2 FADD)</td><td>4 × 128 b (all FMA)</td></tr>
<tr><td>L1I / L1D</td><td>32 KB 8-way / 48 KB 12-way, 4-cycle</td><td>64 KB 4-way / 64 KB 4-way</td></tr>
<tr><td>L2</td><td>1 MB 16-way, ≥14 cycles</td><td>1–2 MB 8-way, 10 cycles</td></tr>
<tr><td>Outstanding L1D misses</td><td>124</td><td>Not published (96-entry L2 TQ)</td></tr>
<tr><td>Mispredict penalty</td><td>12–18 cycles (AMD), 15–25 (Agner)</td><td>Short; not published</td></tr>
</table></div>
<p class="refs">References: the sources listed on each page of this section · Williams, Waterman, and Patterson, "Roofline: An Insightful Visual Performance Model for Multicore Architectures," CACM 2009 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapters 2, 4, and 5</p>`,
  practice: {
    guided: [
      {
        q: `<p>An Intel Xeon 6980P (Granite Rapids) has 128 cores at a 2.0 GHz base clock, two 512-bit FMA units per core, and 12 memory channels. Compute its FP64 machine balance with DDR5-6400 and with MRDIMM-8800.</p>`,
        a: `<ol><li>FLOPs per cycle per core: 2 × 8 FP64 lanes × 2 = 32.</li><li>Peak: 128 × 32 × 2.0 × 10<sup>9</sup> ≈ 8.19 TFLOPS.</li><li>DDR5-6400: 12 × 8 B × 6400 × 10<sup>6</sup> = 614.4 GB/s, balance ≈ 8,192 / 614.4 ≈ <strong>13.3 FLOPs per byte</strong>.</li><li>MRDIMM-8800: 12 × 8 B × 8800 × 10<sup>6</sup> = 844.8 GB/s, balance ≈ <strong>9.7</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A sparse kernel has an arithmetic intensity of 6 FP64 FLOPs per byte. Rank an EPYC 9654 (3.69 TFLOPS, 460.8 GB/s), a Graviton4 (4.30 TFLOPS, 537.6 GB/s), and an MI300X (81.7 TFLOPS FP64 vector, 5.3 TB/s, 192 GB of HBM3) by attainable throughput, and comment on what else would decide the choice.</p>`,
        a: `<p>Roofline: attainable = min(peak, intensity × bandwidth).</p><ul><li>EPYC 9654: min(3.69, 6 × 0.4608 = 2.76) = <strong>2.76 TFLOPS</strong> (memory-bound).</li><li>Graviton4: min(4.30, 6 × 0.5376 = 3.23) = <strong>3.23 TFLOPS</strong> (memory-bound).</li><li>MI300X: min(81.7, 6 × 5.3 = 31.8) = <strong>31.8 TFLOPS</strong> (memory-bound).</li></ul><p>The GPU wins by about 10× on paper, and the ratio is just the bandwidth ratio, since all three are memory-bound. But sparse kernels often don't reach the roofline: irregular gathers waste sector bandwidth on GPUs, low parallelism leaves SMs idle, and data must fit in 192 GB or be streamed over PCIe. Problem size, how well the sparsity pattern coalesces, and the cost of moving data to the GPU decide in practice.</p>`
      }
    ]
  }
}
]);
