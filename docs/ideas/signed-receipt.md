# Idea 7 · The signed receipt in git, tied to the exact diff

The named owner signs a receipt of what was checked, what wasn't and what risk they accept, stored in git next to the commit and bound to a hash of the exact diff.

> Draft. The demo receipt for MP-2283 is signed in T23.

## The problem

"Approved by" on a pull request says almost nothing: on what evidence, with which parts unread, accepting which risks? The record lives in the hosting platform, not with the code, and doesn't notice when the diff changes after approval. Accountability needs a record of what the person took responsibility for, that they can't deny signing, and that goes stale when the code moves.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/signed-receipt-dark.svg">
  <img src="img/signed-receipt-light.svg" alt="At signing: diff hash, receipt, SSH signature. At merge: read the note, check the signature, recompute the hash; exit 0 merges." width="880">
</picture>

1. **The review drafts the receipt** (`pnpm countersign draft <changeId>`): what was **checked** and by whom (`tool`, `ai-supported` or `human`), what was **not checked** (Read this hunks, Unverified claims) and the **residual risk**, including refusals ([Idea 5](refusal-policy.md)). The owner edits it. The AI never signs ([Idea 8](separation-of-duties.md)).
2. **A ledger records who read what.** The payload has one entry per hunk, `hunks: { hunkId, file, coverage, readBy }` ([Idea 3](coverage-map.md)).
3. **Bound to the exact diff.** The receipt carries base and head commits, tree hashes and `diffSha256`, a SHA-256 over a `git diff` run with fixed options and no user config, so any machine gets the same hash.
4. **Signed with the owner's own SSH key.** `pnpm countersign sign` signs canonical JSON (sorted keys) with `ssh-keygen -Y sign -n countersign-receipt`.
5. **Stored in git, append-only:** a note on the head commit under `refs/notes/countersign`. A second signature on the same commit is refused.
6. **`pnpm countersign verify` is the merge gate.** It checks the signature against `allowed_signers`, then recomputes the diff hash. Exit 0: good signature, diff unchanged. 1: "Stale: the diff changed since signing". 2: "No receipt for <changeId>". 3: "Signature invalid". CI requires exit 0.

## What we measured

Nothing to measure in rates. The MP-2283 receipt will be signed with a real key, verified, and committed with its verify output to `data/receipts/`.

## How to adopt it

- **You need:** git, `ssh-keygen` (OpenSSH 8.2 or newer) and an `allowed_signers` file.
- **It costs:** no service, no model calls; a small CLI around `git notes` and `ssh-keygen`.
- **First step:** a CI step that fails when the head commit has no valid note under `refs/notes/countersign`. Start with a receipt naming only the owner and diff hash.

## Limits and failure modes

- **A signature proves who signed, not that they read.** The receipt makes the unread part explicit, so signing is deliberate.
- **Notes are easy to forget to push** (`git push origin refs/notes/countersign`). Verify fails closed (exit 2).
- **A squash merge keeps the receipt valid if the diff is the same:** it binds the diff, not the commit.
- **Personal SSH keys are a reference choice;** an organisation would use its own signing setup (Sigstore or similar).

## Where it fits in regulated delivery

Auditors already ask who approved a change, what was checked and what risk was accepted, with the approver separate from the implementer. PCI DSS 6.2.3.1 asks for review by someone other than the author, approved before release, and DORA's rules on ICT change management ask for approval separate from implementation. With an agent as author, the named signer is that approver. The receipt is a change-approval record of the kind auditors ask for, not a compliance claim; see [`docs/research.md`](../research.md).

## In the code

- `src/receipt/`: the countersign CLI (T20)
- `src/lib/git/diffIdentity.ts`: `computeDiffIdentity()`, which feeds both review and receipt (T09)
- Shown on S2, the Receipt tab (signed, unsigned or stale), and S4, the full receipt
