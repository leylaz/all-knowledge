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
    await loadDbSecFlags();
    await loadDbSolved();
    await loadDbAnswers();
    window.claude.use("sample").then(s => { SAMPLE = s; if (s) addGradeButtons(); })
      .catch(e => console.error("Claude feedback is unavailable:", e));
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
      <p>From transistors to workloads, laid out like a die. <a href="#/drill">Drill a random question</a> or <a href="#/review">review what you've flagged</a>.</p>
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
      `<li><a class="${curSec === s.id ? "cur" : ""}" href="#/${base}/${s.id}">${s.label}${secFlag(base + "/" + s.id) ? SIDE_STAR : ""}</a></li>`).join("")}</ul>`;
  };
  return `<nav class="side" id="side" aria-label="All sections">
    <a class="home" href="#/">All Knowledge</a>
    ${visibleRegions().map(r => {
      const isCurR = curId === "r/" + r.id;
      return `<div class="grp">
      <a class="rg ${isCurR && !curSec ? "cur" : ""}" href="#/r/${r.id}">${r.name}</a>
      ${isCurR ? subFor(r, "r/" + r.id) : ""}
      <ul>${r.id === "intv" ? `<li><a class="${curId === "drill" ? "cur" : ""}" href="#/drill">Random Drill</a></li>` : ""}${visibleNotes().filter(n => n.region === r.id).map(n =>
        `<li><a class="${curId === n.id && !curSec ? "cur" : ""}" href="#/${n.id}">${n.title}</a>${curId === n.id ? subFor(n, n.id) : ""}</li>`).join("")}</ul>
    </div>${r.id === "intv" ? `<div class="grp">
      <a class="rg ${curId === "review" && !curSec ? "cur" : ""}" href="#/review">Review</a>
      <ul><li><a class="${curId === "review" && !curSec ? "cur" : ""}" href="#/review">Flagged for Review</a>${curId === "review" ? subFor(REVIEW_PAGE, "review") : ""}</li></ul>
    </div>` : ""}`; }).join("")}
  </nav>`;
}

function tocHTML(page, base) {
  const secs = pageSections(page);
  if (!secs.length) return "";
  /* Tabbed pages repeat their headings in each tab, so their group labels
     (the tab names) stay in the list to tell the two apart. */
  return `<nav class="toc" aria-label="On this page"><span>On This Page:</span>${secs.filter(s => page.tabs || !s.group).map(s =>
    s.group ? `<span>${s.group}:</span>` : `<a href="#/${base}/${s.id}">${s.label}</a>`).join("")}</nav>`;
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
  decorateSolved();
  decorateAnswers();
  decorateSecFlags(curId);
  if (typeof initCalcs === "function") initCalcs(app);
  if (typeof initTraces === "function") initTraces(app);
  decorateGlossary(curId);
  typesetMath();
}

/* ---------- Glossary hover cards (terms in js/glossary.js) ----------
   Wraps the first use of each term on a page; skips code, links,
   headings, and math. */
const GL_SKIP = "a, code, pre, h1, h2, h3, h4, th, summary, sup, sub, .qn, .math, .eq, mjx-container, svg, .gl, .calc, .trace, .ex";
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
   Cards with a data-qid (sections/interview-prep.js) get a flag button. A flag is
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
  /* Givens added after a question was written sit in p.given and stay out of
     the key, so adding one doesn't orphan the card's flags or answers. */
  qEl.querySelectorAll(".qn, .given").forEach(el => el.remove());
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
  const btn = e.target.closest(".flag-btn:not(.sec-flag)");
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

/* ---------- Flagged subsections ----------
   Every <h3 id="sec-..."> on a public notes page or section overview
   (not the interview pages) gets a flag button. A flag is keyed by page
   and section id, keeps the heading's label in case the section is later
   renamed or removed, and carries an optional note. Stored like the
   question flags: the owner's in the private db, everyone else's in this
   browser. */
const SEC_FLAG_KEY = "sec-flags";
const SIDE_STAR = ' <span class="side-flag" aria-label="flagged">★</span>';
let SEC_FLAGS = [], SEC_FLAG_SAVE = Promise.resolve(), SEC_NOTE_TIMER = null;
try { SEC_FLAGS = JSON.parse(localStorage.getItem(SEC_FLAG_KEY) || "[]"); } catch (e) { SEC_FLAGS = []; }
if (!Array.isArray(SEC_FLAGS)) SEC_FLAGS = [];
const secFlagDoc = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + SEC_FLAG_KEY);
async function loadDbSecFlags() {
  try {
    const snap = await secFlagDoc().get();
    const f = snap.exists ? (snap.data() || {}).flags : null;
    SEC_FLAGS = Array.isArray(f) ? f.slice() : [];
  } catch (e) { console.error("Subsection flags failed to load; using this browser's copy:", e); }
}
function saveSecFlags() {
  const copy = SEC_FLAGS.map(f => Object.assign({}, f));
  if (PRIVATE_OK) {
    SEC_FLAG_SAVE = SEC_FLAG_SAVE.then(() => secFlagDoc().set({ flags: copy })).catch(e => console.error("Saving subsection flags failed:", e));
    return;
  }
  try { localStorage.setItem(SEC_FLAG_KEY, JSON.stringify(copy)); } catch (e) {}
}
const secFlag = key => SEC_FLAGS.find(f => f.key === key);
/* The page a layout id names, if its subsections can be flagged. */
function flaggablePage(curId) {
  const page = curId.startsWith("r/") ? REGIONS.find(r => "r/" + r.id === curId) : NOTES.find(n => n.id === curId);
  return page && !page.private && page.id !== "intv" && page.region !== "intv" ? page : null;
}
function headText(h) {
  const c = h.cloneNode(true);
  c.querySelectorAll(".flag-btn").forEach(b => b.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}
function secNoteBox(key) {
  const box = document.createElement("div");
  box.className = "sec-note";
  box.innerHTML = '<input type="text" class="sec-note-text" aria-label="Why this is flagged" placeholder="Why flag this? (optional note)">';
  const input = box.firstElementChild;
  input.dataset.key = key;
  input.value = (secFlag(key) || {}).note || "";
  return box;
}
function decorateSecFlags(curId) {
  if (!flaggablePage(curId)) return;
  app.querySelectorAll('.note .body h3[id^="sec-"]').forEach(h => {
    if (h.querySelector(".flag-btn")) return;
    const key = curId + "/" + h.id.slice(4);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "flag-btn sec-flag"; btn.dataset.key = key;
    btn.setAttribute("aria-label", "Flag this subsection for review");
    setFlagBtn(btn, !!secFlag(key));
    h.appendChild(btn);
    if (secFlag(key)) h.after(secNoteBox(key));
  });
}
function markSide(key, on) {
  const a = document.querySelector(`.side a[href="#/${key}"]`);
  if (!a) return;
  const star = a.querySelector(".side-flag");
  if (on && !star) a.insertAdjacentHTML("beforeend", SIDE_STAR);
  if (!on && star) star.remove();
}
app.addEventListener("click", e => {
  const btn = e.target.closest(".sec-flag");
  if (!btn) return;
  const key = btn.dataset.key, i = SEC_FLAGS.findIndex(f => f.key === key);
  const h = btn.closest("h3"), next = h && h.nextElementSibling;
  if (i >= 0) {
    SEC_FLAGS.splice(i, 1);
    if (next && next.classList.contains("sec-note")) next.remove();
  } else {
    const item = btn.closest(".rev-item"), kept = item && item.querySelector(".sec-note-text");
    SEC_FLAGS.push({ key, label: h ? headText(h) : btn.dataset.label, note: kept ? kept.value : "", at: Date.now() });
    if (h) { h.after(secNoteBox(key)); h.nextElementSibling.firstElementChild.focus(); }
  }
  saveSecFlags();
  setFlagBtn(btn, i < 0);
  markSide(key, i < 0);
  const count = document.getElementById("secFlagCount");
  if (count) count.textContent = String(SEC_FLAGS.length);
});
app.addEventListener("input", e => {
  const input = e.target.closest(".sec-note-text");
  if (!input) return;
  const f = secFlag(input.dataset.key);
  if (!f) return;
  f.note = input.value;
  clearTimeout(SEC_NOTE_TIMER);
  SEC_NOTE_TIMER = setTimeout(saveSecFlags, 600);
});

/* ---------- Solved problems and the random drill ----------
   Any practice or interview card can be marked solved. Like flags, a
   card is matched by its opening text; the owner's marks live in the
   private db, everyone else's in this browser. */
const SOLVED_KEY = "practice-solved";
let SOLVED = {}, SOLVED_SAVE = Promise.resolve(), DRILL_POOL = null;
try { SOLVED = JSON.parse(localStorage.getItem(SOLVED_KEY) || "{}"); } catch (e) { SOLVED = {}; }
if (!SOLVED || typeof SOLVED !== "object" || Array.isArray(SOLVED)) SOLVED = {};
const solvedDoc = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + SOLVED_KEY);
async function loadDbSolved() {
  try {
    const snap = await solvedDoc().get();
    const d = snap.exists ? (snap.data() || {}).solved : null;
    SOLVED = d && typeof d === "object" ? Object.assign({}, d) : {};
  } catch (e) { console.error("Solved marks failed to load; using this browser's copy:", e); }
}
function saveSolved() {
  const copy = Object.assign({}, SOLVED);
  if (PRIVATE_OK) {
    SOLVED_SAVE = SOLVED_SAVE.then(() => solvedDoc().set({ solved: copy })).catch(e => console.error("Saving solved marks failed:", e));
    return;
  }
  try { localStorage.setItem(SOLVED_KEY, JSON.stringify(copy)); } catch (e) {}
}
function setSolveBtn(btn, on) {
  btn.setAttribute("aria-pressed", String(on));
  btn.textContent = on ? "✓ Solved" : "Mark solved";
}
function decorateSolved() {
  app.querySelectorAll(".prob").forEach(card => {
    if (card.querySelector(".solve-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "solve-btn";
    setSolveBtn(btn, !!SOLVED[cardSnip(card)]);
    card.appendChild(btn);
  });
}
app.addEventListener("click", e => {
  const btn = e.target.closest(".solve-btn");
  if (!btn) return;
  const snip = cardSnip(btn.closest(".prob"));
  if (SOLVED[snip]) delete SOLVED[snip]; else SOLVED[snip] = Date.now();
  saveSolved();
  setSolveBtn(btn, !!SOLVED[snip]);
  const count = document.getElementById("solvedCount");
  if (count) count.textContent = String(drillPool().filter(c => SOLVED[c.snip]).length);
});

/* ---------- Answer box on interview cards ----------
   Every interview card gets a box for your own answer, matched by its
   opening text like flags. Answers save as you type: the owner's to the
   private db (one doc per card), everyone else's in this browser. The
   owner can also ask Claude (the artifact's sample capability) to grade
   an answer against the card's stored answer. The feedback is saved with
   the answer, so reopening a card doesn't call Claude again. */
const ANS_KEY = "intv-answers";
let ANSWERS = {}, SAMPLE = null;
const ANS_TIMERS = {}, ANS_SAVES = {};
try { ANSWERS = JSON.parse(localStorage.getItem(ANS_KEY) || "{}"); } catch (e) { ANSWERS = {}; }
if (!ANSWERS || typeof ANSWERS !== "object" || Array.isArray(ANSWERS)) ANSWERS = {};
/* Doc id for a card: FNV-1a of its opening text. */
function ansId(snip) {
  let h = 0x811c9dc5;
  for (const ch of snip) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return "q" + (h >>> 0).toString(16);
}
const ansCol = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + ANS_KEY).collection("q");
async function loadDbAnswers() {
  try {
    const snap = await ansCol().limit(1000).get();
    ANSWERS = {};
    for (const d of snap.docs) { const v = d.data() || {}; if (v.snip) ANSWERS[v.snip] = v; }
  } catch (e) { console.error("Answers failed to load; using this browser's copy:", e); }
}
function saveAnswer(snip) {
  const v = ANSWERS[snip], empty = !v || (!v.text && !v.fb);
  if (empty) delete ANSWERS[snip];
  if (!PRIVATE_OK) {
    try { localStorage.setItem(ANS_KEY, JSON.stringify(ANSWERS)); } catch (e) {}
    return Promise.resolve();
  }
  const id = ansId(snip), copy = Object.assign({}, v);
  ANS_SAVES[id] = (ANS_SAVES[id] || Promise.resolve())
    .then(() => empty ? ansCol().doc(id).delete() : ansCol().doc(id).set(copy));
  return ANS_SAVES[id];
}

/* The feedback comes back as plain text with "- " or "1." list lines and
   **bold**. Escape it, then build paragraphs and lists. */
function fbHTML(s) {
  const inline = x => x.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  let out = "", list = "";
  for (const raw of s.split("\n")) {
    const line = raw.trim(), m = line.match(/^([-*•]|\d+[.)])\s+(.*)/);
    const kind = m ? (/^\d/.test(m[1]) ? "ol" : "ul") : "";
    if (list && kind !== list) { out += `</${list}>`; list = ""; }
    if (m) { if (!list) { out += `<${kind}>`; list = kind; } out += `<li>${inline(m[2])}</li>`; }
    else if (line) out += `<p>${inline(line)}</p>`;
  }
  return out + (list ? `</${list}>` : "");
}
function showFeedback(card) {
  const v = ANSWERS[card.dataset.snip], el = card.querySelector(".ans-fb");
  if (!el) return;
  el.hidden = !(v && v.fb);
  if (el.hidden) return;
  el.innerHTML = (v.fbFor !== v.text ? `<p class="ans-stale">This feedback is for an earlier version of your answer.</p>` : "") + fbHTML(v.fb);
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(e => console.error("MathJax typeset failed:", e));
}
function decorateAnswers() {
  app.querySelectorAll(".prob[data-qid]").forEach(card => {
    if (card.querySelector(".ans")) return;
    const snip = cardSnip(card), v = ANSWERS[snip];
    card.dataset.snip = snip;
    const box = document.createElement("div");
    const skel = card.querySelector(".code-skel");
    box.className = skel ? "ans code-box" : "ans";
    box.innerHTML = skel ? `<p class="ans-label">Your code</p>
      <textarea class="ans-text code-text" rows="${card.dataset.lines}" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Your code"></textarea>
      <div class="ans-bar"><button type="button" class="code-run">Run</button>${card.dataset.threads ? `<label class="code-seed">Seed <input type="number" min="1" value="1"></label>` : ""}<button type="button" class="code-reset">Reset to skeleton</button><span class="ans-status" aria-live="polite"></span></div>
      <pre class="code-out" aria-live="polite" hidden></pre>
      <div class="ans-fb" aria-live="polite" hidden></div>` : `<p class="ans-label">Your answer</p>
      <textarea class="ans-text" rows="12" aria-label="Your answer" placeholder="Work it out here before opening the answer."></textarea>
      <div class="ans-bar"><span class="ans-status" aria-live="polite"></span></div>
      <div class="ans-fb" aria-live="polite" hidden></div>`;
    box.querySelector(".ans-text").value = v && v.text ? v.text : skel ? skel.textContent : "";
    card.querySelector(".q").after(box);
    showFeedback(card);
  });
  addGradeButtons();
}
function addGradeButtons() {
  if (!PRIVATE_OK || !SAMPLE) return;
  /* Coding cards only exist on the public site, which has no Claude. */
  app.querySelectorAll(".ans:not(.code-box) .ans-bar").forEach(bar => {
    if (bar.querySelector(".ans-go")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ans-go"; btn.textContent = "Get feedback";
    bar.appendChild(btn);
  });
}
app.addEventListener("input", e => {
  const ta = e.target.closest(".ans-text");
  if (!ta) return;
  const card = ta.closest(".prob"), snip = card.dataset.snip, status = card.querySelector(".ans-status");
  /* Untouched code is the skeleton, which isn't worth saving. */
  const skel = card.querySelector(".code-skel"), text = skel && ta.value === skel.textContent ? "" : ta.value;
  ANSWERS[snip] = Object.assign({ snip }, ANSWERS[snip], { text, at: Date.now() });
  status.textContent = "Saving…";
  clearTimeout(ANS_TIMERS[snip]);
  ANS_TIMERS[snip] = setTimeout(() => {
    saveAnswer(snip)
      .then(() => { status.textContent = PRIVATE_OK ? "Saved to your account" : "Saved in this browser"; })
      .catch(err => { status.textContent = "Not saved"; console.error("Saving answer failed:", err); });
  }, 800);
});

/* ---------- Code box on coding cards ----------
   Coding cards exist only on the public site (coding/, left out of the
   artifact). Run compiles and runs the box's code (coding/crun.js) and
   shows the compiler's messages and the program's output under the box.
   Code saves in this browser like answers do. In the box, Tab indents
   (Escape first lets Tab leave the box), Enter keeps the line's
   indentation, and Ctrl+Enter or Cmd+Enter runs. */
function runCode(card) {
  const btn = card.querySelector(".code-run"), out = card.querySelector(".code-out");
  if (!btn || btn.disabled || CRUN.busy()) return;
  const seedEl = card.querySelector(".code-seed input");
  const seed = Math.max(1, parseInt(seedEl ? seedEl.value : "1", 10) || 1);
  const status = document.createElement("span"), body = document.createElement("span");
  status.className = "code-status";
  out.hidden = false; out.textContent = ""; out.append(status, body);
  let text = "";
  const show = s => { text += s; body.textContent = text; out.scrollTop = out.scrollHeight; };
  btn.disabled = true; btn.textContent = "Running…";
  const done = () => {
    if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = "Run"; }
  };
  CRUN.run(card.querySelector(".ans-text").value, { threads: !!card.dataset.threads, seed }, (type, data) => {
    if (type === "status") status.textContent = data + "\n";
    else if (type === "out" || type === "err") { status.textContent = ""; show(data); }
    else if (type === "diag") show(data + "\n");
    else if (type === "fail") {
      status.textContent = "";
      show(data.diag ? data.diag + "\nCompilation failed.\n" : `Couldn't run the code: ${data.msg}\n`);
      done();
    } else if (type === "done") {
      status.textContent = "";
      if (text && !text.endsWith("\n")) show("\n");
      show(data.msg ? data.msg + "\n" : `Exited with status ${data.status} after ${data.ms} ms${card.dataset.threads ? ` (seed ${seed})` : ""}.\n`);
      done();
    }
  });
}
app.addEventListener("click", e => {
  const run = e.target.closest(".code-run");
  if (run) { runCode(run.closest(".prob")); return; }
  const reset = e.target.closest(".code-reset");
  if (!reset) return;
  /* The artifact host blocks confirm(), so changed code takes a second click. */
  const card = reset.closest(".prob"), ta = card.querySelector(".ans-text"), skel = card.querySelector(".code-skel").textContent;
  if (ta.value !== skel && !reset.dataset.armed) {
    reset.dataset.armed = "1"; reset.textContent = "Click again to discard your code";
    setTimeout(() => { delete reset.dataset.armed; reset.textContent = "Reset to skeleton"; }, 4000);
    return;
  }
  delete reset.dataset.armed; reset.textContent = "Reset to skeleton";
  ta.value = skel;
  ta.dispatchEvent(new Event("input", { bubbles: true }));
});
let CODE_TAB_EXIT = false;
app.addEventListener("keydown", e => {
  const ta = e.target.closest(".code-text");
  if (!ta) return;
  if (e.key === "Escape") { CODE_TAB_EXIT = true; return; }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runCode(ta.closest(".prob")); return; }
  const { selectionStart: s, selectionEnd: end, value: v } = ta;
  const lineStart = v.lastIndexOf("\n", s - 1) + 1;
  if (e.key === "Tab" && !CODE_TAB_EXIT && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (e.shiftKey) {
      const n = (v.slice(lineStart).match(/^ {1,4}/) || [""])[0].length;
      if (n) { ta.setSelectionRange(lineStart, lineStart + n); document.execCommand("insertText", false, ""); ta.setSelectionRange(Math.max(lineStart, s - n), Math.max(lineStart, end - n)); }
    } else document.execCommand("insertText", false, "    ");
  } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
    const indent = v.slice(lineStart, s).match(/^[ \t]*/)[0] + (/\{\s*$/.test(v.slice(lineStart, s)) ? "    " : "");
    if (!indent) return;
    e.preventDefault();
    document.execCommand("insertText", false, "\n" + indent);
  }
  if (e.key !== "Shift") CODE_TAB_EXIT = false;
});

/* Question and stored answer as plain text, from the card's source HTML
   (so math stays as TeX rather than rendered SVG). */
function cardText(html) {
  const t = document.createElement("template");
  t.innerHTML = html.replace(/<li[^>]*>/g, "\n- ").replace(/<\/(p|div|ul|ol|tr|h\d|pre)>|<br\s*\/?>/g, "\n").replace(/<\/t[dh]>/g, " | ");
  return t.content.textContent.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function gradePrompt(snip, answer) {
  const src = flagIndex().find(c => c.snip === snip);
  const t = document.createElement("template");
  t.innerHTML = src ? src.html : "";
  const qEl = t.content.querySelector(".q"), aEl = t.content.querySelector(".a");
  if (!qEl || !aEl) return null;
  const qn = qEl.querySelector(".qn");
  if (qn) qn.remove();
  return `You are grading a candidate's answer to an interview question for a CPU performance modeling and performance architecture role. Compare it with the reference answer, which is correct.

Reply in under 200 words, in exactly this format:
**Verdict:** Correct, Partly correct, or Incorrect.
**What's missing:**
- one bullet per point the answer leaves out, or "- Nothing." if nothing is missing
**What's wrong:**
- one bullet per incorrect statement or number, or "- Nothing." if nothing is wrong
**Tip:** one sentence on what to say or practice next time.

Rules:
- Judge the reasoning and the final numbers. Accept a different valid approach and small rounding differences.
- Don't repeat the reference answer in full. Name only what the candidate needs.
- Don't list what the candidate got right. Report only what is missing and what is wrong.
- If the answer is blank, a guess with no reasoning, or off topic, say so.
- Use "- " bullet points for lists. Never use semicolons to separate list items.
- Write math as TeX inside \\( and \\).

Question:
${cardText(qEl.innerHTML)}

Reference answer:
${cardText(aEl.innerHTML)}

Candidate's answer:
${answer}`;
}
const SAMPLE_GONE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];
app.addEventListener("click", async e => {
  const btn = e.target.closest(".ans-go");
  if (!btn || btn.disabled || !SAMPLE) return;
  const card = btn.closest(".prob"), snip = card.dataset.snip, el = card.querySelector(".ans-fb");
  const answer = ((ANSWERS[snip] || {}).text || "").trim();
  if (!answer) { el.hidden = false; el.innerHTML = "<p>Write an answer first.</p>"; return; }
  const prompt = gradePrompt(snip, answer);
  if (!prompt) { el.hidden = false; el.innerHTML = "<p>This question's stored answer couldn't be found.</p>"; return; }
  btn.disabled = true; btn.textContent = "Grading…";
  el.hidden = false; el.innerHTML = "<p>Thinking…</p>";
  try {
    const res = await SAMPLE(prompt, { onText: ({ text }) => { el.innerHTML = fbHTML(text); } });
    const v = ANSWERS[snip] || (ANSWERS[snip] = { snip, text: answer });
    Object.assign(v, { fb: res.text + (res.truncated ? "\n(Cut short.)" : ""), fbFor: answer, fbAt: Date.now() });
    if (document.body.contains(card)) showFeedback(card);
    saveAnswer(snip).catch(err => console.error("Saving feedback failed:", err));
  } catch (err) {
    console.error("Grading failed:", err);
    if (SAMPLE_GONE.includes(err && err.code)) {
      SAMPLE = null;
      app.querySelectorAll(".ans-go").forEach(b => b.remove());
      el.innerHTML = "<p>Claude isn't available on this page, so feedback is off.</p>";
    } else el.innerHTML = `<p>${err && err.code === "rate_limited" ? "Too many requests right now. Try again in a minute." : "Feedback failed. Try again."}</p>`;
  } finally {
    if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = "Get feedback"; }
  }
});

/* Every practice and interview card on the site, parsed once. */
function drillPool() {
  if (DRILL_POOL) return DRILL_POOL;
  DRILL_POOL = [];
  const t = document.createElement("template");
  const add = (base, title, region, html, level) => {
    t.innerHTML = html;
    DRILL_POOL.push({ base, title, region, html, level, snip: cardSnip(t.content.firstElementChild) });
  };
  const fromPractice = (base, title, region, p) => {
    if (!p) return;
    for (const [list, label] of [[p.guided || [], "Walk through the solution"], [p.interview || [], "Show solution"]])
      for (const x of list) add(base, title, region, `<div class="prob"><div class="q">${x.q}</div><details><summary>${label}</summary><div class="a">${x.a}</div></details></div>`, "");
  };
  for (const r of visibleRegions().filter(r => !r.private)) fromPractice("r/" + r.id, r.name, r.id, r.practice);
  for (const n of visibleNotes().filter(n => !n.private)) fromPractice(n.id, n.title, n.region, n.practice);
  for (const c of flagIndex()) {
    const lvl = (c.html.match(/class="lvl (easy|medium|hard)"/) || [])[1] || "";
    add(c.note.id, c.note.title, "intv", c.html, lvl);
  }
  return DRILL_POOL;
}

let DRILL = { region: "", level: "", unsolved: true };
function renderDrill() {
  const pool = drillPool();
  const regions = visibleRegions().filter(r => pool.some(c => c.region === r.id));
  const pick = pool.filter(c => (!DRILL.region || c.region === DRILL.region) && (!DRILL.level || c.level === DRILL.level) && !(DRILL.unsolved && SOLVED[c.snip]));
  const c = pick[Math.floor(Math.random() * pick.length)];
  const opt = (v, label, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${label}</option>`;
  layout("drill", null, `
    <p class="region"><a href="#/r/intv" style="text-decoration:none">${REGIONS.find(r => r.id === "intv").name}</a></p>
    <h1>Random Drill</h1>
    <p class="flag-note"><span id="solvedCount">${pool.filter(c => SOLVED[c.snip]).length}</span> of ${pool.length} questions solved. ${PRIVATE_OK ? "Saved to your account." : "Saved in this browser only."}</p>
    <form class="drill-bar" id="drillForm">
      <label>Section <select name="region">${opt("", "All sections", DRILL.region)}${regions.map(r => opt(r.id, r.name, DRILL.region)).join("")}</select></label>
      <label>Difficulty <select name="level">${opt("", "Any", DRILL.level)}${opt("easy", "Easy (interview pages)", DRILL.level)}${opt("medium", "Medium (interview pages)", DRILL.level)}${opt("hard", "Hard (interview pages)", DRILL.level)}</select></label>
      <label class="chk"><input type="checkbox" name="unsolved"${DRILL.unsolved ? " checked" : ""}> Skip solved</label>
      <button type="submit" class="chip-zoom">Next question</button>
    </form>
    <div class="body">${c ? `<p class="drill-src">From <a href="#/${c.base}">${c.title}</a> · ${pick.length} to choose from</p>${c.html}` : "<p>Nothing left with these filters. Clear “Skip solved” or pick another section.</p>"}</div>`);
  const form = document.getElementById("drillForm");
  form.addEventListener("submit", e => {
    e.preventDefault();
    DRILL = { region: form.region.value, level: form.level.value, unsolved: form.unsolved.checked };
    renderDrill();
  });
  form.addEventListener("change", () => form.requestSubmit());
}

/* ---------- The review page ----------
   Flagged subsections, grouped by page in sidebar order, each with its
   first sentence and your note, then the flagged interview questions.
   Unflagged items stay listed until you leave the page. */
const REVIEW_PAGE = { sections: [{ id: "subsections", label: "Subsections" }, { id: "questions", label: "Interview Questions" }] };
function firstSentence(t) {
  const m = t.match(/^[\s\S]{30,}?[.!?:](?=\s+[A-Z"“(]|$)/);
  const s = m ? m[0] : t;
  return s.length > 220 ? s.slice(0, 200).replace(/\s+\S*$/, "") + "…" : s;
}
const revItem = (key, title, desc) => `<div class="rev-item">
  <button type="button" class="flag-btn sec-flag" data-key="${esc(key)}" data-label="${esc(title)}" aria-label="Flag this subsection for review"></button>
  <p class="rev-title">${desc === null ? esc(title) : `<a href="#/${key}">${esc(title)}</a>`}</p>
  ${desc ? `<p class="rev-desc">${esc(desc)}</p>` : ""}
  <div class="sec-note"><input type="text" class="sec-note-text" data-key="${esc(key)}" aria-label="Why this is flagged" placeholder="Why flag this? (optional note)"></div>
</div>`;
function renderReview() {
  const idx = searchIndex();
  const order = [];
  for (const r of visibleRegions().filter(r => !r.private)) {
    order.push({ base: "r/" + r.id, title: r.name });
    for (const n of visibleNotes().filter(n => n.region === r.id && !n.private)) order.push({ base: n.id, title: n.title });
  }
  const keys = new Set(SEC_FLAGS.map(f => f.key)), found = new Set();
  let subs = "";
  for (const pg of order) {
    const hits = idx.filter(c => c.base === pg.base && c.sec && keys.has(c.base + "/" + c.sec));
    if (!hits.length) continue;
    hits.forEach(c => found.add(c.base + "/" + c.sec));
    subs += `<p class="rev-page"><a href="#/${pg.base}">${pg.title}</a></p>` +
      hits.map(c => revItem(c.base + "/" + c.sec, c.label, firstSentence(c.rest))).join("");
  }
  const missing = SEC_FLAGS.filter(f => !found.has(f.key));
  if (missing.length) subs += `<p class="rev-page">No Longer Found</p><p>These subsections were renamed or removed after you flagged them.</p>` +
    missing.map(f => revItem(f.key, f.label || f.key, null)).join("");

  const cidx = flagIndex();
  const flagged = new Set(FLAGS.map(f => f.snip)), foundQ = new Set();
  let qs = "";
  for (const n of visibleNotes().filter(x => x.region === "intv")) {
    const cards = cidx.filter(c => c.note === n && flagged.has(c.snip));
    if (!cards.length) continue;
    cards.forEach(c => foundQ.add(c.snip));
    qs += `<p class="rev-page"><a href="#/${n.id}">${n.title}</a></p>` + cards.map(c => c.html).join("");
  }
  const missingQ = FLAGS.filter(f => !foundQ.has(f.snip));
  if (missingQ.length) qs += `<p class="rev-page">No Longer Found</p><p>These questions were edited or removed after you flagged them.</p><ul>${missingQ.map(f => {
    const li = document.createElement("li"); li.textContent = f.snip + "…"; return li.outerHTML; }).join("")}</ul>`;

  layout("review", null, `
    <p class="region">Review</p>
    <h1>Flagged for Review</h1>
    ${tocHTML(REVIEW_PAGE, "review")}
    <p class="flag-note">Flagged: <span id="secFlagCount">${SEC_FLAGS.length}</span> subsections, <span id="flagCount">${FLAGS.length}</span> interview questions. ${PRIVATE_OK ? "Saved to your account." : "Saved in this browser only."} Unflagged items stay listed until you leave the page.</p>
    <div class="body">
      <h3 id="sec-subsections">Subsections</h3>
      ${subs || "<p>No subsections flagged yet. Use ☆ Flag next to any subsection heading on a notes page.</p>"}
      <h3 id="sec-questions">Interview Questions</h3>
      ${qs || "<p>No questions flagged yet. Use ☆ Flag on any interview question.</p>"}
    </div>`);
  app.querySelectorAll(".rev-item .sec-flag").forEach(b => setFlagBtn(b, true));
  app.querySelectorAll(".rev-item .sec-note-text").forEach(input => { input.value = (secFlag(input.dataset.key) || {}).note || ""; });
}

function renderRegion(r, sec) {
  const notes = visibleNotes().filter(n => n.region === r.id);
  layout("r/" + r.id, sec, `
    <p class="region">Section Overview</p>
    <h1>${r.name}</h1>
    ${tocHTML(r, "r/" + r.id)}
    <ul class="sublist">${notes.map(n => `<li><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
    ${r.id === "pipe" && typeof pipelineSVG === "function" ? pipelineSVG() : ""}
    ${r.id === "intv" ? `<p class="flag-note"><a href="#/review/questions">★ Flagged Questions</a> (<span id="flagCount">${FLAGS.length}</span>) · <a href="#/drill">Random Drill</a></p>` : ""}
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
      SEARCH_INDEX.push({ base, title, sec, label: sec ? (labels.get(sec) || plain(part.match(/<h3[^>]*>(.*?)<\/h3>/)[1])) : "", text: plain(part),
        rest: sec ? plain(part.replace(/^<h3[^>]*>.*?<\/h3>/, "")) : "" });
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
  box.innerHTML = `<h2>${hits.length} match${hits.length === 1 ? "" : "es"}</h2>` + (hits.length ? `<ol>${hits.slice(0, MAX).map(c => `
    <li><a href="#/${c.base}${c.sec ? "/" + c.sec : ""}">${c.title}${c.label ? " › " + c.label : ""}</a>
      <p>${c.text.toLowerCase().includes(term) ? snippet(c.text, term) : esc(c.text.slice(0, 140)) + "…"}</p></li>`).join("")}</ol>` : "") +
    (hits.length > MAX ? `<p class="more">Showing the first ${MAX}. Add a word to narrow it down.</p>` : "");
}

/* ---------- Tabs ----------
   The interview pages split their questions into a Conceptual and a Math
   panel. A tab button shows its panel, and jumping to a section inside a
   hidden panel opens that panel first. */
function showTab(panel) {
  const box = panel.parentElement;
  box.querySelectorAll(":scope > .tab-panel").forEach(p => { p.hidden = p !== panel; });
  box.querySelectorAll(":scope > .tabs .tab-btn").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === panel.dataset.tab)));
}
app.addEventListener("click", e => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  const panel = btn.closest(".tabs").parentElement.querySelector(`:scope > .tab-panel[data-tab="${btn.dataset.tab}"]`);
  if (panel) showTab(panel);
});

function goToSection(sec) {
  window.scrollTo(0, 0);
  if (!sec) return;
  const el = document.getElementById("sec-" + sec);
  if (!el) return;
  const panel = el.closest(".tab-panel");
  if (panel && panel.hidden) showTab(panel);
  el.scrollIntoView({ block: "start" });
}

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  menuBtn.setAttribute("aria-expanded", "false");
  /* Leaving home ends the search, so coming back shows the full page. */
  if (parts[0]) q.value = "";
  if (parts[0] === "review") { renderReview(); goToSection(parts[1]); return; }
  if (parts[0] === "flagged") { renderReview(); goToSection("questions"); return; }
  if (parts[0] === "drill") { renderDrill(); window.scrollTo(0, 0); return; }
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
