# Idea 1 · Planted-bug calibration and a trust ladder per area

Test the AI reviewer on bugs planted by someone who never sees its prompts, and let its measured catch rate in each area decide how much a human has to read there.

> Draft. The numbers come from the planted-bug eval (T16) and are "not measured yet" until it runs.

## The problem

Teams either trust an AI reviewer everywhere or nowhere, and both choices are guesses. A reviewer can be sharp on generator code and blind to security bugs in the same repository, and nobody knows which until a bug escapes. Trust in a reviewer should be earned per area, from evidence, and lost the same way.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/trust-ladder-dark.svg">
  <img src="img/trust-ladder-light.svg" alt="The trust ladder: Shadow (fewer than 3 planted bugs or under 60% caught, routes nothing), Calibrated (routes Focused at best), Trusted (5 clean spot checks, can route Light). Evidence moves an area up; an escape moves it down one level." width="880">
</picture>

1. **Areas come from paths.** Each repository defines its review areas. For Tieto's MessagePack-CSharp we use four: `generator`, `analyzer`, `security`, `performance`. A file's area comes from its path, first match wins (for example `src/MessagePack.SourceGenerator/Analyzers/**` → `analyzer`).
2. **Someone else plants the bugs.** A teammate who never opens the prompts or the reviewer's output writes small, realistic bugs into the real code, each with an answer key: file, line range, area, what's wrong. The reviewer runs on each one blind.
3. **A catch is scored mechanically.** A planted bug counts as caught when a finding cites the answer key's file, its lines overlap the planted range within ±3 lines, and its area matches.
4. **The catch rate sets a level.** Each area sits on a three-step ladder:

   | Level | Rule | What the AI's output may do |
   | --- | --- | --- |
   | Shadow | fewer than 3 planted bugs, or catch rate below 60% | The reviewer runs, but routes nothing: every hunk in the area is read by a human |
   | Calibrated | not Shadow, and fewer than 5 clean spot checks | Routes the change to Focused review at best |
   | Trusted | not Shadow, and 5 or more clean spot checks | Can let the change through on Light review |

5. **An escape drops a level.** A bug that reaches a human anyway (an "escape") moves the area down one step: Trusted → Calibrated → Shadow.
6. **People set the thresholds; the evidence moves the level.** The numbers 3, 60% and 5 live in one policy file, so a team can argue about them in a pull request.

## What we measured

Not measured yet. The eval runs the reviewer on 10 planted bugs across the four areas, and the report card shows each area's catch rate with its sample size ("4 of 5 caught"), never a bare percentage.

We have no spot-check workflow in this reference implementation, so `spotChecksClean` is 0 and no area can reach Trusted. The report card screen says so instead of hiding it.

## How to adopt it

- **What you need:** a list of review areas with path rules, a person who writes planted bugs without seeing the reviewer's prompts, and an answer key per bug.
- **What it costs:** one reviewer run per planted bug. Ten bugs is one evening of writing and a few dollars of model calls.
- **Smallest first step:** start every area in Shadow. Plant three bugs in the area you care about most, run your reviewer on them, and publish the catch rate with its sample size. That alone changes the conversation from "do we trust the AI?" to "do we trust it here, on this evidence?".

## Limits and failure modes

- **Small samples.** Three planted bugs is a floor, not proof. A rate of 2 of 3 can be luck, which is why the sample size is always shown next to the rate.
- **Planted bugs aren't real bugs.** People who plant bugs write the kind they can think of. The ladder measures that, and real escapes correct it.
- **Blindness has to be enforced socially.** If the bug writer reads the prompts, the plants bend toward what the reviewer already catches. We keep the planting in a separate lane, merged before anyone looks at review output.

The failure modes we saw in our own runs go in `docs/lessons.md` once the eval has run.

## In the code

- [`src/rules/ladder.ts`](../../src/rules/ladder.ts): `ladderLevel()` and `applyEscapes()`, pure functions
- [`src/policy/ladder.ts`](../../src/policy/ladder.ts): the thresholds `minPlanted: 3`, `minCatchRate: 0.6`, `spotChecksForTrusted: 5`
- Eval scoring in `src/pipeline/` (T16, in progress)
- Shown on screen S3, "Can the reviewer be trusted?", the ladder per area
