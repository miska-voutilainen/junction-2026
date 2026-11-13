"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ErrorState";

/**
 * Shown when the recorded changes can't be read: says so, prints the real
 * validation error so it can be pasted into an issue, and re-reads the files
 * on "Try again".
 */
export function InboxError({ details }: { details: string }) {
  const router = useRouter();
  return (
    <ErrorState
      title="Couldn't read the recorded changes"
      body="A change file under data/sample/changes is missing or doesn't match its schema. Fix the file, then try again."
      details={details}
      onRetry={() => router.refresh()}
    />
  );
}
