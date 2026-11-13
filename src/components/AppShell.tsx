import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { CommandMenu } from "@/components/CommandMenu";
import { MobileHeader } from "@/components/MobileHeader";
import type { ShellChange } from "@/components/ShellChange";
import { TopBar } from "@/components/TopBar";
import type { BreadcrumbItem } from "@/components/TopBar";

export type { ShellChange };

/**
 * The frame every page except the access gate sits in: top bar, side nav and
 * the content column, plus the command menu and its shortcuts. Pages opt in by
 * wrapping their content; the shell has no data of its own.
 *
 * Desktop (900 px and up): top bar, 248 px nav, content. 760 to 900 px: the
 * nav moves into a sheet behind a menu button. Below 760 px: the mobile header.
 *
 * @param changes The inbox in order, for the nav badge and the command menu.
 * @param repo The repository's full name, shown as a label.
 * @param breadcrumb Trail for the top bar; the last item is the current page.
 * @param escapeSlot The simulated-escape counter and Reset, when escapes exist.
 * @param title The page title on the mobile header.
 * @param backHref Where the mobile header's back link goes; omit on home pages.
 */
export function AppShell({
  changes,
  repo,
  breadcrumb,
  escapeSlot,
  title,
  backHref,
  children,
}: {
  changes: ShellChange[];
  repo: string;
  breadcrumb?: BreadcrumbItem[];
  escapeSlot?: ReactNode;
  title: string;
  backHref?: string;
  children: ReactNode;
}) {
  const needsReviewCount = changes.filter((change) => change.needsReview).length;

  return (
    <div className="flex min-h-screen flex-col bg-surface-bg text-text-primary">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <div className="hidden compact:block">
        <TopBar repo={repo} breadcrumb={breadcrumb} escapeSlot={escapeSlot} needsReviewCount={needsReviewCount} />
      </div>
      <MobileHeader title={title} backHref={backHref} />
      <div className="flex flex-1">
        <aside className="hidden w-nav shrink-0 border-r border-border-subtle bg-surface-raised nav:block">
          <AppNav needsReviewCount={needsReviewCount} />
        </aside>
        <main id="content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <CommandMenu changes={changes} />
    </div>
  );
}
