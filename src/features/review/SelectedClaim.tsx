"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Citation } from "@/contracts";

/** What the person picked: a claim or a finding, and optionally the one citation to bring into view first. */
export interface Selection {
  kind: "claim" | "finding";
  id: string;
  /** The citation to scroll to; the first cited line when absent. */
  focus?: Citation;
}

interface SelectedClaim {
  /** The current selection, a new object on every press so pressing the same citation again scrolls again; null when nothing is selected. */
  selection: Selection | null;
  /** The claim whose cited lines the diff highlights, or null. */
  selectedClaimId: string | null;
  /** Selects a claim (null clears), optionally focusing one of its citations. */
  setSelectedClaimId: (claimId: string | null, focus?: Citation) => void;
  /** The finding (a contradiction, a defect) whose cited lines the diff highlights, or null. */
  selectedFindingId: string | null;
  setSelectedFindingId: (findingId: string | null, focus?: Citation) => void;
}

const SelectedClaimContext = createContext<SelectedClaim | null>(null);

/**
 * Page-level state shared by the diff and the review steps panel: which claim
 * or finding is selected, and which of its citations to bring into view. The
 * diff reads it to highlight the cited lines and scroll to the focus; the
 * steps panel sets it. One selection at a time, so the diff never highlights
 * two unrelated things, and the scroll target travels with the selection
 * instead of racing it.
 */
export function SelectedClaimProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const value = useMemo<SelectedClaim>(
    () => ({
      selection,
      selectedClaimId: selection?.kind === "claim" ? selection.id : null,
      setSelectedClaimId: (id, focus) => setSelection(id === null ? null : { kind: "claim", id, focus }),
      selectedFindingId: selection?.kind === "finding" ? selection.id : null,
      setSelectedFindingId: (id, focus) => setSelection(id === null ? null : { kind: "finding", id, focus }),
    }),
    [selection],
  );
  return <SelectedClaimContext.Provider value={value}>{children}</SelectedClaimContext.Provider>;
}

/** The selected claim or finding and their setters; must sit inside `SelectedClaimProvider`. */
export function useSelectedClaim(): SelectedClaim {
  const value = useContext(SelectedClaimContext);
  if (value === null) throw new Error("useSelectedClaim needs a SelectedClaimProvider above it.");
  return value;
}
