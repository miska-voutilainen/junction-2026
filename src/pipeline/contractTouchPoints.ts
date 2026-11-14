/**
 * Legacy guard, consumer-contract and build touches. A contract touch changes
 * what consumers compile against or depend on: found by path and by the shape
 * of the changed lines (public declarations, wire attributes, diagnostic ids),
 * and guarded when the same change tells consumers (release notes, docs). A
 * build touch changes what ships; no rule can check it, so its owner reads it.
 * Spec section 5, Policy.
 */
import type { LegacyTouchPoint, Review } from "../contracts";
import { matchesGlob } from "../policy/globMatch";
import {
  analyzerOnlyGlob,
  buildGlobs,
  commentLine,
  consumerContractGlobs,
  consumerNoteGlobs,
  contractShapes,
  maintainersOwner,
  maxListedFiles,
} from "../policy/legacyTouch";
import type { Guard, Hunk } from "./touchSightings";

/**
 * One touch point for every hunk that changes the consumer contract. The shapes
 * find contract changes the paths miss; the detail lists which rules fired.
 * @example detail "contract paths, public surface, diagnostic ids" for mp-2129
 */
export function consumerContractTouchPoints(
  files: Review["files"],
  hunks: readonly Hunk[],
): LegacyTouchPoint[] {
  const found = hunks.flatMap((hunk) => {
    const reasons = contractReasons(hunk);
    return reasons.length > 0 ? [{ hunk, reasons }] : [];
  });
  if (found.length === 0) return [];
  const detail = [...new Set(found.flatMap(({ reasons }) => reasons))].join(", ");
  const hunkIds = found.map(({ hunk }) => hunk.id);
  return [
    {
      kind: "consumer-contract",
      hunkIds,
      detail,
      owner: maintainersOwner.api,
      guard: guardByNotes(files),
    },
  ];
}

/** Why a hunk counts as a contract change, in the labels the touch point's detail lists. */
function contractReasons(hunk: Hunk): string[] {
  const reasons: string[] = [];
  if (matchesAny(consumerContractGlobs, hunk.file)) reasons.push("contract paths");
  // Only src/: a test that declares or calls public members changes no consumer's contract.
  if (!/^src\/.*\.cs$/.test(hunk.file)) return reasons;
  const changed = hunk.lines.filter(
    (line) => line.kind !== "context" && !commentLine.test(line.text),
  );
  const isAnalyzer = matchesGlob(analyzerOnlyGlob, hunk.file);
  for (const { label, pattern, appliesInAnalyzer } of contractShapes) {
    if (isAnalyzer && !appliesInAnalyzer) continue;
    if (changed.some((line) => pattern.test(line.text))) reasons.push(label);
  }
  return reasons;
}

/**
 * Guarded when the same change updates something consumers read: release
 * notes, docs or a changelog. A contract change nobody announces reaches old
 * consumers as a surprise.
 */
function guardByNotes(files: Review["files"]): Guard {
  const notes = files
    .map((file) => file.path)
    .filter((path) => matchesAny(consumerNoteGlobs, path));
  if (notes.length === 0) {
    return {
      status: "unguarded",
      evidence: "no release note or doc tells old consumers",
      files: [],
    };
  }
  return {
    status: "guarded",
    evidence: `the same change updates ${summarise(notes)}`,
    files: notes.slice(0, maxListedFiles),
  };
}

/** One touch point for every hunk in a build input; the owner always reads it. */
export function buildTouchPoints(hunks: readonly Hunk[]): LegacyTouchPoint[] {
  const touched = hunks.filter((hunk) => matchesAny(buildGlobs, hunk.file));
  if (touched.length === 0) return [];
  return [
    {
      kind: "build",
      hunkIds: touched.map((hunk) => hunk.id),
      detail: summarise(touched.map((hunk) => hunk.file)),
      owner: maintainersOwner.build,
      guard: {
        status: "owner-read",
        evidence: "no test shows what a build change does to old targets",
        files: [],
      },
    },
  ];
}

function matchesAny(globs: readonly string[], path: string): boolean {
  return globs.some((glob) => matchesGlob(glob, path));
}

/**
 * File names on one line, so a touch point stays short.
 * @example ["a/x.cs", "b/y.cs", "c/z.cs", "d/w.cs"] gives "x.cs, y.cs, z.cs and 1 more"
 */
function summarise(paths: readonly string[]): string {
  const names = [...new Set(paths.map((path) => path.split("/").pop() ?? path))];
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}
