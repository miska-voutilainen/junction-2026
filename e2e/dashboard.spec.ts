import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// The dashboard shows the committed fixtures until recorded files exist: mp-2283 signed, mp-2129 amended after signing.

/** Collects console errors, warnings and uncaught exceptions while the test runs. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    problems.push(`${message.type()}: ${message.text()} ${message.location().url}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test.beforeEach(async ({ page }) => {
  await unlock(page);
  // Reduced motion shows every bar and fold at rest, so screenshots never catch a half-drawn bar.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("shows what signing covered, with every number from the recorded data", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the facts strip and the table are the desktop layout");
  const problems = watchConsole(page);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const facts = page.locator("dl > div");
  await expect(facts).toHaveCount(5);
  await expect(page.getByText("Signed", { exact: true })).toBeVisible();
  await expect(page.getByText("Hunks read by a person", { exact: true })).toBeVisible();
  await expect(page.getByText("Contradictions caught", { exact: true })).toBeVisible();
  await expect(page.getByText("Escapes recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("Median time to sign")).toBeVisible();
  await expect(page.getByText("Not measured yet")).toBeVisible();

  const table = page.getByRole("table", { name: "Accepted risk" });
  const signedRow = table.getByRole("row").filter({ hasText: "mp-2283" });
  await expect(signedRow.getByRole("link", { name: "mp-2283" })).toHaveAttribute("href", "/changes/mp-2283");
  await expect(signedRow).toContainText("Holds: code unchanged");
  await expect(table.getByRole("row").filter({ hasText: "mp-2129" })).toContainText("Stale: code changed");

  for (const tier of ["Light", "Focused", "Full"]) {
    await expect(page.getByRole("img", { name: new RegExp(`^${tier}: `) })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /^Review next/ })).toBeVisible();

  await page.getByRole("button", { name: /Why changes were escalated above Light/ }).click();
  await page.getByRole("button", { name: /Reviewer trust by area/ }).click();
  await expect(page.getByRole("link", { name: "Open the report card" })).toHaveAttribute("href", "/reviewer");

  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: ".review/dashboard-1440.png", fullPage: true });
  expect(problems).toEqual([]);
});

test("stacks the phone layout: summary, open decisions, accepted risk, attention", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "375 px layout");
  const problems = watchConsole(page);
  await page.goto("/dashboard");

  await expect(page.getByText(/changes signed · .* hunks read by a person/)).toBeVisible();
  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings).toEqual(["Open decisions", "Accepted risk", "Attention by tier"]);
  await expect(page.getByText("Median time to sign")).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: "mp-2283" })).toContainText("Holds: code unchanged");
  await expect(page.getByRole("img", { name: /^Full: / })).toBeVisible();

  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: ".review/dashboard-375.png", fullPage: true });
  expect(problems).toEqual([]);
});

test("has no horizontal scroll from 320 to 1920 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "sweeps the widths itself");
  await page.goto("/dashboard");
  for (const width of [320, 375, 759, 760, 900, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
  }
});

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalScroll).toBe(false);
}
