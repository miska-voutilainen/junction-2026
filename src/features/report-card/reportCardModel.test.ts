import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ReportCardSchema, ReviewSchema } from "@/contracts";
import {
  areaCardModel,
  areaCardModels,
  blindFirstSummary,
  failedQuotes,
  hallucinationLines,
  measuredLine,
  missedPlants,
  retractedClaims,
  unknownRuleRefusals,
} from "./reportCardModel";

const fixtureRoot = path.join(process.cwd(), "data", "fixtures");
const read = (relativePath: string): unknown => JSON.parse(readFileSync(path.join(fixtureRoot, relativePath), "utf8"));
const reportCard = ReportCardSchema.parse(read("eval/report-card.json"));
const review = ReviewSchema.parse(read("runs/mp-2283/review.json"));
const entry = (area: string) => reportCard.areas.find((candidate) => candidate.area === area);

describe("areaCardModel", () => {
  it("states the sample size in the headline and the spot-check gap as the next step", () => {
    const card = areaCardModel("generator", entry("generator"), 0);
    expect(card.level).toBe("calibrated");
    expect(card.headline).toBe("3 of 4 planted bugs caught · planted before the prompts");
    expect(card.nextStep).toBe("Trusted needs 5 clean spot checks: 0 recorded");
    expect(card.nextStepNote).toMatch(/no spot checks/);
    expect(card.effect).toMatch(/Focused at best/);
    expect(card.canRecordEscape).toBe(true);
    expect(card.escapeDrop).toBeNull();
  });

  it("says there is no track record when nothing was planted, and cannot record an escape", () => {
    const card = areaCardModel("performance", entry("performance"), 0);
    expect(card.level).toBe("shadow");
    expect(card.headline).toBe("No track record");
    expect(card.nextStep).toBe("Calibrated needs 3 planted bugs: 0 so far");
    expect(card.nextStepNote).toBeNull();
    expect(card.canRecordEscape).toBe(false);
  });

  it("asks for the catch rate once enough bugs are planted", () => {
    const card = areaCardModel("security", entry("security"), 0);
    expect(card.level).toBe("shadow");
    expect(card.nextStep).toBe("Calibrated needs 2 of 3 planted bugs caught: 1 so far");
  });

  it("drops one level per escape and names the drop", () => {
    const card = areaCardModel("generator", entry("generator"), 1);
    expect(card.level).toBe("shadow");
    expect(card.escapeDrop).toEqual({ from: "calibrated", to: "shadow" });
    expect(card.nextStep).toMatch(/^Earned Calibrated\. 1 simulated escape holds it at Shadow\. Undo the escape to restore it\.$/);
    expect(card.canRecordEscape).toBe(false);
  });

  it("shows no drop for an escape in an area already at Shadow, and plural wording for two", () => {
    expect(areaCardModel("security", entry("security"), 1).escapeDrop).toBeNull();
    expect(areaCardModel("generator", entry("generator"), 2).nextStep).toContain("2 simulated escapes hold it at Shadow. Undo the escapes");
  });

  it("drops the spot-check note once a clean spot check is recorded", () => {
    const withSpotCheck = { ...entry("generator")!, spotChecksClean: 2 };
    expect(areaCardModel("generator", withSpotCheck, 0).nextStepNote).toBeNull();
  });

  it("treats a missing report card as Shadow everywhere, in card order", () => {
    const cards = areaCardModels(null, {});
    expect(cards.map((card) => card.area)).toEqual(["generator", "analyzer", "security", "performance"]);
    expect(cards.every((card) => card.level === "shadow" && card.headline === "No track record")).toBe(true);
  });
});

describe("report card lists", () => {
  it("describes what the levels rest on", () => {
    expect(measuredLine(reportCard)).toBe("Reviewer rv1 · claude-opus-5-5 · measured on 10 planted bugs, planted before the prompts were written");
  });

  it("lists only the plants the reviewer missed, with their area and variant link", () => {
    const missed = missedPlants(reportCard);
    expect(missed.map((plant) => plant.plantId)).toEqual(["v07", "v09", "v05", "v10"]);
    expect(missed[0]).toMatchObject({ area: "generator", variantUrl: expect.stringContaining("/commit/") });
  });

  it("words the hallucination counts as the spec does", () => {
    expect(hallucinationLines(reportCard)).toEqual([
      "Quotes checked: 212 · failed the check: 9 (not posted)",
      "Claims retracted by a failing test: 3",
      "Findings dropped: 2",
    ]);
  });

  it("collects failed quotes and retractions from the recorded reviews with the claim text", () => {
    const reviews = [{ changeId: "mp-2283", review }];
    expect(failedQuotes(reviews)).toHaveLength(review.quoteCheck.failures.length);
    expect(failedQuotes(reviews)[0].location).toMatch(/\.cs:\d+(-\d+)?$/);
    const retracted = retractedClaims(reviews);
    expect(retracted).toHaveLength(review.retractions.length);
    expect(retracted[0].claimText).toBe(review.claims.find((claim) => claim.id === review.retractions[0].claimId)?.text);
  });

  it("lists refusals struck for an unknown rule id apart from failed quotes, matching the phrase in any case", () => {
    const [failure] = review.quoteCheck.failures;
    const synthetic = {
      ...review,
      quoteCheck: {
        ...review.quoteCheck,
        failures: [failure, { ...failure, itemId: "r3", reason: "Unknown rule ID R9: not in refusal policy 1" }],
      },
    };
    const reviews = [{ changeId: "mp-2283", review: synthetic }];
    expect(unknownRuleRefusals(reviews)).toEqual([{ changeId: "mp-2283", itemId: "r3" }]);
    expect(failedQuotes(reviews).map((quote) => quote.itemId)).toEqual([failure.itemId]);
  });

  it("finds no unknown-rule refusals in the recorded fixtures", () => {
    expect(unknownRuleRefusals([{ changeId: "mp-2283", review }])).toEqual([]);
  });

  it("summarises described-first against blind-first per plant", () => {
    const { overall, rows } = blindFirstSummary(reportCard);
    expect(overall).toContain("given the description first caught 4 of 15 · blind-first caught 12 of 15");
    expect(rows[0]).toMatchObject({ plantId: "cp0", describedFirst: "1 of 3", blindFirst: "3 of 3" });
  });
});
