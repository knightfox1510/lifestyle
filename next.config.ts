import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Health Connect exports are SQLite: sql.js reads them with its WebAssembly file,
  // which has to ship with the functions that import exports.
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    "/api/ingest/health-connect/*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
    "/wearables": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
  // Every screen here is per-user and session-bound, so we use classic dynamic
  // rendering instead of Cache Components / partial prerendering.
  turbopack: {
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
