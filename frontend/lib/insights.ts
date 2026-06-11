const PRACTICE_ATTEMPTS_KEY = "stepwise-practice-attempts-v1";
const MAX_ATTEMPTS = 200;

export const PRACTICE_TOPICS = [
  { key: "calculus", label: "Calculus" },
  { key: "algebra", label: "Algebra" },
  { key: "arithmetic", label: "Arithmetic" },
  { key: "linear_algebra", label: "Linear algebra" },
] as const;

export const PRACTICE_DIFFICULTIES = ["easy", "medium", "hard"] as const;

const MISTAKE_LABELS: Record<string, string> = {
  missing_term: "Missing term",
  sign: "Sign error",
  coefficient: "Coefficient error",
  constant: "Missing constant",
  not_equivalent: "Not equivalent",
};

export type PracticeAttempt = {
  id: string;
  createdAt: string;
  problemId: string;
  question: string;
  topic: string;
  difficulty: string;
  correct: boolean;
  mistakeKind: string;
  hintsUsed: number;
};

export type InsightBucket = {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  accuracy: number;
  hintDependency: number;
  mastery: number | null;
  masteryLabel: string;
};

export type MistakeFrequency = {
  kind: string;
  label: string;
  count: number;
};

export type LearningInsights = {
  totalAttempts: number;
  correct: number;
  accuracy: number;
  hintDependency: number;
  mostFrequentMistake: MistakeFrequency | null;
  mistakes: MistakeFrequency[];
  byTopic: InsightBucket[];
  byDifficulty: InsightBucket[];
  recommendedTopic: InsightBucket | null;
  recentAttempts: PracticeAttempt[];
};

export function readPracticeAttempts(): PracticeAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRACTICE_ATTEMPTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      const attempt = sanitizeAttempt(value);
      return attempt ? [attempt] : [];
    });
  } catch {
    return [];
  }
}

export function recordPracticeAttempt(
  attempt: Omit<PracticeAttempt, "id" | "createdAt">,
): PracticeAttempt {
  const record: PracticeAttempt = {
    ...attempt,
    hintsUsed: validCount(attempt.hintsUsed),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  writeAttempts([record, ...readPracticeAttempts()].slice(0, MAX_ATTEMPTS));
  return record;
}

export function buildLearningInsights(attempts: PracticeAttempt[]): LearningInsights {
  const validAttempts = attempts.flatMap((value) => {
    const attempt = sanitizeAttempt(value);
    return attempt ? [attempt] : [];
  });
  const correct = validAttempts.filter((attempt) => attempt.correct).length;
  const mistakes = mistakeFrequencies(validAttempts);
  const byTopic = PRACTICE_TOPICS.map(({ key, label }) =>
    buildBucket(key, label, validAttempts.filter((attempt) => attempt.topic === key)),
  );
  const byDifficulty = PRACTICE_DIFFICULTIES.map((key) =>
    buildBucket(key, titleCase(key), validAttempts.filter((attempt) => attempt.difficulty === key)),
  );
  const assessedTopics = byTopic.filter((bucket) => bucket.mastery !== null);
  const recommendedTopic = assessedTopics.length
    ? [...assessedTopics].sort(
        (a, b) => (a.mastery ?? 0) - (b.mastery ?? 0) || a.attempted - b.attempted,
      )[0]
    : null;

  return {
    totalAttempts: validAttempts.length,
    correct,
    accuracy: percentage(correct, validAttempts.length),
    hintDependency: percentage(
      validAttempts.filter((attempt) => attempt.hintsUsed > 0).length,
      validAttempts.length,
    ),
    mostFrequentMistake: mistakes[0] ?? null,
    mistakes,
    byTopic,
    byDifficulty,
    recommendedTopic,
    recentAttempts: validAttempts.slice(0, 8),
  };
}

export function mistakeLabel(kind: string): string {
  return MISTAKE_LABELS[kind] ?? titleCase(kind.replaceAll("_", " "));
}

export function normalizePracticeTopic(value: string | null): string {
  return PRACTICE_TOPICS.find(({ key }) => key === value)?.key ?? PRACTICE_TOPICS[0].key;
}

function buildBucket(key: string, label: string, attempts: PracticeAttempt[]): InsightBucket {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = percentage(correct, attempts.length);
  const hintDependency = percentage(
    attempts.filter((attempt) => attempt.hintsUsed > 0).length,
    attempts.length,
  );
  const mastery = attempts.length
    ? Math.round(accuracy * 0.8 + (100 - hintDependency) * 0.2)
    : null;

  return {
    key,
    label,
    attempted: attempts.length,
    correct,
    accuracy,
    hintDependency,
    mastery,
    masteryLabel: masteryLabel(mastery),
  };
}

function mistakeFrequencies(attempts: PracticeAttempt[]): MistakeFrequency[] {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.correct || attempt.mistakeKind === "correct") continue;
    counts.set(attempt.mistakeKind, (counts.get(attempt.mistakeKind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: mistakeLabel(kind), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function masteryLabel(mastery: number | null): string {
  if (mastery === null) return "Not assessed";
  if (mastery < 50) return "Needs focus";
  if (mastery < 75) return "Developing";
  if (mastery < 90) return "Proficient";
  return "Strong";
}

function sanitizeAttempt(value: unknown): PracticeAttempt | null {
  if (!value || typeof value !== "object") return null;
  const attempt = value as Partial<PracticeAttempt>;
  if (
    typeof attempt.id !== "string" ||
    typeof attempt.createdAt !== "string" ||
    typeof attempt.problemId !== "string" ||
    typeof attempt.question !== "string" ||
    typeof attempt.topic !== "string" ||
    typeof attempt.difficulty !== "string" ||
    typeof attempt.correct !== "boolean" ||
    typeof attempt.mistakeKind !== "string" ||
    !PRACTICE_TOPICS.some(({ key }) => key === attempt.topic) ||
    !PRACTICE_DIFFICULTIES.some((difficulty) => difficulty === attempt.difficulty)
  ) {
    return null;
  }
  return { ...attempt, hintsUsed: validCount(attempt.hintsUsed) } as PracticeAttempt;
}

function writeAttempts(attempts: PracticeAttempt[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRACTICE_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // Learning insights are optional; storage restrictions must not break practice.
  }
}

function percentage(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

function validCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
