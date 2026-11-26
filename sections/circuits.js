/* Section: Circuits
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "circ"). */

section({
  id: "circ",
  name: "Circuits",
  cap: "Transistors, energy, gates, clocking, and the selection logic built from them",
  body: `
<p>Every microarchitectural trade-off eventually becomes a circuit question: how many transistors switch, how fast, and at what voltage. The last page, <a href="#/select-logic">Selection and Arbitration Logic</a>, covers the decoders, priority encoders, arbiters, and age logic that the core's queues are built from.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A design runs at 1.0 V and 3 GHz. You lower voltage to 0.9 V, which forces frequency down to 2.7 GHz. Estimate the change in dynamic power and in dynamic energy per task.</p>`,
        a: `<ol><li>Dynamic power ∝ V² f: (0.9)² × (2.7 / 3.0) = 0.81 × 0.9 = <strong>0.73×</strong>.</li><li>Energy per task ∝ V² (the task needs the same number of switching events): <strong>0.81×</strong>.</li><li>The task takes 1 / 0.9 ≈ 1.11× longer.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why did single-core frequency stop rising around the mid-2000s?</p>`,
        a: `<p>Under Dennard scaling, each generation shrank voltage along with dimensions, keeping power density constant. Lowering voltage further requires lowering threshold voltage, and leakage grows exponentially as threshold drops. Voltage stopped scaling, so higher frequency meant more power per mm², which cooling could not remove. The industry turned to more cores, wider cores, and specialized units instead.</p>`
      }
    ]
  }
}, [
{
  id: "transistors",
  region: "circ",
  title: "Transistor Physics and Energy",
  sections: [
    { id: "mosfet", label: "The MOSFET" },
    { id: "dynamic-energy", label: "Dynamic Energy" },
    { id: "leakage-static-power", label: "Leakage (Static) Power" },
    { id: "speed-voltage", label: "Speed and Voltage" },
    { id: "end-dennard-scaling", label: "The End of Dennard Scaling" },
    { id: "vt-flavors", label: "Threshold-Voltage Flavors" },
    { id: "power-saving-techniques", label: "Power-Saving Techniques" },
    { id: "architects-care", label: "Why Architects Care" }
  ],
  body: `
<h3 id="sec-mosfet">The MOSFET</h3>
<p>A MOSFET is a voltage-controlled switch with a gate, source, and drain. In an nMOS transistor, raising the gate-to-source voltage above the threshold voltage V<sub>th</sub> forms a conducting channel; a pMOS transistor conducts when its gate is low. CMOS logic pairs them so that, ideally, there's never a direct path from supply to ground in steady state.</p>
<p>Modern transistors wrap the gate around the channel for better control: FinFETs (gate on three sides of a fin) and gate-all-around nanosheets (gate on all sides), which reduce leakage at small sizes.</p>
<h3 id="sec-dynamic-energy">Dynamic Energy</h3>
<ul>
<li>Charging a node of capacitance C to V<sub>dd</sub> draws C V<sup>2</sup> from the supply: half is stored, half is lost in the pull-up; the stored half is lost on discharge. So each 0→1→0 cycle costs C V<sup>2</sup>, or ½ C V<sup>2</sup> per transition.</li>
<li><strong>Dynamic power:</strong> P<sub>dyn</sub> = α C V<sup>2</sup> f, where α is the activity factor (fraction of capacitance switching per cycle).</li>
<li><strong>Short-circuit power:</strong> both transistors briefly conduct during a transition; usually a small share.</li>
</ul>
<h3 id="sec-leakage-static-power">Leakage (Static) Power</h3>
<ul>
<li><strong>Subthreshold leakage:</strong> current flows even when "off," growing exponentially as V<sub>th</sub> falls: I ∝ e<sup>(V<sub>gs</sub> − V<sub>th</sub>) / (n kT/q)</sup>. At room temperature the best possible slope is about 60 mV per 10× change in current.</li>
<li>Leakage also rises steeply with temperature, which can feed back into more heat.</li>
<li><strong>Gate leakage:</strong> tunneling through the thin gate dielectric, reduced by high-k materials.</li>
</ul>
<h3 id="sec-speed-voltage">Speed and Voltage</h3>
<p>Gate delay ∝ C V / I<sub>on</sub>, and I<sub>on</sub> ∝ (V − V<sub>th</sub>)<sup>a</sup> with a ≈ 1.2–1.5 for modern devices. Higher voltage means faster switching, so frequency rises roughly linearly with voltage over the normal range. Combined with P ∝ V<sup>2</sup> f, power grows roughly as V<sup>3</sup> at the top of the frequency curve.</p>
<h3 id="sec-end-dennard-scaling">The End of Dennard Scaling</h3>
<p>Until the mid-2000s, each process node shrank voltage with size, keeping power density constant. Leakage stopped voltage scaling, so power density started rising with transistor count and frequency, leading to the multicore era and "dark silicon": not everything can switch at once within the power budget.</p>
<h3 id="sec-vt-flavors">Threshold-Voltage Flavors: Fast but Leaky vs. Slow but Frugal</h3>
<p><strong>What leaking means.</strong> A transistor is a switch, but "off" is never perfectly off: a small current still trickles through it. That's leakage. It burns power all the time, even when the circuit is idle (static power), unlike switching power, which is spent only when signals change.</p>
<p><strong>Why a lower threshold is faster.</strong> A lower threshold voltage means the transistor turns on harder and drives more current, so it charges the next gate's capacitance sooner:</p>
<p class="eq">Delay ∝ <span class="frac"><span>C V</span><span>I<sub>on</sub></span></span>, with I<sub>on</sub> ∝ (V − V<sub>th</sub>)<sup>a</sup>, a ≈ 1.3</p>
<p>For example, at V = 0.75 V, lowering V<sub>th</sub> from 0.35 V to 0.25 V raises I<sub>on</sub> by (0.5 / 0.4)<sup>1.3</sup> ≈ 1.34×, cutting gate delay by about 25%. The price: subthreshold leakage grows exponentially as V<sub>th</sub> drops, roughly 10× for every 60–100 mV, so that same 100 mV drop raises leakage by more than an order of magnitude.</p>
<p><strong>Cell libraries offer each gate in several flavors:</strong></p>
<div class="tbl"><table>
<tr><th>Flavor</th><th>Speed</th><th>Leakage</th><th>Where it's used</th></tr>
<tr><td>Low-V<sub>th</sub> (LVT, ultra-low ULVT)</td><td>Fastest</td><td>Highest</td><td>Only on critical paths, the slowest paths that set the clock frequency</td></tr>
<tr><td>Standard-V<sub>th</sub> (SVT)</td><td>Medium</td><td>Medium</td><td>General logic</td></tr>
<tr><td>High-V<sub>th</sub> (HVT)</td><td>Slowest</td><td>Lowest</td><td><ul><li>Most of the chip, since most paths have spare time</li><li>Always-on blocks</li><li>Battery-powered designs where standby power matters</li></ul></td></tr>
</table></div>
<p><strong>Why leaky cells go on critical paths.</strong> The slowest path sets the clock for the whole chip, so a path that's a few picoseconds too slow either slows everything down or must be fixed. Swapping a handful of its cells to low-V<sub>th</sub> versions is often the cheapest fix. The alternatives cost more: bigger cells (area and capacitance), restructuring the logic (design time), an extra pipeline stage (latency), or a higher supply voltage (power across the entire chip).</p>
<p><strong>What happens when cells leak:</strong></p>
<ul>
<li><strong>More static power:</strong> faster battery drain in standby on phones and laptops, and power paid for around the clock in data centers.</li>
<li><strong>More heat, which causes more leakage:</strong> leakage rises steeply with temperature, so a hot chip leaks more and heats further. Designs must make sure this feedback loop settles instead of running away, and hot chips may have to throttle.</li>
<li><strong>Less budget for real work:</strong> chips run under fixed power and thermal limits, so every watt spent leaking is a watt that can't go to switching. Too much leakage can cost more performance than the fast cells gained.</li>
</ul>
<p><strong>A rough example:</strong> if 5% of cells switch to a low-V<sub>th</sub> flavor that leaks 5–10× more, total leakage becomes 0.95 + 0.05 × (5 to 10) = 1.20 to 1.45 times the original: a 20–45% increase. That's why leaky cells are used sparingly, and why idle blocks are power-gated to cut their leakage entirely. For where these choices are made in the design flow, see <a href="#/eda-ppa/vt-decisions">Leaky vs. low-leakage cells</a>.</p>
<h3 id="sec-power-saving-techniques">Power-Saving Techniques</h3>
<ul><li><strong>Clock gating:</strong> stop the clock to idle blocks; cuts dynamic power.</li><li><strong>Power gating:</strong> cut supply to idle blocks; cuts leakage, but wake-up takes time and energy.</li><li><strong>DVFS:</strong> lower voltage and frequency when full speed isn't needed.</li><li><strong>Multi-V<sub>th</sub> cells:</strong> fast, leaky cells on critical paths; slow, low-leakage cells elsewhere.</li></ul>
<h3 id="sec-architects-care">Why Architects Care</h3>
<p>Energy per operation is dominated by moving data, not computing on it: fetching operands from DRAM costs orders of magnitude more energy than an add. That is the physical reason caches, locality, and specialization matter for power.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A core has 10 nF of switchable capacitance with an average activity factor of 0.15, running at 0.8 V and 3 GHz. What's its dynamic power? If DVFS drops it to 0.7 V and 2.6 GHz, what are the new power and energy per task (dynamic only)?</p>`,
        a: `<ol><li>P = α C V² f = 0.15 × 10 nF × 0.64 × 3 × 10<sup>9</sup> = <strong>2.88 W</strong>.</li><li>New power ratio: (0.7 / 0.8)² × (2.6 / 3.0) ≈ 0.66, so about <strong>1.91 W</strong>.</li><li>Energy per task ratio = (0.7 / 0.8)² ≈ <strong>0.77</strong>; the task takes 3.0 / 2.6 ≈ 1.15× longer.</li></ol>`
      },
      {
        q: `<p>A block's leakage is 100 mW. To close timing, 8% of its cells are swapped to a low-V<sub>th</sub> flavor that leaks 6× more. What's the new leakage? If leakage then doubles because the chip runs hotter, what is it?</p>`,
        a: `<ol><li>New leakage factor: 0.92 + 0.08 × 6 = 0.92 + 0.48 = 1.40, so <strong>140 mW</strong> (+40%).</li><li>Doubled by temperature: <strong>280 mW</strong>. This is why leakage is checked at the hot corner, and why designers limit the share of leaky cells.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>"Race to idle" versus running slower at lower voltage: which saves energy?</p>`,
        a: `<p>Lower voltage cuts dynamic energy per operation by V², which favors running slowly. But leakage burns energy for as long as the circuit is powered, so running longer accumulates leakage energy; and the rest of the system (memory, uncore) also draws power while the task runs. If the core can enter a deep power-gated idle state after finishing, racing to idle can win, especially at high temperature and leakage. The best point is usually a middle voltage-frequency setting, found by measuring energy per task across settings.</p>`
      }
    ]
  }
},

{
  id: "gates-clocking",
  region: "circ",
  title: "Logic Gates and Clock Distribution",
  sections: [
    { id: "cmos-gates", label: "CMOS Gates" },
    { id: "sequential-elements", label: "Sequential Elements" },
    { id: "timing", label: "Timing" },
    { id: "clock-distribution", label: "Clock Distribution" },
    { id: "power-performance-area", label: "Power, Performance, Area" }
  ],
  body: `
<h3 id="sec-cmos-gates">CMOS Gates</h3>
<p>Gates are built from complementary pull-up (pMOS) and pull-down (nMOS) networks. NAND and NOR are the natural primitives; an inverter is the simplest gate. NAND is generally preferred because its series transistors are nMOS, which conduct better than pMOS. A gate's delay depends on its load capacitance and drive strength; designers express delay in <strong>FO4</strong> (the delay of an inverter driving four copies of itself) to compare across processes. A high-performance cycle is typically a few tens of FO4.</p>
<h3 id="sec-sequential-elements">Sequential Elements</h3>
<ul><li><strong>Latch:</strong> transparent while the clock is high (or low).</li><li><strong>Flip-flop:</strong> captures input on a clock edge.</li><li><strong>Setup time:</strong> data must be stable this long before the edge.</li><li><strong>Hold time:</strong> data must stay stable this long after the edge.</li><li><strong>Clock-to-Q:</strong> delay from the edge to a valid output.</li></ul>
<h3 id="sec-timing">Timing</h3>
<p>Each pipeline stage is a path from one flip-flop to the next, and the slowest one, the <strong>critical path</strong>, sets the clock frequency. The cycle has to fit clock-to-Q, the logic, setup time, and margins for clock skew (the edge reaching different flip-flops at different times) and jitter (the edge moving from cycle to cycle). <a href="#/timing">Critical Path and Flip-Flop Timing</a> covers each term, the setup and hold equations, and a worked example.</p>
<h3 id="sec-clock-distribution">Clock Distribution</h3>
<p>A PLL generates the clock, and an H-tree, grid, or mesh distributes it to minimize skew. The clock network switches every cycle with activity factor 1, so it is often a large share of dynamic power (commonly 20–40%). Clock gating is the main defense.</p>
<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul><li><strong>Higher frequency:</strong> shorter cycles leave less time for logic after fixed overhead; requires more pipelining or more voltage.</li><li><strong>Tighter skew:</strong> stronger, more power-hungry clock networks (grids) cost power and routing area.</li><li><strong>Faster gates:</strong> larger or low-V<sub>th</sub> transistors on critical paths cost area and leakage.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A pipeline stage has clock-to-Q 30 ps, worst-case logic 250 ps, setup 20 ps, adverse skew 15 ps, and jitter 10 ps. What's the maximum frequency? With hold time 25 ps and minimum logic delay 20 ps, does hold pass?</p>`,
        a: `<ol><li>Minimum period = 30 + 250 + 20 + 15 + 10 = <strong>325 ps</strong>, so f<sub>max</sub> ≈ <strong>3.08 GHz</strong>.</li><li>Hold check: t<sub>clk-q</sub> + t<sub>logic,min</sub> ≥ t<sub>hold</sub> + skew → 30 + 20 = 50 ≥ 25 + 15 = 40. <strong>Passes</strong> with 10 ps of margin.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is a hold violation worse than a setup violation?</p>`,
        a: `<p>Setup failures depend on the clock period, so you can always fix them in silicon by lowering the frequency. Hold failures happen when new data races through a short path within the same clock edge; they don't depend on the period, so lowering the frequency doesn't help. A hold violation in silicon means the chip fails at any speed. Designers fix hold in design by inserting delay buffers on short paths.</p>`
      },
      {
        q: `<p>A stage has 250 ps of logic and 75 ps of per-stage overhead (t<sub>clk-q</sub> + t<sub>setup</sub> + skew + jitter). You split its logic evenly into two stages. How does the timing equation change, and how much faster can the clock run?</p>`,
        a: `<p>Splitting the logic halves t<sub>logic</sub> per stage, but each stage still pays t<sub>clk-q</sub> + t<sub>setup</sub> + skew + jitter. One stage: 250 + 75 = 325 ps. Two stages: 125 + 75 = 200 ps. That is 325 / 200 ≈ 1.6× the frequency, not 2×. The overhead fraction grows with depth, which is the circuit-level reason pipelining has diminishing returns.</p>`
      }
    ]
  }
},

{
  id: "timing",
  region: "circ",
  title: "Critical Path and Flip-Flop Timing",
  sections: [
    { id: "critical-path", label: "The Critical Path" },
    { id: "clock-q", label: "Clock-to-Q" },
    { id: "setup-time", label: "Setup Time" },
    { id: "skew", label: "Skew" },
    { id: "jitter", label: "Jitter" },
    { id: "putting-together", label: "Putting It Together" },
    { id: "power-performance-area", label: "Power, Performance, Area" }
  ],
  body: `
<h3 id="sec-critical-path">The Critical Path</h3>
<p>A pipeline stage is a block of combinational logic between two sets of flip-flops. Data leaves the first flip-flop on one clock edge and must be captured by the second on the next edge. The <strong>critical path</strong> is the slowest path through any stage on the chip: the one with the most gate and wire delay. Because the whole chip shares one clock, that single path sets the minimum clock period for everything.</p>
<p>Designers find it with static timing analysis, which computes the worst-case delay of every path without simulating inputs. In CPUs, typical critical paths include the issue queue's wakeup-select loop, the L1 data cache hit path (index, tag compare, way select), the bypass network, and branch predictor lookups.</p>
<div class="tbl"><svg viewBox="0 0 660 175" role="img" aria-label="Diagram of a pipeline stage: flip-flop 1 feeds combinational logic, which feeds flip-flop 2. The clock reaches flip-flop 2 through a longer wire with an extra buffer, so it arrives later, which is skew." style="width:100%;min-width:520px;max-width:660px;display:block;font-family:var(--sans)">
<defs><marker id="arr1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<rect x="50" y="30" width="80" height="70" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="90" y="62" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">FF1</text>
<text x="90" y="80" text-anchor="middle" style="fill:var(--muted);font-size:11px">launches</text>
<path d="M82,100 L90,90 L98,100" style="fill:none;stroke:var(--trace);stroke-width:1.5"/>
<rect x="210" y="25" width="240" height="80" rx="16" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="330" y="60" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Combinational logic</text>
<text x="330" y="80" text-anchor="middle" style="fill:var(--muted);font-size:11px">slowest path = critical path</text>
<rect x="530" y="30" width="80" height="70" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="570" y="62" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">FF2</text>
<text x="570" y="80" text-anchor="middle" style="fill:var(--muted);font-size:11px">captures</text>
<path d="M562,100 L570,90 L578,100" style="fill:none;stroke:var(--trace);stroke-width:1.5"/>
<line x1="130" y1="65" x2="208" y2="65" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr1)"/>
<text x="168" y="57" text-anchor="middle" style="fill:var(--muted);font-size:11px">Q</text>
<line x1="450" y1="65" x2="528" y2="65" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arr1)"/>
<text x="490" y="57" text-anchor="middle" style="fill:var(--muted);font-size:11px">D</text>
<path d="M15,145 H570 V102" style="fill:none;stroke:var(--pad);stroke-width:1.5"/>
<path d="M90,145 V102" style="fill:none;stroke:var(--pad);stroke-width:1.5"/>
<path d="M330,135 L345,145 L330,155 z" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.5"/>
<text x="20" y="138" style="fill:var(--ink);font-size:12px;font-weight:600">Clock</text>
<text x="440" y="165" text-anchor="middle" style="fill:var(--muted);font-size:11px">longer wire + extra buffer: the edge reaches FF2 later (skew)</text>
</svg></div>
<h3 id="sec-clock-q">Clock-to-Q</h3>
<p>When the clock edge arrives, a flip-flop doesn't update its output instantly. Its internal latches take a short time to pass the captured value through to the output pin, Q. That delay is <strong>clock-to-Q</strong>, typically a few tens of picoseconds. Nothing downstream can start computing until Q is valid, so this time is lost at the start of every cycle.</p>
<div class="tbl"><svg viewBox="0 0 660 270" role="img" aria-label="Timing diagram over one clock period. After the first rising clock edge, FF1's output changes after the clock-to-Q delay. The new value then travels through the logic and arrives at FF2's input just before the setup window, which must end before the earliest possible next clock edge allowing for skew and jitter." style="width:100%;min-width:560px;max-width:660px;display:block;font-family:var(--sans)">
<rect x="515" y="128" width="25" height="32" style="fill:var(--pad-soft);stroke:none"/>
<rect x="540" y="28" width="30" height="135" style="fill:var(--code-bg);stroke:none"/>
<text x="10" y="60" style="fill:var(--ink);font-size:12px;font-weight:600">Clock</text>
<text x="10" y="109" style="fill:var(--ink);font-size:12px;font-weight:600">FF1 output (Q)</text>
<text x="10" y="149" style="fill:var(--ink);font-size:12px;font-weight:600">FF2 input (D)</text>
<path d="M130,70 H170 V40 H370 V70 H570 V40 H650" style="fill:none;stroke:var(--trace);stroke-width:2"/>
<path d="M130,95 H202 L212,115 H650 M130,115 H202 L212,95 H650" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>
<text x="166" y="109" text-anchor="middle" style="fill:var(--muted);font-size:11px">old</text>
<text x="300" y="109" text-anchor="middle" style="fill:var(--muted);font-size:11px">new value</text>
<path d="M130,135 H510 L520,155 H650 M130,155 H510 L520,135 H650" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>
<text x="320" y="149" text-anchor="middle" style="fill:var(--muted);font-size:11px">old value (new one still in the logic)</text>
<text x="600" y="149" text-anchor="middle" style="fill:var(--muted);font-size:11px">new</text>
<g style="stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3">
<line x1="170" y1="28" x2="170" y2="200"/><line x1="207" y1="85" x2="207" y2="200"/><line x1="515" y1="125" x2="515" y2="200"/><line x1="540" y1="28" x2="540" y2="200"/><line x1="570" y1="28" x2="570" y2="200"/></g>
<text x="170" y="22" text-anchor="middle" style="fill:var(--muted);font-size:11px">launch edge</text>
<text x="590" y="22" text-anchor="middle" style="fill:var(--muted);font-size:11px">capture edge</text>
<g style="stroke:var(--ink);stroke-width:1.2">
<line x1="170" y1="195" x2="207" y2="195"/><line x1="170" y1="190" x2="170" y2="200"/><line x1="207" y1="190" x2="207" y2="200"/>
<line x1="207" y1="195" x2="515" y2="195"/><line x1="515" y1="190" x2="515" y2="200"/>
<line x1="515" y1="195" x2="540" y2="195"/><line x1="540" y1="190" x2="540" y2="200"/>
<line x1="540" y1="195" x2="570" y2="195"/><line x1="570" y1="190" x2="570" y2="200"/>
<line x1="170" y1="250" x2="570" y2="250"/><line x1="170" y1="245" x2="170" y2="255"/><line x1="570" y1="245" x2="570" y2="255"/></g>
<text x="188" y="216" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">clock-to-Q</text>
<text x="361" y="216" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">logic delay (critical path)</text>
<text x="527" y="216" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">setup</text>
<text x="572" y="232" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">skew + jitter</text>
<text x="370" y="268" text-anchor="middle" style="fill:var(--muted);font-size:11px">one clock period: every segment above must fit inside it</text>
</svg></div>
<p>Reading the diagram left to right:</p><ol><li>The launch edge arrives</li><li>After clock-to-Q, FF1's output changes</li><li>The new value ripples through the logic</li><li>It must reach FF2's input a setup time before the capture edge</li><li>That edge itself might arrive early by the skew and jitter margin (the grey band)</li></ol>
<h3 id="sec-setup-time">Setup Time</h3>
<p>Inside the capturing flip-flop, the input must be stable for a short window <em>before</em> the clock edge so its internal latch can settle on a clean 0 or 1. That window is the <strong>setup time</strong>. If data changes inside it, the flip-flop may capture the wrong value or go metastable (hover between 0 and 1 for an unpredictable time). So the logic must finish early by at least the setup time.</p>
<p>Its counterpart, <strong>hold time</strong>, is how long the input must stay stable <em>after</em> the edge. Hold failures happen on very short paths, where new data arrives too soon.</p>
<h3 id="sec-skew">Skew</h3>
<p>The clock is distributed to millions of flip-flops through wires and buffers of slightly different lengths and loads, so the same edge reaches different flip-flops at slightly different times. That difference is <strong>skew</strong>. It's spatial and mostly constant: the same pair of flip-flops sees about the same skew every cycle.</p>
<ul><li>If the capture clock arrives <em>earlier</em> than the launch clock, the stage loses time (hurts setup).</li><li>If it arrives <em>later</em>, the stage gains time (helps setup) but hold gets harder.</li><li>Designers sometimes add skew on purpose (<strong>useful skew</strong>) to lend time from a short stage to a long one.</li></ul>
<h3 id="sec-jitter">Jitter</h3>
<p>Even at one flip-flop, the clock edge wobbles slightly from cycle to cycle because of power supply noise, temperature, and variation in the clock generator (PLL). That's <strong>jitter</strong>. It's temporal and unpredictable in any given cycle, so timing must budget for the worst case.</p>
<h3 id="sec-putting-together">Putting It Together</h3>
<p><strong>Setup constraint:</strong> T<sub>clk</sub> ≥ t<sub>clk-Q</sub> + t<sub>logic,max</sub> + t<sub>setup</sub> + t<sub>skew</sub> + t<sub>jitter</sub></p>
<p><strong>Hold constraint:</strong> t<sub>clk-Q</sub> + t<sub>logic,min</sub> ≥ t<sub>hold</sub> + t<sub>skew</sub></p>
<p><strong>Slack</strong> = available time − required time. Negative slack means a violation. Example: 30 + 250 + 20 + 15 + 10 = 325 ps, so f<sub>max</sub> ≈ 3.08 GHz, and 75 ps of every cycle is overhead rather than useful logic. That fixed overhead is why each added pipeline stage buys less frequency. See <a href="#/pipelining">Pipelining and the iron law</a>.</p>
<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul>
<li><strong>Bigger transistors on the critical path:</strong> faster, but more area and more capacitance to switch (dynamic power).</li>
<li><strong>Low-threshold cells:</strong> faster, but leakage rises exponentially; use them only where needed.</li>
<li><strong>Higher voltage:</strong> speeds every gate, but power grows roughly with V².</li>
<li><strong>Adding a pipeline stage or retiming logic:</strong> shortens the path, but adds flip-flops (area and clock power) and can raise CPI through longer hazard penalties.</li>
<li><strong>Tighter skew:</strong> requires a stronger clock network (grids, more buffers), which costs significant power since the clock switches every cycle.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A path has clock-to-Q 25 ps, logic delay 280 ps, setup 20 ps, skew 10 ps, and jitter 10 ps. The target is 3 GHz. Does it meet timing? If not, by how much, and what are your options?</p>`,
        a: `<ol><li>Clock period at 3 GHz = 1 / 3 GHz ≈ <strong>333 ps</strong>.</li><li>Required time = 25 + 280 + 20 + 10 + 10 = <strong>345 ps</strong>.</li><li>Slack = 333 − 345 = <strong>−12 ps</strong>: a setup violation.</li><li>Options: speed up the logic by about 12 ps (bigger or low-threshold gates, restructured logic), move some logic into a neighboring stage with slack (retiming), tighten skew, raise voltage, or run at the frequency the path allows: 1 / 345 ps ≈ 2.9 GHz.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>The issue queue's wakeup-select loop is the critical path. What can you do, and what does each option cost in performance?</p>`,
        a: `<ul><li><strong>Split wakeup and select across two cycles:</strong> meets timing, but dependent single-cycle instructions can no longer issue back to back, cutting IPC on dependent chains (up to half speed on them).</li><li><strong>Shrink the queue or split it per port:</strong> shorter tag broadcast wires and fewer comparators per queue, but less scheduling flexibility and possibly a smaller effective window.</li><li><strong>Faster circuits</strong> (larger or low-threshold transistors): keeps IPC, costs area and leakage power.</li><li><strong>Lower the frequency:</strong> keeps IPC, loses performance on every instruction.</li></ul><p>The right answer depends on how much IPC each option costs versus how much frequency it buys, measured across the workload suite.</p>`
      },
      {
        q: `<p>Skew delays the clock at the capturing flip-flop by 20 ps. Does that help or hurt setup? Hold?</p>`,
        a: `<p>It <strong>helps setup</strong>: the capture edge arrives 20 ps later, so the data gets 20 ps more time. It <strong>hurts hold</strong>: the capturing flip-flop keeps watching its input 20 ps longer after the launch edge, so fast new data has more chance to race through and overwrite the value it should have captured. Designers sometimes use this deliberately ("useful skew") to borrow time for a slow stage, then fix any resulting hold problems by adding delay to short paths.</p>`
      }
    ]
  }
},

{
  id: "select-logic",
  region: "circ",
  title: "Selection and Arbitration Logic",
  sections: [
    { id: "decoders", label: "Decoders" },
    { id: "muxes", label: "Multiplexers" },
    { id: "priority-encoders", label: "Priority Encoders" },
    { id: "pick-n", label: "Picking More Than One" },
    { id: "arbiters", label: "Arbiters and Fairness" },
    { id: "age", label: "Tracking Age" },
    { id: "counting", label: "Counting Bits" },
    { id: "crossbars", label: "Crossbars" }
  ],
  body: `
<p>Most of a core's control logic is a handful of blocks used over and over:</p>
<ul>
<li>A <strong>decoder</strong> turns an index into a one-hot select.</li>
<li>A <strong>mux</strong> picks one value by its select.</li>
<li>A <strong>priority encoder</strong> or <strong>arbiter</strong> picks one requester out of many.</li>
<li><strong>Age logic</strong> says which of two entries is older.</li>
<li>A <strong>bit counter</strong> counts the set bits in a vector, or the set bits before each position.</li>
<li>A <strong>crossbar</strong> routes many sources to many destinations.</li>
</ul>
<p>This page covers each block, its delay in gate levels, and where it shows up. How gate delays add up along a path is on <a href="#/gates-clocking">Logic Gates and Clock Distribution</a> and <a href="#/timing">Critical Path and Flip-Flop Timing</a>. The CAM, which produces many of the request vectors these blocks consume, has its own page: <a href="#/cam">Content-Addressable Memory</a>.</p>
<h3 id="sec-decoders">Decoders</h3>
<p>A decoder turns an n-bit index into 2<sup>n</sup> outputs, exactly one of them high (one-hot). Output i is an n-input AND of the index bits, each taken true or complemented to spell out i. It sits at the front of every SRAM read and every indexed table (see <a href="#/rat-circuit/decoder">Address Input and Decoder</a>).</p>
<ul>
<li><strong>Predecoding.</strong> Wide ANDs are slow, so the index is split into groups of 2 or 3 bits, each decoded into 4 or 8 one-hot lines, and each output ANDs one line from each group. A 6-to-64 decoder becomes three 2-to-4 predecoders and 64 three-input ANDs. Each extra index bit adds at most about one gate level.</li>
<li><strong>Fanout.</strong> Each predecode line of that 6-to-64 decoder feeds 16 of the 64 outputs, and each output drives a whole wordline. A decoder's delay is often more wire and fanout than logic, which is why large arrays put a strong driver on every output.</li>
</ul>
<h3 id="sec-muxes">Multiplexers</h3>
<p>A mux picks one of N inputs. It comes in two forms:</p>
<ul>
<li><strong>Binary select.</strong> A tree of 2:1 muxes, log<sub>2</sub> N levels deep, each level steered by one select bit. It fits when the select is an index.</li>
<li><strong>One-hot select (AND-OR).</strong> Each input is ANDed with its own select line and the results are ORed: one AND level, then an OR tree of log<sub>2</sub> N levels. In custom arrays the OR is a shared wire, as on SRAM bitlines. It fits when the select already comes from a decoder, a CAM match vector, or an arbiter grant, which is why grants are kept one-hot.</li>
</ul>
<p>A one-hot mux trusts its select. Two hot lines OR two inputs together, and no hot line gives 0. Anything that feeds one, such as a CAM that could hit twice, must guarantee exactly one line or come with a valid bit. TLB designs either prevent duplicate entries for the same page or detect a double hit for this reason.</p>
<h3 id="sec-priority-encoders">Priority Encoders</h3>
<p>Given N request bits in a fixed order, a <strong>priority encoder</strong> reports the first one that is set, as a one-hot grant, a binary index, or both, plus a valid bit saying whether any request was set. Grant i is request i ANDed with the NOT of every request before it:</p>
<div class="math">\\[ g_i = r_i \\land \\lnot (r_0 \\lor r_1 \\lor \\dots \\lor r_{i-1}) \\]</div>
<p>The OR of everything before i is a <strong>prefix OR</strong>. As a chain it ripples through one gate per input. As a parallel prefix tree, the same structure as a carry-lookahead adder (see <a href="#/int-units/adders">Adders: Ripple Carry to Parallel Prefix</a>), it takes ⌈log<sub>2</sub> N⌉ levels, each ORing a signal with the one 2<sup>k</sup> places before it. For 64 inputs, the last grant waits on 62 ORs in series in a chain, against 6 levels in a tree. The binary index costs one more OR tree per output bit: bit k of the index is the OR of the grants whose position has bit k set.</p>
<p><a href="#/lsq/priority-encoders">Priority Encoders</a> on the Load and Store Queues page draws the 8-input prefix tree, and shows how a circular queue, whose priority order starts at a moving mark, uses two encoders and a 2:1 mux instead of rotating its requests.</p>
<p>The same block appears in many places:</p>
<ul>
<li><strong>Select in a compacting scheduler</strong>, where the lowest position is the oldest (see <a href="#/wakeup/select">Select and the Critical Loop</a>).</li>
<li><strong>Store-to-load forwarding and violation checks</strong> in the load and store queues, where the match nearest in age wins.</li>
<li><strong>Leading and trailing zero counts</strong>, a priority encoder with only the binary output, which normalize floating-point results (see <a href="#/int-units/shift">Shifters and Bit Counting</a>).</li>
<li><strong>Victim choice</strong> in cache replacement: the first invalid way, or the first way at the maximum re-reference value (see <a href="#/cache-replacement/srrip">SRRIP</a>).</li>
<li><strong>Allocation</strong>: the first free entry of a queue, from a bit vector of free entries.</li>
</ul>
<h3 id="sec-pick-n">Picking More Than One</h3>
<p>A queue with two issue ports, or a renamer handing out four registers from one free list, needs the first k set bits in one cycle, not just the first. There are four ways to get them:</p>
<ul>
<li><strong>Cascade.</strong> Mask the first grant out of the requests and encode again. It is simple, but the delays add: k encoders and k − 1 masking ANDs in series.</li>
<li><strong>Both ends.</strong> Run two encoders in parallel, one from each end of the vector. When two or more requests are set, they pick different entries in one encoder delay. The second pick is the youngest request, not the second oldest. When only one request is set, both pick it, so one grant must be suppressed. It only works for k = 2.</li>
<li><strong>Prefix count.</strong> Each request finds how many requests come before it, a parallel prefix sum, and is granted if that count is below k. The delay still grows with log N, but every node of the tree is a small saturating adder instead of an OR.</li>
<li><strong>Split the queue.</strong> Give each port its own queue with its own single-grant encoder. This is the fastest, and one reason most cores distribute their schedulers (see <a href="#/scheduler/unified-distributed">Unified vs. Distributed</a>). The cost is entries that sit idle in one queue while another fills up.</li>
</ul>
<h3 id="sec-arbiters">Arbiters and Fairness</h3>
<p>An <strong>arbiter</strong> is a priority encoder with a policy for who goes first. The policy matters when the same requesters compete cycle after cycle, as cores do for a shared cache port or loads do for a cache bank.</p>
<ul>
<li><strong>Fixed priority.</strong> A plain priority encoder. Requester 0 always wins, so a requester further down starves while requester 0 keeps asking. It is right when the order means something, such as oldest first, and wrong among peers.</li>
<li><strong>Round robin.</strong> A pointer marks the requester with top priority, and after each grant it moves to just past the winner. It is built like circular select: one encoder over the requests masked to positions at or after the pointer, one over all requests, and a 2:1 mux on the first encoder's valid bit. A requester waits for at most N − 1 other grants.</li>
<li><strong>Matrix (least recently granted).</strong> One bit per pair of requesters records which of the two goes first. The winner's bits flip so that it now loses to everyone. It keeps N(N − 1) / 2 bits of state, each grant is a wide AND over the other requesters, and the order is strictly least recently granted.</li>
<li><strong>Tree arbiter.</strong> Small arbiters, say of 4 inputs, sit in a tree. Each node passes "some request below me" up and receives a grant down, so a 64-input arbiter is three levels of 4-input arbiters. Each node can keep its own round-robin pointer.</li>
</ul>
<p>Arbiters sit in front of every shared resource:</p>
<ul>
<li>Load ports competing for a cache bank (see <a href="#/cache-banking/conflicts">Bank Conflicts</a>)</li>
<li>Cores and cache slices sharing an on-chip network</li>
<li>Requests queued for an L2 or a DRAM controller</li>
<li>A renamer's shared read ports, where an arbiter assigns ports to distinct register names (see <a href="#/rename-cost/port-workarounds">Cutting Port Costs</a>)</li>
</ul>
<h3 id="sec-age">Tracking Age</h3>
<p>Oldest first is the usual policy inside a core, because the oldest instruction is the one retirement waits on. There are three ways to know which entry is older.</p>
<p><strong>Position.</strong> A compacting queue shifts entries down as older ones leave, so position is age and a plain priority encoder picks the oldest. The price is moving entries' payloads, through a mux per entry, in every cycle that something leaves.</p>
<p><strong>Sequence numbers.</strong> Each entry carries its ROB index or another counter value, and age is a numeric compare. The counter is circular, so it carries one extra <em>wrap bit</em> that flips every time the pointer passes the end. Two indices a and b compare like this:</p>
<ul>
<li>Same wrap bit: both are on the same lap, so the smaller index is older.</li>
<li>Different wrap bits: the smaller index has already wrapped, so the larger index is older.</li>
</ul>
<p>This works as long as the queue never holds more entries than its size, which it can't. In a 32-entry queue:</p>
<div class="tbl"><table>
<tr><th>Entry A (Wrap, Index)</th><th>Entry B (Wrap, Index)</th><th>Older</th><th>Why</th></tr>
<tr><td>0, 9</td><td>0, 21</td><td>A</td><td>Same lap, smaller index</td></tr>
<tr><td>1, 3</td><td>0, 28</td><td>B</td><td>B is on the earlier lap</td></tr>
<tr><td>1, 14</td><td>1, 6</td><td>B</td><td>Same lap, smaller index</td></tr>
</table></div>
<p>Finding the oldest of N entries this way needs a tree of these comparators, log<sub>2</sub> N levels of small subtractors, which is slower than an OR tree.</p>
<p><strong>Age matrix.</strong> A queue that doesn't compact can keep an N × N bit matrix, where bit (i, j) is 1 if entry j is older than entry i. When an instruction is written into entry i, its row is set to the current valid vector, since everything already in the queue is older. When an entry leaves, its column is cleared. Entry i is the oldest requester when no requester is marked in its row:</p>
<div class="math">\\[ g_i = r_i \\land \\lnot \\bigvee_{j} \\left( M_{ij} \\land r_j \\right) \\]</div>
<p>Take a 4-entry queue whose entries were written in the order 2, 0, 3, 1:</p>
<div class="tbl"><table>
<tr><th>Row</th><th>j = 0</th><th>j = 1</th><th>j = 2</th><th>j = 3</th><th>Older Entries</th></tr>
<tr><td>0</td><td>0</td><td>0</td><td>1</td><td>0</td><td>2</td></tr>
<tr><td>1</td><td>1</td><td>0</td><td>1</td><td>1</td><td>2, 0, 3</td></tr>
<tr><td>2</td><td>0</td><td>0</td><td>0</td><td>0</td><td>none</td></tr>
<tr><td>3</td><td>1</td><td>0</td><td>1</td><td>0</td><td>2, 0</td></tr>
</table></div>
<p>Suppose entries 0, 1, and 3 request and entry 2 is still waiting on an operand. Row 0's only older entry is 2, which isn't requesting, so entry 0 is granted. Row 1 sees requests from 0 and 3 and row 3 sees one from 0, so both lose. Entry 0 is indeed the oldest requester in the write order.</p>
<p>The matrix costs N² bits. Its diagonal is always 0, and over valid entries it is antisymmetric, but storing full rows keeps each grant's logic local to its row. Each grant is one wide AND-OR across the row, whose wires grow with N. This is a different matrix from the dependency matrix of <a href="#/wakeup/matrix">Matrix Schedulers</a>, which records which entry produces each operand, and a scheduler can have both. Sassone, Rupley, Brekelbaum, Loh, and Black (ISCA 2007) describe the two side by side.</p>
<h3 id="sec-counting">Counting Bits</h3>
<ul>
<li><strong>Population count.</strong> The number of set bits in an N-bit vector, built as a tree of adders: pairs of bits into 2-bit sums, pairs of those into 3-bit sums, and so on for ⌈log<sub>2</sub> N⌉ levels. Carry-save adders, full adders used as 3:2 compressors, shorten it further. Dispatch uses it to compare a queue's free entries with the instructions waiting to enter, and performance counters that count several events per cycle need it too.</li>
<li><strong>Prefix count.</strong> Each position's count of set bits before it, the prefix sum from <a href="#/select-logic/pick-n">Picking More Than One</a>. A renamer whose free list is a bit vector computes it to hand out four registers in a cycle: the free register with count 0 goes to rename slot 0, count 1 to slot 1, and so on.</li>
<li><strong>Leading and trailing zeros.</strong> The binary output of a priority encoder (see <a href="#/select-logic/priority-encoders">Priority Encoders</a>).</li>
</ul>
<h3 id="sec-crossbars">Crossbars</h3>
<p>A <strong>crossbar</strong> connects N sources to M destinations, any to any, in the same cycle. Each destination has an N-input mux, and an arbiter per destination decides which source wins when two want it. Its cost grows with N × M × the width of each path.</p>
<ul>
<li><strong>Wires dominate.</strong> Every source's bits run past every destination, so a crossbar's area is mostly routing tracks and its delay mostly wire.</li>
<li><strong>Where it appears.</strong> Load ports to cache banks, the bypass network that sends any functional unit's result to any unit's inputs, register file read ports to functional units, and a renamer's shared read ports.</li>
<li><strong>When it gets too big.</strong> Partition it. Clusters of functional units keep a full bypass inside the cluster and pay an extra cycle between clusters. Banked arrays keep fewer ports per bank and arbitrate the conflicts.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Golden Cove issues integer and vector µops from a 97-entry unified scheduler. Can one prefix-tree priority encoder pick the oldest ready µop within the cycle, can a cascade pick two, and does splitting the entries into two queues help?</p><p>Given:</p><ul><li>Scheduler: 97 entries, treated as a compacting queue, so position gives age</li><li>Clock: 5.2 GHz</li><li>Wakeup: 75 ps of each cycle</li><li>Flop overhead (clock-to-Q plus setup): 25 ps of each cycle</li><li>Select gets the rest of the cycle</li><li>Prefix-OR tree: each level is a 2-input OR costing 11 ps, and each level doubles the span of inputs covered</li><li>Grant: one AND (request AND NOT prefix), 9 ps, after the prefix is ready</li><li>A second pick by cascade: the first grant is masked out of the requests by one AND, 9 ps, and then a second encoder of the same size runs</li><li>Split option: two queues of 48 and 49 entries, each with its own encoder and its own port, with each µop steered to one queue at dispatch</li><li>The real scheduler feeds more ports than two. Consider only one or two picks per cycle</li><li>Ignore wire delay beyond these gate delays</li></ul>`,
        a: `<ol class="steps"><li><strong>Select budget.</strong> Select gets whatever the cycle leaves after wakeup and the flop overhead.<div class="math chain"><span>\\(\\displaystyle B = \\frac{1}{5.2\\ \\text{GHz}} - 75\\ \\text{ps} - 25\\ \\text{ps} \\)</span><span>\\(\\displaystyle = 192.307\\ldots\\ \\text{ps} - 100\\ \\text{ps} \\)</span><span>\\(\\displaystyle \\approx 92.31\\ \\text{ps} \\)</span></div></li><li><strong>One encoder over 97 entries.</strong> The last grant, for entry 96, needs the OR of the 96 requests before it. Each tree level doubles the span covered, so the tree needs enough levels for 2<sup>L</sup> to reach 96, which is 7 levels since 2<sup>6</sup> = 64 falls short. The grant AND follows.<div class="math chain"><span>\\(\\displaystyle T_{97} = 7\\ \\text{levels} \\times \\frac{11\\ \\text{ps}}{1\\ \\text{level}} + 9\\ \\text{ps} \\)</span><span>\\(\\displaystyle = \\mathbf{86}\\ \\textbf{ps} \\)</span></div>That fits the budget of about 92.31 ps, with about 6.31 ps to spare.</li><li><strong>The chain, for comparison.</strong> Built as a chain, the OR of 96 requests takes 95 two-input ORs in series before the grant AND.<div class="math chain"><span>\\(\\displaystyle T_{\\text{chain}} = 95\\ \\text{ORs} \\times \\frac{11\\ \\text{ps}}{1\\ \\text{OR}} + 9\\ \\text{ps} \\)</span><span>\\(\\displaystyle = 1054\\ \\text{ps} \\)</span></div>That is more than five cycles, so the tree is what makes single-cycle select possible at all.</li><li><strong>Two picks by cascade.</strong> The second encoder can only start once the first grant has been masked out of the requests, so the two encoders and the mask run in series.<div class="math chain"><span>\\(\\displaystyle T_{\\text{cascade}} = 86\\ \\text{ps} + 9\\ \\text{ps} + 86\\ \\text{ps} \\)</span><span>\\(\\displaystyle = \\mathbf{181}\\ \\textbf{ps} \\)</span></div>That is about twice the budget of about 92.31 ps, so a cascade can't pick two per cycle.</li><li><strong>Two queues.</strong> In the 49-entry queue, the last grant, for entry 48, needs the OR of 48 requests. 2<sup>6</sup> = 64 covers 48 while 2<sup>5</sup> = 32 doesn't, so the tree needs 6 levels. The 48-entry queue needs the same 6 levels.<div class="math chain"><span>\\(\\displaystyle T_{49} = 6\\ \\text{levels} \\times \\frac{11\\ \\text{ps}}{1\\ \\text{level}} + 9\\ \\text{ps} \\)</span><span>\\(\\displaystyle = \\mathbf{75}\\ \\textbf{ps} \\)</span></div>Each queue picks one µop per cycle with about 17.31 ps to spare, so the pair picks two.</li><li><strong>What it shows.</strong> One encoder over 97 entries barely fits, and stacking a second pick behind it doesn't. Two picks from one queue need either the both-ends trick, which fits in 86 ps but makes the second pick the youngest ready µop rather than the second oldest, or a split. The split also halves each queue's tag bus load and buys slack, but a µop can then issue only from its own queue, so one queue can sit idle while the other backs up.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An issue queue frees entries out of order and refills the lowest-numbered free entry, and its select is a fixed-priority encoder with entry 0 first. What can go wrong, how bad can it get, and how would you fix it?</p><p>Given:</p><ul><li>Queue: 48 entries that don't compact. A µop that issues frees its entry, and a new µop takes the lowest-numbered free entry</li><li>Select: one grant per cycle, entry 0 has the highest priority</li><li>The workload often has more ready µops than the queue can issue in a cycle</li><li>The ROB head is waiting on a µop that sits in entry 40, and that µop is ready</li></ul>`,
        a: `<p>Position no longer means age, so the encoder favors whatever was written into the low entries, and those are mostly the newest µops.</p><ul><li><strong>What goes wrong.</strong> Entries free up out of order, and new µops fill the lowest free slots, so young µops collect at low positions and old ones get stranded high. The ready µop in entry 40 loses select to every ready µop in entries 0 to 39, many of them younger. The old µops are usually the ones on the critical path, since retirement waits on the oldest.</li><li><strong>How bad.</strong> While younger ready µops keep arriving in low entries, entry 40 can lose cycle after cycle. Retirement stalls, the ROB fills, and dispatch stops. Then the stream of new µops dries up, the low entries drain, and entry 40 finally issues. So it is usually a long stall rather than a true deadlock. It becomes a deadlock if the younger µops need something the stuck µop holds or must produce, such as a load-queue entry, a store's data, or a replay slot.</li></ul><p>The fixes trade area and power for age order:</p><ul><li><strong>Compacting queue.</strong> Shift entries down as older ones leave, so position is age again. It costs a mux per entry and the energy of moving payloads every cycle, and several frees per cycle make the shift network wider.</li><li><strong>Age matrix.</strong> 48 entries × 48 entries = 2,304 bits, with a row written at dispatch and a column cleared at issue, giving exact oldest-first select without moving anything.</li><li><strong>An oldest-first pick alongside the position pick.</strong> Compare ROB indices (with wrap bits) to find the single oldest ready µop for one grant, and let position pick the rest. This guarantees the ROB head's µop progresses at the cost of a compare tree.</li><li><strong>Anti-starvation.</strong> A counter per entry, or a timeout on the ROB head, that forces the stuck µop to the top priority. It is cheap, but it bounds the damage instead of preventing it.</li></ul><p>I'd use the age matrix. At 48 entries its 2,304 bits are affordable, it gives exact age order without the compacting shifter's energy or the compare tree's delay, and its grant logic is one wide AND-OR per row, which fits in a select cycle. The counter is worth adding anyway as a cheap backstop.</p>`
      }
    ]
  }
}
]);
