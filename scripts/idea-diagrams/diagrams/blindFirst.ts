import { type Diagram, MARGIN, node, path, secondaryLine, text, type TextLine } from "../svg";

const COLUMNS = 5;
const COLUMN_WIDTH = 140;
const COLUMN_GAP = 29;
const NODE_HEIGHT = 64;

interface Lane {
  y: number;
  heading: string;
  isBlindFirst: boolean;
  nodes: { title: string; lines: TextLine[]; cssClass: string }[];
}

const LANES: Lane[] = [
  {
    y: 40,
    heading: "Anchored: the way most AI review works today",
    isBlindFirst: false,
    nodes: [
      { title: "Author's", lines: [secondaryLine("description, read first")], cssClass: "node" },
      { title: "A1 skipped", lines: [secondaryLine("no expectation")], cssClass: "node-dash" },
      { title: "A2 story", lines: [secondaryLine("and claims")], cssClass: "node" },
      { title: "A4 checks", lines: [secondaryLine("the description")], cssClass: "node" },
      { title: "caught x of 15", lines: [secondaryLine("not measured yet")], cssClass: "node" },
    ],
  },
  {
    y: 180,
    heading: "Blind-first: Countersign's order",
    isBlindFirst: true,
    nodes: [
      { title: "Requirement", lines: [secondaryLine("read first")], cssClass: "node-acc" },
      { title: "A1 expectation", lines: [secondaryLine("before any code")], cssClass: "node-acc" },
      { title: "A2 story", lines: [secondaryLine("and claims")], cssClass: "node-acc" },
      { title: "A4 checks the", lines: [secondaryLine("description, read last")], cssClass: "node-acc" },
      { title: "caught y of 15", lines: [secondaryLine("not measured yet")], cssClass: "node-acc" },
    ],
  },
];

/** Idea 2: the same five steps in the anchored order and in the blind-first order. */
export function blindFirst(): Diagram {
  const columnX = Array.from({ length: COLUMNS }, (_, i) => MARGIN + i * (COLUMN_WIDTH + COLUMN_GAP));
  const body: string[] = [];
  for (const { y, heading, isBlindFirst, nodes } of LANES) {
    body.push(text(MARGIN, y, heading, "h"));
    const top = y + 16;
    const arrowY = top + NODE_HEIGHT / 2;
    nodes.forEach(({ title, lines, cssClass }, i) => {
      body.push(node(columnX[i], top, COLUMN_WIDTH, NODE_HEIGHT, title, lines, cssClass));
      if (i < COLUMNS - 1) {
        const arrow = `M${columnX[i] + COLUMN_WIDTH + 2},${arrowY} L${columnX[i + 1] - 3},${arrowY}`;
        body.push(path(arrow, isBlindFirst ? "la" : "ln", isBlindFirst ? "a" : "n"));
      }
    });
  }
  body.push(text(MARGIN, 300, "Same reviewer, same 5 planted false sentences, 3 runs per mode: 15 chances to catch them in each lane.", "s"));
  body.push(text(MARGIN, 320, "A plant is caught when A4 marks the planted sentence contradicted or unsupported.", "s"));
  return {
    name: "blind-first",
    height: 344,
    title: "Anchored versus blind-first review order",
    desc:
      "Two lanes with the same steps. Anchored: the author's description is read first, A1 is skipped, then A2 and A4. " +
      "Blind-first: the requirement first, A1 writes an expectation before any code, then A2, and A4 reads the description last. " +
      "Each lane gets 15 chances to catch 5 planted false sentences; the counts are not measured yet.",
    body,
  };
}
