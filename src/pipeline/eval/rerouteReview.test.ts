import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReviewSchema, type Area, type LadderLevel } from "../../contracts";
import { rerouteReview, routingSpreadOf } from "./rerouteReview";

const review = ReviewSchema.parse(
  JSON.parse(
    readFileSync(path.join(__dirname, "../../../data/fixtures/runs/mp-2283/review.json"), "utf8"),
  ),
);
const levelsAll = (level: LadderLevel): Record<Area, LadderLevel> => ({
  generator: level,
  analyzer: level,
  security: level,
  performance: level,
});

describe("rerouteReview", () => {
  it("routes with the given levels, rebuilds the draft from that routing and changes nothing else", () => {
    const shadow = rerouteReview(review, levelsAll("shadow"));
    const trusted = rerouteReview(review, levelsAll("trusted"));
    expect(shadow.routing.readHunks).toBeGreaterThanOrEqual(trusted.routing.readHunks);
    expect(shadow.receiptDraft.notChecked.length).toBeGreaterThanOrEqual(
      trusted.receiptDraft.notChecked.length,
    );
    expect({ ...shadow, routing: null, receiptDraft: null }).toEqual({
      ...review,
      routing: null,
      receiptDraft: null,
    });
  });

  it("starts the draft with no accepted refusals", () => {
    expect(
      rerouteReview(review, levelsAll("shadow")).receiptDraft.residualRisk.acceptedRefusalIds,
    ).toEqual([]);
  });
});

describe("routingSpreadOf", () => {
  it("is all zeros for no reviews", () => {
    expect(routingSpreadOf([])).toEqual({
      changes: 0,
      light: 0,
      focused: 0,
      full: 0,
      readHunks: 0,
      totalHunks: 0,
      readMinutes: 0,
      fullMinutes: 0,
    });
  });

  it("counts tiers and sums hunks and minutes", () => {
    const one = rerouteReview(review, levelsAll("shadow"));
    const spread = routingSpreadOf([one, one]);
    expect(spread).toMatchObject({
      changes: 2,
      readHunks: 2 * one.routing.readHunks,
      totalHunks: 2 * one.routing.totalHunks,
      fullMinutes: 2 * one.routing.fullMinutes,
    });
    expect(spread.light + spread.focused + spread.full).toBe(2);
  });
});
