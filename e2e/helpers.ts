import { expect, type Page } from "@playwright/test";

export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export type TestUser = { email: string; password: string; name: string };

/** Creates a brand-new account through the real signup form and lands on /dashboard. */
export async function signUp(page: Page): Promise<TestUser> {
  const suffix = uniqueSuffix();
  const user: TestUser = {
    email: `e2e-${suffix}@example.com`,
    password: "e2e-password-123",
    name: `E2E ${suffix}`,
  };

  await page.goto("/auth");
  await page.getByRole("button", { name: /don't have an account\? sign up/i }).click();
  await page.getByPlaceholder("Your name").fill(user.name);
  await page.getByPlaceholder("you@example.com").fill(user.email);
  await page.getByPlaceholder("At least 8 characters").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Your sites" })).toBeVisible();
  return user;
}

/** Creates a site from the dashboard and returns its slug + siteId (from the URL). */
export async function createSite(page: Page): Promise<{ slug: string; siteId: string }> {
  const slug = `e2e-${uniqueSuffix()}`;
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New site" }).click();
  await page.getByPlaceholder("Site name").fill(`E2E ${slug}`);
  await page.getByPlaceholder("slug (lowercase, dashes)").fill(slug);
  await page.getByRole("button", { name: "Create" }).click();

  // Creating a site navigates straight into its pages manager.
  await page.waitForURL(/\/sites\/[0-9a-f-]+\/pages/, { timeout: 30_000 });
  const siteId = page.url().match(/\/sites\/([0-9a-f-]+)\//)![1];
  await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
  return { slug, siteId };
}

/** Opens the home page in the builder and publishes it. */
export async function publishHomePage(page: Page) {
  await page.getByRole("link", { name: "Edit" }).first().click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+\/edit/, { timeout: 30_000 });
  const publish = page.getByRole("button", { name: /publish page/i });
  await expect(publish).toBeVisible({ timeout: 30_000 });
  await publish.click();
  await expect(page.getByRole("button", { name: /republish page/i })).toBeVisible({
    timeout: 30_000,
  });
}
