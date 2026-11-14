import { describe, expect, it } from "vitest";
import { legacyRefusalRule } from "./legacy";
import { allRefusalRules } from "./refusalPolicy";
import { refusalRules } from "./refusals";

describe("allRefusalRules", () => {
  it("lists the model's rules and then the rule-only R8, each id once", () => {
    const ids = allRefusalRules.map((rule) => rule.id);
    expect(ids).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The model's list feeds the A3 prompt; R8 there would let the model raise a
  // refusal it can't ground (it doesn't know the zone map) and change the reviewer.
  it("keeps R8 out of the rules the model reads", () => {
    expect(refusalRules.map((rule) => rule.id)).not.toContain(legacyRefusalRule.id);
  });
});
