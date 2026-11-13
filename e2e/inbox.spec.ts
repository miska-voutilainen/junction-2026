import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// The inbox shows the committed fixtures until recorded reviews exist: four Tieto changes, one signed.
const SIGNED_CHANGE_HREF = "/changes/mp-2283";

const UNBUILT_ROUTES = ["/changes/", "/dashboard", "/reviewer"];

/** Collects console errors, warnings and uncaught exceptions while the test runs. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    // Links prefetch pages that later tasks ship (/changes/<id>, /dashboard, /reviewer); their 404s are not this page's.
    if (UNBUILT_ROUTES.some((route) => message.location().url.includes(route))) return;
    problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test.beforeEach(async ({ page }) => {
  await unlock(page);
});

test("lists the four changes with their tiers and links each to its review", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  await expect(page.getByText(/^4 changes/)).toBeVisible();
  await expect(page.getByText(/Light|Focused|Full/).first()).toBeVisible();
  // mp-2283 is the signed one, so its row is inside the fold.
  await page.getByRole("button", { name: /^Signed \d+$/ }).click();
  await expect(page.locator(`a[href="${SIGNED_CHANGE_HREF}"]:visible`).first()).toBeVisible();

  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalScroll).toBe(false);

  const width = testInfo.project.name === "mobile" ? 375 : 1440;
  await page.screenshot({ path: `.review/inbox-${width}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("keeps the signed change in a closed fold with its count", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the table is the desktop layout");
  await page.goto("/");
  const fold = page.getByRole("button", { name: /^Signed \d+$/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table", { name: "Signed changes" })).toBeVisible();
});

test("j and k move between rows and Enter opens the change", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "row shortcuts are for the keyboard layout");
  await page.goto("/");
  const links = page.locator("a[data-inbox-row-link]:visible");
  await expect(links.first()).toBeVisible();

  // Keys pressed before React hydrates do nothing, so press until the first row takes focus.
  await expect(async () => {
    await page.keyboard.press("j");
    await expect(links.nth(0)).toBeFocused({ timeout: 500 });
  }).toPass();
  await page.keyboard.press("j");
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await expect(links.nth(0)).toBeFocused();

  const href = await links.nth(0).getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("the command menu opens on Ctrl+K and closes on Esc", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "no keyboard on the phone layout");
  await page.goto("/");
  await expect(page.getByText(/^4 changes/)).toBeVisible();

  // The shortcut is registered on hydration; press until the menu opens.
  await expect(async () => {
    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the phone layout groups changes into Sign here, Needs a desktop and Signed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "desktop shows the table");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Needs a desktop/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open read-only" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});
