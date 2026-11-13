---
name: join
description: Set up this machine for the project with no manual configuration - identify the person from gh, derive their plan and lane, set the git identity, install and configure Lightfoot, Graphify, the Playwright MCP and an Obsidian vault, write .claude/settings.local.json and build the code map. Use the first time someone opens Claude Code in the repo on a new machine ("join", "set me up"), or when the briefing says LANE or PLAN is missing.
---

# Join

Your user has cloned the repo and started Claude Code in it; everything else is your job. They only approve the permission prompts (installs, and the one write under `.claude/`). Run every step without asking questions unless a step below says to stop. Show a one-line result per step.

**Before:** Claude Code, Git, `gh` (logged in with `gh auth login`) and Node LTS must exist; you're running in Claude Code and the repo was cloned, so check only `gh auth status` and `node --version`. If either fails, stop and tell your user the one command to run (setup.md section 1).

1. **Who.** `gh api user --jq '.login + " " + (.id|tostring)'`. Find the login in the **Team** table in `CLAUDE.md`: it gives the name and the plan (`max` or `pro`). Find the lane: the lane in `.claude/lanes.json` whose `owner` is this login, else the Lanes table in `CLAUDE.md`. If the login isn't in the Team table, stop: "your GitHub login isn't on the team list; ask Miska". If no lane is assigned yet, carry on with `LANE` unset and say so.
2. **Git identity, for this repo only.** If `git config user.name` is empty, set it to the name from the Team table. If the person already has an email set (`git config user.email` returns one), keep it: it's their choice. Only if it's empty, set `git config user.email "<id>+<login>@users.noreply.github.com"`: GitHub links it to the account, so squash merges get no stray co-author line, and no personal address enters the history.
3. **Tools.** For each, check first and install only if missing (each install raises a prompt your user approves). Windows: `winget` and `py`; macOS: `brew` and `python3`; Linux: the distro's package manager.
   - Python 3.11+ and `uv` (`winget install astral-sh.uv` / `brew install uv`)
   - Lightfoot: `uv tool install lightfoot`, then `lightfoot doctor`
   - Graphify: `uv tool install graphifyy`, then `graphify install` (Windows: `graphify install --platform windows`). Never `graphify claude install`. If `graphify` isn't on the PATH afterwards, use `py -m graphify` / `python -m graphify`.
   - Playwright browsers: `npx playwright install chromium`
   - Playwright MCP for every project: `claude mcp get playwright` succeeds, or `claude mcp add --scope user playwright -- npx @playwright/mcp@latest`
   - Obsidian, optional: `winget install --id Obsidian.Obsidian --exact` / `brew install --cask obsidian`. The vault works without the app; a failure here doesn't stop the join.
4. **Vault.** Use `~/Obsidian/Junction` (create it if missing) with `Home.md` (one paragraph: personal notes; the team record is issue #1), the folders `Claude Handoffs/` and `Junction/`, and `.obsidian/app.json` containing `{ "useMarkdownLinks": true, "newLinkFormat": "relative" }`. Then `lightfoot config set integrations.vault_path "<absolute vault path, forward slashes>"`, `lightfoot handoff install` and `lightfoot integrate on` (routes VS Code and plain `claude` through Lightfoot too). Leave Lightfoot's mode as the team decided in `CLAUDE.md` (Tools line); if it says nothing, leave the default.
5. **`.claude/settings.local.json`** from the matching shape in setup.md section 3, with this person's `LANE`, `PLAN` and vault path (forward slashes). For `pro` it includes `"model": "sonnet"` and `CLAUDE_CODE_EFFORT_LEVEL`. If the file exists, merge: keep their other keys, overwrite only these. This is the one write under `.claude/`, so your user gets a prompt.
6. **Code map.** `graphify update .` and `graphify hook install` (no model calls).
7. **Hand over to a fresh session.** The new settings apply only to a new session. Tell your user, in one message: what was set up (name, plan, lane, vault path), anything that failed and its fix, then: "Type `/exit`, start Claude Code again in this folder, accept the trust prompt, and say **go**." (Before the harness core has merged, `go` holds merges; after it, the first session runs setup.md 4.7.)

Never print tokens or keys, never edit files outside `.claude/settings.local.json`, the vault and Lightfoot's and Graphify's own config, and never change the shared `.claude/settings.json`.
