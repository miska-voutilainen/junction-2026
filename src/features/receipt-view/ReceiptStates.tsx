import Link from "next/link";
import { FileSignature } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";

/** The change has no receipt: says who can sign, shows the command and links back to the review. */
export function NoReceipt({ changeId, signCommand }: { changeId: string; signCommand: string }) {
  return (
    <EmptyState
      icon={<FileSignature />}
      title={`No receipt for ${changeId} yet.`}
      body="Only a named human can sign. Review the change, then run"
      command={signCommand}
      actions={
        <Button asChild variant="secondary">
          <Link href={`/changes/${changeId}`}>Back to the review</Link>
        </Button>
      }
    />
  );
}

/** The receipt file exists but fails its schema: names the file and prints the validation error. */
export function InvalidReceipt({ changeId, error }: { changeId: string; error: string }) {
  return (
    <ErrorState
      title="This receipt couldn't be read"
      body={
        <>
          <span className="font-mono text-sm">data/receipts/{changeId}.json</span> doesn&apos;t match the receipt schema. Re-export it with{" "}
          <span className="font-mono text-sm">pnpm countersign export {changeId}</span> and rebuild the site.
        </>
      }
      details={error}
      actions={
        <Button asChild variant="secondary">
          <Link href={`/changes/${changeId}`}>Back to the review</Link>
        </Button>
      }
    />
  );
}
