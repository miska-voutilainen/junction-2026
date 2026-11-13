import { describe, expect, it } from "vitest";
import {
  AnswerKeySchema,
  ChangeInputSchema,
  CitationSchema,
  ReceiptRecordSchema,
  ReportCardSchema,
  RequirementSchema,
  ReviewSchema,
} from "./index";

const sha = "a".repeat(40);
const hash = "b".repeat(64);
const ts = "2026-11-13T10:00:00Z";

const requirement = {
  id: "MP-2283",
  title: "Title",
  intent: "Intent.",
  functional: [{ id: "F1", text: "Do it." }],
  nonFunctional: [{ id: "N1", text: "Fast." }],
  derivedFrom: { kind: "github-issue" as const, url: "https://example.com/1", note: "n" },
};

const change = {
  id: "mp-2283",
  kind: "tieto" as const,
  title: "Title",
  requirementId: "MP-2283",
  parentChangeId: null,
  repo: "owner/repo",
  branch: "main",
  baseSha: sha,
  headSha: sha,
  authorAgent: "agent",
  authorDescription: { text: "t", synthetic: true, writtenBy: "me" },
};

const review = {
  schemaVersion: 1 as const,
  changeId: "mp-2283",
  requirementId: "MP-2283",
  title: "Title",
  authorAgent: "agent",
  kind: "tieto" as const,
  mode: "blind-first" as const,
  reviewer: {
    version: "rv1",
    model: "m",
    promptVersions: { a1: "1", a2: "1", a3: "1", a4: "1", a5: "1" },
  },
  run: {
    id: "run1",
    startedAt: ts,
    finishedAt: ts,
    durationMs: 1,
    usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.1, calls: 1 },
  },
  diff: {
    baseSha: sha,
    headSha: sha,
    baseTree: sha,
    headTree: sha,
    diffSha256: hash,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
  },
  files: [],
  hunks: [],
  requirement,
  expectation: null,
  story: { what: "w", why: "y", touches: [] },
  claims: [],
  findings: [],
  refusals: [],
  quoteCheck: { checked: 0, passed: 0, downgraded: 0, dropped: 0, failures: [] },
  retractions: [],
  receiptDraft: { checked: [], notChecked: [], residualRisk: { text: "", acceptedRefusalIds: [] } },
  routing: {
    tier: "light" as const,
    reasons: [],
    coverage: {},
    readHunks: 0,
    totalHunks: 0,
    readLines: 0,
    totalLines: 0,
    readMinutes: 0,
    fullMinutes: 0,
  },
};

describe("contracts", () => {
  it("parses a minimal Requirement", () => {
    expect(RequirementSchema.safeParse(requirement).success).toBe(true);
  });

  it("parses a minimal ChangeInput", () => {
    expect(ChangeInputSchema.safeParse(change).success).toBe(true);
  });

  it("parses a minimal AnswerKey", () => {
    const key = {
      plantId: "v01",
      changeId: "v01",
      kind: "planted-bug",
      area: null,
      file: null,
      startLine: null,
      endLine: null,
      defect: "d",
      why: "w",
      writtenBy: "me",
      writtenAt: ts,
    };
    expect(AnswerKeySchema.safeParse(key).success).toBe(true);
  });

  it("parses a minimal Review", () => {
    expect(ReviewSchema.safeParse(review).success).toBe(true);
  });

  it("parses a minimal ReportCard", () => {
    const card = {
      schemaVersion: 1,
      generatedAt: ts,
      reviewer: { version: "rv1", model: "m" },
      areas: [],
      anchoredVsBlind: {
        plants: 0,
        runsPerMode: 0,
        anchored: { caught: 0, total: 0 },
        blind: { caught: 0, total: 0 },
        perPlant: [],
      },
      hallucinations: { quotesChecked: 0, quoteFailures: 0, claimsRetracted: 0, findingsDropped: 0 },
      findingsOnPlants: { total: 0, matchedPlant: 0 },
      routingSpread: {
        changes: 0,
        light: 0,
        focused: 0,
        full: 0,
        readHunks: 0,
        totalHunks: 0,
        readMinutes: 0,
        fullMinutes: 0,
      },
    };
    expect(ReportCardSchema.safeParse(card).success).toBe(true);
  });

  it("parses a minimal ReceiptRecord", () => {
    const record = {
      schemaVersion: 1,
      changeId: "mp-2283",
      receipt: {
        kind: "countersign-receipt",
        version: 1,
        changeId: "mp-2283",
        requirementId: "MP-2283",
        repo: "owner/repo",
        commit: sha,
        baseCommit: sha,
        baseTree: sha,
        headTree: sha,
        diffSha256: hash,
        reviewerVersion: "rv1",
        reviewRunId: "run1",
        owner: "login",
        signedAt: ts,
        checked: [{ item: "i", by: "tool" }],
        notChecked: [],
        residualRisk: { text: "", acceptedRefusalIds: [] },
      },
      signature: "-----BEGIN SSH SIGNATURE-----",
      notesRef: "refs/notes/countersign",
      verify: { command: "c", output: "o", ok: true, verifiedAt: ts },
    };
    expect(ReceiptRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects a Review with an unknown key", () => {
    expect(ReviewSchema.safeParse({ ...review, extra: 1 }).success).toBe(false);
  });

  it("rejects a ChangeInput with a 7-char SHA", () => {
    expect(ChangeInputSchema.safeParse({ ...change, headSha: "32258fd" }).success).toBe(false);
  });

  it("rejects a Citation with startLine 0", () => {
    const citation = { file: "a.cs", side: "new", startLine: 0, endLine: 1, quote: "q" };
    expect(CitationSchema.safeParse(citation).success).toBe(false);
  });
});
