/**
 * Evidence levels from test results. A test earns a claim the top level only by
 * telling the versions apart: it fails on the base and passes on the head. The
 * author never checks its own work, so a test the PR itself wrote can confirm a
 * claim but never change its level; only the tests A5 wrote from the requirement,
 * without seeing the code, can make it Verified or retract it. Judged per test
 * method, because one run holds several methods and one broken method must not
 * hide behind its passing neighbours. Pure rules, no model, no .NET. Spec section 6, A5.
 */
import type { Review } from "../../contracts";
import { NO_DIFFERENCE_NOTE, PR_TEST_NOTE } from "../../policy/differentialTests";
import type { TestRun } from "./dotnetRunner";
import { buildErrorLine, type MethodResult } from "./testOutput";

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

/** What a pair of results says about the change. */
export type Verdict = "tells-apart" | "same" | "broken-on-head" | "fails-on-both" | "inconclusive";

/** A test that said nothing about the change, with the reason a reader can act on. */
export type InconclusiveTest = NonNullable<Review["inconclusiveTests"]>[number];

/** How many test methods ended each way, for the log. */
export type VerdictCounts = Record<Verdict, number>;

/** The claims after the tests, the retractions they caused and the tests that said nothing. */
export interface ClassifiedClaims {
  claims: Claim[];
  retractions: Review["retractions"];
  inconclusiveTests: InconclusiveTest[];
  counts: VerdictCounts;
}

/** One test method's verdict, with the reason when it says nothing. */
interface MethodVerdict {
  name: string;
  verdict: Verdict;
  reason: string | null;
}

/**
 * What one method's pair of results means. Only a test that passes on one
 * version and fails on the other says something. A test that fails on both
 * versions does not test the change (it asserts something neither version does),
 * and a missing result (build error, no matching test, timeout) is no verdict.
 *
 * @example classifyVerdict("fail", "pass") // "tells-apart"
 * @example classifyVerdict("pass", "fail") // "broken-on-head"
 */
export function classifyVerdict(base: MethodResult, head: MethodResult): Verdict {
  if (base === "missing" || head === "missing") return "inconclusive";
  if (base === "fail" && head === "fail") return "fails-on-both";
  if (head === "fail") return "broken-on-head";
  return base === "fail" ? "tells-apart" : "same";
}

/**
 * Applies every outcome to the claims it covers. A5's tests go first, so a claim
 * an A5 test retracts is no longer Supported and gets no evidence from the PR's
 * tests. The PR's tests never change a level.
 */
export function applyOutcomes(
  claims: readonly Claim[],
  outcomes: readonly TestOutcome[],
): ClassifiedClaims {
  const counts = emptyCounts();
  const retractions: Review["retractions"] = [];
  const inconclusiveTests: InconclusiveTest[] = [];
  let current = [...claims];
  const ordered = [...outcomes].sort(
    (a, b) => Number(a.source === "pr-test") - Number(b.source === "pr-test"),
  );
  for (const outcome of ordered) {
    const methods = methodVerdicts(outcome);
    for (const method of methods) {
      counts[method.verdict] += 1;
      if (method.reason !== null)
        inconclusiveTests.push({
          source: outcome.source,
          requirementItemId: outcome.requirementItemId,
          testNames: [method.name],
          reason: method.reason,
        });
    }
    const verdict = outcomeVerdict(methods);
    if (verdict === null) continue;
    current = current.map((claim) => {
      if (!isCovered(claim, outcome)) return claim;
      const updated = withEvidence(claim, outcome, verdict, methods);
      if (outcome.source === "pr-test") return updated;
      if (verdict === "broken-on-head") {
        const broken = methods.filter(({ verdict: v }) => v === "broken-on-head");
        retractions.push({
          claimId: claim.id,
          reason: `A test written from the requirement passes on the base and fails on the head: ${broken.map(({ name }) => name).join(", ")}.`,
          output: outcome.head.output,
        });
        return { ...updated, level: "unverified" };
      }
      return verdict === "tells-apart" && claim.level === "supported"
        ? { ...updated, level: "verified" }
        : updated;
    });
  }
  return { claims: current, retractions, inconclusiveTests, counts };
}

function emptyCounts(): VerdictCounts {
  return { "tells-apart": 0, same: 0, "broken-on-head": 0, "fails-on-both": 0, inconclusive: 0 };
}

/**
 * The outcome's verdict from its methods: a method that passes on the base and
 * fails on the head wins (the change broke what the requirement asks for), then
 * a method that tells the versions apart. All methods passing on both is "same".
 * Anything else gives no verdict (null) and the claims stay as they were.
 */
function outcomeVerdict(methods: readonly MethodVerdict[]): Verdict | null {
  if (methods.some(({ verdict }) => verdict === "broken-on-head")) return "broken-on-head";
  if (methods.some(({ verdict }) => verdict === "tells-apart")) return "tells-apart";
  if (methods.length > 0 && methods.every(({ verdict }) => verdict === "same")) return "same";
  return null;
}

function methodVerdicts(outcome: TestOutcome): MethodVerdict[] {
  return outcome.testNames.map((name) => {
    const base = methodResult(outcome.base, name);
    const head = methodResult(outcome.head, name);
    const verdict = classifyVerdict(base, head);
    return { name, verdict, reason: reasonFor(verdict, outcome, base) };
  });
}

/** A runner that reports no per-method results gives every method the run's result. */
function methodResult(run: TestRun, name: string): MethodResult {
  if (run.result === "error") return "missing";
  return run.methods?.[name] ?? (run.result === "pass" ? "pass" : "fail");
}

function reasonFor(verdict: Verdict, outcome: TestOutcome, base: MethodResult): string | null {
  if (verdict === "fails-on-both")
    return "the test fails on both versions: it doesn't test the change";
  if (verdict !== "inconclusive") return null;
  const side = base === "missing" ? "base" : "head";
  const run = side === "base" ? outcome.base : outcome.head;
  return run.result === "error"
    ? reasonForRunError(run.output, side)
    : `no result was reported for the test on the ${side}`;
}

/** Longest build error line kept in a reason: enough for the file, the code and the start of the message. */
const MAX_REASON_CHARS = 240;

/**
 * Why a run said nothing, in words for a reader: a timeout, no matching test, or
 * the first build error without the temp folder and the project suffix.
 */
function reasonForRunError(output: string, side: "base" | "head"): string {
  if (/Timed out after/.test(output)) return `the run on the ${side} timed out`;
  if (/No test matches the given testcase filter|No test is available/.test(output))
    return `no test matches the filter on the ${side}`;
  const line = buildErrorLine(output);
  if (line === null) return `no test result in the output on the ${side}`;
  const readable = line.replace(/^<worktree>[\\/]/, "").replace(/ \[[^\]]+\.csproj\]$/, "");
  const shown =
    readable.length > MAX_REASON_CHARS ? `${readable.slice(0, MAX_REASON_CHARS)}…` : readable;
  return `build error on the ${side}: ${shown}`;
}

/**
 * The claims a test speaks to: behaviour claims that cite hunks. An A5 test covers
 * those of its own requirement item. The PR's tests cover every item, but only
 * where the claim is Supported or Verified: a test cannot lift a claim whose quote did not match.
 */
function isCovered(claim: Claim, outcome: TestOutcome): boolean {
  if (claim.kind !== "behaviour" || claim.hunkIds.length === 0 || claim.requirementItemId === null)
    return false;
  if (outcome.source === "differential-test")
    return claim.requirementItemId === outcome.requirementItemId;
  return claim.level === "supported" || claim.level === "verified";
}

function withEvidence(
  claim: Claim,
  outcome: TestOutcome,
  verdict: Verdict,
  methods: readonly MethodVerdict[],
): Claim {
  const deciding = methods.filter((method) => method.verdict === verdict);
  const evidence: Evidence = {
    kind: outcome.source,
    summary: summaryFor(outcome, verdict, methods),
    testName: deciding.map(({ name }) => name).join(", "),
    ...resultsFor(verdict, outcome),
  };
  return { ...claim, evidence: [...claim.evidence, evidence] };
}

/** The evidence's base and head results follow the verdict, so "pass" on the head always means the deciding test passed there. */
function resultsFor(
  verdict: Verdict,
  { base, head }: TestOutcome,
): Pick<Evidence, "base" | "head"> {
  const results = {
    "tells-apart": ["fail", "pass"],
    "broken-on-head": ["pass", "fail"],
    same: ["pass", "pass"],
    "fails-on-both": ["fail", "fail"],
    inconclusive: ["error", "error"],
  } as const;
  const [baseResult, headResult] = results[verdict];
  return {
    base: { result: baseResult, output: base.output },
    head: { result: headResult, output: head.output },
  };
}

/** How a count of methods with one verdict reads: [one method, several methods]. */
const phrases: Record<Verdict, readonly [string, string]> = {
  "tells-apart": [
    "fails on the base and passes on the head",
    "fail on the base and pass on the head",
  ],
  "broken-on-head": [
    "passes on the base and fails on the head",
    "pass on the base and fail on the head",
  ],
  same: ["passes on both", "pass on both"],
  "fails-on-both": ["fails on both", "fail on both"],
  inconclusive: ["could not run", "could not run"],
};

const verdictOrder: readonly Verdict[] = [
  "broken-on-head",
  "tells-apart",
  "same",
  "fails-on-both",
  "inconclusive",
];

/**
 * One sentence for the evidence. It names the methods that decided the verdict
 * and counts the rest. A5: "A5_F1_X fails on the base and passes on the head; 2 more pass on both."
 * PR tests: "3 of 4 PR tests fail on the base and pass on the head; 1 passes on both; the PR's own test: ...".
 */
function summaryFor(
  outcome: TestOutcome,
  verdict: Verdict,
  methods: readonly MethodVerdict[],
): string {
  const deciding = methods.filter((method) => method.verdict === verdict);
  const isPrTest = outcome.source === "pr-test";
  const lead = isPrTest
    ? `${deciding.length} of ${methods.length} PR ${deciding.length === 1 ? "test" : "tests"} ${phrase(verdict, deciding.length)}`
    : `${deciding.map(({ name }) => name).join(", ")} ${phrase(verdict, deciding.length)}`;
  const others = verdictOrder
    .filter((other) => other !== verdict)
    .flatMap((other) => {
      const count = methods.filter((method) => method.verdict === other).length;
      if (count === 0) return [];
      return [
        isPrTest ? `${count} ${phrase(other, count)}` : `${count} more ${phrase(other, count)}`,
      ];
    });
  const notes = [
    ...(verdict === "same" ? [NO_DIFFERENCE_NOTE] : []),
    ...(isPrTest ? [PR_TEST_NOTE] : []),
  ];
  return `${[lead, ...others, ...notes].join("; ")}.`;
}

function phrase(verdict: Verdict, count: number): string {
  return phrases[verdict][count === 1 ? 0 : 1];
}
