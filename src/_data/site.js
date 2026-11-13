// Platform links: URLs not supplied yet. `url: null` renders as a visibly
// pending link that is not clickable.
export default {
  name: "@zanyiah",
  lastUpdated: new Date(),
  platforms: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/zyhillmi/", external: true },
    { label: "Are.na", url: "https://www.are.na/zanyiah-hill-milling", external: true },
    // Email: clicking copies the address; without JavaScript it opens a mail app instead.
    { label: "Email", url: "mailto:zyhillmi@outlook.com", copy: "zyhillmi@outlook.com", external: false },
  ],
  // The Mockup bar (design-review switches) shows locally but not on the live site (Vercel sets VERCEL=1).
  mockup: !process.env.VERCEL,
};
