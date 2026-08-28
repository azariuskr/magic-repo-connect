import { expect, test } from "@playwright/test";
import { createSite, publishHomePage, signUp } from "./helpers";

test.describe("public site rendering", () => {
  test("unknown site slug shows the not-found screen", async ({ page }) => {
    await page.goto("/s/definitely-not-a-real-site-slug");
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  });

  test("a published home page renders publicly with its nav", async ({ page }) => {
    await signUp(page);
    const { slug } = await createSite(page);
    await publishHomePage(page);

    await page.goto(`/s/${slug}`);
    // Default starter content comes from the Hero block.
    await expect(page.locator("section").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("hasn't been published yet");
  });

  test("draft pages are not publicly reachable", async ({ page }) => {
    await signUp(page);
    const { slug, siteId } = await createSite(page);

    await page.goto(`/sites/${siteId}/pages`);
    await page.getByRole("button", { name: "New page" }).click();
    await page.getByPlaceholder("Page title (e.g. About)").fill("Secret");
    await page.getByPlaceholder("/about").fill("/secret");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("cell", { name: "/secret" })).toBeVisible({ timeout: 30_000 });

    await page.goto(`/s/${slug}/secret`);
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
  });
});
