import type { AskResponse, HistoryItem, PracticeCheckResponse, PracticeRevealResponse } from "./types";

const HISTORY_KEY = "stepwise-history-v1";
const PRACTICE_STATS_KEY = "stepwise-practice-stats-v1";
const MAX_HISTORY = 60;

export type PracticeStats = {
  attempted: number;
  correct: number;
  hintsUsed: number;
};

export function readHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTutorHistory(question: string, result: AskResponse): HistoryItem | null {
  if (!result.tool || result.verification.scope === "none") return null;
  return saveHistory({
    source: "tutor",
    question,
    tool: result.tool,
    tool_args: result.tool_args ?? {},
    values: result.values,
    wolfram_code: result.wolfram_code,
    summary: result.verified_answer,
  });
}

export function savePracticeHistory(
  question: string,
  result: PracticeCheckResponse | PracticeRevealResponse,
  summary: string,
): HistoryItem {
  return saveHistory({
    source: "practice",
    question,
    tool: result.tool,
    tool_args: result.tool_args,
    values: result.values,
    wolfram_code: result.wolfram_code,
    summary,
  });
}

export function deleteHistory(ids: string[]): HistoryItem[] {
  const remaining = readHistory().filter((item) => !ids.includes(item.id));
  writeLocal(HISTORY_KEY, remaining);
  return remaining;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // History is optional; storage restrictions must not break the tutor.
  }
}

export function readPracticeStats(): PracticeStats {
  if (typeof window === "undefined") return { attempted: 0, correct: 0, hintsUsed: 0 };
  try {
    const parsed = JSON.parse(localStorage.getItem(PRACTICE_STATS_KEY) ?? "{}") as Partial<PracticeStats>;
    return {
      attempted: validCount(parsed.attempted),
      correct: validCount(parsed.correct),
      hintsUsed: validCount(parsed.hintsUsed),
    };
  } catch {
    return { attempted: 0, correct: 0, hintsUsed: 0 };
  }
}

export function updatePracticeStats(delta: Partial<PracticeStats>): PracticeStats {
  const current = readPracticeStats();
  const next = {
    attempted: current.attempted + (delta.attempted ?? 0),
    correct: current.correct + (delta.correct ?? 0),
    hintsUsed: current.hintsUsed + (delta.hintsUsed ?? 0),
  };
  writeLocal(PRACTICE_STATS_KEY, next);
  return next;
}

function saveHistory(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  const record: HistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const previous = readHistory().filter(
    (existing) => !(existing.question === record.question && existing.tool === record.tool),
  );
  writeLocal(HISTORY_KEY, [record, ...previous].slice(0, MAX_HISTORY));
  return record;
}

function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; computation and verification must remain usable.
  }
}

function validCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
