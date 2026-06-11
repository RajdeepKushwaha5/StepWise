"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, ChartNoAxesCombined, Lightbulb, Target } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildLearningInsights,
  mistakeLabel,
  readPracticeAttempts,
  type InsightBucket,
  type LearningInsights,
} from "@/lib/insights";

const EMPTY_INSIGHTS = buildLearningInsights([]);

export default function InsightsPage() {
  const [insights, setInsights] = useState<LearningInsights>(EMPTY_INSIGHTS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInsights(buildLearningInsights(readPracticeAttempts()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="app-frame min-h-screen">
      <SiteHeader active="insights" />
      <main className="mx-auto max-w-[1340px] px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
        <section className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">Learning insights / misconception intelligence</div>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              See the pattern. <span className="text-[var(--color-verify)]">Practice what matters.</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              StepWise does not only correct a mistake. It identifies recurring misconceptions and recommends what to practice next.
            </p>
          </div>
          <div className="grid grid-cols-2 border border-line bg-[var(--color-surface-2)] sm:grid-cols-4">
            <Metric value={`${insights.accuracy}%`} label="accuracy" />
            <Metric value={insights.mostFrequentMistake?.label ?? "None yet"} label="top misconception" />
            <Metric value={`${insights.hintDependency}%`} label="hint dependency" />
            <Metric value={String(insights.totalAttempts)} label="attempts analyzed" />
          </div>
        </section>

        {insights.totalAttempts === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
              <MasteryMap buckets={insights.byTopic} />
              <Recommendation topic={insights.recommendedTopic} mistake={insights.mostFrequentMistake?.label} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <AccuracyPanel title="Accuracy by topic" buckets={insights.byTopic} />
              <AccuracyPanel title="Accuracy by difficulty" buckets={insights.byDifficulty} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
              <Mistakes insights={insights} />
              <RecentAttempts insights={insights} />
            </section>
          </>
        )}

        <div className="mt-6 border border-line bg-[var(--color-surface-2)] px-4 py-3 text-[10px] leading-5 text-muted">
          <strong className="text-text">Private by design.</strong> Learning insights are computed from submitted practice attempts and stay in this browser. Mastery is 80% answer accuracy plus 20% independent completion.
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="panel mt-6 grid min-h-[360px] place-items-center p-6 text-center">
      <div className="max-w-xl">
        <BrainCircuit size={34} className="mx-auto text-[var(--color-verify)]" />
        <div className="eyebrow mt-5">No learning evidence yet</div>
        <h2 className="mt-2 text-2xl font-bold text-text">Complete a practice attempt to build your mastery map.</h2>
        <p className="mt-3 text-xs leading-6 text-muted">Correct and incorrect submissions both improve the recommendation. Revealed answers are intentionally excluded from accuracy.</p>
        <Link href="/practice" className="console-action console-action-primary mt-5 inline-flex px-5">
          Start practice <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function MasteryMap({ buckets }: { buckets: InsightBucket[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={<ChartNoAxesCombined size={14} />} title="Mastery map" tag="Adaptive view" />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="border border-line bg-[var(--color-surface-2)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-text">{bucket.label}</div>
                <div className="mt-1 text-[9px] uppercase text-faint">{bucket.attempted} attempts / {bucket.masteryLabel}</div>
              </div>
              <div className="font-mono text-xl font-bold text-[var(--color-verify)]">{bucket.mastery === null ? "—" : `${bucket.mastery}%`}</div>
            </div>
            <Progress value={bucket.mastery ?? 0} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Recommendation({ topic, mistake }: { topic: InsightBucket | null; mistake?: string }) {
  return (
    <section className="panel">
      <PanelTitle icon={<Target size={14} />} title="Recommended next practice" tag="Lowest mastery" />
      <div className="p-5">
        <div className="eyebrow text-[var(--color-verify)]">Next topic</div>
        <div className="mt-2 text-3xl font-bold text-text">{topic?.label ?? "Build a baseline"}</div>
        <p className="mt-3 text-xs leading-6 text-muted">
          {topic
            ? `${topic.label} currently has your lowest assessed mastery at ${topic.mastery}%. Focus here to improve the weakest demonstrated skill.`
            : "Submit a practice answer and StepWise will recommend the topic with the greatest demonstrated need."}
        </p>
        {mistake && <div className="mt-4 border-l-2 border-[var(--color-lie)] pl-3 text-[10px] leading-5 text-muted">Watch for your recurring <strong className="text-text">{mistake.toLowerCase()}</strong>.</div>}
        <Link href={topic ? `/practice?topic=${topic.key}` : "/practice"} className="console-action console-action-primary mt-5 inline-flex w-full">
          Practice recommendation <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function AccuracyPanel({ title, buckets }: { title: string; buckets: InsightBucket[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={<Target size={14} />} title={title} />
      <div className="grid gap-4 p-4">
        {buckets.map((bucket) => (
          <div key={bucket.key}>
            <div className="flex justify-between gap-3 text-xs">
              <span className="font-bold text-text">{bucket.label}</span>
              <span className="font-mono text-muted">{bucket.attempted ? `${bucket.correct}/${bucket.attempted} · ${bucket.accuracy}%` : "Not assessed"}</span>
            </div>
            <Progress value={bucket.accuracy} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Mistakes({ insights }: { insights: LearningInsights }) {
  const max = insights.mistakes[0]?.count ?? 1;
  return (
    <section className="panel">
      <PanelTitle icon={<BrainCircuit size={14} />} title="Misconception frequency" />
      <div className="grid gap-3 p-4">
        {insights.mistakes.length ? insights.mistakes.map((mistake) => (
          <div key={mistake.kind}>
            <div className="flex justify-between text-xs"><span className="font-bold text-text">{mistake.label}</span><span className="font-mono text-muted">{mistake.count}</span></div>
            <Progress value={(mistake.count / max) * 100} danger />
          </div>
        )) : <p className="text-xs leading-6 text-muted">No incorrect attempts yet. Keep practicing to confirm mastery.</p>}
      </div>
    </section>
  );
}

function RecentAttempts({ insights }: { insights: LearningInsights }) {
  return (
    <section className="panel">
      <PanelTitle icon={<Lightbulb size={14} />} title="Recent learning evidence" tag="Submitted attempts only" />
      <div className="divide-y divide-line">
        {insights.recentAttempts.map((attempt) => (
          <div key={attempt.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_110px] sm:items-center">
            <div>
              <div className="line-clamp-1 text-xs font-bold text-text">{attempt.question}</div>
              <div className="mt-1 text-[9px] uppercase text-faint">{attempt.topic.replaceAll("_", " ")} / {attempt.difficulty} / {attempt.hintsUsed} hints</div>
            </div>
            <div className="text-[10px] text-muted">{attempt.correct ? "Verified correct" : mistakeLabel(attempt.mistakeKind)}</div>
            <span className={`status-chip justify-center ${attempt.correct ? "status-chip-accent" : ""}`}>{attempt.correct ? "Correct" : "Needs review"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelTitle({ icon, title, tag }: { icon: React.ReactNode; title: string; tag?: string }) {
  return <div className="panel-header"><span className="flex items-center gap-2 text-xs font-bold uppercase text-text">{icon}{title}</span>{tag && <span className="status-chip status-chip-accent">{tag}</span>}</div>;
}

function Progress({ value, danger = false }: { value: number; danger?: boolean }) {
  return <div className="mt-2 h-2 overflow-hidden bg-[#e6e2db]"><div className="h-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: danger ? "var(--color-lie)" : "var(--color-verify)" }} /></div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="border-r border-line px-3 py-3 last:border-r-0"><div className="truncate font-mono text-base font-bold text-text" title={value}>{value}</div><div className="mt-1 text-[9px] uppercase leading-4 text-faint">{label}</div></div>;
}
