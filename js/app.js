/* Rendering, routing, search, and private pages. No note content lives here. */
let PRIVATE_CHECKED = false, PRIVATE_OK = false, PRIVATE_UID = null, PRIVATE_DB = null;
function visibleNotes() { return NOTES.filter(n => !n.private || PRIVATE_OK); }
function visibleRegions() { return REGIONS.filter(r => !r.private || PRIVATE_OK); }
async function checkPrivate() {
  try {
    if (!window.claude || !window.claude.use) return;
    const user = await window.claude.use("user");
    if (!user) return;
    const owner = await user.isOwner();
    const uid = await user.id();
    if (!owner || !uid) return;
    const db = await window.claude.use("db");
    if (!db) return;
    PRIVATE_UID = uid; PRIVATE_DB = db; PRIVATE_OK = true;
    await loadDbFlags();
    try {
      const meta = await db.doc("data/users/" + uid + "/p-meta").get();
      const m = meta.exists ? (meta.data() || {}) : {};
      for (const r of REGIONS) if (m.regions && m.regions[r.id]) Object.assign(r, m.regions[r.id]);
      for (const n of NOTES) if (m.notes && m.notes[n.id]) Object.assign(n, m.notes[n.id]);
    } catch (e) { console.error("Private titles failed to load; keeping placeholders:", e); }
  } catch (e) { console.error("Private access check failed; showing public pages only:", e); }
  finally { PRIVATE_CHECKED = true; if (typeof route === "function") route(); }
}
async function loadPrivate(n, sec, hashKey) {
  const box = document.getElementById("privbody");
  if (!box || !PRIVATE_CHECKED) return;
  if (!PRIVATE_OK) { box.innerHTML = "<p>This page is private.</p>"; return; }
  try {
    const snap = await PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + n.id).get();
    if (location.hash.replace(/^#\/?/, "").split("/").slice(0, hashKey ? 2 : 1).join("/") !== (hashKey || n.id)) return;
    const el = document.getElementById("privbody");
    if (!el) return;
    if (!snap.exists) { el.innerHTML = "<p>No content has been saved for this page yet.</p>"; return; }
    const d = snap.data() || {};
    el.innerHTML = '<div class="body">' + (d.body || "") + "</div>" + practiceHTML(d.practice);
    typesetMath();
    if (sec) goToSection(sec);
  } catch (e) {
    console.error("Private page " + n.id + " failed to load:", e);
    const el = document.getElementById("privbody");
    if (el) el.innerHTML = "<p>This page couldn't be loaded.</p>";
  }
}

/* ---------- Math (MathJax, loaded async from index.html) ---------- */
function typesetMath() {
  const M = window.MathJax;
  if (!M || !M.typesetPromise) return;
  const root = document.getElementById("app");
  try { if (M.typesetClear) M.typesetClear([root]); } catch (e) { console.error("MathJax typesetClear failed:", e); }
  M.typesetPromise([root]).catch(e => console.error("MathJax typeset failed:", e));
}
window.typesetMath = typesetMath;

/* ---------- Rendering ---------- */
const app = document.getElementById("app");
const q = document.getElementById("q");
const menuBtn = document.getElementById("menuBtn");
const strip = s => s.replace(/<[^>]+>/g, " ");
const text = n => (n.title + " " + strip(n.body) + " " + JSON.stringify(n.practice || "")).toLowerCase();

function renderHome() {
  menuBtn.classList.remove("show");
  app.innerHTML = `
  <div class="wrap">
    <section class="intro">
      <h1>All Knowledge</h1>
      <p>From transistors to workloads, laid out like a die.</p>
    </section>
    <section class="results" id="results" aria-live="polite" hidden></section>
    ${typeof floorplanSVG === "function" ? floorplanSVG() : ""}
    <div class="die"><div class="floor">
      ${visibleRegions().map(r => `
        <section class="block" style="grid-area:${r.id}" data-region="${r.id}">
          <h2><a href="#/r/${r.id}">${r.name}</a></h2>
          <p class="cap">${r.cap}</p>
          <ul>${visibleNotes().filter(n => n.region === r.id).map(n =>
            `<li data-id="${n.id}"><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
        </section>`).join("")}
    </div></div>
    <p class="empty" id="empty" hidden>No notes match that search. Try a shorter term.</p>
    ${typeof stackHTML === "function" ? stackHTML() : ""}
  </div>`;
  applySearch();
  if (typeof initChipZoom === "function") initChipZoom();
}

function pageSections(page) {
  return [...(page.sections || []), ...(page.practice ? [{ id: "practice", label: "Practice Problems" }] : [])];
}

function sideNav(curId, curSec) {
  const subFor = (page, base) => {
    const secs = pageSections(page);
    if (!secs.length) return "";
    return `<ul class="subsec">${secs.map(s => s.group ? `<li class="grp-label">${s.group}</li>` :
      `<li><a class="${curSec === s.id ? "cur" : ""}" href="#/${base}/${s.id}">${s.label}</a></li>`).join("")}</ul>`;
  };
  return `<nav class="side" id="side" aria-label="All sections">
    <a class="home" href="#/">All Knowledge</a>
    ${visibleRegions().map(r => {
      const isCurR = curId === "r/" + r.id;
      return `<div class="grp">
      <a class="rg ${isCurR && !curSec ? "cur" : ""}" href="#/r/${r.id}">${r.name}</a>
      ${isCurR ? subFor(r, "r/" + r.id) : ""}
      <ul>${r.id === "intv" ? `<li><a class="${curId === "flagged" ? "cur" : ""}" href="#/flagged">Flagged Questions</a></li>` : ""}${visibleNotes().filter(n => n.region === r.id).map(n =>
        `<li><a class="${curId === n.id && !curSec ? "cur" : ""}" href="#/${n.id}">${n.title}</a>${curId === n.id ? subFor(n, n.id) : ""}</li>`).join("")}</ul>
    </div>`; }).join("")}
  </nav>`;
}

function tocHTML(page, base) {
  const secs = pageSections(page);
  if (!secs.length) return "";
  return `<nav class="toc" aria-label="On this page"><span>On This Page:</span>${secs.filter(s => !s.group).map(s =>
    `<a href="#/${base}/${s.id}">${s.label}</a>`).join("")}</nav>`;
}

function practiceHTML(p) {
  if (!p) return "";
  const block = (list, label) => list.map(x => `
    <div class="prob"><div class="q">${x.q}</div>
      <details><summary>${label}</summary><div class="a">${x.a}</div></details></div>`).join("");
  return `<section class="practice" id="sec-practice" aria-label="Practice problems">
    <h2>Practice Problems</h2>
    <p>Try each one before opening the solution.</p>
    <h3>Guided</h3>${block(p.guided, "Walk through the solution")}
    <h3>Interview Level</h3>${block(p.interview, "Show solution")}
  </section>`;
}

function layout(curId, curSec, inner) {
  menuBtn.classList.add("show");
  app.innerHTML = `<div class="wrap page">${sideNav(curId, curSec)}<article class="note">${inner}</article></div>`;
  const cur = document.querySelector(".side .cur");
  if (cur && window.innerWidth > 860) cur.scrollIntoView({ block: "nearest" });
  decorateFlags();
  decorateGlossary(curId);
  typesetMath();
}

/* ---------- Glossary hover cards (terms in js/glossary.js) ----------
   Wraps the first use of each term on a page; skips code, links,
   headings, and math. */
const GL_SKIP = "a, code, pre, h1, h2, h3, h4, th, summary, sup, sub, .qn, .math, .eq, mjx-container, svg, .gl";
let GL_RE = null;
function decorateGlossary(curId) {
  if (typeof GLOSSARY !== "object") return;
  if (!GL_RE) {
    const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    GL_RE = new RegExp("(?<![\\w-])(" + terms.join("|") + ")(?![\\w-])");
  }
  const used = new Set();
  const walker = document.createTreeWalker(app.querySelector(".note") || app, NodeFilter.SHOW_TEXT, {
    acceptNode: t => t.parentElement.closest(GL_SKIP) || !t.parentElement.closest(".body, .prob") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (let t of nodes) {
    let m;
    while (t && (m = t.data.match(GL_RE))) {
      const term = m[1];
      if (used.has(term)) { t = t.splitText(m.index + term.length); continue; }
      used.add(term);
      const g = GLOSSARY[term];
      const word = t.splitText(m.index);
      t = word.splitText(term.length);
      const span = document.createElement("span");
      span.className = "gl"; span.tabIndex = 0;
      const link = g.page && g.page.split("/")[0] !== curId
        ? ` <a href="#/${g.page}">Read more</a>` : "";
      span.innerHTML = `<span class="gl-card" role="tooltip"><strong></strong> ${g.def.replace(/</g, "&lt;")}${link}</span>`;
      span.querySelector("strong").textContent = term;
      span.insertBefore(document.createTextNode(term), span.firstChild);
      word.replaceWith(span);
    }
  }
}
/* Keep a card inside the viewport. */
app.addEventListener("mouseover", e => {
  const gl = e.target.closest && e.target.closest(".gl");
  if (gl) placeCard(gl);
});
app.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("gl")) placeCard(e.target); });
function placeCard(gl) {
  const card = gl.querySelector(".gl-card");
  card.style.left = "0px";
  const r = card.getBoundingClientRect(), over = r.right - (document.documentElement.clientWidth - 12);
  if (over > 0) card.style.left = -Math.min(over, gl.getBoundingClientRect().left - 12) + "px";
}

/* ---------- Flagged interview questions ----------
   Cards with a data-qid (sections/intv.js) get a flag button. A flag is
   matched by the question's opening text, not its number, so inserting a
   question doesn't move flags. The owner's flags live in the private db;
   everyone else (and GitHub Pages) keeps them in this browser. */
const FLAG_KEY = "intv-flags";
let FLAGS = [], FLAG_SAVE = Promise.resolve(), FLAG_INDEX = null;
try { FLAGS = JSON.parse(localStorage.getItem(FLAG_KEY) || "[]"); } catch (e) { FLAGS = []; }
if (!Array.isArray(FLAGS)) FLAGS = [];
const flagDoc = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + FLAG_KEY);
async function loadDbFlags() {
  try {
    const snap = await flagDoc().get();
    const f = snap.exists ? (snap.data() || {}).flags : null;
    FLAGS = Array.isArray(f) ? f.slice() : [];
  } catch (e) { console.error("Flags failed to load; using this browser's copy:", e); }
}
function saveFlags() {
  const copy = FLAGS.map(f => Object.assign({}, f));
  if (PRIVATE_OK) {
    FLAG_SAVE = FLAG_SAVE.then(() => flagDoc().set({ flags: copy })).catch(e => console.error("Saving flags failed:", e));
    return;
  }
  try { localStorage.setItem(FLAG_KEY, JSON.stringify(copy)); } catch (e) {}
}
function cardSnip(card) {
  const qEl = card.querySelector(".q").cloneNode(true);
  const qn = qEl.querySelector(".qn");
  if (qn) qn.remove();
  return qEl.textContent.replace(/\s+/g, " ").trim().slice(0, 160);
}
const isFlagged = snip => FLAGS.some(f => f.snip === snip);
function setFlagBtn(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
  btn.textContent = on ? "★ Flagged" : "☆ Flag";
}
function decorateFlags() {
  app.querySelectorAll(".prob[data-qid]").forEach(card => {
    const qn = card.querySelector(".qn");
    if (!qn || qn.querySelector(".flag-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "flag-btn";
    btn.setAttribute("aria-label", "Flag this question");
    setFlagBtn(btn, isFlagged(cardSnip(card)));
    qn.appendChild(btn);
  });
}
app.addEventListener("click", e => {
  const btn = e.target.closest(".flag-btn");
  if (!btn) return;
  const card = btn.closest(".prob");
  const snip = cardSnip(card);
  const i = FLAGS.findIndex(f => f.snip === snip);
  if (i >= 0) FLAGS.splice(i, 1);
  else FLAGS.push({ qid: card.dataset.qid, snip, at: Date.now() });
  saveFlags();
  setFlagBtn(btn, i < 0);
  const count = document.getElementById("flagCount");
  if (count) count.textContent = String(FLAGS.length);
});

/* Every interview card in page order, parsed once from the page bodies. */
function flagIndex() {
  if (FLAG_INDEX) return FLAG_INDEX;
  FLAG_INDEX = [];
  const t = document.createElement("template");
  for (const n of visibleNotes().filter(x => x.region === "intv" && !x.private)) {
    t.innerHTML = n.body;
    t.content.querySelectorAll(".prob[data-qid]").forEach(card =>
      FLAG_INDEX.push({ note: n, snip: cardSnip(card), html: card.outerHTML }));
  }
  return FLAG_INDEX;
}

function renderFlagged() {
  const idx = flagIndex();
  const flagged = new Set(FLAGS.map(f => f.snip));
  const found = new Set();
  let html = "";
  for (const n of visibleNotes().filter(x => x.region === "intv")) {
    const cards = idx.filter(c => c.note === n && flagged.has(c.snip));
    if (!cards.length) continue;
    cards.forEach(c => found.add(c.snip));
    html += `<h3><a href="#/${n.id}">${n.title}</a></h3>` + cards.map(c => c.html).join("");
  }
  const missing = FLAGS.filter(f => !found.has(f.snip));
  if (missing.length) html += `<h3>No Longer Found</h3><p>These questions were edited or removed after you flagged them.</p><ul>${missing.map(f => {
    const li = document.createElement("li"); li.textContent = f.snip + "…"; return li.outerHTML; }).join("")}</ul>`;
  layout("flagged", null, `
    <p class="region"><a href="#/r/intv" style="text-decoration:none">${REGIONS.find(r => r.id === "intv").name}</a></p>
    <h1>Flagged Questions</h1>
    <p class="flag-note"><span id="flagCount">${FLAGS.length}</span> flagged. ${PRIVATE_OK ? "Saved to your account." : "Saved in this browser only."} Unflagged questions stay listed until you leave the page.</p>
    <div class="body">${html || "<p>No questions flagged yet. Use ☆ Flag on any interview question.</p>"}</div>`);
}

function renderRegion(r, sec) {
  const notes = visibleNotes().filter(n => n.region === r.id);
  layout("r/" + r.id, sec, `
    <p class="region">Section Overview</p>
    <h1>${r.name}</h1>
    ${tocHTML(r, "r/" + r.id)}
    <ul class="sublist">${notes.map(n => `<li><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
    ${r.id === "pipe" && typeof pipelineSVG === "function" ? pipelineSVG() : ""}
    ${r.id === "intv" ? `<p class="flag-note"><a href="#/flagged">★ Flagged Questions</a> (<span id="flagCount">${FLAGS.length}</span>)</p>` : ""}
    ${r.private ? '<div id="privbody"><p>Loading…</p></div>' : `<div class="body">${r.body}</div>${practiceHTML(r.practice)}`}`);
}

function renderNote(n, sec) {
  const region = REGIONS.find(r => r.id === n.region);
  const vis = visibleNotes(); const i = vis.indexOf(n), prev = vis[i - 1], next = vis[i + 1];
  layout(n.id, sec, `
    <p class="region"><a href="#/r/${region.id}" style="text-decoration:none">${region.name}</a></p>
    <h1>${n.title}</h1>
    ${n.book ? '<p class="bookref">' + n.book + '</p>' : ''}
    ${tocHTML(n, n.id)}
    ${n.private ? '<div id="privbody"><p>Loading…</p></div>' : '<div class="body">' + n.body + '</div>' + practiceHTML(n.practice)}
    <nav class="pager">
      ${prev ? `<a href="#/${prev.id}"><small>Previous</small>${prev.title}</a>` : ""}
      ${next ? `<a class="next" href="#/${next.id}"><small>Next</small>${next.title}</a>` : ""}
    </nav>`);
}

function applySearch() {
  const term = q.value.trim().toLowerCase();
  let any = false;
  document.querySelectorAll(".block").forEach(b => {
    let hits = 0;
    b.querySelectorAll("li").forEach(li => {
      const n = NOTES.find(x => x.id === li.dataset.id);
      const ok = !term || text(n).includes(term);
      li.classList.toggle("hide", !ok);
      if (ok) hits++;
    });
    b.classList.toggle("dim", !!term && hits === 0);
    if (hits) any = true;
  });
  const e = document.getElementById("empty");
  if (e) e.hidden = any;
  showResults(term);
}

/* ---------- Section-level search results ----------
   Each page is split at its <h3 id="sec-..."> headings, so a hit links
   straight to the section that contains it. */
let SEARCH_INDEX = null;
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = s => strip(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  SEARCH_INDEX = [];
  const pages = [...visibleRegions().filter(r => !r.private).map(r => ({ base: "r/" + r.id, title: r.name, p: r })),
    ...visibleNotes().filter(x => !x.private).map(x => ({ base: x.id, title: x.title, p: x }))];
  for (const { base, title, p: n } of pages) {
    const labels = new Map((n.sections || []).map(s => [s.id, s.label]));
    const parts = (n.body || "").split(/(?=<h3 id="sec-)/);
    for (const part of parts) {
      const m = part.match(/^<h3 id="sec-([^"]+)"/);
      const sec = m ? m[1] : null;
      SEARCH_INDEX.push({ base, title, sec, label: sec ? (labels.get(sec) || plain(part.match(/<h3[^>]*>(.*?)<\/h3>/)[1])) : "", text: plain(part) });
    }
    if (n.practice) SEARCH_INDEX.push({ base, title, sec: "practice", label: "Practice Problems",
      text: plain([...(n.practice.guided || []), ...(n.practice.interview || [])].map(x => x.q + " " + x.a).join(" ")) });
  }
  return SEARCH_INDEX;
}
function snippet(text, term) {
  const i = text.toLowerCase().indexOf(term);
  const start = Math.max(0, i - 60), end = Math.min(text.length, i + term.length + 80);
  return (start ? "…" : "") + esc(text.slice(start, i)) + "<mark>" + esc(text.slice(i, i + term.length)) + "</mark>" +
    esc(text.slice(i + term.length, end)) + (end < text.length ? "…" : "");
}
function showResults(term) {
  const box = document.getElementById("results");
  if (!box) return;
  if (term.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = searchIndex().filter(c => (c.title + " " + c.label + " " + c.text).toLowerCase().includes(term));
  const MAX = 40;
  box.hidden = false;
  box.innerHTML = `<h2>${hits.length} match${hits.length === 1 ? "" : "es"}</h2>` + (hits.length ? `<ol start="0">${hits.slice(0, MAX).map(c => `
    <li><a href="#/${c.base}${c.sec ? "/" + c.sec : ""}">${c.title}${c.label ? " › " + c.label : ""}</a>
      <p>${c.text.toLowerCase().includes(term) ? snippet(c.text, term) : esc(c.text.slice(0, 140)) + "…"}</p></li>`).join("")}</ol>` : "") +
    (hits.length > MAX ? `<p class="more">Showing the first ${MAX}. Add a word to narrow it down.</p>` : "");
}

function goToSection(sec) {
  window.scrollTo(0, 0);
  if (!sec) return;
  const el = document.getElementById("sec-" + sec);
  if (el) el.scrollIntoView({ block: "start" });
}

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  menuBtn.setAttribute("aria-expanded", "false");
  if (parts[0] === "flagged") { renderFlagged(); window.scrollTo(0, 0); return; }
  if (parts[0] === "r") {
    const r = REGIONS.find(x => x.id === parts[1]);
    if (r && r.private) { renderRegion(r, parts[2]); window.scrollTo(0, 0); loadPrivate({ id: r.doc }, parts[2], "r/" + r.id); return; }
    if (r) { renderRegion(r, parts[2]); goToSection(parts[2]); return; }
  }
  const n = NOTES.find(x => x.id === parts[0]);
  if (n) { renderNote(n, parts[1]); if (n.private) { window.scrollTo(0, 0); loadPrivate(n, parts[1]); } else goToSection(parts[1]); return; }
  renderHome();
  window.scrollTo(0, 0);
}

menuBtn.addEventListener("click", () => {
  const side = document.getElementById("side");
  if (!side) return;
  const open = side.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
q.addEventListener("input", () => {
  if (location.hash && location.hash !== "#/") location.hash = "#/";
  else applySearch();
});

window.addEventListener("hashchange", route);
if (typeof initThemeToggle === "function") initThemeToggle();
route();
checkPrivate();
