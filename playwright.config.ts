import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the main daily flows, against a running Hearth (a
 * Vercel preview, or `npm run dev` pointed at a test Supabase project).
 * Needs E2E_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * E2E_EMAIL (a test account, not a real person). See e2e/README.md.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    timezoneId: "Asia/Kolkata",
    ...devices["Pixel 7"],
    // Use a browser already on the machine when given (e.g. a sandbox); CI installs its own.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
