// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildBlindCheck } from "./blindCheckModel";
import { loadFixtureReview, readableCard } from "./stepsModelFixtures";

describe("blind check", () => {
  it("lists the contradictions with the sentence they contradict", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), await readableCard());
    expect(blindCheck.contradictions).toHaveLength(1);
    expect(blindCheck.contradictions[0].finding.statement).toContain("diagnostics are unchanged");
  });

  it("shows this change's planted contradiction and the overall count from the report card", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), await readableCard());
    expect(blindCheck.readingOrder.map((row) => [row.anchoredCaught, row.blindCaught, row.runs])).toEqual([[1, 3, 3]]);
    expect(blindCheck.overallLine).toBe(
      "Across 5 planted contradictions × 3 runs: given the description first caught 4 of 15 · blind-first caught 12 of 15",
    );
  });

  it("leaves out the reading-order count when the report card is missing", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), { state: "missing" });
    expect(blindCheck.overallLine).toBeNull();
    expect(blindCheck.readingOrder).toEqual([]);
  });

  it("has nothing expected in anchored mode", async () => {
    const anchored = { ...(await loadFixtureReview("mp-2283")), expectation: null };
    expect(buildBlindCheck(anchored, { state: "missing" }).expected).toEqual([]);
  });
});
