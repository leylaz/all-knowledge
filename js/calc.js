/* Interactive calculators. A page body places one with
   <div class="calc" data-calc="name"></div>; initCalcs() builds a form of
   number inputs from CALCS[name].inputs and redraws CALCS[name].run(v) on
   every change. run() returns HTML. Nothing here touches the DOM until
   initCalcs() is called, so tools/check.js can load this file. */
const fmt = (x, d = 2) => !isFinite(x) ? "∞" : Number(x).toLocaleString("en-US", { maximumFractionDigits: d });

/* Rows of [name, value, note]; the largest value is marked as the bottleneck. */
function boundTable(rows, unit) {
  const max = Math.max(...rows.map(r => r[1]));
  return `<table><tr><th>Bound</th><th>${unit}</th><th>From</th></tr>${rows.map(([name, v, note]) =>
    `<tr class="${v === max && max > 0 ? "hot" : ""}"><td>${name}</td><td>${fmt(v)}</td><td>${note}</td></tr>`).join("")}</table>`;
}

/* Float formats for the encoder: exponent bits, fraction bits, and what the
   all-ones exponent means ("ieee": ∞ and NaN, "e4m3": one NaN pattern per
   sign, "fn": finite numbers only). */
const FP_FORMATS = {
  fp64: { name: "FP64", e: 11, f: 52, kind: "ieee" },
  fp32: { name: "FP32", e: 8, f: 23, kind: "ieee" },
  tf32: { name: "TF32", e: 8, f: 10, kind: "ieee" },
  fp16: { name: "FP16", e: 5, f: 10, kind: "ieee" },
  bf16: { name: "BF16", e: 8, f: 7, kind: "ieee" },
  e5m2: { name: "FP8 E5M2", e: 5, f: 2, kind: "ieee" },
  e4m3: { name: "FP8 E4M3", e: 4, f: 3, kind: "e4m3" },
  e3m2: { name: "FP6 E3M2", e: 3, f: 2, kind: "fn" },
  e2m3: { name: "FP6 E2M3", e: 2, f: 3, kind: "fn" },
  e2m1: { name: "FP4 E2M1", e: 2, f: 1, kind: "fn" }
};
const pow2 = k => Math.pow(2, k);
function fpInfo(F) {
  const bias = pow2(F.e - 1) - 1, top = pow2(F.e) - 1;
  const emax = (F.kind === "ieee" ? top - 1 : top) - bias;
  const maxM = F.kind === "e4m3" ? pow2(F.f) - 2 : pow2(F.f) - 1;
  return { bias, top, emin: 1 - bias, emax, maxM, max: (1 + maxM / pow2(F.f)) * pow2(emax) };
}
/* Round to nearest integer, ties to even. q is small enough to be exact. */
function rne(q) {
  const i = Math.floor(q), d = q - i;
  return d > 0.5 || (d === 0.5 && i % 2 === 1) ? i + 1 : i;
}
/* Value of the fields { s, E, M } (M is the stored fraction as an integer). */
function fpValue({ s, E, M }, F) {
  const I = fpInfo(F);
  if (F.kind === "ieee" && E === I.top) return M ? NaN : s ? -Infinity : Infinity;
  if (F.kind === "e4m3" && E === I.top && M === pow2(F.f) - 1) return NaN;
  const v = E === 0 ? M * pow2(I.emin - F.f) : (pow2(F.f) + M) * pow2(E - I.bias - F.f);
  return s ? -v : v;
}
/* Round x into format F. Returns the fields, plus over: true if it overflowed. */
function fpEncode(x, F) {
  const I = fpInfo(F), s = x < 0 || Object.is(x, -0) ? 1 : 0, a = Math.abs(x);
  const sat = { s, E: I.emax + I.bias, M: I.maxM, over: true };
  if (Number.isNaN(x)) return F.kind === "fn" ? null : { s: 0, E: I.top, M: F.kind === "e4m3" ? pow2(F.f) - 1 : pow2(F.f - 1) };
  if (a === Infinity) return F.kind === "ieee" ? { s, E: I.top, M: 0 } : sat;
  if (a === 0) return { s, E: 0, M: 0 };
  let k = Math.floor(Math.log2(a));
  while (pow2(k) > a) k--;
  while (pow2(k + 1) <= a) k++;
  let E, M;
  if (k < I.emin) {
    M = rne(a / pow2(I.emin - F.f));
    E = M >= pow2(F.f) ? 1 : 0;
    if (E) M -= pow2(F.f);
  } else {
    M = rne(a / pow2(k - F.f));
    if (M >= pow2(F.f + 1)) { k++; M /= 2; }
    E = k + I.bias;
    M -= pow2(F.f);
  }
  if (E > I.emax + I.bias || (E === I.emax + I.bias && M > I.maxM))
    return F.kind === "ieee" ? { s, E: I.top, M: 0, over: true } : sat;
  return { s, E, M };
}
function fpNum(v) {
  if (Number.isNaN(v)) return "NaN";
  if (!isFinite(v)) return v > 0 ? "+∞" : "−∞";
  if (v === 0) return Object.is(v, -0) ? "−0" : "0";
  const [m, e] = String(v).split("e");
  return m.replace("-", "−") + (e ? ` × 10<sup>${String(+e).replace("-", "−")}</sup>` : "");
}
const fpEsc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CALCS = {
  bounds: {
    title: "Loop Bounds Calculator",
    intro: "Per-iteration counts for one loop, and the machine it runs on. Defaults: a 12-micro-op loop on a Golden Cove-like core.",
    inputs: [
      ["Loop, per iteration", [
        ["nu", "Micro-ops N<sub>u</sub> (fused)", 12, 1],
        ["nld", "Loads N<sub>ld</sub>", 3, 1],
        ["nst", "Stores N<sub>st</sub>", 1, 1],
        ["nbr", "Branches N<sub>br</sub>", 1, 1],
        ["ntk", "Taken branches N<sub>tk</sub>", 1, 1],
        ["ldep", "Loop-carried path ΣL (cycles)", 1, 1]
      ]],
      ["Events", [
        ["mbr", "Mispredicts per branch m<sub>br</sub>", 0.01, 0.005],
        ["mpen", "Mispredict penalty (cycles)", 17, 1],
        ["ml1", "L1 misses per load m<sub>L1</sub>", 0.05, 0.01],
        ["lbelow", "Miss latency L<sub>below</sub> (cycles)", 16, 1]
      ]],
      ["Machine", [
        ["wren", "Rename width W<sub>ren</sub>", 6, 1],
        ["pld", "Load ports P<sub>ld</sub>", 3, 1],
        ["pst", "Store ports P<sub>st</sub>", 2, 1],
        ["ttk", "Taken branches per cycle T<sub>tk</sub>", 1, 1],
        ["crob", "ROB entries C<sub>ROB</sub>", 512, 16],
        ["cmshr", "L1 MSHRs C<sub>MSHR</sub>", 16, 1]
      ]]
    ],
    run(v) {
      const misses = v.nld * v.ml1;
      /* Misses overlap only if the ROB holds at least one per window; otherwise
         each miss stalls for whatever latency the window can't cover. */
      const perWindow = misses * v.crob / v.nu;
      const overlap = perWindow >= 1;
      const rows = [
        ["Rename", v.nu / v.wren, "N<sub>u</sub> / W<sub>ren</sub>"],
        ["Load ports", v.nld / v.pld, "N<sub>ld</sub> / P<sub>ld</sub>"],
        ["Store ports", v.nst / v.pst, "N<sub>st</sub> / P<sub>st</sub>"],
        ["Taken branches", v.ntk / v.ttk, "N<sub>tk</sub> / T<sub>tk</sub>"],
        ["Loop-carried dependency", v.ldep, "ΣL"],
        ["L1 MSHRs", misses * v.lbelow / v.cmshr, "N<sub>ld</sub> m<sub>L1</sub> L<sub>below</sub> / C<sub>MSHR</sub>"],
        ["ROB (overlapping misses)", overlap ? v.nu * v.lbelow / v.crob : 0, overlap ? "N<sub>u</sub> L<sub>below</sub> / C<sub>ROB</sub>" : "Misses too rare to overlap; see the penalty below"]
      ];
      const tmax = Math.max(...rows.map(r => r[1]));
      const tmp = v.nbr * v.mbr * v.mpen;
      const tiso = overlap ? 0 : misses * Math.max(0, v.lbelow - v.crob / v.wren);
      const t = tmax + tmp + tiso;
      const top = rows.find(r => r[1] === tmax)[0];
      return boundTable(rows, "Cycles / iteration") +
        `<p><strong>Serialized penalties:</strong> mispredicts N<sub>br</sub> m<sub>br</sub> × penalty = ${fmt(tmp)}${overlap ? "" : `; isolated misses N<sub>ld</sub> m<sub>L1</sub> × (L<sub>below</sub> − C<sub>ROB</sub> / W<sub>ren</sub>) = ${fmt(tiso)}`} cycles/iteration.</p>` +
        `<p class="calc-out">T ≈ ${fmt(tmax)} + ${fmt(tmp + tiso)} = <strong>${fmt(t)} cycles/iteration</strong>, ${fmt(v.nu / t)} micro-ops per cycle. Bottleneck: <strong>${top}</strong>${tmp + tiso > tmax ? ", though the serialized penalties cost more" : ""}.</p>`;
    }
  },

  amat: {
    title: "AMAT Calculator",
    intro: "Hit times in cycles and local miss rates (misses at that level ÷ accesses reaching it). Defaults: Zen 4-like latencies at 5 GHz with illustrative miss rates.",
    inputs: [
      ["Hit time (cycles)", [["h0", "L1", 4, 1], ["h1", "L2", 14, 1], ["h2", "L3", 50, 1], ["mem", "DRAM", 400, 10]]],
      ["Local miss rate", [["m0", "L1", 0.05, 0.01], ["m1", "L2", 0.3, 0.05], ["m2", "L3", 0.4, 0.05]]]
    ],
    run(v) {
      const p2 = v.h2 + v.m2 * v.mem, p1 = v.h1 + v.m1 * p2, amat = v.h0 + v.m0 * p1;
      const reach = [1, v.m0, v.m0 * v.m1, v.m0 * v.m1 * v.m2];
      const parts = [["L1", v.h0], ["L2", reach[1] * v.h1], ["L3", reach[2] * v.h2], ["DRAM", reach[3] * v.mem]];
      return `<table><tr><th>Level</th><th>Accesses reaching it</th><th>Cycles it adds per access</th><th>Share of AMAT</th></tr>${parts.map(([name, c], i) =>
        `<tr><td>${name}</td><td>${fmt(reach[i] * 100, 3)}%</td><td>${fmt(c, 3)}</td><td>${fmt(c / amat * 100, 1)}%</td></tr>`).join("")}</table>
        <p>Miss penalty seen from L2 = ${fmt(v.h2)} + ${fmt(v.m2)} × ${fmt(v.mem)} = ${fmt(p2)}; from L1 = ${fmt(v.h1)} + ${fmt(v.m1)} × ${fmt(p2)} = ${fmt(p1)}.</p>
        <p class="calc-out">AMAT = ${fmt(v.h0)} + ${fmt(v.m0)} × ${fmt(p1)} = <strong>${fmt(amat)} cycles</strong>. Global DRAM miss rate: ${fmt(reach[3] * 1000, 3)} per thousand accesses.</p>`;
    }
  },

  little: {
    title: "Little's Law: Misses in Flight",
    intro: "How many outstanding misses a bandwidth target needs, and what bandwidth a given number of miss buffers allows. Defaults: one core streaming from DDR5 with Golden Cove's 16 L1 fill buffers.",
    inputs: [
      ["Target", [["bw", "Bandwidth (GB/s)", 30, 1], ["lat", "Miss latency (ns)", 80, 5], ["line", "Line size (bytes)", 64, 64]]],
      ["Hardware", [["mshr", "Outstanding misses allowed", 16, 1]]]
    ],
    run(v) {
      const need = v.bw * v.lat / v.line;           /* GB/s × ns = bytes */
      const get = v.mshr * v.line / v.lat;            /* bytes per ns = GB/s */
      return `<p>Lines in flight = bandwidth × latency / line size = ${fmt(v.bw)} GB/s × ${fmt(v.lat)} ns / ${fmt(v.line)} B = <strong>${fmt(need, 1)}</strong>.</p>
        <p>With ${fmt(v.mshr)} outstanding misses: bandwidth ≤ ${fmt(v.mshr)} × ${fmt(v.line)} B / ${fmt(v.lat)} ns = <strong>${fmt(get, 1)} GB/s</strong>.</p>
        <p class="calc-out">${need <= v.mshr ? `Enough: the target needs ${fmt(need, 1)} of ${fmt(v.mshr)} buffers.` : `Short by ${fmt(need - v.mshr, 1)} buffers: the core tops out at ${fmt(get, 1)} GB/s, ${fmt(get / v.bw * 100, 0)}% of the target. Prefetching into L2, which tracks more misses, is how real cores get past this.`}</p>`;
    }
  },

  float: {
    title: "Float Encoder and Decoder",
    intro: "Type a decimal value to see how a format rounds and stores it, or a bit pattern starting with 0x or 0b to decode it. Rounding is to nearest, ties to even. Errors are measured against your input as an FP64 number, so FP64 always shows as exact. The OCP formats (E4M3, FP6, FP4) saturate instead of overflowing.",
    inputs: [["Input", [
      ["fmt", "Format", "fp32", null, Object.entries(FP_FORMATS).map(([k, F]) => [k, F.name])],
      ["x", "Value or bits", "-6.5", null, "text"]
    ]]],
    run(v) {
      const F = FP_FORMATS[v.fmt] || FP_FORMATS.fp32, I = fpInfo(F), w = 1 + F.e + F.f;
      const t = v.x.trim().replace(/−/g, "-"), l = t.toLowerCase().replace(/^\+/, "");
      let r, x = null;
      if (/^0[xb]/.test(l)) {
        let b;
        try { b = BigInt(l); } catch (e) { return "<p>That isn’t a valid bit pattern.</p>"; }
        if (b >= 1n << BigInt(w)) return `<p>${F.name} has only ${w} bits, so the pattern must be below 0x${(1n << BigInt(w)).toString(16).toUpperCase()}.</p>`;
        r = { s: Number(b >> BigInt(F.e + F.f)), E: Number((b >> BigInt(F.f)) & BigInt(I.top)), M: Number(b & ((1n << BigInt(F.f)) - 1n)) };
      } else {
        x = /^(inf|infinity)$/.test(l) ? Infinity : /^-(inf|infinity)$/.test(l) ? -Infinity : l === "nan" ? NaN : t === "" ? NaN : Number(t);
        if (Number.isNaN(x) && l !== "nan") return "<p>Enter a decimal number (such as -6.5, 1e-6, inf, or nan) or a bit pattern (such as 0xC0D00000).</p>";
        r = fpEncode(x, F);
        if (!r) return `<p>${F.name} has no NaN encoding: every bit pattern is a finite number.</p>`;
      }
      const val = fpValue(r, F);
      const bits = (BigInt(r.s) << BigInt(F.e + F.f)) | (BigInt(r.E) << BigInt(F.f)) | BigInt(r.M);
      const bin = (n, len) => n.toString(2).padStart(len, "0");
      const hex = "0x" + bits.toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0");
      const cls = Number.isNaN(val) ? "NaN" : !isFinite(val) ? "infinity" : val === 0 ? "zero" : r.E === 0 ? "subnormal" : "normal";
      const ulp = r.E === 0 ? pow2(I.emin - F.f) : pow2(r.E - I.bias - F.f);
      const expTxt = cls === "normal" ? `${r.E} − ${I.bias} = ${r.E - I.bias}` : r.E === 0 ? `0: read as 1 − ${I.bias} = ${I.emin}, hidden bit 0` : "All ones: special value";
      const fracTxt = isFinite(val) ? `Significand ${r.E ? 1 : 0}.F = ${fpNum((r.E ? 1 : 0) + r.M / pow2(F.f))}` : Number.isNaN(val) ? "Nonzero: NaN" : "Zero: infinity";
      let out = `<table><tr><th>Field</th><th>Bits</th><th>Meaning</th></tr>
        <tr><td>Sign</td><td><code>${r.s}</code></td><td>${r.s ? "Negative" : "Positive"}</td></tr>
        <tr><td>Exponent (${F.e} bits)</td><td><code>${bin(r.E, F.e)}</code></td><td>${expTxt}</td></tr>
        <tr><td>Fraction (${F.f} bits)</td><td><code>${bin(r.M, F.f)}</code></td><td>${fracTxt}</td></tr></table>
        <p>Bits <code>${r.s} | ${bin(r.E, F.e)} | ${bin(r.M, F.f)}</code> = <code>${hex}</code>, a ${cls} number.${isFinite(val) ? ` Neighbors here are ${fpNum(ulp)} apart (1 ULP).` : ""}</p>
        <p>${F.name} range: max ${fpNum(+I.max.toPrecision(4))}, min normal ${fpNum(+pow2(I.emin).toPrecision(4))}, min subnormal ${fpNum(+pow2(I.emin - F.f).toPrecision(4))}, with ${F.f + 1} bits of precision.</p>`;
      if (x === null) return out + `<p class="calc-out"><code>${fpEsc(t)}</code> decodes to <strong>${fpNum(val)}</strong>.</p>`;
      if (r.over) return out + `<p class="calc-out">${fpNum(x)} is beyond ${F.name}’s max of ${fpNum(I.max)}, so it ${F.kind === "ieee" ? "overflows to" : "saturates to"} <strong>${fpNum(val)}</strong>.</p>`;
      if (Number.isNaN(x)) return out + `<p class="calc-out">NaN is stored as <code>${hex}</code>.</p>`;
      const err = Math.abs(val - x);
      return out + `<p class="calc-out">${fpNum(x)} is stored as <strong>${fpNum(val)}</strong>${err === 0 || !isFinite(x) ? ", exactly." : `, off by ${fpNum(+err.toPrecision(3))} (relative error ${fpNum(+(err / Math.abs(x)).toPrecision(3))}).`}</p>`;
    }
  },

  yield: {
    title: "Die Cost Calculator",
    intro: "Dies per wafer, Poisson yield, and cost per good die, using the formulas above. Defaults match the worked example.",
    inputs: [
      ["Wafer", [["d", "Diameter (mm)", 300, 50], ["cost", "Wafer cost ($)", 17000, 500], ["d0", "Defects per cm² D<sub>0</sub>", 0.1, 0.01]]],
      ["Die", [["area", "Die area (mm²)", 100, 5]]]
    ],
    run(v) {
      const dies = Math.floor(Math.PI * (v.d / 2) ** 2 / v.area - Math.PI * v.d / Math.sqrt(2 * v.area));
      const y = Math.exp(-(v.area / 100) * v.d0), good = Math.floor(dies * y);
      return `<p>Dies per wafer ≈ π × ${fmt(v.d / 2)}² / ${fmt(v.area)} − π × ${fmt(v.d)} / √(2 × ${fmt(v.area)}) ≈ <strong>${fmt(Math.max(dies, 0), 0)}</strong>.</p>
        <p>Yield = e<sup>−${fmt(v.area / 100, 3)} × ${fmt(v.d0)}</sup> = <strong>${fmt(y * 100, 1)}%</strong>, so about ${fmt(Math.max(good, 0), 0)} good dies.</p>
        <p class="calc-out">${good > 0 ? `Cost per good die ≈ $${fmt(v.cost)} / ${fmt(good, 0)} = <strong>$${fmt(v.cost / good)}</strong>, before test and packaging.` : "No good dies: the die is too large for this wafer or defect density."}</p>`;
    }
  }
};

/* One input: [id, label, default, step] is a number box, a fifth element
   "text" makes a text box, and a list of [value, label] makes a menu. */
function calcField([id, label, val, step, kind]) {
  if (Array.isArray(kind))
    return `<label><span>${label}</span><select name="${id}">${kind.map(([k, t]) => `<option value="${k}"${k === val ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
  if (kind === "text")
    return `<label><span>${label}</span><input type="text" name="${id}" value="${val}" spellcheck="false" autocomplete="off"></label>`;
  return `<label><span>${label}</span><input type="number" name="${id}" value="${val}" step="${step}" min="0" inputmode="decimal"></label>`;
}

function initCalcs(root) {
  root.querySelectorAll(".calc[data-calc]").forEach(el => {
    const c = CALCS[el.dataset.calc];
    if (!c || el.dataset.ready) return;
    el.dataset.ready = "1";
    el.innerHTML = `<p class="calc-title">${c.title}</p>${c.intro ? `<p class="calc-intro">${c.intro}</p>` : ""}
      <form class="calc-form">${c.inputs.map(([group, list]) => `<fieldset><legend>${group}</legend>${list.map(calcField).join("")}</fieldset>`).join("")}</form>
      <div class="calc-result" aria-live="polite"></div>`;
    const form = el.querySelector("form"), out = el.querySelector(".calc-result");
    const draw = () => {
      const v = {};
      for (const inp of form.elements) if (inp.name) v[inp.name] = inp.type === "number" ? parseFloat(inp.value) : inp.value;
      if (Object.values(v).some(x => typeof x === "number" && (!isFinite(x) || x < 0))) { out.innerHTML = "<p>Enter a non-negative number in every box.</p>"; return; }
      try { out.innerHTML = c.run(v); } catch (e) { out.innerHTML = "<p>Those inputs can't be computed.</p>"; console.error("Calculator " + el.dataset.calc + " failed:", e); }
    };
    form.addEventListener("input", draw);
    form.addEventListener("change", draw);
    form.addEventListener("submit", e => e.preventDefault());
    draw();
  });
}
