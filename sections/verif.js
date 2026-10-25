/* Section: Verification
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "verif"). */

section({
  id: "verif",
  name: "Verification",
  cap: "Testbenches, reference models, coverage, and debug",
  body: `
<p>Functional verification checks that the RTL does what the specification says. It is one stage of the <a href="#/r/eda">EDA stack</a>, summarized in <a href="#/eda-verif">Functional verification</a>; these pages go into the details: the tools, how testbenches are built, how a CPU is checked against a reference model, how coverage decides when testing is done, and how failures are debugged.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Put these verification activities in the order a CPU project can first start them, and say what each one needs to exist first:</p><ul><li>(a) Lockstep comparison of the core against the ISA reference model</li><li>(b) Formal proofs on the load/store queue's ordering logic</li><li>(c) Booting Linux on an emulator</li><li>(d) Post-silicon validation</li></ul>`,
        a: `<ol start="0"><li><strong>(b) Formal on a block:</strong> needs only that block's RTL and its properties, so it can start as soon as the block compiles.</li><li><strong>(a) Lockstep against the reference model:</strong> needs a core that fetches, executes, and retires instructions end to end, plus the reference model.</li><li><strong>(c) Linux on an emulator:</strong> needs the full SoC (core, caches, interconnect, devices) to be stable enough that an OS boot gets somewhere, plus firmware.</li><li><strong>(d) Post-silicon:</strong> needs real chips back from the fab, months after tapeout.</li></ol><p>Each later method costs more per bug found and gives less visibility, which is why the early ones are pushed as hard as possible.</p>`
      }
    ],
    interview: [
      {
        q: `<p>A CPU team has an ISA reference model and a cycle-level performance model. A manager proposes using the performance model as the reference model to save effort. What's wrong with that?</p>`,
        a: `<p>They answer different questions. The reference model must be the source of correct architectural results, simple enough to trust, and written independently of the RTL. A performance model is built to predict timing; it often skips or approximates functional behavior (it may be trace-driven, ignore rare exceptions, or lean on a functional model for values), and it shares the microarchitecture team's assumptions with the RTL, so the same misreading of the spec can land in both and go unnoticed. Making it the checker would either slow it down with full functional detail or weaken checking. The usual split: one trusted functional model, which both the testbench and the performance model can link against for values.</p>`
      }
    ]
  }
}, [
{
  id: "verif-overview",
  region: "verif",
  title: "Overview and Tools",
  sections: [{ id: "tools", label: "Main Tools" }, { id: "what-to-test", label: "Deciding What to Test, and AI" }, { id: "soc-verif", label: "SoC-Level Verification" }],
  body: `
<p>Functional verification is the stage of the <a href="#/r/eda">EDA stack</a> where engineers check that the RTL does what the specification says (summarized in <a href="#/eda-verif">Functional verification</a>). This page covers the main tools and how verification scales up to a full SoC.</p>

<h3 id="sec-tools">The Main Tools of Functional Verification</h3>
<p>Testbenches and regression suites are central, but they sit inside a larger toolkit:</p>
<div class="tbl"><table>
<tr><th>Tool</th><th>What it does</th></tr>
<tr><td>Simulator</td><td>Runs the RTL and testbench together (Synopsys VCS, Cadence Xcelium, Siemens Questa, open-source Verilator); also collects coverage and records waveforms</td></tr>
<tr><td>Testbench</td><td>Code that drives inputs into the design, watches its outputs, and checks them. Most are built with UVM (Universal Verification Methodology), a standard SystemVerilog framework for constrained-random stimulus (random inputs within legal limits), scoreboards, and functional coverage (see below)</td></tr>
<tr><td>Reference models and scoreboards</td><td>Predict the correct result so the testbench can check the design: from a simple queue for a FIFO up to a full ISA simulator for a core</td></tr>
<tr><td>Assertions</td><td>SystemVerilog rules that must always hold (for example, "a grant is never given without a request"), checked every cycle during simulation and firing the moment one is broken; also usable by formal tools</td></tr>
<tr><td>Formal tools</td><td>Mathematically prove properties for every possible input rather than sampling inputs (Cadence Jasper, Synopsys VC Formal, Siemens Questa Formal). Good for control logic and protocols; doesn't scale to whole chips</td></tr>
<tr><td>Verification IP (VIP)</td><td>Pre-built, pre-verified models of standard protocols (AXI, CHI, PCIe, DDR) that generate legal traffic and check the design's side of the interface</td></tr>
<tr><td>Coverage tools</td><td>Collect, merge, and report coverage across all runs</td></tr>
<tr><td>Regression management</td><td>Schedules thousands of runs on a compute farm, tracks pass/fail and coverage over time, and links results to the verification plan</td></tr>
<tr><td>Debug tools and bug tracking</td><td>Waveform viewers for finding root causes; a bug database for tracking fixes</td></tr>
<tr><td>Emulators</td><td>Run the full design fast enough for real software (see <a href="#/eda-emu">Emulation and prototyping</a>)</td></tr>
</table></div>

<h3 id="sec-what-to-test">Deciding What to Test, and How AI Changes It</h3>
<p><strong>The traditional approach</strong> starts with a <strong>verification plan</strong>, written by hand from the specification:</p>
<ol start="0">
<li><strong>Extract features.</strong> Engineers read the spec and microarchitecture documents and list every feature and rule. For a FIFO, that includes ordering, full and empty flags, simultaneous push and pop, and behavior on reset.</li>
<li><strong>Turn each feature into checks and coverage.</strong> For each item they decide how correctness will be checked (scoreboard, assertion, or reference-model comparison) and which coverage points prove it was exercised, including crosses such as “full while a push and pop happen together.”</li>
<li><strong>Prioritize by risk.</strong> New or changed logic, complex control (arbiters, coherence, memory ordering), concurrency, error paths, and areas with past bugs get the most attention.</li>
<li><strong>Review.</strong> Designers and architects review the plan to catch features nobody listed.</li>
<li><strong>Close coverage.</strong> Regressions run, engineers inspect unhit coverage bins, and they write new tests or constraints or exclude unreachable cases, repeating until goals are met. Tools such as Cadence’s vManager make the plan “executable” by linking each item to its coverage results.</li>
</ol>
<p>The weak points: it’s manual and subjective, it depends on how well people read a long spec, links between spec and tests break when the spec changes, and closing the last few percent of coverage takes a long time.</p>
<p><strong>Cadence</strong></p>
<ul>
<li><strong>Verisium:</strong> applies machine learning to the data verification already produces (regressions, coverage, logs, waveforms) for test selection, regression optimization, coverage closure, failure triage, bug prediction, and root-cause analysis. Apps include AutoTriage, SemanticDiff, PinDown, and Debug. Mostly it makes running, closing, and debugging tests more efficient.</li>
<li><strong>ChipStack AI Super Agent (2026):</strong> an agentic system for front-end design and verification. It turns a high-level prompt into verification objectives using a “mental model” of the design, and coordinates multiple agents built on frontier LLMs that call Cadence tools such as Xcelium and Jasper, with engineers reviewing and guiding the work.</li>
</ul>
<p><strong>Synopsys</strong></p>
<ul>
<li><strong>VSO.ai:</strong> works inside the VCS simulator. Machine learning removes redundant tests from regressions, explains why coverage bins are not being hit, and infers coverage from RTL and stimulus to find gaps, steering coverage at the constraint-solver, test, and test-option levels. It is a coverage-closure tool.</li>
<li><strong>Autonomous verification agent (July 2026):</strong> built on Synopsys AgentEngineer. An orchestrator agent gathers verification goals from the spec, the design, existing tests, and engineer input, then sends specialized agents to work on test-plan generation, coverage closure, and debug. Synopsys claims large speedups, but against its own baseline, with no named design.</li>
</ul>
<p><strong>Normal EDA</strong> focuses on the upstream question of what to test, and builds it from the spec in a structured way. It converts specs, timing diagrams, and existing testbenches into NormML, a proprietary formal language, producing an auditable graph. From that graph it generates test plans, SystemVerilog/UVM stimulus, and coverage links, and it flags inconsistencies in the spec before RTL is simulated. The main differences:</p>
<ul>
<li><strong>Traceability:</strong> each test links to the exact quote, table, or diagram in the spec it came from, so when the spec changes you can see which tests are affected.</li>
<li><strong>A formal intermediate representation:</strong> the spec becomes a structured model rather than relying only on an LLM’s reasoning, which makes it auditable and lets it catch contradictions in the spec itself.</li>
<li><strong>Vendor-neutral:</strong> it works alongside VCS or Xcelium rather than being tied to one vendor’s simulator.</li>
<li><strong>Human in the loop:</strong> engineers can watch its actions, step in, give feedback, and approve inferred tests.</li>
</ul>
<p>The gap is narrower than it was: in 2026, both Cadence’s and Synopsys’s agents also start from the spec and generate test plans. Normal’s case rests mainly on the formal spec model, traceability, spec-bug detection, and independence from a single vendor. These comparisons come from vendor materials, not published head-to-head benchmarks.</p>
<p class="refs">References: <a href="https://easychair.org/smart-slide/slide/rn79" target="_blank" rel="noopener">Cadence Verisium with AI agents (DVCon Europe 2025)</a> · <a href="https://secure.businesswire.com/news/home/20260210926552/en/Cadence-Unleashes-ChipStack-AI-Super-Agent-Pioneering-a-New-Frontier-in-Chip-Design-and-Verification" target="_blank" rel="noopener">Cadence ChipStack AI Super Agent</a> · <a href="https://www.synopsys.com/ai/ai-powered-eda/vso-ai.html" target="_blank" rel="noopener">Synopsys VSO.ai</a> · <a href="https://www.unite.ai/synopsys-hands-chip-verification-to-autonomous-ai-agents/" target="_blank" rel="noopener">Synopsys autonomous verification agent (Unite.AI)</a> · <a href="https://normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a> · <a href="https://www.ai-infra-summit.com/demo-stage-2025/normal-eda-ai-native-verification-without-rework" target="_blank" rel="noopener">Normal EDA demo (AI Infra Summit 2025)</a></p>
<h3 id="sec-soc-verif">SoC-Level Verification</h3>
<p>Once verified blocks are assembled into a <a href="#/eda-soc">system-on-chip</a>, many of the hardest bugs live between blocks rather than inside them. SoC-level verification adds checks that block-level testbenches can't do:</p>
<ul>
<li><strong>Connectivity:</strong> every block is wired to the right signals, interrupts, and buses.</li>
<li><strong>Clock-domain crossing (CDC):</strong> signals passing between blocks running on different clocks are properly synchronized, so they can't be sampled mid-change.</li>
<li><strong>Power-aware simulation:</strong> using the chip's power-intent description, it checks what happens when blocks power off, retain state, and wake back up.</li>
<li><strong>Interconnect and coherence:</strong> traffic between CPUs, accelerators, and memory flows correctly under heavy, concurrent load.</li>
<li><strong>Hardware-software co-verification:</strong> real firmware and drivers run against the RTL, usually on <a href="#/eda-emu">emulation</a>, because full-chip simulation is too slow.</li>
</ul>
<p>Pre-verified IP and matching verification IP let teams spend their effort on these integration problems and on the blocks that make their chip unique.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A block has a 4-requester round-robin arbiter with an AXI4 port to the rest of the SoC. Pick the main tool for each goal:</p><ul><li>(a) Prove the grant vector is one-hot or zero for every possible input sequence</li><li>(b) Check the AXI4 port follows the protocol under realistic traffic</li><li>(c) Run the real boot firmware through the block</li><li>(d) Show that every requester was granted while the AXI port was back-pressured</li></ul>`,
        a: `<ol start="0"><li>(a) <strong>Formal tool</strong> with an assertion: the property is small and control-heavy, and "every possible input" is exactly what formal proves and simulation can't.</li><li>(b) <strong>AXI verification IP</strong>: it generates legal traffic and checks the block's side of the protocol.</li><li>(c) <strong>Emulation</strong> (or an FPGA prototype): firmware runs billions of cycles, far too slow for RTL simulation.</li><li>(d) <strong>Functional coverage</strong>: a cross of "which requester was granted" with "AXI READY low," collected across the regression.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Three weeks before RTL freeze, your block shows 98% line coverage but only 60% on a functional cross of coherence state × incoming snoop type. Where do you spend the time, and what do you tell the project lead?</p>`,
        a: `<p>On the cross. Line coverage near 100% only says each line ran at least once; the bugs in coherence logic live in combinations (a snoop arriving while the line is mid-upgrade), and 40% of those combinations have never been exercised. Steps:</p><ul><li>List the unhit bins</li><li>Mark any that are unreachable by design as excluded, with a written reason</li><li>Steer constraints toward the rest (more sharing, smaller address ranges so lines collide)</li><li>Write directed tests for the stubborn ones</li><li>Use formal on the state machine if the space is small enough</li></ul><p>Tell the lead the block is not ready on functional coverage regardless of the line number, give the count of reachable unhit bins and a burn-down estimate, and flag the risk if the date can't move.</p>`
      }
    ]
  }
},

{
  id: "verif-testbench",
  region: "verif",
  title: "Testbenches and UVM",
  sections: [{ id: "testbench", label: "What a Testbench Looks Like" }, { id: "agent-reuse", label: "Example: Reusing an Agent" }, { id: "interfaces", label: "Checking Interfaces" }],
  body: `
<p>A testbench drives a design with stimulus and checks what comes out. This page builds one up from a small example, shows how UVM organizes the same pieces, and covers how interfaces between blocks are checked.</p>

<h3 id="sec-testbench">What a Testbench Looks Like</h3>
<p>Here's a small, self-contained SystemVerilog testbench for an 8-entry FIFO. It shows every core piece in one place: the design under test, a clock, random stimulus, a reference model, a scoreboard check, an assertion, and coverage. (It assumes a "show-ahead" FIFO, where <code>dout</code> always shows the oldest entry.)</p>
<pre><code>module fifo_tb;
  logic clk = 0, rst_n;
  logic push, pop, full, empty;
  logic [31:0] din, dout;

  fifo #(.DEPTH(8)) dut (.*);           <span class="cm">// design under test</span>

  always #5 clk = ~clk;                 <span class="cm">// clock</span>

  logic [31:0] model[$];                <span class="cm">// reference model: a simple queue</span>

  <span class="cm">// Stimulus: random pushes and pops (never push when full, never pop when empty)</span>
  initial begin
    rst_n = 0; push = 0; pop = 0;
    repeat (2) @(posedge clk);
    rst_n = 1;
    repeat (10000) begin
      @(negedge clk);
      push = !full  &amp;&amp; ($urandom_range(0, 1) == 1);
      pop  = !empty &amp;&amp; ($urandom_range(0, 1) == 1);
      din  = $urandom;
    end
    $finish;
  end

  <span class="cm">// Scoreboard: every popped value must match the model</span>
  always @(posedge clk) if (rst_n) begin
    if (pop) begin
      assert (dout == model[0])
        else $error("Mismatch: got %h, expected %h", dout, model[0]);
      void'(model.pop_front());
    end
    if (push) model.push_back(din);
  end

  <span class="cm">// Assertion: the FIFO can never be full and empty at the same time</span>
  assert property (@(posedge clk) disable iff (!rst_n) !(full &amp;&amp; empty));

  <span class="cm">// Coverage: did it ever fill up? Did a push and pop ever happen together?</span>
  covergroup fifo_cg @(posedge clk iff rst_n);
    cp_full: coverpoint full;
    cp_both: coverpoint (push &amp;&amp; pop);
  endgroup
  fifo_cg cg = new();
endmodule</code></pre>
<p><strong>How the pieces connect.</strong> The testbench checks one FIFO against another:</p>
<ul>
<li><strong>The RTL FIFO</strong> (<code>fifo dut</code>) is the real hardware design, written elsewhere and not shown here. <code>(.*)</code> connects it to the testbench by matching each port to the signal with the same name (<code>clk</code>, <code>rst_n</code>, <code>push</code>, <code>pop</code>, <code>din</code>, <code>dout</code>, <code>full</code>, <code>empty</code>).</li>
<li><strong>The functional model</strong> is the queue <code>model[$]</code>: a short description of what a FIFO should do (add to the back, remove from the front) with no clock, pins, or hardware detail. In this testbench it serves as the reference model.</li>
<li><strong>The scoreboard</strong> compares the two. Both see the same pushes and pops, and on every pop it checks that the RTL’s <code>dout</code> matches the front of the model.</li>
</ul>
<p><strong>Functional model vs. reference model.</strong> The terms overlap. “Functional model” describes what the model is: an untimed description of correct behavior. “Reference model” describes its role: the thing the design is checked against. Here they are the same queue. For a whole CPU, the functional model is a much larger C or C++ simulator that executes instructions correctly, and it serves as the reference model the same way: run the same program on both and compare the results. A performance simulator is a different kind of model again, built to predict timing rather than to be the source of correct results.</p>
<p><strong>How UVM organizes the same pieces.</strong> Real testbenches for large blocks use UVM, which splits these jobs into reusable classes:</p>
<ul>
<li><strong>Transaction (sequence item):</strong> a small class describing one operation at a high level, with no timing. For the FIFO, a transaction might be “push with data 0x1234” or “pop.” Its fields can carry constraints, such as limits on which data values are legal.</li>
<li><strong>Sequence:</strong> produces a stream of transactions, randomizing each one within its constraints. One FIFO sequence might push until the FIFO is full and then drain it; another might mix pushes and pops at random. Sequences describe what to do, never when, so the same sequence works whatever the interface timing is.</li>
<li><strong>Sequencer:</strong> passes transactions from the running sequences to the driver one at a time, and decides whose turn it is when several sequences run at once. It is usually used as is, with little custom code.</li>
<li><strong>Driver:</strong> turns each transaction into pin activity, cycle by cycle. For a push, it sets <code>din</code> and raises <code>push</code> before the clock edge, then lowers it afterward. It is the only component that knows the interface’s timing rules (the protocol), which is what keeps sequences timing-free.</li>
<li><strong>Monitor:</strong> watches the pins every cycle and rebuilds transactions from what it sees, such as “a pop happened and <code>dout</code> was 0x1234.” It sends them to the scoreboard and coverage collector through an analysis port. It never drives a signal, so it works even when the interface is driven by a real neighboring block rather than the testbench.</li>
<li><strong>Scoreboard:</strong> receives transactions from the monitors, feeds the inputs to the reference model, and compares the model’s predicted outputs with what the design actually produced. Any difference is reported as an error. For the FIFO, it would hold the queue model from the example above.</li>
<li><strong>Coverage collector:</strong> samples the observed transactions into covergroups, recording which scenarios actually happened, such as the FIFO filling up or a push and pop in the same cycle. The coverage report shows what has not been tested yet, so you can add sequences or change constraints to reach it.</li>
<li><strong>Agent:</strong> bundles a sequencer, driver, and monitor for one interface. An active agent drives and monitors; a passive agent only monitors, which is useful when the block sits inside a larger system and something else drives that interface.</li>
<li><strong>Environment:</strong> assembles the agents, scoreboards, and coverage collectors and connects each monitor to the components that need its transactions. It is built once per block and reused by every test.</li>
<li><strong>Test:</strong> the top-level class. It configures the environment (for example, the FIFO depth or which agents are active), chooses which sequences to start, and decides how long to run. Different tests target different scenarios while sharing the same environment.</li>
</ul>
<p>Data flows in one loop: sequence, sequencer, driver, then the design’s pins; then back out through the monitor to the scoreboard and coverage collector.</p>
<p>The benefit is reuse: the same agent for an interface can be used in every testbench that touches that interface, and a vendor's VIP plugs in as a ready-made agent.</p>
<div class="callout"><strong>Where Normal Computing fits:</strong> <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a> generates parts of a testbench like this automatically from the spec: UVM stimulus and SystemVerilog assertions, each linked to the requirement it checks. Engineers review and steer what it produces.</div>

<h3 id="sec-agent-reuse">Example: Reusing an Agent</h3>
<p>Take the interface between the load/store unit (LSU) and the L1 data cache. Requests go from the LSU to the cache (“load address A,” “store data D to address A”), and responses come back (“here’s the data,” “miss, retry later”). You write one <strong>LSU–cache agent</strong> for this interface. Its driver knows the valid/ready timing, its monitor turns pin activity into request and response transactions, and it comes with protocol checks and coverage. The same agent is then used in several testbenches:</p>
<div class="tbl"><table>
<tr><th>Testbench</th><th>Who drives the interface</th><th>How the agent is used</th></tr>
<tr><td><strong>L1 cache, block level</strong></td><td>Nobody else; the cache is tested alone</td><td><strong>Active, as the requester.</strong> The driver pretends to be the LSU and sends random loads and stores; the monitor feeds the scoreboard.</td></tr>
<tr><td><strong>LSU, block level</strong></td><td>Nobody else; the LSU is tested alone</td><td><strong>Active, as the responder.</strong> The same agent, configured for the other side, pretends to be the cache and returns hits, misses, and retries.</td></tr>
<tr><td><strong>Whole core</strong></td><td>The real LSU talks to the real cache</td><td><strong>Passive.</strong> The driver is switched off; the monitor only watches. Its protocol checks still catch a rule violation between the two real blocks, and its coverage shows whether, say, a store and a load to the same line ever happened back to back.</td></tr>
<tr><td><strong>Next chip</strong></td><td>The interface is unchanged or slightly extended</td><td>The agent carries over, along with its sequences (for example, “stores to the same cache line back to back”) and its coverage.</td></tr>
</table></div>
<p>Switching between active and passive is one configuration line in the test, not new code:</p>
<pre><code><span class="cm">// Block-level cache test: the agent drives requests</span>
uvm_config_db#(uvm_active_passive_enum)::set(this, "env.lsu_agent", "is_active", UVM_ACTIVE);

<span class="cm">// Core-level test: the real LSU drives; the agent only watches</span>
uvm_config_db#(uvm_active_passive_enum)::set(this, "env.lsu_agent", "is_active", UVM_PASSIVE);</code></pre>
<p>The protocol knowledge is written and debugged once. Every testbench that touches the interface gets the same timing, checks, and coverage, so a bug fixed in the agent is fixed everywhere. Vendor verification IP for standard buses like AXI works the same way: a ready-made agent you configure as requester, responder, or passive monitor.</p>
<h3 id="sec-interfaces">Checking Interfaces Between Blocks</h3>
<p>Interfaces aren't checked with counters. Counters are for <em>coverage</em> (measuring what happened). Interfaces are checked with rules that fire the moment something goes wrong:</p>
<ul>
<li><strong>Protocol assertions</strong> attached to the interface signals check the protocol's rules every cycle.</li>
<li><strong>Verification IP</strong> acts as the other side of a standard protocol, generating legal traffic and flagging any rule the design breaks.</li>
<li><strong>Scoreboards</strong> check end to end: every request's data arrives intact and in the allowed order.</li>
<li><strong>Formal tools</strong> prove handshake rules and the absence of deadlock for every possible input.</li>
<li><strong>Coverage</strong> then confirms which scenarios were exercised (back-pressure, every burst type, maximum outstanding requests).</li>
</ul>
<p>For example, a core rule of AXI-style handshakes is that once a sender raises VALID, it must keep VALID high and the data stable until the receiver raises READY:</p>
<pre><code><span class="cm">// Once valid is raised without ready, next cycle valid must still be high</span>
<span class="cm">// and the data unchanged.</span>
assert property (@(posedge clk) disable iff (!rst_n)
  valid &amp;&amp; !ready |=&gt; valid &amp;&amp; $stable(data));</code></pre>
<p><strong>Examples of what gets checked:</strong></p>
<div class="tbl"><table>
<tr><th>Check</th><th>Example</th></tr>
<tr><td>Handshake stability</td><td>VALID stays high and data stays stable until accepted</td></tr>
<tr><td>Every request gets exactly one response</td><td>No response without a request, none duplicated, none lost; a timeout catches responses that never arrive</td></tr>
<tr><td>Ordering rules</td><td>Responses with the same transaction ID come back in order</td></tr>
<tr><td>Data integrity</td><td>A read returns the most recent data written to that address</td></tr>
<tr><td>Flow control</td><td>Credit counters never go negative or above their maximum; FIFOs never overflow or underflow</td></tr>
<tr><td>Legal values</td><td>No unknown (X) values on control signals; one-hot signals (like an arbiter's grants) have at most one bit set</td></tr>
<tr><td>Reset behavior</td><td>Outputs are idle during and right after reset</td></tr>
<tr><td>Forward progress</td><td>No deadlock, and no requester is starved forever</td></tr>
<tr><td>Coherence legality</td><td>Two caches never hold the same line in a writable state at once</td></tr>
<tr><td>Clock-domain crossings</td><td>Signals between different clocks pass through proper synchronizers</td></tr>
</table></div>
`,
  practice: {
    guided: [
      {
        q: `<p>You're building a UVM testbench for an AXI4-Lite register block. Say which UVM component does each job:</p><ul><li>(a) Choose random write addresses within the register map</li><li>(b) Raise AWVALID and hold it until AWREADY</li><li>(c) Rebuild "write 0x5 to offset 0x10" from pin activity</li><li>(d) Check that a read returns the last value written</li><li>(e) Record whether every register was written while BREADY was held low</li></ul>`,
        a: `<ol start="0"><li>(a) <strong>Sequence</strong>, randomizing sequence items within constraints. It says what to do, not when.</li><li>(b) <strong>Driver</strong>: the only component that knows the handshake timing.</li><li>(c) <strong>Monitor</strong>: it watches pins and publishes transactions on an analysis port.</li><li>(d) <strong>Scoreboard</strong>, holding a register-map model that the monitor's write transactions update.</li><li>(e) <strong>Coverage collector</strong>: a covergroup crossing register offset with "BREADY was low."</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>At core level, the passive LSU–cache agent's protocol check fires: the LSU dropped VALID before the cache raised READY. Both block-level testbenches passed for weeks. How did the bug get through, and what do you change?</p>`,
        a: `<p>At block level, the LSU only ever talked to the agent acting as the cache, and that responder probably raised READY within a cycle or two. The real cache holds READY low much longer (during a miss or a fill), and only then does the LSU's other behavior show up, for example cancelling a request on a pipeline flush by dropping VALID. First check the spec: if cancelling is legal, the agent's check is wrong; if not, the LSU is wrong. Either way, fix the block-level gap: randomize the responder's READY delay over a wide range (including very long stalls) and inject flushes while a request is waiting, and add a coverage bin for "flush while VALID and not READY" so the hole is visible if it appears again.</p>`
      }
    ]
  }
},

{
  id: "verif-refmodel",
  region: "verif",
  title: "Checking Against a Reference Model",
  sections: [{ id: "ref-compare", label: "Comparing RTL Against the Reference Model" }, { id: "c-model-example", label: "Example: ADD Against a C Model" }, { id: "both-wrong", label: "When Both Have Bugs" }],
  body: `
<p>Most correctness checking for a CPU comes down to comparing the RTL against a reference model that executes the ISA directly. This page covers how the comparison works, a complete example, and what happens when both sides have bugs.</p>

<h3 id="sec-ref-compare">Comparing RTL Against the Reference Model</h3>
<p>For ISA-level checking, the RTL is compared against a <strong>reference model</strong>: a functional ISA simulator that executes one instruction at a time and updates registers, memory, and the PC exactly as the ISA defines, with no timing, pipeline, or caches (see <a href="#/eda-arch/models">Functional vs. cycle-level models</a>). It may be an open-source simulator (such as Spike for RISC-V), a commercial one, or a company's own “golden model.” It's usually built early, but by a different team than the RTL and separately from the performance model, so the two implementations are independent.</p>
<p><strong>Step 0: capture what the RTL retires.</strong> A monitor in the testbench (not in the chip) watches the core's commit stage. Each time an instruction retires, it records the PC and instruction, the destination register and value written, any store's address and data, and any exception or interrupt taken. Some ISAs standardize this interface, such as the RISC-V Formal Interface (RVFI). A trace entry might look like:</p>
<pre><code>PC 0x80000010  add x5, x6, x7   x5 = 0x2a</code></pre>
<p><strong>Step 1: compare against the reference model,</strong> in one of two ways:</p>
<ul>
<li><strong>After the run:</strong> the RTL writes its retirement trace to a log file, the reference model runs the same program and writes its own log, and a script compares them line by line. It's simple, and the first differing line pinpoints the instruction where they diverged. The drawbacks: logs get huge, the simulation keeps running long past the error (wasting time and piling up side effects), and debugging usually means rerunning the test with waveforms recorded around that point. Random-instruction flows such as riscv-dv work this way.</li>
<li><strong>Live (“lockstep” or “step and compare”):</strong> the reference model runs inside the simulation, linked to the testbench. Each time the RTL retires an instruction, the testbench tells the model to execute exactly one instruction and compares the results immediately. The first mismatch stops the simulation at that exact instruction and cycle, with the waveforms still at hand. A superscalar core that retires several instructions in a cycle steps the model several times.</li>
</ul>
<p><strong>Example: a retirement trace comparison.</strong> A short program stores a value and loads it straight back. The reference model's trace:</p>
<pre><code>#  PC          Instruction          Result
1  0x80000000  addi x5, x0, 7       x5 = 0x00000007
2  0x80000004  addi x6, x0, 6       x6 = 0x00000006
3  0x80000008  mul  x7, x5, x6      x7 = 0x0000002a
4  0x8000000c  sw   x7, 0(x10)      mem[0x80001000] = 0x0000002a
5  0x80000010  lw   x8, 0(x10)      x8 = 0x0000002a</code></pre>
<p>The RTL's trace matches for instructions 1 through 4, but differs at 5:</p>
<pre><code>5  0x80000010  lw   x8, 0(x10)      x8 = 0x00000000</code></pre>
<p>The comparison reports:</p>
<pre><code>MISMATCH at instruction 5 (PC 0x80000010, cycle 1234)
  x8: RTL = 0x00000000, reference = 0x0000002a</code></pre>
<p>The load returned the old memory value instead of the value just stored, which points at store-to-load forwarding in the load/store queue. The engineer opens the waveform at cycle 1234 and follows that path backward (see <a href="#/verif-debug/debug-flow">the debug flow</a>).</p>
<p><strong>What gets compared:</strong> usually just each instruction's changes (the next PC, the register written and its value, any memory stored), not the entire state every time. Full register and memory state is compared at the end of the test or at checkpoints.</p>
<p><strong>Events with no single right answer:</strong> interrupts, timer values, and reads from devices depend on timing the reference model can't predict. So the RTL tells the model what happened (“take this interrupt now,” “this load returned this value”), and the model follows along. For multicore programs, lockstep isn't enough, because the order in which cores see each other's stores can legally vary; those are checked with memory-consistency checkers and litmus tests instead.</p>

<h3 id="sec-c-model-example">Example: Checking an ADD Against a C Model</h3>
<p>A minimal version of live lockstep checking, with all three pieces: a C functional model, a tiny RTL core, and a SystemVerilog testbench that runs random ADD instructions on both and compares the results. It uses the RISC-V ADD encoding.</p>
<p><strong>The C functional model.</strong> The 32 architectural registers are a plain array. <code>ref_step()</code> decodes one instruction and, if it’s an ADD, writes <code>rs1 + rs2</code> into <code>rd</code>. There is no clock or pipeline: each call executes a whole instruction instantly. It keeps <code>x0</code> at zero, as RISC-V requires.</p>
<pre><code><span class="cm">// ref_model.c</span>
#include &lt;stdint.h&gt;

static uint32_t regs[32];   <span class="cm">// architectural register file; x0 is always 0</span>

void ref_reset(void) {
    for (int i = 0; i &lt; 32; i++) regs[i] = 0;
}

void ref_set_reg(int idx, uint32_t val) {
    if (idx != 0) regs[idx] = val;
}

uint32_t ref_get_reg(int idx) {
    return regs[idx];
}

<span class="cm">// Execute one instruction. Returns 1 if it was an ADD, 0 otherwise.</span>
int ref_step(uint32_t insn) {
    uint32_t opcode = insn &amp; 0x7f;
    uint32_t rd     = (insn &gt;&gt; 7)  &amp; 0x1f;
    uint32_t funct3 = (insn &gt;&gt; 12) &amp; 0x07;
    uint32_t rs1    = (insn &gt;&gt; 15) &amp; 0x1f;
    uint32_t rs2    = (insn &gt;&gt; 20) &amp; 0x1f;
    uint32_t funct7 = insn &gt;&gt; 25;

    if (opcode == 0x33 &amp;&amp; funct3 == 0 &amp;&amp; funct7 == 0) {   <span class="cm">// ADD</span>
        if (rd != 0) regs[rd] = regs[rs1] + regs[rs2];        <span class="cm">// wraps mod 2^32</span>
        return 1;
    }
    return 0;
}</code></pre>
<p><strong>The RTL.</strong> A register file, decode logic that pulls out the opcode and register fields, and an adder. On each rising clock edge where <code>valid</code> is high and the instruction is an ADD, it writes the sum into <code>rd</code>. The <code>dbg_*</code> port is a test-only shortcut for loading starting values into the registers.</p>
<pre><code><span class="cm">// tiny_core.sv</span>
module tiny_core (
  input  logic        clk, rst_n,
  input  logic        valid,      <span class="cm">// an instruction is presented this cycle</span>
  input  logic [31:0] insn,
  input  logic        dbg_we,     <span class="cm">// test-only register write port</span>
  input  logic [4:0]  dbg_idx,
  input  logic [31:0] dbg_data
);
  logic [31:0] regs [32];

  <span class="cm">// Decode (RISC-V R-type fields)</span>
  wire [6:0] opcode = insn[6:0];
  wire [4:0] rd     = insn[11:7];
  wire [2:0] funct3 = insn[14:12];
  wire [4:0] rs1    = insn[19:15];
  wire [4:0] rs2    = insn[24:20];
  wire [6:0] funct7 = insn[31:25];
  wire is_add = (opcode == 7'b0110011) &amp;&amp; (funct3 == 3'b000) &amp;&amp; (funct7 == 7'b0000000);

  <span class="cm">// Execute and write back on the clock edge</span>
  always_ff @(posedge clk) begin
    if (!rst_n) begin
      for (int i = 0; i &lt; 32; i++) regs[i] &lt;= '0;
    end else if (dbg_we &amp;&amp; dbg_idx != 0) begin
      regs[dbg_idx] &lt;= dbg_data;
    end else if (valid &amp;&amp; is_add &amp;&amp; rd != 0) begin
      regs[rd] &lt;= regs[rs1] + regs[rs2];
    end
  end
endmodule</code></pre>
<p><strong>The testbench.</strong></p>
<pre><code><span class="cm">// core_tb.sv</span>
module core_tb;
  <span class="cm">// DPI-C: call the C functions directly from SystemVerilog</span>
  import "DPI-C" function void         ref_reset();
  import "DPI-C" function void         ref_set_reg(input int idx, input int unsigned val);
  import "DPI-C" function int unsigned ref_get_reg(input int idx);
  import "DPI-C" function int          ref_step(input int unsigned insn);

  logic        clk = 0, rst_n;
  logic        valid;
  logic [31:0] insn;
  logic        dbg_we;
  logic [4:0]  dbg_idx;
  logic [31:0] dbg_data;

  tiny_core dut (.*);                  <span class="cm">// design under test</span>

  always #5 clk = ~clk;

  <span class="cm">// Encode ADD rd, rs1, rs2</span>
  function automatic logic [31:0] make_add(logic [4:0] rd, rs1, rs2);
    return {7'b0000000, rs2, rs1, 3'b000, rd, 7'b0110011};
  endfunction

  initial begin
    int          errors = 0;
    logic [4:0]  rd, rs1, rs2;

    <span class="cm">// Reset both models</span>
    rst_n = 0; valid = 0; dbg_we = 0; insn = '0;
    ref_reset();
    repeat (2) @(posedge clk);
    rst_n = 1;

    <span class="cm">// Load the same random values into both register files</span>
    for (int i = 1; i &lt; 32; i++) begin
      @(negedge clk);
      dbg_we = 1; dbg_idx = i; dbg_data = $urandom;
      ref_set_reg(i, dbg_data);
    end
    @(negedge clk) dbg_we = 0;

    <span class="cm">// Random ADDs: send each one to both, then compare</span>
    repeat (1000) begin
      rd = $urandom; rs1 = $urandom; rs2 = $urandom;

      @(negedge clk);
      insn  = make_add(rd, rs1, rs2);
      valid = 1;
      void'(ref_step(insn));           <span class="cm">// C model executes instantly</span>

      @(negedge clk);                  <span class="cm">// RTL executed at the posedge in between</span>
      valid = 0;

      for (int r = 0; r &lt; 32; r++)     <span class="cm">// compare every register, not just rd</span>
        if (dut.regs[r] !== ref_get_reg(r)) begin
          $error("After ADD x%0d, x%0d, x%0d: x%0d RTL=%h model=%h",
                 rd, rs1, rs2, r, dut.regs[r], ref_get_reg(r));
          errors++;
        end
    end

    if (errors == 0) $display("PASS: 1000 ADDs matched the C model");
    else             $display("FAIL: %0d mismatches", errors);
    $finish;
  end
endmodule</code></pre>
<p><strong>What the testbench does:</strong></p>
<ol start="0">
<li><strong>Connects the C code.</strong> <code>import "DPI-C"</code> lets SystemVerilog call the C functions as if they were its own. The C file is compiled and linked into the simulator, so the model runs in the same process on the host machine.</li>
<li><strong>Gives both the same starting state.</strong> It resets both, then loads the same random values into registers 1 to 31 of each.</li>
<li><strong>Runs each ADD on both.</strong> For each of 1,000 random ADDs, it presents the instruction to the RTL and calls <code>ref_step()</code> on the C model. The RTL executes at the next rising edge; the C model executes immediately.</li>
<li><strong>Compares.</strong> After the clock edge, it compares all 32 registers, not just <code>rd</code>. That catches bugs such as writing the result to the wrong register or corrupting <code>x0</code>. Random 32-bit values naturally include sums that overflow, so it also checks that both sides wrap correctly.</li>
</ol>
<p><strong>How a real CPU differs.</strong> A pipelined core finishes an instruction several cycles after it starts, so the testbench compares when each instruction <strong>retires</strong>, using the retirement monitor described above, rather than right after each clock edge. And instead of comparing every register each time, it usually compares only what each instruction changed, with full-state checks at the end or at checkpoints. This toy core finishes each instruction in one cycle, so it can compare right away.</p>
<p><strong>Building it:</strong> list all three files on the simulator’s command line, for example <code>xrun ref_model.c tiny_core.sv core_tb.sv</code> with Cadence Xcelium, or the equivalent with VCS or Questa.</p>

<h3 id="sec-both-wrong">What If Both the RTL and the Reference Model Have Bugs?</h3>
<p>A mismatch only says the two disagree, not which one is wrong. Engineers check the ISA specification itself to decide, and it's common for the bug to be in the model. Comparing two independent implementations finds bugs in both; this is sometimes called differential testing.</p>
<p>The real danger is the <strong>same bug in both</strong>, for example when both teams misread an ambiguous line of the spec the same way. Then they agree, nothing mismatches, and the bug escapes. Teams reduce that risk by:</p>
<ul>
<li>Keeping the model and the RTL written by different teams, from the spec, without sharing code.</li>
<li>Using well-established reference models, or ones generated from a formal, machine-readable ISA specification (Arm publishes its architecture in a machine-readable form, and RISC-V has a formal model written in the Sail language).</li>
<li>Running self-checking tests and ISA compliance suites whose expected results are written down independently of either implementation.</li>
<li>Using other methods with different blind spots: formal verification of properties, booting real operating systems on emulation, and post-silicon validation.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A 4-wide core runs in lockstep with a reference model. It retires 3 instructions in cycle 0, none in cycle 1, and 4 in cycle 2. Numbering retired instructions from 0, how many times is the model stepped in each cycle, and if the second instruction retired in cycle 2 mismatches, which instruction does the report name?</p>`,
        a: `<ol start="0"><li>The model is stepped once per retired instruction: 3 times in cycle 0, 0 in cycle 1, 4 in cycle 2.</li><li>Cycle 0 retires instructions 0, 1, and 2. Cycle 2 retires 3, 4, 5, and 6.</li><li>The second one in cycle 2 is <strong>instruction 4</strong>. The simulation stops there, with cycle 2 as the time to open the waveform at; instructions 5 and 6 are never compared.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A two-core RISC-V SoC runs a lock-free queue test in lockstep. Core 1's load returns a value different from what the reference model, which runs the cores one after the other, predicts. Is this an RTL bug?</p>`,
        a: `<p>Not necessarily. Under RISC-V's weak memory model (RVWMO), a load to shared memory can legally return any of several values depending on how the cores' accesses interleave, and a reference model that runs the cores sequentially picks just one interleaving. The fix is in the checking, not the RTL: let the model take the RTL's value for loads to shared data, and check those values separately with a memory-consistency checker that confirms each one is allowed by the model's rules (it came from some store that was visible under RVWMO's ordering rules). Litmus tests (message passing, store buffering) then confirm the RTL never shows a forbidden outcome. It is an RTL bug only if the observed value is impossible under every legal ordering.</p>`
      }
    ]
  }
},

{
  id: "verif-coverage",
  region: "verif",
  title: "Coverage",
  sections: [{ id: "coverage", label: "Coverage" }, { id: "coverage-calc", label: "How Coverage Is Tracked and Calculated" }],
  body: `
<p>Passing tests only matter if they exercised the design. Coverage measures what the tests actually reached, and it decides when verification is done.</p>

<h3 id="sec-coverage">Coverage</h3>
<p><strong>Coverage</strong> measures how much of the design's behavior the tests have actually exercised. It answers “what have we tested?”, not “is it correct?” Checkers, scoreboards, assertions, and the reference model decide correctness; coverage tells you which situations those checks have seen. Random tests make coverage essential: without it, there's no way to know whether a million random runs ever hit the corner case you care about.</p>
<p><strong>Code coverage</strong> is collected automatically by the simulator from the RTL itself:</p>
<ul>
<li><strong>Line (statement) coverage:</strong> has every line of RTL executed?</li>
<li><strong>Branch and condition coverage:</strong> has every <code>if</code>/<code>case</code> branch been taken, and has each part of a condition been both true and false?</li>
<li><strong>Toggle coverage:</strong> has every bit of every signal changed from 0 to 1 and back?</li>
<li><strong>State machine coverage:</strong> has every state and every transition of each control state machine been visited?</li>
</ul>
<p><strong>Functional coverage</strong> is written by verification engineers from the specification, to describe the scenarios that matter. In SystemVerilog it's written as covergroups: each <em>coverpoint</em> samples a value and sorts it into <em>bins</em>, and a <em>cross</em> requires every combination of two coverpoints. For example, for the load/store queue:</p>
<pre><code>covergroup lsq_cg @(posedge clk iff ld_issue);
  cp_size: coverpoint ld_size  { bins sz[]    = {1, 2, 4, 8}; }
  cp_fwd:  coverpoint fwd_kind { bins kinds[] = {NO_MATCH, FULL_FWD, PARTIAL_STALL}; }
  size_x_fwd: cross cp_size, cp_fwd;   <span class="cm">// 4 x 3 = 12 combinations</span>
endgroup</code></pre>
<p>This asks whether every load size has been seen with every forwarding outcome, including an 8-byte load that partially overlaps an older store. Assertions can also carry <em>cover properties</em> that count how often a sequence of events (such as “store address resolves after a younger load already ran”) actually happened.</p>
<p><strong>How coverage is used</strong> (coverage-driven verification):</p>
<ol start="0">
<li><strong>Plan:</strong> the verification plan lists features from the spec, and each gets coverage points.</li>
<li><strong>Run:</strong> random regressions run with many seeds, and coverage from every run is merged into one database.</li>
<li><strong>Find holes:</strong> reports show which bins were never hit.</li>
<li><strong>Close holes:</strong> adjust random constraints to steer tests toward them, write directed tests, or, if a bin is truly unreachable by design, exclude it with a written justification.</li>
<li><strong>Repeat</strong> until coverage goals are met. Coverage closure, together with a falling rate of new bugs, is a main signoff criterion.</li>
</ol>
<p>Coverage also helps manage regressions: <em>test grading</em> ranks tests by how much unique coverage each adds, so a small, fast subset can be picked that still covers most of the design.</p>
<p><strong>Limits.</strong> 100% coverage doesn't mean bug-free. A bin can be hit while no checker looks at the result, the coverage model can miss a scenario nobody thought to write down, and code coverage can't reveal a feature the RTL is missing entirely. Coverage measures the completeness of testing, only as well as the coverage model itself was designed.</p>
<p><strong>Same word, different meanings.</strong> “Coverage” also means the fraction of manufacturing faults that test patterns detect (fault coverage, in <a href="#/eda-dft">Design for test</a>), and the fraction of cache misses a prefetcher removes (in <a href="#/prefetch">Prefetching</a>). Context tells you which one is meant.</p>
<div class="callout"><strong>Where Normal Computing fits:</strong> <a href="https://www.normalcomputing.com/solutions" target="_blank" rel="noopener">Normal EDA</a> generates coverage criteria from the spec and keeps each one traceable to the requirement it measures, so coverage reports show which parts of the spec have been exercised, not just which lines of RTL. Its command-line tool tracks simulation runs and coverage progress.</div>

<h3 id="sec-coverage-calc">How Coverage Is Tracked and Calculated</h3>
<p><strong>The RTL itself doesn't track anything.</strong> The design isn't changed. The simulator does the tracking, plus coverage code that lives in the testbench.</p>
<p><strong>Code coverage: the simulator instruments the design.</strong> When the design is compiled with coverage turned on (a compile option in VCS, Xcelium, or Questa), the simulator quietly adds a hidden counter for every line, every branch, every bit's 0→1 and 1→0 transitions, and every state-machine state and transition. As the test runs, each counter goes up whenever its event happens. Nobody writes this by hand, which is why code coverage is “automatic.” It does slow the simulation down, so it's sometimes switched off for runs that don't need it.</p>
<p><strong>Functional coverage: the testbench watches RTL signals.</strong> A covergroup like the one above is SystemVerilog code in the testbench (or attached to the design without modifying it). It reads RTL signals such as the load size and forwarding result, or values a testbench monitor derives from them. At each sampling event, here every cycle a load issues, the simulator checks which bin the sampled values fall into and increments that bin's counter. Cross bins work the same way: the pair (8-byte load, partial overlap) increments one specific counter out of the 12.</p>
<p><strong>Saving and merging.</strong> At the end of each test, the counters are saved to a coverage database file. A merge tool combines the databases from thousands of regression runs: a bin counts as covered if any run hit it. Reporting tools, such as Synopsys Verdi or Cadence's Integrated Metrics Center, show coverage per file, block, and covergroup, list exactly which lines or bins were never hit, and can link each one back to items in the verification plan. An industry standard format (Accellera's UCIS) lets different tools share coverage data.</p>
<p><strong>Calculating the percentages.</strong> Each metric is hits divided by total:</p>
<ul>
<li><strong>Line coverage:</strong> if 2,000 of 2,100 lines executed, that's 2,000 / 2,100 ≈ 95.2%, and the report lists the 100 unexecuted lines by file and line number.</li>
<li><strong>Toggle coverage:</strong> bits that have toggled both ways, divided by all bits.</li>
<li><strong>Functional coverage:</strong> bins hit at least once (or a set minimum number of times), divided by total bins, not counting bins marked as ignored or illegal.</li>
</ul>
<p>For the load/store covergroup above, by default each coverpoint and cross counts equally:</p>
<div class="tbl"><table>
<tr><th>Item</th><th>Bins hit</th><th>Coverage</th></tr>
<tr><td>Load size</td><td>4 of 4</td><td>100%</td></tr>
<tr><td>Forwarding outcome</td><td>3 of 3</td><td>100%</td></tr>
<tr><td>Size × outcome cross</td><td>9 of 12</td><td>75%</td></tr>
<tr><td><strong>Covergroup</strong></td><td>Average of the three</td><td>(100 + 100 + 75) / 3 ≈ <strong>91.7%</strong></td></tr>
</table></div>
<p>This is why crosses matter: every size and every outcome appeared somewhere, yet three combinations never happened together. The report names exactly which three, so the team knows where to steer the tests next.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>An ALU covergroup has <code>cp_op</code> with 5 bins (ADD, SUB, AND, OR, XOR), <code>cp_carry</code> with 2 bins (carry out 0 or 1), and their cross (10 bins). After the regression, every op and both carry values were hit, but the cross bins (AND, 1), (OR, 1), and (XOR, 1) never were. What's the covergroup coverage, and what should the team do?</p>`,
        a: `<ol start="0"><li>cp_op: 5 of 5 = 100%. cp_carry: 2 of 2 = 100%. Cross: 7 of 10 = 70%.</li><li>Covergroup: (100 + 100 + 70) / 3 = <strong>90%</strong>.</li><li>The three missing bins can't happen: logic ops never produce a carry out. They aren't test holes, so more random runs won't help.</li><li>Mark them as <code>ignore_bins</code> with a written reason. The cross becomes 7 of 7, and the covergroup reaches <strong>100%</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A core reached 100% line and branch coverage, yet silicon shows a bug: misaligned atomic memory operations should raise an exception, and the core silently performs them. Why didn't coverage catch it, and what would have?</p>`,
        a: `<p>Code coverage only measures code that exists. The core has no logic for that case, so there's no line or branch left unhit. Two things would have caught it: functional coverage written from the spec (a bin for "AMO with a misaligned address"), which would have shown the case was never generated; and stimulus that does generate it, so the reference model, which raises the exception, would have mismatched the RTL at the first such instruction. The lesson is that coverage completeness depends on the coverage model being built from the spec, not from the RTL.</p>`
      }
    ]
  }
},

{
  id: "verif-debug",
  region: "verif",
  title: "Regressions and Debug",
  sections: [{ id: "regressions", label: "Regression Suites" }, { id: "waveforms", label: "Waveforms" }, { id: "debug-flow", label: "The Debug Flow" }],
  body: `
<p>How tests run at scale every day, and what engineers do when one fails: from the failing test to the waveform to the root cause.</p>

<h3 id="sec-regressions">Regression Suites</h3>
<p>A <strong>regression suite</strong> is a collection of tests run over and over, every time the design changes, to make sure nothing that used to work has broken. The name comes from “regressing”: going backward by reintroducing a bug or breaking something that previously passed.</p>
<p>In chip verification it typically includes:</p>
<ul>
<li><strong>Directed tests:</strong> hand-written tests for specific features or past bugs.</li>
<li><strong>Constrained-random tests,</strong> each run with many different seeds, so every regression explores new cases.</li>
<li><strong>Assertions and formal checks</strong> running alongside.</li>
</ul>
<p>With thousands to millions of test runs, they execute in parallel on a server farm or the cloud, usually in tiers:</p>
<ul>
<li><strong>Smoke (sanity) suite:</strong> a few minutes of quick tests an engineer runs before submitting a change.</li>
<li><strong>Nightly regression:</strong> a large set run every night on the latest design.</li>
<li><strong>Full or weekly regression:</strong> everything, including the longest tests.</li>
</ul>
<p>Each run produces a pass/fail report and merged coverage data. New failures are triaged with the <a href="#/verif-debug/debug-flow">debug flow</a> below. When a bug is fixed, the test that found it joins the suite, so every future regression checks that the bug hasn't come back.</p>
<p><strong>Performance regressions.</strong> Performance teams use the same idea: a fixed set of workloads runs on each new version of the performance model (or RTL), and any unexpected change in IPC or other metrics is flagged, so a change that accidentally slows the design down is caught right away. See <a href="#/eda-arch">Architecture and performance modeling</a>.</p>

<h3 id="sec-waveforms">Waveforms</h3>
<p>A <strong>waveform</strong> is a recording of how the design's signals change over time during a simulation. It shows the value of every recorded wire and register at every moment, drawn as horizontal traces against time, like a logic analyzer screen for a chip that doesn't exist yet:</p>
<pre><code>cycle:      1     2     3     4     5
clk       _|‾|__|‾|__|‾|__|‾|__|‾|__
ld_valid  ______|‾‾‾‾‾‾‾‾‾‾‾|_______
ld_addr   ======X 0x40 X 0x48 X=====
hit       ____________|‾‾‾‾‾|_______</code></pre>
<ul>
<li><strong>Single-bit signals</strong> (like <code>clk</code> or <code>hit</code>) are drawn as high or low lines.</li>
<li><strong>Multi-bit signals</strong> (like an address bus) are drawn as bands labeled with their value, with an X where the value changes.</li>
<li>Time runs left to right, usually lined up with clock edges. The timing diagram on <a href="#/timing">Critical path and flip-flop timing</a> is the same idea at a much finer time scale.</li>
</ul>
<p><strong>Debugging with them.</strong> The engineer opens the waveform in a viewer (such as Synopsys Verdi, Cadence SimVision, or the open-source GTKWave), jumps to the failing cycle, and works backward. For example, if a load returned stale data: was the older store still in the store queue? Did its address match? Which input did the forwarding mux select, and why? Following signals back cycle by cycle usually leads to the root cause.</p>
<p><strong>Why they're expensive.</strong> Recording every signal on every cycle of a long simulation produces enormous files (in formats such as VCD or FSDB) and slows the simulation down. So teams record only selected signals or a time window, or run without recording and then rerun the failing seed with waveforms turned on around the failure. That's one reason live comparison is easier to debug than comparing logs after the run: it stops right at the first mismatch, so the window that matters is easy to capture.</p>

<h3 id="sec-debug-flow">When a Mismatch Is Found: The Debug Flow</h3>
<p><strong>0. Reproduce it.</strong> Random tests are driven by a seed, so rerunning with the same seed replays the exact same test. The engineer reruns the failing test, this time recording waveforms around the failure (see <a href="#/verif-debug/waveforms">Waveforms</a> above).</p>
<p><strong>1. Triage: who's wrong?</strong> A mismatch has three possible causes, and the engineer checks the ISA or microarchitecture specification to decide:</p>
<ul>
<li><strong>The RTL is wrong:</strong> a real design bug.</li>
<li><strong>The reference model is wrong:</strong> it misimplements the spec.</li>
<li><strong>The test is wrong:</strong> the testbench generated something illegal, or set up the scenario incorrectly.</li>
</ul>
<p>Sometimes the answer is that the spec itself is ambiguous. Then the architects clarify it, and both implementations are checked against the clarified wording.</p>
<p><strong>3a. If the RTL is wrong:</strong></p>
<ul>
<li>The bug is filed in a bug-tracking system with the failing seed, waveform, and analysis, and the RTL designer fixes it.</li>
<li>The failing test is added to the regression suite so the bug can't silently return, and often an assertion is added that would catch the same problem immediately.</li>
<li>Regressions are rerun to make sure the fix didn't break something else.</li>
<li>The team asks whether similar bugs might exist nearby, and adds coverage points or targeted tests for that area.</li>
<li>Timing matters: early fixes are just RTL edits. After synthesis and layout, a fix may need an engineering change order (ECO) that patches the netlist without redoing the whole flow. After tapeout, the options are workarounds, disabling features, or a respin (see <a href="#/eda-tapeout">Tapeout</a>).</li>
</ul>
<p><strong>3b. If the reference model is wrong:</strong></p>
<ul>
<li>The model's owners fix it, and the fix is checked against the spec and the compliance suites.</li>
<li>Earlier tests that “passed” are rerun, because the RTL may have matched the model's wrong behavior, hiding a real RTL bug with the same mistake.</li>
<li>Other users of the model are told, since software teams and the performance model may depend on it too.</li>
</ul>
<p><strong>3c. If the test is wrong:</strong> the testbench or its constraints are fixed, and the test is rerun.</p>
<p><strong>Tracking progress.</strong> Teams track how many bugs are found each week. A falling rate of new bugs, together with coverage goals being met, is one of the main signals that a design is ready to sign off for tapeout.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A nightly regression has 20,000 runs averaging 45 minutes each, on a farm with 2,000 simulator licenses. How long does it take? The team then turns on coverage collection, which slows simulation by 30%. Does it still finish within a 10-hour night?</p>`,
        a: `<ol start="0"><li>Total work: 20,000 × 45 = 900,000 license-minutes.</li><li>Spread over 2,000 licenses: 900,000 / 2,000 = 450 minutes = <strong>7.5 hours</strong>.</li><li>With coverage: 7.5 × 1.3 = <strong>9.75 hours</strong>. It fits, but only barely, and the longest single tests or a busy farm will push it over. Options: collect coverage on a graded subset each night and on everything weekly.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>The nightly regression goes from 0 to 37 failures, all on different seeds, after a day with 6 RTL commits and 1 reference-model commit. How do you triage efficiently?</p>`,
        a: `<ol start="0"><li><strong>Cluster by signature:</strong> group failures by the first error (mismatch type, PC or instruction class, assertion name). 37 failures are often 1 to 3 bugs.</li><li><strong>Pick the shortest failing seed</strong> in each cluster, so reruns are fast.</li><li><strong>Bisect the commits:</strong> rerun that seed at points in the 7 commits; a binary search needs at most 3 reruns.</li><li><strong>Check the model commit first</strong> if the failures are mismatches in the area it touched: a model bug fails tests the same way an RTL bug does.</li><li>Rerun the guilty seed with waveforms, find the root cause, and file one bug per cluster, not 37.</li></ol>`
      }
    ]
  }
}
]);
