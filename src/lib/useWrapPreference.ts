"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The kinds of console that remember their own Wrap choice. */
export type ConsoleKind = "diff" | "output" | "log";

const storageKey = (kind: ConsoleKind) => `cs-wrap-${kind}`;

const listeners = new Set<() => void>();
// Holds the choice only when localStorage refuses the write (private mode,
// quota), so a blocked store still lasts until the page closes.
const unsavedChoices = new Map<ConsoleKind, boolean>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readChoice(kind: ConsoleKind): boolean | null {
  // A choice the store refused is newer than anything it still holds.
  const unsaved = unsavedChoices.get(kind);
  if (unsaved !== undefined) return unsaved;
  try {
    const stored = window.localStorage.getItem(storageKey(kind));
    if (stored === "true" || stored === "false") return stored === "true";
    return null;
  } catch {
    return null;
  }
}

function writeChoice(kind: ConsoleKind, isWrapped: boolean): void {
  try {
    window.localStorage.setItem(storageKey(kind), String(isWrapped));
    unsavedChoices.delete(kind);
  } catch {
    unsavedChoices.set(kind, isWrapped);
  }
  listeners.forEach((notify) => notify());
}

/**
 * Whether a console wraps long lines, remembered per kind of console in
 * localStorage. A visitor who unwraps one diff finds the next diff unwrapped.
 *
 * The server and the first browser render use `defaultWrap`; the stored
 * choice applies right after hydration, so the markup matches. Every storage
 * access is guarded because the browser may block it.
 *
 * @returns `[isWrapped, setIsWrapped]`
 */
export function useWrapPreference(
  kind: ConsoleKind,
  defaultWrap: boolean,
): [boolean, (isWrapped: boolean) => void] {
  const choice = useSyncExternalStore(
    subscribe,
    () => readChoice(kind),
    () => null,
  );
  const setIsWrapped = useCallback((isWrapped: boolean) => writeChoice(kind, isWrapped), [kind]);
  return [choice ?? defaultWrap, setIsWrapped];
}
