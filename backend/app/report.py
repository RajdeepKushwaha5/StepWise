"""Operation-specific solution evidence builder.

Deterministic and LLM-free: every displayed result is computed by Wolfram Language.
When the originating operation is supplied, the report follows that operation rather
than running an unrelated generic function-analysis sequence.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from app.wolfram import tools


def build_report(
    expression: str,
    variable: str = "x",
    label: str = "Worked solution",
    tool: str | None = None,
    tool_args: dict[str, Any] | None = None,
    question: str = "",
) -> dict[str, Any]:
    expr = tools._safe_expr(tools._strip_definition(expression))
    var = tools._safe_var(variable)

    args = dict(tool_args or {})
    if tool in tools.TOOLS and tool != "verify_answer":
        plan = [(tool, args)]
    else:
        plan = [
            ("simplify_expression", {"expression": expr, "operation": "simplify"}),
            ("differentiate", {"expression": expr, "variable": var, "order": 1}),
            ("integrate_expression", {"expression": expr, "variable": var}),
            ("solve_equation", {"equation": f"({expr}) == 0", "variable": var}),
            ("plot_function", {"expression": expr, "variable": var, "x_min": -10, "x_max": 10}),
        ]

    sections: list[dict[str, Any]] = []
    for name, params in plan:
        try:
            sections.append(tools.run_tool(name, **params))
        except Exception:  # noqa: BLE001 - skip sections Wolfram can't produce for this expression
            continue

    if not sections:
        raise tools.ToolError(
            "StepWise couldn't build a worked solution for that. Check the expression and try again."
        )

    return {
        "label": label or f"f({var}) = {expr}",
        "question": question,
        "verification": "Each displayed result in this document was computed by Wolfram Language.",
        "generated_on": date.today().isoformat(),
        "sections": sections,
    }
