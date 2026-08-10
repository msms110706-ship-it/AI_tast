const baseUrl = "https://ai-tast.pages.dev";

export default function sitemap() {
  const routes = [
    "",
    "/about",
    "/guides",
    "/guides/exam-plan",
    "/guides/review",
    "/guides/focus",
    "/privacy",
    "/terms",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date("2026-07-29"),
    changeFrequency: route.startsWith("/guides") ? "monthly" : "yearly",
    priority: route === "" ? 1 : route === "/guides" ? 0.8 : 0.6,
  }));
}
