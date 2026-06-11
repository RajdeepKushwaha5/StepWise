"""Deterministic practice, progressive hints, and verified mistake analysis."""
from __future__ import annotations

import random
import re
from typing import Any

from app.wolfram.tools import ToolError, run_tool

PRACTICE_PROBLEMS: list[dict[str, Any]] = [
    {
        "id": "calc-easy-diff-1",
        "topic": "calculus",
        "difficulty": "easy",
        "question": "Differentiate x^3.",
        "tool": "differentiate",
        "tool_args": {"expression": "x^3", "variable": "x"},
        "answer_key": "derivative",
        "hints": [
            "Use the power rule for a single power of x.",
            "For x^n, multiply by n and reduce the exponent by one.",
            "Start with 3 times x raised to the power 2.",
        ],
    },
    {
        "id": "calc-medium-diff-1",
        "topic": "calculus",
        "difficulty": "medium",
        "question": "Differentiate x^2 Sin[x].",
        "tool": "differentiate",
        "tool_args": {"expression": "x^2 Sin[x]", "variable": "x"},
        "answer_key": "derivative",
        "hints": [
            "This is a product of two functions.",
            "Use the product rule: differentiate each factor once while keeping the other.",
            "Combine 2 x Sin[x] with x^2 Cos[x].",
        ],
    },
    {
        "id": "calc-hard-int-1",
        "topic": "calculus",
        "difficulty": "hard",
        "question": "Integrate x^2 from 0 to 3.",
        "tool": "integrate_expression",
        "tool_args": {"expression": "x^2", "variable": "x", "lower": "0", "upper": "3"},
        "answer_key": "exact",
        "hints": [
            "Find an antiderivative, then evaluate it at both bounds.",
            "The antiderivative of x^2 is x^3/3.",
            "Compute 3^3/3 minus 0^3/3.",
        ],
    },
    {
        "id": "alg-easy-solve-1",
        "topic": "algebra",
        "difficulty": "easy",
        "question": "Solve x + 7 = 12.",
        "tool": "solve_equation",
        "tool_args": {"equation": "x + 7 == 12", "variable": "x"},
        "answer": "5",
        "hints": [
            "Isolate x by undoing the addition.",
            "Subtract 7 from both sides.",
            "Evaluate 12 - 7.",
        ],
    },
    {
        "id": "alg-medium-solve-1",
        "topic": "algebra",
        "difficulty": "medium",
        "question": "Solve x^2 - 5x + 6 = 0. Enter the solutions as {a, b}.",
        "tool": "solve_equation",
        "tool_args": {"equation": "x^2 - 5x + 6 == 0", "variable": "x"},
        "answer_key": "solutions",
        "hints": [
            "Try factoring the quadratic.",
            "Find two numbers that multiply to 6 and add to -5.",
            "Set (x - 2)(x - 3) equal to zero.",
        ],
    },
    {
        "id": "alg-hard-factor-1",
        "topic": "algebra",
        "difficulty": "hard",
        "question": "Factor x^3 - x.",
        "tool": "simplify_expression",
        "tool_args": {"expression": "x^3 - x", "operation": "factor"},
        "answer_key": "result",
        "hints": [
            "First take out the greatest common factor.",
            "After factoring out x, recognize a difference of squares.",
            "Use x(x - 1)(x + 1).",
        ],
    },
    {
        "id": "arith-easy-1",
        "topic": "arithmetic",
        "difficulty": "easy",
        "question": "Evaluate 7 * 8 + 4.",
        "tool": "evaluate_expression",
        "tool_args": {"expression": "7 * 8 + 4"},
        "answer_key": "exact",
        "hints": [
            "Use order of operations.",
            "Perform the multiplication before addition.",
            "Compute 56 + 4.",
        ],
    },
    {
        "id": "arith-medium-1",
        "topic": "arithmetic",
        "difficulty": "medium",
        "question": "Evaluate Sin[Pi/6].",
        "tool": "evaluate_expression",
        "tool_args": {"expression": "Sin[Pi/6]"},
        "answer_key": "exact",
        "hints": [
            "Use the standard unit-circle value.",
            "Pi/6 is 30 degrees.",
            "The sine value is one half.",
        ],
    },
    {
        "id": "arith-hard-1",
        "topic": "arithmetic",
        "difficulty": "hard",
        "question": "Evaluate (3^4 - 5^2)/7.",
        "tool": "evaluate_expression",
        "tool_args": {"expression": "(3^4 - 5^2)/7"},
        "answer_key": "exact",
        "hints": [
            "Evaluate each power before subtracting.",
            "Compute 3^4 and 5^2 separately.",
            "Subtract 25 from 81, then divide by 7.",
        ],
    },
    {
        "id": "linear-easy-det-1",
        "topic": "linear_algebra",
        "difficulty": "easy",
        "question": "Find the determinant of {{1, 2}, {3, 4}}.",
        "tool": "matrix_analysis",
        "tool_args": {"matrix": "{{1, 2}, {3, 4}}"},
        "answer_key": "determinant",
        "hints": [
            "For a 2 by 2 matrix, use ad - bc.",
            "Multiply the main diagonal, then subtract the other diagonal product.",
            "Compute 1*4 - 2*3.",
        ],
    },
    {
        "id": "linear-hard-eigen-1",
        "topic": "linear_algebra",
        "difficulty": "hard",
        "question": "Find the eigenvalues of {{2, 1}, {1, 2}}. Enter them as {a, b}.",
        "tool": "matrix_analysis",
        "tool_args": {"matrix": "{{2, 1}, {1, 2}}"},
        "answer_key": "eigenvalues",
        "hints": [
            "Set the determinant of A - lambda I equal to zero.",
            "The characteristic polynomial is (2 - lambda)^2 - 1.",
            "Solve (lambda - 1)(lambda - 3) = 0.",
        ],
    },
    {
        "id": "linear-medium-rank-1",
        "topic": "linear_algebra",
        "difficulty": "medium",
        "question": "Find the rank of {{1, 2}, {2, 4}}.",
        "tool": "matrix_analysis",
        "tool_args": {"matrix": "{{1, 2}, {2, 4}}"},
        "answer_key": "rank",
        "hints": [
            "Compare the two rows for linear dependence.",
            "The second row is a multiple of the first.",
            "Only one row contributes an independent direction.",
        ],
    },
]

_BY_ID = {problem["id"]: problem for problem in PRACTICE_PROBLEMS}


def practice_topics() -> dict[str, Any]:
    topics: dict[str, list[str]] = {}
    for problem in PRACTICE_PROBLEMS:
        topics.setdefault(problem["topic"], [])
        if problem["difficulty"] not in topics[problem["topic"]]:
            topics[problem["topic"]].append(problem["difficulty"])
    return {"topics": topics, "total_problems": len(PRACTICE_PROBLEMS)}


def generate_practice(topic: str, difficulty: str, exclude_id: str = "") -> dict[str, Any]:
    candidates = [
        p for p in PRACTICE_PROBLEMS
        if p["topic"] == topic and p["difficulty"] == difficulty and p["id"] != exclude_id
    ]
    if not candidates:
        candidates = [
            p for p in PRACTICE_PROBLEMS
            if p["topic"] == topic and p["difficulty"] == difficulty
        ]
    if not candidates:
        raise ToolError("No practice problem is available for that topic and difficulty yet.")
    problem = random.choice(candidates)
    return {
        "id": problem["id"],
        "topic": problem["topic"],
        "difficulty": problem["difficulty"],
        "question": problem["question"],
        "hint_count": len(problem["hints"]),
    }


def practice_hint(problem_id: str, level: int) -> dict[str, Any]:
    problem = _problem(problem_id)
    bounded = max(1, min(level, len(problem["hints"])))
    return {"problem_id": problem_id, "level": bounded, "hint": problem["hints"][bounded - 1]}


def check_practice(problem_id: str, student: str) -> dict[str, Any]:
    problem = _problem(problem_id)
    correct, computation = _computed_answer(problem)
    checked = run_tool("verify_answer", student=student, correct=correct, variable="x")
    equivalent = bool(checked["values"].get("equivalent"))
    return {
        "problem_id": problem_id,
        "equivalent": equivalent,
        "analysis": analyze_mistake(student, correct, equivalent),
        "student_simplified": checked["values"].get("student_simplified"),
        "correct_simplified": checked["values"].get("correct_simplified"),
        "correct_answer": correct if equivalent else None,
        "tool": problem["tool"],
        "tool_args": problem["tool_args"],
        "values": computation["values"],
        "wolfram_code": computation["wolfram_code"],
    }


def reveal_practice(problem_id: str) -> dict[str, Any]:
    problem = _problem(problem_id)
    correct, computation = _computed_answer(problem)
    return {
        "problem_id": problem_id,
        "correct_answer": correct,
        "tool": problem["tool"],
        "tool_args": problem["tool_args"],
        "values": computation["values"],
        "wolfram_code": computation["wolfram_code"],
    }


def analyze_mistake(student: str, correct: str, equivalent: bool) -> dict[str, str]:
    if equivalent:
        return {
            "kind": "correct",
            "title": "Equivalent answer",
            "explanation": "Wolfram confirmed that your answer is mathematically equivalent.",
            "next_step": "Try another problem or increase the difficulty.",
        }
    stu = student.replace(" ", "")
    cor = correct.replace(" ", "")
    if stu.lstrip("-") == cor.lstrip("-") and stu.startswith("-") != cor.startswith("-"):
        kind, title, explanation = "sign", "Possible sign error", "Your expression matches the verified form except for its overall sign."
    elif "+C" in correct and "+C" not in student:
        kind, title, explanation = "constant", "Missing integration constant", "Indefinite integrals need an arbitrary constant."
    elif _term_count(student) < _term_count(correct):
        kind, title, explanation = "missing_term", "A term may be missing", "The verified expression contains more additive terms than your answer."
    elif _numbers(student) != _numbers(correct):
        kind, title, explanation = "coefficient", "Check the coefficients", "The numerical factors in your answer differ from the verified expression."
    else:
        kind, title, explanation = "not_equivalent", "Not equivalent yet", "Wolfram simplified both expressions and they do not represent the same result."
    return {
        "kind": kind,
        "title": title,
        "explanation": explanation,
        "next_step": "Compare your simplified form with the verified form and revise one step at a time.",
    }


def _computed_answer(problem: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    computation = run_tool(problem["tool"], **problem["tool_args"])
    if "answer" in problem:
        answer = problem["answer"]
    else:
        answer = computation["values"].get(problem["answer_key"])
    if answer is None:
        raise ToolError("The verified answer could not be prepared for this practice problem.")
    return str(answer).replace(" + C", "").strip(), computation


def _problem(problem_id: str) -> dict[str, Any]:
    problem = _BY_ID.get(problem_id)
    if not problem:
        raise ToolError("That practice problem no longer exists. Generate another one.")
    return problem


def _term_count(value: str) -> int:
    return len(re.findall(r"(?<!\^)[+-]", value.replace(" ", ""))) + 1


def _numbers(value: str) -> list[str]:
    return re.findall(r"-?\d+(?:\.\d+)?", value)
