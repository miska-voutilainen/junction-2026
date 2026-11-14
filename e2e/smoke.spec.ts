import { expect, test } from "./fixtures";
import { bypassVercelAuth } from "./bypassVercelAuth";

test.beforeEach(async ({ page }) => {
  await bypassVercelAuth(page);
});

test("the inbox opens with a clean console", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
});

test("the reviewer report card opens with a clean console", async ({ page }) => {
  await page.goto("/reviewer");
  await expect(page.getByRole("heading", { level: 1, name: "Reviewer report card" })).toBeAttached();
});
