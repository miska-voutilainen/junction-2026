import { describe, expect, it } from "vitest";
import { tokenOverlap } from "./tokenOverlap";

describe("tokenOverlap", () => {
  it("is 1 for the same words in any case and punctuation", () => {
    expect(tokenOverlap("The cache is cleared.", "the CACHE, is cleared")).toBe(1);
  });

  it("is the share of key words found in the statement", () => {
    expect(tokenOverlap("a b c d", "a b c x")).toBe(0.75);
  });

  it("uses word sets, so repeats do not count twice", () => {
    expect(tokenOverlap("a a b", "a")).toBe(0.5);
  });

  it("is 0 when the key has no words", () => {
    expect(tokenOverlap("", "anything")).toBe(0);
    expect(tokenOverlap("... --", "anything")).toBe(0);
  });
});
