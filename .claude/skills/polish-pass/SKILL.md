---
name: polish-pass
description: Sweep the whole demo path, the docs and the file tree for anything below the quality bar, and turn the findings into polish issues per lane that "go" then fixes. Run by one person at the midpoint and after the feature freeze.
---

# Polish pass

One person runs the sweep; every lane's "go" fixes its own items.

1. **Inventory:** every screen and interaction on the demo path in `docs/spec.md`, plus anything a judge could click from there.
2. **Sweep, in parallel:**
   - `ux-reviewer` on all of them (all states, 375 px and 1440 px)
   - Lighthouse on the main screens (performance, accessibility, best practices; LCP, layout shift)
   - `docs-keeper` as an audit: does every doc match the code, does the README's quick start work from a fresh clone, do all links resolve (report only)
   - `tidy` on the whole tree (report only)
   - on a **Max** machine: the full `/graphify . --update` (model calls, so only here), optionally `--obsidian --obsidian-dir "$VAULT/Graph"`; then `GRAPH_REPORT.md`'s god nodes and orphans go into the triage like any other finding
   - evals, plus ten odd inputs (empty, very long, another language, prompt injection, off-topic): every answer fast, grounded, failing gracefully
3. **Walk it as a stranger** on the deployed app, on a phone and a laptop, once with a throttled network. Note every hesitation, wait, flash of empty content and unclear word.
4. **Triage** into one list ranked by what a judge notices first: broken > slow > confusing > inconsistent > ugly > undocumented > untidy. Drop anything a judge won't see.
5. **File** one issue per item (or per tight group), title `P<nn> <what>`, labels `polish` and the owning `lane:<lane>`, body: where, what's wrong, the fix, the screenshot path. Number them in triage order.
6. Tell your user how many items each lane has; the lanes run "go". Re-run only the sweeps whose area changed once the issues close.

When the team calls the pass done, close what's left as won't-fix. Never add a feature in a polish pass; a fix that turns out to be a feature becomes a `needs-human` question.
