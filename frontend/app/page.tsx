"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Loader2, Sparkles } from "lucide-react";
import { AskConsole } from "@/components/AskConsole";
import { Verdict } from "@/components/Verdict";
import { ReportView } from "@/components/ReportView";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ask, askPhoto, report, reportPdf } from "@/lib/api";
import { saveTutorHistory } from "@/lib/history";
import type { AskResponse, Report } from "@/lib/types";

const SAMPLE_QS = [
  "What is the derivative of x^2 sin(x)?",
  "Solve x^2 - 5x + 6 = 0",
  "Integrate x^2 from 0 to 3",
  "Simplify (x^2 - 1)/(x - 1)",
  "Factor x^3 - x",
  "Plot sin(x)/x",
];

// Curated empty-state launchers — the first reliably exposes an AI slip (product rule),
// the second usually agrees, so a judge sees both outcomes in two clicks.
const STARTERS: { q: string; tag: string; tone: "catch" | "confirm" }[] = [
  { q: "What is the derivative of x^2 sin(x)?", tag: "Often catches a mistake", tone: "catch" },
  { q: "Solve x^2 - 5x + 6 = 0", tag: "Usually confirmed", tone: "confirm" },
  { q: "Integrate x^2 from 0 to 3", tag: "Definite integral + graph", tone: "confirm" },
  { q: "Factor x^3 - x", tag: "Symbolic equivalence", tone: "confirm" },
];

const LOAD_STEPS = [
  ["Route", "Identifying the supported math operation"],
  ["Compare", "Asking the language model without computation"],
  ["Compute", "Running the approved Wolfram Language tool"],
  ["Explain + guard", "Explaining the result and checking numeric claims"],
];

function reportRequestOf(result: AskResponse | null, question: string) {
  const args = result?.tool_args as Record<string, unknown> | undefined;
  const expression =
    typeof args?.expression === "string"
      ? args.expression
      : typeof args?.equation === "string"
        ? args.equation
        : typeof args?.matrix === "string"
          ? args.matrix
          : null;
  if (!expression) return null;
  return {
    expression,
    variable: typeof args?.variable === "string" ? args.variable : "x",
    label: question || "Worked solution",
    tool: result?.tool,
    tool_args: args,
    question,
  };
}

const LANGUAGES: { label: string; value: string }[] = [
  { label: "English", value: "English" },
  { label: "हिन्दी", value: "Hindi" },
  { label: "বাংলা", value: "Bengali" },
  { label: "தமிழ்", value: "Tamil" },
  { label: "తెలుగు", value: "Telugu" },
  { label: "मराठी", value: "Marathi" },
  { label: "Español", value: "Spanish" },
];

export default function Home() {
  const [result, setResult] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState("");
  const [reporting, setReporting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportData, setReportData] = useState<Report | null>(null);
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [language, setLanguage] = useState("English");
  const reportRequest = reportRequestOf(result, asked);

  useEffect(() => {
    const question = new URLSearchParams(window.location.search).get("question")?.trim();
    if (!question) return;
    window.history.replaceState({}, "", window.location.pathname);
    void handleAsk(question);
    // Deep-linked examples should run exactly once on initial load.
  }, []);

  async function handleAsk(question: string) {
    setLoading(true);
    setError(null);
    setAsked(question);
    setPhotoDraft(null);
    setResult(null);
    try {
      const answer = await ask(question, language);
      setResult(answer);
      saveTutorHistory(question, answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Choose a photo or screenshot of the problem.");
      return;
    }
    // The client pipeline downscales/re-encodes, so we only block absurdly large files
    // (a guard against decoding something pathological) rather than normal phone photos.
    if (file.size > 30 * 1024 * 1024) {
      setError("That image is very large. Crop to just the problem, or take a smaller photo.");
      return;
    }
    setLoading(true);
    setError(null);
    setAsked("Reading problem from photo...");
    setResult(null);
    try {
      const photoResult = await askPhoto(file);
      setAsked("");
      setPhotoDraft(photoResult.question);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo reading failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReport() {
    if (!reportRequest) {
      setError("Ask a derivative, integral, equation, or expression first, then I can build a worked solution.");
      return;
    }
    setReporting(true);
    setError(null);
    try {
      setReportData(await report(reportRequest));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Worked solution failed.");
    } finally {
      setReporting(false);
    }
  }

  async function handlePdfDownload() {
    if (!reportRequest) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const blob = await reportPdf(reportRequest);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stepwise-${reportRequest.expression.replace(/[^a-z0-9_-]+/gi, "-") || "solution"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="app-frame flex min-h-screen flex-col">
      <SiteHeader active="tutor" />

      <main className="mx-auto w-full max-w-[1340px] flex-1 px-3 py-5 sm:px-5 lg:px-8 lg:py-8">
        <section className="mb-5 grid gap-4 border-b border-line pb-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">Wolfram-verified math tutor / session 001</div>
            <h1 className="font-display mt-3 max-w-3xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              Ask the model. <span className="text-[var(--color-verify)]">Inspect the evidence.</span>
            </h1>
            <p className="prose-readable mt-3 max-w-2xl text-sm leading-7 text-muted">
              Gemini provides the comparison and explanation. Wolfram Language computes the math. StepWise shows the difference before a student learns the wrong step.
            </p>
          </div>
          <div className="grid grid-cols-3 border border-line bg-[var(--color-surface-2)]">
            <Metric value="02" label="answer paths" />
            <Metric value="08" label="Wolfram tools" />
            <Metric value="15s" label="compute limit" />
          </div>
        </section>

        <AskConsole
          subject="Calculus / Algebra / Linear Algebra"
          subjectMeta="Wolfram-backed"
          sampleQuestions={SAMPLE_QS}
          loading={loading}
          reporting={reporting}
          canReport={Boolean(reportRequest)}
          photoDraft={photoDraft}
          language={language}
          languages={LANGUAGES}
          onLanguageChange={setLanguage}
          onClearPhotoDraft={() => setPhotoDraft(null)}
          onAsk={handleAsk}
          onPhoto={handlePhoto}
          onReport={handleReport}
        />

        {error && (
          <div className="mt-4 border border-[var(--color-lie)] bg-[#f8eae8] px-4 py-3 text-xs leading-5 text-[var(--color-lie)]">
            <span className="font-bold uppercase">Request failed / </span>{error}
          </div>
        )}

        <div className="mt-5">
          <AnimatePresence mode="wait">
            {loading && <LoadingView key="loading" question={asked} />}
            {!loading && !result && (
              <EmptyState key="empty" onPick={handleAsk} disabled={loading || reporting} />
            )}
            {!loading && result && (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="min-w-0">
                    <div className="eyebrow">Current answer audit</div>
                    <div className="mt-1 truncate text-sm font-bold text-text">{asked}</div>
                  </div>
                  <span className={`status-chip ${result.verification.scope === "none" ? "" : "status-chip-accent"}`}>
                    <Check size={13} /> {result.verification.scope === "none" ? "No computation performed" : "Verification complete"}
                  </span>
                </div>
                <Verdict r={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <SiteFooter />

      {reportData && (
        <ReportView report={reportData} downloading={downloadingPdf} onDownload={handlePdfDownload} onClose={() => setReportData(null)} />
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-line px-3 py-3 last:border-r-0">
      <div className="font-mono text-xl font-bold text-text">{value}</div>
      <div className="mt-1 text-[11px] uppercase leading-4 text-faint">{label}</div>
    </div>
  );
}

function LoadingView({ question }: { question: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    // Decelerating cadence that mirrors where time is actually spent: route + compare
    // are quick, computing is slower, and the trace HOLDS on the final
    // "explain + guard" step until the real response arrives and replaces this view —
    // so it never claims "done" before the answer lands.
    const start = performance.now();
    const thresholds = [0, 550, 1500, 3200]; // ms at which each step lights up
    const timer = setInterval(() => {
      const elapsed = performance.now() - start;
      let step = 0;
      for (let i = 0; i < thresholds.length; i += 1) {
        if (elapsed >= thresholds[i]) step = i;
      }
      // Never auto-complete the last step; it stays "in progress" until results render.
      setActive(Math.min(step, LOAD_STEPS.length - 1));
    }, 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow text-[var(--color-verify)]">Live verification trace</div>
          <div className="font-display mt-1 max-w-3xl truncate text-base font-bold text-text">{question}</div>
        </div>
        <Loader2 size={18} className="animate-spin text-[var(--color-verify)]" />
      </div>
      <div className="grid gap-0 p-4 lg:grid-cols-4">
        {LOAD_STEPS.map(([title, description], index) => {
          const done = index < active;
          const current = index === active;
          return (
            <div key={title} className="trace-line flex gap-3 border-b border-line py-3 last:border-b-0 lg:border-b-0 lg:border-r lg:px-4 lg:first:pl-0 lg:last:border-r-0">
              <span className={`step-index ${index <= active ? "step-index-active" : ""}`}>
                {done ? <Check size={14} /> : current ? <Loader2 size={13} className="animate-spin" /> : String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="text-sm font-bold uppercase text-text">{title}</div>
                <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-[11px] uppercase text-faint">
        trace advancing <ArrowRight size={12} className="text-[var(--color-verify)]" />
      </div>
    </motion.section>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="panel"
    >
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="step-index step-index-active"><Sparkles size={14} /></span>
          <div>
            <div className="eyebrow text-[var(--color-verify)]">See it in action</div>
            <div className="font-display mt-0.5 text-base font-bold text-text sm:text-lg">Not sure where to start? Try one of these</div>
          </div>
        </div>
        <span className="hidden text-xs text-faint sm:inline">One click runs a full audit</span>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {STARTERS.map(({ q, tag, tone }, index) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            disabled={disabled}
            className="group flex items-center gap-3 bg-[var(--color-surface)] px-4 py-4 text-left transition hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="step-index shrink-0">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm font-bold text-text">{q}</span>
              <span
                className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase ${
                  tone === "catch" ? "text-[var(--color-lie)]" : "text-[var(--color-confirm)]"
                }`}
              >
                {tag}
              </span>
            </span>
            <ArrowUpRight size={18} className="shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-[var(--color-verify)]" />
          </button>
        ))}
      </div>
    </motion.section>
  );
}
