# Idea 2 · Blind-first review, with the anchoring effect measured

The reviewer writes down what the requirement should produce before it reads the code or the author's description, and we count how much reading the description first costs.

## The problem

An agent-written pull request arrives with the agent's own story. A reviewer who reads it first, human or AI, checks the code against the story instead of the requirement. If the story says "adds a null check" and the code adds one, the review passes, even when the requirement asked for something else.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/blind-first-dark.svg">
  <img src="img/blind-first-light.svg" alt="Two lanes: anchored reads the description first; blind-first writes an expectation from the requirement, then reads the code, then the description." width="880">
</picture>

1. **Expectation first (A1).** It gets the requirement and one fixed paragraph about the repository. No diff, no description. Per requirement item it writes 1 to 5 expected behaviours, the areas likely touched and the tests it would expect.
2. **Then the code (A2).** It reads the hunks with A1's expectation beside them and writes the story and claims, each citing code.
3. **The description last (A4).** It checks each sentence against the claims: `supported`, `contradicted` or `unsupported`. The last two become findings.
4. **Tests are blind-first too (A5).** One test per functional item, written from the requirement, never from the diff ([Idea 6](evidence-levels.md)).
5. **We measure the effect.** An isolated agent that never sees the prompts plants false sentences in 5 PR descriptions. The reviewer runs 2 times per mode on each:
   - **Anchored:** A2 reads the description first; A1 is skipped.
   - **Blind-first:** A1, A2, A4 in order (A3 and A5 skipped).

   A plant is caught when A4 marks it `contradicted` or `unsupported`. The result is "anchored caught x of 15, blind-first caught y of 15", with each plant's count per run so a lucky run shows.

## What we measured

From the report card: 5 planted false sentences (`cp0`–`cp2` on MP-2283, `cp3` on MP-2234, `cp4` on MP-2129), 3 runs per mode. Anchored caught 15 of 15; blind-first caught 15 of 15. Every plant was caught in every run of both modes, so these plants sit at the ceiling and show no anchoring effect; the third run per mode (#216) did not change that. Our reading: each false sentence contradicts code the reviewer reads anyway, so subtler plants are the next test. Five of them (`cp5` to `cp9`, mostly true and wrong in one detail) are written by an isolated agent blind to the prompts, but not yet run ([lessons.md](../lessons.md)). These are our own recorded runs, not a preregistered study.

## How to adopt it

- **You need:** requirements your reviewer can read (a ticket is enough) and the discipline to keep the description out of the first prompt.
- **It costs:** one extra model call per review, small because it reads only the requirement.
- **First step:** put the requirement first in your prompt, ask for expected behaviours, then append the diff. Check the description separately.

## Limits and failure modes

- **No requirement, no blind-first.** Untraceable changes go to a human (`R6`, [Idea 5](refusal-policy.md)).
- **The expectation can be wrong.** A1 informs the review and never overrides what the code and tests show.
- **Five plants is a small sample.** The count shows a direction, not a law; every run is recorded so anyone can recount.

Failure modes we saw go in `docs/lessons.md`.

## Where it comes from

A study of code review with AI hints (Tufano et al., 29 developers) found that reviewers who started from the AI review found more low-severity issues but not more high-severity ones; figures and caveats in [`docs/research.md`](../research.md). Preregistration in science (Registered Reports, Chambers 2013) writes expectations down before seeing results.

## In the code

- [`src/prompts/a1.ts`](../../src/prompts/a1.ts): writes the expectation; never receives the diff or the description
- [`src/prompts/a4.ts`](../../src/prompts/a4.ts): checks the description against the code, run last
- Step order and the `--anchored` flag (which shows the description first, for the comparison) in [`src/pipeline/steps.ts`](../../src/pipeline/steps.ts) and [`src/pipeline/runReview.ts`](../../src/pipeline/runReview.ts)
- Shown on S2, the Blind check tab
