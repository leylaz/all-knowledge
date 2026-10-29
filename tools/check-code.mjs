#!/usr/bin/env node
/* Compiles and runs every coding card on the interview pages with the same
   engine the page uses (js/crun.js). A card passes when its skeleton
   compiles and fails its checks, and its reference solution compiles
   without warnings and passes, on seeds 1 to 5 for thread problems.
   Needs Node 18 or later and, once per clone:
     npm install --no-save @yowasp/clang@21.1.4-3 binaryen@131.0.0
   Usage: node tools/check-code.mjs [text to match in a question]. Not
   published. Exits 1 on any failure. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { cEngine, SIM_H, SIM_RT } = require(path.join(ROOT, "js/crun.js"));
const dep = p => pathToFileURL(path.join(ROOT, "node_modules", p)).href;

const ctx = vm.createContext({ console, window: {} });
for (const s of ["js/site.js", "sections/interview-prep.js"])
  vm.runInContext(fs.readFileSync(path.join(ROOT, s), "utf8"), ctx, { filename: s });
const filter = process.argv[2] || "";
const name = c => c.q.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
const cards = ctx.window.INTV_CODE.filter(c => name(c).includes(filter));

let out = "", diag = "";
const eng = cEngine({ clang: dep("@yowasp/clang/gen/bundle.js"), binaryen: dep("binaryen/index.js"), simH: SIM_H, simRt: SIM_RT },
  (type, data) => { if (type === "out" || type === "err") out += data; else if (type === "diag") diag += data; });
async function exec(src, threads, seed) {
  out = ""; diag = "";
  let wasm;
  try { wasm = await eng.compile(src, threads); }
  catch (e) { return { compiled: false, diag: e.diag || String(e) }; }
  const r = await eng.run(wasm, { threads, seed });
  return { compiled: true, diag, out, status: r.status, msg: r.msg || "", ms: r.ms };
}

let bad = 0;
for (const c of cards) {
  const problems = [];
  const sk = await exec(c.skel, c.threads, 1);
  if (!sk.compiled) problems.push("skeleton doesn't compile:\n" + sk.diag);
  else if (sk.status === 0) problems.push("skeleton passes its own checks");
  const times = [];
  for (const seed of c.threads ? [1, 2, 3, 4, 5] : [1]) {
    const r = await exec(c.sol, c.threads, seed);
    if (!r.compiled) { problems.push("solution doesn't compile:\n" + r.diag); break; }
    if (r.diag) problems.push("solution has warnings:\n" + r.diag.slice(0, 1500));
    if (r.status !== 0 || !/ checks passed\n/.test(r.out) || /FAIL/.test(r.out))
      problems.push(`solution fails (seed ${seed}, status ${r.status}) ${r.msg}\n${r.out.slice(-1500)}`);
    times.push(r.ms);
    if (problems.length) break;
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name(c)} (${times.join(", ")} ms)`);
  for (const p of problems) console.log("    " + p.replace(/\n/g, "\n    "));
  if (problems.length) bad++;
}
console.log(`${cards.length - bad} of ${cards.length} coding cards pass.`);
process.exit(bad ? 1 : 0);
