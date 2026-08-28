import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test.describe("authentication", () => {
  test("unauthenticated users are redirected away from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /welcome back|create your account/i })).toBeVisible();
  });

  test("sign up, sign out state persists across a reload", async ({ page }) => {
    await signUp(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your sites" })).toBeVisible({ timeout: 30_000 });
  });

  test("signing in again with the same credentials works", async ({ page, context }) => {
    const user = await signUp(page);
    await context.clearCookies();

    await page.goto("/auth");
    await page.getByPlaceholder("you@example.com").fill(user.email);
    await page.getByPlaceholder("At least 8 characters").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Your sites" })).toBeVisible();
  });
});
