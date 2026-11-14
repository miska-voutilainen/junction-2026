# Idea 5 · A written refusal policy

A short, versioned list of what the AI reviewer never decides, each item naming the person who decides instead.

## The problem

An AI reviewer gives an opinion on anything. Some questions aren't its to answer: whether the requested behaviour is right, whether a public API change is acceptable, whether a dependency's licence is fine. When it answers, a human approves without noticing a decision was made. The fix isn't a smarter model; it's writing down where its authority ends.

## How it works

1. **Seven rules, policy `v1`:**
   - `R1` requirement intent: whether the requested behaviour is right. Decides: product owner (the maintainers).
   - `R2` security design: trust boundaries, untrusted input, crypto, secrets. Security owner.
   - `R3` data handling: retention, personal data, legal. Data protection owner.
   - `R4` irreversible changes: formats old readers can't read, destructive migrations, deletion. Change owner.
   - `R5` new third-party dependencies and licences. Tech lead.
   - `R6` changes it can't trace to the requirement. Change owner.
   - `R7` public contract: new or changed public API, diagnostic IDs, documented behaviour. API owner (the maintainers).
2. **The reviewer reads the policy.** The area review (A3) gets rule ids, titles and deciders. For a hunk under a rule it outputs a refusal (rule id, reason, hunks) with `source: "ai"`. The quote check strikes a refusal whose rule id isn't in the policy ([Idea 4](quote-check.md)).
3. **Some refusals don't depend on the model.** Fixed rules match paths and produce `source: "rule"` refusals. `R7` is fixed for `**/PublicAPI.Unshipped.txt` and `src/MessagePack.Annotations/**`: those changes reach a human whatever the model says.
4. **A refusal routes to a person.** It sends the change to at least Focused review (`R-refusal`, [Idea 3](coverage-map.md)) and marks its hunks Read this.
5. **The owner accepts it in writing.** The draft receipt lists each refusal as residual risk ([Idea 7](signed-receipt.md)), so removing one is a visible edit the owner signs.

Example, Tieto's MP-2283: the fix stops the generator crashing on types from a referenced assembly and silently drops a diagnostic for them. That is documented behaviour, so the reviewer should refuse under `R7` (or `R1`) and hand it to the maintainers.

## What we measured

Tieto's changes: `R7` (public contract) in 3 of 4. MP-2283 on its README and MsgPack004 doc hunks, MP-2129 on a new public attribute, MP-2234 on documented analyzer behaviour; MP-2297 had no refusal. Across 10 planted-bug runs: `R7` in 8, `R2` in 3, `R6` in 1, none in 1; no fixed path rule fired. `R2` fired on exactly the three security plants, the bugs the reviewer missed ([Idea 1](trust-ladder.md)), so those changes still reached the security owner.

## How to adopt it

- **You need:** your own list, under ten rules, each with a named role. A web product would add accessibility or payments.
- **It costs:** the rules as prompt text, no extra model call; each fixed rule is a path glob.
- **First step:** write the list in your repository, put it in the prompt and show refusals apart from findings. A refusal is a question with an owner. Then turn the rules you'd never leave to a model into path rules.

## Limits and failure modes

- **The model decides when an AI rule applies** and can miss one. Planted bugs don't measure this yet; seeding "should refuse" cases is next. Fixed rules cover only what a path can express.
- **Too many refusals is noise.** The count per rule shows drift.
- **`verify` doesn't yet compare** the receipt's `acceptedRefusalIds` with the review's refusals.
- **Deciders are roles, not people;** mapping them is left to each team.

## In the code

- [`src/policy/refusals.ts`](../../src/policy/refusals.ts): the seven rules, `refusalPolicyVersion = "v1"`
- `src/prompts/a3.ts`: the area review that outputs refusals
- Shown on S2, the Refused tab: rule, reason, decider, hunks, source
