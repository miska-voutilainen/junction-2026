"use client";

import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";

/** Last-resort error screen for any route: says what happened, re-renders on "Try again" and links back to the inbox. */
export default function Error({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8">
      <ErrorState
        title="Something went wrong showing this page."
        body="Nothing was changed. Try again, or go back to the inbox."
        onRetry={reset}
        actions={
          <Link href="/" className="rounded-item text-sm text-link hover:underline">
            Back to the inbox
          </Link>
        }
      />
    </div>
  );
}
