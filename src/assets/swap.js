// Progressive enhancement: every node/project URL is a real page. With JS,
// clicking swaps the breadcrumbs and columns 2–3 and updates the address bar,
// so column 1 stays put and Back/Forward step through what was opened.
// On the landing page column 2 is hidden; it appears once a node or project opens.
(() => {
  if (!("fetch" in window) || !("DOMParser" in window)) return;
  const wide = window.matchMedia("(min-width: 1000px)");

  // Tab title scrolls like a ticker (after Mindy Seu's site): "Zanyiah Hill-Milling — Body of Work — "
  // moves one letter left every 0.4s and loops. Search engines still read the plain <title> in the HTML.
  // Keeps moving when the tab is in the background too. Browsers slow background timers to about
  // once a second, so the position follows the clock (one letter per 0.4s) and catches up on each tick.
  // Still for reduced-motion users.
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let tickerText = "", tickerStart = Date.now();
  function setTitle(t) {
    tickerText = t.replace(/\s+—\s*$/, "") + " — ";
    tickerStart = Date.now();
    document.title = calm.matches ? t : tickerText;
  }
  setInterval(() => {
    if (calm.matches || !tickerText) return;
    const pos = Math.floor((Date.now() - tickerStart) / 400) % tickerText.length;
    document.title = tickerText.slice(pos) + tickerText.slice(0, pos);
  }, 400);
  setTitle(document.title);

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

  async function load(url, { push = true, openToggle = false } = {}) {
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
    setTitle(next.title);

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
    updatePeek();

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

    if (openSection(target.hash)) {
      // Links from the ReadMe! page also open that section's list in column 1.
      if (openToggle) document.getElementById(target.hash.slice(1)).open = true;
      return;
    }

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
    load(a.href, { openToggle: a.hasAttribute("data-open-section") });
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
    updatePeek();
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
    setTitle(title || "Zanyiah Hill-Milling — Body of Work");
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
  // On the last item of a section, the next section's row "peeks": it bounces open a little,
  // over and over, until it's clicked (or you move to another item).
  // Once a section has been clicked open, it never peeks again for the rest of the visit.
  const PEEK = "zanyiah-peek-seen";
  const peekSeen = () => { try { return JSON.parse(sessionStorage.getItem(PEEK)) || []; } catch { return []; } };
  function markPeekSeen(id) {
    const list = peekSeen();
    if (list.includes(id)) return;
    list.push(id);
    try { sessionStorage.setItem(PEEK, JSON.stringify(list)); } catch {}
  }
  function updatePeek() {
    document.querySelectorAll("#col1 details.peek").forEach((d) => d.classList.remove("peek"));
    document.querySelectorAll("#col1 .sec-peek-preview").forEach((p) => p.remove());
    const cur = document.querySelector("#col1 .sec-list a[aria-current]");
    if (!cur) return;
    // On a project with "[read more +]", wait until it's been opened, so the peek doesn't compete with it.
    if (document.querySelector("#col2 details.more") && !readList().includes(location.pathname)) return;
    const li = cur.closest("li");
    if (li.nextElementSibling) return; // not the last item
    const sec = cur.closest("details");
    if (!["sec-recent", "sec-in-progress", "sec-archive"].includes(sec.id)) return; // status filters only
    const next = sec.nextElementSibling;
    if (!next || !next.matches("details.sec") || next.open || peekSeen().includes(next.id)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    next.classList.add("peek");
    // A one-time glimpse: the next section's list drops all the way open, holds, then snaps shut.
    // Plain text (no links inside the toggle); the real list opens when the row is clicked.
    const preview = document.createElement("span");
    preview.className = "sec-peek-preview";
    preview.setAttribute("aria-hidden", "true");
    next.querySelectorAll(".sec-list .sec-label").forEach((l) => {
      const item = document.createElement("span");
      item.className = "sec-peek-item";
      item.textContent = l.textContent;
      preview.append(item);
    });
    next.querySelector("summary").append(preview);
    const full = preview.scrollHeight + 12;
    markPeekSeen(next.id); // it plays once per visit
    const anim = preview.animate(
      [
        { height: "0px", easing: "cubic-bezier(.2,.7,.3,1)" },
        { height: full + "px", offset: 0.35 },
        { height: full + "px", offset: 0.88, easing: "cubic-bezier(.6,0,1,1)" },
        { height: "0px" },
      ],
      { duration: 2000, delay: 500, fill: "both" }
    );
    anim.onfinish = () => { next.classList.remove("peek"); preview.remove(); };
  }

  sections.forEach((d) => {
    d.querySelector("summary").addEventListener("click", () => (userToggled = d));
    d.addEventListener("toggle", () => {
      const key = d.id.replace("sec-", "");
      if (d.open) {
        d.classList.remove("peek");
        if (userToggled === d) markPeekSeen(d.id);
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
  updatePeek();
  openSection(location.hash);
})();
