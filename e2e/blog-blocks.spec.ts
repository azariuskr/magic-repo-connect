import { expect, test } from "@playwright/test";
import { createSite, publishHomePage, signUp, uniqueSuffix } from "./helpers";

test.describe("blog module", () => {
  test("a published post appears on the public blog index", async ({ page }) => {
    await signUp(page);
    const { slug, siteId } = await createSite(page);
    await publishHomePage(page);

    const title = `E2E post ${uniqueSuffix()}`;
    await page.goto(`/sites/${siteId}/blog`);
    await page.getByRole("button", { name: "New post" }).click();
    await page.getByPlaceholder("Post title").fill(title);
    await page.getByRole("button", { name: /^create/i }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole("button", { name: "Publish" }).click();
    await expect(row.getByText("Published")).toBeVisible({ timeout: 30_000 });

    await page.goto(`/s/${slug}/blog`);
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  });
});
