# Spec: Countersign (working name)

<!--
The single source of truth for WHAT we build. Written at kickoff (kickoff skill), changed only by a PR that the affected lane owners agree on.
Write it so an agent can build any task below without asking a question: concrete values, exact copy, real field names, no "etc.", no "TBD" in anything a task depends on.
Every task in section 9 becomes a GitHub issue; "go" works through them.
-->

Status: ready (signed off by Miska, Fri 13.11 21:50) · Last change: 2026-11-14, eight ideas and four next ideas (sections 1, 3, 9) · Feature freeze: Sun 15.11 00:00 · Submission deadline: Sun 15.11 10:00 (hard, form closes; our target 07:00)

Event milestones: Fri 23:59 pre-submission ✅ done Fri 13.11 by Miska (draft "Countersign", Tieto challenge; name, punchline, description; status Draft) · Sat 12:00 submissions open · Sun 10:00 final (set to FINAL, not DRAFT) · Sun 10:30–13:00 live peer review at our table (all present, else no main prize) · Sun 14:15 top-5 pitches (3 min + 3 min Q&A).

Build milestones: S1–S3 render on production from fixtures by Sat 08:00 · .NET go/no-go for A5 Sat 01:00 · anchored-vs-blind go/no-go Sat 12:00 · recorded real runs on production by Sat 18:00 · freeze Sun 00:00.

## 1. Product

- **Pitch:** AI reviews, a named human countersigns. Countersign turns an agent-written PR into a requirement-traced story with checkable evidence. It routes the human's attention by explainable risk and produces a signed receipt in git of what was checked, what wasn't and what risk the owner accepts. The reviewer's own blind spots are measured, not assumed.
- **User:** An engineer at a Tieto-style delivery team. It's Friday afternoon and a 200-line agent-written PR for a known requirement ID lands with their name on the approval. They know the codebase but don't have time for a full read of every agent PR.
- **Problem:** Agent PRs now outnumber human ones. Line-by-line review doesn't scale, and an AI "LGTM" is not something an engineer can put their name on. Today they either skim and rubber-stamp, so accountability is fiction, or read everything, so the agent's speed is wasted.
- **Insight:** Trust has to come from evidence a person can check, and that includes evidence about the reviewer itself. Three things others miss:
  1. Calibrate the AI reviewer on planted bugs, and let its measured catch rate per area decide how much humans read.
  2. Review blind-first, from the requirement, so the reviewer isn't anchored on the authoring agent's own story. Evidence is blind-first too: a test counts only if it fails before the change and passes after it, and only a test the authoring agent didn't write can make a claim Verified (an agent that writes both the code and its test can put the same mistake in both).
  3. Put the accountability record in git, where the code lives.
- **Partner tech and data:** Tieto's code input: the repository `te-industry-tech-office/junction26-messagepack-csharp` (a copy of MessagePack-CSharp, a C# serializer with a Roslyn source generator and analyzer, .NET SDK 8.0.402), with four agent-written changes, one branch each, all on base commit `32258fd`:

  | Change id | Branch | Upstream issue (= requirement) | Size |
  | --- | --- | --- | --- |
  | `mp-2283` (**the demo change**) | `ju26-issue-2283` | #2283 Generator and analyzer crash with IndexOutOfRangeException on a closed generic struct from a referenced assembly | 4 files, +225 −3 |
  | `mp-2234` | `ju26-issue-2234` | #2234 The analyzer does not work if SuppressSourceGeneration = true | 4 files, +262 −4 |
  | `mp-2129` | `ju26-issue-2129` | #2129 Allow generation of Formatter for a type in a referenced assembly | 28 files, +1034 −9 |
  | `mp-2297` | `ju26-issue-2297` | #2297 Add ExcludeFromCodeCoverage attribute to generated code | 237 files (223 test snapshots), +1383 −9 |

  Tieto's requirements set and standards document are still announced as "TBA". Until they arrive we derive one requirement record per issue (intent, functional, non-functional items, labelled "derived from upstream issue #n") and write our own per-area checklists, labelled as ours. The commits carry one-line messages only, so each change gets an author PR description written by the evidence lane and labelled "synthetic". Models: Anthropic Claude, recorded through Claude Code's headless mode on Miska's Max plan; the API backend stays for anyone with a key (`docs/decisions.md`, 2026-11-14). Vendor selection is out of scope, so the model sits behind one client interface (`src/ai/`) and the concept holds with any capable model.
- **Review areas for this repository:** `generator`, `analyzer`, `security`, `performance` (areas are per-repository configuration; a web repository would use frontend, backend, security, performance). Used the same everywhere: policy, prompts, planted bugs, report card.
- **Event judging (peer review and finals):** Innovation (the canaries, the blind-first review and evidence, the receipt in git), Impact (every team merging agent PRs), Implementation (a working pipeline on Tieto's real repo, not slides).
- **Tieto's judging criteria** (from the challenge page): **Clarity 30%** (a clear recommendation with stated principles, explicit trade-offs and limits) · **Practicality 25%** (could work in a real PR flow and scale, with a named human owning each decision) · **Measurement 25%** (how trust is measured: reverts and incidents don't rise as review time falls, AI findings are real and accepted, time to merge, share routed to humans) · **Evidence 20%** (evidence traceable to a requirement lets a named human accept a change without a full read, incl. what the AI found, what it refused to decide, and why). Tieto: "we put more weight for the concept than only the technical implementation." Tieto added two criteria for the code itself: **readable code** and **comments that give the reader something** (`.claude/rules/readability.md`).
- **Emphasis (changed 2026-11-13):** Tieto wants ideas from the teams to build into their own product. So the **eight ideas are the headline and the app is their proof**: every screen exists to show an idea working on Tieto's real code, not to look like a finished product. Effort split, roughly: **60% proof** (pipeline, quote check, eval, receipt, and the screens that show them), **25% ideas** (the idea pages, the concept card, "Beyond the reference", the pitch), **15% readable code** (idea headers, giving comments, names; written as we build, not cleaned up at the end). The eight ideas, each with a page in `docs/ideas/` (T25):

  | # | Idea | Page | Shown in |
  | --- | --- | --- | --- |
  | 1 | Planted-bug calibration and a trust ladder per area | `trust-ladder.md` | S3 ladder |
  | 2 | Blind-first review, with the anchoring effect measured | `blind-first.md` | S2 Blind check |
  | 3 | The hunk coverage map | `coverage-map.md` | S2 tier banner and navigator |
  | 4 | A mechanical quote check | `quote-check.md` | S2 Story evidence, S3 hallucinations |
  | 5 | A written refusal policy | `refusal-policy.md` | S2 Refused |
  | 6 | Evidence levels instead of confidence scores | `evidence-levels.md` | S2 Story claims |
  | 7 | The signed receipt in git, tied to the exact diff | `signed-receipt.md` | S2 Receipt, the CLI |
  | 8 | The author never checks its own work: an agent's own test makes a claim Supported at most, the AI drafts the receipt but never signs it, the person who plants the bugs never sees the prompts | `separation-of-duties.md` | S2 roles line and "the PR's own test" evidence lines, S4 roles line |

  **Next ideas** (concept card and idea index only, labelled "not built"; no screen shows them): registered pull requests (the owner signs the tests before the agent writes code), audit sampling for very large PRs, round-trip property tests for serializers, post-merge reverts as the live source of escapes.
- **Final submission requires:** project name, punchline, description; challenge; technologies; a **2-minute video, strictly not a second longer**, publicly viewable (YouTube or Vimeo); demo and source links (source accessible to the organisers, MIT-licensed); pitch deck as PDF; phone numbers and Discord usernames.
- **Rules that bind us:** no code written before the event (open-source libraries are fine); past experience is fine, copying a project is not.
- **Challenge expectations, mapped:**
  - Concept defined (what the PR review factory should follow): concept card plus the pitch opening. Moment 1 shows it in action.
  - Principles (balancing risk, hallucination, transparency, confidence and quality): concept card. Risk and confidence in moment 1, hallucination and transparency in moment 2, quality in moment 3.
  - One sample agent-written change with its requirement ID: `mp-2283` / MP-2283; moments 1–3 all run on it.
  - What the AI found, refused to decide, and why: moment 2.
  - Named human accepts without a full read: moments 1 and 3 ("read 2 of 8 hunks", what covers the others, the receipt).
  - Failure modes and decision log: moment 3's report card, `docs/lessons.md` (logged from the first pipeline run) and `docs/decisions.md`.
  - Synthetic or cleared data only: Tieto's samples, plus planted bugs, contradiction plants and PR descriptions labelled "synthetic".
  - "What would make you not trust your own output?": moment 3, the report card. We don't grade our own homework: the planted bugs come from an agent that never saw the prompts, the prompt writers never saw the plants, and every rate shows its sample size.
  - "Who owns the decision?": moment 3, the signed receipt in git.
  - "How would this scale?": moment 3, the routing spread over all four Tieto changes, plus the trust ladder.
- **Tieto deliverables (first-class, each has a task):**
  - Concept card (recommendation, principles, trade-offs, limits, how trust is measured): `docs/concept-card.md` (T22), exported to one PDF page and used as a pitch slide. It is also the index of the eight ideas, lists the four next ideas (section 1, Emphasis), and holds "Beyond the reference", which adds organisation-managed signing (Sigstore or similar) in place of personal SSH keys.
  - Research: `docs/research.md`, the checked figures we quote (sample size and source each) and the red-team questions with our answers. Pitch, concept card and idea pages quote only figures listed there.
  - Idea pages: `docs/ideas/*.md` (T25), one per idea, written for a product team that wants to adopt it.
  - Lessons log with the failure modes we actually saw: `docs/lessons.md`, started by T15 from the first pipeline run (caught hallucinations, missed planted bugs, wrong tier calls, model errors), each entry with the date and what we changed.
  - Decision log: `docs/decisions.md`.
  - Live walkthrough: the three demo moments.
  - Demo video (2 min) and presentation (PDF): made at the freeze by `demo-prep` and the pitch owner (interim: Miska).
- **Theme line for the pitch:** "European Tech Renaissance: idealism and caution." AI does the work, an accountable human signs: human oversight in practice. No legal claims.
- **Pitch spine:** the AI's claims are checked before you see them, your reading is narrowed to what nothing checked, and you sign for exactly what you read; planted bugs decide how far the reviewer is trusted. The video shows the mechanics working (a test failing on base and passing on head, a struck citation, the verify output), not a dashboard. Borrowed pedigrees (continuous sampling, rules of evidence) belong on the idea pages, not in the video.

### Principles (for the concept card)

1. **The AI advises, a human signs.** No merge without a named owner's receipt. The AI can draft the receipt but never sign it.
2. **Claims, not lines.** Review is a story traced to requirement items. The hunks that verified evidence doesn't cover are what the human reads.
3. **Evidence over confidence.** Evidence levels: Verified, Supported, Unverified, Refused. The model's self-reported confidence is never shown.
4. **Verify before posting.** A citation that doesn't match the code mechanically is not posted. Every caught hallucination is counted.
5. **Explainable routing.** The tier (Light, Focused, Full) comes from rules a person can read, one line per reason.
6. **Written refusals.** A versioned list of things the AI never decides, each with the owner who does.
7. **Measured trust, on a ladder.** Each area climbs Shadow → Calibrated → Trusted on evidence (planted-bug catch rate, clean spot checks) and drops a level after an escape. New areas start in Shadow: the reviewer runs but routes nothing. Humans set the thresholds; the evidence moves the level.
8. **Blind first.** Expectations come from the requirement before the reviewer reads the author's story, and a test is evidence only if it fails before the change and passes after it; Verified needs a test the authoring agent didn't write. We show blind-first works by counting: the same reviewer anchored (given the author's description first) and blind-first, on the same planted contradictions.
9. **We don't grade our own homework.** The planted bugs were written by an isolated subagent that never opened the reviewer's prompts, pipeline or review output, while the agents writing the prompts never opened the plants (`docs/decisions.md`). Every rate shows its sample size. Principles 1, 8 and 9 together are idea 8: the author never checks its own work. Every change shows three different roles: written by the agent, reviewed by the AI reviewer, signed by a named person.

### Product in parts

Seven parts, each with one job. Data flows top to bottom: P1 feeds P2, P2 and P3 feed P4, and P5 and P6 sit on top.

| Part | One job | In → out | Built from | Lane | Shown in |
| --- | --- | --- | --- | --- | --- |
| **P1 · Demo data** | The material everything runs on | → our fork of Tieto's repo (a branch per change and per planted bug), requirement records, author PR descriptions, planted bugs and contradiction plants with answer keys | Tieto's repo; derived requirements; plants written by an isolated subagent, blind to the prompts, while the prompt writers stay blind to the plants | evidence | S1 (the changes listed) |
| **P2 · Review pipeline** | Review one change and save the result | change + requirement → `data/runs/<changeId>/review.json` | AI calls A1–A5, the quote check and the .NET test runner (code) | engine | S2 tabs Story, Blind check, Refused |
| **P3 · Routing rules** | Decide how much the human reads | review + area levels → tier, reasons, hunk coverage | Plain TS in `src/rules/`, no AI; runs in the pipeline and in the browser | engine | S1 badges, S2 banner and hunk colours |
| **P4 · Reviewer measurement** | Measure how far the reviewer can be trusted | planted-bug runs + answer keys → `data/eval/report-card.json` | Plain code over P2's output | engine | S3 |
| **P5 · Receipt** | Make a named human accountable | drafted receipt → signed git note (the owner's own SSH key), verify result, stale check, exported JSON | `pnpm countersign` CLI + git + ssh-keygen | evidence | S2 Receipt tab, S1 status |
| **P6 · Review app** | Show all of it | recorded files → inbox, review page, report card | Static Next.js site on Vercel; the simulated escape re-runs P3 in the browser | app (S3: evidence) | S1, S2, S3 |
| **P7 · Tieto deliverables** | What Tieto grades besides the app, and what they take home | everything above → idea pages, concept card, lessons log, decision log, 2-min video, deck | Docs + recording | evidence, engine, pitch owner | Pitch and submission |

**Boundaries that keep the parts independent:** P2 never decides the tier on its own terms (it calls P3). P3 never calls a model. P6 never runs the pipeline or signs anything (it only reads recorded files and runs P3 client-side). P5 is the only part that writes git notes. No part has a server: the site is static, and everything that needs git, .NET or a model runs on a laptop.

## 2. Demo path

<!-- Three moments, so the story fits a 2-minute video and a peer-review table. Every task serves one of them. Everything shown comes from real pipeline runs, recorded; nothing runs a model live during the demo. -->

| Moment | The user does | The user sees | Acceptance (testable) | Screens |
| --- | --- | --- | --- | --- |
| 1 · "Read only this" | Opens the inbox, sees every change with its tier, opens `mp-2283` (MP-2283), then clicks a claim | The change story (what, why with the requirement ID, what else it touches); a tier banner like "Focused · Read 2 of 8 hunks · ~2 min (full read ~10 min)" with each reason as one line; **a hunk map showing what covers each hunk** (Verified · Supported · Read this). Clicking a claim shows the cited quote with file:line, its evidence level and, for Verified, the recorded test result on the base commit (fails) and on the change (passes) | S2 first render < 2 s on production; every hunk has exactly one coverage state; tier and reasons equal `route()`'s output for the recorded review; every citation shown has `check: "passed"`; a Verified claim always shows both test results | S1, S2 |
| 2 · "It caught the author out" | Opens "Blind check", then "Refused" | "The PR says … / The code does …", plus the **anchored-vs-blind count** ("Given the PR description first: caught 4 of 15 · Blind-first: caught 12 of 15", over 5 planted contradictions × 3 runs each; numbers illustrative), missing items and scope creep. Refused items, each with the policy rule, the reason and who decides | The contradiction and the counts come from recorded runs in `data/runs/` and `data/eval/`; every refused item cites a rule id from `src/policy/refusals.ts`; every synthetic part is labelled "synthetic". Go/no-go Sat 12:00: if blind-first shows no advantage, the count is still shown as measured, logged in `docs/lessons.md`, and moment 2 leads with the contradiction and the refusals | S2 |
| 3 · "Signed and measured" | Runs `pnpm countersign sign mp-2283` as the named owner (shown in the video as an already-signed receipt plus 5 s of verify output), then opens the report card and records a simulated escape | The receipt (checked / not checked / residual risk accepted) as a signed git note, with the verify command and its output. The report card: a trust ladder per area with the sample size ("Generator · Calibrated · 3 of 4 planted bugs caught · planted blind to the prompts"), "Performance · Shadow · no track record", the hallucinations caught, and **the routing spread over all four Tieto changes** ("Of 4 changes: 0 Light · 3 Focused · 1 Full"). "Record escape" on an area drops it a level and the affected changes re-route live | `git notes --ref=countersign show <headSha>` in the fork holds the receipt; `pnpm countersign verify mp-2283` exits 0 and prints the `Good "countersign-receipt" signature` line; the receipt holds `diffSha256`, `baseTree` and `headTree`; every number on S3 comes from `data/eval/report-card.json`; after "Record escape" the S1 badge and S2 banner change without a page reload | S2, S3 |

Wow moment (first 30 s): moment 1's "read 2 of 8 hunks, and here's what covers the other 6", straight into moment 2's "the PR says X, the code does Y, and a reviewer reading the PR first missed it".

Each moment is told as ideas in action: moment 1 shows ideas 3, 4 and 6; moment 2 ideas 2 and 5; moment 3 ideas 7 and 1.

Video and pitch structure (2 min): problem (15 s) → moment 1 (25 s) → moment 2 (25 s) → moment 3 (25 s) → the eight ideas and what Tieto can take from them, "Beyond the reference" (30 s).

At the peer-review table the app runs locally (`pnpm dev`) against the laptop's clone of the fork, so sign → refresh works live in front of judges. The deployed site shows the receipt signed earlier.

## 3. Screens

The app is a **Graphite-style review interface**: an inbox of changes, a review page with the diff at the centre, and the reviewer's report card. It is a static site over recorded files, not connected to GitHub. **Visual direction:** the final design canvas (link on T01, #3), translated into this product in [docs/design/ui-plan.md](design/ui-plan.md). The plan sets layout, routes, components, motion and the consoles; where it and this section differ on those, the plan wins. Data rules and the exact copy in this section still hold. Every screen uses only tokens and `src/components/`.

**Routes:** `/` Inbox (S1), `/changes/[id]` Review (S2), `/changes/[id]/receipt` full receipt (S4), `/reviewer` report card (S3), `/dashboard` (S5), and the temporary `/unlock` gate until the submission.

**App shell (all screens):** a top bar (wordmark linking to `/`, the repository as a label, breadcrumb, "Search or jump to… ⌘K"), a grouped left nav (Review: Inbox · Insights: Dashboard, Reviewer report card) with the active item marked `aria-current="page"`, and a ⌘K command menu (quick actions, pages, the four changes); details in the UI plan, section 3. When simulated escapes exist, the top bar shows "Simulated escapes: <n>" and a button "Reset". Below ~900 px the nav opens from a menu button; below ~760 px pages use the mobile header. A "Showing mock data" banner (role `status`) appears under the top bar whenever any data on the page came from `data/fixtures/` instead of recorded files.

**Idea labels (T26, T27):** the part of a screen that shows an idea carries a small label "Idea <n> · <name>" (names from the table in section 1, Emphasis) linking to `https://github.com/miska-voutilainen/junction-2026/blob/main/docs/ideas/<page>`, opened in a new tab. Placement: S2 tier banner (3), Story tab "Claims" heading (6) and each "Quote checked against the code" line (4), Blind check heading (2), Refused heading (5), Receipt heading (7), the roles line in the S2 meta row and each "the PR's own test" evidence line (8); S3 trust ladder heading (1) and "Hallucinations caught" heading (4). One shared component, `IdeaLabel`, muted text, keyboard-focusable, accessible name "Idea <n>: <name>, opens the idea page".

**States everywhere:** pages are statically generated, so there is no data loading on the client. Each route still has a `loading.tsx` skeleton (shown during client navigation) and an `error.tsx` with "Something went wrong showing this page." and a "Try again" button (calls `reset()`). A data file that fails schema validation never crashes a page: the loader returns an `invalid` result and the screen shows the error copy given below.

### S1 · Inbox (`/`)

- **Purpose:** every agent-written change waiting for review, routed by risk. It doubles as the routing spread.
- **Content:** the four Tieto changes (`data/sample/changes/*.json` with `kind: "tieto"`), each with its recorded review. Planted-bug variants never appear here.
- **Layout (1440 px):** page title (h1) "Inbox" with the subline "Agent changes waiting for a named person to sign." and a primary "Review next" link (the first unsigned change in list order). Below it a summary bar, one line: "4 changes · 0 Light · 3 Focused · 1 Full · 1 signed" and, on the same line right-aligned, "Humans read 14 of 290 hunks · ~12 of 180 min". Then a list, one row per change, sorted by tier (Full, Focused, Light), then by change id.
- **Each row** (the whole row is one link to `/changes/<id>`, keyboard-focusable):
  - the change title (from the change input), e.g. "Fix crash on closed generic structs from referenced assemblies";
  - the requirement ID chip, e.g. "MP-2283";
  - the authoring agent, e.g. "Coding agent (Tieto sample)";
  - the tier badge: "Light", "Focused" or "Full";
  - the reading estimate: "read 2 of 8 · ~2 min" (the minutes are left out when nothing needs reading);
  - the counts, only when non-zero: "1 contradiction", "2 contradictions", "2 refused";
  - the receipt status: "Needs review", "Signed by <owner login>", "Stale" or "Signature failed verification" (the receipt's recorded check failed);
  - a "synthetic PR description" tag when the change's `authorDescription.synthetic` is true.
- **375 px:** rows stack in three lines: title; chips (requirement ID, tier badge, reading estimate); counts, receipt status and tag. The summary bar wraps to two lines.
- **States:** empty (no change has a review file): "No recorded reviews yet." and "Run `pnpm review run mp-2283` to record one." · a change whose review file is missing: its row shows the title and "Not reviewed yet" in place of tier and estimate · a review file that fails validation: the row shows the title and "This review couldn't be read. Re-record it with `pnpm review run <id>`." · success as above.
- **Live re-routing:** tier badges, reading estimates and the summary bar are computed in the browser by `route()` with the current simulated escapes (T06's store), so a recorded escape changes them without a reload.

### S2 · Review (`/changes/[id]`)

- **Purpose:** review one change: moments 1–3 happen here. Static params: every `kind: "tieto"` change id.
- **Header:** "← Inbox" link; the title (h1); chips: requirement ID, authoring agent, "synthetic PR description" when applicable; the receipt status (as on S1).
- **Tier banner** (below the header, full width): first line "<Tier> · Read <r> of <n> hunks · ~<m> min (full read ~<f> min)"; below it one line per reason, in the order `route()` returns them, each "<reason text>" followed by its rule id in muted text, e.g. "2 items refused: a human decides · R-refusal". A small "How is this computed?" link opens a tooltip: "Tier = the highest tier any rule asks for. Reading time assumes 25 changed lines a minute, a stated assumption."
- **Left: hunk navigator** (fixed 280 px at ≥ 1024 px). Three groups in this order, each with a heading and count: "Read this (<n>)", "Supported (<n>)", "Verified (<n>)"; groups with zero hunks are omitted. Each item: a coverage marker, "<file name>:<newStart>" and the area chip when the hunk has an area. Clicking an item scrolls the diff to that hunk and focuses its header. Hunks of files with `kind: "generated"` are one item per file group: "<n> generated snapshot files".
- **Centre: diff viewer.** Per file: a header with the path, "+<added> −<removed>" and the area chip; then its hunks. Each hunk: its `@@` header line, a coloured gutter bar showing its coverage (Verified, Supported, Read this, each with a text label for colour-blind users), old and new line numbers, the lines with `+`/`-` markers and C# syntax highlighting (shiki, tokenised per hunk on the server at build time). When a claim is selected, its cited lines get a highlight and the first one scrolls into view. Files with `kind: "generated"` start collapsed: "<n> generated snapshot files · Show".
- **Right: sidebar** ("Review steps", 392 px at ≥ 1100 px) with four tabs, labelled as steps "1 Read", "2 Blind check", "3 Refused", "4 Sign" (below they're called Story, Blind check, Refused and Receipt), in this order:
  - **Story:** headings "What", "Why", "What it touches" (list of symbol, file and note), then "Claims", grouped by requirement item: a heading per item "<itemId> · <item text>" (claims with `requirementItemId: null` under "Not traced to a requirement item"). Each claim: its evidence-level badge (Verified, Supported, Unverified, Refused) and text. Selecting a claim expands it: each citation as "<file>:<startLine>–<endLine>" plus the quoted code; for Verified, the evidence block "Fails on the base commit" and "Passes on this change", each with its recorded test output in a collapsible block; for Supported, "Quote checked against the code"; for Unverified, "No checkable evidence. Needs a human." Then a heading "Defects found (<n>)": each defect with severity, area chip, title, detail and its citations; if none: "No defects found in the four area checklists."
  - **Blind check:** heading "Expected from <requirementId> before reading the diff": A1's items, each with its expected behaviours; then "Contradictions": each as two lines "The PR says: <statement>" and "The code does: <explanation>" with citations; then "Given the PR description first vs blind-first": one row per planted contradiction of this change (9.1 T19), and below it the overall count from the report card, "Across <p> planted contradictions × <k> runs: given the description first caught <a> of <t> · blind-first caught <b> of <t>"; then "Missing" and "Scope creep" (A3's `missing` and `scope-creep` findings). Empty copy per section: "No contradictions between the PR description and the code." · "Nothing missing." · "No scope creep found."
  - **Refused:** each refusal as "<ruleId> · <rule title>", the reason, "Decides: <decider>" and links to its hunks. Empty: "Nothing refused. Policy v1 has 7 rules. None applied to this change."
  - **Receipt:** unsigned: the intro "Drafted by the AI. Only a named human can sign it.", then "Checked" (each item and by whom or what: "tool", "AI, supported", "human"), "Not checked" (each item and its reason), "Residual risk" (text plus the refused items the owner accepts); then "Sign on your own machine" with two copyable commands, `pnpm countersign draft mp-2283` (writes the draft to edit) and `pnpm countersign sign mp-2283`. Signed: "Signed by <owner> · <date and time>", the same three sections from the signed receipt, then "Verify" with the command `pnpm countersign verify mp-2283` and its recorded output in a code block, and the line "Signature valid · diff unchanged". Stale (the receipt's `diffSha256` differs from the review's): a warning "Stale: the code changed after signing." with both hashes.
- **375 px:** one column: header, tier banner, then a tab list "Hunks · Diff · Story · Blind check · Refused · Receipt" with "Diff" selected by default. The diff scrolls horizontally inside its own container; the page never does.
- **States:** unknown id: "No change with id <id>." and a link "Back to the inbox" (`not-found.tsx`) · review missing: "This change hasn't been reviewed yet. Run `pnpm review run <id>`." · review invalid: "This review couldn't be read. Re-record it with `pnpm review run <id>`." · success as above.

### S3 · Reviewer report card (`/reviewer`)

- **Purpose:** how far the AI reviewer can be trusted, per area, and why.
- **Header:** h1 "Reviewer Report Card" with the line "How far the AI reviewer can be trusted, by area. Levels move only on evidence: planted bugs it had to find blind, and escapes you record."; meta line "Reviewer <version> · <model> · measured on <n> planted bugs, planted by an agent that never saw the prompts".
- **Trust ladder** (one card per area, in the order generator, analyzer, security, performance): the area name; the three rungs Shadow, Calibrated and Trusted with the current one marked; the evidence line, always with the sample size, e.g. "Calibrated · 3 of 4 planted bugs caught · planted blind to the prompts" or "Shadow · no track record"; the next step, e.g. "Trusted needs 5 clean spot checks: 0 recorded" or "Calibrated needs 3 planted bugs: 0 so far"; a button "Record escape". Pressing it drops the area one level (simulated, stored in the browser), shows a toast "Escape recorded in <area> (simulated). Its changes re-routed.", and adds "(1 simulated escape)" to the card.
- **Missed planted bugs:** a list: plant id, area, the defect from the answer key, and a link "View variant" to the variant branch's commit on GitHub. Empty: "The reviewer caught every planted bug."
- **Given the description first vs blind-first:** the overall count as on S2, plus one row per contradiction plant with both modes' results.
- **Hallucinations caught:** "Quotes checked: <n> · failed the check: <f> (not posted)"; "Claims retracted by a failing test: <r>"; "Findings dropped: <d>".
- **Routing spread:** "Of 4 changes: <l> Light · <fo> Focused · <fu> Full · humans read <r> of <n> hunks (~<m> of <f> min)", recomputed with the simulated escapes.
- **Footer link:** "Lessons log" to `https://github.com/miska-voutilainen/junction-2026/blob/main/docs/lessons.md`.
- **375 px:** cards stack in one column.
- **States:** no report card: "No evaluation recorded yet." and "Run `pnpm evals` to measure the reviewer." · invalid: "The report card couldn't be read. Re-run `pnpm evals`." · success as above.

### S4 · Full receipt (`/changes/[id]/receipt`)

- **Purpose:** the signed receipt as a document a person can read, print and verify.
- **Content:** per the UI plan, section 5: the seal "Signature verified", commit, base, `diffSha256`, author agent and signer key; "Checked", "Not checked", "Residual risk" in the signer's words; a hunk ledger (location, coverage, "Read by <owner>"); open decisions (the refused items the owner accepted); the verify command and its recorded output; Copy verify command, Copy link and Print.
- **States:** no receipt: "No receipt for <id> yet." and the sign command · stale: the S2 stale warning with both hashes · invalid: "This receipt couldn't be read. Re-export it with `pnpm countersign export <id>`."

### S5 · Dashboard (`/dashboard`)

- **Purpose:** what signing covered across all changes, what it didn't, and who still has to decide.
- **Content:** per the UI plan, section 5, from the recorded reviews, receipts and report card only: signed count, hunks read by a person, contradictions caught, simulated escapes, "Median time to sign: not measured yet"; accepted risk (residual-risk lines from signed receipts, "Holds", "Stale" or "Signature failed verification"); open decisions (refusals by decider); attention by tier; why changes were escalated (`route()` reason counts); reviewer trust by area. No time ranges: there is no time series.
- **States:** no readable receipt at all (stale or unverified receipts still list): "No signed changes yet." and a link to the inbox · invalid data: the error copy of the file that failed, with its validation error.

## 4. Data

All data the site shows is committed under `data/`, validated by the zod schemas in `src/contracts/` (section 5). Nothing is fetched at runtime.

- **Our fork:** `miska-voutilainen/junction26-messagepack-csharp`, a GitHub fork of Tieto's repository (all branches), created at kickoff; Elias and Veijo have write access. Each machine that runs the pipeline or the receipt CLI clones it and sets `SAMPLE_REPO_DIR` in `.env` to the clone's absolute path (`pnpm seed` clones and fetches it, T07).
- **Tieto changes:** the four in section 1, one `data/sample/changes/<id>.json` each (`kind: "tieto"`). Base `32258fd` for all; full SHAs recorded by T07.
- **Requirements:** `data/sample/requirements/MP-<n>.json` for 2283, 2234, 2129 and 2297, derived from the upstream issue text: intent (one sentence), 2–5 functional items `F1…`, 1–3 non-functional items `N1…`, and `derivedFrom` with the issue URL.
- **Author PR descriptions:** one per Tieto change, 80–200 words, written by the engine lane (T07 moved from evidence) as the authoring agent would (what changed, why, tests added, anything it claims about scope), with `synthetic: true`. The `mp-2283` description contains exactly one false statement (the engine lane picks which, records it in the answer key, and never sees the reviewer's prompts).
- **Planted bugs:** 10 variant branches `variant/v01` … `variant/v10` in the fork. Each is the base commit plus one commit that contains the agent's original change **plus one planted defect**, with the same commit message as the original. Six are variants of `mp-2283`, four of `mp-2234`. By area: 4 generator, 3 analyzer, 3 security, 0 performance. Branch names and commit messages never hint at the defect. Each has an answer key `data/sample/answer-key/v<nn>.json` (file, new-side line range, area, the defect in one sentence, written by, written at). Each variant also gets a change input `data/sample/changes/v<nn>.json` with `kind: "planted-bug"` and the same author description as its parent. A plant's `area` is the area of its file by `classifyFile()` in `src/policy/areas.ts`, the rule routing and the ladder use, so a variant may change files its parent doesn't (the defect stays inside the variant's diff against the base). Every planted line range lies more than 3 lines from any line the parent change edits (new side), so a finding about the parent's own code cannot score as a catch.
- **Contradiction plants:** `cp0` is the false statement in `mp-2283`'s own description (answer key only, 9.1 T07); plus 4 change inputs `data/sample/changes/cp<n>.json` (`kind: "contradiction-plant"`), each pointing at a Tieto change's branch and head, with an author description that contains one planted false statement; answer keys `data/sample/answer-key/cp<n>.json` hold the exact false sentence and why it's false. `cp1` and `cp2` point at `mp-2283`, `cp3` at `mp-2234`, `cp4` at `mp-2129`.
- **Owners' public keys:** `data/sample/allowed_signers` in the `ssh-keygen` ALLOWED SIGNERS format, one line per owner: `<github-login> namespaces="countersign-receipt" ssh-ed25519 <base64>`. Private keys never enter the repo.
- **Recorded output:** `data/runs/<changeId>/review.json` (latest blind-first review), `data/runs/<changeId>/anchored/<k>.json` and `data/runs/<changeId>/blind/<k>.json` (anchored-vs-blind runs, k = 1–3), `data/eval/report-card.json`, `data/recordings/<promptVersion>-<keyHash>.json` (raw model responses for replay), `data/receipts/<changeId>.json` (exported signed receipts).
- **Fixtures:** `data/fixtures/` mirrors the recorded layout (`runs/mp-2283/review.json`, `eval/report-card.json`, `receipts/mp-2283.json`, `sample/changes/*.json`) with hand-written data that validates against the schemas; used by the UI until recorded files exist and by unit and e2e tests.

## 5. Contracts between lanes

There is no HTTP API: the contracts are data files, one shared function and two CLIs. The zod schemas live in `src/contracts/` (written at kickoff, shared path) and are the source of truth for the types below; `docs/api.md` describes them for people.

| Contract | File or entry point | Producer lane | Consumer lanes |
| --- | --- | --- | --- |
| `ChangeInput` | `data/sample/changes/<id>.json` | evidence | engine, app |
| `Requirement` | `data/sample/requirements/<id>.json` | evidence | engine, app |
| `AnswerKey` | `data/sample/answer-key/<plantId>.json` | evidence | engine (scoring only; never in a prompt) |
| `Review` | `data/runs/<changeId>/review.json` and the anchored/blind runs | engine | app, evidence |
| `ReportCard` | `data/eval/report-card.json` | engine | app, evidence (S3) |
| `ReceiptRecord` | `data/receipts/<changeId>.json` | evidence | app |
| `route()` | `src/rules/route.ts` | engine | app, evidence (S3) |
| `ladderLevel()`, `applyEscapes()`, `levelsFromReportCard()` | `src/rules/ladder.ts` | engine | app, evidence |
| Diff hash | `computeDiffIdentity()` in `src/lib/git/diffIdentity.ts` | engine | evidence (receipt) |
| Pipeline CLI | `pnpm review run <changeId> [--anchored] [--run <k>]`, `pnpm review check <changeId>`, `pnpm evals` | engine | people |
| Receipt CLI | `pnpm countersign draft|sign|verify|export <changeId>` | evidence | people, CI later |
| Simulated escapes | `useEscapes()` in `src/lib/simulation/escapes.ts` | app | app, evidence (S3) |
| Policy | `src/policy/*.ts` | engine | app, evidence (rule titles, thresholds) |

### Shared enums (`src/contracts/common.ts`)

- `Area`: `"generator" | "analyzer" | "security" | "performance"`
- `EvidenceLevel`: `"verified" | "supported" | "unverified" | "refused"`
- `Coverage`: `"verified" | "supported" | "read"` (UI labels: Verified, Supported, Read this)
- `Tier`: `"light" | "focused" | "full"` (UI labels: Light, Focused, Full)
- `LadderLevel`: `"shadow" | "calibrated" | "trusted"`
- `FileKind`: `"source" | "test" | "docs" | "generated"`
- `Citation`: `{ file: string; side: "new" | "old"; startLine: number; endLine: number; quote: string }`, lines 1-based and inclusive.

### `Requirement`

`{ id: string /* "MP-2283" */; title: string; intent: string; functional: { id: string /* "F1" */; text: string }[]; nonFunctional: { id: string /* "N1" */; text: string }[]; derivedFrom: { kind: "github-issue"; url: string; note: string } }`

### `ChangeInput`

`{ id: string /* "mp-2283" | "v01" | "cp1" */; kind: "tieto" | "planted-bug" | "contradiction-plant"; title: string; requirementId: string; parentChangeId: string | null /* set for v<nn> and cp<n> */; repo: string /* "miska-voutilainen/junction26-messagepack-csharp" */; branch: string; baseSha: string /* 40 hex */; headSha: string /* 40 hex */; authorAgent: string; authorDescription: { text: string; synthetic: boolean; writtenBy: string } }`

### `AnswerKey`

`{ plantId: string; changeId: string; kind: "planted-bug" | "contradiction"; area: Area | null; file: string | null; startLine: number | null; endLine: number | null; defect: string /* planted bug: the defect; contradiction: the exact false sentence */; why: string; writtenBy: string; writtenAt: string /* ISO */ }`

### `Review` (`src/contracts/review.ts`)

```
{
  schemaVersion: 1,
  changeId, requirementId, title, authorAgent, kind,            // copied from ChangeInput
  mode: "blind-first" | "anchored",
  reviewer: { version: string /* "rv1" */, model: string, promptVersions: Record<"a1"|"a2"|"a3"|"a4"|"a5", string> },
  run: { id: string, startedAt: string, finishedAt: string, durationMs: number,
         usage: { inputTokens: number, outputTokens: number, costUsd: number, calls: number } },
  diff: { baseSha, headSha, baseTree, headTree, diffSha256: string, filesChanged: number, linesAdded: number, linesRemoved: number },
  files: { path: string, kind: FileKind, area: Area | null, added: number, removed: number, hunkIds: string[] }[],
  hunks: { id: string /* "h1", "h2", … in diff order */, file: string, header: string /* "@@ -236,7 +236,7 @@" */,
           oldStart, oldLines, newStart, newLines: number,
           lines: { kind: "context" | "add" | "del", oldLine: number | null, newLine: number | null, text: string }[] }[],
  requirement: Requirement,
  expectation: { items: { requirementItemId: string, expectedBehaviours: string[], likelyAreas: Area[], expectedTests: string[] }[] } | null,  // null in anchored mode
  story: { what: string, why: string, touches: { symbol: string, file: string, note: string }[] },
  claims: { id: string /* "c1" */, requirementItemId: string | null, text: string, kind: "behaviour" | "structure" | "docs" | "test",
            level: EvidenceLevel, hunkIds: string[], citations: Citation[],
            evidence: { kind: "differential-test" | "pr-test" | "quote-check",
                        summary: string, testName: string | null,
                        base: { result: "fail" | "pass" | "error", output: string } | null,
                        head: { result: "fail" | "pass" | "error", output: string } | null }[] }[],
  findings: { id: string /* "f1" */, kind: "defect" | "contradiction" | "missing" | "scope-creep", area: Area | null,
              severity: "high" | "medium" | "low", title: string, detail: string,
              statement: string | null /* contradiction: the PR's sentence */, hunkIds: string[], citations: Citation[] }[],
  refusals: { id: string /* "r1" */, ruleId: string /* "R1".."R7" */, source: "ai" | "rule" /* rule: a fixed trigger in policy, no model involved */,
              reason: string, hunkIds: string[] }[],
  quoteCheck: { checked: number, passed: number, downgraded: number, dropped: number,
                failures: { itemId: string, citation: Citation | null /* null: no code to check, e.g. an unknown rule id */, reason: string }[] },
  retractions: { claimId: string, reason: string, output: string }[],
  receiptDraft: { checked: { item: string, by: "tool" | "ai-supported" | "human" }[],
                  notChecked: { item: string, reason: string }[],
                  residualRisk: { text: string, acceptedRefusalIds: string[] } },
  routing: TierDecision   // route() at record time, with the levels from the report card then
}
```

Output text fields (`text`, `detail`, `reason`, `what`, `why`) are plain text, no Markdown. Lines in `hunks[].lines[].text` exclude the `+`/`-`/space prefix. Output `output` strings are trimmed to the last 2,000 characters.

### `TierDecision` and `route()` (`src/rules/route.ts`)

`route(review: Review, levels: Record<Area, LadderLevel>, policy = routingPolicy, escapes: Partial<Record<Area, number>> = {}): TierDecision` where

`TierDecision = { tier: Tier; reasons: { ruleId: string; text: string; tier: Tier }[]; coverage: Record<string /* hunkId */, Coverage>; readHunks: number; totalHunks: number; readLines: number; totalLines: number; readMinutes: number; fullMinutes: number }`.

Deterministic, pure, no I/O; runs in Node and the browser. Rules, in this order (each that fires adds one reason; the tier is the highest any reason asks for; with no reasons the tier is Light):

1. **Coverage per hunk**, first match wins: `read` if a finding or refusal lists the hunk, if the hunk's file area is at level `shadow`, or if no claim with level `verified` or `supported` lists it; `verified` if a `verified` claim lists it; otherwise `supported`. Generated-file hunks follow the same rule.
2. `R-size` · changed lines in non-generated files > 400 → full · "<n> changed lines outside generated files (limit 400)".
3. `R-read-share` · read hunks ≥ 75% of all hunks → full · "Read <r> of <n> hunks: most of the change needs a human".
4. `R-escape` · for each area of the change's hunks with `escapes[area] > 0` → full · "<Area>: a bug escaped here, the next changes get a full read". This is the "cluster arrest" of continuous sampling plans: after a defect gets through, inspection goes back to 100% until trust is earned again.
5. `R-refusal` · any refusal → focused · "<n> items refused: a human decides" (singular "1 item refused: a human decides").
6. `R-contradiction` · any contradiction finding → focused · "The PR description contradicts the code in <n> place(s)".
7. `R-defect` · any defect finding → focused · "<n> defect(s) found".
8. `R-sensitive-path` · any hunk in `policy.sensitivePaths` → focused · "Touches <path glob label>".
9. `R-area-level` · for each area of the change's hunks (file areas) whose level is not `trusted` → focused · "<Area>: <Level>, may route Focused at best" (shadow: "<Area>: Shadow, the AI's output routes nothing here").
10. `R-unread` · any hunk with coverage `read` and no other rule fired → focused · "<n> hunks have no checked evidence".

**Without a readable report card** (missing or invalid), the app applies one rule on top of `route()`, in `decideChange()` (`src/features/inbox/`), so every screen shows the same decision: route with every area at Shadow, then force tier Full and every hunk `read`, drop `R-read-share` and `R-unread` (their counts no longer match), and add `R-no-track-record` · → full · "No readable report card: nothing counts as covered, so a person reads every hunk."

Reading time: `readMinutes = ceil(readLines / 25)` (minimum 1 when readLines > 0), `fullMinutes = ceil(totalLines / 25)`; lines = added + removed lines of the hunks.

### Ladder (`src/rules/ladder.ts`)

`ladderLevel({ planted, caught, spotChecksClean, escapes }) : LadderLevel`: shadow if `planted < 3` or `caught / planted < 0.6`; calibrated if not shadow and `spotChecksClean < 5`; trusted otherwise. Each escape then drops one level (trusted → calibrated → shadow; shadow stays). `applyEscapes(levels, escapes: Partial<Record<Area, number>>)` returns the adjusted levels. Thresholds live in `src/policy/ladder.ts` (`minPlanted: 3`, `minCatchRate: 0.6`, `spotChecksForTrusted: 5`). No spot-check workflow exists in this reference, so `spotChecksClean` is 0 and no area can be Trusted; S3 says so.

### `ReportCard` (`src/contracts/reportCard.ts`)

```
{
  schemaVersion: 1, generatedAt: string,
  reviewer: { version: string, model: string },
  areas: { area: Area, planted: number, caught: number, spotChecksClean: number, level: LadderLevel,
           plants: { plantId: string, changeId: string, caught: boolean, findingId: string | null, defect: string, variantUrl: string }[] }[],
  anchoredVsBlind: { plants: number, runsPerMode: number,
                     anchored: { caught: number, total: number }, blind: { caught: number, total: number },
                     perPlant: { plantId: string, changeId: string, statement: string, anchoredCaught: number, blindCaught: number, runs: number }[] },
  hallucinations: { quotesChecked: number, quoteFailures: number, claimsRetracted: number, findingsDropped: number },
  findingsOnPlants: { total: number, matchedPlant: number },
  routingSpread: { changes: number, light: number, focused: number, full: number, readHunks: number, totalHunks: number, readMinutes: number, fullMinutes: number }
}
```

`variantUrl` is `https://github.com/miska-voutilainen/junction26-messagepack-csharp/commit/<headSha>`.

### `ReceiptRecord` (`src/contracts/receipt.ts`)

```
Receipt = { kind: "countersign-receipt", version: 1, changeId, requirementId, repo, commit /* headSha */, baseCommit,
            baseTree, headTree, diffSha256, reviewerVersion, reviewRunId,
            owner: string /* GitHub login, the allowed_signers principal */, signedAt: string,
            checked: { item: string, by: "tool" | "ai-supported" | "human" }[],
            notChecked: { item: string, reason: string }[],
            residualRisk: { text: string, acceptedRefusalIds: string[] },
            hunks: { hunkId: string, file: string, coverage: Coverage, readBy: string | null /* the owner for "read" hunks, else null */ }[] }
ReceiptRecord = { schemaVersion: 1, changeId: string, receipt: Receipt, signature: string /* armored SSH signature */,
                  notesRef: "refs/notes/countersign",
                  verify: { command: string, output: string, ok: boolean, verifiedAt: string } }
```

The S2 receipt is unverified when `verify.ok` is false, else stale when `receipt.diffSha256 !== review.diff.diffSha256`. `hunks` comes from `review.routing.coverage` at draft time, so the signature covers which hunks the owner read and which checks covered the rest. Because the receipt binds the diff, not a commit, a squash or rebase that leaves the diff unchanged keeps it valid.

### Diff identity (`src/lib/git/diffIdentity.ts`)

`computeDiffIdentity(repoDir, baseSha, headSha): Promise<{ baseTree, headTree, diffSha256 }>`: tree SHAs from `git rev-parse <sha>^{tree}`; `diffSha256` = sha256 (hex) over the raw stdout bytes of `git -c core.quotepath=false -c diff.algorithm=myers diff --binary --no-ext-diff --no-color --no-renames --full-index --src-prefix=a/ --dst-prefix=b/ <base> <head>`, run with `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL` pointing to an empty file. The same function feeds the review and the receipt.

### Pipeline CLI (`src/pipeline/cli.ts`)

- `pnpm review run <changeId> [--anchored] [--run <k>] [--no-tests]`: blind-first by default (A1 → A2 → quote check → A3 → A4 → A5 unless `--no-tests` → `route()`), writes `data/runs/<changeId>/review.json`; with `--anchored` (A1 skipped, A2 gets the author description first) or `--run <k>` it writes `data/runs/<changeId>/<anchored|blind>/<k>.json` instead. Prints one summary line: "<changeId> · <tier> · read <r> of <n> hunks · <claims> claims · <findings> findings · <refusals> refused · $<cost> · <seconds> s".
- `pnpm evals`: blind runs (no A5) of every `planted-bug` input, 3 anchored and 3 blind runs of every `contradiction-plant` input, scoring against the answer keys, then writes `data/eval/report-card.json` and recomputes `data/runs/*/review.json` `routing` with the new levels.
- Env: `AI_BACKEND` (`claude-code` default | `api`), `ANTHROPIC_API_KEY` (only for `api`), `SAMPLE_REPO_DIR`, `AI_MODE` (`record` default: call the model and save the response; `replay`: read `data/recordings/` only, fail on a miss; `live`: call without saving).

### Receipt CLI (`src/receipt/cli.ts`)

- `pnpm countersign draft <changeId>`: writes `.scratch/receipts/<changeId>.json` (a `Receipt` without `signedAt`, from `review.receiptDraft`, owner from `--owner <login>` or `git config github.user`, else asks for `--owner`). The owner edits it.
- `pnpm countersign sign <changeId> [--key <path>]` (default key `~/.ssh/countersign_ed25519`): sets `signedAt`, serialises the receipt as canonical JSON (keys sorted, 2-space indent, trailing newline), signs it with `ssh-keygen -Y sign -f <key> -n countersign-receipt`, writes the note `<canonical JSON>\n<armored signature>` with `git notes --ref=countersign add --no-stripspace -F <file> <headSha>` in `SAMPLE_REPO_DIR` (fails if a note exists: receipts are append-only by policy), then prints the verify command.
- `pnpm countersign verify <changeId>`: reads the note, splits it at the `-----BEGIN SSH SIGNATURE-----` line, runs `ssh-keygen -Y verify -f data/sample/allowed_signers -I <owner> -n countersign-receipt -s <sig>` with the payload on stdin, checks `commit === headSha` and recomputes `computeDiffIdentity()`. Prints the ssh-keygen line and "diff unchanged" (exit 0), or "Stale: the diff changed since signing" (exit 1), or "No receipt for <changeId>" (exit 2), or "Signature invalid" (exit 3). The exit code is the merge gate a CI step would use.
- `pnpm countersign export <changeId>`: runs verify and writes `data/receipts/<changeId>.json`.
- ssh-keygen: on Windows `C:\Program Files\Git\usr\bin\ssh-keygen.exe` (OpenSSH 10.2), else `ssh-keygen` on the PATH; paths passed with forward slashes, `cwd` set.

### Simulated escapes (`src/lib/simulation/escapes.ts`)

A React context provider mounted in the root layout plus `useEscapes(): { escapes: Partial<Record<Area, number>>, record(area: Area): void, undo(area: Area): void, reset(): void, total: number }`, persisted to `localStorage` key `countersign.escapes.v1` (wrapped in try/catch; works without storage). Every screen that shows a tier computes it with `route(review, applyEscapes(reportCardLevels, escapes), routingPolicy, escapes)`.

### Policy (`src/policy/`)

- `refusals.ts` (`refusalPolicyVersion = "v1"`): `R1` Requirement intent: whether the requested behaviour is right · decides: product owner (the library maintainers). `R2` Security design: trust boundaries, untrusted-input handling, crypto, secrets · security owner. `R3` Data handling: retention, personal data, legal · data protection owner. `R4` Irreversible changes: wire-format or persisted-data changes old readers can't read, destructive migrations, data deletion · change owner. `R5` New third-party dependencies and licences · tech lead. `R6` Changes it can't trace to the requirement · change owner. `R7` Public contract: new or changed public API, diagnostic IDs or documented behaviour · API owner (the maintainers). `fixedRefusals`: `[{ ruleId: "R7", glob: "**/PublicAPI.Unshipped.txt", reason: "Changes the declared public API" }, { ruleId: "R7", glob: "src/MessagePack.Annotations/**", reason: "Changes the public attributes" }]`; after A3 the pipeline adds a `source: "rule"` refusal for the hunks each glob matches (merged into an AI `R7` refusal on the same hunks), so these always reach a human whatever the model says.
- `areas.ts`: file kind and area by path, first match wins: `tests/**/Resources/**` and `**/*.verified.*` → generated, area null · `tests/**` → test, area null · `**/AnalyzerReleases.*.md` → source, analyzer (listed before the Markdown rule, or it could never match: those files are `.md`) · `**/*.md` → docs, area null except `doc/analyzers/**` → analyzer · `src/MessagePack.SourceGenerator/Analyzers/**` → source, analyzer · `src/MessagePack.SourceGenerator/Transforms/**`, `src/MessagePack/**` → source, security (they generate or run deserialization of untrusted input) · `src/MessagePack.SourceGenerator/**`, `src/MessagePack.Annotations/**` → source, generator · anything else → source, area null. Plus the four area checklists for A3 (6–10 items each, written by T09 from public .NET, Roslyn and OWASP deserialization guidance, labelled "our checklist until Tieto's standards arrive").
- `routing.ts`: `sizeLimit: 400`, `readShareFull: 0.75`, `linesPerMinute: 25`, `sensitivePaths: [{ glob: "src/MessagePack.Annotations/**", label: "public attributes (MessagePack.Annotations)" }, { glob: "**/AnalyzerReleases.*.md", label: "diagnostic IDs (analyzer releases)" }, { glob: "src/MessagePack/**", label: "the runtime serializer" }]`.
- `ladder.ts`: the thresholds above.

## 6. AI behaviour

**Model and client.** Every call goes through `src/ai/client.ts`, which has two backends chosen by `AI_BACKEND`. **`claude-code`** (default): Claude Code's headless mode (`claude -p`) on the operator's own subscription, one turn, no tools, our system text replacing Claude Code's, JSON output parsed and validated with the call's zod schema, effort through `CLAUDE_CODE_EFFORT_LEVEL`; exact flags per Claude Code's CLI reference, checked in T10; cost logged as Claude Code reports it. **`api`**: the official `@anthropic-ai/sdk`. Both use model `claude-opus-5-5` and the same prompts, retry and recording rules. API backend details: structured outputs (the SDK's `messages.parse` with a zod schema per call), `output_config.effort: "high"`, adaptive thinking (the model default; it can't be disabled), `max_tokens: 16000`, request timeout 180 s, `maxRetries: 2`, and the server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`); a `refusal` stop reason is logged and fails the step. No `temperature` (removed on this model): repeatability comes from the recordings, not from sampling. On a schema validation failure the client retries once with the validation error appended; a second failure fails the step and the run (no partial review is written). Each call logs model, prompt version, input and output tokens, cost (input $4 and output $20 per million tokens) and milliseconds, never the content. Recording key: sha256 of model + prompt version + the rendered prompt + the run index.

**Prompts** live in `src/prompts/a<n>.ts`, each exporting `version` (e.g. `"a2.v1"`), the system text, a typed `render(input)` and its zod output schema. Changing a prompt bumps its version and the reviewer version (`rv1` → `rv2`), and is logged in `docs/lessons.md`. Untrusted text (the diff, the author description, file contents) goes in clearly delimited blocks and is never treated as instructions.

**Latency budget** (offline; nothing runs live in the demo): each call ≤ 120 s; one full blind-first review ≤ 10 min excluding .NET builds; `pnpm evals` ≤ 90 min.

### A1 · Blind expectation (`a1.v1`)

- **Input:** the requirement only (intent, functional and non-functional items) plus a fixed one-paragraph orientation to the repository (its projects and what they do). No diff, no author description.
- **Output:** `{ items: { requirementItemId, expectedBehaviours: string[] (1–5), likelyAreas: Area[], expectedTests: string[] (0–3) }[] }`, one item per functional and non-functional item.
- **Eval cases:** for MP-2283 the items mention that the generator and analyzer no longer throw for a closed generic value type from a referenced assembly, and that a resolver is generated; every requirement item id appears exactly once.

### A2 · Change story and claims (`a2.v1`)

- **Input:** the hunks with their ids and line numbers, the full head-side text of each touched source file (non-generated, up to 60,000 tokens in total; larger files are cut to ±80 lines around each hunk), and A1's output. In anchored mode: the author description first, then the hunks and files, no A1.
- **Output:** `{ story: { what, why, touches: { symbol, file, note }[] }, claims: { requirementItemId | null, text, kind, hunkIds, citations: { file, side, startLine, endLine, quote }[] }[] }`. A claim may name hunks by id or by `pathGlob`, which the pipeline expands to hunk ids.
- **Quote check (code):** each citation's quote must appear, whitespace-normalised, within the cited lines of the cited side (head file for `new`, base file for `old`), and in every expanded hunk for a `pathGlob` claim. A claim with at least one passing citation is `supported`; a claim with no passing citation becomes `unverified` with no citations (claims are never dropped, 9.1). Every failure is recorded in `quoteCheck.failures` and counted.
- **Eval cases:** on `mp-2283` every hunk except the README and doc hunks is listed by at least one claim; zero quote-check failures is not required, but each failure must be recorded; a deliberately wrong quote in a unit-test fixture is caught.

### A3 · Area review and refusals (`a3.v1`)

- **Input:** the hunks, the touched files (as A2), the four area checklists and the refusal policy (rule ids, titles, deciders), A1's expectation and A2's claims.
- **Output:** `{ findings: { kind: "defect" | "missing" | "scope-creep", area, severity, title, detail, hunkIds, citations }[], refusals: { ruleId, reason, hunkIds }[] }`. Every finding needs at least one citation that passes the quote check, or it is dropped and counted (`hallucinations.findingsDropped`). The check also tests fit to the record: a refusal whose `ruleId` isn't in the refusal policy is dropped and recorded in `quoteCheck.failures` with `citation: null` and the reason `unknown rule id "R8"`. Struck items stay visible there and on S3; nothing the model said is silently lost. A finding's `area` is the area of its cited file by path: the pipeline sets it from `classifyFile()` of the first citation that passes the quote check (null for test, docs and generated files), and the model does not choose it (decided Sat 14.11).
- **Note:** one generalist call with per-area checklists; the planted bugs measure that breadth.
- **Eval cases:** the 10 planted bugs (caught when a defect or missing finding has a citation in the answer key's file whose lines overlap the planted range ±3 lines, and its area equals the answer key's); on `mp-2283` at least one refusal cites `R7` or `R1` (the change silently drops diagnostics for types from referenced assemblies, a documented-behaviour decision).

### A4 · Contradiction check (`a4.v1`)

- **Input:** the author description and A2's story and claims (with citations).
- **Output:** `{ statements: { statement: string /* exact sentence from the description */, verdict: "supported" | "contradicted" | "unsupported", claimIds: string[], explanation: string, citations }[] }`. `contradicted` and `unsupported` statements become `contradiction` findings (area null, severity medium; high when contradicted).
- **Anchored run for comparison:** with `--anchored`, A2 sees the author description first and A1 is skipped; A4 runs the same (A3 and A5 are skipped in the comparison runs, 9.1 T16). A planted contradiction counts as caught in a run when A4 marks the planted sentence (case- and whitespace-insensitive match, or ≥ 80% token overlap) as `contradicted` or `unsupported`.
- **Eval cases:** the 5 contradiction plants (`cp0`–`cp4`), 3 runs per mode.

### A5 · Differential test evidence (`a5.v1`, offline inside `pnpm review run`)

- **Two sources of tests:** (1) the PR's own added or changed test methods; (2) one test per functional requirement item, written by A5 **from the requirement and A1's expectation, not from the diff**.
- **A5 input:** the requirement item, A1's expectation for it, and the base-side text of one existing test file in the touched test project as a style example. No hunks.
- **A5 output:** `{ testFile: string /* path inside the test project */, code: string, testNames: string[], requirementItemId: string }`.
- **Run:** in two git worktrees of `SAMPLE_REPO_DIR` (base and head), the test file is added to each, then `dotnet test <project> --filter "FullyQualifiedName~<name>"` runs on both (timeout 15 min per side). For (1) the base worktree gets only the PR's test files. A claim citing hunks of that requirement item becomes `verified` only when an A5 test (2) **fails on base and passes on head**; both outputs are attached as evidence. A PR's own test (1) that does the same makes the claim at most `supported`, noted "the PR's own test: the same agent wrote the code and the test" (an agent can encode one mistake in both; `docs/research.md`). Passes on both: the claim stays `supported`, noted "the test doesn't tell the versions apart". Fails on head with a test failure (not a build error): the claim is retracted (`retractions`, logged in `docs/lessons.md`). Build error: logged and counted, the claim stays as it was.
- **Go/no-go Sat 01:00 (Miska):** `dotnet test tests/MessagePack.SourceGenerator.Tests` runs on the pipeline laptop (.NET SDK 8.0.4xx installed). With the ideas-first emphasis, a borderline result (it runs only after workarounds, or a run takes over 15 min) counts as no-go. If not, A5 is cut, no claim can be Verified, S2 shows Supported as the top level, and the concept card's limits say why.

### Planted-bug eval

- A1–A4 run blind over each planted-bug variant; scored as in A3's eval cases. The results feed the report card and the starting levels of the trust ladder.
- The bugs are planted by an agent that never sees the prompts, and the prompts are written by agents that never see the plants (principle 9); every rate is shown with its sample size, and prompts are frozen (`rv1`) before the first eval run; any later prompt change makes a new reviewer version and the eval reruns.

## 7. External integrations

- Claude through `src/ai/client.ts`, with record/replay: Claude Code headless on Miska's Max plan by default (recording runs are scheduled outside build sessions, checked against `/usage`); the Anthropic API (`ANTHROPIC_API_KEY`, spending limit set by Miska) as the alternative backend.
- git and GitHub: our fork of Tieto's repo (branches, worktrees, notes under `refs/notes/countersign`, pushed with `git push origin refs/notes/countersign`); SSH signing with `ssh-keygen -Y` (namespace `countersign-receipt`).
- .NET SDK 8.0.4xx on the pipeline laptop for A5.
- Vercel: project "junction-2026" (team "junction"), Git integration, a preview per PR, production from `main`; `vercel.json` sets the framework to Next.js and the pnpm commands.
- Stretch goals: dropped on 2026-11-13 (ideas first, section 1). Both are described in "Beyond the reference" instead: a GitHub PR comment with the story and a link to the receipt, and a live "Prove it" button that reruns A5 on one claim.
- Not built, pitch only: in a real team the receipt becomes a required merge check (`pnpm countersign verify` exit code: "no valid receipt for this diff, no merge"), and the pipeline runs on every agent PR.

## 8. Out of scope

- A finished product, model training or fine-tuning, vendor or model selection (challenge rules).
- Accounts, multi-user collaboration, review of arbitrary repos or PRs (our fork of Tieto's repo only).
- Real CI integration of the reviewer; a server or database of any kind.
- Specialist multi-agent reviewer swarms and reviewer debate.
- Live model calls during the demo, including the "Prove it" button (vision only).
- UI polish beyond the definition of done (`.claude/rules/quality.md`): screens are clean and correct; spare time goes to the idea pages and readable code.
- A spot-check workflow (the concept card describes it; the report card shows its effect through the simulated escape and the "Trusted needs 5 clean spot checks" line).
- Keyboard shortcuts beyond normal tab focus (no `j`/`k`).
- Any real customer data.

## 9. Work plan

Each task is one PR in one lane, about 1–3 hours of agent work. Lanes: **engine** (Miska, `miska-voutilainen`, Max), **app** (Miska, `miska-voutilainen`, Max, from Sat 14.11; Elias takes over UI changes once the design is built), **evidence** (Veijo, `Kasanen`, Pro). Foundation tasks list their **pre-agreed shared paths**; the sign-off of this spec is the owners' agreement for exactly those. Every task: docs it changes in the same PR; unit tests for its logic; UI tasks a Playwright spec at 375 and 1440 px.

| ID | Lane | Title | Depends on | Demo step | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| T00 | engine | Agent harness core (lane map, lane module, guard, briefing, tests) | – | – | `.claude/lanes.json` matches the Lanes table; docs/setup.md 4.6 tests pass (`pnpm test:hooks`); 4.7 steps 1–5 pass. Shared: `.claude/**` |
| T01 | app | Design system and app shell | T00; Miska's wireframe link posted on the issue (`needs-human` until then) | all | Tokens (colour, spacing, radius, type scale, shadow, motion) in `src/styles/tokens.css` from the wireframe, mapped into the shadcn theme in `src/app/globals.css`; `AppShell` (wordmark, nav, escape counter slot, mock-data banner slot); `LoadingSkeleton`, `EmptyState` (title, body, optional command), `ErrorState` (title, body, retry), `Toaster` (sonner) in `src/components/`; coverage, tier and evidence-level badges as shared components with text labels; AA contrast checked; screenshots at 375 and 1440 px in `.review/`. Shared: `src/styles/tokens.css`, `components.json` |
| T02 | evidence | Quality hooks, lint and format config, unit test runner | T00 | – | `format-on-edit.mjs` and `quality-on-stop.mjs` per docs/setup.md 4.3–4.4 with the dry-run test cases as tests; registered in `.claude/settings.json`; ESLint flat config adds the a11y rules and `no-console` (error) for `src/app`, `src/features`, `src/components`; `.prettierrc.json` with `prettier-plugin-tailwindcss`; `vitest.config.ts` (jsdom, tsconfig paths, `src/**/*.test.ts(x)`) with one passing test; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass. Shared: `.claude/hooks/format-on-edit.mjs`, `.claude/hooks/quality-on-stop.mjs`, `.claude/settings.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts` |
| T03 | app | E2E harness and screenshots | – | all | `playwright.config.ts`: projects `desktop` (1440×900) and `mobile` (375×812), `webServer` `pnpm build && pnpm start` on `process.env.PORT ?? 3000`, `baseURL` from `E2E_BASE_URL` when set; a fixture that fails any test on a console error or warning; `e2e/smoke.spec.ts` opens `/` and `/reviewer`; a `screenshots` project saving full-page PNGs of `/`, `/changes/mp-2283` and `/reviewer` at both widths into `.review/`; `pnpm e2e` and `pnpm screenshots` work. Shared: `playwright.config.ts` |
| T04 | engine | CI workflows | T00, T02, T03 | – | `.github/workflows/ci.yml` and `e2e-preview.yml` per docs/setup.md section 6 (message check, lane check, tree check in `.github/scripts/`, hook tests, lint, typecheck, unit tests, build, gitleaks); under 4 minutes on this repo; then Miska turns on branch protection on `main` (PR required, `ci` required, no force push) and auto-merge. Shared: `.github/**` |
| T05 | engine | Docs foundation | – | – | `docs/architecture.md` (SVG diagram, light and dark, of P1–P7 and the data files, the boundaries from section 1), `docs/development.md` (setup incl. `.env`, the fork clone, .NET, commands), `docs/api.md` (every contract in section 5, field by field, plus both CLIs); README "How to run" section. Docs only |
| T06 | app | Fixtures, data loaders and the simulated-escape store | – | 1, 3 | `data/fixtures/` with a `mp-2283` review (built from the real diff: its real hunks, 8–12 claims across levels incl. one Verified with base/head outputs, one contradiction, two refusals, a receipt draft), the other three Tieto changes' reviews (smaller), a report card, a signed receipt record, change inputs; every fixture validates (unit test); `src/lib/data/` loaders (server-only) returning `{ status: "ok" \| "missing" \| "invalid", data, source: "recorded" \| "fixture" }`, preferring recorded files; `src/lib/simulation/escapes.ts` per section 5 with tests (record, reset, persistence, no storage) |
| T07 | engine (moved from evidence on Sat 14.11) | Sample repo fork, change inputs and requirements | T28 | 1 | `data/sample/changes/mp-*.json` (4, full SHAs, titles in plain words) and `data/sample/requirements/MP-*.json` (4) per section 4; the four synthetic author descriptions, with the one false statement in `mp-2283`'s recorded in `data/sample/answer-key/cp0.json`; all validate against `src/contracts/` (unit test). Never open `src/prompts/` or `src/pipeline/` |
| T08 | engine (moved from evidence on Sat 14.11) | Planted bugs and contradiction plants, written by an isolated subagent that never opened the prompts, and the prompt writers never opened the plants | T07 | 2, 3 | 10 variant branches pushed to the fork per section 4 (6 of `mp-2283`, 4 of `mp-2234`; 4 generator, 3 analyzer, 3 security), each compiling with `dotnet build src/MessagePack.SourceGenerator`; `data/sample/changes/v01…v10.json` and `cp1…cp4.json`; answer keys for all 14; written without opening `src/prompts/`, `src/pipeline/` or any review output; each plant's area is its file's area and its lines are more than 3 lines from the parent change's own edits; validated by a unit test (every plant has an answer key whose file and lines exist in the variant) |
| T09 | engine | Git diff loader, hunks, diff identity and policy | T07 | 1 | `src/lib/git/`: diff between two SHAs parsed (parse-diff) into `Review.files` and `Review.hunks` with ids `h1…` in diff order, file kind and area from `src/policy/areas.ts`; `computeDiffIdentity()` per section 5; head and base file text readers; `src/policy/*.ts` per section 5 incl. the four area checklists; tests on `mp-2283` (8 hunks expected; adjust the number in the spec if the real diff differs) and on fixture diffs |
| T10 | engine | AI client with record/replay and usage log | – | – | `src/ai/client.ts` per section 6 (model, effort, structured outputs, retry with the validation error, refusal fallback, timeout, usage and cost); `AI_MODE` record/replay/live; unit tests with a fake transport (validation retry, replay miss, refusal); one live smoke call recorded |
| T11 | engine | Routing rules and trust ladder | – | 1, 3 | `src/rules/route.ts` and `src/rules/ladder.ts` per section 5, pure and browser-safe; one unit test per rule and per coverage branch, plus the `mp-2283` fixture routing to Focused with the reasons in order |
| T12 | engine | Pipeline: A1 blind expectation, A2 story and claims, quote check | T09, T10, T11 | 1 | `src/prompts/a1.ts`, `a2.ts`; `src/pipeline/` steps and the quote check per section 6; `pnpm review run mp-2283 --no-tests` writes a schema-valid review (findings and refusals empty until T13); quote-check unit tests incl. a deliberately wrong quote |
| T13 | engine | Pipeline: A3 area review and refusals, A4 contradictions, anchored mode | T12 | 2 | `a3.ts`, `a4.ts`; findings and refusals in the review; `--anchored` and `--run <k>` per section 5; receipt draft built from the review (checked: tool and Verified items; not checked: Read this hunks and Unverified claims; residual risk: the refusals); A4 catches the false statement in `mp-2283`'s description in a recorded run |
| T14 | engine | Pipeline: A5 differential tests on .NET | T12 | 1 | `a5.ts`; worktree runner with timeouts; differential classification per section 6; a recorded `mp-2283` review with at least one Verified claim showing fail-on-base and pass-on-head output; or, if the Sat 01:00 go/no-go fails, the documented cut (`docs/decisions.md`, concept card limits) |
| T15 | engine | Record the four Tieto reviews and start the lessons log | T13, T14 | 1, 2 | `data/runs/mp-*/review.json` for all four, recorded with `AI_MODE=record`; `pnpm review run` reproduces each from recordings with `AI_MODE=replay`; `docs/lessons.md` started with every failure seen (quote-check failures, retractions, wrong tiers, model errors), dated, with what we changed |
| T16 | engine | Planted-bug eval, anchored-vs-blind count, report card | T08, T13, T11 | 2, 3 | `pnpm evals` per section 5 writes a schema-valid `data/eval/report-card.json` from recorded runs; scoring unit tests (overlap ±3 lines, area match, statement match); reviews re-routed with the measured levels; go/no-go result for anchored-vs-blind logged in `docs/lessons.md` by Sat 12:00 |
| T17 | app | S1 Inbox | T01, T03, T06, T11 | 1, 3 | S1 per section 3, every state; tiers via `route()` with simulated escapes; e2e: row count, a tier badge, the link to S2, no console errors, at 375 and 1440 px |
| T18 | app | S2 header, tier banner, hunk navigator and diff viewer | T01, T03, T06, T11 | 1 | S2 header, banner, navigator and diff per section 3 with shiki highlighting; every hunk shows exactly one coverage state; e2e: banner text equals `route()` output for the fixture, clicking a navigator item focuses its hunk, 375 px tab layout |
| T19 | app | S2 sidebar: Story, Blind check, Refused and Receipt tabs | T18, T09 | 1, 2, 3 | The four tabs per section 3, every empty state; selecting a claim highlights its cited lines; Receipt tab in unsigned, signed and stale states (fixtures); e2e for each tab |
| T20 | evidence | Receipt CLI: draft, sign, verify, export | T07, T09 | 3 | `src/receipt/` per section 5; unit tests with a throwaway key in a temp repo: sign → verify ok, tampered payload → exit 3, changed diff → exit 1, second sign → refused; works on Windows (Git for Windows ssh-keygen) |
| T21 | app (moved from evidence on Sat 14.11) | S3 Reviewer report card | T01, T03, T06, T11 | 3 | S3 per section 3 in `src/features/report-card/` and `src/app/reviewer/page.tsx` (route file pre-agreed with app), every state; "Record escape" uses `useEscapes()` and the S1 badges change without a reload (e2e); 375 and 1440 px. Shared: none; cross-lane file `src/app/reviewer/page.tsx` agreed here |
| T22 | evidence | Concept card | – | – | `docs/concept-card.md`, one printed page: recommendation (3 sentences), the 9 principles in one line each, trade-offs (at least 4, each "we chose X over Y because Z, at the cost of W"), limits (at least 5, incl. no Trusted area without spot checks, derived requirements, synthetic descriptions, n per area, notes not tamper-evident without the signature), how trust is measured (Tieto's four measurement points mapped to what we measure now and what a real deployment tracks: reverts and incidents vs review time, findings real and accepted, time to merge, share routed to humans); the eight ideas in one line each, linking to `docs/ideas/`, and the four next ideas marked "not built"; a "Beyond the reference" section (what each idea looks like across a real organisation: the receipt as a required merge check, trust ladders across teams, a spot-check workflow, a refusal policy per organisation, the PR comment and "Prove it" button); reviewed by Miska |
| T23 | engine | Sign and publish the demo receipt | T15, T20 | 3 | Miska's `countersign_ed25519` public key in `data/sample/allowed_signers`; `mp-2283` signed by `miska-voutilainen`, note pushed to the fork, `data/receipts/mp-2283.json` exported and shown on production |
| T24 | engine | Guard hardening follow-ups from the T00 review (issue #27) | T00 | – | gh subcommands after leading flags, chaining and wrapper forms, worktree paths and cwd, PowerShell harness writes; one test each. Shared: `.claude/hooks/**` |
| T25 | engine | Idea pages | – (numbers filled in after T16) | all | Eight pages in `docs/ideas/` named as in section 1 (Emphasis), plus the four next ideas in `docs/ideas/README.md`, each per the template in 9.1; the code links resolve; each idea in the README's "The ideas" list links to its page; numbers only from `data/eval/report-card.json` or recorded runs, with sample sizes, or "not measured yet"; reviewed by Miska. Docs only |
| T26 | app | `IdeaLabel` and idea labels on S2 | T19 | 1, 2, 3 | `src/components/IdeaLabel.tsx` per section 3 (Idea labels), the eight ideas defined once in it; labels on S2 at the placements listed; e2e: each S2 label present with its link, keyboard focus visible, at 375 and 1440 px |
| T27 | evidence | Idea labels on S3 | T21, T26 | 3 | `IdeaLabel` on the S3 trust ladder (1) and "Hallucinations caught" (4) headings; e2e: both present with their links |
| T28 | evidence | Seed script (split out of T07, about an hour) | – | – | `scripts/seed.ts` per 9.1 T07 (the `scripts/seed.ts` bullet: env, clone, origin check, fetch with notes, exit codes); until T07's change inputs exist it checks the four Tieto branches `ju26-issue-2283`, `ju26-issue-2234`, `ju26-issue-2129`, `ju26-issue-2297` exist on `origin` instead of their `headSha`s, and prints each branch's head SHA (T07 uses them); `pnpm seed` runs on Windows; a unit test for the origin check and the exit codes against a temp git repo; readable per `.claude/rules/readability.md`. No other files |

Not tasks: the 2-minute video, the deck and the final README are made at the freeze by `demo-prep` and the pitch owner.

All dependencies (incl. shiki, parse-diff, zod, the Anthropic SDK, Vitest, Playwright, tsx) were installed by the skeleton PR; the `package.json` scripts in `CLAUDE.md` exist already. Tasks that need an unlisted package stop and ask (`go`).

### 9.1 Task notes (answers to the cold-read questions; they bind like the table)

**T06 · loaders and shared pieces.**
- `src/lib/data/` exports `loadChanges(): Promise<LoadResult<ChangeInput[]>>` (only `kind: "tieto"`, sorted by id), `loadChange(id)`, `loadReview(changeId)`, `loadReportCard()`, `loadReceipt(changeId)`, where `LoadResult<T> = { status: "ok"; data: T; source: "recorded" | "fixture" } | { status: "missing" } | { status: "invalid"; error: string }`. Each reads the recorded path first (`data/sample/…`, `data/runs/…`, `data/eval/…`, `data/receipts/…`) and falls back to the same path under `data/fixtures/`.
- Also in T06: `receiptStatus(review, receiptRecord | null): "needs-review" | "unverified" | "signed" | "stale"` in `src/lib/data/receiptStatus.ts`, the `ReceiptStatus` component in `src/components/ReceiptStatus.tsx` ("Needs review" · "Signed by <owner>" · "Stale" · "Signature failed verification"), and a `MockDataBanner` in `src/components/MockDataBanner.tsx` that a page renders when any of its loader results has `source: "fixture"`.
- The `mp-2283` fixture must route to Focused with at least 2 `read` hunks under `levelsFromReportCard(fixture report card)` and no escapes.

**T07 · sample data.**
- `authorAgent` is "Coding agent (Tieto sample)" for all four. `authorDescription.writtenBy` is "engine lane (Miska), drafted by a Claude Sonnet builder without opening prompts, pipeline or review output" (T07 moved from the evidence lane on Sat 14.11, #9). `parentChangeId` is null and `branch` the bare branch name for the four Tieto changes.
- Change titles: written by T07, plain words, at most 70 characters, describing what the change does (example: "Fix crash on closed generic structs from referenced assemblies"). Requirement `title` is the upstream issue title verbatim.
- Upstream issues are in `MessagePack-CSharp/MessagePack-CSharp`. Read them with `gh issue view <n> -R MessagePack-CSharp/MessagePack-CSharp`. `derivedFrom.url` is the issue URL. `derivedFrom.note` is "Derived by the engine lane from the upstream issue text on <date>; not Tieto's requirements set." Non-functional items not stated in the issue may be inferred; their text ends with " (inferred)". Items come from the issue only, never from the diff.
- Descriptions are 80–200 words (whitespace split of `text`). Every statement in them is true against the diff, except in `mp-2283`'s, which contains exactly one false statement. A false statement is a factual claim about what the code does or what the change includes that the diff contradicts or doesn't support.
- That false statement is contradiction plant `cp0`: answer key `data/sample/answer-key/cp0.json` with `plantId: "cp0"`, `changeId: "mp-2283"`, `kind: "contradiction"`, and `area`, `file`, `startLine`, `endLine` all null. `cp0` is not a separate change input. The anchored-vs-blind count uses `cp1`–`cp4`; S2's per-change comparison for `mp-2283` uses `cp0`. Planted-bug variants reuse their parent's description, false sentence included; their scoring ignores contradictions. `cp1` and `cp2` use false sentences different from `cp0`'s.
- The fork exists before T07 starts (kickoff creates it). `scripts/seed.ts`:
  - Loads `.env` with `process.loadEnvFile()` when present and reads `SAMPLE_REPO_DIR`.
  - Clones `https://github.com/miska-voutilainen/junction26-messagepack-csharp.git` there if the folder is missing. If the folder exists but its `origin` is another URL, it exits 1 with "SAMPLE_REPO_DIR is not a clone of the fork".
  - Fetches all branches and `refs/notes/countersign:refs/notes/countersign`, printing "No receipts yet" when that ref doesn't exist.
  - Checks each `data/sample/changes/*.json` `headSha` exists in the clone, then prints one line per change. Exit 0 on success, 1 on any failure.
- The unit test `scripts/sampleData.test.ts` validates every `data/sample/**/*.json` against `src/contracts/` and checks every change has its requirement. It needs no clone.

**T25 · idea page template.** Each page, under 600 words, written for an engineer on a product team who wasn't at the event:
- `# Idea <n> · <name>`, then one sentence: the idea.
- **The problem** it answers, in two to four sentences.
- **How it works**, as steps, with the concrete values we use (thresholds, rule ids, formats).
- **What we measured**, numbers with sample sizes, or "not measured yet" and why.
- **How to adopt it** in your own review product: what you need, what it costs, the smallest first step.
- **Limits and failure modes**, including the ones we saw (link `docs/lessons.md` entries).
- **Where it comes from**, when the idea borrows from another field, in one or two sentences with the source from `docs/research.md`: the trust ladder from continuous sampling plans (Dodge, 1943), the quote check from the admissibility of expert evidence (Daubert, 1993), blind-first from measured anchoring of reviewers on AI hints.
- **In the code**, links to the modules with the idea header (`.claude/rules/readability.md`) and to the screen that shows it.

**T09 · hunk count.** T09 reports the real hunk count of `mp-2283` and, if it isn't 8, updates the example numbers in sections 2–3 in its PR. Tests compute expectations from the data, never from the example numbers.

**T11 · levels.** `src/rules/ladder.ts` also exports `levelsFromReportCard(reportCard: ReportCard | null): Record<Area, LadderLevel>`. With no report card every area is `shadow` (no track record).

**T12 · pipeline details.**
- **Quote check:**
  - Normalise by replacing `\r\n` with `\n`, collapsing every whitespace run (newlines too) to one space, and trimming. The match is case-sensitive.
  - A citation passes when its normalised quote is a substring of the normalised text of lines `startLine`–`endLine` (joined with `\n`) of the cited side: the head file for `new`, the base file for `old`. A file missing on that side fails with "file not present on <side>".
  - A claim with at least one passing citation is `supported`, and its failing citations are removed. Its `hunkIds` shrink to the hunks a passing citation lies in (same side: new-side lines for `new`, old-side for `old`; not for `pathGlob` claims), so a hunk counts as covered only where the claim shows code. A claim with no passing citation (or none at all) becomes `unverified` with `citations: []`. Claims are never dropped. Each failing citation goes into `quoteCheck.failures` with the claim's id. Ids are assigned in output order before the check.
  - A3 findings with no passing citation are dropped (`dropped`, `hallucinations.findingsDropped`).
  - Units: `checked` and `passed` count citations, `downgraded` counts claims, `dropped` counts findings.
- **`pathGlob`:** an optional claim field `pathGlob: string | null` in A2's output. When it's set, the claim's hunks are every hunk whose file matches it, using Node's `path.matchesGlob` on repo-relative forward-slash paths, and `hunkIds` is ignored. The first citation's quote must also appear in the added lines of every expanded hunk; otherwise the claim becomes `unverified`.
- **Prompt context:**
  - Files go in with each line prefixed `<lineNo>| `, inside delimited blocks.
  - Size is estimated as characters / 4. Over 60,000 tokens, files are cut to ±80 lines around each hunk, marked `… (lines a–b omitted)`.
  - "Source files" means kind `source` and `test`. For `docs` only the hunks are sent; for `generated` only the paths.
- **A1 orientation text** (fixed, in `src/prompts/a1.ts`): "MessagePack-CSharp is a binary serializer for .NET. `src/MessagePack` is the runtime serializer (readers, writers, formatters, security options for untrusted data). `src/MessagePack.Annotations` holds the public attributes users put on their types. `src/MessagePack.SourceGenerator` is a Roslyn source generator that writes formatters and resolvers at compile time, plus analyzers (diagnostics MsgPack001 and up, documented in `doc/analyzers/`). Tests live in `tests/`, including generator snapshot tests whose expected outputs are files under `Resources`."
- **Output validation:** each A-call's zod schema refines that every `hunkId`, `requirementItemId`, `claimId` and `ruleId` it returns exists in the input. A1 must cover every requirement item exactly once; `likelyAreas` may be empty. A failed refinement is a validation failure, so it gets the one retry with the error.
- **A `--no-tests` review from T12:** `findings`, `refusals` and `retractions` are `[]`; `receiptDraft` is `{ checked: [], notChecked: [], residualRisk: { text: "", acceptedRefusalIds: [] } }`; `promptVersions` uses `"none"` for steps not run. T13 fills them.
- **Evidence and run fields:**
  - A Supported claim's `evidence` is one entry `{ kind: "quote-check", summary: "Quote checked against the code at <file>:<start>–<end>", testName: null, base: null, head: null }`.
  - `run.id` is `YYYYMMDDTHHMMSSZ` (UTC).
  - `usage.calls` counts API requests, retries included.
  - The summary line prints cost with two decimals and whole seconds.
  - A call over 120 s logs a warning; the 180 s timeout fails it (after the SDK retries).
- **CLI:** T12 creates `src/pipeline/cli.ts` with `run` (rejecting `--anchored` and `--run` with "available after T13"). It also adds `pnpm review check <changeId>`, which runs the eval cases of A1 and A2 on the recorded review:
  - A1 covers every requirement item.
  - For `mp-2283`, A1's text mentions a crash, throw or IndexOutOfRange, and mentions a resolver.
  - Every hunk of a non-docs file is listed by a claim.
  - It prints PASS or MISS per case and exits 0. A miss is a measurement for `docs/lessons.md`, not a test failure. T13 adds A3 and A4 cases.
- **The T12 PR** commits the code, the unit tests and the recorded `mp-2283` review with its recordings. T15 re-records all four at the end. T12 needs Q8 (the key) and T07's data.

**T18 · S2 core.**
- **Banner computation:** S2 computes the tier client-side as `route(review, applyEscapes(levelsFromReportCard(reportCard), escapes))`. The server render uses no escapes; after hydration the stored escapes apply. With no escapes this equals the recorded `review.routing` (the pipeline re-routes after `pnpm evals`).
- **Banner copy:**
  - Light: "Light · No hunk needs a read" and the reason line "No rule asked for more than Light".
  - Singular: "Read 1 of 1 hunk".
  - When `readMinutes` is 0, the "· ~<m> min" part is omitted.
  - "How is this computed?" is a button with a shadcn Tooltip (hover and focus; Esc closes).
- **Navigator:**
  - Items keep diff order inside each group. The label is the file's base name plus `:<newStart>`; the area is the file's area (`areaLabel`).
  - Each item is a button with the accessible name "<file>:<line>, <coverage label>".
  - All generated files form one item, "<n> generated snapshot files". It sits in the group of its worst hunk coverage (read, then supported, then verified) and shows its counts.
  - Each hunk header has `id="hunk-<id>"` and `tabIndex={-1}`. Clicking an item expands a collapsed generated group if needed, then focuses the header and scrolls it into view (smooth unless reduced motion).
- **Syntax highlighting:** languages by extension: `.cs` and `.tt` csharp, `.md` markdown, `.csproj`/`.props`/`.targets`/`.xml` xml, `.json` json, else plain text. Theme `github-dark-default` until T01's tokens name another. Highlighting happens in the server component per non-generated hunk; generated files render as plain text. The client components get serialisable token lines.
- **Shared visuals:** gutter colours come from T01's tokens `--coverage-verified`, `--coverage-supported` and `--coverage-read`. The area chip is T01's `AreaChip`.
- **Selected claim:** T18 owns `src/features/review/selection.tsx`, a context with `{ selectedClaimId: string | null, selectClaim(id: string | null): void }`. The diff viewer derives the highlighted lines from the selected claim's citations. T19's Story tab calls `selectClaim`.
- **Layout breakpoints:**
  - Three columns at ≥ 1024 px.
  - Below 1024 px, the tab layout with shadcn Tabs. T18 shows only "Hunks · Diff"; T19 adds the four sidebar tabs.
  - In the Hunks tab, clicking an item switches to Diff and focuses the hunk.
- **Routes and states:** T18 owns `src/app/changes/[id]/{page,loading,error,not-found}.tsx`. `generateStaticParams` comes from `loadChanges()`. If `loadChange(id)` is missing, the page calls `notFound()`.
- **E2E and performance:**
  - The banner assertion computes its expected text from `route()` and the fixture in the test.
  - The "< 2 s" acceptance is an e2e check that runs only when `E2E_BASE_URL` is set: `page.goto('/changes/mp-2283')` reaches `load` in under 2,000 ms.

**T01 · additions.** Besides the list in the table, T01 also delivers:
- the tokens `--coverage-verified`, `--coverage-supported`, `--coverage-read` and `--tier-light`, `--tier-focused`, `--tier-full`;
- the `AreaChip` component;
- the rendering theme name for shiki.

**T16 · eval details.**
- **Runs and output paths:**
  - **Planted bugs:** one blind run per plant (A1–A3; no A4, no A5) into `data/runs/<plantId>/review.json` (e.g. `data/runs/v01/review.json`). A re-run overwrites.
  - **Contradiction plants:** 3 blind runs (A1, A2, A4) and 3 anchored runs (A2 with the description first, A4) per plant. A3 and A5 are skipped in these runs.
    - `cp1`–`cp4` write to `data/runs/<plantId>/{blind,anchored}/<k>.json`.
    - `cp0`, the false statement in `mp-2283`'s own description, writes to `data/runs/mp-2283/{blind,anchored}/<k>.json`.
  - **Count:** all five plants feed the count (5 plants × 3 runs = 15 per mode). Moment 2's example copy reads "caught <a> of 15".
- **Mapping:** `cp1` and `cp2` belong to `mp-2283`, `cp3` to `mp-2234`, `cp4` to `mp-2129`. In answer keys and in `anchoredVsBlind.perPlant`, `changeId` is that Tieto change (`cp0` → `mp-2283`).
- **Planted-bug match:**
  - A finding matches when its kind is `defect` or `missing` and its `area` equals the answer key's (null never matches). It also needs a citation with `side: "new"` in the answer key's file whose `[startLine, endLine]` intersects `[keyStart − 3, keyEnd + 3]`; any one such citation is enough.
  - `findingId` is the first match in output order. `scope-creep` and `contradiction` findings never count.
  - `findingsOnPlants` counts `defect` and `missing` findings over the planted-bug runs: `total`, plus `matchedPlant` for the ones that match.
- **Contradiction match:**
  - A run catches the plant when a `contradiction` finding's `statement` matches the answer key's sentence. A match is equality after lowercasing and collapsing whitespace, or a token overlap of at least 0.8.
  - Token overlap: lowercase, split on non-alphanumerics, drop empties, then `|key tokens ∩ statement tokens| / |key tokens|`.
  - Contradiction findings are never dropped by the quote check (their failing citations are removed).
- **Hallucination counts:** summed over every review this `pnpm evals` run wrote plus the four `data/runs/mp-*/review.json`.
  - `quotesChecked` = Σ `quoteCheck.checked`
  - `quoteFailures` = Σ `quoteCheck.failures.length`
  - `findingsDropped` = Σ `quoteCheck.dropped`
  - `claimsRetracted` = Σ `retractions.length`
- **Routing:** recomputed for the four `mp-*` reviews only, when present. `routingSpread` covers those present (zeros when none).
- **Failed runs:** a run that fails (schema, refusal, timeout) is retried once. If it still fails, it counts as not caught and is printed as "run failed".
  - `pnpm evals` exits 0 when it wrote the report card, and 1 only when it couldn't.
  - Last line: "evals · <c>/<p> planted caught · anchored <a>/<t> · blind <b>/<t> · $<cost> · <min> min".
  - Runs go 4 at a time.
- **Score-only mode:** `pnpm evals --score-only` makes no model calls: it scores the runs already in `data/runs/` and writes the report card. `AI_MODE=replay` also works for full runs.
  - Scoring unit tests use hand-made `Review` objects.
  - Mixed reviewer versions across runs fail with "mixed reviewer versions: rerun all". `reviewer` in the report card comes from the runs.
- **Areas with no plants:** performance (0 plants) is still emitted: `planted: 0`, `plants: []`, `level: "shadow"`. `spotChecksClean` is always 0.
- **Lessons log:** whichever of T15 or T16 merges first creates `docs/lessons.md` with the heading "# Lessons log". Entries are "## <YYYY-MM-DD HH:mm> · <title>", then what happened and what we changed.
  - "No advantage" means `blind.caught <= anchored.caught`.
  - The go/no-go entry is a PR checklist item, not a test.

**T19 · sidebar details** (depends on T09 too, for the refusal policy).
- **Structure:**
  - T19 adds `src/features/review/sidebar/{Sidebar,StoryTab,BlindCheckTab,RefusedTab,ReceiptTab}.tsx`.
  - T18's `ReviewLayout` takes `navigator`, `diff`, and optional `sidebar` and `extraTabs` (`{ value, label, content }[]` for the below-1024 tab list) props. T19 passes them from the S2 page, where it also loads the report card and receipt.
  - The default sidebar tab is Story.
- **Policy:** `src/policy/refusals.ts` exports `refusalRules: { id: string; title: string; decider: string }[]` and `refusalPolicyVersion`. The empty copy uses both ("Policy v1 has 7 rules; …").
- **Story tab:**
  - **Item headings:** functional items first, then non-functional, in requirement order. An item with no claim shows "No claim covers this item."
  - **Claims:** claims with `requirementItemId: null` go under "Not traced to a requirement item", whatever their kind. A `refused` claim shows its badge and "Out of the AI's remit: see Refused."
  - **Touches:** each row reads "<symbol> · <file> · <note>".
  - **Empty copy:** "No claims were made." and "Nothing else touched."
- **Evidence:**
  - Each `differential-test` or `pr-test` entry is its own block titled by its `summary`.
  - Each side reads "Fails on the base commit", "Passes on the base commit" or "Error on the base commit" (and the same for "this change"); a null side reads "Not run".
  - Outputs sit in a collapsible block labelled "Test output".
- **Defects:**
  - Only `kind: "defect"` findings, with severity labels "High", "Medium" and "Low".
  - A citation reads "<file>:<start>–<end>", plus " (before)" for `side: "old"`.
- **Claim selection:** clicking the selected claim again deselects it. Below 1024 px, selecting a claim switches to the Diff tab. Old-side citations highlight old line numbers; T18's highlighted lines are keyed by file, side and line.
- **Blind check tab:**
  - **Contradictions:** "The code does: <detail>" for severity high (contradicted), "The code doesn't show this: <detail>" for medium (unsupported). A null `statement` shows only the detail.
  - **A1 items:** they show `expectedBehaviours` and the `likelyAreas` chips.
  - **Missing and Scope creep:** these render the `missing` and `scope-creep` findings (title, detail, citations), replacing the "derived" wording in section 3.
  - **Per-change comparison:** one row per `anchoredVsBlind.perPlant` entry whose `changeId` is this change: "<plantId>: given the description first caught <a> of <k> · blind-first caught <b> of <k>". `cp0` is labelled "This change's own description" and listed first. Without a report card: "No comparison recorded yet."
- **Refused tab:** hunk links are buttons labelled "<file name>:<newStart>" that act like navigator items.
- **Receipt tab:**
  - **Labels:** `by` reads "Tool", "AI, supported" and "Human". Accepted refusals read "<ruleId> · <rule title>".
  - **Dates:** "YYYY-MM-DD HH:mm UTC", formatted without locale.
  - **Verify line:** "Signature valid · diff unchanged" only when `verify.ok` and not stale. When `verify.ok` is false: "The signature check failed when this receipt was exported."
  - **Stale:** "Signed diff" and "Reviewed diff" hashes, each cut to 12 characters.
  - **Commands:** they use the change id. Copy buttons have `aria-label` "Copy command", with the toast "Copied" or "Couldn't copy. Select the text instead."
  - **Empty lists:** "Nothing listed."
- **Fixtures (T06 adds them):** `mp-2283` signed and valid, `mp-2234` unsigned, and a stale receipt for `mp-2129` (different `diffSha256`). The e2e asserts one heading and one fixture item per tab.

**T20 · receipt CLI details.**
- **draft:**
  - Reads `data/runs/<id>/review.json` only (no fixture fallback). A missing review is exit 1 "No recorded review for <id>".
  - **Field sources:**
    - `changeId`, `requirementId`, `reviewerVersion` (`review.reviewer.version`), `reviewRunId` (`review.run.id`) and the three lists come from the review.
    - `repo`, `commit` (`headSha`) and `baseCommit` come from the change input.
    - `baseTree`, `headTree` and `diffSha256` come from `computeDiffIdentity()`. They must equal `review.diff`, else exit 1 "Review is stale: re-run the pipeline".
  - **Owner:** `--owner <login>`, else `git config github.user` in the repo root, else exit 1 "Pass --owner <github-login>".
  - **Output:** the draft goes to `<repo root>/.scratch/receipts/<id>.json`. An existing draft is overwritten only with `--force`, else exit 1 "Draft exists: <path> (use --force)".
- **Exit codes:**
  - 0 ok.
  - 1 for input and environment errors: missing draft or key, invalid draft, owner not in `allowed_signers`, stale review, git or ssh-keygen missing.
  - 4 for "A receipt already exists for <headSha> (receipts are append-only)".
  - `verify` keeps 0/1/2/3 as in section 5.
- **Payload and note format:**
  - The payload is the canonical JSON: UTF-8, object keys sorted recursively by code-unit order, 2-space indent, LF line endings and exactly one trailing newline.
  - The note is the payload followed directly by the armored signature, CRLF normalised to LF, with no extra blank line. `verify` splits at the line `-----BEGIN SSH SIGNATURE-----`; everything before it is the payload, byte for byte.
- **Signing:**
  - In a `mkdtemp` folder: write the payload, run `ssh-keygen -Y sign -f <key> -n countersign-receipt <file>` with stdin closed, read `<file>.sig`, then delete the folder. `~` resolves with `os.homedir()`.
  - A key that needs a passphrase fails with exit 1 "Use an unencrypted demo key (ssh-keygen -t ed25519 -N \"\")".
  - `sign` does not push. It prints "Signed. Verify: pnpm countersign verify <id>" and "Publish: git -C <SAMPLE_REPO_DIR> push origin refs/notes/countersign".
- **verify:**
  - Finds the newest receipt for the change id among all notes in `refs/notes/countersign` (`git notes --ref=countersign list`).
  - Checks the signature first: exit 3 on failure or an unparseable note.
  - Then `receipt.commit === ChangeInput.headSha` and the three identity values recomputed for `baseSha..headSha`. Any mismatch is exit 1, "Stale: the diff changed since signing".
  - Test for stale: sign on commit A, then point the change input's `headSha` at a new commit B.
  - The printed "Good …" line is ssh-keygen's stdout.
- **Testability:**
  - Functions take `{ repoDir, dataDir, allowedSignersPath, sshKeygenPath }`. The CLI fills them from the env and defaults; `COUNTERSIGN_DATA_DIR` and `COUNTERSIGN_ALLOWED_SIGNERS` override them for tests.
  - Modules: `src/receipt/{cli,draft,sign,verify,exportRecord,canonicalJson,sshKeygen,notes}.ts`. Args are parsed with `node:util` `parseArgs`.
  - Temp repos in tests set `user.name` and `user.email` with `-c`. Tests build a minimal `Review` in a temp data folder.
- **export:** writes only after verify exits 0; otherwise it exits with verify's code and writes nothing.
  - `verify.command` is "pnpm countersign verify <id>" and `verify.output` is the lines verify printed.
  - It overwrites the file, written with 2-space indent and a trailing newline.
- **allowed_signers:** T20 creates `data/sample/allowed_signers` with one comment line describing the format. T23 adds Miska's key.

## 10. Open questions

- **Q1** Tieto's requirements set and standards document are still "TBA". We derive requirements from the issues (T07) and write our own checklists (T09). If Tieto's arrive, swap them in and rerun T15/T16. Owner: Miska (Tieto contact, interim) · by: Sat 12:00 · blocks: nothing until they arrive.
- **Q4** Visual direction: Miska's Claude Design wireframe, link posted on T01. Elias reviews the design artifact first and posts issues and development ideas on T01's issue; Miska revises the artifact and hands the final design to T01. Owner: Miska · by: Fri 23:30 · blocks: T01 (then T17–T19, T21). Pitch owner: interim Miska, final decision by Sat 18:00.
- **Q6** Does Tieto expect the concept card in a specific format (PDF, slide or page)? Owner: Miska · by: Sat 12:00 · blocks: nothing (T22 writes Markdown either way).
- **Q7** .NET go/no-go for A5: `dotnet test tests/MessagePack.SourceGenerator.Tests` on the pipeline laptop. Owner: Miska · by: Sat 01:00 · blocks: T14.
- **Q8** Anthropic API key from the partner credits in `.env` with a spending limit. Owner: Miska · by: Sat 00:00 · blocks: T10's live smoke call, T12–T16.

## Ready checklist

<!-- Status becomes "ready" only when every box is ticked. -->

- [x] Every demo step has testable acceptance and names its screens.
- [x] Every screen has its layout at both widths, all four states and exact copy (the visual design itself comes from Miska's wireframe, T01).
- [x] Every contract has field names, types and errors; producer and consumer lanes are named.
- [x] Every AI call has a model, output schema, latency budget, fallback and eval cases.
- [x] Every task has one lane, its dependencies, a demo step and acceptance criteria a test can check.
- [x] Nothing a task depends on says "TBD", "etc." or "something like" (Tieto's own requirements set is "TBA" upstream; no task waits for it).
- [x] Cold-read check: two rounds (T07, T12, T18; then T16, T19, T20) raised about 85 questions, all answered in sections 5, 6 and 9.1; a third confirming round was not run.
- [x] Open questions empty or owned with deadlines.
