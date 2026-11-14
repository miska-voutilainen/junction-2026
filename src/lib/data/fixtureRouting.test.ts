// @vitest-environment node
import { describe, expect, it } from "vitest";
import { route } from "@/rules/route";
import { levelsFromReportCard } from "@/rules/ladder";
import { loadReportCard, loadReview } from "./loaders";

const fixtureRoot = "data/fixtures";
const tietoChangeIds = ["mp-2129", "mp-2234", "mp-2283", "mp-2297"];

// The fixtures store the routing they were written for; the UI recomputes it
// with route(). If the two drift, the inbox and the review page disagree with
// the recorded file, so the stored value must be exactly what route() returns.
describe("fixture routing", () => {
  it.each(tietoChangeIds)("%s stores the routing route() computes", async (changeId) => {
    const review = await loadReview(changeId, fixtureRoot);
    const reportCard = await loadReportCard(fixtureRoot);
    if (review.status !== "ok" || reportCard.status !== "ok") throw new Error(`fixture for ${changeId} did not load`);

    const levels = levelsFromReportCard(reportCard.data);
    expect(route(review.data, levels)).toEqual(review.data.routing);
  });

  it("routes mp-2283 to Focused with at least 2 hunks to read (spec 9.1, T06)", async () => {
    const review = await loadReview("mp-2283", fixtureRoot);
    if (review.status !== "ok") throw new Error("mp-2283 fixture did not load");
    expect(review.data.routing.tier).toBe("focused");
    expect(review.data.routing.readHunks).toBeGreaterThanOrEqual(2);
  });
});
