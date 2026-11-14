"use client";

/**
 * Simulated escapes: a reviewer can record "a bug got through in this area" and
 * every tier on screen is recomputed with that area one trust level lower
 * (`applyEscapes`, spec section 5). Nothing is sent anywhere: the count per area
 * lives in this small store, persisted to localStorage, so it survives a reload
 * and is shared by every component without a provider.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { type Area, AreaSchema } from "@/contracts";

/** Escapes recorded per area; an area with none is absent. */
export type Escapes = Partial<Record<Area, number>>;

/** Id of the toast that reports a recorded escape, so Reset dismisses that toast and no other. */
export const ESCAPE_TOAST_ID = "simulated-escape";

/** localStorage key; the version suffix lets a later shape change start clean. */
export const escapesStorageKey = "countersign.escapes.v1";

const StoredEscapesSchema = z.partialRecord(AreaSchema, z.number().int().positive());

// One frozen object for the server and for "nothing recorded": React compares snapshots by identity.
const noEscapes: Escapes = Object.freeze({});

let current: Escapes | null = null;
const listeners = new Set<() => void>();

/** The stored value, or nothing when storage is unavailable, empty or corrupt. */
function readStorage(): Escapes {
  try {
    const text = window.localStorage.getItem(escapesStorageKey);
    if (text === null) return noEscapes;
    const parsed = StoredEscapesSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : noEscapes;
  } catch {
    return noEscapes;
  }
}

function writeStorage(escapes: Escapes): void {
  try {
    window.localStorage.setItem(escapesStorageKey, JSON.stringify(escapes));
  } catch {
    // Private mode or a full quota: the escapes still work until the page closes.
  }
}

function getSnapshot(): Escapes {
  current ??= readStorage();
  return current;
}

function getServerSnapshot(): Escapes {
  return noEscapes;
}

function set(next: Escapes): void {
  current = next;
  writeStorage(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab recorded or reset: reread so both tabs show the same tiers.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== escapesStorageKey) return;
    current = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The simulated escapes with the actions the UI needs: record, undo, reset. */
export interface EscapesApi {
  /** Escapes recorded per area. */
  escapes: Escapes;
  /** Sum over all areas; the top bar shows it when above zero. */
  total: number;
  /** Records one more escape in `area`. */
  record: (area: Area) => void;
  /** Takes back one escape in `area`; does nothing when none is recorded there. */
  undo: (area: Area) => void;
  /** Clears every recorded escape. */
  reset: () => void;
}

/**
 * Reads and changes the simulated escapes.
 * Empty on the server and during hydration, then the stored value.
 */
export function useEscapes(): EscapesApi {
  const escapes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const record = useCallback((area: Area) => {
    const now = getSnapshot();
    set({ ...now, [area]: (now[area] ?? 0) + 1 });
  }, []);
  const undo = useCallback((area: Area) => {
    const now = getSnapshot();
    const remaining = (now[area] ?? 0) - 1;
    if (remaining < 0) return;
    // Drop the key at zero: the stored shape only holds positive counts.
    const next = { ...now };
    if (remaining === 0) delete next[area];
    else next[area] = remaining;
    // The rows are back on their earlier tier, so there is nothing left to highlight.
    pendingReroutedIds = [];
    set(next);
  }, []);
  const reset = useCallback(() => {
    pendingReroutedIds = [];
    set(noEscapes);
  }, []);
  return useMemo(
    () => ({ escapes, total: Object.values(escapes).reduce((sum, count) => sum + count, 0), record, undo, reset }),
    [escapes, record, undo, reset],
  );
}

// Ids re-routed by the last recorded escape, waiting for S1 to highlight them.
// Memory only: a reload or a second visit shows no highlight.
let pendingReroutedIds: string[] = [];

/** Remembers which changes escapes re-routed, for the inbox's brief highlight; several escapes before S1 opens add up. */
export function markRerouted(changeIds: string[]): void {
  pendingReroutedIds = [...new Set([...pendingReroutedIds, ...changeIds])];
}

/**
 * The ids `markRerouted` stored, without clearing them. Read during render, and
 * cleared by `clearRerouted` only after the inbox has mounted: React may start a
 * render and throw it away (a navigation transition), and a read that also cleared
 * would leave the render that does mount with nothing to highlight.
 */
export function peekRerouted(): string[] {
  return pendingReroutedIds;
}

/** Forgets the stored ids once the inbox has shown them, so the highlight plays one visit. */
export function clearRerouted(): void {
  pendingReroutedIds = [];
}
