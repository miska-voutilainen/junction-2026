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
  it("rejects a --run that is not a whole number from 1", () => {
    for (const value of ["0", "x", "1.5"]) {
      const result = runCli("run", "mp-2283", "--run", value);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("--run takes a whole number from 1");
    }
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
