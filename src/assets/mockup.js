// Mockup-only controls: bio draft, typeface, metadata style.
// Choices are remembered per browser; the page works without storage.
(() => {
  const KEY = "zanyiah-mockup-v2"; // bumped so the new Mono default shows
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}

  const apply = (name, value) => {
    document.body.dataset[name] = value;
    document.querySelectorAll(`[data-set="${name}"]`).forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.value === value))
    );
  };

  Object.entries(saved).forEach(([k, v]) => apply(k, v));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set]");
    if (!btn) return;
    apply(btn.dataset.set, btn.dataset.value);
    saved[btn.dataset.set] = btn.dataset.value;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  });
})();
