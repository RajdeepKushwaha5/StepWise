"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, PencilLine, XCircle } from "lucide-react";
import { check } from "@/lib/api";
import type { CheckResponse } from "@/lib/types";

export function CheckAnswer({ correct, variable }: { correct: string; variable: string }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const student = value.trim();
    if (!student || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await check(student, correct, variable));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check that answer.");
    } finally {
      setLoading(false);
    }
  }

  const equivalent = result?.equivalent;

  return (
    <section className="proof-details mt-4">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="step-index">04</span>
          <div>
            <div className="eyebrow">Learning loop</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-text">
              <PencilLine size={14} style={{ color: "var(--color-verify)" }} />
              Check your answer
            </div>
          </div>
        </div>
        <span className="hidden text-[10px] text-faint sm:inline">symbolic equivalence / Wolfram</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={value}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. 2 x Sin[x] + x^2 Cos[x]"
            className="min-w-0 flex-1 border border-line-2 bg-[#fffefa] px-3 py-2.5 font-mono text-sm text-text outline-none focus:border-[var(--color-verify)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !value.trim()}
            className="console-action console-action-primary shrink-0 px-5"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Verify"}
          </button>
        </div>

        {error && <div className="mt-3 border-l-2 border-[var(--color-lie)] px-3 text-xs text-[var(--color-lie)]">{error}</div>}

        {result && (
          <div className={`mt-3 border-l-2 px-3 py-2 text-sm ${equivalent ? "border-[var(--color-verify)] bg-[#fff3ed]" : "border-[var(--color-lie)] bg-[#f8eae8]"}`}>
            <div className="flex items-center gap-2 font-bold" style={{ color: equivalent ? "var(--color-verify)" : "var(--color-lie)" }}>
              {equivalent ? <BadgeCheck size={16} /> : <XCircle size={16} />}
              {equivalent ? "Equivalent. Nice work." : "Not equivalent yet. Keep going."}
            </div>
            {!equivalent && typeof result.values.student_simplified === "string" && (
              <div className="mt-2 font-mono text-xs leading-5 text-muted">
                Yours: <span className="text-text">{String(result.values.student_simplified)}</span>
                <br />
                Proven: <span className="text-text">{String(result.values.correct_simplified)}</span>
              </div>
            )}
            <div className="mt-3 border-t border-line pt-3">
              <div className="text-xs font-bold text-text">{result.analysis.title}</div>
              <p className="mt-1 text-[10px] leading-5 text-muted">{result.analysis.explanation}</p>
              <p className="mt-1 text-[10px] leading-5 text-faint">{result.analysis.next_step}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
