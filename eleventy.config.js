export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Every project file in src/work/ is a project. Relationships to nodes live
  // on the project (`nodes:` is a list), so node "Connections" are generated
  // and a project can belong to more than one node later.
  eleventyConfig.addCollection("projects", (api) =>
    api.getFilteredByGlob("src/work/*.md").sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  );

  eleventyConfig.addFilter("inNode", (projects, nodeSlug) =>
    projects.filter((p) => (p.data.nodes || []).includes(nodeSlug))
  );

  // Projects sharing at least one node with `project` (excluding itself).
  eleventyConfig.addFilter("related", (projects, project) => {
    const mine = project.data?.nodes || project.nodes || [];
    const slug = project.data?.slug || project.slug;
    return projects.filter(
      (p) => p.data.slug !== slug && (p.data.nodes || []).some((n) => mine.includes(n))
    );
  });

  // Projects with a status, in the order they appear in website-content.txt.
  eleventyConfig.addFilter("withStatus", (projects, status) =>
    projects
      .filter((p) => p.data.status === status)
      .sort((a, b) => (a.data.sourceOrder ?? 0) - (b.data.sourceOrder ?? 0))
  );

  // A node's tags = the (suggested) tags of its projects, de-duplicated, in order.
  eleventyConfig.addFilter("nodeTags", (projects, nodeSlug) => [
    ...new Set(
      projects.filter((p) => (p.data.nodes || []).includes(nodeSlug)).flatMap((p) => p.data.tags || [])
    ),
  ]);

  // Landing gallery: Recent Work first (in content order), then everything else as before.
  // Up to 4 images for a grid-style thumbnail: the chosen cover, her own photos,
  // then the project's Are.na images (first image blocks in gallery order).
  const tileImages = (p, arena) => {
    const out = [];
    const add = (src, src2x) => { if (src && !out.some((o) => o.src === src)) out.push({ src, src2x: src2x || src }); };
    if (p.data.cover) add(p.data.cover);
    (p.data.gallery || []).forEach((g) => add(g.src));
    const ch = arena && arena[p.data.slug];
    if (ch) ch.items.filter((i) => i.kind === "image" && i.img).forEach((i) => add(i.img.src, i.img.src2x));
    return out.slice(0, 4);
  };
  eleventyConfig.addFilter("tileImages", tileImages);
  // A node's grid thumbnail: the first image from each of its projects.
  eleventyConfig.addFilter("nodeImages", (projects, slug, arena) =>
    projects
      .filter((p) => (p.data.nodes || []).includes(slug))
      .map((p) => tileImages(p, arena)[0])
      .filter(Boolean)
      .slice(0, 4)
  );

  // The other nodes, starting with the one after `slug` and wrapping around (02…07, 01 on node 01's page).
  eleventyConfig.addFilter("othersFrom", (list, slug) => {
    const i = list.findIndex((n) => n.slug === slug);
    return [...list.slice(i + 1), ...list.slice(0, Math.max(i, 0))];
  });

  eleventyConfig.addFilter("recentFirst", (projects) => [
    ...projects.filter((p) => p.data.status === "recent").sort((a, b) => (a.data.sourceOrder ?? 0) - (b.data.sourceOrder ?? 0)),
    ...projects.filter((p) => p.data.status !== "recent"),
  ]);

  eleventyConfig.addFilter("sectionByKey", (sections, key) => sections.find((s) => s.key === key));

  eleventyConfig.addFilter("nodeBySlug", (nodes, slug) => nodes.find((n) => n.slug === slug));

  eleventyConfig.addFilter("statusLabel", (s) =>
    ({ recent: "recent", "in-progress": "in progress", archive: "archive" })[s] || s
  );

  // A reference whose destination hasn't been supplied yet: styled as a link,
  // not clickable, and announced as pending to screen readers.
  eleventyConfig.addShortcode(
    "pending",
    (text) =>
      `<span class="link-pending" title="Link pending">${text}<span class="vh"> (link pending)</span></span>`
  );

  // A link with a URL supplied in the content file: opens in a new tab, with ↗.
  eleventyConfig.addShortcode(
    "ext",
    (url, text) =>
      `<a class="external" href="${url}" target="_blank" rel="noopener">${text}<span class="vh"> (opens in new tab)</span></a><span class="arrow" aria-hidden="true">↗</span>`
  );

  // A mention of another project on this site, linked to its page.
  eleventyConfig.addShortcode(
    "work",
    (slug, text) => `<a class="internal" href="/work/${slug}/" data-swap>${text}</a>`
  );

  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
