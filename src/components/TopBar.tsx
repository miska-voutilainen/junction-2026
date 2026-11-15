"use client";

import { Fragment, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useCommandMenu } from "@/components/CommandMenu";
import { NavSheet } from "@/components/NavSheet";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useSearchShortcutLabel } from "@/lib/useShortcuts";

/** One step of the top bar trail; the last item is the current page and has no `href`. */
export type BreadcrumbItem = { label: string; href?: string };

/**
 * The 56 px bar across the top: logo, the one repository as a label, where you
 * are, the escape counter and search. Between 760 and 900 px the nav is hidden
 * and a menu button opens it as a sheet; the search field shrinks to an icon.
 *
 * @param repo Full repository name; truncated with an ellipsis, full text in the tooltip.
 * @param breadcrumb Trail after the repository, e.g. Inbox / mp-2283 / Receipt; the last item is the current page.
 * @param escapeSlot The simulated-escape counter and Reset, rendered only when escapes exist.
 * @param needsReviewCount Passed to the nav in the sheet.
 */
export function TopBar({
  repo,
  breadcrumb = [],
  escapeSlot,
  needsReviewCount,
}: Readonly<{
  repo: string;
  breadcrumb?: BreadcrumbItem[];
  escapeSlot?: ReactNode;
  needsReviewCount: number;
}>) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-3.5 border-b border-border-subtle bg-surface-raised px-4 text-sm">
      <NavSheet needsReviewCount={needsReviewCount} className="-ml-2 nav:hidden" />
      <Link href="/" aria-label="Countersign home" className="rounded-item">
        <Wordmark size="sm" />
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-border-default" />
      <span title={repo} className="min-w-0 truncate font-mono text-xs text-text-secondary">
        {repo}
      </span>
      {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex-1" />
      {escapeSlot}
      <SearchButton />
    </header>
  );
}

function Breadcrumb({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden min-w-0 items-center gap-2 text-text-muted compact:flex"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            <span aria-hidden="true">/</span>
            {isLast || !item.href ? (
              <span
                aria-current={isLast ? "page" : undefined}
                className="truncate font-mono text-xs text-text-primary"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate text-text-secondary hover:text-text-primary"
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function SearchButton() {
  const { open } = useCommandMenu();
  const shortcutLabel = useSearchShortcutLabel();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openFromButton = () => open(buttonRef.current);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openFromButton}
        aria-haspopup="dialog"
        className="hidden h-8 w-60 min-w-11 items-center gap-2 rounded-control border border-border-default bg-surface-panel pr-1.5 pl-2.5 text-left text-sm text-text-muted transition-colors duration-(--duration-fast) ease-out hover:border-border-strong hover:bg-surface-hover hover:text-text-secondary nav:flex"
      >
        <Search aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">Search or jump to…</span>
        <Kbd className="font-mono">{shortcutLabel}</Kbd>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search and quick actions"
        aria-haspopup="dialog"
        onClick={(event) => open(event.currentTarget)}
        className="nav:hidden"
      >
        <Search aria-hidden="true" className="size-4" />
      </Button>
    </>
  );
}
