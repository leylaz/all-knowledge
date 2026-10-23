/* Pipeline trace viewer. A body places one with
   <div class="trace" data-trace="name"></div>; initTraces() runs a tiny
   cycle-level model of TRACES[name] and draws a Konata-style chart: one
   row per instruction, one column per cycle, with a slider to step
   through cycles. Nothing here touches the DOM until initTraces() runs,
   so tools/check.js can load this file. */

/* Program: [text, sources (instruction numbers), latency, kind].
   kind "miss" uses the miss-latency input instead of a fixed latency. */
const TRACES = {
  "rob-fill": {
    title: "Trace: One Miss Fills the ROB",
    intro: "A 2-wide out-of-order core (rename, issue, and retire 2 per cycle). I0 misses; everything else hits. Watch the ROB fill behind it and rename stall, while independent work still issues.",
    program: [
      ["ld   r1, [r9]", [], 0, "miss"],
      ["add  r2, r1, 1", [0], 1],
      ["add  r3, r4, 1", [], 1],
      ["mul  r5, r3, r3", [2], 3],
      ["ld   r6, [r8]", [], 5],
      ["add  r7, r6, r2", [4, 1], 1],
      ["add  r10, r10, 1", [], 1],
      ["add  r11, r11, 1", [], 1],
      ["sub  r12, r10, r11", [6, 7], 1],
      ["add  r13, r12, r5", [8, 3], 1],
      ["add  r14, r14, 1", [], 1],
      ["add  r15, r15, 1", [], 1],
      ["add  r16, r14, r15", [10, 11], 1],
      ["add  r17, r17, 1", [], 1]
    ],
    inputs: [["miss", "Miss latency (cycles)", 24, 1, 1, 80], ["rob", "ROB entries", 8, 1, 2, 16]]
  }
};
const TRACE_WIDTH = 2;

/* Cycle-driven model. Front end delivers instruction k to rename no earlier
   than cycle floor(k / W) + 2 (fetch, then decode). Each cycle: retire the
   oldest completed instructions in order, issue the oldest ready ones, then
   rename into the ROB if it has room (entries free the cycle after retire). */
function traceRun(t, miss, robSize) {
  const P = t.program, n = P.length, W = TRACE_WIDTH;
  const lat = P.map(p => p[3] === "miss" ? miss : p[2]);
  const r = Array(n).fill(-1), iss = Array(n).fill(-1), done = Array(n).fill(Infinity), ret = Array(n).fill(-1);
  const robAt = [], stall = [];
  let nextRen = 0, nextRet = 0, retiredBefore = 0;
  for (let c = 0; nextRet < n && c < 1000; c++) {
    let k = 0;
    while (k < W && nextRet < n && r[nextRet] >= 0 && done[nextRet] <= c) { ret[nextRet++] = c; k++; }
    k = 0;
    for (let i = 0; i < nextRen && k < W; i++)
      if (iss[i] < 0 && r[i] < c && P[i][1].every(s => done[s] <= c)) { iss[i] = c; done[i] = c + lat[i]; k++; }
    const inRob = nextRen - retiredBefore;
    k = 0;
    while (k < W && nextRen < n && Math.floor(nextRen / W) + 2 <= c && nextRen - retiredBefore < robSize) { r[nextRen++] = c; k++; }
    stall[c] = nextRen < n && Math.floor(nextRen / W) + 2 <= c && k < W && nextRen - retiredBefore >= robSize;
    robAt[c] = inRob;
    retiredBefore = nextRet;
  }
  return { r, iss, done, ret, lat, robAt, stall, cycles: Math.max(...ret) + 1 };
}

function traceCell(s, i, c) {
  const { r, iss, done, ret } = s;
  if (c === r[i] - 2) return ["F", "f"];
  if (c === r[i] - 1) return ["D", "f"];
  if (c === r[i]) return ["R", "r"];
  if (c > r[i] && c < iss[i]) return ["·", "w"];
  if (c >= iss[i] && c < done[i]) return [c === iss[i] ? "I" : (s.lat[i] > 6 ? "M" : "X"), s.lat[i] > 6 ? "m" : "x"];
  if (c >= done[i] && c < ret[i]) return ["–", "d"];
  if (c === ret[i]) return ["C", "c"];
  return ["", ""];
}

function initTraces(root) {
  root.querySelectorAll(".trace[data-trace]").forEach(el => {
    const t = TRACES[el.dataset.trace];
    if (!t || el.dataset.ready) return;
    el.dataset.ready = "1";
    el.innerHTML = `<p class="calc-title">${t.title}</p><p class="calc-intro">${t.intro}</p>
      <form class="calc-form">${t.inputs.map(([id, label, val, step, min, max]) =>
        `<label><span>${label}</span><input type="number" name="${id}" value="${val}" step="${step}" min="${min}" max="${max}"></label>`).join("")}</form>
      <label class="trace-step"><span>Cycle <strong class="trace-c">0</strong></span><input type="range" min="0" value="0" aria-label="Cycle"></label>
      <p class="trace-status" aria-live="polite"></p>
      <div class="trace-scroll"></div>
      <p class="trace-key"><b class="f">F</b> fetch <b class="f">D</b> decode <b class="r">R</b> rename <b class="w">·</b> waiting for operands <b class="x">I</b>/<b class="x">X</b> issue, execute <b class="m">M</b> miss outstanding <b class="d">–</b> done, waiting to retire <b class="c">C</b> retire</p>`;
    const form = el.querySelector("form"), slider = el.querySelector("input[type=range]");
    const grid = el.querySelector(".trace-scroll"), status = el.querySelector(".trace-status"), cLabel = el.querySelector(".trace-c");
    let s = null;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
    const draw = () => {
      const v = {};
      t.inputs.forEach(([id, , val, , min, max]) => { v[id] = clamp(Math.round(parseFloat(form[id].value)), min, max); });
      s = traceRun(t, v.miss, v.rob);
      slider.max = String(s.cycles - 1);
      if (+slider.value > s.cycles - 1) slider.value = String(s.cycles - 1);
      let h = `<table><tr><th>#</th><th>Instruction</th>${Array.from({ length: s.cycles }, (_, c) => `<th data-c="${c}">${c}</th>`).join("")}</tr>`;
      t.program.forEach((p, i) => {
        h += `<tr><td>I${i}</td><td><code>${p[0]}</code></td>`;
        for (let c = 0; c < s.cycles; c++) { const [txt, cls] = traceCell(s, i, c); h += `<td class="${cls}" data-c="${c}">${txt}</td>`; }
        h += "</tr>";
      });
      grid.innerHTML = h + "</table>";
      step();
    };
    const step = () => {
      const c = +slider.value;
      cLabel.textContent = String(c);
      grid.querySelectorAll(".now").forEach(x => x.classList.remove("now"));
      grid.querySelectorAll(`[data-c="${c}"]`).forEach(x => x.classList.add("now"));
      const ren = s.r.map((x, i) => x === c ? "I" + i : "").filter(Boolean);
      const iss = s.iss.map((x, i) => x === c ? "I" + i : "").filter(Boolean);
      const ret = s.ret.map((x, i) => x === c ? "I" + i : "").filter(Boolean);
      status.innerHTML = `ROB holds <strong>${s.robAt[c] || 0}</strong> of ${form.rob.value}. ` +
        `Rename: ${ren.length ? ren.join(", ") : s.stall[c] ? "<strong>stalled, ROB full</strong>" : "nothing"}. ` +
        `Issue: ${iss.join(", ") || "nothing"}. Retire: ${ret.join(", ") || "nothing"}.`;
    };
    form.addEventListener("input", draw);
    form.addEventListener("submit", e => e.preventDefault());
    slider.addEventListener("input", step);
    draw();
  });
}
