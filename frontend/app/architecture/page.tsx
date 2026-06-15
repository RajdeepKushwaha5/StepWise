import { ArrowRight, Bot, FileText, GitCompareArrows, LockKeyhole, Server, ShieldCheck, Sigma } from "lucide-react";
import { GeminiMark, WolframMark } from "@/components/BrandMarks";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// The computed path, as an ordered sequence (top to bottom).
const computedSteps = [
  { title: "Intent router", label: "Sends common math straight to a tool; Gemini only translates unfamiliar phrasing.", icon: <GeminiMark size={16} /> },
  { title: "Wolfram computes", label: "Produces the real result — exact values, numeric values, and the graph.", icon: <WolframMark size={16} /> },
  { title: "Gemini narrates", label: "Explains the answer using only the values Wolfram returned.", icon: <GeminiMark size={16} /> },
  { title: "Number guard", label: "Rejects any number not traceable to the computation, then shows provenance.", icon: <ShieldCheck size={16} /> },
];

const rules = [
  "The displayed result always comes from Wolfram",
  "Only approved Wolfram tools can execute",
  "Numeric claims are checked before the explanation shows",
  "Saved records keep their originating computation",
];

export default function ArchitecturePage() {
  return (
    <div className="app-frame flex min-h-screen flex-col">
      <SiteHeader active="architecture" />

      <main className="mx-auto w-full max-w-[1340px] flex-1 px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
        <section className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">System architecture / trust boundaries</div>
            <h1 className="font-display mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              Language for teaching. <span className="text-[var(--color-verify)]">Computation for truth.</span>
            </h1>
            <p className="prose-readable mt-4 max-w-3xl text-sm leading-7 text-muted">
              Every question runs two ways: an ungrounded AI answer you can inspect, and a Wolfram-computed
              answer that is the source of truth. StepWise compares them and teaches the verified step.
            </p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <span className="flex items-center gap-2 text-sm font-bold uppercase text-text"><LockKeyhole size={15} className="text-[var(--color-verify)]" /> Trust boundary</span>
              <span className="status-chip status-chip-accent">Implemented</span>
            </div>
            <div className="grid grid-cols-2">
              {rules.map((rule, index) => (
                <div key={rule} className="border-b border-r border-line p-3 text-xs leading-5 text-muted even:border-r-0">
                  <span className="mr-2 font-bold text-[var(--color-verify)]">{String(index + 1).padStart(2, "0")}</span>{rule}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- The core story: one question, two paths, one comparison ---- */}
        <section className="mt-6 panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Primary request pipeline</div>
              <div className="font-display mt-1 text-base font-bold text-text sm:text-lg">How a question becomes a verified answer</div>
            </div>
            <span className="status-chip status-chip-accent"><code className="font-mono">POST /api/ask</code></span>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            {/* Stage 1 */}
            <div>
              <StageLabel n="1" title="One question comes in" />
              <div className="mt-3 border-l-2 border-[var(--color-verify)] bg-[var(--color-surface-2)] px-3 py-2">
                <div className="eyebrow">Worked example used below</div>
                <div className="mt-1 font-mono text-base font-bold text-text">What is the derivative of x² sin(x)?</div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Node index="A" icon={<Sigma size={16} />} title="Confirmed question" label="Typed text, or a photo transcription the student reviews first." />
                <Node index="B" icon={<Server size={16} />} title="FastAPI orchestrator" label="Starts both answer paths and waits for the computed result." />
              </div>
            </div>

            <StageDivider />

            {/* Stage 2 */}
            <div>
              <StageLabel n="2" title="The same question runs two ways at once" />
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {/* Path A — untrusted */}
                <div className="flex flex-col border border-[var(--color-lie)] bg-[#f8eae8] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-lie)]"><Bot size={16} /> Path A · AI alone</span>
                    <span className="status-chip border-[var(--color-lie)] text-[var(--color-lie)]">Untrusted</span>
                  </div>
                  <p className="prose-readable mt-3 text-sm leading-6 text-muted">
                    Gemini answers from memory with <strong>no tools</strong>. Fluent, confident — and sometimes
                    subtly wrong. It stays on screen so the exact risk is visible, never hidden.
                  </p>
                  <div className="mt-auto border-l-2 border-[var(--color-lie)] bg-[#fffefa] px-3 py-2">
                    <div className="eyebrow">Example claim it might make</div>
                    <div className="mt-1 font-mono text-xl font-bold line-through text-[var(--color-lie)]">2x cos(x)</div>
                  </div>
                </div>

                {/* Path B — source of truth */}
                <div className="border border-[var(--color-verify)] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-verify)]"><ShieldCheck size={16} /> Path B · Computed</span>
                    <span className="status-chip status-chip-accent">Source of truth</span>
                  </div>
                  <ol className="mt-4">
                    {computedSteps.map((step, index) => (
                      <li key={step.title}>
                        <Node index={String(index + 1).padStart(2, "0")} {...step} accent />
                        {index < computedSteps.length - 1 && <SeqConnector />}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <StageDivider />

            {/* Stage 3 */}
            <div>
              <StageLabel n="3" title="StepWise compares the two and teaches the verified step" />
              <div className="mt-3 border border-line bg-[var(--color-surface-2)] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex items-center gap-2 text-sm font-bold uppercase text-text">
                    <GitCompareArrows size={18} className="text-[var(--color-verify)]" /> Symbolic comparison
                  </span>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                    <span className="line-through text-[var(--color-lie)]">2x cos(x)</span>
                    <ArrowRight size={16} className="text-[var(--color-verify)]" />
                    <span className="font-bold text-text">2x sin(x) + x² cos(x)</span>
                  </div>
                </div>
                <p className="prose-readable mt-3 max-w-3xl text-sm leading-6 text-muted">
                  Wolfram checks whether the two answers are equivalent. If they differ, StepWise shows the gap
                  (&ldquo;caught a mistake&rdquo;); if they agree, it shows an independent confirmation. Either way,
                  the student learns from the computed result.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel h-fit">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Learning and document pipeline</div>
                <div className="font-display mt-1 text-base font-bold text-text sm:text-lg">Practice to revision report</div>
              </div>
              <FileText size={16} className="text-[var(--color-verify)]" />
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-5">
              {["Choose practice", "Request hints", "Wolfram verifies", "Save locally", "Export study PDF"].map((label, index) => (
                <div key={label} className="bg-[var(--color-surface)] p-4">
                  <div className="text-xs font-bold text-[var(--color-verify)]">{String(index + 1).padStart(2, "0")}</div>
                  <div className="mt-2 text-sm font-bold text-text">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel h-fit">
            <div className="panel-header">
              <div className="eyebrow">Verification contract</div>
              <span className="status-chip status-chip-accent">Visible in UI</span>
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-3 lg:grid-cols-1">
              <Contract icon={<WolframMark size={16} />} title="Wolfram computes" text="Results, exact values, graphs, and symbolic equivalence." />
              <Contract icon={<GeminiMark size={16} />} title="Gemini explains" text="Natural-language teaching grounded in returned results." />
              <Contract icon={<ShieldCheck size={16} />} title="StepWise guards" text="Unsupported numeric claims fall back to a deterministic computed answer." />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function StageLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="step-index step-index-active shrink-0">{n}</span>
      <div className="font-display text-sm font-bold text-text sm:text-base">{title}</div>
    </div>
  );
}

function StageDivider() {
  return (
    <div className="flex items-center gap-3 text-faint" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <ArrowRight size={16} className="rotate-90 text-[var(--color-verify)]" />
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Node({ index, icon, title, label, accent = false }: { index: string; icon: React.ReactNode; title: string; label: string; accent?: boolean }) {
  return (
    <div className={`architecture-node ${accent ? "architecture-node-accent" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`step-index shrink-0 ${accent ? "step-index-active" : ""}`}>{index}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-text">{icon}{title}</div>
          <p className="prose-readable mt-1.5 text-xs leading-5 text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SeqConnector() {
  return (
    <div className="flex h-5 items-center pl-[13px]" aria-hidden="true">
      <span className="h-full w-px bg-[var(--color-verify)]" />
    </div>
  );
}

function Contract({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-text">{icon}{title}</div>
      <p className="prose-readable mt-1.5 text-xs leading-5 text-muted">{text}</p>
    </div>
  );
}
