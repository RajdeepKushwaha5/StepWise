"""End-to-end test of the StepWise tutoring loop (no HTTP)."""
from __future__ import annotations

from app.pipeline import check_answer, tutor

QUESTIONS = [
    "What is the derivative of x^2 sin(x)?",
    "Solve x^2 - 5x + 6 = 0",
    "Integrate x^2 from 0 to 3",
]


def show(r: dict) -> None:
    print("\n" + "=" * 70)
    print("Q:", r["question"])
    print("-" * 70)
    print("AI ALONE (ungrounded): ", r["raw_answer"])
    print("VERIFIED (Wolfram):    ", r["verified_answer"])
    d = r["discrepancy"]
    if d:
        verdict = "AGREE" if d["agree"] else ">>> DISCREPANCY — caught a mistake <<<"
        print(f"DELTA [{d['headline_key']}]: raw={d['raw_value']} vs verified={d['verified']}  => {verdict}")
    print("tool:", r["tool"], r.get("tool_args"))
    print("clean (no fabricated numbers):", r["verified_clean"])
    print("provenance:", (r["wolfram_code"] or "").strip().splitlines()[0] if r["wolfram_code"] else None, "...")
    print("chart bytes:", len(r["chart_png_base64"]) if r["chart_png_base64"] else 0)


for q in QUESTIONS:
    show(tutor(q))

print("\n--- answer check ---")
chk = check_answer("2 x Sin[x] + x^2 Cos[x]", "D[x^2 Sin[x], x]")
print("student equivalent to correct?", chk["equivalent"])

print("\n[SUCCESS] Full tutoring loop ran.")
