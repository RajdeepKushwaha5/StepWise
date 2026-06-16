"use client";

import { useState } from "react";
import { ListOrdered, Loader2 } from "lucide-react";
import { fetchSteps } from "@/lib/api";
import type { SolutionStep } from "@/lib/types";
import { Tex } from "@/components/Tex";

/** On-demand, Wolfram-computed worked steps. Loads only when the student asks, and
 *  quietly shows nothing extra if steps aren't available for this operation. */
export function WorkedSteps({ tool, toolArgs }: { tool: string; toolArgs: Record<string, unknown> }) {
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);

  async function load() {
    if (loading) return;
    setLoading(true);
    try {
      setSteps(await fetchSteps(tool, toolArgs));
    } finally {
      setLoading(false);
      setTried(true);
    }
  }

  if (steps === null) {
    return (
      <button type="button" onClick={load} disabled={loading} className="console-action console-action-primary mt-4">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ListOrdered size={14} />}
        <span>{loading ? "Computing steps" : "Show the worked steps"}</span>
      </button>
    );
  }

  if (steps.length === 0) {
    return tried ? <p className="mt-4 text-[11px] text-faint">Step-by-step isn&apos;t available for this operation.</p> : null;
  }

  return (
    <section className="proof-details mt-4">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="step-index step-index-active"><ListOrdered size={14} /></span>
          <div>
            <div className="eyebrow">Worked steps</div>
            <div className="mt-1 text-sm font-bold text-text">Each line computed by Wolfram</div>
          </div>
        </div>
      </div>
      <ol className="divide-y divide-line">
        {steps.map((step, index) => (
          <li key={`${index}-${step.label}`} className="flex gap-3 p-3 sm:p-4">
            <span className="step-index shrink-0">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-text">{step.label}</div>
              <div className="mt-1 overflow-x-auto font-mono text-sm text-[var(--color-verify)]">
                {step.result_tex ? <Tex tex={step.result_tex} /> : step.result}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
