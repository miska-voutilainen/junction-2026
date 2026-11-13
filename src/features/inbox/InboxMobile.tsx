"use client";

import Link from "next/link";
import { Disclosure } from "@/components/Disclosure";
import type { ReactNode } from "react";
import { tierLabel } from "@/contracts";
import { flagsText, readCount } from "./rowText";
import { isReviewed } from "./inboxModel";
import type { InboxRow, MobileSections, ReviewedRow } from "./inboxModel";

/**
 * The inbox below 760 px: three short lists instead of a table. "Sign here"
 * holds what a phone can handle (Light changes and stale signatures),
 * "Needs a desktop" the Focused and Full ones with a read-only link, and
 * "Signed" folds away. There is no approve button: signing is a git command.
 */
export function InboxMobile({ sections }: { sections: MobileSections }) {
  return (
    <div className="flex flex-col gap-6">
      {sections.signHere.length > 0 && (
        <Section title="Sign here" count={sections.signHere.length}>
          {sections.signHere.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 border-t border-border-subtle pt-3">
              <RowTitle row={row} />
              <RowMeta row={row} />
              <Link
                href={`/changes/${row.id}`}
                data-inbox-row-link
                className="flex min-h-11 items-center justify-center rounded-control bg-brand text-base font-semibold text-white hover:bg-brand-hover"
              >
                {row.receipt === "stale" ? "Review and re-sign" : "Review and sign"}
              </Link>
            </li>
          ))}
        </Section>
      )}
      {sections.needsDesktop.length > 0 && (
        <Section title="Needs a desktop" count={sections.needsDesktop.length}>
          {sections.needsDesktop.map((row) => (
            <li key={row.id} className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
              <RowTitle row={row} />
              <RowMeta row={row} />
              {isReviewed(row) && (
                <Link href={`/changes/${row.id}`} className="flex min-h-11 items-center text-sm text-link">
                  Open read-only
                </Link>
              )}
            </li>
          ))}
        </Section>
      )}
      {sections.signed.length > 0 && (
        <Disclosure
          title={
            <span className="flex items-center gap-2 font-semibold text-text-primary">
              Signed <span className="font-mono text-sm font-normal text-text-muted">{sections.signed.length}</span>
            </span>
          }
        >
          <ul className="flex flex-col gap-3 pb-2 pl-6">
            {sections.signed.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5">
                <RowTitle row={row} />
                <RowMeta row={row} />
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {title} <span className="font-mono text-xs font-normal text-text-muted">{count}</span>
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function RowTitle({ row }: { row: InboxRow }) {
  return (
    <Link href={`/changes/${row.id}`} className="font-medium text-text-primary">
      {row.title}
    </Link>
  );
}

/** "MP-2283 · Focused · read 2 of 8 · 1 contradiction"; unreviewed rows say why they have no tier. */
function RowMeta({ row }: { row: InboxRow }) {
  if (!isReviewed(row)) {
    return (
      <p className="text-sm text-text-muted">
        <span className="font-mono">{row.requirementId}</span> ·{" "}
        {row.state === "missing" ? "Not reviewed yet" : "This review couldn't be read"}
      </p>
    );
  }
  return (
    <p className="text-sm text-text-muted">
      <span className="font-mono">{row.requirementId}</span> · {tierLabel[row.tier]} · {readCount(row)} ·{" "}
      <span className={metaFlagClass(row)}>{row.receipt === "stale" ? "Stale" : flagsText(row)}</span>
    </p>
  );
}

function metaFlagClass(row: ReviewedRow): string {
  if (row.receipt === "stale") return "text-amber-light";
  return row.contradictions > 0 ? "text-rose-light" : "";
}
