"use client";

import { useEffect } from "react";
import { isTypingTarget } from "@/lib/useShortcuts";
import { REVIEW_STEPS_ID } from "./ReviewSteps";
import { STEP_IDS } from "./stepsModel";
import type { StepId } from "./stepsModel";

/**
 * Binds the keys `1` to `4` to the four review steps, on the review page only
 * (the other pages have nothing numbered). Ignores modified keys and typing in
 * a field. When the panel sits below the diff (narrow screens), the key also
 * scrolls it into view, so the step change is never invisible.
 */
export function useStepKeys(onStepChange: (step: StepId) => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const step = STEP_IDS[Number(event.key) - 1];
      if (step === undefined) return;
      event.preventDefault();
      onStepChange(step);
      document.getElementById(REVIEW_STEPS_ID)?.scrollIntoView({ block: "nearest" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStepChange]);
}
