# Development

<!-- From clone to running in five minutes. Kept current by docs-keeper. -->

## Prerequisites

- Node 24 or newer and pnpm 12.11.2 (set by `packageManager` in `package.json`).

## Setup

1. Clone the repository.
2. Install dependencies: `pnpm install --frozen-lockfile`
3. Copy `.env.example` to `.env` and fill in the values (ask the team; never commit `.env`).
4. Seed the demo data: `pnpm seed` (clones our fork of Tieto's repository into `SAMPLE_REPO_DIR`)
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

| Command                                           | What it does                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                        | Run locally                                                                                                                                                   |
| `pnpm build`, `pnpm start`                        | Production build and server                                                                                                                                   |
| `pnpm lint`, `pnpm lint:fix`                      | ESLint, with autofix                                                                                                                                          |
| `pnpm format`                                     | Prettier write                                                                                                                                                |
| `pnpm typecheck`                                  | `next typegen`, then `tsc --noEmit`                                                                                                                           |
| `pnpm test`                                       | Unit tests, Vitest                                                                                                                                            |
| `pnpm test:hooks`                                 | Harness hook tests, `node --test`                                                                                                                             |
| `pnpm e2e`                                        | Playwright at 1440 and 375 px; builds and serves the app unless `E2E_BASE_URL` is set                                                                         |
| `pnpm screenshots`                                | Playwright `screenshots` project, into `.review/`                                                                                                             |
| `pnpm seed`                                       | Clone the fork and fetch notes                                                                                                                                |
| `pnpm pipeline`, `pnpm evals`, `pnpm countersign` | Defined in `package.json` for the review pipeline, the planted-bug eval and the receipt CLI; `src/pipeline/` and `src/receipt/` are not in the repository yet |

## Testing

<!-- Unit, e2e (locally and against a preview: E2E_BASE_URL), evals. -->

## Deploying

<!-- Preview per PR, production on merge to main, how to roll back. -->

## Troubleshooting

<!-- Problems the team actually hit and the fix. -->
