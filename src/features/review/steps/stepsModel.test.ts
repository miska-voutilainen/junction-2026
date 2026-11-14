// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildStepTabs } from "./stepsModel";
import { loadFixtureReceipt, loadFixtureReview } from "./stepsModelFixtures";
describe("tabs", () => {
  it("counts what each step holds, and asks for attention on contradictions and a stale receipt", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    const tabs = buildStepTabs(review, record, "signed");
    expect(tabs.map((tab) => tab.label)).toEqual(["Read", "Blind check", "Refused", "Sign"]);
    expect(tabs.map((tab) => tab.count)).toEqual(["8 claims", "1 found", "1 open", "Signed"]);
    expect(tabs[1].tone).toBe("rose");

    const staleReview = await loadFixtureReview("mp-2129");
    expect(buildStepTabs(staleReview, await loadFixtureReceipt("mp-2129"), "stale")[3]).toMatchObject({ count: "Stale", tone: "amber" });
  });
});
