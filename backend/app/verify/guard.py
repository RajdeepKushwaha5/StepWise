"""Number-guard: trace numeric narration claims to computation or explicit inputs.

- `extract_numbers` pulls numeric tokens out of free text.
- `verify_text` asserts every number in the narrator's answer is traceable to a
  Wolfram-computed value or an explicit numeric input (within tolerance). If
  not, the caller regenerates or falls back to a templated answer.
- `discrepancy` compares the raw (ungrounded) AI answer to the verified headline
  number — this is what powers the 'we caught the AI lying' moment.
"""
from __future__ import annotations

import re
from typing import Any

_NUM_RE = re.compile(r"-?\d[\d,]*\.?\d*")
_DATE_RE = re.compile(r"\b\d{4}-\d{1,2}(?:-\d{1,2})?\b")


def extract_numbers(text: str) -> list[float]:
    text = _DATE_RE.sub(" ", text or "")
    out: list[float] = []
    for tok in _NUM_RE.findall(text):
        try:
            out.append(float(tok.replace(",", "")))
        except ValueError:
            continue
    return out


def _numbers_in(value: Any) -> list[float]:
    """Numbers contained in a single value (scalar, string, or list)."""
    if isinstance(value, bool):
        return []
    if isinstance(value, (int, float)):
        return [float(value)]
    if isinstance(value, str):
        return extract_numbers(value)
    if isinstance(value, (list, tuple)):
        nums: list[float] = []
        for x in value:
            nums.extend(_numbers_in(x))
        return nums
    return []


def _flatten(values: dict[str, Any]) -> list[float]:
    """Every number Wolfram produced — scalars, list entries, and any number that
    appears inside a Wolfram-returned string (e.g. the coefficients and exponents of a
    symbolic result like "2 x Sin[x] + x^2 Cos[x]"). The tutor narrates around symbolic
    results, so a number is "verified" if it shows up anywhere Wolfram computed it.
    """
    nums: list[float] = []
    for v in values.values():
        nums.extend(_numbers_in(v))
    return nums


def _close(a: float, b: float, rel: float = 0.02, absol: float = 0.05) -> bool:
    return abs(a - b) <= max(absol, rel * max(abs(a), abs(b)))


def verify_text(
    text: str, values: dict[str, Any], allowed_inputs: list[float] | None = None
) -> dict[str, Any]:
    """Return {ok, unverified:[...]} — ok means no fabricated numbers."""
    verified = _flatten(values) + list(allowed_inputs or [])
    unverified: list[float] = []
    for n in extract_numbers(text):
        if any(_close(n, v) for v in verified):
            continue
        unverified.append(n)
    return {"ok": len(unverified) == 0, "unverified": unverified}


def discrepancy(
    raw_text: str, values: dict[str, Any], headline_key: str
) -> dict[str, Any]:
    """Compare the raw AI's number to the Wolfram-verified headline metric."""
    headline = values.get(headline_key)
    raw_nums = extract_numbers(raw_text)
    if headline is None or not isinstance(headline, (int, float)):
        return {"headline_key": headline_key, "verified": headline, "raw_value": None, "agree": None}
    candidates = raw_nums
    if headline >= 0:
        positive = [n for n in raw_nums if n >= 0]
        if positive:
            candidates = positive
    closest = min(candidates, key=lambda n: abs(n - headline), default=None)
    agree = None if closest is None else _close(closest, float(headline), rel=0.03, absol=0.1)
    return {
        "headline_key": headline_key,
        "verified": float(headline),
        "raw_value": closest,
        "agree": agree,
    }
