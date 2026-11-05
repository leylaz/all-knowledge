/* Section: Performance analysis
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "perf"). */

section({
  id: "perf",
  name: "Performance Analysis",
  cap: "Methodology, workloads, benchmarks, models, validation, power",
  sections: [
    { id: "ironlaw", label: "The Iron Law" },
    { id: "amdahl", label: "Amdahl's Law" },
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>Performance work is mostly measurement: choosing workloads, measuring the right things, finding the bottleneck, and summarizing results honestly. The same analysis applies to performance models, RTL, emulation, and real silicon. This region covers the methodology: what to run, how to simulate and summarize, how to model performance on paper, how to check a model against hardware, and how to model power. Finding where the cycles go, from statistics and stall causes to bounding each stage, is in <a href="#/r/stall">Stalls and Bottlenecks</a>.</p>
<h3 id="sec-ironlaw">The Iron Law</h3>
<p>Time = instructions × CPI × cycle time. A change helps only if it improves the product; a better CPI with a lower clock or more instructions can be a loss (see <a href="#/pipelining">Pipelining and the iron law</a>).</p>
<h3 id="sec-amdahl">Amdahl's Law</h3>
<p>Speedup = 1 / ((1 − p) + p / n), where p is the fraction of the work that benefits from an improvement and n is how much faster that part gets (for parallel code, the thread count). The part that doesn't improve dominates quickly. <a href="#/r/conc">Concurrency in C</a> covers what keeps real threads below this bound.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/workloads">Types of workloads</a> and <a href="#/spec-cpu">SPEC CPU benchmarks</a>: what to run, and what each workload stresses.</li>
<li><a href="#/ipc-spec">IPC and simulation methodology</a>: CPI stacks, summarizing results, simulation hygiene, and model correlation.</li>
<li><a href="#/perf-analytical">Analytical performance models</a>: first-order CPI stacks, interval analysis, and the roofline, worked on paper.</li>
<li><a href="#/perf-roofline">The roofline model for CPUs</a>: building the roofs, ceilings, a roof per cache level, and measuring a kernel's point.</li>
<li><a href="#/perf-validation">Validating a performance model</a>: kinds of error, microbenchmarks, error metrics, and a correlation process.</li>
<li><a href="#/perf-power">Power and energy modeling</a>: where power goes, event-based energy models, and voltage and frequency.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Design A runs 1.2 billion instructions at CPI 0.8 and 3.0 GHz. Design B runs 1.0 billion at CPI 1.0 and 3.2 GHz. Which is faster?</p>`,
        a: `<ol><li>A: 1.2e9 × 0.8 / 3.0e9 = 0.32 s.</li><li>B: 1.0e9 × 1.0 / 3.2e9 ≈ 0.3125 s.</li><li><strong>B is faster</strong> despite its worse CPI.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can IPC be misleading when comparing two chips?</p>`,
        a: `<p>Different ISAs, compilers, or flags produce different instruction counts for the same work, and micro-op cracking changes what counts as an instruction. Spin loops can inflate IPC while doing no useful work. Compare execution time (or IPC only on identical binaries), and pair IPC with frequency and power.</p>`
      }
    ]
  }
}, [
{
  id: "workloads",
  region: "perf",
  title: "Types of Workloads",
  sections: [
    { id: "bottleneck", label: "By Bottleneck" },
    { id: "domain", label: "By Domain" },
    { id: "top-down-analysis", label: "Top-Down Analysis" }
  ],
  body: `
<p>Workloads differ in which part of the machine limits them. Name the bottleneck first, then pick the feature to study.</p>
<h3 id="sec-bottleneck">By Bottleneck</h3>
<ul>
<li><strong>Compute-bound:</strong> high IPC, limited by execution width and ports (namd, exchange2).</li>
<li><strong>Memory latency-bound:</strong> dependent misses, low MLP (mcf, linked data structures).</li>
<li><strong>Memory bandwidth-bound:</strong> streaming arrays, limited by DRAM bandwidth (lbm, STREAM).</li>
<li><strong>Frontend-bound:</strong> large code footprints, i-cache and BTB misses (servers, browsers, interpreters).</li>
<li><strong>Branch-bound:</strong> data-dependent, hard-to-predict branches (game search, compression).</li>
<li><strong>Synchronization-bound:</strong> locks, barriers, and sharing limit multithreaded scaling.</li>
</ul>
<h3 id="sec-domain">By Domain</h3>
<ul>
<li><strong>Client:</strong> browsers, JavaScript, app launch, UI; latency and energy matter.</li>
<li><strong>Server and cloud:</strong> databases, web services, JVMs; throughput and tail latency.</li>
<li><strong>HPC:</strong> dense numerical kernels; floating point and bandwidth.</li>
<li><strong>ML:</strong> matrix multiplies are compute-bound; inference with large models is often bandwidth-bound.</li>
<li><strong>Media and games:</strong> SIMD-heavy, real-time deadlines.</li>
</ul>
<h3 id="sec-top-down-analysis">Top-Down Analysis</h3>
<p>Intel's top-down method splits pipeline slots into retiring, front-end bound, bad speculation, and back-end bound (memory or core), then drills into the largest category. See <a href="#/perf-bottlenecks">Bottleneck types</a> for the full method and how to tell the bottlenecks apart.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A top-down breakdown: retiring 30%, frontend-bound 35%, bad speculation 10%, backend-bound 25%. What kind of workload is this, and what do you check next?</p>`,
        a: `<ol><li>Frontend-bound dominates: the core is starved of instructions.</li><li>Likely a large code footprint (server, browser, interpreter, JIT).</li><li>Check L1I and L2 instruction MPKI, iTLB misses, BTB misses, and decode or micro-op cache behavior.</li><li>Features to evaluate: bigger BTB, instruction prefetching (fetch-directed prefetching with a decoupled frontend), bigger L1I or micro-op cache.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>How would you build a workload set to evaluate a phone CPU versus a server CPU?</p>`,
        a: `<p>Phone: short bursty interactive work (browser benchmarks, app launches, UI rendering, JavaScript), with single-thread latency and energy as primary metrics, plus some media and light ML. Server: databases, web serving, key-value stores, JVM and microservices with huge code footprints and many threads, measured by throughput at a latency target and performance per watt. Both should include SPEC as a common baseline, but neither should rely on it alone.</p>`
      }
    ]
  }
},

{
  id: "spec-cpu",
  region: "perf",
  title: "SPEC CPU Benchmarks",
  sections: [
    { id: "four-suites", label: "Four Suites" },
    { id: "scoring", label: "Scoring" },
    { id: "specspeed-specrate", label: "SPECspeed vs. SPECrate" },
    { id: "input-sets", label: "Input Sets: Test, Train, and Ref" },
    { id: "other-inputs", label: "Other Inputs" },
    { id: "int-benchmarks", label: "Integer Benchmarks and Their Character" },
    { id: "floating-point-highlights", label: "Floating-Point Highlights" },
    { id: "lbm", label: "A Closer Look at 519.lbm" },
    { id: "limits", label: "Limits" }
  ],
  body: `
<p>SPEC CPU 2017 is the standard suite for comparing CPU performance and the usual workload set in microarchitecture papers and simulator studies. (A successor suite has been in development; check SPEC's site for the current release.)</p>
<h3 id="sec-four-suites">Four Suites</h3>
<ul><li><strong>SPECrate Integer / Floating Point:</strong> throughput, many copies run at once. Benchmarks end in <code>_r</code>.</li><li><strong>SPECspeed Integer / Floating Point:</strong> time for one task, optionally multithreaded. Benchmarks end in <code>_s</code>.</li></ul>
<h3 id="sec-scoring">Scoring</h3>
<p>Each benchmark's score is the reference machine's time divided by your time; the suite score is the geometric mean. "Base" uses consistent compiler flags across benchmarks; "peak" allows per-benchmark tuning.</p>
<h3 id="sec-specspeed-specrate">SPECspeed vs. SPECrate</h3>
<p>SPECspeed is a latency metric: how long does one task take? SPECrate is a throughput metric: how much work gets done when many independent tasks run at once? (Hennessy &amp; Patterson, ch. 1, makes the same split between execution time and throughput.)</p>
<div class="tbl"><table>
<tr><th></th><th>SPECspeed</th><th>SPECrate</th></tr>
<tr><td>Copies</td><td>Always one copy of each benchmark</td><td>N concurrent copies; the tester picks N (usually one per hardware thread), and N = 1 is allowed</td></tr>
<tr><td>Parallelism inside a copy</td><td>OpenMP and compiler auto-parallelization allowed, so one copy may use many threads</td><td>Forbidden; each copy is a separate single-threaded process with its own data</td></tr>
<tr><td>Binaries</td><td><code>_s</code> versions, e.g. 600.perlbench_s; 64-bit, larger workloads</td><td><code>_r</code> versions, e.g. 500.perlbench_r; smaller workloads</td></tr>
<tr><td>Memory needed</td><td>16 GB minimum</td><td>About 1–2 GB per copy</td></tr>
<tr><td>Per-benchmark score</td><td>T<sub>ref</sub> / T<sub>yours</sub></td><td>N × T<sub>ref</sub> / T<sub>yours</sub>(N), where T(N) runs from the first copy starting to the last one finishing</td></tr>
<tr><td>What it rewards</td><td>Single-thread latency: frequency, IPC, branch prediction, cache latency; plus thread scaling on the OpenMP benchmarks</td><td>Scaling across cores: shared LLC capacity, interconnect, DRAM bandwidth, and all-core (not single-core) clock speed</td></tr>
</table></div>
<p>So the two suites aren’t the same programs run two ways. SPEC builds separate versions with different workload sizes, compile flags, and run rules. Both report the geometric mean of per-benchmark ratios against a reference machine, not literal jobs per minute.</p>
<p><strong>Example (illustrative, not real scores).</strong> Two 8-core CPUs. Alone, a job takes 10 s on A and 8 s on B, so B is 25% faster on SPECspeed. With 8 copies, contention slows A’s jobs to 20 s each (0.40 jobs/s) but B’s only to 12.5 s (0.64 jobs/s), so B is 60% faster on throughput. The rate gap is bigger than the speed gap because B handles shared-resource contention better. The reverse can happen too: a chip with a high single-core boost clock and little memory bandwidth can win SPECspeed and lose SPECrate.</p>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/" target="_blank" rel="noopener">SPEC CPU 2017 documentation index</a>, <a href="https://www.spec.org/cpu2017/Docs/system-requirements.html" target="_blank" rel="noopener">system requirements</a>.</p>
<h3 id="sec-input-sets">Input Sets: Test, Train, and Ref</h3>
<p>Every benchmark ships with several workloads (input files plus the expected outputs), selected with <code>runcpu --size</code>. Only ref produces a score.</p>
<div class="tbl"><table>
<tr><th>Input</th><th>Purpose</th><th>Timed?</th><th>In a simulator</th></tr>
<tr><td><code>test</code></td><td>Tiny; checks that the binary builds, runs, and produces correct output</td><td>No</td><td>Smoke test that your model can run the program end to end. Too small for results: data often fits in cache and startup code dominates.</td></tr>
<tr><td><code>train</code></td><td>Medium; the profiling input for feedback-directed optimization (PGO) in peak builds</td><td>No</td><td>A cheaper stand-in only if you’ve checked it behaves like ref. Some benchmarks match closely; others don’t.</td></tr>
<tr><td><code>refrate</code> (5xx <code>_r</code>) / <code>refspeed</code> (6xx <code>_s</code>)</td><td>Full-size workloads</td><td>Yes</td><td>What you should pick SimPoints from and report.</td></tr>
</table></div>
<p>A reportable run also runs test and train first, to verify the binaries, then times ref several times. Some ref workloads are several inputs run back to back; perlbench, for example, runs more than one Perl script, and the benchmark’s time covers all of them.</p>
<p><strong>Why train and ref are separate:</strong> with PGO, the compiler tunes code layout, inlining, and branch hints to the profiled input. Training on train and scoring on ref keeps a compiler from being tuned to the exact input it’s scored on.</p>
<h3 id="sec-other-inputs">Other Inputs</h3>
<ul><li><strong>Alberta Workloads:</strong> extra inputs from the University of Alberta for many CPU 2017 benchmarks, some with scripts that generate unlimited new inputs. They’re for research such as PGO and studying how sensitive a program is to its input, not for official results or vendor comparisons.</li><li><strong>SimPoints and pinballs:</strong> not new inputs, but representative regions cut from ref runs.</li><li><strong>Your own inputs:</strong> fine for studying a design, but you can’t call the result a SPEC score, not even an estimated one.</li></ul>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/runcpu.html" target="_blank" rel="noopener">runcpu documentation</a>, <a href="https://research.spec.org/tools/overview/alberta-workloads" target="_blank" rel="noopener">Alberta Workloads</a>.</p>
<h3 id="sec-int-benchmarks">Integer Benchmarks and Their Character</h3>
<div class="tbl"><table>
<tr><th>Benchmark</th><th>What it is</th><th>What it stresses</th></tr>
<tr><td>500.perlbench</td><td>Perl interpreter</td><td>Indirect branches, frontend</td></tr>
<tr><td>502.gcc</td><td>C compiler</td><td>Large code footprint, branches</td></tr>
<tr><td>505.mcf</td><td>Network flow optimization</td><td>Pointer chasing, memory latency</td></tr>
<tr><td>520.omnetpp</td><td>Discrete event simulation</td><td>Irregular memory, cache misses</td></tr>
<tr><td>523.xalancbmk</td><td>XML transformation</td><td>Pointer-heavy, branches</td></tr>
<tr><td>525.x264</td><td>Video encoding</td><td>Compute, SIMD</td></tr>
<tr><td>531.deepsjeng</td><td>Chess search</td><td>Hard-to-predict branches</td></tr>
<tr><td>541.leela</td><td>Go (game tree search)</td><td>Hard-to-predict branches</td></tr>
<tr><td>548.exchange2</td><td>Puzzle solver</td><td>Compute-bound, small footprint</td></tr>
<tr><td>557.xz</td><td>Compression</td><td>Data-dependent branches, memory</td></tr>
</table></div>
<h3 id="sec-floating-point-highlights">Floating-Point Highlights</h3>
<ul><li><strong>Bandwidth-bound streaming:</strong> 519.lbm, 503.bwaves, 549.fotonik3d, 554.roms.</li><li><strong>Compute-heavy:</strong> 508.namd, 544.nab, 511.povray, 538.imagick.</li><li><strong>Large, mixed applications:</strong> 521.wrf, 527.cam4, 526.blender, 510.parest, 507.cactuBSSN.</li></ul>
<h3 id="sec-lbm">A Closer Look at 519.lbm</h3>
<p><strong>What it computes.</strong> 519.lbm_r (and 619.lbm_s) simulates an incompressible fluid in 3D with the lattice Boltzmann method. Thomas Pohl wrote it as the core of a larger code that models gas bubbles forming in metal foams. Instead of solving the Navier–Stokes equations directly, it tracks, for every cell of a regular grid, how much fluid is moving in each of 19 fixed directions (the D3Q19 lattice: at rest, the 6 face neighbors, and the 12 edge neighbors). Each time step does two things:</p>
<ul><li><strong>Collide:</strong> from a cell's 19 values, compute its density and velocity, then relax each value toward the equilibrium for that density and velocity.</li><li><strong>Stream:</strong> move each relaxed value one cell along its direction, into the neighbor it points at.</li></ul>
<p>Obstacle cells, read from an obstacle file, bounce values back the way they came. The refrate input runs 3000 time steps on a 100 × 100 × 130 grid with a shear-flow (moving lid) boundary. Refspeed runs 2000 steps on 200 × 200 × 260. Train uses a different geometry and no shear flow, but the same kernel.</p>
<p><strong>Data layout.</strong> The code keeps two copies of the grid, src and dst, and swaps them after every step. Each cell is 20 doubles (the 19 values plus a flag word that marks obstacle and lid cells), 160 B, stored cell by cell with x varying fastest. One grid is 1.3 M cells × 160 B ≈ 208 MB, so the pair plus padding planes is about 430 MB, far larger than any LLC. All accesses go through macros, so the layout can be changed in one place, but SPEC's run rules forbid source changes, so scored runs always use this array-of-structures layout.</p>
<h4>One Time Step in Code</h4>
<p>A simplified version of the kernel (the real one unrolls the 19 directions by hand and handles obstacle and lid cells first). It pushes: it reads one cell from src and writes into 19 neighbors in dst.</p>
<pre><code>#define NX 100
#define NY 100
#define NZ 130
#define Q  20   /* 19 values + 1 flag word per cell */
#define IDX(x, y, z, i) ((i) + Q * ((x) + NX * ((y) + NY * (z))))

/* cx, cy, cz: direction i's step in x, y, z (each -1, 0, or +1)
   w: lattice weights, OMEGA: relaxation rate */
for (int z = 0; z &lt; NZ; z++)
  for (int y = 0; y &lt; NY; y++)
    for (int x = 0; x &lt; NX; x++) {
      const double *f = &amp;src[IDX(x, y, z, 0)];   /* 160 contiguous bytes */

      double rho = 0, ux = 0, uy = 0, uz = 0;     /* density and velocity */
      for (int i = 0; i &lt; 19; i++) {
        rho += f[i];
        ux += cx[i] * f[i]; uy += cy[i] * f[i]; uz += cz[i] * f[i];
      }
      ux /= rho; uy /= rho; uz /= rho;
      double u2 = 1.5 * (ux * ux + uy * uy + uz * uz);

      for (int i = 0; i &lt; 19; i++) {            /* collide, then stream */
        double cu  = 3.0 * (cx[i] * ux + cy[i] * uy + cz[i] * uz);
        double feq = w[i] * rho * (1.0 + cu + 0.5 * cu * cu - u2);
        dst[IDX(x + cx[i], y + cy[i], z + cz[i], i)] = f[i] - OMEGA * (f[i] - feq);
      }
    }
/* swap src and dst, then repeat (3000 times for refrate) */</code></pre>
<p>Each cell update does around 200 floating-point operations against 160 B read and 152 B written, well under 1 flop per byte of DRAM traffic. On the <a href="#/perf-analytical/roofline">roofline</a> it sits far left of the ridge point of any current CPU, so memory bandwidth sets its speed.</p>
<h4>Reading src</h4>
<div class="tbl"><svg viewBox="0 0 680 222" role="img" aria-label="The src grid in memory. Four 160-byte cells, x minus 1 through x plus 2, sit back to back over ten 64-byte cache lines. Cell x, the one being updated, covers bytes 160 to 319, which is half of line 2 and all of lines 3 and 4. Line 2 was already brought in by cell x minus 1. The sweep reads addresses in ascending order, x fastest, then y, then z." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="14" style="fill:var(--ink);font-size:13px;font-weight:600">src read: cell (x, y, z) is 20 doubles, 160 B, next to its x neighbors in memory</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="20" y="32" width="160" height="40"/><rect x="340" y="32" width="160" height="40"/><rect x="500" y="32" width="160" height="40"/></g>
<rect x="180" y="32" width="160" height="40" style="fill:var(--accent-green);fill-opacity:.2;stroke:var(--accent-green);stroke-width:2"/>
<g style="font-size:11px" text-anchor="middle"><text x="100" y="50" style="fill:var(--muted)">cell x − 1</text><text x="100" y="64" style="fill:var(--muted)">(read last update)</text><text x="260" y="50" style="fill:var(--ink);font-weight:600">cell x: f[0] … f[18], flag</text><text x="260" y="64" style="fill:var(--ink)">read now</text><text x="420" y="50" style="fill:var(--muted)">cell x + 1</text><text x="420" y="64" style="fill:var(--muted)">(next update)</text><text x="580" y="50" style="fill:var(--muted)">cell x + 2</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="20" y="92" width="64" height="22"/><rect x="84" y="92" width="64" height="22"/><rect x="340" y="92" width="64" height="22"/><rect x="404" y="92" width="64" height="22"/><rect x="468" y="92" width="64" height="22"/><rect x="532" y="92" width="64" height="22"/><rect x="596" y="92" width="64" height="22"/></g>
<rect x="148" y="92" width="64" height="22" style="fill:var(--accent-green);fill-opacity:.1;stroke:var(--accent-green);stroke-width:1;stroke-dasharray:3 2"/>
<g style="fill:var(--accent-green);fill-opacity:.2;stroke:var(--accent-green);stroke-width:2"><rect x="212" y="92" width="64" height="22"/><rect x="276" y="92" width="64" height="22"/></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="52" y="107">line 0</text><text x="116" y="107">line 1</text><text x="180" y="107">line 2</text><text x="244" y="107" style="fill:var(--ink)">line 3</text><text x="308" y="107" style="fill:var(--ink)">line 4</text><text x="372" y="107">line 5</text><text x="436" y="107">line 6</text><text x="500" y="107">line 7</text><text x="564" y="107">line 8</text><text x="628" y="107">line 9</text></g>
<path d="M180,72V92M340,72V92" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:2 2"/>
<text x="0" y="132" style="fill:var(--muted);font-size:11px">64 B lines. Cell x needs 2.5 lines: line 2 is already in L1 from cell x − 1, lines 3 and 4 are new.</text>
<path d="M20,152H650" style="fill:none;stroke:var(--accent-green);stroke-width:1.5"/><polygon points="660,152 650,147 650,157" style="fill:var(--accent-green)"/>
<text x="20" y="170" style="fill:var(--ink);font-size:11px">Address order is sweep order (x fastest, then y, then z): one ascending stream for the L2 prefetcher.</text>
<text x="20" y="190" style="fill:var(--ink);font-size:11px">Each line is finished after at most 2 cell updates. Its next touch is one step later, as dst, after about 430 MB</text>
<text x="20" y="206" style="fill:var(--ink);font-size:11px">of other traffic, so no cache keeps it: every src line comes from DRAM once per step.</text>
</svg></div>
<h4>Writing dst</h4>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="Where the 19 values from source cell x, y, z land in dst. In plane z all 9 cells of the 3 by 3 neighborhood get one value each: C at the source position, N, S, E, W, NE, NW, SE, SW around it. In plane z minus 1, 1.6 MB lower, a plus shape of 5 cells gets B, NB, SB, EB, WB. In plane z plus 1, 1.6 MB higher, a plus shape gets T, NT, ST, ET, WT. The stores hit 9 rows, so the kernel runs 9 write streams." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="14" style="fill:var(--ink);font-size:13px;font-weight:600">dst write: the 19 new values go to 19 different cells (push)</text>
<g text-anchor="middle"><text x="160" y="42" style="fill:var(--ink);font-size:12px;font-weight:600">plane z − 1</text><text x="374" y="42" style="fill:var(--ink);font-size:12px;font-weight:600">plane z</text><text x="588" y="42" style="fill:var(--ink);font-size:12px;font-weight:600">plane z + 1</text><text x="160" y="58" style="fill:var(--muted);font-size:10px">1.6 MB below the source</text><text x="374" y="58" style="fill:var(--muted);font-size:10px">rows 16 KB apart</text><text x="588" y="58" style="fill:var(--muted);font-size:10px">1.6 MB above the source</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="0" y="102">y + 1</text><text x="0" y="158">y</text><text x="0" y="214">y − 1</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="76" y="70" width="56" height="56"/><rect x="188" y="70" width="56" height="56"/><rect x="76" y="182" width="56" height="56"/><rect x="188" y="182" width="56" height="56"/><rect x="504" y="70" width="56" height="56"/><rect x="616" y="70" width="56" height="56"/><rect x="504" y="182" width="56" height="56"/><rect x="616" y="182" width="56" height="56"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="132" y="70" width="56" height="56"/><rect x="76" y="126" width="56" height="56"/><rect x="132" y="126" width="56" height="56"/><rect x="188" y="126" width="56" height="56"/><rect x="132" y="182" width="56" height="56"/><rect x="290" y="70" width="56" height="56"/><rect x="346" y="70" width="56" height="56"/><rect x="402" y="70" width="56" height="56"/><rect x="290" y="126" width="56" height="56"/><rect x="346" y="126" width="56" height="56"/><rect x="402" y="126" width="56" height="56"/><rect x="290" y="182" width="56" height="56"/><rect x="346" y="182" width="56" height="56"/><rect x="402" y="182" width="56" height="56"/><rect x="560" y="70" width="56" height="56"/><rect x="504" y="126" width="56" height="56"/><rect x="560" y="126" width="56" height="56"/><rect x="616" y="126" width="56" height="56"/><rect x="560" y="182" width="56" height="56"/></g>
<rect x="349" y="129" width="50" height="50" style="fill:none;stroke:var(--accent-green);stroke-width:2.5"/>
<g style="fill:var(--trace);font-size:12px;font-weight:600" text-anchor="middle"><text x="160" y="102">NB</text><text x="104" y="158">WB</text><text x="160" y="158">B</text><text x="216" y="158">EB</text><text x="160" y="214">SB</text><text x="318" y="102">NW</text><text x="374" y="102">N</text><text x="430" y="102">NE</text><text x="318" y="158">W</text><text x="374" y="158">C</text><text x="430" y="158">E</text><text x="318" y="214">SW</text><text x="374" y="214">S</text><text x="430" y="214">SE</text><text x="588" y="102">NT</text><text x="532" y="158">WT</text><text x="588" y="158">T</text><text x="644" y="158">ET</text><text x="588" y="214">ST</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="104" y="252">x − 1</text><text x="160" y="252">x</text><text x="216" y="252">x + 1</text><text x="318" y="252">x − 1</text><text x="374" y="252">x</text><text x="430" y="252">x + 1</text><text x="532" y="252">x − 1</text><text x="588" y="252">x</text><text x="644" y="252">x + 1</text></g>
<text x="0" y="280" style="fill:var(--ink);font-size:11px">The stores land in 9 rows, 3 per plane: 9 write streams, each moving 160 B per update.</text>
<text x="0" y="296" style="fill:var(--ink);font-size:11px">Each store is one 8 B double, so a dst line is filled piece by piece, by updates up to 2 planes apart.</text>
<g style="fill:var(--muted);font-size:11px"><rect x="0" y="310" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="320">receives one of the 19 values</text><rect x="210" y="310" width="16" height="12" rx="2" style="fill:none;stroke:var(--accent-green);stroke-width:2"/><text x="232" y="320">the source cell's position (x, y, z)</text></g>
</svg></div>
<h4>Reading dst: The Hidden Read</h4>
<p>The kernel never loads from dst, but with ordinary write-allocate stores the hardware does. The first store to a dst line misses and issues a <a href="#/cache-write/wa">read for ownership</a> (RFO), which fetches the old 64 B from DRAM only so the stores can merge into it. The old contents are stale (they are two steps old) and every byte the program cares about gets overwritten.</p>
<div class="tbl"><svg viewBox="0 0 680 300" role="img" aria-label="Timeline of one dst line in plane Z. While the sweep is in plane Z minus 1, the first store misses and a read for ownership brings 64 bytes from DRAM, then the T family of 5 values is stored. While the sweep is in plane Z, 9 in-plane values are stored. While it is in plane Z plus 1, the B family of 5 values is stored. Later the dirty line is evicted and written back. Below, DRAM bytes per cell update: 480 with ordinary stores, 160 for the src read, 160 for the RFO and 160 for the writeback, versus 320 with non-temporal stores." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="14" style="fill:var(--ink);font-size:13px;font-weight:600">Life of one dst line in plane Z, with ordinary stores</text>
<path d="M30,100H650" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><polygon points="660,100 650,95 650,105" style="fill:var(--rule)"/>
<path d="M120,40V88" style="fill:none;stroke:var(--accent-red);stroke-width:2"/><polygon points="120,96 115,86 125,86" style="fill:var(--accent-red)"/>
<text x="120" y="34" text-anchor="middle" style="fill:var(--accent-red);font-size:11px;font-weight:600">1st store misses: RFO reads 64 B</text>
<path d="M600,92V50" style="fill:none;stroke:var(--trace);stroke-width:2"/><polygon points="600,42 595,52 605,52" style="fill:var(--trace)"/>
<text x="600" y="34" text-anchor="middle" style="fill:var(--trace);font-size:11px;font-weight:600">evicted: writeback 64 B</text>
<g style="fill:var(--trace)"><circle cx="140" cy="100" r="4"/><circle cx="330" cy="100" r="4"/><circle cx="500" cy="100" r="4"/></g>
<g text-anchor="middle" style="font-size:11px"><text x="140" y="120" style="fill:var(--ink)">sweep in plane Z − 1</text><text x="140" y="134" style="fill:var(--muted)">5 values (T family)</text><text x="330" y="120" style="fill:var(--ink)">sweep in plane Z</text><text x="330" y="134" style="fill:var(--muted)">9 in-plane values</text><text x="500" y="120" style="fill:var(--ink)">sweep in plane Z + 1</text><text x="500" y="134" style="fill:var(--muted)">5 values (B family)</text><text x="600" y="120" style="fill:var(--ink)">later</text></g>
<g text-anchor="middle" style="fill:var(--muted);font-size:10px"><text x="235" y="92">~3 MB of other lines</text><text x="415" y="92">~3 MB of other lines</text></g>
<text x="0" y="156" style="fill:var(--muted);font-size:11px">Between visits the line falls out of a 1–2 MB L2 but stays in a 32 MB L3, so DRAM sees it once in each direction.</text>
<text x="0" y="186" style="fill:var(--ink);font-size:12px;font-weight:600">DRAM bytes per cell update</text>
<text x="0" y="214" style="fill:var(--muted);font-size:11px">ordinary stores</text>
<rect x="150" y="198" width="160" height="24" style="fill:var(--accent-green)"/><rect x="310" y="198" width="160" height="24" style="fill:var(--accent-red)"/><rect x="470" y="198" width="160" height="24" style="fill:var(--trace)"/>
<g text-anchor="middle" style="fill:var(--surface);font-size:11px;font-weight:600"><text x="230" y="214">src read 160</text><text x="390" y="214">dst RFO read 160</text><text x="550" y="214">dst writeback 160</text></g>
<text x="636" y="214" style="fill:var(--ink);font-size:11px;font-weight:600">480 B</text>
<text x="0" y="246" style="fill:var(--muted);font-size:11px">non-temporal stores</text>
<rect x="150" y="230" width="160" height="24" style="fill:var(--accent-green)"/><rect x="310" y="230" width="160" height="24" style="fill:var(--trace)"/>
<g text-anchor="middle" style="fill:var(--surface);font-size:11px;font-weight:600"><text x="230" y="246">src read 160</text><text x="390" y="246">dst write 160</text></g>
<text x="476" y="246" style="fill:var(--ink);font-size:11px;font-weight:600">320 B</text>
<text x="0" y="276" style="fill:var(--ink);font-size:11px">A third of the traffic is the RFO. Over 3000 refrate steps of 1.3 M cells, 480 B per update</text>
<text x="0" y="292" style="fill:var(--ink);font-size:11px">is about 1.9 TB of DRAM traffic per copy.</text>
</svg></div>
<h4>Optimizations for LBM Workloads</h4>
<p>Real LBM codes (and compilers, within SPEC's rules) attack the bytes per cell update, since that sets the run time. The last column matters when you read SPEC results: only compiler and hardware changes count there.</p>
<div class="tbl"><table>
<tr><th>Optimization</th><th>What it changes</th><th>DRAM bytes per update</th><th>Allowed in a SPEC run?</th></tr>
<tr><td><a href="#/cache-write/nwa">Non-temporal (streaming) stores</a></td><td><ul><li>dst stores skip the RFO and go to memory through write-combining buffers.</li><li>They also stop dst from evicting useful lines from the LLC, which matters in SPECrate.</li><li>Catch: in lbm's push order each dst line is filled across 2 planes, but a core has only about 10 to 16 write-combining buffers. They flush half-filled lines, and partial-line writes can cost more than the RFO saved. Streaming stores pay off when each line is written in full within a short window (pull order or a structure-of-arrays layout).</li></ul></td><td>480 → 320 (1.5× less)</td><td>Yes, if the compiler emits them (for example Intel's <code>-qopt-streaming-stores</code>)</td></tr>
<tr><td>Hardware RFO elimination</td><td><ul><li>Some cores detect stores that will overwrite a whole line and request ownership without data (Intel's <code>rep movsb</code>/<code>rep stosb</code> fast strings, and the speculative full-line write (SpecI2M) added in Ice Lake-SP).</li><li>Needs the full line written soon, which lbm's scattered stores rarely give it.</li></ul></td><td>Up to 480 → 320</td><td>Yes, it's the hardware</td></tr>
<tr><td>Pull instead of push</td><td><ul><li>Gather the 19 values from the neighbors in src and write the cell's 160 B contiguously in dst.</li><li>Moves the scattering to loads, which are cheaper when misaligned, and makes full-line writes, so streaming stores work.</li></ul></td><td>None alone, enables 320</td><td>No, source change</td></tr>
<tr><td>Structure-of-arrays layout</td><td><ul><li>One array per direction, so direction i of neighboring cells is contiguous.</li><li>Gives unit-stride SIMD loads and stores instead of 160 B strides (in array-of-structures, a vector load needs a gather).</li><li>Raises the stream count to 19 reads and 19 writes, which can overflow the L2 prefetcher's stream table and spread accesses over many DRAM rows. Loop splitting keeps fewer arrays live per loop.</li></ul></td><td>None alone, enables 320</td><td>No, source change</td></tr>
<tr><td>One grid, updated in place (AA pattern, Esoteric Twist)</td><td><ul><li>Alternate two kernels so each value is written back to a slot that was just read, in a line already in cache.</li><li>No RFO without any special stores, and half the memory (215 MB instead of 430 MB for refrate).</li></ul></td><td>480 → 320, half the footprint</td><td>No, source change</td></tr>
<tr><td>Temporal blocking (wavefront)</td><td><ul><li>Advance a cache-sized block several time steps before moving on, so each value crosses the DRAM bus once per k steps.</li><li>Hard for LBM: 160 B per cell makes blocks small, and the dependence cone shrinks each step.</li></ul></td><td>About 480 / k for k fused steps</td><td>No, source change</td></tr>
<tr><td>Single precision</td><td><ul><li>Half the bytes per value, at the cost of accuracy.</li></ul></td><td>480 → 240</td><td>No, and output must validate</td></tr>
<tr><td>Parallel first-touch (SPECspeed)</td><td><ul><li>Initialize the grids with the same threads and decomposition the kernel uses, so each socket's pages sit in its own memory.</li><li>Otherwise one NUMA node serves all the traffic.</li></ul></td><td>Same bytes, more usable bandwidth</td><td>Yes, through OpenMP and OS settings</td></tr>
</table></div>
<p><strong>What lbm stresses in a model.</strong></p>
<ul><li><strong>DRAM bandwidth:</strong> the bound on any multicore run, especially SPECrate with one copy per core.</li><li><strong>Memory-level parallelism:</strong> on one core, L2 miss tracking and prefetch depth limit it before bandwidth does (see the lbm worked example on <a href="#/perf-find-cause">Finding a Stall's Cause</a>).</li><li><strong>Write handling:</strong> RFO versus full-line writes, write-combining buffer count, and writeback buffering.</li><li><strong>LLC policy:</strong> each line is reused only after about 430 MB, a <a href="#/cache-patterns/stream">cyclic stream</a> no LLC can hold, so the policy's job is to keep lbm from evicting other programs' data.</li></ul>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/benchmarks/519.lbm_r.html" target="_blank" rel="noopener">SPEC's 519.lbm_r description</a>, Wittmann et al., “Comparison of different propagation steps for the lattice Boltzmann method,” <em>Computers &amp; Mathematics with Applications</em> 65(6), 2013, and Wellein et al., “On the single processor performance of simple lattice Boltzmann kernels,” <em>Computers &amp; Fluids</em> 35(8–9), 2006.</p>
<h3 id="sec-limits">Limits</h3>
<p>SPEC is mostly single-application and has smaller code footprints than servers, browsers, or JIT-compiled code, so frontend features look less important than they are in practice. Supplement it with real workloads.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Compute a SPEC-style score for three benchmarks. Reference times: 1000 s, 2000 s, 1500 s. Measured: 250 s, 800 s, 300 s.</p>`,
        a: `<ol><li>Ratios (reference / measured): 4.0, 2.5, 5.0.</li><li>Score = geometric mean = (4.0 × 2.5 × 5.0)^(1/3) = 50^(1/3) ≈ <strong>3.68</strong>.</li></ol>`
      },
      {
        q: `<p>A SPECrate run uses 64 copies of one benchmark. The reference machine ran one copy in 1000 s; your system finishes all 64 copies in 400 s. What’s the ratio? Running one copy alone takes 300 s. What does that tell you?</p>`,
        a: `<ol><li>Rate ratio = 64 × 1000 / 400 = <strong>160</strong>.</li><li>One copy alone takes 300 s, but with 64 copies each takes about 400 s, so each copy is about 33% slower under load. Ideal scaling would give 64 × 1000 / 300 ≈ 213; you’re getting 75% of that. Look at shared LLC misses, DRAM bandwidth, and the all-core clock speed.</li></ol>`
      },
      {
        q: `<p>A production D3Q19 code (19 doubles per cell, no flag word, two grids) runs a 256 × 256 × 256 grid on one AMD EPYC 9654 socket: 12 channels of DDR5-4800, of which a STREAM-like kernel sustains about 370 GB/s. Estimate the memory footprint and the best-case speed in million lattice updates per second (MLUP/s), with ordinary stores and with non-temporal stores.</p>`,
        a: `<ol><li>Cells: 256³ = 16,777,216. Bytes per cell: 19 × 8 = 152 B.</li><li>Footprint: 2 grids × 16.78 M × 152 B ≈ <strong>5.1 GB</strong>, so every step streams from DRAM.</li><li>Ordinary stores: read 152 B, RFO 152 B, writeback 152 B = 456 B per update. 370 GB/s / 456 B ≈ <strong>811 MLUP/s</strong>, or about 20.7 ms per time step.</li><li>Non-temporal stores: 152 + 152 = 304 B per update. 370 GB/s / 304 B ≈ <strong>1217 MLUP/s</strong>, 1.5× faster.</li><li>These are upper bounds: they assume the kernel reaches STREAM bandwidth, that every dst line is written in full so the streaming stores don't turn into partial writes, and that the roughly 200 flops per update stay hidden under memory time.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Which SPEC CPU 2017 benchmarks would you use to evaluate a new L2 prefetcher, and why?</p>`,
        a: `<ul><li><strong>Streaming, bandwidth-heavy:</strong> 519.lbm, 503.bwaves, 549.fotonik3d, 554.roms; the prefetcher should help and must not waste bandwidth.</li><li><strong>Irregular, pointer-heavy:</strong> 505.mcf, 520.omnetpp, 523.xalancbmk; check that inaccurate prefetches don't pollute the cache.</li><li><strong>Compute-bound controls:</strong> 548.exchange2, 508.namd, 541.leela; they should show no regression.</li><li>Also check rate mode with many copies, where shared LLC and DRAM bandwidth are under pressure.</li></ul>`
      },
      {
        q: `<p>What's the difference between SPECrate and SPECspeed, and which stresses the memory system more?</p>`,
        a: `<p>SPECspeed measures how fast one task finishes (one copy; may use OpenMP threads). SPECrate measures throughput by running many independent copies at once. Rate puts more pressure on shared LLC capacity, interconnect, and DRAM bandwidth, because every core is competing for them.</p>`
      },
      {
        q: `<p>Simulating ref is too slow, so a teammate evaluated a new prefetcher using the train inputs and reports +5% IPC. Do you trust it?</p>`,
        a: `<ol><li>Not yet. Train inputs often have smaller working sets and shorter, different phases, and a prefetcher is very sensitive to footprint and access patterns. A gain that shows up when data almost fits in the L2 may disappear, or reverse, when the working set is DRAM-sized.</li><li>Check that train and ref behave alike for these benchmarks (MPKI, footprint, basic-block profiles), or better, run SimPoints taken from ref.</li><li>Never report a train-based number as a SPEC result or estimate.</li></ol>`
      }
    ]
  }
},

{
  id: "ipc-spec",
  region: "perf",
  title: "IPC and Simulation Methodology",
  sections: [
    { id: "breaking-cycles-down", label: "Breaking Cycles Down" },
    { id: "summarizing-suite", label: "Summarizing a Suite" },
    { id: "simulation-hygiene", label: "Simulation Hygiene" },
    { id: "sim-vs-hw", label: "SPEC on a Simulator vs. on Real Hardware" },
    { id: "whole-spec-run", label: "Why You Can’t Simulate a Whole SPEC Run" },
    { id: "two-separate-sources", label: "Two Separate Sources of Error" },
    { id: "measured-estimated-results", label: "Measured vs. Estimated Results" },
    { id: "model-correlation", label: "Model Correlation" }
  ],
  body: `
<p>IPC is instructions retired per cycle. Compare it only on identical binaries.</p>
<h3 id="sec-breaking-cycles-down">Breaking Cycles Down</h3>
<p>A CPI stack splits cycles into base work and stall causes, showing where a gain actually came from.</p>
<h3 id="sec-summarizing-suite">Summarizing a Suite</h3>
<p>Use the geometric mean of speedups, and report per-benchmark results too.</p>
<h3 id="sec-simulation-hygiene">Simulation Hygiene</h3>
<ul><li>Simulate representative regions (SimPoints).</li><li>Warm up caches and predictors before measuring.</li><li>Pair IPC with MPKI for caches and branches.</li><li>Sweep one parameter at a time to find where returns flatten.</li></ul>
<h3 id="sec-sim-vs-hw">SPEC on a Simulator vs. on Real Hardware</h3>
<p>These are two different experiments. On hardware, you time the run and get a SPEC score. On a C model, the simulator is just a program running on a host CPU, so you get two separate clocks:</p>
<div class="tbl"><table>
<tr><th></th><th>Host wall-clock time</th><th>Simulated target cycles</th></tr>
<tr><td>What it measures</td><td>How fast your simulator runs</td><td>How fast the modeled CPU would run</td></tr>
<tr><td>Depends on</td><td>Host CPU, model detail, simulator code quality</td><td>The modeled microarchitecture (and how accurate the model is)</td></tr>
<tr><td>Use it for</td><td>Planning simulation budgets</td><td>IPC, CPI stacks, design comparisons</td></tr>
</table></div>
<p>Never report host time as target performance; there’s nothing to “subtract.” Estimated target time = cycles / frequency, e.g. 5 × 10<sup>9</sup> cycles at 3 GHz ≈ 1.67 s. That only holds if the clock is fixed and memory latency is modeled sensibly: if DRAM latency is a fixed cycle count, raising the clock in the model wrongly makes memory faster too. Model it in nanoseconds if you plan to sweep frequency.</p>
<h3 id="sec-whole-spec-run">Why You Can’t Simulate a Whole SPEC Run</h3>
<p>Reference inputs run hundreds of billions to trillions of instructions, and detailed cycle-level models are often 10,000× or more slower than native, so a full run would take weeks to months. Instead, simulate representative regions (SimPoint) or sampled intervals (SMARTS) and weight the results. SPEC itself points to SimPoint-based checkpoints (“pinballs”) for CPU 2017 from UT Austin. Don’t substitute the <code>test</code> or <code>train</code> inputs for <code>ref</code>: they behave differently, often with much smaller memory footprints.</p>
<h3 id="sec-two-separate-sources">Two Separate Sources of Error</h3>
<ul><li><strong>Overhead:</strong> affects only how long you wait, not the answer.</li><li><strong>Abstraction:</strong> simplified bank conflicts, fixed memory latency, idealized arbitration, or predictor update timing all change the cycle count. This is the error that matters; reduce it by correlating against RTL, emulation, or silicon.</li><li><strong>Sampling:</strong> regions that miss a phase, or insufficient warmup, bias the result.</li></ul>
<h3 id="sec-measured-estimated-results">Measured vs. Estimated Results</h3>
<p>Published SPEC results are measured on real systems with outputs validated and the full configuration disclosed. SPEC allows performance metrics (not energy metrics) to be estimated, from simulation or models for example, but any public estimate must be clearly labeled as one.</p>
<p>Sources: <a href="https://www.spec.org/cpu2017/Docs/runrules.html" target="_blank" rel="noopener">SPEC CPU 2017 run rules</a>, <a href="https://open.spec.org/cpu2017/research/simpoint.html" target="_blank" rel="noopener">SPEC CPU 2017 and simulation</a>.</p>
<h3 id="sec-model-correlation">Model Correlation</h3>
<p>A model is only useful if it tracks the real design. Correlate against RTL simulation, emulation, or silicon with the same workloads, and compare per-structure events, not just total IPC.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Design B's speedups over A on three benchmarks are 1.10, 1.00, and 0.90. Give the arithmetic and geometric means.</p><p>Separately, a CPI stack: base 0.5, branch 0.3, L2 0.2, memory 0.6. If you halve memory stalls, what's the speedup?</p>`,
        a: `<ol><li>Arithmetic mean = 1.00. Geometric mean = (1.1 × 1.0 × 0.9)^(1/3) = 0.99^(1/3) ≈ <strong>0.997</strong>. Use the geomean for ratios; its ranking doesn't depend on which design is the baseline.</li><li>Total CPI = 1.6. New CPI = 1.6 − 0.3 = 1.3. Speedup = 1.6 / 1.3 ≈ <strong>1.23×</strong>.</li></ol>`
      },
      {
        q: `<p>Your simulator takes 6 hours on a SimPoint region of 100 million instructions and reports 40 million cycles for a 3 GHz target. What’s the target IPC and time for the region? A colleague says “the design is slow, it took 6 hours.” What’s wrong with that?</p>`,
        a: `<ol><li>IPC = 100M / 40M = <strong>2.5</strong>.</li><li>Target time = 40 × 10<sup>6</sup> / 3 × 10<sup>9</sup> ≈ <strong>13.3 ms</strong>.</li><li>The 6 hours is host time: it measures the simulator’s speed (here roughly 4,600 target instructions per second), not the modeled CPU. To estimate the whole benchmark, weight each region’s CPI by its SimPoint weight and multiply by the total instruction count.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your model predicts +8% IPC for a feature, but RTL simulation of the same workloads shows +2%. How do you find the gap?</p>`,
        a: `<ol><li>Confirm it's the same workload: same binary, region, warmup, and configuration.</li><li>Compare event counts per structure (misses, replays, stall cycles by resource) between model and RTL.</li><li>Narrow it down with directed microbenchmarks that exercise just the feature.</li><li>Check modeling assumptions: latencies, port counts, arbitration, queue sizes, and corner cases RTL implements that the model idealizes.</li><li>Fix the model or flag the RTL as a performance bug, and add the case to a correlation regression suite.</li></ol>`
      }
    ]
  }
},

{
  id: "perf-analytical",
  region: "perf",
  title: "Analytical Performance Models",
  sections: [
    { id: "why", label: "Why Model on Paper" },
    { id: "cpi-stack", label: "First-Order CPI Stacks" },
    { id: "interval", label: "Interval Analysis" },
    { id: "roofline", label: "The Roofline Model" },
    { id: "limits", label: "Where They Break" }
  ],
  body: `
<p>A cycle-level simulator answers "what is the IPC?" after hours of simulation. An analytical model answers "roughly what, and why?" in seconds, from a handful of event counts. They are how architects sanity-check simulator results, explore a design space before building anything, and explain a result in one sentence.</p>

<h3 id="sec-why">Why Model on Paper</h3>
<ul>
<li><strong>Speed:</strong> sweep thousands of design points (ROB sizes, cache sizes, widths) from one set of profiled event counts.</li>
<li><strong>Insight:</strong> each term names a cause, so the model says <em>why</em> IPC changed.</li>
<li><strong>A check on the simulator:</strong> when the detailed model and the first-order model disagree by a lot, one of them has a bug or a missing effect, and finding which is usually instructive.</li>
</ul>

<h3 id="sec-cpi-stack">First-Order CPI Stacks</h3>
<p>The simplest model adds a penalty per event to a base CPI:</p>
<div class="math">\\[ CPI = CPI_{base} + \\sum_e \\frac{N_e}{N_i} \\, P_e \\]</div>
<p>where \\(N_e / N_i\\) is event e's rate per instruction (MPKI / 1000) and \\(P_e\\) its penalty in cycles. For an in-order pipeline this is nearly exact (see <a href="#/stall-perf">Performance of Pipelines with Stalls</a>). For an out-of-order core it overcounts, because the core overlaps misses with each other and with useful work; the useful refinements below are about how much to subtract.</p>

<h3 id="sec-interval">Interval Analysis</h3>
<p>Interval analysis (Karkhanis and Smith, 2004; Eyerman, Eeckhout, Karkhanis, and Smith, 2009) models an out-of-order core as running at a steady dispatch rate, interrupted by <strong>miss events</strong>. Execution splits into intervals, each a stretch of steady dispatch followed by one miss event:</p>
<div class="math">\\[ C \\approx \\frac{N_i}{D_{eff}} + \\sum_{\\text{mispredicts}} (c_{res} + c_{fe}) + \\sum_{\\text{I-misses}} L_{I} + \\sum_{\\text{isolated long D-misses}} L_{mem} \\]</div>
<ul>
<li><strong>Steady state:</strong> \\(D_{eff}\\) is the dispatch rate the window sustains given the code's ILP, at most the dispatch width.</li>
<li><strong>Branch mispredict:</strong> the branch resolution time \\(c_{res}\\) (how long the branch waits in the window, which grows with the dependence chain feeding it) plus the front-end refill \\(c_{fe}\\). The resolution term is why mispredicts cost more than the pipeline depth.</li>
<li><strong>Instruction cache miss:</strong> about its full latency \\(L_I\\); the fetch queue hides only a few cycles.</li>
<li><strong>Long data cache miss:</strong> to first order, the full memory latency \\(L_{mem}\\): the cycles spent filling the ROB behind the miss are useful, but they are offset by the ramp back to steady state after it returns.</li>
<li><strong>Overlap:</strong> long misses that fall within one ROB's worth of instructions of an earlier long miss overlap with it and cost almost nothing extra. Counting only the first miss of each such group is what turns the naive sum into a usable out-of-order model.</li>
</ul>
<p>Short data cache misses (L1 misses that hit L2) are mostly hidden by the window and are folded into \\(D_{eff}\\). The Sniper simulator uses this model in place of a cycle-level core, running roughly 10× faster than a detailed simulator with modest error on many workloads.</p>

<h3 id="sec-roofline">The Roofline Model</h3>
<p>For loops limited by arithmetic or memory bandwidth, the roofline model (Williams, Waterman, and Patterson, 2009) bounds attainable throughput by the lower of two ceilings:</p>
<div class="math">\\[ \\text{Attainable FLOP/s} = \\min(\\text{Peak FLOP/s}, \\; AI \\times BW) \\]</div>
<p>Arithmetic intensity AI is FLOPs per byte moved from the memory level in question. Plotted on log-log axes, the bandwidth line rises until it meets the flat compute ceiling at the <strong>ridge point</strong>, Peak / BW. Kernels left of the ridge are memory-bound, right of it compute-bound. <a href="#/perf-roofline">The Roofline Model for CPUs</a> builds the roofs for a real server, adds lower ceilings and a roof for each cache level, and shows how to measure where a kernel sits.</p>
<p>Example, a Ryzen 9 7950X (16 Zen 4 cores): each core does two 256-bit FMAs per cycle, 16 double-precision FLOPs, so about 1.2 TFLOP/s at an all-core clock near 4.8 GHz. Two DDR5-6000 channels give 96 GB/s. The ridge is near 13 FLOP/byte. A <code>daxpy</code> (y = a·x + y) does 2 FLOPs per 24 bytes (two loads, one store): AI ≈ 0.083, so it is capped at about 8 GFLOP/s from DRAM, under 1% of peak.</p>

<h3 id="sec-limits">Where They Break</h3>
<ul>
<li><strong>Interactions:</strong> a mispredicted branch that depends on a long miss resolves only when the miss returns, so the two penalties overlap in ways a sum of independent terms misses.</li>
<li><strong>Prefetching:</strong> it turns misses into hits or partial hits; event counts must come from the configuration being modeled.</li>
<li><strong>Bandwidth and queueing:</strong> interval analysis treats memory latency as fixed; near peak bandwidth, latency rises (see <a href="#/icx-memory">Memory Interfaces</a>).</li>
<li><strong>Resource stalls without misses:</strong> port pressure or a small scheduler can cap \\(D_{eff}\\); the bounds on <a href="#/perf-bounds/bounds">Stalls by Pipeline Stage</a> estimate it.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapters 1 and 3, and Chapter 4 (the roofline model) · Karkhanis and Smith, "A First-Order Superscalar Processor Model," ISCA 2004 · Eyerman, Eeckhout, Karkhanis, and Smith, "A Mechanistic Performance Model for Superscalar Out-of-Order Processors," ACM TOCS 2009 · Carlson, Heirman, and Eeckhout, "Sniper: Exploring the Level of Abstraction for Scalable and Accurate Parallel Multi-Core Simulation," SC 2011 · Williams, Waterman, and Patterson, "Roofline: An Insightful Visual Performance Model for Multicore Architectures," CACM 2009</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 4-wide core with a 256-entry ROB runs 1,000 instructions at a steady dispatch rate of 4 when nothing goes wrong. In that stretch there are 5 mispredicts (resolution 10 cycles, front-end refill 12), 2 instruction cache misses to L2 (16 cycles each), and 3 DRAM misses (300 cycles each); the second and third are 60 instructions apart, the first is 600 instructions before them. Estimate the cycles and IPC with interval analysis.</p>`,
        a: `<ol><li>Steady state: 1,000 / 4 = 250 cycles.</li><li>Mispredicts: 5 × (10 + 12) = 110 cycles.</li><li>Instruction cache misses: 2 × 16 = 32 cycles.</li><li>DRAM misses: the second and third are within one ROB (60 &lt; 256 instructions), so they overlap and count once; the first is 600 instructions away, so it is isolated. Two groups: 2 × 300 = 600 cycles.</li><li>Total ≈ 250 + 110 + 32 + 600 = <strong>992 cycles</strong>, IPC ≈ <strong>1.0</strong>. Memory is 60% of the time; doubling the ROB to 512 wouldn't merge the first miss (600 apart), but a prefetcher that covered it would save 300 cycles.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your interval model predicts that doubling the ROB from 256 to 512 entries gains 3% IPC on a database workload. Cycle-level simulation says 15%. What could the interval model be missing?</p>`,
        a: `<p>Most likely the overlap term. If the model computes miss overlap from a fixed window or from average miss distance, it misses the distribution: on databases, many long misses sit 256 to 512 instructions apart, so a 512-entry window merges them while a 256-entry one doesn't. Recompute the groups from the actual distance between consecutive long misses at each window size. Other candidates: mispredicted branches that depend on misses resolve only after the miss, and a larger window lets the core find and overlap more of those misses before the flush; the larger window can also expose more prefetch-triggering accesses earlier. And check the simulator: a 512-entry ROB with unchanged load queue, store queue, and register file would hit those limits first, so if the simulation scaled them too, the comparison isn't like for like.</p>`
      }
    ]
  }
},

{
  id: "perf-roofline",
  region: "perf",
  title: "The Roofline Model for CPUs",
  sections: [
    { id: "build", label: "Building the Roofs" },
    { id: "ceilings", label: "Ceilings Below the Roof" },
    { id: "hierarchy", label: "A Roof for Each Cache Level" },
    { id: "kernels", label: "Where Common Kernels Sit" },
    { id: "measure", label: "Measuring a Kernel's Point" },
    { id: "moving", label: "Moving a Kernel on the Plot" },
    { id: "limits", label: "What the Roofline Can't See" }
  ],
  body: `
<p>The roofline (Williams, Waterman, and Patterson, 2009) bounds a loop's throughput by the lower of two limits: how fast the core can compute and how fast memory can feed it. <a href="#/perf-analytical/roofline">Analytical Performance Models</a> gives the formula. This page builds the roofs for a real server, adds the lower ceilings that real code hits, gives each cache level its own roof, and shows how to measure where a kernel sits.</p>
<div class="math">\\[ P = \\min(P_{peak}, \\; AI \\times BW), \\qquad AI = \\frac{\\text{FLOPs}}{\\text{bytes moved at the chosen level}} \\]</div>

<h3 id="sec-build">Building the Roofs</h3>
<p>Running example: an Intel Xeon Platinum 8480+ (Sapphire Rapids, 56 Golden Cove cores, 8 channels of DDR5-4800).</p>
<ul>
<li><strong>Compute roof:</strong> each core has two 512-bit FMA units. One 512-bit FMA does 8 double-precision multiplies and 8 adds, so a core peaks at 2 × 8 × 2 = 32 FLOP per cycle. Heavy AVX-512 code runs well below the 3.0 GHz all-core turbo. At an assumed 2.0 GHz that is 64 GFLOP/s per core and about 3.6 TFLOP/s per socket.</li>
<li><strong>Memory roof:</strong> 8 channels × 8 bytes × 4.8 GT/s = 307.2 GB/s in theory. STREAM Triad reaches roughly 240 GB/s. Use the measured number, because no real access stream reaches the theoretical one.</li>
<li><strong>Ridge point:</strong> 3,584 / 240 ≈ 15 FLOP per byte. A kernel needs about 15 FLOPs for every byte it brings from DRAM before the FMA units become the limit. With the theoretical bandwidth the ridge would be 11.7, which flatters every memory-bound kernel.</li>
</ul>
<p>Measure both roofs with microbenchmarks rather than datasheets: STREAM or <code>likwid-bench</code> for bandwidth, a dense FMA loop or the Empirical Roofline Toolkit (ERT) for FLOP/s. The measured roofs already include the effects of the clock under load, DRAM refresh, and read-write turnaround.</p>

<h3 id="sec-ceilings">Ceilings Below the Roof</h3>
<p>The roof assumes the code uses every FLOP the core offers. Code that doesn't sits under a lower <strong>ceiling</strong>, and the gap names the missing optimization. For one Sapphire Rapids core at 2.0 GHz:</p>
<div class="tbl"><table>
<tr><th>Ceiling</th><th>FLOP per cycle</th><th>GFLOP/s per core</th><th>What breaks it</th></tr>
<tr><td>AVX-512 with FMA (peak)</td><td>32</td><td>64</td><td>Nothing</td></tr>
<tr><td>AVX-512 without FMA, or AVX2 with FMA</td><td>16</td><td>32</td><td>Separate multiplies and adds, or 256-bit vectors</td></tr>
<tr><td>Scalar with FMA</td><td>4</td><td>8</td><td>No vectorization</td></tr>
<tr><td>One dependence chain</td><td>4</td><td>8</td><td>A reduction with a single accumulator</td></tr>
</table></div>
<ul>
<li><strong>Instruction-level parallelism:</strong> an FMA takes 4 cycles on Golden Cove, so a loop whose FMAs form one chain (<code>s += x[i] * y[i]</code> with one vector accumulator) issues one FMA every 4 cycles instead of two per cycle. Little's law gives the fix: latency × throughput = 4 × 2 = 8 independent accumulators.</li>
<li><strong>Clock licenses:</strong> scalar and AVX2 code runs at a higher clock than AVX-512 code, so the lower ceilings sit somewhat higher than this table shows. Measure each ceiling at the clock the code actually runs at.</li>
<li><strong>Bandwidth ceilings:</strong> a single thread can't reach the socket's 240 GB/s. Its bandwidth is bounded by Little's law on the misses it can keep in flight. Golden Cove's L2 tracks 48 outstanding misses, and DRAM latency is about 115 ns, so one core sustains at most 48 × 64 B / 115 ns ≈ 27 GB/s. Roughly 9 cores saturate the socket. Remote NUMA memory and a single-channel DIMM population give lower bandwidth ceilings too.</li>
</ul>

<h3 id="sec-hierarchy">A Roof for Each Cache Level</h3>
<p>DRAM is only one place data can come from. Each cache level has its own bandwidth and so its own diagonal roof. Per Golden Cove core at 2.0 GHz:</p>
<ul>
<li><strong>L1:</strong> two 64-byte loads per cycle, 128 B/cycle = 256 GB/s. Ridge 32 / 128 = 0.25 FLOP/byte.</li>
<li><strong>L2 to L1:</strong> one 64-byte line per cycle, 128 GB/s. Ridge 0.5.</li>
<li><strong>DRAM, one core's share with all 56 running:</strong> 240 / 56 ≈ 4.3 GB/s. Ridge about 15.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 410" role="img" aria-label="Roofline for one Sapphire Rapids core at 2.0 GHz on log-log axes. The x axis is arithmetic intensity from 1/32 to 32 FLOP per byte. The y axis is GFLOP/s per core from 1/16 to 128. The compute roof is flat at 64 GFLOP/s. Lower dashed ceilings sit at 32 GFLOP/s for no FMA or AVX2 and 8 GFLOP/s for scalar code. Three parallel diagonal bandwidth roofs rise from the left: L1 at 256 GB/s meets the peak at 0.25 FLOP per byte, L2 at 128 GB/s meets it at 0.5, and the DRAM share of 4.3 GB/s meets it at about 15. STREAM Triad, SpMV, and a 7-point stencil sit on the DRAM roof at intensities between 1/16 and 1/3. DGEMM sits on the flat roof at an intensity of about 24." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="stroke:var(--rule);stroke-width:1">
<line x1="186" y1="30" x2="186" y2="360"/><line x1="302" y1="30" x2="302" y2="360"/><line x1="418" y1="30" x2="418" y2="360"/><line x1="534" y1="30" x2="534" y2="360"/><line x1="650" y1="30" x2="650" y2="360"/>
<line x1="70" y1="60" x2="650" y2="60"/><line x1="70" y1="120" x2="650" y2="120"/><line x1="70" y1="180" x2="650" y2="180"/><line x1="70" y1="240" x2="650" y2="240"/><line x1="70" y1="300" x2="650" y2="300"/>
</g>
<g style="stroke:var(--muted);stroke-width:1.5"><line x1="70" y1="30" x2="70" y2="360"/><line x1="70" y1="360" x2="650" y2="360"/></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="70" y="376">1/32</text><text x="186" y="376">1/8</text><text x="302" y="376">1/2</text><text x="418" y="376">2</text><text x="534" y="376">8</text><text x="650" y="376">32</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="end">
<text x="62" y="364">1/16</text><text x="62" y="304">1/4</text><text x="62" y="244">1</text><text x="62" y="184">4</text><text x="62" y="124">16</text><text x="62" y="64">64</text>
</g>
<text x="360" y="400" text-anchor="middle" style="fill:var(--muted);font-size:12px">arithmetic intensity, FLOP per byte (log scale)</text>
<text transform="rotate(-90 18 195)" x="18" y="195" text-anchor="middle" style="fill:var(--muted);font-size:12px">GFLOP/s per core (log scale)</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:5 4"><line x1="186" y1="90" x2="650" y2="90"/><line x1="70" y1="150" x2="650" y2="150"/></g>
<line x1="586" y1="60" x2="586" y2="360" style="stroke:var(--muted);stroke-width:1;stroke-dasharray:2 3"/>
<polyline points="70,150 244,60" style="fill:none;stroke:var(--muted);stroke-width:2.5"/>
<polyline points="70,180 302,60" style="fill:none;stroke:var(--pad);stroke-width:2.5"/>
<polyline points="70,327 586,60" style="fill:none;stroke:var(--trace);stroke-width:2.5"/>
<line x1="244" y1="60" x2="650" y2="60" style="stroke:var(--ink);stroke-width:2.5"/>
<g style="fill:var(--ink);font-size:11px">
<text x="320" y="54">AVX-512 FMA peak, 64 GFLOP/s</text><text x="310" y="84">no FMA or AVX2, 32 GFLOP/s</text><text x="250" y="144">scalar FMA, 8 GFLOP/s</text>
</g>
<text x="586" y="352" text-anchor="middle" style="fill:var(--muted);font-size:11px">DRAM ridge ≈ 15</text>
<g style="stroke-width:2.5"><line x1="80" y1="200" x2="100" y2="200" style="stroke:var(--muted)"/><line x1="80" y1="216" x2="100" y2="216" style="stroke:var(--pad)"/><line x1="80" y1="232" x2="100" y2="232" style="stroke:var(--trace)"/></g>
<g style="fill:var(--ink);font-size:11px"><text x="106" y="204">L1 load, 256 GB/s</text><text x="106" y="220">L2 to L1, 128 GB/s</text><text x="106" y="236">DRAM share, 4.3 GB/s</text></g>
<g style="fill:var(--ink)"><circle cx="128" cy="297" r="4.5"/><circle cx="210" cy="255" r="4.5"/><circle cx="268" cy="224.5" r="4.5"/><circle cx="626" cy="60" r="4.5"/></g>
<g style="fill:var(--ink);font-size:11px"><text x="136" y="314">STREAM Triad</text><text x="218" y="272">SpMV</text><text x="276" y="241">7-point stencil</text><text x="646" y="78" text-anchor="end">DGEMM</text></g>
</svg></div>
<p>The three diagonals are parallel because every roof has slope 1 on log-log axes. The wide gap between the L2 and DRAM roofs is why cache blocking pays: a kernel at an intensity of 1 FLOP per byte is capped at 4.3 GFLOP/s per core from DRAM but can reach the 64 GFLOP/s peak once its working set lives in L2.</p>
<p>Two variants put kernels on this plot differently:</p>
<ul>
<li><strong>Hierarchical roofline</strong> (the Berkeley form, also used for GPUs on <a href="#/gpu-models/roofline">Analytical Models and Simulators</a>): measure the bytes at each level separately, so one kernel gets one point per level, each against its own roof. The level whose point sits closest to its roof is the bound.</li>
<li><strong>Cache-aware roofline</strong> (Ilic, Pratas, and Sousa, 2014, used by Intel Advisor): count bytes once, at the core, as every load and store instruction. A kernel then has one intensity that doesn't change with cache size, and its height shows which level it is effectively running from: above the DRAM roof but under the L2 roof means it is getting data from L2 or L3.</li>
</ul>

<h3 id="sec-kernels">Where Common Kernels Sit</h3>
<p>Intensities for double precision, counting DRAM bytes on a cache that allocates on a write miss (a store miss first reads the line, then writes it back later):</p>
<div class="tbl"><table>
<tr><th>Kernel</th><th>FLOPs and bytes per element</th><th>DRAM AI</th><th>Bound at 240 GB/s</th></tr>
<tr><td>STREAM Triad, <code>a[i] = b[i] + s * c[i]</code></td><td>2 FLOPs, 16 B loaded + 8 B stored + 8 B write-allocate read = 32 B</td><td>0.0625</td><td>15 GFLOP/s</td></tr>
<tr><td>SpMV in CSR, per nonzero</td><td>2 FLOPs, 8 B value + 4 B column index, plus 8 B of <code>x</code> if it misses</td><td>0.10 to 0.17</td><td>24 to 40 GFLOP/s</td></tr>
<tr><td>3D 7-point stencil, out of place</td><td>8 FLOPs, 8 B read + 8 B written + 8 B write-allocate, if the planes it touches stay in cache</td><td>0.33</td><td>80 GFLOP/s</td></tr>
<tr><td>DGEMM, blocked with b × b tiles</td><td>2b³ FLOPs per 16b² bytes streamed</td><td>b / 8</td><td>Compute-bound once b &gt; 120</td></tr>
</table></div>
<p>Everything except DGEMM sits far left of the 15 FLOP/byte ridge, under 3% of the socket's 3.6 TFLOP/s. That is the normal case for scientific and data-processing code, and it is why memory bandwidth per core is a headline server specification.</p>

<h3 id="sec-measure">Measuring a Kernel's Point</h3>
<ol>
<li><strong>Count by hand first.</strong> The hand count is the ideal: every byte read once. It is the target the measurement is compared against.</li>
<li><strong>FLOPs from counters.</strong> On Intel, <code>FP_ARITH_INST_RETIRED</code> has one event per width (scalar, 128-bit, 256-bit, and 512-bit packed double). Weight them 1, 2, 4, and 8. FMAs already count twice. Masked AVX-512 instructions count their full width, so masked remainder loops overcount slightly. AMD Zen cores count retired FLOPs directly with <code>FP_RET_SSE_AVX_OPS</code>.</li>
<li><strong>Bytes from the memory controller.</strong> Uncore CAS counts (<code>UNC_M_CAS_COUNT.RD</code> and <code>.WR</code>) × 64 B give real DRAM traffic, including prefetches, write-allocate reads, and writebacks. Core-side events (L1 or L2 misses) undercount it.</li>
<li><strong>Time from the same run,</strong> so FLOPs / time is the point's height. <code>likwid-perfctr</code> (the <code>MEM_DP</code> group) and Intel Advisor report all three.</li>
</ol>
<p>The ratio of hand-counted to measured intensity is diagnostic. Measured below hand count means wasted bytes: write-allocate reads, prefetcher overfetch, conflict or capacity misses, or a whole 64-byte line fetched for one 8-byte gather.</p>

<h3 id="sec-moving">Moving a Kernel on the Plot</h3>
<ul>
<li><strong>Move right (raise intensity):</strong>
  <ul>
  <li>Cache blocking or tiling, so data is reused while it is in cache (DGEMM's b / 8).</li>
  <li>Loop fusion, so an intermediate array stays in registers instead of making a round trip to DRAM.</li>
  <li>Non-temporal (streaming) stores, which skip the write-allocate read: Triad goes from 32 to 24 bytes, a 33% higher bound.</li>
  <li>Temporal blocking for stencils: several time steps per pass over the grid.</li>
  <li>Smaller types (FP32, BF16, 16-bit indices). This also changes the compute roof, so redraw it.</li>
  </ul></li>
<li><strong>Move up toward a higher ceiling:</strong> vectorize, use FMA, and split reductions across enough accumulators to cover the FMA latency.</li>
<li><strong>Raise the bandwidth ceiling:</strong> run enough threads to cover Little's law, place memory on the local NUMA node, and populate every memory channel.</li>
</ul>
<p>The plot says which of these can matter. Vectorizing a kernel that sits on the DRAM roof does nothing until its intensity rises past the point where the vector ceiling binds.</p>

<h3 id="sec-limits">What the Roofline Can't See</h3>
<ul>
<li><strong>Latency-bound code:</strong> pointer chasing, hash lookups, and tree walks have little memory-level parallelism. They sit far below both roofs, and the gap is explained by <a href="#/perf-analytical/interval">interval analysis</a> or a top-down breakdown, not by bandwidth.</li>
<li><strong>Non-FLOP work:</strong> integer, branch-heavy, and shuffle-heavy code has no meaningful FLOP count. An instruction roofline (instructions per second against instructions per byte) keeps the idea.</li>
<li><strong>Front end and speculation:</strong> instruction cache misses and branch mispredictions lower achieved throughput without moving the roofs (see <a href="#/perf-bounds/bounds">Stalls by Pipeline Stage</a>).</li>
<li><strong>Overlap:</strong> the model assumes compute and memory transfer overlap completely, time = max(FLOPs / peak, bytes / BW). Without overlap, time is the sum, so a kernel exactly at the ridge can run at half the roofline value.</li>
<li><strong>Bandwidth under load:</strong> latency rises sharply as bandwidth nears the roof (see <a href="#/icx-memory">Memory Interfaces</a>), which is part of why STREAM stops near 80% of theoretical.</li>
</ul>
<p class="refs">References: Williams, Waterman, and Patterson, "Roofline: An Insightful Visual Performance Model for Multicore Architectures," CACM 2009 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 4 (the roofline model) · Ilic, Pratas, and Sousa, "Cache-aware Roofline Model: Upgrading the Loft," IEEE Computer Architecture Letters 2014 · Yang, Kurth, and Williams, "Hierarchical Roofline Analysis for GPUs," CCPE 2020 · McCalpin, "Memory Bandwidth and Machine Balance in Current High Performance Computers," IEEE TCCA Newsletter 1995 · Intel, <em>Intel 64 and IA-32 Architectures Optimization Reference Manual</em> (Golden Cove) · Treibig, Hager, and Wellein, "LIKWID: A Lightweight Performance-Oriented Tool Suite for x86 Multicore Environments," PSTI 2010</p>`,
  practice: {
    guided: [
      {
        q: `<p>An NVIDIA Grace CPU has 72 Neoverse V2 cores. Each core has four 128-bit FMA pipes. Assume a 3.0 GHz all-core clock and 450 GB/s of measured STREAM bandwidth from its LPDDR5X. A loop computes <code>a[i] = b[i] * c[i] + d[i]</code> in double precision over arrays far larger than the caches, using all cores. Find the peak FLOP/s and the ridge point, the loop's arithmetic intensity and roofline bound with write-allocate, and the bound when the core's write streaming mode avoids the write-allocate read for full-line stores. What fraction of peak is that?</p>`,
        a: `<ol><li>Per core: 4 pipes × 2 doubles per 128-bit vector × 2 FLOPs per FMA = 16 FLOP per cycle. At 3.0 GHz that is 48 GFLOP/s, and 72 cores give <strong>3,456 GFLOP/s</strong>.</li><li>Ridge: 3,456 / 450 ≈ <strong>7.7 FLOP per byte</strong>.</li><li>Per element: one FMA = 2 FLOPs. Bytes: three 8-byte loads (24 B) + one 8-byte store + one 8-byte write-allocate read = 40 B. AI = 2 / 40 = 0.05, so the bound is 0.05 × 450 = <strong>22.5 GFLOP/s</strong>.</li><li>Without the write-allocate read: 32 B, AI = 0.0625, bound 0.0625 × 450 ≈ <strong>28.1 GFLOP/s</strong>, 25% faster.</li><li>Fraction of peak: 28.1 / 3,456 ≈ <strong>0.8%</strong>. The loop is deep in memory-bound territory, so vectorization or FMA changes nothing. Only fewer bytes help.</li></ol>`
      },
      {
        q: `<p>A Zen 4 core runs a dot product of two 1,000-element double arrays that are already in its 32 KB L1. Zen 4 has two 256-bit FMA pipes with a 4-cycle FMA latency and can load two 256-bit vectors per cycle from L1. The compiler emits one vector accumulator. Find the FLOPs per cycle with one accumulator, the L1 bandwidth bound, and the number of accumulators needed to reach that bound. Is the compute peak reachable?</p>`,
        a: `<ol><li>One accumulator: each FMA depends on the previous one, so one 256-bit FMA issues every 4 cycles. That is 4 doubles × 2 FLOPs / 4 cycles = <strong>2 FLOP per cycle</strong>.</li><li>L1 bound: each FMA needs one vector of <code>x</code> and one of <code>y</code>, 2 × 32 B = 64 B, for 8 FLOPs, so AI = 8 / 64 = 0.125 FLOP per byte. Two 32-byte loads per cycle is 64 B per cycle, so the bound is 0.125 × 64 = <strong>8 FLOP per cycle</strong>, one FMA per cycle.</li><li>Accumulators: to issue one FMA per cycle with a 4-cycle latency, Little's law needs 4 × 1 = <strong>4 independent accumulators</strong>, summed at the end. That is a 4× speedup.</li><li>Compute peak: 2 pipes × 4 doubles × 2 = 16 FLOP per cycle. It is <strong>not reachable</strong>: the loads cap the loop at half of it, so 8 accumulators would not help.</li></ol>`
      },
      {
        q: `<p>An AMD EPYC 9654 has 96 Zen 4 cores, each doing 16 double-precision FLOPs per cycle, and a 1 MB L2 per core. Assume a 3.0 GHz all-core clock and 370 GB/s of measured bandwidth from its 12 channels of DDR5-4800. DGEMM is blocked so that each b × b tile of C stays in cache while a b × n panel of A and an n × b panel of B stream from DRAM, each element read once per tile. Derive the DRAM arithmetic intensity as a function of b, find the smallest b that makes DGEMM compute-bound, and check whether the C tile fits in L2.</p>`,
        a: `<ol><li>One C tile over the full k dimension does b × b × n multiply-adds = 2b²n FLOPs.</li><li>It streams 2bn doubles from A and B, which is 16bn bytes. The C tile's own traffic is read and written once, negligible for large n.</li><li>AI = 2b²n / 16bn = <strong>b / 8 FLOP per byte</strong>.</li><li>Peak: 96 × 16 × 3.0 GHz = 4,608 GFLOP/s. Ridge: 4,608 / 370 ≈ 12.5 FLOP per byte.</li><li>Compute-bound when b / 8 ≥ 12.5, so <strong>b ≥ 100</strong>.</li><li>The C tile is 100 × 100 × 8 B = 80 KB, well inside the 1 MB L2, so the blocking is feasible. Production BLAS libraries use larger tiles, so they also clear the roofs of the cache levels the panels stream through.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 3D stencil does 8 FLOPs per 20 bytes of DRAM traffic. It runs on an AWS Graviton4: 96 Neoverse V2 cores, each doing 16 double-precision FLOPs per cycle at 2.8 GHz, with 430 GB/s of measured socket bandwidth. A single thread can sustain at most 28 GB/s because of the misses it can keep in flight. Assume threads share bandwidth evenly and memory latency doesn't rise with load. What speedup does going from 1 to 96 threads give? Would a 32-core part with the same memory system be any slower? At what intensity would the 96-core part start to pull ahead?</p>`,
        a: `<p>The intensity is 8 / 20 = 0.4 FLOP per byte. One core peaks at 16 × 2.8 = 44.8 GFLOP/s. One thread is bounded by min(44.8, 0.4 × 28) = 11.2 GFLOP/s, so it is bandwidth-bound by its own memory-level parallelism. With n threads the bandwidth is min(28n, 430) GB/s, which saturates at 430 / 28 ≈ 15.4 threads. Beyond that, the socket gives 0.4 × 430 = 172 GFLOP/s, so 96 threads are about <strong>15.4× faster</strong> than one, and the last 80 threads add nothing.</p><p>A 32-core part peaks at 32 × 44.8 = 1,433.6 GFLOP/s, and its bandwidth also saturates at 430 GB/s, so it also delivers <strong>172 GFLOP/s</strong>. It is no slower.</p><p>The two parts differ only once the 32-core part becomes compute-bound: at 1,433.6 / 430 ≈ <strong>3.3 FLOP per byte</strong>. That is about 8× the stencil's intensity, more than temporal blocking usually achieves for a 7-point stencil. Below 3.3, buy bandwidth, not cores. If the assumptions fail, the picture gets worse for the bigger part: loaded latency rises near saturation, so per-thread bandwidth falls and adding threads can even slow the kernel down.</p>`
      },
      {
        q: `<p>In your simulator you grow the per-core L2 from 1 MB to 2 MB and rerun a 3D stencil whose working planes didn't fit in the old L2 but fit in the new one. It runs 30% faster. Describe how its point moves on a DRAM roofline and on a cache-aware roofline, and whether any roof moves. Assume the L2's bandwidth and latency don't change.</p>`,
        a: `<p>No roof moves. Cache capacity doesn't change peak FLOP/s or any level's bandwidth, and the question fixes L2 bandwidth and latency.</p><p>On the DRAM roofline (bytes counted at the memory controller), the point moves <strong>right and up</strong>. Planes that were refetched from DRAM now hit in L2, so DRAM bytes per FLOP fall and the intensity rises. If the kernel was on the DRAM roof before, it slides up along the diagonal. If the 30% speedup is smaller than the intensity gain, the point now sits below the roof, so a different limit has taken over, often the L2 or L3 roof or a ceiling.</p><p>On the cache-aware roofline (bytes counted at the core as load and store instructions), the intensity is a property of the instruction stream and doesn't change, so the point moves <strong>straight up</strong>. It rises from near the L3 roof toward the L2 roof, which shows directly that the kernel now runs out of L2. The two views agree: the DRAM roofline says it moves fewer bytes from memory, and the cache-aware one says which level now feeds it.</p>`
      },
      {
        q: `<p>A hand count says a double-precision CSR SpMV should have a DRAM intensity of 2 / 12 ≈ 0.167 FLOP per byte, assuming every access to the vector <code>x</code> hits in cache. Counters (FLOPs from the core, bytes from memory-controller CAS counts × 64 B) say 0.09, and the measured GFLOP/s sits right on the DRAM roof at that intensity. The matrix is far larger than the caches, lines are 64 bytes, and the run is alone on one socket. Is the kernel well optimized? Where do the extra bytes come from, and what would you try?</p>`,
        a: `<p>It is using the memory system well, since it sits on the roof, but it moves too many bytes. Being on the roof at the wrong intensity means the fix is fewer bytes, not more parallelism or vectorization.</p><p>The measured intensity means 2 / 0.09 ≈ 22.2 bytes per nonzero against the 12 expected, about 10.2 extra bytes. The most likely source is <code>x</code>. Its accesses follow the column indices, so they are irregular, and a miss costs a whole 64-byte line, not 8 bytes. 10.2 / 64 ≈ 16% of <code>x</code> accesses missing to DRAM would explain all of it. Other candidates, each checkable:</p><ul><li>Prefetcher overfetch on the irregular <code>x</code> stream (adjacent-line prefetch pulls a second line).</li><li>Write-allocate reads on <code>y</code>, which matter only if rows have few nonzeros.</li><li>Row-pointer traffic, which is also significant only for very short rows.</li></ul><p>Masked FLOP counting would push the measured intensity up, not down, so it isn't the cause. To fix it, reorder the matrix (reverse Cuthill-McKee or a graph partitioner) so column indices cluster and lines of <code>x</code> get reused, or block the columns so each block's slice of <code>x</code> fits in L2. Also compress the indices or values (16-bit column deltas, FP32 values where accuracy allows). Then re-measure: success is the intensity moving toward 0.167 while the point stays on the roof.</p>`
      }
    ]
  }
},

{
  id: "perf-validation",
  region: "perf",
  title: "Validating a Performance Model",
  sections: [
    { id: "what", label: "What Validation Means" },
    { id: "errors", label: "Kinds of Error" },
    { id: "micro", label: "Microbenchmarks Structure by Structure" },
    { id: "metrics", label: "Error Metrics" },
    { id: "process", label: "A Correlation Process" }
  ],
  body: `
<p>A performance model is a claim about hardware that doesn't exist yet. Validation is how a team earns the right to trust it: compare it against a reference (RTL simulation, emulation, an earlier chip, or the new silicon), find where it disagrees, and fix either the model or the understanding. <a href="#/ipc-spec">IPC and Simulation Methodology</a> covers sampling and the sources of error; this page covers how correlation is actually done.</p>

<h3 id="sec-what">What Validation Means</h3>
<p>Two different questions, and teams often need both:</p>
<ul>
<li><strong>Absolute accuracy:</strong> does the model predict the IPC the chip will achieve? Needed for performance projections and commitments to customers.</li>
<li><strong>Relative accuracy:</strong> when the design changes (bigger ROB, new prefetcher), does the model predict the direction and size of the change? This is what design decisions depend on, and a model can have it while being off in absolute terms, as long as its errors don't depend on the change being evaluated.</li>
</ul>

<h3 id="sec-errors">Kinds of Error</h3>
<ul>
<li><strong>Specification error:</strong> the model implements what the documents say, and the documents (or the modeler's reading of them) differ from the RTL: a queue size, an arbitration policy, a latency.</li>
<li><strong>Abstraction error:</strong> details deliberately left out (bank conflicts, exact predictor update timing, replay mechanisms) that turn out to matter for some workload.</li>
<li><strong>Bugs:</strong> the model doesn't do what its author intended. A model that is "too fast" often has a bug that lets something bypass a limit.</li>
<li><strong>Reference error:</strong> the thing you compare against is also imperfect: an emulator with a fake memory system, silicon with different firmware settings, or performance counters with known inaccuracies.</li>
</ul>
<p>Desikan, Burger, and Keckler's 2001 study of an Alpha 21264 simulator showed how these stack up: simulators that hadn't been checked against the real chip had large errors, and matching the chip on microbenchmarks didn't guarantee matching it on full applications.</p>

<h3 id="sec-micro">Microbenchmarks Structure by Structure</h3>
<p>Comparing SPEC IPC first tells you the model is wrong but not where. Correlation starts with microbenchmarks that each isolate one parameter, run on both the model and the reference:</p>
<div class="tbl"><table>
<tr><th>Parameter</th><th>Microbenchmark</th><th>What the curve shows</th></tr>
<tr><td>Cache and TLB latencies and sizes</td><td>Pointer chase through a randomly linked array, sweeping the array size</td><td>Steps in latency at each capacity; the step heights are the latencies</td></tr>
<tr><td>Bandwidth at each level</td><td>Streaming loads (and separately stores) over arrays sized for each level</td><td>Plateaus in bytes per cycle</td></tr>
<tr><td>ROB size</td><td>Two independent cache-missing loads separated by N filler instructions, sweeping N</td><td>Time per iteration doubles once N exceeds the window: the misses stop overlapping</td></tr>
<tr><td>Physical registers, load queue, store queue, scheduler</td><td>The same, with filler that consumes only that resource (register writes, loads, stores, dependent instructions)</td><td>The knee moves to that structure's size</td></tr>
<tr><td>Execution ports and latencies</td><td>Long chains of one instruction (latency) and many independent copies (throughput)</td><td>Cycles per instruction for each</td></tr>
<tr><td>Branch predictor</td><td>Patterns of increasing period or history length; many branches to fill the BTB</td><td>Where the misprediction rate jumps</td></tr>
<tr><td>Memory-level parallelism</td><td>K independent pointer chases interleaved, sweeping K</td><td>Throughput rises with K until MSHRs or queues saturate</td></tr>
</table></div>
<p>The window-size technique was popularized by Henry Wong's measurements of reorder buffer capacity on real x86 cores; the same benchmarks run on the model expose a misconfigured structure in minutes.</p>

<h3 id="sec-metrics">Error Metrics</h3>
<ul>
<li><strong>Per-workload error:</strong> (model − reference) / reference. Report the mean of the absolute values (mean absolute percentage error), and the worst case; a small mean can hide one workload that is 40% off.</li>
<li><strong>Bias:</strong> the mean of the signed errors. A model that is consistently 8% optimistic is easier to use than one that is ±8% at random.</li>
<li><strong>Speedup error:</strong> for a design change, compare predicted and measured speedup per workload. This is the error that matters for decisions.</li>
<li><strong>Rank correlation:</strong> do the workloads (or design options) come out in the same order? Spearman's rank correlation summarizes it.</li>
<li><strong>Event-level error:</strong> MPKI, miss rates, and stall counts per structure. Matching IPC with wrong event counts means errors are canceling, and they won't cancel after the next design change.</li>
</ul>

<h3 id="sec-process">A Correlation Process</h3>
<ol>
<li><strong>Align configurations:</strong> same binary, same inputs, same compiler flags, same memory configuration and frequency, prefetchers and SMT set the same.</li>
<li><strong>Microbenchmarks first,</strong> until every structure's latency, size, and bandwidth match.</li>
<li><strong>Then small kernels</strong> (loops from real code) that combine two or three effects.</li>
<li><strong>Then full workloads,</strong> compared with a top-down breakdown on both sides, so a gap is attributed to front end, bad speculation, or a back-end resource.</li>
<li><strong>Fix the largest gap, rerun everything,</strong> and keep the whole suite as a regression, so a later model change can't silently break a parameter that was already correlated.</li>
<li><strong>Record what remains:</strong> known gaps and their direction go into every report the model produces.</li>
</ol>
<p class="refs">References: Desikan, Burger, and Keckler, "Measuring Experimental Error in Microprocessor Simulation," ISCA 2001 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1 (measuring and reporting performance) · Henry Wong, "Measuring Reorder Buffer Capacity" (blog.stuffedcow.net, 2013)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A model and the silicon give these IPCs on four workloads: A 2.10 vs 2.00, B 1.32 vs 1.20, C 0.62 vs 0.80, D 3.04 vs 3.20 (model first). Compute each error, the mean absolute percentage error, and the bias. Is the workload ranking preserved?</p>`,
        a: `<ol><li>A: (2.10 − 2.00) / 2.00 = +5%. B: (1.32 − 1.20) / 1.20 = +10%. C: (0.62 − 0.80) / 0.80 = −22.5%. D: (3.04 − 3.20) / 3.20 = −5%.</li><li>Mean absolute error: (5 + 10 + 22.5 + 5) / 4 ≈ <strong>10.6%</strong>.</li><li>Bias: (5 + 10 − 22.5 − 5) / 4 ≈ <strong>−3.1%</strong>: small on average, because errors in both directions cancel.</li><li>Ranking: silicon D &gt; A &gt; B &gt; C; model D &gt; A &gt; B &gt; C. <strong>Preserved.</strong></li><li>C is the one to investigate: the lowest-IPC workload is usually memory-bound, so a 22% pessimistic error points at the memory system (MLP, prefetcher, or DRAM latency) rather than the core.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Design the microbenchmark that measures a core's reorder buffer size, explain what curve you expect, and say what could make the measured value differ from the real ROB size.</p>`,
        a: `<p>Build a loop body of: a load that misses to DRAM, N filler instructions that don't depend on it, then a second independent DRAM-missing load, using random pointers so prefetchers can't help. Sweep N. While both loads fit in the window (N + 2 ≤ ROB entries), their misses overlap and each iteration costs about one DRAM latency; once N exceeds the window, the second load can't enter until the first retires, and the time per iteration roughly doubles. The knee is the ROB size.</p><p>Pitfalls: the filler must not consume a smaller resource first. Instructions that write registers can exhaust the physical register file first, so the usual filler is NOPs, which take a ROB entry but no register or execution port. Know the micro-op count of the filler: long NOPs and fused pairs may count differently than you expect. And with SMT, the ROB may be split between threads, so run with the sibling thread idle.</p>`
      }
    ]
  }
},

{
  id: "perf-power",
  region: "perf",
  title: "Power and Energy Modeling",
  sections: [
    { id: "basics", label: "Where Power Goes" },
    { id: "events", label: "Event-Based Energy Models" },
    { id: "costs", label: "What Operations Cost" },
    { id: "dvfs", label: "Voltage and Frequency" },
    { id: "metrics", label: "Metrics and Power Limits" }
  ],
  body: `
<p>Every modern chip is power-limited: a phone by its battery and skin temperature, a server by its socket power and cooling. A feature that adds 2% IPC and 3% power can make the chip slower once the power limit forces a lower clock. So performance models are paired with power models, and design decisions are made on performance per watt.</p>

<h3 id="sec-basics">Where Power Goes</h3>
<div class="math">\\[ P = \\underbrace{\\alpha \\, C \\, V^2 f}_{\\text{dynamic}} + \\underbrace{V \\, I_{leak}}_{\\text{static}} \\]</div>
<ul>
<li><strong>Dynamic power</strong> is spent charging and discharging capacitance C when signals switch, at activity factor α (the fraction of capacitance switched per cycle), supply voltage V, and frequency f.</li>
<li><strong>Static (leakage) power</strong> flows whenever a block is powered, switching or not. It grows steeply with temperature and with lower threshold voltages, which is why idle blocks are clock-gated (stops dynamic power) and, for longer idle periods, power-gated (stops leakage too, at the cost of wake-up time and lost state).</li>
</ul>
<p>The circuit side of these terms is on <a href="#/transistors">Transistor Physics and Energy</a>.</p>

<h3 id="sec-events">Event-Based Energy Models</h3>
<p>Architects estimate dynamic energy from the same event counts the performance model already produces:</p>
<div class="math">\\[ E = \\sum_{\\text{events } e} N_e \\, E_e \\; + \\; P_{static} \\, T \\]</div>
<p>Each structure has an energy per access (a cache read, a register file write, a scheduler wake-up, an ALU operation), estimated from its size, ports, and technology. Wattch (Brooks, Tiwari, and Martonosi, 2000) attached such estimates to a cycle-level simulator; McPAT (Li et al., 2009) added area, timing, and leakage models for full multicore chips and is still the common academic choice. In industry, the per-event energies are calibrated from RTL power analysis of the actual blocks (gate-level simulation with switching activity), then from silicon.</p>
<p>The accuracy rules are the same as for performance: absolute numbers from analytical tools can be off by a lot, but trends between design points are more trustworthy when the model has been calibrated on the blocks that change.</p>

<h3 id="sec-costs">What Operations Cost</h3>
<p>Horowitz's widely used 45 nm estimates (ISSCC 2014) show where the energy actually goes:</p>
<div class="tbl"><table>
<tr><th>Operation</th><th>Energy</th></tr>
<tr><td>32-bit integer add</td><td>0.1 pJ</td></tr>
<tr><td>32-bit floating-point add</td><td>0.9 pJ</td></tr>
<tr><td>32-bit floating-point multiply</td><td>3.7 pJ</td></tr>
<tr><td>64-bit read from an 8 KB SRAM</td><td>10 pJ</td></tr>
<tr><td>64-bit read from a 32 KB SRAM</td><td>20 pJ</td></tr>
<tr><td>64-bit read from a 1 MB SRAM</td><td>100 pJ</td></tr>
<tr><td>64-bit read from DRAM</td><td>1.3 to 2.6 nJ</td></tr>
</table></div>
<p>Newer nodes lower every number, but the ratios hold: moving data costs far more than computing on it, and a DRAM access costs as much as thousands of additions. In an out-of-order core, the arithmetic itself is a small fraction of the energy per instruction; fetch, decode, rename, scheduling, register file, and data movement take most of it. That is the overhead SIMD, accelerators, and caches near compute all attack.</p>

<h3 id="sec-dvfs">Voltage and Frequency</h3>
<p>Within the usable range, the maximum frequency rises roughly linearly with voltage (the transistor-level reason is in <a href="#/transistors">Transistor Physics and Energy</a>). So dynamic power grows roughly with f<sup>3</sup> (V<sup>2</sup> × f with V ∝ f), while dynamic energy per operation grows with V<sup>2</sup>, roughly f<sup>2</sup>. That is why:</p>
<ul>
<li>the last few hundred MHz of turbo cost a disproportionate amount of power;</li>
<li>a chip at a fixed power limit gets more total throughput from more cores at a lower clock (if the work is parallel);</li>
<li>below a certain voltage, leakage and the minimum operating voltage stop the savings, and racing to finish then sleeping becomes better.</li>
</ul>

<h3 id="sec-metrics">Metrics and Power Limits</h3>
<ul>
<li><strong>Performance per watt</strong> (equivalently, operations per joule): the main efficiency metric.</li>
<li><strong>Energy-delay product (EDP)</strong> and <strong>ED²P</strong>: weight energy against speed; ED²P is roughly independent of voltage scaling, so it compares designs fairly when either can be retuned in voltage.</li>
<li><strong>Performance at a power limit:</strong> the decision metric for a power-capped part. Model the change, recompute power, and let the frequency drop until power is back at the cap; then compare performance.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1 (trends in power and energy) · Brooks, Tiwari, and Martonosi, "Wattch: A Framework for Architectural-Level Power Analysis and Optimizations," ISCA 2000 · Li et al., "McPAT: An Integrated Power, Area, and Timing Modeling Framework for Multicore and Manycore Architectures," MICRO 2009 · Horowitz, "Computing's Energy Problem (and What We Can Do About It)," ISSCC 2014</p>`,
  practice: {
    guided: [
      {
        q: `<p>A CPU-bound task runs on a core that drops its clock by 20% and its voltage by 10%. Ignoring leakage, how do dynamic power, run time, and dynamic energy for the task change?</p>`,
        a: `<ol><li>Power ∝ V<sup>2</sup> f: 0.9<sup>2</sup> × 0.8 = 0.81 × 0.8 = <strong>0.648</strong>, a 35% cut.</li><li>Time: a CPU-bound task scales with 1 / f, so 1 / 0.8 = <strong>1.25×</strong> as long.</li><li>Energy = power × time: 0.648 × 1.25 = <strong>0.81</strong>, a 19% saving. It equals the V<sup>2</sup> ratio, as expected: energy per operation depends on voltage, not frequency.</li><li>If the task were memory-bound, its time would grow less than 25%, and the energy saving would be larger.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A larger branch predictor raises IPC by 2% and core power by 1.5%. The part always runs at its power limit, and power scales roughly with f<sup>3</sup>. Is the predictor worth it? At what power increase would it break even?</p>`,
        a: `<p>At the cap, the frequency must drop until power returns to the limit: 1.015 × f<sup>3</sup> = 1, so f falls by a factor of 1.015<sup>−1/3</sup> ≈ 0.995. Performance ∝ IPC × f = 1.02 × 0.995 ≈ <strong>1.015</strong>, so the gain shrinks from 2% to about 1.5%: still worth it.</p><p>Break-even: 1.02 × (1 + p)<sup>−1/3</sup> = 1, so 1 + p = 1.02<sup>3</sup> ≈ 1.061. A feature costing more than about <strong>6% power</strong> for 2% IPC makes a power-capped part slower. In general, with P ∝ f<sup>3</sup>, a feature pays off at the cap when its IPC gain exceeds a third of its power cost. The caveat: if the part is limited by temperature or current rather than average power, or isn't at its limit, the rule changes.</p>`
      }
    ]
  }
}
]);
