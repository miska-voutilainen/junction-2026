# Gemma bounty: a claim check anyone can re-run

Status: **proposal, not built; decided once Google's API key arrives.** It changes `docs/spec.md` (a second model next to `claude-opus-5-5`), so it needs the agreement of all three lane owners before any task is opened. Nothing here binds until that spec change merges.

**Update 2026-11-14.** The reviewer's recordings run on Claude Code with Miska's Max plan ([decisions](decisions.md)); that stays the primary backend. A Google AI Studio key is expected for the weekend, possibly with unlimited use. If it comes, it fits this proposal like this:

- **Build and measure on the hosted API:** prompt tuning, the planted unsupported claims and the false-alarm count are many small calls, so the API makes them fast and free.
- **Prove it locally:** the pitch rests on pinned open weights, so the receipt's claim-check block and `verify --recheck` use the same Gemma model run locally, with its weights hash. One recorded local re-check of `mp-2283` is the bounty's demo. If hosted and local verdicts differ (quantisation), we report the agreement share.
- **Decide** when the key arrives and its limits are known, and not before the core demo path is recorded (spec milestone Sat 18:00).

## The bounty

Google's Gemma bounty at Junction 2026 goes to "the most innovative and impactful use of Google's Gemma open models": creative application, strong technical execution, open models solving a real problem. Gemma is reachable through Google AI Studio, Featherless AI (hosted API), Modal (serverless GPU) or Hugging Face (weights). The prize isn't stated in the brief.

We won't win on how much we use Gemma; teams that build their whole product on it will. We enter on **why an open model at all**: Gemma does one job in Countersign that a closed API model can't, and nowhere else. Using it in more places would water that argument down and add risk to the demo.

## The gap it closes

The quote check (spec section 6, A2) proves that each citation's quote exists in the cited lines. It doesn't prove the quote supports the claim. Today a claim like "the analyzer no longer throws for types from referenced assemblies", citing a real but unrelated line, passes as **Supported**.

This is worth fixing for the Tieto entry whether or not the bounty is won: it strengthens Evidence (20% of Tieto's weighting) and Measurement (25%).

## The idea

**Opus writes the story. Gemma checks every claim, and anyone can re-run that check from the receipt, years later, offline.**

1. **Claim check.** After the quote check, Gemma reads each A2 claim with only its cited lines and answers one question: does this code support this sentence? Verdicts: `supports`, `partial`, `does-not-support`, with a one-line reason. A claim whose citations pass the quote check but don't support it drops from Supported to Unverified. This narrow judgment over a small context suits a small open model.
2. **Pinned and re-runnable.** The receipt records the check's model, weights sha256, runtime, settings (greedy decoding, the quantisation) and each verdict. `pnpm countersign verify --recheck <changeId>` re-runs it on the reviewer's own machine and compares the verdicts. A check by a closed model can't be repeated once the model is retired, and Opus has no temperature setting, which is why the spec relies on recordings. Open weights pinned by hash turn "trust our log" into "check it yourself".
3. **Runs where the code is.** Local inference: the diff and the claims never leave the machine. That's the realistic way for a company like Tieto, which reviews client code, to adopt the concept.

## How we measure it

- **Planted unsupported claims:** the evidence lane writes a handful of claims for `mp-2283` that cite real lines which don't support them, blind, as with the planted bugs (principle 9). Report: caught N of M, with M stated.
- **False alarms:** the share of Opus's own claims on the four Tieto changes that Gemma marks `does-not-support`, each one read by a person and labelled right or wrong.
- **Repeatability:** the check run 10 times on `mp-2283` with the pinned runtime; report how many verdicts are identical across all runs. We claim only what this shows.

## Scope

- **In:** one pipeline step after the quote check; the claim-check block in the receipt; `verify --recheck`; one row on S3 (caught, false alarms, repeatability) and the verdict on each claim in S2's Story tab.
- **Out:** Gemma anywhere else in A1–A5; live calls in the demo (record and replay, as for Opus); fine-tuning.

## What it touches

| Where                                               | Change                                                            | Lane                |
| --------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| `docs/spec.md` sections 4–7 and the work plan       | The step, the receipt fields, the eval rows, task rows            | Shared (all owners) |
| `src/ai/`                                           | A local Gemma client with record and replay and the usage log     | engine              |
| `src/prompts/`, `src/pipeline/`                     | The claim-check prompt and step; scoring                          | engine              |
| `src/contracts/`                                    | `claimCheck` on each claim; the pinned-model block in the receipt | Shared              |
| `src/receipt/`                                      | `verify --recheck`                                                | evidence            |
| `data/sample/`                                      | Planted unsupported claims and their answer key, written blind    | evidence            |
| `src/features/review/`, `src/features/report-card/` | The verdict on claims; the S3 row                                 | app                 |

Rough size: about a day across the engine and evidence lanes, plus an hour in the app.

## Open questions

- **Runtime:** a local runtime (for example Ollama) on the pipeline laptop and the reviewer's machine; it's a new tool, so it needs the team's agreement.
- **Model size:** the largest Gemma model that runs on a laptop and returns schema-valid verdicts in a smoke test on `mp-2283`.
- **Repeatability:** if verdicts differ between runs even with greedy decoding, `--recheck` reports agreement as a share instead of a pass or fail, and the pitch says so.
- **When:** after the core demo path is recorded on production (spec milestone Sat 18:00). It must not delay T12–T16.
- **Submission:** what the bounty requires beyond the main Junction submission. Check the Hackerpack.
