"use client";

import { useMemo, useState } from "react";
import { Disclosure } from "@/components/Disclosure";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { ReportCard } from "@/contracts";
import { useEscapes } from "@/lib/simulation/escapes";
import { applyEscapes, levelsFromReportCard } from "@/rules/ladder";
import { InboxHeader } from "./InboxHeader";
import { InboxMobile } from "./InboxMobile";
import { InboxTable } from "./InboxTable";
import { SummaryBar } from "./SummaryBar";
import { buildInboxModel, filterCounts, filterRows, isReviewed, mobileSections } from "./inboxModel";
import type { InboxRow, InboxSource, StatusFilter } from "./inboxModel";
import { useRowNavigation } from "./useRowNavigation";

const EMPTY_FILTER_TEXT: Record<StatusFilter, string> = {
  all: "Every change here is signed.",
  "needs-review": "No change needs review.",
  stale: "No signature is stale.",
  signed: "No change is signed yet.",
};

/**
 * The inbox body: header, summary, and the list as a table (760 px and up) or
 * as three short lists (below). Tiers are computed here, in the browser, from
 * the report card's trust levels minus any simulated escapes, so recording an
 * escape re-routes every row at once (spec section 3, S1 "Live re-routing").
 */
export function InboxView({ sources, reportCard }: { sources: InboxSource[]; reportCard: ReportCard | null }) {
  const { escapes } = useEscapes();
  const model = useMemo(
    () => buildInboxModel(sources, applyEscapes(levelsFromReportCard(reportCard), escapes)),
    [sources, reportCard, escapes],
  );
  const [filter, setFilter] = useState<StatusFilter>("all");
  useRowNavigation();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6 compact:px-8 compact:py-7">
      <InboxHeader reviewNext={model.reviewNext} />
      <SummaryBar summary={model.summary} />
      <div className="compact:hidden">
        <InboxMobile sections={mobileSections(model.rows)} />
      </div>
      <div className="hidden flex-col gap-4 compact:flex">
        <DesktopList rows={model.rows} filter={filter} onFilterChange={setFilter} />
      </div>
    </div>
  );
}

function DesktopList({
  rows,
  filter,
  onFilterChange,
}: {
  rows: InboxRow[];
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
}) {
  const counts = filterCounts(rows);
  const matching = filterRows(rows, filter);
  // Under "All" the signed changes fold away below the open ones; under "Signed" they are the list.
  const isSigned = (row: InboxRow) => isReviewed(row) && row.receipt === "signed";
  const listed = filter === "all" ? matching.filter((row) => !isSigned(row)) : matching;
  const folded = filter === "all" ? matching.filter(isSigned) : [];

  return (
    <>
      <SegmentedControl
        label="Filter changes by status"
        value={filter}
        onChange={onFilterChange}
        segments={[
          { value: "all", label: "All", count: counts.all },
          { value: "needs-review", label: "Needs review", count: counts["needs-review"] },
          { value: "stale", label: "Stale", count: counts.stale },
          { value: "signed", label: "Signed", count: counts.signed },
        ]}
        className="self-start"
      />
      <InboxTable rows={listed} label="Changes" emptyText={EMPTY_FILTER_TEXT[filter]} />
      {folded.length > 0 && (
        <Disclosure
          title={
            <span className="flex items-center gap-2 font-semibold text-text-primary">
              Signed <span className="font-mono text-sm font-normal text-text-muted">{folded.length}</span>
            </span>
          }
        >
          <InboxTable rows={folded} label="Signed changes" emptyText="" withHeader={false} />
        </Disclosure>
      )}
    </>
  );
}
