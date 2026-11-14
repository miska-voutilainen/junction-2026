/**
 * addLegacyGuard on a recorded review (mp-2297, the legacy catch the pitch leads
 * with): R8 refusals are appended without renumbering what the model raised, and
 * a re-run replaces stale R8s, so `pnpm review legacy` is safe to run again.
 */
import { describe, expect, it, vi } from "vitest";
import type { Area, LadderLevel, Review } from "../contracts";
import type { BaseTree } from "../lib/git/baseTree";
import { addLegacyGuard } from "./addLegacyGuard";
import * as touchPoints from "./legacyTouchPoints";
import { readFileSync } from "node:fs";

const levels: Record<Area, LadderLevel> = {
  generator: "trusted",
  analyzer: "trusted",
  security: "trusted",
  performance: "trusted",
};

/** A recorded review with one `#if` template hunk, as mp-2297 has; its tree has no legacy-target tests. */
const recorded = JSON.parse(readFileSync("data/runs/mp-2297/review.json", "utf8")) as Review;
const base: Review = {
  ...recorded,
  legacyTouchPoints: undefined,
  refusals: recorded.refusals.filter((refusal) => refusal.ruleId !== "R8"),
};
const noLegacyTargets: BaseTree = {
  filesMentioning: async () => [],
  accessModifierLines: async () => [],
  readFile: async () =>
    "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>",
  listFiles: async () => [],
};

const realFind = touchPoints.findLegacyTouchPoints;

/** Runs addLegacyGuard with git replaced by the fake tree. */
function run(review: Review) {
  vi.spyOn(touchPoints, "findLegacyTouchPoints").mockImplementation((input) =>
    realFind(input, noLegacyTargets),
  );
  return addLegacyGuard(review, "", levels);
}

describe("addLegacyGuard", () => {
  it("returns the same review when nothing is touched", async () => {
    const untouched = { ...base, hunks: [], files: [] };
    expect(await run(untouched)).toBe(untouched);
  });

  it("appends R8 with the next id after the existing refusals", async () => {
    const existing = { id: "r1", ruleId: "R7", source: "ai" as const, reason: "x", hunkIds: [] };
    const after = await run({ ...base, refusals: [existing] });
    expect(after.refusals.map((refusal) => refusal.id)).toEqual(["r1", "r2"]);
    expect(after.refusals[1]).toMatchObject({ ruleId: "R8", source: "rule" });
    expect(after.legacyTouchPoints?.[0].kind).toBe("old-platform");
  });

  it("numbers R8 after the highest kept id, so a gap in the ids can't collide", async () => {
    const refusal = (id: string) => ({
      id,
      ruleId: "R7",
      source: "ai" as const,
      reason: "x",
      hunkIds: [],
    });
    const after = await run({ ...base, refusals: [refusal("r1"), refusal("r3")] });
    expect(after.refusals.map((each) => each.id)).toEqual(["r1", "r3", "r4"]);
  });

  it("is a no-op the second time", async () => {
    const once = await run(base);
    expect(await run(once)).toEqual(once);
  });

  it("drops a stale R8 refusal on a re-run", async () => {
    const stale = {
      id: "r1",
      ruleId: "R8",
      source: "rule" as const,
      reason: "old",
      hunkIds: ["h1"],
    };
    const untouched = { ...base, hunks: [], files: [], legacyTouchPoints: [], refusals: [stale] };
    const after = await run(untouched);
    expect(after.refusals).toEqual([]);
  });
});
