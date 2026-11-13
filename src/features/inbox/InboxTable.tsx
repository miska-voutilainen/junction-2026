"use client";

import { IdeaLabel } from "@/components/IdeaLabel";
import { InboxRow } from "./InboxRow";
import { ROW_GRID } from "./tableLayout";
import type { InboxRow as Row } from "./inboxModel";

// Below 1280 px the columns are too narrow for the label, which would be clipped mid-word.
const IDEA_LABEL_CLASS = "hidden whitespace-nowrap xl:inline-flex";

/**
 * The desktop list: a bordered table with a header (Effort carries idea 3,
 * Receipt idea 7) and one `InboxRow` per change. `withHeader` is off for the
 * list inside the Signed fold, which sits under the same column heads.
 *
 * @param label Names the table for screen readers.
 * @param emptyText Shown inside the box when no row matches the filter.
 */
export function InboxTable({
  rows,
  label,
  emptyText,
  withHeader = true,
}: {
  rows: Row[];
  label: string;
  emptyText: string;
  withHeader?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
      <div role="table" aria-label={label}>
        {withHeader && (
          <div role="row" className={`${ROW_GRID} h-9 border-b border-border-subtle text-xs font-semibold whitespace-nowrap text-text-muted`}>
            <span role="columnheader" aria-label="Status" className="size-4" />
            <span role="columnheader">Change</span>
            <span role="columnheader" className="flex min-w-0 items-center gap-2">
              Effort <IdeaLabel n={3} className={IDEA_LABEL_CLASS} />
            </span>
            <span role="columnheader">Risk</span>
            <span role="columnheader" className="flex min-w-0 items-center gap-2">
              Receipt <IdeaLabel n={7} className={IDEA_LABEL_CLASS} />
            </span>
            <span role="columnheader" aria-label="Open" className="hidden size-4 lg:block" />
          </div>
        )}
        <div role="rowgroup">
          {rows.map((row, index) => (
            <InboxRow key={row.id} row={row} index={index} />
          ))}
        </div>
      </div>
      {rows.length === 0 && <p className="px-4 py-6 text-sm text-text-muted">{emptyText}</p>}
    </div>
  );
}
