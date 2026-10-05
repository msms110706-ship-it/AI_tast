const baseUrl = "https://ai-tast.pages.dev";

export default function sitemap() {
  // Editorial dates, never build time or filesystem mtime.
  // See docs/sitemap-maintenance.md for the content-change evidence.
  const routes = [
    ["", "2026-10-05"],
    ["/about", "2026-09-24"],
    ["/guides", "2026-09-24"],
    ["/guides/exam-plan", "2026-09-24"],
    ["/guides/review", "2026-09-24"],
    ["/guides/focus", "2026-09-24"],
    ["/guides/active-recall", "2026-09-24"],
    ["/guides/mistake-notes", "2026-09-24"],
    ["/guides/subject-strategy", "2026-09-24"],
    ["/guides/recovery", "2026-09-24"],
    ["/guides/exam-day", "2026-09-24"],
    ["/privacy", "2026-09-24"],
    ["/terms", "2026-09-24"],
  ];

  return routes.map(([route, lastModified]) => ({
    url: `${baseUrl}${route}/`,
    lastModified,
    changeFrequency: route.startsWith("/guides") ? "monthly" : "yearly",
    priority: route === "" ? 1 : route === "/guides" ? 0.8 : 0.6,
  }));
}
