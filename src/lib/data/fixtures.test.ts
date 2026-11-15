import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  ChangeInputSchema,
  ReceiptRecordSchema,
  ReportCardSchema,
  RequirementSchema,
  ReviewSchema,
} from "@/contracts";
import { receiptStatus } from "./receiptStatus";

const fixtureRoot = path.join(process.cwd(), "data", "fixtures");
const tietoIds = ["mp-2283", "mp-2234", "mp-2129", "mp-2297"];

const schemaByPath: [RegExp, z.ZodType][] = [
  [/^sample\/changes\//, ChangeInputSchema],
  [/^sample\/requirements\//, RequirementSchema],
  [/^runs\/[^/]+\/review\.json$/, ReviewSchema],
  [/^eval\/report-card\.json$/, ReportCardSchema],
  [/^receipts\//, ReceiptRecordSchema],
];

const fixtureFiles = (readdirSync(fixtureRoot, { recursive: true }) as string[])
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".json"));

const readFixture = (relativePath: string): unknown =>
  JSON.parse(readFileSync(path.join(fixtureRoot, relativePath), "utf8"));

const reviewOf = (id: string) => ReviewSchema.parse(readFixture(`runs/${id}/review.json`));

describe("fixtures", () => {
  it("include the four Tieto changes with a review each, and the report card", () => {
    for (const id of tietoIds) {
      expect(fixtureFiles).toContain(`sample/changes/${id}.json`);
      expect(fixtureFiles).toContain(`runs/${id}/review.json`);
    }
    expect(fixtureFiles).toContain("eval/report-card.json");
  });

  it.each(fixtureFiles)("%s validates against its schema", (file) => {
    const entry = schemaByPath.find(([pattern]) => pattern.test(file));
    expect(entry, `no schema is mapped to ${file}`).toBeDefined();
    const result = entry?.[1].safeParse(readFixture(file));
    expect(result?.success, result?.success ? "" : result?.error.message).toBe(true);
  });

  it("give every hunk exactly one coverage state", () => {
    for (const id of tietoIds) {
      const review = reviewOf(id);
      const hunkIds = review.hunks.map((hunk) => hunk.id);
      expect(new Set(hunkIds).size).toBe(hunkIds.length);
      expect(Object.keys(review.routing.coverage).sort()).toEqual([...hunkIds].sort());
      expect(review.routing.totalHunks).toBe(hunkIds.length);
    }
  });

  it("route mp-2283 Focused with 8 hunks of which at least 2 are read, and mp-2129 Full", () => {
    const review = reviewOf("mp-2283");
    expect(review.routing.tier).toBe("focused");
    expect(review.routing.totalHunks).toBe(8);
    expect(review.routing.readHunks).toBeGreaterThanOrEqual(2);
    expect(reviewOf("mp-2129").routing.tier).toBe("full");
    expect(reviewOf("mp-2234").routing.tier).toBe("focused");
    expect(reviewOf("mp-2297").routing.tier).toBe("focused");
  });

  it("make the report card's routing spread match the four reviews", () => {
    const card = ReportCardSchema.parse(readFixture("eval/report-card.json"));
    const routings = tietoIds.map((id) => reviewOf(id).routing);
    const total = (pick: (r: (typeof routings)[number]) => number) =>
      routings.reduce((sum, r) => sum + pick(r), 0);
    expect(card.routingSpread.focused).toBe(routings.filter((r) => r.tier === "focused").length);
    expect(card.routingSpread.full).toBe(routings.filter((r) => r.tier === "full").length);
    expect(card.routingSpread.readHunks).toBe(total((r) => r.readHunks));
    expect(card.routingSpread.totalHunks).toBe(total((r) => r.totalHunks));
  });

  it("have a signed receipt for mp-2283, a stale one for mp-2129 and none for the others", () => {
    const status = (id: string) => {
      const file = `receipts/${id}.json`;
      const record = fixtureFiles.includes(file)
        ? ReceiptRecordSchema.parse(readFixture(file))
        : null;
      return receiptStatus(reviewOf(id), record);
    };
    expect(status("mp-2283")).toBe("signed");
    expect(status("mp-2129")).toBe("stale");
    expect(status("mp-2234")).toBe("needs-review");
    expect(status("mp-2297")).toBe("needs-review");
  });

  it("show every finding kind, refusals, a retraction and base-fail/head-pass evidence for mp-2283", () => {
    const review = reviewOf("mp-2283");
    const kinds = new Set(review.findings.map((finding) => finding.kind));
    expect(kinds).toEqual(new Set(["defect", "contradiction", "missing", "scope-creep"]));
    expect(
      review.findings.find((finding) => finding.kind === "contradiction")?.statement,
    ).toBeTruthy();
    expect(review.refusals.length).toBeGreaterThanOrEqual(2);
    expect(review.retractions).toHaveLength(1);
    const evidence = review.claims.find((claim) => claim.level === "verified")?.evidence[0];
    expect(evidence?.base?.result).toBe("fail");
    expect(evidence?.head?.result).toBe("pass");
  });

  it("include a generated file in mp-2297", () => {
    expect(reviewOf("mp-2297").files.some((file) => file.kind === "generated")).toBe(true);
  });
});
