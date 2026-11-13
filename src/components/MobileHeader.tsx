"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useCommandMenu } from "@/components/CommandMenu";
import { Wordmark } from "@/components/Wordmark";

const TOUCH_TARGET = "grid size-11 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary";

/**
 * The header below 760 px, replacing the top bar: a back link (or the logo on
 * the home pages), the page title and search. 44 px touch targets.
 *
 * @param escapeSlot The simulated-escape counter, so a recorded escape is visible at phone width too.
 * @param title What this page is, shown in place of the breadcrumb.
 * @param backHref Where "back" goes on a detail page; omit on the Inbox.
 */
export function MobileHeader({ title, backHref, escapeSlot }: { title: string; backHref?: string; escapeSlot?: ReactNode }) {
  const { open } = useCommandMenu();
  const searchRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-raised pr-1.5 pl-4 compact:hidden">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className={`${TOUCH_TARGET} -ml-3`}>
          <ArrowLeft aria-hidden="true" className="size-4.5" />
        </Link>
      ) : (
        <Link href="/" aria-label="Countersign home" className="rounded-item">
          <Wordmark size="sm" showName={false} />
        </Link>
      )}
      <p className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">{title}</p>
      {escapeSlot}
      <button
        ref={searchRef}
        type="button"
        aria-label="Search and quick actions"
        aria-haspopup="dialog"
        onClick={() => open(searchRef.current)}
        className={TOUCH_TARGET}
      >
        <Search aria-hidden="true" className="size-4.5" />
      </button>
    </header>
  );
}
