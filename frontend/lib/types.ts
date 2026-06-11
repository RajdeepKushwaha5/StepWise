export type VerifiedValue = number | number[] | string | string[] | boolean;

export type Discrepancy = {
  kind?: "numeric" | "symbolic";
  headline_key: string | null;
  verified: number | string | null;
  raw_value: number | string | null;
  agree: boolean | null;
};

export type AskResponse = {
  question: string;
  tool: string | null;
  tool_args?: Record<string, unknown>;
  raw_answer: string;
  verified_answer: string;
  values: Record<string, VerifiedValue>;
  wolfram_code: string | null;
  chart_png_base64: string | null;
  discrepancy: Discrepancy | null;
  verified_clean: boolean;
  verification: {
    scope: "none" | "computed_result_and_numeric_claims";
    label: string;
    details: string;
  };
};

export type PhotoTranscription = {
  question: string;
  confirmed: false;
};

export type CheckResponse = {
  tool: string;
  values: Record<string, VerifiedValue>;
  wolfram_code: string | null;
  equivalent: boolean;
  analysis: MistakeAnalysis;
};

export type MistakeAnalysis = {
  kind: string;
  title: string;
  explanation: string;
  next_step: string;
};

export type PracticeProblem = {
  id: string;
  topic: string;
  difficulty: string;
  question: string;
  hint_count: number;
};

export type PracticeCheckResponse = {
  problem_id: string;
  equivalent: boolean;
  analysis: MistakeAnalysis;
  student_simplified?: string;
  correct_simplified?: string;
  correct_answer: string | null;
  tool: string;
  tool_args: Record<string, unknown>;
  values: Record<string, VerifiedValue>;
  wolfram_code: string | null;
};

export type PracticeRevealResponse = {
  problem_id: string;
  correct_answer: string;
  tool: string;
  tool_args: Record<string, unknown>;
  values: Record<string, VerifiedValue>;
  wolfram_code: string | null;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  source: "tutor" | "practice";
  question: string;
  tool: string | null;
  tool_args: Record<string, unknown>;
  values: Record<string, VerifiedValue>;
  wolfram_code: string | null;
  summary: string;
};

export type ReportSection = {
  tool: string;
  title: string;
  values: Record<string, VerifiedValue>;
  chart_png_base64: string | null;
  wolfram_code: string | null;
};

export type Report = {
  label: string;
  question?: string;
  verification?: string;
  generated_on: string;
  sections: ReportSection[];
};
