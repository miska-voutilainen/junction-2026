import { describe, expect, it } from "vitest";
import { countOf } from "./countOf";

describe("countOf", () => {
  it("is singular for one only", () => {
    expect(countOf(1, "claim")).toBe("1 claim");
    expect(countOf(0, "claim")).toBe("0 claims");
    expect(countOf(2, "claim")).toBe("2 claims");
  });

  it("takes the plural form when adding s is wrong", () => {
    expect(countOf(2, "entry", "entries")).toBe("2 entries");
  });
});
