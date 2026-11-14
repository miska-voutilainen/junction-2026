import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// The review page shows the committed fixtures until recorded reviews exist.
const CHANGE_PATH = "/changes/mp-2283";
const fixture = JSON.parse(readFileSync("data/fixtures/runs/mp-2283/review.json", "utf8")) as {
  routing: { tier: string; readHunks: number; totalHunks: number; readMinutes: number; fullMinutes: number };
  hunks: unknown[];
};

/** Collects console errors, warnings and uncaught exceptions while the test runs. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()} ${message.location().url}`);
    }
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

test("shows the tier line the routing computes, with no console errors and no page scroll", async ({ page }, testInfo) => {
  const problems = watchConsole(page);
  // Reduced motion shows every reveal at rest, so the screenshots never catch a half-open section.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CHANGE_PATH);

  const { tier, readHunks, totalHunks, readMinutes, fullMinutes } = fixture.routing;
  const tierLine = page.getByRole("region", { name: "Review tier" });
  await expect(tierLine).toContainText(tier[0].toUpperCase() + tier.slice(1));
  const fullRead = fullMinutes === readMinutes ? "" : ` (full read ~${fullMinutes} min)`;
  await expect(tierLine).toContainText(`read ${readHunks} of ${totalHunks} hunks · ~${readMinutes} min${fullRead}`);
  // More than two reasons: open on a desktop, behind "Why <Tier>" on a phone.
  if (testInfo.project.name === "mobile") await expect(tierLine.getByRole("button", { name: /^Why / })).toHaveAttribute("aria-expanded", "false");
  else await expect(tierLine.getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  expect(await hasHorizontalScroll(page)).toBe(false);
  const width = testInfo.project.name === "mobile" ? 375 : 1440;
  await page.screenshot({ path: `.review/review-${width}.png`, fullPage: true });
  expect(problems).toEqual([]);
});

test("gives every hunk exactly one coverage label", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the phone shows only the hunks to read");
  await page.goto(CHANGE_PATH);
  await page.getByRole("button", { name: /^Covered by evidence/ }).click();

  const cards = page.locator("[data-hunk-card]:visible");
  await expect(cards).toHaveCount(fixture.hunks.length);
  for (const card of await cards.all()) {
    const coverage = (await card.getAttribute("data-coverage")) ?? "";
    const label = { read: "Read this", supported: "Supported", verified: "Verified" }[coverage];
    await expect(card.getByText(/^(Read this|Supported|Verified)$/)).toHaveCount(1);
    await expect(card.getByText(label ?? "", { exact: true })).toHaveCount(1);
  }
});

test("a navigator click focuses the hunk header, and j moves to the next hunk", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the navigator is a column from 1100 px");
  await page.goto(CHANGE_PATH);

  const navigator = page.getByRole("navigation", { name: "Hunks" });
  const first = navigator.getByRole("button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(page.locator("[data-hunk-card]:visible").first().locator("[id^=hunk-header-]")).toBeFocused();

  // A covered hunk sits in a closed section; the jump opens it.
  await navigator.getByRole("button", { name: /GenerationTests\.cs\s*:118/ }).click();
  await expect(page.getByRole("button", { name: /^Covered by evidence/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-hunk-id=h5] button[aria-expanded]")).toBeFocused();

  await page.keyboard.press("j");
  await expect(navigator.getByRole("button", { name: /GenerationTests\.cs\s*:331/ })).toHaveAttribute("aria-current", "true");
});

test("Wrap toggles, Copy announces Copied and Mark read moves the progress", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the toolbar is the desktop layout");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(CHANGE_PATH);
  const card = page.locator("[data-hunk-card]:visible").first();

  const wrap = card.getByRole("button", { name: "Wrap lines" });
  const wasWrapped = await wrap.getAttribute("aria-pressed");
  await wrap.click();
  await expect(wrap).toHaveAttribute("aria-pressed", wasWrapped === "true" ? "false" : "true");

  await card.getByRole("button", { name: /^Copy hunk/ }).click();
  await expect(card.getByRole("status").filter({ hasText: "Copied" })).toBeAttached();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@\r?\n/);

  const progress = page.getByRole("navigation", { name: "Hunks" }).getByText(/\d+\/\d+ read/);
  await expect(progress).toHaveText("0/2 read");
  const markRead = card.getByRole("button", { name: "Mark read" });
  await markRead.click();
  // The name stays; the pressed state and the progress show the change.
  await expect(markRead).toHaveAttribute("aria-pressed", "true");
  await expect(progress).toHaveText("1/2 read");
});

test("the phone shows the hunks to read read-only, behind one button", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "desktop shows the full diff");
  await page.goto(CHANGE_PATH);
  const toggle = page.getByRole("button", { name: /^Read-only hunks/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: /^Copy hunk/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark read" })).toHaveCount(0);
  expect(await hasHorizontalScroll(page)).toBe(false);
});

test("mp-2297 lists its generated hunks apart from the reading count", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2297");
  await expect(page.getByText("read 2 of 5 hunks · 2 generated")).toBeVisible();
  await expect(page.getByText(/^2 are generated snapshots: read the template change that produces them/)).toBeVisible();
  if (testInfo.project.name === "mobile") {
    // The note sits above the sticky Sign bar once the page is scrolled to its end.
    const note = page.getByText("Generated: 2 hunks, not in the reading count");
    await note.scrollIntoViewIfNeeded();
    await expect(note).toBeVisible();
    return;
  }
  await expect(page.getByRole("heading", { name: /^Generated\s*2$/ })).toBeVisible();
});

test("an unknown id says so, keeps the four changes in the shell and links back to the inbox", async ({ page }, testInfo) => {
  await page.goto("/changes/zz-9999");
  await expect(page.getByText("No change with id zz-9999.")).toBeVisible();
  if (testInfo.project.name !== "mobile") {
    // The shell's command menu still lists the four changes.
    await expect(async () => {
      await page.keyboard.press("Control+K");
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 500 });
    }).toPass();
    await expect(page.getByRole("dialog").getByRole("group", { name: "Changes" }).getByRole("option")).toHaveCount(4);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("link", { name: "Back to the inbox" }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const changeId of ["mp-2283", "mp-2297"]) {
  test(`${changeId} never scrolls the page sideways, from 320 to 1920 px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "sets its own widths");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 768, 1099, 1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/changes/${changeId}`);
      const covered = page.getByRole("button", { name: /^Covered by evidence/ });
      if (await covered.isVisible()) await covered.click();
      const generated = page.getByRole("button", { name: /snapshot files? · not in the reading count · Show/ });
      if (await generated.isVisible()) await generated.click();
      expect(await hasHorizontalScroll(page), `page scrolls sideways at ${width} px`).toBe(false);
    }
  });
}
