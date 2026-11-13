# Not AI slop

Tieto expects every team to build with AI, and expects most of it to look like AI slop: generic, padded, plausible, and made by nobody in particular. Ours must read as made by people who made decisions. AI writes much of the code here; people decide what stays.

**The test:** could this screen, sentence, function or doc have come out of any other team's project unchanged? If yes, it's slop: make it specific to Countersign, Tieto's repository and our decisions, or delete it.

## The tells, and what we do instead

**UI**
- Slop: gradient hero sections, glassmorphism, glowing cards, sparkle icons and "AI-powered" badges, dashboard cards full of vanity numbers, a different style on every screen.
- Ours: a working tool. The design tokens only, dense and calm like a code review interface; every element answers a question the reviewer has. If removing an element loses nothing, remove it.

**Copy**
- Slop: "Unlock the power of AI", "seamless", "robust", "revolutionary", "Let's dive in", emoji, exclamation marks, generic empty states ("Nothing here yet!"), hedging that commits to nothing.
- Ours: plain statements with specifics: numbers with their sample size, rule ids, file and line, the exact copy in `docs/spec.md`. Say what happened and what to do next.

**Data**
- Slop: invented users, round-number metrics, lorem ipsum, "Acme Corp", charts with made-up trends.
- Ours: Tieto's real changes and our recorded runs. Anything synthetic is labelled "synthetic"; anything not measured says "not measured yet".

**Code** (with `readability.md`)
- Slop: wrappers and abstractions for one caller, a config option nobody sets, defensive checks for impossible states, try/catch that swallows errors, near-duplicate helpers, unused exports, comments that narrate.
- Ours: the simplest code that meets the spec, one helper per purpose, errors handled at the boundary, names in the domain's words. Less code is better when it reads as clearly.

**Docs and PRs**
- Slop: long intros, summaries of the summary, every heading filled in "for completeness", bullet lists of adjectives, claims of tests that didn't run.
- Ours: short, concrete, what changed and why, the real command output. Empty sections say "None".

## Who checks

- Every writer (people, `builder`, `test-writer`, `docs-keeper`) applies the test before handing work over.
- `code-reviewer` reports code, copy and doc slop; `ux-reviewer` reports UI and copy slop; both mark it **blocking** on the demo path.
- `polish-pass` sweeps the whole product for it at the midpoint and the freeze.
