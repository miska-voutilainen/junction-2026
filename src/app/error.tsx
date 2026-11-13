"use client";

import { ErrorState } from "@/components/ErrorState";

/** Last-resort error screen for any route: says what happened and re-renders the page on "Try again". */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8">
      <ErrorState title="Something went wrong showing this page." body="Nothing was changed. Try again, or go back to the inbox." onRetry={reset} />
    </div>
  );
}
