import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Every screen here is per-user and session-bound, so we use classic dynamic
  // rendering instead of Cache Components / partial prerendering.
  turbopack: {
    // sql.js (reads Health Connect exports in the browser) mentions Node's fs/path/crypto in code that only runs under Node.
    resolveAlias: {
      fs: { browser: "./src/lib/shims/empty.ts" },
      path: { browser: "./src/lib/shims/empty.ts" },
      crypto: { browser: "./src/lib/shims/empty.ts" },
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
