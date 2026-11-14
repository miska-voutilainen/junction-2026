import { describe, expect, it } from "vitest";
import type { InboxRow, ReviewedRow } from "./inboxModel";
import { describeReroute } from "./reroute";

function row(id: string, overrides: Partial<ReviewedRow> = {}): ReviewedRow {
  return { id, state: "reviewed", tier: "focused", readHunks: 3, totalHunks: 8, ...overrides } as ReviewedRow;
}

describe("describeReroute", () => {
  it("names a tier change as from and to", () => {
    const result = describeReroute([row("mp-1")], [row("mp-1", { tier: "full", readHunks: 8 })]);
    expect(result).toEqual({ changedIds: ["mp-1"], sentence: "mp-1: Focused to Full" });
  });

  it("names the new reading count when only the count changed", () => {
    const result = describeReroute([row("mp-2283", { tier: "full", readHunks: 7 })], [row("mp-2283", { tier: "full", readHunks: 8 })]);
    expect(result.sentence).toBe("mp-2283 now reads 8 of 8");
  });

  it("names two changes and counts the rest", () => {
    const before = ["a", "b", "c", "d"].map((id) => row(id));
    const after = ["a", "b", "c", "d"].map((id) => row(id, { readHunks: 4 }));
    const result = describeReroute(before, after);
    expect(result.changedIds).toEqual(["a", "b", "c", "d"]);
    expect(result.sentence).toBe("a now reads 4 of 8, b now reads 4 of 8, 2 more");
  });

  it("says so when nothing changed, and ignores rows without a review", () => {
    const unreviewed = { id: "mp-9", state: "missing" } as InboxRow;
    expect(describeReroute([row("mp-1"), unreviewed], [row("mp-1"), unreviewed])).toEqual({
      changedIds: [],
      sentence: "No change re-routed",
    });
  });
});
