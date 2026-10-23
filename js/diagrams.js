/* Clickable diagrams: the 5-stage pipeline on the Pipeline Stages overview,
   and the chip floorplan and industry stack on the home page. Every link
   points at an existing note (and optionally a section anchor) by hash route. */

function svgEsc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/* A clickable rectangle with centered label lines. kind: core | mem | io | ghost */
function fpBlock(x, y, w, h, href, lines, kind, tip) {
  const lh = 15, sub = lines.length > 1 ? lines.slice(1) : [];
  const total = lh + sub.length * 13;
  let ty = y + h / 2 - total / 2 + 11;
  const cx = x + w / 2;
  let t = `<text class="l" x="${cx}" y="${ty}">${svgEsc(lines[0])}</text>`;
  sub.forEach((s, i) => { t += `<text class="s" x="${cx}" y="${ty + 15 + i * 13}">${svgEsc(s)}</text>`; });
  const label = tip || lines.join(", ");
  return `<a href="#/${href}" class="fpb ${kind}" aria-label="${svgEsc(label)}"><title>${svgEsc(label)}</title>
    <rect class="b" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${t}</a>`;
}

/* ---------- 5-stage pipeline ---------- */
function plStage(x, href, abbr, name, parts) {
  const cx = x + 59;
  return `<a href="#/${href}" class="fpb core" aria-label="${svgEsc(name)} (${abbr})"><title>${svgEsc(name)} (${abbr})</title>
    <rect class="b" x="${x}" y="110" width="118" height="130" rx="3"/>
    <text class="big" x="${cx}" y="142">${abbr}</text>
    <text class="s" x="${cx}" y="160">${svgEsc(name)}</text>
    ${parts.map((p, i) => `<text class="p" x="${cx}" y="${186 + i * 16}">${svgEsc(p)}</text>`).join("")}</a>`;
}
function plReg(x, name) {
  return `<a href="#/pipe-problems/pipe-regs" class="fpb preg" aria-label="${name} pipeline register"><title>${name} pipeline register</title>
    <rect class="b" x="${x}" y="96" width="12" height="160" rx="2"/>
    <text class="s" x="${x + 6}" y="272">${name}</text></a>`;
}
function plPath(href, d, cls, label, tip) {
  return `<a href="#/${href}" class="plp ${cls}" aria-label="${svgEsc(tip)}"><title>${svgEsc(tip)}</title>
    <path class="hit" d="${d}"/><path class="ln" d="${d}" marker-end="url(#ah-${cls})"/>${label}</a>`;
}

function pipelineSVG() {
  return `<figure class="fp-fig pl-fig">
  <div class="fp-scroll"><svg class="fp pl" viewBox="0 0 760 390" role="group" aria-label="Classic 5-stage pipeline. Stages, pipeline registers, forwarding paths, and the branch redirect link to their notes.">
    <defs>
      <marker id="ah-fwd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah fwd" d="M0,0 L10,5 L0,10 z"/></marker>
      <marker id="ah-redir" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah redir" d="M0,0 L10,5 L0,10 z"/></marker>
      <marker id="ah-aux" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah aux" d="M0,0 L10,5 L0,10 z"/></marker>
    </defs>

    ${plPath("branch-hazards/schemes", "M371,110 L371,58 L79,58 L79,106", "redir",
      `<text class="pl-lab redir" x="225" y="50">Branch redirect: target → PC, flush IF and ID</text>`,
      "Branch redirect: a taken or mispredicted branch resolved in EX sends its target to the PC and flushes the two younger instructions")}

    ${plStage(20, "stage-if", "IF", "Instruction fetch", ["PC → I-cache", "PC + 4"])}
    ${plReg(146, "IF/ID")}
    ${plStage(166, "stage-id", "ID", "Decode / reg read", ["Decode", "Register read", "Sign-extend"])}
    ${plReg(292, "ID/EX")}
    ${plStage(312, "stage-ex", "EX", "Execute / address", ["ALU", "Effective address", "Branch compare"])}
    ${plReg(438, "EX/MEM")}
    ${plStage(458, "stage-mem", "MEM", "Memory access", ["D-cache load", "D-cache store"])}
    ${plReg(584, "MEM/WB")}
    ${plStage(604, "stage-wb", "WB", "Write-back", ["Register write"])}

    ${plPath("data-hazards/forwarding", "M444,256 L444,300 L398,300 L398,244", "fwd",
      `<text class="pl-lab fwd" x="452" y="304" text-anchor="start">Forward EX/MEM → ALU</text>`,
      "Forwarding path: EX/MEM result back to the ALU input")}
    ${plPath("data-hazards/forwarding", "M590,256 L590,330 L344,330 L344,244", "fwd",
      `<text class="pl-lab fwd" x="598" y="334" text-anchor="start">Forward MEM/WB → ALU</text>`,
      "Forwarding path: MEM/WB result back to the ALU input")}

    ${fpBlock(20, 300, 118, 44, "branch-hazards/btb", ["Branch predictor", "+ BTB"], "core", "Branch-target buffer and dynamic prediction")}
    <path class="aux-ln" d="M79,300 L79,244" marker-end="url(#ah-aux)"/>
    ${fpBlock(166, 300, 118, 44, "data-hazards/load-use", ["Hazard detection", "load-use stall"], "core", "Hazard detection unit: load-use stall")}
    <path class="aux-ln" d="M225,300 L225,244" marker-end="url(#ah-aux)"/>

    <g class="pl-key" transform="translate(20,372)">
      <rect class="k-stage" x="0" y="-9" width="14" height="10" rx="2"/><text x="20" y="0">Stage</text>
      <rect class="k-reg" x="74" y="-9" width="14" height="10" rx="2"/><text x="94" y="0">Pipeline register</text>
      <line class="k-fwd" x1="214" y1="-4" x2="238" y2="-4"/><text x="244" y="0">Forwarding</text>
      <line class="k-redir" x1="330" y1="-4" x2="354" y2="-4"/><text x="360" y="0">Branch redirect</text>
      <text class="hint" x="720" y="0" text-anchor="end">Click any part</text>
    </g>
  </svg></div></figure>`;
}

/* ---------- CPU floorplan: one Zen 4 CCD ("Durango"), 8 cores ----------
   Two columns of four cores on either side of the shared 32 MB L3. Each
   core's FP region is on the outer edge (thermals) and its L2 faces its own
   L3 slice. Core 0 is traced from SemiAnalysis's annotation of AMD's ISSCC
   2023 Zen 4 core ("Persephone"); cores 1-7 are copies, mirrored on the right.
   Die proportions come from AMD's published areas (66.3 mm2 CCD, about
   3.84 mm2 per core, about 25 mm2 of L3). Dashed blocks are not labeled in
   the annotation, so their placement inside a partition is inferred.
   Colors are fixed in the dark and light themes (a chip is dark in both);
   the pink theme swaps in pastels via the g-<group> classes. */

const Z4_GROUPS = {
  fe:   { name: "Front end",                  fill: "#1D3F7A", stroke: "#4F7FD6" },
  ooo:  { name: "Dispatch, OoO, integer",     fill: "#17543E", stroke: "#3DB386" },
  fp:   { name: "FP and SIMD",                fill: "#7A1F2B", stroke: "#E0606E" },
  lsu:  { name: "Load/store, prefetch",       fill: "#12505A", stroke: "#36AFC0" },
  sram: { name: "SRAM and ROM arrays",        fill: "#2A2D63", stroke: "#7C84DA" },
  coh:  { name: "Ring, coherence",            fill: "#4A2558", stroke: "#B474CF" },
  io:   { name: "Die-to-die I/O",             fill: "#5C211C", stroke: "#D2614C" },
  misc: { name: "Pervasive: power, clocks, debug", fill: "#24313F", stroke: "#7890A8" }
};

/* Core 0, traced in the annotation image's pixel space (the core spans
   x 50-1135, y 505-1015 there): [x0, y0, x1, y1, group, href, lines, tip, inferred]. */
const CORE_TRACE = [
  [70, 515, 325, 575, "sram", "fe-decode/decode", ["uCode ROM"], "Microcode ROM"],
  [70, 575, 215, 745, "fp", "fp-units", ["FP/SIMD", "pipes"], "FP and SIMD execution pipes, 4 × 256-bit in total"],
  [215, 575, 325, 745, "fp", "prf-sizing", ["FP PRF"], "FP/vector physical register file, first half"],
  [70, 745, 325, 830, "fp", "scheduler", ["FP rename, sched"], "FP rename and FP scheduler (placement inferred)", true],
  [70, 830, 215, 1005, "fp", "fp-units", ["FP/SIMD", "pipes"], "FP and SIMD execution pipes, 4 × 256-bit in total"],
  [215, 830, 325, 1005, "fp", "prf-sizing", ["FP PRF"], "FP/vector physical register file, second half"],

  [330, 520, 510, 610, "fe", "fe-decode", ["Decode"], "Instruction decode"],
  [510, 520, 640, 610, "sram", "stage-if", ["L1I", "+ iTLB"], "L1 instruction cache and iTLB"],
  [640, 520, 830, 715, "fe", "fe-direction", ["Branch", "predictor", "BTBs"], "Branch predictor and BTBs"],
  [330, 610, 450, 715, "ooo", "renaming", ["Disp.", "rename"], "Dispatch and register renaming"],
  [450, 610, 640, 715, "sram", "fe-decode/uop-cache", ["Op cache", "6.75K ops"], "Op cache, decoded ops"],
  [330, 715, 600, 775, "ooo", "scheduler", ["Int scheduler"], "Integer scheduler: 4 queues shared by ALUs and AGUs"],
  [600, 715, 830, 775, "ooo", "rob", ["ROB"], "Reorder buffer / retire queue (placement inferred)", true],

  [330, 775, 510, 821, "ooo", "prf-sizing", ["Int PRF"], "Integer physical register file (placement inferred)", true],
  [330, 821, 510, 852, "ooo", "data-hazards/forwarding", ["Bypass"], "Bypass network (placement inferred)", true],
  [330, 852, 420, 905, "ooo", "exec-units", ["ALUs"], "4 integer ALUs"],
  [420, 852, 510, 905, "ooo", "exec-units", ["AGUs"], "3 address generation units, next to load/store and the L1D (placement inferred)", true],
  [510, 775, 645, 905, "lsu", "lsq", ["LSQ"], "Load and store queues (placement inferred)", true],
  [645, 775, 830, 830, "lsu", "mdp", ["MDP"], "Memory dependence predictor (placement inferred)", true],
  [645, 830, 830, 905, "lsu", "virtual-memory", ["dTLB"], "L1 and L2 data TLBs (placement inferred)", true],
  [330, 905, 645, 1005, "sram", "dcache", ["L1 D-cache"], "L1 data cache, 32 KB"],
  [645, 905, 830, 1005, "lsu", "virtual-memory", ["Page", "walker"], "Page table walker"],

  [830, 515, 1135, 575, "misc", "gates-clocking", ["CPL"], "Chip pervasive logic: clocking, power, debug"],
  [830, 575, 900, 1005, "lsu", "prefetch", ["L2", "ctrl", "pref."], "L2 control and prefetchers (placement inferred)", true],
  [900, 575, 1135, 1005, "sram", "l2-banks", ["Private L2", "1 MB, 8-way"], "Private L2 cache and banking"]
];
const TRACE_S = 426 / 1085;
const Z4_LAYOUT = CORE_TRACE.map(([x0, y0, x1, y1, g, href, lines, tip, inf]) =>
  [(x0 - 50) * TRACE_S + 0.8, (y0 - 505) * TRACE_S + 0.8, (x1 - x0) * TRACE_S - 1.6, (y1 - y0) * TRACE_S - 1.6, g, href, lines, tip, !!inf]);
const Z4_W = 426, Z4_H = 200;

function dieBlock(x, y, w, h, g, href, lines, tip, inferred) {
  const G = Z4_GROUPS[g];
  const big = h >= 38 && w >= 80;
  const lh = big ? 14 : 12, sub = lines.slice(1);
  const total = lh + sub.length * 12;
  const ty = y + h / 2 - total / 2 + (big ? 11 : 9.5);
  const cx = x + w / 2;
  let t = `<text class="dl${big ? "" : " sm"}" x="${cx}" y="${ty}">${svgEsc(lines[0])}</text>`;
  sub.forEach((s, i) => { t += `<text class="ds" x="${cx}" y="${ty + 13 + i * 12}">${svgEsc(s)}</text>`; });
  const label = tip || lines.join(", ");
  const tex = g === "sram" ? `<rect class="tex" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sram)"/>` : "";
  const dash = inferred ? ` stroke-dasharray="4 2.5"` : "";
  return `<a href="#/${href}" class="dblk" aria-label="${svgEsc(label)}"><title>${svgEsc(label)}</title>
    <rect class="b g-${g}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${G.fill}" stroke="${G.stroke}"${dash}/>${tex}${t}</a>`;
}

/* Core 0 in full detail. */
function coreDetail(ox, oy) {
  return `<rect class="core-edge" x="${ox}" y="${oy}" width="${Z4_W}" height="${Z4_H}" rx="3"/>` +
    Z4_LAYOUT.map(([x, y, w, h, g, href, lines, tip, inf]) => dieBlock(ox + x, oy + y, w, h, g, href, lines, tip, inf)).join("");
}

/* Cores 1-7: the same layout, unlabeled; the right column is mirrored so its L2s face the L3. */
function coreGhost(n, ox, oy, flipX, flipY) {
  const tf = `translate(${ox + (flipX ? Z4_W : 0)},${oy + (flipY ? Z4_H : 0)}) scale(${flipX ? -1 : 1},${flipY ? -1 : 1})`;
  const rects = Z4_LAYOUT.map(([x, y, w, h, g]) =>
    `<rect class="g-${g}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${Z4_GROUPS[g].fill}" stroke="${Z4_GROUPS[g].stroke}" stroke-opacity=".5"/>`).join("");
  const lx = ox + (flipX ? Z4_W - 10 : 10), ly = oy + (flipY ? 14 : Z4_H - 8);
  return `<a href="#/r/core" class="dghost" aria-label="Core ${n}: same design as core 0"><title>Core ${n}: same design as core 0 (opens Out-of-order core)</title>
    <rect class="core-edge" x="${ox}" y="${oy}" width="${Z4_W}" height="${Z4_H}" rx="3"/>
    <g class="gl" transform="${tf}">${rects}</g>
    <text class="gname" x="${lx}" y="${ly}" text-anchor="${flipX ? "end" : "start"}">Core ${n}</text></a>`;
}

/* Die geometry: left cores at x 50, L3 x 482-1158, right cores at x 1164;
   core rows every 206 from y 70; uncore strip below. */
const DIE_L = 50, DIE_R = 1164, ROW0 = 70, ROW_DY = 206;
const L3_TOPICS = [
  ["cache-size", "Shared L3 slice 0: cache size"], ["cache-assoc", "Shared L3 slice 1: associativity"],
  ["cache-replacement", "Shared L3 slice 2: replacement policies"], ["cache-write", "Shared L3 slice 3: write policies"],
  ["cache-line", "Shared L3 slice 4: cache lines"], ["cache-banking", "Shared L3 slice 5: banking"],
  ["mesi", "Shared L3 slice 6: coherence states (MOESI family)"], ["directory", "Shared L3 slice 7: the L3 tracks which cores hold each line (opens Directory-based coherence)"]
];

function floorplanSVG() {
  const D = dieBlock;
  let cores = coreDetail(DIE_L, ROW0), l3 = "";
  for (let n = 1; n < 8; n++) {
    const right = n >= 4, row = n % 4;
    cores += coreGhost(n, right ? DIE_R : DIE_L, ROW0 + row * ROW_DY, right, false);
  }
  for (let n = 0; n < 8; n++) {
    const right = n >= 4, row = n % 4, [href, tip] = L3_TOPICS[n];
    l3 += D(right ? 858 : 482, ROW0 + row * ROW_DY, 300, 200, "sram", href, [`L3 slice ${n}`, "4 MB"], tip);
  }
  return `<figure class="fp-fig">
  <div class="chip-bar"><button type="button" class="chip-zoom" id="chipZoom" aria-pressed="true">Show all 8 cores</button>
    <span>or pinch / Ctrl + scroll over the chip</span></div>
  <div class="fp-scroll"><svg class="fp chip zoomed" viewBox="${Z4_CORE.join(" ")}" role="group" aria-label="Zen 4 core complex die floorplan, 8 cores. Each block links to its notes.">
    <defs>
      <pattern id="sram" width="6" height="6" patternUnits="userSpaceOnUse"><path class="sram-ln" d="M6 0H0V6" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="1"/></pattern>
      <marker id="ah-chip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah-chip-p" d="M0,0 L10,5 L0,10 z" fill="#C2503F"/></marker>
    </defs>

    <text class="ext-t sm" x="820" y="26">Zen 4 CCD · 8 cores · 32 MB shared L3</text>
    <rect class="die-bg" x="40" y="40" width="1560" height="1000" rx="3" fill="#080D13" stroke="#3A5068"/>
    <text class="gname" x="${DIE_L + 2}" y="60" text-anchor="start">Core 0</text>

    ${cores}
    ${l3}
    ${D(788, ROW0, 64, 818, "coh", "icx-coherent", ["Ring", "TSVs"], "Ring bus between the L3 slices, and TSVs for stacked 3D V-Cache")}

    ${D(DIE_L, 894, 510, 136, "io", "icx-chiplets", ["IFoP PHYs", "2 × GMI3 links to the I/O die"], "Infinity Fabric on Package: links to the I/O die (placement inferred)", true)}
    ${D(566, 894, 334, 136, "misc", "gates-clocking", ["SMU", "power and clock management"], "System Management Unit (placement inferred)", true)}
    ${D(906, 894, 684, 136, "misc", "perf-stats", ["Test, debug, PMU"], "Test, debug and performance monitoring (placement inferred)", true)}

    <a href="#/icx-chiplets" class="ext" aria-label="I/O die"><title>The I/O die (DDR5, PCIe 5) is a separate chiplet: Chiplets and UCIe</title>
      <path class="ext-ln" d="M305,1040 L305,1060" marker-end="url(#ah-chip)"/>
      <text class="ext-t" x="305" y="1080">To the I/O die: DDR5, PCIe 5</text></a>
  </svg></div>
  <figcaption class="fp-legend chip-legend">
    ${Object.entries(Z4_GROUPS).map(([k, g]) => `<span><i class="sw g-${k}" style="background:${g.fill};border-color:${g.stroke}"></i>${g.name}</span>`).join("")}
    <span><i class="sw" style="border-style:dashed;border-color:var(--muted)"></i>Placement inferred</span>
    <span class="hint">Core 0 is traced from SemiAnalysis's annotation of AMD's Zen 4 core; cores 1-7 are copies. Click any block to open its notes.</span>
  </figcaption></figure>`;
}

/* ---------- Floorplan zoom (diagram only, never the page) ----------
   Pinch on a trackpad, Ctrl + scroll, a two-finger pinch on touch, or the
   button: zooms the SVG's viewBox onto Core 0 instead of zooming the page,
   so following a link always lands on an unzoomed page. */
const Z4_FULL = [0, 0, 1640, 1090];
const Z4_CORE = [42, 38, 442, 294];
function initChipZoom() {
  const svg = document.querySelector("svg.chip");
  const btn = document.getElementById("chipZoom");
  if (!svg || !btn) return;
  let zoomed = true, cur = Z4_CORE.slice(), anim = 0;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setVB = v => svg.setAttribute("viewBox", v.map(n => n.toFixed(2)).join(" "));
  function go(z) {
    if (z === zoomed) return;
    zoomed = z;
    btn.textContent = z ? "Show all 8 cores" : "Zoom into Core 0";
    btn.setAttribute("aria-pressed", String(z));
    svg.classList.toggle("zoomed", z);
    const from = cur.slice(), to = z ? Z4_CORE : Z4_FULL, t0 = performance.now(), dur = reduce ? 0 : 380;
    cancelAnimationFrame(anim);
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      cur = from.map((f, i) => f + (to[i] - f) * e); setVB(cur);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  btn.addEventListener("click", () => go(!zoomed));
  // Trackpad pinch and Ctrl+scroll arrive as wheel events with ctrlKey.
  let acc = 0;
  svg.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    acc += e.deltaY;
    if (acc < -12) { go(true); acc = 0; } else if (acc > 12) { go(false); acc = 0; }
  }, { passive: false });
  // Safari trackpad pinch.
  ["gesturestart", "gesturechange"].forEach(t => svg.addEventListener(t, e => {
    e.preventDefault();
    if (e.scale > 1.08) go(true); else if (e.scale < 0.92) go(false);
  }, { passive: false }));
  // Two-finger pinch on touch screens (CSS touch-action stops the page from zooming here).
  const pts = new Map(); let d0 = 0;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  svg.addEventListener("pointerdown", e => { if (e.pointerType !== "touch") return; pts.set(e.pointerId, e); if (pts.size === 2) d0 = dist(); });
  svg.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pts.size === 2 && d0) { const r = dist() / d0; if (r > 1.15) { go(true); d0 = dist(); } else if (r < 0.87) { go(false); d0 = dist(); } }
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => svg.addEventListener(t, e => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; }));
  document.addEventListener("keydown", function onKey(e) {
    if (!document.body.contains(svg)) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "Escape" && zoomed) go(false);
  });
}

/* ---------- The semiconductor industry stack (bottom of the home page) ----------
   Eight layers from TestFlow's "8 Layers of the Semiconductor Industry",
   numbered from 0 here (the article counts 1-8). Top of the stack first.
   [kind, name, description, companies, 2024 market size, main link, extra links]
   kind: sys | mfg | design. A null main link means no notes yet: the layer
   shows but isn't clickable. Links whose target doesn't exist are dropped. */
const STACK_SRC = "https://testflowinc.com/blog/8-layers-semiconductor-industry-trillion-dollar-breakdown";
const STACK_LAYERS = [
  ["sys", "System Companies", "Build the final products and drive chip demand", "Apple, Dell, Sony, Cisco", "$3.2T", null, []],
  ["mfg", "Packaging and Testing (OSAT)", "Assemble, package, and test chips before they ship", "ASE Group, Amkor, JCET, SPIL", "$35B", "icx-chiplets", [["eda-dft", "Design for Test"]]],
  ["mfg", "Equipment Vendors", "Build the machines that pattern, etch, and inspect wafers", "ASML, Applied Materials, Lam Research, KLA", "$109B", "fab-nodes", []],
  ["mfg", "Foundries and IDMs", "Manufacture chips for others (foundries) or for themselves (IDMs)", "TSMC, Samsung, GlobalFoundries, Intel", "$574B", "r/fab", [["fab-yield", "Yield and Die Cost"]]],
  ["design", "EDA Tools", "Software to design, simulate, and verify chips", "Synopsys, Cadence, Siemens EDA", "$15B", "r/eda", [["r/verif", "Verification"]]],
  ["design", "IP Cores", "Licensed processor cores, interfaces, and logic blocks", "Arm, Imagination, Rambus, CEVA", "$8B", "r/isa", [["icx-onchip", "On-Chip Buses"]]],
  ["design", "Fabless Design Companies", "Design chips and outsource the manufacturing", "Qualcomm, NVIDIA, AMD, Broadcom", "$385B", "eda-arch", [["r/core", "Out-of-Order Core"], ["r/mem", "Memory Hierarchy"]]],
  ["mfg", "Raw Materials", "Silicon wafers, chemicals, and process gases", "Shin-Etsu, SUMCO, BASF, Air Liquide", "$28B", "r/fab", []]
];

function stackTargetExists(href) {
  const [a, b] = href.split("/");
  return a === "r" ? REGIONS.some(r => r.id === b && !r.private) : NOTES.some(n => n.id === a && !n.private);
}

function stackHTML() {
  const layers = STACK_LAYERS.filter(l => !l[5] || stackTargetExists(l[5]));
  const top = layers.length - 1;
  return `<section class="stack-fig" aria-labelledby="stackTitle">
    <h2 id="stackTitle">The Semiconductor Industry Stack</h2>
    <p class="stack-cap">Eight layers, from the sand to the finished product. Click a layer to open the related notes.</p>
    <ol class="stack" style="--n:${top}">${layers.map(([kind, name, desc, cos, size, href, more], i) => `
      <li class="layer ${kind}${href ? "" : " nolink"}" style="--d:${i}">
        <span class="lvl" aria-hidden="true">${top - i}</span>
        <div class="lyr-main">${href ? `<a class="lyr-name" href="#/${href}">${name}</a>` : `<span class="lyr-name">${name}</span>`}<span class="lyr-cap">${desc}</span>
          <span class="lyr-cos">${cos}</span></div>
        <div class="lyr-side"><span class="lyr-size" title="2024 market size">${size}</span>
          <div class="lyr-more">${more.filter(m => stackTargetExists(m[0])).map(([h, t]) => `<a href="#/${h}">${t}</a>`).join("")}</div></div>
      </li>`).join("")}
    </ol>
    <p class="stack-key"><span><i class="sys"></i>Products</span><span><i class="design"></i>Design</span><span><i class="mfg"></i>Manufacturing and supply</span></p>
    <p class="stack-src">Layers, companies, and 2024 market sizes from <a href="${STACK_SRC}" target="_blank" rel="noopener">8 Layers of the Semiconductor Industry (TestFlow)</a>. The article bills the industry as a $1 trillion ecosystem; the System Companies figure counts finished products, so the layers don't sum to that.</p>
  </section>`;
}
