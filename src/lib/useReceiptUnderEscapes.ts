"use client";

import { useMemo } from "react";
import type { ReceiptRecord, Review } from "@/contracts";
import { decideChange } from "@/lib/decideChange";
import type { ReportCardInput } from "@/lib/decideChange";
import { receiptUnderEscapes } from "@/lib/receiptUnderEscapes";
import type { ReceiptUnderEscapes } from "@/lib/receiptUnderEscapes";
import { useEscapes } from "@/lib/simulation/escapes";

/**
 * The receipt's state under the browser's simulated escapes, recomputed when
 * one is recorded or reset, so S2 and S4 agree with the inbox without a reload.
 * Null when the change has no readable review or receipt to compare.
 */
export function useReceiptUnderEscapes(
  review: Review | null,
  record: ReceiptRecord | null,
  reportCard: ReportCardInput,
): ReceiptUnderEscapes | null {
  const { escapes } = useEscapes();
  return useMemo(() => {
    if (review === null || record === null) return null;
    const { decision } = decideChange(review, reportCard, escapes);
    return receiptUnderEscapes(review, record, decision, escapes);
  }, [review, record, reportCard, escapes]);
}
