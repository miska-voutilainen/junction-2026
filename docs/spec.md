# Spec: <project name>

<!--
The single source of truth for WHAT we build. Written at kickoff (kickoff skill), changed only by a PR that the affected lane owners agree on.
Write it so an agent can build any task below without asking a question: concrete values, exact copy, real field names, no "etc.", no "TBD" in anything a task depends on.
Every task in section 9 becomes a GitHub issue; "go" works through them.
-->

Status: <draft | ready> · Last change: <YYYY-MM-DD HH:MM> · Feature freeze: <day HH:MM> · Submission deadline: <day HH:MM>

## 1. Product

- **Pitch:** <one sentence: what it does, for whom>
- **User:** <a specific person, their situation>
- **Problem:** <what hurts, how often, how they cope today>
- **Insight:** <what we see or do that others miss>
- **Partner tech:** <which models, APIs or hardware of the challenge partner, and why each is essential here>
- **Judging criteria:** <copied from the challenge, one per line, each with where in the demo we meet it>

## 2. Demo path

<!-- The 3-6 steps a judge sees, in order. The "wow" moment within the first 30 seconds. Every task serves one of these steps. -->

| Step | The user does | The user sees | Acceptance (testable) | Screens |
| --- | --- | --- | --- | --- |
| 1 | | | | S1 |

## 3. Screens

<!-- One block per screen. Exact copy in quotes. Every state written out; "standard error state" is not enough. -->

### S1 · <name> (`<route>`)

- **Purpose:** <one line>
- **Layout:** <regions top to bottom at 1440 px; how it collapses at 375 px; reference sketch in docs/design/ if any>
- **Elements:** <each element: what it shows, what it does on click, keyboard behaviour>
- **States:** loading: <...> · empty: "<exact copy>" + <action> · error: "<exact copy>" + <recovery> · success: <...>
- **Copy:** <every visible string not listed above>

## 4. Data

<!-- Entities, fields with types and constraints, where each comes from (partner API, seed, user), what is stored, what is never stored. -->

| Entity | Field | Type | Constraints | Source |
| --- | --- | --- | --- | --- |
| --- | --- | --- | --- | --- |

Seed data: <what the demo dataset contains, how many records, which story it tells>

## 5. Contracts between lanes

<!-- Every API route, event or shared type another lane depends on. The code version lives in the contracts file named in CLAUDE.md; this section describes it. -->

| Contract | Producer lane | Consumer lane(s) | Request / input | Response / output | Errors |
| --- | --- | --- | --- | --- | --- |
| --- | --- | --- | --- | --- | --- |

## 6. AI behaviour

<!-- One block per model call. -->

### A1 · <what it does>

- **Model:** <provider and model id> · why this one: <...>
- **Input:** <fields and where they come from>
- **Output schema:** <fields and types; the code validates against it>
- **Prompt intent:** <what the prompt must achieve, tone, constraints; the prompt file itself is code>
- **Latency budget:** <first token / total> · **Streaming:** <yes/no>
- **Fallback:** <on timeout, invalid output, provider down; the recorded-response flag>
- **Eval cases:** <at least 5: input → the property the output must have>

## 7. External integrations

<!-- Partner and third-party APIs: endpoint, auth (env var name only), rate limits, what we call and when, the mock we use until it works. -->

## 8. Out of scope

<!-- Explicit list. Anything not on the demo path is hidden or removed, never half-built. -->

-

## 9. Work plan

<!--
Tasks in build order. Each becomes a GitHub issue (labels: task, lane:<lane>), titled "T<nn> <title>".
A task is one PR (tier S or M, at most L), owned by one lane, with acceptance criteria a test can check.
Dependencies only on tasks with lower numbers. Cross-lane needs are their own tasks in the producing lane.
Build order: T00 is the agent harness core (kickoff builds it). Then foundation tasks (T01…: design system; format-on-edit and quality-on-stop hooks with the lint config, docs/setup.md 4.3-4.4; test harnesses and the AI client module; CI, docs/setup.md 6; deployed skeleton with preview per PR; docs), one or two per lane; then contracts and mocks, so lanes work in parallel from the start; then features.
Size: about 1-3 hours of agent work and 100-400 changed lines each. Every PR carries ~10-20 minutes of fixed overhead (CI, preview, e2e, reviews), so fold small copy or styling items into the task they belong to.
-->

| ID | Lane | Title | Depends on | Demo step | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| T00 | <kickoff lane> | Agent harness core (lane map, lane module, guard, briefing, tests) | – | – | docs/setup.md 4.6 tests pass; 4.7 steps 1-5 pass |
| T01 | | | T00 if it needs the lane module | | |

## 10. Open questions

<!-- Must be empty, or each item owned by a person with a deadline and the tasks it blocks, before Status is "ready". -->

-

## Ready checklist

<!-- Status becomes "ready" only when every box is ticked. -->

- [ ] Every demo step has testable acceptance and names its screens.
- [ ] Every screen has its layout at both widths, all four states and exact copy.
- [ ] Every contract has field names, types and errors; producer and consumer lanes are named.
- [ ] Every AI call has a model, output schema, latency budget, fallback and eval cases.
- [ ] Every task has one lane, its dependencies, a demo step and acceptance criteria a test can check.
- [ ] Nothing a task depends on says "TBD", "etc." or "something like".
- [ ] Cold-read check passed: a fresh agent listed no questions for three random tasks.
- [ ] Open questions empty or owned with deadlines.
