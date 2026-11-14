/**
 * Planted-bug calibration: bugs are written blind with an answer key, and a
 * review "catches" one when a defect or missing finding sits in the planted area and cites
 * the planted lines. The catch rate per area sets the trust ladder's starting
 * level. Spec section 6 (Planted-bug eval) and 9.1 (T16).
 */
import type { AnswerKey, Review } from "@/contracts";

type Finding = Review["findings"][number];

/**
 * Lines of slack around the planted range. The model cites the line where it
 * noticed the bug, often a few lines from the range the plant's author marked;
 * demanding an exact overlap would score those as misses.
 */
export const PLANT_LINE_TOLERANCE = 3;

const BUG_KINDS: ReadonlyArray<Finding["kind"]> = ["defect", "missing"];

/**
 * True when a defect or missing finding is in the key's area and cites the
 * planted lines (new side, same file, within the tolerance). Contradiction keys
 * and keys without an area, file or lines never match.
 */
export function isPlantedBugMatch(finding: Finding, key: AnswerKey): boolean {
  if (key.kind !== "planted-bug") return false;
  if (!BUG_KINDS.includes(finding.kind)) return false;
  if (finding.area === null || finding.area !== key.area) return false;
  const { file, startLine, endLine } = key;
  if (file === null || startLine === null || endLine === null) return false;

  const from = startLine - PLANT_LINE_TOLERANCE;
  const to = endLine + PLANT_LINE_TOLERANCE;
  return finding.citations.some(
    (citation) =>
      citation.side === "new" &&
      citation.file === file &&
      citation.startLine <= to &&
      citation.endLine >= from,
  );
}

/** The first matching finding in output order; its id becomes the report card's findingId. */
export function findPlantedBugMatch(findings: readonly Finding[], key: AnswerKey): Finding | null {
  return findings.find((finding) => isPlantedBugMatch(finding, key)) ?? null;
}

/**
 * Counts the run's defect and missing findings and how many of them hit the
 * plant; the rest are candidates for false positives. Each planted-bug variant
 * carries exactly one plant, so a run is scored against its one key; the report
 * card's `findingsOnPlants` is the sum over runs.
 */
export function countFindingsOnPlants(
  findings: readonly Finding[],
  key: AnswerKey,
): { total: number; matchedPlant: number } {
  const bugFindings = findings.filter((finding) => BUG_KINDS.includes(finding.kind));
  const matchedPlant = bugFindings.filter((finding) => isPlantedBugMatch(finding, key)).length;
  return { total: bugFindings.length, matchedPlant };
}
