/**
 * The Review steps panel as data: the four tabs (Read, Blind check, Refused,
 * Sign) and what each shows, built from one review, its report card and its
 * receipt. Pure functions, no React, so the order of the story, which
 * refusals the receipt accepted and which Sign state applies are unit-tested
 * and cannot differ from what is on screen. Spec section 3, S2 sidebar.
 */
import type { ReceiptRecord, Review } from "@/contracts";
import { buildRefusals, openRefusalCount } from "./refusalsModel";
import type { SignState } from "./signModel";
import { countOf } from "@/lib/countOf";

/** The four steps, in the order the person works through them. */
export type StepId = "read" | "blind" | "refused" | "sign";

/** One tab of the panel: "1 Read" with a short count under it. */
export interface StepTab {
  id: StepId;
  number: 1 | 2 | 3 | 4;
  label: string;
  /** What is waiting in this step, e.g. "2 found" or "Draft ready". */
  count: string;
  /** Counts that ask for attention (a contradiction, a stale receipt) read in colour as well as words. */
  tone: "neutral" | "amber" | "rose";
}

const STEP_LABELS: Record<StepId, string> = {
  read: "Read",
  blind: "Blind check",
  refused: "Refused",
  sign: "Sign",
};

/** The step ids in tab order; the `1` to `4` keys index into it. */
export const STEP_IDS: readonly StepId[] = ["read", "blind", "refused", "sign"];

/** The Refused tab's count: "None" without refusals, "All accepted" once the receipt took them all, else how many wait. */
function refusedCount(review: Review, openRefusals: number): string {
  if (review.refusals.length === 0) return "None";
  if (openRefusals === 0) return "All accepted";
  return `${openRefusals} open`;
}

/** The tabs with their counts, so a person sees which steps have something for them before opening one. */
export function buildStepTabs(
  review: Review,
  record: ReceiptRecord | null,
  signState: SignState,
): StepTab[] {
  const openRefusals = openRefusalCount(buildRefusals(review, record, signState));
  const contradictionCount = review.findings.filter(
    (finding) => finding.kind === "contradiction",
  ).length;
  const signCount: Record<SignState, Pick<StepTab, "count" | "tone">> = {
    "needs-review": { count: "Draft ready", tone: "neutral" },
    signed: { count: "Signed", tone: "neutral" },
    stale: { count: "Stale", tone: "amber" },
    unverified: { count: "Failed", tone: "rose" },
    unreadable: { count: "Unreadable", tone: "rose" },
  };
  const counts: Record<StepId, Pick<StepTab, "count" | "tone">> = {
    read: { count: countOf(review.claims.length, "claim"), tone: "neutral" },
    blind: {
      count: contradictionCount === 0 ? "None found" : `${contradictionCount} found`,
      tone: contradictionCount === 0 ? "neutral" : "rose",
    },
    refused: {
      count: refusedCount(review, openRefusals),
      tone: openRefusals === 0 ? "neutral" : "amber",
    },
    sign: signCount[signState],
  };
  return STEP_IDS.map((id, index) => ({
    id,
    number: (index + 1) as StepTab["number"],
    label: STEP_LABELS[id],
    ...counts[id],
  }));
}
