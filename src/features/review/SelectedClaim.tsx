"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface SelectedClaim {
  /** The claim whose cited lines the diff highlights, or null. */
  selectedClaimId: string | null;
  setSelectedClaimId: (claimId: string | null) => void;
}

const SelectedClaimContext = createContext<SelectedClaim | null>(null);

/**
 * Page-level state shared by the diff and the review steps panel: which claim
 * is selected. The diff reads it to highlight the claim's cited lines; the
 * steps panel will set it when a person opens a claim.
 */
export function SelectedClaimProvider({ children }: { children: ReactNode }) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const value = useMemo(() => ({ selectedClaimId, setSelectedClaimId }), [selectedClaimId]);
  return <SelectedClaimContext.Provider value={value}>{children}</SelectedClaimContext.Provider>;
}

/** The selected claim and its setter; must sit inside `SelectedClaimProvider`. */
export function useSelectedClaim(): SelectedClaim {
  const value = useContext(SelectedClaimContext);
  if (value === null) throw new Error("useSelectedClaim needs a SelectedClaimProvider above it.");
  return value;
}
