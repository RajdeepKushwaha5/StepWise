"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BookOpenCheck, Eye, Lightbulb, Loader2, RefreshCw, Target, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { checkPractice, generatePractice, practiceHint, revealPractice } from "@/lib/api";
import { readPracticeStats, savePracticeHistory, updatePracticeStats, type PracticeStats } from "@/lib/history";
import { normalizePracticeTopic, recordPracticeAttempt } from "@/lib/insights";
import type { PracticeCheckResponse, PracticeProblem, PracticeRevealResponse } from "@/lib/types";

const TOPICS = [
  ["calculus", "Calculus"],
  ["algebra", "Algebra"],
  ["arithmetic", "Arithmetic"],
  ["linear_algebra", "Linear algebra"],
] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export default function PracticePage() {
  const [topic, setTopic] = useState("calculus");
  const [difficulty, setDifficulty] = useState("easy");
  const [problem, setProblem] = useState<PracticeProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [check, setCheck] = useState<PracticeCheckResponse | null>(null);
  const [revealed, setRevealed] = useState<PracticeRevealResponse | null>(null);
  const [stats, setStats] = useState<PracticeStats>({ attempted: 0, correct: 0, hintsUsed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setStats(readPracticeStats());
      const initialTopic = normalizePracticeTopic(new URLSearchParams(window.location.search).get("topic"));
      setTopic(initialTopic);
      try {
        setProblem(await generatePractice(initialTopic, "easy"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate a problem.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function newProblem() {
    setLoading(true);
    setError(null);
    try {
      setProblem(await generatePractice(topic, difficulty, problem?.id));
      setAnswer("");
      setHints([]);
      setCheck(null);
      setRevealed(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a problem.");
    } finally {
      setLoading(false);
    }
  }

  async function getHint() {
    if (!problem || hints.length >= problem.hint_count) return;
    setLoading(true);
    setError(null);
    try {
      const hint = await practiceHint(problem.id, hints.length + 1);
      setHints((current) => [...current, hint]);
      setStats(updatePracticeStats({ hintsUsed: 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load a hint.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!problem || !answer.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await checkPractice(problem.id, answer.trim());
      setCheck(result);
      setStats(updatePracticeStats({ attempted: 1, correct: result.equivalent ? 1 : 0 }));
      recordPracticeAttempt({
        problemId: problem.id,
        question: problem.question,
        topic: problem.topic,
        difficulty: problem.difficulty,
        correct: result.equivalent,
        mistakeKind: result.analysis.kind,
        hintsUsed: hints.length,
      });
      if (result.equivalent) {
        savePracticeHistory(problem.question, result, "Practice answer verified by Wolfram.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the answer.");
    } finally {
      setLoading(false);
    }
  }

  async function reveal() {
    if (!problem || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await revealPractice(problem.id);
      setRevealed(result);
      savePracticeHistory(problem.question, result, `Revealed verified answer: ${result.correct_answer}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reveal the answer.");
    } finally {
      setLoading(false);
    }
  }

  const accuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0;

  return (
    <div className="app-frame min-h-screen">
      <SiteHeader active="practice" />
      <main className="mx-auto max-w-[1340px] px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
        <section className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">Practice mode / guided learning</div>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              Try the step. <span className="text-[var(--color-verify)]">Verify the thinking.</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              Choose a topic and difficulty, ask for progressive hints, and let Wolfram verify the final answer. Incorrect attempts receive targeted mistake analysis instead of a generic red mark.
            </p>
          </div>
          <div className="grid grid-cols-3 border border-line bg-[var(--color-surface-2)]">
            <Metric value={String(stats.attempted)} label="attempts" />
            <Metric value={String(stats.correct)} label="verified correct" />
            <Metric value={`${accuracy}%`} label="accuracy" />
          </div>
        </section>

        <section className="mt-6 grid items-start gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="panel">
            <div className="panel-header">
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><Target size={14} className="text-[var(--color-verify)]" /> Practice setup</span>
            </div>
            <div className="space-y-5 p-4">
              <fieldset>
                <legend className="eyebrow">Topic</legend>
                <div className="mt-2 grid gap-2">
                  {TOPICS.map(([value, label]) => (
                    <button key={value} onClick={() => setTopic(value)} className={`console-action justify-start ${topic === value ? "console-action-primary" : ""}`}>{label}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="eyebrow">Difficulty</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((value) => (
                    <button key={value} onClick={() => setDifficulty(value)} className={`console-action ${difficulty === value ? "console-action-primary" : ""}`}>{value}</button>
                  ))}
                </div>
              </fieldset>
              <button onClick={() => void newProblem()} disabled={loading} className="console-action console-action-primary w-full">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Generate problem
              </button>
              <div className="border-t border-line pt-4 text-[10px] leading-5 text-muted">
                Hints used across sessions: <strong className="text-text">{stats.hintsUsed}</strong>
              </div>
            </div>
          </aside>

          <section className="panel min-h-[440px]">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Current challenge</div>
                <div className="mt-1 text-sm font-bold capitalize text-text">
                  {problem ? `${problem.topic.replace("_", " ")} / ${problem.difficulty}` : "Preparing problem"}
                </div>
              </div>
              <span className="status-chip status-chip-accent">Wolfram checked</span>
            </div>
            <div className="p-4 sm:p-6">
              {problem ? (
                <>
                  <div className="border-l-2 border-[var(--color-verify)] bg-[#fff3ed] px-4 py-4 font-mono text-lg font-bold leading-8 text-text">
                    {problem.question}
                  </div>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
                      placeholder="Enter your answer in Wolfram-style math syntax"
                      className="min-w-0 flex-1 border border-line-2 bg-[#fffefa] px-3 py-3 font-mono text-sm text-text outline-none focus:border-[var(--color-verify)]"
                    />
                    <button onClick={() => void submit()} disabled={loading || !answer.trim()} className="console-action console-action-primary px-5">
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <BookOpenCheck size={14} />} Verify answer
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => void getHint()} disabled={loading || hints.length >= problem.hint_count} className="console-action">
                      <Lightbulb size={14} /> Hint {Math.min(hints.length + 1, problem.hint_count)} of {problem.hint_count}
                    </button>
                    <button onClick={() => void reveal()} disabled={loading || Boolean(revealed)} className="console-action"><Eye size={14} /> Reveal verified answer</button>
                  </div>

                  {hints.length > 0 && (
                    <div className="mt-5 grid gap-2">
                      {hints.map((hint, index) => (
                        <div key={hint} className="border border-line bg-[var(--color-surface-2)] px-3 py-3 text-xs leading-6 text-muted">
                          <span className="mr-2 font-bold text-[var(--color-verify)]">Hint {index + 1}</span>{hint}
                        </div>
                      ))}
                    </div>
                  )}

                  {check && <Feedback check={check} />}
                  {revealed && (
                    <div className="mt-5 border-l-2 border-[var(--color-verify)] bg-[#fff3ed] px-4 py-3">
                      <div className="eyebrow text-[var(--color-verify)]">Verified answer</div>
                      <div className="mt-2 break-words font-mono text-lg font-bold text-text">{revealed.correct_answer}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid min-h-80 place-items-center text-xs text-muted">{loading ? "Generating practice problem..." : "Choose a setup and generate a problem."}</div>
              )}
              {error && <div className="mt-4 border-l-2 border-[var(--color-lie)] px-3 text-xs text-[var(--color-lie)]">{error}</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function Feedback({ check }: { check: PracticeCheckResponse }) {
  return (
    <div className={`mt-5 border-l-2 px-4 py-3 ${check.equivalent ? "border-[var(--color-verify)] bg-[#fff3ed]" : "border-[var(--color-lie)] bg-[#f8eae8]"}`}>
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color: check.equivalent ? "var(--color-verify)" : "var(--color-lie)" }}>
        {check.equivalent ? <BadgeCheck size={16} /> : <XCircle size={16} />} {check.analysis.title}
      </div>
      <p className="mt-2 text-xs leading-6 text-muted">{check.analysis.explanation}</p>
      <p className="mt-1 text-[10px] leading-5 text-faint">{check.analysis.next_step}</p>
      {!check.equivalent && check.student_simplified && check.correct_simplified && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 font-mono text-[10px] sm:grid-cols-2">
          <div><span className="text-faint">Yours / </span>{check.student_simplified}</div>
          <div><span className="text-faint">Verified / </span>{check.correct_simplified}</div>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="border-r border-line px-3 py-3 last:border-r-0"><div className="font-mono text-lg font-bold text-text">{value}</div><div className="mt-1 text-[9px] uppercase leading-4 text-faint">{label}</div></div>;
}
