# Idea 6 · Evidence levels instead of confidence scores

Each claim the AI makes is labelled by what backs it, Verified, Supported, Unverified or Refused, and the model's own confidence is never shown.

> Draft. How many claims reach each level on Tieto's changes comes from recorded runs and is "not measured yet".

## The problem

"Confidence: 92%" looks precise and means little. It's the model's opinion of itself, it isn't calibrated against anything the reader can check, and it invites the reader to trust the number instead of the code. A person deciding whether to sign needs to know what kind of proof stands behind a claim, not how sure the model felt.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/evidence-levels-dark.svg">
  <img src="img/evidence-levels-light.svg" alt="Verified (a test fails on base and passes on head), Supported (a quoted citation matched), Unverified (no citation matched), and separately Refused (a written rule applies). The model's confidence is never shown." width="880">
</picture>

Four levels, from strongest to weakest, each earned by something a person can check:

| Level | Earned by | What the reader can check |
| --- | --- | --- |
| **Verified** | A test that **fails on the code before the change and passes after it** | Both test outputs, attached |
| **Supported** | A citation whose quote matched the code ([Idea 4](quote-check.md)) | The quoted lines, with file and line range |
| **Unverified** | Nothing: the model said it, but no citation matched | Only the claim, labelled as unchecked |
| **Refused** | A refusal rule: the AI won't decide this ([Idea 5](refusal-policy.md)) | The rule, its reason and who decides |

How a claim becomes Verified (step A5):

1. **Two sources of tests.** The pull request's own added or changed tests, and one test per functional requirement item written by A5 **from the requirement, not from the diff** ([Idea 2](blind-first.md)).
2. **Run on both versions.** Each test runs in two git worktrees, base and head, with `dotnet test` (15 minutes per side at most).
3. **Read the difference:**
   - Fails on base, passes on head: the claim becomes **Verified**.
   - Passes on both: the claim stays Supported, noted "the test doesn't tell the versions apart". A test that passes before the fix proves nothing about the fix.
   - Fails on head with a test failure: the claim is retracted and logged.
   - Build error: logged and counted; the claim stays as it was.

The levels feed the coverage map: a hunk listed by a Verified claim is Verified, by a Supported one Supported, and otherwise Read this ([Idea 3](coverage-map.md)).

## What we measured

Not measured yet. The review of MP-2283 should show at least one Verified claim, with the failing base output and the passing head output beside it.

## How to adopt it

- **What you need:** a citation check for Supported; for Verified, a way to build and test both versions of the code in isolation (git worktrees are enough).
- **What it costs:** Supported is free once you have the quote check. Verified costs build and test time per change, minutes for a .NET project.
- **Smallest first step:** stop showing the model's confidence. Show Supported and Unverified from your citations, and add Verified later for the areas where a test can tell the versions apart.

## Limits and failure modes

- **Verified means "a test shows a difference", not "correct".** The test can test the wrong thing. Writing it from the requirement instead of the diff makes that less likely, not impossible.
- **Some changes can't be tested this way:** documentation, generated snapshots, build configuration. Their claims top out at Supported.
- **The .NET run is the riskiest part of our build.** If it can't run reliably on the pipeline laptop, A5 is cut, no claim can be Verified, and Supported is the top level shown. The concept card's limits will say so.

The failure modes we saw (retractions, build errors) go in `docs/lessons.md`.

## In the code

- `src/contracts/common.ts`: `EvidenceLevel`, `"verified" | "supported" | "unverified" | "refused"` (in progress)
- `src/prompts/a5.ts` and the worktree test runner in `src/pipeline/` (T14, in progress)
- Shown on screen S2, the Story tab: each claim with its level badge and the evidence behind it
