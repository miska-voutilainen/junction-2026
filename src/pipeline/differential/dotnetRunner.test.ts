import { describe, expect, it } from "vitest";
import {
  classifyTestOutput,
  dotnetEnvironment,
  dotnetTestArguments,
  trimOutput,
} from "./dotnetRunner";

describe("classifyTestOutput", () => {
  it("passes a green run", () => {
    const output =
      "Passed!  - Failed:     0, Passed:     2, Skipped:     0, Total:     2, Duration: 1 s";
    expect(classifyTestOutput(output, 0)).toBe("pass");
  });

  it("fails a run with a failed test", () => {
    const output =
      "  Failed A5_F1_Counts [4 ms]\nFailed!  - Failed:     1, Passed:     0, Skipped:     0, Total:     1";
    expect(classifyTestOutput(output, 1)).toBe("fail");
  });

  it("counts a failure on any target framework", () => {
    const output =
      "Passed!  - Failed:     0, Passed:     1, Total: 1\nFailed!  - Failed:     1, Passed:     0, Total: 1";
    expect(classifyTestOutput(output, 1)).toBe("fail");
  });

  it("does not read dotnet's Build FAILED after a failed test as a build error", () => {
    const output =
      "Failed!  - Failed:     1, Passed:     0, Total:     1\n\nBuild FAILED.\n    0 Error(s)";
    expect(classifyTestOutput(output, 1)).toBe("fail");
  });

  it("is not a verdict when the code does not build, even with failures listed", () => {
    const output = "A.cs(3,1): error CS0246: The type 'Foo' could not be found\nBuild FAILED.";
    expect(classifyTestOutput(output, 1)).toBe("error");
  });

  it("is not a verdict when no test matches the filter", () => {
    expect(classifyTestOutput("No test matches the given testcase filter", 0)).toBe("error");
  });

  it("is not a verdict when there is no summary at all", () => {
    expect(classifyTestOutput("", null)).toBe("error");
  });
});

describe("dotnetTestArguments", () => {
  it("joins the names into one OR filter and passes the project as its own argument", () => {
    expect(
      dotnetTestArguments({ worktreeDir: "w", projectDir: "tests/X", testNames: ["A", "B"] }),
    ).toEqual([
      "test",
      "tests/X",
      "--nologo",
      "--filter",
      "FullyQualifiedName~A|FullyQualifiedName~B",
    ]);
  });
});

describe("dotnetEnvironment", () => {
  it("passes the build's variables and leaves secrets out", () => {
    const env = dotnetEnvironment({ PATH: "/bin", ANTHROPIC_API_KEY: "secret", HOME: "/h" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.HOME).toBe("/h");
    expect(env.DOTNET_CLI_TELEMETRY_OPTOUT).toBe("1");
  });
});

describe("trimOutput", () => {
  it("drops build progress and warnings so the test result stays in the kept tail", () => {
    const noise = [
      "  Restored C:/x.csproj (in 4 ms).",
      "A.cs(1,1): warning CS0105: dup",
      "  Lib -> C:/bin/Lib.dll",
      "",
    ].join("\n");
    const result = "Failed A5_F1_Counts [4 ms]\nFailed!  - Failed: 1, Passed: 0";
    expect(trimOutput(`${noise.repeat(300)}${result}`)).toBe(result);
  });

  it("keeps the last 2,000 characters", () => {
    const trimmed = trimOutput(`${"x".repeat(5000)}END`);
    expect(trimmed).toHaveLength(2000);
    expect(trimmed.endsWith("END")).toBe(true);
  });
});
