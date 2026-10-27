/* Section: Circuits
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "circ"). */

section({
  id: "circ",
  name: "Circuits",
  cap: "Transistors, energy, gates, and clocking",
  body: `
<p>Every microarchitectural trade-off eventually becomes a circuit question: how many transistors switch, how fast, and at what voltage.</p>`,
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
  sections: [{ id: "vt-flavors", label: "Threshold-Voltage Flavors" }],
  body: `
<h3>The MOSFET</h3>
<p>A MOSFET is a voltage-controlled switch with a gate, source, and drain. In an nMOS transistor, raising the gate-to-source voltage above the threshold voltage V<sub>th</sub> forms a conducting channel; a pMOS transistor conducts when its gate is low. CMOS logic pairs them so that, ideally, there's never a direct path from supply to ground in steady state.</p>
<p>Modern transistors wrap the gate around the channel for better control: FinFETs (gate on three sides of a fin) and gate-all-around nanosheets (gate on all sides), which reduce leakage at small sizes.</p>
<h3>Dynamic Energy</h3>
<ul>
<li>Charging a node of capacitance C to V<sub>dd</sub> draws C V<sup>2</sup> from the supply: half is stored, half is lost in the pull-up; the stored half is lost on discharge. So each 0→1→0 cycle costs C V<sup>2</sup>, or ½ C V<sup>2</sup> per transition.</li>
<li><strong>Dynamic power:</strong> P<sub>dyn</sub> = α C V<sup>2</sup> f, where α is the activity factor (fraction of capacitance switching per cycle).</li>
<li><strong>Short-circuit power:</strong> both transistors briefly conduct during a transition; usually a small share.</li>
</ul>
<h3>Leakage (Static) Power</h3>
<ul>
<li><strong>Subthreshold leakage:</strong> current flows even when "off," growing exponentially as V<sub>th</sub> falls: I ∝ e<sup>(V<sub>gs</sub> − V<sub>th</sub>) / (n kT/q)</sup>. At room temperature the best possible slope is about 60 mV per 10× change in current.</li>
<li>Leakage also rises steeply with temperature, which can feed back into more heat.</li>
<li><strong>Gate leakage:</strong> tunneling through the thin gate dielectric, reduced by high-k materials.</li>
</ul>
<h3>Speed and Voltage</h3>
<p>Gate delay ∝ C V / I<sub>on</sub>, and I<sub>on</sub> ∝ (V − V<sub>th</sub>)<sup>a</sup> with a ≈ 1.2–1.5 for modern devices. Higher voltage means faster switching, so frequency rises roughly linearly with voltage over the normal range. Combined with P ∝ V<sup>2</sup> f, power grows roughly as V<sup>3</sup> at the top of the frequency curve.</p>
<h3>The End of Dennard Scaling</h3>
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
<h3>Power-Saving Techniques</h3>
<ul><li><strong>Clock gating:</strong> stop the clock to idle blocks; cuts dynamic power.</li><li><strong>Power gating:</strong> cut supply to idle blocks; cuts leakage, but wake-up takes time and energy.</li><li><strong>DVFS:</strong> lower voltage and frequency when full speed isn't needed.</li><li><strong>Multi-V<sub>th</sub> cells:</strong> fast, leaky cells on critical paths; slow, low-leakage cells elsewhere.</li></ul>
<h3>Why Architects Care</h3>
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
  title: "Logic Gates, Clocks, and Skew",
  body: `
<h3>CMOS Gates</h3>
<p>Gates are built from complementary pull-up (pMOS) and pull-down (nMOS) networks. NAND and NOR are the natural primitives; an inverter is the simplest gate. NAND is generally preferred because its series transistors are nMOS, which conduct better than pMOS. A gate's delay depends on its load capacitance and drive strength; designers express delay in <strong>FO4</strong> (the delay of an inverter driving four copies of itself) to compare across processes. A high-performance cycle is typically a few tens of FO4.</p>
<h3>Sequential Elements</h3>
<ul><li><strong>Latch:</strong> transparent while the clock is high (or low).</li><li><strong>Flip-flop:</strong> captures input on a clock edge.</li><li><strong>Setup time:</strong> data must be stable this long before the edge.</li><li><strong>Hold time:</strong> data must stay stable this long after the edge.</li><li><strong>Clock-to-Q:</strong> delay from the edge to a valid output.</li></ul>
<h3>Timing Equations</h3>
<p><strong>Setup (max delay):</strong> T<sub>clk</sub> ≥ t<sub>clk-q</sub> + t<sub>logic,max</sub> + t<sub>setup</sub> + t<sub>skew</sub> + t<sub>jitter</sub></p>
<p><strong>Hold (min delay):</strong> t<sub>clk-q</sub> + t<sub>logic,min</sub> ≥ t<sub>hold</sub> + t<sub>skew</sub></p>
<p>The longest path through a stage is the <strong>critical path</strong>; it sets the frequency. See <a href="#/timing">Critical path and flip-flop timing</a> for diagrams and a full walkthrough.</p>
<h3>Skew and Jitter</h3>
<ul>
<li><strong>Skew:</strong> the clock edge reaches different flip-flops at different times because of wire length and buffer differences. It's a spatial, mostly static difference.</li>
<li><strong>Jitter:</strong> the edge varies cycle to cycle at the same flip-flop because of supply noise and PLL variation. It's a temporal difference.</li>
<li>Skew that delays the capturing clock relaxes setup but tightens hold. "Useful skew" exploits this deliberately.</li>
</ul>
<h3>Clock Distribution</h3>
<p>A PLL generates the clock, and an H-tree, grid, or mesh distributes it to minimize skew. The clock network switches every cycle with activity factor 1, so it is often a large share of dynamic power (commonly 20–40%). Clock gating is the main defense.</p>
<h3>Power, Performance, Area</h3>
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
  body: `
<h3>The Critical Path</h3>
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
<h3>Clock-to-Q</h3>
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
<h3>Setup Time</h3>
<p>Inside the capturing flip-flop, the input must be stable for a short window <em>before</em> the clock edge so its internal latch can settle on a clean 0 or 1. That window is the <strong>setup time</strong>. If data changes inside it, the flip-flop may capture the wrong value or go metastable (hover between 0 and 1 for an unpredictable time). So the logic must finish early by at least the setup time.</p>
<p>Its counterpart, <strong>hold time</strong>, is how long the input must stay stable <em>after</em> the edge. Hold failures happen on very short paths, where new data arrives too soon.</p>
<h3>Skew</h3>
<p>The clock is distributed to millions of flip-flops through wires and buffers of slightly different lengths and loads, so the same edge reaches different flip-flops at slightly different times. That difference is <strong>skew</strong>. It's spatial and mostly constant: the same pair of flip-flops sees about the same skew every cycle.</p>
<ul><li>If the capture clock arrives <em>earlier</em> than the launch clock, the stage loses time (hurts setup).</li><li>If it arrives <em>later</em>, the stage gains time (helps setup) but hold gets harder.</li></ul>
<h3>Jitter</h3>
<p>Even at one flip-flop, the clock edge wobbles slightly from cycle to cycle because of power supply noise, temperature, and variation in the clock generator (PLL). That's <strong>jitter</strong>. It's temporal and unpredictable in any given cycle, so timing must budget for the worst case.</p>
<h3>Putting It Together</h3>
<p><strong>Setup constraint:</strong> T<sub>clk</sub> ≥ t<sub>clk-Q</sub> + t<sub>logic,max</sub> + t<sub>setup</sub> + t<sub>skew</sub> + t<sub>jitter</sub></p>
<p><strong>Hold constraint:</strong> t<sub>clk-Q</sub> + t<sub>logic,min</sub> ≥ t<sub>hold</sub> + t<sub>skew</sub></p>
<p><strong>Slack</strong> = available time − required time. Negative slack means a violation. Example: 30 + 250 + 20 + 15 + 10 = 325 ps, so f<sub>max</sub> ≈ 3.08 GHz, and 75 ps of every cycle is overhead rather than useful logic. That fixed overhead is why each added pipeline stage buys less frequency. See <a href="#/pipelining">Pipelining and the iron law</a>.</p>
<h3>Power, Performance, Area</h3>
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
}
]);
