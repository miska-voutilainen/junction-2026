"use client";

import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import type { InboxSource, ReportCardInput } from "@/features/inbox/inboxModel";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { useEscapes } from "@/lib/simulation/escapes";
import { ReviewBody } from "./ReviewBody";
import { ReviewHeader } from "./ReviewHeader";
import { ReviewMissing, ReviewUnreadable } from "./ReviewStates";
import { SelectedClaimProvider } from "./SelectedClaim";
import type { HighlightedHunks } from "./highlightHunks";
import { decideReview } from "./reviewModel";
import { useShellChanges } from "./useShellChanges";

/**
 * S2 · Review inside its shell. Routing runs here with the current simulated
 * escapes, so recording an escape re-routes this page and the shell's change
 * list together, without a reload. The shell gets the same inbox model the
 * inbox builds, so "inbox order" has one source.
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
  const { escapes } = useEscapes();
  const shellChanges = useShellChanges(sources, reportCard);
  const current = sources.find((source) => source.change.id === currentId);
  if (!current) throw new Error(`No change with id ${currentId} among the loaded sources.`);
  const { change, review, receipt } = current;

  const routed = review.state === "ok" ? decideReview(review.data, reportCard.state === "ok" ? reportCard.data : null, escapes) : null;
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
          />
          {review.state === "missing" && <ReviewMissing changeId={change.id} />}
          {review.state === "unreadable" && <ReviewUnreadable changeId={change.id} details={reviewError} />}
          {review.state === "ok" && routed && (
            <ReviewBody
              change={change}
              review={review.data}
              decision={routed.decision}
              levels={routed.levels}
              isEvidenceAvailable={routed.isEvidenceAvailable}
              tokens={tokens}
            />
          )}
        </div>
      </SelectedClaimProvider>
    </AppShell>
  );
}
