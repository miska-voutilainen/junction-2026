"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { HunkSections } from "./reviewModel";

/** The id of the element that takes focus when the reader jumps to a hunk. */
export function hunkHeaderId(hunkId: string): string {
  return `hunk-header-${hunkId}`;
}

/** What the diff keeps open, and how to bring one hunk into view. */
export interface DiffReveal {
  isCoveredOpen: boolean;
  setCoveredOpen: (isOpen: boolean) => void;
  isGeneratedOpen: boolean;
  setGeneratedOpen: (isOpen: boolean) => void;
  /** Covered hunks the reader has expanded to see their diff. */
  expandedIds: ReadonlySet<string>;
  toggleExpanded: (hunkId: string) => void;
  /** The hunk last jumped to; the navigator marks it `aria-current`. */
  activeHunkId: string | null;
  /** Opens whatever hides the hunk, scrolls its header to the top of the view and focuses it. */
  jumpTo: (hunkId: string) => void;
  /** Opens the hunk and scrolls its first highlighted line to the middle of the view, without taking focus. */
  showHighlight: (hunkId: string) => void;
}

type Pending = { hunkId: string; mode: "focus" | "highlight" };

/**
 * Open and closed state of the covered and generated sections and the
 * expanded covered hunks, plus jumping to a hunk. Covered hunks sit in
 * collapsed rows, so a jump has to open them first and can only scroll once
 * they are on screen; the jump is stored and carried out after the render
 * that opened them.
 */
export function useDiffReveal(sections: HunkSections): DiffReveal {
  const [isCoveredOpen, setCoveredOpen] = useState(false);
  const [isGeneratedOpen, setGeneratedOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [activeHunkId, setActiveHunkId] = useState<string | null>(null);
  // Bumped on every jump so the page renders and the effect below runs, even when no open state changed.
  const [, setJumpCount] = useState(0);
  const pending = useRef<Pending | null>(null);
  const isReduced = useReducedMotion();

  const openHiding = useCallback(
    (hunkId: string) => {
      if (sections.read.some((entry) => entry.hunk.id === hunkId)) return;
      if (sections.covered.some((entry) => entry.hunk.id === hunkId)) setCoveredOpen(true);
      if (sections.generated.some((entry) => entry.hunk.id === hunkId)) setGeneratedOpen(true);
      setExpandedIds((ids) => new Set(ids).add(hunkId));
    },
    [sections],
  );

  const jumpTo = useCallback(
    (hunkId: string) => {
      openHiding(hunkId);
      setActiveHunkId(hunkId);
      pending.current = { hunkId, mode: "focus" };
      setJumpCount((count) => count + 1);
    },
    [openHiding],
  );

  const showHighlight = useCallback(
    (hunkId: string) => {
      openHiding(hunkId);
      pending.current = { hunkId, mode: "highlight" };
      setJumpCount((count) => count + 1);
    },
    [openHiding],
  );

  const toggleExpanded = useCallback((hunkId: string) => {
    setExpandedIds((ids) => {
      const next = new Set(ids);
      if (!next.delete(hunkId)) next.add(hunkId);
      return next;
    });
  }, []);

  // Runs after every render and does nothing unless a jump is waiting, so it sees the state the jump opened.
  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    const behavior = isReduced ? "auto" : "smooth";
    if (target.mode === "focus") {
      const header = document.getElementById(hunkHeaderId(target.hunkId));
      if (!header) return;
      pending.current = null;
      header.scrollIntoView({ block: "start", behavior });
      header.focus({ preventScroll: true });
      return;
    }
    const line = document.querySelector(
      `[data-hunk-id="${CSS.escape(target.hunkId)}"] tr[data-highlighted]`,
    );
    if (!line) return;
    pending.current = null;
    line.scrollIntoView({ block: "center", behavior });
  });

  return {
    isCoveredOpen,
    setCoveredOpen,
    isGeneratedOpen,
    setGeneratedOpen,
    expandedIds,
    toggleExpanded,
    activeHunkId,
    jumpTo,
    showHighlight,
  };
}
