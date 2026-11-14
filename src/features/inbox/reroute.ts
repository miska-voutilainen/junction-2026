/**
 * Re-route summary: what a simulated escape changed in the inbox, so the
 * reviewer sees the effect of "Record escape" without opening S1 (spec
 * section 2, moment 3). Compares the rows routed before and after; pure,
 * no React.
 */
import { tierLabel } from "@/contracts";
import { isReviewed } from "./inboxModel";
import type { InboxRow, ReviewedRow } from "./inboxModel";

/** Changes whose tier or reading count differs between two routings, and a sentence naming them. */
export interface Reroute {
  /** Ids of the changed rows, in inbox order. */
  changedIds: string[];
  /** "mp-2283 now reads 8 of 8", "mp-2283: Focused to Full", or "No change re-routed". */
  sentence: string;
}

/** How many changes the sentence names before it counts the rest. */
const NAMED_CHANGES = 2;

/**
 * Compares the inbox before and after an escape.
 *
 * A tier change reads "mp-2283: Focused to Full"; a change that only reads more
 * hunks reads "mp-2283 now reads 8 of 8". More than two changes name the first
 * two and count the rest.
 *
 * @param before Rows routed with the escapes as they were.
 * @param after Rows routed with the new escape included.
 */
export function describeReroute(before: InboxRow[], after: InboxRow[]): Reroute {
  const earlier = new Map(before.filter(isReviewed).map((row) => [row.id, row]));
  const changed = after.filter(isReviewed).flatMap((row) => {
    const was = earlier.get(row.id);
    return was && (was.tier !== row.tier || was.readHunks !== row.readHunks) ? [{ was, now: row }] : [];
  });
  if (changed.length === 0) return { changedIds: [], sentence: "No change re-routed" };

  const named = changed.slice(0, NAMED_CHANGES).map(({ was, now }) => changeSentence(was, now));
  const rest = changed.length - named.length;
  if (rest > 0) named.push(`and ${rest} more`);
  return { changedIds: changed.map(({ now }) => now.id), sentence: named.join(", ") };
}

function changeSentence(was: ReviewedRow, now: ReviewedRow): string {
  if (was.tier !== now.tier) return `${now.id}: ${tierLabel[was.tier]} to ${tierLabel[now.tier]}`;
  return `${now.id} now reads ${now.readHunks} of ${now.totalHunks}`;
}
