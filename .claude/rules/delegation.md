# Delegation and models

The main session is the orchestrator: it holds the plan, makes the judgment calls and integrates the work. Anything well-specified, mechanical, parallelisable or context-heavy goes to a subagent on the right model. Subagents are on call all the time; use them.

## Who does what

| Task | Agent | Model | Why this model |
| --- | --- | --- | --- |
| Plan, architecture, hard bugs, UX and product direction, integrating results, talking to your user | main session | opus | Judgment and the full context |
| Review a diff for bugs, security, AI robustness | `code-reviewer` | inherit (opus on Max, sonnet on Pro) | Misses here cost the demo |
| Review UI from screenshots | `ux-reviewer` | inherit (opus on Max, sonnet on Pro) | Visual judgment |
| Judge the idea, demo and pitch | `product-critic` | opus | Strategic judgment |
| Build a well-specified change from a written brief (a component from the design system, an endpoint to a contract, seed data, a refactor across files) | `builder` | sonnet | Strong coding, cheaper and faster than opus |
| Write unit and e2e tests | `test-writer` | inherit (opus on Max, sonnet on Pro) | Coding with a spec |
| A large doc sync (small ones: the main session) | `docs-keeper` | sonnet | Clear writing from a diff |
| A hard-to-tell tier L PR description | `pr-writer` | sonnet | Well-written prose from facts |
| Research an external API, SDK or library (docs, examples, limits) | `researcher` | sonnet | Accurate reading of long docs |
| Find code, trace a call, dig through logs or test output | `scout` | haiku | Fast and cheap; returns only the conclusion |
| Check and fix the file tree, names, stray files | `tidy` | haiku | Mechanical rules |

## Plans and effort

The team: **Miska on Max 5x; Elias and Veijo on Pro.** `PLAN` in each machine's `.claude/settings.local.json` says which (setup.md section 3), and the briefing shows it.

| | Max (`PLAN=max`) | Pro (`PLAN=pro`) |
| --- | --- | --- |
| Main session | Opus at **`/effort medium`** for routine "go" work (the builder subagents do the writing); `high` for an integration or a tricky bug; **`max` only for kickoff and a bug stuck after two attempts**, then straight back to `medium` | Sonnet (`"model": "sonnet"`), effort capped at `medium` by `CLAUDE_CODE_EFFORT_LEVEL` |
| Subagents | `code-reviewer`, `ux-reviewer` and `test-writer` follow the session model (`model: inherit`), so Opus here; `code-reviewer` at `high`, `ux-reviewer` at `medium` effort; `product-critic` opus at `max` (three runs in the event); `builder`, `docs-keeper`, `pr-writer`, `researcher` on sonnet; `scout`, `tidy` on haiku | The same files resolve to Sonnet here (they follow the Sonnet session), and the machine caps their effort at `medium`. No per-call override needed; never run `product-critic` here |
| `product-critic`, `polish-pass`, the full Graphify pass | Run here | Ask Miska: they run on the Max account |
| A tier L PR | `code-reviewer` on opus, passing `effort: "xhigh"` only for the demo-path core and the AI pipeline | `code-reviewer` on sonnet; for the demo-path core or the AI pipeline, ask Miska to run one opus review from his machine (`gh pr checkout <n>`, then `code-reviewer`) |

Effort and model cost usage together: one opus review at `xhigh` can use more of a Pro window than an hour of sonnet building.

**Fewer, better-briefed subagents.** The same habits that cut a previous project's subagent usage from about 60% of the window to about 8%: one review per PR instead of several; small doc syncs and PR bodies written by the main session; every agent told to keep it cheap; briefs that carry files, graph nodes and spec sections so agents don't explore; the graph rebuilt per milestone, not per task.

## Usage guardrails (Miska's Max account is the one that can't run out)

The heavy work is front-loaded: kickoff at `max` is a one-off of under an hour. After that the Max account must last two days, so:

- **Before kickoff:** check `/usage`, both the 5-hour window and the **weekly** limit. If the week is already well used, run kickoff at `high` instead of `max`.
- **Watch it live:** `lightfoot status-line install` shows the share of the 5-hour window in Claude Code's status line.
- **Checkpoints:** at every `handover` and at T+6, T+12, T+24 and the freeze, check `/usage`. If the 5-hour window is past 60% with more than half of it left, or the weekly limit is past 50% before the midpoint: main session to `/model sonnet` for mechanical work, reviews at tier M, and `product-critic` only for the pitch.
- **Delegate the writing:** the main session plans, briefs and verifies; `builder` and `test-writer` on sonnet write the code. An Opus main session that writes code itself is the fastest way to empty the window.
- **Short sessions:** `handover` and a fresh session every ~3 tasks; Lightfoot trims the rest.
- **If it runs out anyway:** `handover`, then keep going on Sonnet in a new session, or log Claude Code in with a Console API key that has a spending limit (pay per token, no usage window; partner credits often cover it). Another person's account is never the fallback.

The model aliases (`opus`, `sonnet`, `haiku`) resolve to the newest model of each tier. Each agent's model is the `model:` line in its file in `.claude/agents/`; to change it, edit that line and this table together. To override it for one run, pass a model when starting the agent.

## When to delegate

- **Delegate** when the task can be written as a brief of a few lines with a clear done-condition, when it would flood your context (searching, long logs, long docs), or when it can run in parallel with your own work.
- **Do it yourself** when it takes one or two tool calls, when it needs the conversation's context to get right, or when it's a judgment call your user expects from you.
- **Never delegate** decisions: architecture, what to cut, UX direction, anything that changes the demo path. Agents propose; you and your user decide.

## How to delegate

1. **Brief like a colleague who wasn't in the room:** the goal, the files and contracts involved, the decisions already made, the done-condition (tests passing, matches design tokens...), and what not to touch. Subagents start cold; every file you name saves them a search.
2. **Run independent agents in parallel** (e.g. `builder` on the endpoint, `test-writer` on its tests from the contract, `researcher` on the partner API), but only when they write different files. Only `builder` commits; for everything else, you review the changes and commit them.
3. **Verify what comes back:** read the diff, run the checks. A subagent's "done" is a claim until you've seen the output.
4. **Follow up with the same agent** (SendMessage) instead of starting a new one; it keeps its context.
5. Don't nest: subagents don't spawn subagents.

## Keep context small (every plan)

- `/clear` between unrelated tasks, `/compact` on long ones; a long conversation costs more on every turn. Hand subagents file paths and graph nodes instead of letting them explore (`tools.md`).
- On Pro, `/model opus` only for a hard bug or an architecture call, then back. Before any account nears its limit: `handover` first, so no work is stuck in a session you can't open.
