"""Exercise the Wolfram math-tool library against the cloud (one session). Saves charts.

This is a LIVE smoke test: it requires Wolfram Cloud credentials in backend/.env and
self-skips (exit 0) when they are absent, so offline/CI runs don't fail spuriously.
"""
from __future__ import annotations

import base64
from pathlib import Path

from app import config
from app.wolfram import tools
from app.wolfram.session import health_check


def _secrets_ready() -> bool:
    return bool(config.WOLFRAM_CONSUMER_KEY and config.WOLFRAM_CONSUMER_SECRET)

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)


def save_chart(name: str, b64: str | None) -> None:
    if not b64:
        print(f"       (no chart for {name})")
        return
    (OUT / f"{name}.png").write_bytes(base64.b64decode(b64))
    print(f"       chart -> out/{name}.png")


def show(result: dict) -> None:
    print(f"\n=== {result['tool']}: {result['title']} ===")
    for k, v in result["values"].items():
        print(f"       {k:>22}: {v}")
    print(f"       provenance: {result['wolfram_code'].splitlines()[1].strip()} ...")
    save_chart(result["tool"], result["chart_png_base64"])


def main() -> None:
    print("[*] Wolfram Cloud:", health_check())

    show(tools.differentiate("x^2 Sin[x]", "x"))
    show(tools.integrate_expression("x^2", "x"))
    show(tools.integrate_expression("x^2", "x", lower="0", upper="3"))
    show(tools.solve_equation("x^2 - 5 x + 6 == 0", "x"))
    show(tools.simplify_expression("(x^2 - 1)/(x - 1)", "simplify"))
    show(tools.evaluate_expression("Sin[Pi/6]"))
    show(tools.plot_function("Sin[x]/x", "x", -10, 10))
    show(tools.verify_answer("2 x Sin[x] + x^2 Cos[x]", "D[x^2 Sin[x], x]"))
    show(tools.matrix_analysis("{{1, 2}, {3, 4}}"))

    print("\n[SUCCESS] Wolfram math-tool library works end-to-end against the cloud.")


if __name__ == "__main__":
    if not _secrets_ready():
        print("[SKIP] test_tools needs live Wolfram Cloud secrets in backend/.env.")
        raise SystemExit(0)
    main()
