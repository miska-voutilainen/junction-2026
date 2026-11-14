import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// Fixtures: mp-2283 signed and current, mp-2129 signed for an older diff, mp-2234 not signed.
const SIGNED_DIFF_HASH = "4324d7fc9bf1398271864e2d529054c4f28b9dc911d42b3bb4184463d2f3a322";
const WIDTHS = [320, 375, 768, 1440, 1920];

const normalizeLineEndings = (text: string): string => text.replaceAll("\r\n", "\n");

/** The receipt file as the site reads it: the recorded one, else the fixture. */
function receiptFileText(changeId: string): string {
  const recorded = path.join("data", "receipts", `${changeId}.json`);
  return readFileSync(existsSync(recorded) ? recorded : path.join("data", "fixtures", "receipts", `${changeId}.json`), "utf8");
}

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
  await expect(page.getByText(SIGNED_DIFF_HASH).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checked", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not checked" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Residual risk" })).toBeVisible();
  await expect(page.getByText("Signature valid · diff unchanged")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).or(page.getByRole("link", { name: "Back" }))).toBeVisible();

  const width = testInfo.project.name === "mobile" ? 375 : 1440;
  await page.screenshot({ path: `.review/receipt-${width}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("a receipt for an older diff shows the stale notice and no seal", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/changes/mp-2129/receipt");

  await expect(page.getByRole("heading", { name: "Stale: the code changed after signing." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Diff hashes" })).toContainText(/Signed diff\s+[0-9a-f]{12}\s+Reviewed diff\s+[0-9a-f]{12}/);
  await expect(page.getByText("Signature verified", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "sign command" })).toContainText("pnpm countersign sign mp-2129");
  await page.screenshot({ path: `.review/receipt-stale-${testInfo.project.name === "mobile" ? 375 : 1440}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("a change without a receipt says so and shows the sign command", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.goto("/changes/mp-2234/receipt");

  await expect(page.getByRole("heading", { name: "No receipt for mp-2234 yet." })).toBeVisible();
  await expect(page.getByText("Only a named human can sign. Review the change, then run")).toBeVisible();
  await expect(page.getByText("pnpm countersign sign mp-2234")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the review" })).toHaveAttribute("href", "/changes/mp-2234");
  await expect(page.getByText("Signature verified", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `.review/receipt-unsigned-${testInfo.project.name === "mobile" ? 375 : 1440}.png`, fullPage: true });
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

test("an unknown id under /receipt shows the not-found page inside the shell", async ({ page }) => {
  await page.goto("/changes/nope-1/receipt");
  await expect(page.getByRole("heading", { name: "No change with id nope-1." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the inbox" })).toBeVisible();
});

test("the printout drops the shell and the toolbar and keeps the receipt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/changes/mp-2283/receipt");
  await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Residual risk" })).toBeVisible();
  await expect(page.getByText("Signature verified", { exact: true })).toBeVisible();
});

test("the review page links to the full receipt", async ({ page }) => {
  await page.goto("/changes/mp-2129");
  await page.getByRole("link", { name: "View full receipt" }).click();
  await expect(page).toHaveURL(/\/changes\/mp-2129\/receipt$/);
});

test("the toolbar copies the verify command and an absolute link to the page", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/changes/mp-2283/receipt");

  await page.getByRole("button", { name: "Copy verify command" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied" })).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("pnpm countersign verify mp-2283");

  await page.getByRole("button", { name: "Copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/^https?:\/\/.+\/changes\/mp-2283\/receipt$/);
});

test("Copy JSON puts the receipt file's exact text on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/changes/mp-2283/receipt");

  await page.getByRole("button", { name: "Receipt JSON", exact: true }).click();
  await page.getByRole("button", { name: "Copy Receipt JSON" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // A Windows checkout has CRLF in the file and the browser's clipboard may return LF; nothing else may differ.
  expect(normalizeLineEndings(copied)).toBe(normalizeLineEndings(receiptFileText("mp-2283")));
});
