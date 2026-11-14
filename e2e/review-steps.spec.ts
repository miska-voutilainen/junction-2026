import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { unlock } from "./unlock";

// The review page shows the committed fixtures until recorded reviews exist:
// mp-2283 is signed, mp-2129 has a receipt for an older diff, mp-2234 has none.
const SIGNED = "/changes/mp-2283";
const STALE = "/changes/mp-2129";
const UNSIGNED = "/changes/mp-2234";

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

const stepTab = (page: Page, name: RegExp) => page.getByRole("tab", { name });

/** Opens a step by its tab, which also waits for the page to hydrate; keys pressed before that do nothing. */
async function openStep(page: Page, name: RegExp): Promise<void> {
  await stepTab(page, name).click();
  await expect(stepTab(page, name)).toHaveAttribute("aria-selected", "true");
}

test.beforeEach(async ({ page }) => {
  await unlock(page);
});

test("moves between the four steps with the arrow keys, Home, End and the keys 1 to 4", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(SIGNED);

  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(stepTab(page, /Read/)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Claims");

  await stepTab(page, /Read/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(stepTab(page, /Blind check/)).toHaveAttribute("aria-selected", "true");
  await expect(stepTab(page, /Blind check/)).toBeFocused();
  await page.keyboard.press("End");
  await expect(stepTab(page, /Sign/)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(stepTab(page, /Read/)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(stepTab(page, /Sign/)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(stepTab(page, /Read/)).toHaveAttribute("aria-selected", "true");

  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (const [key, name] of [["3", /Refused/], ["2", /Blind check/], ["4", /Sign/], ["1", /Read/]] as const) {
    await page.keyboard.press(key);
    await expect(stepTab(page, name)).toHaveAttribute("aria-selected", "true");
  }
  expect(problems).toEqual([]);
});

test("selecting a claim highlights its lines in the diff and brings them into view", async ({ page }, testInfo) => {
  await page.goto(SIGNED);
  await openStep(page, /Read/);
  const claim = page.getByRole("button", { name: /ClosedGenericStruct|no longer throws/i }).first();
  await claim.click();
  await expect(claim).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Show .* in the diff$/ }).first()).toBeVisible();

  // A phone shows only the read-only hunks, behind a disclosure: this claim's hunk is covered, so no diff line exists there to highlight.
  if (testInfo.project.name === "desktop") {
    const highlighted = page.locator("tr[data-highlighted]").first();
    await expect(highlighted).toBeInViewport();
  }

  await claim.click();
  await expect(claim).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("tr[data-highlighted]")).toHaveCount(0);
});

test("lists the refusals with the rule, the decider and which one the receipt accepted", async ({ page }, testInfo) => {
  await page.goto(SIGNED);
  await openStep(page, /Refused/);
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  await expect(panel).toContainText("R6");
  await expect(panel).toContainText("Decides: change owner");
  await expect(panel).toContainText("R7");
  await expect(panel).toContainText("Decides: API owner");
  await expect(panel).toContainText("Accepted in the receipt by");
  await expect(panel).toContainText("Open: no signed receipt accepts it yet");

  if (testInfo.project.name === "desktop") {
    await panel.getByRole("button", { name: /^Show .* in the diff$/ }).first().click();
    await expect(page.locator("[data-hunk-card]").first()).toBeVisible();
  }
});

test("shows the contradiction on the blind check with what the PR says and what the code does", async ({ page }, testInfo) => {
  await page.goto(SIGNED);
  await openStep(page, /Blind check/);
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("The PR says:");
  await expect(panel).toContainText("The code does:");
  await expect(panel).toContainText("Given the PR description first vs blind-first");
  if (testInfo.project.name === "desktop") {
    await panel.getByRole("button", { name: /^Show .* in the diff$/ }).first().click();
    await expect(page.locator("tr[data-highlighted]").first()).toBeInViewport();
  }
});

test("signed change shows the verified seal, the signer and the verify output", async ({ page }) => {
  await page.goto(SIGNED);
  await openStep(page, /Sign/);
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Signature verified");
  await expect(panel).toContainText("Signed by");
  await expect(panel).toContainText("Signature valid · diff unchanged");
  await expect(panel.getByRole("link", { name: "View full receipt" })).toHaveAttribute("href", "/changes/mp-2283/receipt");
});

test("stale change warns that the code changed after signing and shows both hashes", async ({ page }) => {
  await page.goto(STALE);
  await openStep(page, /Sign/);
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Stale: the code changed after signing.");
  await expect(panel).toContainText("signed");
  await expect(panel).toContainText("current");
  await expect(panel).toContainText("pnpm countersign sign mp-2129");
});

test("unsigned change shows the drafted receipt, the sign command and copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(UNSIGNED);
  await openStep(page, /Sign/);
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Drafted by the AI. Only a named human can sign it.");
  await expect(panel).toContainText("Signing happens in your terminal with your own SSH key.");
  await expect(panel).toContainText("pnpm countersign sign mp-2234");

  await panel.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Copied" }).first()).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("pnpm countersign sign mp-2234");
});

test("the Copy button of a sign command announces Copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(UNSIGNED);
  await openStep(page, /Sign/);
  await page.getByRole("tabpanel").getByRole("button", { name: "Copy Sign command" }).click();
  await expect(page.getByRole("tabpanel").getByRole("status").filter({ hasText: "Copied" }).last()).toHaveText("Copied");
});

test("phone: the Sign bar opens step 4", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The bar exists below 760 px only.");
  await page.goto(UNSIGNED);
  await page.getByRole("button", { name: "Sign", exact: true }).first().click();
  await expect(stepTab(page, /Sign/)).toHaveAttribute("aria-selected", "true");
  await expect(stepTab(page, /Sign/)).toBeInViewport();
});

test("the page never scrolls sideways from 320 to 1920 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Sets its own widths.");
  const problems = watchConsole(page);
  for (const width of [320, 375, 768, 1099, 1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [SIGNED, STALE, UNSIGNED, "/changes/mp-2297"]) {
      await page.goto(path);
      for (const name of [/Read/, /Blind check/, /Refused/, /Sign/]) {
        await openStep(page, name);
        expect(await hasHorizontalScroll(page), `${path} step ${name} at ${width} px`).toBe(false);
      }
    }
  }
  expect(problems).toEqual([]);
});

test("the header's Sign button opens step 4 for an unsigned change and is absent for a signed one", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The header button shows from 760 px.");
  await page.goto(UNSIGNED);
  await page.getByRole("banner").or(page.locator("header")).getByRole("button", { name: /^Sign/ }).first().click();
  await expect(stepTab(page, /Sign/)).toHaveAttribute("aria-selected", "true");

  await page.goto(SIGNED);
  await expect(page.locator("header").getByRole("button", { name: /^Sign/ })).toHaveCount(0);
});

test("a second press on a contradiction's location clears the highlight, and changing step does too", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A phone shows no covered hunks to highlight.");
  await page.goto(SIGNED);
  await openStep(page, /Blind check/);
  const location = page.getByRole("tabpanel").getByRole("button", { name: /^Show .* in the diff$/ }).first();
  await location.click();
  await expect(page.locator("tr[data-highlighted]").first()).toBeAttached();
  await location.click();
  await expect(page.locator("tr[data-highlighted]")).toHaveCount(0);

  await location.click();
  await expect(page.locator("tr[data-highlighted]").first()).toBeAttached();
  await openStep(page, /Refused/);
  await expect(page.locator("tr[data-highlighted]")).toHaveCount(0);
});

test("every tab controls a tabpanel that exists, and only the open one has content", async ({ page }) => {
  await page.goto(SIGNED);
  await expect(stepTab(page, /Read/)).toBeVisible();
  for (const id of ["read", "blind", "refused", "sign"]) {
    await expect(page.locator(`#step-panel-${id}`)).toBeAttached();
  }
  await expect(page.locator("#step-panel-blind")).toBeHidden();
});

test("screenshots of the steps panel", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(SIGNED);
  await openStep(page, /Read/);
  const isDesktop = testInfo.project.name === "desktop";
  const width = isDesktop ? 1440 : 375;

  // A claim's lines in the diff next to the panel: the one view that shows the two halves working together.
  if (isDesktop) {
    await page.getByRole("tabpanel").getByRole("button", { name: /ClosedGenericStruct|no longer throws/i }).first().click();
    await expect(page.locator("tr[data-highlighted]").first()).toBeInViewport();
    await page.screenshot({ path: ".review/review-steps-claim-1440.png" });
  } else {
    await page.getByRole("tabpanel").getByRole("button").first().click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.review/review-steps-${width}.png`, fullPage: true });
});
