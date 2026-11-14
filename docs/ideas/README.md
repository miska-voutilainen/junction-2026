# The eight ideas

Eight ideas for reviewing agent-written code so that a named person can accept a change without reading all of it. Each one stands on its own: a product team can adopt one without the others. Countersign, the app in this repository, shows them working on Tieto's sample repository.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/ideas-overview-dark.svg">
  <img src="img/ideas-overview-light.svg" alt="One pull request left to right: an expectation from the requirement (idea 2), claims that cite code (idea 4), refusals (idea 5), tests on base and head (idea 6), route() coverage per hunk (idea 3), the owner signs a git note (idea 7). The trust ladder (idea 1), measured offline on planted bugs, feeds route(). Idea 8, the author never checks its own work, runs through all of it." width="880">
</picture>

| #   | Idea                                                            | In one sentence                                                                                                                 |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Planted-bug calibration and a trust ladder](trust-ladder.md)   | The reviewer's measured catch rate per area decides how much a person reads there.                                              |
| 2   | [Blind-first review](blind-first.md)                            | The reviewer writes what the requirement should produce before it reads the code or the author's story.                         |
| 3   | [The hunk coverage map](coverage-map.md)                        | Every hunk is Verified, Supported, Read this or Generated, from rules a person can read.                                        |
| 4   | [A mechanical quote check](quote-check.md)                      | Code checks that every quoted citation is really in the cited lines.                                                            |
| 5   | [A written refusal policy](refusal-policy.md)                   | Seven things the AI never decides, each with the role that does.                                                                |
| 6   | [Evidence levels instead of confidence](evidence-levels.md)     | A claim is labelled by what backs it, never by how sure the model felt.                                                         |
| 7   | [The signed receipt in git](signed-receipt.md)                  | The owner signs what was checked and what wasn't, bound to the exact diff.                                                      |
| 8   | [The author never checks its own work](separation-of-duties.md) | An agent's own test is Supported at most, the AI drafts the receipt but a person signs, and the planter never sees the prompts. |

[Why these eight ideas](why-these-ideas.md) sets out what each one is, what it adds over a typical AI reviewer and what the recorded results show. [From the challenge to the product](from-challenge-to-product.md) traces where the ideas came from, where each one appears in the app and how they feed each other.

## Next ideas (not built)

No screen shows these; they are recommendations in the concept card.

- **Registered pull requests:** the owner signs the tests before the agent writes any code.
- **Audit sampling for very large PRs:** read a statistically chosen share of hunks instead of all of them.
- **Round-trip property tests for serializers:** for a serializer, test that deserialising what was serialised gives the original.
- **Post-merge reverts as the live source of escapes:** a revert of a merged change feeds the trust ladder as an escape.

Numbers come from the report card (`data/eval/report-card.json`) and the recorded runs in `data/runs/`, each with its sample size. What isn't measured says "not measured yet" and why.

The diagrams in `img/` come in a light and a dark version, and each page shows the one that matches the reader's theme. They are drawn by `pnpm tsx scripts/idea-diagrams/draw.ts`: change the diagram's file there and re-run it, never edit the SVGs by hand.
