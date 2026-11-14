import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { unlock } from "./unlock";

// Idea 8 (the author never checks its own work) and the signed ledger on the committed fixtures:
// mp-2283 is signed and current, mp-2129 is signed for an older diff, mp-2234 has no receipt.
const FIXED_RULE_NOTE = "A fixed policy rule raised this, no model involved. It always reaches a person, whatever the model says.";
const OWN_TEST_NOTE = "The same agent wrote the code and this test, so it can't make the claim Verified.";
const ESCAPE_REASON = "Analyzer: a bug escaped here, the next changes get a full read";

test.beforeEach(async ({ page }) => {
  await unlock(page);
  // Reduced motion shows everything at rest, so screenshots never catch a half-faded element.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const widthOf = (projectName: string): number => (projectName === "mobile" ? 375 : 1440);
const shot = (name: string) => `.review/separation-of-duties-${name}.png`;
const analyzerCard = (page: Page) => page.getByRole("article", { name: "Analyzer" });
const headerOf = (page: Page): Locator => page.getByRole("heading", { level: 1 }).locator("xpath=ancestor::header[1]");

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test("the roles line names author, reviewer and signer once, in the header", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2283");
  const header = headerOf(page);
  await expect(header).toContainText("Written by Coding agent (Tieto sample)");
  await expect(header).toContainText("Reviewed by rv1");
  await expect(header).toContainText("Signed by miska-voutilainen");
  await expect(header.getByRole("link", { name: "Idea 8: Separation of duties, opens the idea page" })).toHaveAttribute("href", /docs\/ideas\/separation-of-duties\.md$/);
  // The status keeps no "Signed by" of its own: the roles line owns it.
  await expect(header.getByText("Signed by")).toHaveCount(1);
  await expect(header.getByRole("link", { name: "View full receipt" })).toBeVisible();
  expect(await hasHorizontalScroll(page)).toBe(false);
  await header.screenshot({ path: shot(`review-header-${widthOf(testInfo.project.name)}`) });
});

test("an unsigned change says Not signed yet", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2234");
  const header = headerOf(page);
  await expect(header).toContainText("Reviewed by rv1");
  await expect(header).toContainText("Not signed yet");
  await expect(header.getByText("Signed by")).toHaveCount(0);
  if (testInfo.project.name === "mobile") await header.screenshot({ path: shot("review-header-unsigned-375") });
});

test("the Refused tab marks a fixed-rule refusal and an AI refusal", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2129");
  await page.getByRole("tab", { name: /Refused/ }).click();
  // The selected tab proves the page has hydrated, so the tap below reaches its handler.
  await expect(page.getByRole("tab", { name: /Refused/ })).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  const items = panel.getByRole("listitem");
  await expect(items.filter({ hasText: "R7" }).getByRole("button", { name: /^Fixed rule/ })).toBeVisible();
  await expect(items.filter({ hasText: "R1" }).getByText("AI", { exact: true })).toBeVisible();

  const chip = panel.getByRole("button", { name: /^Fixed rule/ });
  // A tap opens it on a touch screen, where focus and hover never fire.
  if (testInfo.project.name === "mobile") await chip.tap();
  else await chip.focus();
  await expect(page.getByRole("tooltip").getByText(FIXED_RULE_NOTE)).toBeVisible();
  await panel.screenshot({ path: shot(`refused-${widthOf(testInfo.project.name)}`) });
});

test("a claim backed only by the PR's own test is Supported, and says why", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2283");
  const claim = page.getByRole("tabpanel").getByRole("button", { name: /asserts no AD0001 diagnostic/ });
  await claim.click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("Supported · the PR's own test")).toBeVisible();
  await expect(panel.getByText(OWN_TEST_NOTE)).toBeVisible();
  await expect(panel.getByRole("link", { name: /^Idea 8: / })).toBeVisible();
  if (testInfo.project.name === "mobile") return;

  // On a phone the covered hunks are one summary line, so the diff's evidence line is desktop only.
  const row = page.locator('[data-hunk-id="h8"]');
  await expect(row.getByText("Supported · the PR's own test")).toBeVisible();
  await expect(row.getByRole("link", { name: /^Idea 8: / })).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await row.screenshot({ path: shot("own-test-1440") });
  await claim.locator("xpath=ancestor::li[1]").screenshot({ path: shot("own-test-read-step-1440") });
});

test("the receipt page shows the roles line and the signed ledger", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2283/receipt");
  const receipt = page.getByRole("article", { name: "Receipt for mp-2283" });
  await expect(receipt).toContainText("Written by Coding agent (Tieto sample)");
  await expect(receipt).toContainText("Signed by miska-voutilainen");
  await expect(receipt.getByText("signer", { exact: true })).toHaveCount(0);
  await expect(receipt.getByText("Hunk ledger · signed")).toBeVisible();
  await expect(receipt.getByText("Part of the signed payload: the signature covers which hunks miska-voutilainen read and which checks covered the rest.")).toBeVisible();
  expect(await hasHorizontalScroll(page)).toBe(false);
  await receipt.screenshot({ path: shot(`receipt-${widthOf(testInfo.project.name)}`) });
});

test("a stale receipt still shows the ledger it signed", async ({ page }, testInfo) => {
  await page.goto("/changes/mp-2129/receipt");
  await expect(page.getByText("Hunk ledger · signed")).toBeVisible();
  if (testInfo.project.name === "desktop") await page.getByRole("article", { name: "Receipt for mp-2129" }).screenshot({ path: shot("receipt-stale-1440") });
});

test("Hallucinations caught lists refusals struck for an unknown rule id, or says there are none", async ({ page }, testInfo) => {
  await page.goto("/reviewer");
  const card = page.locator("section").filter({ has: page.getByRole("button", { name: /^Hallucinations caught/ }) });
  await card.getByRole("button", { name: /^Hallucinations caught/ }).click();
  await expect(card.getByText("None in the 4 recorded reviews.")).toBeVisible();
  if (testInfo.project.name === "desktop") await card.screenshot({ path: shot("reviewer-hallucinations-1440") });
});

test("an escape in the analyzer area adds R-escape to the review's reasons, and Undo removes it", async ({ page }, testInfo) => {
  await page.goto("/reviewer");
  await analyzerCard(page).getByRole("button", { name: "Record escape" }).click();
  await expect(analyzerCard(page).getByRole("button", { name: "Undo" })).toBeVisible();

  await page.goto("/changes/mp-2283");
  const tier = page.getByRole("region", { name: "Review tier" });
  const reason = tier.getByRole("listitem").filter({ hasText: ESCAPE_REASON });
  // On a phone more than two reasons sit behind a disclosure.
  if (testInfo.project.name === "mobile") await tier.getByRole("button", { name: /^Why / }).click();
  await expect(reason).toContainText("R-escape");
  await expect(tier.getByText("Full", { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === "desktop") await tier.screenshot({ path: shot("escape-1440") });

  await page.goto("/reviewer");
  await analyzerCard(page).getByRole("button", { name: "Undo" }).click();
  await page.goto("/changes/mp-2283");
  await expect(page.getByRole("region", { name: "Review tier" }).getByText(ESCAPE_REASON)).toHaveCount(0);
});
