import type {
  AskResponse,
  CheckResponse,
  HistoryItem,
  PhotoTranscription,
  PracticeCheckResponse,
  PracticeProblem,
  PracticeRevealResponse,
  Report,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function warmBackend(): Promise<void> {
  try {
    await fetch(`${API}/api/health`, { cache: "no-store" });
  } catch {
    // Best-effort wake-up for free-tier hosting; normal requests still report real failures.
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    // The backend may return plain text for infrastructure-level failures.
  }
  return `${fallback} (${res.status})`;
}

export async function ask(question: string): Promise<AskResponse> {
  const res = await fetch(`${API}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Request failed"));
  return res.json();
}

export async function askPhoto(file: File): Promise<PhotoTranscription> {
  const image_base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
  const res = await fetch(`${API}/api/ask/photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64, mime_type: file.type }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Photo reading failed"));
  return res.json();
}

export async function check(student: string, correct: string, variable = "x"): Promise<CheckResponse> {
  const res = await fetch(`${API}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student, correct, variable }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Check failed"));
  return res.json();
}

export async function examples(): Promise<string[]> {
  const res = await fetch(`${API}/api/examples`);
  if (!res.ok) throw new Error(await errorMessage(res, "Could not load examples"));
  return (await res.json()).questions ?? [];
}

export type ReportRequest = {
  expression: string;
  variable?: string;
  label?: string;
  tool?: string | null;
  tool_args?: Record<string, unknown>;
  question?: string;
};

export async function report(request: ReportRequest): Promise<Report> {
  const res = await fetch(`${API}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Worked solution failed"));
  return res.json();
}

export async function reportPdf(request: ReportRequest): Promise<Blob> {
  const res = await fetch(`${API}/api/report/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "PDF failed"));
  return res.blob();
}

export async function generatePractice(topic: string, difficulty: string, exclude_id = ""): Promise<PracticeProblem> {
  const res = await fetch(`${API}/api/practice/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, difficulty, exclude_id }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not generate practice"));
  return res.json();
}

export async function practiceHint(problem_id: string, level: number): Promise<string> {
  const res = await fetch(`${API}/api/practice/hint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id, level }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not load hint"));
  return (await res.json()).hint;
}

export async function checkPractice(problem_id: string, student: string): Promise<PracticeCheckResponse> {
  const res = await fetch(`${API}/api/practice/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id, student }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not check practice answer"));
  return res.json();
}

export async function revealPractice(problem_id: string): Promise<PracticeRevealResponse> {
  const res = await fetch(`${API}/api/practice/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id, level: 3 }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not reveal answer"));
  return res.json();
}

export async function studyReportPdf(title: string, items: HistoryItem[]): Promise<Blob> {
  const res = await fetch(`${API}/api/study-report/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      items: items.map(({ question, tool, values, wolfram_code }) => ({ question, tool, values, wolfram_code })),
    }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Study report failed"));
  return res.blob();
}
