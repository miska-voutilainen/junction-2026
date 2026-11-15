import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { bypassHeaders, bypassVercelAuth } from "./bypassVercelAuth";
import { expectNoSemicolonsOrArrows } from "./copyPunctuation";

// Runs in the `real-data` project against a build of the committed data/ as it is.
// Everything expected here is read from data/ at test time, so the spec keeps
// working as recordings land; the behaviour specs use fixtures instead.
const dataRoot = path.join(process.cwd(), "data");
const changesFolder = path.join(dataRoot, "sample", "changes");

/** Ids of the Tieto changes: planted-bug and contradiction-plant inputs share the folder and are not reviewable. */
function tietoChangeIds(): string[] {
  return readdirSync(changesFolder)
    .filter((name) => name.endsWith(".json"))
    .map(
      (name) =>
        JSON.parse(readFileSync(path.join(changesFolder, name), "utf8")) as {
          id: string;
          kind: string;
        },
    )
    .filter((change) => change.kind === "tieto")
    .map((change) => change.id)
    .sort();
}

/**
 * Whether a page reading these changes must show the mock-data banner: the
 * report card or any change's review is missing from the recorded folders and
 * so comes from fixtures. Mirrors the loaders' per-file fallback.
 */
function expectsMockDataBanner(changeIds: string[]): boolean {
  const hasRecordedReportCard = existsSync(path.join(dataRoot, "eval", "report-card.json"));
  const allReviewsRecorded = changeIds.every((id) =>
    existsSync(path.join(dataRoot, "runs", id, "review.json")),
  );
  return !(hasRecordedReportCard && allReviewsRecorded);
}

const changeIds = tietoChangeIds();
const mockDataBanner = (page: import("@playwright/test").Page) =>
  page.getByText("Showing mock data");

test.beforeEach(async ({ page }) => {
  await bypassVercelAuth(page);
});

test("the inbox lists exactly the Tieto changes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  await expect(page.getByText(new RegExp(`^${changeIds.length} changes`))).toBeVisible();

  // The fold keeps signed changes out of the open list; expand it so every change has a visible link.
  const fold = page.getByRole("button", { name: /^Signed \d+$/ });
  if (await fold.count()) await fold.click();
  const hrefs = await page
    .locator('a[href^="/changes/"]:visible')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")?.split("/")[2] ?? ""));
  expect([...new Set(hrefs)].sort()).toEqual(changeIds);
});

for (const id of changeIds) {
  test(`the review page of ${id} loads cleanly`, async ({ page }) => {
    await page.goto(`/changes/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    if (expectsMockDataBanner(changeIds)) await expect(mockDataBanner(page)).toBeVisible();
    else await expect(mockDataBanner(page)).toHaveCount(0);
  });

  // The recorded prose quotes C# names with no break in them; the fixtures don't, so only real data shows a cut-off line.
  test(`no step text of ${id} runs past its panel at 375 px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/changes/${id}`);
    for (const step of [/^Read/, /^Blind check/, /^Refused/, /^Sign/]) {
      await page.getByRole("tab", { name: step }).click();
      const overflowing = await page
        .getByRole("tabpanel")
        .locator("p, li, dd")
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.scrollWidth > element.clientWidth)
            .map((element) => element.textContent?.slice(0, 60)),
        );
      expect(overflowing, `${id}, step ${step.source}`).toEqual([]);
    }
  });

  test(`the copy of ${id} has no semicolons or arrows on any step`, async ({ page }) => {
    await page.goto(`/changes/${id}`);
    await expectNoSemicolonsOrArrows(page, `${id}, page`);
    for (const step of [/^Read/, /^Blind check/, /^Refused/, /^Sign/]) {
      await page.getByRole("tab", { name: step }).click();
      await expectNoSemicolonsOrArrows(page, `${id}, step ${step.source}`);
    }
  });
}

test("planted inputs are not reviewable changes", async ({ page }) => {
  const plantIds = readdirSync(changesFolder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .filter((id) => !changeIds.includes(id));
  for (const id of plantIds) {
    // A request, not a page visit: the browser logs every 404 as a console error.
    // No redirects: a redirect (to a login page, say) must fail the test, not read as a 200.
    const response = await page.request.get(`/changes/${id}`, {
      headers: bypassHeaders(),
      maxRedirects: 0,
    });
    expect(response.status(), `/changes/${id}`).toBe(404);
  }
});

test("the reviewer report card and the dashboard load cleanly", async ({ page }) => {
  await page.goto("/reviewer");
  await expect(
    page.getByRole("heading", { level: 1, name: "Reviewer report card" }),
  ).toBeAttached();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
});

/**
 * Hunks the signer of mp-2283 left unread, from the exported receipt. All of
 * them sit in Generator files, so a Generator escape that drops the area to
 * Shadow sends every one of them back to a person.
 */
function unreadHunksOfSignedMp2283(): number {
  const receiptFile = path.join(dataRoot, "receipts", "mp-2283.json");
  const exported = JSON.parse(readFileSync(receiptFile, "utf8")) as {
    receipt: { hunks: { readBy: string | null }[] };
  };
  return exported.receipt.hunks.filter((hunk) => hunk.readBy === null).length;
}

test("a Generator escape reopens the signed mp-2283", async ({ page }) => {
  const unread = unreadHunksOfSignedMp2283();
  const reopenedLine =
    unread === 1
      ? "1 hunk the signer didn't read now needs a person."
      : `${unread} hunks the signer didn't read now need a person.`;
  await page.goto("/reviewer");
  await page
    .getByRole("article", { name: "Generator" })
    .getByRole("button", { name: "Record escape" })
    .click();
  await expect(page.getByText("Escape recorded (simulated)")).toBeVisible();

  await page.goto("/changes/mp-2283");
  await expect(page.getByText("Reopened by an escape", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      `An escape in Generator re-routed this change after it was signed: ${reopenedLine}`,
    ),
  ).toBeVisible();
});

// The legacy guard (idea 9) on S2 for every recorded review that has touch points.
// Expected text is read from data/runs at test time, so a newly recorded change is covered without an edit.
interface RecordedTouchPoint {
  kind: string;
  detail: string;
  owner: string;
  hunkIds: string[];
  guard: { status: "unguarded" | "partly" | "owner-read" | "guarded"; evidence: string };
}
interface RecordedLegacyReview {
  touchPoints: RecordedTouchPoint[];
  legacyReasons: string[];
  r8Refusals: { id: string }[];
}

const guardStatusWord = {
  unguarded: "Unguarded",
  partly: "Partly guarded",
  "owner-read": "Owner reads",
  guarded: "Guarded",
} as const;
const touchKindWord: Record<string, string> = {
  "legacy-code": "Legacy code",
  "old-platform": "Old platform",
  "consumer-contract": "Consumer contract",
  build: "Build and dependencies",
};

function readRecordedReview(id: string): Record<string, unknown> | null {
  const file = path.join(dataRoot, "runs", id, "review.json");
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>)
    : null;
}

/** The recorded reviews with touch points, keyed by change id; the rest are the "old reviews" case. */
function legacyReviews(): Map<string, RecordedLegacyReview> {
  const found = new Map<string, RecordedLegacyReview>();
  for (const id of changeIds) {
    const review = readRecordedReview(id) as {
      legacyTouchPoints?: RecordedTouchPoint[];
      refusals: { id: string; ruleId: string }[];
      routing: { reasons: { ruleId: string; text: string }[] };
    } | null;
    // An empty list means the guard ran and found nothing, which the page shows as no
    // legacy section at all, so it belongs with the reviews recorded before the guard.
    if (!review?.legacyTouchPoints?.length) continue;
    found.set(id, {
      touchPoints: review.legacyTouchPoints,
      legacyReasons: review.routing.reasons
        .filter((reason) => reason.ruleId.startsWith("R-legacy"))
        .map((reason) => reason.text),
      r8Refusals: review.refusals.filter((refusal) => refusal.ruleId === "R8"),
    });
  }
  return found;
}

const withTouchPoints = legacyReviews();
const withoutTouchPoints = changeIds.filter(
  (id) => readRecordedReview(id) && !withTouchPoints.has(id),
);

test("the recorded data has the guard states the screens are checked on", () => {
  const recorded = new Set(
    [...withTouchPoints.values()].flatMap((review) =>
      review.touchPoints.map((touch) => touch.guard.status),
    ),
  );
  expect(recorded.has("unguarded"), "an unguarded touch point is recorded (mp-2297)").toBe(true);
  expect(recorded.has("guarded"), "a guarded touch point is recorded (mp-2129)").toBe(true);
  const missing = Object.keys(guardStatusWord).filter(
    (status) => !recorded.has(status as keyof typeof guardStatusWord),
  );
  // Not an error: fixtures are not added to data/runs, so these states are covered by unit tests of the row model only.
  if (missing.length > 0)
    test.info().annotations.push({ type: "no recorded case", description: missing.join(", ") });
});

for (const [id, review] of withTouchPoints) {
  for (const width of [375, 1440]) {
    test.describe(`${id} legacy guard at ${width} px`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.goto(`/changes/${id}`);
      });

      test("lists every touch point with its kind, detail, hunks, owner, guard and evidence", async ({
        page,
      }) => {
        const section = page.getByRole("region", { name: /Legacy touch points/ });
        const rows = section.getByRole("listitem");
        await expect(rows).toHaveCount(review.touchPoints.length);
        for (const [index, touch] of review.touchPoints.entries()) {
          const row = rows.nth(index);
          await expect(row).toContainText(touchKindWord[touch.kind]);
          await expect(row).toContainText(touch.detail);
          await expect(row).toContainText(
            `${touch.hunkIds.length} ${touch.hunkIds.length === 1 ? "hunk" : "hunks"}`,
          );
          await expect(row).toContainText(touch.owner);
          await expect(
            row.getByText(guardStatusWord[touch.guard.status], { exact: true }),
          ).toBeVisible();
          await expect(row).toContainText(touch.guard.evidence);
        }
      });

      test("names the legacy reasons in the tier banner", async ({ page }) => {
        // Past three reasons a phone folds them behind a "Why <tier>" disclosure; a click
        // before hydration is lost, so retry until the reasons show.
        const disclosure = page.getByRole("button", { name: /^Why (Light|Focused|Full)$/ });
        for (const text of review.legacyReasons) {
          const reason = page.getByText(text, { exact: true }).locator("visible=true").first();
          await expect(async () => {
            if (
              (await disclosure.isVisible()) &&
              (await disclosure.getAttribute("aria-expanded")) !== "true"
            )
              await disclosure.click();
            await expect(reason).toBeVisible({ timeout: 500 });
          }).toPass();
        }
      });

      test("Who reads what gives R8 hunks to the touch point's owner", async ({ page }) => {
        const roles = page.getByRole("region", { name: /Who reads what/ });
        if (review.r8Refusals.length === 0) return;
        for (const touch of review.touchPoints) await expect(roles).toContainText(touch.owner);
        await expect(roles).toContainText("R8 legacy contract");
      });

      test("nothing scrolls or is cut off sideways", async ({ page }) => {
        const section = page.getByRole("region", { name: /Legacy touch points/ });
        await section.scrollIntoViewIfNeeded();
        const overflowing = await section
          .locator("p, li, code, span")
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.scrollWidth > element.clientWidth + 1)
              .map((element) => element.textContent?.slice(0, 60)),
          );
        expect(overflowing).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          ),
        ).toBe(false);
      });
    });
  }

  test(`${id}: the legacy section is reachable by keyboard with a visible focus ring and passes axe`, async ({
    page,
  }) => {
    await page.goto(`/changes/${id}`);
    const section = page.getByRole("region", { name: /Legacy touch points/ });
    const ideaLink = section.getByRole("link", { name: /^Idea 9: / });
    // Tab from the top until focus lands in the section: the Tab order must reach it without a mouse.
    for (
      let stop = 0;
      stop < 200 && !(await ideaLink.evaluate((link) => link === document.activeElement));
      stop += 1
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(ideaLink).toBeFocused();
    const ring = await ideaLink.evaluate((link) => {
      const style = getComputedStyle(link);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        boxShadow: style.boxShadow,
      };
    });
    expect(
      ring.outlineStyle !== "none" && ring.outlineWidth > 0
        ? "outline"
        : ring.boxShadow !== "none"
          ? "shadow"
          : "none",
    ).not.toBe("none");

    const results = await new AxeBuilder({ page })
      .include("#legacy-touch-heading")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test(`${id}: the receipt page says no receipt exists until a person signs`, async ({ page }) => {
    // S4 renders signed receipts only; the draft with the R8 refusals is on the S2 Sign tab, checked above.
    test.skip(
      existsSync(path.join(dataRoot, "receipts", `${id}.json`)),
      "signed: the receipt itself is shown",
    );
    await page.goto(`/changes/${id}/receipt`);
    await expect(page.getByText(`No receipt for ${id} yet.`)).toBeVisible();
  });
}

for (const id of withoutTouchPoints) {
  test(`${id} was recorded without touch points: no legacy section and a clean console`, async ({
    page,
  }) => {
    await page.goto(`/changes/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    await expect(page.getByRole("heading", { name: /Legacy touch points/ })).toHaveCount(0);
    await expect(page.getByText(/^Unguarded$|^Partly guarded$/)).toHaveCount(0);
  });
}
