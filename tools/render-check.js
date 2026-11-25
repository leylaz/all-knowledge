#!/usr/bin/env node
/* Renders pages in headless Edge and checks their practice problems.

   Usage:
     node tools/render-check.js sections/<file>.js          every page in that file
     node tools/render-check.js sections/<file>.js id1 id2  just those pages
     node tools/render-check.js id1 id2                     no key diff
   A page id is the part after "#/", so a region's own page is r/<region id>.

   For each page, at 1256 px and 490 px wide, it opens every answer, waits for
   MathJax, and reports per card:
     - MathJax errors (mjx-merror)
     - leftover \( or \) text that MathJax didn't typeset
     - any .math.chain > span wider than its chain (an iteration wider than
       the line)
   When a file is given, it also renders the HEAD version of that file and
   lists every card whose key (cardSnip in js/app.js) changed.

   It copies the tracked files into a temp folder and injects a probe script
   there, so the working tree is never touched. Set EDGE to the msedge.exe
   path if it isn't in the usual place. Exits 1 if anything is reported.
   Not published. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const WIDTHS = [1256, 490];

const args = process.argv.slice(2);
const file = args[0] && args[0].endsWith(".js") ? args.shift().replace(/\\/g, "/") : null;
let pages = args;
if (file && !pages.length) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  pages = [...src.matchAll(/^ {2}id: "([^"]+)"/gm)].map(m => m[1]);
  /* The first id is the region itself, whose page lives at #/r/<id>. */
  if (/^\s*section\(\{/m.test(src) && pages.length) pages[0] = "r/" + pages[0];
}
if (!pages.length) {
  console.error("usage: node tools/render-check.js [sections/<file>.js] [page-id ...]");
  process.exit(2);
}

const edge = process.env.EDGE || [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
].find(p => fs.existsSync(p));
if (!edge) { console.error("msedge.exe not found, set EDGE"); process.exit(2); }

/* Runs in the page. Writes one JSON line between @@ markers. */
const PROBE = String.raw`(async function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 150 && !(window.MathJax && MathJax.startup && MathJax.startup.promise); i++) await sleep(100);
  await MathJax.startup.promise; await sleep(500);
  document.querySelectorAll(".prob details").forEach(d => d.open = true);
  await MathJax.typesetPromise(); await sleep(300);
  const probs = [...document.querySelectorAll(".prob")].map(p => {
    const qEl = p.querySelector(".q").cloneNode(true);
    qEl.querySelectorAll(".qn, .given").forEach(el => el.remove());
    const wide = [];
    p.querySelectorAll(".math.chain").forEach(c => {
      const cw = c.clientWidth;
      c.querySelectorAll(":scope > span").forEach(s => {
        const w = s.getBoundingClientRect().width;
        if (w > cw + 0.5) wide.push(Math.round(w) + " px > " + cw + " px: " + s.textContent.slice(0, 60));
      });
    });
    return {
      key: qEl.textContent.replace(/\s+/g, " ").trim().slice(0, 160),
      errs: [...p.querySelectorAll("mjx-merror")].map(e => e.getAttribute("data-mjx-error") || e.textContent),
      raw: /\\[()]/.test(p.textContent),
      chains: p.querySelectorAll(".math.chain").length,
      wide
    };
  });
  const out = document.createElement("pre");
  out.textContent = "@@" + JSON.stringify(probs) + "@@";
  document.body.appendChild(out);
})();`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "render-check-"));
function git(...a) { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 }); }

function buildCopy(name, headFile) {
  const dir = path.join(tmp, name);
  for (const f of git("ls-files").split("\n").filter(Boolean)) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(src, path.join(dir, f));
  }
  if (headFile) fs.writeFileSync(path.join(dir, headFile), git("show", "HEAD:" + headFile));
  fs.writeFileSync(path.join(dir, "probe.js"), PROBE);
  const idx = path.join(dir, "index.html");
  fs.writeFileSync(idx, fs.readFileSync(idx, "utf8").replace("</body>", '<script src="probe.js"></script></body>'));
  return dir;
}

function render(dir, page, width) {
  const url = "file:///" + path.join(dir, "index.html").replace(/\\/g, "/") + "#/" + page;
  const html = execFileSync(edge, [
    "--headless=new", "--disable-gpu", "--no-first-run",
    "--user-data-dir=" + path.join(tmp, "profile-" + width),
    "--window-size=" + width + ",1000", "--virtual-time-budget=25000",
    "--dump-dom", url
  ], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"], timeout: 120000 });
  const m = html.match(/@@(.*)@@/s);
  if (!m) throw new Error("no probe output for " + page + " at " + width + " px");
  /* --dump-dom escapes &, <, > in the pre's text. */
  return JSON.parse(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
}

let problems = 0;
try {
  const cur = buildCopy("current", null);
  const head = file ? buildCopy("head", file) : null;
  for (const page of pages) {
    const lines = [];
    let cards = 0, chains = 0;
    for (const w of WIDTHS) {
      const probs = render(cur, page, w);
      cards = probs.length;
      chains = probs.reduce((s, p) => s + p.chains, 0);
      probs.forEach((p, i) => {
        const tag = "card " + (i + 1) + " at " + w + " px";
        p.errs.forEach(e => lines.push(tag + ": MathJax error: " + e));
        if (p.raw) lines.push(tag + ": untypeset \\( or \\) text");
        p.wide.forEach(x => lines.push(tag + ": wide iteration " + x));
      });
      if (w === WIDTHS[0] && head) {
        const old = render(head, page, w);
        if (old.length !== probs.length) lines.push("card count changed: " + old.length + " -> " + probs.length);
        else probs.forEach((p, i) => {
          if (p.key !== old[i].key) lines.push("card " + (i + 1) + ": KEY CHANGED\n    old: " + old[i].key + "\n    new: " + p.key);
        });
      }
    }
    problems += lines.length;
    console.log(page + ": " + cards + " cards, " + chains + " chains" + (lines.length ? "" : ", OK"));
    lines.forEach(l => console.log("  " + l));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(problems ? 1 : 0);
