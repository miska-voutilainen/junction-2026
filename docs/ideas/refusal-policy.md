# Idea 5 · A written refusal policy

A short, versioned list of what the AI reviewer never decides, each item naming the person who decides instead.

> Draft. How often each rule fires on Tieto's changes comes from recorded runs and is "not measured yet".

## The problem

An AI reviewer will give an opinion on anything it's asked. Some questions aren't the reviewer's to answer: whether the requested behaviour is the right one, whether a change to a public API is acceptable, whether a new dependency's licence is fine. When the AI answers those, a human approves without noticing that a decision was made. The fix isn't a smarter model; it's writing down where its authority ends.

## How it works

1. **Seven rules, versioned.** Policy `v1`:

   | Rule | The AI doesn't decide | Decides |
   | --- | --- | --- |
   | `R1` | Requirement intent: whether the requested behaviour is right | Product owner (the library maintainers) |
   | `R2` | Security design: trust boundaries, untrusted input, crypto, secrets | Security owner |
   | `R3` | Data handling: retention, personal data, legal | Data protection owner |
   | `R4` | Irreversible changes: wire or stored formats old readers can't read, destructive migrations, deletion | Change owner |
   | `R5` | New third-party dependencies and licences | Tech lead |
   | `R6` | Changes it can't trace to the requirement | Change owner |
   | `R7` | Public contract: new or changed public API, diagnostic IDs, documented behaviour | API owner (the maintainers) |

2. **The reviewer reads the policy.** The area review step (A3) gets the rule ids, titles and deciders with the change. When a hunk falls under a rule, it outputs a refusal: the rule id, its reason, and the hunks it covers.
3. **A refusal routes to a person.** Any refusal sends the change to at least Focused review (`R-refusal`, [Idea 3](coverage-map.md)) and marks its hunks Read this.
4. **The owner accepts it in writing.** The signed receipt lists the refusals the owner accepted as residual risk ([Idea 7](signed-receipt.md)). A refusal can't disappear between the review and the merge.

An example from Tieto's change MP-2283: the fix stops the generator crashing on types from a referenced assembly, and in doing so it silently drops a diagnostic for those types. Whether that's acceptable is documented behaviour, so the reviewer should refuse it under `R7` (or `R1`) and hand it to the maintainers.

## What we measured

Not measured yet. The review of MP-2283 is expected to refuse under `R7` or `R1`; the recorded run will show whether it does.

## How to adopt it

- **What you need:** your own list. Ours is written for a C# library; a web product would add rules for accessibility or payments. Keep it under ten rules, each with a named role.
- **What it costs:** a few hundred tokens of policy in the review prompt.
- **Smallest first step:** write the list in your repository, put it in your review prompt, and show refusals separately from findings. A refusal isn't a bug report; it's a question with an owner.

## Limits and failure modes

- **The model decides when a rule applies.** It can miss a refusal it should have made. The ladder's planted bugs don't measure this yet; seeding "should refuse" cases is the next step.
- **Too many refusals is noise.** A reviewer that refuses everything routes everything to a human. The count per rule shows that drift.
- **Deciders are roles, not people.** The receipt names the person; mapping roles to people is left to each team.

## In the code

- [`src/policy/refusals.ts`](../../src/policy/refusals.ts): the seven rules, `refusalPolicyVersion = "v1"`
- `src/prompts/a3.ts`: the area review that outputs refusals (T13, in progress)
- Shown on screen S2, the Refused tab: each refusal with its rule, reason, decider and hunks
