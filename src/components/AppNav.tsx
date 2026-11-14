"use client";

import { useId } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { Keyboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Disclosure } from "@/components/Disclosure";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { useEnterTransition } from "@/lib/motion";
import { PAGES } from "@/lib/pages";
import { SHORTCUT_LIST, useSearchShortcutLabel } from "@/lib/useShortcuts";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: LucideIcon; hasBadge?: boolean };

function navItem(id: (typeof PAGES)[number]["id"]): NavItem {
  const page = PAGES.find((candidate) => candidate.id === id)!;
  return { label: page.navLabel, href: page.href, icon: page.icon, hasBadge: id === "inbox" };
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Review", items: [navItem("inbox")] },
  { label: "Insights", items: [navItem("dashboard"), navItem("reviewer")] },
];

/** Inbox is the home of `/` and of every `/changes/<id>`; the other items match their own path. */
function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/changes");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The side navigation: the Review and Insights groups, and the keyboard shortcuts
 * that exist. The selected background is one element that slides between items
 * (shared `layoutId`), so the eye follows where you went.
 *
 * @param needsReviewCount The badge on Inbox; hidden at zero.
 * @param onNavigate Called when a link is followed, so a sheet can close.
 * @param isRail Icons only, for the review screen where the diff needs the width; the names stay as accessible names and tooltips, the shortcut list is left out.
 */
export function AppNav({
  needsReviewCount,
  onNavigate,
  isRail = false,
}: Readonly<{ needsReviewCount: number; onNavigate?: () => void; isRail?: boolean }>) {
  // Two navs can be mounted (the page's and the sheet's); a group id keeps their highlights apart.
  const groupId = useId();
  const searchShortcut = useSearchShortcutLabel();

  return (
    <nav aria-label="Main" className={cn("flex h-full flex-col gap-5 pt-4 pb-3 text-sm", isRail ? "px-1.5" : "px-2.5")}>
      <LayoutGroup id={groupId}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className={cn("px-2.5 pb-1.5 text-xs font-semibold text-text-faint", isRail && "sr-only")}>{group.label}</div>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} needsReviewCount={needsReviewCount} onNavigate={onNavigate} isRail={isRail} />
            ))}
          </div>
        ))}
      </LayoutGroup>

      <div className="mt-auto border-t border-border-subtle pt-3">
        {isRail ? (
          <ShortcutsDialog searchShortcut={searchShortcut} />
        ) : (
          <Disclosure
            title={
              <span className="flex items-center gap-2.5">
                <Keyboard aria-hidden="true" className="size-4" />
                Keyboard shortcuts
              </span>
            }
          >
            <ShortcutList searchShortcut={searchShortcut} className="py-1 pr-2.5 pl-9" />
          </Disclosure>
        )}
      </div>
    </nav>
  );
}

/** One sidebar link: the sliding selected background, the label, and the Inbox count (a dot in the rail). */
function NavLink({
  item,
  needsReviewCount,
  onNavigate,
  isRail,
}: Readonly<{ item: NavItem; needsReviewCount: number; onNavigate?: () => void; isRail: boolean }>) {
  const pathname = usePathname();
  const slide = useEnterTransition();
  const isActive = isCurrent(item.href, pathname);
  const Icon = item.icon;
  return (
    <RailTip label={item.label} isRail={isRail}>
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "relative flex items-center gap-2.5 rounded-item px-2.5 py-2 text-text-secondary transition-colors duration-(--duration-fast) ease-out hover:text-text-primary",
          isRail && "justify-center px-0",
          isActive && "text-text-primary",
        )}
      >
        {isActive && (
          <motion.span
            layoutId="nav-selected"
            aria-hidden="true"
            className="absolute inset-0 rounded-item bg-surface-selected"
            transition={slide}
          />
        )}
        <Icon aria-hidden="true" className="relative size-4 shrink-0" />
        {/* Not `cn("relative flex-1", "sr-only")`: `relative` wins over sr-only's `absolute`, the hidden label stays in the flex row and pushes the rail icon off centre. */}
        <span className={isRail ? "sr-only" : "relative flex-1"}>{item.label}</span>
        {item.hasBadge && needsReviewCount > 0 && isRail && (
          // The count does not fit the rail; a dot says "something waits" and the label carries the number.
          <>
            <span aria-hidden="true" className="absolute top-1 right-1.5 size-2 rounded-full bg-text-muted" />
            <span className="sr-only">{needsReviewCount} need review</span>
          </>
        )}
        {item.hasBadge && needsReviewCount > 0 && !isRail && (
          <span
            className="relative rounded-chip bg-surface-control px-1.5 font-mono text-xs text-text-primary"
            aria-label={`${needsReviewCount} need review`}
          >
            {needsReviewCount}
          </span>
        )}
      </Link>
    </RailTip>
  );
}

/** The rail's name for a link: a tooltip that opens on focus as well as hover, so a keyboard user sees it too. Outside the rail the label is visible and there is nothing to add. */
function RailTip({ label, isRail, children }: Readonly<{ label: string; isRail: boolean; children: ReactElement }>) {
  if (!isRail) return children;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The rail has no room for the list, so its Keyboard shortcuts control opens it in a dialog. */
function ShortcutsDialog({ searchShortcut }: Readonly<{ searchShortcut: string }>) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Keyboard shortcuts"
        className="flex w-full items-center justify-center rounded-item py-2 text-text-secondary transition-colors duration-(--duration-fast) ease-out hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <Keyboard aria-hidden="true" className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription className="sr-only">Every shortcut the review app binds.</DialogDescription>
        <ShortcutList searchShortcut={searchShortcut} className="text-sm" />
      </DialogContent>
    </Dialog>
  );
}

function ShortcutList({ searchShortcut, className }: Readonly<{ searchShortcut: string; className?: string }>) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2 text-xs text-text-muted", className)}>
      <ShortcutRow keys={[searchShortcut]} label="Search and actions" />
      {SHORTCUT_LIST.map((shortcut) => (
        <ShortcutRow key={shortcut.label} keys={shortcut.keys} label={shortcut.label} />
      ))}
    </dl>
  );
}

function ShortcutRow({ keys, label }: Readonly<{ keys: readonly string[]; label: string }>) {
  return (
    <>
      <dt className="flex gap-1">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </dt>
      <dd>{label}</dd>
    </>
  );
}
