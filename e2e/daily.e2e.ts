import { expect, test } from "@playwright/test";
import { expectToast, ready, signIn } from "./helpers";

test.skip(!ready, "Set E2E_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and E2E_EMAIL to run these.");

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("water: one tap logs it and confirms", async ({ page }) => {
  await page.goto("/food");
  await page.getByRole("button", { name: "+250 ml" }).first().click();
  await expectToast(page, /\+250 ml/);
});

test("food: add by hand, see it in the meal, delete it", async ({ page }) => {
  const name = `E2E poha ${Date.now()}`;
  await page.goto("/food");
  await page.getByRole("tab", { name: "Type it in" }).first().click();
  await page.getByLabel("Food").first().fill(name);
  await page.getByLabel("kcal").first().fill("250");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expectToast(page, /./);
  const row = page.getByRole("button", { name: `Edit ${name}` }).first();
  await expect(row).toBeVisible();
  await row.click();
  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expectToast(page, /Deleted/);
  await expect(page.getByRole("button", { name: `Edit ${name}` })).toHaveCount(0);
});

test("medicine: add one with a time, take today's dose, undo", async ({ page }) => {
  const name = `E2E vitamin ${Date.now()}`;
  await page.goto("/medicines/manage");
  await page.getByText("+ Add a medicine or course").click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add medicine" }).click();
  await expectToast(page, /./);
  await page.goto("/medicines");
  const item = page.locator("li").filter({ hasText: name }).first();
  await item.getByRole("button", { name: "Take" }).click();
  await expectToast(page, /Dose taken/);
  await page.getByRole("status").filter({ hasText: /Dose taken/ }).getByRole("button", { name: "Undo" }).click();
  await expectToast(page, /Undone/);
});

test("close the day: skip something on purpose, close, Today turns to tomorrow, reopen", async ({ page }) => {
  await page.goto("/close");
  const skip = page.getByRole("checkbox").first();
  if (await skip.isVisible().catch(() => false)) await skip.check();
  await page.getByLabel(/A note for today/).fill("E2E test day");
  await page.getByRole("button", { name: /Close my day/ }).click();
  await page.waitForURL("**/");
  await expect(page.getByText("Day closed").first()).toBeVisible();
  await expect(page.getByText("Tomorrow").first()).toBeVisible();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expectToast(page, /reopened/i);
});

test("offline: a tap is kept, then synced when back online", async ({ page, context }) => {
  await page.goto("/food");
  await context.setOffline(true);
  await page.getByRole("button", { name: "+250 ml" }).first().click();
  await expectToast(page, /saved offline/i);
  await expect(page.getByText(/waiting to sync/)).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expectToast(page, /Synced 1 offline entry/);
});
