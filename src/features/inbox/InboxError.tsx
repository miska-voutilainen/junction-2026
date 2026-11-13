"use client";

import { ErrorState } from "@/components/ErrorState";

/**
 * Shown when the recorded changes can't be read: says so and prints the real
 * validation error so it can be pasted into an issue. The site is built from
 * the data files, so a reload only helps under `pnpm dev`; the copy says so.
 */
export function InboxError({ details }: { details: string }) {
  return (
    <ErrorState
      title="Couldn't read the recorded changes"
      body="A change file under data/sample/changes is missing or doesn't match its schema. Fix the file and rebuild the site; in pnpm dev a reload is enough."
      details={details}
      onRetry={() => window.location.reload()}
      retryLabel="Reload"
    />
  );
}
