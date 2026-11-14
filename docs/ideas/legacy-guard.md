# Idea 9 · The legacy guard

New code keeps the fast path. Every place a change touches what old systems rely on becomes a touch point with a kind, a named owner and a guard: the evidence that the touch is safe. A guard never takes a hunk off the reading list. It tells the owner what covers the touch, and a touch without a guard raises the tier.

Tieto's engineer told us (2026-11-14) that they run old infrastructure, that new agent code breaking old code is the main risk ("nothing passes that breaks old code"), and that tests on legacy code matter most. This idea is that sentence as a rule.

## The problem

An agent-written change can be correct, pass its tests and still break a system nobody in the PR knows about: a service on .NET Framework, a Unity build that can't upgrade, a reader that expects yesterday's bytes. Path ownership (a code-owners file) says who must approve a path. It doesn't say why that touch matters or what evidence covers it. CI on modern targets can't notice that no test ever runs the branch an old target compiles.

## How it works

1. **Touch kinds, each with its own guard.** One rule table per repository (`src/policy/legacy.ts`, `src/policy/legacyTouch.ts`); ours is an example for MessagePack-CSharp, and Tieto writes its own.

   | Kind | Detector (no model) | Owner | Guard |
   | --- | --- | --- | --- |
   | Legacy code | the hunk is in a legacy zone (reflection resolvers, wire format, Unity client), or reaches into one: it changes a symbol zone code calls, or calls a symbol a zone declares | runtime or Unity owner | a test that existed before the change references it |
   | Old platform | an `#if` on `NETFRAMEWORK`, `NETSTANDARD*` or `UNITY*` | platform owner | a test project for that code runs on that target |
   | Consumer contract | public declarations, wire attributes and diagnostic ids changed in a hunk (not in comments; not the analyzer-only source generator, except ids), or the contract paths | API owner | the same change adds release notes or docs for consumers |
   | Build and dependencies | project files, `Directory.*.props`, package versions, `global.json` | build owner | none a rule can check: the owner always reads it |

2. **Every touch stays on the reading list.** Each hunk in a legacy zone gets refusal R8 "Legacy contract: behaviour that old systems depend on" from code, not from the model. A refusal is the coverage map's first row ([Idea 3](coverage-map.md)), so no Verified claim and no ladder level ([Idea 1](trust-ladder.md)) can move it off.
3. **The guard sets the tier.** `R-legacy` names each zone and its owner (Focused, Full from 5 legacy hunks). `R-legacy-guard` gives one line per touch: unguarded goes to Full, partly guarded or owner-read goes to Focused, and guarded adds a line at Light, so the owner sees what covers it.
4. **Guards come from before the change.** A test counts as a guard only if it was in the base commit, so the authoring agent didn't write it ([Idea 8](separation-of-duties.md)).
5. **The model never sees R8.** It doesn't know the zone map, so R8 lives outside the refusal rules the model reads, and adding it didn't change the measured reviewer ([decision](../decisions.md)).

`pnpm review legacy <changeId>` adds the touch points to a recorded review in place, with no model call. It replaces the R8 refusals it added before and appends the new ones after the others, so existing refusal ids never change. A hunk an `R7` refusal already gives to the API owner gets no second refusal for a consumer-contract touch.

## What we measured

On Tieto's four changes (recorded reviews in `data/runs/`, `pnpm review legacy`):

| Change | Touch points | Guard |
| --- | --- | --- |
| `mp-2283` | none | none needed |
| `mp-2234` | none | none needed |
| `mp-2297` | old platform: `#if !NETSTANDARD2_0 && !NETFRAMEWORK` in 11 hunks (7 C# template files and 4 `.tt` templates) | **Unguarded.** The three source-generator test projects (Tests, ExecutionTests, MapModeExecutionTests) target net8.0 only; the library ships netstandard2.0, netstandard2.1, net8.0 and net472 |
| `mp-2129` | consumer contract: `Attributes.cs` and the analyzer, in 4 hunks | **Guarded** by `AnalyzerReleases.Unshipped.md` and `doc/analyzers/` MsgPack019 to 022 and the index |

Reach-in by symbol name found nothing on the four diffs. The prototype's only hits were false positives (`this.Write` in T4 templates), which is why the detector drops calls through `this`. No tier changed: `mp-2297` and `mp-2129` were already Full. So on this sample the guard adds reasons and an owner to read, not a higher tier. Four changes is a small sample, and the one finding (an old-platform branch no test project runs) is a single change.

## How to adopt it

- **You need:** a list of the paths old systems rely on, with an owner each. Start with the zones and the old targets you still ship.
- **It costs:** no model calls. `git grep` on the base commit and path rules; 659 lines in seven files (`legacy.ts` 79, `legacyTouch.ts` 87, `refusalPolicy.ts` 15, `legacyTouchPoints.ts` 319, `baseTree.ts` 59, `csharpSymbols.ts` 57, `addLegacyGuard.ts` 43) and 271 lines of tests, plus the two routing rules in `route.ts`.
- **First step:** add the old-platform and consumer-contract kinds. They need no zone map, and they find touches that ownership by path misses.

## Limits and failure modes

- **Name matching is coarse.** Reach-in matches identifiers by name, not by type, so `this.Write` in a template looks like a call into `MessagePackWriter.Write`. We drop calls through `this` and common framework names. A false touch costs one read; it never lets a hunk skip one.
- **A test that mentions a symbol may not test it.** A guarded touch means an old test names the code, not that it checks the behaviour that matters. Running the guard tests on base and head is the next step (not built).
- **A web service has other contract shapes.** For one, the same rule reads endpoint shapes (`[HttpGet]`/`[Route]`, `MapGet`, route files, OpenAPI specs). Not built: Tieto's sample has none.
- **The zone map is ours,** written from the repository's layout, not from Tieto's systems.

## In the code

- [`src/policy/legacy.ts`](../../src/policy/legacy.ts): zones, owners, `legacyTouchFull`, rule R8
- [`src/policy/legacyTouch.ts`](../../src/policy/legacyTouch.ts): touch kinds and what counts as each
- [`src/policy/refusalPolicy.ts`](../../src/policy/refusalPolicy.ts): R1 to R7 plus R8, policy v2
- [`src/pipeline/legacyTouchPoints.ts`](../../src/pipeline/legacyTouchPoints.ts): the detectors and guards
- [`src/lib/git/baseTree.ts`](../../src/lib/git/baseTree.ts): what the guards read from the base commit
- [`src/pipeline/csharpSymbols.ts`](../../src/pipeline/csharpSymbols.ts): the C# declarations and calls a hunk adds or removes
- [`src/pipeline/addLegacyGuard.ts`](../../src/pipeline/addLegacyGuard.ts): adds touch points to a recorded review
- [`src/rules/route.ts`](../../src/rules/route.ts): `R-legacy` and `R-legacy-guard`
- Shown on S2: the legacy touch list under the tier banner
