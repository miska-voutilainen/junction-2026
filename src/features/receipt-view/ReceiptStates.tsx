import { FileSignature } from "lucide-react";
import { BackAction } from "@/components/BackAction";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

/** The change has no receipt: says who can sign, shows the command and links back to the review. */
export function NoReceipt({ changeId, signCommand }: Readonly<{ changeId: string; signCommand: string }>) {
  return (
    <EmptyState
      icon={<FileSignature />}
      title={`No receipt for ${changeId} yet.`}
      body="Only a named human can sign. Review the change, then run this command:"
      command={signCommand}
      actions={<BackAction href={`/changes/${changeId}`}>Back to the review</BackAction>}
    />
  );
}

/** The receipt file exists but fails its schema: names the file and prints the validation error. */
export function InvalidReceipt({ changeId, error }: Readonly<{ changeId: string; error: string }>) {
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
      actions={<BackAction href={`/changes/${changeId}`}>Back to the review</BackAction>}
    />
  );
}
