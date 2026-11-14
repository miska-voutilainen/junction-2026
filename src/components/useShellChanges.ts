"use client";

import { useMemo } from "react";
import { toShellChanges } from "@/components/shellChange";
import type { ShellChange } from "@/components/shellChange";
import { buildInboxModel } from "@/features/inbox";
import type { InboxSource } from "@/features/inbox";
import type { ReportCardInput } from "@/lib/decideChange";
import { useEscapes } from "@/lib/simulation/escapes";

/**
 * The shell's change list for a page that isn't the inbox: the same inbox
 * model, routed with the current simulated escapes, so the nav badge and
 * command menu order match the inbox and change when an escape is recorded.
 */
export function useShellChanges(sources: InboxSource[], reportCard: ReportCardInput): ShellChange[] {
  const { escapes } = useEscapes();
  return useMemo(
    () => toShellChanges(buildInboxModel(sources, reportCard, escapes).rows),
    [sources, reportCard, escapes],
  );
}
