import { describe, expect, it } from "vitest";
import type { Coverage, Review } from "@/contracts";
import { buildReviewRoles, changeOwnerRole } from "./reviewRolesModel";

type Refusal = Review["refusals"][number];

function reviewWith(
  hunks: { id: string; file?: string }[],
  refusals: Pick<Refusal, "ruleId" | "hunkIds">[] = [],
  legacyTouchPoints?: Review["legacyTouchPoints"],
): Review {
  return {
    hunks: hunks.map((hunk) => ({ id: hunk.id, file: hunk.file ?? "src/A.cs" })),
    refusals: refusals.map((refusal, index) => ({
      id: `r${index}`,
      source: "ai",
      reason: "",
      ...refusal,
    })),
    legacyTouchPoints,
  } as unknown as Review;
}

describe("buildReviewRoles", () => {
  it("sends an AI R7 refusal to the API owner", () => {
    const review = reviewWith(
      [{ id: "h1" }, { id: "h2" }],
      [{ ruleId: "R7", hunkIds: ["h1", "h2"] }],
    );
    expect(buildReviewRoles(review, { h1: "read", h2: "read" })).toEqual([
      {
        role: "API owner (the maintainers)",
        hunkIds: ["h1", "h2"],
        reasons: ["R7 public contract"],
      },
    ]);
  });

  it("sends an R8 hunk to the owner of its touch point", () => {
    const review = reviewWith(
      [{ id: "h1" }],
      [{ ruleId: "R8", hunkIds: ["h1"] }],
      [
        {
          kind: "old-platform",
          hunkIds: ["h1"],
          detail: "#if NETFRAMEWORK",
          owner: "platform owner (the maintainers)",
          guard: { status: "unguarded", evidence: "", files: [] },
        },
      ],
    );
    expect(buildReviewRoles(review, { h1: "read" })[0]).toMatchObject({
      role: "platform owner (the maintainers)",
      reasons: ["R8 legacy contract"],
    });
  });

  it("sends a read hunk with no refusal to the change owner, last", () => {
    const review = reviewWith([{ id: "h1" }, { id: "h2" }], [{ ruleId: "R7", hunkIds: ["h2"] }]);
    const roles = buildReviewRoles(review, { h1: "read", h2: "read" });
    expect(roles.map((entry) => entry.role)).toEqual([
      "API owner (the maintainers)",
      changeOwnerRole,
    ]);
    expect(roles[1].hunkIds).toEqual(["h1"]);
  });

  it("counts a hunk once when it is both refused and read", () => {
    const review = reviewWith([{ id: "h1" }], [{ ruleId: "R7", hunkIds: ["h1"] }]);
    const roles = buildReviewRoles(review, { h1: "read" });
    expect(roles).toHaveLength(1);
    expect(roles[0].hunkIds).toEqual(["h1"]);
  });

  it("leaves verified hunks unassigned and returns [] when nobody needs to read", () => {
    const coverage: Record<string, Coverage> = { h1: "verified", h2: "generated" };
    expect(buildReviewRoles(reviewWith([{ id: "h1" }, { id: "h2" }]), coverage)).toEqual([]);
  });
});
