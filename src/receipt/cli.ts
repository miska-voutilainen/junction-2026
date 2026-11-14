/**
 * `pnpm countersign draft|sign|verify|export <changeId>`: the receipt CLI.
 * Commands return the lines to print or throw a CommandError; only this file
 * turns them into output and an exit code, so tests call the commands directly.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CommandError, type ReceiptOptions } from "./context";
import { defaultSshKeygenPath } from "./sshKeygen";
import { draftReceipt } from "./draft";
import { exportReceipt } from "./exportReceipt";
import { signReceipt } from "./sign";
import { verifyReceipt } from "./verify";

const usage = `Usage: pnpm countersign <draft|sign|verify|export> <changeId>
  draft  [--owner <github-login>] [--force]
  sign   [--key <path>]   (default ~/.ssh/countersign_ed25519)
  verify
  export`;

type FlagValues = { owner?: string; force?: boolean; key?: string };

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      owner: { type: "string" },
      force: { type: "boolean" },
      key: { type: "string" },
    },
  });
  const [command, changeId] = positionals;
  const isKnownCommand = ["draft", "sign", "verify", "export"].includes(command);
  // The id goes into file paths, so only plain ids are accepted.
  if (!changeId || !isKnownCommand || !/^[a-z0-9-]+$/i.test(changeId)) {
    console.error(usage);
    return 1;
  }
  const lines = await runCommand(command, changeId, optionsFromEnv(), values);
  for (const line of lines) console.log(line);
  return 0;
}

function runCommand(
  command: string,
  changeId: string,
  options: ReceiptOptions,
  values: FlagValues,
): Promise<string[]> {
  if (command === "draft")
    return draftReceipt(changeId, options, {
      ownerOption: values.owner,
      force: values.force,
    });
  if (command === "sign") return signReceipt(changeId, options, { keyOption: values.key });
  if (command === "export") return exportReceipt(changeId, options);
  if (command === "verify")
    return verifyReceipt(changeId, options).then((verified) => verified.lines);
  throw new CommandError(1, usage);
}

/** The project root is the working directory: pnpm runs scripts from it. */
function optionsFromEnv(): ReceiptOptions {
  // Same source as pnpm seed: pnpm doesn't load .env, and a variable seed found
  // there but this CLI didn't would fail with "not set" right after seeding.
  if (existsSync(".env")) process.loadEnvFile();
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir) {
    throw new CommandError(
      1,
      "SAMPLE_REPO_DIR is not set. Add it to .env as the absolute path of the fork's clone (see .env.example), then run pnpm seed.",
    );
  }
  if (!existsSync(repoDir)) {
    throw new CommandError(1, `SAMPLE_REPO_DIR ${repoDir} does not exist. Run pnpm seed.`);
  }
  const projectRoot = process.cwd();
  const dataDir = process.env.COUNTERSIGN_DATA_DIR ?? join(projectRoot, "data");
  return {
    repoDir,
    dataDir,
    draftsDir: join(projectRoot, ".scratch", "receipts"),
    allowedSignersPath:
      process.env.COUNTERSIGN_ALLOWED_SIGNERS ?? join(dataDir, "sample", "allowed_signers"),
    sshKeygenPath: defaultSshKeygenPath,
  };
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof CommandError ? error.exitCode : 1;
  });
