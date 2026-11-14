# API

Countersign has no API. The site is statically generated and reads committed files under `data/`; there are no `/api` routes and no server state.

The only server-side code is the temporary access gate (`src/proxy.ts`, `src/features/access-gate/`): it redirects visitors without the code cookie to `/unlock`. See its [README](../src/features/access-gate/README.md). The command-line tools (`pnpm pipeline`, `pnpm countersign`) are listed in [development.md](development.md).
