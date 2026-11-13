// Are.na at build time.
//
// For every project with an `arena:` channel URL in its front matter (src/work/*.md),
// fetch that public channel's latest 20 blocks (other channels excluded), in the order Are.na shows them
// (newest first). Nothing is invented: titles, sources, descriptions and images all
// come from Are.na. No API key is needed for public channels.
//
// Responses are cached in site/.cache for a day, so rebuilds are fast and the site
// still builds (from the last good copy) if Are.na is unreachable.
//
// A project can choose its home-page cover with `coverBlock:` (an Are.na block link or ID),
// leave blocks off its gallery with `arenaHide: [block IDs]`, and put chosen blocks first with
// `arenaPin: [block IDs]`, send blocks to the end with `arenaLast: [block IDs]`, and swap
// pairs of blocks with `arenaSwap: [a, b]`
// (Are.na itself is untouched).
//
// Also writes site/arena-report.md: images whose Are.na description is missing,
// so alt text can be fixed on Are.na itself.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fetch from "@11ty/eleventy-fetch";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(here, "..", "work");
const REPORT = path.join(here, "..", "..", "arena-report.md");
const CAP = 20;

// Read `slug:` / `title:` / `arena:` from each project's front matter.
function projectsWithChannels() {
  return fs
    .readdirSync(WORK_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const fm = (fs.readFileSync(path.join(WORK_DIR, f), "utf8").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
      const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "").trim().replace(/^"(.*)"$/, "$1");
      return { slug: get("slug"), title: get("title"), arena: get("arena"), coverBlock: get("coverBlock").replace(/\D/g, ""), hide: (get("arenaHide").match(/\d+/g) || []).map(Number), pin: (get("arenaPin").match(/\d+/g) || []).map(Number), last: (get("arenaLast").match(/\d+/g) || []).map(Number), swap: (get("arenaSwap").match(/\d+/g) || []).map(Number) };
    })
    .filter((p) => p.slug && p.arena);
}

const channelSlug = (url) => url.replace(/\/+$/, "").split("/").pop();

// A title that is really a filename or camera ID tells a reader nothing.
const looksLikeFilename = (t) =>
  !t || /^(IMG|DSC|PXL|Screenshot|Screen Shot|\d{3}_)/i.test(t) || /^[0-9A-F-]{20,}$/i.test(t) || /\.(jpe?g|png|gif|webp|heic|pdf)$/i.test(t);

const plain = (d) => (d && (d.plain || d.markdown)) || "";
const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

function normalise(b, channelTitle, missing) {
  const blockUrl = `https://www.are.na/block/${b.id}`;
  const title = (b.title || "").trim();
  const sourceUrl = b.source && b.source.url;
  const sourceName = (b.source && b.source.provider && b.source.provider.name) || (sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "");
  const img = b.image && b.image.small && {
    src: b.image.small.src,
    src2x: b.image.small.src_2x || b.image.medium?.src,
    width: b.image.small.width,
    height: b.image.small.height,
  };

  // Alt text: Are.na's own alt text, else the block description, else a real title.
  let alt = (b.image && b.image.alt_text) || plain(b.description) || "";
  if (img && !alt) {
    missing.push({ id: b.id, title, url: blockUrl });
    alt = looksLikeFilename(title) ? `Image from the Are.na channel “${channelTitle}”` : title;
  }

  const base = {
    id: b.id,
    type: b.type,
    title: looksLikeFilename(title) ? "" : title,
    href: sourceUrl || blockUrl,
    blockUrl,
    sourceName,
  };

  switch (b.type) {
    case "Image":
      return { ...base, kind: "image", img, alt, href: blockUrl };
    case "Link":
      return { ...base, kind: img ? "image" : "link", img, alt: alt || title };
    case "Text":
      return { ...base, kind: "text", text: clip(plain(b.content), 320) };
    case "Attachment":
      return { ...base, kind: img ? "image" : "file", img, alt: alt || title, href: (b.attachment && b.attachment.url) || blockUrl, fileLabel: (b.attachment && (b.attachment.file_extension || "").toUpperCase()) || "FILE" };
    case "Embed":
    case "Media":
      return { ...base, kind: img ? "image" : "link", img, alt: alt || title };
    case "Channel":
      return { ...base, kind: "channel", title: (b.title || "").trim(), href: `https://www.are.na/${b.owner?.slug || "zanyiah-hill-milling"}/${b.slug}` };
    default:
      return null;
  }
}

export default async function () {
  const out = {};
  const report = [];

  for (const p of projectsWithChannels()) {
    const slug = channelSlug(p.arena);
    try {
      const [channel, contents] = await Promise.all([
        Fetch(`https://api.are.na/v3/channels/${slug}`, { duration: "1d", type: "json", fetchOptions: { headers: { "User-Agent": "zanyiah-site-build" } } }),
        Fetch(`https://api.are.na/v3/channels/${slug}/contents?per=${CAP * 2}`, { duration: "1d", type: "json", fetchOptions: { headers: { "User-Agent": "zanyiah-site-build" } } }),
      ]);
      const missing = [];
      // Channel blocks (links to other channels) are left out of the gallery; the next blocks fill in.
      // Pinned blocks (`arenaPin:`) go first, in the order listed, fetched one by one so they can come
      // from anywhere in the channel; then the channel's latest blocks fill the rest.
      const pinned = [];
      for (const id of p.pin) {
        try {
          pinned.push(await Fetch(`https://api.are.na/v3/blocks/${id}`, { duration: "1d", type: "json", fetchOptions: { headers: { "User-Agent": "zanyiah-site-build" } } }));
        } catch (err) {
          console.warn(`[arena] Pinned block ${id} for “${p.title}” couldn't be fetched: ${err.message}`);
        }
      }
      const rest = (contents.data || []).filter((b) => !p.pin.includes(b.id));
      const all = [...pinned, ...rest];
      // `arenaSwap: [a, b, c, d…]` swaps the positions of each pair (a↔b, c↔d). Done before hiding,
      // so swapping a block with one that is then hidden puts it exactly in the hidden one's place.
      for (let i = 0; i + 1 < p.swap.length; i += 2) {
        const x = all.findIndex((b) => b.id === p.swap[i]);
        const y = all.findIndex((b) => b.id === p.swap[i + 1]);
        if (x >= 0 && y >= 0) [all[x], all[y]] = [all[y], all[x]];
      }
      const shown = all.filter((b) => b.type !== "Channel" && !p.hide.includes(b.id));
      // Blocks listed in `arenaLast:` move to the end of the gallery, in the order listed.
      const last = p.last.map((id) => shown.find((b) => b.id === id)).filter(Boolean);
      const blocks = [...shown.filter((b) => !p.last.includes(b.id)).slice(0, CAP - last.length), ...last].slice(0, CAP);
      const items = blocks.map((b) => normalise(b, channel.title, missing)).filter(Boolean);
      out[p.slug] = {
        url: p.arena,
        title: channel.title,
        total: contents.meta?.total_count ?? items.length,
        items,
        cover: (items.find((i) => i.kind === "image" && i.img) || {}).img || null,
      };
      // A chosen cover: `coverBlock: <Are.na block link or ID>` in the project's front matter.
      if (p.coverBlock) {
        try {
          const b = await Fetch(`https://api.are.na/v3/blocks/${p.coverBlock}`, { duration: "1d", type: "json", fetchOptions: { headers: { "User-Agent": "zanyiah-site-build" } } });
          const im = b.image && (b.image.medium || b.image.small);
          if (im) out[p.slug].cover = { src: im.src, src2x: im.src_2x || im.src, width: im.width, height: im.height };
          else console.warn(`[arena] coverBlock ${p.coverBlock} for “${p.title}” has no image; using the channel's first image.`);
        } catch (err) {
          console.warn(`[arena] coverBlock ${p.coverBlock} for “${p.title}” couldn't be fetched: ${err.message}`);
        }
      }
      if (missing.length) report.push({ project: p.title, channel: p.arena, missing });
    } catch (err) {
      // Private, renamed or unreachable channel: skip it and say which project.
      console.warn(`[arena] Skipped “${p.title}” (${p.arena}): ${err.message}`);
    }
  }

  const lines = [
    "# Are.na alt-text report",
    "",
    "Images shown on the site whose Are.na block has no description. Until one is added on Are.na,",
    "the site uses the block title as alt text (or a generic line when the title is a filename).",
    "Add a description on Are.na and it is picked up on the next build.",
    "",
  ];
  for (const r of report) {
    lines.push(`## ${r.project} — ${r.missing.length} missing`, `Channel: ${r.channel}`, "");
    for (const m of r.missing) lines.push(`- ${m.title || "(untitled)"} — ${m.url}`);
    lines.push("");
  }
  try { fs.writeFileSync(REPORT, lines.join("\n")); } catch {}

  return out;
}
