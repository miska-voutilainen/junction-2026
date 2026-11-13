# Junction 2026

<One-line pitch, written at kickoff. `demo-prep` turns this part into the judges' README: a GIF or screenshot, the live URL, what it does, how it uses the partner's tech, the architecture, what's real vs mocked, how to run it locally, and how we used AI tools.>

## Prepared before the event, no code

This environment was set up before Junction started, and it contains no code. There are no scripts, no product code, no config files and no installed tools here. It is written guidance: how the team works, how the agents behave, and specs for the tooling. The event rules let us bring only Markdown files like these, so that is all this folder holds.

Every line of code is written during the event, in a fresh repository, by the team and its agents. That includes the hooks, settings and CI described here. Nothing from other projects goes into that repository. If organisers want to check, we show them this folder as it is.

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

| When | What | Where |
| --- | --- | --- |
| Session start | lane, handoffs, my task queue, overlapping PRs, new sync-log summaries, the next task | `session-brief` hook |
| Every action | secrets, force pushes, pushes to `main`, other lanes' files, stray files, GitHub text format | `guard` hook |
| Every edit | formatting, lint, accessibility lint, hard-coded colours, placeholder copy | `format-on-edit` hook |
| Every turn | type errors, failing unit tests | `quality-on-stop` hook |
| Every task | pick the next ready issue, build to the spec, ship, merge, repeat | `go` skill |
| Every PR | lanes touched, self-check, reviews by tier, docs, PR description, e2e | `ship-pr` skill |
| Every push / deploy | lane check, tree check, hook tests, lint, typecheck, tests, build; e2e on previews | CI |
| Session end | commit, push, decisions recorded, summary on issue #1 | `handover` skill |
| Midpoint and freeze | whole-product, docs and tree sweep into `polish` issues; judge's-eye critique | `polish-pass`, `product-critic` |

### Subagents and models

| Model | Agents | For |
| --- | --- | --- |
| opus | main session on Max, `product-critic`; `code-reviewer`, `ux-reviewer`, `test-writer` follow the session (`inherit`) | judgment: architecture, hard bugs, reviews, critique |
| sonnet | main session on Pro (so the `inherit` agents too), `builder`, `docs-keeper`, `pr-writer`, `researcher` | well-specified building, tests, docs, PR prose, research |
| haiku | `scout`, `tidy` | search, log digging, file-tree hygiene |

Delegation rules and budget mode for Pro plans: [.claude/rules/delegation.md](.claude/rules/delegation.md).

### Tools on every machine

| Tool | What it does here | Rule |
| --- | --- | --- |
| Lightfoot | Installed at the venue (docs/setup.md section 1). A local proxy that trims what each turn re-sends; on Pro and Max it stretches the usage limit | `lightfoot claude`, or `lightfoot integrate on` for VS Code |
| Graphify | A code map in `graphify-out/` (gitignored), rebuilt by git hooks with no model calls; agents query it before searching | [.claude/rules/tools.md](.claude/rules/tools.md) |
| Obsidian | Each person's vault gets a Lightfoot handoff note at the end of every session; private, issue #1 stays the team record | [.claude/rules/tools.md](.claude/rules/tools.md) |

Setup: [docs/setup.md](docs/setup.md) section 1.

### What's in here

| Path | What it is |
| --- | --- |
| [docs/setup.md](docs/setup.md) | Machine setup, repo and issue #1, settings, lane map, hook specs, GitHub workflow, CI spec |
| [CLAUDE.md](CLAUDE.md) | Agent entry point: how to work, lanes, commands, stack, file tree; `kickoff` fills it |
| [AGENTS.md](AGENTS.md) | Pointer for Cursor, Codex, Gemini and others |
| [.github/](.github/) | `pull_request_template.md` |
| [docs/](docs/) | `spec` (what to build, with the Ready checklist), `architecture`, `decisions`, `api`, `development` |
| [.claude/rules/](.claude/rules/) | `lanes`, `quality`, `design`, `ai-features`, `structure`, `docs`, `git`, `delegation`, `security`, `testing`, `tools` |
| [.claude/agents/](.claude/agents/) | The ten subagents above |
| [.claude/skills/](.claude/skills/) | `join`, `go`, `kickoff`, `ship-pr`, `handover`, `polish-pass`, `demo-prep` |

### Team

| Name | GitHub | Role |
| --- | --- | --- |
| Miska | `miska-voutilainen` | Repo owner; runs `kickoff` |
| Elias | `eliasnorta` | Miska's backup: admin on the repo, takes over `kickoff` if Miska's laptop or account fails |
| Veijo | `Kasanen` | |

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

- The goal and the scope: a project-agnostic kit for a three-person, 48-hour team. It stays Markdown only, with nothing installed or coded before the event.
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
