import { type Diagram, MARGIN, path, rect, secondaryLine, text, type TextLine } from "../svg";

const CARD_TOP = 44;
const CARD_WIDTH = 180;
const CARD_HEIGHT = 104;

interface Level {
  title: string;
  tint: string | null;
  cssClass: string;
  lines: TextLine[];
  readerChecks: string;
}

const LEVELS: Level[] = [
  {
    title: "Verified",
    tint: "tint-acc2",
    cssClass: "node-acc",
    lines: [secondaryLine("A test fails on base"), secondaryLine("and passes on head")],
    readerChecks: "both test outputs",
  },
  {
    title: "Supported",
    tint: "tint-acc",
    cssClass: "node-acc",
    lines: [secondaryLine("A quoted citation"), secondaryLine("matched the code")],
    readerChecks: "file:41–48 + quote",
  },
  {
    title: "Unverified",
    tint: null,
    cssClass: "node",
    lines: [secondaryLine("The model said it;"), secondaryLine("no citation matched")],
    readerChecks: "the claim only",
  },
];

/** Idea 6: the three evidence levels, the Refused card beside them, and the confidence score we never show. */
export function evidenceLevels(): Diagram {
  const body: string[] = [
    path("M572,30 L36,30", "ln", "neutral"),
    text(304, 22, "stronger evidence", "secondary", "middle"),
  ];
  LEVELS.forEach(({ title, tint, cssClass, lines, readerChecks }, index) => {
    const x = MARGIN + index * CARD_WIDTH;
    // The middle card has square corners so the three levels read as one strip.
    const rx = index === 1 ? 0 : 6;
    body.push(rect(x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, cssClass, rx));
    if (tint) body.push(rect(x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, tint, rx));
    body.push(text(x + 16, 72, title, "title"));
    lines.forEach(([content, lineClass], lineIndex) =>
      body.push(text(x + 16, 94 + 17 * lineIndex, content, lineClass)),
    );
    body.push(
      text(x + 16, 176, "Reader checks:", "secondary"),
      text(x + 16, 194, readerChecks, "code"),
    );
  });

  // Refused sits apart from the strip: it is a rule applying, not weaker evidence.
  body.push(
    rect(628, CARD_TOP, 220, CARD_HEIGHT, "node-amber"),
    rect(628, CARD_TOP, 220, CARD_HEIGHT, "tint-amber"),
  );
  body.push(text(644, 72, "Refused", "title"));
  body.push(
    text(644, 94, "Not the AI's decision:", "secondary"),
    text(644, 111, "a written rule applies", "secondary"),
  );
  body.push(
    text(644, 176, "Reader checks:", "secondary"),
    text(644, 194, "R7 · API owner decides", "code"),
  );

  body.push(text(MARGIN, 240, "Never shown:", "title"), text(126, 240, "confidence: 0.92", "code"));
  body.push('<line class="strike" x1="122" y1="236" x2="250" y2="236"/>');
  body.push(
    text(262, 240, "the model's opinion of itself, which no reader can check", "secondary"),
  );
  return {
    name: "evidence-levels",
    height: 266,
    title: "Evidence levels instead of confidence",
    desc:
      "Three levels from strongest to weakest: Verified, a test fails on base and passes on head; Supported, a quoted citation matched; " +
      "Unverified, no citation matched. Separately, Refused: a written rule says the AI doesn't decide. The model's confidence is never shown.",
    body,
  };
}
