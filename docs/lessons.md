# Lessons

<!-- Every failure we saw: quote-check failures, retractions, wrong tiers, model errors. Dated, with what we changed. Newest first. -->

## 2026-11-14 · A5 on mp-2129, mp-2234 and mp-2297: tests that did not build on the base left two reviews all Supported

- **What happened:** With `a5.v2` in Docker, no claim was retracted on any of the three changes. mp-2297 (mostly generated code) has 7 claims Verified and 6 Supported; 4 test methods tell the versions apart and none fail on the head. mp-2129 has 17 claims, all Supported, and 18 test entries without a verdict (4 files in another test project, 14 methods that do not build on the base); mp-2234 has 10 claims, all Supported, and 3 (1 file in another test project, 2 methods that do not build on the base). The build errors are `CS0117` and `CS0535`: the tests call generated members the base version does not have.
- **Why:** A5 writes tests blind to the change, so a test that needs an API the change introduces cannot compile on the base. The runner reads that as "no verdict", never as a failure of the claim, so the claims stay Supported instead of being retracted or promoted.
- **What we changed:** Nothing. We recorded the reviews as they came out and did not tune the prompts to these three changes. Each review lists the tests that could not run in `inconclusiveTests`.

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
