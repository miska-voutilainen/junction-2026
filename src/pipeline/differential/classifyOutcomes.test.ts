import { describe, expect, it } from "vitest";
import type { Review } from "../../contracts";
import { applyOutcomes, classifyVerdict, type TestOutcome } from "./classifyOutcomes";
import type { TestRun } from "./dotnetRunner";

type Claim = Review["claims"][number];

const run = (result: TestRun["result"], output = `${result} output`): TestRun => ({
  result,
  output,
});

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "c1",
    requirementItemId: "F1",
    text: "It counts.",
    kind: "behaviour",
    level: "supported",
    hunkIds: ["h1"],
    citations: [],
    evidence: [],
    ...overrides,
  };
}

function outcome(overrides: Partial<TestOutcome>): TestOutcome {
  return {
    source: "differential-test",
    requirementItemId: "F1",
    testNames: ["A5_F1_Counts"],
    base: run("fail"),
    head: run("pass"),
    ...overrides,
  };
}

describe("classifyVerdict", () => {
  it.each([
    ["fail", "pass", "tells-apart"],
    ["pass", "pass", "same"],
    ["fail", "fail", "broken-on-head"],
    ["pass", "fail", "broken-on-head"],
    ["error", "pass", "inconclusive"],
    ["fail", "error", "inconclusive"],
  ] as const)("base %s and head %s is %s", (base, head, verdict) => {
    expect(classifyVerdict(run(base), run(head))).toBe(verdict);
  });
});

describe("applyOutcomes", () => {
  it("makes a supported claim Verified when the A5 test fails on the base and passes on the head, with both outputs", () => {
    const { claims, counts } = applyOutcomes([claim()], [outcome({})]);
    expect(claims[0].level).toBe("verified");
    expect(claims[0].evidence).toEqual([
      {
        kind: "differential-test",
        summary: "A5_F1_Counts fails on the base and passes on the head.",
        testName: "A5_F1_Counts",
        base: run("fail"),
        head: run("pass"),
      },
    ]);
    expect(counts["tells-apart"]).toBe(1);
  });

  it("leaves claims of other requirement items, non-behaviour claims and unverified claims at their level", () => {
    const claims = [
      claim({ id: "c1", requirementItemId: "F2" }),
      claim({ id: "c2", kind: "docs" }),
      claim({ id: "c3", level: "unverified" }),
      claim({ id: "c4", hunkIds: [] }),
    ];
    expect(applyOutcomes(claims, [outcome({})]).claims.map((c) => c.level)).toEqual([
      "supported",
      "supported",
      "unverified",
      "supported",
    ]);
  });

  it("keeps a claim Supported when the test passes on both, and says the test does not tell the versions apart", () => {
    const { claims } = applyOutcomes([claim()], [outcome({ base: run("pass") })]);
    expect(claims[0].level).toBe("supported");
    expect(claims[0].evidence[0].summary).toContain("the test doesn't tell the versions apart");
  });

  it("retracts the claim when the A5 test fails on the head, with the head output", () => {
    const { claims, retractions } = applyOutcomes(
      [claim()],
      [outcome({ head: run("fail", "Assert.Equal failed") })],
    );
    expect(claims[0].level).toBe("unverified");
    expect(retractions).toEqual([
      {
        claimId: "c1",
        reason: "A test written from the requirement fails on the head: A5_F1_Counts.",
        output: "Assert.Equal failed",
      },
    ]);
  });

  it("changes nothing when a side could not run", () => {
    const original = claim();
    const { claims, retractions, counts } = applyOutcomes(
      [original],
      [outcome({ base: run("error", "error CS0246") })],
    );
    expect(claims).toEqual([original]);
    expect(retractions).toEqual([]);
    expect(counts.inconclusive).toBe(1);
  });

  it("never lifts a claim past Supported on the PR's own test, and notes who wrote it", () => {
    const pr = outcome({ source: "pr-test", requirementItemId: null, testNames: ["Counts"] });
    const { claims } = applyOutcomes([claim()], [pr]);
    expect(claims[0].level).toBe("supported");
    expect(claims[0].evidence[0]).toMatchObject({ kind: "pr-test" });
    expect(claims[0].evidence[0].summary).toContain(
      "the PR's own test: the same agent wrote the code and the test",
    );
  });

  it("does not retract on a PR test that fails on the head, and does not undo a Verified claim", () => {
    const a5 = outcome({});
    const pr = outcome({
      source: "pr-test",
      requirementItemId: null,
      testNames: ["Counts"],
      head: run("fail"),
    });
    const { claims, retractions } = applyOutcomes([claim()], [pr, a5]);
    expect(claims[0].level).toBe("verified");
    expect(retractions).toEqual([]);
    expect(claims[0].evidence.map((e) => e.kind)).toEqual(["differential-test", "pr-test"]);
  });
});
