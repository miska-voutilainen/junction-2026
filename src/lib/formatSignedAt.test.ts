import { describe, expect, it } from "vitest";
import { formatSignedAt } from "./formatSignedAt";

describe("formatSignedAt", () => {
  it("formats in UTC", () => {
    expect(formatSignedAt("2026-11-13T17:22:48Z")).toBe("13 Nov 2026, 17:22 UTC");
  });

  it("converts an offset to UTC", () => {
    expect(formatSignedAt("2026-11-14T11:40:12+02:00")).toBe("14 Nov 2026, 09:40 UTC");
  });
});
