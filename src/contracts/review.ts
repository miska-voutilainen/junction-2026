import { z } from "zod";
import {
  AreaSchema,
  CitationSchema,
  EvidenceLevelSchema,
  FileKindSchema,
  IsoTimestampSchema,
  ReceiptBodySchema,
  ShaSchema,
} from "./common";
import { RequirementSchema } from "./requirement";
import { TierDecisionSchema } from "./tierDecision";

const nonNegInt = z.number().int().nonnegative();
const TestResultSchema = z.strictObject({
  result: z.enum(["fail", "pass", "error"]),
  output: z.string(), // a 2,000-character excerpt: failed tests, error messages, repository frames, summary
});

const HunkLineSchema = z.strictObject({
  kind: z.enum(["context", "add", "del"]),
  oldLine: z.number().int().positive().nullable(),
  newLine: z.number().int().positive().nullable(),
  text: z.string(), // excludes the +/-/space prefix
});

const HunkSchema = z.strictObject({
  id: z.string(), // "h1", "h2", ... in diff order
  file: z.string(),
  header: z.string(), // "@@ -236,7 +236,7 @@"
  oldStart: nonNegInt,
  oldLines: nonNegInt,
  newStart: nonNegInt,
  newLines: nonNegInt,
  lines: z.array(HunkLineSchema),
});

export const LegacyTouchKindSchema = z.enum([
  "legacy-code",
  "old-platform",
  "consumer-contract",
  "build",
]);
export type LegacyTouchKind = z.infer<typeof LegacyTouchKindSchema>;

/**
 * A place the change touches what old systems rely on, with who decides and
 * what covers it. Producer: engine, findLegacyTouchPoints (git and path rules,
 * no model). One per kind and detail; a guard never removes a hunk from the
 * reading list, it tells the owner what covers the touch.
 */
export const LegacyTouchPointSchema = z.strictObject({
  kind: LegacyTouchKindSchema,
  hunkIds: z.array(z.string()),
  /** What is touched, e.g. "#if !NETSTANDARD2_0 && !NETFRAMEWORK". */
  detail: z.string(),
  /** The named owner who decides, e.g. "runtime owner (the maintainers)". */
  owner: z.string(),
  guard: z.strictObject({
    /** guarded: evidence covers it; partly: covers some targets; unguarded: none; owner-read: no mechanical evidence exists for this kind. */
    status: z.enum(["guarded", "partly", "unguarded", "owner-read"]),
    /** One sentence saying what covers the touch, or that nothing does. */
    evidence: z.string(),
    files: z.array(z.string()),
  }),
});
export type LegacyTouchPoint = z.infer<typeof LegacyTouchPointSchema>;

const ClaimSchema = z.strictObject({
  id: z.string(), // "c1"
  requirementItemId: z.string().nullable(),
  text: z.string(),
  kind: z.enum(["behaviour", "structure", "docs", "test"]),
  level: EvidenceLevelSchema,
  hunkIds: z.array(z.string()),
  citations: z.array(CitationSchema),
  evidence: z.array(
    z.strictObject({
      kind: z.enum(["differential-test", "pr-test", "quote-check"]),
      summary: z.string(),
      testName: z.string().nullable(),
      base: TestResultSchema.nullable(),
      head: TestResultSchema.nullable(),
    }),
  ),
});

const FindingSchema = z.strictObject({
  id: z.string(), // "f1"
  kind: z.enum(["defect", "contradiction", "missing", "scope-creep"]),
  area: AreaSchema.nullable(),
  severity: z.enum(["high", "medium", "low"]),
  title: z.string(),
  detail: z.string(),
  statement: z.string().nullable(), // contradiction: the PR sentence
  hunkIds: z.array(z.string()),
  citations: z.array(CitationSchema),
});

/** data/runs/<changeId>/review.json and the anchored/blind runs (producer: engine lane). */
export const ReviewSchema = z.strictObject({
  schemaVersion: z.literal(1),
  // copied from ChangeInput
  changeId: z.string(),
  requirementId: z.string(),
  title: z.string(),
  authorAgent: z.string(),
  kind: z.enum(["tieto", "planted-bug", "contradiction-plant"]),
  mode: z.enum(["blind-first", "anchored"]),
  reviewer: z.strictObject({
    version: z.string(), // "rv1"
    model: z.string(),
    promptVersions: z.strictObject({
      a1: z.string(),
      a2: z.string(),
      a3: z.string(),
      a4: z.string(),
      a5: z.string(),
    }),
  }),
  run: z.strictObject({
    id: z.string(),
    startedAt: IsoTimestampSchema,
    finishedAt: IsoTimestampSchema,
    durationMs: nonNegInt,
    usage: z.strictObject({
      inputTokens: nonNegInt,
      outputTokens: nonNegInt,
      costUsd: z.number().nonnegative(),
      calls: nonNegInt,
    }),
  }),
  diff: z.strictObject({
    baseSha: ShaSchema,
    headSha: ShaSchema,
    baseTree: ShaSchema,
    headTree: ShaSchema,
    diffSha256: z.string().regex(/^[0-9a-f]{64}$/),
    filesChanged: nonNegInt,
    linesAdded: nonNegInt,
    linesRemoved: nonNegInt,
  }),
  files: z.array(
    z.strictObject({
      path: z.string(),
      kind: FileKindSchema,
      area: AreaSchema.nullable(),
      added: nonNegInt,
      removed: nonNegInt,
      hunkIds: z.array(z.string()),
    }),
  ),
  hunks: z.array(HunkSchema),
  requirement: RequirementSchema,
  // null in anchored mode
  expectation: z
    .strictObject({
      items: z.array(
        z.strictObject({
          requirementItemId: z.string(),
          expectedBehaviours: z.array(z.string()),
          likelyAreas: z.array(AreaSchema),
          expectedTests: z.array(z.string()),
        }),
      ),
    })
    .nullable(),
  story: z.strictObject({
    what: z.string(),
    why: z.string(),
    touches: z.array(
      z.strictObject({ symbol: z.string(), file: z.string(), note: z.string() }),
    ),
  }),
  claims: z.array(ClaimSchema),
  findings: z.array(FindingSchema),
  refusals: z.array(
    z.strictObject({
      id: z.string(), // "r1"
      ruleId: z.string(), // "R1".."R7"
      /**
       * "rule": a fixed trigger in policy (`fixedRefusals`), no model involved,
       * so it reaches a human whatever the model says. "ai": the model refused.
       */
      source: z.enum(["ai", "rule"]),
      reason: z.string(),
      hunkIds: z.array(z.string()),
    }),
  ),
  quoteCheck: z.strictObject({
    checked: nonNegInt,
    passed: nonNegInt,
    downgraded: nonNegInt,
    dropped: nonNegInt,
    failures: z.array(
      z.strictObject({
        // The model's item the failure belongs to: a claim's id ("c1"), or the position
        // in the step's answer for A3 and A4 output: "a3-f<n>" the n-th finding,
        // "a3-r<n>" the n-th refusal, "a4-s<n>" the n-th statement. A finding or
        // refusal dropped by the check is absent from the review, so this is not
        // the id of an item in `findings` or `refusals`.
        itemId: z.string(),
        // null when there was no code to check, e.g. a refusal naming an unknown rule id.
        citation: CitationSchema.nullable(),
        reason: z.string(),
      }),
    ),
  }),
  retractions: z.array(
    z.strictObject({ claimId: z.string(), reason: z.string(), output: z.string() }),
  ),
  // Tests that said nothing about the change (a build error, no match, a timeout, or a failure on both
  // versions), with the reason. Optional so reviews recorded before A5 stay valid.
  inconclusiveTests: z
    .array(
      z.strictObject({
        source: z.enum(["differential-test", "pr-test"]),
        requirementItemId: z.string().nullable(),
        testNames: z.array(z.string()),
        reason: z.string(),
      }),
    )
    .optional(),
  receiptDraft: ReceiptBodySchema,
  // Optional so reviews recorded before the legacy guard stay valid.
  legacyTouchPoints: z.array(LegacyTouchPointSchema).optional(),
  // route() at record time, with the levels from the report card then
  routing: TierDecisionSchema,
});
export type Review = z.infer<typeof ReviewSchema>;
