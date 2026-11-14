"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface SelectedClaim {
  /** The claim whose cited lines the diff highlights, or null. */
  selectedClaimId: string | null;
  setSelectedClaimId: (claimId: string | null) => void;
  /** The finding (a contradiction, a defect) whose cited lines the diff highlights, or null. */
  selectedFindingId: string | null;
  setSelectedFindingId: (findingId: string | null) => void;
}

const SelectedClaimContext = createContext<SelectedClaim | null>(null);

type Selection = { kind: "claim" | "finding"; id: string } | null;

/**
 * Page-level state shared by the diff and the review steps panel: which claim
 * or finding is selected. The diff reads it to highlight the cited lines; the
 * steps panel sets it when a person opens a claim or a contradiction. One
 * selection at a time, so the diff never highlights two unrelated things.
 */
export function SelectedClaimProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  const value = useMemo<SelectedClaim>(
    () => ({
      selectedClaimId: selection?.kind === "claim" ? selection.id : null,
      setSelectedClaimId: (id) => setSelection(id === null ? null : { kind: "claim", id }),
      selectedFindingId: selection?.kind === "finding" ? selection.id : null,
      setSelectedFindingId: (id) => setSelection(id === null ? null : { kind: "finding", id }),
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
