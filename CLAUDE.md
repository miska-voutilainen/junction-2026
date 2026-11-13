# Countersign

A reference implementation of AI code review for agent-written pull requests: the AI explains each change as a requirement-traced story with checkable evidence, routes the human's attention by readable risk rules, and a named engineer signs a receipt in git. Built at Junction 2026 for the Tieto challenge "Earned Trust in AI Code"; judged by engineers and investors from leading AI and tech companies, so the product must feel finished. **What we build is in [docs/spec.md](docs/spec.md); it wins over anything else.**

## Team

| Name | GitHub | Claude Plan |
| --- | --- | --- |
| Miska | `miska-voutilainen` | max |
| Elias | `eliasnorta` | pro |
| Veijo | `Kasanen` | pro |

Tools: Lightfoot shadow, Graphify, Obsidian, Playwright MCP (set up by `join`).

## How to work

- **New machine:** open Claude Code in the repo and say **"join"**. The `join` skill sets up the git identity, tools, vault, `.claude/settings.local.json` and the code map from the Team and Lanes tables; you only approve install prompts.

- **"go"** (or "continue", "proceed") with nothing else means: run the `go` skill. It works through your lane's task issues to the spec, ships and merges each through `ship-pr`, and asks only on its stop conditions.
- Session start: the briefing (lane, handoffs, overlapping PRs, new summaries on the agent sync log, issue #1). Session end, sleep or account switch: `handover`.
- One person runs `polish-pass` at the midpoint and after the freeze, and `demo-prep` at the freeze; their findings become issues the lanes' "go" picks up.
- Find code through the Graphify map first (`.claude/rules/tools.md`); sessions run through Lightfoot.
- Rules: `.claude/rules/` (all loaded automatically). Subagents and models: `.claude/rules/delegation.md`. Plans: Miska Max 5x (normal mode); Elias and Veijo Pro (budget mode, capped in their `.claude/settings.local.json`; reviewers follow the session model). Details: `.claude/rules/delegation.md`, Plans and effort. Lanes: Miska the heaviest, Elias the second, Veijo the lightest.

## Lanes

Decided at kickoff (`.claude/rules/lanes.md`). Every code path belongs to exactly one lane or to Shared; mirrored in `.claude/lanes.json`, changed together. Open to all lanes: `README.md`, `CLAUDE.md`, `AGENTS.md` and `docs/` (except `docs/spec.md`).

| Lane | Owner (GitHub login) | Owns (paths) | Responsible for |
| --- | --- | --- | --- |
| engine | `miska-voutilainen` | `src/ai/**`, `src/prompts/**`, `src/pipeline/**`, `src/rules/**`, `src/policy/**`, `src/lib/git/**`, `data/runs/**`, `data/eval/**`, `data/recordings/**` | The review pipeline (A1–A5, quote check, .NET differential tests), routing rules and trust ladder, the planted-bug eval and report card, the AI client and prompts, CI and the harness; the critical path of the demo (heaviest) |
| app | `eliasnorta` | `src/app/**`, `src/features/inbox/**`, `src/features/review/**`, `src/components/**`, `src/lib/data/**`, `src/lib/simulation/**`, `src/lib/utils.ts`, `data/fixtures/**`, `e2e/**`, `public/**` | The review app: design system and shell, S1 inbox, S2 review page, data loaders, fixtures, the simulated-escape store, e2e and screenshots |
| evidence | `Kasanen` | `src/receipt/**`, `src/features/report-card/**`, `data/sample/**`, `data/receipts/**`, `scripts/**` | The sample data (fork, change inputs, requirements), planted bugs and contradiction plants written blind, the receipt CLI (SSH-signed git notes), S3 report card, quality hooks, the concept card (lightest) |
| _Shared_ | the affected owners | `src/contracts/**`, `src/styles/tokens.css`, root configs (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `*.config.*`, `components.json`, `vercel.json`, `.prettierrc.json`, `.env.example`, `.gitignore`, `.gitattributes`, `LICENSE`), `docs/spec.md`, `.github/`, `.claude/` | changed only with the owners' agreement; dependencies in their own `chore(deps)` PR |

The evidence lane writes the planted bugs blind: Veijo and his agent never open `src/prompts/`, `src/pipeline/` or recorded review output before the plants are merged.

Each machine sets its lane in `.claude/settings.local.json`: `{ "env": { "LANE": "<lane>" } }`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev                          # run locally at http://localhost:3000 (PORT overrides)
pnpm lint                         # autofix: pnpm lint:fix (a11y and no-console rules: T02)
pnpm typecheck
pnpm test                         # unit, Vitest (config: T02)
pnpm test:hooks                   # harness hook tests, node --test (T00)
pnpm e2e                          # Playwright (T03); E2E_BASE_URL=<url> for a preview or production
pnpm screenshots                  # into .review/, for ux-reviewer (T03)
pnpm evals                        # planted-bug eval and report card, costs model credits (T16)
pnpm pipeline run <changeId>      # record one review into data/runs/ (T12-T14)
pnpm countersign sign <changeId>  # draft | sign | verify | export a receipt (T20)
pnpm seed                         # clone our fork of Tieto's repo into SAMPLE_REPO_DIR and fetch notes (T07)
```

Production: filled in when the skeleton PR's first production deploy lands. Previews: one per PR from Vercel (team "junction", project "junction-2026").

Env (names in `.env.example`): `ANTHROPIC_API_KEY`, `SAMPLE_REPO_DIR` (absolute path of the fork's clone), `AI_MODE` (`record` | `replay` | `live`).

## Stack

- **App:** Next.js 16.4 (App Router, statically generated, no server state), React 19.3, TypeScript 5.9 strict, Tailwind CSS 4.3, shadcn/ui 4.23 (radix base) with lucide icons, sonner toasts, shiki 4.6 for C# highlighting at build time.
- **Pipeline and CLIs:** TypeScript on Node 24 run with tsx; `@anthropic-ai/sdk` 1.8 with structured outputs; zod 4.6 for every data file and model output; parse-diff for unified diffs; git (worktrees, notes) and `ssh-keygen -Y` for receipts; .NET SDK 8.0.4xx for A5.
- **Model:** Anthropic `claude-opus-5-5` at effort `high`, through the Junction partner credits, behind one client in `src/ai/` with record/replay.
- **Tests:** Vitest 5 (jsdom) for units, Playwright 1.65 for e2e at 375 and 1440 px, `node --test` for the harness hooks.
- **Hosting:** Vercel (Git integration, preview per PR, `vercel.json` sets the Next.js preset and pnpm 12.11.2 via `packageManager`).
- **No database, no server:** the site reads committed files under `data/`; git, .NET and model calls run on a laptop.

## File tree

The canonical layout (`.claude/rules/structure.md`); new top-level folders or root files are added here first, in the same PR.

```text
.
├── README.md, CLAUDE.md, AGENTS.md, LICENSE
├── package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.json, components.json, vercel.json,
│   next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts, .prettierrc.json, .env.example
├── .github/      workflows/, scripts/ (CI lane and tree checks), pull_request_template.md
├── .claude/      rules/, agents/, skills/, hooks/, settings.json, lanes.json
├── docs/         challenge, spec, concept-card, lessons, architecture, decisions, api, development, setup, demo, pitch, design/
├── src/
│   ├── app/                    routes: / (S1), /changes/[id] (S2), /reviewer (S3), layout, loading, error, not-found
│   ├── features/inbox/         S1 components
│   ├── features/review/        S2 components: navigator, diff viewer, sidebar tabs
│   ├── features/report-card/   S3 components
│   ├── components/ui/          shadcn/ui primitives (generated)
│   ├── components/             shared app components: shell, states, badges
│   ├── styles/tokens.css       design tokens (T01)
│   ├── contracts/              zod schemas and types for every data file (shared)
│   ├── lib/data/               server-side loaders for data/
│   ├── lib/simulation/         simulated-escape store (browser)
│   ├── lib/git/                git helpers: diff, hunks, diff identity
│   ├── lib/utils.ts            shadcn class-name helper
│   ├── policy/                 refusal rules, areas and checklists, ladder and routing thresholds
│   ├── rules/                  route() and the trust ladder, pure TS (pipeline and browser)
│   ├── ai/                     the one model client: record/replay, usage log
│   ├── prompts/                versioned prompts A1-A5
│   ├── pipeline/               pipeline CLI, steps, quote check, .NET test runner, eval scoring
│   └── receipt/                countersign CLI: draft, sign, verify, export
├── data/
│   ├── sample/                 change inputs, requirements, answer keys, allowed_signers
│   ├── runs/                   recorded reviews per change
│   ├── eval/                   the report card
│   ├── recordings/             raw model responses for replay
│   ├── receipts/               exported signed receipts with verify output
│   └── fixtures/               mock data for UI work and tests
├── e2e/                        Playwright specs
├── public/                     static assets
└── scripts/                    seed (clone the fork, fetch branches and notes)
```

Unit tests sit next to the code (`route.ts` → `route.test.ts`); the eval set is the planted bugs and contradiction plants in `data/sample/`.

Gitignored working folders: `.scratch/` (drafts, PR bodies, summaries), `.review/` (screenshots), `graphify-out/` (the code map, per machine), `.obsidian/`, `.lightfoot/`.
