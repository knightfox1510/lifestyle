import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const ready = Boolean(process.env.E2E_BASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_EMAIL);

/**
 * Signs the test account in through the real email-link page: the admin key
 * makes a one-time magic link (no email is sent), then the page's own
 * "Sign in to Hearth" button is pressed, exactly as a person would.
 */
export async function signIn(page: Page) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.E2E_EMAIL! });
  if (error || !data.properties?.hashed_token) throw new Error(`Couldn't make a sign-in link: ${error?.message}`);
  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink`);
  await page.getByRole("button", { name: "Sign in to Hearth" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth") && !u.pathname.startsWith("/login"));
  // First run: the test account makes its own household.
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: "Create household" }).first().click().catch(() => undefined);
    await page.getByLabel(/household/i).fill("E2E test home");
    await page.getByRole("button", { name: "Create household" }).last().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"));
  }
}

/** A toast with this text appears. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
}
