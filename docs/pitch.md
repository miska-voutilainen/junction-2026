# Pitch

The script for the video, the table and the top-5 pitch is in [demo.md](demo.md); its numbers are filled in at the freeze. This page holds what the pitch must do. Spec section 1 (Pitch spine, Final submission) has the rest.

## What decides it, in order

0. **Nothing breaks old code.** Tieto runs old infrastructure and names new agent code that breaks it as the main risk. We open with the legacy guard ([idea 9](ideas/legacy-guard.md)): the old-platform touch in `mp-2297` that no test project runs, shown as unguarded, with its owner. Then evidence and separation of duties (6, 8), the trust ladder (1), the coverage map and refusals (3, 5), and the quote check and blind-first review (4, 2) as guards on the AI's own words.
1. **Real numbers.** The pipeline and the planted-bug eval must run, so the report card shows real catch rates with their sample sizes. Without them the ideas are claims. That's Tieto's Measurement criterion (25%).
2. **The video shows the mechanics working, not slides.** In 2 minutes: a test failing before the change and passing after it, a struck citation, `pnpm countersign verify` printing a valid signature.
3. **One line people remember.** Working draft: "We measure the AI reviewer before we trust it, and you sign for exactly what you read."
4. **All three of us at the table** for the live peer review, Sun 15.11 10:30–13:00. It's a condition for the main prize.

## Deck

The submission needs a PDF deck, and the top-5 pitch uses it. Nine slides, one idea each, in the order of the [demo script](demo.md). Screenshots are taken at the freeze from production at 1440 px with real data; numbers use the `{N…}` slots from the demo script, so the deck and the video say the same thing.

| #   | Title                                   | On the slide                                                                                                                                                                                               | Says                                                              |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Countersign                             | The logo, the line "AI reviews. A named human countersigns.", the production URL, Tieto challenge "Earned Trust in AI Code"                                                                                | Who we are, in one line                                           |
| 2   | The engineer signing an agent's PR      | One sentence of the problem (spec section 1, User and Problem) and the two bad options: skim and rubber-stamp, or read every line                                                                          | Why this matters now                                              |
| 3   | Read only this                          | S2 screenshot: tier banner, legacy touch list and hunk navigator; "read `{N2}` of `{N3}` hunks"; slide 2's old-code risk answered first by idea 9, the legacy guard                                       | Ideas 9, 3, 4, 6: legacy guard, coverage map, quote check, evidence levels |
| 4   | Evidence, not confidence                | S2 screenshot: a Verified claim with "Fails on the base commit / Passes on this change"                                                                                                                    | Idea 6, and idea 8: a test the agent didn't write                 |
| 5   | It caught the author out                | S2 Blind check: "The PR says … / The code does …" and the count `{N8}`                                                                                                                                     | Idea 2: blind-first, measured                                     |
| 6   | What the AI won't decide                | S2 Refused: `{N9}`, each with its rule and who decides                                                                                                                                                     | Idea 5: the refusal policy                                        |
| 7   | Signed in git, measured on planted bugs | S4 receipt with the verify output `{N13}`; S3 trust ladder `{N11}` with the sample size                                                                                                                    | Ideas 7 and 1                                                     |
| 8   | Concept card                            | The recommendation, the nine principles in one line each, two trade-offs and two limits from [concept-card.md](concept-card.md)                                                                            | Tieto's Clarity criterion (30 %)                                  |
| 9   | What Tieto can take                     | The nine ideas in trust-first order, linking to [docs/ideas/](ideas/README.md); "Beyond the reference" in three lines (receipt as a merge check, spot-check workflow, organisation-managed signing); team: Miska, Elias, Veijo | What's next, and who                                              |

Rules for the slides: the design tokens' dark theme, system font, no stock images, no gradients; every number with its sample size; nothing a judge can't find in the app or the repo.

## Lead with

What's new is the combination, not any single idea: the reviewer is measured on bugs planted blind before it's trusted, and the signature records exactly what a person read. Tieto asked who makes decisions and when human oversight is required ([research](research.md), "Tieto's own words"); the pitch answers both.
