# Countersign

**Eight ideas for reviewing agent-written code, each shown working on Tieto's real repository.**

AI reviews. A named human countersigns, on evidence they can check.

Agent-written pull requests now outnumber human ones, and line-by-line review doesn't scale. Countersign is a set of ideas for how AI review can keep pace while a named person stays accountable. Each idea stands on its own, so a product team can adopt one without the others. The app is the reference implementation: it proves the ideas on agent-written changes to Tieto's sample repository.

## The ideas

1. **[Planted-bug calibration and a trust ladder per area](docs/ideas/trust-ladder.md).** We test the AI reviewer on bugs planted by someone who never sees its prompts. Its catch rate in each area decides how much a human reads, and an escaped bug drops that area a level.
2. **[Blind-first review](docs/ideas/blind-first.md).** The reviewer writes down what the requirement should produce before it reads the code or the author's description. We measure how much reading the description first costs.
3. **[The hunk coverage map](docs/ideas/coverage-map.md).** "Read 2 of 8 hunks, and here is what covers the other 6", from rules a person can read, with no AI in the routing.
4. **[A mechanical quote check](docs/ideas/quote-check.md).** Every AI claim cites the code. A citation that doesn't match the code is never shown, and each one caught counts as a hallucination.
5. **[A written refusal policy](docs/ideas/refusal-policy.md).** A versioned list of what the AI never decides, each item naming who decides instead.
6. **[Evidence levels instead of confidence scores](docs/ideas/evidence-levels.md).** A claim is Verified, Supported, Unverified or Refused by what backs it; the model's own confidence is never shown.
7. **[The signed receipt in git](docs/ideas/signed-receipt.md).** The owner signs what was checked, what wasn't and the risk they accept, tied to the exact diff, so the receipt can gate the merge.
8. **[The author never checks its own work](docs/ideas/separation-of-duties.md).** An agent's own test makes a claim Supported at most, the AI drafts the receipt but only a named person signs it, and whoever plants the bugs never sees the prompts.

Each idea has its own page in [`docs/ideas/`](docs/ideas/): the problem, how it works, what we measured, how to adopt it, its limits and where it lives in the code.

## See them working

**Live:** https://countersign-junction.com, the review of one agent-written change (MP-2283), with each idea labelled where it appears.

Built at Junction 2026 for Tieto's challenge, **Earned Trust in AI Code** ([challenge text](docs/challenge.md)). What we build: [docs/spec.md](docs/spec.md). Why: [docs/decisions.md](docs/decisions.md).

<!-- demo-prep turns this part into the judges' README at the freeze: a GIF or screenshot, the live URL, what it does, how it uses the partner's tech, the architecture, what's real vs mocked, how to run it locally, and how we used AI tools. -->

<!-- demo-prep keeps the next section word for word: it is the team's declaration of what existed before the event. -->

## Prepared before the event

Junction 2026 started on Fri 13.11.2026 at 19:30 EET. The rules let teams bring Markdown files but no code. This is everything that existed before 19:30, and when work started. Times are EET, from GitHub and `git log`; check them with `git log --reverse` and `gh repo view --json createdAt`.

| Time (Fri 13.11) | What happened                                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19:12            | Empty repository created on GitHub                                                                                                                                                                                                                                                       |
| 19:13            | Issue #1 (the agent sync log) opened with a one-line description; first comment at 20:49                                                                                                                                                                                                 |
| 19:30            | Event starts                                                                                                                                                                                                                                                                             |
| 19:40            | First commit `bac8ef7`, `chore: add agent environment`: 38 Markdown files written before the event (rules, skills, subagent definitions, templates, setup guide) and two plain-text config files, `.gitignore` (9 ignore patterns) and `.gitattributes` (one line, `* text=auto eol=lf`) |
| 22:03            | First code: the skeleton, PR #26                                                                                                                                                                                                                                                         |

The Markdown is project-agnostic. It never names Countersign, Tieto or the challenge, and `docs/spec.md` in that commit is an empty template. We picked the challenge, the idea, the name and the spec at the event. Every line of code, including the hooks, settings and CI that the Markdown describes, was written during the event by the team and its agents. Nothing from other projects is in this repository; tools such as Lightfoot and Graphify run on our laptops and are not committed.

## How to run

```bash
git clone https://github.com/miska-voutilainen/junction-2026.git
cd junction-2026
pnpm install --frozen-lockfile
cp .env.example .env   # the app runs without values; see development.md
pnpm dev               # http://localhost:3000
```

Needs Node 24 and pnpm. The site reads the committed files under `data/`. The receipt CLI is built, and so are review steps A1 to A5 with the quote check; the fork clone (`pnpm seed`), the .NET SDK, every command and the env vars are in [docs/development.md](docs/development.md).

## Agent environment

A project-agnostic AI-agent environment for a 48-hour hackathon team that ships a **polished, well-documented product from a clean repository**, with several people each running their own agent in parallel. Built for Claude Code; other assistants follow it through `AGENTS.md`.

Everything here is Markdown. Rules, skills and subagents are in place. Hooks, settings, the lane map and CI are **specs** the agent writes as code: the safety core (settings, lane map, guard, briefing) at kickoff, the rest as the first **foundation tasks** that the lanes build with "go". The project, spec, stack, file tree and lanes are **decided at kickoff** from the project info; after that, each person says **"go"** and their agent works through its lane's tasks.

### Principles

1. **The spec decides, "go" builds.** `docs/spec.md` is written so precisely at kickoff that agents build from it without questions; they ask only where it conflicts. Cut scope, never quality.
2. **Lanes, not collisions.** Every code path belongs to one lane; each lane works its own task issues; requests go through handoff issues; every session ends with a summary on the agent sync log (issue #1).
3. **Quality where it's cheapest.** Hooks on every edit and turn; reviews scaled to each PR's risk (tiers S/M/L); a fast CI that only confirms.
4. **The main session decides, subagents do.** Mechanical and well-specified work goes to cheaper models.
5. **The repo is part of the product.** Docs in the same PR as the code, well-written PRs, a file tree that reads like a table of contents.

### The harness

| When                | What                                                                                         | Where                           |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------- |
| Session start       | lane, handoffs, my task queue, overlapping PRs, new sync-log summaries, the next task        | `session-brief` hook            |
| Every action        | secrets, force pushes, pushes to `main`, other lanes' files, stray files, GitHub text format | `guard` hook                    |
| Every edit          | formatting, lint, accessibility lint, hard-coded colours, placeholder copy                   | `format-on-edit` hook           |
| Every turn          | type errors, failing unit tests                                                              | `quality-on-stop` hook          |
| Every task          | pick the next ready issue, build to the spec, ship, merge, repeat                            | `go` skill                      |
| Every PR            | lanes touched, self-check, reviews by tier, docs, PR description, e2e                        | `ship-pr` skill                 |
| Every push / deploy | lane check, tree check, hook tests, lint, typecheck, tests, build; e2e on previews           | CI                              |
| Session end         | commit, push, decisions recorded, summary on issue #1                                        | `handover` skill                |
| Midpoint and freeze | whole-product, docs and tree sweep into `polish` issues; judge's-eye critique                | `polish-pass`, `product-critic` |

### Subagents and models

| Model  | Agents                                                                                                              | For                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| opus   | main session on Max, `product-critic`; `code-reviewer`, `ux-reviewer`, `test-writer` follow the session (`inherit`) | judgment: architecture, hard bugs, reviews, critique     |
| sonnet | main session on Pro (so the `inherit` agents too), `builder`, `docs-keeper`, `pr-writer`, `researcher`              | well-specified building, tests, docs, PR prose, research |
| haiku  | `scout`, `tidy`                                                                                                     | search, log digging, file-tree hygiene                   |

Delegation rules and budget mode for Pro plans: [.claude/rules/delegation.md](.claude/rules/delegation.md).

### Tools on every machine

| Tool      | What it does here                                                                                                                               | Rule                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Lightfoot | Installed at the venue (docs/setup.md section 1). A local proxy that trims what each turn re-sends; on Pro and Max it stretches the usage limit | `lightfoot claude`, or `lightfoot integrate on` for VS Code |
| Graphify  | A code map in `graphify-out/` (gitignored), rebuilt by git hooks with no model calls; agents query it before searching                          | [.claude/rules/tools.md](.claude/rules/tools.md)            |
| Obsidian  | Each person's vault gets a Lightfoot handoff note at the end of every session; private, issue #1 stays the team record                          | [.claude/rules/tools.md](.claude/rules/tools.md)            |

Setup: [docs/setup.md](docs/setup.md) section 1.

### What's in here

| Path                               | What it is                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [docs/setup.md](docs/setup.md)     | Machine setup, repo and issue #1, settings, lane map, hook specs, GitHub workflow, CI spec                            |
| [CLAUDE.md](CLAUDE.md)             | Agent entry point: how to work, lanes, commands, stack, file tree; `kickoff` fills it                                 |
| [AGENTS.md](AGENTS.md)             | Pointer for Cursor, Codex, Gemini and others                                                                          |
| [.github/](.github/)               | `pull_request_template.md`                                                                                            |
| [docs/](docs/)                     | `spec` (what to build, with the Ready checklist), `architecture`, `decisions`, `api`, `development`                   |
| [.claude/rules/](.claude/rules/)   | `lanes`, `quality`, `design`, `ai-features`, `structure`, `docs`, `git`, `delegation`, `security`, `testing`, `tools` |
| [.claude/agents/](.claude/agents/) | The ten subagents above                                                                                               |
| [.claude/skills/](.claude/skills/) | `join`, `go`, `kickoff`, `ship-pr`, `handover`, `polish-pass`, `demo-prep`                                            |

### Team

| Name  | GitHub              | Role                                                                                       |
| ----- | ------------------- | ------------------------------------------------------------------------------------------ |
| Miska | `miska-voutilainen` | Repo owner; runs `kickoff`                                                                 |
| Elias | `eliasnorta`        | Miska's backup: admin on the repo, takes over `kickoff` if Miska's laptop or account fails |
| Veijo | `Kasanen`           |                                                                                            |

Lanes and their owners are decided at kickoff.

### Kickoff

1. As a team, without agents: pick the challenge, the idea, the stack, the demo path and the **lanes**; the designer sets the visual direction.
2. Miska (`miska-voutilainen`; backup: Elias, `eliasnorta`) sets up the repo, the labels and **issue #1, the agent sync log** (docs/setup.md section 2); the kit files are already in place.
3. Miska (`miska-voutilainen`) runs the `kickoff` skill with the project info (timeboxed to 90 minutes; skeleton PR ~45 minutes in): idea check, file tree and lanes, `docs/spec.md` with a cold-read check, your sign-off, task issues, the skeleton PR, then the harness core (settings, lane map, guard, briefing). The design system, the other hooks, test harnesses, CI, docs and the deployed skeleton are foundation tasks (T01…) spread across the lanes.
4. As soon as the repo exists, Elias and Veijo clone it and say **"join"** (their agent sets up their machine). When the skeleton PR merges, they say **"go"** (following the guard's rules by hand and holding merges until the harness core merges); after it merges: `git merge origin/main`, a new session, "Verify the harness" (docs/setup.md 4.7).
5. From then on: "go" in each lane; `handover` before sleeping; one person runs `polish-pass` at the midpoint and after the freeze, and `demo-prep` at the freeze; the lanes' "go" fixes what they file.

## Credits

Miska (`miska-voutilainen`) made this environment together with Claude Opus 5.5, Anthropic's AI model, working in Claude Code.

**Miska decided:**

- The goal and the scope: a project-agnostic kit for a three-person, 48-hour team. It stays Markdown only (plus two plain-text config files, `.gitignore` and `.gitattributes`), with nothing installed or coded before the event.
- The team, the roles and the backup: Miska runs kickoff and owns the repo, and Elias takes over if Miska's laptop or account fails.
- The Claude plans and how usage is split: Max 5x for Miska, and Pro in budget mode for Elias and Veijo.
- The tools on every machine (Lightfoot, Graphify, Obsidian), and the rule that experimental or unsupported add-ons stay out.
- How AI use is disclosed: a short technical AI use section in every PR and in the final README, with no co-author trailers or generated-by lines.
- The Git conventions: squash merges, a protected `main` (GitHub Pro), no emoji in commits or PRs, and no Lefthook or Husky.
- The lanes: every code path belongs to one lane, with one person and their agent per lane.
- The reviews: S/M/L tiers scaled to each PR's risk.
- What to keep, change or cut in every draft.

**Claude did:**

- Wrote the files: the rules, the skills, the ten subagents, the templates, setup.md and checklist.md.
- Worked out the rest of the working model for Miska to review: the spec-first kickoff, the harness hook specs and the opus/sonnet/haiku model split.
- Kept every file consistent as the decisions changed.
