# Idea 3 · The hunk coverage map

Every hunk of a change gets exactly one state, Verified, Supported or Read this, from rules a person can read, so the human reads only what no checked evidence covers.

> Draft. The routing spread over Tieto's four changes comes from recorded runs and is "not measured yet".

## The problem

"The AI reviewed it" doesn't tell a person what they still have to read. A review summary covers the change in general, and the person either reads everything anyway or skims and approves. What they need is a reading list: these hunks, and here is what covers the rest. And if a model decides what goes on that list, nobody can explain why a hunk was skipped.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/coverage-map-dark.svg">
  <img src="img/coverage-map-light.svg" alt="First match wins: a hunk is Read this if a finding or refusal lists it, its area is at Shadow, or no Verified or Supported claim lists it; Verified if a Verified claim lists it; otherwise Supported." width="880">
</picture>

1. **Coverage per hunk, first match wins:**
   - **Read this** if a finding or a refusal lists the hunk, if the hunk's area is at Shadow on the ladder ([Idea 1](trust-ladder.md)), or if no Verified or Supported claim lists it.
   - **Verified** if a Verified claim lists it (a test that fails before the change and passes after it).
   - **Supported** otherwise (a claim whose quote matched the code, [Idea 4](quote-check.md)).
2. **A tier for the whole change.** Each rule that fires adds one reason, with its rule id. The tier is the highest any reason asks for; no reasons means Light.

   | Rule | Fires when | Tier |
   | --- | --- | --- |
   | `R-size` | more than 400 changed lines outside generated files | Full |
   | `R-read-share` | 75% or more of the hunks are Read this | Full |
   | `R-refusal` | the AI refused to decide something | Focused |
   | `R-contradiction` | the description contradicts the code | Focused |
   | `R-defect` | a defect was found | Focused |
   | `R-sensitive-path` | a hunk touches a sensitive path (public attributes, diagnostic IDs, the runtime serializer) | Focused |
   | `R-area-level` | a touched area isn't Trusted | Focused |
   | `R-unread` | some hunks are Read this and nothing else fired | Focused |

3. **One honest line on top.** The reviewer sees "Focused · Read 2 of 8 hunks · ~3 min (full read ~9 min)" followed by one line per reason, each with its rule id. Reading time assumes 25 changed lines a minute, and the page says it's an assumption.
4. **No model in the routing.** `route()` is a pure function: the same review and the same ladder levels always give the same tier. It runs in the pipeline and again in the browser, so a simulated escape re-routes the page live.

## What we measured

Not measured yet. The report card will show the routing over all four of Tieto's agent-written changes: how many went Light, Focused and Full, and the hunks and minutes read compared with a full read. The "2 of 8" above is the shape of the line, not a result.

## How to adopt it

- **What you need:** hunks with stable ids, claims that list the hunks they cover, and a ladder level per area (start everything at Shadow).
- **What it costs:** no model calls. It's a few hundred lines of rules and their tests.
- **Smallest first step:** show the three states in your diff view and the "Read r of n hunks" line. Keep your current approval flow; just let the reviewer see what the evidence covers.

## Limits and failure modes

- **Supported isn't proven.** A quote match shows the claim points at real code, not that the claim is right. That's why Supported and Verified are separate states.
- **Lines a minute is a guess.** 25 is our stated assumption, not a measurement of anyone's reading speed.
- **Rules can be gamed.** An agent that learns the rules could split changes under 400 lines. The ladder and the refusals still apply per hunk.

The failure modes we saw (wrong tier calls) go in `docs/lessons.md`.

## In the code

- [`src/rules/route.ts`](../../src/rules/route.ts): `route()`, the rules above in order
- [`src/policy/routing.ts`](../../src/policy/routing.ts): `sizeLimit: 400`, `readShareFull: 0.75`, `linesPerMinute: 25`, the sensitive paths
- Shown on screen S2: the tier banner and the hunk navigator ("Read this", "Supported", "Verified")
