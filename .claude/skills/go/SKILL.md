---
name: go
description: Work through your lane's queue autonomously - briefing, handoffs, then the next unblocked task issue, built to docs/spec.md and shipped through ship-pr, merged, repeated until the queue is empty. Use when your user says "go", "continue" or "proceed" with nothing else.
---

# Go

"go" is your user's go-ahead to build, push, open and merge your own PRs, and post to issues, without asking. Ask only when a stop condition below applies.

## Preconditions

- `LANE` and `PLAN` are set: if either is missing, run the `join` skill first (it sets them from `gh` and the Team and Lanes tables), then tell your user to restart the session.
- `docs/spec.md` has `Status: ready`. Otherwise stop: say what's missing (`kickoff` creates the spec).
- If the harness core hasn't merged yet (issue `T00 Agent harness core` still open), follow the guard's rules by hand as `AGENTS.md` lists them, brief yourself with `gh` (issue #1, your lane's `task` and `handoff` issues, open PRs), and **open PRs but don't merge them**: there is no guard and no CI yet. When it merges, `handover`, then tell your user to merge `origin/main`, start a new session and run setup.md 4.7; then merge `origin/main` into each held PR and merge it when green.

## The loop

1. **Briefing.** Read the SessionStart briefing (or run `node .claude/hooks/session-brief.mjs`). If your previous session's summary is missing, write it first (`handover` step 4). Read the vault note the briefing names, if any, and install the Graphify hook if it says it's missing (`tools.md`, Turning points).
2. **Catch up.** If others merged since: `git fetch`, `git merge origin/main` into your branch, re-run the checks; read changed contracts and the spec diff. The Graphify git hook refreshes the code map on the merge.
3. **Handoffs to your lane first.** For each open one: `Ack:` with the plan (and do it as the next task), `Decision:` if it's a detail inside your lane, or `Escalate:` plus the `needs-human` label if it changes the spec, the demo path or another lane.
4. **Pick the next task:** foundation tasks come first by number. The lowest-numbered open issue labelled `task` (or `polish` after the feature freeze) and `lane:<LANE>`, not assigned to someone else, not labelled `needs-human`, whose "Depends on" issues are closed. Assign it to yourself (`gh issue edit <n> --add-assignee @me`) and tell your user in one line what you're starting.
5. **Build it** to its spec sections and acceptance criteria, on a branch `type/t<nn>-short-name`. Delegate per `.claude/rules/delegation.md` only where it pays: with `PLAN=max`, hand the writing to `builder` (sonnet) so the Opus session plans and verifies; with `PLAN=pro`, build in your own Sonnet session and spawn `builder` or `test-writer` only for independent work that runs in parallel. Every brief carries the files, graph nodes, spec sections and decisions, so the agent doesn't explore; you integrate and verify. Every acceptance criterion gets a test.
6. **Ship and merge** with `ship-pr` (the PR body says `Closes #<n>`). Merge when green.
7. **Repeat** from step 2. Every ~3 tasks, or when context gets long, run `handover` and tell your user to start a fresh session with "go".

## Stop and ask your user (one message, all questions together) when

- The spec contradicts itself, the code, or a contract, or leaves a behaviour open that a task needs. Say exactly which lines conflict, propose an answer, and continue with another unblocked task while waiting.
- A task needs another lane's change: open a handoff, build against a mock of the agreed contract if the spec defines it, otherwise move to the next unblocked task.
- A change would touch shared paths (except the pre-agreed shared paths its issue lists; for those the guard still asks your user, and that's the expected confirmation), the demo path, the design direction, scope, a paid service or a new dependency the spec doesn't name.
- `ship-pr` or CI fails for a reason you can't fix in your lane, or the same failure twice.
- Your usage is near its limit: `handover` first.

## Stop without asking when

- The queue is empty: no open handoffs, no unblocked `task`/`polish` issue in your lane. Run `handover` and tell your user "Nothing unblocked in <lane>", listing what the blocked issues wait on. Never invent work outside the spec.
- The feature freeze time in the spec has passed and the next issue is a `task`: tell your user to run `polish-pass` or `demo-prep`.
