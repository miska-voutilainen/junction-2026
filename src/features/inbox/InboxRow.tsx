"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Ban, ChevronRight, FileWarning } from "lucide-react";
import { ReceiptStatus } from "@/components/ReceiptStatus";
import { TierBadge } from "@/components/TierBadge";
import { fadeUpItem, useStaggeredPreset } from "@/lib/motion";
import { CoverageStrip } from "./CoverageStrip";
import { StatusIcon } from "./StatusIcon";
import { countOf, readingText } from "./rowText";
import { ROW_GRID } from "./tableLayout";
import type { InboxRow as Row, ReviewedRow } from "./inboxModel";

/**
 * One change as a table row. The whole row is one link: the title link is
 * stretched over the row with `::after`, so there is a single tab stop and the
 * row can still hold other text. Rows fade up in turn (30 ms apart, capped).
 *
 * @param index Position in the list, for the entrance stagger.
 */
export function InboxRow({ row, index }: { row: Row; index: number }) {
  const entrance = useStaggeredPreset(fadeUpItem, index);

  return (
    <motion.div
      role="row"
      initial={entrance.initial}
      animate={entrance.animate}
      className={`group relative ${ROW_GRID} gap-y-1 border-t border-border-subtle py-3 first:border-t-0 hover:bg-surface-hover has-focus-visible:bg-surface-hover has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-focus-ring`}
    >
      <div role="cell">
        <StatusIcon row={row} />
      </div>
      <ChangeCell row={row} />
      {row.state === "reviewed" ? <ReviewedCells row={row} /> : <UnreviewedCells row={row} />}
      <div
        role="cell"
        className="hidden justify-end text-text-faint opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 group-has-focus-visible:opacity-100 lg:flex"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </div>
    </motion.div>
  );
}

function ChangeCell({ row }: { row: Row }) {
  return (
    <div role="cell" className="min-w-0">
      <Link
        href={`/changes/${row.id}`}
        data-inbox-row-link
        className="block truncate text-base font-medium text-text-primary outline-none after:absolute after:inset-0"
      >
        {row.title}
      </Link>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 font-mono text-xs text-text-muted">
        <span>{row.requirementId}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{row.authorAgent}</span>
        {row.hasSyntheticDescription && (
          <span className="rounded-chip border border-border-default px-1.5 font-sans">synthetic PR description</span>
        )}
      </p>
    </div>
  );
}

function ReviewedCells({ row }: { row: ReviewedRow }) {
  return (
    <>
      <div role="cell" className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <TierBadge tier={row.tier} />
          <span className="text-xs text-text-muted">{readingText(row)}</span>
        </div>
        <CoverageStrip coverage={row.coverage} className="hidden lg:flex" />
      </div>
      <div role="cell" className="flex flex-col gap-0.5 text-sm">
        {row.contradictions > 0 && (
          <span className="flex items-center gap-1.5 text-rose-light">
            <FileWarning aria-hidden="true" className="size-3.5 shrink-0" />
            {countOf(row.contradictions, "contradiction")}
          </span>
        )}
        {row.refusals > 0 && (
          <span className="flex items-center gap-1.5 text-text-secondary">
            <Ban aria-hidden="true" className="size-3.5 shrink-0" />
            {row.refusals} refused
          </span>
        )}
        {row.contradictions === 0 && row.refusals === 0 && <span className="text-text-muted">No flags</span>}
      </div>
      <div role="cell" className="text-sm">
        <ReceiptStatus status={row.receipt} owner={row.signedBy} />
      </div>
    </>
  );
}

/** A change without a readable review: one message across the effort and risk columns, no receipt. */
function UnreviewedCells({ row }: { row: Row }) {
  return (
    <>
      <div role="cell" className="col-span-2 text-sm text-text-muted">
        {row.state === "missing" ? (
          "Not reviewed yet"
        ) : (
          <>
            This review couldn&apos;t be read. Re-record it with{" "}
            <code className="font-mono text-xs text-text-secondary">pnpm pipeline run {row.id}</code>.
          </>
        )}
      </div>
      <div role="cell" className="text-sm text-text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No receipt</span>
      </div>
    </>
  );
}
