const baseUrl = "https://ai-tast.pages.dev";

export default function sitemap() {
  const routes = [
    "",
    "/about",
    "/guides",
    "/guides/exam-plan",
    "/guides/review",
    "/guides/focus",
    "/guides/active-recall",
    "/guides/mistake-notes",
    "/guides/subject-strategy",
    "/guides/recovery",
    "/guides/exam-day",
    "/privacy",
    "/terms",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date("2026-08-20"),
    changeFrequency: route.startsWith("/guides") ? "monthly" : "yearly",
    priority: route === "" ? 1 : route === "/guides" ? 0.8 : 0.6,
  }));
}
