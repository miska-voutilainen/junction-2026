import type { DashboardFacts } from "./dashboardModel";
import { countOf } from "@/lib/countOf";

/**
 * Five numbers, each with its sample size: signed of all changes, hunks and
 * contradictions over the changes that have a review. "Median time to sign" is not
 * measured: a receipt records when it was signed but not when review began,
 * so the cell says so instead of showing a made-up figure.
 */
export function FactsStrip({ facts, className }: Readonly<{ facts: DashboardFacts; className?: string }>) {
  return (
    <dl className={className}>
      <Fact term="Signed" value={`${facts.signed} of ${facts.changes} changes`} />
      <Fact term="Hunks read by a person" value={`${facts.readHunks} of ${facts.totalHunks}`} note={hunkNote(facts)} />
      <Fact term="Contradictions caught" value={String(facts.contradictions)} note={`In ${countOf(facts.reviewedChanges, "reviewed change")}`} />
      <Fact term="Escapes recorded" value={`${facts.escapes} simulated`} />
      <Fact
        term="Median time to sign"
        value="Not measured yet"
        note="Receipts record when they were signed, not when review began."
        isMuted
      />
    </dl>
  );
}

/** Live with escapes; says how many changes the hunks come from when some have no review yet. */
function hunkNote({ reviewedChanges, changes }: DashboardFacts): string {
  return reviewedChanges < changes ? `Across ${reviewedChanges} of ${changes} changes · live` : "Live: follows simulated escapes";
}

function Fact({ term, value, note, isMuted = false }: Readonly<{ term: string; value: string; note?: string; isMuted?: boolean }>) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-surface-panel px-4 py-3.5">
      <dt className="text-sm text-text-muted">{term}</dt>
      <dd className={isMuted ? "text-base text-text-muted" : "text-xl font-semibold tabular-nums"}>{value}</dd>
      {note && <dd className="text-xs text-text-muted">{note}</dd>}
    </div>
  );
}
