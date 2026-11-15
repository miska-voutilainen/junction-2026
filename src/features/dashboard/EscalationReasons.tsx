import { Disclosure } from "@/components/Disclosure";
import type { EscalationReason } from "./dashboardModel";

/**
 * Which routing rules lifted a change above Light, by the number of changes
 * each fired in. Same rules as `route()`, so each line traces to a rule id
 * in the routing policy.
 */
export function EscalationReasons({
  reasons,
  changes,
}: Readonly<{ reasons: EscalationReason[]; changes: number }>) {
  const mostFrequent = reasons[0];
  return (
    <Disclosure
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-semibold text-text-primary">
            Why changes were escalated above Light
          </span>
          {mostFrequent && (
            <span className="text-sm text-text-muted">
              Most often: {mostFrequent.label}, {mostFrequent.changes}
            </span>
          )}
        </span>
      }
    >
      {reasons.length === 0 ? (
        <p className="px-1 py-2 text-sm text-text-muted">No change was escalated above Light.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
          {reasons.map((reason) => (
            <li key={reason.ruleId} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">{reason.label}</span>
              <span className="font-mono text-xs text-text-muted">{reason.ruleId}</span>
              <span className="w-28 shrink-0 text-right text-text-secondary tabular-nums">
                {reason.changes} of {changes} reviewed
              </span>
            </li>
          ))}
        </ul>
      )}
    </Disclosure>
  );
}
