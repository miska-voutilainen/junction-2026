# Readable code and giving comments

Tieto grades two things beyond the concept: **code a person can read** and **comments that give the reader something**. Their engineers will open our files to take ideas into their own product, so the code is part of the pitch. It should read like a worked example of the concept, not like hackathon code.

Applies to every file a person or agent writes: app, pipeline, CLIs, tests, scripts. `builder`, `test-writer` and `docs-keeper` write to it; `code-reviewer` checks it on every review.

## Readable code

- **A reader new to the project understands a function in one pass**, without jumping to other files. If they can't, the code changes, not just the comments.
- **Names in the domain's words**, written out: `readHunks`, `catchRate`, `refusalRule`, `diffSha256`; not `rh`, `cr`, `data`, `item`, `tmp`, `res`, `handle()`. Booleans read as questions: `isStale`, `hasPassingCitation`.
- **One job per function**, short (aim under ~40 lines), at one level of detail. The top-level function reads like the steps of the idea; helpers below it do the details.
- **Top-down order:** the main export first, then the helpers it calls, in the order it calls them.
- **Plain control flow:** early returns over nesting; no nested ternaries; no clever one-liners, chained reductions or regexes without a comment showing an example match.
- **No magic values:** every threshold or limit is a named constant (policy values live in `src/policy/`), and its comment says why that number.
- **Explicit types at every boundary** (exports, data files, model output); inferred types inside are fine.
- **Errors say what happened and what to do next**, in words: `"No receipt for mp-2283. Run pnpm countersign sign mp-2283 first."`, not `"not found"`.

## Giving comments

A giving comment tells the reader something the code can't: **why** it's done this way, **what idea it serves**, **what would go wrong** without it, or **an example**. If deleting the comment loses nothing, delete it.

### Three kinds, all required where they apply

1. **Idea header** at the top of every module that implements one of the concept's ideas: two to five lines naming the idea in plain words, why it exists, and the spec section. The eight ideas and their homes:
   - Planted-bug calibration and the trust ladder: `src/rules/ladder.ts`, `src/policy/ladder.ts`, eval scoring in `src/pipeline/`
   - Blind-first review: `src/prompts/a1.ts`, `src/prompts/a4.ts`, the pipeline's step order
   - Hunk coverage map and routing: `src/rules/route.ts`, `src/policy/routing.ts`
   - Mechanical quote check: the quote check in `src/pipeline/`
   - Refusal policy: `src/policy/refusals.ts`
   - Evidence levels: `src/contracts/common.ts`, the A5 test runner
   - Signed receipt in git: `src/receipt/`, `src/lib/git/diffIdentity.ts`
   - The author never checks its own work: the A5 test runner (the PR's own test gives Supported at most), `src/receipt/` (the AI drafts, a person signs)
2. **Doc comment on every export** (`docs.md`): one-line summary, the why when it isn't obvious, params, returns, throws, and a short example for anything with a non-obvious input or output.
3. **Inline why-comments** at decisions, trade-offs, workarounds and gotchas: the reason, the alternative rejected, the failure it prevents, or a link to the issue, `docs/decisions.md` entry or spec section.

### Examples

```ts
// Bad: repeats the code.
// Loop over the citations and check each one.

// Bad: says nothing a reader can use.
// Handle the edge case.

// Giving: why, and what goes wrong without it.
// Compare whitespace-normalised text: the model often re-indents quoted code,
// and an exact match would count those as hallucinations when they aren't.

// Giving: the idea, in words a product team can take away.
/**
 * Hunk coverage: turns a review into a reading list. Every hunk gets exactly
 * one state, Verified, Supported or Read this, so the human reads only what no
 * checked evidence covers ("Read 2 of 8 hunks"). Pure rules, no model call,
 * so the routing is explainable line by line. Spec section 5, route().
 */
```

### Never

- Comments that restate the code, narrate the change ("added X", "now uses Y", "fixed"), or name who or what wrote it (no "AI-generated", no agent or model names).
- Commented-out code, or a TODO without an issue number.
- Filler: "simply", "just", "robust", "seamless", "magic", "handles everything".
- A comment that's out of date with the code next to it. When you change code, update its comments in the same commit.
