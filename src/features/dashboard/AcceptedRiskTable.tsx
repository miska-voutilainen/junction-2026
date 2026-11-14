import Link from "next/link";
import { DashboardSection } from "./DashboardSection";
import type { AcceptedRisk } from "./dashboardModel";

const ROW_COLUMNS = "compact:grid compact:grid-cols-[minmax(0,1fr)_12rem_8rem_12rem] compact:items-start compact:gap-x-6";
const SIGNED_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Residual-risk lines from the receipts, in the signer's own words. A line
 * "Holds" while the code is the code that was signed; once the change is
 * amended it is "Stale" and the signer's acceptance no longer applies.
 * Rows stack on a phone and become a table from 760 px.
 */
export function AcceptedRiskTable({ risks }: { risks: AcceptedRisk[] }) {
  return (
    <DashboardSection title="Accepted risk" subtitle="Residual risk lines from signed receipts, and whether their code still holds">
      <div role="table" aria-label="Accepted risk" className="overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
        <div role="row" className={`hidden border-b border-border-subtle px-4 py-2.5 text-xs text-text-muted ${ROW_COLUMNS}`}>
          <span role="columnheader">Risk, in the signer&apos;s words</span>
          <span role="columnheader">Accepted by</span>
          <span role="columnheader">Change</span>
          <span role="columnheader">Status</span>
        </div>
        {risks.map((risk) => (
          <div
            key={risk.changeId}
            role="row"
            className={`flex flex-col gap-1.5 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0 ${ROW_COLUMNS}`}
          >
            <span role="cell" className="min-w-0 text-text-primary">
              {risk.text}
            </span>
            <span role="cell" className="min-w-0 break-words text-text-secondary">
              {risk.owner}
              <span className="text-text-muted"> · {SIGNED_DATE.format(new Date(risk.signedAt))}</span>
            </span>
            <span role="cell">
              <Link
                href={`/changes/${risk.changeId}`}
                className="font-mono text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {risk.changeId}
              </Link>
            </span>
            <span role="cell" className={risk.isStale ? "text-amber-light" : "text-text-secondary"}>
              {risk.isStale ? "Stale: code changed" : "Holds: code unchanged"}
            </span>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
