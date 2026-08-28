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
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("link", { name: `E2E ${slug}` })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Home" })).toBeVisible();
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
    // Creating a page drops straight into its builder.
    await page.waitForURL(/\/pages\/[0-9a-f-]+\/edit/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Publish page" })).toBeVisible();

    await page.goto(`/s/${slug}/secret`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});
