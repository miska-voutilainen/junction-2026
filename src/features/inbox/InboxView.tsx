"use client";

import { useState } from "react";
import { Disclosure } from "@/components/Disclosure";
import { SegmentedControl } from "@/components/SegmentedControl";
import { InboxHeader } from "./InboxHeader";
import { InboxMobile } from "./InboxMobile";
import { InboxTable } from "./InboxTable";
import { SummaryBar } from "./SummaryBar";
import { filterCounts, filterRows, isReviewed, mobileSections } from "./inboxModel";
import type { InboxModel, InboxRow, StatusFilter } from "./inboxModel";
import { useRowNavigation } from "./useRowNavigation";

const EMPTY_FILTER_TEXT: Record<StatusFilter, string> = {
  all: "Every change here is signed.",
  "needs-review": "No change needs review.",
  stale: "No signature is stale.",
  signed: "No change is signed yet.",
};

/**
 * The inbox body: header, summary, and the list as a table (760 px and up) or
 * as three short lists (below). The model arrives already routed with the
 * current simulated escapes (see `InboxScreen`).
 *
 * @param highlightedIds Changes the last simulated escape re-routed; their rows are tinted for a moment.
 * @param notice A line shown above the list, e.g. that the report card is unreadable.
 */
export function InboxView({
  model,
  notice,
  highlightedIds,
}: Readonly<{ model: InboxModel; notice: string | null; highlightedIds: ReadonlySet<string> }>) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  useRowNavigation();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6 compact:px-8 compact:py-7">
      <InboxHeader reviewNext={model.reviewNext} />
      {notice && (
        <p
          role="status"
          className="rounded-control border border-amber/40 px-4 py-2.5 text-sm text-amber-light"
        >
          {notice}
        </p>
      )}
      <SummaryBar summary={model.summary} />
      <div className="compact:hidden">
        <InboxMobile sections={mobileSections(model.rows)} highlightedIds={highlightedIds} />
      </div>
      <div className="hidden flex-col gap-4 compact:flex">
        <DesktopList
          rows={model.rows}
          highlightedIds={highlightedIds}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>
    </div>
  );
}

function DesktopList({
  rows,
  highlightedIds,
  filter,
  onFilterChange,
}: Readonly<{
  rows: InboxRow[];
  highlightedIds: ReadonlySet<string>;
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
}>) {
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
      <InboxTable
        rows={listed}
        highlightedIds={highlightedIds}
        label="Changes"
        emptyText={EMPTY_FILTER_TEXT[filter]}
      />
      {folded.length > 0 && (
        <Disclosure
          title={
            <span className="flex items-center gap-2 font-semibold text-text-primary">
              Signed{" "}
              <span className="font-mono text-sm font-normal text-text-muted">{folded.length}</span>
            </span>
          }
        >
          <InboxTable
            rows={folded}
            highlightedIds={highlightedIds}
            label="Signed changes"
            emptyText=""
            withHeader={false}
          />
        </Disclosure>
      )}
    </>
  );
}
