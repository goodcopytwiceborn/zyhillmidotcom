// Progressive enhancement: every node/project URL is a real page. With JS,
// clicking swaps the breadcrumbs and columns 2–3 and updates the address bar,
// so column 1 stays put and Back/Forward step through what was opened.
// On the landing page column 2 is hidden; it appears once a node or project opens.
(() => {
  if (!("fetch" in window) || !("DOMParser" in window)) return;
  const wide = window.matchMedia("(min-width: 1000px)");

  // "/#sec-recent" etc. (a section breadcrumb) filters the Index to that section
  // (breadcrumbs + gallery) but leaves every section in column 1 closed.
  let filterKey = null;
  function openSection(hash) {
    if (!hash || !hash.startsWith("#sec-")) return false;
    const sec = document.getElementById(hash.slice(1));
    if (!sec) return false;
    document.querySelectorAll("#col1 details").forEach((d) => (d.open = false));
    filterKey = sec.id.replace("sec-", "");
    indexCrumbs();
    sec.querySelector("summary").focus({ preventScroll: true });
    return true;
  }

  async function load(url, { push = true } = {}) {
    const target = new URL(url, location.href);
    let html;
    try {
      const res = await fetch(target.pathname, { headers: { Accept: "text/html" } });
      if (!res.ok) throw new Error(res.status);
      html = await res.text();
    } catch {
      window.location.href = url;
      return;
    }
    const next = new DOMParser().parseFromString(html, "text/html");

    for (const id of ["masthead", "col2", "col3", "arena-slot"]) {
      document.getElementById(id).innerHTML = next.getElementById(id).innerHTML;
    }
    document.getElementById("col2").scrollTop = 0;
    document.getElementById("col3").scrollTop = 0;
    document.body.dataset.view = next.body.dataset.view;
    document.body.dataset.homeState = next.body.dataset.homeState;
    document.title = next.title;

    // Mirror the highlighted node/project in column 1.
    document.querySelectorAll("#col1 a[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    let currentSection = null;
    next.querySelectorAll("#col1 a[aria-current]").forEach((a) => {
      const mine = document.querySelector(`#col1 a[href="${a.getAttribute("href")}"]`);
      if (mine) {
        mine.setAttribute("aria-current", "page");
        currentSection = mine.closest("details");
      }
    });
    // Mark the section that holds the current node/project (its + spins while closed).
    document.querySelectorAll("#col1 details").forEach((d) => d.classList.toggle("is-current", d === currentSection));

    // After each navigation one section is open: ReadMe! on the landing page, otherwise the
    // section holding the project/node on screen, so its list stays in reach for the next one.
    // Visitors can still open others by hand.
    const { view, homeState } = document.body.dataset;
    const keep = view === "home" ? (homeState === "index" ? null : document.getElementById("sec-about")) : currentSection;
    document.querySelectorAll("#col1 details").forEach((d) => (d.open = d === keep));

    filterKey = null;
    if (push) history.pushState({}, "", target.pathname + target.hash);
    markSeen();
    window.dispatchEvent(new Event("swap:loaded"));

    if (openSection(target.hash)) return;

    // Move focus to the new heading so keyboard and screen-reader users land
    // on the content that changed.
    const heading = document.querySelector("#col2 h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: wide.matches });
    }
  }

  // Projects and nodes a visitor has opened are greyed out in column 1, so they can see
  // what's left. Remembered in their own browser only.
  const SEEN_KEY = "zanyiah-seen";
  function markSeen() {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch {}
    const here = location.pathname;
    if (/^\/(work|nodes)\//.test(here) && !seen.includes(here)) {
      seen.push(here);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch {}
    }
    document.querySelectorAll("#col1 .sec-list a").forEach((a) => a.classList.toggle("seen", seen.includes(a.getAttribute("href"))));
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-swap]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.origin !== location.origin) return;
    e.preventDefault();
    load(a.href);
  });

  window.addEventListener("popstate", () => load(location.href, { push: false }));

  // Email link: copy the address to the clipboard and say so. If copying isn't possible,
  // open the mail app instead (the link's mailto:).
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("a.copy-email");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const text = a.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    if (!ok) {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.append(t); t.select();
      try { ok = document.execCommand("copy"); } catch {}
      t.remove();
    }
    if (!ok) { window.location.href = a.href; return; }
    const status = a.querySelector(".copy-status");
    status.textContent = "Copied";
    clearTimeout(a._copyTimer);
    a._copyTimer = setTimeout(() => (status.textContent = ""), 1800);
  });

  // "[read more +]" waves until it's opened; then it stays still on that project for the visit.
  const READ = "zanyiah-read-more";
  const readList = () => { try { return JSON.parse(sessionStorage.getItem(READ)) || []; } catch { return []; } };
  function settleReadMore() {
    const done = readList().includes(location.pathname);
    document.querySelectorAll("details.more").forEach((d) => d.classList.toggle("opened", done));
  }
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains("more") || !d.open) return;
    d.classList.add("opened");
    const list = readList();
    if (!list.includes(location.pathname)) {
      list.push(location.pathname);
      try { sessionStorage.setItem(READ, JSON.stringify(list)); } catch {}
    }
  }, true);
  settleReadMore();
  window.addEventListener("swap:loaded", settleReadMore);

  // "(more…)" waves until it's clicked, then rests for the rest of the visit.
  const MORE = "zanyiah-more-seen";
  try { if (sessionStorage.getItem(MORE)) document.body.classList.add("more-seen"); } catch {}
  document.addEventListener("click", (e) => {
    if (!(e.target.closest && e.target.closest("a.more-link"))) return;
    document.body.classList.add("more-seen");
    try { sessionStorage.setItem(MORE, "1"); } catch {}
  });

  // The LinkedIn / Are.na arrows keep nudging until someone clicks one of those links
  // (in the top corner or in the ReadMe! bio); then they stay still for the rest of the visit.
  const SEEN = "zanyiah-arrows-seen";
  try { if (sessionStorage.getItem(SEEN)) document.body.classList.add("arrows-seen"); } catch {}
  document.addEventListener("click", (e) => {
    if (!(e.target.closest && e.target.closest(".sitebar-links a, .bio a.external"))) return;
    document.body.classList.add("arrows-seen");
    try { sessionStorage.setItem(SEEN, "1"); } catch {}
  });

  // An underlined phrase in the copy that shows/hides the points it refers to, in place.
  // It's an inline span (role="button") so it wraps with the sentence like normal text.
  function toggleReveal(el) {
    const target = document.getElementById(el.getAttribute("aria-controls"));
    if (!target) return;
    const open = el.getAttribute("aria-expanded") !== "true";
    el.setAttribute("aria-expanded", String(open));
    target.hidden = !open;
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".reveal");
    if (el) toggleReveal(el);
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(".reveal");
    if (!el || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    toggleReveal(el);
  });

  // On the Index, the chosen section (from a breadcrumb, or opened in column 1) shows up in
  // the breadcrumbs — "ZANYIAH / INDEX / NODES", with Index clickable to go back home —
  // and filters the gallery. No section chosen keeps "ZANYIAH HILL-MILLING / INDEX".
  const sep = '<span class="crumb-sep" aria-hidden="true"> / </span>';
  // The gallery follows the chosen section: only that status's projects, or the node
  // tiles for Nodes; everything when none is chosen.
  function filterGallery(key) {
    const projectsList = document.getElementById("gallery-projects");
    const nodesList = document.getElementById("gallery-nodes");
    if (!projectsList || !nodesList) return;
    nodesList.hidden = key !== "nodes";
    projectsList.hidden = key === "nodes";
    projectsList.querySelectorAll(".tile").forEach((t) => {
      t.hidden = Boolean(key) && key !== "nodes" && t.dataset.status !== key;
    });
  }

  function indexCrumbs() {
    if (document.body.dataset.view !== "home") return;
    const sec = filterKey && document.getElementById("sec-" + filterKey);
    const title = sec && sec.querySelector(".sec-title").textContent;
    filterGallery(sec ? filterKey : null);
    document.title = title || "Zanyiah Hill-Milling — Body of Work";
    // Full name on the landing state; first name only once a section joins the trail.
    document.querySelector(".crumbs").innerHTML = title
      ? `<li><span>ZANYIAH</span>${sep}</li><li><a href="/" data-swap>Index</a>${sep}</li><li><span aria-current="page">${title}</span></li>`
      : `<li><span>ZANYIAH HILL-MILLING</span>${sep}</li><li><span aria-current="page">Index</span></li>`;
  }

  // Only one section open at a time: opening one closes the rest (About included).
  // Opening a section by hand also chooses it as the filter; opening About clears the filter;
  // closing the chosen section by hand clears it too.
  const sections = [...document.querySelectorAll("#col1 details")];
  let userToggled = null;
  sections.forEach((d) => {
    d.querySelector("summary").addEventListener("click", () => (userToggled = d));
    d.addEventListener("toggle", () => {
      const key = d.id.replace("sec-", "");
      if (d.open) {
        sections.forEach((other) => { if (other !== d) other.open = false; });
        filterKey = key === "about" ? null : key;
      } else if (userToggled === d && filterKey === key) {
        filterKey = null;
      }
      if (userToggled === d) userToggled = null;
      indexCrumbs();
    });
  });
  markSeen();
  openSection(location.hash);
})();
