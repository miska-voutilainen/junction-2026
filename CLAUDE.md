# <Project name>

<One sentence: what it does and for whom.> Built at Junction <year> for the <partner> challenge; judged by engineers and investors from leading AI and tech companies, so the product must feel finished. **What we build is in [docs/spec.md](docs/spec.md); it wins over anything else.**

## Team

| Name | GitHub | Plan |
| --- | --- | --- |
| Miska | `miska-voutilainen` | max |
| Elias | `eliasnorta` | pro |
| Veijo | `Kasanen` | pro |

Tools: Lightfoot <live | shadow>, Graphify, Obsidian, Playwright MCP (set up by `join`).

## How to work

- **New machine:** open Claude Code in the repo and say **"join"**. The `join` skill sets up the git identity, tools, vault, `.claude/settings.local.json` and the code map from the Team and Lanes tables; you only approve install prompts.

- **"go"** (or "continue", "proceed") with nothing else means: run the `go` skill. It works through your lane's task issues to the spec, ships and merges each through `ship-pr`, and asks only on its stop conditions.
- Session start: the briefing (lane, handoffs, overlapping PRs, new summaries on the agent sync log, issue #1). Session end, sleep or account switch: `handover`.
- One person runs `polish-pass` at the midpoint and after the freeze, and `demo-prep` at the freeze; their findings become issues the lanes' "go" picks up.
- Find code through the Graphify map first (`.claude/rules/tools.md`); sessions run through Lightfoot.
- Rules: `.claude/rules/` (all loaded automatically). Subagents and models: `.claude/rules/delegation.md`. Plans: Miska Max 5x (normal mode); Elias and Veijo Pro (budget mode, capped in their `.claude/settings.local.json`; reviewers follow the session model). Details: `.claude/rules/delegation.md`, Plans and effort. Lanes: Miska the heaviest, Elias the second, Veijo the lightest.

## Lanes

<To be decided at kickoff (`.claude/rules/lanes.md`). Every code path belongs to exactly one lane or to Shared; mirrored in `.claude/lanes.json`, changed together.> Open to all lanes: `README.md`, `CLAUDE.md`, `AGENTS.md` and `docs/` (except `docs/spec.md`).

| Lane | Owner (GitHub login) | Owns (paths) | Responsible for |
| --- | --- | --- | --- |
| <lane> | <login> | | |
| _Shared_ | the affected owners | <contracts file>, <tokens file>, root configs, package manifest and lockfile, `docs/spec.md`, `.github/`, `.claude/` | changed only with the owners' agreement; dependencies in their own `chore(deps)` PR |

Each machine sets its lane in `.claude/settings.local.json`: `{ "env": { "LANE": "<lane>" } }`.

## Commands

```bash
<install>
<dev>            # run locally at <http://localhost:PORT>
<lint>           # autofix: <lint:fix>
<typecheck>
<test>           # unit
<e2e>            # Playwright; E2E_BASE_URL=<url> for a preview or production
<evals>          # model evals
<screenshots>    # into .review/, for ux-reviewer
<seed>           # reset the demo data
```

Production: <URL>. Previews: one per PR from <host>.

## Stack

<framework, language, component library, database, hosting, model providers and model ids>

## File tree

The canonical layout (`.claude/rules/structure.md`); new top-level folders or root files are added here first, in the same PR.

```text
.
├── README.md, CLAUDE.md, AGENTS.md, LICENSE
├── .github/      workflows/, pull_request_template.md
├── .claude/      rules/, agents/, skills/, hooks/, settings.json, lanes.json
├── docs/         spec, architecture, decisions, api, development, setup, demo, pitch, design/
└── <code layout: to be decided at kickoff from the stack's conventions, one line per folder,
     naming the homes of: routes or entry points, features, shared UI, design tokens,
     clients (API, AI, database), prompts, contracts, unit tests, e2e tests, evals,
     scripts (seed, screenshots, tree check), static assets>
```

Gitignored working folders: `.scratch/` (drafts, PR bodies, summaries), `.review/` (screenshots), `graphify-out/` (the code map, per machine), `.obsidian/`, `.lightfoot/`.
