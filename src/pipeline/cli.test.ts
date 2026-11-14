import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cliPath = path.join(__dirname, "cli.ts");

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    encoding: "utf8",
    cwd: path.join(__dirname, "../.."),
  });
}

describe("pipeline CLI", () => {
  it("rejects --anchored and --run until T13", () => {
    for (const flag of [["--anchored"], ["--run", "1"]]) {
      const result = runCli("run", "mp-2283", "--no-tests", ...flag);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("available after T13");
    }
  });

  it("asks for --no-tests while A3 to A5 do not exist", () => {
    const result = runCli("run", "mp-2283");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--no-tests");
  });

  it("prints usage for an unknown command", () => {
    const result = runCli("frobnicate", "mp-2283");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pnpm pipeline run <changeId>");
  });

  it("says which command records a review when check finds none", () => {
    const result = runCli("check", "no-such-change");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pnpm pipeline run no-such-change");
  });
}, 30_000);
