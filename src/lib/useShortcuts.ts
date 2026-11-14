"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PAGES } from "@/lib/pages";

// "g" then a letter must come as one gesture; a second later it is forgotten.
const GO_SEQUENCE_MS = 1000;

const GO_TARGETS: Record<string, string> = Object.fromEntries(PAGES.map((page) => [page.goKey, page.href]));

/** The page-level shortcuts that exist, in the order the nav lists them, after the search shortcut (its key depends on the platform, see `useSearchShortcutLabel`). */
export const SHORTCUT_LIST = [
  { keys: ["N"], label: "Review next" },
  { keys: ["j", "k"], label: "Move" },
  { keys: ["↵"], label: "Open" },
  { keys: ["1", "2", "3", "4"], label: "Review step" },
  ...PAGES.map((page) => ({ keys: ["g", page.goKey], label: page.title })),
] as const;

/**
 * Which way `j` and `k` move a list: 1 for forward, -1 for back, 0 for any other
 * key. Modifier keys and typing in a field give 0, so the shortcut never steals them.
 */
export function stepFromKey(event: KeyboardEvent, forwardKey = "j", backKey = "k"): -1 | 0 | 1 {
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return 0;
  if (event.key === forwardKey) return 1;
  return event.key === backKey ? -1 : 0;
}

/**
 * The index a step lands on in a list of `length`, clamped at both ends. With
 * nothing current yet (`current` is -1), forward lands on the first item and
 * back on the last.
 */
export function nextIndex(current: number, step: 1 | -1, length: number): number {
  if (current === -1) return step === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + step));
}

/** True when the key press belongs to a text field, so a shortcut must not steal it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Global keyboard shortcuts: Cmd/Ctrl+K opens search, N opens the next change
 * that needs review, `g` then `i` jumps to Inbox, `g` then `r` to the report card. Letter shortcuts ignore modifier keys and any focused field, so
 * typing "n" in a search box never navigates. `j`/`k` and `1`-`4` belong to the
 * pages that have something to move through.
 *
 * @param openSearch Called on Cmd/Ctrl+K.
 * @param reviewNextHref Where N goes, or null when nothing needs review.
 */
export function useShortcuts({
  openSearch,
  reviewNextHref,
}: {
  openSearch: () => void;
  reviewNextHref: string | null;
}) {
  const router = useRouter();
  const goPressedAt = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isGoSequenceOpen =
        goPressedAt.current !== null && event.timeStamp - goPressedAt.current < GO_SEQUENCE_MS;
      goPressedAt.current = null;

      if (isGoSequenceOpen && key in GO_TARGETS) {
        router.push(GO_TARGETS[key]);
      } else if (key === "g") {
        goPressedAt.current = event.timeStamp;
      } else if (key === "n" && reviewNextHref) {
        router.push(reviewNextHref);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch, reviewNextHref, router]);
}

const subscribeNever = () => () => {};

/**
 * The label for the search shortcut: "⌘K" on Apple platforms, "Ctrl K" elsewhere.
 * The server and the first client render say "⌘K", so hydration matches.
 */
export function useSearchShortcutLabel(): string {
  const isApple = useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
  return isApple ? "⌘K" : "Ctrl K";
}
