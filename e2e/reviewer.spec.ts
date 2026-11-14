import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// The report card shows the committed fixture until a recorded one exists: generator and analyzer
// Calibrated, security and performance Shadow.
const AREA_ORDER = ["Generator", "Analyzer", "Security", "Performance"];
const ESCAPE_TOAST = "Escape recorded in Generator (simulated). Its changes re-routed.";
const ESCAPE_NOTICE = "Escape recorded (simulated) · dropped from Calibrated to Shadow";

/** Collects console errors, warnings and uncaught exceptions while the test runs. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    // Links to /changes/<id> prefetch and 404 until S2 (T18) ships; delete this line with that PR.
    if (/\/changes\/[\w-]+\?_rsc=/.test(message.location().url)) return;
    problems.push(`${message.type()}: ${message.text()} ${message.location().url}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

const generatorCard = (page: Page) => page.getByRole("article", { name: "Generator" });

test.beforeEach(async ({ page }) => {
  await unlock(page);
  // Reduced motion shows everything at rest, so screenshots never catch a half-faded element.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("shows the four areas in order with their sample sizes and no horizontal scroll", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  await page.goto("/reviewer");

  await expect(page.getByRole("heading", { level: 1, name: "Reviewer Report Card" })).toBeAttached();
  await expect(page.getByRole("heading", { level: 3 }).filter({ hasText: /^(Generator|Analyzer|Security|Performance)$/ })).toHaveText(
    AREA_ORDER,
  );
  await expect(generatorCard(page).getByText("3 of 4 planted bugs caught · planted before the prompts")).toBeVisible();
  await expect(generatorCard(page).getByText("Trusted needs 5 clean spot checks: 0 recorded")).toBeVisible();
  await expect(page.getByRole("article", { name: "Performance" }).getByText("No track record")).toBeVisible();
  await expect(page.getByRole("article", { name: "Performance" }).getByRole("button", { name: "Record escape" })).toBeDisabled();

  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalScroll).toBe(false);

  const width = testInfo.project.name === "mobile" ? 375 : 1440;
  await page.screenshot({ path: `.review/reviewer-${width}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("records an escape with a notice and a toast, and undo restores the level", async ({ page }) => {
  await page.goto("/reviewer");
  const card = generatorCard(page);
  await expect(card.getByText("Calibrated", { exact: true }).first()).toBeVisible();

  await card.getByRole("button", { name: "Record escape" }).click();
  await expect(page.getByText(ESCAPE_TOAST)).toBeVisible();
  await expect(card.getByText(ESCAPE_NOTICE)).toBeVisible();
  await expect(card.getByText("(1 simulated escape)")).toBeVisible();
  await expect(card.getByRole("button", { name: "Record escape" })).toBeDisabled();

  await card.getByRole("button", { name: "Undo" }).click();
  await expect(card.getByText(ESCAPE_NOTICE)).toBeHidden();
  await expect(card.getByRole("button", { name: "Record escape" })).toBeEnabled();
});

test("re-routes the inbox without a reload after an escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the breadcrumb is the desktop route back");
  await page.goto("/reviewer");
  await generatorCard(page).getByRole("button", { name: "Record escape" }).click();
  await expect(page.getByText(ESCAPE_NOTICE)).toBeVisible();
  await page.evaluate(() => Object.assign(window, { stillSamePage: true }));

  await page.getByRole("link", { name: "Inbox", exact: true }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
  // The same document: no reload happened between the report card and the inbox.
  expect(await page.evaluate(() => "stillSamePage" in window)).toBe(true);

  // Generator at Shadow routes nothing, so every generator hunk becomes "read this".
  const summary = page.getByText(/^Humans read \d+ of \d+ hunks/);
  await expect(summary).toBeVisible();
  const readAfter = Number((await summary.innerText()).match(/^Humans read (\d+)/)?.[1]);

  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  const readBefore = Number(((await page.getByText(/^Humans read \d+ of \d+ hunks/).innerText()).match(/^Humans read (\d+)/) ?? [])[1]);
  expect(readAfter).toBeGreaterThan(readBefore);
});

test("opens the plant-a-bug dialog with the real steps and closes it on Escape", async ({ page }) => {
  await page.goto("/reviewer");
  await page.getByRole("button", { name: "Plant a synthetic bug" }).click();
  const dialog = page.getByRole("dialog", { name: "Plant a synthetic bug" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("pnpm evals")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
