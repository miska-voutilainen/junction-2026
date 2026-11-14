import { expect, test } from "@playwright/test";
import { unlock } from "./unlock";

const code = process.env.ACCESS_CODE;

test.describe("gate on", () => {
  test.skip(!code, "ACCESS_CODE is not set");

  test("sends a visitor without the cookie to /unlock", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/unlock\?next=%2F$/);
    await expect(page.getByRole("heading", { name: "This project is private" })).toBeVisible();
  });

  test("a wrong code is checked on its last digit, then the error clears the field and keeps focus", async ({
    page,
  }) => {
    await page.goto("/unlock");
    const field = page.getByLabel("4-digit code");
    await field.pressSequentially("0000");

    await expect(page.getByText("That code doesn't match. Try again.")).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
  });

  test("typing the right code opens the site without pressing anything", async ({ page }) => {
    await page.goto("/unlock?next=%2F");
    await page.getByLabel(/4-digit code|Access code/).pressSequentially(code!);
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  });

  test("the right code opens the site", async ({ page }) => {
    await unlock(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  });

  test("gated pages ask search engines not to index", async ({ page }) => {
    await unlock(page);
    const response = await page.goto("/");
    expect(response?.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("the unlock page has no horizontal scroll", async ({ page }) => {
    await page.goto("/unlock");
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});

test.describe("gate off", () => {
  test.skip(!!code, "ACCESS_CODE is set");

  test("the home page loads directly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  });

  test("/unlock answers with a 307 to /", async ({ request, page }) => {
    const response = await request.get("/unlock", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, "http://localhost").pathname).toBe("/");

    await page.goto("/unlock");
    await expect(page).toHaveURL(/\/$/);
  });
});
