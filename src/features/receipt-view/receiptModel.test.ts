import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChangeInputSchema, ReceiptRecordSchema, ReviewSchema } from "@/contracts";
import type { InboxSource } from "@/features/inbox";
import { buildReceiptView, formatUtc } from "./receiptModel";
import type { ReceiptDocumentView } from "./receiptModel";

const fixtureText = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), "data", "fixtures", relativePath), "utf8");
const fixture = (relativePath: string): unknown => JSON.parse(fixtureText(relativePath));

/** A source from the fixtures; `receipt` overrides the receipt file (null for none). */
function source(changeId: string, receipt?: InboxSource["receipt"]): InboxSource {
  return {
    change: ChangeInputSchema.parse(fixture(`sample/changes/${changeId}.json`)),
    review: { state: "ok", data: ReviewSchema.parse(fixture(`runs/${changeId}/review.json`)) },
    receipt: receipt === undefined ? ReceiptRecordSchema.parse(fixture(`receipts/${changeId}.json`)) : receipt,
  };
}

function documentOf(input: InboxSource, receiptText: string | null = null): ReceiptDocumentView {
  const view = buildReceiptView(input, null, receiptText);
  if (view.kind !== "document") throw new Error(`Expected a receipt document, got ${view.kind}.`);
  return view;
}

describe("buildReceiptView", () => {
  it("shows a receipt for the reviewed diff as signed, with the verify line from the spec", () => {
    const view = documentOf(source("mp-2283"));
    expect(view.status).toBe("signed");
    expect(view.verifyLine).toBe("Signature valid · diff unchanged");
    expect(view.staleHashes).toBeNull();
    expect(view.signedAt).toBe("2026-11-14 09:40 UTC");
  });

  it("labels who checked each item", () => {
    const view = documentOf(source("mp-2283"));
    expect(view.checked.map((entry) => entry.by)).toEqual(expect.arrayContaining(["Tool", "AI, supported", "Human"]));
  });

  it("names author, reviewer version and signer once, in the roles line, not as identity rows", () => {
    const input = source("mp-2283");
    const view = documentOf(input);
    expect(view.roles).toEqual({ authorAgent: input.change.authorAgent, reviewerVersion: "rv1", owner: "miska-voutilainen" });
    expect(view.identity.map((row) => row.label)).not.toEqual(expect.arrayContaining(["author"]));
    expect(view.identity.map((row) => row.label)).not.toEqual(expect.arrayContaining(["signer"]));
  });

  it("shows a receipt for an older diff as stale, with both hashes cut to 12 characters and no summary but the signed ledger", () => {
    const view = documentOf(source("mp-2129"));
    expect(view.status).toBe("stale");
    expect(view.staleHashes?.signedDiff).toHaveLength(12);
    expect(view.staleHashes?.reviewedDiff).toHaveLength(12);
    expect(view.staleHashes?.signedDiff).not.toBe(view.staleHashes?.reviewedDiff);
    expect(view.identity.find((row) => row.label === "diffSha256")?.value).toHaveLength(64);
    expect(view.ledger.length).toBeGreaterThan(0);
    expect(view.summary).toBeNull();
  });

  it("shows a receipt whose recorded check failed as unverified, even when the diff matches", () => {
    const record = ReceiptRecordSchema.parse(fixture("receipts/mp-2283.json"));
    const failed = source("mp-2283", { ...record, verify: { ...record.verify, ok: false } });
    const view = documentOf(failed);
    expect(view.status).toBe("unverified");
    expect(view.verifyLine).toBe("The signature check failed when this receipt was exported.");
  });

  it("offers the sign command when there is no receipt", () => {
    expect(buildReceiptView(source("mp-2234", null), null, null)).toEqual({
      kind: "none",
      changeId: "mp-2234",
      signCommand: "pnpm countersign sign mp-2234",
    });
  });

  it("carries the validation error of an unreadable receipt", () => {
    const view = buildReceiptView(source("mp-2283", "unreadable"), "data/receipts/mp-2283.json: owner: Required", null);
    expect(view).toEqual({ kind: "invalid", changeId: "mp-2283", error: "data/receipts/mp-2283.json: owner: Required" });
  });

  it("calls a verified receipt unchecked, not signed, when no review can be compared with it", () => {
    const withoutReview: InboxSource = { ...source("mp-2283"), review: { state: "missing" } };
    const view = documentOf(withoutReview);
    expect(view.status).toBe("unchecked");
    expect(view.verifyLine).toBe("Signature valid");
    expect(view.summary).toBeNull();
    expect(view.ledger.length).toBeGreaterThan(0);
    expect(view.residualRisk.accepted.every((entry) => entry.rule === null)).toBe(true);
  });

  it("keeps a failed check unverified when there is no review either", () => {
    const record = ReceiptRecordSchema.parse(fixture("receipts/mp-2283.json"));
    const input: InboxSource = { ...source("mp-2283", { ...record, verify: { ...record.verify, ok: false } }), review: { state: "unreadable" } };
    expect(documentOf(input).status).toBe("unverified");
  });

  it("puts the file's exact text in the Copy JSON field, else the parsed record", () => {
    const text = fixtureText("receipts/mp-2283.json");
    expect(documentOf(source("mp-2283"), text).recordJson).toBe(text);
    expect(JSON.parse(documentOf(source("mp-2283")).recordJson).changeId).toBe("mp-2283");
  });
});

describe("hunk ledger", () => {
  const input = source("mp-2283");
  const view = documentOf(input);
  const signedHunks = ReceiptRecordSchema.parse(fixture("receipts/mp-2283.json")).receipt.hunks;

  it("lists every hunk of the receipt's signed payload", () => {
    expect(view.ledger).toHaveLength(signedHunks.length);
  });

  it("puts the hunks a person read first and keeps who read them as signed", () => {
    const readRows = view.ledger.filter((row) => row.coverage === "read");
    expect(view.ledger.slice(0, readRows.length)).toEqual(readRows);
    expect(readRows.every((row) => row.readBy === view.owner)).toBe(true);
    expect(view.ledger.filter((row) => row.coverage !== "read").every((row) => row.readBy === null)).toBe(true);
  });

  it("reads the signed hunks, not the review: a review that disagrees changes nothing", () => {
    const review = ReviewSchema.parse(fixture("runs/mp-2283/review.json"));
    const withoutHunks = { ...review, hunks: [], routing: { ...review.routing, coverage: {} } };
    const other = documentOf({ ...input, review: { state: "ok", data: withoutHunks } });
    expect(other.ledger).toEqual(view.ledger);
  });
});

describe("accepted refusals", () => {
  it("resolves a refusal id to its rule id and title when the review is the run the receipt names", () => {
    const view = documentOf(source("mp-2283"));
    expect(view.residualRisk.accepted).toHaveLength(1);
    const [accepted] = view.residualRisk.accepted;
    expect(accepted.rule?.id).toMatch(/^R[1-7]$/);
    expect(accepted.rule?.title.length).toBeGreaterThan(0);
  });

  it("claims no rule title when the review is from another run than the receipt's", () => {
    // mp-2129's receipt was signed against run-20261113, the recorded review is run-20261114: "r1" may mean another rule there.
    const view = documentOf(source("mp-2129"));
    const [accepted] = view.residualRisk.accepted;
    expect(accepted.refusalId).toBe("r1");
    expect(accepted.rule).toBeNull();
    expect(accepted.runId).toBe("run-20261113-mp-2129");
  });
});

describe("formatUtc", () => {
  it("formats without locale, converting an offset to UTC", () => {
    expect(formatUtc("2026-11-14T11:40:12+02:00")).toBe("2026-11-14 09:40 UTC");
  });
});
