/**
 * Planted-bug calibration, measured: scores recorded runs against the answer
 * keys and returns the report card. A planted-bug run is caught when a finding
 * sits in the plant's area on its lines; a plant counts as caught when a strict
 * majority of its runs caught it (2 of 3), because one run flips on security
 * plants and the ladder's per-plant meaning ("caught") should not depend on luck.
 * The card also keeps each plant's `caughtRuns` of `runs`. A contradiction run is caught when A4
 * flags the planted false sentence. Catch rates per area set the trust ladder's
 * levels, and the blind-versus-anchored count says whether reading the code
 * before the description buys anything. Pure: files and models are the caller's
 * job. Spec section 5 (ReportCard) and 9.1 (T16).
 */
import { MODEL } from "../../ai/limits";
import {
  AreaSchema,
  type AnswerKey,
  type Area,
  type ChangeInput,
  type ReportCard,
  type Review,
} from "../../contracts";
import { ladderLevel } from "../../rules/ladder";
import { reviewerVersion } from "../assembleReview";
import { findContradictionMatch } from "./matchContradiction";
import { countFindingsOnPlants, findPlantedBugMatch } from "./matchPlantedBug";

/**
 * One planted-bug variant: its key, its change input (for the commit link) and
 * its blind runs. Index k-1 holds run k; null is a run that failed or was never
 * made, which counts as not caught. The array length is the runs planned.
 */
export interface PlantedBugRun {
  key: AnswerKey;
  change: ChangeInput;
  reviews: ReadonlyArray<Review | null>;
}

/**
 * One contradiction plant with its runs. Index k-1 holds run k; null is a run
 * that failed or was never made, which counts as not caught.
 */
export interface ContradictionRuns {
  key: AnswerKey;
  anchored: ReadonlyArray<Review | null>;
  blind: ReadonlyArray<Review | null>;
}

/** Everything the report card is computed from. */
export interface EvalInput {
  plantedBugs: readonly PlantedBugRun[];
  contradictions: readonly ContradictionRuns[];
  /** Runs per mode and plant: the measured n, so the count reads "of 10" after two runs and "of 15" after three. */
  runsPerMode: number;
  /** Reviews counted for hallucinations only, e.g. the four Tieto reviews. */
  otherReviews: readonly Review[];
  now: Date;
}

/**
 * The report card for these runs.
 * The routing spread is added by the caller, after the Tieto reviews are routed again.
 * @throws "mixed reviewer versions: rerun all" when the runs come from different reviewer versions.
 */
export function scoreReportCard(input: EvalInput): Omit<ReportCard, "routingSpread"> {
  const runs = [
    ...input.plantedBugs.flatMap((plant) => plant.reviews),
    ...input.contradictions.flatMap((plant) => [...plant.anchored, ...plant.blind]),
  ].filter((review): review is Review => review !== null);

  return {
    schemaVersion: 1,
    generatedAt: input.now.toISOString(),
    reviewer: reviewerOf(runs),
    areas: AreaSchema.options.map((area) => scoreArea(area, input.plantedBugs)),
    anchoredVsBlind: scoreAnchoredVsBlind(input.contradictions, input.runsPerMode),
    hallucinations: countHallucinations([...runs, ...input.otherReviews]),
    findingsOnPlants: sumFindingsOnPlants(input.plantedBugs),
  };
}

function reviewerOf(runs: readonly Review[]): ReportCard["reviewer"] {
  const reviewers = new Map(
    runs.map((run) => [`${run.reviewer.version} ${run.reviewer.model}`, run.reviewer]),
  );
  if (reviewers.size > 1) throw new Error("mixed reviewer versions: rerun all");
  const [only] = reviewers.values();
  return { version: only?.version ?? reviewerVersion, model: only?.model ?? MODEL };
}

/** An area with no plants (performance) still gets a row: Shadow, since nothing measures it. */
function scoreArea(area: Area, plantedBugs: readonly PlantedBugRun[]): ReportCard["areas"][number] {
  const plants = plantedBugs
    .filter((plant) => plant.key.area === area)
    .map(({ key, change, reviews }) => {
      const matches = reviews.map((review) => (review ? findPlantedBugMatch(review.findings, key) : null));
      const caughtRuns = matches.filter((match) => match !== null).length;
      // Strict majority: 2 of 3 caught, 1 of 3 not; a tie (1 of 2) is not caught.
      const isCaught = caughtRuns * 2 > reviews.length;
      return {
        plantId: key.plantId,
        changeId: key.changeId,
        caught: isCaught,
        runs: reviews.length,
        caughtRuns,
        findingId: matches.find((match) => match !== null)?.id ?? null,
        defect: key.defect,
        variantUrl: `https://github.com/${change.repo}/commit/${change.headSha}`,
      };
    });
  const caught = plants.filter((plant) => plant.caught).length;
  // Spot checks are a person's work and never run in the eval; the simulated escape shows their effect.
  const spotChecksClean = 0;
  const level = ladderLevel({ planted: plants.length, caught, spotChecksClean });
  return { area, planted: plants.length, caught, spotChecksClean, level, plants };
}

function scoreAnchoredVsBlind(
  contradictions: readonly ContradictionRuns[],
  runsPerMode: number,
): ReportCard["anchoredVsBlind"] {
  const caughtIn = (key: AnswerKey, runs: ContradictionRuns["anchored"]) =>
    runs.filter((run) => run !== null && findContradictionMatch(run.findings, key) !== null).length;
  const perPlant = contradictions.map(({ key, anchored, blind }) => ({
    plantId: key.plantId,
    changeId: key.changeId,
    statement: key.defect,
    anchoredCaught: caughtIn(key, anchored),
    blindCaught: caughtIn(key, blind),
    runs: runsPerMode,
  }));
  const total = contradictions.length * runsPerMode;
  const sum = (pick: (plant: (typeof perPlant)[number]) => number) =>
    perPlant.reduce((count, plant) => count + pick(plant), 0);
  return {
    plants: contradictions.length,
    runsPerMode,
    anchored: { caught: sum((plant) => plant.anchoredCaught), total },
    blind: { caught: sum((plant) => plant.blindCaught), total },
    perPlant,
  };
}

/**
 * Sums over every review read, so the A1/A2 claims that blind runs of one
 * Tieto change share (same recording) are counted once per run: the total is
 * "quote checks run", not distinct quotes.
 */
function countHallucinations(reviews: readonly Review[]): ReportCard["hallucinations"] {
  const sum = (count: (review: Review) => number) =>
    reviews.reduce((total, review) => total + count(review), 0);
  return {
    quotesChecked: sum((review) => review.quoteCheck.checked),
    quoteFailures: sum((review) => review.quoteCheck.failures.length),
    claimsRetracted: sum((review) => review.retractions.length),
    findingsDropped: sum((review) => review.quoteCheck.dropped),
  };
}

function sumFindingsOnPlants(
  plantedBugs: readonly PlantedBugRun[],
): ReportCard["findingsOnPlants"] {
  let total = 0;
  let matchedPlant = 0;
  for (const { key, reviews } of plantedBugs) {
    for (const review of reviews) {
      if (!review) continue;
      const counts = countFindingsOnPlants(review.findings, key);
      total += counts.total;
      matchedPlant += counts.matchedPlant;
    }
  }
  return { total, matchedPlant };
}

/**
 * The go/no-go line for the lessons log: whether blind-first earned its place.
 * "No advantage" means blind caught no more than anchored (spec 9.1, T16).
 */
export function anchoredVsBlindVerdict(counts: ReportCard["anchoredVsBlind"]): {
  hasAdvantage: boolean;
  line: string;
} {
  const { anchored, blind, plants, runsPerMode } = counts;
  const hasAdvantage = blind.caught > anchored.caught;
  const measured = `Blind-first caught ${blind.caught} of ${blind.total}, anchored ${anchored.caught} of ${anchored.total} (${plants} plants, ${runsPerMode} runs per mode).`;
  const verdict = hasAdvantage
    ? "Go: blind-first shows an advantage."
    : "No-go: no advantage for blind-first, so the pitch drops the claim.";
  return { hasAdvantage, line: `${verdict} ${measured}` };
}
