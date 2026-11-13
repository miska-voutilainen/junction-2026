"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

// "g" then a letter must come as one gesture; a second later it is forgotten.
const GO_SEQUENCE_MS = 1000;

const GO_TARGETS: Record<string, string> = { i: "/" };

/** The page-level shortcuts that exist, in the order the nav lists them. */
export const SHORTCUT_LIST = [
  { keys: ["⌘K"], label: "Search and actions" },
  { keys: ["N"], label: "Review next" },
  { keys: ["j", "k"], label: "Move" },
  { keys: ["↵"], label: "Open" },
  { keys: ["g", "i"], label: "Inbox" },
  { keys: ["1–4"], label: "Review steps" },
] as const;

/** True when the key press belongs to a text field, so a shortcut must not steal it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Global keyboard shortcuts: Cmd/Ctrl+K opens search, N opens the next change
 * that needs review, `g` then `i` jumps to Inbox. Letter shortcuts ignore modifier keys and any focused field, so
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
