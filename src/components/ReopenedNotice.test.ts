import { describe, expect, it } from "vitest";
import { reopenedText } from "./ReopenedNotice";

describe("reopenedText", () => {
  it("names one area and uses the plural for several hunks", () => {
    expect(reopenedText(["generator"], 2)).toBe(
      "An escape in Generator re-routed this change after it was signed: 2 hunks the signer didn't read now need a person.",
    );
  });

  it("uses the singular for one hunk", () => {
    expect(reopenedText(["analyzer"], 1)).toContain(
      "1 hunk the signer didn't read now needs a person.",
    );
  });

  it("joins several areas", () => {
    expect(reopenedText(["generator", "analyzer", "security"], 3)).toContain(
      "An escape in Generator, Analyzer and Security re-routed",
    );
    expect(reopenedText(["generator", "analyzer"], 3)).toContain(
      "An escape in Generator and Analyzer re-routed",
    );
  });
});
