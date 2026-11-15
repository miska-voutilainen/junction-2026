"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSelection } from "../SelectionProvider";
import type { StepId } from "./stepsModel";

/** The panel's DOM id: the Sign buttons scroll it into view. */
export const REVIEW_STEPS_ID = "review-steps";

interface ReviewStep {
  step: StepId;
  /** Shows a step. A finding's highlight belongs to the step that showed it, so it clears. */
  setStep: (step: StepId) => void;
  /** `setStep`, then scrolls the panel to the top of the screen: for buttons far from it (the header, the phone's Sign bar). */
  openStep: (step: StepId) => void;
}

const ReviewStepContext = createContext<ReviewStep | null>(null);

/**
 * Which review step is open, shared by the panel, the `1` to `4` keys, the
 * header's Sign button and the phone's Sign bar. Sits inside
 * `SelectionProvider` because changing step clears a finding's highlight.
 */
export function ReviewStepProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [step, setStepState] = useState<StepId>("read");
  const { selection, setSelectedFindingId } = useSelection();
  const isFindingSelected = selection?.kind === "finding";

  const value = useMemo<ReviewStep>(() => {
    const setStep = (next: StepId) => {
      setStepState(next);
      if (isFindingSelected) setSelectedFindingId(null);
    };
    return {
      step,
      setStep,
      openStep: (next) => {
        setStep(next);
        document.getElementById(REVIEW_STEPS_ID)?.scrollIntoView({ block: "start" });
      },
    };
  }, [step, isFindingSelected, setSelectedFindingId]);
  return <ReviewStepContext.Provider value={value}>{children}</ReviewStepContext.Provider>;
}

/** The open step and its setters; must sit inside `ReviewStepProvider`. */
export function useReviewStep(): ReviewStep {
  const value = useContext(ReviewStepContext);
  if (value === null)
    throw new Error(
      "useReviewStep needs a ReviewStepProvider above it. ReviewScreen mounts one around the steps panel; render this inside it.",
    );
  return value;
}
