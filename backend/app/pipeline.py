"""The StepWise tutoring pipeline — compute results before explaining them.

  question
      -> AI-alone pass answers ungrounded        (Gemini, may be subtly wrong)
      -> intent router picks a Wolfram tool      (deterministic first, Gemini fallback)
      -> Wolfram computes the real result        (the only source of truth)
      -> narrator explains it pedagogically       (Gemini, prose only)
      -> number-guard checks numeric claims        (reject fabricated numbers)
      -> discrepancy(AI-alone vs verified)        (the 'caught a mistake' moment)
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.llm.narrator import narrate, templated_answer
from app.llm.planner import plan
from app.llm.raw import raw_answer
from app.verify.guard import discrepancy, verify_text
from app.wolfram.tools import TOOLS, ToolError, run_tool
from app.learning import analyze_mistake

# --------------------------------------------------------------------------- #
# deterministic backup planner (keeps StepWise usable during an LLM outage)
# --------------------------------------------------------------------------- #

_INTENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(derivative|differentiate|d/d\w)\b", re.I), "differentiate"),
    (re.compile(r"\b(integrate|integral|antiderivative|area under)\b", re.I), "integrate_expression"),
    (re.compile(r"\b(solve|roots?|zeros?|find x)\b", re.I), "solve_equation"),
    (re.compile(r"\b(factor|expand|simplify)\b", re.I), "simplify_expression"),
    (re.compile(r"\b(plot|graph|sketch)\b", re.I), "plot_function"),
    (re.compile(r"\b(eigenvalues?|eigenvectors?|determinant|matrix|inverse)\b", re.I), "matrix_analysis"),
    (re.compile(r"\b(calculate|compute|evaluate|what is)\b", re.I), "evaluate_expression"),
]

_MATH_SIGNAL = re.compile(
    r"[\d=+\-*/^{}[\]()]|"
    r"\b(math|algebra|calculus|equation|expression|function|matrix|"
    r"derivative|differentiate|integral|integrate|solve|roots?|zeros?|"
    r"simplify|factor|expand|plot|graph|eigenvalues?|determinant|inverse|"
    r"calculate|compute|evaluate|pi|sin|cos|tan|log|sqrt|square root)\b",
    re.I,
)

# light natural-language -> Wolfram cleanup for the no-LLM fallback only
_WORD_FUNCS = {"sin": "Sin", "cos": "Cos", "tan": "Tan", "ln": "Log", "log": "Log",
               "sqrt": "Sqrt", "exp": "Exp", "abs": "Abs"}


def _rough_expression(question: str) -> str:
    """Best-effort extraction of the math expression from a plain question.

    Intentionally simple: this only has to keep the most common single-expression
    questions working while Gemini is briefly unavailable.
    """
    q = question
    for trigger in ("derivative of", "integral of", "integrate", "differentiate", "solve",
                    "simplify", "factor", "expand", "plot", "graph of", "graph",
                    "calculate", "compute", "evaluate", "what is"):
        idx = q.lower().find(trigger)
        if idx != -1:
            q = q[idx + len(trigger):]
            break
    q = re.split(r"\bwith respect to\b|\bfor\b|\?", q, flags=re.I)[0]
    q = q.strip(" .:=")
    for word, fn in _WORD_FUNCS.items():
        q = re.sub(rf"\b{word}\s*\(([^()]*)\)", rf"{fn}[\1]", q, flags=re.I)
    q = q.replace("π", "Pi")
    return re.sub(r"\bpi\b", "Pi", q, flags=re.I)


def _fallback_plan(question: str) -> dict[str, Any] | None:
    for pattern, name in _INTENTS:
        if pattern.search(question):
            expr = _rough_expression(question)
            if not expr and name != "matrix_analysis":
                return None
            if name == "solve_equation":
                return {"name": name, "args": {"equation": expr, "variable": "x"}}
            if name == "simplify_expression":
                op = "factor" if re.search(r"factor", question, re.I) else (
                    "expand" if re.search(r"expand", question, re.I) else "simplify")
                return {"name": name, "args": {"expression": expr, "operation": op}}
            if name == "matrix_analysis":
                m = re.search(r"\{\{.*\}\}", question)
                return {"name": name, "args": {"matrix": m.group(0)}} if m else None
            if name == "plot_function":
                return {"name": name, "args": {"expression": expr, "variable": "x"}}
            if name == "integrate_expression":
                bounds = re.search(
                    r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:\?|$)", question, re.I
                )
                if bounds:
                    expression = re.split(r"\bfrom\b", expr, maxsplit=1, flags=re.I)[0].strip()
                    return {
                        "name": name,
                        "args": {
                            "expression": expression,
                            "variable": "x",
                            "lower": bounds.group(1).strip(),
                            "upper": bounds.group(2).strip(" .?"),
                        },
                    }
                return {"name": name, "args": {"expression": expr, "variable": "x"}}
            if name == "evaluate_expression":
                return {"name": name, "args": {"expression": expr}}
            return {"name": name, "args": {"expression": expr, "variable": "x"}}
    return None


def _looks_like_math_question(question: str) -> bool:
    return bool(_MATH_SIGNAL.search(question))


# --------------------------------------------------------------------------- #
# main tutoring entrypoint
# --------------------------------------------------------------------------- #


def _graceful(question: str, raw: str, message: str) -> dict[str, Any]:
    return {
        "question": question,
        "tool": None,
        "tool_args": {},
        "raw_answer": raw,
        "verified_answer": message,
        "values": {},
        "wolfram_code": None,
        "chart_png_base64": None,
        "discrepancy": None,
        "verified_clean": True,
        "verification": {
            "scope": "none",
            "label": "No computation performed",
            "details": "StepWise only marks results verified after a Wolfram computation.",
        },
    }


def _numeric_inputs(args: dict[str, Any]) -> list[float]:
    out: list[float] = []
    for value in args.values():
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            out.append(float(value))
        elif isinstance(value, str):
            try:
                out.append(float(value.strip()))
            except ValueError:
                continue
    return out


# Tools whose answer is a single expression we can compare symbolically against the
# AI-alone answer. value = the key in `values` holding the canonical verified expression.
_SYMBOLIC_ANSWER_KEYS = {
    "differentiate": "derivative",
    "integrate_expression": "antiderivative",
    "simplify_expression": "result",
}


def _symbolic_discrepancy(raw_expr: str, verified_expr: str, variable: str) -> dict[str, Any] | None:
    """Ask Wolfram whether the AI-alone answer is equivalent to the proven one."""
    if not raw_expr or not verified_expr:
        return None
    correct = verified_expr.replace(" + C", "").strip()
    try:
        cmp = run_tool("verify_answer", student=raw_expr, correct=correct, variable=variable or "x")
    except Exception:  # noqa: BLE001 - a messy AI expression just means "no banner"
        return None
    vals = cmp["values"]
    return {
        "kind": "symbolic",
        "headline_key": None,
        "verified": correct,
        "raw_value": raw_expr,
        "agree": bool(vals.get("equivalent")),
        # the step-diff: the exact symbolic gap between the two answers, computed by Wolfram
        "verified_tex": vals.get("correct_tex"),
        "raw_tex": vals.get("student_tex"),
        "difference": vals.get("difference"),
        "difference_tex": vals.get("difference_tex"),
    }


def _build_discrepancy(
    tool: str, args: dict[str, Any], values: dict[str, Any], raw_expr: str, raw_prose: str
) -> dict[str, Any] | None:
    variable = str(args.get("variable", "x"))
    # symbolic answer (derivative / antiderivative / simplified form)
    answer_key = _SYMBOLIC_ANSWER_KEYS.get(tool)
    if answer_key and isinstance(values.get(answer_key), str):
        return _symbolic_discrepancy(raw_expr, values[answer_key], variable)
    # numeric answer (a concrete value or a definite integral)
    for key in ("numeric", "definite_integral"):
        if isinstance(values.get(key), (int, float)) and not isinstance(values.get(key), bool):
            disc = discrepancy(raw_prose, values, key)
            disc["kind"] = "numeric"
            return disc
    # explicitly-numeric headline declared by the tool (e.g. solve count) — skip, it misleads
    return None


def _grounded_answer(
    question: str, title: str, values: dict[str, Any], allowed_inputs: list[float]
) -> tuple[str, dict[str, Any]]:
    try:
        answer = narrate(question, title, values)
        check = verify_text(answer, values, allowed_inputs)
        if not check["ok"]:
            answer = narrate(question, title, values, strict=True)
            check = verify_text(answer, values, allowed_inputs)
    except Exception:  # noqa: BLE001 - computed results still have a safe no-LLM narration
        answer = templated_answer(title, values)
        check = verify_text(answer, values, allowed_inputs)
    if not check["ok"]:
        answer = templated_answer(title, values)
        check = verify_text(answer, values, allowed_inputs)
    return answer, check


def tutor(question: str) -> dict[str, Any]:
    if not _looks_like_math_question(question):
        return _graceful(
            question,
            "No AI-alone comparison was run.",
            "StepWise currently handles math questions: derivatives, integrals, equations, "
            "simplification, plots, arithmetic, and matrices.",
        )

    # 1 + 2) Start the AI-alone comparison while routing the computation.
    # Common intents route deterministically; Gemini planning handles unfamiliar phrasing.
    with ThreadPoolExecutor(max_workers=2) as pool:
        raw_future = pool.submit(raw_answer, question)
        sel = _fallback_plan(question)
        if not sel:
            try:
                sel = plan(question)
            except Exception:  # noqa: BLE001 - unsupported phrasing remains graceful
                sel = None
        try:
            raw = raw_future.result()
        except Exception:  # noqa: BLE001 - the verified path must survive Gemini downtime
            raw = {"prose": "The AI-alone comparison is temporarily unavailable.", "expr": ""}

    if not sel or sel.get("name") not in TOOLS:
        return _graceful(
            question,
            raw["prose"],
            "I can only answer with a Wolfram-verified computation, and I couldn't map this "
            "to one of my tools yet. Try a derivative, integral, equation to solve, an "
            "expression to simplify, or a function to plot.",
        )

    # 3) Wolfram computes the real result (the only answer we will ever teach)
    try:
        result = run_tool(sel["name"], **sel.get("args", {}))
    except ToolError as exc:
        return _graceful(question, raw["prose"], str(exc))
    except Exception:  # noqa: BLE001 - never 500 on a student's question
        return _graceful(
            question,
            raw["prose"],
            "I couldn't compute that one. Try rewriting the expression, e.g. use ^ for powers "
            "and * or a space for multiplication.",
        )

    values = result["values"]
    allowed_inputs = _numeric_inputs(sel.get("args", {}))

    # 4 + 5) Narration (Gemini) and comparison (Wolfram) are independent.
    with ThreadPoolExecutor(max_workers=2) as pool:
        answer_future = pool.submit(
            _grounded_answer, question, result["title"], values, allowed_inputs
        )
        discrepancy_future = pool.submit(
            _build_discrepancy,
            sel["name"],
            sel.get("args", {}),
            values,
            raw["expr"],
            raw["prose"],
        )
        answer, check = answer_future.result()
        disc = discrepancy_future.result()

    return {
        "question": question,
        "tool": sel["name"],
        "tool_args": sel.get("args", {}),
        "raw_answer": raw["prose"],
        "verified_answer": answer,
        "values": values,
        "wolfram_code": result["wolfram_code"],
        "chart_png_base64": result["chart_png_base64"],
        "discrepancy": disc,
        "verified_clean": check["ok"],
        "verification": {
            "scope": "computed_result_and_numeric_claims",
            "label": "Result computed; numeric claims checked",
            "details": (
                "Wolfram Language computed the displayed result. StepWise checked every numeric "
                "claim in the explanation against computed values or explicit problem inputs."
            ),
        },
    }


def check_answer(student: str, correct: str, variable: str = "x") -> dict[str, Any]:
    """Symbolically check a student's answer against the correct one (no LLM needed)."""
    result = run_tool("verify_answer", student=student, correct=correct, variable=variable)
    return {
        "tool": "verify_answer",
        "values": result["values"],
        "wolfram_code": result["wolfram_code"],
        "equivalent": bool(result["values"].get("equivalent")),
        "analysis": analyze_mistake(student, correct, bool(result["values"].get("equivalent"))),
    }
