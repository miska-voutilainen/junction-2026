import type { InboxSummary } from "@/features/inbox";
import { countOf } from "@/lib/countOf";

/**
 * What the current levels mean for the four changes: how many land in each
 * tier and how much a person still reads. Recomputed with the simulated
 * escapes, so recording one here moves the numbers.
 */
export function RoutingSpread({ summary, escapeCount }: Readonly<{ summary: InboxSummary; escapeCount: number }>) {
  const { changes, tierCounts, readHunks, totalHunks, readMinutes, fullMinutes } = summary;
  return (
    <section aria-labelledby="routing-spread-heading" className="flex flex-col gap-2">
      <h2 id="routing-spread-heading" className="text-lg font-semibold">
        Routing spread
      </h2>
      <p className="text-text-secondary">
        Of {changes} changes: {tierCounts.light} Light · {tierCounts.focused} Focused · {tierCounts.full} Full · humans read{" "}
        {readHunks} of {totalHunks} hunks (~{readMinutes} of {fullMinutes} min)
        {escapeCount > 0 && (
          <span className="text-rose-light"> · with {countOf(escapeCount, "simulated escape")}</span>
        )}
      </p>
    </section>
  );
}
