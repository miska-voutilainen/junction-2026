import { PlantBugDialog } from "./PlantBugDialog";

/**
 * Title, what the page is for, and what the levels rest on. The measured line
 * comes from the report card, so it is absent when none was recorded.
 *
 * @param measured "Reviewer rv1 · model · measured on 10 planted bugs written blind", or null.
 */
export function ReviewerHeader({ measured }: { measured: string | null }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h1 className="sr-only text-2xl font-semibold tracking-tight compact:not-sr-only">Reviewer Report Card</h1>
        <p className="max-w-prose text-text-muted">
          How far the AI reviewer can be trusted, by area. Levels move only on evidence: planted bugs it had to find blind, and
          escapes you record.
        </p>
        {measured && <p className="text-sm text-text-muted">{measured}</p>}
      </div>
      <PlantBugDialog />
    </div>
  );
}
