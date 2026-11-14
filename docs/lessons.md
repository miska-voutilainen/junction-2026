# Lessons

<!-- Every failure we saw: quote-check failures, retractions, wrong tiers, model errors. Dated, with what we changed. Newest first. -->

## 2026-11-14 · The 93 findings on planted-bug runs that match no plant

- **What happened:** The 30 planted-bug runs (10 plants, 3 runs each) produced 117 findings; 24 match their plant by the eval's rule. The report card leaves the other 93 unscored, so the share of wrong findings is unknown, and it's the first thing a reviewer of an AI reviewer asks.
- **What we measured, without a person:** for each of the 93, whether a defect or missing finding on the variant's parent change (`data/runs/<parent>/review.json`, recorded without the plant) cites the same file and side with lines within ±3, the eval's own tolerance; and whether another run of the same variant has a finding there. Result: 56 are `missing` (a test or a check the change lacks), 37 `defect`. 70 sit where the parent change's review also has a finding, so the plant didn't cause them; 74 recur in another run of the same variant; 78 do one or both. 15 appear in one run only and nowhere on the parent.
- **What it means:** most of the unscored findings are the reviewer repeating what it says about Tieto's change itself, not noise the plants provoked. That says they're consistent, not that they're right: whether the parent's findings are real still needs a person, and the 15 one-off findings are the likeliest false positives. This is a count we ran once by hand from the committed runs; the report card doesn't compute it.
- **What we changed:** nothing in the scorer; [trust-ladder.md](ideas/trust-ladder.md) quotes the split.

## 2026-11-14 · Independent audit of the eight ideas against the recorded data

- **What we did:** A script outside the test suite parsed every recorded file against its schema, re-ran `route()` on the four Tieto reviews, and re-checked each citation with plain `git show` in the fork, not with the pipeline's quote check. It also checked the evidence rules (no Verified claim without an A5 test that fails on the base and passes on the head; none on the PR's own test alone), the ladder thresholds, the fixed refusals and the receipt against the review. 54 recorded reviews, 1,421 citations: no violation. `pnpm countersign verify mp-2283` exits 0, and the 53 demo-path e2e specs pass on a production build.
- **What it found that wasn't logged:** the report card's Shadow legend said a person reads only the hunks no checked evidence covers; `route()` sends every hunk of a Shadow area to a person, which is why mp-2297 shows 7 Verified claims and "Read 21 of 21" (#212). Reasons in mp-2129's `inconclusiveTests` start mid-word because the build error line is read from an output excerpt that can begin mid-line (#213). The concept card quoted "55 of 473 hunks" without saying that 402 are generated snapshots: outside them a person reads 55 of 71 (#214). 93 of 117 findings on planted-bug runs are not scored, so the false-positive rate is unknown (#217).
- **Confirmed, already logged above:** blind-first shows no advantage at 10 of 10 per mode (#216 tracks harder plants); tests of new API can't build on the base, so mp-2129 and mp-2234 have no Verified claim (#215 tracks the rule change). The quote check passed 1,421 of 1,422 quotes on real runs, so its value on screen rests on that one failure and the unit tests.
- **What we changed:** the legend and the S2 hunk line (#212), the concept card (#214). The rest are open issues.

## Correction (2026-11-14)

The entry below, "Security caught 0 of 3 planted bugs: all three are real misses", was partly wrong. Under rv1, A3 did spot v03 and v10 but filed them as `scope-creep`, which the eval rightly doesn't count (spec 9.1), so the "three real misses" was partly a labelling miss.

- **What we changed:** `a3.v2` tells A3 to file wrong out-of-scope code as a defect. Each planted bug now runs 3 times and counts as caught when at least 2 of 3 runs catch it ([decisions.md](decisions.md)).
- **Result on rv2:** v06 is caught in 3 of 3 runs. v03 and v10 got no finding in any of 3 runs, so on rv2 they are detection misses. Security is 1 of 3 and stays at Shadow; the R2 and R6 refusals still send every security hunk to a person, which is the point of the ladder.
- **Scorer:** not changed after seeing results.

## 2026-11-14 · Security caught 0 of 3 planted bugs: all three are real misses

- **What happened:** The eval scored v03, v06 and v10, the three security plants, as missed (one run each). Miska, who can read the answer keys, compared each key with its run's findings using the eval's own matching rule. In all three runs no defect or missing finding cites the planted file at all. They are not near misses: no finding sits a few lines off or carries the wrong area.
- **What it means:** On this sample, A3 does not find security defects on its own, so the measured level is right. Security stays at Shadow: the AI's output routes nothing in that area, and every security hunk stays on the reading list. This is the trust ladder doing its job, and the pitch says so with the number: 0 of 3.
- **What we changed:** Nothing in the scoring or the prompts. A prompt tuned to these three plants would score better and measure nothing. Three plants is a small sample: a fairer measure needs more security plants written blind, scored at 2 runs each.

## 2026-11-14 · A5 on mp-2129, mp-2234 and mp-2297: tests that did not build on the base left two reviews all Supported

- **What happened:** With `a5.v2` in Docker, no claim was retracted on any of the three changes. mp-2297 has 7 claims Verified and 6 Supported; 4 test methods tell the versions apart and none fail on the head. mp-2129 and mp-2234 add new API, so the tests of the feature, A5's and the pull request's, do not compile on the base commit and get no verdict under the rule. mp-2129: 17 claims, all Supported; 7 A5 and 7 PR test methods have a build error on the base, and 4 PR test files sit in another test project. mp-2234: 10 claims, all Supported; 2 PR test methods have a build error on the base and 1 test file sits in another test project. The build errors are `CS0117` and `CS0535`: the tests call members the base version does not have.
- **Why:** A test that needs an API the change introduces cannot compile on the base. The runner reads that as no verdict, never as a failure of the claim, so the claims stay Supported. A build error in one file also blocks every test in that project build on that side, so a good test can inherit the error of its neighbour.
- **What we changed (Miska decided):** Nothing: the rule stays and the recordings ship as they came out. We did not tune the prompts to these changes. Known limit and follow-up: count "does not compile on the base, passes on the head" as Verified only when the base error is in A5's own file and names a symbol the diff adds.

## 2026-11-14 · A5 on mp-2283, final recording: two claims Verified by two methods, the F2 tests did not build

- **What happened:** With `a5.v2`, in Docker, A5 wrote three methods for F1 and two for F2. Two F1 methods (`A5_F1_ClosedGenericStructFromReferencedAssembly_DoesNotThrow`, `A5_F1_ClosedGenericRecordStructFromReferencedAssembly_DoesNotThrow`) fail on the base and pass on the head, so claims c3 and c4 are Verified. The PR's own tests (3 of 3) also fail on the base and pass on the head; they keep c1 and c2 at Supported by design. Both F2 methods did not build on the base (`CS0104: AnalyzerOptions is an ambiguous reference`), so they said nothing and the F2 claims are unchanged; the reason is stored in `inconclusiveTests`. No retractions.
- **What we changed:** The runner now reads results per test method, so one failing method cannot hide behind passing neighbours. A test run is classified from its test summary, not from the words "error CS" in an assertion message. Tests run in Docker (restore with the network, test with none). The list of the PR's own tests ends a method at its closing brace, so `Generics_Defined_In_ReferencedProject` (an unchanged test before an added helper) is no longer counted as the PR's.

## 2026-11-14 · A5 on mp-2283, first recording: tests that fail on both versions retracted two correct claims

- **What happened:** A5 wrote one test for F1 (the generator and analyzer do not throw for a closed generic value type from a referenced assembly) and one for F2. The F1 tests fail on the base and on the head with a generator-verifier assertion from the Roslyn testing library, so the spec's rule retracted claims c3 and c4 (now Unverified, with the head output in `retractions`). The F2 tests could not run (no verdict, claims unchanged). No claim became Verified through A5; the PR's own tests fail on the base and pass on the head, which keeps c1 and c2 at Supported by design.
- **Why:** The sample repository's generator tests compare generated source with expected snapshot files. A test written without seeing the change cannot know the expected output, so it fails on both sides. A test that fails on the head is read as "the claim is wrong", which is not what this failure says.
- **What we changed (Miska decided):** A5 retracts only when a test passes on the base and fails on the head. A test that fails on both versions, or does not build, says nothing: the claim stays and the reason goes into `inconclusiveTests`. The A5 prompt (`a5.v2`) now says the model cannot know generated output and must assert behaviour directly. The `a5.v1` recordings were deleted.

## 2026-11-14 10:59 · Anchored versus blind-first

No-go: no advantage for blind-first, so the pitch drops the claim. Blind-first caught 10 of 10, anchored 10 of 10 (5 plants, 2 runs per mode).

Both modes caught every contradiction plant in every run (10 of 10 each), so at n = 2 runs per mode the count cannot separate them; the plants were likely too easy. The blind runs of cp0, cp1 and cp2 share A1 and A2 per run number (same recording, one Tieto change), so those runs are not independent. What we changed: the pitch drops the blind-first claim, and moment 2 leads with the contradiction and the refusals.
