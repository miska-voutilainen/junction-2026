/**
 * Evidence levels from test results. A test earns a claim the top level only by
 * telling the versions apart: it fails on the base and passes on the head. The
 * author never checks its own work, so a test the PR itself wrote can confirm a
 * claim but never lift it past Supported; only the test A5 wrote from the
 * requirement, without seeing the code, can make it Verified. Pure rules, no
 * model, no .NET. Spec section 6, A5.
 */
import type { Review } from "../../contracts";
import { NO_DIFFERENCE_NOTE, PR_TEST_NOTE } from "../../policy/differentialTests";
import type { TestRun } from "./dotnetRunner";

type Claim = Review["claims"][number];
type Evidence = Claim["evidence"][number];

/** The two runs of one test source on one change. */
export interface TestOutcome {
  source: "differential-test" | "pr-test";
  /** The requirement item an A5 test was written for; null for the PR's own tests, which cover the change as a whole. */
  requirementItemId: string | null;
  testNames: string[];
  base: TestRun;
  head: TestRun;
}

/** What a pair of runs says about the change. */
export type Verdict = "tells-apart" | "same" | "broken-on-head" | "fails-on-both" | "inconclusive";

/** A pair of runs that says nothing about the change, with the reason a reader can act on. */
export type InconclusiveTest = NonNullable<Review["inconclusiveTests"]>[number];

/** How many outcomes ended each way, for the log. */
export type VerdictCounts = Record<Verdict, number>;

/** The claims after the tests, the retractions they caused and the verdict counts. */
export interface ClassifiedClaims {
  claims: Claim[];
  retractions: Review["retractions"];
  /** The tests that could not say anything, also stored in the review. */
  inconclusiveTests: InconclusiveTest[];
  counts: VerdictCounts;
}

/**
 * What a pair of runs means. Only a test that passes on one version and fails on
 * the other says something. A test that fails on both versions does not test the
 * change (it asserts something neither version does), and an "error" on either
 * side (build error, no matching test, timeout) is no verdict: the claim stays
 * as it was.
 *
 * @example classifyVerdict({ result: "fail", ... }, { result: "pass", ... }) // "tells-apart"
 * @example classifyVerdict({ result: "pass", ... }, { result: "fail", ... }) // "broken-on-head"
 */
export function classifyVerdict(base: TestRun, head: TestRun): Verdict {
  if (base.result === "error" || head.result === "error") return "inconclusive";
  if (base.result === "fail" && head.result === "fail") return "fails-on-both";
  if (head.result === "fail") return "broken-on-head";
  return base.result === "fail" ? "tells-apart" : "same";
}

/**
 * Why a pair of runs could not say anything, in words for a reader: the side
 * and the first build error line, or that nothing matched or the run timed out.
 */
export function inconclusiveReason(base: TestRun, head: TestRun): string {
  if (base.result === "fail" && head.result === "fail")
    return "the test fails on both versions: it doesn't test the change";
  const side = base.result === "error" ? "base" : "head";
  const output = (side === "base" ? base : head).output;
  if (/Timed out after/.test(output)) return `the run on the ${side} timed out`;
  if (/No test matches the given testcase filter|No test is available/.test(output))
    return `no test matches the filter on the ${side}`;
  const buildError = output.split("\n").find((line) => /error (CS|MSB|NU|NETSDK)\d+/.test(line));
  if (buildError !== undefined)
    return `build error on the ${side}: ${buildError.trim().slice(0, MAX_REASON_CHARS)}`;
  return `no test result in the output on the ${side}`;
}

/** Longest build error line kept in a reason: enough for the file, code and message start. */
const MAX_REASON_CHARS = 240;

/** Applies every outcome to the claims it covers, A5's tests first so a PR test never undoes them. */
export function applyOutcomes(
  claims: readonly Claim[],
  outcomes: readonly TestOutcome[],
): ClassifiedClaims {
  const counts: VerdictCounts = {
    "tells-apart": 0,
    same: 0,
    "broken-on-head": 0,
    "fails-on-both": 0,
    inconclusive: 0,
  };
  const inconclusiveTests: InconclusiveTest[] = [];
  const retractions: Review["retractions"] = [];
  let current = [...claims];
  const ordered = [...outcomes].sort(
    (a, b) => Number(a.source === "pr-test") - Number(b.source === "pr-test"),
  );
  for (const outcome of ordered) {
    const verdict = classifyVerdict(outcome.base, outcome.head);
    counts[verdict] += 1;
    if (verdict === "inconclusive" || verdict === "fails-on-both") {
      inconclusiveTests.push({
        source: outcome.source,
        requirementItemId: outcome.requirementItemId,
        testNames: outcome.testNames,
        reason: inconclusiveReason(outcome.base, outcome.head),
      });
      continue;
    }
    current = current.map((claim) => {
      if (!isCovered(claim, outcome)) return claim;
      const updated = withEvidence(claim, outcome, verdict);
      if (verdict === "broken-on-head" && outcome.source === "differential-test") {
        retractions.push({
          claimId: claim.id,
          reason: `A test written from the requirement passes on the base and fails on the head: ${outcome.testNames.join(", ")}.`,
          output: outcome.head.output,
        });
        return { ...updated, level: "unverified" };
      }
      return verdict === "tells-apart" &&
        outcome.source === "differential-test" &&
        claim.level === "supported"
        ? { ...updated, level: "verified" }
        : updated;
    });
  }
  return { claims: current, retractions, inconclusiveTests, counts };
}

/**
 * The claims a test speaks to: behaviour claims that cite hunks. An A5 test covers
 * those of its own requirement item. The PR's tests cover every item, but only
 * where the claim is Supported: a test cannot lift a claim whose quote did not match.
 */
function isCovered(claim: Claim, outcome: TestOutcome): boolean {
  if (claim.kind !== "behaviour" || claim.hunkIds.length === 0 || claim.requirementItemId === null)
    return false;
  if (outcome.source === "differential-test")
    return claim.requirementItemId === outcome.requirementItemId;
  return claim.level === "supported" || claim.level === "verified";
}

function withEvidence(claim: Claim, outcome: TestOutcome, verdict: Verdict): Claim {
  const evidence: Evidence = {
    kind: outcome.source,
    summary: summaryFor(outcome, verdict),
    testName: outcome.testNames.join(", "),
    base: outcome.base,
    head: outcome.head,
  };
  return { ...claim, evidence: [...claim.evidence, evidence] };
}

function summaryFor(outcome: TestOutcome, verdict: Verdict): string {
  const names = outcome.testNames.join(", ");
  const note = outcome.source === "pr-test" ? PR_TEST_NOTE : null;
  const sentence = {
    "tells-apart": `${names} fails on the base and passes on the head`,
    same: `${names} passes on the base and on the head: ${NO_DIFFERENCE_NOTE}`,
    "broken-on-head": `${names} passes on the base and fails on the head`,
    "fails-on-both": "",
    inconclusive: "",
  }[verdict];
  return note === null ? `${sentence}.` : `${sentence}; ${note}.`;
}
