/* Section: EDA stack
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "eda"). */

section({
  id: "eda",
  name: "EDA Stack",
  cap: "From performance model to tapeout, stage by stage",
  body: `
<p>The EDA (electronic design automation) stack is the chain of tools and steps that takes a chip from an idea to the data a factory manufactures: performance modeling, RTL design, verification, emulation, synthesis, design for test, physical design, signoff, and tapeout.</p>
<p>Start with <a href="#/eda-why">Why EDA matters</a> for the big picture, or jump straight to any stage below.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Name what each stage of the stack hands to the next: performance modeling → RTL design → logic synthesis → design for test → physical design → signoff → tapeout.</p>`,
        a: `<ol><li>Performance modeling → RTL design: a <strong>microarchitecture specification</strong> (structure sizes, widths, latencies) backed by model results.</li><li>RTL design → synthesis: <strong>RTL</strong> (SystemVerilog), verified against the spec.</li><li>Synthesis → design for test: a <strong>gate-level netlist</strong> mapped to the standard-cell library.</li><li>Design for test → physical design: the netlist with <strong>scan chains and test logic</strong> inserted.</li><li>Physical design → signoff: a placed and routed <strong>layout</strong>.</li><li>Signoff → tapeout: the layout once it passes timing, power, and physical checks, written out as <strong>GDSII or OASIS</strong> for mask making.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do teams spend so much effort finding bugs early, in the performance model and RTL simulation, rather than relying on emulation or silicon? Give rough costs.</p>`,
        a: `<p>A bug's cost grows at every stage. In the performance model or early RTL, a fix is an edit and a rerun: hours. Late in physical design it may need an ECO that patches the netlist and reruns parts of signoff: days to weeks. After tapeout, a fix needs new masks; for a leading-edge node, a full mask set is commonly estimated at well over ten million dollars, plus several months of fab time, plus the lost market window. Silicon also gives the least visibility: no waveforms, only a few debug signals. So each earlier stage is worth heavy investment: the cost per bug found is far lower and debug is far faster.</p>`
      }
    ]
  }
}, [
{
  id: "eda-why",
  region: "eda",
  title: "Why EDA Matters",
  sections: [{ id: "why", label: "Why It Matters" }, { id: "why-improve", label: "Why Improving It Matters" }, { id: "flow", label: "The Flow" }, { id: "perf-connect", label: "Where Performance Work Connects" }],
  body: `
<p>Electronic design automation (EDA) tools carry a chip from RTL to manufacturing data. The three big vendors are Synopsys, Cadence, and Siemens EDA.</p>
<p>Each stage has its own page in this section, with detailed descriptions and reference links.</p>
<h3 id="sec-why">Why the EDA Stack Matters</h3>
<p>Electronic design automation is the software (plus specialized hardware like emulators, and services) used to design chips. Designers once drew circuits by hand with separate, disconnected tools; with billions of connections and many teams working on one chip, that's no longer possible. EDA is where a chip is built and checked in a virtual world before anything is manufactured.</p>
<ul>
<li><strong>It makes modern chips possible at all.</strong> No team could place billions of transistors, route their wires, or check every timing path by hand. EDA tools handle the complexity that comes from packing more and more features into one system-on-chip.</li>
<li><strong>It predicts behavior before silicon exists.</strong> Simulation lets engineers check whether a design will be fast and accurate enough for its job (for example, whether a car's driving chip processes sensor data in time) instead of discovering problems after fabrication.</li>
<li><strong>It proves the design is correct.</strong> Verification confirms the chip does what the spec says and that everything is connected properly, which is what makes a design ready for production.</li>
<li><strong>It makes designs manufacturable and reliable.</strong> Design-for-manufacturing checks make sure the layout meets the fab's process requirements, since violating them hurts yield and reliability.</li>
<li><strong>It sets power, performance, and area.</strong> The quality of synthesis, placement, and routing directly determines how fast a chip runs, how much power it uses, and how big (and costly) it is.</li>
<li><strong>It sets the schedule.</strong> How quickly a team gets through verification and timing closure largely decides time to market.</li>
</ul>
<h3 id="sec-why-improve">Why Improving It Matters</h3>
<ul>
<li><strong>Complexity grows faster than teams.</strong> Each generation adds transistors, features, and now multiple chiplets in one package, but design teams don't grow at the same rate. Tools have to raise productivity per engineer just to keep schedules flat.</li>
<li><strong>Time to market is a competitive weapon.</strong> Customers expect new products quickly. The industry's answer is "shift left": finding problems and starting software work earlier, for example with emulation and prototyping before silicon, so less is left for the end of the schedule.</li>
<li><strong>Mistakes are extremely expensive.</strong> A bug that escapes to silicon can force a respin that costs months and millions of dollars, so better verification pays for itself.</li>
<li><strong>Better tools mean better chips on the same process.</strong> As each new process node delivers smaller gains, extracting more performance and lower power from a given node through better optimization matters more.</li>
<li><strong>Compute demand keeps rising.</strong> Simulation, emulation, and signoff runs need enormous compute; cloud-based EDA adds elastic capacity for faster runs and easier collaboration across sites.</li>
<li><strong>AI is changing the tools themselves.</strong> Machine learning and agentic AI are being applied across the flow (simulation, verification, emulation, implementation) to automate tedious work and explore more design options, which is where both the large EDA vendors and AI-native startups are investing.</li>
</ul>
<div class="callout"><strong>Where Normal Computing fits:</strong> Normal Computing is one of these AI-native startups. <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a> targets the specification-to-verification part of the stack: reading the specs written during <a href="#/eda-arch">architecture and modeling</a> and generating the plans, stimulus, assertions, and coverage used in <a href="#/eda-verif">functional verification</a>. It doesn't replace simulators, synthesis, or physical design tools; it works alongside them. The company also designs its own chips, which go through the full stack through <a href="#/eda-tapeout">tapeout</a>.</div>
<p><strong>For a performance engineer,</strong> a better EDA stack means a shorter loop from idea to trustworthy measurement: faster models, earlier RTL, and emulation that runs real workloads sooner, so design decisions are made with better data.</p>
<p class="refs">References: <a href="https://www.cadence.com/en_US/home/explore/what-is-electronic-design-automation.html" target="_blank" rel="noopener">What is Electronic Design Automation (EDA)? (Cadence)</a></p>
<h3 id="sec-flow">The Flow</h3>
<div class="tbl"><table>
<tr><th>Stage</th><th>What happens</th><th>Typical tools</th></tr>
<tr><td><a href="#/eda-arch">Architecture and performance modeling</a></td><td>Explore ideas in C++ cycle-level models</td><td>In-house simulators, gem5, ChampSim</td></tr>
<tr><td><a href="#/eda-rtl">RTL design</a></td><td>Write the hardware in Verilog or SystemVerilog</td><td>Editors, lint (SpyGlass)</td></tr>
<tr><td><a href="#/eda-verif">Functional verification</a></td><td>Simulation with UVM testbenches, formal proofs</td><td>VCS, Xcelium, Questa; JasperGold, VC Formal</td></tr>
<tr><td><a href="#/eda-emu">Emulation and prototyping</a></td><td>Run RTL fast enough for real software</td><td>Palladium, ZeBu, Veloce; FPGA prototypes</td></tr>
<tr><td><a href="#/eda-synth">Logic synthesis</a></td><td>RTL to a gate-level netlist</td><td>Design Compiler, Fusion Compiler, Genus</td></tr>
<tr><td><a href="#/eda-dft">Design for test</a></td><td>Scan chains, test pattern generation</td><td>Tessent, TetraMAX</td></tr>
<tr><td><a href="#/eda-pd">Physical design</a></td><td>Floorplan, placement, clock tree, routing</td><td>IC Compiler II, Fusion Compiler, Innovus</td></tr>
<tr><td><a href="#/eda-signoff">Signoff</a></td><td>Timing, power, DRC/LVS, equivalence</td><td><ul><li>PrimeTime, Tempus</li><li>Voltus, PrimePower</li><li>Calibre</li><li>Formality, Conformal</li></ul></td></tr>
<tr><td><a href="#/eda-tapeout">Tapeout</a></td><td>Final layout (GDSII/OASIS) goes to the foundry</td><td></td></tr>
</table></div>
<h3 id="sec-perf-connect">Where Performance Work Connects</h3>
<ul><li>Latencies in the model come from timing closure; when physical design adds a stage, the model must follow.</li><li>Correlation against RTL simulation and emulation keeps the model honest.</li><li>Power models are calibrated against gate-level power analysis.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Put these in order: synthesis, RTL design, performance modeling, place and route, functional verification, signoff, tapeout.</p>`,
        a: `<p>Performance modeling → RTL design → functional verification (runs alongside RTL) → synthesis → place and route → signoff → tapeout.</p>`
      },
      {
        q: `<p>Place each problem in the flow:</p><ul><li>(a) Cycle counts from your C++ model disagree with RTL on a microbenchmark</li><li>(b) A timing violation after place and route</li><li>(c) A mismatch between the netlist and RTL</li></ul>`,
        a: `<ol><li>(a) Model correlation, between <a href="#/eda-arch">architecture and performance modeling</a> and RTL simulation or <a href="#/eda-emu">emulation</a>.</li><li>(b) Static timing analysis during <a href="#/eda-pd">physical design</a> and <a href="#/eda-signoff">signoff</a>; the fix may change pipeline depth, which feeds back into the performance model.</li><li>(c) Equivalence checking during <a href="#/eda-signoff">signoff</a>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Timing closure forces an extra pipeline stage in the L1 load path. What do you do as the performance engineer?</p>`,
        a: `<p>Update the model's load-to-use latency, rerun the suite, and report the IPC cost per workload (pointer-chasing code like mcf will hurt most). Then propose mitigations to evaluate: better speculative wakeup, way prediction, or keeping a fast path for common cases.</p>`
      }
    ]
  }
},

{
  id: "eda-soc",
  region: "eda",
  title: "SoCs and Design Complexity",
  sections: [{ id: "what-soc", label: "What an SoC Is" }, { id: "relate", label: "How SoCs and EDA Relate" }, { id: "handle", label: "How EDA Handles the Complexity" }],
  body: `

<h3 id="sec-what-soc">What an SoC Is</h3>
<p>A system-on-chip puts an entire computer system on one piece of silicon instead of spreading it across many chips. A phone SoC (such as Apple's A-series or Qualcomm's Snapdragon) typically includes:</p>
<ul>
<li>CPU cores, a GPU, and an AI accelerator (NPU).</li>
<li>Caches and memory controllers.</li>
<li>Image, video, and audio processors, and often the cellular modem.</li>
<li>I/O controllers (USB, PCIe, display), security hardware, and power management.</li>
</ul>
<p>Older systems used separate chips for many of these. Putting them on one die saves power, space, and cost, and speeds up communication between them. The price is that one design now contains many different subsystems, each with its own clocks, power domains, and protocols.</p>
<h3 id="sec-relate">How SoCs and EDA Relate</h3>
<p>An SoC is the thing being built; EDA is the set of tools used to build it. Think of a skyscraper: a one-room shed can be planned on paper, but a skyscraper with plumbing, electrical, elevators, and HVAC all interacting needs specialized design, simulation, and inspection tools. SoCs are the most complex designs being made today, so they set what EDA tools must be able to do. As chipmakers pack more subsystems onto one chip, the tools have to keep up, and in turn, EDA capability limits how complex an SoC a team can realistically build and verify on schedule.</p>
<div class="tbl"><table>
<tr><th>What SoC integration adds</th><th>What the tools must provide</th></tr>
<tr><td>More blocks</td><td>Hierarchical design flows and reuse of pre-built IP</td></tr>
<tr><td>Many clock domains</td><td>Checks that signals cross safely between clock domains</td></tr>
<tr><td>Many power domains</td><td>Power-intent descriptions and power-aware simulation</td></tr>
<tr><td>Hardware and software working together</td><td>Emulation and virtual platforms to run real software before silicon</td></tr>
<tr><td>More transistors overall</td><td>More compute and smarter automation for synthesis, layout, and signoff</td></tr>
</table></div>
<h3 id="sec-handle">How EDA Tools Handle the Complexity</h3>
<ul>
<li><strong>Hierarchy:</strong> the chip is split into blocks that are designed, verified, synthesized, and laid out separately, then assembled. Tools build compact models of finished blocks so top-level analysis doesn't reprocess every gate.</li>
<li><strong>IP reuse:</strong> much of an SoC is licensed, pre-verified building blocks (CPU cores, PCIe and DDR controllers), plus matching verification IP that already knows how to test those protocols. Teams design only what makes their chip different.</li>
<li><strong>Higher abstraction:</strong> engineers describe intent and tools fill in the detail: RTL instead of gates, high-level synthesis from C++ for some blocks, and constraint and power-intent files describing timing and power domains across the chip.</li>
<li><strong>Integration checks:</strong> the hardest SoC bugs are often between blocks rather than inside them, so tools check connectivity, clock-domain crossings, and power-domain behavior. See <a href="#/verif-overview/soc-verif">SoC-level verification</a>.</li>
<li><strong>Compute at scale:</strong> regressions run in parallel across server farms or the cloud, and <a href="#/eda-emu">emulators</a> run the full chip with real software, the only practical way to test everything together before silicon.</li>
<li><strong>Shift left:</strong> virtual platforms and emulation let software teams start before hardware is finished, so integration problems surface earlier.</li>
<li><strong>Multi-die and AI:</strong> newer tools handle multiple chiplets packaged together, and machine learning automates tuning and repetitive work.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Match each SoC integration challenge to the EDA capability that handles it: (a) dozens of blocks designed by different teams, (b) blocks running on different clocks, (c) blocks that power off to save energy, (d) firmware that must run before silicon exists, (e) standard interfaces like PCIe and DDR.</p>`,
        a: `<ol type="a"><li>Hierarchical design flows: design, verify, and lay out blocks separately, then assemble.</li><li>Clock-domain crossing checks.</li><li>Power-intent descriptions and power-aware simulation.</li><li>Emulation and virtual platforms.</li><li>Licensed, pre-verified IP plus matching verification IP.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is an SoC, and why does SoC integration create new requirements for EDA tools? Give three specific examples.</p>`,
        a: `<p>A system-on-chip combines an entire computer system (CPU cores, GPU, accelerators, memory controllers, I/O, power management) on one die. Integration saves power, space, and cost, but puts many subsystems with different clocks, power domains, and protocols into one design. Examples: many clock domains require clock-domain-crossing checks; many power domains require power-intent descriptions and power-aware simulation; hardware and software interacting require emulation to run real firmware before silicon. More generally, hierarchy and IP reuse are what keep a design this large manageable.</p>`
      }
    ]
  }
},

{
  id: "eda-ppa",
  region: "eda",
  title: "Power, Performance, and Area",
  sections: [{ id: "ppa", label: "How Tools Improve PPA" }, { id: "vt-decisions", label: "Leaky vs. Low-Leakage Cells" }],
  body: `
<h3 id="sec-ppa">How EDA Tools Improve Power, Performance, and Area</h3>
<p>They help in two ways: they optimize the design automatically at every stage, and they measure PPA accurately enough that engineers can make real trade-offs instead of padding everything with safety margin.</p>
<ul>
<li><strong><a href="#/eda-arch">Architecture and modeling</a>:</strong> performance and power models compare options (cache sizes, pipeline depth, number of units) before RTL exists, so the biggest PPA decisions are made with data.</li>
<li><strong><a href="#/eda-synth/synth-ppa">Synthesis</a>:</strong> restructures logic, picks the smallest cell that meets timing, uses fast leaky cells only where needed, shares hardware, and inserts clock gating, all driven by the team's targets.</li>
<li><strong><a href="#/eda-pd/vt-pd">Physical design</a>:</strong> places communicating cells close together to shorten wires, resizes and buffers slow paths, builds a clock tree that balances skew against power, and adds power gating and multiple voltages for blocks that don't need full speed.</li>
<li><strong><a href="#/eda-signoff/vt-signoff">Analysis and signoff</a>:</strong> accurate timing analysis avoids wasteful margins; power analysis uses real switching activity from simulation or emulation to find hot spots worth fixing.</li>
<li><strong>AI-driven optimization:</strong> newer tools (such as Cadence Cerebrus and Synopsys DSO.ai) search thousands of tool settings and floorplan options to find better PPA than hand-tuning.</li>
</ul>
<p>PPA always involves trade-offs: a faster path usually means bigger or leakier cells. The tools don't remove the trade-off; they find a better balance point for the targets the team sets.</p>
<h3 id="sec-vt-decisions">Leaky vs. Low-Leakage Cells: Where the Decisions Are Made</h3>
<p>The cell-by-cell choices are made automatically by the tools, within rules and budgets that engineers set. For what these cells are and why leakage matters, see <a href="#/transistors/vt-flavors">Threshold-voltage flavors</a>.</p>
<ol>
<li><strong>Flow setup (before synthesis):</strong> the team decides which threshold-voltage flavors are allowed, often with limits such as a maximum percentage of low-V<sub>th</sub> cells, or high-V<sub>th</sub> only for always-on blocks. These limits come from the power budget and frequency target.</li>
<li><strong><a href="#/eda-synth/synth-ppa">Logic synthesis</a>, the first pass:</strong> mostly low-leakage cells, with leaky, fast ones on paths that miss timing. Provisional, since wire delays are only estimated.</li>
<li><strong><a href="#/eda-pd/vt-pd">Physical design</a>, where most decisions become final:</strong> with real wire delays known, the tool swaps leaky cells onto paths that became too slow, then runs leakage recovery to swap cells back wherever slack allows.</li>
<li><strong><a href="#/eda-signoff/vt-signoff">Signoff</a>, final adjustments:</strong> timing checked at the slow corner and leakage at the hot, fast corner; remaining issues fixed with ECOs, where threshold-voltage swaps are a favorite because they don't change the layout.</li>
</ol>
<p><strong>Earlier stages shape how many leaky cells are needed</strong> without choosing individual cells: an aggressive frequency target from architecture creates more critical paths, and RTL designers can restructure a slow path (or add a pipeline stage) so it doesn't need leaky cells at all.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A path misses timing by 15 ps late in the schedule. List the possible fixes, roughly from least to most disruptive, and what each costs in power, performance, or area.</p>`,
        a: `<ol><li><strong>Swap cells to low-V<sub>th</sub>:</strong> no area change and no layout disturbance, but more leakage power.</li><li><strong>Upsize cells or add buffers:</strong> more area and switching power; may need small placement changes.</li><li><strong>Restructure the logic:</strong> design and verification time; may change the RTL.</li><li><strong>Add a pipeline stage:</strong> more latency, which can lower IPC, plus more flip-flops and clock power.</li><li><strong>Raise the supply voltage or lower the frequency:</strong> affects the whole chip's power or performance.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Where in the EDA flow is the choice between leaky and low-leakage cells made, and why is a threshold-voltage swap a popular fix late in the schedule?</p>`,
        a: `<p>Engineers set the rules at flow setup (allowed flavors, limits on leaky cells). Synthesis makes a provisional first pass using estimated wire delays. Physical design finalizes most choices once real delays are known: it swaps in fast cells where paths fail and runs leakage recovery to swap back where slack allows. Signoff makes final fixes through ECOs. Threshold-voltage swaps are popular late because the flavors of a cell share the same footprint, so a swap changes speed and leakage without moving any cells or disturbing the routed layout.</p>`
      }
    ]
  }
},

{
  id: "eda-arch",
  region: "eda",
  title: "Architecture and Performance Modeling",
  sections: [
    { id: "models", label: "Functional vs. Cycle-Level Models" },
    { id: "func-how", label: "How a Functional Model Computes" },
    { id: "perf-track", label: "How Performance Is Tracked" },
    { id: "abstract", label: "What a C Model Abstracts Away from RTL" },
    { id: "gem5", label: "How gem5 Works" },
    { id: "champsim", label: "How ChampSim Works" },
    { id: "inhouse", label: "Open-Source vs. In-House" }
  ],
  body: `
<p><strong>What happens.</strong> Architects decide how the chip will implement its instruction set (ISA): core width, pipeline depth, cache sizes, interconnect, accelerators. They test ideas in software models long before any hardware is written, because changing a model takes hours while changing RTL takes weeks.</p>
<p><strong>Starting point and result.</strong> This stage starts from the ISA, which already defines the architecture: the instructions, registers, and memory model that software sees. That is usually an existing standard such as Arm, x86, or RISC-V, sometimes with new extensions. It also starts from the product goals (performance targets, power and area budgets) and the workloads the chip must run well. It produces <strong>microarchitecture decisions</strong>: how the hardware will implement that ISA. Architects record those decisions in a microarchitecture specification document, which RTL designers build from. The performance model is the main tool for making those decisions, not the specification itself. It produces the performance projections behind each decision, and it stays in use afterward as the reference that RTL is correlated against.</p>
<p><strong>Why it matters.</strong> This is the cheapest place to change the design; a wrong decision here costs years later. Note the naming overlap: "simulation" in this stage means simulating a model of the hardware, not the RTL simulation in the <a href="#/eda-verif">Functional Verification</a> stage.</p>

<div class="callout"><strong>Where Normal Computing fits:</strong> the specification documents written in this stage are <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a>'s input. Its AI turns spec text, tables, and timing diagrams into a formal model and flags missing, unclear, or contradictory sections, so spec problems are caught before they become RTL bugs. With Fraunhofer IESE, Normal also built DRAMBench, a benchmark for how well AI translates memory specifications into formal timed models.</div>
<h3 id="sec-models">Functional Models vs. Cycle-Level Models</h3>
<p>Software models of a processor come in two basic kinds, which answer different questions.</p>
<p><strong>Functional models</strong> (instruction set simulators) answer "what does the program compute?" They execute instructions one at a time and update the architectural state (registers, memory, program counter) exactly as the ISA specifies, with no notion of time, pipelines, or caches:</p>
<pre><code>// Functional model: correct results, no timing
while (!halted) {
  uint32_t inst = mem_read32(pc);   // fetch
  decoded_t d   = decode(inst);     // what is it?
  execute(&amp;d, regs, mem);           // update registers / memory
  pc = d.next_pc;                   // follow the program
}</code></pre>
<ul>
<li><strong>Speed:</strong> very fast, from tens of millions of instructions per second for simple interpreters to far more for ones that translate code on the fly (like QEMU).</li>
<li><strong>Uses:</strong> running software before hardware exists, a "golden reference" that RTL results are checked against, generating instruction traces, and fast-forwarding a program to the interesting region before detailed simulation.</li>
<li><strong>Examples:</strong> QEMU, Spike (RISC-V), gem5's atomic CPU model, and most companies' internal reference models.</li>
</ul>
<p><strong>Cycle-level (timing) models</strong> answer "how long does it take, and why?" They model the microarchitecture's structures (fetch queue, ROB, issue queues, caches, DRAM) and advance them one cycle at a time, tracking when each instruction moves through each stage and where it waits:</p>
<pre><code>// Cycle-level model: every structure advances each cycle
for (cycle = 0; !done; cycle++) {
  commit();      // retire finished instructions from the ROB head
  writeback();   // complete operations whose latency has elapsed
  issue();       // pick ready instructions from the issue queues
  dispatch();    // rename; allocate ROB, IQ, and LSQ entries
  fetch();       // follow the branch predictor, fill the fetch queue
  cache_tick(); dram_tick();
  update_stats(); // occupancy, stalls by cause, misses, IPC
}</code></pre>
<p>The stages run in reverse pipeline order each cycle so every stage sees the state the previous stage left last cycle, like real pipeline registers. The output is cycles, IPC, and detailed event counts, such as how many cycles dispatch stalled because the ROB was full.</p>
<ul>
<li><strong>Speed:</strong> roughly a thousand times slower than a functional model or more; detailed models often run around hundreds of thousands to a few million instructions per second.</li>
<li><strong>"Cycle-level" vs. "cycle-accurate":</strong> most performance models are cycle-<em>level</em> (they model per-cycle behavior but simplify details). A truly cycle-<em>accurate</em> model matches the RTL cycle for cycle, which is expensive to build and slow, and is rare outside specific blocks.</li>
</ul>
<p><strong>How the two are combined:</strong></p>
<div class="tbl"><table>
<tr><th>Approach</th><th>How it works</th><th>Trade-off</th></tr>
<tr><td>Trace-driven</td><td>A functional model (or real hardware with an instrumentation tool) records an instruction trace once. The timing model then reuses that trace across many separate simulation runs, one per design option being compared (for example, three cache sizes or five prefetchers). This works because the program's correct-path instructions don't depend on the microarchitecture: a design change alters when instructions finish, not which ones run.</td><td>Simple and fast to iterate, but the trace contains only the correct path: no wrong-path instructions after mispredicts, and no feedback from timing to execution</td></tr>
<tr><td>Execution-driven</td><td>The timing model executes instructions itself as they move through the modeled pipeline</td><td>Models wrong-path execution and timing-dependent behavior (such as multithreaded races), but is more complex and slower</td></tr>
<tr><td>Functional-first</td><td>A functional model runs ahead and feeds instructions to a separate timing model, with corrections when they diverge</td><td>Keeps the functional model reusable and verified, with extra complexity to handle mispredicted paths</td></tr>
</table></div>
<p>Because detailed simulation is slow, studies don't simulate whole programs: they fast-forward functionally to representative regions (chosen with methods like SimPoints), warm up caches and predictors, then simulate a few hundred million instructions in detail.</p>

<h3 id="sec-func-how">How a Functional Model Knows What the Program Computes</h3>
<p>A functional model doesn't read a trace to learn the answer; it <strong>computes</strong> the answer by executing the program itself, the way the ISA says a processor must.</p>
<ol>
<li><strong>Load the program.</strong> The model reads the compiled binary (for example, an ELF file), copies its code and data into the model's simulated memory, and sets the PC to the program's entry point.</li>
<li><strong>Hold the architectural state as plain data structures:</strong> an array for the registers, a variable for the PC, a sparse map of memory pages, and the control and status registers.</li>
<li><strong>Run the fetch-decode-execute loop:</strong> read the instruction at the PC, decode it, perform its effect on that state, and compute the next PC.</li>
<li><strong>Handle the outside world:</strong> it emulates system calls (so <code>printf</code> or file reads work) or models devices if it boots a full operating system.</li>
</ol>
<pre><code>struct ArchState { uint32_t pc; uint32_t x[32]; Memory mem; };

void step(ArchState &amp;s) {
  uint32_t inst = s.mem.read32(s.pc);
  Decoded d = decode(inst);
  uint32_t next = s.pc + 4;
  switch (d.op) {
    case ADD: s.x[d.rd] = s.x[d.rs1] + s.x[d.rs2];          break;
    case LW:  s.x[d.rd] = s.mem.read32(s.x[d.rs1] + d.imm); break;
    case SW:  s.mem.write32(s.x[d.rs1] + d.imm, s.x[d.rs2]); break;
    case BEQ: if (s.x[d.rs1] == s.x[d.rs2]) next = s.pc + d.imm; break;
    // ... every other instruction in the ISA
  }
  s.x[0] = 0;   // RISC-V register x0 always reads as zero
  s.pc = next;
}</code></pre>
<p>"What the program computes" is simply this state as it evolves: register values, memory contents, the program's printed output, and its exit code.</p>
<p><strong>Traces are an output, not an input.</strong> Because the model knows every instruction and every value, it can <em>write</em> traces as it runs: instruction traces for trace-driven timing models, and retirement logs for comparison against RTL in <a href="#/verif-refmodel/ref-compare">functional verification</a>.</p>
<p><strong>How the model itself is trusted.</strong> The functional model defines the correct answer, so it has to be checked too: against ISA compliance test suites, self-checking programs that compute a known result and report pass or fail, and by running the same binaries on existing real hardware and comparing outputs.</p>

<h3 id="sec-perf-track">How Performance Is Tracked</h3>
<p>A cycle-level model tracks performance with statistics counters: ordinary variables in the model's code that are incremented whenever an event happens, the software equivalent of hardware performance counters. What gets counted, the causes of lost cycles, and how bottlenecks are classified are covered in the <a href="#/r/perf">Performance analysis</a> section: <a href="#/perf-stats">Performance statistics</a>, <a href="#/perf-stalls">Stall causes</a>, and <a href="#/perf-bottlenecks">Bottleneck types</a>.</p>
<h3 id="sec-abstract">What a C Cycle-Level Model Abstracts Away from RTL</h3>
<p>A C cycle-level model keeps <strong>when</strong> things happen (which cycle an instruction issues, how long a miss takes, when a structure fills up) but drops much of <strong>how</strong> the hardware does it. Typical examples:</p>
<div class="tbl"><table>
<tr><th>In the RTL</th><th>What the C model does instead</th></tr>
<tr><td><strong>Wires and handshakes:</strong> valid/ready signals, multi-beat bus transfers, per-wire protocols</td><td>A function call or a queue with a latency. “This 64-byte line takes 2 cycles on a 32-byte bus” becomes a counter, not individual beats.</td></tr>
<tr><td><strong>Data values in the pipeline</strong></td><td>Often not computed at all: a functional model executes the instruction, and the timing model only tracks dependencies and latencies. Values are used only where they change timing, such as branch outcomes, load addresses, or variable-latency division.</td></tr>
<tr><td><strong>Bit-level encodings:</strong> one-hot vs. binary state, packed instruction fields, pointer wrap bits</td><td>Plain C enums, structs, and integers. A decoded instruction is a struct, not 32 bits being sliced.</td></tr>
<tr><td><strong>Circuit structures:</strong> CAMs, age matrices, free-list bit vectors, SRAM arrays with read/write ports</td><td>A hash map for a CAM search, sequence numbers for age ordering, a queue for the free list, a counter for the number of ports used this cycle.</td></tr>
<tr><td><strong>Replacement state</strong></td><td>Pseudo-LRU bits are often replaced with timestamps (true LRU), unless the exact policy matters for accuracy.</td></tr>
<tr><td><strong>Coherence transient states</strong></td><td>Protocol transitions are often treated as atomic. In RTL, a line passes through intermediate states while waiting for acknowledgments.</td></tr>
<tr><td><strong>Arbitration details</strong></td><td>A simple rule such as “oldest first” instead of the exact round-robin and priority logic.</td></tr>
<tr><td><strong>Off-core memory</strong></td><td>DRAM and parts of the interconnect are modeled with fixed or simple latency and bandwidth limits instead of a full controller with refresh, bank timing, and scheduling.</td></tr>
<tr><td><strong>Physical timing</strong></td><td>No gate delays, setup and hold, or critical paths. Only cycle boundaries exist; a slow path shows up only as an extra cycle of latency the architect chose.</td></tr>
<tr><td><strong>Clocking and power</strong></td><td>Clock domains, clock gating, reset sequencing, and power states are usually absent or reduced to a single clock.</td></tr>
<tr><td><strong>Test and debug logic</strong></td><td>Scan chains, built-in self-test, debug ports, and performance-counter wiring are omitted. The model counts events directly in C.</td></tr>
<tr><td><strong>Error handling and rare features</strong></td><td>ECC and parity, error injection, machine checks, many control registers, and rarely used instructions are often missing or simplified.</td></tr>
</table></div>
<p><strong>What can’t be abstracted</strong> if the model is to stay cycle-accurate: anything that changes when events happen. That includes structure sizes, port and bank counts, pipeline depth, latencies, bandwidth limits, the issue width, and policies that change ordering, such as the scheduler’s selection rule or replay on a memory-ordering violation.</p>
<p>Each abstraction trades accuracy for speed and development time. Correlating the model against RTL on microbenchmarks shows which abstractions were safe. A common example is a model that assumed true LRU but disagrees with RTL on a cache-thrashing benchmark, because the real cache uses pseudo-LRU. Many teams therefore call their models “cycle-approximate” rather than “cycle-accurate.”</p>
<h3 id="sec-gem5">How gem5 Works</h3>
<p>gem5 is an open-source, execution-driven simulator widely used in academic architecture research. It's written in C++, and each simulation is configured with a Python script that builds a system out of components (CPUs, caches, memory controllers, devices) and connects them.</p>
<ul>
<li><strong>Event-driven core:</strong> instead of stepping every component every cycle, components schedule events on a global event queue at future ticks, and the simulator jumps from event to event.</li>
<li><strong>Interchangeable CPU models:</strong> a fast atomic model (essentially functional), a simple timing model, an in-order pipelined model (Minor), and a detailed out-of-order model (O3) with rename, ROB, issue queues, and load/store queues. A KVM-based model runs on the host's hardware virtualization for very fast fast-forwarding. You can switch models mid-run: fast-forward on a fast model, then switch to O3 for the region of interest.</li>
<li><strong>Two memory systems:</strong> a "classic" cache model that's fast and simple, and Ruby, which models cache coherence protocols in detail using a protocol description language.</li>
<li><strong>Two modes:</strong> syscall emulation runs a single user program and fakes the operating system calls; full-system mode boots a real Linux kernel, so it captures OS effects, devices, and multithreaded software.</li>
<li><strong>Multiple ISAs:</strong> including x86, Arm, and RISC-V.</li>
<li><strong>Output:</strong> a statistics file with hundreds of counters (IPC, misses at every level, stall reasons, occupancies), plus checkpoints so runs can restart from a saved state.</li>
</ul>
<p class="refs">References: <a href="https://www.gem5.org" target="_blank" rel="noopener">gem5 project site</a> · <a href="https://arxiv.org/pdf/2007.03152" target="_blank" rel="noopener">The gem5 Simulator: Version 20.0+ (paper)</a></p>

<h3 id="sec-champsim">How ChampSim Works</h3>
<p>ChampSim is an open-source, <strong>trace-driven</strong> simulator focused on the core's memory system and branch prediction. It's maintained at Texas A&amp;M with community support and came out of the architecture "championships" (data prefetching, cache replacement), where researchers compete on a shared set of traces.</p>
<ul>
<li><strong>Traces:</strong> a tracer built on Intel's Pin instrumentation tool records the instructions a real x86 program executes (addresses, register and memory operands, branch outcomes) into a compressed trace file. Public trace sets cover SPEC CPU and other benchmarks.</li>
<li><strong>The model:</strong> an out-of-order core with a ROB and branch predictor, a cache hierarchy (L1 instruction and data caches, L2, a shared last-level cache), TLBs, and DRAM. A JSON file configures sizes, latencies, and which components to use.</li>
<li><strong>Pluggable policies:</strong> branch predictors, prefetchers, and cache replacement policies are small C++ modules with a standard interface, so you can implement a new prefetcher in one file and compare it against published ones.</li>
<li><strong>Running:</strong> you specify warm-up and simulation instruction counts (for example 200 million to warm up, then 500 million measured). It reports IPC plus cache, prefetcher, and branch statistics, and supports multicore runs with one trace per core.</li>
<li><strong>Limits:</strong> as a trace-driven tool it doesn't model wrong-path instructions or real data values, traces are user-level only (no OS), and cores running separate traces don't share data, so it can't study real coherence behavior.</li>
</ul>
<p class="refs">References: <a href="https://github.com/ChampSim/ChampSim" target="_blank" rel="noopener">ChampSim repository</a> · <a href="https://dpc3.compas.cs.stonybrook.edu/champsim-traces/speccpu/" target="_blank" rel="noopener">DPC-3 SPEC CPU traces for ChampSim</a></p>

<h3 id="sec-inhouse">Open-Source Simulators vs. In-House Models</h3>
<div class="tbl"><table>
<tr><th></th><th>gem5</th><th>ChampSim</th><th>In-house model</th></tr>
<tr><td>Style</td><td>Execution-driven, full system</td><td>Trace-driven, core and memory focused</td><td>Usually cycle-level, built to match the company's own design</td></tr>
<tr><td>Speed</td><td>Slow in detailed mode</td><td>Fast</td><td>Tuned for the company's needs</td></tr>
<tr><td>Accuracy for a real chip</td><td>Not calibrated to any specific product</td><td>Not calibrated; simplified core</td><td>Correlated against RTL, emulation, and silicon</td></tr>
<tr><td>Best for</td><td>Research needing OS effects, multicore, coherence, or new ISAs</td><td>Prefetcher, replacement, and branch predictor studies</td><td>Product decisions</td></tr>
</table></div>
<p><strong>Why use open-source simulators:</strong></p>
<ul>
<li>Free and quick to start, with many existing components (predictors, prefetchers, protocols).</li>
<li>Results are comparable with published research and reproducible by others.</li>
<li>Good for <em>relative</em> comparisons (is idea A better than idea B?) and for learning.</li>
</ul>
<p><strong>Why companies build their own:</strong></p>
<ul>
<li><strong>Fidelity to the real design:</strong> the model must reproduce the product's actual microarchitecture, proprietary features, and ISA extensions, which a generic simulator doesn't have.</li>
<li><strong>Correlation:</strong> an in-house model is continuously checked against RTL and emulation (and later silicon), so its absolute numbers can be trusted for product decisions.</li>
<li><strong>Speed and scale:</strong> it's built to run the company's internal workloads and trace formats across large compute farms, often faster than a general-purpose simulator because it models only what matters.</li>
<li><strong>Integration:</strong> it shares configuration with RTL, feeds power models, and supports the team's analysis tools.</li>
<li><strong>Confidentiality:</strong> future designs can't be developed in public code.</li>
</ul>
<p>The cost is building and maintaining it, which is why performance modeling teams exist. Many companies still use gem5 or ChampSim for early research or to prototype an idea before adding it to the production model.</p>

`,
  practice: {
    guided: [
      {
        q: `<p>A functional model runs at 50 million instructions per second and a cycle-level model at 0.5 million. A benchmark executes 2 trillion instructions. How long does each take to run it in full, and how long does a sampled study take with 10 regions of 100 million detailed instructions each?</p>`,
        a: `<ol><li>Functional: 2 × 10<sup>12</sup> / 5 × 10<sup>7</sup> = 40,000 s ≈ <strong>11 hours</strong>.</li><li>Cycle-level, in full: 2 × 10<sup>12</sup> / 5 × 10<sup>5</sup> = 4 × 10<sup>6</sup> s ≈ <strong>46 days</strong>.</li><li>Sampled: 10 × 10<sup>8</sup> = 10<sup>9</sup> detailed instructions / 5 × 10<sup>5</sup> = 2,000 s ≈ <strong>33 minutes</strong> of detailed simulation, plus fast-forwarding (or restoring checkpoints) and warm-up. That's why sampling methods like SimPoints exist.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>When can a trace-driven simulator give a misleading answer?</p>`,
        a: `<ul><li><strong>Wrong-path effects:</strong> after a mispredict, real hardware fetches and executes wrong-path instructions that pollute caches or act as accidental prefetches; a correct-path trace has none of them.</li><li><strong>Timing-dependent execution:</strong> in multithreaded code, how many times a spin loop iterates or which thread wins a lock depends on timing, but the trace fixes one execution.</li><li><strong>OS and system effects:</strong> user-level traces miss kernel code, interrupts, and page faults.</li><li><strong>Data-dependent behavior:</strong> features that depend on actual values (value prediction, compression) need real data, which many traces don't include.</li></ul>`
      },
      {
        q: `<p>A new prefetcher gives +5% IPC in ChampSim. What has to happen before it ships in a product?</p>`,
        a: `<ol><li>Re-implement it in the in-house model, which matches the real core and memory system, and re-measure on the company's workload suite, including regressions.</li><li>Check hardware costs: table storage, timing of its lookup path, power, and how it interacts with existing prefetchers.</li><li>Review feasibility with RTL designers, then implement and verify it.</li><li>Correlate model and RTL (often on emulation) to confirm the gain survives in the real design.</li></ol>`
      }
    ]
  }
},

{
  id: "eda-rtl",
  region: "eda",
  title: "RTL Design",
  sections: [{ id: "test-hooks", label: "Test Hooks" }, { id: "synth-gates", label: "Synthesizing into Gates" }],
  body: `
<p><strong>What happens.</strong> Designers describe the hardware at the register-transfer level (RTL) in a hardware description language such as Verilog, SystemVerilog, or VHDL: registers, and the combinational logic that computes the next value of each register every clock cycle. Lint tools check the code for coding-style and structural problems before simulation.</p>
<p><strong>Starting point and result.</strong> RTL designers start from the microarchitecture specification and turn it into RTL code: the description of the hardware that every later stage works from and must match.</p>
<p><strong>Why it matters.</strong> RTL is detailed enough to build the chip from, but still abstract enough to be written and changed by people. Timing feedback from synthesis often sends designers back to restructure RTL (for example, adding a pipeline stage to a slow path).</p>
<h3 id="sec-test-hooks">Test Hooks</h3>
<p>Test hooks are extra logic added so engineers can test and debug the design, rather than for the chip's normal job:</p>
<ul>
<li><strong>Scan chains:</strong> flip-flops linked into shift registers so a tester can load any internal state and read results back during manufacturing test (see <a href="#/eda-dft">Design for test</a>).</li>
<li><strong>Built-in self-test (BIST):</strong> small controllers that automatically test memories such as caches at power-on or in the factory.</li>
<li><strong>Debug access:</strong> ports (such as JTAG) and debug registers that let engineers halt a core, read its registers, or set breakpoints on real silicon.</li>
<li><strong>Performance counters and trace:</strong> counters for events like cache misses or branch mispredicts, and logic that records what the core did. These are how silicon performance is checked against the performance model.</li>
<li><strong>Configuration and “chicken” bits:</strong> switches that can disable a risky feature, such as a new prefetcher, if a bug turns up after tapeout.</li>
<li><strong>Error injection:</strong> hooks that deliberately flip a bit to test that error-correcting logic works.</li>
</ul>
<p>A performance model usually leaves all of this out, because none of it changes how fast normal code runs. RTL must include every bit of it, because it will physically exist on the chip.</p>
<h3 id="sec-synth-gates">What It Means to Synthesize RTL into Gates</h3>
<p>RTL describes <em>behavior</em>. A synthesis tool translates it into a <strong>netlist</strong>: an actual circuit made of standard cells (specific gates and flip-flops from the foundry's library) and the wires connecting them. For example, this RTL:</p>
<pre><code>always_ff @(posedge clk)
  q &lt;= (a &amp; b) | c;</code></pre>
<p>becomes an AND gate feeding an OR gate feeding a D flip-flop, each one a real library cell (for example AND2, OR2, and DFF). On every rising clock edge, the flip-flop captures the gates' output as the new value of <code>q</code>.</p>
<p>Here is what that netlist looks like, drawn as a circuit and written out as text. Each cell is an <em>instance</em> of a library cell with a name (U1, U2, q_reg), and the internal wires get generated names (n1, n2):</p>
<div class="tbl"><svg viewBox="0 0 640 215" role="img" aria-label="Netlist for q <= (a & b) | c. Inputs a and b enter cell U1, an AND2 gate, whose output wire n1 goes into cell U2, an OR2 gate, along with input c. U2's output wire n2 goes to the D input of cell q_reg, a D flip-flop clocked by clk, whose Q output is q." style="width:100%;min-width:520px;max-width:640px;display:block;font-family:var(--sans)">
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M40,58 H120"/><path d="M40,82 H120"/>
<path d="M165,70 H240 V93 H282"/>
<path d="M40,140 H240 V117 H282"/>
<path d="M330,105 H450"/>
<path d="M40,180 H420 V140 H450"/>
<path d="M530,105 H590"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<path d="M120,45 H140 A25,25 0 0 1 140,95 H120 Z"/>
<path d="M280,80 Q295,105 280,130 Q310,130 330,105 Q310,80 280,80 Z"/>
<rect x="450" y="75" width="80" height="80" rx="3"/>
</g>
<path d="M450,130 L462,140 L450,150" style="fill:none;stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:13px;font-weight:600"><text x="20" y="62">a</text><text x="20" y="86">b</text><text x="20" y="144">c</text><text x="14" y="184">clk</text><text x="598" y="109">q</text></g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle"><text x="142" y="34">U1: AND2</text><text x="305" y="70">U2: OR2</text><text x="490" y="66">q_reg: DFF</text></g>
<g style="fill:var(--ink);font-size:11px"><text x="457" y="109">D</text><text x="515" y="109">Q</text><text x="468" y="144" style="fill:var(--muted)">CK</text></g>
<g style="fill:var(--pad);font-size:11px;font-weight:600"><text x="195" y="64">n1</text><text x="380" y="99">n2</text></g>
<text x="320" y="208" text-anchor="middle" style="fill:var(--muted);font-size:11px">Three library cells and the wires (nets) connecting them. Wire names are shown in gold.</text>
</svg></div>
<p>The same netlist written out as text (structural Verilog), the form the synthesis tool actually produces. Cell names like <code>AND2_X1</code> depend on the library; the <code>_X1</code> suffix is the drive strength:</p>
<pre><code>AND2_X1 U1    (.A(a),  .B(b),   .Y(n1));
OR2_X1  U2    (.A(n1), .B(c),   .Y(n2));
DFF_X1  q_reg (.D(n2), .CK(clk), .Q(q));</code></pre>
<p>Each line places one cell and says which wire connects to each of its pins. Physical design later takes exactly this list and decides where each cell sits on the die and how each wire is routed.</p>
<p>For bigger operations, the tool makes design choices. A line like <code>sum = a + b;</code> on 64-bit values might become a small ripple-carry adder if timing is relaxed, or a fast parallel-prefix adder if the path is critical, like the adders on the <a href="#/stage-ex">EX stage</a> page. See <a href="#/eda-synth">Logic synthesis</a> for how the tool chooses cells.</p>
<p>That's the key difference from a C++ model: RTL is written in a style that tools can turn into physical hardware, so everything in it has to be something a circuit can actually do every clock cycle.</p>
<p class="refs">References: <a href="https://en.wikipedia.org/wiki/Hardware_description_language" target="_blank" rel="noopener">Hardware description language (Wikipedia)</a></p>

`,
  practice: {
    guided: [
      {
        q: `<p>Timing feedback shows a path in the load unit is too slow, and the designer adds a pipeline stage to it in RTL. What else has to change?</p>`,
        a: `<ul><li><strong>RTL:</strong> new pipeline registers, plus updated control logic (stalls, flushes, forwarding) for the extra cycle.</li><li><strong>Verification:</strong> testbenches, assertions, and expected latencies must be updated and rerun.</li><li><strong>Performance model:</strong> the load-to-use latency grows by a cycle, so the model must be updated and the IPC cost measured.</li><li><strong>Software:</strong> compiler scheduling models may need the new latency.</li></ul>`
      }
    ],
    interview: [
      {
        q: `<p>What's the difference between RTL for a cache and a C++ performance model of the same cache?</p>`,
        a: `<p>RTL describes the actual hardware: every register, every bit, and the logic computing each register's next value every cycle, including control state machines, arbitration, error handling, and test hooks. It can be synthesized into gates. A performance model describes behavior at a higher level: how long a hit or miss takes, how many requests can be outstanding, which line gets replaced, often without data values or bit-level detail. The model is faster to write and run and easy to change; RTL is exact but slow to simulate and change. Keeping the two consistent is what correlation is for.</p>`
      }
    ]
  }
},

{
  id: "eda-verif",
  region: "eda",
  title: "Functional Verification",
  body: `
<p><strong>What happens.</strong> Verification engineers check that the RTL behaves as specified, at two levels:</p>
<ul>
<li><strong>Against the microarchitecture specification (block and unit level):</strong> each block is checked against its microarchitecture documentation. For example, does the load/store queue forward data under the documented rules and stall when full? Interfaces between blocks are checked against their protocol specs, including standard buses such as AXI or CHI (see <a href="#/verif-testbench/interfaces">Checking interfaces between blocks</a>, and <a href="#/r/icx">Interconnects and protocols</a> for the protocols themselves).</li>
<li><strong>Against the ISA (core and full-chip level):</strong> does the core execute programs correctly as the instruction set defines them? Instruction streams (from random instruction generators and ISA compliance test suites) run on the RTL and on a golden reference model, a functional ISA simulator, and the registers, memory, and PC are compared after every retired instruction. The ISA's memory consistency model is checked with short multithreaded “litmus” programs that test which orderings are allowed.</li>
</ul>
<p>Neither level checks performance: the ISA says nothing about timing, so a core can pass every correctness test while a prefetcher never fires. That's caught separately by performance validation, which compares RTL against the performance model. Simulation builds confidence by testing many cases; only formal methods actually prove properties. Verification usually takes more effort than design itself. The tools it uses are described in <a href="#/verif-overview/tools">The main tools</a> in the Verification section.</p>
<p><strong>Starting point and result.</strong> Verification starts from the RTL and the specification and checks one against the other. It produces bug reports, which designers fix, and coverage reports showing what has been tested. Verification is signed off once coverage goals are met.</p>
<p><strong>Why it matters.</strong> A functional bug that reaches silicon can mean a re-spin costing months and millions of dollars.</p>
<div class="callout"><strong>Where Normal Computing fits:</strong> this is the main stage its product, <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a>, works in. It reads design specifications (text, tables, and timing diagrams), builds a formal model of them, and generates verification plans, SystemVerilog/UVM stimulus, assertions, and coverage criteria, with every item traced back to the part of the spec it came from. It runs alongside existing simulators such as VCS and Xcelium rather than replacing them, and flags inconsistent or unclear spec sections before RTL simulation.</div>
<p class="refs">References: <a href="https://dev.to/fidus_systems/uvm-verification-best-practices-ensuring-accuracy-reusability-and-scalability-5ah9" target="_blank" rel="noopener">UVM verification best practices (Fidus Systems)</a> · <a href="https://dvcon-proceedings.org/wp-content/uploads/enriching-uvm-in-systemc-with-ams-extensions-for-randomization-and-functional-coverage.pdf" target="_blank" rel="noopener">UVM randomization and functional coverage (DVCon paper)</a> · <a href="https://en.wikipedia.org/wiki/Signoff_(electronic_design_automation)" target="_blank" rel="noopener">Signoff, including verification signoff (Wikipedia)</a></p>
<p><strong>Going deeper.</strong> The details have their own section, <a href="#/r/verif">Verification</a>:</p>
<ul>
<li><a href="#/verif-overview">Overview and tools</a>: simulation, formal, emulation, and how verification scales to a full SoC.</li>
<li><a href="#/verif-testbench">Testbenches and UVM</a>: a complete FIFO testbench, how UVM organizes it, and how interfaces between blocks are checked.</li>
<li><a href="#/verif-refmodel">Checking against a reference model</a>: retirement-trace comparison, a worked ADD example with a C model, and what happens when both sides have bugs.</li>
<li><a href="#/verif-coverage">Coverage</a>: what it measures and how it is calculated.</li>
<li><a href="#/verif-debug">Regressions and debug</a>: running tests at scale, waveforms, and the debug flow.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A coverage model for a cache controller has 400 coverage bins, and regressions have hit 340 of them. What's the coverage, and what do you do about the rest?</p>`,
        a: `<ol><li>Coverage = 340 / 400 = <strong>85%</strong>.</li><li>Review each unhit bin: some are unreachable by design and should be excluded with a justification; others need new constraints or directed tests to reach.</li><li>Rerun regressions and repeat until coverage goals are met, then sign off.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>When would you use formal verification instead of simulation?</p>`,
        a: `<p>Formal tools prove a property for every possible input sequence, so they're best for control-heavy logic where corner cases are hard to reach with random stimulus: arbiters, FIFOs, cache coherence protocols, deadlock and starvation checks. They struggle with large datapaths and whole chips because the state space explodes. Simulation scales to full designs and real scenarios but only checks the cases you happen to run. Most teams use both: formal for critical blocks and properties, simulation for everything else.</p>`
      }
    ]
  }
},

{
  id: "eda-emu",
  region: "eda",
  title: "Emulation and Prototyping",
  sections: [{ id: "emulation", label: "Emulation in Detail" }, { id: "sim-vs-emu", label: "Simulation vs. Emulation" }],
  body: `
<p><strong>What happens.</strong> The RTL is compiled onto special hardware that runs it orders of magnitude faster than software simulation, fast enough to boot operating systems, run firmware, and execute real benchmarks before silicon exists. Covered in detail in <a href="#/eda-emu/emulation">Emulation in detail</a> below.</p>
<p><strong>Starting point and result.</strong> Emulation starts from the RTL, plus a testbench or real software to run on it. It produces bugs found under real workloads, confirmation that hardware and software work together, and performance and power data from long runs.</p>
<p class="refs">References: <a href="https://en.wikipedia.org/wiki/Hardware_emulation" target="_blank" rel="noopener">Hardware emulation (Wikipedia)</a> · <a href="https://www.synopsys.com/glossary/what-is-hav-emulation.html" target="_blank" rel="noopener">What is HAV emulation? (Synopsys)</a></p>

<h3 id="sec-emulation">Emulation in Detail</h3>
<p><strong>Hardware emulation</strong> runs the RTL on dedicated hardware instead of evaluating it in software. The design is compiled onto the emulator, which then behaves like the future chip, only much slower than real silicon but far faster than simulation.</p>
<p><strong>How emulators are built.</strong> Two main styles:</p>
<ul>
<li><strong>Processor-based:</strong> arrays of custom chips containing many small Boolean processors that evaluate the design's logic in parallel each emulated cycle (Cadence Palladium).</li>
<li><strong>FPGA-based:</strong> the design is partitioned across many interconnected FPGAs (Synopsys ZeBu). Siemens Veloce is the third major platform.</li>
</ul>
<p><strong>Capacity and cost.</strong> Large emulators hold designs of billions of gates. They cost millions of dollars, fill racks, and are shared across teams with job scheduling, much like a compute cluster. Compiling a big design onto one takes hours.</p>
<p><strong>Ways to use one:</strong></p>
<ul>
<li><strong>Simulation acceleration:</strong> the design runs in the emulator while the testbench stays in software on a host computer.</li>
<li><strong>Transaction-based acceleration:</strong> the host and emulator exchange high-level transactions instead of signal-by-signal updates, which avoids the communication bottleneck.</li>
<li><strong>In-circuit emulation (ICE):</strong> the emulator connects to real external devices (through speed bridges that match clock rates), for example real PCIe or Ethernet equipment.</li>
<li><strong>Hybrid emulation:</strong> fast virtual models of some parts (such as CPU clusters running software) are combined with the RTL of the block under test in the emulator.</li>
</ul>
<p><strong>Debugging.</strong> Emulators capture waveforms with trace buffers and triggers. Visibility is good but less convenient than simulation: you typically capture a window around an event rather than stopping and inspecting anything at will.</p>
<p><strong>FPGA prototyping</strong> (Synopsys HAPS, Cadence Protium) is a close cousin: the design is mapped onto FPGA boards and runs faster still (tens of MHz), but with limited debug visibility and longer bring-up. It's mainly used for software development before silicon.</p>
<p class="refs">References: <a href="https://en.wikipedia.org/wiki/Hardware_emulation" target="_blank" rel="noopener">Hardware emulation (Wikipedia)</a> · <a href="https://www.synopsys.com/glossary/what-is-hav-emulation.html" target="_blank" rel="noopener">What is HAV emulation? (Synopsys)</a> · <a href="https://technav.ieee.org/topic/hardware-emulation/" target="_blank" rel="noopener">Hardware emulation (IEEE)</a> · <a href="https://s2cinc.com/verification-methodology/emulation.html" target="_blank" rel="noopener">Emulation methodology (S2C)</a> · <a href="https://www.keysight.com/blogs/tech/bench/2023/05/18/emulation-simulation-hsd-know-difference" target="_blank" rel="noopener">Emulation versus simulation (Keysight)</a></p>

<h3 id="sec-sim-vs-emu">Simulation vs. Emulation</h3>
<div class="tbl"><table>
<tr><th></th><th>RTL simulation</th><th>Emulation</th><th>FPGA prototype</th></tr>
<tr><td>Runs on</td><td>Software on ordinary servers (VCS, Xcelium, Questa, open-source Verilator)</td><td>Dedicated emulation hardware</td><td>FPGA boards</td></tr>
<tr><td>Typical speed (full SoC)</td><td>Roughly hertz to kilohertz</td><td>Roughly hundreds of kHz to a few MHz</td><td>Tens of MHz</td></tr>
<tr><td>Setup time</td><td>Minutes to compile</td><td>Hours to compile; weeks to bring up a new design</td><td>Weeks to months</td></tr>
<tr><td>Debug visibility</td><td>Complete: any signal, any time, stop and inspect</td><td>Good: trace windows and triggers</td><td>Limited: selected probes</td></tr>
<tr><td>Logic values</td><td>Four states (0, 1, X unknown, Z high-impedance), so it catches uninitialized-value bugs</td><td>Two states (0, 1), like real silicon</td><td>Two states</td></tr>
<tr><td>Cost</td><td>Software licenses on a server farm; scales out with many parallel jobs</td><td>Millions of dollars per system; a shared resource</td><td>Lower than emulation per system</td></tr>
<tr><td>Best for</td><td>Block-level verification, UVM regressions, early RTL, debugging</td><td>Full-chip runs, OS boot, firmware, real workloads, performance and power data</td><td>Software development, long-running tests</td></tr>
</table></div>
<p><strong>Why the speed difference matters.</strong> Suppose you want to run one second of a real workload on a chip that will run at 3 GHz: that's 3 × 10<sup>9</sup> cycles.</p>
<div class="tbl"><table>
<tr><th>Platform</th><th>Speed</th><th>Time to run 3 × 10<sup>9</sup> cycles</th></tr>
<tr><td>RTL simulation</td><td>100 cycles/s</td><td>3 × 10<sup>7</sup> s ≈ <strong>almost a year</strong></td></tr>
<tr><td>Emulation</td><td>1 MHz</td><td>3,000 s ≈ <strong>50 minutes</strong></td></tr>
<tr><td>FPGA prototype</td><td>30 MHz</td><td>100 s ≈ <strong>under 2 minutes</strong></td></tr>
<tr><td>Real silicon</td><td>3 GHz</td><td><strong>1 second</strong></td></tr>
</table></div>
<p>That's why the two are complementary rather than competing: simulation finds most bugs early with full visibility and cheap parallel runs, while emulation is the only pre-silicon way to run software-scale workloads on the real RTL.</p>
<p><strong>Where a performance engineer fits.</strong> Performance models are fast because they're abstract; emulation is accurate because it runs the actual RTL. Engineers run the same workloads on both and compare cycle counts and per-structure event counts to <strong>correlate</strong> the model, find performance bugs in the RTL (for example, an arbiter starving requests), and collect activity data for power estimation, on workloads far too long for RTL simulation.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A workload runs for 0.5 seconds on a 2 GHz chip. How long does it take to run on RTL simulation at 200 cycles/s, an emulator at 1.5 MHz, and an FPGA prototype at 25 MHz?</p>`,
        a: `<ol><li>Cycles: 0.5 s × 2 × 10<sup>9</sup> = 10<sup>9</sup> cycles.</li><li>RTL simulation: 10<sup>9</sup> / 200 = 5 × 10<sup>6</sup> s ≈ <strong>58 days</strong>.</li><li>Emulator: 10<sup>9</sup> / 1.5 × 10<sup>6</sup> ≈ 667 s ≈ <strong>11 minutes</strong>.</li><li>FPGA prototype: 10<sup>9</sup> / 25 × 10<sup>6</sup> = <strong>40 s</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>For each task, would you use RTL simulation, emulation, or an FPGA prototype: (a) debugging an X-propagation bug in a new cache controller, (b) booting Linux on the full SoC to measure a benchmark's IPC against the performance model, (c) giving the firmware team a platform to develop drivers for three months before silicon?</p>`,
        a: `<ul><li><strong>(a) RTL simulation:</strong> it models X (unknown) values and gives full visibility; emulators are two-state and would hide the bug.</li><li><strong>(b) Emulation:</strong> billions of cycles are needed, it runs the actual RTL so the IPC is trustworthy for correlation, and it captures event counts and traces for debugging mismatches.</li><li><strong>(c) FPGA prototype:</strong> the fastest pre-silicon platform and cheap enough to give a team for months; limited visibility is fine for software work.</li></ul>`
      },
      {
        q: `<p>Why does a performance engineer care about emulation?</p>`,
        a: `<p>RTL simulation of a full core is far too slow to run real workloads. Emulators run RTL orders of magnitude faster, so billions of cycles of real software can run before tapeout. That lets you correlate the performance model at scale, catch performance bugs (an arbiter starving a request, a prefetcher not triggering), and validate gains on workloads too long for simulation.</p>`
      }
    ]
  }
},

{
  id: "eda-synth",
  region: "eda",
  title: "Logic Synthesis",
  sections: [{ id: "cells", label: "Standard Cells" }, { id: "synth-ppa", label: "How Synthesis Improves PPA" }],
  body: `
<p><strong>What happens.</strong> A synthesis tool turns RTL into a gate-level netlist: a list of standard cells (specific gates and flip-flops from the foundry's cell library) and the wires connecting them. It takes the RTL, timing constraints (the target clock period, input and output delays), and the target cell library, then optimizes for timing, area, and power. Modern "physical synthesis" also estimates placement and wire delays during this step, so the result needs fewer iterations with place and route.</p>
<p><strong>Starting point and result.</strong> Synthesis starts from the RTL, the timing constraints (such as the target clock period), and the foundry's cell libraries. It produces a gate-level netlist (the design as a list of standard cells and the wires connecting them), plus early estimates of timing, area, and power. For a small worked example, one line of RTL drawn and written out as a netlist, see <a href="#/eda-rtl/synth-gates">What It Means to Synthesize RTL into Gates</a>.</p>
<p><strong>Why it matters.</strong> This is the first point where you learn whether the design can actually hit its frequency target. Failing paths here feed back into RTL changes, and possibly into the performance model's latencies.</p>
<p class="refs">References: <a href="https://www.synopsys.com/glossary/what-is-synthesis.html" target="_blank" rel="noopener">What is synthesis? (Synopsys)</a> · <a href="https://synopsys.com/glossary/what-is-physical-synthesis.html" target="_blank" rel="noopener">What is physical synthesis? (Synopsys)</a> · <a href="https://technav.ieee.org/topic/integrated-circuit-synthesis/" target="_blank" rel="noopener">Integrated circuit synthesis (IEEE)</a></p>


<h3 id="sec-cells">Standard Cells and Cell Libraries</h3>
<p>A <strong>standard cell</strong> is a small, pre-designed building block: an inverter, a NAND gate, a flip-flop, a multiplexer, a full adder. The foundry or a library vendor designs each one at the transistor level, lays it out, and measures (characterizes) its delay, power, and leakage across many conditions. The collection is the <strong>cell library</strong>, and its timing and power data live in library files the tools read (commonly in the Liberty format).</p>
<ul>
<li>Synthesis builds the design out of these cells, much like building with Lego bricks, instead of designing individual transistors.</li>
<li>Cells share a fixed height so they line up in rows during placement; their widths vary.</li>
<li>Each logic function comes in several <strong>drive strengths</strong> (bigger cells drive more load faster, at more area and power) and several <strong>threshold-voltage flavors</strong> (faster but leakier, or slower but low-leakage). See <a href="#/transistors/vt-flavors">Threshold-voltage flavors</a>.</li>
</ul>
<h3 id="sec-synth-ppa">How Synthesis Improves PPA</h3>
<ul>
<li><strong>Restructuring logic</strong> to shorten critical paths.</li>
<li><strong>Sizing:</strong> picking the smallest cell that meets timing on each path.</li>
<li><strong>Threshold-voltage choice:</strong> building mostly from low-leakage cells and using fast, leaky ones only on paths that miss timing. These choices are provisional, because synthesis only estimates wire delays; physical design revisits them.</li>
<li><strong>Resource sharing:</strong> reusing one piece of hardware for operations that never happen at the same time.</li>
<li><strong>Clock gating:</strong> automatically adding logic that stops the clock to registers that aren't changing, cutting switching power.</li>
</ul>
<p>All of this is driven by the timing, area, and power targets the team provides, plus limits such as a maximum share of leaky cells.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Synthesis targeting 3 GHz reports a worst path with −40 ps of slack. What are the options?</p>`,
        a: `<ul><li>Let the tool try harder: higher-effort optimization, larger or faster (low-threshold) cells on that path, at some area and leakage cost.</li><li>Restructure the logic in RTL (for example, precompute part of the result a cycle earlier).</li><li>Add a pipeline stage, accepting the extra latency (and its IPC cost).</li><li>Relax the target: −40 ps on a 333 ps cycle means about 2.7 GHz would pass as is.</li></ul>`
      }
    ],
    interview: [
      {
        q: `<p>Why can a design meet timing after synthesis but fail after place and route?</p>`,
        a: `<p>Synthesis estimates wire delays because it doesn't know where cells will be placed. After placement and routing, real wire lengths, congestion detours, coupling between neighboring wires, and clock skew are known, and at advanced nodes wire delay is a large part of path delay. Physical synthesis narrows the gap by estimating placement during synthesis.</p>`
      }
    ]
  }
},

{
  id: "eda-dft",
  region: "eda",
  title: "Design for Test",
  body: `
<p><strong>What happens.</strong> Extra logic is added so every manufactured chip can be tested for physical defects. The main technique is <strong>scan</strong>: flip-flops are linked into long shift chains, so in test mode a tester can shift in any internal state, run one clock, and shift out the result. <strong>ATPG</strong> (automatic test pattern generation) creates compact sets of patterns that detect modeled faults, such as a wire stuck at 0 or 1. Memories get built-in self-test (BIST), and boundary scan (JTAG) tests chip-to-board connections. Coverage here means the fraction of possible faults the tests can detect.</p>
<p><strong>Starting point and result.</strong> DFT starts from the gate-level netlist. It produces the same netlist with test structures added (scan chains, self-test logic) and the test patterns the factory will run on every chip.</p>
<p><strong>Why it matters.</strong> This is a different question from functional verification: verification asks "is the design right?"; manufacturing test asks "did this particular chip come out of the fab right?" DFT logic costs some area and can affect timing.</p>
<p class="refs">References: <a href="https://technav.ieee.org/topic/design-for-testability/" target="_blank" rel="noopener">Design for testability (IEEE)</a> · <a href="https://www.synopsys.com/implementation-and-signoff/rtl-synthesis-test/test-automation/dftmax.html" target="_blank" rel="noopener">TestMAX DFT (Synopsys)</a></p>

`,
  practice: {
    guided: [
      {
        q: `<p>A block has 10,000 scan flip-flops in one chain, tested with 2,000 patterns at a 100 MHz scan clock. Roughly how long does the test take? What if the flip-flops are split into 100 chains of 100?</p>`,
        a: `<ol><li>Each pattern shifts through the chain: about 10,000 cycles (the next pattern shifts in while the previous result shifts out).</li><li>One chain: 2,000 × 10,000 = 2 × 10<sup>7</sup> cycles / 10<sup>8</sup> per second = <strong>0.2 s</strong>.</li><li>100 chains of 100: 2,000 × 100 = 2 × 10<sup>5</sup> cycles = <strong>2 ms</strong>. Tester time costs money on every chip, which is why designs use many short chains and compression.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>How is manufacturing test different from functional verification?</p>`,
        a: `<p>Functional verification happens before tapeout and asks whether the design is correct. Manufacturing test happens on every chip after fabrication and asks whether that particular chip was built correctly, looking for physical defects (shorts, opens, faulty transistors) using fault models such as stuck-at faults. DFT structures like scan make the chip's internal state controllable and observable so defects can be detected quickly.</p>`
      }
    ]
  }
},

{
  id: "eda-pd",
  region: "eda",
  title: "Physical Design",
  sections: [{ id: "vt-pd", label: "Threshold-Voltage Swaps" }],
  body: `
<p><strong>What happens.</strong> The netlist becomes a physical layout:</p>
<ul>
<li><strong>Floorplanning:</strong> place major blocks, memories, and I/O, and plan the power grid.</li>
<li><strong>Placement:</strong> put every standard cell at a location on the die.</li>
<li><strong>Clock tree synthesis:</strong> build the network that delivers the clock to every flip-flop with low skew (see <a href="#/timing">Critical path and flip-flop timing</a>).</li>
<li><strong>Routing:</strong> draw the actual metal wires connecting everything, across many metal layers.</li>
<li><strong>Optimization:</strong> resize cells, insert buffers, and fix timing as real wire delays appear.</li>
</ul>
<p><strong>Starting point and result.</strong> Physical design starts from the gate-level netlist, floorplan constraints, and the foundry's technology files (the rules and properties of each metal layer). It produces a placed and routed layout: the exact position of every cell and every wire.</p>
<p><strong>Why it matters.</strong> At advanced process nodes, wires often dominate delay and power, so a design that met timing in synthesis can fail after routing. Timing closure, iterating until every path meets its constraints, is often the longest part of the back-end schedule.</p>
<p class="refs">References: <a href="https://synopsys.com/glossary/what-is-physical-synthesis.html" target="_blank" rel="noopener">Physical synthesis and place-and-route (Synopsys)</a> · <a href="https://users.ece.utexas.edu/~mcdermot/vlsi1/main/lectures/lecture_21.pdf" target="_blank" rel="noopener">Synthesis and timing analysis lecture (UT Austin)</a></p>


<h3 id="sec-vt-pd">Threshold-Voltage Swaps and Leakage Recovery</h3>
<p>Most decisions about leaky vs. low-leakage cells become final here, because real wire delays are finally known.</p>
<ul>
<li><strong>Swapping to fast cells:</strong> paths that became too slow after placement and routing get some cells swapped to low-V<sub>th</sub> (leaky, fast) versions, alongside resizing and buffering.</li>
<li><strong>Leakage recovery:</strong> the tool then walks the design and swaps cells back to high-V<sub>th</sub> (low-leakage) versions wherever a path still has slack to spare, cutting leakage without breaking timing.</li>
</ul>
<p>Placement also improves PPA directly: cells that communicate are placed close together, shortening wires, which dominate delay and power at advanced nodes. The clock tree is built to balance low skew against clock power, and power-gating and multi-voltage structures let idle blocks shut off or run slower.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Put the physical design steps in order and say what each one decides: routing, placement, clock tree synthesis, floorplanning.</p>`,
        a: `<ol><li><strong>Floorplanning:</strong> where major blocks, memories, I/O, and power grid go.</li><li><strong>Placement:</strong> where every standard cell goes.</li><li><strong>Clock tree synthesis:</strong> how the clock reaches every flip-flop with low skew.</li><li><strong>Routing:</strong> the actual metal wires for every connection.</li></ol><p>Optimization (resizing cells, adding buffers) happens throughout.</p>`
      }
    ],
    interview: [
      {
        q: `<p>What is routing congestion, and how does it affect a design?</p>`,
        a: `<p>Congestion happens when more wires need to pass through an area than the available routing tracks allow. Routes then detour, making wires longer and slower, adding coupling noise, and sometimes making the design unroutable without spreading cells out. Fixes: spread out dense logic (lower utilization, which costs area), change the floorplan, or restructure logic that creates many long wires, such as wide multiplexers or crossbars.</p>`
      }
    ]
  }
},

{
  id: "eda-signoff",
  region: "eda",
  title: "Signoff",
  sections: [{ id: "vt-signoff", label: "Corners and Late Swaps" }],
  body: `
<p><strong>What happens.</strong> Final, highest-accuracy checks before the design can be manufactured:</p>
<ul>
<li><strong>Static timing analysis (STA):</strong> checks setup and hold on every path at every process, voltage, and temperature corner, using wire parasitics extracted from the layout, without simulating any inputs.</li>
<li><strong>Power and reliability:</strong> power analysis, IR drop (voltage loss across the power grid), and electromigration (wires wearing out under high current).</li>
<li><strong>Physical verification:</strong> DRC (design rule checking) confirms the layout obeys the foundry's manufacturing rules, such as minimum widths and spacings; LVS (layout versus schematic) confirms the layout implements exactly the circuit in the netlist.</li>
<li><strong>Equivalence checking:</strong> formally proves the final netlist matches the RTL, catching errors introduced by synthesis or optimization.</li>
</ul>
<p><strong>Starting point and result.</strong> Signoff starts from the final layout and netlist. It produces either a clean report, meaning the design is ready to manufacture, or a list of violations to fix first.</p>
<p class="refs">References: <a href="https://en.wikipedia.org/wiki/Signoff_(electronic_design_automation)" target="_blank" rel="noopener">Signoff (Wikipedia)</a> · <a href="https://chipverify.com/verification/tapeout-checklist" target="_blank" rel="noopener">Tapeout verification steps, DRC and LVS (ChipVerify)</a> · <a href="https://users.ece.utexas.edu/~mcdermot/vlsi1/main/lectures/lecture_21.pdf" target="_blank" rel="noopener">Static timing analysis lecture (UT Austin)</a></p>


<h3 id="sec-vt-signoff">Corners and Late Threshold-Voltage Swaps</h3>
<ul>
<li><strong>Different corners for different risks:</strong> timing is checked at the slow, worst-case corner (low voltage, slow transistors), while leakage is checked at the hot, fast corner, where it's worst.</li>
<li><strong>ECOs:</strong> remaining violations are fixed with small, late edits called engineering change orders.</li>
<li><strong>Why threshold-voltage swaps are a favorite late fix:</strong> the different flavors of a cell share the same footprint, so swapping one for another doesn't move anything or disturb the routed layout.</li>
<li><strong>Margins:</strong> accurate analysis lets designers avoid large safety margins, which would otherwise cost frequency or power.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>After routing, STA reports one setup violation and one hold violation. Which is more dangerous, and how is each fixed?</p>`,
        a: `<p>The <strong>hold violation</strong> is more dangerous: it doesn't depend on clock frequency, so a chip with one fails at any speed. It's fixed by adding delay (buffers) on the short path. A setup violation can be fixed by speeding up the path (bigger cells, restructuring) or, in the worst case, by running at a lower frequency. See <a href="#/timing">Critical path and flip-flop timing</a>.</p>`
      }
    ],
    interview: [
      {
        q: `<p>Why is timing signed off with static timing analysis rather than simulation?</p>`,
        a: `<p>Simulation only checks the paths that the test stimulus happens to exercise, and only at one set of conditions. STA analyzes every timing path in the design, without needing inputs, across all process, voltage, and temperature corners, using parasitics extracted from the real layout. It's exhaustive and fast enough to run on billions of paths, which simulation can't match.</p>`
      }
    ]
  }
},

{
  id: "eda-tapeout",
  region: "eda",
  title: "Tapeout",
  body: `
<p><strong>What happens.</strong> The final layout database (GDSII or OASIS format) is handed to the foundry, which builds masks and starts fabrication. The name comes from the era when layouts were shipped on magnetic tape.</p>
<p><strong>Starting point and result.</strong> Tapeout starts from the signed-off layout. It produces the masks the foundry uses to manufacture the chip, then wafers, and weeks to months later the first chips, which go through bring-up and validation.</p>
<p><strong>Why it matters.</strong> It's irreversible: fixing a bug after tapeout means new masks (at advanced nodes, a full mask set costs millions of dollars) or a workaround in firmware or software.</p>
<p class="refs">References: <a href="https://chipverify.com/verification/tapeout-checklist" target="_blank" rel="noopener">Tapeout checklist (ChipVerify)</a> · <a href="https://foss-eda-tools.googlesource.com/gf180mcu-pdk/+/0cba32596b0dbc82f53d16b4d1adfebd1ecf9eb3/docs/physical_verification/design_manual/drm_06.rst" target="_blank" rel="noopener">GlobalFoundries GF180MCU tapeout checklist (open PDK)</a></p>


<div class="callout"><strong>Where Normal Computing fits:</strong> besides selling software, Normal designs its own chips. It taped out CN101, described as the first thermodynamic computing chip, in mid-2025 (see <a href="https://normalcomputing.com/solutions/asics" target="_blank" rel="noopener">Normal ASICs</a>), and uses <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a> to verify its own silicon IP, so its hardware team is also a demanding in-house customer for its software.</div>
`,
  practice: {
    guided: [
      {
        q: `<p>List the checks that must be clean before a design tapes out.</p>`,
        a: `<ul><li>Functional verification signed off (coverage goals met).</li><li>Static timing analysis clean at all corners (setup and hold).</li><li>Power, IR drop, and electromigration within limits.</li><li>DRC and LVS clean (manufacturable, and layout matches the netlist).</li><li>Equivalence checking passes (netlist matches RTL).</li><li>DFT structures and test patterns ready.</li></ul>`
      }
    ],
    interview: [
      {
        q: `<p>A functional bug is found right after tapeout. What are the options, from cheapest to most expensive?</p>`,
        a: `<ol><li><strong>Software or firmware workaround:</strong> avoid the buggy behavior in drivers, the OS, or microcode.</li><li><strong>Disable the feature:</strong> designs include configuration bits ("chicken bits") that turn off risky features.</li><li><strong>Metal-only fix:</strong> rewire existing spare cells using only the upper metal layers, which needs only a few new masks.</li><li><strong>Full respin:</strong> new masks for all layers and months of delay.</li></ol>`
      }
    ]
  }
}
]);
