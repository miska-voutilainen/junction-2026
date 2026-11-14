# Demo

The script for the three places Countersign is shown: the 2-minute video, the live peer review at our table (Sun 15.11 10:30–13:00) and, if we reach the top five, the 3-minute pitch (Sun 14:15). The story is spec section 2: three moments, all on `mp-2283`, all from recorded runs. No model runs live.

**How to finish this page at the freeze.** The script is written; only the numbers are missing. Every number is a slot like `{N3}`. Fill the "Value" column of [Numbers](#numbers) from the file named in "Source", then replace each slot in the text with its value (`grep -n "{N" docs/demo.md` lists them all). Where a go/no-go could go either way, both versions are written below; delete the one that didn't happen. Nothing else needs rewriting.

## Numbers

Every number said aloud or shown on screen comes from a committed file. "Shown on" is where to point the camera.

| Slot    | What                                                                                                                     | Source                                                                   | Shown on                    | Value |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------- | ----- |
| `{N1}`  | `mp-2283`'s tier (Light, Focused or Full)                                                                                | `route()` over `data/runs/mp-2283/review.json` (the S2 banner prints it) | S2 tier banner              |       |
| `{N2}`  | Hunks the person reads                                                                                                   | same, "Read r of n"                                                      | S2 tier banner              |       |
| `{N3}`  | Hunks in the change                                                                                                      | same                                                                     | S2 tier banner              |       |
| `{N4}`  | Hunks covered by checked evidence (`{N3}` − `{N2}`)                                                                      | same                                                                     | S2 hunk navigator           |       |
| `{N5}`  | Reading time, and full read time                                                                                         | same, "~m min (full read ~f min)"                                        | S2 tier banner              |       |
| `{N6}`  | The Verified claim, in a few words, and its test                                                                         | `review.json`, the claim with `level: "verified"`                        | S2 Read tab, claim expanded |       |
| `{N7}`  | The false statement in the PR description, and what the code does                                                        | `review.json`, the A4 contradiction finding (answer key `cp0`)           | S2 Blind check              |       |
| `{N8}`  | Anchored vs blind-first: "given the description first caught a of t · blind-first caught b of t", over p plants × k runs | `data/eval/report-card.json`, `anchoredVsBlind`                          | S2 Blind check, S3          |       |
| `{N9}`  | Refusals on `mp-2283` and one rule id with its decider                                                                   | `review.json`, `refusals`                                                | S2 Refused                  |       |
| `{N10}` | Quotes checked and quotes that failed the check                                                                          | `report-card.json`, `hallucinations`                                     | S3 Hallucinations caught    |       |
| `{N11}` | The generator area's ladder line, e.g. "Calibrated · 3 of 4 planted bugs caught"                                         | `report-card.json`, `areas[generator]`                                   | S3 trust ladder             |       |
| `{N12}` | Routing spread: Light · Focused · Full, hunks read of total                                                              | `report-card.json`, `routingSpread` (S1 summary bar recomputes it)       | S1 summary bar, S3          |       |
| `{N13}` | Signer and the verify line, `Good "countersign-receipt" signature for …`                                                 | `data/receipts/mp-2283.json`, `verify.output`                            | S2 Receipt tab, S4          |       |
| `{N14}` | Planted bugs in total, and areas measured                                                                                | `report-card.json`, `areas[].planted`                                    | S3 header                   |       |

## Video (2:00, strictly)

Target 1:55: the form rejects anything over 2:00, so the last 5 seconds are margin. Record at 1440 × 900 or larger, browser at 100 %, the access gate already unlocked, no other tabs, notifications off. Narration is about 2.5 words a second; each line below fits its time.

| Time                                             | On screen                                                                                                                                                  | Say                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 · Problem                              | S1 Inbox, still                                                                                                                                            | "Agent-written pull requests now arrive faster than anyone can read them. The engineer whose name goes on the approval has two bad options: skim and rubber-stamp, or read every line. Countersign gives them a third."                                                                                                                 |
| 0:15–0:40 · Moment 1, "Read only this"           | Click `mp-2283`. Hold on the tier banner, then the hunk navigator. Click the Verified claim and expand "Fails on the base commit / Passes on this change". | "A real change from Tieto's MessagePack repository, reviewed against its requirement. Routed `{N1}`: read `{N2}` of `{N3}` hunks; checkable evidence covers the other `{N4}`. This claim is Verified: `{N6}`. The test fails on the base commit, passes on the change, and the authoring agent didn't write it."                        |
| 0:40–1:05 · Moment 2, "It caught the author out" | Tab 2 Blind check: the contradiction, then the anchored vs blind-first row. Tab 3 Refused.                                                                 | "Before reading the PR description, the reviewer wrote down what the requirement expects. Then it compared. The PR says `{N7}`. Reviewers given the description first caught it `{N8-anchored}`; blind-first caught it `{N8-blind}`. And what it won't decide, it refuses in writing: `{N9}`, decided by a person."                     |
| 1:05–1:30 · Moment 3, "Signed and measured"      | Tab 4 Sign: the signed receipt, then 5 s of the verify output. Open S3: the generator card, then press "Record escape" and show the S1 badge change.       | "The owner signs a receipt: what was checked, what wasn't, the risk they accept. An SSH-signed git note, tied to the exact diff, verifiable by anyone. And the reviewer itself is measured, on `{N14}` bugs planted by an agent that never saw its prompts. Generator: `{N11}`. One escape drops it a level, and its changes re-route." |
| 1:30–1:55 · The ideas                            | `docs/ideas/README.md` on GitHub, scrolling the eight ideas; end on the production URL.                                                                    | "Eight ideas, each with a page Tieto can take into its own product: the trust ladder, blind-first review, the hunk coverage map, the quote check, the refusal policy, evidence levels, the signed receipt, and an author that never checks its own work. Countersign: the AI reviews, a named human countersigns."                      |

**Shots to capture separately** (cut in if the screen recording runs long): the verify command in a terminal (`pnpm countersign verify mp-2283`, 5 s), the S3 "Hallucinations caught" list with a failed quote, the 375 px S2 layout (2 s, shows it works on a phone).

## Peer review at our table (10:30–13:00)

All three of us present (a condition for the main prize). The app runs locally (`pnpm dev`) against this laptop's clone of the fork, so signing works live. Expect about 5 minutes per visit; let the judge drive after the first minute.

1. **Open with one sentence.** "We measure the AI reviewer before we trust it, and you sign for exactly what you read."
2. **Moment 1** on `/changes/mp-2283`: the banner, the navigator, one Verified claim. Let the judge click a citation: the diff scrolls to the cited lines.
3. **Moment 2:** Blind check, then Refused. If they ask how we know blind-first helps: S3 "Given the description first vs blind-first", `{N8}`, with the sample size.
4. **Moment 3, live:** in the terminal, `pnpm countersign verify mp-2283` prints `{N13}` and "diff unchanged", exit 0. If they ask what a changed diff does: exit 1, "Stale: the diff changed since signing", the code a CI merge check would read (covered by the receipt CLI's unit tests; never tamper with the real note at the table). Back in the browser, S3 "Record escape" on generator, then S1: the badges changed without a reload. "Reset" in the top bar undoes it.
5. **Hand over the concept card** (printed) and point to `docs/ideas/`.

Questions we expect, with where the answer lives:

| Question                                         | Answer from                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| "Isn't this the AI grading its own homework?"    | Principle 9 and idea 8: the plants were written by an agent that never opened the prompts ([decisions](decisions.md)). |
| "What would make you not trust your own output?" | S3: missed planted bugs are listed, not hidden; every rate shows its sample size.                                      |
| "How does this scale past four changes?"         | S3 routing spread and the trust ladder; [concept card](concept-card.md), "Beyond the reference".                       |
| "Why not just a confidence score?"               | [Evidence levels](ideas/evidence-levels.md): confidence is never shown, only what was checked.                         |
| "What failed while you built it?"                | The lessons log, `docs/lessons.md` (started by T15, #17).                                                              |

## Top-5 pitch (3 min + 3 min Q&A)

Same three moments, live from production, one person driving and one speaking. The video's narration is the script; add 60 seconds after moment 3 for the concept card slide (recommendation, the principles, trade-offs and limits), since Tieto weights Clarity at 30 %. The deck (PDF, required for the submission) is: title and one-line pitch · the problem · three slides, one per moment, each a screenshot with its number · the eight ideas · concept card · team.

## If a step fails

| Step           | What fails                                                | Do this                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any page       | Production is slow or down on venue Wi-Fi                 | Switch to `pnpm dev` on the laptop (same data, it's all committed). For the video, the recording is already made.                                                                                 |
| Any page       | The access gate asks for the code                         | Enter the code (Miska has it; it's never in the repo). The gate is removed after submission (#73).                                                                                                |
| Moment 1       | No claim is Verified (A5 was cut, see the go/no-go below) | Show a Supported claim and its "Quote checked against the code" line; say "Supported: the quote matches the code mechanically, but no independent test proves it."                                |
| Moment 3, live | `verify` fails on the laptop                              | Show S4 (`/changes/mp-2283/receipt`): the recorded verify output from the export. Then check `SAMPLE_REPO_DIR` and `git fetch origin refs/notes/countersign:refs/notes/countersign` in the clone. |
| Moment 3       | "Record escape" leaves the badges unchanged               | Press "Reset" in the top bar and record it again. Escapes are saved in the browser's localStorage and survive a reload, so press "Reset" before every take and every table visit.                 |

## Go/no-go branches

Delete the version that didn't happen when filling the numbers.

- **A5 differential tests (#110).**
  _Merged:_ moment 1 as written.
  _Cut:_ moment 1 says "The strongest evidence here is Supported: the quoted code matches mechanically. A claim becomes Verified only when a test the authoring agent didn't write fails before the change and passes after it." Record the cut in [decisions](decisions.md) and the concept card's limits.
- **Anchored vs blind-first (spec section 2, moment 2).**
  _Blind-first catches more:_ moment 2 as written.
  _No advantage:_ moment 2 leads with the contradiction and the refusals, then says "We measured whether reading blind first helps: `{N8}`. On this sample it didn't, and that's in the lessons log." Never drop the count.
- **The signed receipt (T23, #25).**
  _Signed and exported:_ moment 3 as written.
  _Not signed in time:_ show the unsigned Receipt tab ("Drafted by the AI. Only a named human can sign it.") and run `sign` and `verify` live at the table instead; the video cuts the verify shot and gives moment 3's time to the report card.

## Submission checklist

Due Sun 15.11 10:00, hard (the form closes); our target is 07:00, then update. Spec section 1, "Final submission requires".

- [ ] Project name, punchline and description (the README's first lines)
- [ ] Challenge: Tieto, "Earned Trust in AI Code"
- [ ] Technologies: Next.js, TypeScript, Anthropic Claude, .NET 8, git notes with SSH signatures, Vercel
- [ ] Video: 2:00 or shorter, public on YouTube or Vimeo, link opened in a private window
- [ ] Demo link: https://countersign-junction.com, and the access code given to the organisers, or the gate removed if they ask
- [ ] Source link: the repository accessible to the organisers, `LICENSE` is MIT
- [ ] Pitch deck as PDF
- [ ] Phone numbers and Discord usernames for Miska, Elias and Veijo
- [ ] Status set to **FINAL**, not Draft
- [ ] After judging: revoke or restrict the API keys used for recording, then remove the gate (#73)
