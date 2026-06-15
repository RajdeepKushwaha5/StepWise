"use client";

import { useEffect, useState } from "react";
import { warmBackend, type BackendHealth } from "@/lib/api";

export function BackendWarmup() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    void warmBackend().then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!health || health.status === "ok" || dismissed) return null;

  const message =
    health.status === "unreachable"
      ? "Can't reach the StepWise backend right now. It may be waking up — retry in a moment."
      : "The StepWise backend is running in a degraded state (Wolfram or Gemini is unavailable), so answers may fail. Try again shortly.";

  return (
    <output
      className="block border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 font-semibold underline underline-offset-2 hover:opacity-80"
        aria-label="Dismiss backend status notice"
      >
        Dismiss
      </button>
    </output>
  );
}
