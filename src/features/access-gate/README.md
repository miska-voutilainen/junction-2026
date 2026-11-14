# Access gate

One four-digit code that unlocks the whole site. It is temporary: it stays until the final submission on Sun 15.11 and then goes.

A proxy (`src/proxy.ts`) sends every visitor without the right cookie to `/unlock`. The cookie holds the sha256 of the code, so changing the code signs everyone out.

## Kill switch

`ACCESS_CODE` empty or unset turns the gate off: every page is open and `/unlock` answers with a 307 to `next`. The real code lives only in Vercel's environment settings, never in the repo. Vercel applies an env change only to new deployments: after changing it, redeploy (Deployments, then Redeploy).

## Removal

1. Delete `src/features/access-gate/`, `src/proxy.ts` and `src/app/unlock/`, and the `@keyframes unlock-pulse` block in `src/app/globals.css`.
2. Remove `ACCESS_CODE` from `.env.example` and from Vercel.
3. Delete `e2e/unlock.ts` and its calls in the specs, and `e2e/gate.spec.ts`.
4. Remove the access-gate lines from the File tree in `CLAUDE.md`.

Then `pnpm build` passes.
