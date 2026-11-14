import { describe, expect, it } from "vitest";
import type { Review } from "@/contracts";
import { buildLegacyTouchRows } from "./legacyTouchModel";

function reviewWith(legacyTouchPoints: Review["legacyTouchPoints"]): Review {
  return { legacyTouchPoints } as Review;
}

describe("buildLegacyTouchRows", () => {
  it("words an unguarded old-platform touch", () => {
    const rows = buildLegacyTouchRows(
      reviewWith([
        {
          kind: "old-platform",
          hunkIds: ["h1", "h2"],
          detail: "#if !NETSTANDARD2_0 && !NETFRAMEWORK",
          owner: "platform owner (the maintainers)",
          guard: { status: "unguarded", evidence: "No test runs net472.", files: [] },
        },
      ]),
    );
    expect(rows).toEqual([
      {
        kind: "Old platform",
        detail: "#if !NETSTANDARD2_0 && !NETFRAMEWORK",
        hunks: "2 hunks",
        owner: "platform owner (the maintainers)",
        status: "unguarded",
        statusLabel: "Unguarded",
        evidence: "No test runs net472.",
      },
    ]);
  });

  it("returns no rows when the review has no touch points", () => {
    expect(buildLegacyTouchRows(reviewWith(undefined))).toEqual([]);
    expect(buildLegacyTouchRows(reviewWith([]))).toEqual([]);
  });
});
