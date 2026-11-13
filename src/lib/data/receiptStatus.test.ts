import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReceiptRecordSchema, ReviewSchema } from "@/contracts";
import { receiptStatus } from "./receiptStatus";

const fixture = (relativePath: string): unknown =>
  JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", relativePath), "utf8"));

const review = ReviewSchema.parse(fixture("runs/mp-2283/review.json"));
const record = ReceiptRecordSchema.parse(fixture("receipts/mp-2283.json"));

describe("receiptStatus", () => {
  it("is needs-review when no receipt exists", () => {
    expect(receiptStatus(review, null)).toBe("needs-review");
  });

  it("is signed when the receipt covers the review's diff", () => {
    expect(receiptStatus(review, record)).toBe("signed");
  });

  it("is stale when the diff changed after signing", () => {
    const amended = { ...review, diff: { ...review.diff, diffSha256: "0".repeat(64) } };
    expect(receiptStatus(amended, record)).toBe("stale");
  });
});
