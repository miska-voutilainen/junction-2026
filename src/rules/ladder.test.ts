import { describe, expect, it } from "vitest";
import type { Area, LadderLevel, ReportCard } from "../contracts";
import { applyEscapes, ladderLevel, levelsForReviewer, levelsFromReportCard } from "./ladder";

const record = (planted: number, caught: number, spotChecksClean = 0) => ({
  planted,
  caught,
  spotChecksClean,
});

describe("ladderLevel", () => {
  it("is shadow with fewer than 3 planted bugs, even when all were caught", () => {
    expect(ladderLevel(record(2, 2))).toBe("shadow");
  });

  it("is shadow below a 60% catch rate", () => {
    expect(ladderLevel(record(5, 2))).toBe("shadow");
  });

  it("is calibrated at exactly 3 planted and a 60% catch rate", () => {
    expect(ladderLevel(record(5, 3))).toBe("calibrated");
    expect(ladderLevel(record(3, 2))).toBe("calibrated");
  });

  it("stays calibrated with 4 clean spot checks and is trusted at 5", () => {
    expect(ladderLevel(record(4, 4, 4))).toBe("calibrated");
    expect(ladderLevel(record(4, 4, 5))).toBe("trusted");
  });
});

describe("applyEscapes", () => {
  const levels: Record<Area, LadderLevel> = {
    generator: "trusted",
    analyzer: "calibrated",
    security: "shadow",
    performance: "trusted",
  };

  it("drops only the named areas and floors at shadow", () => {
    expect(applyEscapes(levels, { generator: 1, analyzer: 1, security: 2 })).toEqual({
      generator: "calibrated",
      analyzer: "shadow",
      security: "shadow",
      performance: "trusted",
    });
  });

  it("does not change its input", () => {
    applyEscapes(levels, { generator: 2 });
    expect(levels.generator).toBe("trusted");
  });
});

describe("levelsFromReportCard", () => {
  it("makes every area shadow when there is no report card", () => {
    expect(Object.values(levelsFromReportCard(null))).toEqual([
      "shadow",
      "shadow",
      "shadow",
      "shadow",
    ]);
  });

  it("reads the recorded level per area and leaves areas it lacks at shadow", () => {
    const card = {
      areas: [
        { area: "generator", level: "calibrated" },
        { area: "security", level: "trusted" },
      ],
    } as unknown as ReportCard;
    expect(levelsFromReportCard(card)).toEqual({
      generator: "calibrated",
      analyzer: "shadow",
      security: "trusted",
      performance: "shadow",
    });
  });
});

describe("levelsForReviewer", () => {
  const card = {
    reviewer: { version: "rv1", model: "model-a" },
    areas: [{ area: "security", level: "calibrated" }],
  } as unknown as ReportCard;

  it("keeps the measured levels for the model the card measured", () => {
    expect(levelsForReviewer(card, "model-a").security).toBe("calibrated");
  });

  it("routes every area as shadow for a model the card did not measure", () => {
    expect(Object.values(levelsForReviewer(card, "model-b"))).toEqual([
      "shadow",
      "shadow",
      "shadow",
      "shadow",
    ]);
  });

  it("is all shadow without a report card", () => {
    expect(levelsForReviewer(null, "model-a").security).toBe("shadow");
  });
});
