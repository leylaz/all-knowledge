/* GPU animations for the Visual region. A body places one with
   <div class="anim" data-anim="name"></div>, and initAnims() builds it.
   "steps" anims show one SVG frame per step with Prev and Next (moving
   pieces use SMIL <animate>, which restarts each time a frame is drawn).
   "cycles" anims run a cycle-level model of one H100 SM sub-partition and
   draw it at the chosen cycle, laid out like the classic Fermi SM figure.
   Nothing here touches the DOM until initAnims() runs, so tools/check.js
   can load this file. */

/* One H100 (SM90) SM sub-partition. A warp instruction needs 32 / lanes
   passes through its unit, one pass per cycle. */
const SUBP_UNITS = {
  int: { name: "INT32", lanes: 16, cols: 2 },
  fp32: { name: "FP32", lanes: 32, cols: 4 },
  fp64: { name: "FP64", lanes: 16, cols: 2 },
  tc: { name: "Tensor Core", lanes: 0, cols: 0 },
  ldst: { name: "LD/ST", lanes: 8, cols: 1 },
  sfu: { name: "SFU", lanes: 4, cols: 1 }
};
const AN_FULL = 0xFFFFFFFF;
const AN_DARK = "#0B1C24";
const anHue = k => `hsl(${Math.round(k * 137.5) % 360} 68% 64%)`;
const anPop = m => { let n = 0; for (; m; m >>>= 1) n += m & 1; return n; };
/* Threads that take the if in the divergence anim, in a fixed scattered order. */
const AN_PERM = [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 24, 25, 26, 27, 4, 5, 12, 13, 20, 21, 22, 23, 28, 29, 30, 31];
const anMask = k => AN_PERM.slice(0, k).reduce((m, t) => (m | (1 << t)) >>> 0, 0);

/* SVG helpers */
const anR = (x, y, w, h, style, inner = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" style="${style}">${inner}</rect>`;
const anT = (x, y, txt, style, mid) => `<text x="${x}" y="${y}"${mid ? ' text-anchor="middle"' : ""} style="${style}">${txt}</text>`;
const anMove = (a, b, d) => ["x", "y", "width", "height"].map((k, i) =>
  `<animate attributeName="${k}" from="${a[i]}" to="${b[i]}" begin="${d}s" dur=".7s" fill="freeze"/>`).join("");
const anShow = d => `<animate attributeName="opacity" from="0" to="1" begin="${d}s" dur=".3s" fill="freeze"/>`;
const AN_S = {
  box: "fill:var(--surface);stroke:var(--muted);stroke-width:1.2",
  thin: "fill:var(--surface);stroke:var(--rule);stroke-width:1",
  slot: "fill:none;stroke:var(--rule);stroke-dasharray:3 2",
  blue: "fill:var(--trace-soft);stroke:var(--rule)",
  orange: "fill:var(--pad-soft);stroke:var(--pad)",
  green: "fill:var(--code-bg);stroke:var(--accent-green)",
  lit: "fill:var(--trace-soft);stroke:var(--trace)",
  title: "font-size:11px;font-weight:600;fill:var(--ink)",
  label: "font-size:10px;fill:var(--ink)",
  small: "font-size:9.5px;fill:var(--muted)",
  dark: `font-size:9.5px;font-weight:600;fill:${AN_DARK}`
};

/* H100 SXM5: 8 GPCs of 18 SM slots, 132 of the 144 enabled. Which slots
   are fused off varies chip to chip; this picks 12 for the drawing. */
const AN_GPU = [];
for (let g = 0; g < 8; g++) for (let j = 0; j < 18; j++) {
  const gx = 236 + (g % 4) * 107, gy = 84 + Math.floor(g / 4) * 82;
  AN_GPU.push({ g, x: gx + 6 + (j % 6) * 15, y: gy + 18 + Math.floor(j / 6) * 18, on: j < (g < 4 ? 16 : 17) });
}
const AN_SM = AN_GPU.filter(s => s.on);
const anGridPos = b => [24 + (b % 6) * 30, 74 + Math.floor(b / 6) * 30];

function anGpuFrame(dealt) {
  let h = anR(10, 30, 200, 252, AN_S.box) + anT(20, 48, "Grid", AN_S.title) +
    anT(20, 62, "scale&lt;&lt;&lt;1320, 256&gt;&gt;&gt;", "font-size:9.5px;font-family:var(--mono);fill:var(--muted)");
  for (let b = 0; b < 36; b++) {
    const [x, y] = anGridPos(b);
    h += `<g style="opacity:${dealt ? .25 : 1}">${anR(x, y, 24, 24, AN_S.lit)}${anT(x + 12, y + 15, b, "font-size:9px;fill:var(--ink)", 1)}</g>`;
  }
  h += dealt ? anT(20, 264, "1,056 blocks now resident", AN_S.small) + anT(20, 277, "264 wait for a free slot", AN_S.small)
    : anT(20, 266, "36 of 1,320 blocks drawn", AN_S.small);
  h += anR(226, 30, 444, 252, AN_S.box) + anT(236, 48, "H100 SXM5: 132 SMs in 8 GPCs", AN_S.title) +
    anR(236, 56, 424, 20, AN_S.orange) + anT(448, 70, "GigaThread Engine (hands blocks to SMs)", AN_S.label, 1);
  for (let g = 0; g < 8; g++) {
    const gx = 236 + (g % 4) * 107, gy = 84 + Math.floor(g / 4) * 82;
    h += anR(gx, gy, 101, 76, AN_S.thin) + anT(gx + 5, gy + 12, `GPC ${g}`, AN_S.small);
  }
  for (const s of AN_GPU)
    h += anR(s.x, s.y, 12, 12, !s.on ? AN_S.slot : dealt ? AN_S.lit : "fill:var(--surface);stroke:var(--muted)");
  h += anR(236, 256, 424, 18, AN_S.blue) + anT(448, 269, "L2 Cache, 50 MB, shared by all SMs", AN_S.label, 1);
  h += anR(226, 292, 444, 20, AN_S.blue) + anT(448, 306, "HBM3 global memory, 80 GB at 3.35 TB/s", AN_S.label, 1);
  if (dealt) for (let b = 0; b < 36; b++) {
    const [x, y] = anGridPos(b), s = AN_SM[b];
    h += anR(x, y, 24, 24, `fill:var(--trace);stroke:var(--trace)`, anMove([x, y, 24, 24], [s.x, s.y, 12, 12], (b * .04).toFixed(2)));
  }
  return h;
}

/* SM 0 holds blocks 0, 132, ..., 924 (block k = 132k), one shared-memory
   slice each. done = slot whose block finished (step 6). */
function anSmFrame(done) {
  let h = anT(10, 44, "SM 0's resident blocks", AN_S.title);
  for (let k = 0; k < 8; k++) {
    const gone = k === done;
    h += `<g style="opacity:${gone ? .35 : 1}">${anR(10, 54 + k * 30, 140, 24, `fill:${anHue(k)};stroke:none`)}` +
      anT(18, 70 + k * 30, `Block ${k * 132} · ${gone ? "finished" : "256 threads"}`, AN_S.dark) + "</g>";
  }
  h += anR(166, 30, 504, 282, AN_S.box) + anT(176, 48, "SM 0", AN_S.title) +
    anR(176, 56, 484, 18, AN_S.blue) + anT(418, 69, "L1 Instruction Cache", AN_S.label, 1);
  for (let k = 0; k < 4; k++) {
    const x = 176 + k * 123;
    h += anR(x, 82, 115, 150, AN_S.thin) + anT(x + 6, 96, `Sub-partition ${k}`, "font-size:10px;font-weight:600;fill:var(--ink)") +
      anR(x + 6, 102, 103, 14, AN_S.blue) + anT(x + 57, 112, "L0 I-cache", AN_S.small, 1) +
      anR(x + 6, 120, 103, 14, AN_S.orange) + anT(x + 57, 130, "Warp Scheduler", AN_S.small, 1) +
      anR(x + 6, 138, 103, 14, AN_S.orange) + anT(x + 57, 148, "Dispatch Unit", AN_S.small, 1) +
      anR(x + 6, 156, 103, 18, AN_S.blue) + anT(x + 57, 168, "Registers, 64 KB", AN_S.small, 1) +
      anT(x + 8, 190, "32 FP32 · 16 INT32", AN_S.small) + anT(x + 8, 203, "16 FP64 · Tensor Core", AN_S.small) +
      anT(x + 8, 216, "8 LD/ST · 4 SFU", AN_S.small);
  }
  h += anR(176, 242, 484, 62, AN_S.blue) + anT(418, 256, "L1 Data Cache / Shared Memory, 256 KB", AN_S.label, 1);
  for (let k = 0; k < 8; k++) {
    const x = 182 + k * 59.5, from = [10, 54 + k * 30, 140, 24], to = [x, 262, 54, 36];
    h += anR(x, 262, 54, 36, AN_S.slot);
    if (done === undefined) {
      const d = k * .12;
      h += anR(...from, `fill:${anHue(k)};stroke:none`, anMove(from, to, d.toFixed(2))) +
        `<g style="opacity:0">${anShow((d + .7).toFixed(2))}${anT(x + 27, 278, `B${k * 132}`, AN_S.dark, 1)}${anT(x + 27, 290, "smem", AN_S.dark, 1)}</g>`;
    } else if (k === done) {
      h += `<g>${anR(x, 262, 54, 36, `fill:${anHue(k)};stroke:none`)}${anT(x + 27, 284, `B${k * 132}`, AN_S.dark, 1)}` +
        `<animate attributeName="opacity" from="1" to="0" dur=".6s" fill="freeze"/></g>`;
      const nf = [10, 294, 140, 18];
      h += anR(...nf, "fill:var(--trace);stroke:none") + anT(18, 306, "Block 1,056 · waiting", `font-size:9.5px;font-weight:600;fill:var(--surface)`) +
        anR(...nf, "fill:var(--trace);stroke:none", anMove(nf, to, ".8")) +
        `<g style="opacity:0">${anShow("1.5")}${anT(x + 27, 278, "B1056", "font-size:9.5px;font-weight:600;fill:var(--surface)", 1)}${anT(x + 27, 290, "smem", "font-size:9.5px;font-weight:600;fill:var(--surface)", 1)}</g>`;
    } else h += anR(x, 262, 54, 36, `fill:${anHue(k)};stroke:none`) + anT(x + 27, 278, `B${k * 132}`, AN_S.dark, 1) + anT(x + 27, 290, "smem", AN_S.dark, 1);
  }
  return h;
}

/* Warp w of a block goes to sub-partition w % 4. In each sub-partition,
   slot 2k + floor(w / 4) holds warp w of SM 0's block k. */
function anWarpFrame() {
  let h = anR(10, 30, 214, 282, AN_S.box) + anT(20, 48, "Block 0: 256 threads = 8 warps", AN_S.title);
  for (let w = 0; w < 8; w++) {
    h += anT(20, 66 + w * 30, `Warp ${w}: threads ${32 * w}–${32 * w + 31}`, AN_S.small);
    for (let t = 0; t < 32; t++) h += `<rect x="${20 + t * 6}" y="${70 + w * 30}" width="5" height="5" style="fill:${anHue(0)}"/>`;
  }
  for (let k = 0; k < 4; k++) {
    const x = 240 + k * 108;
    h += anR(x, 30, 100, 282, AN_S.box) + anT(x + 6, 46, `Sub-partition ${k}`, "font-size:10px;font-weight:600;fill:var(--ink)") +
      anT(x + 6, 59, "16 warp slots", AN_S.small);
    for (let s = 0; s < 16; s++) h += anR(x + 6, 66 + s * 15, 88, 12, AN_S.slot);
  }
  for (let w = 0; w < 8; w++) {
    const k = w % 4, slot = Math.floor(w / 4), d = w * .15;
    const from = [20, 70 + w * 30, 192, 5], to = [246 + k * 108, 66 + slot * 15, 88, 12];
    h += anR(...from, `fill:${anHue(0)};stroke:none`, anMove(from, to, d.toFixed(2))) +
      `<g style="opacity:0">${anShow((d + .7).toFixed(2))}${anT(to[0] + 44, to[1] + 9.5, `B0 · W${w}`, AN_S.dark, 1)}</g>`;
  }
  return h;
}

function anLaneFrame() {
  let h = anR(10, 30, 170, 282, AN_S.box) + anT(18, 46, "Sub-partition 0: 16 warps", AN_S.title);
  for (let s = 0; s < 16; s++) {
    const k = s >> 1;
    h += anR(16, 54 + s * 16, 158, 13, `fill:${anHue(k)};stroke:${s ? "none" : "var(--ink)"};stroke-width:2`) +
      anT(22, 64 + s * 16, `Block ${k * 132} · warp ${s & 1 ? 4 : 0}`, AN_S.dark);
  }
  h += `<path d="M176,60 C190,60 186,140 200,140" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>` +
    anR(200, 118, 120, 44, AN_S.orange) + anT(260, 136, "Warp Scheduler", AN_S.label, 1) + anT(260, 151, "picks 1 warp per cycle", AN_S.small, 1) +
    `<path d="M320,140 H340" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>`;
  h += anR(340, 30, 330, 282, AN_S.green) + anT(352, 48, "32 FP32 lanes: one FFMA for block 0's warp 0", AN_S.title);
  for (let j = 0; j < 32; j++) {
    const x = 352 + (j % 8) * 39, y = 62 + Math.floor(j / 8) * 44, d = (.2 + j * .03).toFixed(2);
    h += anR(x, y, 32, 32, AN_S.thin) + anT(x + 16, y + 42, `lane ${j}`, "font-size:8px;fill:var(--muted)", 1) +
      anR(30, 58, 6, 6, `fill:${anHue(0)};stroke:var(--ink)`, anMove([30, 58, 6, 6], [x, y, 32, 32], d)) +
      `<g style="opacity:0">${anShow((+d + .7).toFixed(2))}${anT(x + 16, y + 20, `t${j}`, AN_S.dark, 1)}</g>`;
  }
  h += anT(352, 252, "Lane j runs thread j: 32 multiply-adds in one cycle,", AN_S.small) +
    anT(352, 266, "each on its own thread's registers.", AN_S.small) +
    anT(352, 286, "Next cycle the scheduler may pick another warp.", AN_S.small);
  return h;
}

const ANIMS = {
  "grid-to-lanes": {
    kind: "steps",
    title: "Walk-Through: A Launch Lands on an H100",
    intro: "One launch of 1,320 blocks of 256 threads. Step through it from the grid down to single lanes.",
    height: 320,
    frames: [
      { label: "The launch", svg: () => anGpuFrame(false),
        cap: "The kernel launch creates a grid of 1,320 independent blocks. The GPU holds 132 SMs in 8 GPCs (graphics processing clusters), all sharing one L2 and HBM. Nothing runs yet: the GigaThread engine, the GPU's block scheduler, decides where blocks go." },
      { label: "Blocks go to SMs", svg: () => anGpuFrame(true),
        cap: "The engine hands each block to an SM with room, in roughly index order. A 256-thread block that fits the limits lets an SM hold 8 at once (2,048 threads, the SM's maximum), so 132 × 8 = 1,056 blocks become resident in the first wave and 264 wait. A block never moves once placed." },
      { label: "Inside one SM", svg: () => anSmFrame(),
        cap: "SM 0 now holds 8 blocks. Each block gets a slice of the 256 KB shared memory and a slice of the registers, reserved until the whole block finishes. The SM itself is 4 sub-partitions, each with its own scheduler, registers, and lanes." },
      { label: "A block becomes warps", svg: anWarpFrame,
        cap: "Inside the SM a block is cut into warps of 32 consecutive threads. Warp w goes to sub-partition w mod 4 (the usual pattern), so block 0's 8 warps take 2 slots in each sub-partition. A warp stays in its sub-partition for life." },
      { label: "A warp meets the lanes", svg: anLaneFrame,
        cap: "Every block does the same, so each sub-partition holds 16 warps, 2 from each block. Each cycle its scheduler picks one ready warp and sends one instruction for all 32 threads. On FP32 work, lane j does thread j's operation, so a whole warp finishes one FFMA in one cycle." },
      { label: "A block finishes", svg: () => anSmFrame(2),
        cap: "When the last warp of block 264 exits, its shared memory and registers free at once, and the engine sends the next waiting block (1,056) into the gap. Blocks are the unit of placement and of release." }
    ]
  },
  "warp-switch": {
    kind: "cycles",
    title: "Timeline: Switching Between Warps",
    intro: "Each warp runs y[i] = c3·x³ + c2·x² + c1·x + c0 in Horner form, as simplified SASS. The scheduler stays on its last warp while that warp is ready and otherwise takes the lowest-numbered ready one (greedy-then-oldest). An L1 hit takes around 40 cycles. Try 260 for an L2 hit and 500 for HBM. In the whole-SM view, warp w lives in sub-partition w mod 4.",
    inputs: [["warps", "Resident warps", 32, 1, 1, 64], ["lat", "Load latency (cycles)", 40, 1, 4, 800]],
    program: [
      ["IMAD R0 = ctaid.x × ntid.x + tid.x", "int", [], 4],
      ["LDG R1 = x[R0]", "ldst", [0], "mem"],
      ["FFMA R2 = R1 × c3 + c2", "fp32", [1], 4],
      ["FFMA R2 = R2 × R1 + c1", "fp32", [2], 4],
      ["FFMA R2 = R2 × R1 + c0", "fp32", [3], 4],
      ["STG y[R0] = R2", "ldst", [0, 4], 0]
    ]
  },
  "warp-diverge": {
    kind: "cycles",
    title: "Timeline: An If/Else Splits a Warp",
    intro: "r = v &gt; 0 ? 0.5·√v : −v² − 1, then y = r + bias, with v already in R1. W0's data is mixed, so it runs both paths with part of the warp masked off. All of W1's values are positive, so it skips the else path.",
    warps: 2,
    inputs: [["pos", "W0 threads with v &gt; 0", 20, 1, 0, 32]],
    masks: v => [anMask(v.pos), AN_FULL],
    program: [
      ["FSETP.GT P0 = R1 &gt; 0", "fp32", [], 4],
      ["@!P0 BRA ELSE", "ctrl", [0], 2],
      ["MUFU.SQRT R2 = √R1", "sfu", [], 18, "if"],
      ["FMUL R2 = R2 × 0.5", "fp32", [2], 4, "if"],
      ["BRA JOIN", "ctrl", [], 2, "if"],
      ["ELSE: FMUL R2 = R1 × −R1", "fp32", [], 4, "else"],
      ["FADD R2 = R2 − 1", "fp32", [5], 4, "else"],
      ["JOIN: FADD R3 = R2 + R4", "fp32", [3, 6], 4],
      ["STG y[R0] = R3", "ldst", [7], 0]
    ]
  }
};

/* Cycle model of one sub-partition. Each warp walks its own instruction
   sequence (if/else entries only run with their part of the mask). A warp
   can issue when its operands are ready (a branch also blocks the warp
   until it resolves) and its unit is free. One warp instruction issues per
   cycle and holds its unit for 32 / lanes cycles. */
function subpRun(a, v, ids) {
  const P = a.program;
  const all = a.masks ? a.masks(v) : Array(v.warps).fill(AN_FULL);
  const masks = ids.map(id => all[id]);
  const nW = masks.length;
  const seqs = masks.map(m => P.map((p, i) => ({ i, mask: p[4] === "if" ? m : p[4] === "else" ? (~m >>> 0) : AN_FULL })).filter(x => x.mask));
  const lat = p => p[3] === "mem" ? v.lat : p[3];
  const pc = Array(nW).fill(0), ready = masks.map(() => ({}));
  const unitFree = {}, lanes = [], cyc = [], loads = [];
  let last = -1, end = 0;
  for (let c = 0; c < 6000; c++) {
    const st = [];
    for (let w = 0; w < nW; w++) {
      const sq = seqs[w];
      if (pc[w] >= sq.length) { st.push({ k: "done", i: -1 }); continue; }
      const x = sq[pc[w]], p = P[x.i];
      const deps = p[2].filter(d => d in ready[w]);
      if (pc[w] > 0 && P[sq[pc[w] - 1].i][1] === "ctrl") deps.push(sq[pc[w] - 1].i);
      let wait = -1;
      for (const d of deps) if (ready[w][d] > c && (wait < 0 || ready[w][d] > ready[w][wait])) wait = d;
      if (wait >= 0) st.push({ k: P[wait][3] === "mem" ? "mem" : P[wait][1] === "ctrl" ? "br" : "dep", i: x.i, left: ready[w][wait] - c });
      else if (p[1] !== "ctrl" && (unitFree[p[1]] || 0) > c) st.push({ k: "unit", i: x.i });
      else st.push({ k: "ready", i: x.i });
    }
    let pick = last >= 0 && st[last].k === "ready" ? last : st.findIndex(x => x.k === "ready");
    let ins = null;
    if (pick >= 0) {
      const x = seqs[pick][pc[pick]], p = P[x.i], u = SUBP_UNITS[p[1]];
      const passes = u ? 32 / u.lanes : 1;
      if (u) {
        unitFree[p[1]] = c + passes;
        for (let k = 0; k < passes; k++) (lanes[c + k] = lanes[c + k] || {})[p[1]] = { w: ids[pick], pass: k, passes, mask: x.mask };
      }
      ready[pick][x.i] = c + passes - 1 + lat(p);
      if (p[3] === "mem") loads.push(ready[pick][x.i]);
      end = Math.max(end, c + passes - 1);
      ins = x;
      st[pick] = { k: "issue", i: x.i };
      pc[pick]++;
      last = pick;
    }
    cyc.push({ pick: pick >= 0 ? ids[pick] : -1, ins, st, inflight: loads.filter(r => r > c).length });
    if (pc.every((n, w) => n >= seqs[w].length) && c >= end) break;
  }
  return { nW, ids, cyc, lanes, cycles: cyc.length };
}

const anMn = t => t.replace(/^\w+: /, "").replace(/^@\S+ /, "").split(" ")[0];

function anStateText(a, st) {
  const mn = st.i >= 0 ? anMn(a.program[st.i][0]) : "";
  switch (st.k) {
    case "issue": return `${mn} issuing`;
    case "mem": return `${mn}: load returns in ${st.left}`;
    case "dep": return `${mn}: operand ready in ${st.left}`;
    case "br": return `branch resolves in ${st.left}`;
    case "unit": return `${mn}: ${SUBP_UNITS[a.program[st.i][1]].name} unit busy`;
    case "ready": return `${mn}: ready, not picked`;
    default: return "exited";
  }
}

/* The sub-partition at cycle c, after the Fermi SM figure: caches and
   registers in blue, scheduling in orange, execution units in green. */
function subpSvg(a, s, c) {
  const rec = s.cyc[c], use = s.lanes[c] || {};
  let h = anT(0, 14, "Warps in this sub-partition", AN_S.title);
  rec.st.forEach((st, w) => {
    const id = s.ids[w], y = 24 + w * 22, on = rec.pick === id, col = anHue(id);
    h += anR(0, y, 198, 19, `fill:${on ? col : "var(--surface)"};stroke:${col};stroke-width:${on ? 1.5 : 1};opacity:${st.k === "done" ? .45 : 1}`) +
      anT(6, y + 13, `W${id}`, `font-size:10.5px;font-weight:700;fill:${on ? AN_DARK : "var(--ink)"}`) +
      anT(32, y + 13, anStateText(a, st), `font-size:10px;fill:${on ? AN_DARK : "var(--muted)"}`);
  });
  const X = 212, W = 468, mid = X + W / 2;
  const row = s.ids.indexOf(rec.pick);
  if (row >= 0) h += `<path d="M198,${33 + row * 22} C206,${33 + row * 22} 204,42 ${X},42" style="fill:none;stroke:var(--ink);stroke-width:1.2"/>`;
  const p = rec.ins && a.program[rec.ins.i];
  h += anR(X, 0, W, 22, AN_S.blue) + anT(mid, 15, "L0 Instruction Cache", AN_S.label, 1) +
    anR(X, 30, W, 24, rec.pick >= 0 ? `fill:${anHue(rec.pick)};stroke:var(--pad)` : AN_S.orange) +
    anT(mid, 46, rec.pick >= 0 ? `Warp Scheduler: picks W${rec.pick}` : "Warp Scheduler: no ready warp, slot unused", rec.pick >= 0 ? AN_S.dark : AN_S.label, 1) +
    anR(X, 60, W, 24, AN_S.orange) +
    anT(mid, 76, p ? `Dispatch Unit: ${p[0]}${rec.ins.mask !== AN_FULL ? ` (${anPop(rec.ins.mask)} of 32 threads)` : ""}` : "Dispatch Unit (32 threads/clk)", AN_S.label, 1) +
    anR(X, 90, W, 28, AN_S.blue) + anT(mid, 108, "Register File (16,384 × 32-bit)", AN_S.label, 1);
  const order = ["int", "fp32", "fp64", "tc", "ldst", "sfu"];
  const bw = k => k === "tc" ? 64 : SUBP_UNITS[k].cols * 27 + 9;
  let x = X + (W - order.reduce((t, k) => t + bw(k), 0) - 35) / 2;
  for (const k of order) {
    const u = SUBP_UNITS[k], lu = use[k];
    h += anR(x, 126, bw(k), 248, lu ? `fill:var(--code-bg);stroke:${anHue(lu.w)};stroke-width:2` : AN_S.green) +
      anT(x + bw(k) / 2, 141, u.name.replace("Tensor Core", "Tensor"), `font-size:10px;font-weight:600;fill:var(--ink)`, 1);
    if (k === "tc") h += anT(x + 32, 154, "Core", "font-size:10px;font-weight:600;fill:var(--ink)", 1) + anT(x + 32, 250, "(idle here)", AN_S.small, 1);
    for (let j = 0; j < u.lanes; j++) {
      const lx = x + 6 + Math.floor(j / 8) * 27, ly = 148 + (j % 8) * 27;
      if (!lu) { h += anR(lx, ly, 24, 24, AN_S.thin); continue; }
      const t = lu.pass * u.lanes + j, on = (lu.mask >>> t) & 1, col = anHue(lu.w);
      h += on ? anR(lx, ly, 24, 24, `fill:${col};stroke:${col}`) + anT(lx + 12, ly + 16, t, `font-size:10px;font-weight:700;fill:${AN_DARK}`, 1)
        : anR(lx, ly, 24, 24, `fill:none;stroke:${col};stroke-dasharray:3 2`) + anT(lx + 12, ly + 16, t, "font-size:10px;fill:var(--muted);opacity:.6", 1);
    }
    x += bw(k) + 7;
  }
  h += anR(X, 382, W, 22, AN_S.blue) + anT(mid, 397, `L1 Data Cache / Shared Memory (256 KB per SM)${rec.inflight ? ` · ${rec.inflight} load${rec.inflight > 1 ? "s" : ""} in flight` : ""}`, AN_S.label, 1) +
    anR(X, 410, W, 22, AN_S.blue) + anT(mid, 425, "L2 (50 MB) and HBM3 (80 GB), shared by all 132 SMs", AN_S.label, 1);
  return h;
}

/* A sub-partition's record at cycle c, padded with "exited" once its run ends. */
const anRec = (s, c) => c < s.cycles ? s.cyc[c] : { pick: -1, ins: null, st: s.ids.map(() => ({ k: "done", i: -1 })), inflight: 0 };

/* The whole SM at cycle c: the 4 sub-partitions in a 2 × 2 grid, each a
   smaller copy of the single view, with warp chips in place of the list. */
function smSvg(a, runs, c) {
  let h = anR(0, 0, 680, 18, AN_S.blue) + anT(340, 13, "L1 Instruction Cache (shared by the 4 sub-partitions)", AN_S.label, 1);
  const order = ["int", "fp32", "fp64", "tc", "ldst", "sfu"];
  const bw = k => k === "tc" ? 30 : SUBP_UNITS[k].cols * 18 + (SUBP_UNITS[k].cols > 1 ? 6 : 12);
  let inflight = 0;
  runs.forEach((s, sp) => {
    const rec = anRec(s, c), use = (c < s.cycles && s.lanes[c]) || {};
    const px = (sp % 2) * 344, py = 26 + Math.floor(sp / 2) * 256;
    inflight += rec.inflight;
    const p = rec.ins && a.program[rec.ins.i];
    h += anR(px, py, 336, 248, AN_S.thin) + anT(px + 8, py + 15, `Sub-partition ${sp}`, "font-size:10px;font-weight:600;fill:var(--ink)") +
      anR(px + 110, py + 4, 218, 16, rec.pick >= 0 ? `fill:${anHue(rec.pick)};stroke:var(--pad)` : AN_S.orange) +
      anT(px + 219, py + 16, rec.pick >= 0 ? `Warp Scheduler: picks W${rec.pick}` : "Warp Scheduler: slot unused", rec.pick >= 0 ? AN_S.dark : AN_S.small, 1) +
      anR(px + 8, py + 24, 320, 16, AN_S.orange) +
      anT(px + 168, py + 36, p ? `Dispatch: ${p[0]}${rec.ins.mask !== AN_FULL ? ` (${anPop(rec.ins.mask)} of 32 threads)` : ""}` : "Dispatch: nothing this cycle", "font-size:9px;fill:var(--ink)", 1);
    rec.st.forEach((st, l) => {
      const id = s.ids[l], col = anHue(id), x = px + 8 + l * 20, y = py + 46;
      const look = st.k === "issue" ? `fill:${col};stroke:${col}` : st.k === "ready" ? `fill:none;stroke:${col};stroke-width:1.5`
        : st.k === "done" ? `fill:none;stroke:${col};opacity:.2` : `fill:none;stroke:${col};stroke-dasharray:2 2;opacity:.6`;
      h += anR(x, y, 18, 14, look) + anT(x + 9, y + 10, `W${id}`, `font-size:7.5px;font-weight:600;fill:${st.k === "issue" ? AN_DARK : "var(--muted)"};opacity:${st.k === "done" ? .3 : 1}`, 1);
    });
    if (!s.ids.length) h += anT(px + 8, py + 57, "no resident warps", AN_S.small);
    h += anR(px + 8, py + 66, 320, 12, AN_S.blue) + anT(px + 168, py + 75, "Register File, 64 KB", "font-size:8.5px;fill:var(--ink)", 1);
    let x = px + (336 - order.reduce((t, k) => t + bw(k), 0) - 30) / 2;
    for (const k of order) {
      const u = SUBP_UNITS[k], lu = use[k];
      h += anR(x, py + 84, bw(k), 162, lu ? `fill:var(--code-bg);stroke:${anHue(lu.w)};stroke-width:2` : AN_S.green) +
        anT(x + bw(k) / 2, py + 95, k === "tc" ? "TC" : u.name, "font-size:8.5px;font-weight:600;fill:var(--ink)", 1);
      for (let j = 0; j < u.lanes; j++) {
        const lx = x + (bw(k) - u.cols * 18 + 2) / 2 + Math.floor(j / 8) * 18, ly = py + 100 + (j % 8) * 18;
        if (!lu) { h += anR(lx, ly, 16, 16, AN_S.thin); continue; }
        const t = lu.pass * u.lanes + j, on = (lu.mask >>> t) & 1, col = anHue(lu.w);
        h += on ? anR(lx, ly, 16, 16, `fill:${col};stroke:${col}`) + anT(lx + 8, ly + 11.5, t, `font-size:8px;font-weight:700;fill:${AN_DARK}`, 1)
          : anR(lx, ly, 16, 16, `fill:none;stroke:${col};stroke-dasharray:2 2`) + anT(lx + 8, ly + 11.5, t, "font-size:8px;fill:var(--muted);opacity:.6", 1);
      }
      x += bw(k) + 6;
    }
  });
  h += anR(0, 538, 680, 20, AN_S.blue) + anT(340, 552, `L1 Data Cache / Shared Memory, 256 KB, shared by the 4 sub-partitions${inflight ? ` · ${inflight} load${inflight > 1 ? "s" : ""} in flight` : ""}`, AN_S.label, 1) +
    anR(0, 562, 680, 20, AN_S.blue) + anT(340, 576, "L2 (50 MB) and HBM3 (80 GB), shared by all 132 SMs", AN_S.label, 1);
  return h;
}

/* One row per warp, grouped by sub-partition: a tick per issue, a thin bar
   while the warp waits on memory. */
function subpStrip(runs, cycles, c) {
  const L = 30, Wd = 646, cw = Wd / cycles, n = runs.reduce((t, s) => t + s.nW, 0);
  const rh = n > 16 ? 6 : 10, gap = runs.length > 1 ? 4 : 0;
  let h = "", y = 2;
  runs.forEach((s, sp) => {
    s.ids.forEach((id, l) => {
      const col = anHue(id);
      if (rh === 10) h += anT(0, y + rh - 2, `W${id}`, "font-size:8px;fill:var(--muted)");
      else if (l === 0) h += anT(0, y + 6, `SP ${sp}`, "font-size:8px;fill:var(--muted)");
      let run = -1;
      for (let k = 0; k <= s.cycles; k++) {
        const m = k < s.cycles && s.cyc[k].st[l].k === "mem";
        if (m && run < 0) run = k;
        if (!m && run >= 0) { h += `<rect x="${L + run * cw}" y="${y + rh / 2 - 1}" width="${(k - run) * cw}" height="1.5" style="fill:${col};opacity:.5"/>`; run = -1; }
        if (k < s.cycles && s.cyc[k].pick === id) h += `<rect x="${L + k * cw}" y="${y}" width="${Math.max(cw, 1.2)}" height="${rh - 2}" style="fill:${col}"/>`;
      }
      y += rh;
    });
    if (s.nW) y += gap;
  });
  const H = y + 14;
  h += `<rect x="${L + c * cw - (cw < 2 ? .75 : 0)}" y="0" width="${Math.max(cw, 1.5)}" height="${y}" style="fill:none;stroke:var(--pad);stroke-width:1.5"/>` +
    anT(L, H - 2, "cycle 0", "font-size:8px;fill:var(--muted)") + anT(L + Wd, H - 2, `cycle ${cycles - 1}`, "font-size:8px;fill:var(--muted);text-anchor:end");
  return { h, H, L, cw };
}

function anRange(lo, hi) { return lo === hi ? `thread ${lo}` : `threads ${lo}–${hi}`; }

function subpStatus(a, runs, cycles, c) {
  let t = `<strong>Cycle ${c}:</strong> `;
  if (runs.length === 1) {
    const s = runs[0], rec = s.cyc[c];
    if (rec.pick >= 0) {
      const p = a.program[rec.ins.i], prev = c ? s.cyc[c - 1].pick : -1;
      t += `the scheduler picks <strong>W${rec.pick}</strong>${prev === rec.pick ? " again, since it is still ready" : prev >= 0 ? `, switching from W${prev},` : ""} and dispatches <code>${p[0]}</code>` +
        (p[1] === "ctrl" ? " (a branch: it uses the issue slot but no lanes)" : "") + ". ";
    } else t += "no warp can issue, so this cycle's issue slot goes unused. ";
    const use = s.lanes[c] || {};
    for (const k of Object.keys(use)) {
      const u = SUBP_UNITS[k], lu = use[k], lo = lu.pass * u.lanes, hi = lo + u.lanes - 1;
      let off = 0;
      for (let th = lo; th <= hi; th++) if (!((lu.mask >>> th) & 1)) off++;
      t += `${u.name} lanes run ${anRange(lo, hi)} of W${lu.w}${lu.passes > 1 ? ` (pass ${lu.pass + 1} of ${lu.passes})` : ""}${off ? `, ${off} masked off` : ""}. `;
    }
  } else {
    let n = 0;
    const parts = runs.map((s, sp) => {
      const rec = anRec(s, c);
      if (rec.pick < 0) return `sub-partition ${sp} issues nothing`;
      n++;
      return `sub-partition ${sp} issues <code>${anMn(a.program[rec.ins.i][0])}</code> for W${rec.pick}`;
    });
    t += n ? parts.join(", ") + `, so the SM issues ${n} of a possible 4 warp instructions this cycle.` : "no sub-partition has a ready warp, so all 4 issue slots go unused.";
  }
  const iss = runs.flatMap(s => s.cyc.filter(r => r.pick >= 0)), work = iss.filter(r => a.program[r.ins.i][1] !== "ctrl");
  const act = work.reduce((n, r) => n + anPop(r.ins.mask), 0);
  return t + `<br>Whole run: ${iss.length} warp instructions in ${cycles} cycles, ` +
    (runs.length === 1 ? `so the scheduler issued in ${Math.round(100 * iss.length / cycles)}% of cycles` : `an average of ${(iss.length / cycles).toFixed(2)} per cycle out of a peak of 4 (one per sub-partition)`) +
    (work.length ? `, and ${Math.round(100 * act / (32 * work.length))}% of thread slots did useful work (SIMT efficiency).` : ".");
}

function initAnims(root) {
  root.querySelectorAll(".anim[data-anim]").forEach(el => {
    const a = ANIMS[el.dataset.anim];
    if (!a || el.dataset.ready) return;
    el.dataset.ready = "1";
    (a.kind === "steps" ? animSteps : animCycles)(el, a);
  });
}

function animSteps(el, a) {
  const n = a.frames.length;
  el.innerHTML = `<p class="calc-title">${a.title}</p><p class="calc-intro">${a.intro}</p>
    <div class="anim-ctl"><button type="button" data-d="-1">◀ Prev</button>${a.frames.map((f, i) =>
      `<button type="button" data-i="${i}" title="${f.label}">${i + 1}</button>`).join("")}<button type="button" data-d="1">Next ▶</button></div>
    <div class="anim-fig"></div><p class="anim-cap" aria-live="polite"></p>`;
  const fig = el.querySelector(".anim-fig"), cap = el.querySelector(".anim-cap");
  let i = 0;
  const show = k => {
    i = Math.max(0, Math.min(n - 1, k));
    const f = a.frames[i];
    fig.innerHTML = `<svg viewBox="0 0 680 ${a.height}" role="img" aria-label="Step ${i + 1} of ${n}: ${f.label}" style="font-family:var(--sans)">${f.svg()}</svg>`;
    cap.innerHTML = `<strong>Step ${i + 1} of ${n}, ${f.label}.</strong> ${f.cap}`;
    el.querySelectorAll("[data-i]").forEach(b => b.setAttribute("aria-current", +b.dataset.i === i ? "step" : "false"));
    el.querySelector('[data-d="-1"]').disabled = i === 0;
    el.querySelector('[data-d="1"]').disabled = i === n - 1;
  };
  el.querySelector(".anim-ctl").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) show(b.dataset.i !== undefined ? +b.dataset.i : i + +b.dataset.d);
  });
  show(0);
}

function animCycles(el, a) {
  el.innerHTML = `<p class="calc-title">${a.title}</p><p class="calc-intro">${a.intro}</p>
    <form class="calc-form">${a.inputs.map(([id, label, val, step, min, max]) =>
      `<label><span>${label}</span><input type="number" name="${id}" value="${val}" step="${step}" min="${min}" max="${max}"></label>`).join("")}
      <label><span>View</span><select name="view"><option value="sm">Whole SM (4 sub-partitions)</option><option value="one">One sub-partition</option></select></label></form>
    <div class="anim-ctl"><button type="button" data-j="-1" title="Back to the last cycle where something changed">◀◀ Event</button><button type="button" data-d="-1">◀ Cycle</button>
      <button type="button" data-d="1">Cycle ▶</button><button type="button" data-j="1" title="Ahead to the next cycle where something changes">Event ▶▶</button>
      <label class="trace-step"><span>Cycle <strong class="anim-c">0</strong></span><input type="range" min="0" value="0" aria-label="Cycle"></label></div>
    <div class="anim-fig"></div>
    <div class="anim-strip" title="Click to jump to a cycle"></div>
    <p class="anim-cap" aria-live="polite"></p>
    <p class="trace-key">Filled lane: the thread whose operation enters that lane this cycle. Dashed lane: masked-off thread. Strip: a tick for each issue, a thin bar while the warp waits on memory. Click it to jump. Whole-SM chips: filled is issuing, solid outline is ready, dashed is waiting, faded has exited.</p>`;
  const form = el.querySelector("form"), slider = el.querySelector("input[type=range]");
  const fig = el.querySelector(".anim-fig"), strip = el.querySelector(".anim-strip"), cap = el.querySelector(".anim-cap"), cLabel = el.querySelector(".anim-c");
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  let runs = [], cycles = 1, sig = [];
  const go = c => {
    c = clamp(c, 0, cycles - 1);
    slider.value = String(c);
    cLabel.textContent = String(c);
    fig.innerHTML = runs.length > 1
      ? `<svg viewBox="0 0 680 584" role="img" aria-label="One H100 SM, all 4 sub-partitions, at cycle ${c}" style="font-family:var(--sans)">${smSvg(a, runs, c)}</svg>`
      : `<svg viewBox="0 0 680 434" role="img" aria-label="One H100 SM sub-partition at cycle ${c}" style="font-family:var(--sans)">${subpSvg(a, runs[0], c)}</svg>`;
    const st = subpStrip(runs, cycles, c);
    strip.innerHTML = `<svg viewBox="0 0 680 ${st.H}" style="font-family:var(--sans)">${st.h}</svg>`;
    strip.onclick = e => {
      const r = strip.firstChild.getBoundingClientRect();
      go(Math.floor(((e.clientX - r.left) * 680 / r.width - st.L) / st.cw));
    };
    cap.innerHTML = subpStatus(a, runs, cycles, c);
  };
  const run = () => {
    const v = { warps: a.warps };
    a.inputs.forEach(([id, , val, , min, max]) => { v[id] = clamp(Math.round(parseFloat(form[id].value)), min, max); });
    const sm = form.view.value === "sm", n = a.warps || v.warps;
    if (!sm && n > 16) { v.warps = 16; form.warps.value = "16"; }
    const ids = Array.from({ length: Math.min(n, sm ? 64 : 16) }, (_, w) => w);
    runs = sm ? [0, 1, 2, 3].map(k => subpRun(a, v, ids.filter(w => w % 4 === k))) : [subpRun(a, v, ids)];
    cycles = Math.max(...runs.map(s => s.cycles));
    slider.max = String(cycles - 1);
    sig = Array.from({ length: cycles }, (_, c) => runs.map(s => {
      const r = anRec(s, c);
      return `${r.pick}|${r.st.map(x => x.k).join()}|${Object.keys((c < s.cycles && s.lanes[c]) || {}).join()}`;
    }).join("/"));
    go(+slider.value);
  };
  const jump = d => {
    let c = +slider.value;
    if (d > 0) { do c++; while (c < cycles - 1 && sig[c] === sig[c - 1]); }
    else { if (c > 0) c--; while (c > 0 && sig[c] === sig[c - 1]) c--; }
    go(c);
  };
  el.querySelector(".anim-ctl").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.j) jump(+b.dataset.j);
    else go(+slider.value + +b.dataset.d);
  });
  slider.addEventListener("input", () => go(+slider.value));
  form.addEventListener("input", run);
  form.addEventListener("submit", e => e.preventDefault());
  run();
}
