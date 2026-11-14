import { beforeAll, describe, expect, it } from "vitest";
import { loadReportCard, loadReview } from "@/lib/data/loaders";
import {
  decideChange,
  inboxLevels,
  reportCardNotice,
  REPORT_CARD_MISSING_NOTICE,
  REPORT_CARD_NOTICE,
} from "./decideChange";
import type { ReportCardInput } from "./decideChange";

// Pinned to the committed fixtures, so recorded data landing under data/ cannot change these results.
const fixtureRoot = "data/fixtures";

let card: ReportCardInput;

beforeAll(async () => {
  const reportCard = await loadReportCard(fixtureRoot);
  if (reportCard.status !== "ok") throw new Error("fixtures are missing");
  card = { state: "ok", data: reportCard.data, source: "fixture" };
});

describe("decideChange", () => {
  it("adds R-escape for a simulated escape in an area the change touches", async () => {
    const review = await loadReview("mp-2283", fixtureRoot);
    if (review.status !== "ok") throw new Error("fixture review is missing");
    const ruleIds = (escapes: Parameters<typeof decideChange>[2]) =>
      decideChange(review.data, card, escapes).decision.reasons.map((reason) => reason.ruleId);
    expect(ruleIds({})).not.toContain("R-escape");
    expect(ruleIds({ analyzer: 1 })).toContain("R-escape");
    expect(decideChange(review.data, card, { analyzer: 1 }).decision.tier).toBe("full");
  });
});

describe("without a readable report card", () => {
  it("explains an unreadable report card and routes every area as Shadow", () => {
    expect(reportCardNotice({ state: "unreadable" })).toBe(REPORT_CARD_NOTICE);
    expect(reportCardNotice({ state: "missing" })).toBe(REPORT_CARD_MISSING_NOTICE);
    expect(reportCardNotice({ state: "ok", data: {} as never, source: "fixture" })).toBeNull();
    expect(
      Object.values(inboxLevels({ state: "unreadable" }, {})).every((level) => level === "shadow"),
    ).toBe(true);
  });
});
