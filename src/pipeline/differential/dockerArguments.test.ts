import { describe, expect, it } from "vitest";
import { DOTNET_SDK_IMAGE, NUGET_VOLUME } from "../../policy/differentialTests";
import { restoreArguments, testArguments, warmupArguments } from "./dockerArguments";

const request = { worktreeDir: "C:\\Temp\\cs-a5-x\\base", projectDir: "tests/X" };

describe("restoreArguments", () => {
  const args = restoreArguments("name-1", request);

  it("runs the pinned image as a non-root user with only the worktree and the NuGet volume mounted", () => {
    expect(args).toContain(DOTNET_SDK_IMAGE);
    expect(args[args.indexOf("--user") + 1]).toBe("1654:1654");
    const mounts = args.flatMap((arg, index) => (args[index - 1] === "-v" ? [arg] : []));
    expect(mounts).toEqual(["C:/Temp/cs-a5-x/base:/work", `${NUGET_VOLUME}:/nuget:rw`]);
  });

  it("restores the project with the network on", () => {
    expect(args).not.toContain("--network");
    expect(args.slice(args.indexOf(DOTNET_SDK_IMAGE) + 1)).toEqual([
      "dotnet",
      "restore",
      "tests/X",
      "--nologo",
    ]);
  });
});

describe("testArguments", () => {
  const args = testArguments("name-2", { ...request, testNames: ["A", "B"] });

  it("turns the network off, drops all capabilities and mounts the NuGet cache read-only", () => {
    expect(args[args.indexOf("--network") + 1]).toBe("none");
    expect(args[args.indexOf("--cap-drop") + 1]).toBe("ALL");
    expect(args).toContain(`${NUGET_VOLUME}:/nuget:ro`);
    expect(args).toContain("--rm");
  });

  it("passes no host environment: only the dotnet settings", () => {
    const variables = args.flatMap((arg, index) => (args[index - 1] === "-e" ? [arg] : []));
    expect(variables.map((variable) => variable.split("=")[0]).sort()).toEqual([
      "DOTNET_CLI_HOME",
      "DOTNET_CLI_TELEMETRY_OPTOUT",
      "DOTNET_NOLOGO",
      "HOME",
      "NUGET_PACKAGES",
    ]);
  });

  it("runs one OR filter without restoring, with the project as its own argument", () => {
    const command = args.slice(args.indexOf(DOTNET_SDK_IMAGE) + 1);
    // The script is fixed text; everything variable is a separate argument after it.
    expect(command.slice(0, 2)).toEqual(["sh", "-c"]);
    expect(command[2]).toContain('exec dotnet "$@"');
    expect(command.slice(3)).toEqual([
      "sh",
      "test",
      "tests/X",
      "--no-restore",
      "--nologo",
      "--disable-build-servers",
      "--logger",
      "console;verbosity=normal",
      "--filter",
      "FullyQualifiedName~A|FullyQualifiedName~B",
    ]);
  });
});

describe("warmupArguments", () => {
  const args = warmupArguments("name-3", { ...request, warmupTestName: "Existing_Test; rm -rf /" });
  const command = args.slice(args.indexOf(DOTNET_SDK_IMAGE) + 1);

  it("keeps the project and the test name out of the shell script", () => {
    expect(command.slice(0, 2)).toEqual(["sh", "-c"]);
    expect(command[2]).not.toContain("tests/X");
    expect(command[2]).not.toContain("Existing_Test");
    expect(command.slice(3)).toEqual(["tests/X", "FullyQualifiedName~Existing_Test; rm -rf /"]);
  });

  it("is the only phase with a model-free repository test and the network on", () => {
    expect(args).not.toContain("--network");
  });
});
