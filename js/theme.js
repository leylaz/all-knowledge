/* Theme switch in the header. The page's first script applies the saved
   theme before render; this keeps the button and the saved choice in sync. */

/* ---------- Light / dark switch ---------- */
function initThemeToggle() {
  const btn = document.getElementById("themeBtn");
  if (!btn) return;
  const sync = () => {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.title = btn.getAttribute("aria-label");
    btn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg><span>Light</span>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Dark</span>';
  };
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    sync();
  });
  sync();
}
