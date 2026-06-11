export function fmtNum(n: number, maxFrac = 4): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

/** Format a value using a hint from its key. Most StepWise values are symbolic
 *  strings rendered verbatim; numbers are integers (counts) or plain reals. */
export function fmtByKey(key: string, value: number): string {
  const k = key.toLowerCase();
  if (k === "order" || k === "rank" || k === "num_solutions" || k.endsWith("_index")) {
    return fmtNum(value, 0);
  }
  return fmtNum(value);
}

export function prettyKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\btex\b/i, "(LaTeX)")
    .replace(/\bw r t\b/i, "w.r.t.")
    .trim();
}
