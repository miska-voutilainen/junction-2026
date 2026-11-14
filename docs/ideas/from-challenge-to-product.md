# From the challenge to the product

How the nine ideas came out of Tieto's challenge, where a person sees each one in the app, and how they feed each other on one change, `mp-2283`. Each idea's own page says what it is; [Why these nine ideas](why-these-ideas.md) says why. This page is the route between them.

## Where the ideas came from

The [challenge](../challenge.md) lists what Tieto thinks builds trust. We started from that list, then added ideas from our own tools, from other fields and from critics. Dates are from the [decision log](../decisions.md).

| Challenge line                                                         | Became                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A named engineer owns each change and signs off                        | [7 Signed receipt](signed-receipt.md)                                                    |
| The AI review is advice with evidence, never the approval              | [7 Signed receipt](signed-receipt.md), [8 Separation of duties](separation-of-duties.md) |
| Evidence is traceable to a requirement                                 | Claims that cite requirement items, with [4 Quote check](quote-check.md)                 |
| Depth of human review follows risk                                     | [3 Coverage map](coverage-map.md)                                                        |
| Humans spot-check the AI reviewer; trust is earned per area, withdrawn | [1 Trust ladder](trust-ladder.md)                                                        |
| Not accepted: confidence without evidence                              | [6 Evidence levels](evidence-levels.md)                                                  |
| Not accepted: a risk score nobody can explain                          | [3 Coverage map](coverage-map.md): rules a person can read, no model in the routing      |
| Show what the AI refused to decide, and why (expectations list)        | [5 Refusal policy](refusal-policy.md)                                                    |
| Vendors: verify findings before posting                                | [4 Quote check](quote-check.md)                                                          |

Idea 2, [blind-first review](blind-first.md), is not on Tieto's list. It came from our own differentiators.

### Chronology

- **2026-11-13, 17:10 to 17:55.** We chose the challenge, then turned the lines of the table above into decisions: the requirement-traced claim as the unit of review, a fixed refusal list, evidence levels instead of the model's confidence, a mechanical check before a finding is posted, routing by explainable rules, a trust ledger per area, and a receipt bound to the diff. All are in [decisions.md](../decisions.md), entries 17:15 to 17:55.
- **18:10.** Because the baseline is nearly dictated by the challenge text, we added differentiators: a canary-calibrated reviewer (planted bugs, now idea 1), blind-first review (idea 2) and a receipt that lives in git (idea 7).
- **18:40.** From Miska's tool Lightfoot we adopted two concepts and no code: the proof ladder (Shadow, Calibrated, Trusted) and shadow mode for new areas. The event rule is that patterns carry over and code does not.
- **21:00 and 22:00, the critic rounds.** The pre-kickoff critique found that planted-bug rates were circular if we wrote both the bugs and the prompts, and that "Prove it" live was the likeliest step to fail. Round 2 found that a test written from the diff proves nothing, so A5 writes from the requirement and counts only a test that fails on the base and passes on the change, and that one anchored-versus-blind pair is an anecdote, so it became a count. Both rounds are in [decisions.md](../decisions.md).
- **2026-11-14, research.** Four Gemini Deep Research runs (two for better ideas, one on how agent PRs fail, one red team) kept all seven ideas and added six sharpenings, for example an escape sending an area's next changes to a full read (`R-escape`). Then "Eight ideas built, four next ideas on paper" added idea 8, because separation of duties had the broadest support in the research. A fifth pass kept all eight and changed limits and wording. Later the same day, Tieto's engineer named new agent code breaking old code as the main risk, and that became idea 9, the [legacy guard](legacy-guard.md). Sources and checked figures: [research.md](../research.md).
- **Borrowed from other fields** ([research.md](../research.md), "Ideas borrowed from other fields"): continuous sampling plans for the ladder (clearance after clean checks, full inspection after a defect), the Daubert and Rule 702 admissibility test for the quote check, and preregistration for blind-first. The anchoring study in the same file (Tufano et al., 29 developers) found AI hints pull reviewers' attention to what the AI flagged.

## What we changed our minds about

Each of these came from a measurement or a recorded run, not from taste.

- **Blind-first has no measured advantage.** Both modes caught 10 of 10 planted false sentences (5 plants, 2 runs per mode), so at n = 2 the count cannot separate them, and the blind runs of three plants share A1 and A2 per run number, so they are not independent. The pitch dropped the claim and moment 2 now leads with the contradiction and the refusals ([lessons.md](../lessons.md), 10:59).
- **A5 retracts only when behaviour broke.** The first mp-2283 recording retracted two correct claims: A5's tests failed on the base and the head because they compared generated output they could not know. A5 now retracts only when a test passes on the base and fails on the head; a test that fails on both goes into `inconclusiveTests`. In the final recording two claims are Verified by two methods, and no claim is retracted ([lessons.md](../lessons.md)).
- **Generated hunks left the count.** Tieto's `mp-2297` has 237 files and 423 hunks, nearly all generated snapshots, so "Read 12 of 423" meant nothing. Generated hunks now have their own coverage state, and the recorded review reads 21 hunks and marks 402 generated ([decisions.md](../decisions.md)).
- **A hunk is covered only where a claim quotes code in it.** A2 listed hunks on claims whose citations lay in one hunk, so a Supported claim could cover hunks it showed nothing about. After the quote check a claim keeps only the hunks a passing citation overlaps ([decisions.md](../decisions.md)).
- **The receipt goes stale on a rebase, not only on a changed diff.** Our docs said a rebase with an unchanged diff kept the receipt valid. The code is stricter: the signed receipt holds the head commit and both trees, so `verify` rejects a change in any of them ([decisions.md](../decisions.md), fifth research pass).
- **Security caught 0 of 3 planted bugs (rv1), then 1 of 3 (rv2).** Under rv1 two of the misses were a labelling miss: A3 saw the bug but filed it as `scope-creep`, which the eval doesn't count. `a3.v2` files wrong out-of-scope code as a defect; v06 is now caught in 3 of 3 runs, v03 and v10 in 0 of 3. The scorer did not change. Security stays at Shadow and the pitch says "1 of 3" ([lessons.md](../lessons.md#correction-2026-11-14)).

## How each idea is applied in the product

Screens: S1 inbox `/`, S2 review `/changes/[id]`, S3 report card `/reviewer`, S4 receipt `/changes/[id]/receipt`, S5 dashboard `/dashboard`. Every idea carries a numbered idea label in the UI that links to its page.

| #   | Where a person sees it                                                                                              | Code home                                                                                                                                                                          | Data it reads                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | S3 "Trust ladder by area" with a record-escape button; S5 trust by area                                             | [`src/rules/ladder.ts`](../../src/rules/ladder.ts), [`src/policy/ladder.ts`](../../src/policy/ladder.ts), [`src/pipeline/eval/scoreEval.ts`](../../src/pipeline/eval/scoreEval.ts) | [`data/eval/report-card.json`](../../data/eval/report-card.json), the planted-bug runs in `data/runs/v01`-`v10` |
| 2   | S2 "Blind check" tab (what was expected before the diff); S3 "Given the description first vs blind-first"           | [`src/prompts/a1.ts`](../../src/prompts/a1.ts), [`src/prompts/a4.ts`](../../src/prompts/a4.ts), [`src/pipeline/runReview.ts`](../../src/pipeline/runReview.ts)                     | `data/runs/<id>/review.json`, `data/runs/mp-2283/anchored` and `blind`, the report card                         |
| 3   | S1 inbox Effort column; S2 coverage line and hunk navigator                                                         | [`src/rules/route.ts`](../../src/rules/route.ts), [`src/policy/routing.ts`](../../src/policy/routing.ts)                                                                           | `data/runs/<id>/review.json`, ladder levels from the report card                                                |
| 4   | S2 "Read" tab, the cited lines; S3 "Hallucinations caught"                                                          | [`src/pipeline/quoteCheck.ts`](../../src/pipeline/quoteCheck.ts), [`src/contracts/common.ts`](../../src/contracts/common.ts)                                                       | `data/runs/<id>/review.json` (`quoteCheck`)                                                                     |
| 5   | S2 "Refused" tab; S5 open decisions                                                                                 | [`src/policy/refusals.ts`](../../src/policy/refusals.ts), [`src/prompts/a3.ts`](../../src/prompts/a3.ts)                                                                           | `src/policy/refusals.ts`, `data/runs/<id>/review.json` (`refusals`)                                             |
| 6   | S2 "Read" tab, a level on every claim and the test output on the base and the head                                  | [`src/contracts/common.ts`](../../src/contracts/common.ts), [`src/pipeline/differential/runDifferentialTests.ts`](../../src/pipeline/differential/runDifferentialTests.ts)         | `data/runs/<id>/review.json` (`claims`, `retractions`, `inconclusiveTests`)                                     |
| 7   | S2 "Sign" tab; S1 Receipt column; S4 the full receipt with verify output                                            | [`src/receipt/`](../../src/receipt/), [`src/lib/git/diffIdentity.ts`](../../src/lib/git/diffIdentity.ts)                                                                           | [`data/receipts/mp-2283.json`](../../data/receipts/mp-2283.json), `data/sample/allowed_signers`                 |
| 8   | The roles line "Written by, Reviewed by, Signed by" on S2 and S4; the own-test label on a claim the PR's test backs | [`src/pipeline/differential/runDifferentialTests.ts`](../../src/pipeline/differential/runDifferentialTests.ts), [`src/receipt/sign.ts`](../../src/receipt/sign.ts)                 | `data/runs/<id>/review.json`, `data/receipts/mp-2283.json`                                                      |
| 9   | S2 legacy touch list under the tier banner; the `R-legacy-guard` line in the tier reasons | [`src/pipeline/legacyTouchPoints.ts`](../../src/pipeline/legacyTouchPoints.ts), [`src/rules/route.ts`](../../src/rules/route.ts) | `data/runs/mp-2297/review.json` (`legacyTouchPoints`) |

## How they work together

The pipeline in [`src/pipeline/runReview.ts`](../../src/pipeline/runReview.ts) runs in a fixed order, and the order is the design ([architecture](../architecture.md) has the diagram). Here is `mp-2283`, step by step.

| Step                       | Idea             | What it produces                                                                                     | Who uses it                                               |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A1 expectation             | 2 Blind-first    | What the requirement should produce, written before any code or description is read                  | A2 (beside the hunks), A3, A5 (tests are written from it) |
| A2 claims                  | 2, 6             | The story and claims, each citing file, lines and a quote                                            | The quote check                                           |
| Quote check                | 4 Quote check    | Supported or Unverified per claim; failures logged; a claim keeps only the hunks a quote lands in    | A3, A4, A5, `route()`                                     |
| A3 areas and refusals      | 5 Refusal policy | Findings per area checklist and refusals by rule id; fixed path rules add refusals the model did not | `route()` (`R-refusal`), the receipt draft                |
| A4 description check       | 2 Blind-first    | Each sentence of the author's description supported, contradicted or unsupported                     | Findings (`R-contradiction`)                              |
| A5 differential tests      | 6 and 8          | A test passing on the base and failing on the head retracts; the reverse, written by A5, verifies    | Claim levels, `inconclusiveTests`                         |
| `route()`                  | 3 with 1         | One coverage state per hunk and a tier, with a reason per rule                                       | S1, S2, the receipt draft's "not checked" list            |
| Receipt draft, then `sign` | 7 with 8         | Checked, not checked and residual risk; a person signs with their own key                            | `verify`, S4                                              |

On the recorded `mp-2283` review, `route()` gives "Full · Read 6 of 8 hunks" ([why-these-ideas.md](why-these-ideas.md)). The A5 recording has two claims Verified by two test methods that fail on the base and pass on the head; the PR's own three tests keep the other two at Supported ([lessons.md](../lessons.md)). The signed receipt lists 8 checked items (2 by `tool`, 6 `ai-supported`) and 6 not checked ([signed-receipt.md](signed-receipt.md)).

Where one idea depends on another:

- **Evidence levels feed coverage states.** `route()` marks a hunk Verified or Supported only if a claim at that level lists it, and the quote check has already trimmed each claim to the hunks it quotes ([`route.ts`](../../src/rules/route.ts)).
- **Refusals raise the tier and reach the receipt.** Any refusal fires `R-refusal` (Focused at least), and the receipt draft writes one residual-risk sentence per refusal for the owner to accept ([`buildReceiptDraft.ts`](../../src/pipeline/buildReceiptDraft.ts)).
- **The ladder decides what a person must read.** A hunk in an area at Shadow is always Read this, and an area that is not Trusted fires `R-area-level` (Focused). Planted-bug results set the levels; a simulated escape lowers one and `route()` re-runs in the browser ([`route.ts`](../../src/rules/route.ts)).
- **Separation of duties caps the author's evidence.** The PR's own tests add evidence to a claim but never change its level; only an A5 test, written from the requirement without the diff, can make a claim Verified ([`classifyOutcomes.ts`](../../src/pipeline/differential/classifyOutcomes.ts)).
- **Blind-first order protects the early steps.** In blind-first mode the author's description reaches none of A1, A2 or A3, and A1 sees no code either; A4 reads the description last ([`runReview.ts`](../../src/pipeline/runReview.ts)).

## Where it goes next

Four next ideas are on paper only; no screen shows them ([README](README.md)):

- **Registered pull requests:** the owner signs the tests before the agent writes any code.
- **Audit sampling for very large PRs:** read a statistically chosen share of hunks.
- **Round-trip property tests for serializers:** deserialising what was serialised gives the original.
- **Post-merge reverts as the live source of escapes:** a revert feeds the ladder.

The concept card's [Beyond the reference](../concept-card.md) lists ten items in all, among them the receipt as a required merge check, organisation-managed signing, review slices instead of hunks, a rule ratchet and a reviewer from another model family.
