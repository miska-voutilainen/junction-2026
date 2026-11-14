import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChangeInputSchema, ReceiptRecordSchema, ReviewSchema } from "@/contracts";
import type { InboxSource } from "@/features/inbox";
import { buildReceiptView, formatUtc } from "./receiptModel";
import type { ReceiptDocumentView } from "./receiptModel";

const fixture = (relativePath: string): unknown =>
  JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", relativePath), "utf8"));

/** A source from the fixtures; `receipt` overrides the receipt file ("none" for no file). */
function source(changeId: string, receipt?: InboxSource["receipt"]): InboxSource {
  return {
    change: ChangeInputSchema.parse(fixture(`sample/changes/${changeId}.json`)),
    review: { state: "ok", data: ReviewSchema.parse(fixture(`runs/${changeId}/review.json`)) },
    receipt: receipt === undefined ? ReceiptRecordSchema.parse(fixture(`receipts/${changeId}.json`)) : receipt,
  };
}

function documentOf(view: ReturnType<typeof buildReceiptView>): ReceiptDocumentView {
  if (view.kind !== "document") throw new Error(`Expected a receipt document, got ${view.kind}.`);
  return view;
}

describe("buildReceiptView", () => {
  it("shows a receipt for the reviewed diff as signed, with the verify line from the spec", () => {
    const view = documentOf(buildReceiptView(source("mp-2283"), null));
    expect(view.status).toBe("signed");
    expect(view.verifyLine).toBe("Signature valid · diff unchanged");
    expect(view.staleHashes).toBeNull();
    expect(view.signedAt).toBe("2026-11-14 09:40 UTC");
  });

  it("labels who checked each item", () => {
    const view = documentOf(buildReceiptView(source("mp-2283"), null));
    expect(view.checked.map((entry) => entry.by)).toEqual(expect.arrayContaining(["Tool", "AI, supported", "Human"]));
  });

  it("shows a receipt for an older diff as stale, with both hashes and no ledger or summary", () => {
    const view = documentOf(buildReceiptView(source("mp-2129"), null));
    expect(view.status).toBe("stale");
    expect(view.staleHashes?.signed).toHaveLength(64);
    expect(view.staleHashes?.current).toHaveLength(64);
    expect(view.staleHashes?.signed).not.toBe(view.staleHashes?.current);
    expect(view.ledger).toBeNull();
    expect(view.summary).toBeNull();
  });

  it("shows a receipt whose recorded check failed as unverified, even when the diff matches", () => {
    const signed = source("mp-2283");
    const record = ReceiptRecordSchema.parse(fixture("receipts/mp-2283.json"));
    const failed = { ...signed, receipt: { ...record, verify: { ...record.verify, ok: false } } };
    const view = documentOf(buildReceiptView(failed, null));
    expect(view.status).toBe("unverified");
    expect(view.verifyLine).toBe("The signature check failed when this receipt was exported.");
    expect(view.ledger).toBeNull();
  });

  it("offers the sign command when there is no receipt", () => {
    expect(buildReceiptView(source("mp-2234", null), null)).toEqual({
      kind: "none",
      changeId: "mp-2234",
      signCommand: "pnpm countersign sign mp-2234",
    });
  });

  it("carries the validation error of an unreadable receipt", () => {
    const view = buildReceiptView(source("mp-2283", "unreadable"), "data/receipts/mp-2283.json: owner: Required");
    expect(view).toEqual({ kind: "invalid", changeId: "mp-2283", error: "data/receipts/mp-2283.json: owner: Required" });
  });

  it("treats a receipt without a readable review as signed when its check passed, without claiming the diff is unchanged", () => {
    const withoutReview: InboxSource = { ...source("mp-2283"), review: { state: "missing" } };
    const view = documentOf(buildReceiptView(withoutReview, null));
    expect(view.status).toBe("signed");
    expect(view.verifyLine).toBe("Signature valid");
    expect(view.ledger).toBeNull();
    expect(view.residualRisk.accepted.every((entry) => entry.rule === null)).toBe(true);
  });
});

describe("hunk ledger", () => {
  const view = documentOf(buildReceiptView(source("mp-2283"), null));
  const ledger = view.ledger ?? [];
  const review = ReviewSchema.parse(fixture("runs/mp-2283/review.json"));

  it("lists every hunk of the signed diff", () => {
    expect(ledger).toHaveLength(review.hunks.length);
  });

  it("puts the hunks a person read first and names the signer on them only", () => {
    const readRows = ledger.filter((row) => row.coverage === "read");
    expect(ledger.slice(0, readRows.length)).toEqual(readRows);
    expect(readRows.every((row) => row.readBy === view.owner)).toBe(true);
    expect(ledger.filter((row) => row.coverage !== "read").every((row) => row.readBy === null)).toBe(true);
  });

  it("writes a location as file:first-last line of the new side", () => {
    const hunk = review.hunks[0];
    const row = ledger.find((entry) => entry.hunkId === hunk.id);
    expect(row?.location).toBe(`${hunk.file}:${hunk.newStart}–${hunk.newStart + hunk.newLines - 1}`);
  });
});

describe("accepted refusals", () => {
  it("resolves a refusal id to its rule id and title in the refusal policy", () => {
    const view = documentOf(buildReceiptView(source("mp-2283"), null));
    expect(view.residualRisk.accepted).toHaveLength(1);
    const [accepted] = view.residualRisk.accepted;
    expect(accepted.rule?.id).toMatch(/^R[1-7]$/);
    expect(accepted.rule?.title.length).toBeGreaterThan(0);
  });
});

describe("formatUtc", () => {
  it("formats without locale, converting an offset to UTC", () => {
    expect(formatUtc("2026-11-14T11:40:12+02:00")).toBe("2026-11-14 09:40 UTC");
  });
});
