import { test } from "@playwright/test";
import { createSite, signUp } from "./helpers";

test("debug blog create", async ({ page }) => {
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 300)));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400) console.log("HTTP", r.status(), r.url().slice(0, 160));
  });
  await signUp(page);
  const { siteId } = await createSite(page);
  await page.goto(`/sites/${siteId}/blog`);
  await page.waitForTimeout(2000);
  console.log("URL", page.url());
  await page.getByRole("button", { name: "New post" }).click();
  await page.getByPlaceholder("Post title").fill("Debug post");
  await page.getByRole("button", { name: /^create/i }).click();
  await page.waitForTimeout(4000);
  console.log("AFTER", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 600));
});
