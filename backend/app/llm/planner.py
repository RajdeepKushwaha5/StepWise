"""Planner — Gemini chooses ONE Wolfram tool + arguments. It never computes the math.

Its only judgement calls are (a) which tool fits the student's question and (b) how to
translate the natural-language math into a valid Wolfram Language expression. The actual
answer always comes back from Wolfram.
"""
from __future__ import annotations

from typing import Any

from google.genai import types

from app.llm.gemini import get_client
from app.wolfram.tools import INT_PARAMS, TOOLS

PLANNER_SYSTEM = """You are the planner for StepWise, an AI math & STEM tutor whose every \
result is computed by Wolfram Language, never by you.

Your ONLY job: given a supported student's math question, choose one tool and fill its arguments. \
You never state, simplify, or compute the answer yourself.

How to translate math into Wolfram Language syntax:
- Powers use ^  (x squared -> x^2). Multiplication can be a space (2 x, x Sin[x]).
- Functions are capitalized with square brackets: Sin[x], Cos[x], Exp[x], Log[x], Sqrt[x], Abs[x].
- Constants: Pi, E. Equations use == (e.g. x^2 - 4 == 0). Fractions: (x + 1)/(x - 1).
- For "derivative of f", use differentiate with expression=f. For "integral of f", use
  integrate_expression. For "solve/roots", use solve_equation. For "simplify/factor/expand",
  use simplify_expression with the right operation. For "plot/graph", use plot_function.
- Always pass the variable the student is using (default x).
Pick the single best tool and use clean Wolfram syntax in the arguments."""


def _declarations() -> list[types.FunctionDeclaration]:
    decls: list[types.FunctionDeclaration] = []
    for name, meta in TOOLS.items():
        props = {
            p: types.Schema(
                type="INTEGER" if p in INT_PARAMS else "STRING", description=desc
            )
            for p, desc in meta["params"].items()
        }
        decls.append(
            types.FunctionDeclaration(
                name=name,
                description=meta["description"],
                parameters=types.Schema(type="OBJECT", properties=props),
            )
        )
    return decls


def plan(question: str) -> dict[str, Any] | None:
    """Return {'name': tool, 'args': {...}} or None if no tool was selected."""
    prompt = (
        f"Student question: {question}\n\n"
        "Choose the single best tool and translate the math into clean Wolfram Language syntax."
    )
    return get_client().select_function(prompt, PLANNER_SYSTEM, _declarations())
