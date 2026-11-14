# Structure and a clean file tree

Judges open the repo. The tree should read like a table of contents: every file where you'd expect it, named for what it is, nothing stray.

## The tree

- The canonical layout lives in `CLAUDE.md` ("File tree"). New top-level folders or root files are added there first, in the same PR.
- **Root holds only:** `README.md`, `CLAUDE.md`, `AGENTS.md`, `LICENSE`, the package manifest and lockfile (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`), tool configs the stack needs at the root (`tsconfig.json`, `*.config.*`, `components.json`, `vercel.json`, `.prettierrc.json`, `.prettierignore`), `.gitignore`, `.gitattributes`, `.env.example`, and the top-level folders in `CLAUDE.md`. Anything else goes in a folder.
- Group code by feature, not by type: a feature folder holds its components, logic, API calls and tests, and exposes a small `index`; other features import from it, never from its internals.
- Shared UI, clients, scripts, e2e tests and evals each have one home, named in the File tree. Code moves to a shared folder only when a second feature needs it.
- Keep the framework's conventions (routing folders, config locations) where they conflict with these rules.

## Names

- Files named after what they export: `SearchResults.tsx` → `SearchResults`, `rankResults.ts` → `rankResults`. Components PascalCase, everything else camelCase (or the language's convention: snake_case in Python). Folders kebab-case or the framework's convention, one style throughout.
- **Never** as a name or a whole name segment: `utils2`, `helpers-new`, `old`, `backup`, `copy`, `final`, `v2`, `test123`, `temp`, `tmp`, `misc`, `stuff`. Substrings are fine (`template.tsx`, `CopyButton.tsx`, `temperature.ts`, `finalize.ts`). Rename or delete instead.
- No two files with the same purpose. Before creating a helper, search for an existing one (`scout`).

## Nothing stray

- Scratch work, experiments, screenshots and downloaded files go in `.scratch/` or `.review/` (both gitignored), never committed.
- No empty folders, unused files, unused exports, dead code or commented-out code. Delete what the demo path doesn't use (git remembers).
- Generated output (`dist/`, `.next/`, coverage, Playwright reports) is gitignored.
- Assets in the one folder the File tree names, named by content (`hero-dashboard.png`, not `image (3).png`), compressed.

## Code shape

- One component, function or module per file; files under ~300 lines.
- TypeScript strict (or type hints plus a checker in Python); no `any` without a comment.
- Errors are never swallowed: handled at the boundary, logged with context (no secrets or personal data), shown to the user clearly.
- Prefer well-maintained, widely used libraries.
