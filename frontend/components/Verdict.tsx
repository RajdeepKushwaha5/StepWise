"use client";

import { motion } from "motion/react";
import { AlertTriangle, BadgeCheck, Bot, ChevronDown, Code2, LineChart, ShieldCheck } from "lucide-react";
import type { AskResponse, VerifiedValue } from "@/lib/types";
import { fmtByKey, prettyKey } from "@/lib/format";
import { MathText } from "@/components/MathText";
import { Tex } from "@/components/Tex";
import { CheckAnswer } from "@/components/CheckAnswer";

function answerTex(values: Record<string, VerifiedValue>): string | null {
  for (const [key, value] of Object.entries(values)) {
    if (key.endsWith("_tex") && typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function checkableAnswer(values: Record<string, VerifiedValue>): string | null {
  for (const key of ["derivative", "antiderivative", "result", "exact"]) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) return value.replace(" + C", "").trim();
  }
  return null;
}

export function Verdict({ r }: { r: AskResponse }) {
  const computed = r.verification.scope !== "none";
  const discrepancy = r.discrepancy;
  const caught = discrepancy?.agree === false;
  const confirmed = discrepancy?.agree === true;
  const symbolic = discrepancy?.kind === "symbolic";
  const tex = answerTex(r.values);
  const checkable = checkableAnswer(r.values);
  const variable = typeof r.tool_args?.variable === "string" ? r.tool_args.variable : "x";
  const headline =
    discrepancy && !symbolic && discrepancy.verified != null
      ? fmtByKey(discrepancy.headline_key ?? "", discrepancy.verified as number)
      : null;
  const rawHeadline =
    discrepancy && !symbolic && discrepancy.raw_value != null
      ? fmtByKey(discrepancy.headline_key ?? "", discrepancy.raw_value as number)
      : null;
  const rawShown = symbolic && discrepancy ? String(discrepancy.raw_value) : rawHeadline;
  const verifiedShown = symbolic && discrepancy ? String(discrepancy.verified) : headline;
  const rawTex = symbolic ? discrepancy?.raw_tex ?? null : null;
  const verifiedTex = symbolic ? discrepancy?.verified_tex ?? null : null;
  const diffTex = symbolic ? discrepancy?.difference_tex ?? null : null;

  return (
    <div className="space-y-4">
      {caught && (
        <motion.div
          initial={{ opacity: 0, scale: 0.965, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="alert-banner"
        >
          <div className="panel-header border-b-0 bg-transparent">
            <div className="flex items-center gap-3">
              <span className="alert-badge"><AlertTriangle size={15} /></span>
              <div>
                <div className="eyebrow text-[var(--color-lie)]">Mistake caught · AI vs Wolfram</div>
                <div className="font-display mt-0.5 text-base font-bold leading-tight text-text sm:text-lg">
                  The AI&apos;s answer is wrong — StepWise caught it before you learned it
                </div>
              </div>
            </div>
            {!symbolic && (
              <div className="alert-compare max-w-full font-mono text-xs">
                <span className="truncate text-right line-through text-[var(--color-lie)]">{rawShown}</span>
                <span className="font-bold text-[var(--color-verify)]">→</span>
                <span className="truncate font-bold text-text">{verifiedShown}</span>
              </div>
            )}
          </div>
          {symbolic && (
            <StepDiff
              rawTex={rawTex}
              rawText={String(rawShown ?? "")}
              verifiedTex={verifiedTex}
              verifiedText={String(verifiedShown ?? "")}
              diffTex={diffTex}
            />
          )}
        </motion.div>
      )}
      {confirmed && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="confirm-banner"
        >
          <div className="panel-header border-b-0 bg-transparent">
            <div className="flex items-center gap-3">
              <span className="confirm-badge"><BadgeCheck size={15} /></span>
              <div>
                <div className="eyebrow text-[var(--color-confirm)]">Independently confirmed</div>
                <div className="font-display mt-0.5 text-base font-bold leading-tight text-text sm:text-lg">
                  Wolfram independently confirms the AI&apos;s answer is correct
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
        <div className="space-y-4 xl:sticky xl:top-20">
          <motion.section initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="raw-panel">
            <PanelHeader index="02A" icon={<Bot size={15} />} title="AI alone" tag="Unchecked" />
            <div className="p-4 sm:p-5">
              {rawHeadline && (
                <div className="mb-4 border-l-2 border-[var(--color-lie)] bg-[#f8eae8] px-3 py-2">
                  <div className="eyebrow">Claimed result</div>
                  <div className="tnum mt-1 break-words font-mono text-2xl font-bold line-through text-[var(--color-lie)]">{rawHeadline}</div>
                </div>
              )}
              <MathText text={r.raw_answer} className="prose-readable text-sm leading-7 text-muted" />
            </div>
          </motion.section>
          <aside className="raw-brief p-4">
            <div className="eyebrow">Why show this?</div>
            <p className="mt-2 text-xs leading-6 text-muted">
              A fluent answer is not a proof. The comparison keeps the model&apos;s unchecked path visible so students can see exactly what verification changes.
            </p>
          </aside>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="verified-panel"
        >
          <PanelHeader
            index="02B"
            icon={<ShieldCheck size={15} />}
            title={computed ? "StepWise evidence" : "StepWise response"}
            tag={computed ? "Wolfram computed" : "No computation performed"}
            accent={computed}
          />
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="eyebrow">Guided explanation</div>
                <MathText text={r.verified_answer} className="prose-readable mt-2 max-w-3xl text-sm leading-7 text-text" />
              </div>
              {r.verified_clean && (
                <span className="status-chip status-chip-accent">
                  <BadgeCheck size={13} /> {r.verification.label}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-faint">{r.verification.details}</p>

            {(headline || tex) && (
              <div className="mt-4 border-l-2 border-[var(--color-verify)] bg-[#fff3ed] px-4 py-3">
                <div className="eyebrow text-[var(--color-verify)]">Proven result</div>
                {headline && <div className="tnum mt-2 break-words font-mono text-3xl font-bold text-text sm:text-4xl">{headline}</div>}
                {tex && <div className="mt-2 overflow-x-auto"><Tex tex={tex} block className="text-xl text-text" /></div>}
              </div>
            )}

            <div className="mt-4 grid gap-3">
              {r.chart_png_base64 && <ChartDetails image={r.chart_png_base64} />}
              <ValuesDetails values={r.values} />
              {r.wolfram_code && <CodeDetails code={r.wolfram_code} />}
            </div>

            {checkable && <CheckAnswer correct={checkable} variable={variable} />}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function StepDiff({
  rawTex,
  rawText,
  verifiedTex,
  verifiedText,
  diffTex,
}: {
  rawTex: string | null;
  rawText: string;
  verifiedTex: string | null;
  verifiedText: string;
  diffTex: string | null;
}) {
  return (
    <div className="grid gap-3 border-t border-line p-4">
      <div className="eyebrow text-[var(--color-verify)]">Step difference / exactly where the answers diverge</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 border-l-2 border-[var(--color-lie)] bg-[#f8eae8] px-3 py-2">
          <div className="eyebrow flex items-center gap-1.5"><Bot size={11} /> AI alone</div>
          <div className="mt-1 overflow-x-auto text-[var(--color-lie)]">
            {rawTex ? <Tex tex={rawTex} /> : <span className="font-mono text-sm">{rawText}</span>}
          </div>
        </div>
        <div className="min-w-0 border-l-2 border-[var(--color-verify)] bg-[#fff3ed] px-3 py-2">
          <div className="eyebrow flex items-center gap-1.5 text-[var(--color-verify)]"><ShieldCheck size={11} /> Wolfram computed</div>
          <div className="mt-1 overflow-x-auto text-text">
            {verifiedTex ? <Tex tex={verifiedTex} /> : <span className="font-mono text-sm">{verifiedText}</span>}
          </div>
        </div>
      </div>
      {diffTex && diffTex.trim() !== "0" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-line bg-[var(--color-surface-2)] px-3 py-2 text-xs text-muted">
          <span className="eyebrow">Wolfram computed the gap</span>
          <span className="font-mono text-faint">correct − AI =</span>
          <span className="min-w-0 overflow-x-auto text-text"><Tex tex={diffTex} /></span>
          <span className="text-faint">— non-zero, so the answers are not equivalent.</span>
        </div>
      )}
    </div>
  );
}

function PanelHeader({
  index,
  icon,
  title,
  tag,
  accent = false,
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  tag: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-header">
      <div className="flex items-center gap-3">
        <span className={`step-index ${accent ? "step-index-active" : ""}`}>{index}</span>
        <div>
          <div className="eyebrow">{tag}</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-bold text-text">{icon}{title}</div>
        </div>
      </div>
    </div>
  );
}

function valueText(key: string, value: number | string | boolean): string {
  if (typeof value === "number") return fmtByKey(key, value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return value;
}

function ValuesDetails({ values }: { values: AskResponse["values"] }) {
  const scalars = Object.entries(values).filter(
    ([key, value]) => (typeof value === "number" || typeof value === "string" || typeof value === "boolean") && !key.endsWith("_tex"),
  ) as [string, number | string | boolean][];
  if (scalars.length === 0) return null;
  return (
    <details className="proof-details">
      <summary>
        <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><BadgeCheck size={14} className="text-[var(--color-verify)]" />Computed values</span>
        <span className="flex items-center gap-2 text-[10px] uppercase text-faint">{scalars.length} fields <ChevronDown size={13} /></span>
      </summary>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {scalars.map(([key, value]) => (
          <div key={key} className="min-w-0 bg-[var(--color-surface)] px-3 py-3">
            <div className="eyebrow truncate">{prettyKey(key)}</div>
            <div className="tnum mt-1 break-words font-mono text-xs text-text">{valueText(key, value)}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ChartDetails({ image }: { image: string }) {
  return (
    <details className="proof-details">
      <summary>
        <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><LineChart size={14} className="text-[var(--color-verify)]" />Wolfram graph</span>
        <span className="flex items-center gap-2 text-[10px] uppercase text-faint">Rendered evidence <ChevronDown size={13} /></span>
      </summary>
      <div className="chart-canvas p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${image}`} alt="Wolfram-rendered graph" className="mx-auto h-auto max-h-[380px] w-full object-contain" />
      </div>
    </details>
  );
}

function CodeDetails({ code }: { code: string }) {
  return (
    <details className="proof-details">
      <summary>
        <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><Code2 size={14} className="text-[var(--color-verify)]" />Wolfram provenance code</span>
        <span className="flex items-center gap-2 text-[10px] uppercase text-faint">Provenance <ChevronDown size={13} /></span>
      </summary>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap bg-[#1c1b19] p-4 font-mono text-[11px] leading-6 text-[#ffd9cd]">{code}</pre>
    </details>
  );
}
