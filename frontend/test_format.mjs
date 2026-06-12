import { fmtByKey, fmtNum, prettyKey } from "./lib/format.ts";
import { readPracticeStats, updatePracticeStats } from "./lib/history.ts";
import { parseMathText } from "./lib/math-text.ts";
import {
  buildLearningInsights,
  normalizePracticeTopic,
  readPracticeAttempts,
  recordPracticeAttempt,
} from "./lib/insights.ts";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(fmtNum(117372), "117,372", "uses stable US grouping");
assertEqual(fmtByKey("order", 2), "2", "derivative order is an integer");
assertEqual(fmtByKey("num_solutions", 3), "3", "solution count");
assertEqual(fmtByKey("rank", 2), "2", "matrix rank");
assertEqual(fmtByKey("definite_integral", 9), "9", "definite integral value");
assertEqual(fmtByKey("x_max", 10.5), "10.5", "plain real");
assertEqual(prettyKey("antiderivative_tex"), "antiderivative (LaTeX)", "pretty key tex");
const mixedMath = parseMathText(String.raw`Use $x^2 \sin(x)$, then \(2x\).`);
assertEqual(mixedMath.length, 5, "mixed explanation is split into prose and math");
assertEqual(mixedMath[1].kind, "inline-math", "dollar-delimited math is detected");
assertEqual(mixedMath[1].value, String.raw`x^2 \sin(x)`, "math delimiters are removed");
assertEqual(mixedMath[3].value, "2x", "parenthesis-delimited math is detected");
assertEqual(parseMathText(String.raw`Result: \[x^2 + 1\]`)[1].kind, "block-math", "display math is detected");

const stored = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
stored.set("stepwise-practice-stats-v1", '{"attempted":"bad","correct":2,"hintsUsed":-1}');
assertEqual(readPracticeStats().attempted, 0, "invalid persisted attempt count is ignored");
assertEqual(readPracticeStats().correct, 2, "valid persisted correct count is retained");
globalThis.localStorage.setItem = () => {
  throw new Error("storage blocked");
};
assertEqual(updatePracticeStats({ attempted: 1 }).attempted, 1, "storage failure does not break progress");

const attempts = [
  {
    id: "1",
    createdAt: "2026-06-11T10:00:00.000Z",
    problemId: "calc-1",
    question: "Differentiate x^2 Sin[x]",
    topic: "calculus",
    difficulty: "medium",
    correct: false,
    mistakeKind: "missing_term",
    hintsUsed: 1,
  },
  {
    id: "2",
    createdAt: "2026-06-11T10:01:00.000Z",
    problemId: "calc-1",
    question: "Differentiate x^2 Sin[x]",
    topic: "calculus",
    difficulty: "medium",
    correct: true,
    mistakeKind: "correct",
    hintsUsed: 1,
  },
  {
    id: "3",
    createdAt: "2026-06-11T10:02:00.000Z",
    problemId: "alg-1",
    question: "Solve x + 4 = 2",
    topic: "algebra",
    difficulty: "easy",
    correct: false,
    mistakeKind: "sign",
    hintsUsed: 0,
  },
];
const insights = buildLearningInsights(attempts);
assertEqual(insights.totalAttempts, 3, "insights count submitted attempts");
assertEqual(insights.accuracy, 33, "insights calculate overall accuracy");
assertEqual(insights.hintDependency, 67, "insights calculate hint dependency");
assertEqual(insights.mostFrequentMistake?.kind, "missing_term", "mistake tie is deterministic");
assertEqual(insights.byTopic[0].mastery, 40, "mastery combines accuracy and independence");
assertEqual(insights.recommendedTopic?.key, "algebra", "weakest assessed topic is recommended");
assertEqual(normalizePracticeTopic("algebra"), "algebra", "recommended topic deep-link is retained");
assertEqual(normalizePracticeTopic("obsolete-topic"), "calculus", "invalid deep-link topic falls back safely");
assertEqual(
  buildLearningInsights([...attempts, { ...attempts[0], id: "bad", topic: "obsolete-topic" }]).totalAttempts,
  3,
  "unsupported persisted topics are ignored",
);

globalThis.localStorage.setItem = (key, value) => stored.set(key, value);
recordPracticeAttempt({
  problemId: "arith-1",
  question: "Evaluate 7 * 8",
  topic: "arithmetic",
  difficulty: "easy",
  correct: true,
  mistakeKind: "correct",
  hintsUsed: 0,
});
assertEqual(readPracticeAttempts().length, 1, "practice attempt is persisted for insights");

console.log("[SUCCESS] format and learning insight tests passed");
