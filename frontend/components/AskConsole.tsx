"use client";

import { useRef, useState } from "react";
import { ArrowUp, Camera, FileText, Loader2, Sigma, X } from "lucide-react";

type Props = {
  subject: string;
  subjectMeta?: string;
  sampleQuestions: string[];
  loading: boolean;
  reporting?: boolean;
  canReport?: boolean;
  photoDraft?: string | null;
  onClearPhotoDraft: () => void;
  onAsk: (q: string) => void;
  onPhoto: (file: File) => Promise<void>;
  onReport: () => void;
};

export function AskConsole({
  subject,
  subjectMeta,
  sampleQuestions,
  loading,
  reporting,
  canReport,
  photoDraft,
  onClearPhotoDraft,
  onAsk,
  onPhoto,
  onReport,
}: Props) {
  const [value, setValue] = useState("");
  const [photoName, setPhotoName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = loading || Boolean(reporting);

  function submit(q?: string) {
    const text = (q ?? photoDraft ?? value).trim();
    if (!text || busy) return;
    setPhotoName("");
    onClearPhotoDraft();
    onAsk(text);
    if (!q) setValue("");
  }

  async function choosePhoto(file?: File) {
    if (!file || busy) return;
    setPhotoName(file.name);
    await onPhoto(file);
  }

  return (
    <section className="command-console">
      <div className="panel-header flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <span className="step-index step-index-active">01</span>
          <div className="min-w-0">
            <div className="eyebrow">Tutor console / new problem</div>
            <div className="mt-1 truncate text-sm font-bold text-text">{subject}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {subjectMeta && <span className="hidden text-[11px] text-faint md:inline">{subjectMeta}</span>}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void choosePhoto(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="Photograph or upload a math problem"
            className="console-action"
          >
            {loading && photoName ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            <span>{loading && photoName ? "Reading photo" : "Photo"}</span>
          </button>
          <button
            type="button"
            onClick={onReport}
            disabled={busy || !canReport}
            title={canReport ? "Build a Wolfram-computed worked solution" : "Ask a problem first"}
            className="console-action"
          >
            {reporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            <span>{reporting ? "Building" : canReport ? "Worked solution" : "Ask first for solution"}</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        {(photoName || photoDraft) && (
          <div className="mb-3 flex items-center gap-2 border-l-2 border-[var(--color-verify)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-muted">
            <Camera size={13} style={{ color: "var(--color-verify)" }} />
            <span className="min-w-0 flex-1">
              {photoDraft ? "Review the transcription below, correct any mistakes, then compute it." : `Photo queued: ${photoName}`}
            </span>
            {photoDraft && (
              <button type="button" onClick={() => { setValue(""); setPhotoName(""); onClearPhotoDraft(); }} aria-label="Discard photo transcription">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        <div className="question-field grid gap-2 p-2 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center">
          <span className="hidden h-10 w-10 place-items-center border-r border-line text-[var(--color-verify)] sm:grid">
            <Sigma size={17} />
          </span>
          <textarea
            rows={2}
            value={photoDraft ?? value}
            disabled={busy}
            onChange={(e) => {
              if (photoDraft) onClearPhotoDraft();
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Differentiate, integrate, solve, simplify, plot, or evaluate a math problem..."
            className="min-h-[62px] max-h-40 w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 text-text outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy || !(photoDraft ?? value).trim()}
            className="console-action console-action-primary h-11 px-4"
            aria-label="Ask StepWise"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            <span>{loading ? "Computing" : "Run audit"}</span>
          </button>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="flex items-center justify-between px-3 py-2 sm:px-5">
          <span className="eyebrow">Example commands</span>
          <span className="text-[10px] text-faint">Enter to submit / Shift+Enter for newline</span>
        </div>
        <div className="grid sm:grid-cols-2">
          {sampleQuestions.map((q, index) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={busy}
              className="sample-command sm:odd:border-r"
            >
              <span className="text-[10px] font-bold text-[var(--color-verify)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="truncate text-xs">{q}</span>
              <ArrowUp size={13} className="rotate-45 justify-self-end text-faint" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
