# The seven ideas

Seven ideas for reviewing agent-written code so that a named person can accept a change without reading all of it. Each one stands on its own: a product team can adopt one without the others. Countersign, the app in this repository, shows them working on Tieto's sample repository.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/ideas-overview-dark.svg">
  <img src="img/ideas-overview-light.svg" alt="One pull request left to right: an expectation from the requirement (idea 2), claims that cite code (idea 4), refusals (idea 5), tests on base and head (idea 6), route() coverage per hunk (idea 3), the owner signs a git note (idea 7). The trust ladder (idea 1), measured offline on planted bugs, feeds route()." width="880">
</picture>

| # | Idea | In one sentence |
| --- | --- | --- |
| 1 | [Planted-bug calibration and a trust ladder](trust-ladder.md) | The reviewer's measured catch rate per area decides how much a person reads there. |
| 2 | [Blind-first review](blind-first.md) | The reviewer writes what the requirement should produce before it reads the code or the author's story. |
| 3 | [The hunk coverage map](coverage-map.md) | Every hunk is Verified, Supported or Read this, from rules a person can read. |
| 4 | [A mechanical quote check](quote-check.md) | Code checks that every quoted citation is really in the cited lines. |
| 5 | [A written refusal policy](refusal-policy.md) | Seven things the AI never decides, each with the person who does. |
| 6 | [Evidence levels instead of confidence](evidence-levels.md) | A claim is labelled by what backs it, never by how sure the model felt. |
| 7 | [The signed receipt in git](signed-receipt.md) | The owner signs what was checked and what wasn't, bound to the exact diff. |

These pages are drafts. Numbers come from the planted-bug eval and the recorded runs, and say "not measured yet" until those have run.

The diagrams in `img/` come in a light and a dark version, and each page shows the one that matches the reader's theme. They are drawn by `pnpm tsx scripts/idea-diagrams/draw.ts`: change the diagram's file there and re-run it, never edit the SVGs by hand.
