"use client";

import { Check } from "lucide-react";
import type { KeyboardEvent } from "react";
import { AreaChip } from "@/components/AreaChip";
import { CoverageMark } from "@/components/CoverageMark";
import { cn } from "@/lib/utils";
import type { NavigatorGroup } from "./reviewModel";

interface NavigatorProps {
  groups: NavigatorGroup[];
  /** The hunk last jumped to. */
  activeHunkId: string | null;
  /** Hunks marked read; drives the "n/m read" progress of the Read this group. */
  readIds: ReadonlySet<string>;
  onJump: (hunkId: string) => void;
}

const ITEM_SELECTOR = "button[data-navigator-item]";

/**
 * The hunk navigator: every hunk of the change grouped by coverage, Read
 * this first. Pick one to scroll the diff to it and focus its header. Arrow
 * keys move between items; Enter or Space jumps. A column from 1100 px.
 */
export function HunkNavigator({ groups, activeHunkId, readIds, onJump }: NavigatorProps) {
  function moveFocus(event: KeyboardEvent<HTMLElement>) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR)];
    const next = items[items.indexOf(document.activeElement as HTMLButtonElement) + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  return (
    <nav
      aria-label="Hunks"
      onKeyDown={moveFocus}
      className="hidden w-56 shrink-0 wide:block xwide:w-navigator"
    >
      <div className="sticky top-0 flex max-h-dvh flex-col gap-4 overflow-y-auto py-4 pr-1">
        {groups.map((group) => (
          <section key={group.coverage} aria-labelledby={`navigator-${group.coverage}`}>
            <h2 id={`navigator-${group.coverage}`} className="flex items-baseline justify-between px-2 pb-1 text-xs font-medium text-text-muted">
              <span className={cn(group.coverage === "read" && "text-amber")}>{group.title}</span>
              <span className="tabular-nums">{groupCount(group, readIds)}</span>
            </h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.hunkId + String(item.isGenerated)}>
                  <button
                    type="button"
                    data-navigator-item
                    aria-current={item.hunkId === activeHunkId ? "true" : undefined}
                    onClick={() => onJump(item.hunkId)}
                    className="flex w-full items-center gap-2 rounded-item px-2 py-1.5 text-left transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover aria-[current=true]:bg-surface-selected"
                  >
                    <CoverageMark coverage={item.coverage} isLabelHidden />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">{item.label}</span>
                    {readIds.has(item.hunkId) && !item.isGenerated && (
                      <>
                        <Check aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
                        <span className="sr-only">Read</span>
                      </>
                    )}
                    {item.area && <AreaChip area={item.area} />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

/** "1/2 read" for the Read this group, the plain hunk count for the others. */
function groupCount(group: NavigatorGroup, readIds: ReadonlySet<string>): string {
  if (group.coverage !== "read") return String(group.hunkCount);
  const done = group.items.filter((item) => readIds.has(item.hunkId)).length;
  return `${done}/${group.hunkCount} read`;
}

/**
 * Below 1100 px the navigator is a dropdown above the diff: a native select,
 * so it works with every keyboard and screen reader and opens the platform's
 * own picker on a phone.
 */
export function HunkDropdown({ groups, activeHunkId, onJump }: Omit<NavigatorProps, "readIds">) {
  return (
    <div className="hidden compact:block wide:hidden">
      <label htmlFor="hunk-dropdown" className="sr-only">
        Jump to a hunk
      </label>
      <select
        id="hunk-dropdown"
        value={activeHunkId ?? ""}
        onChange={(event) => event.target.value && onJump(event.target.value)}
        className="h-9 w-full rounded-control border border-border-default bg-surface-control px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <option value="" disabled>
          Jump to a hunk
        </option>
        {groups.map((group) => (
          <optgroup key={group.coverage} label={`${group.title} (${group.hunkCount})`}>
            {group.items.map((item) => (
              <option key={item.hunkId + String(item.isGenerated)} value={item.hunkId}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
