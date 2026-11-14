import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import type { ChangeInput, Review } from "@/contracts";
import type { EvidenceAlert } from "./reviewModel";

/** The change has no recorded review: say so and show the command that records one. */
export function ReviewMissing({ changeId }: Readonly<{ changeId: string }>) {
  return (
    <EmptyState
      title="This change hasn't been reviewed yet."
      body="Run this command to record the review."
      command={`pnpm review run ${changeId}`}
    />
  );
}

/** The review file exists but fails validation; `details` is the validation error. */
export function ReviewUnreadable({ changeId, details }: Readonly<{ changeId: string; details: string | null }>) {
  return (
    <ErrorState
      title="This review couldn't be read."
      body={`Re-record it with pnpm review run ${changeId}.`}
      details={details ?? undefined}
    />
  );
}

/** A review whose diff has no hunks: nothing to read or sign. */
export function EmptyDiff({ change, review }: Readonly<{ change: ChangeInput; review: Review }>) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
      <h2 className="text-lg font-semibold">This change has no diff</h2>
      <p className="text-text-muted">
        The branch <span className="font-mono text-text-secondary">{change.branch}</span> matches its base, so there is nothing to review
        or sign.
      </p>
      <p className="font-mono text-xs break-all text-text-muted">
        base {review.diff.baseSha} · head {review.diff.headSha}
      </p>
    </section>
  );
}

/**
 * The report card is missing or unreadable, so no area has a track record and
 * nothing counts as covered. The diff below stays: only the coverage is gone.
 */
export function EvidenceUnavailable({ alert }: Readonly<{ alert: EvidenceAlert }>) {
  return (
    <div role="alert" className="flex gap-3 rounded-control border border-amber/40 px-4 py-3">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-light" />
      <div className="flex flex-col gap-0.5 text-base">
        <p className="font-medium text-amber-light">{alert.title}</p>
        <p className="text-text-secondary">
          {alert.verb} <code className="font-mono text-sm">{alert.command}</code> to measure the reviewer. {alert.consequence}
        </p>
      </div>
    </div>
  );
}
