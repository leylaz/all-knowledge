#!/usr/bin/env node
/* Packs the compiler's binaries for the artifact: gzips them and splits
   them under the artifact's 15 MB per-file limit into vendor/cc/, which
   publishes as cc/ (js/crun.js reads them there). Needs the npm install
   from tools/check-code.mjs. Run it, and publish vendor/cc/, only when the
   Clang version in js/crun.js changes. vendor/ is not committed. */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(ROOT, "node_modules/@yowasp/clang/gen"), OUT = path.join(ROOT, "vendor/cc");
const want = fs.readFileSync(path.join(ROOT, "js/crun.js"), "utf8").match(/@yowasp\/clang@([^/]+)\//)[1];
const have = JSON.parse(fs.readFileSync(path.join(GEN, "../package.json"), "utf8")).version;
if (want !== have) { console.error(`js/crun.js uses Clang ${want} but node_modules has ${have}.`); process.exit(1); }
const LIMIT = 14 * 1024 * 1024;
const FILES = { "llvm.core.wasm": "core", "llvm.core2.wasm": "core2", "llvm.core3.wasm": "core3", "llvm.core4.wasm": "core4", "llvm-resources.tar": "res" };
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [src, base] of Object.entries(FILES)) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(GEN, src)), { level: 9 });
  const n = Math.ceil(gz.length / LIMIT);
  for (let i = 0; i < n; i++) {
    const name = n > 1 ? `${base}-${i}.bin` : `${base}.bin`, part = gz.subarray(Math.floor(i * gz.length / n), Math.floor((i + 1) * gz.length / n));
    fs.writeFileSync(path.join(OUT, name), part);
    console.log(name, part.length);
  }
}
