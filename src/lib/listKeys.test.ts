import { describe, expect, it } from "vitest";
import { nextIndex, stepFromKey } from "./useShortcuts";

describe("nextIndex", () => {
  it("moves one step and clamps at both ends", () => {
    expect(nextIndex(1, 1, 3)).toBe(2);
    expect(nextIndex(2, 1, 3)).toBe(2);
    expect(nextIndex(0, -1, 3)).toBe(0);
  });

  it("lands on the first item going forward and the last going back when nothing is current", () => {
    expect(nextIndex(-1, 1, 5)).toBe(0);
    expect(nextIndex(-1, -1, 5)).toBe(4);
  });
});

describe("stepFromKey", () => {
  it("maps j and k and ignores the rest", () => {
    expect(stepFromKey(new KeyboardEvent("keydown", { key: "j" }))).toBe(1);
    expect(stepFromKey(new KeyboardEvent("keydown", { key: "k" }))).toBe(-1);
    expect(stepFromKey(new KeyboardEvent("keydown", { key: "x" }))).toBe(0);
  });

  it("ignores a key pressed with a modifier", () => {
    expect(stepFromKey(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }))).toBe(0);
  });
});
