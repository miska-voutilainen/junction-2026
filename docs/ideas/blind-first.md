# Idea 2 · Blind-first review, with the anchoring effect measured

The reviewer writes down what the requirement should produce before it reads the code or the author's description, and we count how much reading the description first costs.

> Draft. The anchored-versus-blind count comes from T16 and is "not measured yet" until it runs.

## The problem

An agent-written pull request arrives with the agent's own story of what it did. A reviewer that reads that story first, human or AI, tends to check the code against the story instead of against the requirement. If the story says "adds a null check" and the code adds one, the review passes, even when the requirement asked for something else. The author's description is the most convenient input and the most anchoring one.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/blind-first-dark.svg">
  <img src="img/blind-first-light.svg" alt="Two lanes. Anchored: author's description first, A1 skipped, A2, A4. Blind-first: requirement first, A1 expectation before any code, A2, A4 reads the description last. Each lane has 15 chances to catch 5 planted false sentences." width="880">
</picture>

1. **Expectation first, from the requirement only.** Step A1 gets the requirement (intent, functional and non-functional items) and one fixed paragraph about the repository. No diff, no description. It writes, per requirement item, the behaviours it expects (1 to 5), the areas likely touched and the tests it would expect.
2. **Then the code.** Step A2 reads the hunks and the touched files, with A1's expectation beside them, and writes the change's story and its claims, each citing code.
3. **The description comes last.** Step A4 reads the author's description only now and checks each sentence against the claims: `supported`, `contradicted` or `unsupported`. A contradicted or unsupported sentence becomes a finding.
4. **Tests are blind-first too.** Step A5 writes one test per functional requirement item from the requirement and A1's expectation, never from the diff. A test counts as evidence only if it fails before the change and passes after it ([Idea 6](evidence-levels.md)).
5. **We measure the effect instead of asserting it.** The evidence lane plants false sentences in pull request descriptions (5 "contradiction plants"). The same reviewer runs 3 times in each mode on each plant:
   - **Anchored:** A2 reads the description first, A1 is skipped.
   - **Blind-first:** A1, A2 and A4 in the order above (A3 and A5 are skipped in these runs).

   A plant counts as caught in a run when A4 marks the planted sentence `contradicted` or `unsupported`. The result is two counts, "anchored caught x of 15, blind-first caught y of 15".

## What we measured

Not measured yet. The report card will show both counts with their sample size and the per-plant breakdown. If blind-first doesn't catch more, the report card says that too: the point is to measure, not to win.

## How to adopt it

- **What you need:** requirements written down somewhere your reviewer can read them (a ticket is enough), and the discipline to keep the PR description out of the first prompt.
- **What it costs:** one extra model call per review (the expectation), small because it reads only the requirement.
- **Smallest first step:** reorder your existing review prompt. Put the requirement first, ask for expected behaviours, and only then append the diff. Keep the author's description for a separate "does the description match the code?" check.

## Limits and failure modes

- **No requirement, no blind-first.** A change with no requirement behind it can't be reviewed this way. Our refusal policy routes untraceable changes to a human (rule R6, [Idea 5](refusal-policy.md)).
- **The expectation can be wrong.** A1 can misread the requirement. It informs the review; it never overrides what the code and tests show.
- **Five plants is a small sample.** The count shows a direction, not a law. Each run is recorded so anyone can recount.

The failure modes we saw go in `docs/lessons.md` once the runs are recorded.

## In the code

- `src/prompts/a1.ts`: the blind expectation, which never receives the diff or the description (T12, in progress)
- `src/prompts/a4.ts`: the contradiction check that reads the description last (T13, in progress)
- The step order in `src/pipeline/` and the `--anchored` flag for the comparison runs (T12–T13, in progress)
- Shown on screen S2, the Blind check tab: what the requirement predicted next to what the code does
