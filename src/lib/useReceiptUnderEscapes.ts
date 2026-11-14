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
 *
 * @param review the recorded review, or null when missing or unreadable
 * @param record the change receipt, or null when it has none or is unreadable
 * @param reportCard the report card behind the routing
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
    return receiptUnderEscapes(review, record, decision, reportCard, escapes);
  }, [review, record, reportCard, escapes]);
}
