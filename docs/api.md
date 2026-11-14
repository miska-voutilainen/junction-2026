# API

Countersign has no HTTP endpoints. The site is statically generated and reads committed files under `data/`; there are no `/api` routes and no server state.

What the parts exchange instead: data files, two pure functions and two command-line tools. The zod schemas in `src/contracts/` are the source of truth; this page describes them for people. Spec section 5 in [spec.md](spec.md) is the agreed interface.

| Contract                                                 | File or entry point                                                      | Status                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [`Requirement`](#requirement)                            | `data/sample/requirements/<id>.json`                                     | Built; files in `data/sample/`                                       |
| [`ChangeInput`](#changeinput), [`AnswerKey`](#answerkey) | `data/sample/changes/<id>.json`, `data/sample/answer-key/<plantId>.json` | Built; files in `data/sample/`                                       |
| [`Review`](#review)                                      | `data/runs/<changeId>/review.json`                                       | Built; recorded runs, fixtures in `data/fixtures/runs/` for UI tests |
| [`route()`](#route-and-tierdecision)                     | `src/rules/route.ts`                                                     | Built                                                                |
| [Ladder](#trust-ladder)                                  | `src/rules/ladder.ts`                                                    | Built                                                                |
| [`ReportCard`](#reportcard)                              | `data/eval/report-card.json`                                             | Built; recorded by `pnpm evals`                                      |
| [`ReceiptRecord`](#receiptrecord)                        | `data/receipts/<changeId>.json`                                          | Schema built; `mp-2283` recorded, signed and verified                |
| [Simulated escapes](#simulated-escapes)                  | `useEscapes()` in `src/lib/simulation/escapes.ts`                        | Built                                                                |
| [Pipeline CLI](#pipeline-cli)                            | `pnpm review`, `pnpm evals`                                              | `review run`, `review check`, `evals` built                          |
| [Receipt CLI](#receipt-cli)                              | `pnpm countersign`                                                       | Built, with unit tests                                               |

All objects are strict: an unknown key fails validation. Lines are 1-based and inclusive. SHAs are 40 lowercase hex characters; timestamps are ISO 8601.

## Shared enums (`src/contracts/common.ts`)

| Name            | Values                                             | UI labels                                  |
| --------------- | -------------------------------------------------- | ------------------------------------------ |
| `Area`          | `generator`, `analyzer`, `security`, `performance` | Generator, Analyzer, Security, Performance |
| `EvidenceLevel` | `verified`, `supported`, `unverified`, `refused`   | Verified, Supported, Unverified, Refused   |
| `Coverage`      | `verified`, `supported`, `read`, `generated`       | Verified, Supported, Read this, Generated  |
| `Tier`          | `light`, `focused`, `full`                         | Light, Focused, Full                       |
| `LadderLevel`   | `shadow`, `calibrated`, `trusted`                  | Shadow, Calibrated, Trusted                |
| `FileKind`      | `source`, `test`, `docs`, `generated`              |                                            |

`Citation`: `{ file: string, side: "new" | "old", startLine: number, endLine: number, quote: string }`.

`ReceiptBody` (shared by `Review.receiptDraft` and `Receipt`):

| Field          | Type                                                        | Notes |
| -------------- | ----------------------------------------------------------- | ----- |
| `checked[]`    | `{ item: string, by: "tool" \| "ai-supported" \| "human" }` |       |
| `notChecked[]` | `{ item: string, reason: string }`                          |       |
| `residualRisk` | `{ text: string, acceptedRefusalIds: string[] }`            |       |

## `Requirement`

`data/sample/requirements/<id>.json`, written by the evidence lane.

| Field                             | Type                                                  | Notes            |
| --------------------------------- | ----------------------------------------------------- | ---------------- |
| `id`                              | string                                                | `"MP-2283"`      |
| `title`, `intent`                 | string                                                |                  |
| `functional[]`, `nonFunctional[]` | `{ id: string, text: string }`                        | ids `F1…`, `N1…` |
| `derivedFrom`                     | `{ kind: "github-issue", url: string, note: string }` |                  |

## `ChangeInput`

`data/sample/changes/<id>.json`, written by the evidence lane.

| Field                                             | Type                                                      | Notes                                               |
| ------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `id`                                              | string                                                    | `"mp-2283"`, `"v01"` or `"cp1"`                     |
| `kind`                                            | `"tieto"` \| `"planted-bug"` \| `"contradiction-plant"`   |                                                     |
| `title`, `requirementId`, `branch`, `authorAgent` | string                                                    |                                                     |
| `parentChangeId`                                  | string \| null                                            | set for `v<nn>` and `cp<n>`                         |
| `repo`                                            | string                                                    | `"miska-voutilainen/junction26-messagepack-csharp"` |
| `baseSha`, `headSha`                              | SHA                                                       |                                                     |
| `authorDescription`                               | `{ text: string, synthetic: boolean, writtenBy: string }` |                                                     |

## `AnswerKey`

`data/sample/answer-key/<plantId>.json`. Only the engine's scoring reads it; it never goes into a prompt.

| Field                  | Type                                 | Notes                                                            |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `plantId`, `changeId`  | string                               |                                                                  |
| `kind`                 | `"planted-bug"` \| `"contradiction"` |                                                                  |
| `area`, `file`         | `Area` \| null, string \| null       | null for contradictions                                          |
| `startLine`, `endLine` | number \| null                       |                                                                  |
| `defect`               | string                               | planted bug: the defect; contradiction: the exact false sentence |
| `why`, `writtenBy`     | string                               |                                                                  |
| `writtenAt`            | ISO timestamp                        |                                                                  |

## `Review`

`data/runs/<changeId>/review.json` (blind-first, latest), plus `data/runs/<changeId>/anchored/<k>.json` and `blind/<k>.json` for the anchored-vs-blind runs. Schema: `src/contracts/review.ts`. Free-text fields are plain text, not Markdown. Test `output` strings are trimmed to the last 2,000 characters.

| Field                                                       | Type                                                                                              | Notes                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                                             | `1`                                                                                               |                                                                                                                                                                  |
| `changeId`, `requirementId`, `title`, `authorAgent`, `kind` | as in `ChangeInput`                                                                               | copied from it                                                                                                                                                   |
| `mode`                                                      | `"blind-first"` \| `"anchored"`                                                                   |                                                                                                                                                                  |
| `reviewer`                                                  | `{ version, model, promptVersions: { a1, a2, a3, a4, a5 } }`                                      | `version` such as `"rv1"`; prompt versions such as `"a2.v1"`                                                                                                     |
| `run`                                                       | `{ id, startedAt, finishedAt, durationMs, usage: { inputTokens, outputTokens, costUsd, calls } }` |                                                                                                                                                                  |
| `diff`                                                      | `{ baseSha, headSha, baseTree, headTree, diffSha256, filesChanged, linesAdded, linesRemoved }`    | `diffSha256` is 64 hex characters                                                                                                                                |
| `files[]`                                                   | `{ path, kind: FileKind, area: Area \| null, added, removed, hunkIds[] }`                         |                                                                                                                                                                  |
| `hunks[]`                                                   | `{ id, file, header, oldStart, oldLines, newStart, newLines, lines[] }`                           | `id` is `h1, h2…` in diff order; each line is `{ kind: "context" \| "add" \| "del", oldLine, newLine, text }` with `text` excluding the `+`, `-` or space prefix |
| `requirement`                                               | `Requirement`                                                                                     |                                                                                                                                                                  |
| `expectation`                                               | `{ items[] } \| null`                                                                             | null in anchored mode; item: `{ requirementItemId, expectedBehaviours[], likelyAreas: Area[], expectedTests[] }`                                                 |
| `story`                                                     | `{ what, why, touches[] }`                                                                        | `touches[]`: `{ symbol, file, note }`                                                                                                                            |
| `claims[]`                                                  | see below                                                                                         |                                                                                                                                                                  |
| `findings[]`                                                | see below                                                                                         |                                                                                                                                                                  |
| `refusals[]`                                                | `{ id, ruleId, source: "ai" \| "rule", reason, hunkIds[] }`                                       | `ruleId` is `R1` to `R7`; `source: "rule"` is a fixed trigger in the policy, no model involved                                                                   |
| `quoteCheck`                                                | `{ checked, passed, downgraded, dropped, failures[] }`                                            | failure: `{ itemId, citation, reason }`                                                                                                                          |
| `retractions[]`                                             | `{ claimId, reason, output }`                                                                     | claims withdrawn: an A5 test passed on the base and failed on the head                                                                                           |
| `inconclusiveTests[]` (optional)                            | `{ source, requirementItemId, testNames, reason }`                                                | tests that said nothing about the change: build error, no matching test, timeout, or a failure on both versions; `reason` says which                             |
| `receiptDraft`                                              | `ReceiptBody`                                                                                     |                                                                                                                                                                  |
| `routing`                                                   | `TierDecision`                                                                                    | `route()`'s output at record time                                                                                                                                |

**Claim:** `{ id: "c1", requirementItemId: string | null, text, kind: "behaviour" | "structure" | "docs" | "test", level: EvidenceLevel, hunkIds[], citations: Citation[], evidence[] }`. Each evidence entry: `{ kind: "differential-test" | "pr-test" | "quote-check", summary, testName: string | null, base: TestResult | null, head: TestResult | null }`, where `TestResult` is `{ result: "fail" | "pass" | "error", output }`.

**Finding:** `{ id: "f1", kind: "defect" | "contradiction" | "missing" | "scope-creep", area: Area | null, severity: "high" | "medium" | "low", title, detail, statement: string | null, hunkIds[], citations[] }`. `statement` is the PR's sentence for a contradiction.

## `route()` and `TierDecision`

`src/rules/route.ts`. Pure, no I/O, runs in Node and the browser.

```ts
route(
  review: Pick<Review, "files" | "hunks" | "claims" | "findings" | "refusals">,
  levels: Record<Area, LadderLevel>,
  policy: RoutingPolicy = routingPolicy,
  escapes: Partial<Record<Area, number>> = {},
): TierDecision
```

`TierDecision`:

| Field                                                | Type                       | Notes                                                                        |
| ---------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `tier`                                               | `Tier`                     | highest tier any reason asks for; `light` with no reasons                    |
| `reasons[]`                                          | `{ ruleId, text, tier }`   | one line per rule that fired, in rule order                                  |
| `coverage`                                           | `Record<hunkId, Coverage>` | exactly one state per hunk                                                   |
| `readHunks`, `totalHunks`, `readLines`, `totalLines` | number                     | lines are added plus removed                                                 |
| `readMinutes`, `fullMinutes`                         | number                     | `ceil(lines / 25)`; `readMinutes` is at least 1 when `readLines > 0`, else 0 |

**Coverage per hunk**, first match wins: `read` if a finding or refusal lists the hunk or its file's area is at `shadow`; `generated` if its file's kind is `generated` (snapshots: visible, never in the reading list); `verified` if a `verified` claim lists it; `supported` if a `supported` claim lists it; otherwise `read`.

**Rules**, in this order. The thresholds are in `src/policy/routing.ts`.

| Rule id            | Fires when                                               | Tier    |
| ------------------ | -------------------------------------------------------- | ------- |
| `R-size`           | changed lines outside generated files exceed 400         | full    |
| `R-read-share`     | read hunks are at least 75% of non-generated hunks       | full    |
| `R-escape`         | one reason per touched area with `escapes[area] > 0`     | full    |
| `R-refusal`        | any refusal                                              | focused |
| `R-contradiction`  | any contradiction finding                                | focused |
| `R-defect`         | any defect finding                                       | focused |
| `R-sensitive-path` | a hunk is in one of the policy's `sensitivePaths`        | focused |
| `R-area-level`     | one reason per touched area whose level is not `trusted` | focused |
| `R-unread`         | a hunk is `read` and no other rule fired                 | focused |
| `R-generated`      | any hunk is `generated`: says the risk in one line       | light   |

**No readable report card.** `decideChange()` in `src/features/inbox/inboxModel.ts` routes with every area at `shadow`, then forces tier `full` and every hunk `read`, drops `R-read-share` and `R-unread`, and adds `R-no-track-record` ("No readable report card: nothing counts as covered, so a person reads every hunk."), so every screen shows the same decision.

## Trust ladder

`src/rules/ladder.ts`; thresholds in `src/policy/ladder.ts` (`minPlanted: 3`, `minCatchRate: 0.6`, `spotChecksForTrusted: 5`).

- `ladderLevel({ planted, caught, spotChecksClean }): LadderLevel`: `shadow` if fewer than 3 planted bugs or a catch rate under 0.6; `calibrated` if earned and fewer than 5 clean spot checks; `trusted` otherwise. Example: 4 planted, 3 caught, 0 spot checks gives Calibrated; `applyEscapes` with 1 escape then gives Shadow.
- `applyEscapes(levels, escapes): Record<Area, LadderLevel>`: drops each area one level per recorded escape.
- `levelsFromReportCard(reportCard | null): Record<Area, LadderLevel>`: the report card's levels, or all `shadow` with none.

No spot-check workflow exists in this reference, so `spotChecksClean` is 0 and no area can reach `trusted`.

## `ReportCard`

`data/eval/report-card.json`, written by `pnpm evals` (schema: `src/contracts/reportCard.ts`).

| Field                          | Type                                                                                 | Notes                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`, `generatedAt` | `1`, ISO timestamp                                                                   |                                                                                                                                       |
| `reviewer`                     | `{ version, model }`                                                                 |                                                                                                                                       |
| `areas[]`                      | `{ area, planted, caught, spotChecksClean, level, plants[] }`                        | plant: `{ plantId, changeId, caught: boolean, runs, caughtRuns, findingId: string \| null, defect, variantUrl }`; `caught` means a strict majority of `runs` caught it (`caughtRuns`); `variantUrl` is the fork's commit URL |
| `anchoredVsBlind`              | `{ plants, runsPerMode, anchored, blind, perPlant[] }`                               | `anchored` and `blind`: `{ caught, total }`; per plant: `{ plantId, changeId, statement, anchoredCaught, blindCaught, runs }`         |
| `hallucinations`               | `{ quotesChecked, quoteFailures, claimsRetracted, findingsDropped }`                 |                                                                                                                                       |
| `findingsOnPlants`             | `{ total, matchedPlant }`                                                            |                                                                                                                                       |
| `routingSpread`                | `{ changes, light, focused, full, readHunks, totalHunks, readMinutes, fullMinutes }` |                                                                                                                                       |

## `ReceiptRecord`

`data/receipts/<changeId>.json`, written by `pnpm countersign export` (schema: `src/contracts/receipt.ts`).

| Field                       | Type                                           | Notes                 |
| --------------------------- | ---------------------------------------------- | --------------------- |
| `schemaVersion`, `changeId` | `1`, string                                    |                       |
| `receipt`                   | `Receipt`                                      | the signed payload    |
| `signature`                 | string                                         | armored SSH signature |
| `notesRef`                  | `"refs/notes/countersign"`                     |                       |
| `verify`                    | `{ command, output, ok: boolean, verifiedAt }` |                       |

`Receipt`: `{ kind: "countersign-receipt", version: 1, changeId, requirementId, repo, commit, baseCommit, baseTree, headTree, diffSha256, reviewerVersion, reviewRunId, owner, signedAt, checked[], notChecked[], residualRisk, hunks[] }`. `commit` is the head SHA; `owner` is the GitHub login that appears in `allowed_signers`; each `hunks[]` entry is `{ hunkId, file, coverage: Coverage, readBy: string | null }`, where `readBy` is the owner for hunks they read.

The site shows a receipt as unverified when `verify.ok` is false, and as stale when `receipt.diffSha256` differs from the review's `diff.diffSha256`. `verify` also requires the head commit, `baseTree` and `headTree` to match, so a rebase or a new commit makes the receipt stale and the change is reviewed and signed again.

## Diff identity

`computeDiffIdentity(repoDir, baseSha, headSha): Promise<{ baseTree, headTree, diffSha256 }>` in `src/lib/git/diffIdentity.ts` (built). Tree SHAs come from `git rev-parse <sha>^{tree}`; `diffSha256` is the sha256 of the raw output of a fixed `git diff --binary` command run with system and global git config disabled. The review and the receipt call the same function.

## Simulated escapes

`useEscapes()` in `src/lib/simulation/escapes.ts`, a React hook over a store in the browser's `localStorage` (key `countersign.escapes.v1`; works without storage).

```ts
{ escapes: Partial<Record<Area, number>>, total: number,
  record(area: Area): void, undo(area: Area): void, reset(): void }
```

Screens that show a tier call `route(review, applyEscapes(levels, escapes), routingPolicy, escapes)`.

## Policy

`src/policy/`. `refusals.ts` (built): `refusalPolicyVersion`, the rules `R1` to `R7` (`{ id, title, decider }`) and `fixedRefusals`, the globs that always produce a rule-sourced `R7` refusal. `routing.ts` and `ladder.ts` (built): the thresholds above. `areas.ts` (file kind and area by path) and `areaChecklists.ts` (the four area checklists) are built.

## Pipeline CLI

`package.json` defines `pnpm review` (the script is not called `pipeline`: that is a built-in pnpm 12 command) and `pnpm evals`, both running `src/pipeline/cli.ts`. Commands: `run <changeId> [--anchored] [--run <k>] [--no-tests]` and `check <changeId>`. `--no-tests` skips A5, which needs the .NET SDK and runs `dotnet test` twice per requirement item. `--anchored` runs A2 and A4 with the description shown first; `--run <k>` is a blind comparison run of A1, A2 and A4 (no A3). `evals` is built; see the table below.

| Command                                                            | What it does                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm review run <changeId> [--anchored] [--run <k>] [--no-tests]` | Blind-first review (A1, A2, quote check, A3, A4, A5 unless `--no-tests`, then `route()`); writes `data/runs/<changeId>/review.json`. With `--anchored` (A1 skipped, the author description first) or `--run <k>`, writes `data/runs/<changeId>/<anchored\|blind>/<k>.json` instead. Prints `<changeId> · <tier> · read <r> of <n> hunks · <claims> claims · <findings> findings · <refusals> refused · $<cost> · <seconds> s`. |
| `pnpm review check <changeId>`                                     | Runs the A1 and A2 eval cases on the recorded `data/runs/<changeId>/review.json` and prints PASS or MISS per case, exit 0 (a miss is a measurement, not a failure): A1 covers every requirement item exactly once; for `mp-2283` A1 mentions a crash, throw or IndexOutOfRange and a resolver; every hunk of a non-docs, non-generated file is listed by a claim.                                                              |
| `pnpm evals`                                                       | Runs every planted-bug input blind 3 times (`--plant-runs <n>`; run 1 in `review.json`, runs 2..n in `blind/<k>.json`) and every contradiction plant anchored and blind (2 runs each by default, `--runs <n>` to change), scores against the answer keys, writes `data/eval/report-card.json` and recomputes each review's `routing`.                                                                                                                                                                                                                 |

Env: `AI_BACKEND`, `ANTHROPIC_API_KEY` (only for `api`), `SAMPLE_REPO_DIR`, `AI_MODE` (`record`, `replay`, `live`; see [development.md](development.md)).

## Receipt CLI

`src/receipt/`, per spec section 5 and 9.1. It reads `SAMPLE_REPO_DIR`; `COUNTERSIGN_DATA_DIR` and `COUNTERSIGN_ALLOWED_SIGNERS` override `data/` and `data/sample/allowed_signers` (tests use them). On Windows it runs Git for Windows' `ssh-keygen` (`C:/Program Files/Git/usr/bin/ssh-keygen.exe`), elsewhere the one on the PATH. Exit 1 covers input and environment errors (missing draft or key, a passphrase-protected key with no terminal to prompt in, owner not in `allowed_signers`, stale review; in a terminal `sign` prompts for the passphrase).

| Command                                                         | What it does                                                                                                                                                                                                                                                                                                                             | Exit codes                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm countersign draft <changeId> [--owner <login>] [--force]` | Writes `.scratch/receipts/<changeId>.json` from `data/runs/<changeId>/review.json`: `review.receiptDraft` plus the hunk ledger from `review.routing.coverage`; the owner edits it. Owner from `--owner`, else `git config github.user`. Refuses a review whose diff identity no longer matches, and an existing draft without `--force`. | 0 written; 1 otherwise                                                 |
| `pnpm countersign sign <changeId> [--key <path>]`               | Sets `signedAt`, signs the canonical JSON with `ssh-keygen -Y sign -n countersign-receipt`, writes the git note under `refs/notes/countersign` on the head commit in `SAMPLE_REPO_DIR` and prints the verify command. Fails if a note exists: receipts are append-only. Doesn't push.                                                    | 0 signed; 1 input error; 4 a receipt already exists                    |
| `pnpm countersign verify <changeId>`                            | Reads the note, checks the signature against `data/sample/allowed_signers`, checks `commit` and recomputes the diff identity.                                                                                                                                                                                                            | 0 valid and diff unchanged; 1 stale; 2 no receipt; 3 signature invalid |
| `pnpm countersign export <changeId>`                            | Runs verify and, only when it passes, writes `data/receipts/<changeId>.json` with the verify output.                                                                                                                                                                                                                                     | verify's code                                                          |

The exit code of `verify` is the merge gate a CI step would use.
