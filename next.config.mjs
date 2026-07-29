/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig = {
  output: "export",
  distDir: "dist",
  basePath: isGitHubPages ? "/AI_tast" : "",
  assetPrefix: isGitHubPages ? "/AI_tast/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
