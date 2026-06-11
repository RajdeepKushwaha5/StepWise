"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileStack, Loader2, Search, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { deleteHistory, readHistory } from "@/lib/history";
import { studyReportPdf } from "@/lib/api";
import type { HistoryItem } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readHistory()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.question} ${item.tool} ${item.summary}`.toLowerCase().includes(q));
  }, [items, query]);

  function remove(ids: string[]) {
    setItems(deleteHistory(ids));
    setSelected((current) => current.filter((id) => !ids.includes(id)));
  }

  async function downloadStudyReport() {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (!chosen.length) return;
    await downloadItems(chosen, "stepwise-study-report.pdf");
  }

  async function downloadItems(chosen: HistoryItem[], filename: string) {
    setDownloading(true);
    setError(null);
    try {
      const blob = await studyReportPdf("StepWise revision set", chosen);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Study report failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-frame min-h-screen">
      <SiteHeader active="history" />
      <main className="mx-auto max-w-[1340px] px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
        <section className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">Session history / local study library</div>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              Keep the evidence. <span className="text-[var(--color-verify)]">Build a revision set.</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              Computed tutor results and completed practice problems are saved in this browser. Reopen them, search the library, remove old work, or combine selected problems into one study-report PDF.
            </p>
          </div>
          <div className="panel p-4">
            <div className="eyebrow">Privacy model</div>
            <p className="mt-2 text-xs leading-6 text-muted">History stays in local browser storage. No account or remote student profile is required.</p>
          </div>
        </section>

        <section className="mt-6 panel">
          <div className="panel-header flex-wrap">
            <div className="flex min-w-0 items-center gap-3">
              <FileStack size={15} className="text-[var(--color-verify)]" />
              <div><div className="eyebrow">Saved sessions</div><div className="mt-1 text-sm font-bold text-text">{items.length} records / {selected.length} selected</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void downloadStudyReport()} disabled={!selected.length || downloading} className="console-action console-action-primary">
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download study report
              </button>
              <button onClick={() => remove(selected)} disabled={!selected.length} className="console-action"><Trash2 size={14} /> Delete selected</button>
            </div>
          </div>
          <div className="border-b border-line p-3">
            <label className="flex items-center gap-2 border border-line bg-[#fffefa] px-3 py-2">
              <Search size={14} className="text-faint" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions, tools, or summaries" className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none" />
            </label>
          </div>
          {filtered.length ? (
            <div className="grid gap-px bg-line lg:grid-cols-2">
              {filtered.map((item) => (
                <article key={item.id} className="bg-[var(--color-surface)] p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                      aria-label={`Select ${item.question}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-chip status-chip-accent">{item.source}</span>
                        <span className="font-mono text-[9px] uppercase text-faint">{item.tool}</span>
                        <span className="text-[9px] text-faint">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <h2 className="mt-3 break-words text-sm font-bold leading-6 text-text">{item.question}</h2>
                      <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-muted">{item.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/?question=${encodeURIComponent(item.question)}`} className="console-action console-action-primary">Reopen in tutor</Link>
                        <button onClick={() => void downloadItems([item], "stepwise-saved-solution.pdf")} disabled={downloading} className="console-action"><Download size={13} /> PDF</button>
                        <button onClick={() => remove([item.id])} className="console-action"><Trash2 size={13} /> Delete</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center p-6 text-center text-xs leading-6 text-muted">
              {items.length ? "No saved sessions match that search." : "No saved sessions yet. Complete a tutor computation or practice problem to begin."}
            </div>
          )}
          {error && <div className="border-t border-line px-4 py-3 text-xs text-[var(--color-lie)]">{error}</div>}
        </section>
      </main>
    </div>
  );
}
