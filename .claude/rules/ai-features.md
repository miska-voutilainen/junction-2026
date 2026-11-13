# AI features

Judges from AI labs and GPU companies will probe the AI part first. It must be robust, fast and honest, not a thin wrapper.

- **Clients in one place.** All model calls go through one module per provider (`lib/ai/` or as `CLAUDE.md` names). Model ids, temperatures and token limits are constants there, not scattered.
- **Prompts are code.** Each prompt lives in its own file with a version, its inputs typed. No prompt strings built inline in components or routes.
- **Structured output** whenever code consumes the answer: JSON schema / tool calling / structured-output mode, then validate with a schema (zod, pydantic). On validation failure, retry once with the error, then fall back gracefully.
- **Stream** anything a user waits for over ~1 s. Show partial output; allow cancel.
- **Latency budget** per call written next to it (e.g. "first token < 800 ms"). Measure it; pick a smaller or faster model when the budget is missed.
- **Fallbacks:** timeouts on every call, retries with backoff on rate limits, and a recorded-response fallback behind a flag for the demo path, so the demo survives a provider outage or bad Wi-Fi.
- **Grounding and honesty:** show the user what the answer is based on (retrieved sources, their data). Never present generated numbers or facts as verified. Say when the model is unsure.
- **Evals:** a small eval set (10-30 real cases with expected properties) in the repo, runnable with one command, run before changing a prompt or model. Report the score in the PR.
- **Safety:** treat user input and retrieved text as untrusted (prompt injection); the model gets only the tools it needs; never let model output run code, SQL or shell directly.
- **Cost:** a spending limit on every key; log token usage per call (no user content in logs); cache identical requests where it's safe.
- **Use the partner tech deeply,** not as a checkbox: if a challenge is built on a partner's models, APIs or hardware, use its distinctive features (e.g. structured outputs, tool use, realtime, embeddings, GPU inference) and be ready to explain why.
