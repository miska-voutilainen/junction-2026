# Idea 7 · The signed receipt in git, tied to the exact diff

The named owner signs a receipt of what was checked, what wasn't and what risk they accept, and it is stored in git next to the commit, bound to a hash of the exact diff.

> Draft. The demo receipt for MP-2283 is signed in T23.

## The problem

When an agent writes the code and an AI reviews it, "approved by" on a pull request says almost nothing: approved on what evidence, with which parts unread, accepting which risks? The record also lives in the hosting platform, not with the code, and it doesn't notice when the diff changes after approval. Accountability needs a record that says what the person actually took responsibility for, that they can't deny signing, and that goes stale when the code moves.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/signed-receipt-dark.svg">
  <img src="img/signed-receipt-light.svg" alt="At signing: git diff, its SHA-256, the receipt, signed with ssh-keygen. At merge in CI: read the git note, check the signature, recompute the diff hash. Exit 0 merges; exit 1, 2 or 3 blocks the merge." width="880">
</picture>

1. **The review drafts the receipt.** `pnpm countersign draft <changeId>` writes three lists from the review:
   - **Checked:** each item with who checked it, `tool` (a test, the quote check), `ai-supported` or `human`.
   - **Not checked:** the Read this hunks and the Unverified claims, each with the reason.
   - **Residual risk:** what the owner accepts, including the refusals ([Idea 5](refusal-policy.md)).

   The owner edits it. The AI drafts the receipt but never signs it.
2. **Bind it to the exact diff.** The receipt carries the base and head commits, their tree hashes and `diffSha256`: a SHA-256 over the bytes of a `git diff` run with fixed options and no user config, so the same diff gives the same hash on any machine.
3. **Sign with the owner's own SSH key.** `pnpm countersign sign` serialises the receipt as canonical JSON (sorted keys) and signs it with `ssh-keygen -Y sign -n countersign-receipt`. No new key infrastructure: the same kind of key the owner already uses for git.
4. **Store it in git, append-only.** The receipt and its signature go into a git note on the head commit under `refs/notes/countersign`. A second signature on the same commit is refused. The note travels with the repository, not with a hosting platform.
5. **Verify, and use the exit code as the merge gate.** `pnpm countersign verify` checks the signature against the team's `allowed_signers` file, then recomputes the diff hash:

   | Result | Exit code |
   | --- | --- |
   | Good signature, "diff unchanged" | 0 |
   | "Stale: the diff changed since signing" | 1 |
   | "No receipt for <changeId>" | 2 |
   | "Signature invalid" | 3 |

   A CI step that runs verify and requires exit 0 means nothing merges without a valid, current receipt.

## What we measured

Nothing to measure in rates. The receipt for MP-2283 will be signed with a real key and verified, and the exported receipt with its verify output will be committed to `data/receipts/`.

## How to adopt it

- **What you need:** git, `ssh-keygen` (OpenSSH 8.2 or newer, already on most machines), and an `allowed_signers` file listing who may sign.
- **What it costs:** no service and no model calls; a small CLI around `git notes` and `ssh-keygen`.
- **Smallest first step:** add a CI step that fails when a pull request's head commit has no valid note under `refs/notes/countersign`. Start with a receipt that only names the owner and the diff hash; add the checked and not-checked lists once your review can fill them.

## Limits and failure modes

- **A signature proves who signed, not that they read.** The receipt makes the unread part explicit, so signing it is a deliberate act; it can't force attention.
- **Git notes are easy to forget to push.** They need `git push origin refs/notes/countersign`. The verify step fails closed (exit 2), so a missing note blocks the merge instead of passing silently.
- **Squash merges make a new commit.** The receipt binds to the reviewed head commit and its diff; a team using squash merges should verify before merging, which is where the gate runs.

## In the code

- `src/receipt/`: the countersign CLI, draft, sign, verify and export (T20, in progress)
- `src/lib/git/diffIdentity.ts`: `computeDiffIdentity()`, the one function that feeds both the review and the receipt (T09, in progress)
- Shown on screen S2, the Receipt tab: signed, unsigned or stale, with the verify output
