"""Narrator — turns Wolfram's computed result into a clear tutoring explanation.

It teaches AROUND the values Wolfram already computed; it must not introduce any new
result or number of its own. The number-guard checks its output afterward, so the
explanation can be warm and human while the math stays provably correct.
"""
from __future__ import annotations

from typing import Any

from app.llm.gemini import get_client

NARRATOR_SYSTEM = """You are StepWise, an encouraging math & STEM tutor. You receive a \
student's question and the EXACT result computed by Wolfram Language. Explain it clearly \
in 2-4 short sentences, like a patient tutor talking to a student.

STRICT RULES:
- Use ONLY the result(s) provided below. Never invent, re-derive, or change a value.
- Quote the final answer Wolfram gave, then briefly explain the idea or the key step.
- Be warm and plain-spoken. Do not output LaTeX or code; write it the way you'd say it aloud.
- Never claim a different answer than the one provided, even if you think it's wrong."""


def _facts(values: dict[str, Any]) -> str:
    lines = []
    for k, v in values.items():
        if isinstance(v, (list, tuple)):
            shown = ", ".join(str(x) for x in v[:8])
            lines.append(f"- {k} = [{shown}]")
        else:
            lines.append(f"- {k} = {v}")
    return "\n".join(lines)


def _language_instruction(language: str) -> str:
    """Explain in the student's language while keeping the math itself untouched.

    Numbers, variables, and expressions must stay in standard notation so the
    number-guard (which reads Latin numerals) still traces every claim.
    """
    lang = (language or "English").strip()
    if lang.lower() in ("", "english", "en"):
        return ""
    return (
        f"\n\nWrite your entire explanation in {lang}. Keep all numbers, variable names, and "
        "mathematical expressions exactly as given, in standard notation — do not translate, "
        "transliterate, or convert the math or the digits."
    )


def narrate(
    question: str,
    title: str,
    values: dict[str, Any],
    strict: bool = False,
    language: str = "English",
) -> str:
    extra = "\nIMPORTANT: copy every number and symbol EXACTLY as given; change nothing." if strict else ""
    system = NARRATOR_SYSTEM + _language_instruction(language)
    prompt = (
        f"Student question: {question}\n\n"
        f"Wolfram-computed result ({title}):\n{_facts(values)}\n{extra}\n\n"
        "Explain it to the student now."
    )
    return get_client().generate_text(prompt, system=system, temperature=0.25)


def templated_answer(title: str, values: dict[str, Any]) -> str:
    """Guaranteed-safe fallback built directly from verified values (no LLM)."""
    # Prefer the most "answer-like" key for each tool.
    for key, lead in (
        ("derivative", "The derivative is"),
        ("antiderivative", "The antiderivative is"),
        ("definite_integral", "The definite integral equals"),
        ("result", "That simplifies to"),
        ("solutions", "The solution(s):"),
        ("numeric", "That evaluates to"),
        ("equivalent", "Answer equivalent:"),
    ):
        if key in values and not isinstance(values[key], (list, tuple)):
            return f"{lead} {values[key]}. (Computed by Wolfram Language.)"
    parts = [f"{k.replace('_', ' ')} = {v}" for k, v in values.items() if not isinstance(v, (list, tuple))]
    return f"StepWise computed ({title}): " + "; ".join(parts) + "."
