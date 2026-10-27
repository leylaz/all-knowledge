/* Theme switch in the header. The page's first script applies the saved
   theme before render; this keeps the button and the saved choice in sync. */

/* ---------- Theme switch: Night ⇄ Mili (key "pink") ---------- */
const THEME_NEXT = { night: "pink", pink: "night" };
const THEME_BTN = {
  pink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg><span>Mili</span>',
  night: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Night</span>'
};
const THEME_NAME = { night: "Night", pink: "Mili" };
function initThemeToggle() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const cur = () => THEME_NEXT[document.documentElement.getAttribute("data-theme")] ? document.documentElement.getAttribute("data-theme") : "night";
  const sync = () => {
    const next = THEME_NEXT[cur()];
    btn.setAttribute("aria-label", "Switch to " + THEME_NAME[next] + " mode");
    btn.title = btn.getAttribute("aria-label");
    btn.innerHTML = THEME_BTN[next];
  };
  btn.addEventListener("click", () => {
    const next = THEME_NEXT[cur()];
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
  });
  sync();
}
