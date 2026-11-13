# Decisions

<!-- One entry per real choice: stack, model, data source, design direction, a feature cut. Newest first. Kept short. -->

## 2026-11-14 · The UI follows the design canvas; S4 receipt and S5 dashboard added; S3 moves to the app lane

- **Context:** The final design canvas draws a product connected to GitHub and CI, with sample people, ids and 30 days of metrics, plus a full receipt page, a dashboard, a grouped nav and a command menu that the spec didn't have.
- **Decision:** `docs/design/ui-plan.md` translates the canvas into this product: same layouts, states and motion over our recorded data only. Controls with no backend are cut (request changes, ask a person, approve/reject, send to desktop, time ranges, editable receipt fields). Two routes added: `/changes/[id]/receipt` (S4) and `/dashboard` (S5). `motion` and `cmdk` are added for shared-layout indicators and the command list. S3's components move from the evidence lane to the app lane, so one session builds every screen; the evidence lane keeps the data and the CLIs.
- **Why:** The canvas gives the product a finished look; showing it with invented people or dead buttons would break the "nothing fake on the demo path" rule judges will test.
- **Rejected:** Building S1–S3 only (loses the receipt page, the strongest visual for idea 7). Keeping the cut controls as browser-only simulations (more surface that says nothing true).
- **PR:** –

## 2026-11-14 · Temporary access gate until the submission

- **Context:** The site is public on a custom domain before the final submission on Sun 15.11, and should open only for people we give a code.
- **Decision:** One code on every page, checked by the Next proxy against an httpOnly cookie that holds the sha256 of the code. An empty `ACCESS_CODE` turns the gate off. It lives in one folder (`src/features/access-gate/`) plus two entry files (`src/proxy.ts`, `src/app/unlock/`), so removing it takes minutes.
- **Why:** A short code is enough to keep casual visitors out; what matters is that it is clearly temporary and easy to delete.
- **Rejected:** Vercel Password Protection (a paid-plan feature that treats custom domains differently). Basic Auth (the browser prompt would be the first thing a judge sees).
- **PR:** #38

## 2026-11-14 · App lane moves to Miska for the UI build

- **Context:** The final design is a finished canvas with every screen, state and the shared components drawn. Building it is one connected job (tokens, shell, five screens) that needs judgment on layout and motion.
- **Decision:** Miska (`miska-voutilainen`, Max) owns the app lane and builds the UI from the canvas, in phases. Elias takes over UI changes once the design is built; polishing the UI happens in the last hours.
- **Why:** One Max session holding the whole design builds a consistent UI faster than handing a large design across machines.
- **Rejected:** Keeping the lane with Elias and handing over the canvas (more handoffs for one connected job).
- **PR:** #36

## 2026-11-13 22:10 · Lanes: engine (Miska), app (Elias), evidence (Veijo)

- **Context:** Three people: Miska on Claude Max 5x, Elias and Veijo on Pro (Sonnet at medium effort). The critical path of the demo is the real pipeline run on Tieto's change; the planted bugs must be written by someone who never sees the reviewer's prompts.
- **Decision:** **engine** (Miska): pipeline A1–A5, routing rules, trust ladder, eval and report card, AI client and prompts, policy, CI and the harness. It is the heaviest lane, because every number on screen depends on it and its prompts need judgment. **app** (Elias): design system, S1, S2, data loaders, fixtures, the simulated-escape store, e2e. **evidence** (Veijo): the fork and sample data, planted bugs and contradiction plants written blind, the receipt CLI, S3, the quality hooks and the concept card; it is the lightest lane and the one that keeps the measurement honest.
- **Why:** Pro lanes get well-specified tasks with no open design questions; the engine lane gets the judgment calls and can add a second Sonnet seat. Putting the plants in a lane with no prompt files keeps principle 9 true by construction.
- **Rejected:** Frontend/backend/AI lanes (would put the planted-bug writer next to the prompts). Giving the routing rules to a Pro lane (they're the concept's core; the engine lane owns them and the app imports them).
- **PR:** –

## 2026-11-13 22:05 · Data: Tieto's MessagePack-CSharp repo, demo change mp-2283, areas generator/analyzer/security/performance

- **Context:** Tieto published its code input during kickoff: `te-industry-tech-office/junction26-messagepack-csharp` with four agent-written branches (issues #2283, #2234, #2129, #2297). It's a C# source generator and analyzer, not a web app. The requirements set and standards are still "TBA". Tieto's judging weights: Clarity 30%, Practicality 25%, Measurement 25%, Evidence 20%.
- **Decision:** We fork the repo and run on all four changes. The demo change is `mp-2283` (#2283, a crash fix, about 200 lines, 4 files; the issue has a concrete repro). Requirements are derived from the issue text and labelled so; author PR descriptions are written by the evidence lane and labelled synthetic. Review areas for this repo are generator, analyzer, security and performance. The synthetic sample app from the fallback plan is dropped.
- **Why:** Real agent-written changes on a real repo beat anything synthetic for Implementation and Practicality. #2283 matches the challenge's own "200 lines on a Friday" story, and its silent dropping of diagnostics is a real behaviour decision for the AI to refuse.
- **Rejected:** #2129 as the demo (1,043 lines, about 40 hunks: "read only this" is less striking). Frontend/backend areas (the sample has no frontend; areas are per-repo configuration, which the concept card explains).
- **PR:** –

## 2026-11-13 22:00 · Critic round 2 accepted: differential "Verified", no server, anchored-vs-blind as a count

- **Context:** The kickoff product-critic pass found that a test the AI writes from the diff and that passes on the diff proves nothing, that "record escape" on a recorded-output site hides a backend, and that one anchored-vs-blind pair is an anecdote.
- **Decision:** (1) A5 writes its test from the requirement and A1's expectation, not the diff, and a test counts as evidence only if it fails on the base commit and passes on the change (the PR's own tests are checked the same way). Go/no-go for .NET on the laptop Sat 01:00. (2) No server: a static site over recorded JSON; the routing rules run in the browser, so a simulated escape re-routes live; `countersign sign` writes the note and `countersign export` writes JSON for the site; at the judging table the app runs locally. (3) Veijo writes 4 contradiction plants blind; each runs anchored and blind-first 3 times; go/no-go Sat 12:00.
- **Why:** Differential tests make "Verified" non-circular, which is the strongest answer to "what would make you not trust your own output?". No server saves about 4–6 hours and removes the live-demo risk. A count is evidence; one pair is an anecdote.
- **Rejected (not chosen by Miska this round):** renaming the Blind check tab to Findings, a cost-per-change line, and fixed fixture milestones as features. Defects found are shown in the Story tab instead.
- **PR:** –

## 2026-11-13 21:55 · Model: Claude Opus 5.5 through the official Anthropic SDK, behind our own client

- **Context:** Q2: the Junction partner credits cover Anthropic. The concept must stay vendor-neutral (vendor selection is out of scope).
- **Decision:** `claude-opus-5-5`, effort `high`, structured outputs via `@anthropic-ai/sdk` `messages.parse` with zod, server-side refusal fallback on, no temperature (removed on this model). All five calls go through `src/ai/client.ts`, which is the only file that knows the provider; recorded responses make every run replayable.
- **Why:** Opus is the strongest reviewer available and runs offline, so latency doesn't matter; the official SDK supports structured outputs and effort directly. Neutrality lives in our interface, not in a library.
- **Rejected:** Vercel AI SDK v7 (an extra abstraction over the same calls; its `generateObject` is deprecated). Sonnet 5.5 for the eval runs (the report card must measure the same reviewer the demo shows).
- **PR:** –

## 2026-11-13 21:50 · Stack: Next.js 16 static site on Vercel plus a TypeScript pipeline in the same repo

- **Context:** The site serves recorded pipeline output; the pipeline needs git, .NET and model calls on a laptop. Vercel is already connected. Kickoff criteria: partner SDK fit, a fast reliable demo, preview deploys, how well agents build it, cost.
- **Decision:** Next.js 16.4 App Router with static generation, React 19, TypeScript strict, Tailwind 4, shadcn/ui (radix), pnpm 12, Vitest and Playwright; the pipeline and CLIs are TypeScript run with tsx; one package, one lockfile. `vercel.json` sets the Next.js preset.
- **Why:** One language for the pipeline, the routing rules and the UI, so `route()` runs in both and the zod contracts are shared. Next.js is the best-documented stack for agents and Vercel's native framework; pages are static, so the first screen is fast on venue Wi-Fi.
- **Rejected:** Vite + React Router SPA (works, but fewer conventions and a client-route rewrite on Vercel). A Python pipeline with a Next.js frontend (two languages and duplicated contracts). C#/.NET for the pipeline to match the sample (heavier for agents, and the app would still be TypeScript).
- **PR:** –

## 2026-11-13 21:45 · Design: Miska designs the screens in Claude Design

- **Context:** Q4: visual direction.
- **Decision:** Miska designs the wireframe in Claude Design and posts the link on T01 by about 23:30; T01 turns it into tokens and the shell. Until then the screens use shadcn defaults. Pitch owner: Miska for now, decided by Sat 18:00.
- **PR:** –

<!-- Pre-kickoff concept decisions, 2026-11-13. -->

## 2026-11-13 22:00 · The UI is a Graphite-style review app (inbox, review page, report card); signing happens on the owner's machine

- **Context:** The team decided in person on a website UI like Graphite. The spec also said signing works on the deployed site, which would mean a server signs with the owner's key.
- **Decision:**
  - **Three screens:**
    - **S1 · Inbox:** every change with its tier, reading estimate and receipt status; it doubles as the routing spread.
    - **S2 · Review:** a hunk navigator, a diff viewer with coverage colours, and a sidebar with Story, Blind check, Refused and Receipt tabs.
    - **S3 · Reviewer report card:** the trust ladder, planted-bug results and the record-escape button.
  - **Signing:** the owner runs a one-line sign command on their own machine with their own SSH key. The site shows the signed receipt and the verify result.
- **Why:**
  - A familiar review layout means judges get it in seconds.
  - The diff at the centre with coverage colours makes "read only this" visible.
  - The inbox shows routing at scale for free.
  - Keeping keys on the owner's machine is the only design consistent with "the AI advises, a human signs".
- **Rejected:**
  - A single long review page (doesn't look like a real review tool, and hides scale).
  - Two-way GitHub sync like Graphite itself (product scope, and a live-demo risk).
  - Signing on the server (a server holding human keys breaks accountability).
- **PR:** –

## 2026-11-13 21:00 · Pre-kickoff critique: three demo moments, a reviewer measurement that's hard to attack, Tieto deliverables first

- **Context:** A product-critic pass on the draft found: six demo steps don't fit a 2-minute video; "Prove it" live is the most likely step to fail; the planted-bug rates are circular (we wrote both the bugs and the prompts) and the sample is tiny; blind-first review looks like mere prompt order unless we show it working; we used only one of Tieto's sample changes; and the lessons log and concept card were under-weighted.
- **Decision:**
  1. **Three moments:** "Read only this" (story, routing, and what covers each hunk), "It caught the author out" (blind check and refusals), "Signed and measured" (receipt and report card). Everything shown comes from recorded real runs; no live model calls in the demo.
  2. **"Prove it" runs offline inside the pipeline** (A5): Supported claims are tested while the review is computed. The live button becomes a stretch goal.
  3. **The measurement is hard to attack:**
     - the planted bugs are written blind by Veijo, with an answer key;
     - every rate shows its sample size;
     - the anchored-vs-blind runs are shown side by side;
     - the router runs over all of Tieto's sample changes to show the routing spread.
  4. **Tieto deliverables are first-class tasks:** `docs/concept-card.md`, and `docs/lessons.md` logged from the first pipeline run.
  5. **Theme line** in the pitch: idealism and caution, with an accountable human signing.
- **Why:** Cutting the live sandbox saves about 4–6 hours and removes the riskiest step. The measurement changes cost about 3–4 hours and answer "what would make you not trust your own output?" with evidence an engineer can't wave away.
- **Rejected:** Keeping six steps (doesn't fit 2 minutes). Live model calls in the demo (venue network and latency risk). Planted bugs written by the prompt author (circular).
- **PR:** –

## 2026-11-13 18:40 · From Lightfoot, adopt its trust ladder and shadow mode as concepts; reuse no code

- **Context:** Miska's open-source tool Lightfoot (an agent-session proxy) already earns trust in steps: shadow mode measures before anything is switched on, proof levels per agent run from `wired` to `certified`, every rewrite is validated or falls back to the original, and `why` and `stats` explain what was cut. We weighed what transfers to Tieto's challenge.
- **Decision:**
  - **Adopt: the proof ladder per area.** The trust ledger shows named levels instead of bare numbers. **Shadow** (the reviewer runs, the human reads everything), then **Calibrated** (the canary catch rate is at or above the threshold, so the area may route Focused), then **Trusted** (calibrated, plus N clean spot checks and no escapes, so the area may route Light). An escape drops the area one level. Every level states the evidence that earned it.
  - **Adopt: shadow mode for new areas.** An area or reviewer version with no track record starts in Shadow. The AI's output is shown but changes no tier. The demo shows one area (performance) still in Shadow, with what it needs to move up.
  - **Already covered:** validate-or-fall-back is our quote check, "nothing is lost" is the click-through to dropped and downgraded findings, and `stats` is the report card.
  - **Reject: code reuse.** Event rule (confirmed 2026-11-13): past experience may be used, but no project may be copied and presented as made here. Patterns and lessons carry over; all code is written at the event.
  - **Reject: provenance from the agent session** (reading the authoring agent's traffic). It's distinctive, but Tieto's samples come without session logs, so it would need a synthetic one. It goes in the concept card under "next steps" only.
  - **Pitch:** one line saying the ladder pattern comes from a tool we've already shipped, as credibility for "how would this scale", not as a feature.
- **Why:** The ladder turns "trust is earned per area" into something a person can see and read at a glance, which suits a concept card better than thresholds. Both ideas reuse the trust-ledger data, add about one state and one badge each, and answer "who decides when the AI is trusted more": the evidence does, and humans set the thresholds.
- **Rejected:** Building on Lightfoot itself, which is pre-work, off-brief (cost) and outside vendor-neutral scope. Bare numeric thresholds alone, which are harder to explain in 10 seconds.
- **PR:** –

## 2026-11-13 18:10 · Differentiators: a canary-calibrated reviewer, a blind-first review and a receipt that lives in git

- **Context:** The baseline (change story, evidence, risk tiers, sign-off) is nearly dictated by the challenge text, so most teams, many building with AI, will land on something similar. We need to stand out while staying in scope (concept plus reference, no product, no training, no vendor selection) and staying buildable in the time we have.
- **Decision:** Keep the baseline thin and polished, and build three signature mechanisms:
  1. **Canary-calibrated reviewer.** Every reviewer version is run on synthetic copies of the sample change with known bugs planted in them (about 8–12, spread over frontend, backend and security). The catch rate per area is measured and shown as a report card. The trust ledger starts from these measured rates, not from assumptions. An area below its threshold can never be Light, whatever the change looks like. This answers "What would make you not trust your own output?" with a number we measured, and catching your own reviewer's misses is "spot-check the AI" done automatically.
  2. **Blind-first review.** Before the reviewer sees the diff or the authoring agent's PR description, it writes down what it expects the change to do from the requirement ID alone. Only then does it read the diff and derive the story itself. Three comparisons become findings: expected but missing, present but not required (scope creep), and the author agent's description against what the code actually does ("the PR says X; the code does Y"). The reviewer is never anchored on the author's story, which is exactly where AI-written PRs mislead.
  3. **The receipt lives in git.** The signed receipt is stored as a git note on the reviewed commit, signed with the owner's SSH key, and anyone can verify it with one command. Accountability travels with the code, with no SaaS database to trust. A new commit leaves the receipt pointing at the old hash, visibly.

  Small extra: a **"Prove it"** button on any Supported claim. The reviewer must produce an executable check (a test it writes and runs). The claim is upgraded to Verified, or retracted on screen and counted.
- **Why:** Each one is a few hundred lines and reuses the same pipeline. Each answers a judges' question directly, and each turns a principle into something shown live, not asserted on a slide.
- **Rejected:** Multi-agent debate between reviewers (expensive and hard to explain). Mutation testing of the test suite (heavier tooling, and canaries cover the reviewer, which matters more here). Learned risk models (training is out of scope). A VS Code or GitHub-native product (product scope).
- **PR:** –

## 2026-11-13 18:00 · The reference implementation is a review page plus a pipeline over a real git repo, not a GitHub bot

- **Context:** The challenge wants a live walkthrough that shows where the trust comes from, on one sample change. It also says the result is not a product.
- **Decision:** A small sample repository holds Tieto's sample change as a real branch. A review pipeline runs on that diff, executing tests and scanners and making model calls. A web page shows the result as a PR review: the change story, evidence, routing and the sign-off receipt. Posting the summary as a GitHub PR comment is a stretch goal.
- **Why:** We control the full walkthrough and it works offline with recorded responses. Every number on screen still comes from a real run.
- **Rejected:** A GitHub App only, because of setup and auth risk live, and because PR comments can't show a receipt or a trust ledger well. Slides only, because that isn't a reference implementation.
- **PR:** –

## 2026-11-13 17:55 · Only synthetic or Tieto-cleared data

- **Context:** The challenge requires synthetic or cleared sample data.
- **Decision:** The demo uses Tieto's sample changes and requirements set. Any extra changes we need (a seeded "escape", a low-risk change) are synthetic and labelled synthetic in the UI.
- **Why:** This is a challenge rule, and synthetic changes let us stage failure modes on purpose.
- **Rejected:** Real open-source PRs, because their licence and clearance are unclear and they carry no requirement IDs.
- **PR:** –

## 2026-11-13 17:50 · The deliverable is a signed receipt bound to the diff, not an approval button

- **Context:** "What the owner signs" lists three things: what was checked and by whom, what wasn't checked and why, and the residual risk accepted. An unowned merge is not accepted.
- **Decision:** Merge needs a **receipt**, signed by a named engineer. It has three sections: checked (each item names the check as tool, AI-supported or human), not checked (each item names a reason), and residual risk accepted (free text plus the refused items the owner took on). The receipt holds the diff's hash. Any new commit voids it. Receipts are append-only.
- **Why:** This makes accountability concrete and auditable. The AI can draft the receipt but can never sign it.
- **Rejected:** An "Approve" button with an AI summary, because that is "the AI said it was fine". A receipt with no diff hash can be reused after a change.
- **PR:** –

## 2026-11-13 17:45 · Humans spot-check the AI, and trust per area is earned and withdrawn

- **Context:** "Trust is earned per area, from track record, and withdrawn after escapes." "Humans spot-check the AI reviewer, and track what it misses." Vendors say to measure outcomes, not activity.
- **Decision:** A **trust ledger** per area (frontend, backend, security, data) records three things: changes reviewed, spot-check misses (a human found what the AI missed) and escapes (a revert or incident traced back to a reviewed change). A fixed share of Light changes goes to a full read as a spot check. One escape in an area drops that area one tier until a set number of clean spot checks restore it. The thresholds are written in config and shown on screen.
- **Why:** It is the answer to "how would this scale?" and "what would make you not trust your own output?". Trust is a record, not a feeling.
- **Rejected:** A global trust level, because one weak area would hide inside a good average.
- **PR:** –

## 2026-11-13 17:40 · Review depth is routed by explainable rules, not a model's risk score

- **Context:** "A risk score nobody can explain" is explicitly not accepted. "Depth of human review follows risk." Model training is out of scope.
- **Decision:** Every change gets one of three **tiers**: Light (the owner reads the story and evidence), Focused (the owner reads the named hunks) or Full (the owner reads everything). Rules over visible signals pick the tier: paths touched (auth, payments, crypto, PII, migrations, infra are always Focused or higher), dependencies added, public API or schema changes, size, test coverage of the touched lines, the area's trust ledger, and whatever the AI refused to decide. Each rule that fires is shown as one line. The tier is the highest any rule asks for.
- **Why:** The owner can see and argue with every reason. It is deterministic, cheap and testable.
- **Rejected:** A model-predicted risk score, which can't be explained and needs training. Leaving the tier to the AI alone puts the model in charge of its own oversight.
- **PR:** –

## 2026-11-13 17:35 · A finding is posted only if its evidence checks out mechanically

- **Context:** "Verify findings before posting." Hallucination is one of the five things we have to balance.
- **Decision:** The model must back each finding or claim with a file, a line range and an exact quote. Code checks that the quote exists at those lines in the diff or the repo. A behaviour claim also needs a test that ran (existing, or generated and executed). Anything that fails these checks is not posted. It is downgraded to "unverified" or dropped, and every drop is counted in the lessons log as a caught hallucination.
- **Why:** Hallucinations get caught by code, not by trusting the model, and the drop count becomes a number we can show.
- **Rejected:** A second model voting on findings. It costs more, two models can share the same blind spot, and it's at best a later add-on for claims that can't be tested.
- **PR:** –

## 2026-11-13 17:30 · Confidence comes from the kind of evidence, not from the model's self-report

- **Context:** "Confidence without evidence" is not accepted. The intro asks how sure the AI is about each part.
- **Decision:** Every claim gets one of four **evidence levels**, ranked: **Verified** (a tool or an executed test reproduces it, with output attached), **Supported** (the model's reading, with citations that pass the mechanical check), **Unverified** (no checkable evidence, shown greyed with "needs a human") and **Refused** (out of the AI's remit, see below). Model self-reported confidence is never shown.
- **Why:** A person can check every level by clicking through to the evidence. The level says what kind of check backs the claim, not how the model feels about it.
- **Rejected:** Percentage confidence from the model, which is uncalibrated and can't be checked.
- **PR:** –

## 2026-11-13 17:25 · The AI refuses to decide a fixed, written list of things

- **Context:** "Show what the AI found, what it refused to decide, and why."
- **Decision:** The reviewer may flag these but never decides them. It marks them Refused, with the reason and who should decide:
  1. Whether the requirement itself is right (business intent belongs to the product owner).
  2. Security design choices: authn/authz model, crypto, secret handling, trust boundaries (security owner).
  3. Data retention, PII and legal handling.
  4. Irreversible operations: destructive migrations, data deletion.
  5. New third-party dependencies and licences.
  6. Anything it can't trace to the requirement ID.

  The list is written as a versioned policy that both the prompt and the UI read.
- **Why:** Refusals make the AI's limits visible and push the change to Focused or Full. A refusal is an outcome we show proudly, not a failure.
- **Rejected:** Letting the model decide case by case what to refuse. That is inconsistent and can't be audited.
- **PR:** –

## 2026-11-13 17:20 · The unit of review is a requirement-traced claim, not a line

- **Context:** "Is line-by-line review still the right way?" The sample changes come with requirement IDs. The intro talks about "checking a story".
- **Decision:** The AI turns the diff into a **change story**: what it does, why (the requirement ID and its intent, functional and non-functional items), and what else it touches (callers, schemas, configs found with full repo context). Every requirement item maps to one or more claims, each with an evidence level and the hunks behind it. Requirement items with no claim, and hunks with no requirement, are flagged as findings: missing behaviour and scope creep.
- **Why:** The owner checks a story against the requirement. Hunks not covered by verified evidence are exactly what they have to read, so "accept without a full read" becomes concrete.
- **Rejected:** Inline line comments as the main output. They are noisy, don't trace to anything and still force a full read.
- **PR:** –

## 2026-11-13 17:15 · Direction: an evidence-first generalist reviewer with an explainable risk router (both suggested directions, combined)

- **Context:** The challenge offers a generalist reviewer or a classifier, and says to keep a named human accountable either way.
- **Decision:** **Countersign** (working name): the AI reviews and drafts, and a named human countersigns. A single generalist reviewer covers frontend, backend, security and performance through per-area checklists taken from Tieto's standards. Its output feeds a rule-based router that decides how much the human has to read.
- **Why:** A classifier alone says "needs review" but gives the owner nothing to sign. A reviewer alone doesn't tell people where to spend their attention. Together they answer the challenge question (keep pace by routing, stay accountable through the receipt).
- **Rejected:** Pure generalist (no depth routing, so it doesn't scale). Pure classifier (no evidence, so it can't be owned). Separate specialist agents per area, which are more moving parts for the same demo and leave the generalist question unanswered.
- **PR:** –

## 2026-11-13 17:10 · Challenge: Tieto, "Earned Trust in AI Code"

- **Context:** The team picked the challenge. Full text in [challenge.md](challenge.md).
- **Decision:** Build for Tieto's challenge 351.
- **Why:** The team chose it.
- **Rejected:** –
- **PR:** –
