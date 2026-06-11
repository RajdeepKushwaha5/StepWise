"use client";

import { BarChart3, Code2, Download, Loader2, Printer, ShieldCheck, X } from "lucide-react";
import type { Report, ReportSection } from "@/lib/types";
import { fmtByKey, prettyKey } from "@/lib/format";
import { Wordmark } from "@/components/Wordmark";

function renderValue(key: string, value: number | number[] | string | string[] | boolean): string {
  if (typeof value === "number") return fmtByKey(key, value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.slice(0, 6).join(", ");
  return value;
}

function sectionKey(section: ReportSection, index: number, suffix = ""): string {
  return `${section.tool}-${index}-${section.title}${suffix}`;
}

export function ReportView({
  report,
  downloading,
  onDownload,
  onClose,
}: {
  report: Report;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="report-print-root fixed inset-0 z-50 overflow-auto print:static print:overflow-visible">
      <div className="sticky top-0 z-20 border-b border-[#3c3933] bg-[#1c1b19] px-3 py-2 text-[#fffefa] print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase text-[#bbb5aa]">Worked solution / document preview</span>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} disabled={downloading} className="console-action border-[#fffefa] bg-[#fffefa] text-[#1c1b19]">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? "Building PDF" : "Download PDF"}
            </button>
            <button onClick={() => window.print()} className="console-action border-[#777168] text-[#fffefa]"><Printer size={14} /><span className="hidden sm:inline">Print</span></button>
            <button onClick={onClose} className="console-action border-[#777168] text-[#fffefa]" aria-label="Close report"><X size={14} /></button>
          </div>
        </div>
      </div>

      <article className="report-document relative mx-auto my-5 max-w-5xl px-5 py-6 text-text sm:px-10 sm:py-10 print:my-0 print:max-w-none">
        <header className="grid gap-5 border-b-2 border-text pb-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <Wordmark />
            <div className="eyebrow mt-6 text-[var(--color-verify)]">Worked solution / Wolfram provenance</div>
            <h1 className="mt-3 break-words text-2xl font-bold leading-tight text-text sm:text-4xl">{report.label}</h1>
            <div className="mt-2 text-xs text-muted">Generated {report.generated_on}</div>
          </div>
          <div className="border border-[var(--color-verify)] bg-[#fff3ed] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-verify)]"><ShieldCheck size={14} /> Computation status</div>
            <div className="mt-2 text-[10px] uppercase leading-5 text-muted">{report.verification ?? "Every displayed result was computed by Wolfram Language."}</div>
          </div>
        </header>

        <div className="mt-8 space-y-8">
          {report.sections.map((section, index) => (
            <section key={sectionKey(section, index)} className="report-section break-inside-avoid border-t border-line pt-5">
              <div className="flex items-start gap-3">
                <span className="step-index step-index-active">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="break-words text-base font-bold leading-snug text-text sm:text-lg">{section.title}</h2>
                    {section.chart_png_base64 && <span className="status-chip status-chip-accent"><BarChart3 size={12} /> Visualized</span>}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                    <dl className="border border-line">
                      {Object.entries(section.values).filter(([, value]) => !Array.isArray(value)).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[minmax(90px,0.7fr)_minmax(0,1fr)] gap-2 border-b border-line px-3 py-2 last:border-b-0">
                          <dt className="eyebrow break-words">{prettyKey(key)}</dt>
                          <dd className="tnum break-words text-right font-mono text-xs font-bold text-text">{renderValue(key, value)}</dd>
                        </div>
                      ))}
                    </dl>
                    {section.chart_png_base64 && (
                      <figure className="border border-line bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:image/png;base64,${section.chart_png_base64}`} alt={`${section.title} chart`} className="w-full bg-white" />
                        <figcaption className="border-t border-line px-3 py-2 text-[10px] uppercase text-faint">Wolfram-rendered chart</figcaption>
                      </figure>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <details className="report-section proof-details mt-10 break-inside-avoid print:hidden">
          <summary>
            <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><Code2 size={14} className="text-[var(--color-verify)]" />Wolfram provenance appendix</span>
            <span className="text-[10px] uppercase text-faint">Show source</span>
          </summary>
          <div className="space-y-3 p-3">
            {report.sections.filter((section) => section.wolfram_code).map((section, index) => (
              <div key={sectionKey(section, index, "-code")} className="break-inside-avoid border border-line">
                <div className="border-b border-line bg-[var(--color-surface-2)] px-3 py-2 text-[10px] font-bold uppercase text-[var(--color-verify)]">{section.title}</div>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap bg-[#1c1b19] p-3 font-mono text-[10px] leading-5 text-[#ffd9cd]">{section.wolfram_code}</pre>
              </div>
            ))}
          </div>
        </details>

        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-[9px] uppercase leading-5 text-faint">
          <span>Math computed by Wolfram Language / explanation structured by StepWise</span>
          <span>OSC AI Build 1.0</span>
        </footer>
      </article>
    </div>
  );
}
