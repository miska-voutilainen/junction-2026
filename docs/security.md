# Security model

What Countersign trusts, what it doesn't, and the code and test behind each claim. Every link below resolves to a file in this repository; a claim with no file behind it is not made here.

## Model output is untrusted until checked

The model's text is parsed against schemas and then checked by code before anything is shown.

- **A citation that isn't on the cited lines is dropped.** The quote check compares the quoted code with the cited lines by plain string comparison and records each failure. Code: [`quoteCheck.ts`](../src/pipeline/quoteCheck.ts). Test: [`quoteCheck.test.ts`](../src/pipeline/quoteCheck.test.ts).
- **A finding without a passing citation is dropped and counted.** An unknown refusal rule id is dropped and recorded with the reason `unknown rule id "R9"`. Code: [`checkFindings.ts`](../src/pipeline/checkFindings.ts). Test: [`checkFindings.test.ts`](../src/pipeline/checkFindings.test.ts).
- **Text in the diff is data, never instructions.** Each file line goes into the prompt inside a delimited block with its line number, and a line of code that looks like a closing tag can't close the block. Code: [`promptContext.ts`](../src/pipeline/promptContext.ts). Test: [`promptContext.test.ts`](../src/pipeline/promptContext.test.ts), the case with `Ignore previous instructions` inside a file.

## The legacy guard

Old code that other systems rely on is guarded by rules, not by the model.

- **R8 is raised only by code.** The model can't raise it, lower it or talk it away. Code: [`legacy.ts`](../src/policy/legacy.ts), [`checkFindings.ts`](../src/pipeline/checkFindings.ts).
- **No claim or ladder level takes an R8 hunk off the reading list, and an unguarded touch always routes Full.** These invariants run over every recorded review in `data/runs/`: [`legacyGuardInvariants.test.ts`](../src/rules/legacyGuardInvariants.test.ts).
- **Detectors** are tested with and without adversarial inputs: [`legacyTouchPoints.test.ts`](../src/pipeline/legacyTouchPoints.test.ts), [`addLegacyGuard.test.ts`](../src/pipeline/addLegacyGuard.test.ts), [`legacyGuardAdversarial.test.ts`](../src/pipeline/legacyGuardAdversarial.test.ts). The list of all of them is in the Testing section of [`development.md`](development.md#testing).
- **On screen:** [`real-data.spec.ts`](../e2e/real-data.spec.ts) checks the guard on S2 for every recorded review that has touch points.
- **On the recorded runs:** `pnpm review replay all` rebuilds every run in `data/runs/` with the model replayed and fails if one differs, so a change to the guard that would alter a recorded tier or touch point shows up before anything is re-recorded ([development.md](development.md#testing)).

## The author never checks its own work

- **The PR's own test gives Supported at most.** The same agent wrote the code and the test, so a differential test run from the PR's own tests is never Verified. Code: [`classifyOutcomes.ts`](../src/pipeline/differential/classifyOutcomes.ts). Test: [`classifyOutcomes.test.ts`](../src/pipeline/differential/classifyOutcomes.test.ts), "the PR's own tests". On screen: [`separation-of-duties.spec.ts`](../e2e/separation-of-duties.spec.ts), "a claim backed only by the PR's own test is Supported, and says why".
- **The AI drafts the receipt, a named person signs it.** [`draft.ts`](../src/receipt/draft.ts) writes the draft; [`sign.ts`](../src/receipt/sign.ts) refuses a key that isn't the owner's and a hunk ledger that names someone else as reader. Tests: [`receipt.test.ts`](../src/receipt/receipt.test.ts), "receipt refusals".

## The signed receipt

A receipt is an SSH signature on a git note, tied to the exact diff. [`receipt.test.ts`](../src/receipt/receipt.test.ts), "receipts that must not verify", covers a payload that claims the owner but was signed by another listed signer, a signature made in another namespace, and a ledger that doesn't match. The same file covers a review whose diff moved to another head: it exits 1 as stale and exports nothing. Code: [`verify.ts`](../src/receipt/verify.ts), [`signature.ts`](../src/receipt/signature.ts). Idea page: [signed receipt](ideas/signed-receipt.md).

## The site

- **Static pages, no accounts, no server state.** The site reads committed files under `data/`; nothing is written at request time.
- **No secrets in the browser.** The model key and the signing key are used only on a laptop by the CLIs. The app has no environment variable that reaches the client bundle.
- **Security headers on every route:** Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Frame-Options`. Code: [`next.config.ts`](../next.config.ts). Test: [`security-headers.spec.ts`](../e2e/security-headers.spec.ts), which asserts each header on S1 to S5 and fails on any console error, so on any CSP violation. The CSP allows `'unsafe-inline'` for scripts and styles because the pages are static and a per-request nonce isn't possible; the reasoning is in [`decisions.md`](decisions.md).

## What is not covered

- **Reach-in matches names, not types.** `this.Write` in a template can look like a call into another class. A false touch costs one read; it never lets a hunk skip one. See [the legacy guard's limits](ideas/legacy-guard.md#limits-and-failure-modes).
- **An old-only block opened above the hunk.** A changed line inside `#if NETFRAMEWORK` counts as an old-platform touch only when the `#if` is in the same hunk; the detector reads the diff, not the whole file. `legacyGuardAdversarial.test.ts` marks any case the code gets wrong with `it.fails`; none is open.
- **A guarded touch means an old test names the code**, not that it checks the behaviour that matters. Running the guard tests on base and head is not built.
- **The zone map is ours**, written from the repository's layout, not from Tieto's systems.
- **Wrong findings are not scored.** 93 of 117 findings on planted-bug runs match no plant, so the false-positive rate is unknown ([`lessons.md`](lessons.md)).
