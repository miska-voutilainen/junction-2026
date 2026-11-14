# Pitch

The script for the video, the table and the top-5 pitch is in [demo.md](demo.md); its numbers are filled in at the freeze. This page holds what the pitch must do. Spec section 1 (Pitch spine, Final submission) has the rest.

## What decides it, in order

0. **Nothing breaks old code.** Tieto runs old infrastructure and names new agent code that breaks it as the main risk. We open with the legacy guard ([idea 9](ideas/legacy-guard.md)): the old-platform touch in `mp-2297` that no test project runs, shown as unguarded, with its owner. Then evidence and separation of duties (6, 8), the trust ladder (1), the coverage map and refusals (3, 5), and the quote check and blind-first review (4, 2) as guards on the AI's own words.
1. **Real numbers.** The pipeline and the planted-bug eval must run, so the report card shows real catch rates with their sample sizes. Without them the ideas are claims. That's Tieto's Measurement criterion (25%).
2. **The video shows the mechanics working, not slides.** In 2 minutes: a test failing before the change and passing after it, a struck citation, `pnpm countersign verify` printing a valid signature.
3. **One line people remember.** Working draft: "We measure the AI reviewer before we trust it, and you sign for exactly what you read."
4. **All three of us at the table** for the live peer review, Sun 15.11 10:30–13:00. It's a condition for the main prize.

## Deck

The submission needs a PDF deck, and the top-5 pitch uses it. Nine slides in trust-first order: the legacy guard, evidence and separation of duties, the reading list, the trust ladder, the receipt, then the guards on the AI's own words. The [demo script](demo.md) follows the same order. Screenshots are taken at the freeze from production at 1440 px with real data; numbers use the `{N…}` slots from the demo script, so the deck and the video say the same thing.

| #   | Title                                   | On the slide                                                                                                                                                                                               | Says                                                              |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Countersign                             | The logo, the line "AI reviews. A named human countersigns.", the production URL, Tieto challenge "Earned Trust in AI Code"                                                                                | Who we are, in one line                                           |
| 2   | The engineer signing an agent's PR      | One sentence of the problem (spec section 1, User and Problem) and the two bad options: skim and rubber-stamp, or read every line                                                                          | Why this matters now                                              |
| 3   | Nothing breaks old code                 | S2 screenshot of `mp-2297`: the legacy touch list, "Old platform: `#if !NETSTANDARD2_0 && !NETFRAMEWORK` in 11 hunks", status **Unguarded** ("no test runs it on netstandard or .NET Framework"), owner: the maintainers; tier Full | Idea 9: the moment no other AI reviewer shows. Slide 2's old-code risk answered first |
| 4   | Evidence, not confidence                | S2 screenshot of `mp-2283`: a Verified claim with "Fails on the base commit / Passes on this change"                                                                                                       | Idea 6, and idea 8: a test the agent didn't write                 |
| 5   | Read 6 of 8, and who reads what         | S2 tier banner and hunk navigator of `mp-2283`: "Read 6 of 8 hunks", the roles line                                                                                                                        | Ideas 3 and 5: coverage map, refusals                             |
| 6   | Trusted by measurement                  | S3 trust ladder `{N11}` with the sample size; the planted-bug catch rates                                                                                                                                  | Idea 1: the trust ladder                                          |
| 7   | Signed in git                           | S4 receipt with the verify output `{N13}`                                                                                                                                                                  | Idea 7: the receipt                                               |
| 8   | The AI's own words are checked          | S2 struck citation from the quote check; Blind check "The PR says … / The code does …" and the count `{N8}`                                                                                                | Ideas 4 and 2: quote check, blind-first                           |
| 9   | Concept card, and what Tieto can take   | The recommendation and the nine principles in one line each ([concept-card.md](concept-card.md)); the nine ideas in trust-first order, linking to [docs/ideas/](ideas/README.md); "Beyond the reference" in three lines (receipt as a merge check, spot-check workflow, organisation-managed signing); team: Miska, Elias, Veijo | Tieto's Clarity criterion (30 %), what's next, and who            |

Rules for the slides: the design tokens' dark theme, system font, no stock images, no gradients; every number with its sample size; nothing a judge can't find in the app or the repo.

## The first concrete moment

`mp-2297`, a real MessagePack-CSharp change. 11 of its hunks sit behind `#if !NETSTANDARD2_0 && !NETFRAMEWORK`, and every source-generator test project targets net8.0, so nothing runs that code on the old platforms. S2 shows the touch as **Unguarded**, routes the change Full under rule `R-legacy-guard`, and names the platform owner (the maintainers) who reads those hunks. Source: `data/runs/mp-2297/review.json`, `legacyTouchPoints` and `routing`. The pitch says this before anything about evidence or ladders.

Next comes `mp-2283`: routed Full, "Read 6 of 8 hunks", two of its claims Verified by a test that fails on the base commit and passes on the change. Source: `data/runs/mp-2283/review.json`, `routing`.

## Lead with

What's new is the combination, not any single idea: the reviewer is measured on bugs planted blind before it's trusted, and the signature records exactly what a person read. Tieto asked who makes decisions and when human oversight is required ([research](research.md), "Tieto's own words"); the pitch answers both.
