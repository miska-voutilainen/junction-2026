---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/tests/**"
  - "**/e2e/**"
  - "**/evals/**"
---

# Testing

Three layers, each with one command in `CLAUDE.md`:

1. **Unit** (Vitest/Jest/pytest): core logic, data transforms, parsers of partner data, API handlers, prompt-output validation. Fast; runs in the Stop hook.
2. **End-to-end** (Playwright): the demo path, step by step, against the local app and the deployed preview. Also one run at 375 px. Checks no console errors on the way.
3. **Evals** (`.claude/rules/ai-features.md`): model behaviour on the eval set.

- Tests sit next to the code (`foo.ts` → `foo.test.ts`); e2e in `e2e/`, evals in `evals/`, unless the stack has a convention.
- Name tests by behaviour: `it('shows a retry button when the model call times out')`.
- Mock only network edges (partner APIs, model calls) with recorded responses; don't mock your own code. E2E against the preview uses real services.
- E2E uses stable selectors (roles and labels first, `data-testid` otherwise), never CSS classes or text that copy edits will change.
- Every acceptance criterion of a task has a test that checks it.
- A test that fails because the code is wrong is a bug report, not a reason to change the test.
- Unit suite under a minute; e2e under three.
