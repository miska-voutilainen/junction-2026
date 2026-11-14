/**
 * Invariants of the legacy guard (idea 9), checked over every recorded review in
 * data/runs/ and small variations of them. One example test shows a case works;
 * these check the promises the pitch makes hold for any evidence a reviewer
 * could produce: no claim or ladder level hides an R8 hunk, an unguarded touch
 * always routes Full, one hunk has one reader, and the guard only adds caution.
 * Spec section 5, routing reasons 8a and 8b.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildReviewRoles } from "@/features/review/reviewRolesModel";
import { addLegacyGuard } from "@/pipeline/addLegacyGuard";
import * as touchPoints from "@/pipeline/legacyTouchPoints";
import type { BaseTree } from "@/lib/git/baseTree";
import { ReviewSchema, type Area, type LadderLevel, type Review, type Tier } from "@/contracts";
import { route } from "./route";

const runsDir = "data/runs";
const areas: Area[] = ["generator", "analyzer", "security", "performance"];
const tierRank: Record<Tier, number> = { light: 0, focused: 1, full: 2 };

/** Every area at one level, so a test can ask for the most generous ladder. */
function allAreasAt(level: LadderLevel): Record<Area, LadderLevel> {
  return Object.fromEntries(areas.map((area) => [area, level])) as Record<Area, LadderLevel>;
}

// Calibration runs (cp*, v*) hold other files; only a review.json is a recorded review.
const recordedReviews: Review[] = readdirSync(runsDir)
  .filter((changeId) => existsSync(`${runsDir}/${changeId}/review.json`))
  .map((changeId) =>
    ReviewSchema.parse(JSON.parse(readFileSync(`${runsDir}/${changeId}/review.json`, "utf8"))),
  )
  .sort((a, b) => a.changeId.localeCompare(b.changeId));
const guardedReviews = recordedReviews.filter((review) => review.legacyTouchPoints !== undefined);
const reviewsWithR8 = recordedReviews.filter((review) =>
  review.refusals.some((refusal) => refusal.ruleId === "R8"),
);

/** The most generous evidence: every claim Verified, as if each had a passing differential test. */
function withAllClaimsVerified(review: Review): Review {
  return {
    ...review,
    claims: review.claims.map((claim) => ({ ...claim, level: "verified" as const })),
  };
}

/** The review as the model alone left it: no touch points and none of the rule-made R8 refusals. */
function withoutLegacyGuard(review: Review): Review {
  return {
    ...review,
    legacyTouchPoints: undefined,
    refusals: review.refusals.filter((refusal) => refusal.ruleId !== "R8"),
  };
}

describe("the recorded reviews the invariants run over", () => {
  it("include reviews with touch points and reviews with R8 refusals", () => {
    expect(guardedReviews.map((review) => review.changeId)).toContain("mp-2297");
    expect(reviewsWithR8.length).toBeGreaterThan(0);
  });
});

describe("invariant 1: no claim or ladder level takes an R8 hunk off the reading list", () => {
  for (const level of ["shadow", "calibrated", "trusted"] as const) {
    it(`keeps every R8 hunk to read with all claims Verified and every area ${level}`, () => {
      for (const review of reviewsWithR8) {
        const decision = route(withAllClaimsVerified(review), allAreasAt(level));
        const r8Hunks = review.refusals
          .filter((refusal) => refusal.ruleId === "R8")
          .flatMap((refusal) => refusal.hunkIds);
        expect(r8Hunks.length, review.changeId).toBeGreaterThan(0);
        for (const hunkId of r8Hunks)
          expect(decision.coverage[hunkId], `${review.changeId} ${hunkId}`).toBe("read");
      }
    });
  }

  it("keeps a hunk to read when a generated file's hunk carries the R8 refusal", () => {
    const review = guardedReviews.find((candidate) => candidate.changeId === "mp-2297")!;
    const generated = review.files.find((file) => file.kind === "generated")!;
    const hunk = review.hunks.find((candidate) => candidate.file === generated.path)!;
    const refusal = {
      id: "r99",
      ruleId: "R8",
      source: "rule" as const,
      reason: "x",
      hunkIds: [hunk.id],
    };
    const decision = route(
      { ...review, refusals: [...review.refusals, refusal] },
      allAreasAt("trusted"),
    );
    expect(decision.coverage[hunk.id]).toBe("read");
  });
});

describe("invariant 2: an unguarded touch always routes Full", () => {
  it("routes Full for every recorded unguarded touch whatever else the review says", () => {
    for (const review of guardedReviews) {
      const hasUnguarded = review.legacyTouchPoints!.some(
        (touch) => touch.guard.status === "unguarded",
      );
      if (!hasUnguarded) continue;
      const calm = { ...withAllClaimsVerified(review), findings: [], refusals: [] };
      for (const level of ["shadow", "calibrated", "trusted"] as const) {
        expect(route(calm, allAreasAt(level)).tier, `${review.changeId} at ${level}`).toBe("full");
      }
    }
  });

  it("routes Full when a guarded touch is made unguarded", () => {
    const guarded = guardedReviews.find((review) =>
      review.legacyTouchPoints!.every((touch) => touch.guard.status === "guarded"),
    )!;
    const before = route(withAllClaimsVerified(guarded), allAreasAt("trusted")).tier;
    const unguarded: Review = {
      ...guarded,
      legacyTouchPoints: guarded.legacyTouchPoints!.map((touch) => ({
        ...touch,
        guard: { status: "unguarded" as const, evidence: "no test runs it", files: [] },
      })),
    };
    const after = route(withAllClaimsVerified(unguarded), allAreasAt("trusted")).tier;
    expect(tierRank[after]).toBeGreaterThanOrEqual(tierRank[before]);
    expect(after).toBe("full");
  });
});

describe("invariant 3: one hunk, one role", () => {
  it("lists every hunk to read under exactly one role", () => {
    for (const review of recordedReviews) {
      const decision = route(review, allAreasAt("calibrated"));
      const roles = buildReviewRoles(review, decision.coverage);
      const listed = roles.flatMap((role) => role.hunkIds);
      const toRead = review.hunks
        .filter((hunk) => decision.coverage[hunk.id] === "read")
        .map((hunk) => hunk.id);
      expect(new Set(listed).size, `${review.changeId} lists a hunk twice`).toBe(listed.length);
      expect([...listed].sort(), review.changeId).toEqual([...toRead].sort());
    }
  });

  it("gives an R8 hunk to its touch point's owner", () => {
    for (const review of guardedReviews) {
      const decision = route(review, allAreasAt("calibrated"));
      const roles = buildReviewRoles(review, decision.coverage);
      const r8Hunks = review.refusals
        .filter((refusal) => refusal.ruleId === "R8")
        .flatMap((refusal) => refusal.hunkIds);
      for (const touch of review.legacyTouchPoints!) {
        for (const hunkId of touch.hunkIds.filter((id) => r8Hunks.includes(id))) {
          const reader = roles.find((role) => role.hunkIds.includes(hunkId));
          expect(reader?.role, `${review.changeId} ${hunkId}`).toBe(touch.owner);
        }
      }
    }
  });
});

describe("invariant 4: addLegacyGuard is idempotent and keeps ids", () => {
  /** A base tree where no test targets an old platform, so the result depends only on the recorded hunks. */
  const noLegacyTargets: BaseTree = {
    filesMentioning: async () => [],
    accessModifierLines: async () => [],
    readFile: async () =>
      "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>",
    listFiles: async () => [],
  };
  const realFind = touchPoints.findLegacyTouchPoints;
  const levels = allAreasAt("calibrated");

  /** Runs addLegacyGuard with git replaced by the fake tree. */
  function guard(review: Review): Promise<Review> {
    vi.spyOn(touchPoints, "findLegacyTouchPoints").mockImplementation((input) =>
      realFind(input, noLegacyTargets),
    );
    return addLegacyGuard(review, "", levels);
  }

  it("gives the same review when run twice on every recorded review", async () => {
    for (const review of recordedReviews) {
      const once = await guard(review);
      const twice = await guard(once);
      expect(twice, review.changeId).toEqual(once);
    }
  });

  it("never renumbers a refusal the review already had", async () => {
    for (const review of recordedReviews) {
      const after = await guard(review);
      const before = review.refusals.filter((refusal) => refusal.ruleId !== "R8");
      expect(
        after.refusals.slice(0, before.length).map((refusal) => refusal.id),
        review.changeId,
      ).toEqual(before.map((refusal) => refusal.id));
    }
  });
});

describe("invariant 5: the guard only adds caution", () => {
  it("never lowers the tier or shortens the reading list", () => {
    for (const review of recordedReviews) {
      for (const level of ["shadow", "calibrated", "trusted"] as const) {
        const levels = allAreasAt(level);
        const without = route(withoutLegacyGuard(review), levels);
        const guarded = route(review, levels);
        expect(tierRank[guarded.tier], `${review.changeId} at ${level}`).toBeGreaterThanOrEqual(
          tierRank[without.tier],
        );
        for (const [hunkId, state] of Object.entries(without.coverage)) {
          if (state === "read")
            expect(guarded.coverage[hunkId], `${review.changeId} ${hunkId}`).toBe("read");
        }
      }
    }
  });
});
