import type { ReviewedRow } from "./inboxModel";

/** "1 contradiction", "2 contradictions": the noun takes an "s" unless the count is one. */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** How many hunks a person reads: "read 2 of 8", or "read 12 of 423 · 411 generated" when snapshots are left out of the count. */
export function readCount(row: ReviewedRow): string {
  const generated = row.coverage.filter((state) => state === "generated").length;
  const generatedNote = generated > 0 ? ` · ${generated} generated` : "";
  return `read ${row.readHunks} of ${row.totalHunks}${generatedNote}`;
}

/** The reading estimate of a row: "read 2 of 8 · ~2 min", or without minutes when nothing needs reading. */
export function readingText(row: ReviewedRow): string {
  return row.readMinutes > 0 ? `${readCount(row)} · ~${row.readMinutes} min` : readCount(row);
}

/** The flags of a row in words, e.g. "1 contradiction · 2 refused"; "No flags" when there are none. */
export function flagsText(row: ReviewedRow): string {
  const flags = [
    row.contradictions > 0 ? countOf(row.contradictions, "contradiction") : null,
    row.refusals > 0 ? `${row.refusals} refused` : null,
  ].filter((flag) => flag !== null);
  return flags.length > 0 ? flags.join(" · ") : "No flags";
}
