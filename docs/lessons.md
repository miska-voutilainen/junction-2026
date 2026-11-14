# Lessons

<!-- Every failure we saw: quote-check failures, retractions, wrong tiers, model errors. Dated, with what we changed. Newest first. -->

## 2026-11-14 · A5 on mp-2283: the F1 test fails on both versions and retracts two correct claims

- **What happened:** A5 wrote one test for F1 (the generator and analyzer do not throw for a closed generic value type from a referenced assembly) and one for F2. The F1 tests fail on the base and on the head with a generator-verifier assertion from the Roslyn testing library, so the spec's rule retracted claims c3 and c4 (now Unverified, with the head output in `retractions`). The F2 tests could not run (no verdict, claims unchanged). No claim became Verified through A5; the PR's own tests fail on the base and pass on the head, which keeps c1 and c2 at Supported by design.
- **Why:** The sample repository's generator tests compare generated source with expected snapshot files. A test written without seeing the change cannot know the expected output, so it fails on both sides. A test that fails on the head is read as "the claim is wrong", which is not what this failure says.
- **What we changed:** Nothing in the prompt: it is not tuned toward mp-2283. The retraction rule is the spec's. Open question for the people: a head failure whose base run fails with the same message could count as "could not say" instead of a retraction.
