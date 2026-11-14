# Lessons

<!-- Every failure we saw: quote-check failures, retractions, wrong tiers, model errors. Dated, with what we changed. Newest first. -->

## 2026-11-14 · A5 on mp-2283, second recording: two claims Verified, the F2 test did not build

- **What happened:** With `a5.v2` the F1 tests (no exception from the generator and analyzer for a closed generic value type from a referenced assembly) fail on the base and pass on the head, so claims c3 and c4 are Verified. The PR's own tests also fail on the base and pass on the head; they keep c1 and c2 at Supported by design. The F2 tests did not build on the base (`CS0104: AnalyzerOptions is an ambiguous reference`): no verdict, claims unchanged, the reason stored in `inconclusiveTests`. No retractions.
- **What we changed:** Nothing for this change specifically. The one prompt edit was generic (see the entry below).

## 2026-11-14 · A5 on mp-2283, first recording: tests that fail on both versions retracted two correct claims

- **What happened:** A5 wrote one test for F1 (the generator and analyzer do not throw for a closed generic value type from a referenced assembly) and one for F2. The F1 tests fail on the base and on the head with a generator-verifier assertion from the Roslyn testing library, so the spec's rule retracted claims c3 and c4 (now Unverified, with the head output in `retractions`). The F2 tests could not run (no verdict, claims unchanged). No claim became Verified through A5; the PR's own tests fail on the base and pass on the head, which keeps c1 and c2 at Supported by design.
- **Why:** The sample repository's generator tests compare generated source with expected snapshot files. A test written without seeing the change cannot know the expected output, so it fails on both sides. A test that fails on the head is read as "the claim is wrong", which is not what this failure says.
- **What we changed (Miska decided):** A5 retracts only when a test passes on the base and fails on the head. A test that fails on both versions, or does not build, says nothing: the claim stays and the reason goes into `inconclusiveTests`. The A5 prompt (`a5.v2`) now says the model cannot know generated output and must assert behaviour directly. The `a5.v1` recordings were deleted.
