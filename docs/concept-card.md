# Concept card

**Recommendation.** Let the AI review every agent-written pull request, but make it show its work: each claim cites code that a program checks, and each hunk is marked by what covers it. Route a person's reading to the hunks no checked evidence covers, and let the AI's measured record on planted bugs decide how much that reading is. A named engineer signs a receipt in git for exactly what was checked and what was read.

## Principles

1. **The AI advises, a human signs.** No merge without a named owner's receipt.
2. **Claims, not lines.** The review is a story traced to requirement items; people read what no evidence covers.
3. **Evidence over confidence.** Claims are Verified, Supported, Unverified or Refused; the model's own confidence is never shown.
4. **Verify before posting.** A citation that doesn't match the code is not posted, and every one caught is counted.
5. **Explainable routing.** Light, Focused or Full comes from rules a person can read, one line per reason.
6. **Written refusals.** A versioned list of what the AI never decides, each with the role that does.
7. **Measured trust, on a ladder.** Areas climb Shadow, Calibrated, Trusted on evidence and drop after an escape.
8. **Blind first.** Expectations come from the requirement before the author's story; a test counts only if it fails before the change and passes after.
9. **We don't grade our own homework.** Planted bugs come from an agent that never sees the reviewer's prompts, the prompt writers never see the plants, and every rate shows its sample size.

## Trade-offs

- We chose **readable routing rules** over a learned classifier because a reviewer can check a rule line by line, at the cost of missing risk no rule names.
- We chose **mechanical checks of quotes and tests** over asking the model how sure it is because code doesn't flatter itself, at the cost of striking true claims whose quote is paraphrased.
- We chose **planted bugs** over production history for calibration because we can control and count them now, at the cost of areas that look easy only because our plants were.
- We chose **a signature per change** over a dashboard of AI activity because accountability needs a name, at the cost of an engineer's time on every merge.
- We chose **a git note** over a database because the record travels with the repository, at the cost of tamper evidence that depends on the signature.

## Limits

- **No Trusted area without spot checks.** Catch rate alone never earns Trusted; five clean spot checks do.
- **Requirements are derived.** Tieto's sample changes have no written requirements, so we derived them; a real team's would be better and worse.
- **PR descriptions are synthetic.** We wrote the author descriptions and planted one false statement; they are labelled as such.
- **The plants come from the prompt author's session.** Separate agents kept each side blind to the other, but no second person planted them; a team should have someone outside the prompt work do it.
- **Some plants stand alone.** A plant's area follows its file's path, so the analyzer and security plants sit in files the original change doesn't touch; a lone edit there may be easier to spot than a real agent's bug.
- **Small n per area.** Every rate shows its sample size, and a small one is a weak rate.
- **The planted-bug catch rate measures the reviewer, not the agent.** It says how often the reviewer finds a planted kind of defect, not how often agents write that kind; real defect mixes differ.
- **A diff-only quote check strikes some true claims.** A claim about code the change doesn't touch, such as a caller left unchanged, has nothing in the diff to quote. It is struck and stays in the log.
- **Hunks are judged one at a time.** Two hunks can be fine alone and wrong together (a buffer rented in one, returned in another); routing doesn't see that interaction.
- **Notes are not tamper-evident without the signature.** An unsigned or unverified git note proves nothing.
- **One repository, one reviewer model.** Results say nothing yet about other code or models.

## How trust is measured

| Tieto's measure                                       | What we measure now                                                            | What a real deployment tracks                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Reverts and incidents don't rise as review time falls | Planted-bug catch rate per area, with n; simulated escapes on the report card  | Reverts and incidents of merged changes against reading time per change |
| AI findings are real and accepted                     | Findings checked against answer keys; hallucinations caught by the quote check | Share of findings the owner accepts, and the share that were wrong      |
| Time to merge                                         | Not measured yet                                                               | Time from open to signed receipt, by tier                               |
| Share routed to humans                                | Hunks per tier across the four sample changes (read 55 of 473; `mp-2283` 7 of 8) | Share of hunks and changes at Light, Focused and Full, per area         |

## The eight ideas

1. [Planted-bug calibration and a trust ladder](ideas/trust-ladder.md): the measured catch rate per area sets how much a person reads.
2. [Blind-first review](ideas/blind-first.md): the reviewer states what the requirement should produce before it reads the code.
3. [The hunk coverage map](ideas/coverage-map.md): every hunk is Verified, Supported or Read this (and Generated, outside the reading count).
4. [A mechanical quote check](ideas/quote-check.md): code confirms each quote is in the cited lines.
5. [A written refusal policy](ideas/refusal-policy.md): seven things the AI never decides.
6. [Evidence levels instead of confidence](ideas/evidence-levels.md): a claim is labelled by what backs it.
7. [The signed receipt in git](ideas/signed-receipt.md): the owner signs what was checked, bound to the exact diff.
8. [The author never checks its own work](ideas/separation-of-duties.md): an agent's own test is Supported at most, and a person signs.

Next ideas, **not built**: registered pull requests (the owner signs the tests before the agent codes); audit sampling for very large PRs; round-trip property tests for serializers; post-merge reverts as the live source of escapes.

## Beyond the reference

- **The receipt as a required merge check.** Branch protection refuses a merge without a verifying receipt for the current diff. Built as the `receipt` job in `countersign.yml`; the reference does not switch it on for its own `main`.
- **Trust ladders across teams.** Each team's areas keep their own level, so a new team starts in Shadow.
- **A spot-check workflow.** Owners get a queue of sampled Light changes; clean checks lift a level, and an escape drops it.
- **A refusal policy per organisation.** Each organisation edits the list and names its own roles.
- **The PR comment and "Prove it" button.** The tier and receipt status appear on the pull request (built: `pnpm review comment`, posted by the `review` job), and a button re-runs a claim's evidence (not built).
- **Reverts as escapes.** A revert of a merged change feeds the ladder automatically.
- **Organisation-managed signing.** Sigstore or similar replaces personal SSH keys.
- **Review slices instead of hunks.** A compiler's call and data-flow graph groups hunks that share a field or a caller, so a hunk that needs a human keeps its linked hunks in view.
- **A rule ratchet.** A finding a person makes becomes an executable rule, tested against the rejected and the fixed diff, that guards later changes.
- **A reviewer from another model family.** The receipt records the author's and the verifier's model families and flags a match.
