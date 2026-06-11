import { ArrowRight, Bot, FileText, LockKeyhole, Server, ShieldCheck, Sigma } from "lucide-react";
import { GeminiMark, WolframMark } from "@/components/BrandMarks";
import { SiteHeader } from "@/components/SiteHeader";

const computedFlow = [
  { title: "Intent router", label: "Routes common math directly; Gemini translates unfamiliar phrasing", icon: <GeminiMark size={15} /> },
  { title: "Wolfram compute", label: "Produces the result, exact values, and graph", icon: <WolframMark size={15} /> },
  { title: "Gemini narration", label: "Explains only the values returned by Wolfram", icon: <GeminiMark size={15} /> },
  { title: "Guarded answer", label: "Checks numeric claims, then displays provenance", icon: <ShieldCheck size={15} /> },
];

const rules = [
  "The displayed result always comes from Wolfram",
  "Only approved Wolfram tools can execute",
  "Numeric claims are checked before the explanation is displayed",
  "Saved records retain the originating computation",
];

export default function ArchitecturePage() {
  return (
    <div className="app-frame min-h-screen">
      <SiteHeader active="architecture" />

      <main className="mx-auto max-w-[1340px] px-3 py-6 sm:px-5 lg:px-8 lg:py-10">
        <section className="grid gap-6 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-end">
          <div>
            <div className="eyebrow text-[var(--color-verify)]">System architecture / trust boundaries</div>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-[1.12] text-text sm:text-5xl">
              Language for teaching. <span className="text-[var(--color-verify)]">Computation for truth.</span>
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
              StepWise separates the fluent answer path from the computed answer path. Gemini explains and translates unfamiliar phrasing; Wolfram Language produces the displayed result.
            </p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-text"><LockKeyhole size={14} className="text-[var(--color-verify)]" /> Trust boundary</span>
              <span className="status-chip status-chip-accent">Implemented</span>
            </div>
            <div className="grid grid-cols-2">
              {rules.map((rule, index) => (
                <div key={rule} className="border-b border-r border-line p-3 text-[10px] uppercase leading-5 text-muted even:border-r-0">
                  <span className="mr-2 font-bold text-[var(--color-verify)]">{String(index + 1).padStart(2, "0")}</span>{rule}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Primary request pipeline</div>
              <div className="mt-1 text-sm font-bold text-text">POST /api/ask</div>
            </div>
            <span className="status-chip status-chip-accent">Two answer paths</span>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[220px_40px_minmax(0,1fr)] lg:p-6">
            <div className="space-y-3">
              <Node index="01" icon={<Sigma size={15} />} title="Confirmed question" label="Typed text, or a reviewed photo transcription" />
              <Connector />
              <Node index="02" icon={<Server size={15} />} title="FastAPI orchestrator" label="Runs the comparison and computed paths" />
            </div>
            <div className="hidden place-items-center text-[var(--color-verify)] lg:grid"><ArrowRight size={18} /></div>
            <div className="grid gap-4 md:grid-cols-[0.72fr_1.28fr]">
              <div className="border border-[var(--color-lie)] bg-[#f8eae8] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-lie)]"><Bot size={14} /> AI-alone branch</div>
                <div className="mt-4 border-t border-[var(--color-lie)] pt-4">
                  <div className="eyebrow">Purpose</div>
                  <p className="mt-2 text-xs leading-6 text-muted">Creates an intentionally ungrounded baseline. It stays visible so the exact risk is inspectable.</p>
                  <div className="mt-5 border-l-2 border-[var(--color-lie)] px-3">
                    <div className="eyebrow">Possible claim</div>
                    <div className="mt-1 font-mono text-lg font-bold line-through text-[var(--color-lie)]">2x cos(x)</div>
                  </div>
                </div>
              </div>
              <div className="border border-[var(--color-verify)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-verify)]"><ShieldCheck size={14} /> Computed branch</span>
                  <span className="status-chip status-chip-accent">Source of truth</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {computedFlow.map((step, index) => (
                    <Node key={step.title} index={String(index + 3).padStart(2, "0")} {...step} accent />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel h-fit">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Learning and document pipeline</div>
                <div className="mt-1 text-sm font-bold text-text">Practice to revision report</div>
              </div>
              <FileText size={15} className="text-[var(--color-verify)]" />
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-5">
              {["Choose practice", "Request hints", "Wolfram verifies", "Save locally", "Export study PDF"].map((label, index) => (
                <div key={label} className="bg-[var(--color-surface)] p-4">
                  <div className="text-[10px] font-bold text-[var(--color-verify)]">{String(index + 1).padStart(2, "0")}</div>
                  <div className="mt-2 text-xs font-bold text-text">{label}</div>
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
              <Contract icon={<WolframMark size={15} />} title="Wolfram computes" text="Results, exact values, graphs, and symbolic equivalence." />
              <Contract icon={<GeminiMark size={15} />} title="Gemini explains" text="Natural-language teaching grounded in returned results." />
              <Contract icon={<ShieldCheck size={15} />} title="StepWise guards" text="Unsupported numeric claims fall back to a deterministic computed answer." />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Node({ index, icon, title, label, accent = false }: { index: string; icon: React.ReactNode; title: string; label: string; accent?: boolean }) {
  return (
    <div className={`architecture-node ${accent ? "architecture-node-accent" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`step-index ${accent ? "step-index-active" : ""}`}>{index}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-text">{icon}{title}</div>
          <p className="mt-2 text-[10px] leading-5 text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return <div className="architecture-connector" aria-hidden="true" />;
}

function Contract({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-text">{icon}{title}</div>
      <p className="mt-2 text-[10px] leading-5 text-muted">{text}</p>
    </div>
  );
}
