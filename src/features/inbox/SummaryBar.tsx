import type { InboxSummary } from "./inboxModel";

/**
 * One row, wrapping on narrow screens: signed-share pips, the counts by tier,
 * and what a human has to read across all changes. The reading figure is the
 * routing idea in one line: "Humans read 14 of 290 hunks".
 */
export function SummaryBar({ summary }: Readonly<{ summary: InboxSummary }>) {
  const { changes, tierCounts, signed } = summary;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-control border border-border-subtle bg-surface-panel px-4 py-2.5 text-sm text-text-secondary">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span role="img" aria-label={`${signed} of ${changes} signed`} className="inline-flex gap-0.5">
          {Array.from({ length: changes }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 w-3.5 rounded-chip ${index < signed ? "bg-text-secondary" : "bg-border-strong"}`}
            />
          ))}
        </span>
        <span>
          <b className="font-semibold text-text-primary">{changes === 1 ? "1 change" : `${changes} changes`}</b> ·{" "}
          {tierCounts.light} Light · {tierCounts.focused} Focused · {tierCounts.full} Full · {signed} signed
        </span>
      </div>
      <span className="text-text-muted compact:ml-auto">
        Humans read {summary.readHunks} of {summary.totalHunks} hunks · ~{summary.readMinutes} of {summary.fullMinutes} min
      </span>
    </div>
  );
}
