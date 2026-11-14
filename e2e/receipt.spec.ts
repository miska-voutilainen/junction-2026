import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// Fixtures: mp-2283 signed and current, mp-2129 signed for an older diff, mp-2234 not signed.
const SIGNED_DIFF_HASH_PREFIX = "4324d7fc9bf1398271864e2d529054c4f28b9dc911d42b3bb4184463d2f3a322";
const WIDTHS = [320, 375, 768, 1440, 1920];

/** Collects console errors, warnings and uncaught exceptions while the test runs. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    // The back-to-review links prefetch /changes/<id>, which 404s until S2 (T18) ships; delete this line with that PR.
    if (/\/changes\/[\w-]+(\?_rsc=|$)/.test(message.location().url)) return;
    problems.push(`${message.type()}: ${message.text()} ${message.location().url}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test.beforeEach(async ({ page }) => {
  await unlock(page);
});

test("a signed receipt shows the seal, the diff hash and the verify output", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  // Reduced motion shows the seal at rest, so the screenshots never catch the pulse.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/changes/mp-2283/receipt");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Signature verified", { exact: true })).toBeVisible();
  await expect(page.getByText(SIGNED_DIFF_HASH_PREFIX).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checked", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not checked" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Residual risk" })).toBeVisible();
  await expect(page.getByText("Signature valid · diff unchanged")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).or(page.getByRole("link", { name: "Back" }))).toBeVisible();

  const width = testInfo.project.name === "mobile" ? 375 : 1440;
  await page.screenshot({ path: `.review/receipt-${width}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("a receipt for an older diff shows the stale notice and no seal", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/changes/mp-2129/receipt");

  await expect(page.getByText("The code changed after signing. This receipt no longer covers the diff.")).toBeVisible();
  await expect(page.getByText("Signature verified", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "sign command" })).toContainText("pnpm countersign sign mp-2129");
  expect(problems).toEqual([]);
});

test("a change without a receipt says so and shows the sign command", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/changes/mp-2234/receipt");

  await expect(page.getByRole("heading", { name: "Not signed yet." })).toBeVisible();
  await expect(page.getByText("Only a named human can sign. Review the change, then run")).toBeVisible();
  await expect(page.getByText("pnpm countersign sign mp-2234")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the review" })).toHaveAttribute("href", "/changes/mp-2234");
  await expect(page.getByText("Signature verified", { exact: true })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("Copy announces Copied and Wrap toggles aria-pressed", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/changes/mp-2283/receipt");

  await page.getByRole("button", { name: "Copy countersign verify" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" }).first()).toHaveText("Copied");

  const wrap = page.getByRole("button", { name: "Wrap lines" }).first();
  const before = await wrap.getAttribute("aria-pressed");
  await wrap.click();
  await expect(wrap).not.toHaveAttribute("aria-pressed", before ?? "");
});

test("the page never scrolls sideways from 320 to 1920 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the widths are set in this test");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const changeId of ["mp-2283", "mp-2129", "mp-2234"]) {
      await page.goto(`/changes/${changeId}/receipt`);
      await expect(page.getByRole("main")).toBeVisible();
      expect(await hasHorizontalScroll(page), `${changeId} at ${width}px`).toBe(false);
    }
  }
});
