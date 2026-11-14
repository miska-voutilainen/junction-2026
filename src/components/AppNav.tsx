"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { Gauge, Inbox, Keyboard, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Disclosure } from "@/components/Disclosure";
import { Kbd } from "@/components/ui/kbd";
import { useEnterTransition } from "@/lib/motion";
import { SHORTCUT_LIST, useSearchShortcutLabel } from "@/lib/useShortcuts";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: LucideIcon; hasBadge?: boolean };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Review", items: [{ label: "Inbox", href: "/", icon: Inbox, hasBadge: true }] },
  {
    label: "Insights",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Reviewer", href: "/reviewer", icon: Gauge },
    ],
  },
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
 */
export function AppNav({ needsReviewCount, onNavigate }: Readonly<{ needsReviewCount: number; onNavigate?: () => void }>) {
  const pathname = usePathname();
  // Two navs can be mounted (the page's and the sheet's); a group id keeps their highlights apart.
  const groupId = useId();
  const slide = useEnterTransition();
  const searchShortcut = useSearchShortcutLabel();

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 px-2.5 pt-4 pb-3 text-sm">
      <LayoutGroup id={groupId}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1.5 text-xs font-semibold text-text-faint">{group.label}</div>
            {group.items.map((item) => {
              const isActive = isCurrent(item.href, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-item px-2.5 py-2 text-text-secondary transition-colors duration-(--duration-fast) ease-out hover:text-text-primary",
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
                  <span className="relative flex-1">{item.label}</span>
                  {item.hasBadge && needsReviewCount > 0 && (
                    <span
                      className="relative rounded-chip bg-surface-control px-1.5 font-mono text-xs text-text-primary"
                      aria-label={`${needsReviewCount} need review`}
                    >
                      {needsReviewCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </LayoutGroup>

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Disclosure
          title={
            <span className="flex items-center gap-2.5">
              <Keyboard aria-hidden="true" className="size-4" />
              Keyboard shortcuts
            </span>
          }
        >
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2 py-1 pr-2.5 pl-9 text-xs text-text-muted">
            <ShortcutRow keys={[searchShortcut]} label="Search and actions" />
            {SHORTCUT_LIST.map((shortcut) => (
              <ShortcutRow key={shortcut.label} keys={shortcut.keys} label={shortcut.label} />
            ))}
          </dl>
        </Disclosure>
      </div>
    </nav>
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
