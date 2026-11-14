// @vitest-environment node
import { describe, expect, it } from "vitest";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { buildRefusals } from "./refusalsModel";
import { buildStepTabs } from "./stepsModel";
import { loadFixtureReceipt, loadFixtureReview } from "./stepsModelFixtures";
describe("refusals", () => {
  it("names each rule and its decider from the policy", async () => {
    const review = await loadFixtureReview("mp-2283");
    const { items } = buildRefusals(review, null, "needs-review");
    expect(items.map((item) => item.ruleId)).toEqual(["R6", "R7"]);
    expect(items[0].decider).toBe("change owner");
    expect(items[0].locations[0].label).toMatch(/:\d+/);
  });

  it("marks a refusal accepted only when a valid, current receipt accepts it", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    expect(receiptStatus(review, record)).toBe("signed");
    const accepted = buildRefusals(review, record, "signed").items.map((item) => item.acceptedBy);
    expect(accepted).toEqual([null, record?.receipt.owner]);

    // The same receipt on a changed diff vouches for nothing.
    const stale = buildRefusals(review, record, "stale").items.map((item) => item.acceptedBy);
    expect(stale).toEqual([null, null]);
  });

  it("keeps a refusal open when the receipt was signed against another run", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    if (record === null) throw new Error("fixture receipt missing");
    const otherRun = {
      ...record,
      receipt: { ...record.receipt, reviewRunId: "run-from-another-day" },
    };
    expect(buildRefusals(review, otherRun, "signed").items.map((item) => item.acceptedBy)).toEqual([
      null,
      null,
    ]);
    expect(buildStepTabs(review, otherRun, "signed")[2].count).toBe("2 open");
  });

  it("tells a fixed-rule refusal from one the AI raised", async () => {
    const { items } = buildRefusals(await loadFixtureReview("mp-2129"), null, "needs-review");
    expect(items.map((item) => [item.id, item.source])).toEqual([
      ["r1", "rule"],
      ["r2", "ai"],
    ]);
  });

  it("has no items when nothing was refused", async () => {
    expect(buildRefusals(await loadFixtureReview("mp-2234"), null, "needs-review").items).toEqual(
      [],
    );
  });
});
