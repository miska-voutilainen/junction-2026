// @vitest-environment node
import { describe, expect, it } from "vitest";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { buildSignView, isSignable, signActionLabel } from "./signModel";
import { buildStepTabs } from "./stepsModel";
import { loadFixtureReceipt, loadFixtureReview } from "./stepsModelFixtures";
describe("sign", () => {
  it("says the receipt file is unreadable instead of offering a draft", async () => {
    const review = await loadFixtureReview("mp-2234");
    expect(buildSignView(review, null, "unreadable").status).toBe("unreadable");
    expect(buildStepTabs(review, null, "unreadable")[3]).toMatchObject({
      count: "Unreadable",
      tone: "rose",
    });
  });

  it("shows the draft and the sign command for a change with no receipt", async () => {
    const review = await loadFixtureReview("mp-2234");
    const view = buildSignView(review, null, "needs-review");
    expect(view.status).toBe("needs-review");
    expect(view.commands.sign).toBe("pnpm countersign sign mp-2234");
  });

  it("shows the verified receipt for a signed change", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    const view = buildSignView(review, record, receiptStatus(review, record));
    expect(view.status).toBe("signed");
  });

  it("carries both hashes for a stale receipt", async () => {
    const review = await loadFixtureReview("mp-2129");
    const record = await loadFixtureReceipt("mp-2129");
    const view = buildSignView(review, record, receiptStatus(review, record));
    if (view.status !== "stale") throw new Error(`expected stale, got ${view.status}`);
    expect(view.receipt.diffSha256).not.toBe(view.reviewDiffSha256);
    expect(view.reviewDiffSha256).toBe(review.diff.diffSha256);
  });

  it("reports a failed signature check as unverified, ahead of the diff comparison", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    if (record === null) throw new Error("fixture receipt missing");
    const failed = { ...record, verify: { ...record.verify, ok: false } };
    expect(buildSignView(review, failed, receiptStatus(review, failed)).status).toBe("unverified");
  });
});

describe("sign action", () => {
  it("offers a Sign button only where there is something to sign", () => {
    expect(signActionLabel("needs-review")).toBe("Sign");
    expect(signActionLabel("stale")).toBe("Re-sign");
    expect(isSignable("signed")).toBe(false);
    expect(isSignable("unreadable")).toBe(false);
  });
});
