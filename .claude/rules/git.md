# Git and pull requests

The PR list is the project's story; a judge who opens it should see a clean sequence of well-explained changes.

## Branches and commits

- Never push to `main`; every change lands through a PR. `main` is always deployable and always deployed.
- Branch per task: `type/t<nn>-short-name` (`feat/t04-live-search`); `type/short-name` for work without a task.
- **No emoji, ever,** in commit messages, PR titles or PR bodies (squash merges turn the PR title and body into the commit on `main`). Plain text only; no gitmoji, no `:shortcode:`. The guard refuses them and CI fails on them. No git-hook manager (Lefthook, Husky, commitizen presets) goes into this repo: they can rewrite messages or print emoji, and `--no-verify` skips git hooks anyway; our checks live in the Claude Code guard and CI, which can't be skipped.
- Conventional Commits: `type(scope): summary`, imperative, lowercase, no period, under 72 characters. Types: feat, fix, refactor, perf, test, docs, style, chore, ci. A body when the why isn't obvious.
- One logical change per commit; commit often.
- **AI use is declared in the PR, not in trailers.** Every PR body has an **AI use** section (`.github/pull_request_template.md`): one to three technical lines on which models and agents did what (planning, writing, tests, review) and what people decided or checked. Never invent or round up; name the models the session really used. No `Co-Authored-By` trailer naming Claude or Anthropic in commits (squash merges copy them into `main`) and no "Generated with [Claude Code]" boilerplate: the project's `attribution` setting turns Claude Code's own lines off, and the guard refuses them if they appear anyway.
- Never force push. Update a pushed branch with `git merge origin/main`; never rebase a pushed branch.
- Before `git reset --hard`, `git clean` or `git checkout -- .`, check `git status` first.

## Pull requests

- One task per PR, under ~400 changed lines (lockfiles and generated files don't count); split larger work into stacked PRs.
- **Title** in Conventional Commit format; it becomes the squash commit.
- **Body:** first line `[agent:<your lane>]`, then `.github/pull_request_template.md` (its comments say what each section needs), including `Closes #<task>`. Labels: `lane:<your lane>`, plus `cross-lane` only after the affected owner agreed.
- Say only what the diff does and what was actually run. No filler, no AI boilerplate, no claims of tests that weren't run.
- Text over one line goes through a file written with the file tool: `--body-file <file>`, `git commit -F <file>`. In PowerShell the backtick is an escape character and garbles inline Markdown.
- Merge only your own PR (squash, delete branch) when CI is green and the `ship-pr` reviews are done. Never commit to, merge or close a teammate's PR.
