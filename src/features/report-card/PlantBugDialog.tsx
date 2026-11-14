"use client";

import { FlaskConical } from "lucide-react";
import { Console } from "@/components/Console";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// <nn> is the next free variant number; 32258fd is the base commit every variant branches from.
const PLANT_COMMANDS = [
  'git -C "$SAMPLE_REPO_DIR" switch -c variant/v<nn> 32258fd',
  "# apply the agent's change plus one planted defect; reuse the original commit message",
  'git -C "$SAMPLE_REPO_DIR" push origin variant/v<nn>',
  "pnpm evals",
].join("\n");

/**
 * "Plant a synthetic bug": states the real steps instead of faking a button.
 * A plant is a variant branch of the fork plus an answer key; the eval then
 * measures whether the reviewer finds it blind. Spec section 4, planted bugs.
 */
export function PlantBugDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="h-9 bg-brand px-4 text-primary-foreground hover:bg-brand-hover">
          <FlaskConical aria-hidden="true" />
          Plant a synthetic bug
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plant a synthetic bug</DialogTitle>
          <DialogDescription>
            A planted bug is a variant branch of our fork with one known defect. The reviewer sees it like any other change, and the
            eval records whether it found the defect.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-text-secondary">
          <li>Branch the fork from the base commit and commit the agent&apos;s change with one defect in it.</li>
          <li>
            Write its answer key in <code className="font-mono text-sm">data/sample/answer-key/</code>: file, lines, area and the
            defect in one sentence.
          </li>
          <li>Run the eval. The report card updates with the new catch or miss.</li>
        </ol>
        <Console label="Commands" text={PLANT_COMMANDS} kind="output" />
      </DialogContent>
    </Dialog>
  );
}
