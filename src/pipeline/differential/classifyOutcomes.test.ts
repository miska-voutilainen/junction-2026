import { describe, expect, it } from "vitest";
import type { Review } from "../../contracts";
import { applyOutcomes, classifyVerdict, type TestOutcome } from "./classifyOutcomes";
import type { TestRun } from "./dotnetRunner";
import type { MethodResult } from "./testOutput";

type Claim = Review["claims"][number];

/** A run whose methods have the given results; the overall result follows them. */
function runOf(methods: Record<string, MethodResult>, output = "output"): TestRun {
  const results = Object.values(methods);
  const result = results.includes("fail") ? "fail" : results.includes("pass") ? "pass" : "error";
  return { result, methods, output };
}

const buildError = (output: string): TestRun => ({ result: "error", output });

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

function outcome(
  base: Record<string, MethodResult>,
  head: Record<string, MethodResult>,
  overrides: Partial<TestOutcome> = {},
): TestOutcome {
  return {
    source: "differential-test",
    requirementItemId: "F1",
    testNames: Object.keys(base),
    base: runOf(base, "base output"),
    head: runOf(head, "head output"),
    ...overrides,
  };
}

describe("classifyVerdict", () => {
  it.each([
    ["fail", "pass", "tells-apart"],
    ["pass", "pass", "same"],
    ["fail", "fail", "fails-on-both"],
    ["pass", "fail", "broken-on-head"],
    ["missing", "pass", "inconclusive"],
    ["fail", "missing", "inconclusive"],
  ] as const)("base %s and head %s is %s", (base, head, verdict) => {
    expect(classifyVerdict(base, head)).toBe(verdict);
  });
});

describe("applyOutcomes: A5 tests", () => {
  it("makes a supported claim Verified when the test fails on the base and passes on the head, with both outputs", () => {
    const { claims, counts } = applyOutcomes(
      [claim()],
      [outcome({ A5_F1_Counts: "fail" }, { A5_F1_Counts: "pass" })],
    );
    expect(claims[0].level).toBe("verified");
    expect(claims[0].evidence).toEqual([
      {
        kind: "differential-test",
        summary: "A5_F1_Counts fails on the base and passes on the head.",
        testName: "A5_F1_Counts",
        base: { result: "fail", output: "base output" },
        head: { result: "pass", output: "head output" },
      },
    ]);
    expect(counts["tells-apart"]).toBe(1);
  });

  it("names only the methods that told the versions apart and counts the rest", () => {
    const { claims } = applyOutcomes(
      [claim()],
      [
        outcome(
          { A5_F1_A: "fail", A5_F1_B: "pass", A5_F1_C: "pass", A5_F1_D: "fail" },
          { A5_F1_A: "pass", A5_F1_B: "pass", A5_F1_C: "pass", A5_F1_D: "fail" },
        ),
      ],
    );
    expect(claims[0].level).toBe("verified");
    expect(claims[0].evidence[0].summary).toBe(
      "A5_F1_A fails on the base and passes on the head; 2 more pass on both; 1 more fails on both.",
    );
  });

  it("uses plural verbs for several deciding methods", () => {
    const { claims } = applyOutcomes(
      [claim()],
      [outcome({ A5_F1_A: "fail", A5_F1_B: "fail" }, { A5_F1_A: "pass", A5_F1_B: "pass" })],
    );
    expect(claims[0].evidence[0].summary).toBe(
      "A5_F1_A, A5_F1_B fail on the base and pass on the head.",
    );
  });

  it("retracts when one method passes on the base and fails on the head, even next to a method that tells the versions apart", () => {
    const { claims, retractions } = applyOutcomes(
      [claim()],
      [outcome({ A5_F1_A: "fail", A5_F1_B: "pass" }, { A5_F1_A: "pass", A5_F1_B: "fail" })],
    );
    expect(claims[0].level).toBe("unverified");
    expect(retractions).toEqual([
      {
        claimId: "c1",
        reason:
          "A test written from the requirement passes on the base and fails on the head: A5_F1_B.",
        output: "head output",
      },
    ]);
  });

  it("gives two items in one call different verdicts", () => {
    const claims = [
      claim({ id: "c1", requirementItemId: "F1" }),
      claim({ id: "c2", requirementItemId: "F2" }),
      claim({ id: "c3", requirementItemId: "F3" }),
    ];
    const result = applyOutcomes(claims, [
      outcome({ A5_F1_A: "fail" }, { A5_F1_A: "pass" }),
      outcome({ A5_F2_A: "pass" }, { A5_F2_A: "fail" }, { requirementItemId: "F2" }),
    ]);
    expect(result.claims.map((c) => c.level)).toEqual(["verified", "unverified", "supported"]);
    expect(result.retractions.map((r) => r.claimId)).toEqual(["c2"]);
  });

  it("leaves claims of other items, non-behaviour claims and unverified claims at their level", () => {
    const claims = [
      claim({ id: "c1", requirementItemId: "F2" }),
      claim({ id: "c2", kind: "docs" }),
      claim({ id: "c3", level: "unverified" }),
      claim({ id: "c4", hunkIds: [] }),
    ];
    const result = applyOutcomes(claims, [outcome({ A5_F1_A: "fail" }, { A5_F1_A: "pass" })]);
    expect(result.claims.map((c) => c.level)).toEqual([
      "supported",
      "supported",
      "unverified",
      "supported",
    ]);
  });

  it("keeps a claim Supported when every method passes on both, and says the test does not tell the versions apart", () => {
    const { claims } = applyOutcomes(
      [claim()],
      [outcome({ A5_F1_A: "pass" }, { A5_F1_A: "pass" })],
    );
    expect(claims[0].level).toBe("supported");
    expect(claims[0].evidence[0].summary).toBe(
      "A5_F1_A passes on both; the test doesn't tell the versions apart.",
    );
  });

  it("says nothing when the tests fail on both versions: claim unchanged, nothing retracted, reason stored per method", () => {
    const original = claim();
    const { claims, retractions, inconclusiveTests, counts } = applyOutcomes(
      [original],
      [outcome({ A5_F1_A: "fail", A5_F1_B: "fail" }, { A5_F1_A: "fail", A5_F1_B: "fail" })],
    );
    expect(claims).toEqual([original]);
    expect(retractions).toEqual([]);
    expect(counts["fails-on-both"]).toBe(2);
    expect(inconclusiveTests).toEqual([
      {
        source: "differential-test",
        requirementItemId: "F1",
        testNames: ["A5_F1_A"],
        reason: "the test fails on both versions: it doesn't test the change",
      },
      {
        source: "differential-test",
        requirementItemId: "F1",
        testNames: ["A5_F1_B"],
        reason: "the test fails on both versions: it doesn't test the change",
      },
    ]);
  });

  it("stores the build error without the temp folder and the project suffix, and cuts a long line", () => {
    const line = `<worktree>\\tests\\X\\A5_F1.cs(3,9): error CS0246: The type 'Foo' was not found [<worktree>\\tests\\X\\X.csproj]`;
    const original = claim();
    const { claims, inconclusiveTests } = applyOutcomes(
      [original],
      [
        {
          ...outcome({ A5_F1_A: "pass" }, { A5_F1_A: "pass" }),
          base: buildError(`noise\n${line}\nmore`),
        },
      ],
    );
    expect(claims).toEqual([original]);
    expect(inconclusiveTests[0].reason).toBe(
      "build error on the base: tests\\tests\\X\\A5_F1.cs(3,9): error CS0246: The type 'Foo' was not found".replace(
        "tests\\tests",
        "tests",
      ),
    );
    const long = `<worktree>\\${"x".repeat(400)}.cs(1,1): error CS0001: bad [<worktree>\\X.csproj]`;
    const cut = applyOutcomes(
      [original],
      [
        {
          ...outcome({ A5_F1_A: "pass" }, { A5_F1_A: "pass" }),
          head: buildError(long),
        },
      ],
    );
    expect(cut.inconclusiveTests[0].reason.endsWith("…")).toBe(true);
  });

  it("reports a timeout, no matching test and a method the run never reported", () => {
    const pair = (head: TestRun, base: TestRun = runOf({ A5_F1_A: "pass" })) => ({
      ...outcome({ A5_F1_A: "pass" }, { A5_F1_A: "pass" }),
      base,
      head,
    });
    const reasons = applyOutcomes(
      [claim()],
      [
        pair(buildError("Timed out after 15 minutes.")),
        pair(buildError("No test matches the given testcase filter")),
        pair({ result: "pass", methods: { A5_F1_A: "missing" }, output: "" }),
      ],
    ).inconclusiveTests.map((test) => test.reason);
    expect(reasons).toEqual([
      "the run on the head timed out",
      "no test matches the filter on the head",
      "no result was reported for the test on the head",
    ]);
  });
});

describe("applyOutcomes: the PR's own tests", () => {
  const pr = (
    base: Record<string, MethodResult>,
    head: Record<string, MethodResult>,
  ): TestOutcome => outcome(base, head, { source: "pr-test", requirementItemId: null });

  it("never changes a level and names how many of the PR's tests told the versions apart", () => {
    const { claims } = applyOutcomes(
      [claim()],
      [
        pr(
          { A: "fail", B: "fail", C: "fail", D: "pass" },
          { A: "pass", B: "pass", C: "pass", D: "pass" },
        ),
      ],
    );
    expect(claims[0].level).toBe("supported");
    expect(claims[0].evidence[0]).toMatchObject({ kind: "pr-test" });
    expect(claims[0].evidence[0].summary).toBe(
      "3 of 4 PR tests fail on the base and pass on the head; 1 passes on both; the PR's own test: the same agent wrote the code and the test.",
    );
  });

  it("uses the singular for one PR test", () => {
    const { claims } = applyOutcomes([claim()], [pr({ A: "fail" }, { A: "pass" })]);
    expect(claims[0].evidence[0].summary).toBe(
      "1 of 1 PR test fails on the base and passes on the head; the PR's own test: the same agent wrote the code and the test.",
    );
  });

  it("does not retract on a PR test that breaks on the head, and does not undo a Verified claim", () => {
    const a5 = outcome({ A5_F1_A: "fail" }, { A5_F1_A: "pass" });
    const { claims, retractions } = applyOutcomes(
      [claim()],
      [pr({ A: "pass" }, { A: "fail" }), a5],
    );
    expect(claims[0].level).toBe("verified");
    expect(retractions).toEqual([]);
    expect(claims[0].evidence.map((e) => e.kind)).toEqual(["differential-test", "pr-test"]);
  });

  it("gives a claim an A5 test retracted no PR evidence", () => {
    const { claims } = applyOutcomes(
      [claim()],
      [pr({ A: "fail" }, { A: "pass" }), outcome({ A5_F1_A: "pass" }, { A5_F1_A: "fail" })],
    );
    expect(claims[0].level).toBe("unverified");
    expect(claims[0].evidence.map((e) => e.kind)).toEqual(["differential-test"]);
  });
});
