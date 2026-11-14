import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ReceiptSchema, type Receipt } from "@/contracts/receipt";
import { ReviewSchema, type Review } from "@/contracts/review";
import { computeDiffIdentity, type DiffIdentity } from "@/lib/git";
import { runGit } from "@/lib/git/runGit";
import { canonicalJson } from "./canonicalJson";
import {
  CommandError,
  draftPath,
  readChangeInput,
  readValidatedJson,
  type ReceiptOptions,
} from "./context";

/**
 * Signed receipt in git, step 1: the AI drafts, a person signs. The draft turns a
 * recorded review into a receipt the owner can edit; nothing in it is signed, and
 * the review's own claims never become a signature without a named engineer
 * running `sign`. Spec section 5, Receipt CLI.
 */

/** The draft file: a receipt before `signedAt` exists. */
export const DraftSchema = ReceiptSchema.omit({ signedAt: true });
/** A Receipt before signing: what the owner edits in .scratch/receipts/<id>.json. */
export type Draft = Omit<Receipt, "signedAt">;

/**
 * Writes `<draftsDir>/<changeId>.json` from the recorded review and returns the lines to print.
 *
 * @param ownerOption `--owner`; falls back to `git config github.user`.
 * @param force overwrite an existing draft.
 * @throws CommandError (exit 1) for a missing review, an unknown owner, an existing draft,
 *   a review recorded for a different diff, or a hunk the routing has no coverage for.
 */
export async function draftReceipt(
  changeId: string,
  options: ReceiptOptions,
  { ownerOption, force }: { ownerOption?: string; force?: boolean } = {},
): Promise<string[]> {
  const review = await readReview(options.dataDir, changeId);
  const change = await readChangeInput(options, changeId);
  const identity = await computeDiffIdentity(options.repoDir, change.baseSha, change.headSha);
  requireReviewMatchesDiff(review, identity);
  const owner = ownerOption ?? (await githubUserFromGitConfig());

  const draft: Draft = DraftSchema.parse({
    kind: "countersign-receipt",
    version: 1,
    changeId,
    requirementId: review.requirementId,
    repo: change.repo,
    commit: change.headSha,
    baseCommit: change.baseSha,
    ...identity,
    reviewerVersion: review.reviewer.version,
    reviewRunId: review.run.id,
    owner,
    ...review.receiptDraft,
    hunks: hunkLedger(review, owner),
  });

  const path = draftPath(options, changeId);
  await writeDraftFile(path, draft, force ?? false);
  return [`Draft written: ${path}`, `Edit it, then: pnpm countersign sign ${changeId}`];
}

function readReview(dataDir: string, changeId: string): Promise<Review> {
  return readValidatedJson(join(dataDir, "runs", changeId, "review.json"), "review", ReviewSchema, {
    hint: `Re-run pnpm pipeline run ${changeId}.`,
    missing: `No recorded review for ${changeId}`,
  });
}

/** A review recorded for another diff would put claims the owner never saw into a receipt for this one. */
function requireReviewMatchesDiff(review: Review, identity: DiffIdentity): void {
  const { baseTree, headTree, diffSha256 } = review.diff;
  if (
    baseTree !== identity.baseTree ||
    headTree !== identity.headTree ||
    diffSha256 !== identity.diffSha256
  ) {
    throw new CommandError(1, "Review is stale: re-run the pipeline");
  }
}

async function githubUserFromGitConfig(): Promise<string> {
  const login = await runGit(process.cwd(), ["config", "github.user"])
    .then((output) => output.toString("utf8").trim())
    .catch(() => "");
  if (login === "") throw new CommandError(1, "Pass --owner <github-login>");
  return login;
}

/**
 * The ledger the signature covers: every hunk in diff order with the coverage the
 * routing gave it, and the owner as reader of the hunks nothing else checked.
 */
function hunkLedger(review: Review, owner: string): Draft["hunks"] {
  return review.hunks.map((hunk) => {
    const coverage = review.routing.coverage[hunk.id];
    if (coverage === undefined) {
      throw new CommandError(
        1,
        `Review routing has no coverage for ${hunk.id}: re-run the pipeline`,
      );
    }
    return {
      hunkId: hunk.id,
      file: hunk.file,
      coverage,
      readBy: coverage === "read" ? owner : null,
    };
  });
}

async function writeDraftFile(path: string, draft: Draft, force: boolean): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // "wx" fails if the file exists, so a draft the owner edited is never lost to a rerun.
  await writeFile(path, canonicalJson(draft), {
    flag: force ? "w" : "wx",
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new CommandError(1, `Draft exists: ${path} (use --force)`);
    throw error;
  });
}
