/**
 * Legacy guard, shared step: detectors first record sightings (one place in one
 * hunk), then group them into touch points, so an owner reads one card per
 * thing touched instead of one per hunk. Spec section 5, Policy.
 */
import type { LegacyTouchKind, LegacyTouchPoint, Review } from "../contracts";

/** A hunk of the change, as the detectors read it. */
export type Hunk = Review["hunks"][number];

/** The evidence that a touch is safe, as stored on a touch point. */
export type Guard = LegacyTouchPoint["guard"];

/** One place in one hunk that touches something legacy, before hunks are grouped. */
export interface Sighting {
  /** What the touch point will say it touches, e.g. "Wire format: src/MessagePack/MessagePackWriter.cs". */
  detail: string;
  owner: string;
  hunkId: string;
  /** What the guard looks up: a symbol, a type name or a source project. */
  subject: string;
}

/**
 * One touch point per detail, in first-seen order. Its guard is computed once
 * from every subject seen under that detail, so three hunks that edit the
 * writer make one lookup and one card, not three.
 * @param guardOf finds the evidence for the subjects, e.g. tests that name them
 */
export async function groupSightings(
  kind: LegacyTouchKind,
  sightings: readonly Sighting[],
  guardOf: (subjects: string[]) => Promise<Guard>,
): Promise<LegacyTouchPoint[]> {
  const details = [...new Set(sightings.map((sighting) => sighting.detail))];
  return Promise.all(
    details.map(async (detail) => {
      const group = sightings.filter((sighting) => sighting.detail === detail);
      return {
        kind,
        hunkIds: [...new Set(group.map((sighting) => sighting.hunkId))],
        detail,
        owner: group[0].owner,
        guard: await guardOf([...new Set(group.map((sighting) => sighting.subject))]),
      };
    }),
  );
}
