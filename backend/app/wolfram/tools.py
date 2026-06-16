"""StepWise's Wolfram tool library — vetted, math-only symbolic templates.

Each tool:
  * takes a Wolfram-Language expression string (+ a few params),
  * runs ONE Wolfram Cloud evaluation (returns values + an optional rendered plot),
  * returns a normalized dict: { tool, title, values, chart_png_base64, wolfram_code }.

The LLM never computes the math — it only chooses which of these tools to run and
translates the student's natural-language question into an allowlisted Wolfram expression.
Every displayed result comes from Wolfram Language, and `wolfram_code` is the
human-readable provenance shown in the UI.
"""
from __future__ import annotations

import re
from typing import Any

from app.wolfram import session

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


class ToolError(Exception):
    """A user-facing, non-crashing problem (e.g. an expression we can't parse)."""


_MAX_EXPR_LEN = 400

_ALLOWED_HEADS = {
    "Abs", "AiryAi", "AiryBi", "ArcCos", "ArcCosh", "ArcCot", "ArcCoth",
    "ArcCsc", "ArcCsch", "ArcSec", "ArcSech", "ArcSin", "ArcSinh", "ArcTan",
    "ArcTanh", "Arg", "BesselJ", "BesselY", "Binomial", "Ceiling", "ConditionalExpression",
    "Conjugate", "Cos", "Cosh", "Cot", "Coth", "Csc", "Csch", "D", "Det",
    "Erf", "Erfc", "Exp", "Factorial", "Floor", "Gamma", "GCD", "Im", "Integrate",
    "LCM", "Limit", "Log", "Max", "Min", "Mod", "Norm", "Piecewise", "Product",
    "Re", "Root", "Round", "Sec", "Sech", "Sign", "Sin", "Sinh", "Sqrt", "Sum",
    "Surd", "Tan", "Tanh", "Transpose",
}
_HEAD_RE = re.compile(r"\b([A-Za-z][A-Za-z0-9]*)\s*\[")
_SINGLE_EQUALS_RE = re.compile(r"(?<![<>=!])=(?![=])")
_UNSAFE_SYNTAX = (
    '"', "'", ";", ":", "@", "&", "#", "_", "`", "~", "?", "%", "\\",
    "->", ":>", "/.", "//", "<<", ">>",
)
_ALLOWED_CHARS = re.compile(r"^[A-Za-z0-9+\-*/^().,\[\]{}<>=!\s]+$")


def _safe_expr(expr: str, *, label: str = "expression") -> str:
    """Accept only an explicit mathematical subset of Wolfram syntax."""
    cleaned = (expr or "").strip()
    if not cleaned:
        raise ToolError(f"I didn't get a math {label} to work with. Try writing it out, e.g. x^2 + 3x.")
    if len(cleaned) > _MAX_EXPR_LEN:
        raise ToolError(f"That {label} is too long for me to compute safely.")
    if not _ALLOWED_CHARS.fullmatch(cleaned):
        raise ToolError(f"That {label} contains syntax outside StepWise's math-only allowlist.")
    if any(token in cleaned for token in _UNSAFE_SYNTAX):
        raise ToolError(f"That {label} contains syntax outside StepWise's math-only allowlist.")
    if _SINGLE_EQUALS_RE.search(cleaned):
        raise ToolError("Use '==' for an equation; assignments are not allowed.")
    unknown_heads = sorted({head for head in _HEAD_RE.findall(cleaned) if head not in _ALLOWED_HEADS})
    if unknown_heads:
        raise ToolError(
            f"Unsupported math function: {unknown_heads[0]}. "
            "StepWise only evaluates approved mathematical functions."
        )
    if cleaned.count("[") != cleaned.count("]") or cleaned.count("(") != cleaned.count(")"):
        raise ToolError(f"That {label} has unbalanced brackets.")
    if cleaned.count("{") != cleaned.count("}"):
        raise ToolError(f"That {label} has unbalanced braces.")
    return cleaned


def _safe_var(var: str) -> str:
    """A variable must be a bare symbol like x, y, t, theta."""
    cleaned = (var or "x").strip()
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", cleaned):
        raise ToolError(f"'{var}' is not a valid variable name. Use a symbol like x, y, or t.")
    return cleaned


_DEFINITION_RE = re.compile(r"^[A-Za-z]\w*\s*(?:\(\s*[A-Za-z]\w*\s*\))?\s*=(?!=)\s*(.+)$")


def _strip_definition(expr: str) -> str:
    """Reduce a function definition like 'f(x) = 6x^3 - 9x + 4' (or 'y = ...') to its
    right-hand side.

    Students routinely write the definition and then ask to differentiate, integrate, or
    plot it; the lone '=' would otherwise trip the equation guard. Genuine equations with a
    relational operator (handled by solve_equation) are left untouched.
    """
    cleaned = (expr or "").strip()
    match = _DEFINITION_RE.match(cleaned)
    if match:
        rhs = match.group(1).strip()
        if not any(ch in rhs for ch in "=<>"):
            return rhs
    return cleaned


def _int(value: Any, default: int, *, low: int, high: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, n))


# Hard ceiling on any single cloud evaluation. Protects the demo (no hangs) and the
# limited Wolfram Cloud credits from a pathological expression (e.g. While[True], huge
# factorials). On timeout TimeConstrained returns $Aborted, which surfaces as a ToolError.
_EVAL_TIME_LIMIT = 15


def _run(exec_code: str) -> dict[str, Any]:
    """Evaluate the tool's Wolfram code and split values/chart out of the result.

    Wrapped in Quiet[...] to suppress benign cloud-kernel plot-styling messages and in
    TimeConstrained[...] to bound runtime. The computed values are validated below, so
    real failures (and timeouts) still surface as a non-dict result.
    """
    result = session.evaluate(f"TimeConstrained[Quiet[{exec_code}], {_EVAL_TIME_LIMIT}]")
    if not isinstance(result, dict):
        raise RuntimeError(f"Wolfram returned unexpected result: {result!r}")
    chart = result.get("chart")
    if not isinstance(chart, str) or not chart:
        chart = None
    return {"values": result.get("values", {}), "chart_png_base64": chart}


def _normalize(tool: str, title: str, exec_code: str, display_code: str) -> dict[str, Any]:
    out = _run(exec_code)
    if not out["values"]:
        raise ToolError(
            "Wolfram couldn't evaluate that. Check the expression and try rephrasing the problem."
        )
    return {
        "tool": tool,
        "title": title,
        "values": out["values"],
        "chart_png_base64": out["chart_png_base64"],
        "wolfram_code": display_code.strip(),
    }


# A reusable Plot fragment: renders {exprs} over the variable range as a base64 PNG,
# or returns Null if plotting fails (e.g. a multivariate or symbolic expression).
def _plot(exprs_wl: str, var: str, xmin: float, xmax: float, label: str, legends: str | None = None) -> str:
    legend_opt = f"PlotLegends -> {legends}, " if legends else ""
    return (
        "Module[{img = ExportByteArray["
        f"Plot[Evaluate[{exprs_wl}], {{{var}, {xmin}, {xmax}}}, {legend_opt}"
        f'PlotLabel -> "{label}", PlotTheme -> "Detailed", ImageSize -> 560], "PNG"]}}, '
        "If[ByteArrayQ[img], BaseEncode[img], Null]]"
    )


# --------------------------------------------------------------------------- #
# tools  (each = one vetted Wolfram Language template)
# --------------------------------------------------------------------------- #

_SOLVE = """
Module[{eq = __EQ__, var = __VAR__, sol, roots, reals},
 sol = Solve[eq, var];
 roots = var /. sol;
 reals = Select[roots, Element[#, Reals] && NumericQ[N[#]] &];
 <|"values" -> <|
     "solutions" -> ToString[roots, InputForm],
     "solutions_tex" -> ToString[TeXForm[roots]],
     "num_solutions" -> Length[sol],
     "numeric_solutions" -> ToString[N[reals, 6], InputForm]|>,
   "chart" -> Null|>]
"""


def solve_equation(equation: str, variable: str = "x") -> dict[str, Any]:
    eq = (equation or "").strip()
    if "==" not in eq:
        if "=" in eq.replace("<=", "").replace(">=", "").replace("!=", ""):
            # a single '=' from natural input -> Wolfram equality
            eq = re.sub(r"(?<![<>=!])=(?![=])", "==", eq)
        else:
            # a bare expression -> solve "expr == 0"
            eq = f"({eq}) == 0"
    eq = _safe_expr(eq, label="equation")
    var = _safe_var(variable)
    code = _SOLVE.replace("__EQ__", eq).replace("__VAR__", var)
    return _normalize("solve_equation", f"Solve {eq} for {var}", code, code)


_EVAL = """
Module[{ex = __EXPR__, val},
 val = N[ex, 10];
 <|"values" -> <|
     "exact" -> ToString[ex, InputForm],
     "exact_tex" -> ToString[TeXForm[ex]],
     "numeric" -> If[NumericQ[val], N[ex, 10], ToString[val, InputForm]]|>,
   "chart" -> Null|>]
"""


def evaluate_expression(expression: str) -> dict[str, Any]:
    ex = _safe_expr(_strip_definition(expression))
    code = _EVAL.replace("__EXPR__", ex)
    return _normalize("evaluate_expression", f"Evaluate {ex}", code, code)


_SIMPLIFY = """
Module[{ex = __EXPR__, res},
 res = __OP__[ex];
 <|"values" -> <|
     "input" -> ToString[ex, InputForm],
     "result" -> ToString[res, InputForm],
     "result_tex" -> ToString[TeXForm[res]]|>,
   "chart" -> Null|>]
"""

_SIMPLIFY_OPS = {"simplify": "FullSimplify", "factor": "Factor", "expand": "Expand",
                 "together": "Together", "apart": "Apart"}


def simplify_expression(expression: str, operation: str = "simplify") -> dict[str, Any]:
    ex = _safe_expr(_strip_definition(expression))
    op = _SIMPLIFY_OPS.get((operation or "simplify").strip().lower(), "FullSimplify")
    code = _SIMPLIFY.replace("__EXPR__", ex).replace("__OP__", op)
    verb = {"FullSimplify": "Simplify", "Factor": "Factor", "Expand": "Expand",
            "Together": "Combine", "Apart": "Decompose"}[op]
    return _normalize("simplify_expression", f"{verb} {ex}", code, code)


_DIFF = """
Module[{f = __EXPR__, var = __VAR__, d},
 d = D[f, {var, __ORDER__}];
 <|"values" -> <|
     "input" -> ToString[f, InputForm],
     "derivative" -> ToString[d, InputForm],
     "derivative_tex" -> ToString[TeXForm[d]],
     "order" -> __ORDER__|>,
   "chart" -> __CHART__|>]
"""


def differentiate(expression: str, variable: str = "x", order: int = 1) -> dict[str, Any]:
    f = _safe_expr(_strip_definition(expression))
    var = _safe_var(variable)
    n = _int(order, 1, low=1, high=6)
    chart = _plot(f"{{f, d}}", var, -5, 5, "Function (f) and its derivative", legends='{"f", "f\'"}')
    code = (
        _DIFF.replace("__EXPR__", f)
        .replace("__VAR__", var)
        .replace("__ORDER__", str(n))
        .replace("__CHART__", chart)
    )
    ordinal = {1: "", 2: "2nd ", 3: "3rd "}.get(n, f"{n}th ")
    return _normalize("differentiate", f"{ordinal}Derivative of {f} w.r.t. {var}", code, code)


_INTEGRATE_INDEF = """
Module[{f = __EXPR__, var = __VAR__, anti},
 anti = Integrate[f, var];
 <|"values" -> <|
     "input" -> ToString[f, InputForm],
     "antiderivative" -> ToString[anti, InputForm] <> " + C",
     "antiderivative_tex" -> ToString[TeXForm[anti]]|>,
   "chart" -> __CHART__|>]
"""

_INTEGRATE_DEF = """
Module[{f = __EXPR__, var = __VAR__, a = __A__, b = __B__, area},
 area = Integrate[f, {var, a, b}];
 <|"values" -> <|
     "input" -> ToString[f, InputForm],
     "lower" -> a, "upper" -> b,
     "definite_integral" -> If[NumericQ[N[area]], N[area, 8], ToString[area, InputForm]],
     "exact" -> ToString[area, InputForm]|>,
   "chart" -> __CHART__|>]
"""


def integrate_expression(
    expression: str, variable: str = "x", lower: str = "", upper: str = ""
) -> dict[str, Any]:
    f = _safe_expr(_strip_definition(expression))
    var = _safe_var(variable)
    has_bounds = str(lower).strip() != "" and str(upper).strip() != ""
    if has_bounds:
        a = _safe_expr(str(lower), label="lower bound")
        b = _safe_expr(str(upper), label="upper bound")
        chart = (
            "Module[{img = ExportByteArray["
            f"Plot[f, {{{var}, {a}, {b}}}, Filling -> Axis, "
            'PlotLabel -> "Area under the curve", PlotTheme -> "Detailed", ImageSize -> 560], "PNG"]}, '
            "If[ByteArrayQ[img], BaseEncode[img], Null]]"
        )
        code = (
            _INTEGRATE_DEF.replace("__EXPR__", f)
            .replace("__VAR__", var)
            .replace("__A__", a)
            .replace("__B__", b)
            .replace("__CHART__", chart)
        )
        return _normalize("integrate_expression", f"Definite integral of {f} on [{a}, {b}]", code, code)
    chart = _plot("{f}", var, -5, 5, "Integrand", legends=None)
    code = _INTEGRATE_INDEF.replace("__EXPR__", f).replace("__VAR__", var).replace("__CHART__", chart)
    return _normalize("integrate_expression", f"Integral of {f} d{var}", code, code)


_PLOT = """
Module[{f = __EXPR__, var = __VAR__},
 <|"values" -> <|
     "input" -> ToString[f, InputForm],
     "x_min" -> __XMIN__, "x_max" -> __XMAX__|>,
   "chart" -> __CHART__|>]
"""


def plot_function(
    expression: str, variable: str = "x", x_min: float = -10, x_max: float = 10
) -> dict[str, Any]:
    f = _safe_expr(_strip_definition(expression))
    var = _safe_var(variable)
    try:
        lo = float(x_min)
        hi = float(x_max)
    except (TypeError, ValueError):
        lo, hi = -10.0, 10.0
    if hi <= lo:
        lo, hi = -10.0, 10.0
    chart = _plot("{f}", var, lo, hi, f"Graph of {f}", legends=None)
    code = (
        _PLOT.replace("__EXPR__", f)
        .replace("__VAR__", var)
        .replace("__XMIN__", repr(lo))
        .replace("__XMAX__", repr(hi))
        .replace("__CHART__", chart)
    )
    return _normalize("plot_function", f"Graph of {f}", code, code)


_VERIFY = """
Module[{stu = __STU__, cor = __COR__, diff, equiv},
 diff = FullSimplify[cor - stu];
 equiv = TrueQ[diff == 0] || TrueQ[FullSimplify[stu == cor]];
 <|"values" -> <|
     "student" -> ToString[stu, InputForm],
     "correct" -> ToString[cor, InputForm],
     "student_simplified" -> ToString[FullSimplify[stu], InputForm],
     "correct_simplified" -> ToString[FullSimplify[cor], InputForm],
     "student_tex" -> ToString[TeXForm[stu]],
     "correct_tex" -> ToString[TeXForm[cor]],
     "difference" -> ToString[diff, InputForm],
     "difference_tex" -> ToString[TeXForm[diff]],
     "equivalent" -> equiv|>,
   "chart" -> Null|>]
"""


def verify_answer(student: str, correct: str, variable: str = "x") -> dict[str, Any]:
    stu = _safe_expr(student, label="answer")
    cor = _safe_expr(correct, label="answer")
    code = _VERIFY.replace("__STU__", stu).replace("__COR__", cor)
    return _normalize("verify_answer", "Check the student's answer", code, code)


_MATRIX = """
Module[{m = __MAT__, square, inv},
 square = MatrixQ[m] && SquareMatrixQ[m];
 inv = If[square && Det[m] != 0, ToString[Inverse[m], InputForm], "not invertible"];
 <|"values" -> <|
     "matrix" -> ToString[m, InputForm],
     "determinant" -> If[square, ToString[Det[m], InputForm], "needs a square matrix"],
     "rank" -> MatrixRank[m],
     "eigenvalues" -> If[square, ToString[Eigenvalues[m], InputForm], "needs a square matrix"],
     "inverse" -> inv|>,
   "chart" -> Null|>]
"""


def matrix_analysis(matrix: str) -> dict[str, Any]:
    m = _safe_expr(matrix, label="matrix")
    if not (m.startswith("{") and m.endswith("}")):
        raise ToolError("Write the matrix in Wolfram form, e.g. {{1, 2}, {3, 4}}.")
    code = _MATRIX.replace("__MAT__", m)
    return _normalize("matrix_analysis", f"Matrix analysis of {m}", code, code)


# --------------------------------------------------------------------------- #
# registry (used by the Gemini planner for function-calling)
# --------------------------------------------------------------------------- #

TOOLS: dict[str, dict[str, Any]] = {
    "solve_equation": {
        "fn": solve_equation,
        "description": (
            "Solve an equation or find the roots of an expression. Pass the equation in "
            "Wolfram syntax using '==' (e.g. 'x^2 - 5 x + 6 == 0'); a bare expression is "
            "solved against 0. Use for 'solve', 'roots', 'zeros', 'find x'."
        ),
        "params": {
            "equation": "the equation in Wolfram syntax, e.g. 'x^2 - 5 x + 6 == 0'",
            "variable": "the variable to solve for, e.g. x",
        },
        "headline": "num_solutions",
    },
    "evaluate_expression": {
        "fn": evaluate_expression,
        "description": (
            "Evaluate a concrete arithmetic or constant expression to an exact and numeric "
            "value, e.g. '2^10 + Sqrt[2]' or 'Sin[Pi/6]'. Use for 'what is', 'compute', 'calculate'."
        ),
        "params": {"expression": "the Wolfram expression to evaluate, e.g. 'Sin[Pi/6]'"},
        "headline": "numeric",
    },
    "simplify_expression": {
        "fn": simplify_expression,
        "description": (
            "Simplify, factor, or expand an algebraic expression. operation is one of "
            "simplify, factor, expand, together, apart."
        ),
        "params": {
            "expression": "the Wolfram expression, e.g. '(x^2 - 1)/(x - 1)'",
            "operation": "simplify | factor | expand | together | apart",
        },
        "headline": None,
    },
    "differentiate": {
        "fn": differentiate,
        "description": (
            "Differentiate an expression with respect to a variable and plot it. Use for "
            "'derivative', 'differentiate', 'd/dx', 'rate of change'. order is the derivative order."
        ),
        "params": {
            "expression": "the function, e.g. 'x^2 Sin[x]'",
            "variable": "the variable, e.g. x",
            "order": "derivative order (integer, default 1)",
        },
        "headline": None,
    },
    "integrate_expression": {
        "fn": integrate_expression,
        "description": (
            "Integrate an expression. Leave lower and upper empty for an indefinite integral "
            "(antiderivative); provide both for a definite integral / area. Use for 'integrate', "
            "'antiderivative', 'area under the curve'."
        ),
        "params": {
            "expression": "the integrand, e.g. 'x^2'",
            "variable": "the variable, e.g. x",
            "lower": "lower bound (leave empty for indefinite)",
            "upper": "upper bound (leave empty for indefinite)",
        },
        "headline": None,
    },
    "plot_function": {
        "fn": plot_function,
        "description": "Plot/graph a function of one variable over a range. Use for 'plot', 'graph', 'sketch'.",
        "params": {
            "expression": "the function to plot, e.g. 'Sin[x]/x'",
            "variable": "the variable, e.g. x",
            "x_min": "left edge of the range (number)",
            "x_max": "right edge of the range (number)",
        },
        "headline": None,
    },
    "verify_answer": {
        "fn": verify_answer,
        "description": (
            "Check whether a student's answer is mathematically equivalent to the correct "
            "answer, symbolically. Use when a student asks 'is my answer right?' and gives both."
        ),
        "params": {
            "student": "the student's answer expression",
            "correct": "the correct answer expression",
            "variable": "the variable involved, e.g. x",
        },
        "headline": None,
    },
    "matrix_analysis": {
        "fn": matrix_analysis,
        "description": (
            "Compute determinant, rank, eigenvalues, and inverse of a matrix written in "
            "Wolfram form, e.g. '{{1, 2}, {3, 4}}'."
        ),
        "params": {"matrix": "the matrix in Wolfram form, e.g. '{{1, 2}, {3, 4}}'"},
        "headline": "rank",
    },
}

# Parameters the planner should emit as integers rather than strings.
INT_PARAMS = {"order"}


def run_tool(name: str, **params: Any) -> dict[str, Any]:
    if name not in TOOLS:
        raise KeyError(f"Unknown tool: {name}")
    return TOOLS[name]["fn"](**params)


# --------------------------------------------------------------------------- #
# on-demand, Wolfram-verified worked steps (isolated: failure -> [] , never
# affects the primary answer)
# --------------------------------------------------------------------------- #

_DIFF_STEPS = """
Module[{f = __EXPR__, var = __VAR__, steps},
 steps = Which[
   Head[f] === Plus,
     Map[Function[t, <|
        "label" -> "d/d" <> ToString[var] <> "[ " <> ToString[t, InputForm] <> " ]",
        "result" -> ToString[D[t, var], InputForm],
        "result_tex" -> ToString[TeXForm[D[t, var]]]|>], List @@ f],
   Head[f] === Times && Length[List @@ f] == 2,
     With[{u = (List @@ f)[[1]], v = (List @@ f)[[2]]}, {
        <|"label" -> "Product rule with u = " <> ToString[u, InputForm] <> ", v = " <> ToString[v, InputForm],
          "result" -> "(u v)' = u' v + u v'", "result_tex" -> "(u v)' = u' v + u v'"|>,
        <|"label" -> "u' v", "result" -> ToString[D[u, var]*v, InputForm], "result_tex" -> ToString[TeXForm[D[u, var]*v]]|>,
        <|"label" -> "u v'", "result" -> ToString[u*D[v, var], InputForm], "result_tex" -> ToString[TeXForm[u*D[v, var]]]|>}],
   True,
     {<|"label" -> "d/d" <> ToString[var] <> "[ " <> ToString[f, InputForm] <> " ]",
        "result" -> ToString[D[f, var], InputForm],
        "result_tex" -> ToString[TeXForm[D[f, var]]]|>}];
 <|"values" -> <|
     "steps" -> steps,
     "final" -> ToString[D[f, var], InputForm],
     "final_tex" -> ToString[TeXForm[D[f, var]]]|>,
   "chart" -> Null|>]
"""

_INT_STEPS = """
Module[{f = __EXPR__, var = __VAR__, a = __A__, b = __B__, cap, res},
 cap = Integrate[f, var];
 res = Integrate[f, {var, a, b}];
 <|"values" -> <|
     "steps" -> {
        <|"label" -> "Find the antiderivative F(" <> ToString[var] <> ")",
          "result" -> ToString[cap, InputForm], "result_tex" -> ToString[TeXForm[cap]]|>,
        <|"label" -> "Evaluate F at the upper limit " <> ToString[b, InputForm],
          "result" -> ToString[Simplify[cap /. var -> b], InputForm],
          "result_tex" -> ToString[TeXForm[Simplify[cap /. var -> b]]]|>,
        <|"label" -> "Evaluate F at the lower limit " <> ToString[a, InputForm],
          "result" -> ToString[Simplify[cap /. var -> a], InputForm],
          "result_tex" -> ToString[TeXForm[Simplify[cap /. var -> a]]]|>,
        <|"label" -> "Subtract F(upper) - F(lower)",
          "result" -> ToString[res, InputForm], "result_tex" -> ToString[TeXForm[res]]|>},
     "final" -> ToString[res, InputForm], "final_tex" -> ToString[TeXForm[res]]|>,
   "chart" -> Null|>]
"""


def solution_steps(tool: str, args: dict[str, Any]) -> list[dict[str, Any]]:
    """Best-effort Wolfram-computed worked steps for a computed answer.

    Isolated by design: any failure (bad input, cloud error, unsupported operation)
    returns an empty list so the primary answer is never affected.
    """
    try:
        if tool == "differentiate":
            expr = _safe_expr(_strip_definition(str(args.get("expression", ""))))
            var = _safe_var(str(args.get("variable", "x")))
            code = _DIFF_STEPS.replace("__EXPR__", expr).replace("__VAR__", var)
        elif tool == "integrate_expression" and str(args.get("lower", "")).strip() and str(args.get("upper", "")).strip():
            expr = _safe_expr(_strip_definition(str(args.get("expression", ""))))
            var = _safe_var(str(args.get("variable", "x")))
            a = _safe_expr(str(args.get("lower")), label="lower bound")
            b = _safe_expr(str(args.get("upper")), label="upper bound")
            code = _INT_STEPS.replace("__EXPR__", expr).replace("__VAR__", var).replace("__A__", a).replace("__B__", b)
        else:
            return []
        out = _run(code)
        steps = out["values"].get("steps")
        return list(steps) if isinstance(steps, (list, tuple)) else []
    except Exception:  # noqa: BLE001 - steps are a bonus; never surface an error here
        return []
