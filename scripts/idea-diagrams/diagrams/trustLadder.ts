import {
  codeLine,
  type Diagram,
  label,
  MARGIN,
  path,
  rect,
  secondaryLine,
  text,
  type TextLine,
} from "../svg";

interface Step {
  x: number;
  top: number;
  title: string;
  lines: TextLine[];
  tint?: string;
}

const STEP_WIDTH = 230;
const STEP_BOTTOM = 330;

// Each step starts higher than the last, so the staircase reads as climbing.
const STEPS: Step[] = [
  {
    x: 32,
    top: 210,
    title: "Shadow",
    lines: [
      codeLine("planted < 3"),
      codeLine("or caught < 60%"),
      secondaryLine("Runs, but routes nothing:"),
      secondaryLine("a human reads every hunk"),
    ],
  },
  {
    x: 325,
    top: 150,
    title: "Calibrated",
    tint: "tint-acc",
    lines: [
      codeLine("caught ≥ 60% of ≥ 3"),
      codeLine("clean spot checks < 5"),
      secondaryLine("Routes the change"),
      secondaryLine("Focused at best"),
    ],
  },
  {
    x: 618,
    top: 90,
    title: "Trusted",
    tint: "tint-acc2",
    lines: [
      codeLine("clean spot checks ≥ 5"),
      secondaryLine("Can route a change"),
      secondaryLine("Light"),
    ],
  },
];

// The gap after each lower step: its left edge and that step's top, where the arrows start.
const GAPS = STEPS.slice(0, -1).map((step) => ({
  x: step.x + STEP_WIDTH,
  lowerTop: step.top,
}));

/** Idea 1: the three steps of the trust ladder, with the arrows that move an area up or down. */
export function trustLadder(): Diagram {
  const body = [
    text(
      MARGIN,
      34,
      "One ladder per review area: generator, analyzer, security, performance",
      "secondary",
    ),
  ];
  for (const { x, top, title, lines, tint } of STEPS) {
    body.push(rect(x, top, STEP_WIDTH, STEP_BOTTOM - top, tint ? "node-acc" : "node"));
    if (tint) body.push(rect(x, top, STEP_WIDTH, STEP_BOTTOM - top, tint));
    body.push(text(x + 16, top + 28, title, "title"));
    lines.forEach(([content, cssClass], index) =>
      body.push(text(x + 16, top + 52 + 18 * index, content, cssClass)),
    );
  }
  for (const { x, lowerTop } of GAPS) {
    body.push(path(`M${x + 4},${lowerTop + 30} L${x + 58},${lowerTop - 20}`, "la", "accent"));
    body.push(label(x + 31, lowerTop - 30, "evidence", "accent-text"));
    body.push(path(`M${x + 58},${lowerTop + 60} L${x + 6},${lowerTop + 60}`, "lr", "rose"));
    body.push(label(x + 32, lowerTop + 80, "escape", "rose-text"));
  }
  body.push(
    text(
      MARGIN,
      360,
      "An area climbs on evidence and drops one level after each escape. People set the thresholds in src/policy/ladder.ts.",
      "secondary",
    ),
  );
  return {
    name: "trust-ladder",
    height: 384,
    title: "Trust ladder: Shadow, Calibrated, Trusted",
    desc:
      "Three rising steps. Shadow: fewer than 3 planted bugs or a catch rate under 60%, the AI routes nothing. " +
      "Calibrated: at least 60% caught of at least 3, fewer than 5 clean spot checks, routes Focused at best. " +
      "Trusted: 5 or more clean spot checks, can route Light. Evidence moves an area up; an escape moves it down one level.",
    body,
  };
}
