"use client";

import { useMemo } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import type { Citation, ReceiptRecord, Review } from "@/contracts";
import type { ReportCardInput } from "@/features/inbox";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";
import { useEnterTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BlindCheckStep } from "./BlindCheckStep";
import { ReadStep } from "./ReadStep";
import { RefusedStep } from "./RefusedStep";
import { SignStep } from "./SignStep";
import { STEP_IDS, buildBlindCheck, buildRefusals, buildSignView, buildStepTabs, buildStory } from "./stepsModel";
import type { StepId } from "./stepsModel";

/** The panel's DOM id: the mobile Sign bar and the step keys scroll it into view. */
export const REVIEW_STEPS_ID = "review-steps";

const tabId = (step: StepId) => `step-tab-${step}`;
const panelId = (step: StepId) => `step-panel-${step}`;

interface ReviewStepsProps {
  review: Review;
  reportCard: ReportCardInput;
  record: ReceiptRecord | null;
  status: ReceiptStatusValue;
  step: StepId;
  onStepChange: (step: StepId) => void;
  /** Brings a hunk into view in the diff. */
  onShowHunk: (hunkId: string) => void;
  /** Brings a cited line into view in the diff. */
  onShowCitation: (citation: Citation) => void;
}

/**
 * The Review steps panel: four tabs, 1 Read, 2 Blind check, 3 Refused and
 * 4 Sign, that take a person from the AI's story to a named signature. Tabs
 * follow the WAI-ARIA pattern (arrow keys, Home and End move and select; the
 * keys 1 to 4 are bound by `useStepKeys`). The active underline slides
 * between tabs through one shared `layoutId`. UI plan section 5.2.
 */
export function ReviewSteps({ review, reportCard, record, status, step, onStepChange, onShowHunk, onShowCitation }: ReviewStepsProps) {
  const tabs = useMemo(() => buildStepTabs(review, record, status), [review, record, status]);
  const slide = useEnterTransition();

  function moveBetweenTabs(event: KeyboardEvent<HTMLDivElement>) {
    const current = STEP_IDS.indexOf(step);
    const target = {
      ArrowRight: (current + 1) % STEP_IDS.length,
      ArrowLeft: (current + STEP_IDS.length - 1) % STEP_IDS.length,
      Home: 0,
      End: STEP_IDS.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onStepChange(STEP_IDS[target]);
    document.getElementById(tabId(STEP_IDS[target]))?.focus();
  }

  return (
    <section id={REVIEW_STEPS_ID} aria-labelledby="review-steps-heading" className="scroll-mt-4 overflow-hidden rounded-page border border-border-subtle bg-surface-panel wide:sticky wide:top-4 wide:flex wide:max-h-[calc(100dvh-2rem)] wide:flex-col">
      <h2 id="review-steps-heading" className="sr-only">
        Review steps
      </h2>
      <div role="tablist" aria-label="Review steps" onKeyDown={moveBetweenTabs} className="grid grid-cols-4 border-b border-border-subtle">
        {tabs.map((tab) => {
          const isActive = tab.id === step;
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId(tab.id)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onStepChange(tab.id)}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-0.5 px-1 py-2.5 text-sm transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
                isActive ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
              )}
            >
              <span className="text-center font-medium">
                <span className="mr-1 font-mono text-xs text-text-muted">{tab.number}</span>
                {tab.label}
              </span>
              <span
                className={cn(
                  "text-xs",
                  tab.tone === "neutral" && "text-text-muted",
                  tab.tone === "amber" && "text-amber-light",
                  tab.tone === "rose" && "text-rose-light",
                )}
              >
                {tab.count}
              </span>
              {isActive && (
                <motion.span layoutId="review-steps-underline" aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 bg-brand" transition={slide} />
              )}
            </button>
          );
        })}
      </div>
      <div id={panelId(step)} role="tabpanel" aria-labelledby={tabId(step)} tabIndex={0} className="p-4 wide:min-h-0 wide:overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring">
        <ActiveStep {...{ review, reportCard, record, status, step, onStepChange, onShowHunk, onShowCitation }} />
      </div>
    </section>
  );
}

function ActiveStep({ review, reportCard, record, status, step, onStepChange, onShowHunk, onShowCitation }: ReviewStepsProps) {
  const story = useMemo(() => buildStory(review), [review]);
  const blindCheck = useMemo(() => buildBlindCheck(review, reportCard), [review, reportCard]);
  const refusals = useMemo(() => buildRefusals(review, record, status), [review, record, status]);
  const signView = useMemo(() => buildSignView(review, record, status), [review, record, status]);

  if (step === "read") return <ReadStep story={story} onShowCitation={onShowCitation} onOpenRefused={() => onStepChange("refused")} />;
  if (step === "blind") return <BlindCheckStep blindCheck={blindCheck} onShowCitation={onShowCitation} />;
  if (step === "refused") return <RefusedStep refusals={refusals} onShowHunk={onShowHunk} />;
  return <SignStep view={signView} review={review} />;
}
