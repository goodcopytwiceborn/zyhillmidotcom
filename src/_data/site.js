// Platform links: URLs not supplied yet. `url: null` renders as a visibly
// pending link that is not clickable.
export default {
  name: "@zanyiah",
  // For search engines and link previews.
  url: "https://www.zyhillmi.com",
  person: "Zanyiah Hill-Milling",
  homeTitle: "Zanyiah Hill-Milling — Body of Work",
  // Her own words: the bio's opening line (home) and "About this site." (ReadMe!).
  homeDescription: "What I do exists somewhere between media and technology. I’ve found it easier to show than explain.",
  readmeDescription: "This is not a conventional portfolio. It is a living collection of finished and unfinished work, references, and questions.",
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
