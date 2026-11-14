import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/AppNav";
import { CommandMenu } from "@/components/CommandMenu";
import { MobileHeader } from "@/components/MobileHeader";
import type { ShellChange } from "@/components/ShellChange";
import { TopBar } from "@/components/TopBar";
import type { BreadcrumbItem } from "@/components/TopBar";

/**
 * The frame every page except the access gate sits in: top bar, side nav and
 * the content column, plus the command menu and its shortcuts. Pages opt in by
 * wrapping their content; the shell has no data of its own.
 *
 * Desktop (900 px and up): top bar, 248 px nav (a 56 px icon rail with `isNavRail`), content. 760 to 900 px: the
 * nav moves into a sheet behind a menu button. Below 760 px: the mobile header.
 *
 * @param changes The inbox in order, for the nav badge and the command menu.
 * @param repo The repository's full name, shown as a label.
 * @param breadcrumb Trail for the top bar; the last item is the current page.
 * @param escapeSlot The simulated-escape counter and Reset, when escapes exist.
 * @param title The page title on the mobile header.
 * @param backHref Where the mobile header's back link goes; omit on home pages.
 * @param isNavRail Shrinks the desktop nav to an icon rail; the review screen sets it so the diff gets the width.
 */
export function AppShell({
  changes,
  repo,
  breadcrumb,
  escapeSlot,
  title,
  backHref,
  isNavRail = false,
  children,
}: Readonly<{
  changes: ShellChange[];
  repo: string;
  breadcrumb?: BreadcrumbItem[];
  escapeSlot?: ReactNode;
  title: string;
  backHref?: string;
  isNavRail?: boolean;
  children: ReactNode;
}>) {
  const needsReviewCount = changes.filter((change) => change.needsReview).length;

  return (
    <div className="flex min-h-screen flex-col bg-surface-bg text-text-primary">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="sticky top-0 z-30 hidden compact:block print:hidden">
        <TopBar repo={repo} breadcrumb={breadcrumb} escapeSlot={escapeSlot} needsReviewCount={needsReviewCount} />
      </div>
      <MobileHeader title={title} backHref={backHref} escapeSlot={escapeSlot} needsReviewCount={needsReviewCount} />
      <div className="flex flex-1">
        {/* Sticky at the height of what is left below the top bar, so the shortcuts at the foot stay on screen on a long page; a short window scrolls the nav itself. */}
        <aside className={cn(
            "sticky top-topbar hidden h-below-topbar shrink-0 self-start overflow-y-auto border-r border-border-subtle bg-surface-raised nav:block print:hidden",
            isNavRail ? "w-14" : "w-nav",
          )}
        >
          <AppNav needsReviewCount={needsReviewCount} isRail={isNavRail} />
        </aside>
        <main id="content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <CommandMenu changes={changes} />
    </div>
  );
}
