---
name: ship-pr
description: Check, document, review, open and merge a PR for the current branch, with review effort scaled to the PR's risk (tiers S, M, L). Use when a task is finished ("ship it", "open a PR"); go runs it for every task.
---

# Ship a PR

Subagents start cold and re-read everything; each costs tens of thousands of tokens. Use them where judgment pays (the review), do small mechanical work yourself, and hand them the context you already have (changed files, graph nodes, spec sections, decisions) instead of letting them explore.

Under "go", run every step without asking; otherwise merge only when your user says so. Pick the tier first and state it in one line.

| Tier | When | Subagents (step 5) |
| --- | --- | --- |
| **S** | Copy, styling, config or docs only; under ~50 lines; not touching AI, auth, data or contracts | None. You update the docs and write the PR body yourself. |
| **M** | A normal feature or fix | **One:** `code-reviewer` (it includes the security and AI-robustness pass). `ux-reviewer` only if a demo-path screen changed. Docs and the PR body: yourself |
| **L** | Demo-path core, AI pipeline, auth, data model, contracts, or over ~300 lines | `code-reviewer`, plus `ux-reviewer` if UI changed. With `PLAN=max`, pass `effort: "xhigh"` to `code-reviewer` for the demo-path core and AI pipeline; with `PLAN=pro`, ask Miska for one review of those from his machine (`delegation.md`). `docs-keeper` and `pr-writer` only for a large sync or a hard-to-describe PR |

Any tier: add `tidy` if the PR adds a top-level folder or root file.

1. **Branch.** Not on `main`. Commit pending work. Over ~400 changed lines, not counting lockfiles and generated files (scaffold output, snapshots, recorded responses): split into stacked PRs.
2. **Update and lanes.** `git fetch`, `git merge origin/main`; resolve conflicts in your own lane's files. Check which lanes the diff touches (`.claude/lanes.json`). Another lane's or shared paths: stop and get the owner's agreement (`go` stop conditions); with it, add the `cross-lane` label. Shared paths the task issue lists as pre-agreed need no new agreement. Open paths (docs, `README.md`, `CLAUDE.md`) need no agreement; resolve their conflicts by keeping both sides. A lockfile conflict: take `origin/main`'s lockfile, re-run the install, commit.
3. **Checks**, showing the output: lint, typecheck, unit tests, e2e locally, evals if a prompt or model changed. Hand long failure output to `scout`. Fix failures.
4. **Self-check** every touched screen or endpoint against the definition of done (`.claude/rules/quality.md`) and the task's acceptance criteria. Fix what fails.
5. **Subagents for the tier, in parallel,** each given the changed files, the task issue, the spec sections and the decisions made. **Docs:** a small sync (a few lines in up to ~3 docs you can place from what you know) you do yourself; `docs-keeper` only for a larger one. `docs-keeper` and `tidy` leave their changes uncommitted.
6. **One review round.** Fix every blocking finding; list the rest under Follow-ups (polish goes to `polish-pass`). Re-check with the same reviewer (SendMessage) only if a blocking fix was non-trivial. Read and commit the docs and tree changes; decide on `tidy`'s deletion candidates. Re-run the checks if code changed.
7. **Describe** (plain text, no emoji: the title and body become the commit on `main`). Write `.scratch/pr-body.md` yourself from `.github/pull_request_template.md`, including the **AI use** section (one to three technical lines: which models and agents did what in this PR, and what your user decided or checked), from the facts you already hold (lane, task, check output, review results, decisions, screenshot paths), following `pr-writer.md`'s style rules. Hand it to `pr-writer` only for a tier L PR whose story is hard to tell.
8. **Open.** `git push -u origin HEAD`, then `gh pr create --title "<type(scope): summary>" --body-file .scratch/pr-body.md --label lane:<lane>`, plus `cross-lane` whenever the diff touches another lane's or a shared path, pre-agreed ones included (the CI lane check fails without it).
9. **Preview.** Once the deploy foundation task has merged: when the preview URL appears, run e2e against it; add the result to the PR (`gh pr comment --body-file`).
10. **Merge:** `gh pr checks <n> --watch`, then `gh pr merge <n> --squash --delete-branch`. Until the CI foundation task has merged there is no `ci` check: merge when step 3's checks pass locally. Confirm production still passes the e2e smoke (once it exists).
11. If the merge changed a contract or shared path, comment on the related handoff (or open one) so the other lanes know.
