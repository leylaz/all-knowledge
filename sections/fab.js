/* Section: Fabrication and Process Technology
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "fab"). */

section({
  id: "fab",
  name: "Fabrication and Process Technology",
  cap: "Wafers, lithography, process nodes, yield, and die cost",
  body: `
<p>The bottom of the stack: how a design file becomes working silicon. Every die starts as part of a 300 mm silicon wafer and goes through hundreds of process steps over a few months.</p>
<h3>The Flow</h3>
<ul>
<li><strong>Front end of line (FEOL):</strong> builds the transistors. Each layer repeats the same loop: deposit a film, coat it with photoresist, expose a pattern through a mask (lithography), develop, etch or implant, strip the resist, clean.</li>
<li><strong>Middle of line (MOL):</strong> the tiny contacts that connect transistor gates, sources, and drains to the wiring above.</li>
<li><strong>Back end of line (BEOL):</strong> the copper interconnect, often 15 or more metal layers. The lowest layers are the tightest and hardest to pattern; the top layers are thick and wide for power and clock distribution.</li>
<li><strong>Wafer sort:</strong> probe cards test every die on the wafer, so bad dies are marked before anyone pays to package them.</li>
<li><strong>Dicing and packaging:</strong> the wafer is sawn into dies, and good dies are attached to a package substrate (or, for chiplets, to an interposer or bridge alongside other dies).</li>
<li><strong>Final test and binning:</strong> packaged parts are tested again and sorted by the frequency and power they reach.</li>
</ul>
<h3>Why Architects Care</h3>
<p>Fabrication sets the budget everything above it spends: transistor density decides how much cache and how many cores fit, the defect rate decides how big a die can be before cost explodes, and the metal stack limits how far a signal can travel in one cycle.</p>`,
  practice: {
    guided: [
      {
        q: `<p>For each problem, say which part of the flow it belongs to:</p><ul><li>(a) A via between metal layers 3 and 4 has too much resistance</li><li>(b) A die fails at the probe card</li><li>(c) The fin of a transistor is too wide</li><li>(d) A part only reaches its target frequency at a higher voltage</li></ul>`,
        a: `<ol start="0"><li>(a) Back end of line: vias and metal layers are BEOL.</li><li>(b) Wafer sort: the die is caught before packaging.</li><li>(c) Front end of line: fins are part of the transistor.</li><li>(d) Final test and binning: the part is sorted into a slower or higher-voltage bin.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A chiplet product puts 8 compute dies in one package. Why does wafer sort matter more here than for a single monolithic die?</p>`,
        a: `<p>If any die in the package is bad, the whole package (substrate, assembly, and the 7 good dies) may be scrapped. With 8 dies at 97% individual yield, a package built from untested dies works only 0.97<sup>8</sup> ≈ 78% of the time. So chiplet flows test each die thoroughly before assembly ("known good die"), which pushes more of the test effort onto wafer sort.</p>`
      }
    ]
  }
}, [
{
  id: "fab-nodes",
  region: "fab",
  title: "Lithography and Process Nodes",
  body: `
<h3>Lithography Sets the Pitch</h3>
<p>The smallest feature a scanner can print follows the Rayleigh criterion:</p>
<p class="eq">Half-pitch = k<sub>1</sub> × λ / NA</p>
<p>λ is the light's wavelength, NA the numerical aperture of the optics, and k<sub>1</sub> a process factor whose practical floor is about 0.25.</p>
<ul>
<li><strong>DUV immersion (ArF, 193 nm):</strong> with NA = 1.35 and k<sub>1</sub> = 0.28, half-pitch = 0.28 × 193 / 1.35 ≈ 40 nm, so a single exposure prints about an 80 nm pitch.</li>
<li><strong>EUV (13.5 nm):</strong> with NA = 0.33 and k<sub>1</sub> = 0.4, half-pitch ≈ 16 nm, so about a 33 nm pitch in one exposure.</li>
</ul>
<h3>Multipatterning</h3>
<p>To print a tighter pitch with DUV, fabs split one layer into several exposures (LELE), or use self-aligned double or quadruple patterning (SADP, SAQP), where spacers deposited on a printed line halve the pitch each time. Each extra step adds masks, cost, cycle time, and chances for overlay error. EUV replaces several DUV steps on the critical layers with one exposure.</p>
<h3>What a Node Name Means</h3>
<p>Node names like "5 nm" stopped matching any physical dimension years ago; they're labels for a generation. The numbers that matter are:</p>
<ul>
<li><strong>Contacted gate pitch (CPP):</strong> the spacing between neighboring transistor gates.</li>
<li><strong>Minimum metal pitch (MMP):</strong> the spacing of the tightest wires.</li>
<li><strong>Cell height:</strong> the number of metal tracks a standard cell spans.</li>
</ul>
<p>A logic cell's area scales roughly with CPP × MMP × tracks, so density gains come from shrinking pitches and from cutting tracks per cell.</p>
<h3>Transistor Structure</h3>
<p>Planar transistors gave way to FinFETs around 22/16 nm, which wrap the gate around three sides of a fin. The newest nodes move to gate-all-around nanosheets (TSMC N2, Samsung's 3 nm, Intel's RibbonFET), which surround the channel completely for better control of leakage. See <a href="#/transistors">Transistor Physics and Energy</a> for why that control matters.</p>
<h3>Scaling Today</h3>
<p>Logic still shrinks each node; SRAM bit cells shrink much more slowly, so caches take a growing share of the die. That's one reason designs split cache onto separate, older-node dies (stacked L3, chiplet I/O dies).</p>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1 (trends in technology and cost) · <a href="https://en.wikichip.org/wiki/5_nm_lithography_process" target="_blank" rel="noopener">5 nm lithography process (WikiChip)</a></p>`,
  practice: {
    guided: [
      {
        q: `<p>EUV light has a wavelength λ = 13.5 nm. High-NA EUV raises the numerical aperture from 0.33 to 0.55. With k<sub>1</sub> = 0.35, what single-exposure pitch can it print, and how does that compare with 0.33 NA at the same k<sub>1</sub>?</p>`,
        a: `<ol start="0"><li>Half-pitch = k<sub>1</sub> × λ / NA = 0.35 × 13.5 / 0.55.</li><li>0.35 × 13.5 = 4.725, and 4.725 / 0.55 ≈ 8.6 nm.</li><li>Pitch = 2 × half-pitch ≈ <strong>17 nm</strong>.</li><li>At 0.33 NA: 2 × 4.725 / 0.33 ≈ 28.6 nm. The ratio is 0.33 / 0.55 = 0.6, so High-NA prints about 60% of the 0.33 NA pitch.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>TSMC N7 has a contacted gate pitch of 57 nm and a minimum metal pitch of 40 nm; N5 has 51 nm and 28 nm. Estimate the logic density gain from pitch alone. TSMC quoted about 1.8×. Where could the rest come from?</p>`,
        a: `<p>Area scales with CPP × MMP: 57 × 40 = 2280 versus 51 × 28 = 1428, a ratio of about <strong>1.6×</strong>. The rest comes from cell architecture rather than pitch: fewer tracks per cell, tighter design rules such as single diffusion breaks between cells, and contacts placed over the active gate. Those shrink cells without shrinking any single pitch.</p>`
      }
    ]
  }
},

{
  id: "fab-yield",
  region: "fab",
  title: "Yield and Die Cost",
  body: `
<h3>Dies per Wafer</h3>
<p class="eq">Dies per wafer ≈ π (d/2)<sup>2</sup> / A − π d / √(2A)</p>
<p>d is the wafer diameter and A the die area. The first term is wafer area over die area; the second subtracts the partial dies lost around the round edge.</p>
<h3>Die Yield</h3>
<p>Defects land randomly, and one in the wrong place kills a die. The simplest (Poisson) model, with defect density D<sub>0</sub> in defects per cm<sup>2</sup>:</p>
<p class="eq">Die yield = e<sup>−A × D<sub>0</sub></sup></p>
<p>Real defects cluster, so a large die suffers less than Poisson predicts: several defects tend to hit the same die. Hennessy &amp; Patterson use a clustered model, die yield = wafer yield × 1 / (1 + D × A)<sup>N</sup>, where N is a process-complexity factor. Both make the same point: yield falls exponentially with die area.</p>
<h3>Cost per Good Die</h3>
<p class="eq">Cost per die = wafer cost / (dies per wafer × die yield)</p>
<p>Example: a 300 mm wafer, a 100 mm<sup>2</sup> (1 cm<sup>2</sup>) die, D<sub>0</sub> = 0.1 per cm<sup>2</sup>, and a wafer price around $17,000 (a common estimate for TSMC N5).</p>
<ol start="0">
<li>Dies per wafer: π × 150<sup>2</sup> / 100 ≈ 707, minus π × 300 / √200 ≈ 67, so about <strong>640</strong>.</li>
<li>Yield: e<sup>−0.1</sup> ≈ 0.905, so about 579 good dies.</li>
<li>Cost: $17,000 / 579 ≈ <strong>$29 per good die</strong>, before test and packaging.</li>
</ol>
<div class="calc" data-calc="yield"></div>
<h3>What Designers Do About It</h3>
<ul>
<li><strong>Redundancy:</strong> spare rows and columns in SRAM arrays are fused in to replace defective ones, so a defect in a cache doesn't kill the die.</li>
<li><strong>Harvesting:</strong> a die with one bad core is sold as a part with fewer cores enabled.</li>
<li><strong>Chiplets:</strong> several small dies yield far better than one big one, at the cost of die-to-die links and packaging. See <a href="#/icx-chiplets">Chiplets and UCIe</a>.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 1, "Trends in Cost" · <a href="https://cset.georgetown.edu/publication/ai-chips-what-they-are-and-why-they-matter/" target="_blank" rel="noopener">AI Chips: What They Are and Why They Matter (CSET), for wafer cost estimates</a></p>`,
  practice: {
    guided: [
      {
        q: `<p>A laptop SoC die is 120 mm<sup>2</sup>, built on 300 mm wafers costing $20,000, with D<sub>0</sub> = 0.07 per cm<sup>2</sup>. Find dies per wafer, yield (Poisson), and cost per good die.</p>`,
        a: `<ol start="0"><li>Area: 120 mm<sup>2</sup> = 1.2 cm<sup>2</sup>.</li><li>Dies per wafer: π × 150<sup>2</sup> / 120 ≈ 589, minus π × 300 / √240 ≈ 61, so about <strong>528</strong>.</li><li>Yield: e<sup>−1.2 × 0.07</sup> = e<sup>−0.084</sup> ≈ 0.919, so about 485 good dies.</li><li>Cost: $20,000 / 485 ≈ <strong>$41 per good die</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A server design needs 600 mm<sup>2</sup> of logic. Option 0 is one monolithic die; option 1 is 8 chiplets of 75 mm<sup>2</sup> each. With $15,000 wafers (300 mm) and D<sub>0</sub> = 0.08 per cm<sup>2</sup>, compare silicon cost per working product. What does the comparison leave out?</p>`,
        a: `<p><strong>Option 0:</strong> dies per wafer ≈ 22,500π / 600 − 300π / √1200 ≈ 117.8 − 27.2 ≈ 90. Yield e<sup>−6 × 0.08</sup> = e<sup>−0.48</sup> ≈ 0.62, so about 56 good dies: about <strong>$270</strong> each.</p><p><strong>Option 1:</strong> dies per wafer ≈ 22,500π / 75 − 300π / √150 ≈ 942.5 − 77.0 ≈ 865. Yield e<sup>−0.75 × 0.08</sup> = e<sup>−0.06</sup> ≈ 0.94, so about 815 good dies at about $18.4 each; 8 of them cost about <strong>$147</strong>.</p><p>Chiplets cut silicon cost by about 45%. Left out: die-to-die PHYs add area to every chiplet, the advanced package (interposer or bridges) and assembly cost more, assembly has its own yield, cross-die latency and power rise, and harvesting can rescue some partly defective monolithic dies.</p>`
      }
    ]
  }
}
]);
