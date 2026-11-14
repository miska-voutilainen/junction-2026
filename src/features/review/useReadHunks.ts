"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const storageKey = (changeId: string) => `cs-read-hunks-${changeId}`;
const listeners = new Set<() => void>();
// Holds the marks only when sessionStorage refuses the write, so a blocked store still lasts until the page closes.
const unsavedMarks = new Map<string, string>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function readRaw(changeId: string): string {
  const unsaved = unsavedMarks.get(changeId);
  if (unsaved !== undefined) return unsaved;
  try {
    return window.sessionStorage.getItem(storageKey(changeId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeRaw(changeId: string, raw: string): void {
  try {
    window.sessionStorage.setItem(storageKey(changeId), raw);
    unsavedMarks.delete(changeId);
  } catch {
    unsavedMarks.set(changeId, raw);
  }
  listeners.forEach((notify) => notify());
}

function parseIds(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** What the reader has marked read, and the toggle. */
export interface ReadHunks {
  /** Ids of the hunks marked read in this browser tab. */
  readIds: ReadonlySet<string>;
  /** Marks the hunk read, or unmarks it. */
  toggle: (hunkId: string) => void;
}

/**
 * Which hunks the reader has marked read. Browser-only and per tab
 * (sessionStorage): the mark is a reading aid, not a record. The signed
 * receipt is the record. Empty on the server and during hydration.
 */
export function useReadHunks(changeId: string): ReadHunks {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(changeId),
    () => "[]",
  );
  const readIds = useMemo(() => parseIds(raw), [raw]);
  const toggle = useCallback(
    (hunkId: string) => {
      const next = parseIds(readRaw(changeId));
      if (!next.delete(hunkId)) next.add(hunkId);
      writeRaw(changeId, JSON.stringify([...next]));
    },
    [changeId],
  );
  return { readIds, toggle };
}
