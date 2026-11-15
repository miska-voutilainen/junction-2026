import { describe, expect, it } from "vitest";
import { differencesBetween } from "./replayCheck";

describe("differencesBetween", () => {
  it("finds nothing between equal reviews", () => {
    expect(differencesBetween({ a: 1, b: [{ c: "x" }] }, { a: 1, b: [{ c: "x" }] })).toEqual([]);
  });

  it("names the path of a changed value, a missing key and a changed list length", () => {
    expect(
      differencesBetween({ routing: { tier: "full" } }, { routing: { tier: "focused" } }),
    ).toEqual(['routing.tier: "full" -> "focused"']);
    expect(differencesBetween({ a: 1 }, { a: 1, b: 2 })).toEqual(["b: undefined -> 2"]);
    expect(differencesBetween({ claims: [1, 2] }, { claims: [1] })).toEqual([
      "claims: 2 items -> 1 items",
    ]);
    expect(differencesBetween({ hunks: [1, 2] }, { hunks: [1, 3] })).toEqual(["hunks[1]: 2 -> 3"]);
  });

  it("treats a cost summed in another order as the same cost, but not a different cost", () => {
    expect(differencesBetween({ costUsd: 3.0906573999999996 }, { costUsd: 3.0906574 })).toEqual([]);
    expect(differencesBetween({ costUsd: 3.09 }, { costUsd: 3.1 })).toEqual([
      "costUsd: 3.09 -> 3.1",
    ]);
  });

  it("lists at most ten differences, so one shifted list does not flood the output", () => {
    const recorded = Array.from({ length: 30 }, (_, index) => index);
    const replayed = recorded.map((value) => value + 1);
    expect(differencesBetween(recorded, replayed)).toHaveLength(10);
  });
});
