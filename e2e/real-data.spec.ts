import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import { unlock } from "./unlock";

// Runs in the `real-data` project against a build of the committed data/ as it is.
// Everything expected here is read from data/ at test time, so the spec keeps
// working as recordings land; the behaviour specs use fixtures instead.
const dataRoot = path.join(process.cwd(), "data");
const changesFolder = path.join(dataRoot, "sample", "changes");

/** Ids of the Tieto changes: planted-bug and contradiction-plant inputs share the folder and are not reviewable. */
function tietoChangeIds(): string[] {
  return readdirSync(changesFolder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(path.join(changesFolder, name), "utf8")) as { id: string; kind: string })
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
  const allReviewsRecorded = changeIds.every((id) => existsSync(path.join(dataRoot, "runs", id, "review.json")));
  return !(hasRecordedReportCard && allReviewsRecorded);
}

const changeIds = tietoChangeIds();
const mockDataBanner = (page: import("@playwright/test").Page) => page.getByText("Showing mock data");

test.beforeEach(async ({ page }) => {
  await unlock(page);
});

test("the inbox lists exactly the Tieto changes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
  await expect(page.getByText(new RegExp(`^${changeIds.length} changes`))).toBeVisible();

  // The fold keeps signed changes out of the open list; expand it so every change has a visible link.
  const fold = page.getByRole("button", { name: /^Signed \d+$/ });
  if (await fold.count()) await fold.click();
  const hrefs = await page.locator('a[href^="/changes/"]:visible').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")?.split("/")[2] ?? ""),
  );
  expect([...new Set(hrefs)].sort()).toEqual(changeIds);
});

for (const id of changeIds) {
  test(`the review page of ${id} loads cleanly`, async ({ page }) => {
    await page.goto(`/changes/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    if (expectsMockDataBanner(changeIds)) await expect(mockDataBanner(page)).toBeVisible();
    else await expect(mockDataBanner(page)).toHaveCount(0);
  });
}

test("planted inputs are not reviewable changes", async ({ request }) => {
  const plantIds = readdirSync(changesFolder)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .filter((id) => !changeIds.includes(id));
  for (const id of plantIds) {
    // A request, not a page visit: the browser logs every 404 as a console error.
    const response = await request.get(`/changes/${id}`);
    expect(response.status(), `/changes/${id}`).toBe(404);
  }
});

test("the reviewer report card and the dashboard load cleanly", async ({ page }) => {
  await page.goto("/reviewer");
  await expect(page.getByRole("heading", { level: 1, name: "Reviewer Report Card" })).toBeAttached();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
});
