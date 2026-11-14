import { DashboardSection } from "./DashboardSection";
import type { DeciderQueue } from "./dashboardModel";

/**
 * Refusals no signed receipt has accepted, grouped by who the refusal policy
 * says decides. The AI refuses these on purpose (idea 5): a person owns each.
 */
export function OpenDecisions({ queues }: Readonly<{ queues: DeciderQueue[] }>) {
  return (
    <DashboardSection title="Open decisions" subtitle="Refusals waiting on their decider">
      {queues.length === 0 ? (
        <p className="rounded-page border border-border-subtle bg-surface-panel px-4 py-3 text-sm text-text-muted">No decisions waiting.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
          {queues.map((queue) => (
            <li key={queue.decider} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="block font-medium first-letter:uppercase">{queue.decider}</span>
                <span className="shrink-0 text-sm text-amber-light">{queue.count} open</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {queue.decisions.map((decision) => (
                  <li key={decision.ruleId} className="text-sm text-text-secondary">
                    <span className="font-mono text-xs text-text-muted">{decision.ruleId}</span> {decision.title}
                    <span className="text-text-muted">
                      {" "}
                      · {decision.count} in <span className="font-mono text-xs">{decision.changeIds.join(", ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
