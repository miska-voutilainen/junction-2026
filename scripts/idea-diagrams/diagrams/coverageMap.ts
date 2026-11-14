import { type Diagram, label, MARGIN, path, rect, text } from "../svg";

const QUESTION_X = MARGIN;
const QUESTION_WIDTH = 400;
const QUESTION_HEIGHT = 44;
const QUESTION_STRIDE = 64;
// The flow runs down this vertical line, 24 px right of the question boxes' left edge.
const FLOW_X = 56;
const ANSWER_X = 560;
const ANSWER_WIDTH = 288;
const ANSWER_ARROW_END_X = 557;

// Asked top to bottom; the first yes decides. Yes to any of the first three means Read this.
const QUESTIONS = [
  { y: 80, text: "A finding or a refusal lists it?" },
  { y: 144, text: "Its area is at Shadow on the ladder?" },
  { y: 208, text: "No Verified or Supported claim lists it?" },
  { y: 272, text: "A Verified claim lists it?" },
];

/** Idea 3: the questions that give every hunk exactly one state, first match wins. */
export function coverageMap(): Diagram {
  const body: string[] = [];
  body.push(rect(MARGIN, 24, 120, 32, "node", 16));
  body.push(text(92, 45, "Each hunk", "title", "middle"));
  body.push(path(`M${FLOW_X},56 L${FLOW_X},${QUESTIONS[0].y - 3}`, "ln"));
  for (const { y, text: question } of QUESTIONS) {
    body.push(rect(QUESTION_X, y, QUESTION_WIDTH, QUESTION_HEIGHT));
    body.push(text(QUESTION_X + 16, y + 27, question, "title"));
    body.push(
      path(`M${FLOW_X},${y + QUESTION_HEIGHT} L${FLOW_X},${y + QUESTION_STRIDE - 3}`, "ln"),
    );
    body.push(label(66, y + QUESTION_HEIGHT + 14, "no", "secondary", "start"));
  }

  // One "Read this" terminal serves the first three questions.
  body.push(
    rect(ANSWER_X, 80, ANSWER_WIDTH, 172, "node-amber"),
    rect(ANSWER_X, 80, ANSWER_WIDTH, 172, "tint-amber"),
  );
  body.push(
    text(580, 156, "Read this", "title"),
    text(580, 176, "A person reads the hunk.", "secondary"),
  );
  for (const { y } of QUESTIONS.slice(0, 3)) {
    body.push(
      path(`M${QUESTION_X + QUESTION_WIDTH},${y + 22} L${ANSWER_ARROW_END_X},${y + 22}`, "ln"),
    );
    body.push(label(496, y + 16, "yes"));
  }

  body.push(
    rect(ANSWER_X, 272, ANSWER_WIDTH, 44, "node-acc"),
    rect(ANSWER_X, 272, ANSWER_WIDTH, 44, "tint-acc2"),
  );
  body.push(
    text(580, 299, "Verified", "title"),
    text(650, 299, "a test tells base and head apart", "secondary"),
  );
  body.push(
    path(`M${QUESTION_X + QUESTION_WIDTH},294 L${ANSWER_ARROW_END_X},294`, "la", "accent"),
    label(496, 288, "yes", "accent-text"),
  );

  body.push(
    rect(QUESTION_X, 336, QUESTION_WIDTH, 44, "node-dash"),
    text(QUESTION_X + 16, 363, "Otherwise", "title"),
  );
  body.push(
    rect(ANSWER_X, 336, ANSWER_WIDTH, 44, "node-acc"),
    rect(ANSWER_X, 336, ANSWER_WIDTH, 44, "tint-acc"),
  );
  body.push(
    text(580, 363, "Supported", "title"),
    text(660, 363, "a quoted citation matched", "secondary"),
  );
  body.push(path(`M${QUESTION_X + QUESTION_WIDTH},358 L${ANSWER_ARROW_END_X},358`, "ln"));

  body.push(
    text(
      MARGIN,
      412,
      "First match wins. Then the tier rules (R-size to R-unread) set the change to Light, Focused or Full,",
      "secondary",
    ),
  );
  body.push(text(MARGIN, 430, "and the reviewer sees one line: Read r of n hunks.", "secondary"));
  return {
    name: "coverage-map",
    height: 452,
    title: "Hunk coverage: first match wins",
    desc:
      "Each hunk is checked in order. If a finding or refusal lists it, its area is at Shadow, or no Verified or Supported claim lists it, " +
      "it is Read this. Else if a Verified claim lists it, it is Verified. Otherwise it is Supported.",
    body,
  };
}
