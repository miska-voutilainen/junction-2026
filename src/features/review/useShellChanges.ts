"use client";

import { useMemo } from "react";
import { buildInboxModel, toShellChanges } from "@/features/inbox/inboxModel";
import type { InboxSource, ReportCardInput } from "@/features/inbox/inboxModel";
import type { ShellChange } from "@/components/shellChange";
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
