"use client";

import { ErrorState } from "@/components/ErrorState";

/**
 * Shown when a data file fails validation. The numbers need every file, so
 * none are shown rather than a partial count that reads as complete. The
 * details name each failing file and its validation error.
 */
export function DashboardError({ details }: { details: string }) {
  return (
    <ErrorState
      title="Couldn't read the recorded data"
      body="The counts need every recorded review, receipt and the report card, so none are shown. Fix the files named below and rebuild the site; in pnpm dev a reload is enough."
      details={details}
      onRetry={() => window.location.reload()}
      retryLabel="Reload"
    />
  );
}
