# Development

<!-- From clone to running in five minutes. Kept current by docs-keeper. -->

## Prerequisites

- <runtime and version, package manager>

## Setup

1. Clone the repository.
2. Install dependencies: `<install>`
3. Copy `.env.example` to `.env` and fill in the values (ask the team; never commit `.env`).
4. Seed the demo data: `<seed>`
5. Start: `<dev>`, then open <http://localhost:PORT>.

## Environment variables

| Name                | What it's for                                                                                                              | Where to get it                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `AI_BACKEND`        | Which model backend the pipeline uses: `claude-code` (Claude Code headless on your own subscription, the default) or `api` | Set it yourself                                 |
| `ANTHROPIC_API_KEY` | Only for `AI_BACKEND=api`                                                                                                  | Your Anthropic Console, with a spending limit   |
| `SAMPLE_REPO_DIR`   | Absolute path of your clone of the fork; `pnpm seed` creates it                                                            | Choose a folder                                 |
| `AI_MODE`           | `record` (default), `replay` (recordings only) or `live`                                                                   | Set it yourself                                 |
| `ACCESS_CODE`       | Temporary access gate until the submission on Sun 15.11; empty turns it off                                                | Ask the team; set in Vercel's env settings only |

## Commands

| Command | What it does |
| ------- | ------------ |
| ---     | ---          |

## Testing

<!-- Unit, e2e (locally and against a preview: E2E_BASE_URL), evals. -->

## Deploying

<!-- Preview per PR, production on merge to main, how to roll back. -->

## Troubleshooting

<!-- Problems the team actually hit and the fix. -->
