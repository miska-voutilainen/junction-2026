# Quality bar

The judges and partners ship production software for a living (frontier AI labs, GPU companies, top accelerators). They notice a spinner that never ends, a layout that breaks at 375 px and a model answer that takes 12 seconds. The product must feel finished. **Cut scope, never quality.**

## Definition of done (every user-facing change)

A feature is done only when all of these hold. If one can't be met in time, cut the feature, not the item.

- **States:** loading (skeletons, not bare spinners, for anything over ~300 ms), empty (explains what to do next), error (says what happened and offers a retry or way out), success. No raw error messages, stack traces or `undefined` on screen.
- **Responsive:** works at 375 px, 768 px and 1440 px without horizontal scroll, overlap or cut-off text.
- **Accessible:** keyboard reachable with a visible focus ring, labels on inputs and icon buttons, WCAG AA contrast, semantic elements, respects reduced motion.
- **Fast:** the first meaningful screen in under 2 s on venue Wi-Fi; interactions respond in under 100 ms (optimistic UI where it helps); long AI calls stream.
- **Consistent:** only design tokens and shared components (`.claude/rules/design.md`); no one-off colours, sizes or spacing.
- **Copy:** clear, specific, consistent tone; no lorem ipsum, "TODO", "test", placeholder names or developer jargon visible anywhere.
- **Data:** real data or credible, coherent seeded data. Nothing obviously fake on the demo path.
- **Clean console:** no errors or warnings in the browser console or server logs on the demo path.
- **Tested:** core logic has unit tests; the demo path has an end-to-end test that passes against the deployed preview.
- **Reviewed** at the tier `ship-pr` assigns: no subagent for small, low-risk PRs; `code-reviewer` for normal ones; full review for the demo-path core, AI, auth, data and contracts.

## Scope

- Build what `docs/spec.md` says, nothing more. Three flawless demo steps beat ten rough ones; when time runs short, propose to your user what to cut, with the trade-off.
- No half-built features on screen: hide or remove anything that doesn't work end to end. No dead buttons, links or menu items.
- Nothing from the spec's Out of scope; anything in scope is finished completely.
- Stuck on one approach after two failed attempts (install fight, flaky API)? Switch to a simpler route that still meets the spec and log it in `docs/decisions.md`; if no such route exists, ask.
- After the feature freeze in the spec: only fixes and polish.
