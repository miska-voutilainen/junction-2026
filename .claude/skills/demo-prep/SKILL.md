---
name: demo-prep
description: Make the demo bulletproof and the submission complete - seed data, fallbacks, smoke tests, README, demo script, pitch review and video checklist. Use at the feature freeze, before or alongside polish-pass.
---

# Demo prep

Run by one person at the feature freeze; demo-path fixes it finds become `polish` issues for the owning lane. From here on, only fixes and polish.

1. **Seed data.** One command resets the demo to a known, rich, coherent state: realistic fictional data, no real personal data, no "test" or "asdf" anywhere.
2. **Fallbacks.** Every external call on the demo path (partner APIs, models) has a timeout and a recorded-response fallback behind one flag. Rehearse once with the network off.
3. **Smoke test.** The e2e demo-path suite runs against production after every merge. Add a health check page or endpoint if the host doesn't give one.
4. **Finish the edges judges look at:** page titles, favicon, social preview image, 404 page, no console errors, no visible dev tooling, the production URL works on a phone.
5. **README** for judges: one-line pitch, a GIF or screenshot, the live URL, what it does, how it uses the partner's tech, architecture in one small diagram, what's real vs mocked, how to run locally (`.env.example`), the team, and a short **How we used AI tools** section (the agent setup, the models and what they did, what the people did; technical, a few lines, drawn from the PRs' AI use sections). No secrets.
6. **Demo script** in `docs/demo.md`: exact clicks and lines, timed to the slot, the "wow" moment in the first 30 seconds, and what to say and do if any step fails.
7. **Pitch** in `docs/pitch.md` (problem, user, insight, demo, partner tech, what's next). Run `product-critic` on it with the demo script and screenshots; apply its top three.
8. **Video** (if required): screen recording of the demo script at 1080p+, captions, under the length limit, uploaded and the link tested in a private window.
9. **Submission check:** everything the rules require, repo visibility, licence if needed, all teammates listed, submitted before the deadline (aim for two hours early, then update). Remind your user to restrict or revoke API keys after judging.
