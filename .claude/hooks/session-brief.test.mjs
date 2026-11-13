import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDependsOn, queueStatus, summariseSyncComment, nextStep } from "./session-brief.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("parseDependsOn", () => {
  assert.deepEqual(parseDependsOn("Intro\n\nDepends on: none\n"), []);
  assert.deepEqual(parseDependsOn("no such line"), []);
  assert.deepEqual(parseDependsOn("Depends on: #3, #12"), [3, 12]);
  assert.deepEqual(parseDependsOn("Depends on: #4 · see #99 for context"), [4]);
  assert.deepEqual(parseDependsOn("Depends on: none · mentions #7"), []);
});

test("queueStatus", () => {
  const issue = (o) => ({ number: 5, title: "t", body: "Depends on: #1, #2", labels: [{ name: "task" }], assignees: [], ...o });
  assert.equal(queueStatus(issue({}), [1, 2], "me").state, "ready");
  const b = queueStatus(issue({}), [1], "me");
  assert.equal(b.state, "blocked");
  assert.deepEqual(b.blockedBy, [2]);
  assert.equal(queueStatus(issue({ labels: [{ name: "task" }, { name: "needs-human" }] }), [1, 2], "me").state, "needs-human");
  assert.equal(queueStatus(issue({ assignees: [{ login: "Me" }] }), [1, 2], "me").state, "ready");
  assert.equal(queueStatus(issue({ assignees: [{ login: "other" }] }), [1, 2], "me").state, "assigned");
  assert.equal(queueStatus(issue({ body: "Depends on: none" }), [], "me").state, "ready");
});

test("summariseSyncComment", () => {
  const body = "[agent:engine] Summary\n\n**Done:** pipeline skeleton (#12)\n- For other lanes: app needs the Review type\nNext: eval harness\nUnrelated line";
  assert.deepEqual(summariseSyncComment(body), [
    "Done: pipeline skeleton (#12)",
    "For other lanes: app needs the Review type",
    "Next: eval harness",
  ]);
  assert.deepEqual(summariseSyncComment("## Done\nthing one\n## Next\nthing two"), ["Done: thing one", "Next: thing two"]);
  assert.deepEqual(summariseSyncComment("nothing here"), []);
});

test("nextStep order", () => {
  const queue = [
    { number: 3, title: "blocked one", state: "blocked" },
    { number: 4, title: "Build it", state: "ready" },
  ];
  const handoffs = [{ number: 9, title: "h" }];
  assert.match(nextStep({ lane: undefined, queue, handoffs }), /join/);
  assert.match(nextStep({ lane: "engine", plan: null, queue }), /join/);
  assert.match(nextStep({ lane: "engine", missingSummary: true, handoffs, queue }), /missing summary/);
  assert.match(nextStep({ lane: "engine", handoffs, queue }), /Answer the handoffs/);
  assert.equal(nextStep({ lane: "engine", handoffs: [], queue }), "Next task: #4 Build it");
  assert.equal(nextStep({ lane: "engine", handoffs: [], queue: [queue[0]] }), "Nothing unblocked in engine.");
});

test("end to end run exits 0 and prints the lane line", () => {
  const r = spawnSync("node", [join(here, "session-brief.mjs")], {
    input: '{"source":"clear"}',
    encoding: "utf8",
    timeout: 45000,
    cwd: join(here, "..", ".."),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Lane/);
});
