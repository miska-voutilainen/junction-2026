import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonicalJson";

describe("canonicalJson", () => {
  it("sorts keys at every depth and indents with two spaces", () => {
    const text = canonicalJson({ b: 1, a: { d: true, c: null } });
    expect(text).toBe('{\n  "a": {\n    "c": null,\n    "d": true\n  },\n  "b": 1\n}\n');
  });

  it("keeps array order and sorts keys inside array items", () => {
    expect(canonicalJson({ list: [{ z: 1, a: 2 }, "second", 3] })).toBe(
      '{\n  "list": [\n    {\n      "a": 2,\n      "z": 1\n    },\n    "second",\n    3\n  ]\n}\n',
    );
  });

  it("orders integer-like keys as strings, not numerically", () => {
    expect(canonicalJson({ b: 1, 10: 1, 2: 1 })).toBe('{\n  "10": 1,\n  "2": 1,\n  "b": 1\n}\n');
  });

  it("orders keys by code unit, so uppercase sorts before lowercase", () => {
    expect(canonicalJson({ a: 1, B: 2 })).toBe('{\n  "B": 2,\n  "a": 1\n}\n');
  });

  it("writes unicode as is and empty containers compactly", () => {
    expect(canonicalJson({ name: "Ääkkönen ✓", empty: [], none: {} })).toBe(
      '{\n  "empty": [],\n  "name": "Ääkkönen ✓",\n  "none": {}\n}\n',
    );
  });

  it("ends with exactly one newline and uses no carriage returns", () => {
    const text = canonicalJson({ a: "x" });
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(text).not.toContain("\r");
  });
});
