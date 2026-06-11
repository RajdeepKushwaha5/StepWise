import { fmtByKey, fmtNum, prettyKey } from "./lib/format.ts";
import { readPracticeStats, updatePracticeStats } from "./lib/history.ts";

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

console.log("[SUCCESS] format tests passed");
