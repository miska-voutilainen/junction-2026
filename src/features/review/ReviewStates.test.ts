// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decideChange } from "@/features/inbox";
import { loadReview } from "@/lib/data/loaders";
import { evidenceAlert } from "./ReviewStates";

describe("evidenceAlert", () => {
  it("words the alert for a missing and an unreadable card", async () => {
    const review = await loadReview("mp-2283", "data/fixtures");
    if (review.status !== "ok") throw new Error("fixture mp-2283 did not load");
    const { decision } = decideChange(review.data, { state: "missing" }, {});
    expect(evidenceAlert("missing", decision)).toEqual({
      title: "No report card yet",
      verb: "Run",
      command: "pnpm evals",
      consequence: "Until then nothing counts as covered, so this change is Full: read 8 of 8 hunks.",
    });
    expect(evidenceAlert("unreadable", decision)).toMatchObject({ title: "Couldn't read the report card", verb: "Re-run" });
  });
});
