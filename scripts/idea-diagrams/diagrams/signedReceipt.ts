import { type Diagram, MARGIN, node, path, rect, secondaryLine, text, type TextLine } from "../svg";

const NODE_WIDTH = 180;
const NODE_GAP = 32;
const NODE_HEIGHT = 72;
const STAGES = 4;

interface Stage {
  title: string;
  lines: TextLine[];
}

const SIGNING: Stage[] = [
  { title: "git diff base..head", lines: [secondaryLine("fixed options, no user config")] },
  { title: "diffSha256", lines: [secondaryLine("SHA-256 of the diff bytes")] },
  { title: "Receipt", lines: [secondaryLine("checked · not checked"), secondaryLine("residual risk")] },
  { title: "ssh-keygen -Y sign", lines: [secondaryLine("the owner's own SSH key")] },
];

const VERIFYING: Stage[] = [
  { title: "git note", lines: [secondaryLine("refs/notes/countersign"), secondaryLine("append-only")] },
  { title: "Check the signature", lines: [secondaryLine("against allowed_signers")] },
  { title: "Recompute diffSha256", lines: [secondaryLine("same function as above")] },
  { title: "exit 0: merge", lines: [secondaryLine("good signature,"), secondaryLine("diff unchanged")] },
];

// Each failing check blocks the merge with its own exit code.
const FAILURES = [
  { stage: 0, code: "exit 2", reason: "no receipt" },
  { stage: 1, code: "exit 3", reason: "signature invalid" },
  { stage: 2, code: "exit 1", reason: "stale: diff changed" },
];

/** Idea 7: the receipt signed on the owner's machine, and the CI checks that gate the merge on it. */
export function signedReceipt(): Diagram {
  const stageX = Array.from({ length: STAGES }, (_, i) => MARGIN + i * (NODE_WIDTH + NODE_GAP));
  const center = (stage: number) => stageX[stage] + NODE_WIDTH / 2;
  const body: string[] = [text(MARGIN, 34, "At signing, on the owner's machine", "h")];

  SIGNING.forEach(({ title, lines }, i) => {
    body.push(node(stageX[i], 48, NODE_WIDTH, NODE_HEIGHT, title, lines, i === 3 ? "node-acc" : "node"));
    if (i < STAGES - 1) body.push(path(`M${stageX[i] + NODE_WIDTH + 2},84 L${stageX[i + 1] - 3},84`, "ln"));
  });
  // The signed receipt travels from the last signing step to the first verifying step,
  // entering the git note at its right third rather than its middle.
  const noteEntryX = stageX[0] + 150;
  body.push(path(`M${center(3)},122 L${center(3)},150 L${noteEntryX},150 L${noteEntryX},189`, "la", "a"));

  body.push(text(MARGIN, 180, "At merge, in CI", "h"));
  VERIFYING.forEach(({ title, lines }, i) => {
    body.push(node(stageX[i], 192, NODE_WIDTH, NODE_HEIGHT, title, lines, i === 3 ? "node-acc" : "node"));
    if (i < STAGES - 1) {
      const arrow = `M${stageX[i] + NODE_WIDTH + 2},228 L${stageX[i + 1] - 3},228`;
      body.push(path(arrow, i ? "la" : "ln", i ? "a" : "n"));
    }
  });

  for (const { stage, code, reason } of FAILURES) {
    const x = center(stage);
    body.push(path(`M${x},266 L${x},300`, "lr", "r"));
    body.push(rect(x - 90, 304, NODE_WIDTH, 48, "node-rose"));
    body.push(text(x - 74, 332, code, "c"), text(x - 20, 332, reason, "tr"));
  }
  body.push(text(MARGIN, 384, "Any exit code but 0 blocks the merge. The AI drafts the receipt; only the named owner signs it.", "s"));
  return {
    name: "signed-receipt",
    height: 408,
    title: "Signed receipt: sign, store, verify",
    desc:
      "At signing: git diff, its SHA-256, the receipt with what was checked, what wasn't and the residual risk, signed with ssh-keygen and the owner's key. " +
      "At merge in CI: the git note is read, the signature is checked against allowed_signers and the diff hash is recomputed. " +
      "Exit 0 merges; exit 2 no receipt, exit 3 signature invalid, exit 1 stale diff block the merge.",
    body,
  };
}
