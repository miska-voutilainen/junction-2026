"use client";

import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import type { InboxSource, ReportCardInput } from "@/features/inbox/inboxModel";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { ReviewBody } from "./ReviewBody";
import { ReviewHeader } from "./ReviewHeader";
import { ReviewMissing, ReviewUnreadable } from "./ReviewStates";
import { SelectedClaimProvider } from "./SelectedClaim";
import type { HighlightedHunks } from "./highlightHunks";
import { useShellChanges } from "./useShellChanges";

/**
 * S2 · Review inside its shell. The page (in `ReviewBody`) and the shell's
 * change list both route with the current simulated escapes, through the same
 * `decideChange` as the inbox, so recording an escape re-routes them together
 * without a reload and "inbox order" has one source.
 *
 * @param sources Every change with its review, as the inbox reads them.
 * @param currentId The change on screen; must be one of `sources`.
 * @param reviewError Why the current review is unreadable, when it is.
 * @param tokens Server-highlighted code per hunk id.
 */
export function ReviewScreen({
  sources,
  currentId,
  reportCard,
  repo,
  usesFixture,
  reviewError,
  tokens,
}: {
  sources: InboxSource[];
  currentId: string;
  reportCard: ReportCardInput;
  repo: string;
  usesFixture: boolean;
  reviewError: string | null;
  tokens: HighlightedHunks;
}) {
  const shellChanges = useShellChanges(sources, reportCard);
  const current = sources.find((source) => source.change.id === currentId);
  if (!current) throw new Error(`No change with id ${currentId} among the loaded sources.`);
  const { change, review, receipt } = current;
  const record = receipt === "unreadable" ? null : receipt;

  return (
    <AppShell
      changes={shellChanges}
      repo={repo}
      title={change.id}
      backHref="/"
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: change.id }]}
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      <SelectedClaimProvider>
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6 compact:px-8 compact:py-7">
          <ReviewHeader
            change={change}
            review={review.state === "ok" ? review.data : undefined}
            receiptStatus={review.state === "ok" ? receiptStatus(review.data, record) : undefined}
            signedBy={record?.receipt.owner}
            receiptHref={receipt === null ? undefined : `/changes/${change.id}/receipt`}
          />
          {review.state === "missing" && <ReviewMissing changeId={change.id} />}
          {review.state === "unreadable" && <ReviewUnreadable changeId={change.id} details={reviewError} />}
          {review.state === "ok" && <ReviewBody change={change} review={review.data} reportCard={reportCard} tokens={tokens} />}
        </div>
      </SelectedClaimProvider>
    </AppShell>
  );
}
