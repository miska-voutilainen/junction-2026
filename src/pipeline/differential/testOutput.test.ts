import { describe, expect, it } from "vitest";
import {
  buildErrorLine,
  classifyTestOutput,
  parseMethodResults,
  trimOutput,
  withoutTimings,
  withoutWorktreePath,
} from "./testOutput";

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

  it("reads the summary block a container prints", () => {
    const failed = "Total tests: 2\n     Passed: 1\n     Failed: 1\nTest Run Failed.";
    expect(classifyTestOutput(failed, 1)).toBe("fail");
    const passed = "Total tests: 3\n     Passed: 3\nTest Run Successful.";
    expect(classifyTestOutput(passed, 0)).toBe("pass");
  });

  it("counts a failure on any target framework", () => {
    const output =
      "Passed!  - Failed:     0, Passed:     1, Total: 1\nFailed!  - Failed:     1, Passed:     0, Total: 1";
    expect(classifyTestOutput(output, 1)).toBe("fail");
  });

  it("reads an assertion message that contains a compiler error as a test failure, not a build error", () => {
    const output = [
      "  Failed A5_F1_Counts [4 ms]",
      "  Error Message:",
      "   // /0/Test0.cs(5,1): error CS0103: The name 'x' does not exist in the current context",
      "Failed!  - Failed:     1, Passed:     0, Skipped:     0, Total:     1",
      "Build FAILED.",
    ].join("\n");
    expect(classifyTestOutput(output, 1)).toBe("fail");
    expect(buildErrorLine(output)).toBeNull();
  });

  it("is no verdict without a summary: build error, no matching test, nothing", () => {
    expect(classifyTestOutput("A.cs(1,1): error CS0246: x [C:/x/T.csproj]", 1)).toBe("error");
    expect(classifyTestOutput("No test matches the given testcase filter", 0)).toBe("error");
    expect(classifyTestOutput("", null)).toBe("error");
  });
});

describe("buildErrorLine", () => {
  it("finds the first MSBuild error, which ends in its project", () => {
    const output = [
      "warning line",
      "A.cs(3,1): error CS0246: The type 'Foo' was not found [C:/x/Tests.csproj]",
      "B.cs(1,1): error CS0001: later [C:/x/Tests.csproj]",
    ].join("\n");
    expect(buildErrorLine(output)).toBe(
      "A.cs(3,1): error CS0246: The type 'Foo' was not found [C:/x/Tests.csproj]",
    );
  });
});

describe("parseMethodResults", () => {
  const output = [
    "  Passed A5Tests.A5_F1_A [< 1 ms]",
    "  Failed A5Tests.A5_F1_B [6 ms]",
    "  Passed Ns.Other.Theory(arg: 1) [1 ms]",
    "  Failed Ns.Other.Theory(arg: 2) [1 ms]",
    "  Passed A5Tests.A5_F1_AB [1 ms]",
  ].join("\n");

  it("gives each requested method its own result, and a theory fails when a row fails", () => {
    expect(parseMethodResults(output, ["A5_F1_A", "A5_F1_B", "Theory"])).toEqual({
      A5_F1_A: "pass",
      A5_F1_B: "fail",
      Theory: "fail",
    });
  });

  it("marks a method the run never reported as missing, and does not match a longer name", () => {
    expect(parseMethodResults(output, ["A5_F1_X", "A5_F1"])).toEqual({
      A5_F1_X: "missing",
      A5_F1: "missing",
    });
  });
});

describe("withoutWorktreePath", () => {
  it("hides the random temp folder in both slash styles", () => {
    const backslash = String.fromCharCode(92);
    const dir = ["C:", "Temp", "cs-a5-x", "base"].join(backslash);
    const output = `at ${dir}${backslash}A.cs and C:/Temp/cs-a5-x/base/B.cs`;
    expect(withoutWorktreePath(output, dir)).toBe(
      `at <worktree>${backslash}A.cs and <worktree>/B.cs`,
    );
  });
});

describe("withoutWorktreePath in a container", () => {
  it("replaces /work but not a longer folder name", () => {
    expect(withoutWorktreePath("at /work/tests/A.cs:line 9 and /workflow/x", "/work")).toBe(
      "at <worktree>/tests/A.cs:line 9 and /workflow/x",
    );
  });
});

describe("withoutTimings", () => {
  it("removes the durations of a run in every form dotnet prints", () => {
    const output = [
      "  Failed A5_F1_X [6 ms]",
      "  Passed A5_F1_Y [< 1 ms]",
      "  Passed A5_F1_Z [1 m 5 s]",
      "  Passed A5_F1_W [2 s]",
      "Failed!  - Failed:     1, Passed:     0, Total:     1, Duration: 376 ms - Tests.dll (net8.0)",
      "Time Elapsed 00:00:35.79",
      " Total time: 2.7057 Seconds",
      "[xUnit.net 00:00:00.47]   Discovering: Tests",
    ].join("\n");
    expect(withoutTimings(output)).toBe(
      "  Failed A5_F1_X\n  Passed A5_F1_Y\n  Passed A5_F1_Z\n  Passed A5_F1_W\nFailed!  - Failed:     1, Passed:     0, Total:     1 - Tests.dll (net8.0)\n[xUnit.net]   Discovering: Tests",
    );
  });
});

describe("trimOutput", () => {
  it("drops build progress, warnings, framework frames and the restore note so the failure stays in the kept tail", () => {
    const noise = [
      "  Restored C:/x.csproj (in 4 ms).",
      "A.cs(1,1): warning CS0105: dup",
      "  Lib -> C:/bin/Lib.dll",
      "All projects are up-to-date for restore.",
      "   at Microsoft.CodeAnalysis.Testing.AnalyzerTest.RunAsync() in /_/x.cs:line 1",
      "   at System.Threading.Tasks.Task.Run()",
      "   at Xunit.Assert.Equal()",
      "--- End of stack trace from previous location ---",
      "",
    ].join("\n");
    const failure = [
      "Failed A5Tests.A5_F1_X",
      "  Error Message:",
      "   Assert.Equal() Failure",
      "  Stack Trace:",
      "     at A5Tests.A5_F1_X() in <worktree>/tests/A5.cs:line 9",
      "Failed!  - Failed: 1, Passed: 0",
    ].join("\n");
    expect(trimOutput(`${noise.repeat(300)}${failure}`)).toBe(failure);
  });

  it("starts a build error excerpt at a whole line, so the first error read from it is not cut mid-path", () => {
    const error =
      "<worktree>/tests/T/A5_F1Tests.cs(58,36): error CS0117: 'Foo' does not contain a definition for 'Bar' [<worktree>/tests/T/T.csproj]";
    const output = `${"Build started, compiling project files ...\n".repeat(60)}${error}\n${error}`;
    const excerpt = trimOutput(output);
    expect(excerpt.length).toBeLessThanOrEqual(2000);
    expect(excerpt.split("\n")[0]).toBe("Build started, compiling project files ...");
    expect(buildErrorLine(excerpt)).toBe(error);
  });

  it("keeps the last 2,000 characters of output with no test lines", () => {
    const trimmed = trimOutput(`${"x".repeat(5000)}END`);
    expect(trimmed).toHaveLength(2000);
    expect(trimmed.endsWith("END")).toBe(true);
  });

  it("keeps each failed test's name, error message and first repository frames when the stack is long", () => {
    const frame = (n: number) =>
      `   at Lib.Deep.Method${n}() in <worktree>/src/Lib/Deep.cs:line ${n}`;
    const output = [
      "  Failed A5Tests.A5_F1_X",
      "  Error Message:",
      "   System.InvalidOperationException : Sequence contains no elements",
      "   second line of the message",
      "  Stack Trace:",
      ...Array.from({ length: 200 }, (_, n) => frame(n)),
      "     at A5Tests.A5_F1_X() in <worktree>/tests/Tests/A5.cs:line 9",
      "  Failed A5Tests.A5_F1_Y",
      "  Error Message:",
      "   Assert.True() Failure",
      "  Stack Trace:",
      "     at A5Tests.A5_F1_Y() in <worktree>/tests/Tests/A5.cs:line 20",
      "",
      "Total tests: 2",
      "     Failed: 2",
    ].join("\n");
    const excerpt = trimOutput(output);
    expect(excerpt.length).toBeLessThanOrEqual(2000);
    expect(excerpt).toContain("System.InvalidOperationException : Sequence contains no elements");
    expect(excerpt).toContain("Method3()");
    expect(excerpt).not.toContain("Method4()");
    expect(excerpt.indexOf("A5_F1_X")).toBeLessThan(excerpt.indexOf("A5_F1_Y"));
    expect(excerpt).toContain("Assert.True() Failure");
    expect(excerpt.endsWith("Total tests: 2\n     Failed: 2")).toBe(true);
  });

  it("keeps the passed tests and the summary when nothing failed", () => {
    const output = [
      "  Passed A5Tests.A5_F1_X",
      "  Passed A5Tests.A5_F1_Y",
      "",
      "Total tests: 2",
      "     Passed: 2",
    ].join("\n");
    expect(trimOutput(output)).toBe(output.trim());
  });
});

describe("adversarial lines", () => {
  const long = (piece: string) => piece.repeat(50_000 / piece.length);
  const fast = (run: () => unknown) => {
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(50);
  };

  it("reads long lines in linear time", () => {
    const lines = [
      `  Passed ${long(" ")}`,
      `  Failed ${long("a ")} [`,
      long("Failed: "),
      `${long(" ")}Failed: 1x`,
      `${long("error CS1: ")}`,
      long(", Duration: "),
      long(" [1"),
      long("[xUnit.net 1:"),
      `  at ${long("Microsoft.")}`,
      long(" -> "),
    ];
    for (const line of lines) {
      fast(() => parseMethodResults(line, ["A"]));
      fast(() => classifyTestOutput(line, 0));
      fast(() => buildErrorLine(line));
      fast(() => withoutTimings(line));
      fast(() => trimOutput(line));
    }
  });
});
