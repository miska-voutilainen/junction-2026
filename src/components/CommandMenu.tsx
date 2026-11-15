"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Copy, FileDiff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { fadeUpItem, popover, useMotionPreset, useStaggeredPreset } from "@/lib/motion";
import { countersignCommand } from "@/lib/countersignCommand";
import { PAGES } from "@/lib/pages";
import { COPY_ANNOUNCEMENT, useCopy } from "@/lib/useCopy";
import type { CopyStatus } from "@/lib/useCopy";
import { useShortcuts } from "@/lib/useShortcuts";
import type { ShellChange } from "./shellChange";

// The dialog is centred, at most this wide, and sits this far down the viewport; both the placement and the aim of the entrance at the trigger read it.
const MENU_MAX_WIDTH_PX = 640;
const MENU_TOP_DVH = 15;
const MENU_TOP_FRACTION = MENU_TOP_DVH / 100;
const MENU_SIDE_MARGIN_PX = 32;

type CommandMenuState = {
  isOpen: boolean;
  /** Opens the menu; `trigger` is the button to return focus to and to grow from. */
  open: (trigger?: HTMLElement | null) => void;
  close: () => void;
  trigger: HTMLElement | null;
};

const CommandMenuContext = createContext<CommandMenuState | null>(null);

/**
 * Holds whether the command menu is open and which button opened it, so the
 * top bar, the mobile header and the keyboard shortcut all drive one menu.
 * Mount once in the root layout.
 */
export function CommandMenuProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const open = useCallback((from?: HTMLElement | null) => {
    setTrigger(from ?? null);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close, trigger }), [isOpen, open, close, trigger]);
  return <CommandMenuContext value={value}>{children}</CommandMenuContext>;
}

/** Opens and closes the command menu from anywhere under the provider. */
export function useCommandMenu(): CommandMenuState {
  const state = useContext(CommandMenuContext);
  if (!state)
    throw new Error(
      "useCommandMenu needs a CommandMenuProvider above it. Mount one in src/app/layout.tsx.",
    );
  return state;
}

type Row = {
  id: string;
  label: string;
  meta: string;
  icon: LucideIcon;
  shortcut?: string[];
  /** Navigates here; a row without it runs `run` instead. */
  href?: string;
  run?: () => void;
  isPrimary?: boolean;
};

/**
 * The Cmd/Ctrl+K menu: quick actions, pages and every change in one filterable
 * list. Also registers the global shortcuts, since it knows the next change to
 * review. Render it once per page, inside the shell.
 *
 * @param changes The inbox in order; the first that needs review is "next".
 */
export function CommandMenu({ changes }: Readonly<{ changes: ShellChange[] }>) {
  const { isOpen, open, close, trigger } = useCommandMenu();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const nextChange = changes.find((change) => change.needsReview) ?? null;
  // "Copy sign command" targets the change on screen, else the next one to review.
  const changeInView = changes.find((change) => pathname === `/changes/${change.id}`) ?? nextChange;
  const needsReviewCount = changes.filter((change) => change.needsReview).length;
  const { status: copyStatus, copy } = useCopy();
  const menuEntrance = useMotionPreset(popover);

  // While open, the shortcut closes the menu: re-opening would make the search box the "trigger"
  // and Esc would then return focus to it instead of the button that was used first.
  const toggleSearch = useCallback(() => {
    if (isOpen) close();
    else open(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }, [isOpen, open, close]);

  useShortcuts({
    openSearch: toggleSearch,
    reviewNextHref: nextChange ? `/changes/${nextChange.id}` : null,
  });

  const changeRows: Row[] = changes.map((change) => ({
    id: `change-${change.id}`,
    label: change.title,
    meta: `${change.requirementId} · ${change.statusLabel}`,
    icon: FileDiff,
    href: `/changes/${change.id}`,
  }));

  function choose(row: Row) {
    if (row.href) {
      close();
      router.push(row.href);
    } else {
      row.run?.();
    }
  }

  function handleOpenChange(isNowOpen: boolean) {
    if (isNowOpen) return;
    close();
    setQuery("");
  }

  const groups = [
    { heading: "Quick actions", rows: buildQuickActions(nextChange, changeInView, copy) },
    { heading: "Go to", rows: buildPages(needsReviewCount) },
    { heading: "Changes", rows: changeRows },
  ].filter((group) => group.rows.length > 0);
  // Each group's first row number, so the staggered entrance counts rows across groups without mutating a counter while rendering.
  const firstRowOfGroup = groups.map((_, index) =>
    groups.slice(0, index).reduce((rows, group) => rows + group.rows.length, 0),
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        // The entrance is the motion element below; the exit is the dialog's own shorter fade.
        style={{ top: `${MENU_TOP_DVH}dvh` }}
        className="max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden rounded-menu border border-border-strong bg-surface-panel p-0 ring-0 sm:max-w-160 data-open:animate-none motion-reduce:data-closed:animate-none"
        onCloseAutoFocus={(event) => {
          // Return focus to the button that opened the menu, not whatever Radix remembered.
          if (trigger?.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogTitle className="sr-only">Quick actions</DialogTitle>
        <DialogDescription className="sr-only">
          Search changes, pages and actions.
        </DialogDescription>
        {/* min-w-0: the dialog is a grid; without it the list grows to its longest row and spills past a phone screen. */}
        <motion.div
          {...menuEntrance}
          className="min-w-0"
          style={{ transformOrigin: originFor(trigger) }}
        >
          <Command className="rounded-menu! bg-transparent p-0">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search changes or type a command…"
              aria-label="Search or run a command"
            />
            {/* The list takes what is left under the top offset, less the input and footer, so a short window scrolls the list instead of cutting the menu. */}
            <CommandList
              className="p-1"
              style={{ maxHeight: `min(25rem, calc(100dvh - ${MENU_TOP_DVH}dvh - 9rem))` }}
            >
              <CommandEmpty className="px-3 py-7 text-text-muted">
                No match for “{query}”. Try a change id, a requirement or a page.
              </CommandEmpty>
              {groups.map((group, groupIndex) => (
                <CommandGroup key={group.heading} heading={group.heading} className="p-1.5">
                  {group.rows.map((row, rowIndex) => (
                    <MenuRow
                      key={row.id}
                      row={row}
                      index={firstRowOfGroup[groupIndex] + rowIndex}
                      onChoose={choose}
                    />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <MenuFooter copyStatus={copyStatus} />
          </Command>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/** The key hints under the list, and the live region that says whether a copy worked. */
function MenuFooter({ copyStatus }: Readonly<{ copyStatus: CopyStatus }>) {
  return (
    <div className="flex h-9.5 items-center gap-3.5 border-t border-border-subtle bg-surface-raised px-3.5 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> move
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>↵</Kbd> open
      </span>
      <span className="flex-1" />
      <span role="status" aria-live="polite">
        {COPY_ANNOUNCEMENT[copyStatus]}
      </span>
    </div>
  );
}

function buildQuickActions(
  nextChange: ShellChange | null,
  changeInView: ShellChange | null,
  copySignCommand: (command: string) => void,
): Row[] {
  const rows: Row[] = [];
  if (nextChange) {
    rows.push({
      id: "review-next",
      label: "Review next change",
      meta: [nextChange.requirementId, nextChange.tierLabel].filter(Boolean).join(" · "),
      icon: ArrowRight,
      shortcut: ["N"],
      href: `/changes/${nextChange.id}`,
      isPrimary: true,
    });
  }
  if (changeInView) {
    const command = countersignCommand("sign", changeInView.id);
    rows.push({
      id: "copy-sign",
      label: "Copy sign command",
      meta: command,
      icon: Copy,
      run: () => copySignCommand(command),
    });
  }
  return rows;
}

/** What each page's menu row says under its title. */
const PAGE_MENU_NOTE: Record<(typeof PAGES)[number]["id"], (needsReviewCount: number) => string> = {
  inbox: (needsReviewCount) => `${needsReviewCount} need review`,
  dashboard: () => "Signed, accepted risk, open decisions",
  reviewer: () => "Trust by area",
};

function buildPages(needsReviewCount: number): Row[] {
  return PAGES.map((page) => ({
    id: `go-${page.id}`,
    label: page.title,
    meta: PAGE_MENU_NOTE[page.id](needsReviewCount),
    icon: page.icon,
    shortcut: ["g", page.goKey],
    href: page.href,
  }));
}

function MenuRow({
  row,
  index,
  onChoose,
}: Readonly<{ row: Row; index: number; onChoose: (row: Row) => void }>) {
  const Icon = row.icon;
  const entrance = useStaggeredPreset(fadeUpItem, index);
  return (
    <motion.div initial={entrance.initial} animate={entrance.animate}>
      <CommandItem
        value={`${row.label} ${row.meta}`}
        onSelect={() => onChoose(row)}
        className="gap-2.5 rounded-item px-2.5 py-2 data-selected:bg-surface-selected"
      >
        <span
          className={
            row.isPrimary
              ? "grid size-6.5 shrink-0 place-items-center rounded-item bg-brand text-primary-foreground"
              : "grid size-6.5 shrink-0 place-items-center rounded-item bg-surface-control text-text-secondary"
          }
        >
          <Icon aria-hidden="true" className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate">{row.label}</span>
          <span className="truncate text-xs text-text-muted">{row.meta}</span>
        </span>
        {row.shortcut && (
          <span className="flex gap-1">
            {row.shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        )}
      </CommandItem>
    </motion.div>
  );
}

/** Aims the entrance at the button that opened the menu, as a CSS transform-origin. */
function originFor(trigger: HTMLElement | null): string {
  if (!trigger || typeof window === "undefined") return "50% 0";
  const box = trigger.getBoundingClientRect();
  const menuWidth = Math.min(MENU_MAX_WIDTH_PX, window.innerWidth - MENU_SIDE_MARGIN_PX);
  const menuLeft = (window.innerWidth - menuWidth) / 2;
  const menuTop = window.innerHeight * MENU_TOP_FRACTION;
  return `${box.left + box.width / 2 - menuLeft}px ${box.top + box.height / 2 - menuTop}px`;
}
