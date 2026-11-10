/* Rendering, routing, and search. No note content lives here. */
/* ---------- Sign-in (Firebase) ----------
   Signed in with Google, flags, solved marks, answers, the to-do list, and
   the calendar live in Firestore under data/users/<uid>/ (only that uid can read or
   write there), so they follow you between devices. Signed out, they stay
   in this browser. Signing in copies this browser's data into the account,
   then clears it here. The config isn't secret; the Firestore rules are
   what protect the data. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZgRvsFcWA-HmhCqtRtG1rGaVUEvErZsc",
  authDomain: "all-knowledge-8bbf0.firebaseapp.com",
  projectId: "all-knowledge-8bbf0",
  storageBucket: "all-knowledge-8bbf0.firebasestorage.app",
  messagingSenderId: "502581062125",
  appId: "1:502581062125:web:6f7cdbb0fc19d1f9621fe4"
};
let PRIVATE_OK = false, PRIVATE_UID = null, PRIVATE_DB = null;
function initAuth() {
  const btn = document.getElementById("authBtn");
  if (!btn) return;
  if (!window.firebase) { btn.hidden = true; console.error("Firebase didn't load; saving in this browser only."); return; }
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  btn.addEventListener("click", () => {
    if (auth.currentUser) auth.signOut().then(() => location.reload());
    else auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => {
      console.error("Sign-in failed:", e);
      /* Shown on the page, since a failed popup otherwise looks like nothing happened. */
      if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") alert("Sign-in failed: " + (e.code || e.message || e));
    });
  });
  auth.onAuthStateChanged(async user => {
    btn.textContent = user ? "Sign out" : "Sign in";
    btn.title = user ? "Signed in as " + (user.email || "you") : "Sign in to save across devices";
    if (!user || PRIVATE_OK) return;
    PRIVATE_UID = user.uid; PRIVATE_DB = firebase.firestore();
    try { await flagDoc().get(); }
    catch (e) { console.error("Can't reach your saved data; saving in this browser only:", e); alert("Signed in, but your saved data can't be reached (" + (e.code || e.message || e) + "). Saving in this browser only."); return; }
    const local = { flags: FLAGS.slice(), sec: SEC_FLAGS.slice(), solved: Object.assign({}, SOLVED), answers: Object.assign({}, ANSWERS), todos: TODOS.slice(), cal: CAL.slice() };
    await Promise.all([loadDbFlags(), loadDbSecFlags(), loadDbSolved(), loadDbAnswers(), loadDbTodos(), loadDbCal()]);
    PRIVATE_OK = true;
    try { await mergeLocal(local); }
    catch (e) { console.error("Copying this browser's data into your account failed; it stays here:", e); }
    undoReset();
    route();
  });
}
/* Adds items saved in this browser that the account doesn't have yet. */
async function mergeLocal(local) {
  const add = (cur, old, key) => {
    const have = new Set(cur.map(x => x[key])), extra = old.filter(x => !have.has(x[key]));
    cur.push(...extra);
    return extra.length;
  };
  const writes = [];
  if (add(FLAGS, local.flags, "snip")) writes.push(flagDoc().set({ flags: FLAGS.map(f => Object.assign({}, f)) }));
  if (add(SEC_FLAGS, local.sec, "key")) writes.push(secFlagDoc().set({ flags: SEC_FLAGS.map(f => Object.assign({}, f)) }));
  if (add(TODOS, local.todos, "id")) writes.push(todoDoc().set({ todos: TODOS.map(t => Object.assign({}, t)) }));
  if (add(CAL, local.cal, "id")) writes.push(calDoc().set({ items: CAL.map(t => Object.assign({}, t)) }));
  const newSolved = Object.keys(local.solved).filter(k => !SOLVED[k]);
  if (newSolved.length) { newSolved.forEach(k => { SOLVED[k] = local.solved[k]; }); writes.push(solvedDoc().set({ solved: Object.assign({}, SOLVED) })); }
  for (const [snip, v] of Object.entries(local.answers)) {
    if (ANSWERS[snip] || !v || (!v.text && !v.fb)) continue;
    ANSWERS[snip] = Object.assign({ snip }, v);
    writes.push(ansCol().doc(ansId(snip)).set(Object.assign({}, ANSWERS[snip])));
  }
  await Promise.all(writes);
  for (const k of [FLAG_KEY, SEC_FLAG_KEY, SOLVED_KEY, ANS_KEY, TODO_KEY, CAL_KEY]) try { localStorage.removeItem(k); } catch (e) {}
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

/* Home-page tabs: the first is the default page at #/, the rest live at #/t/<id>. */
const tabHref = t => t === TABS[0] ? "#/" : "#/t/" + t.id;
function renderHome(tab = TABS[0]) {
  menuBtn.classList.remove("show");
  app.innerHTML = `
  <div class="wrap">
    <section class="intro">
      <h1>All Knowledge</h1>
      <p>From transistors to workloads, laid out like a die. <a href="#/drill">Drill a random question</a> or <a href="#/review">review what you've flagged</a>.</p>
    </section>
    <nav class="home-tabs" aria-label="Topics">${TABS.map(t =>
      `<a class="home-tab" href="${tabHref(t)}"${t === tab ? ' aria-current="page"' : ""}>${t.name}</a>`).join("")}</nav>
    <section class="results" id="results" aria-live="polite" hidden></section>
    ${tab.id === "arch" && typeof floorplanSVG === "function" ? floorplanSVG() : ""}
    ${tab.id === "chip" && typeof stackHTML === "function" ? stackHTML() : ""}
    <div class="die"><div class="floor" data-tab="${tab.id}">
      ${REGIONS.filter(r => tab.regions.includes(r.id)).map(r => `
        <section class="block" style="grid-area:${r.id}" data-region="${r.id}">
          <h2><a href="#/r/${r.id}">${r.name}</a></h2>
          <p class="cap">${r.cap}</p>
          <ul>${NOTES.filter(n => n.region === r.id).map(n =>
            `<li data-id="${n.id}"><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
        </section>`).join("")}
    </div></div>
    <p class="empty" id="empty" hidden>No notes match that search. Try a shorter term.</p>
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
    ${REGIONS.map(r => {
      const tab = TABS.find(t => t.regions[0] === r.id);
      const isCurR = curId === "r/" + r.id;
      return `${tab ? `<p class="tab-label">${tab.name}</p>` : ""}<div class="grp">
      <a class="rg ${isCurR && !curSec ? "cur" : ""}" href="#/r/${r.id}">${r.name}</a>
      ${isCurR ? subFor(r, "r/" + r.id) : ""}
      <ul>${r.id === "intv" ? `<li><a class="${curId === "drill" ? "cur" : ""}" href="#/drill">Random Drill</a></li>` : ""}${NOTES.filter(n => n.region === r.id).map(n =>
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
  if (typeof initAnims === "function") initAnims(app);
  decorateGlossary(curId);
  typesetMath();
}

/* ---------- Glossary hover cards (terms in js/glossary.js) ----------
   Wraps the first use of each term on a page; skips code, links,
   headings, and math (including inline TeX in plain text). */
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
  /* Blank out inline TeX so a term inside \( \) or \[ \] stays unwrapped for MathJax. */
  const unmath = s => s.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, x => " ".repeat(x.length));
  for (let t of nodes) {
    let m;
    while (t && (m = unmath(t.data).match(GL_RE))) {
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
  for (const n of NOTES.filter(x => x.region === "intv")) {
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
  return page && page.id !== "intv" && page.region !== "intv" ? page : null;
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
  for (const r of REGIONS) fromPractice("r/" + r.id, r.name, r.id, r.practice);
  for (const n of NOTES) fromPractice(n.id, n.title, n.region, n.practice);
  for (const c of flagIndex()) {
    const lvl = (c.html.match(/class="lvl (easy|medium|hard)"/) || [])[1] || "";
    add(c.note.id, c.note.title, "intv", c.html, lvl);
  }
  return DRILL_POOL;
}

let DRILL = { region: "", level: "", unsolved: true };
function renderDrill() {
  const pool = drillPool();
  const regions = REGIONS.filter(r => pool.some(c => c.region === r.id));
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
  for (const r of REGIONS) {
    order.push({ base: "r/" + r.id, title: r.name });
    for (const n of NOTES.filter(n => n.region === r.id)) order.push({ base: n.id, title: n.title });
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
  for (const n of NOTES.filter(x => x.region === "intv")) {
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

/* ---------- The to-do list ----------
   Its own section in the Interview Prep tab, at #/r/todo. Like flags, the
   owner's items live in the private db and everyone else's in this browser.
   Done items move to their own list below until cleared, nested items with them. */
const TODO_KEY = "intv-todos";
let TODOS = [], TODO_SAVE = Promise.resolve();
try { TODOS = JSON.parse(localStorage.getItem(TODO_KEY) || "[]"); } catch (e) { TODOS = []; }
if (!Array.isArray(TODOS)) TODOS = [];
const todoDoc = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + TODO_KEY);
async function loadDbTodos() {
  try {
    const snap = await todoDoc().get();
    const t = snap.exists ? (snap.data() || {}).todos : null;
    TODOS = Array.isArray(t) ? t.slice() : [];
  } catch (e) { console.error("To-do list failed to load; using this browser's copy:", e); }
}
function saveTodos(quiet) {
  if (!quiet) undoNote();
  const copy = TODOS.map(t => Object.assign({}, t));
  if (PRIVATE_OK) {
    TODO_SAVE = TODO_SAVE.then(() => todoDoc().set({ todos: copy })).catch(e => console.error("Saving the to-do list failed:", e));
    return;
  }
  try { localStorage.setItem(TODO_KEY, JSON.stringify(copy)); } catch (e) {}
}
/* Items nest up to TODO_MAX_DEPTH layers (top-level items are layer 1). A
   nested item carries `parent` (its parent's id). Items without one, or whose
   parent is gone, are top-level, so lists saved before nesting existed load
   unchanged. Display order is array order among an item's siblings. */
const TODO_MAX_DEPTH = 8, TODO_INDENT = 26;
const todoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function todoTree(list = TODOS) {
  const byId = new Map(list.map(t => [t.id, t])), kids = new Map(), par = new Map(), roots = [];
  for (const t of list) {
    let p = t.parent ? byId.get(t.parent) : null;
    /* A parent chain that loops back to t (only possible in damaged data) makes t top-level. */
    for (let a = p, n = 0; a && n < list.length; a = a.parent ? byId.get(a.parent) : null, n++) if (a === t) { p = null; break; }
    par.set(t.id, p || null);
    if (p) { if (!kids.has(p.id)) kids.set(p.id, []); kids.get(p.id).push(t); } else roots.push(t);
  }
  const kidsOf = id => kids.get(id) || [];
  const height = t => 1 + Math.max(0, ...kidsOf(t.id).map(height));
  const below = t => kidsOf(t.id).flatMap(k => [k.id, ...below(k)]);
  return { roots, kidsOf, par: id => par.get(id), height, below };
}
/* Removes the items and everything nested under them. */
function todoDrop(ids) {
  const tr = todoTree(), gone = new Set();
  for (const id of ids) { const t = TODOS.find(x => x.id === id); if (t) { gone.add(id); tr.below(t).forEach(k => gone.add(k)); } }
  TODOS = TODOS.filter(t => !gone.has(t.id));
}
/* Tab nests t under the item above it in its layer (as that item's last
   sub-item), and Shift+Tab moves it out to just below its parent. Either way
   it keeps everything under it, and a move past TODO_MAX_DEPTH layers is
   refused. `peer(a, b)` says whether two top-level items share a list (the
   open or Done list, or a calendar day). Returns whether t moved. */
function todoShift(list, t, out, peer) {
  const tr = todoTree(list), p = tr.par(t.id);
  if (out) {
    if (!p) return false;
    list.splice(list.indexOf(t), 1);
    if (tr.par(p.id)) t.parent = tr.par(p.id).id; else delete t.parent;
    list.splice(list.indexOf(p) + 1, 0, t);
    return true;
  }
  const sibs = p ? tr.kidsOf(p.id) : tr.roots.filter(r => peer(r, t)), above = sibs[sibs.indexOf(t) - 1];
  let depth = 1;
  for (let a = p; a; a = tr.par(a.id)) depth++;
  if (!above || depth + tr.height(t) > TODO_MAX_DEPTH) return false;
  list.splice(list.indexOf(t), 1);
  t.parent = above.id;
  list.push(t);
  return true;
}
/* Item text boxes are textareas that grow to fit, so long items wrap and
   stay fully visible. Pasted line breaks become spaces. */
const todoClean = s => s.replace(/\s+/g, " ").trim();
function fitText(root) {
  root.querySelectorAll("textarea.todo-text:not(.cal-new)").forEach(el => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + el.offsetHeight - el.clientHeight + "px";
  });
}
window.addEventListener("resize", () => fitText(app));
/* Leaving a text box saves at once, but the re-render waits until the click
   that moved focus away has landed, so that click isn't lost. `fn` gets the
   element that has focus by then (or the blur's relatedTarget). */
let TODO_PTR = false;
document.addEventListener("pointerdown", () => { TODO_PTR = true; }, true);
document.addEventListener("pointerup", () => setTimeout(() => { TODO_PTR = false; }), true);
function afterClick(e, fn) {
  const go = () => { const a = document.activeElement; fn(a && a !== document.body ? a : e.relatedTarget); };
  if (!TODO_PTR) return go();
  document.addEventListener("pointerup", () => setTimeout(go), { once: true, capture: true });
}
/* Where focus should land after the to-do list re-renders: "form", an item's id, or null. */
const todoFocusKey = el => !el || !app.contains(el) ? null : el.closest("#todoForm") ? "form" :
  el.classList.contains("todo-text") && el.closest(".todo-item") ? el.closest(".todo-item").dataset.id : null;
/* Keys in a to-do text box, the same on the to-do list and the calendar:
   - Enter with text: `next` adds or saves the item and moves to the next box.
   - Escape with text: `save` adds or saves the item, and the box is left.
   - Enter or Escape in an empty box just leaves it. */
function todoKeys(i, save, next) {
  i.addEventListener("keydown", e => {
    if ((e.key !== "Enter" && e.key !== "Escape") || e.isComposing) return;
    e.preventDefault();
    if (!i.value.trim()) return i.blur();
    if (e.key === "Enter") return next();
    save(); i.blur();
  });
}
const todoRow = (t, depth) => `<div class="todo-row">
  <span class="todo-grip" title="Drag to move" aria-hidden="true">⠿</span>
  <input type="checkbox" class="todo-check" aria-label="Done"${t.done ? " checked" : ""}>
  <textarea class="todo-text" rows="1" aria-label="${depth > 1 ? "Sub-item" : "To-do item"}">${esc(t.text)}</textarea>
  ${depth < TODO_MAX_DEPTH ? '<button type="button" class="todo-addsub" aria-label="Add a sub-item" title="Add a sub-item">+</button>' : ""}
  <button type="button" class="todo-del" aria-label="Delete this item">✕</button></div>`;
const todoItem = (tr, t, depth) => {
  const kids = tr.kidsOf(t.id);
  return `<li class="todo-item ${depth > 1 ? "todo-sub" : "todo-main"}${t.done ? " done" : ""}" data-id="${esc(t.id)}" data-depth="${depth}">${todoRow(t, depth)}${kids.length ?
    `<ul class="todo-subs">${kids.map(k => todoItem(tr, k, depth + 1)).join("")}</ul>` : ""}</li>`;
};
function renderTodo(focusId) {
  const tr = todoTree(), open = tr.roots.filter(t => !t.done), done = tr.roots.filter(t => t.done);
  const list = (items, isDone) => `<ul class="todo-list" data-done="${isDone ? 1 : 0}">${items.map(t => todoItem(tr, t, 1)).join("")}`;
  layout("r/todo", null, `
    <p class="region">Section Overview</p>
    <h1>To-Do List</h1>
    <p class="flag-note">${open.length} open, ${done.length} done. ${PRIVATE_OK ? "Saved to your account." : "Saved in this browser only."} Drag ⠿ to move an item with everything under it, and + adds a sub-item (up to ${TODO_MAX_DEPTH} layers). Tab nests an item under the one above it, and Shift+Tab moves it back out.</p>
    <form class="todo-add" id="todoForm">
      <input type="text" name="text" class="todo-text" aria-label="New to-do item" placeholder="Add a to-do item" autocomplete="off">
      <button type="submit" class="chip-zoom">Add</button>
      ${UNDO_BTN}
    </form>
    ${list(open, false)}${open.length ? "" : '<li class="todo-empty">Nothing to do yet.</li>'}</ul>
    ${done.length ? `<p class="rev-page">Done</p>${list(done, true)}</ul>
    <button type="button" class="chip-zoom" id="todoClear">Clear done</button>` : ""}`);
  const form = document.getElementById("todoForm");
  const addNew = (stay, blur) => {
    const text = todoClean(form.text.value);
    if (!text || form.text.dataset.used) return;
    form.text.dataset.used = 1;
    TODOS.push({ id: todoId(), text, done: false });
    saveTodos();
    if (blur) return afterClick(blur, el => renderTodo(todoFocusKey(el)));
    renderTodo(stay ? "form" : null);
  };
  form.addEventListener("submit", e => { e.preventDefault(); addNew(true); });
  todoKeys(form.text, () => addNew(false), () => addNew(true));
  /* Typing in the box and clicking anywhere else adds the item too. */
  form.text.addEventListener("blur", e => addNew(false, e));
  const find = el => TODOS.find(t => t.id === el.closest(".todo-item").dataset.id);
  /* A new item right after `after` in its layer, or the last sub-item of `parent` (null for the top layer). */
  const addSub = (parent, after) => {
    const t = Object.assign({ id: todoId(), text: "", done: false }, parent ? { parent: parent.id } : {});
    if (after) TODOS.splice(TODOS.indexOf(after) + 1, 0, t); else TODOS.push(t);
    renderTodo(t.id);
  };
  app.querySelectorAll(".todo-check").forEach(c => c.addEventListener("change", () => { find(c).done = c.checked; saveTodos(); renderTodo(); }));
  app.querySelectorAll(".todo-item .todo-text").forEach(i => {
    i.addEventListener("input", () => fitText(i.parentElement));
    i.addEventListener("change", () => { const t = find(i), text = todoClean(i.value); if (t && text) { t.text = text; saveTodos(); } });
    /* An emptied item goes away when it loses focus, unless it still has sub-items. */
    i.addEventListener("blur", e => {
      const t = find(i);
      if (!t || i.value.trim() || i.dataset.shifting) return;
      if (todoTree().kidsOf(t.id).length) { i.value = t.text; fitText(i.parentElement); return; }
      todoDrop([t.id]); saveTodos();
      if (i.closest(".todo-sub")) { const ul = i.closest(".todo-subs"); i.closest(".todo-item").remove(); if (ul && !ul.children.length) ul.remove(); }
      else afterClick(e, el => renderTodo(todoFocusKey(el)));
    });
    /* Enter starts the next item in the same layer (a done top-level item is just saved and left). */
    const save = () => { const t = find(i); if (t) { t.text = todoClean(i.value); saveTodos(); } fitText(i.parentElement); };
    todoKeys(i, save, () => {
      const t = find(i), p = t && todoTree().par(t.id);
      save();
      if (p || (t && !t.done)) addSub(p, t); else i.blur();
    });
    i.addEventListener("keydown", e => {
      if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      const t = find(i);
      if (!t) return;
      save(); i.dataset.shifting = 1;
      if (todoShift(TODOS, t, e.shiftKey, (a, b) => !a.done === !b.done)) { saveTodos(); renderTodo(t.id); }
    });
  });
  app.querySelectorAll(".todo-addsub").forEach(b => b.addEventListener("click", () => addSub(find(b))));
  app.querySelectorAll(".todo-del").forEach(b => b.addEventListener("click", () => { todoDrop([find(b).id]); saveTodos(); renderTodo(); }));
  const clear = document.getElementById("todoClear");
  if (clear) clear.addEventListener("click", () => { todoDrop(TODOS.filter(t => t.done).map(t => t.id)); saveTodos(); renderTodo(); });
  app.querySelectorAll(".todo-grip").forEach(g => g.addEventListener("pointerdown", e => todoDrag(e, g)));
  fitText(app); undoButtons();
  if (focusId) { const el = focusId === "form" ? form.text : app.querySelector(`.todo-item[data-id="${focusId}"] .todo-text`); if (el) el.focus(); }
}
/* Drag by the grip (pointer events, so touch works too). The item moves with
   everything under it, which keeps its layers relative to the item, and the
   drop is refused if that would go past TODO_MAX_DEPTH layers.
   - Upper half of a row: drop just above that item, in its layer.
   - Lower half of a row with sub-items: drop as its first sub-item.
   - Lower half of a row without sub-items: drop below it, and the pointer's
     left-right position picks the layer, from one deeper (its sub-item) out to
     any layer the row ends. A top-level drop has to stay in its own list
     (open or Done). */
function todoDrag(e, grip) {
  if (e.button !== 0) return;
  e.preventDefault();
  const li = grip.closest(".todo-item"), tr = todoTree(), byId = id => TODOS.find(x => x.id === id);
  const d = byId(li.dataset.id);
  if (!d) return;
  const h = tr.height(d), maxDepth = TODO_MAX_DEPTH - h + 1;
  const line = document.createElement("div");
  line.className = "todo-drop-line";
  let drop = null;
  const show = (x0, x1, y) => { Object.assign(line.style, { left: x0 + "px", width: Math.max(0, x1 - x0) + "px", top: y - 1 + "px" }); if (!line.isConnected) document.body.appendChild(line); };
  const none = () => { drop = null; line.remove(); };
  const move = ev => {
    if (ev.clientY < 40) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 40) window.scrollBy(0, 12);
    const el = document.elementFromPoint(ev.clientX, ev.clientY), row = el && el.closest(".todo-row");
    if (!row) {
      /* Just below a list: the very bottom of layer 1 in that list. */
      const ul = [...app.querySelectorAll(".todo-list")].find(u => {
        const b = u.getBoundingClientRect();
        return ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.bottom - 4 && ev.clientY <= b.bottom + 40;
      });
      if (!ul || String(d.done ? 1 : 0) !== ul.dataset.done) return none();
      const b = ul.getBoundingClientRect(), roots = tr.roots.filter(t => t !== d && String(t.done ? 1 : 0) === ul.dataset.done);
      drop = roots.length ? { parent: null, ref: roots[roots.length - 1], at: "after", depth: 1 } : { parent: null, ref: null, at: "into", depth: 1 };
      return show(b.left, b.right, b.bottom);
    }
    if (!app.contains(row) || li.contains(row)) return none();
    const rli = row.parentElement, r = byId(rli.dataset.id), dr = +rli.dataset.depth;
    const ul = rli.closest(".todo-list"), base = ul.getBoundingClientRect(), box = row.getBoundingClientRect();
    if (!r) return none();
    /* The dragged item leaves its old place, so it never counts as a neighbor. */
    const kidsOf = id => tr.kidsOf(id).filter(k => k !== d), rk = kidsOf(r.id);
    let next;
    if (ev.clientY < box.top + box.height / 2) next = { parent: tr.par(r.id), ref: r, at: "before", depth: dr, y: box.top };
    else if (rk.length) next = { parent: r, ref: rk[0], at: "before", depth: dr + 1, y: box.bottom };
    else {
      /* Layers open below r: r's sub-item, r's layer, and each ancestor's layer while r ends it. */
      const opts = [{ parent: r, ref: null, at: "into", depth: dr + 1 }];
      for (let a = r, da = dr; a; da--) {
        const p = tr.par(a.id);
        opts.push({ parent: p, ref: a, at: "after", depth: da });
        const sibs = p ? kidsOf(p.id) : [];
        if (!p || sibs[sibs.length - 1] !== a) break;
        a = p;
      }
      const want = Math.round((ev.clientX - base.left - 8) / TODO_INDENT) + 1;
      const ok = opts.filter(o => o.depth <= maxDepth);
      if (!ok.length) return none();
      next = ok.reduce((b, o) => Math.abs(o.depth - want) < Math.abs(b.depth - want) ? o : b);
      next.y = box.bottom;
    }
    if (next.depth > maxDepth) return none();
    if (!next.parent && String(d.done ? 1 : 0) !== ul.dataset.done) return none();
    drop = next;
    show(base.left + (next.depth - 1) * TODO_INDENT, base.right, next.y);
  };
  const end = ev => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", end);
    li.classList.remove("dragging");
    const p = drop; none();
    if (ev.type !== "pointerup" || !p) return;
    TODOS.splice(TODOS.indexOf(d), 1);
    if (p.parent) d.parent = p.parent.id; else delete d.parent;
    TODOS.splice(p.at === "into" ? TODOS.length : TODOS.indexOf(p.ref) + (p.at === "after" ? 1 : 0), 0, d);
    saveTodos(); renderTodo();
  };
  grip.setPointerCapture(e.pointerId);
  li.classList.add("dragging");
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}

/* ---------- The calendar ----------
   Its own section in the Interview Prep tab, at #/r/cal: a month or a week
   in 7-day weeks (Sunday first). Each day holds to-do items with the to-do
   list's rules (nesting up to TODO_MAX_DEPTH layers, + for a sub-item, Enter
   for the next item in a layer, drag by ⠿), except that done items stay in
   place. An item carries `day` (YYYY-MM-DD) and saves like the to-do list.
   - "Copy from To-Do List" opens that list in a panel on the right. Dragging
     between the panel and a day copies the item, with everything under it,
     either way, and the side it came from stays as it is.
   - "Carry Over" moves unfinished items from past days to today.
   - Tab and Shift+Tab nest an item or move it out (todoShift).
   - Alt+Arrow moves to the next or previous day (← →) or week (↑ ↓), and
     Alt+Shift+Arrow copies the item there. */
const CAL_KEY = "intv-calendar", CAL_INDENT = 14;
let CAL = [], CAL_SAVE = Promise.resolve(), CAL_DATE = null, CAL_VIEW = "month", CAL_PANEL = false;
try { CAL = JSON.parse(localStorage.getItem(CAL_KEY) || "[]"); } catch (e) { CAL = []; }
if (!Array.isArray(CAL)) CAL = [];
/* ---------- Undo ----------
   Every save of the to-do list or the calendar records the state before it,
   so Undo steps back one change at a time (additions, deletions, moves,
   checks, edits), with one history for both, since a calendar drag can add
   to the to-do list. Ctrl+Z undoes too, outside a text box or in an empty
   new-item box (anywhere else it's the box's own text undo). Signing in
   starts the history over. */
const UNDO_MAX = 100;
let UNDO = [], UNDO_LAST = null;
const UNDO_BTN = `<button type="button" class="chip-zoom undo-btn" title="Undo the last change (Ctrl+Z)">↶ Undo</button>`;
const undoState = () => JSON.stringify({ todos: TODOS, cal: CAL });
function undoButtons() { document.querySelectorAll(".undo-btn").forEach(b => { b.disabled = !UNDO.length; }); }
function undoNote() {
  const s = undoState();
  if (UNDO_LAST !== null && s !== UNDO_LAST) { UNDO.push(UNDO_LAST); if (UNDO.length > UNDO_MAX) UNDO.shift(); }
  UNDO_LAST = s;
  undoButtons();
}
function undoReset() { UNDO = []; UNDO_LAST = undoState(); }
function undo() {
  if (!UNDO.length) return;
  const s = UNDO.pop(), o = JSON.parse(s), a = document.activeElement;
  TODOS = o.todos; CAL = o.cal; UNDO_LAST = s;
  saveTodos(true); saveCal(true);
  if (document.getElementById("todoForm")) renderTodo(todoFocusKey(a));
  else if (app.querySelector(".cal-grid")) renderCal(calFocusKey(a));
}
undoReset();
app.addEventListener("click", e => { if (e.target.closest(".undo-btn")) undo(); });
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
  if (!document.getElementById("todoForm") && !app.querySelector(".cal-grid")) return;
  const box = e.target.closest && e.target.closest("input, textarea");
  if (box && !((box.classList.contains("cal-new") || box.closest("#todoForm")) && !box.value)) return;
  e.preventDefault(); undo();
});
const calDoc = () => PRIVATE_DB.doc("data/users/" + PRIVATE_UID + "/" + CAL_KEY);
async function loadDbCal() {
  try {
    const snap = await calDoc().get();
    const t = snap.exists ? (snap.data() || {}).items : null;
    CAL = Array.isArray(t) ? t.slice() : [];
  } catch (e) { console.error("Calendar failed to load; using this browser's copy:", e); }
}
function saveCal(quiet) {
  if (!quiet) undoNote();
  const copy = CAL.map(t => Object.assign({}, t));
  if (PRIVATE_OK) {
    CAL_SAVE = CAL_SAVE.then(() => calDoc().set({ items: copy })).catch(e => console.error("Saving the calendar failed:", e));
    return;
  }
  try { localStorage.setItem(CAL_KEY, JSON.stringify(copy)); } catch (e) {}
}
const calDay = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const calDate = day => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); };
const calShift = (day, n) => { const d = calDate(day); d.setDate(d.getDate() + n); return calDay(d); };
/* Removes the items and everything nested under them. */
function calDrop(ids) {
  const tr = todoTree(CAL), gone = new Set();
  for (const id of ids) { const t = CAL.find(x => x.id === id); if (t) { gone.add(id); tr.below(t).forEach(k => gone.add(k)); } }
  CAL = CAL.filter(t => !gone.has(t.id));
}
/* Copies d and everything under it out of `list` with fresh ids, root first.
   The root comes back top-level, and `extra` is merged into every copy. */
function todoClone(list, d, extra) {
  const tr = todoTree(list), ids = new Map([d.id, ...tr.below(d)].map(id => [id, todoId()]));
  return [d, ...list.filter(t => t !== d && ids.has(t.id))].map(t =>
    Object.assign({ id: ids.get(t.id), text: t.text, done: !!t.done }, t === d ? {} : { parent: ids.get(t.parent) }, extra));
}
/* Unfinished top-level items on days before today, oldest day first. */
const calOverdue = today => todoTree(CAL).roots.filter(t => !t.done && t.day < today).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
/* Where focus should land after a re-render: an item's id, or "new:<day>" for a day's blank line. */
const calFocusKey = el => !el || !app.contains(el) ? null :
  el.classList.contains("cal-new") ? "new:" + el.closest(".cal-day").dataset.day :
  el.classList.contains("todo-text") && el.closest(".cal-list") ? el.closest(".todo-item").dataset.id : null;
/* The to-do list as the panel shows it: read-only, with grips to copy from. */
const calPanelItem = (tr, t, depth) => {
  const kids = tr.kidsOf(t.id);
  return `<li class="todo-item ${depth > 1 ? "todo-sub" : "todo-main"}${t.done ? " done" : ""}" data-id="${esc(t.id)}" data-depth="${depth}"><div class="todo-row">
    <span class="todo-grip" title="Drag into a day to copy" aria-hidden="true">⠿</span>
    <input type="checkbox" class="todo-check" aria-label="Done" disabled${t.done ? " checked" : ""}>
    <span class="todo-text">${esc(t.text)}</span></div>${kids.length ?
    `<ul class="todo-subs">${kids.map(k => calPanelItem(tr, k, depth + 1)).join("")}</ul>` : ""}</li>`;
};
function renderCal(focus) {
  const today = calDay(new Date()), at = CAL_DATE ? calDate(CAL_DATE) : calDate(today);
  const y = at.getFullYear(), m = at.getMonth(), week = CAL_VIEW === "week";
  /* The month view shows every week that touches the month, the week view the week holding CAL_DATE. */
  const first = week ? new Date(y, m, at.getDate() - at.getDay()) : new Date(y, m, 1 - new Date(y, m, 1).getDay());
  const days = week ? 7 : Math.ceil((new Date(y, m, 1).getDay() + new Date(y, m + 1, 0).getDate()) / 7) * 7;
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 6);
  const md = d => d.toLocaleString("en-US", { month: "short", day: "numeric" });
  const label = !week ? at.toLocaleString("en-US", { month: "long", year: "numeric" }) :
    md(first) + " – " + (last.getMonth() === first.getMonth() ? last.getDate() : md(last)) + ", " + last.getFullYear();
  const tr = todoTree(CAL), cells = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i), day = calDay(dt);
    /* A day is at least 4 lines tall (8 in the week view, CSS). The blank box
       under its items fills what's left and keeps at least one line, so a day
       grows as its items (wrapped lines included) fill it, and the whole week
       grows with it. */
    const roots = tr.roots.filter(t => t.day === day);
    cells.push(`<div class="cal-day${!week && dt.getMonth() !== m ? " out" : ""}${day === today ? " today" : ""}" data-day="${day}">
      <div class="cal-date">${week ? md(dt) : dt.getDate()}</div>
      <div class="cal-body"><ul class="cal-list">${roots.map(t => todoItem(tr, t, 1)).join("")}</ul>
      <textarea class="todo-text cal-new" rows="1" aria-label="New item for ${day}"></textarea></div></div>`);
  }
  const overdue = calOverdue(today).length;
  const ttr = todoTree(TODOS), open = ttr.roots.filter(t => !t.done), done = ttr.roots.filter(t => t.done);
  const plist = (items, isDone) => `<ul class="todo-list" data-done="${isDone ? 1 : 0}">${items.map(t => calPanelItem(ttr, t, 1)).join("")}</ul>`;
  layout("r/cal", null, `
    <p class="region">Section Overview</p>
    <h1>Calendar</h1>
    <p class="flag-note">${PRIVATE_OK ? "Saved to your account." : "Saved in this browser only."} Type on a day's lines to add an item. Enter adds it and moves to the next line, and Escape adds it and leaves the box. Drag ⠿ to move an item with everything under it, and + adds a sub-item (up to ${TODO_MAX_DEPTH} layers).</p>
    <ul class="flag-note cal-keys">
      <li>Alt+← / Alt+→ moves to the previous or next day, and Alt+↑ / Alt+↓ to the previous or next week.</li>
      <li>Alt+Shift+Arrow copies the item you're in (with everything under it) to that day, and moves you to the copy, so pressing it again repeats it.</li>
      <li>Tab nests an item under the one above it, and Shift+Tab moves it back out.</li>
      <li>↑ at the start of a box or ↓ at its end moves between the boxes in a day.</li>
    </ul>
    <div class="cal-bar">
      <button type="button" class="chip-zoom" id="calCopy" aria-pressed="${CAL_PANEL}">Copy from To-Do List</button>
      <button type="button" class="chip-zoom" id="calCarry" title="Move unfinished items from past days to today"${overdue ? "" : " disabled"}>Carry Over${overdue ? ` (${overdue})` : ""}</button>
      ${UNDO_BTN}
      <div class="cal-nav">
        <button type="button" class="chip-zoom" id="calMonth" aria-pressed="${!week}">Month</button>
        <button type="button" class="chip-zoom" id="calWeek" aria-pressed="${week}">Week</button>
        <button type="button" class="chip-zoom" id="calPrev" aria-label="Previous ${week ? "week" : "month"}">‹</button>
        <span class="cal-month">${label}</span>
        <button type="button" class="chip-zoom" id="calNext" aria-label="Next ${week ? "week" : "month"}">›</button>
        <button type="button" class="chip-zoom" id="calToday">Today</button>
      </div>
    </div>
    <div class="cal-scroll"><div class="cal-grid${week ? " cal-week" : ""}">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="cal-head">${d}</div>`).join("")}
      ${cells.join("")}
    </div></div>
    ${CAL_PANEL ? `<aside class="cal-panel" aria-label="To-Do List">
      <div class="cal-panel-head"><h2>To-Do List</h2><button type="button" class="todo-del" id="calClose" aria-label="Close the to-do list">✕</button></div>
      <p class="flag-note">Drag ⠿ to copy an item, with everything under it, into a day, or drag a day's item here to copy it into the to-do list. The side it came from stays as it is. Escape closes this panel.</p>
      ${plist(open, false)}${open.length ? "" : '<p class="todo-empty">Nothing to do yet.</p>'}
      ${done.length ? `<p class="rev-page">Done</p>${plist(done, true)}` : ""}
    </aside>` : ""}`);
  const page = app.querySelector(".page");
  page.classList.add("cal-page");
  page.classList.toggle("panel-open", CAL_PANEL);
  page.classList.toggle("week-view", week);
  const go = n => () => {
    CAL_DATE = n === null ? null : week ? calShift(calDay(at), 7 * n) : calDay(new Date(y, m + n, 1));
    renderCal();
  };
  document.getElementById("calPrev").addEventListener("click", go(-1));
  document.getElementById("calNext").addEventListener("click", go(1));
  document.getElementById("calToday").addEventListener("click", go(null));
  const view = v => () => { CAL_VIEW = v; renderCal(); };
  document.getElementById("calMonth").addEventListener("click", view("month"));
  document.getElementById("calWeek").addEventListener("click", view("week"));
  document.getElementById("calCopy").addEventListener("click", () => { CAL_PANEL = !CAL_PANEL; renderCal(); });
  document.getElementById("calCarry").addEventListener("click", () => {
    const tr = todoTree(CAL), moving = calOverdue(today);
    for (const t of moving) [t.id, ...tr.below(t)].forEach(id => { CAL.find(x => x.id === id).day = today; });
    /* At the end of today, in the order they were due. */
    CAL = CAL.filter(t => !moving.includes(t)).concat(moving);
    saveCal(); renderCal();
  });
  const close = document.getElementById("calClose");
  if (close) close.addEventListener("click", () => { CAL_PANEL = false; renderCal(); });
  const find = el => CAL.find(t => t.id === el.closest(".todo-item").dataset.id);
  /* A new item right after `after` in its layer, or the last sub-item of `parent`. */
  const addItem = (day, parent, after) => {
    const t = Object.assign({ id: todoId(), day, text: "", done: false }, parent ? { parent: parent.id } : {});
    if (after) CAL.splice(CAL.indexOf(after) + 1, 0, t); else CAL.push(t);
    renderCal(t.id);
  };
  app.querySelectorAll(".cal-new").forEach(i => {
    const day = i.closest(".cal-day").dataset.day;
    const add = (next, blur) => {
      const text = todoClean(i.value);
      if (!text || i.dataset.used) return;
      i.dataset.used = 1;
      CAL.push({ id: todoId(), day, text, done: false });
      saveCal();
      if (blur) return afterClick(blur, el => renderCal(calFocusKey(el)));
      renderCal(next);
    };
    /* Typing a long item grows the box, so the whole item stays visible. */
    i.addEventListener("input", () => {
      i.style.minHeight = "";
      const flex = i.style.flex;
      i.style.flex = "none"; i.style.height = "auto";
      const h = i.scrollHeight;
      i.style.flex = flex; i.style.height = "";
      i.style.minHeight = h + "px";
    });
    todoKeys(i, () => add(null), () => add("new:" + day));
    /* Typing on a line and clicking anywhere else adds the item too. */
    i.addEventListener("blur", e => add(null, e));
  });
  app.querySelectorAll(".cal-list .todo-check").forEach(c => c.addEventListener("change", () => { find(c).done = c.checked; saveCal(); renderCal(); }));
  app.querySelectorAll(".cal-list .todo-text").forEach(i => {
    i.addEventListener("input", () => fitText(i.parentElement));
    i.addEventListener("change", () => { const t = find(i), text = todoClean(i.value); if (t && text) { t.text = text; saveCal(); } });
    /* An emptied item goes away when it loses focus, unless it still has sub-items. */
    i.addEventListener("blur", e => {
      const t = find(i);
      if (!t || i.value.trim() || i.dataset.shifting) return;
      if (todoTree(CAL).kidsOf(t.id).length) { i.value = t.text; fitText(i.parentElement); return; }
      calDrop([t.id]); saveCal(); afterClick(e, el => renderCal(calFocusKey(el)));
    });
    /* Enter starts the next item in the same layer. */
    const save = () => { const t = find(i); if (t) { t.text = todoClean(i.value); saveCal(); } fitText(i.parentElement); };
    todoKeys(i, save, () => { const t = find(i); save(); if (t) addItem(t.day, todoTree(CAL).par(t.id), t); });
    i.addEventListener("keydown", e => {
      if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      const t = find(i);
      if (!t) return;
      save(); i.dataset.shifting = 1;
      if (todoShift(CAL, t, e.shiftKey, (a, b) => a.day === b.day)) { saveCal(); renderCal(t.id); }
    });
  });
  /* Keys between days. The box's text is saved first, since the re-render replaces it. */
  app.querySelector(".cal-grid").addEventListener("keydown", e => {
    const box = e.target.closest("textarea"), cell = box && box.closest(".cal-day");
    if (!cell || e.ctrlKey || e.metaKey || e.isComposing) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    if (!e.altKey) {
      /* ↑ at the very start or ↓ at the very end of a box: the previous or next box in the day. */
      if (e.shiftKey || step === 1 || step === -1) return;
      const boxes = [...cell.querySelectorAll("textarea")], k = boxes.indexOf(box) + (step < 0 ? -1 : 1);
      const edge = step < 0 ? box.selectionStart === 0 && box.selectionEnd === 0 : box.selectionStart === box.value.length;
      if (!edge || !boxes[k]) return;
      e.preventDefault(); boxes[k].focus();
      return;
    }
    e.preventDefault();
    const to = calShift(cell.dataset.day, step), text = todoClean(box.value);
    let t = box.classList.contains("cal-new") ? null : find(box);
    if (t && text) t.text = text;
    if (!t && text && !box.dataset.used) {
      box.dataset.used = 1;
      t = { id: todoId(), day: cell.dataset.day, text, done: false };
      CAL.push(t);
    }
    let key = "new:" + to;
    /* Alt+Shift copies a fresh (not done) item, so a repeat starts unchecked. */
    if (e.shiftKey && t) {
      const made = todoClone(CAL, t, { day: to, done: false });
      CAL.push(...made);
      key = made[0].id;
    }
    saveCal();
    if (!app.querySelector(`.cal-day[data-day="${to}"]`)) CAL_DATE = to;
    renderCal(key);
  });
  app.querySelectorAll(".cal-list .todo-addsub").forEach(b => b.addEventListener("click", () => { const t = find(b); addItem(t.day, t); }));
  app.querySelectorAll(".cal-list .todo-del").forEach(b => b.addEventListener("click", () => { calDrop([find(b).id]); saveCal(); renderCal(); }));
  app.querySelectorAll(".cal-list .todo-grip, .cal-panel .todo-grip").forEach(g => g.addEventListener("pointerdown", e => calDrag(e, g)));
  fitText(app); undoButtons();
  if (focus) {
    const el = focus.startsWith("new:") ? app.querySelector(`.cal-day[data-day="${focus.slice(4)}"] .cal-new`) : app.querySelector(`.cal-list .todo-item[data-id="${focus}"] .todo-text`);
    if (el) el.focus();
  }
}
/* Escape outside a text box closes the to-do list panel (in a text box it
   just leaves the box first). */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !CAL_PANEL || !document.querySelector(".cal-panel") || (e.target.closest && e.target.closest("input, textarea, select"))) return;
  CAL_PANEL = false; renderCal();
});
/* Drag by the grip, with todoDrag's drop rules inside a day or the panel's
   list. Anywhere else in a day drops at the end of its top layer, and
   anywhere else in the panel at the end of the open list.
   - Calendar item into a day: it moves, with everything under it.
   - Panel item into a day: a copy, with everything under it and fresh ids.
   - Calendar item into the panel: a copy goes into the to-do list, not done
     (its sub-items keep their marks), so it lands in the open list. */
function calDrag(e, grip) {
  if (e.button !== 0) return;
  e.preventDefault();
  const li = grip.closest(".todo-item"), fromPanel = !!grip.closest(".cal-panel");
  const src = fromPanel ? TODOS : CAL, d = src.find(x => x.id === li.dataset.id);
  if (!d) return;
  const maxDepth = TODO_MAX_DEPTH - todoTree(src).height(d) + 1;
  const line = document.createElement("div");
  line.className = "todo-drop-line";
  let drop = null;
  const show = (x0, x1, y) => { Object.assign(line.style, { left: x0 + "px", width: Math.max(0, x1 - x0) + "px", top: y - 1 + "px" }); if (!line.isConnected) document.body.appendChild(line); };
  const none = () => { drop = null; line.remove(); };
  /* The drop spot by a row r (layer dr) of `list`, whose top layer is `roots`. */
  const spot = (list, roots, r, dr, box, base, indent, ev) => {
    const tr = todoTree(list);
    /* The dragged item leaves its old place, so it never counts as a neighbor. */
    const kidsOf = id => tr.kidsOf(id).filter(k => k !== d), rk = kidsOf(r.id);
    if (ev.clientY < box.top + box.height / 2) return { parent: tr.par(r.id), ref: r, at: "before", depth: dr, y: box.top };
    if (rk.length) return { parent: r, ref: rk[0], at: "before", depth: dr + 1, y: box.bottom };
    /* Layers open below r: r's sub-item, r's layer, and each ancestor's layer while r ends it. */
    const opts = [{ parent: r, ref: null, at: "into", depth: dr + 1 }];
    for (let a = r, da = dr; a; da--) {
      const p = tr.par(a.id);
      opts.push({ parent: p, ref: a, at: "after", depth: da });
      const sibs = p ? kidsOf(p.id) : roots;
      if (!p || sibs[sibs.length - 1] !== a) break;
      a = p;
    }
    const want = Math.round((ev.clientX - base.left - 4) / indent) + 1;
    const ok = opts.filter(o => o.depth <= maxDepth);
    if (!ok.length) return null;
    return Object.assign(ok.reduce((b, o) => Math.abs(o.depth - want) < Math.abs(b.depth - want) ? o : b), { y: box.bottom });
  };
  const move = ev => {
    if (ev.clientY < 40) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 40) window.scrollBy(0, 12);
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const panel = el && el.closest(".cal-panel"), cell = el && el.closest(".cal-day");
    if (panel) {
      if (fromPanel) return none();
      const open = panel.querySelector('.todo-list[data-done="0"]'), row = el.closest(".todo-row");
      const tr = todoTree(TODOS), roots = tr.roots.filter(t => !t.done);
      if (!row) {
        const b = open.getBoundingClientRect();
        drop = { to: "todo", parent: null, ref: roots[roots.length - 1] || null, at: roots.length ? "after" : "into", depth: 1 };
        return show(b.left, b.right, b.bottom);
      }
      const rli = row.parentElement, r = TODOS.find(x => x.id === rli.dataset.id), ul = rli.closest(".todo-list");
      if (!r) return none();
      const next = spot(TODOS, roots, r, +rli.dataset.depth, row.getBoundingClientRect(), ul.getBoundingClientRect(), TODO_INDENT, ev);
      /* A copy arrives not done, so a top-level drop has to be in the open list. */
      if (!next || next.depth > maxDepth || (!next.parent && ul.dataset.done === "1")) return none();
      drop = Object.assign(next, { to: "todo" });
      return show(ul.getBoundingClientRect().left + (next.depth - 1) * TODO_INDENT, ul.getBoundingClientRect().right, next.y);
    }
    if (!cell) return none();
    const day = cell.dataset.day, base = cell.querySelector(".cal-list").getBoundingClientRect(), row = el.closest(".cal-list .todo-row");
    const roots = todoTree(CAL).roots.filter(t => t !== d && t.day === day);
    if (!row) {
      drop = { to: "cal", day, parent: null, ref: roots[roots.length - 1] || null, at: roots.length ? "after" : "into", depth: 1 };
      return show(base.left, base.right, base.bottom);
    }
    if (li.contains(row)) return none();
    const rli = row.parentElement, r = CAL.find(x => x.id === rli.dataset.id);
    if (!r) return none();
    const next = spot(CAL, roots, r, +rli.dataset.depth, row.getBoundingClientRect(), base, CAL_INDENT, ev);
    if (!next || next.depth > maxDepth) return none();
    drop = Object.assign(next, { to: "cal", day });
    show(base.left + (next.depth - 1) * CAL_INDENT, base.right, next.y);
  };
  const end = ev => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", end);
    li.classList.remove("dragging");
    const p = drop; none();
    if (ev.type !== "pointerup" || !p) return;
    const dest = p.to === "todo" ? TODOS : CAL;
    let item = d, rest = [];
    if (p.to === "todo") {
      [item, ...rest] = todoClone(CAL, d, {});
      item.done = false;
    } else if (fromPanel) {
      [item, ...rest] = todoClone(TODOS, d, { day: p.day });
    } else {
      const tr = todoTree(CAL);
      [d.id, ...tr.below(d)].forEach(id => { CAL.find(x => x.id === id).day = p.day; });
      CAL.splice(CAL.indexOf(d), 1);
    }
    if (p.parent) item.parent = p.parent.id; else delete item.parent;
    dest.splice(p.at === "into" ? dest.length : dest.indexOf(p.ref) + (p.at === "after" ? 1 : 0), 0, item);
    dest.push(...rest);
    if (p.to === "todo") saveTodos(); else saveCal();
    renderCal();
  };
  grip.setPointerCapture(e.pointerId);
  li.classList.add("dragging");
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}

function renderRegion(r, sec) {
  const notes = NOTES.filter(n => n.region === r.id);
  layout("r/" + r.id, sec, `
    <p class="region">Section Overview</p>
    <h1>${r.name}</h1>
    ${tocHTML(r, "r/" + r.id)}
    <ul class="sublist">${notes.map(n => `<li><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
    ${r.id === "pipe" && typeof pipelineSVG === "function" ? pipelineSVG() : ""}
    ${r.id === "intv" ? `<p class="flag-note"><a href="#/review/questions">★ Flagged Questions</a> (<span id="flagCount">${FLAGS.length}</span>) · <a href="#/drill">Random Drill</a></p>` : ""}
    <div class="body">${r.body}</div>${practiceHTML(r.practice)}`);
}

function renderNote(n, sec) {
  const region = REGIONS.find(r => r.id === n.region);
  const i = NOTES.indexOf(n), prev = NOTES[i - 1], next = NOTES[i + 1];
  layout(n.id, sec, `
    <p class="region"><a href="#/r/${region.id}" style="text-decoration:none">${region.name}</a></p>
    <h1>${n.title}</h1>
    ${n.book ? '<p class="bookref">' + n.book + '</p>' : ''}
    ${tocHTML(n, n.id)}
    <div class="body">${n.body}</div>${practiceHTML(n.practice)}
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
  const pages = [...REGIONS.map(r => ({ base: "r/" + r.id, title: r.name, p: r })),
    ...NOTES.map(x => ({ base: x.id, title: x.title, p: x }))];
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
  if (parts[0] && parts[0] !== "t") q.value = "";
  if (parts[0] === "review") { renderReview(); goToSection(parts[1]); return; }
  if (parts[0] === "flagged") { renderReview(); goToSection("questions"); return; }
  if (parts[0] === "todo" || (parts[0] === "r" && parts[1] === "todo")) { renderTodo(); window.scrollTo(0, 0); return; }
  if (parts[0] === "cal" || (parts[0] === "r" && parts[1] === "cal")) { renderCal(); window.scrollTo(0, 0); return; }
  if (parts[0] === "drill") { renderDrill(); window.scrollTo(0, 0); return; }
  if (parts[0] === "r") {
    const r = REGIONS.find(x => x.id === parts[1]);
    if (r) { renderRegion(r, parts[2]); goToSection(parts[2]); return; }
  }
  const n = NOTES.find(x => x.id === parts[0]);
  if (n) { renderNote(n, parts[1]); goToSection(parts[1]); return; }
  const tab = parts[0] === "t" && TABS.find(t => t.id === parts[1]);
  renderHome(tab || TABS[0]);
  window.scrollTo(0, 0);
}

menuBtn.addEventListener("click", () => {
  const side = document.getElementById("side");
  if (!side) return;
  const open = side.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
q.addEventListener("input", () => {
  if (location.hash && location.hash !== "#/" && !location.hash.startsWith("#/t/")) location.hash = "#/";
  else applySearch();
});

window.addEventListener("hashchange", route);
if (typeof initThemeToggle === "function") initThemeToggle();
route();
initAuth();
