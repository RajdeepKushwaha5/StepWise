"use client";

import { useEffect, useState } from "react";
import { warmBackend, type BackendHealth } from "@/lib/api";

export function BackendWarmup() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const maxAttempts = 20; // keep pinging (~1.5 min) so a cold free-tier host wakes fully

    async function poll() {
      if (!active) return;
      const result = await warmBackend();
      if (!active) return;
      setHealth(result);
      attempts += 1;
      // Stop once healthy; otherwise keep waking it and refreshing the notice.
      if (result.status !== "ok" && attempts < maxAttempts) {
        timer = setTimeout(poll, 4500);
      }
    }

    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (!health || health.status === "ok" || dismissed) return null;

  const message =
    health.status === "unreachable"
      ? "Waking up the StepWise backend — first load on free hosting can take up to a minute. Retrying automatically…"
      : "The StepWise backend is starting up (Wolfram or Gemini not ready yet). Retrying automatically — answers will work in a moment.";

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
