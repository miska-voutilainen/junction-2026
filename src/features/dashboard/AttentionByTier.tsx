import { tierLabel } from "@/contracts";
import { DashboardSection } from "./DashboardSection";
import { attentionSummary } from "./dashboardModel";
import type { TierAttention } from "./dashboardModel";

/**
 * Per tier, how many hunks a person read (amber) and how many checked
 * evidence covered (neutral). It is the routing idea in one picture: the
 * lighter the tier, the more of the change the evidence carried. Re-routes
 * live when a simulated escape lowers an area's level.
 */
export function AttentionByTier({ rows }: Readonly<{ rows: TierAttention[] }>) {
  return (
    <DashboardSection
      title="Attention by tier"
      subtitle="Hunks a person read against hunks covered by evidence"
    >
      <ul className="flex flex-col gap-3.5 rounded-page border border-border-subtle bg-surface-panel px-4 py-4">
        {rows.map((row) => (
          <li
            key={row.tier}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm"
          >
            <span className="font-medium">{tierLabel[row.tier]}</span>
            <AttentionBar row={row} />
            <span className="col-start-2 text-text-muted">
              {row.changes === 0
                ? "No changes"
                : `${row.readHunks} of ${row.totalHunks} hunks · ~${row.readMinutes} min`}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-chip bg-amber" /> Read by a person
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-chip bg-border-strong" /> Covered by
          evidence
        </span>
      </p>
    </DashboardSection>
  );
}

function AttentionBar({ row }: Readonly<{ row: TierAttention }>) {
  const readShare = row.totalHunks === 0 ? 0 : (row.readHunks / row.totalHunks) * 100;
  return (
    <span
      role="img"
      aria-label={attentionSummary(row)}
      className="flex h-2.5 overflow-hidden rounded-chip bg-surface-bg"
    >
      {row.totalHunks > 0 && (
        <>
          <span
            className="h-full bg-amber transition-[width] duration-(--duration-fast) ease-out motion-reduce:transition-none"
            style={{ width: `${readShare}%` }}
          />
          <span className="h-full flex-1 bg-border-strong" />
        </>
      )}
    </span>
  );
}
