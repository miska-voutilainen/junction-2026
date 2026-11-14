# Development

<!-- From clone to running in five minutes. Kept current by docs-keeper. -->

## Prerequisites

- Node 24 or newer and pnpm 12.11.2 (set by `packageManager` in `package.json`).
- Git, for `pnpm seed` and the receipt CLI. The receipt CLI also needs `ssh-keygen`.
- .NET SDK 8.0.4xx, only on the laptop that runs the pipeline: step A5 runs `dotnet test` on the fork. Not needed to run the site.

## Setup

1. Clone the repository.
2. Install dependencies: `pnpm install --frozen-lockfile`
3. Copy `.env.example` to `.env` and fill in the values (never commit `.env`). The names are `AI_BACKEND`, `ANTHROPIC_API_KEY`, `SAMPLE_REPO_DIR`, `AI_MODE` and `ACCESS_CODE`; the table below says what each is for. The app alone (`pnpm dev`) needs none of them: it reads the committed files under `data/`.
4. Clone the fork: set `SAMPLE_REPO_DIR` in `.env` to an absolute path, then run `pnpm seed`. It clones `miska-voutilainen/junction26-messagepack-csharp` (our fork of Tieto's repository) into that folder, fetches every branch and the receipt notes, and checks that the head commit of each sample change is there. Only the pipeline and the receipt CLI read the clone.
5. Start: `pnpm dev`, then open <http://localhost:3000> (`PORT` overrides).

## Environment variables

| Name                | What it's for                                                                                                              | Where to get it                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `AI_BACKEND`        | Which model backend the pipeline uses: `claude-code` (Claude Code headless on your own subscription, the default) or `api` | Set it yourself                                 |
| `ANTHROPIC_API_KEY` | Only for `AI_BACKEND=api`                                                                                                  | Your Anthropic Console, with a spending limit   |
| `SAMPLE_REPO_DIR`   | Absolute path of your clone of the fork; `pnpm seed` creates it                                                            | Choose a folder                                 |
| `AI_MODE`           | `record` (default), `replay` (recordings only) or `live`                                                                   | Set it yourself                                 |
| `ACCESS_CODE`       | Temporary access gate until the submission on Sun 15.11; empty turns it off                                                | Ask the team; set in Vercel's env settings only |

## Commands

| Command                                                   | What it does                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                | Run locally                                                                                                                                                                                        |
| `pnpm build`, `pnpm start`                                | Production build and server                                                                                                                                                                        |
| `pnpm lint`, `pnpm lint:fix`                              | ESLint, with autofix                                                                                                                                                                               |
| `pnpm format`                                             | Prettier write                                                                                                                                                                                     |
| `pnpm typecheck`                                          | `next typegen`, then `tsc --noEmit`                                                                                                                                                                |
| `pnpm test`                                               | Unit tests, Vitest                                                                                                                                                                                 |
| `pnpm test:hooks`                                         | Harness hook tests, `node --test`                                                                                                                                                                  |
| `pnpm e2e`                                                | Playwright at 1440 and 375 px; builds and serves the app unless `E2E_BASE_URL` is set                                                                                                              |
| `pnpm screenshots`                                        | Runs Playwright with `--project=screenshots`, meant to save PNGs into `.review/`; `playwright.config.ts` defines no such project yet                                                               |
| `pnpm seed`                                               | Clone the fork and fetch notes                                                                                                                                                                     |
| `pnpm review`, `pnpm evals` | `pnpm review run <changeId> --no-tests` records a blind-first review (A1, A2, quote check) into `data/runs/` and `data/recordings/`; `pnpm review check <changeId>` runs its eval cases. `pnpm review` is a built-in pnpm 12 command, so the script is named `review`. `evals` is not built yet |
| `pnpm countersign draft\|sign\|verify\|export <changeId>` | The receipt CLI (`src/receipt/`); needs `SAMPLE_REPO_DIR` and an unencrypted ed25519 key (default `~/.ssh/countersign_ed25519`, or `--key`). Commands and exit codes: [api.md](api.md#receipt-cli) |

## Testing

- **Unit:** `pnpm test` runs Vitest in jsdom over `src/**/*.test.ts(x)` and `scripts/**/*.test.ts`. Tests sit next to the code (`route.ts` and `route.test.ts`).
- **End to end:** `pnpm e2e` runs the specs in `e2e/` with Playwright at 1440x900 (`desktop`) and 375x812 (`mobile`). Unless `E2E_BASE_URL` is set, it runs `pnpm build && pnpm start` on `PORT` (default 3000) first. To test a preview or production, set `E2E_BASE_URL=<url>`. If `ACCESS_CODE` is set, the specs unlock the gate with it (`e2e/unlock.ts`).
- **Harness hooks:** `pnpm test:hooks` runs the `node --test` suites in `.claude/hooks/`.
- **Evals:** `pnpm evals` is the planted-bug eval. It calls the model and costs credits. Specified, not built yet.

## Deploying

Vercel's Git integration deploys: every pull request gets a preview, and a merge to `main` goes to production at https://countersign-junction.com (`www` and `http` redirect to it; DNS is on Cloudflare as DNS-only records pointing at Vercel). The Vercel project is "junction-2026" in the team "junction". `vercel.json` sets the Next.js framework, `pnpm install --frozen-lockfile` and `pnpm build`.

The `*.vercel.app` preview URLs are behind Vercel Authentication; only custom domains are public. To roll back, promote an earlier deployment in the Vercel dashboard.

## Troubleshooting

- **A changed `ACCESS_CODE` has no effect on the deployed site.** Vercel applies an env change only to new deployments. Redeploy (Deployments, then Redeploy). Source: [access gate README](../src/features/access-gate/README.md).
- **`pnpm e2e` ignores a changed `ACCESS_CODE`.** Playwright reuses a server already running on the port. Stop it, then run again. Source: `playwright.config.ts`.
