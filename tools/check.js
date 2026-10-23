#!/usr/bin/env node
/* Repo checks: run `node tools/check.js` before every commit.
   Loads js/site.js, every sections/ file, and js/diagrams.js in the order
   index.html lists them, then checks links, anchors, practice problems,
   private placeholders, and the home-page grid. Exits 1 on any error. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

/* ---------- Load the site data the way the browser does ---------- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
for (const s of scripts) if (!fs.existsSync(path.join(ROOT, s))) err("index.html", `script ${s} does not exist`);
for (const dir of ["js", "sections"])
  for (const f of fs.readdirSync(path.join(ROOT, dir)))
    if (f.endsWith(".js") && !scripts.includes(`${dir}/${f}`)) err("index.html", `${dir}/${f} is never loaded`);

/* Only data files run here; js/app.js and the widget scripts need a DOM. */
const DATA = new Set(["js/site.js", "js/diagrams.js", "js/glossary.js"]);
/* Top-level consts aren't properties of the context, so copy them out. */
const EXPOSE = "\n;" + ["REGIONS", "NOTES", "GLOSSARY", "CALCS"].map(k => `if (typeof ${k} !== "undefined") globalThis.${k} = ${k};`).join(" ");
const ctx = vm.createContext({ console, window: {}, document: undefined });
for (const s of scripts) {
  if (!(DATA.has(s) || s.startsWith("sections/"))) continue;
  const code = fs.readFileSync(path.join(ROOT, s), "utf8");
  try { vm.runInContext(code + EXPOSE, ctx, { filename: s }); }
  catch (e) { err(s, `failed to load: ${e.message}`); }
}
for (const s of scripts.filter(s => !DATA.has(s) && !s.startsWith("sections/") && s.endsWith(".js"))) {
  try { new vm.Script(fs.readFileSync(path.join(ROOT, s), "utf8"), { filename: s }); }
  catch (e) { err(s, `syntax error: ${e.message}`); }
}
const REGIONS = ctx.REGIONS || [], NOTES = ctx.NOTES || [];

/* ---------- Ids ---------- */
const seen = new Map();
for (const r of REGIONS) seen.set("r/" + r.id, "region");
for (const n of NOTES) {
  if (seen.has(n.id)) err(n.id, "duplicate page id");
  seen.set(n.id, "page");
  if (!REGIONS.some(r => r.id === n.region)) err(n.id, `unknown region "${n.region}"`);
}
const byId = new Map(NOTES.map(n => [n.id, n]));
const regionById = new Map(REGIONS.map(r => [r.id, r]));

/* ---------- Anchors: every sections entry needs id="sec-<id>" in the body ---------- */
const secIds = page => new Set([...(page.sections || []).filter(s => !s.group).map(s => s.id), ...(page.practice ? ["practice"] : [])]);
function checkAnchors(where, page) {
  if (page.private) return;
  for (const s of (page.sections || []).filter(s => !s.group))
    if (!(page.body || "").includes(`id="sec-${s.id}"`)) err(where, `section "${s.id}" has no id="sec-${s.id}" in the body`);
}
REGIONS.forEach(r => checkAnchors("r/" + r.id, r));
NOTES.forEach(n => checkAnchors(n.id, n));

/* ---------- Links ---------- */
const ROUTES = new Set(["", "flagged", "drill"]);
function checkHref(where, href) {
  const parts = href.replace(/^#\/?/, "").split("/");
  if (parts.length === 1 && ROUTES.has(parts[0])) return;
  let page = null;
  if (parts[0] === "r") { page = regionById.get(parts[1]); parts.shift(); }
  else page = byId.get(parts[0]);
  if (!page) return err(where, `link ${href} points to no page`);
  if (parts[1] && !page.private && !secIds(page).has(parts[1])) err(where, `link ${href} points to no section`);
}
const hrefsIn = s => [...String(s).matchAll(/href="(#[^"]*)"/g)].map(m => m[1]);
const practiceText = p => JSON.stringify(p || "");
for (const r of REGIONS) hrefsIn(r.body + practiceText(r.practice)).forEach(h => checkHref("r/" + r.id, h));
for (const n of NOTES) hrefsIn(n.body + practiceText(n.practice) + (n.book || "")).forEach(h => checkHref(n.id, h));
for (const fn of ["pipelineSVG", "floorplanSVG", "stackHTML"]) {
  if (typeof ctx[fn] !== "function") continue;
  try { hrefsIn(ctx[fn]()).forEach(h => checkHref(`js/diagrams.js ${fn}()`, h)); }
  catch (e) { err("js/diagrams.js", `${fn}() threw: ${e.message}`); }
}
if (ctx.GLOSSARY) for (const [term, g] of Object.entries(ctx.GLOSSARY)) {
  if (!g.def) err("js/glossary.js", `"${term}" has no definition`);
  if (g.page) checkHref(`js/glossary.js "${term}"`, "#/" + g.page);
}

/* ---------- Practice problems ---------- */
for (const p of [...REGIONS.map(r => ["r/" + r.id, r]), ...NOTES.map(n => [n.id, n])]) {
  const [where, page] = p;
  if (page.private || page.region === "intv" || where === "r/intv") continue;
  const pr = page.practice;
  if (!pr || !(pr.guided || []).length || !(pr.interview || []).length) err(where, "needs Guided and Interview Level practice problems");
  else for (const x of [...pr.guided, ...pr.interview]) if (!x.q || !x.a) err(where, "a practice problem is missing its question or answer");
}

/* ---------- Private placeholders ---------- */
for (const r of REGIONS.filter(r => r.private))
  if (r.name !== "Private Section" || r.cap || r.body) err("sections/private.js", `region ${r.id} holds more than a placeholder`);
for (const n of NOTES.filter(n => n.private))
  if (n.title !== "Private Page" || n.body || (n.sections || []).length || Object.keys(n.practice || {}).length)
    err("sections/private.js", `page ${n.id} holds more than a placeholder`);

/* ---------- Home-page grid: every region has a cell, desktop and mobile ---------- */
const areas = [...html.matchAll(/grid-template-areas:([^;]+);/g)].map(m => new Set(m[1].match(/[a-z0-9]+/gi)));
if (areas.length < 2) err("index.html", "expected desktop and mobile grid-template-areas");
areas.forEach((set, i) => {
  for (const r of REGIONS) if (!set.has(r.id)) err("index.html", `grid ${i} has no cell for region "${r.id}"`);
  for (const a of set) if (!regionById.has(a)) err("index.html", `grid ${i} has a cell "${a}" with no region`);
});

/* ---------- Titles in title case (first letter of each major word) ---------- */
const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs.", "with", "from", "into", "per", "via"]);
const titleCaseOk = t => t.split(/\s+/).every((w, i) => i === 0 || SMALL.has(w) || !/^[a-z]/.test(w));
for (const r of REGIONS) if (!titleCaseOk(r.name)) err("r/" + r.id, `name "${r.name}" is not in title case`);
for (const n of NOTES) if (!titleCaseOk(n.title)) err(n.id, `title "${n.title}" is not in title case`);

if (errors.length) { console.error(errors.map(e => "  " + e).join("\n") + `\n${errors.length} problem(s).`); process.exit(1); }
console.log(`OK: ${REGIONS.length} regions, ${NOTES.length} pages.`);
