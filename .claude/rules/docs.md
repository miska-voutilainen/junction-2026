# Documentation

Partner engineers read the repo. A judge should understand what it does, how it works and why it's built this way in five minutes.

## What exists

| Doc                                  | Contents                                                                                                                                | Changed by                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/spec.md`                       | What we build: product, demo path, screens, data, contracts, AI behaviour, work plan                                                    | A PR the affected lane owners agreed on; never silently by an agent |
| `README.md`                          | One-line pitch, GIF or screenshot, live URL, features, how it uses the partner's tech, quick start, stack, team, how AI tools were used | Every user-visible change                                           |
| `docs/architecture.md`               | One SVG diagram (light and dark), each component in two lines, the demo path's data flow, the AI pipeline (models, prompts, evals)      | Every structural change                                             |
| `docs/decisions.md`                  | Decision log: date, decision, why, alternatives rejected                                                                                | When a decision is made                                             |
| `docs/api.md` (or generated OpenAPI) | Every endpoint: method, path, request, response, errors, an example                                                                     | Every API change                                                    |
| `docs/development.md`                | Clone to running, env vars (names only), commands, testing, deploy, troubleshooting                                                     | Every tooling change                                                |
| `docs/demo.md`, `docs/pitch.md`      | Demo script and pitch                                                                                                                   | `demo-prep`                                                         |
| `CLAUDE.md`                          | Agent instructions: lanes, commands, file tree, workflow                                                                                | When any of those change                                            |
| Doc comments                         | Every exported function, component, hook, route handler and type: summary, why when not obvious, params, returns, throws                | Same commit as the code                                             |

## Rules

- Docs change in the same PR as the code (`ship-pr`: the main session for small syncs, `docs-keeper` for large ones). A PR that makes a doc wrong isn't done.
- Docs are open to every lane (`lanes.md`), and several lanes edit them at once: change only the lines your PR affects, add rather than rewrite, and on a merge conflict keep both sides. Whole-document rewrites of `README.md` and `docs/architecture.md` happen only in `polish-pass` and `demo-prep`.
- When code and spec disagree, the spec wins until a person changes it: fix the code, or raise a `needs-human` question.
- Write for a smart reader new to the project: short sentences, concrete, examples over abstractions, no filler ("simply", "just", "robust", "seamless").
- One fact in one place; link instead of repeating. Relative Markdown links that resolve; never Obsidian `[[wikilinks]]` (GitHub shows them as raw text). Diagrams as SVG images, kept small: a light and a dark file in an `img/` folder next to the page, shown with `<picture>` (as in `docs/ideas/`), system fonts only (GitHub's image rendering can't load web fonts), the app's colour tokens, and alt text that says what the diagram shows.
- Comments say why, not what. No commented-out code; an open TODO names an issue. What a giving comment is, the idea headers and examples: `readability.md`.
- No secrets, keys or real personal data in any doc or example; env var names only.
