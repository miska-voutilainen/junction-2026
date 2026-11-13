# Setup

Everything a teammate needs before and at kickoff. Hooks, settings, the lane map and CI are specs here; the agent writes them as code during the event (the safety core in `kickoff`, the rest as foundation tasks), so only Markdown is brought to the event.

The harness has three jobs: **keep agents safe** (guard), **keep quality up where it's cheapest** (hooks on every edit and turn, so CI can stay fast), and **keep lanes from colliding** (lane map, briefing, handoffs, CI lane check).

## 1. At the venue, first thing, on every teammate's machine

**By hand:** Claude Code, Git, the GitHub CLI and Node LTS, plus `gh auth login`. **Everything else on this list, the `join` skill does** when you clone the repo, open Claude Code and say "join" (`.claude/skills/join/SKILL.md`). The list below is what it sets up, for reference and for fixing a step by hand if it fails.

Nothing is installed before the event: only this Markdown comes with you. Miska's machine is set up before kickoff (it needs Claude Code, Git, `gh`, Node, Python and Graphify). Everyone else runs this list in the background from the moment the repo exists, while kickoff runs (about 20 minutes, mostly downloads; skip anything already installed), so it's done before the skeleton PR merges. The night before, only read: this kit, the rulebook, the plan limits.


- [ ] **Claude Code** installed and logged in (`claude` in a terminal, or the VS Code extension). Plans and usage: [.claude/rules/delegation.md](../.claude/rules/delegation.md).
- [ ] **Git** with name and **the email of your GitHub account** (or its `…@users.noreply.github.com` address; the dry run showed a different email makes every squash merge add a stray `Co-authored-by` line) (on Windows: Git for Windows, which includes Git Bash; Claude Code needs it); **GitHub CLI** logged in (`gh auth login`) as your own account. Send your GitHub login to whoever creates the repo.
- [ ] **Node.js LTS** (hooks are Node scripts so they run the same on Windows, macOS and Linux) and **Playwright browsers** (`npx playwright install` in any scratch folder; the download is large, so start it first and let it run). Install whatever the likely stack needs (Python, Docker), but don't configure anything yet.
- [ ] **Browser access for the agent (required):** `claude mcp add playwright -- npx @playwright/mcp@latest`, then ask Claude to open a public page and describe it. `ux-reviewer` and every "look at it at 375 and 1440 px" step depend on it.
- [ ] **Editor extensions** (VS Code): ESLint, GitHub Pull Requests (read agents' PRs and #1 in the editor), Markdown Preview Mermaid (the architecture diagram); Tailwind CSS IntelliSense if the stack uses Tailwind. Other AI assistants (Gemini, Codex, Antigravity, Copilot) don't run the hooks: don't let them edit the repo, or have them follow `AGENTS.md` by hand.
- [ ] **Python 3.11+** and **uv** (or pipx), for Lightfoot and Graphify.
- [ ] **Lightfoot:** `uv tool install lightfoot`, then `lightfoot doctor`. Start sessions with `lightfoot claude`; if you work in the VS Code extension or the desktop app, run `lightfoot integrate on` once so they go through it too. It starts in shadow mode (measures only); `lightfoot shadow off` turns the savings on. Kill switch: `lightfoot off`.
- [ ] **Graphify:** `uv tool install graphifyy` (or `pip install graphifyy`), then `graphify install` (Windows: `graphify install --platform windows`) for the `/graphify` skill. Check `graphify --help` works; if it isn't on the PATH, use `python -m graphify` (Windows: `py -m graphify`). **Don't** run `graphify claude install`: the kit has its own rule (`.claude/rules/tools.md`), and that command rewrites `CLAUDE.md` and the shared settings.
- [ ] **Obsidian:** installed (`winget install --id Obsidian.Obsidian --exact` on Windows), with a personal vault for the event. Then `lightfoot config set integrations.vault_path "<absolute path to the vault>"` and `lightfoot handoff install`: every session that did real work leaves a handoff note in `Claude Handoffs/`. It's for you; the team's record stays on issue #1.
- [ ] Editor with the stack's formatter and linter extensions.
- [ ] Accounts created and verified (sign-ups aren't installs; do them the night before if the rules allow, otherwise here): hosting with preview deploys per PR (Vercel, Netlify, Fly, Render...), the model providers you expect, a design tool for whoever owns design. Partner API keys usually come at the event.
- [ ] Brought from home: charger, power strip, a phone for mobile testing, this folder on a USB stick or in cloud storage.

**Windows users:** PowerShell treats the backtick as an escape character, which garbles Markdown passed inline. Every PR body, issue, comment or commit message goes through a file (`--body-file`, `git commit -F`). The rules tell the agent this too.

## 2. Kickoff

1. **Team, no agents:** read the challenges and judging criteria; talk to the partner's engineers; pick the challenge, the idea and the stack; write the product brief and the demo path. **Split the work into lanes** (one per person or pair, by area: e.g. frontend, backend, AI, design and pitch) and agree which lane owns what. The designer sketches the main screen and picks the visual direction.
2. **Miska** (GitHub `miska-voutilainen`) runs steps 2-5, with Elias (GitHub `eliasnorta`) as backup, who takes over if Miska's machine or account fails: creates the repo (private until the rules say otherwise), invites Elias (`eliasnorta`, admin role) and Veijo (`Kasanen`, write role). Settings: squash merge only, with the squash commit built from the PR title and body (`gh api -X PATCH repos/<owner>/<repo> -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY`), so the AI use section lands in history and nothing else does; delete branches on merge, allow auto-merge (`-F allow_auto_merge=true` in the same call; agents use `gh pr merge --auto` so nobody waits for CI); branch protection on `main` once `main` exists (step 3) (PR required, the `ci` check required, no force push, no required approvals). **Decided:** Miska's account is on GitHub Pro, so branch protection and the required `ci` check work on the private repo (on Free they wouldn't). Turn them on right after the first push (step 3). Labels: `agent-sync`, `task`, `polish`, `handoff`, `needs-human`, `cross-lane`, and one `lane:<name>` per lane.
   **Then, before anything else gets a number, create issue #1:** title `Agent sync log`, label `agent-sync`, body: "One summary comment per agent session (`handover` skill). Never closed." Pin it (`gh issue pin 1`). Issues and PRs share numbering, so do this before the first PR; if #1 ends up being anything else, fix it now (delete the repo and recreate it; it's empty).
3. The kit is already laid out as this repo: `.claude/` (rules, skills, agents), `CLAUDE.md` and `AGENTS.md` at the root, `.github/pull_request_template.md`, `docs/` (the templates and this `setup.md`), a `.gitattributes` with `* text=auto eol=lf` (Windows and macOS teammates otherwise commit different line endings) and a `.gitignore` with `.env*`, `!.env.example`, `.claude/settings.local.json`, `.scratch/`, `.review/`, `graphify-out/`, `.obsidian/`, `.lightfoot/`. It went to `main` as the first commit (`chore: add agent environment`), the one push to `main` there will ever be. Set your own lane in `.claude/settings.local.json`, then turn on the branch protection from step 2.
4. Scaffold the stack with its official CLI, **after** `kickoff` has chosen the stack (its step 3b); kickoff runs the official scaffold command itself (an install, so you approve the prompt), commits the generated files to its branch and carries on.
5. Runs the `kickoff` skill with the project info. It writes `docs/spec.md` and its work plan, creates the task issues, installs the dependencies, fills `CLAUDE.md`, ships the skeleton PR, then builds the harness core (settings, `lanes.json`, guard, briefing and their tests). The design system, the other two hooks, test harnesses, CI, docs and the deployed skeleton are the spec's **foundation tasks**, spread across the lanes so everyone builds from the start. It asks one round of questions at the start and one sign-off before creating the issues. **Timebox: 90 minutes** (skeleton PR ~45 minutes in, harness core ~75); if the harness core isn't green by then, kickoff ships what passes and files the rest as a task.
   While kickoff runs, everyone else: talk to the partner's engineers (judging focus, API features, keys and credits); put keys in the password manager and set spending limits; create the hosting project; draw reference screens for `docs/design/`; outline the pitch; answer kickoff's questions and read the spec draft before sign-off.
6. When the skeleton PR merges, everyone clones, sets their lane (section 3), builds the code map once (`graphify update .`, then `graphify hook install` so it rebuilds after every commit, merge and checkout; no model calls) and says **"go"**; until the harness core merges, agents follow the guard's rules by hand (`AGENTS.md`) and **open PRs but don't merge them** (no guard and no CI yet). When it merges: `git merge origin/main`, start a new session, run "Verify the harness" (section 4.7).

## 3. Settings

### `.claude/settings.json` (committed, shared)

| List | Entries | Why |
| --- | --- | --- |
| **allow** | the stack's dev, test, e2e, evals, screenshot, lint, typecheck, format and build commands; `git status/diff/log/show/branch/switch/add/commit/fetch/pull/merge/push`; `gh pr create/view/list/checks/diff/comment/merge`; `gh issue list/view/create/comment/edit`; `gh run list/view` | "go" runs without prompts; the guard enforces the safety of pushes, merges and GitHub text |
| **ask** | `gh api`, deploy commands outside the PR flow, package installs, database resets outside the seed command | A human sees every new dependency and anything that bypasses the PR flow |
| **deny** | `Read`/`Edit` of the real secret files by name (`.env`, `.env.local`, `.env.*.local`, `.env.production`; a deny rule can't except `.env.example`, so the guard covers other `.env.*`); `git push --force` / `-f`; `git push origin main`; `rm -rf /`, `rm -rf ~`; `gh repo edit`; `gh repo delete`; `gh pr review` | Secrets, irreversible actions, approvals are human |

Shape (fill in the stack's package manager and commands; strict JSON, no comments or trailing commas):

```json
{
  "attribution": { "commit": "", "pr": "" },
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(pnpm run *)", "Bash(pnpm exec playwright *)",
      "Bash(git status *)", "Bash(git diff *)", "Bash(git log *)", "Bash(git show *)", "Bash(git branch *)",
      "Bash(git switch *)", "Bash(git add *)", "Bash(git commit *)", "Bash(git fetch *)", "Bash(git pull *)",
      "Bash(git merge *)", "Bash(git push *)",
      "Bash(gh pr create *)", "Bash(gh pr view *)", "Bash(gh pr list *)", "Bash(gh pr checks *)",
      "Bash(gh pr diff *)", "Bash(gh pr comment *)", "Bash(gh pr merge *)",
      "Bash(gh issue list *)", "Bash(gh issue view *)", "Bash(gh issue create *)",
      "Bash(gh issue comment *)", "Bash(gh issue edit *)", "Bash(gh run list *)", "Bash(gh run view *)",
      "Bash(graphify query *)", "Bash(graphify explain *)", "Bash(graphify path *)", "Bash(graphify update *)",
      "Bash(python -m graphify *)", "Bash(py -m graphify *)"
    ],
    "ask": ["Bash(gh api *)", "Bash(pnpm add *)", "Bash(pnpm install *)"],
    "deny": [
      "Read(./.env)", "Read(./.env.local)", "Read(./.env.*.local)", "Read(./.env.production)",
      "Edit(./.env)", "Edit(./.env.local)", "Edit(./.env.*.local)", "Edit(./.env.production)",
      "Bash(git push --force *)", "Bash(git push -f *)", "Bash(git push origin main *)",
      "Bash(gh repo delete *)", "Bash(gh repo edit *)", "Bash(gh pr review *)"
    ]
  },
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-brief.mjs"], "timeout": 45 }] }
    ],
    "PreToolUse": [
      { "matcher": "Read|Edit|Write|NotebookEdit|Bash|PowerShell",
        "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"], "timeout": 10 }] }
    ]
  }
}
```

Notes, checked against the Claude Code docs on 2026-11-12:

- `defaultMode: acceptEdits` lets agents edit files without a prompt each time (the dry run showed every Edit and Write prompting without it). The guard still asks for other lanes', shared and harness files.
- `Bash(x *)` also matches the bare `x`. Compound commands (`a && b`) run without a prompt only when every part is allowed; a deny or ask rule matches any part.
- **Deny rules can't have exceptions.** `Read(./.env.*)` would also block `.env.example`, so deny lists the real secret files by name and the guard's regex covers every other `.env.*`.
- Deny rules match the command as written (`git push --force`), not every form of it (`git -C . push -f`): the guard is the other half.
- `allow` rules and `env` in the shared file apply only after each person **trusts the folder** at the first session start; `deny` and `ask` apply at once.
- The foundation tasks add their hooks (`PostToolUse` for format-on-edit, `Stop` for quality-on-stop) to `hooks` in the same shape.

Also: `hooks` (section 4); `attribution` with empty `commit` and `pr`, so Claude Code adds no `Co-Authored-By` trailer to commits and no boilerplate line to PRs; AI use is declared in each PR's AI use section instead (`git.md`; the guard backs the trailer rule up, since a person's own user settings could add one); `env` with nothing secret; the Playwright MCP server in `.mcp.json` if the team uses it.

### `.claude/settings.local.json` (per machine, gitignored)

Written by the `join` skill; nobody edits it by hand. Per machine. **Max** (Miska):

```json
{
  "env": { "LANE": "frontend", "PLAN": "max", "VAULT": "C:/Users/you/Obsidian/Junction" },
  "permissions": { "additionalDirectories": ["C:/Users/you/Obsidian/Junction"] }
}
```

**Pro** (Elias, Veijo):

```json
{
  "env": {
    "LANE": "backend", "PLAN": "pro", "VAULT": "C:/Users/you/Obsidian/Junction",
    "CLAUDE_CODE_EFFORT_LEVEL": "medium"
  },
  "permissions": { "additionalDirectories": ["C:/Users/you/Obsidian/Junction"] },
  "model": "sonnet"
}
```

- `LANE`: your lane. Switching lanes means changing it and starting a new session.
- `SLOT` and `PORT` (Max only, set by `join`'s second seat): `a` / `b` and the dev-server port for that worktree. The dev server and Playwright read `PORT` (the e2e foundation task sets Playwright's `webServer` port and `baseURL` from `process.env.PORT`, default 3000).
- `PLAN`: `max` or `pro`. The briefing shows it and the agent picks its subagent models by it (`delegation.md`, Plans).
- `VAULT` and `additionalDirectories`: your Obsidian vault, so the agent can read Lightfoot's handoff notes and save its session summaries there without a prompt (`tools.md`).
- **Pro only:** `"model": "sonnet"` runs the main session on Sonnet. `CLAUDE_CODE_EFFORT_LEVEL` caps the effort of everything on that machine (session, skills **and** subagents): Claude Code documents that this variable overrides the `effort:` lines in the shared agent files, so `product-critic`'s `max` doesn't drain a Pro account. Raise it to `high` for one hard problem, then back.

### `.claude/lanes.json` (committed; the machine-readable lane map)

Written at kickoff from the Lanes table in `CLAUDE.md`, changed only together with it:

- `lanes`: for each lane name, its `owner` (GitHub login) and `paths` (glob patterns).
- `shared`: glob patterns for contracts, design tokens, root configs, the package manifest and lockfile, `docs/spec.md`, `.github/**` and `.claude/**` (the rules, skills, agents, hooks and settings decide what every agent does).
- `open`: `README.md`, `CLAUDE.md`, `AGENTS.md` and `docs/**` (except `docs/spec.md`). Docs change with the code in every PR, so these never trigger the guard's lane questions or the CI lane check. The Lanes table in `CLAUDE.md` still changes only together with `lanes.json`.
- Every other tracked path matches exactly one lane or `shared`.
Shape (paths are examples; kickoff writes the real ones):

```json
{
  "lanes": {
    "frontend": { "owner": "<github-login>", "paths": ["src/app/**", "src/features/**/ui/**", "e2e/**"] },
    "backend":  { "owner": "<github-login>", "paths": ["src/server/**", "src/features/**/api/**"] },
    "ai":       { "owner": "<github-login>", "paths": ["src/lib/ai/**", "src/prompts/**", "evals/**"] }
  },
  "shared": ["src/contracts/**", "src/styles/tokens.css", "package.json", "pnpm-lock.yaml", "tsconfig.json",
             "*.config.*", "docs/spec.md", ".github/**", ".claude/**"],
  "open": ["README.md", "CLAUDE.md", "AGENTS.md", "docs/**"]
}
```

Matching order, first match wins: `.claude/settings.local.json` (always allowed) → `shared` → `open` → `lanes`. So `docs/spec.md` is shared although `docs/**` is open. A path that matches nothing is reported by the CI tree check.

- **Dependencies:** kickoff installs every dependency the spec names, in one lockfile change. A later new dependency gets its own small PR (`chore(deps): add <pkg>`: manifest and lockfile only, `cross-lane`, merged at once). On a lockfile conflict never hand-merge: take `origin/main`'s lockfile (`git checkout origin/main -- <lockfile>`), re-run the install, commit.

## 4. Hooks

Claude Code runs hooks as shell commands on lifecycle events with a JSON payload on stdin. Each hook is a Node script in `.claude/hooks/`, registered in `.claude/settings.json` under `hooks.<Event>[].hooks[]` in **exec form**: `{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/<file>.mjs"], "timeout": <seconds> }`. Exec form runs `node` directly with no shell, so it behaves the same on Windows (where shell-form hooks run in Git Bash, or PowerShell without it), macOS and Linux. Tool events take a `matcher`: `Edit|Write` (letters and `|` only) is an exact list of tool names; anything else is a regex. See the example in section 3. Shared logic (reading `lanes.json`, matching a path to a lane) lives in one module the hooks and CI import.

### 4.1 Protocol reference

| Event | Fires | stdin has | To block or give feedback |
| --- | --- | --- | --- |
| `SessionStart` | session start, resume, `/clear`, compact | `session_id`, `cwd`, `source` | stdout is added to the agent's context |
| `PreToolUse` | before a tool call | `tool_name`, `tool_input` (`file_path`, `command`, `content`, `old_string`, `new_string`...) | print `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"\|"ask"\|"allow","permissionDecisionReason":"..."}}`, or exit 2 with the reason on stderr |
| `PostToolUse` | after a tool call succeeds | the same, plus `tool_response` | print `{"decision":"block","reason":"..."}` to feed the reason back to the agent |
| `Stop` | the agent is about to end its turn | `stop_hook_active` (true when a Stop hook already made it continue) | print `{"decision":"block","reason":"..."}` to make it keep working; exit silently to let it stop |

Subagent tool calls go through the same hooks. For every hook: read stdin fully and strip a leading BOM, but when `process.stdin.isTTY` is true (run by hand from a terminal) skip stdin and use defaults, otherwise it waits forever; normalise backslashes to forward slashes before matching paths; finish well within the timeout; exit 0 with no output to allow; never print secrets. Checked against the Claude Code hooks docs on 2026-11-12.

Four facts the code must respect:

- **Exit code 1 doesn't block** (it's a non-blocking error), so a crashing guard lets everything through. Wrap `decide()` in try/catch; on any internal error print an `ask` decision with "guard error: <message>". Use exit 2 or a `deny` decision to block.
- **Who sees the reason:** for `deny` the agent sees `permissionDecisionReason` and adapts; for `ask` the person sees it in the permission prompt and the agent doesn't. An `ask` prompts even in auto mode and even when an allow rule matches.
- **`LANE`:** hooks inherit Claude Code's environment, including `env` from the settings files. If `LANE` is still missing, read `env.LANE` from `.claude/settings.local.json` directly before treating it as unset.
- **Stop loops:** besides `stop_hook_active`, Claude Code caps a Stop hook at 8 consecutive continuations.

### 4.2 `guard.mjs` (PreToolUse, matcher `Read|Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell`, timeout 10)

A pure function `decide(input, root, lane)` so it can be unit-tested; the CLI wrapper reads `LANE` and prints the decision. **Shell** rows apply to both the `Bash` and the `PowerShell` tool (both pass `tool_input.command`). Paths in `open` (section 3) skip the lane rows. A foundation task's issue lists its **pre-agreed shared paths**; the guard still asks for them, and the user approves (that's the expected confirmation, not a stop).

**Lite mode (the escape hatch):** with `GUARD=lite` in the environment (`env` in `.claude/settings.local.json`, then a new session), only the safety rows apply: `.env`, secrets and private keys, likely secrets in written text, force push, push to `main`, `rm -rf` outside the repo, and the canary. Lane, naming, scratch and GitHub-text rows are skipped. For a guard bug that blocks work; remove it as soon as the fix merges.

| Tool | Condition | Decision and reason (deny: the agent sees it; ask: the person sees it) |
| --- | --- | --- |
| Read, Edit, Write | path matches `(^\|/)\.env(\.\|$)` and is not `.env.example` | deny: ".env holds secrets; use .env.example" |
| Edit, Write | path under `secrets/` or a private key file (`*.pem`, `id_rsa*`) | deny |
| Edit, Write | written text contains a likely secret: a whole token `sk-ant-…`, `sk-…` or `nvapi-…` of 20+ characters, `ghp_`/`github_pat_` + 30+, `AKIA` + 16 capitals or digits, or `-----BEGIN … PRIVATE KEY`. Never the bare prefix: `task-list` and `risk-badge` contain `sk-` | deny: "put it in .env and read it from the environment" |
| Edit, Write | `LANE` is unset | ask: "set env.LANE in .claude/settings.local.json" |
| Edit, Write | path belongs to another lane in `lanes.json` | ask: "<path> belongs to lane <x> (owner <login>); talk to them or open a handoff" |
| Edit, Write | path is `shared` in `lanes.json` | ask: "shared path: agree the change with the affected lanes" |
| Edit, Write | `.claude/settings.local.json` | allow (per machine, gitignored; checked before the shared row) |
| Edit, Write | `.claude/lanes.json` | ask: "lane map: change it together with the Lanes table in CLAUDE.md, with the team's agreement" |
| Edit, Write | `.claude/hooks/**` or `.claude/settings.json` | ask: "harness file: it decides what every agent may do; agree the change with the team" |
| Write | a new file at the repo root that isn't on the root allowlist (`.claude/rules/structure.md`) | ask: "put it in a folder, or add it to the File tree in CLAUDE.md first" |
| Write | a file name with a whole segment (base name split on `-`, `_`, `.` and spaces, lowercased) equal to `copy`, `backup`, `old`, `final`, `v2`, `temp`, `tmp` or `untitled`; substrings don't count, so `template.tsx`, `CopyButton.tsx`, `temperature.ts`, `finalize.ts` pass | deny: "name it for what it is (structure.md)" |
| Write | an image, log or scratch file outside the asset folder, `docs/`, `.scratch/`, `.review/` | ask: "scratch goes in .scratch/ (gitignored)" |
| Shell | a command with a `.env` file other than `.env.example` as an argument (`cat .env`, `Get-Content .env.local`, `grep KEY .env`) | deny: ".env holds secrets; use .env.example" |
| Shell | `git push` with `-f`, `--force`, `--force-with-lease` or a `+branch` refspec | deny |
| Shell | `git push` whose target refspec is `main`, `HEAD:main` or `refs/heads/main`, or a bare `git push` while the current branch is `main` | deny: "open a PR (ship-pr)" |
| Shell | `git rebase` (except `--abort`/`--continue`) | ask: "never rebase a pushed branch; merge origin/main instead" |
| Shell | `rm -rf` / `rm -fr`, or PowerShell `Remove-Item -Recurse`, with a target outside the repo (`/`, `~`, a drive letter, `..`) | deny |
| Shell | `git reset --hard`, `git clean -fd`, `git checkout -- .` | ask: "discards uncommitted work" |
| Shell | the wrong package manager (e.g. `npm install` in a pnpm repo) | deny, naming the right one |
| Shell | `gh pr merge` on a PR whose author isn't the current `gh` user (`gh pr view <n> --json author` vs `gh api user`, 5 s timeout; if the check fails: ask) | deny: "only the author merges" |
| Shell | `gh pr review` with `--approve` / `-a` | deny: "approvals are human" |
| Shell | `gh issue create`, `gh issue comment`, `gh pr create`, `gh pr comment` without `--body-file` (or `-F`) | deny: "write the text to a file and pass --body-file" |
| Shell | `gh issue create`, `gh issue comment`, `gh pr create`, `gh pr comment` whose body file is missing, or whose first line doesn't start with `[agent:<LANE>]` | deny: "agent-written GitHub text starts with [agent:<lane>]" |
| Shell | `gh issue close`, `gh issue edit` or `gh issue reopen` whose issue argument is exactly `1` or `#1` (a whole token, so `10`-`19` pass), and any `gh issue delete` | deny: "#1 is the agent sync log; it stays open and unchanged" |
| Shell | a command that names `.claude/hooks/` or `.claude/settings.json` and writes to it (`>`, `>>`, `sed -i`, `mv`, `cp`, `rm`, `tee`, `Set-Content`, `Out-File`, `Remove-Item`, `Move-Item`) | ask: "harness file: use Edit so the change is visible, and agree it with the team" |
| Shell | `git commit` whose message, or `gh pr create`, `gh pr edit` or `gh pr merge` whose title (`--title`/`-t`, `--subject`) or body (`--body`, `--body-file`), contains an emoji (any `\p{Extended_Pictographic}` character, U+FE0F, or a `:shortcode:` gitmoji) | deny: "no emoji in commit messages or PRs (team rule); plain text only" |
| Shell | `git commit` whose message (`-m` text or the `-F` file), or `gh pr create`, `gh pr comment`, `gh issue create`, `gh issue comment` whose body file, contains a `Co-Authored-By:` trailer naming Claude or Anthropic, or the boilerplate link `Generated with [Claude Code](` | deny: "no AI trailers or boilerplate; declare AI use in the PR's AI use section (git.md)" |
| Shell | `graphify claude install` (also as `python -m graphify` / `py -m graphify`) | deny: "it rewrites CLAUDE.md and the shared hooks; the kit's rule is .claude/rules/tools.md" |
| Shell | `echo guard-check` | deny with "guard is active" (the canary) |

Split a shell command on `&&`, `\|\|`, `;`, `\|` and newlines before matching, so chaining can't dodge a rule (the same separators cover PowerShell; Windows PowerShell 5.1 has no `&&`/`\|\|` but chains with `;`). It's a seatbelt, not a shell parser; the permission lists are the other half. Lane rules are `ask`, not `deny`: at one table a quick "may I?" beats a blocked teammate. Until `.claude/lanes.json` exists (during kickoff), the lane rows don't apply; the CI lane check passes the kickoff PR the same way.

#### Implementation notes (from the dry run, 2026-11-13)

A reference guard was built from this table and run in real Claude Code 2.1.317 on Windows with exec-form hooks. Blocked as specified: the canary, `git push origin main`, `page-copy.tsx`, `gh issue edit 1`. Passed: `CopyButton.tsx`. The settings' deny rule stopped `.env` before the guard ran, and the SessionStart briefing reached the agent. About 90 ms per call. Build it the same way:

- **Paths:** backslashes to `/`; strip the `CLAUDE_PROJECT_DIR` prefix **case-insensitively** (Windows sends `C:\…`, sometimes lower-cased); strip a leading `./`. Root = `CLAUDE_PROJECT_DIR`, else the input's `cwd`.
- **Globs:** `**/` matches zero or more folders, `*` stays inside one folder, so `*.config.*` matches root files only. Classification order, first match wins: `.claude/settings.local.json` → `shared` → `open` → `lanes`.
- **Fields:** Write `content`; Edit `new_string`; MultiEdit `edits[].new_string`; NotebookEdit `notebook_path` and `new_source`; Bash and PowerShell `command`.
- **Shell parsing:** split into parts on `&&`, `||`, `;`, `|` and newlines **outside quotes**, then into words honouring quotes, so `gh issue close "#1"` still matches. Flags in both forms: `--body-file x`, `--body-file=x`, `-F x`.
- **Body files:** strip a BOM, allow `\r\n`; a missing file is a deny.
- **Root allowlist** for the new-root-file row: `README.md`, `CLAUDE.md`, `AGENTS.md`, `LICENSE`, `.gitignore`, `.gitattributes`, `.env.example`, `.editorconfig`, `.nvmrc`, the package manifest and lockfile (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`), `tsconfig*.json`, `*.config.{js,cjs,mjs,ts}`, `components.json`, `vercel.json`, `.prettierrc*`, `pyproject.toml`, `uv.lock`, `requirements*.txt`.
- **`LANE` and `GUARD`:** the environment first, then `env` in `.claude/settings.local.json`; an empty string counts as unset.
- **Output:** always exit 0; print JSON only for `ask` or `deny`; deny wins over ask when several rows match; any exception becomes `ask` "guard error: …".
- **Tests:** the guard takes its I/O (read file, file exists, current branch, `gh` user, PR author) as an injectable object, so the 4.6 tests run offline in milliseconds. Also test it end to end: pipe JSON with a Windows absolute path into `node guard.mjs`.

### 4.3 `format-on-edit.mjs` (PostToolUse, matcher `Edit|Write|MultiEdit`, timeout 60)

Writing these hook files (and anything under `.claude/`) always raises a permission prompt: Claude Code protects the folder. The person running the foundation task approves it.

**Commands come from the package scripts**, which the foundation task that writes these hooks defines: `format` and `lint:fix` (each takes one file), `typecheck`, `test`, and optionally `test:related` (takes the changed files). Python stacks: the same names in a `Makefile` or `pyproject` scripts. On Windows, Node 24 runs `npm.cmd` only with `shell: true` (it prints a harmless deprecation warning on stderr).

1. Run the formatter on the edited file; ignore failures on unparsable files.
2. Run the linter with autofix on that file only. The lint config written at kickoff includes the UI framework's accessibility plugin and bans `console.log` in app code.
3. **Polish checks** on UI files (outside the tokens file and tests; comments, `var(--…)` and `href="#…"` don't count). Dry-run test cases: `color:"#ff0000"`, `fontSize: 14`, "Lorem ipsum", `<p>TODO …</p>`, `<img src>` without alt and `<div onClick>` are flagged; a token colour, `// TODO(#12)`, `<img alt>`, `<button onClick>` and `href="#main"` are not. The checks are: a hex/rgb colour literal, a raw pixel font size, `lorem ipsum`, `TODO`/`FIXME` inside a user-visible string, an image without alt text, a clickable non-interactive element without a role.
4. If anything remains, print `{"decision":"block","reason":"<file>: <findings, first 4000 chars>"}` so the agent fixes it in the same turn.

Skip files the formatter doesn't know, generated files and gitignored folders.

### 4.4 `quality-on-stop.mjs` (Stop, timeout 180)

1. If `stop_hook_active` is true, exit silently (otherwise it can loop).
2. `git status --porcelain -uall`; if no changed source files, exit silently. (`-uall` matters: without it a new folder shows as one `src/` line and the hook misses every file in it, as the dry run found.)
3. Typecheck and unit tests for the changed packages only (related tests only, if the runner supports it).
4. On failure print `{"decision":"block","reason":"<check> failed: <errors, trimmed>"}`.
5. Keep it under ~90 s. E2E, evals and screenshots are too slow here; they run in `ship-pr` and CI.

Both hooks were run in real Claude Code during the dry run: the polish feedback reached the agent after a Write, and the Stop hook blocked the turn with the failing test's message, then let the agent stop on the second try (`stop_hook_active`).

### 4.5 `session-brief.mjs` (SessionStart, timeout 45)

Prints a briefing into the agent's context, in this order, each part skipped silently if it fails (venue Wi-Fi) and the whole thing within ~30 s:

1. **Lane, plan and seat:** `LANE` and its paths, `SLOT` if set; **my open PRs** with a failed check, a conflict or stalled auto-merge (they come before new work); `PLAN` (`max` or `pro`) and what it means for models (`delegation.md`, Plans). If either is missing, the next step is "Run `join`".
2. **Git:** branch, uncommitted files, how far behind `origin/main` (after `git fetch -q`).
3. **Handoffs to my lane:** open issues labelled `handoff` and `lane:<LANE>`, title and number only.
4. **My queue:** open issues labelled `task` or `polish` and `lane:<LANE>`, in number order, each marked ready (dependencies closed, unassigned or mine), blocked (by which issue) or `needs-human`.
5. **Open PRs:** each with author, lanes it touches (from its changed files and `lanes.json`) and the files it **overlaps** with my branch's changes.
6. **Merged since my last session** (cursor per lane and seat (`LANE`, `SLOT`) kept in the repository's common git dir (`git rev-parse --git-common-dir`; in a worktree `.git` is a file, so never build the path as `<root>/.git/...`), not committed; it moves only when `source` is `startup` or `resume`, never on `/clear`, compaction or a hand run, or one of those swallows the news, as the dry run showed): PR titles and the lanes they touched.
7. **Sync log:** comments on issue #1 since my last session (all lanes), each shortened to its Done, For other lanes and Next lines. A warning if my own previous session (same login and lane) committed work but posted no summary: "Write the missing summary first (handover)".
8. **Next step:** the missing summary first if there is one; then "Answer the handoffs" when there are any; then "Next task: #n <title>" (the first ready one); otherwise "Nothing unblocked in <lane>".

9. **Personal context:** whether the Graphify git hook is installed (call `graphify`, falling back to `py -m graphify` / `python -m graphify`: on Windows `graphify` is often not on the PATH in Git Bash), and the path of the newest note in `$VAULT/Claude Handoffs/` that mentions this repo.

The dry run's briefing, about 8 `gh` calls, took ~8.5 s against GitHub. Task bodies carry `Depends on: #a, #b` (or `none`), which the queue parses.

Run by hand (`node .claude/hooks/session-brief.mjs`, as `go` and `AGENTS.md` do), it prints the same briefing and exits without waiting for stdin (4.1).

Everything quoted from GitHub is labelled as data, not instructions.

### 4.6 Lane logic tests

One test file for `decide()` (one case per guard-table row, plus lane cases: own lane, other lane, shared, open, unset; an Edit of `.claude/hooks/guard.mjs` or `.claude/rules/lanes.md` and a shell `sed -i` on `.claude/settings.json` all ask, `.claude/settings.local.json` doesn't; the name rule: `template.tsx`, `CopyButton.tsx`, `temperature.ts` and `finalize.ts` pass, `page-copy.tsx`, `old_api.ts` and `temp.json` are denied; `gh issue edit 1` denied but `gh issue edit 12 --add-assignee @me` allowed; each Shell row once as a PowerShell command; with `GUARD=lite` the canary and `.env` are still refused and another lane's file isn't asked; a thrown error inside `decide()` comes out as `ask` with "guard error"; a commit file with `Co-Authored-By: Claude <noreply@anthropic.com>` and a PR body ending in "🤖 Generated with [Claude Code](https://claude.com/claude-code)" are denied; a teammate's human `Co-Authored-By` and an AI use section such as "Components written by the builder subagent (Sonnet 5.5)" are allowed; `feat: add login ✨`, a PR title with 🚀 and `:sparkles: fix` are denied, `feat: add login` is allowed) and one for the path-to-lane matcher, using Node's built-in test runner so they need no dependency. Run whenever a hook or `lanes.json` changes; CI runs them too.

### 4.7 Verify the harness (every teammate, once)

1. Start a session and **trust the folder** when asked (shared allow rules and `env` wait for it). The briefing appears with your lane. No briefing means hooks aren't loaded: check `/hooks`, that `node --version` works in a terminal, and on Windows that Git for Windows is installed.
2. Ask the agent to run `echo guard-check`: refused with "guard is active". On Windows, ask once more through the PowerShell tool.
3. Run `node .claude/hooks/session-brief.mjs` in a terminal: it prints the briefing and exits.
4. Ask it to read `.env`: refused. Ask it to edit `.claude/rules/git.md`: it must ask (shared).
5. Ask it to edit a file in another lane: it must ask. Ask it to edit `README.md`: no question (open path).
6. Once the format-on-edit foundation task has merged: ask it to put `color: #ff0000` in a component; it gets the polish feedback and switches to a token.
7. Once the quality-on-stop foundation task has merged: ask it to introduce a type error and end its turn; the Stop hook makes it fix it.
8. Revert the test changes, then say "go".

## 5. GitHub workflow

- Every change through a PR via `ship-pr`; `main` is protected and always deployed.
- Work is planned as issues: `task` (from the spec's work plan), `polish` (from `polish-pass`), `handoff` (between lanes), `needs-human` (questions only people answer). Each lane's "go" works its `task` and `polish` issues in number order.
- The author merges their own PR (squash) when CI is green and the reviews for its tier are done. No required approvals. A PR that touches another lane's or shared paths carries the `cross-lane` label, added after the affected owner agreed (in person is fine; note it in the PR).
- Requests between lanes: handoff issues (`.claude/rules/lanes.md`). People at the same table still talk; the issue is the record the agents can read.
- **Issue #1 is the agent sync log**, pinned, never closed or edited. Every agent session ends with a summary comment there (`handover`); every session starts by reading the new ones (briefing).
- Every issue, comment and PR body an agent writes starts with `[agent:<lane>]`, so agents' text can be told from people's (both post from the same accounts).
- Tasks sized at about 1-3 hours of agent work; each PR costs ~5 minutes of agent time (the review runs alongside the checks; with auto-merge the agent doesn't wait for CI, the preview or e2e), so fold small copy or styling items into the task they belong to. Small PRs (under ~400 lines); `git merge origin/main` into your branch often, never rebase a pushed branch.

## 6. CI: fast, focused, required

**Is CI required by the event?** Junction doesn't require it to submit. Partner engineers do read repos: a green check, tests and a clean history support the "this is real engineering" impression. Check each challenge's criteria at kickoff.

**Why it's short:** the quality work happens locally (section 4) and in `ship-pr`; CI only confirms it. Long CI (integration databases, image builds and scans, static analysis) blocks merges for hours, which a 48-hour team can't afford.

**Spec** (two workflow files, written at kickoff):

1. **`ci`** on `pull_request` and push to `main`:
   - `concurrency` per branch with `cancel-in-progress: true`; no `paths-ignore` (a required check that never runs leaves a docs-only PR blocked forever; skip the slow steps instead when only `*.md` changed); `timeout-minutes: 10`.
   - One job on `ubuntu-latest`: checkout, runtime setup with the package-manager cache, frozen-lockfile install, then in this order (fail fast):
     0. **Message check** (PRs): the PR title, the PR body and every commit message in the PR (`git log --format=%B origin/main..HEAD`) contain no emoji (`\p{Extended_Pictographic}`, U+FE0F, `:shortcode:`) and no AI `Co-Authored-By` trailer or "Generated with [Claude Code](" boilerplate. Title and body reach the script through `env:`.
     1. **Lane check** (PRs): the lanes the PR touches, from its files and `lanes.json`. Fails if it touches another lane than its author's, or a shared path, without the `cross-lane` label; fails if `lanes.json` and the Lanes table in `CLAUDE.md` disagree. Posts the lanes touched in the job summary.
     2. **Tree check:** root files against the allowlist, top-level folders against the File tree, banned names, committed scratch or build output.
     3. Hook and lane-logic tests (section 4.6).
     4. Lint, typecheck, unit tests, build.
     5. gitleaks secret scan (seconds; matters if the repo goes public).
   - Target **under 4 minutes**. Required status check on `main`. If it gets slower, find the slow step; don't drop the requirement.
2. **`e2e-preview`** on the host's `deployment_status` event (success), for previews and production:
   - Playwright against the deployed URL: the demo path at 1440 px and 375 px, failing on console errors. Cache the browsers.
   - Under 4 minutes. Informational at first; required for production once stable.
   - Optional, informational: Lighthouse CI on the main screens (performance ≥ 90, accessibility ≥ 95).

Pin third-party actions to a full commit SHA or at least a release tag; `permissions:` minimal per job (`contents: read`, `pull-requests: read` for the lane check). Untrusted values (PR titles, branch names) reach `run:` steps only through `env:`.

**Not in CI:** evals (they cost money and need keys; results go in the PR body), UX review, screenshots.

**Minutes:** public repositories get free Actions minutes on standard runners; private ones use the account's allowance (2,000 minutes a month on the free plan). Two short workflows per PR fit easily in a weekend. Use a fresh repo, never one tied to a paid organisation.

## 7. After the event

- Restrict or revoke all partner and model API keys; remove secrets from the host.
- Agree as a team what happens to the repo (keep private, archive, or publish under a licence everyone agrees on) and to the deployment (it may keep costing money).
