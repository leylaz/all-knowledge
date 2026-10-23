/* Rendering, routing, and search. No note content lives here. */
function visibleNotes() { return NOTES; }
function visibleRegions() { return REGIONS; }

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
      <p>From transistors to workloads, laid out like a die. Every page ends with practice problems.</p>
    </section>
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
  </div>`;
  applySearch();
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
      <ul>${visibleNotes().filter(n => n.region === r.id).map(n =>
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
  typesetMath();
}

function renderRegion(r, sec) {
  const notes = visibleNotes().filter(n => n.region === r.id);
  layout("r/" + r.id, sec, `
    <p class="region">Section Overview</p>
    <h1>${r.name}</h1>
    ${tocHTML(r, "r/" + r.id)}
    <ul class="sublist">${notes.map(n => `<li><a href="#/${n.id}">${n.title}</a></li>`).join("")}</ul>
    <div class="body">${r.body}</div>${practiceHTML(r.practice)}`);
}

function renderNote(n, sec) {
  const region = REGIONS.find(r => r.id === n.region);
  const vis = visibleNotes(); const i = vis.indexOf(n), prev = vis[i - 1], next = vis[i + 1];
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
  if (parts[0] === "r") {
    const r = REGIONS.find(x => x.id === parts[1]);
    if (r) { renderRegion(r, parts[2]); goToSection(parts[2]); return; }
  }
  const n = NOTES.find(x => x.id === parts[0]);
  if (n) { renderNote(n, parts[1]); goToSection(parts[1]); return; }
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
