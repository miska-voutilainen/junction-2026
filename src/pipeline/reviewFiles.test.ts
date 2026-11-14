import { describe, expect, it } from "vitest";
import { loadChangeAndRequirement, loadRecordedReview } from "./reviewFiles";

// The CLI passes its argument straight in, so these are what a typo or a
// hostile caller would send.
describe("reviewFiles path guard", () => {
  it.each(["../../.ssh/id_ed25519", "..", "mp-2283/../../x", "C:\\Windows\\win.ini", "mp 2283"])(
    "refuses the id %j before touching the disk",
    async (changeId) => {
      await expect(loadChangeAndRequirement(changeId)).rejects.toThrow(/is not a valid id/);
      await expect(loadRecordedReview(changeId)).rejects.toThrow(/is not a valid id/);
    },
  );

  it("still loads a real change and its requirement", async () => {
    const { change, requirement } = await loadChangeAndRequirement("mp-2283");
    expect(change.id).toBe("mp-2283");
    expect(requirement.id).toBe(change.requirementId);
  });
});
