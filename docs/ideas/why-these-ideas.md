# Why these eight ideas

What each idea is, how it works, what it does that a typical AI code reviewer doesn't, and why its design is finished for the reference. One-page versions of each idea are linked in the [index](README.md).

## The common thread

A typical AI reviewer posts a summary and a confidence score, and a person clicks Approve. Three things stay unanswered: what did the AI actually check, what did nobody read, and who is accountable. Each idea closes one of those gaps with something a person can inspect, a rule, a count or a signature, never with the model's opinion of itself.

| Gap                        | Ideas that close it                                        |
| -------------------------- | ---------------------------------------------------------- |
| What was checked?          | 2 Blind-first, 4 Quote check, 6 Evidence levels            |
| What still has to be read? | 3 Coverage map, 1 Trust ladder                             |
| Who is accountable?        | 5 Refusal policy, 7 Signed receipt, 8 Separation of duties |

## The ideas

### 1. Planted-bug calibration and a trust ladder

**What it is.** Someone who never sees the reviewer's prompts plants small, realistic bugs in Tieto's real code, each with an answer key. The reviewer runs on each blind. Its catch rate per area (generator, analyzer, security, performance) sets a level: Shadow (a person reads everything), Calibrated (Focused review at best) or Trusted (can route Light).

**How it works.** A catch is scored by code: a finding on the right file, within 3 lines of the planted range, in the same area. Below 3 plants or a 60% catch rate an area stays in Shadow. Trusted also needs 5 clean spot checks. An escape drops the area a level and sends its next changes to Full review. The three numbers sit in one policy file.

**Why it stands out.** Teams trust an AI reviewer everywhere or nowhere. This gives a per-area answer that can be measured and can be lost. The report card shows "caught of planted" with the sample size, never a bare percentage.

**Why it's relevant.** It answers Tieto's own question, "how do we know the review can be trusted", with a number the team produced instead of a vendor claim. The idea comes from continuous sampling in manufacturing inspection, where a defect that gets through sends you back to full inspection.

**Why the design is finished.** It has the three parts a calibration needs: a source of ground truth (plants), a mechanical score (no judge model) and a way back down (escapes). What remains is data, not design: more plants, and spot checks from real use. The concept card lists the limits (small n, plants are not real bugs) and the report card shows them.

### 2. Blind-first review

**What it is.** The reviewer writes what the requirement should produce before it sees the code or the author's description. The description is checked last, sentence by sentence.

**How it works.** A1 gets only the requirement and writes expected behaviours. A2 reads the hunks with that expectation beside them. A4 marks each sentence of the description supported, contradicted or unsupported. We also run an anchored mode (description first) and count how many planted false sentences each mode catches, over 2 runs each.

**Why it stands out.** Agent-written PRs arrive with a confident story. A reviewer who reads it first checks the code against the story, so a PR that says "adds a null check" passes if it adds one, whatever the requirement asked. Blind-first removes the anchor, and we measure its cost instead of asserting it.

**Why it's relevant.** It is the order of work that makes a second opinion independent. It costs one small extra call.

**Why the design is finished.** The prompt order is the whole mechanism, and the A/B count tests it. If blind-first doesn't catch more, the report card says so. On the recorded runs it did not: both modes caught 10 of 10 planted false sentences (5 plants, 2 runs each), so on this sample the anchoring effect is not visible. That is a result we report, not hide. 5 plants show a direction, not a law.

### 3. The hunk coverage map

**What it is.** Every hunk of a change gets exactly one state: Read this, Generated, Verified or Supported (first match wins). The change gets a tier, Light, Focused or Full, from rules, one reason line per rule that fired.

**How it works.** `route()` is a pure function: the same review and ladder levels always give the same tier. It runs in the pipeline and in the browser, so simulating an escape re-routes the page live. The top line reads like "Full · Read 7 of 8 hunks · ~10 min (full read ~10 min)", which is what the recorded `mp-2283` review shows today. Generated files (snapshots) stay visible but leave the count, so 400 snapshots can't hide 12 real hunks.

**Why it stands out.** "The AI reviewed it" gives a person nothing to act on. This gives a reading list and a reason for every hunk skipped. Because no model is in the routing, nobody has to trust it: they can read the rule.

**Why it's relevant.** Review time is the cost Tieto wants to cut. This is where the cut happens, and the line "Read r of n hunks" says how much and why. On `mp-2283` the honest answer today is 7 of 8, because the evidence leaves most hunks uncovered and the security area is in Shadow. Across Tieto's four changes it is 55 of 473, most of that cut from generated snapshots.

**Why the design is finished.** Deterministic, explained, tested, and the thresholds live in one policy file a team can argue about in a PR. A learned classifier would be harder to inspect and would not be better for the demo's purpose. The known gap is that hunks are judged one at a time; the concept card lists review slices as the next step.

### 4. A mechanical quote check

**What it is.** Every claim cites a file, a line range and an exact quote. Code checks that the quote is in those lines before anyone sees the claim.

**How it works.** Both sides are normalised the same way (line endings, whitespace runs) and matched as a substring on the cited side. One passing citation makes the claim Supported. None makes it Unverified. A finding with no passing citation is dropped. A refusal naming a rule that doesn't exist is struck. Every strike is logged and totalled on the report card.

**Why it stands out.** It catches invented code without a second model, and it counts how often the reviewer invented something. The hallucination rate becomes a number, not a worry.

**Why it's relevant.** Judges who ship software know a plausible but false line reference ruins trust in a whole review. This makes that failure visible and cheap to catch.

**Why the design is finished.** It does one job and says what it doesn't prove: a real quote can support a wrong claim, so a quote earns Supported and only a test earns Verified. Struck claims stay in the log, so the check can't hide its own mistakes.

### 5. A written refusal policy

**What it is.** Seven rules, versioned, for what the AI never decides, each naming the role that does: requirement intent, security design, data handling, irreversible changes, new dependencies, untraceable changes, public contract.

**How it works.** The reviewer reads the list and outputs a refusal (rule id, reason, hunks) instead of an opinion. Some rules are fixed by path, so a change to `PublicAPI.Unshipped.txt` reaches a human whatever the model says. A refusal sends the change to at least Focused review and appears in the receipt as residual risk the owner accepts in writing.

**Why it stands out.** An AI reviewer has an opinion on everything, and a human approves without noticing a decision was made. This writes down where its authority ends and makes "I don't decide this" a first-class output.

**Why it's relevant.** It is the cheapest idea to adopt (a list and a prompt paragraph) and the one a compliance reader understands at once. The MP-2283 example is real: a fix that silently drops a documented diagnostic should be refused, not approved.

**Why the design is finished.** Seven rules, each with an owner, is the right size; more becomes noise. AI rules and path rules cover both what a model can judge and what it must not. The limit is stated: the model decides when an AI rule applies, and seeding "should refuse" cases is how to measure it next.

### 6. Evidence levels instead of confidence

**What it is.** Each claim is Verified, Supported, Unverified or Refused. The model's own confidence is never shown.

**How it works.** The pipeline sets the level from what ran, never from what the model wrote. Verified is a test, not written by the authoring agent, that fails on base and passes on head, with both outputs shown. Supported is a matched quote or the PR's own test. Unverified is unchecked. A5 writes tests from the requirement without seeing the diff and runs them in two git worktrees. A claim whose test fails on head is retracted and logged.

**Why it stands out.** "Confidence: 92%" is an uncalibrated opinion. A level says what kind of proof exists, and the reader can look at it.

**Why it's relevant.** It is the vocabulary the whole product speaks. The coverage map, the receipt and the report card all use these four words.

**Why the design is finished.** Each level is earned by a check a person can read, and the weakest is shown as weakest. It says plainly what Verified means ("a test shows a difference", not "correct") and what can't be tested this way (docs, snapshots, build config). The .NET run is the riskiest part; if it can't run reliably, Supported is the top level and the product still works.

### 7. The signed receipt in git

**What it is.** The named owner signs a receipt of what was checked, what wasn't and what risk they accept. It is stored in git as a note on the head commit and bound to a hash of the exact diff.

**How it works.** `pnpm countersign draft` writes it, the owner edits, `sign` signs canonical JSON with their own SSH key, and `verify` is the merge gate. Verify exits 0 for a good signature on an unchanged diff, 1 for "Stale: the diff changed since signing", 2 for no receipt, 3 for an invalid signature. A second signature on the same commit is refused.

**Why it stands out.** "Approved by" on a PR says nothing about evidence and stays green when the diff changes. This record travels with the repository, names a person, lists the unread hunks and goes stale when the code moves.

**Why it's relevant.** Regulated delivery already asks who approved, what was checked and what risk was accepted, with the approver separate from the author. With an agent as author, the signer is that approver. It is an approval record, not a compliance claim.

**Why the design is finished.** It needs only git and `ssh-keygen`, fails closed (a forgotten note push gives exit 2) and binds tree hashes as well as the diff hash. Limits are named: a signature proves who signed, not that they read, so the receipt makes the unread part explicit. Organisation-managed signing is a deployment step, not a design gap.

### 8. The author never checks its own work

**What it is.** Whoever writes the code, the test, the receipt or the planted bugs never also judges them.

**How it works.** An agent's own test gives Supported at most. The AI drafts the receipt and only a person's key signs it. The planter never sees the prompts, pipeline or recorded output until the plants are merged. S2 and S4 show the roles: "Written by, Reviewed by, Signed by".

**Why it stands out.** An agent that writes code and test can put the same mistake in both, so a passing test counts as the same claim twice. Most tools count it as proof. Here it is capped one level below an independent test, and the cap is visible.

**Why it's relevant.** It is separation of duties, an old rule in audit (PCI DSS 6.2.3.1 asks for review by someone other than the author), applied to the new case where the author is an agent.

**Why the design is finished.** It costs no model calls and applies the same rule in four places. It admits what it doesn't solve: two agents of one model family share blind spots, and blind planting is enforced by lane, not by code.

## Why they work as a set

- **They share one vocabulary.** Evidence levels feed the coverage map, which feeds the tier, which feeds the receipt. Change one and the others still read.
- **None needs the model to be honest.** Code checks quotes, runs tests, routes hunks and verifies signatures. The model proposes; mechanisms decide.
- **Each can be adopted alone.** A team can start with the quote check or the refusal list without the ladder.
- **Each says what it does not prove.** Every page has a limits section and every number shows its sample size. Numbers the eval has not produced say "not measured yet".

## On "no room for improvement"

The design of each idea is complete for what this reference sets out to prove, and each page lists what it leaves out on purpose. The recorded results are in `data/eval/report-card.json`, and they are mixed:

| Result                  | Number                                                                                                                                                               | What it means                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planted bugs caught     | Generator 4 of 4, Analyzer 3 of 3, Security 0 of 3, Performance none planted                                                                                         | The reviewer is strong where it was tested well and blind in Security. The ladder puts Security at Shadow, so a person reads every hunk there. That is the ladder working as designed.                                                                                 |
| Anchored vs blind-first | 10 of 10 each (5 plants, 2 runs per mode)                                                                                                                            | No measured gap on this sample. Report it as such.                                                                                                                                                                                                                     |
| Quote check             | 0 failures in 917 quote checks                                                                                                                                       | Either the reviewer cites well or the check is lenient; the minimum-length rule in [Idea 4](quote-check.md) is the open question.                                                                                                                                      |
| Routing                 | All 4 Tieto changes go Full. A person reads 55 of 473 hunks, about 51 of 119 minutes. `mp-2283` is 7 of 8, `mp-2234` 7 of 9, `mp-2129` 20 of 33, `mp-2297` 21 of 423 | The saving is real on the large snapshot-heavy change (`mp-2297`) and small on the others. No change reaches Light or Focused: three go Full because most hunks still need reading (`R-read-share`), and `mp-2129` because of its size (`R-size`, 1043 changed lines). |

Two things follow. The mechanisms work and are inspectable. And the headline saving ("read 2 of 8") is not what the data shows: three of four changes are mostly read, and the big saving comes from generated snapshots. The pitch should lead with accountability and evidence, with measured routing as the honest second point. Known next steps, none built: registered pull requests, audit sampling for very large PRs, round-trip tests for serializers, reverts as live escapes. A judge who finds a limit has found one the concept card already names ([Limits](../concept-card.md#limits)).
