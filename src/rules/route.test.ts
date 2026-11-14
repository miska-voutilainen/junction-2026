import { describe, expect, it } from "vitest";
import type { Area, FileKind, LadderLevel, Review } from "../contracts";
import { coverageReason, route } from "./route";

const trustedEverywhere: Record<Area, LadderLevel> = {
  generator: "trusted",
  analyzer: "trusted",
  security: "trusted",
  performance: "trusted",
};

interface HunkSpec {
  id: string;
  file?: string;
  area?: Area | null;
  kind?: FileKind;
  changed?: number;
}

type ReviewParts = Partial<Pick<Review, "claims" | "findings" | "refusals">> & { hunks: HunkSpec[] };

function claim(id: string, level: "verified" | "supported" | "unverified", hunkIds: string[]): Review["claims"][number] {
  return { id, requirementItemId: null, text: "claim", kind: "behaviour", level, hunkIds, citations: [], evidence: [] };
}

function finding(kind: Review["findings"][number]["kind"], hunkIds: string[]): Review["findings"][number] {
  return { id: "f1", kind, area: null, severity: "high", title: "t", detail: "d", statement: null, hunkIds, citations: [] };
}

function refusal(hunkIds: string[]): Review["refusals"][number] {
  return { id: "r1", ruleId: "R7", source: "ai", reason: "r", hunkIds };
}

/** A schema-shaped Review with only the parts route() reads filled in meaningfully. */
function makeReview({ hunks, claims = [], findings = [], refusals = [] }: ReviewParts): Review {
  const specs = hunks.map((spec) => ({ file: "src/Other/File.cs", area: null, kind: "source" as FileKind, changed: 1, ...spec }));
  const files = [...new Set(specs.map((spec) => spec.file))].map((path) => {
    const inFile = specs.filter((spec) => spec.file === path);
    return {
      path,
      kind: inFile[0].kind,
      area: inFile[0].area,
      added: inFile.reduce((sum, spec) => sum + spec.changed, 0),
      removed: 0,
      hunkIds: inFile.map((spec) => spec.id),
    };
  });
  return {
    schemaVersion: 1,
    changeId: "mp-test",
    requirementId: "MP-1",
    title: "t",
    authorAgent: "agent",
    kind: "tieto",
    mode: "blind-first",
    reviewer: { version: "rv1", model: "m", promptVersions: { a1: "a1.v1", a2: "a2.v1", a3: "a3.v1", a4: "a4.v1", a5: "a5.v1" } },
    run: { id: "run", startedAt: "2026-11-14T10:00:00Z", finishedAt: "2026-11-14T10:01:00Z", durationMs: 60000, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 } },
    diff: { baseSha: "a", headSha: "b", baseTree: "c", headTree: "d", diffSha256: "e", filesChanged: files.length, linesAdded: 0, linesRemoved: 0 },
    files,
    hunks: specs.map((spec) => ({
      id: spec.id,
      file: spec.file,
      header: "@@ -1,1 +1,1 @@",
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [
        { kind: "context" as const, oldLine: 1, newLine: 1, text: "ctx" },
        ...Array.from({ length: spec.changed }, (_, index) => ({ kind: "add" as const, oldLine: null, newLine: index + 2, text: "x" })),
      ],
    })),
    requirement: { id: "MP-1", title: "t", intent: "i", functional: [], nonFunctional: [], derivedFrom: { kind: "github-issue", url: "u", note: "n" } },
    expectation: null,
    story: { what: "w", why: "y", touches: [] },
    claims,
    findings,
    refusals,
    quoteCheck: { checked: 0, passed: 0, downgraded: 0, dropped: 0, failures: [] },
    retractions: [],
    receiptDraft: { checked: [], notChecked: [], residualRisk: { text: "", acceptedRefusalIds: [] } },
    routing: { tier: "light", reasons: [], coverage: {}, readHunks: 0, totalHunks: 0, readLines: 0, totalLines: 0, readMinutes: 0, fullMinutes: 0 },
  };
}

const verifiedOn = (...ids: string[]) => [claim("c1", "verified", ids)];
const ruleIds = (review: Review, levels = trustedEverywhere) => route(review, levels).reasons.map((reason) => reason.ruleId);
const reasonText = (review: Review, ruleId: string) => route(review, trustedEverywhere).reasons.find((reason) => reason.ruleId === ruleId)?.text;

describe("coverage per hunk", () => {
  it("marks a hunk with a finding as read even when a verified claim lists it", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1"), findings: [finding("missing", ["h1"])] });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("read");
  });

  it("marks a hunk a refusal lists as read", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1"), refusals: [refusal(["h1"])] });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("read");
  });

  it("marks a hunk in a shadow area as read despite a verified claim", () => {
    const review = makeReview({ hunks: [{ id: "h1", area: "security" }], claims: verifiedOn("h1") });
    expect(route(review, { ...trustedEverywhere, security: "shadow" }).coverage.h1).toBe("read");
  });

  it("does not treat a calibrated area as shadow", () => {
    const review = makeReview({ hunks: [{ id: "h1", area: "security" }], claims: verifiedOn("h1") });
    expect(route(review, { ...trustedEverywhere, security: "calibrated" }).coverage.h1).toBe("verified");
  });

  it("marks a hunk with a verified claim as verified, even next to a supported one", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: [claim("c1", "supported", ["h1"]), claim("c2", "verified", ["h1"])] });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("verified");
  });

  it("marks a hunk with only a supported claim as supported", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: [claim("c1", "supported", ["h1"])] });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("supported");
  });

  it("marks a hunk with no claim, or only an unverified one, as read", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }], claims: [claim("c1", "unverified", ["h2"])] });
    expect(route(review, trustedEverywhere).coverage).toEqual({ h1: "read", h2: "read" });
  });

  it("marks generated-file hunks generated, whatever claims cover them", () => {
    const review = makeReview({
      hunks: [
        { id: "h1", file: "tests/Resources/a.cs", kind: "generated" },
        { id: "h2", file: "tests/Resources/b.cs", kind: "generated" },
      ],
      claims: [claim("c1", "supported", ["h1"])],
    });
    expect(route(review, trustedEverywhere).coverage).toEqual({ h1: "generated", h2: "generated" });
  });

  it("still marks a generated-file hunk read when a finding names it", () => {
    const review = makeReview({
      hunks: [{ id: "h1", file: "tests/Resources/a.cs", kind: "generated" }],
      findings: [finding("defect", ["h1"])],
    });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("read");
  });
});

describe("generated hunks", () => {
  const snapshots = (count: number): HunkSpec[] =>
    Array.from({ length: count }, (_, index) => ({ id: `g${index + 1}`, file: `tests/Resources/s${index + 1}.verified.cs`, kind: "generated" as FileKind }));

  it("leaves a change of only generated hunks at Light, with nothing to read and one reason", () => {
    const decision = route(makeReview({ hunks: snapshots(3) }), trustedEverywhere);
    expect(decision).toMatchObject({ tier: "light", readHunks: 0, totalHunks: 3, readLines: 0, readMinutes: 0 });
    expect(decision.reasons).toEqual([
      {
        ruleId: "R-generated",
        tier: "light",
        text: "3 are generated snapshots: read the template that produces them, because code hidden in a snapshot would not be caught",
      },
    ]);
  });

  it("counts only the hunks a person could read in the read share, and says the risk once", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, ...snapshots(10)], claims: verifiedOn("h1") });
    const decision = route(review, trustedEverywhere);
    // 1 of the 2 readable hunks is read: 50%, under the 75% limit, however many snapshots there are.
    expect(decision.readHunks).toBe(1);
    expect(decision.totalHunks).toBe(12);
    expect(decision.reasons.map((reason) => reason.ruleId)).toEqual(["R-unread", "R-generated"]);
    expect(decision.tier).toBe("focused");
  });

  it("fires R-read-share against the readable hunks, not the snapshots", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, ...snapshots(10)] });
    const decision = route(review, trustedEverywhere);
    expect(decision.reasons[0]).toEqual({ ruleId: "R-read-share", tier: "full", text: "Read 1 of 1 hunks: most of the change needs a human" });
  });

  it("keeps the reason singular for one snapshot", () => {
    const decision = route(makeReview({ hunks: snapshots(1) }), trustedEverywhere);
    expect(decision.reasons[0].text).toMatch(/^1 is a generated snapshot: read the template that produces it, /);
  });

  it("adds no reason and no generated coverage to a change without generated hunks", () => {
    const decision = route(makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") }), trustedEverywhere);
    expect(decision.reasons).toEqual([]);
    expect(Object.values(decision.coverage)).not.toContain("generated");
  });
});

describe("rules", () => {
  const covered = (hunks: HunkSpec[], extra: Partial<ReviewParts> = {}) =>
    makeReview({ hunks, claims: verifiedOn(...hunks.map((hunk) => hunk.id)), ...extra });

  it("fires R-size above 400 changed lines outside generated files, with the Full tier", () => {
    const decision = route(covered([{ id: "h1", changed: 401 }]), trustedEverywhere);
    expect(decision.reasons).toEqual([{ ruleId: "R-size", tier: "full", text: "401 changed lines outside generated files (limit 400)" }]);
    expect(decision.tier).toBe("full");
  });

  it("does not fire R-size at exactly 400 lines, or for lines in generated files", () => {
    expect(ruleIds(covered([{ id: "h1", changed: 400 }]))).toEqual([]);
    expect(ruleIds(covered([{ id: "h1", changed: 900, kind: "generated", file: "tests/Resources/a.cs" }]))).toEqual(["R-generated"]);
  });

  it("fires R-read-share when read hunks are at least 75% of all hunks", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, { id: "h3" }, { id: "h4" }], claims: verifiedOn("h1") });
    const decision = route(review, trustedEverywhere);
    expect(decision.reasons[0]).toEqual({ ruleId: "R-read-share", tier: "full", text: "Read 3 of 4 hunks: most of the change needs a human" });
    expect(decision.tier).toBe("full");
  });

  it("does not fire R-read-share just under 75%", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, { id: "h3" }, { id: "h4" }, { id: "h5" }], claims: verifiedOn("h1", "h2") });
    expect(ruleIds(review)).not.toContain("R-read-share");
  });

  it("fires R-refusal with a singular and a plural text", () => {
    expect(route(covered([{ id: "h1" }], { refusals: [refusal(["h1"])] }), trustedEverywhere).reasons).toContainEqual({
      ruleId: "R-refusal",
      tier: "focused",
      text: "1 item refused: a human decides",
    });
    expect(reasonText(covered([{ id: "h1" }], { refusals: [refusal([]), refusal([])] }), "R-refusal")).toBe("2 items refused: a human decides");
  });

  it("does not fire R-refusal without refusals", () => {
    expect(ruleIds(covered([{ id: "h1" }]))).not.toContain("R-refusal");
  });

  it("fires R-contradiction with a singular and a plural text", () => {
    expect(reasonText(covered([{ id: "h1" }], { findings: [finding("contradiction", [])] }), "R-contradiction")).toBe(
      "The PR description contradicts the code in 1 place",
    );
    expect(reasonText(covered([{ id: "h1" }], { findings: [finding("contradiction", []), finding("contradiction", [])] }), "R-contradiction")).toBe(
      "The PR description contradicts the code in 2 places",
    );
  });

  it("fires R-defect with a singular and a plural text, and not for other finding kinds", () => {
    expect(reasonText(covered([{ id: "h1" }], { findings: [finding("defect", [])] }), "R-defect")).toBe("1 defect found");
    expect(reasonText(covered([{ id: "h1" }], { findings: [finding("defect", []), finding("defect", [])] }), "R-defect")).toBe("2 defects found");
    expect(ruleIds(covered([{ id: "h1" }], { findings: [finding("missing", []), finding("scope-creep", [])] }))).toEqual([]);
  });

  it("fires R-sensitive-path for each policy glob, listing the labels it touched", () => {
    const decision = route(
      covered([
        { id: "h1", file: "src/MessagePack.Annotations/Key.cs" },
        { id: "h2", file: "src/MessagePack.SourceGenerator/AnalyzerReleases.Shipped.md" },
      ]),
      trustedEverywhere,
    );
    expect(decision.reasons).toEqual([
      { ruleId: "R-sensitive-path", tier: "focused", text: "Touches public attributes (MessagePack.Annotations), diagnostic IDs (analyzer releases)" },
    ]);
    expect(ruleIds(covered([{ id: "h1", file: "src/MessagePack/Formatter.cs" }]))).toEqual(["R-sensitive-path"]);
  });

  it("does not fire R-sensitive-path for a neighbouring path", () => {
    expect(ruleIds(covered([{ id: "h1", file: "src/MessagePack.SourceGenerator/Emit.cs" }]))).toEqual([]);
  });

  it("fires R-area-level once per touched area below Trusted, with the Shadow and Calibrated texts", () => {
    const review = covered([
      { id: "h1", area: "analyzer", file: "src/A/a.cs" },
      { id: "h2", area: "generator", file: "src/B/b.cs" },
    ]);
    const decision = route(review, { ...trustedEverywhere, analyzer: "calibrated", generator: "shadow" });
    expect(decision.reasons.filter((reason) => reason.ruleId === "R-area-level").map((reason) => reason.text)).toEqual([
      "Analyzer: Calibrated, may route Focused at best",
      "Generator: Shadow, the AI's output routes nothing here",
    ]);
  });

  it("does not fire R-area-level for Trusted areas or areas the change does not touch", () => {
    const review = covered([{ id: "h1", area: "analyzer", file: "src/A/a.cs" }]);
    expect(ruleIds(review, { ...trustedEverywhere, security: "shadow" })).toEqual([]);
  });

  it("fires R-unread alone when hunks have no checked evidence and nothing else fired", () => {
    const one = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, { id: "h3" }], claims: verifiedOn("h1", "h2") });
    expect(route(one, trustedEverywhere).reasons).toEqual([{ ruleId: "R-unread", tier: "focused", text: "1 hunk has no checked evidence" }]);
    const two = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, { id: "h3" }, { id: "h4" }], claims: verifiedOn("h1", "h2") });
    expect(reasonText(two, "R-unread")).toBe("2 hunks have no checked evidence");
  });

  it("does not fire R-unread when another rule fired", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }, { id: "h3" }], claims: verifiedOn("h1", "h2"), refusals: [refusal(["h3"])] });
    expect(ruleIds(review)).toEqual(["R-refusal"]);
  });
});

describe("R-escape", () => {
  const securityHunk = { id: "h1", file: "src/Runtime/A.cs", area: "security" as const };
  const analyzerHunk = { id: "h2", file: "src/Analyzers/B.cs", area: "analyzer" as const };
  const covered = (...hunks: HunkSpec[]) => makeReview({ hunks, claims: verifiedOn(...hunks.map((hunk) => hunk.id)) });
  const escapeReasons = (review: Review, escapes: Partial<Record<Area, number>>) =>
    route(review, trustedEverywhere, undefined, escapes).reasons.filter((reason) => reason.ruleId === "R-escape");

  it("sends the change to a full read when an area it touches has an escape", () => {
    const decision = route(covered(securityHunk), trustedEverywhere, undefined, { security: 1 });
    expect(decision.tier).toBe("full");
    expect(decision.reasons).toEqual([{ ruleId: "R-escape", tier: "full", text: "Security: a bug escaped here, the next changes get a full read" }]);
  });

  it("adds one reason per escaped area the change touches", () => {
    const reasons = escapeReasons(covered(securityHunk, analyzerHunk), { security: 2, analyzer: 1 });
    expect(reasons.map((reason) => reason.text)).toEqual([
      "Security: a bug escaped here, the next changes get a full read",
      "Analyzer: a bug escaped here, the next changes get a full read",
    ]);
  });

  it("ignores escapes in areas the change does not touch and zero counts", () => {
    expect(escapeReasons(covered(securityHunk), { analyzer: 3 })).toEqual([]);
    expect(escapeReasons(covered(securityHunk), { security: 0 })).toEqual([]);
    expect(route(covered(securityHunk), trustedEverywhere).tier).toBe("light");
  });

  it("sits after R-read-share and before R-refusal", () => {
    const review = makeReview({ hunks: [securityHunk], refusals: [refusal(["h1"])] });
    expect(route(review, trustedEverywhere, undefined, { security: 1 }).reasons.map((reason) => reason.ruleId)).toEqual(["R-read-share", "R-escape", "R-refusal"]);
  });
});

describe("tier and reading time", () => {
  it("routes Light with no reasons when every hunk is covered", () => {
    const decision = route(makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") }), trustedEverywhere);
    expect(decision).toMatchObject({ tier: "light", reasons: [], readHunks: 0, totalHunks: 1, readLines: 0, readMinutes: 0 });
  });

  it("takes the highest tier any reason asks for and keeps the reasons in rule order", () => {
    const review = makeReview({ hunks: [{ id: "h1", changed: 500 }], claims: verifiedOn("h1"), refusals: [refusal([])] });
    const decision = route(review, trustedEverywhere);
    expect(decision.reasons.map((reason) => reason.ruleId)).toEqual(["R-size", "R-refusal"]);
    expect(decision.tier).toBe("full");
  });

  it("counts only added and removed lines, rounds minutes up and reads at least one minute", () => {
    const review = makeReview({ hunks: [{ id: "h1", changed: 3 }, { id: "h2", changed: 30 }], claims: verifiedOn("h2") });
    expect(route(review, trustedEverywhere)).toMatchObject({ readLines: 3, totalLines: 33, readMinutes: 1, fullMinutes: 2 });
  });

  it("is deterministic for the same input", () => {
    const review = makeReview({ hunks: [{ id: "h1" }, { id: "h2" }], claims: verifiedOn("h1") });
    expect(route(review, trustedEverywhere)).toEqual(route(review, trustedEverywhere));
  });
});

describe("coverageReason", () => {
  const trusted = trustedEverywhere;
  const shadowGenerator: Record<Area, LadderLevel> = { ...trustedEverywhere, generator: "shadow" };

  it("names the finding that makes a hunk read, before any claim", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: [claim("c1", "supported", ["h1"])], findings: [finding("defect", ["h1"])] });
    expect(coverageReason(review, trusted, "h1")).toBe("Finding f1 (defect) names this hunk");
  });

  it("names the refusal when no finding does", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], refusals: [refusal(["h1"])] });
    expect(coverageReason(review, trusted, "h1")).toBe("Refusal r1 (R7) names this hunk: a person decides");
  });

  it("says the area is at Shadow when that is why a covered hunk is read", () => {
    const review = makeReview({ hunks: [{ id: "h1", area: "generator" }], claims: [claim("c1", "supported", ["h1"])] });
    expect(coverageReason(review, shadowGenerator, "h1")).toBe("Generator is at Shadow: the AI's evidence routes nothing here yet");
  });

  it("says no Verified or Supported claim covers it otherwise", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: [claim("c1", "unverified", ["h1"])] });
    expect(coverageReason(review, trusted, "h1")).toBe("No Verified or Supported claim covers it");
  });
});

describe("legacy guard", () => {
  const writer = "src/MessagePack/MessagePackWriter.cs";
  const legacyRefusal = (hunkIds: string[]): Review["refusals"][number] => ({
    id: "r1",
    ruleId: "R8",
    source: "rule",
    reason: "Edits legacy code in Wire format: the runtime owner (the maintainers) decides",
    hunkIds,
  });

  it("keeps a legacy hunk with a Verified claim and an R8 refusal on the reading list", () => {
    const review = makeReview({ hunks: [{ id: "h1", file: writer }], claims: verifiedOn("h1"), refusals: [legacyRefusal(["h1"])] });
    expect(route(review, trustedEverywhere).coverage.h1).toBe("read");
  });

  it("fires R-legacy at the Focused tier, naming the zone and its owner", () => {
    const review = makeReview({ hunks: [{ id: "h1", file: writer }, { id: "h2", file: writer }], claims: verifiedOn("h1", "h2") });
    const decision = route(review, trustedEverywhere);
    expect(decision.reasons).toContainEqual({
      ruleId: "R-legacy",
      tier: "focused",
      text: "Wire format: edits legacy code in 2 hunks, the runtime owner (the maintainers) decides",
    });
    expect(decision.tier).toBe("focused");
  });

  it("asks for Full at legacyTouchFull legacy hunks across zones", () => {
    const hunks = [
      ...Array.from({ length: 3 }, (_, index) => ({ id: `w${index}`, file: writer })),
      ...Array.from({ length: 2 }, (_, index) => ({ id: `u${index}`, file: "src/MessagePack.UnityClient/Foo.cs" })),
    ];
    const review = makeReview({ hunks, claims: verifiedOn(...hunks.map((hunk) => hunk.id)) });
    const decision = route(review, trustedEverywhere);
    expect(decision.reasons.filter((reason) => reason.ruleId === "R-legacy").map((reason) => reason.tier)).toEqual(["full", "full"]);
    expect(decision.tier).toBe("full");
  });

  describe("reach-ins toward legacyTouchFull", () => {
    const formatter = "src/MessagePack/Formatters/NewFormatter.cs";
    const reachIn = (hunkIds: string[]) => ({
      kind: "legacy-code" as const,
      hunkIds,
      detail: "WriteArrayHeader: calls into Wire format",
      owner: "runtime owner (the maintainers)",
      guard: { status: "guarded" as const, evidence: "109 test files at the base commit name WriteArrayHeader", files: [] },
    });
    const withReachIns = (zoneHunks: number, reachInHunks: number) => {
      const zone = Array.from({ length: zoneHunks }, (_, index) => ({ id: `w${index}`, file: writer }));
      const outside = Array.from({ length: reachInHunks }, (_, index) => ({ id: `f${index}`, file: formatter }));
      const hunks = [...zone, ...outside];
      return {
        ...makeReview({ hunks, claims: verifiedOn(...hunks.map((hunk) => hunk.id)) }),
        legacyTouchPoints: [reachIn(outside.map((hunk) => hunk.id))],
      };
    };
    const legacyTiers = (review: ReturnType<typeof withReachIns>) =>
      route(review, trustedEverywhere).reasons.filter((reason) => reason.ruleId === "R-legacy").map((reason) => reason.tier);

    it("counts reach-in hunks with zone hunks: 3 in the zone and 2 reaching in is Full, and says so", () => {
      expect(route(withReachIns(3, 2), trustedEverywhere).reasons).toContainEqual({
        ruleId: "R-legacy",
        tier: "full",
        text: "Wire format: edits legacy code in 3 hunks, plus 2 reaching in, the runtime owner (the maintainers) decides",
      });
    });

    it("gives reach-ins alone their own Full reason at the threshold, naming the owner, and none below it", () => {
      expect(route(withReachIns(0, 5), trustedEverywhere).reasons).toContainEqual({
        ruleId: "R-legacy",
        tier: "full",
        text: "Legacy code: reaches into the legacy zones from 5 hunks, the runtime owner (the maintainers) decides",
      });
      expect(legacyTiers(withReachIns(0, 4))).toEqual([]);
    });
  });

  it("adds no R-legacy to a change without legacy files", () => {
    const review = makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") });
    expect(ruleIds(review)).not.toContain("R-legacy");
    expect(route(review, trustedEverywhere).tier).toBe("light");
  });

  it("explains an R8 refusal with its reason, naming zone and owner", () => {
    const review = makeReview({ hunks: [{ id: "h1", file: writer }], refusals: [legacyRefusal(["h1"])] });
    expect(coverageReason(review, trustedEverywhere, "h1")).toBe(
      "Refusal r1 (R8): Edits legacy code in Wire format: the runtime owner (the maintainers) decides",
    );
  });
  describe("R-legacy-guard", () => {
    type Status = "guarded" | "partly" | "unguarded" | "owner-read";
    function routeWith(status: Status) {
      const touch = {
        kind: "old-platform" as const,
        hunkIds: ["h1"],
        detail: "#if !NETFRAMEWORK",
        owner: "platform owner (the maintainers)",
        guard: { status, evidence: "no test runs it on .NET Framework", files: [] },
      };
      const review = {
        ...makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") }),
        legacyTouchPoints: [touch],
      };
      return route(review, trustedEverywhere);
    }

    it("leaves out the hunk count for a touch with no hunks, a binary file or a mode change", () => {
      const touch = {
        kind: "legacy-code" as const,
        hunkIds: [],
        detail: "Unity client: src/MessagePack.UnityClient/Assets/Plugin.dll (no hunks: binary or mode change)",
        owner: "Unity owner (the maintainers)",
        guard: { status: "unguarded" as const, evidence: "no test at the base commit names Plugin", files: [] },
      };
      const review = { ...makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") }), legacyTouchPoints: [touch] };
      expect(route(review, trustedEverywhere).reasons).toContainEqual({
        ruleId: "R-legacy-guard",
        tier: "full",
        text: "Legacy code: Unity client: src/MessagePack.UnityClient/Assets/Plugin.dll (no hunks: binary or mode change), no test at the base commit names Plugin; the Unity owner (the maintainers) decides",
      });
    });

    it("asks for Full when the touch is unguarded, naming the owner", () => {
      const decision = routeWith("unguarded");
      expect(decision.reasons).toContainEqual({
        ruleId: "R-legacy-guard",
        tier: "full",
        text: "Old platform: #if !NETFRAMEWORK in 1 hunk, no test runs it on .NET Framework; the platform owner (the maintainers) decides",
      });
      expect(decision.tier).toBe("full");
    });

    it("asks for Focused when the guard is partial or only the owner can read", () => {
      expect(routeWith("partly").tier).toBe("focused");
      expect(routeWith("owner-read").tier).toBe("focused");
    });

    it("shows a guarded touch at Light without raising the tier", () => {
      const decision = routeWith("guarded");
      expect(decision.reasons.find((reason) => reason.ruleId === "R-legacy-guard")?.tier).toBe(
        "light",
      );
      expect(decision.tier).toBe("light");
    });

    it("decides a review without touch points as before", () => {
      const review = makeReview({ hunks: [{ id: "h1" }], claims: verifiedOn("h1") });
      expect(route({ ...review, legacyTouchPoints: [] }, trustedEverywhere)).toEqual(
        route(review, trustedEverywhere),
      );
    });
  });
});
