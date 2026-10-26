import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const apiInternalUrl = process.env.API_INTERNAL_URL;

const nextConfig: NextConfig = {
  // Keep the app trace rooted in the frontend even though the repo also has a
  // root package.json for Playwright.
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async rewrites() {
    if (!apiInternalUrl) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
