"use client";

import { useMemo } from "react";
import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import type { ReceiptRecord, Review } from "@/contracts";
import type { ReportCardInput } from "@/features/inbox";
import { useEnterTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BlindCheckStep } from "./BlindCheckStep";
import { ReadStep } from "./ReadStep";
import { RefusedStep } from "./RefusedStep";
import { SignStep } from "./SignStep";
import { REVIEW_STEPS_ID } from "./ReviewStep";
import { STEP_IDS, buildBlindCheck, buildRefusals, buildSignView, buildStepTabs, buildStory } from "./stepsModel";
import type { SignState, StepId } from "./stepsModel";

const tabId = (step: StepId) => `step-tab-${step}`;
const panelId = (step: StepId) => `step-panel-${step}`;

interface ReviewStepsProps {
  review: Review;
  reportCard: ReportCardInput;
  record: ReceiptRecord | null;
  signState: SignState;
  step: StepId;
  onStepChange: (step: StepId) => void;
  /** Brings a hunk into view in the diff. */
  onShowHunk: (hunkId: string) => void;
}

/**
 * The Review steps panel: four tabs, 1 Read, 2 Blind check, 3 Refused and
 * 4 Sign, that take a person from the AI's story to a named signature. Tabs
 * follow the WAI-ARIA pattern (arrow keys, Home and End move and select; the
 * keys 1 to 4 are bound by `useStepKeys`). The active underline slides
 * between tabs through one shared `layoutId`. UI plan section 5.2.
 */
export function ReviewSteps({ review, reportCard, record, signState, step, onStepChange, onShowHunk }: Readonly<ReviewStepsProps>) {
  const tabs = useMemo(() => buildStepTabs(review, record, signState), [review, record, signState]);
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
    <section id={REVIEW_STEPS_ID} aria-labelledby="review-steps-heading" className="scroll-mt-4 compact:scroll-mt-scroll-clear overflow-hidden rounded-page border border-border-subtle bg-surface-panel wide:sticky wide:top-scroll-clear wide:flex wide:max-h-[calc(var(--spacing-below-topbar)-2rem)] wide:flex-col">
      <h2 id="review-steps-heading" className="sr-only">
        Review steps
      </h2>
      {/* Roving tabindex: the active tab is focusable, which the lint rule cannot see across the map. */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
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
                <span className="mr-1 text-xs text-text-muted tabular-nums">{tab.number}</span>
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
      {STEP_IDS.map((id) => (
        // All four panels exist so every tab's aria-controls resolves; only the open one has content.
        <div
          key={id}
          id={panelId(id)}
          role="tabpanel"
          aria-labelledby={tabId(id)}
          hidden={id !== step}
          tabIndex={0}
          className="p-4 wide:min-h-0 wide:overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
        >
          {id === step && <ActiveStep {...{ review, reportCard, record, signState, step, onStepChange, onShowHunk }} />}
        </div>
      ))}
    </section>
  );
}

function ActiveStep({ review, reportCard, record, signState, step, onStepChange, onShowHunk }: Readonly<ReviewStepsProps>) {
  const story = useMemo(() => buildStory(review), [review]);
  const blindCheck = useMemo(() => buildBlindCheck(review, reportCard), [review, reportCard]);
  const refusals = useMemo(() => buildRefusals(review, record, signState), [review, record, signState]);
  const signView = useMemo(() => buildSignView(review, record, signState), [review, record, signState]);

  if (step === "read") return <ReadStep story={story} onOpenRefused={() => onStepChange("refused")} />;
  if (step === "blind") return <BlindCheckStep blindCheck={blindCheck} />;
  if (step === "refused") return <RefusedStep refusals={refusals} onShowHunk={onShowHunk} />;
  return <SignStep view={signView} review={review} />;
}
