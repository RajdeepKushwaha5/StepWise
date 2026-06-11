"""The 'AI alone' pass — a normal LLM solving the math directly, with NO tools.

This is how a typical chatbot answers: just predict the steps and the final answer.
On multi-step algebra/calculus it is often fluent and confident yet subtly wrong.
StepWise shows this answer beside the Wolfram-verified one so the student can SEE why
a verified tutor is different.

We also ask the model to restate its final answer as a single Wolfram-Language
expression (`FINAL_WL: ...`). The student never sees that line — it is plumbing that
lets StepWise *symbolically* compare the AI-alone answer to the proven one and surface
the "caught a mistake" moment automatically, even for non-numeric answers.
"""
from __future__ import annotations

import re

from app.llm.gemini import get_client

RAW_SYSTEM = """You are a typical helpful AI assistant (no calculator, no tools). A student \
asks a math question. Answer directly and confidently in 1-3 sentences and state the final \
answer explicitly — do not refuse, do not hedge, just give your single best answer the way an \
ordinary chatbot would, even if the algebra is hard.

Then, on a NEW LINE, restate ONLY your final answer as one Wolfram-Language expression in this \
exact format:
FINAL_WL: <expression>
Use ^ for powers, Sin[x]/Cos[x]/Exp[x]/Sqrt[x] for functions, Pi and E for constants. If your \
answer is not a single expression (or you can't express it), write FINAL_WL: NONE."""

_FINAL_RE = re.compile(r"FINAL_WL:\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)


def raw_answer(question: str) -> dict[str, str]:
    """Return {'prose': shown-to-student answer, 'expr': best-effort Wolfram expression}."""
    prompt = f"Question: {question}\n\nAnswer, then give the FINAL_WL line."
    text = get_client().generate_text(prompt, system=RAW_SYSTEM, temperature=0.3)
    expr = ""
    match = _FINAL_RE.search(text or "")
    if match:
        candidate = match.group(1).strip().strip("`")
        if candidate.upper() != "NONE":
            expr = candidate
    prose = _FINAL_RE.sub("", text or "").strip()
    return {"prose": prose or text or "", "expr": expr}
