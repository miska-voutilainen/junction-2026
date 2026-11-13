"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, Inbox, Search } from "lucide-react";
import { useCommandMenu } from "@/components/CommandMenu";
import { Wordmark } from "@/components/Wordmark";

const TOUCH_TARGET = "grid size-11 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary";

/**
 * The header below 760 px, replacing the top bar: a back link (or the logo on
 * the home pages), the page title, search, and one link across to the other
 * home page (Inbox and Dashboard point at each other). 44 px touch targets.
 *
 * @param title What this page is, shown in place of the breadcrumb.
 * @param backHref Where "back" goes on a detail page; omit on Inbox and Dashboard.
 */
export function MobileHeader({ title, backHref }: { title: string; backHref?: string }) {
  const { open } = useCommandMenu();
  const searchRef = useRef<HTMLButtonElement>(null);
  const isDashboard = usePathname() === "/dashboard";

  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-raised pr-1.5 pl-4 compact:hidden">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className={`${TOUCH_TARGET} -ml-3`}>
          <ArrowLeft aria-hidden="true" className="size-4.5" />
        </Link>
      ) : (
        <Link href="/" aria-label="Countersign home" className="rounded-item">
          <Wordmark size="sm" />
        </Link>
      )}
      <p className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">{title}</p>
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
      <Link href={isDashboard ? "/" : "/dashboard"} aria-label={isDashboard ? "Inbox" : "Dashboard"} className={TOUCH_TARGET}>
        {isDashboard ? <Inbox aria-hidden="true" className="size-4.5" /> : <BarChart3 aria-hidden="true" className="size-4.5" />}
      </Link>
    </header>
  );
}
