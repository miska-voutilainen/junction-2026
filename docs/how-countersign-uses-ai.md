# How Countersign uses AI

Countersign uses AI for one job: **explaining an agent-written pull request to the engineer who has to sign it, with evidence for every statement.** The AI never decides how much a person reads, and it never approves anything. Readable rules decide the first, and a named engineer does the second.

Technical detail (inputs, outputs, record and replay): [architecture.md, AI pipeline](architecture.md#ai-pipeline) and [spec.md section 6](spec.md).

## The five steps

Each review runs five model calls (`claude-opus-5-5`), offline on a laptop. The demo replays recorded runs, so nothing on the site calls a model.

| Step                              | What the AI does                                                                                                                                    | What stops it from fooling us                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A1 · Blind expectation**        | Reads only the requirement and writes down what a correct change should do                                                                          | It never sees the code or the author's description, so it can't be talked into the author's story                              |
| **A2 · Story and claims**         | Reads the diff and explains it as claims, each citing a file, lines and a quote                                                                     | Code checks every quote against the real file. A claim whose quote isn't there is marked unverified                            |
| **A3 · Area review and refusals** | Looks for defects, missing pieces and scope creep, and refuses the decisions that belong to a person (for example a change to documented behaviour) | A finding without a matching quote is dropped and counted as a hallucination. A refusal must name a rule in the written policy |
| **A4 · Contradiction check**      | Compares the author's PR description, sentence by sentence, with what the code does                                                                 | Every verdict cites code, so the quote check covers it too                                                                     |
| **A5 · Differential tests**       | Writes a test from the requirement, not from the diff                                                                                               | Code runs the test on the old and the new version. The claim is **Verified** only if the test fails before and passes after    |

## What is not AI

- **The quote check.** Plain string matching against the files.
- **Routing.** `route()` in `src/rules/route.ts` decides Light, Focused or Full and which hunks a person must read. Each reason is a rule with an id.
- **The trust ladder.** Each area moves between Shadow, Calibrated and Trusted on measured evidence. People set the thresholds.
- **The eval.** Scoring the planted bugs against the answer keys.
- **The receipt.** The AI drafts it; an engineer signs it with their own SSH key and it's stored in git.

## Does it learn from its mistakes?

**No, and that's on purpose.** The model and the prompts don't change on their own. An AI that rewrote itself after every miss would be AI checking AI, the thing Countersign exists to prevent.

What changes after a miss is **how much a person reads**:

1. A bug gets past the reviewer (an escape).
2. Rule `R-escape` sends every following change in that area to a full human read, and the area drops a level on the ladder.
3. People improve the reviewer. Any prompt change makes a new reviewer version (`rv1` to `rv2`), and the planted-bug eval runs again.
4. The area climbs back only when the new version passes the exam.

In the app, escapes are simulated with the "Record escape" button on the report card. Feeding real escapes from post-merge reverts is a next idea, not built.

**In one line:** Countersign doesn't make the AI learn. It makes the AI prove itself again, and a miss puts people back on full review.
