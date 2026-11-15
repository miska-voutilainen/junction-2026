# Tools: Graphify, Lightfoot, Obsidian

Every machine runs all three (`setup.md` section 1). They save searching and usage; they never replace the repo, issue #1 or the spec as the record.

## Graphify: the code map

- `graphify-out/` holds a graph of the code: per machine, gitignored, rebuilt after every commit, merge and checkout by Graphify's git hooks (`graphify update .`, no model calls).
- **Before searching** for where something lives, who calls it or what depends on it, ask the graph: `graphify query "<question>" --budget 1500`, `graphify explain "<name>"`, `graphify path "<A>" "<B>"`, or read `graphify-out/GRAPH_REPORT.md` for the map of the whole codebase. Then open only the files it names. If `graphify` isn't on the PATH, use `python -m graphify` (Windows: `py -m graphify`).
- The graph is a map; the code is the truth. Read a file before you edit it. If the graph looks stale (a file it names is gone), run `graphify update .` once and ask again.
- **Never** run `graphify claude install` (it rewrites `CLAUDE.md` and adds a hook to the shared settings) or the full `/graphify` pipeline (it uses model calls, so your usage) without your user's yes.

## Turning points: when to refresh the map and use the vault

| Turning point                                                             | Graphify                                                                                                                                                                             | Obsidian vault (`VAULT`)                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Session start                                                             | The briefing says whether the git hook is installed; if not: `graphify update .` and `graphify hook install`                                                                         | Read the newest note in `$VAULT/Claude Handoffs/` for this project (the briefing names it) before picking up work                       |
| After `git merge origin/main`, a merge of your own PR, or a branch switch | Nothing: the git hook rebuilds the map. Without the hook: `graphify update .`                                                                                                        |                                                                                                                                         |
| After a large refactor or file moves in your branch, before the commit    | `graphify update .`                                                                                                                                                                  |                                                                                                                                         |
| Before searching for code                                                 | `graphify query` first                                                                                                                                                               |                                                                                                                                         |
| After a Lightfoot summary replaced older turns, or a long break           |                                                                                                                                                                                      | Re-read the newest handoff note and your own last summary in the vault                                                                  |
| Handover                                                                  |                                                                                                                                                                                      | Save the #1 summary to `$VAULT/Junction/<lane>/` (`handover` step 5); end the session with `/exit` so Lightfoot writes its handoff note |
| Midpoint and freeze (`polish-pass`)                                       | One full `/graphify . --update` on a **Max** machine (it uses model calls for docs and the spec), optionally `--obsidian --obsidian-dir "$VAULT/Graph"` so people can browse the map |                                                                                                                                         |

**Cost:** `graphify update .` and the git hook make no model calls and take seconds, so refreshing often is free. Only the full `/graphify` pass uses the model: twice in the event, on a Max account, never per task.

## Lightfoot: condensed context

- Your session may run through Lightfoot, which shortens old or very large tool output before it's re-sent. A `[lightfoot: …]` note names the file that holds the full text: read that file (with an offset) instead of re-running the command.
- A Lightfoot summary at the start of a session replaces the oldest turns; your user's requests in it are verbatim. Trust it for progress; read the named history file for an exact detail.
- Nothing about Lightfoot belongs in the repo; project `.lightfoot/` folders ignore themselves.

## Obsidian: personal notes, not the team record

- At the end of a session, Lightfoot writes a handoff note into your user's own Obsidian vault. It helps their next session; the other lanes' agents can't see it. The team's record stays where it was: the summary on issue #1 (`handover`), PRs, handoff issues and `docs/`.
- Docs in the repo use relative Markdown links, never `[[wikilinks]]`: GitHub shows wikilinks as raw text. Anyone who opens the repo or `docs/` as an Obsidian vault turns off "Use [[Wikilinks]]" and sets "New link format" to "Relative path to file"; `.obsidian/` is gitignored.
