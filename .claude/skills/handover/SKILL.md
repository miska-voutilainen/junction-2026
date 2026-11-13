---
name: handover
description: End a session so the other lanes' agents and your next session can pick up - commit and push, record decisions where they bind, and post the session summary to the agent sync log (issue #1). Use at the end of every session that did work: run it yourself, without being asked, whenever your user says they're stopping, pausing, going to sleep or switching account, and whenever `go` stops.
---

# Handover

Other agents only know what reaches the repo or GitHub; your chat and private memory are invisible to them. Run every step without asking.

1. **Collect facts**, don't recall them: `git status`, `git log --oneline origin/main..HEAD` on each branch you touched, `gh pr list --author @me --state all --limit 10`, your assigned issues, the handoffs you answered or opened.
2. **Make the work visible.** Commit finished work; commit half-finished work on its branch with a `wip:` commit if it doesn't build (never on `main`); push. Unpushed work doesn't exist for the team. A task you won't finish: unassign yourself and comment where it stands.
3. **Put decisions where they bind:** a contract change in its shared file through a PR; a request for another lane in a handoff issue; a new fact about a partner API or env var in `docs/`; a behaviour the spec didn't cover as a `needs-human` question, never as a silent spec edit.
4. **Post the summary to issue #1.** Write `.scratch/summary.md` in exactly this shape (under ~25 lines, links rather than prose), then `gh issue comment 1 --body-file .scratch/summary.md`:

   ```markdown
   [agent:<lane>]

   ### Session summary · <lane> · <owner login> · <YYYY-MM-DD HH:MM>

   **Done:** #task → PR #n (merged | open), …
   **In progress:** #task on `branch`: what works, what doesn't, where to start
   **Decisions:** … → where recorded (PR, contract file, handoff #n, docs/decisions.md); or "none"
   **For other lanes:** contract changes, new handoffs (#n), things not to break; or "none"
   **Next:** the next task (#n) and anything it waits on
   ```

5. **Copy it to your user's vault** if `VAULT` is set: the same text to `$VAULT/Junction/<lane>/<YYYY-MM-DD HHMM>.md`, so their notes hold the lane's history next to Lightfoot's handoff notes. If a large refactor or file moves happened, run `graphify update .` first so the next session's map is current.
6. Tell your user in two lines what's on record and what the next session starts with, and to end the session with `/exit` (that's when Lightfoot writes its handoff note).

Lightfoot also writes a handoff note to your user's Obsidian vault when the session ends. That one is private to them; the summary on #1 is still required, because it's the only one the other lanes' agents can read.

No secrets, keys or personal data in the summary. If posting fails (offline, no `gh` login), show your user the summary and the error.
