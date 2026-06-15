"""Fast regression tests for StepWise's deterministic glue code (no network)."""
from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import REPORT_CACHE, _RATE_BUCKETS, app
from app.learning import analyze_mistake, generate_practice, practice_hint
from app.pdf import _fmt_value, render_report_pdf, render_study_report_pdf
from app.pipeline import _fallback_plan, _rough_expression, tutor
from app.report import build_report
from app.verify.guard import discrepancy, extract_numbers, verify_text
from app.wolfram import tools
from app.wolfram.tools import ToolError


class GuardTests(unittest.TestCase):
    def test_dates_do_not_become_fake_raw_numbers(self) -> None:
        self.assertEqual(extract_numbers("The root near 2025-06 is irrelevant."), [])
        result = discrepancy(
            "In 2025-05, the model guesses the integral is 29.75.",
            {"definite_integral": 9.0},
            "definite_integral",
        )
        self.assertEqual(result["raw_value"], 29.75)

    def test_missing_raw_number_is_not_a_false_discrepancy(self) -> None:
        result = discrepancy(
            "The AI-alone comparison is temporarily unavailable.",
            {"definite_integral": 9.0},
            "definite_integral",
        )
        self.assertIsNone(result["raw_value"])
        self.assertIsNone(result["agree"])

    def test_number_guard_credits_numbers_inside_symbolic_results(self) -> None:
        # The narrator quotes a symbolic derivative; its coefficients/exponents are
        # "verified" because they appear in the Wolfram-returned string.
        ok = verify_text(
            "The derivative is 2 x sin(x) + x^2 cos(x).",
            {"derivative": "2 x Sin[x] + x^2 Cos[x]"},
        )
        self.assertTrue(ok["ok"])

    def test_number_guard_flags_fabricated_numbers(self) -> None:
        fabricated = verify_text("The answer is 9.", {"derivative": "2 x"})
        self.assertFalse(fabricated["ok"])
        self.assertEqual(fabricated["unverified"], [9.0])

        allowed = verify_text("Take the 2nd derivative.", {}, [2.0])
        self.assertTrue(allowed["ok"])

    def test_number_guard_accepts_high_precision_numeric_strings(self) -> None:
        values = {"exact": "Pi", "numeric": "3.14159265358979323845859885078191098273"}
        result = verify_text(
            "That evaluates to 3.14159265358979323845859885078191098273.",
            values,
        )
        self.assertTrue(result["ok"])


class SafetyTests(unittest.TestCase):
    def test_safe_expr_accepts_plain_math(self) -> None:
        self.assertEqual(tools._safe_expr("x^2 + 3 x"), "x^2 + 3 x")
        self.assertEqual(tools._safe_expr("D[x^2 Sin[x], x]"), "D[x^2 Sin[x], x]")

    def test_safe_expr_blocks_io_and_statements(self) -> None:
        for bad in (
            "Import[\"/etc/passwd\"]",
            "x; DeleteFile[\"a\"]",
            "Run[\"ls\"]",
            "Set[x, 1]",
            'ToExpression["1+1"]',
            "Pause[100]",
            "Quit[]",
            'ExternalEvaluate["Python", "1+1"]',
            "x" * 500,
        ):
            with self.assertRaises(ToolError):
                tools._safe_expr(bad)

    def test_safe_var_rejects_non_symbols(self) -> None:
        self.assertEqual(tools._safe_var("theta"), "theta")
        with self.assertRaises(ToolError):
            tools._safe_var("x + 1")

    def test_solve_normalizes_single_equals(self) -> None:
        captured: dict[str, str] = {}

        def fake_evaluate(code: str):
            captured["code"] = code
            return {"values": {"solutions": "{2, 3}", "num_solutions": 2}, "chart": None}

        with patch("app.wolfram.tools.session.evaluate", side_effect=fake_evaluate):
            tools.solve_equation("x^2 - 5x + 6 = 0", "x")

        self.assertIn("6 == 0", captured["code"])

    def test_solve_wraps_bare_expression_against_zero(self) -> None:
        captured: dict[str, str] = {}

        def fake_evaluate(code: str):
            captured["code"] = code
            return {"values": {"num_solutions": 2}, "chart": None}

        with patch("app.wolfram.tools.session.evaluate", side_effect=fake_evaluate):
            tools.solve_equation("x^2 - 4", "x")

        self.assertIn("(x^2 - 4) == 0", captured["code"])

    def test_unsafe_expression_never_reaches_the_kernel(self) -> None:
        with patch("app.wolfram.tools.session.evaluate") as evaluate:
            with self.assertRaises(ToolError):
                tools.differentiate("Export[\"x\", 1]", "x")
            evaluate.assert_not_called()

    def test_strip_definition_reduces_function_definitions(self) -> None:
        self.assertEqual(tools._strip_definition("f(x) = 6x^3 - 9x + 4"), "6x^3 - 9x + 4")
        self.assertEqual(tools._strip_definition("y = x^2 + 1"), "x^2 + 1")
        self.assertEqual(tools._strip_definition("g(t) = t^2 + t"), "t^2 + t")
        # plain expressions and genuine equations are untouched
        self.assertEqual(tools._strip_definition("6x^3 - 9x + 4"), "6x^3 - 9x + 4")
        self.assertEqual(tools._strip_definition("x^2 - 5x + 6 = 0"), "x^2 - 5x + 6 = 0")

    def test_differentiate_accepts_function_definition_notation(self) -> None:
        # "differentiate f(x) = ..." must compute, not be rejected for the lone '='
        captured: dict[str, str] = {}

        def fake_evaluate(code: str):
            captured["code"] = code
            return {"values": {"derivative": "18 x^2 - 9", "order": 1}, "chart": None}

        with patch("app.wolfram.tools.session.evaluate", side_effect=fake_evaluate):
            out = tools.differentiate("f(x) = 6x^3 - 9x + 4", "x")

        self.assertNotIn("f(x)", captured["code"])  # the f(x)= wrapper was stripped
        self.assertIn("6x^3 - 9x + 4", captured["code"])
        self.assertEqual(out["values"]["derivative"], "18 x^2 - 9")


class PlannerFallbackTests(unittest.TestCase):
    def test_fallback_planner_routes_common_intents(self) -> None:
        self.assertEqual(_fallback_plan("what is the derivative of x^2 sin(x)?")["name"], "differentiate")
        self.assertEqual(_fallback_plan("integrate x^2")["name"], "integrate_expression")
        self.assertEqual(_fallback_plan("solve x^2 - 1 = 0")["name"], "solve_equation")
        self.assertEqual(_fallback_plan("factor x^3 - x")["name"], "simplify_expression")
        self.assertEqual(_fallback_plan("plot sin(x)")["name"], "plot_function")
        self.assertEqual(
            _fallback_plan("eigenvalues of {{1, 2}, {3, 4}}")["name"], "matrix_analysis"
        )
        self.assertEqual(_fallback_plan("what is pi?")["args"]["expression"], "Pi")
        definite = _fallback_plan("integrate x^2 from 0 to 3")
        self.assertEqual(definite["args"]["expression"], "x^2")
        self.assertEqual(definite["args"]["lower"], "0")
        self.assertEqual(definite["args"]["upper"], "3")

    def test_fallback_factor_picks_factor_operation(self) -> None:
        plan = _fallback_plan("factor x^3 - x")
        self.assertEqual(plan["args"]["operation"], "factor")

    def test_rough_expression_converts_word_functions(self) -> None:
        self.assertEqual(_rough_expression("derivative of sin(x)"), "Sin[x]")

    def test_conversational_filler_is_stripped(self) -> None:
        from app.pipeline import _fallback_is_computable

        # "differentiate this : f(x) = ..." should still route cleanly and compute
        sel = _fallback_plan("differentiate this : f(x) = 6x^3 - 9x + 4")
        self.assertEqual(sel["name"], "differentiate")
        self.assertTrue(_fallback_is_computable(sel))
        self.assertEqual(_rough_expression("differentiate the following function: f(x) = x^2"), "f(x) = x^2")

    def test_word_salad_is_not_treated_as_computable(self) -> None:
        from app.pipeline import _fallback_is_computable

        # matches the "differentiate" trigger but has no real math -> defer, don't feed Wolfram
        sel = _fallback_plan("differentiate the thing my teacher wrote on the board")
        self.assertFalse(_fallback_is_computable(sel))

    def test_find_roots_of_phrasing_is_stripped_to_clean_equation(self) -> None:
        from app.pipeline import _fallback_is_computable

        # Regression: "find roots of ..." must not leave the words in the equation, or
        # Wolfram would solve 'find * roots * of * 2 x^2 ...' as if they were variables.
        sel = _fallback_plan("find roots of 2x^2 - 5x - 3 = 0")
        self.assertEqual(sel["name"], "solve_equation")
        self.assertEqual(sel["args"]["equation"], "2x^2 - 5x - 3 = 0")
        self.assertTrue(_fallback_is_computable(sel))

    def test_prose_words_left_in_equation_are_not_computable(self) -> None:
        from app.pipeline import _fallback_is_computable

        # Even if prose leaks through, the guard refuses to treat words as variables.
        sel = {"name": "solve_equation", "args": {"equation": "find roots of 2x^2 - 5x - 3 == 0", "variable": "x"}}
        self.assertFalse(_fallback_is_computable(sel))


class PipelineTests(unittest.TestCase):
    def test_pipeline_survives_gemini_outage(self) -> None:
        result = {
            "tool": "differentiate",
            "title": "Derivative of x^2",
            "values": {"input": "x^2", "derivative": "2 x", "order": 1},
            "chart_png_base64": None,
            "wolfram_code": "D[x^2, x]",
        }
        with (
            patch("app.pipeline.raw_answer", side_effect=RuntimeError("Gemini down")),
            patch("app.pipeline.plan", side_effect=RuntimeError("Gemini down")),
            patch("app.pipeline.narrate", side_effect=RuntimeError("Gemini down")),
            patch("app.pipeline.run_tool", return_value=result),
        ):
            answer = tutor("what is the derivative of x^2?")

        self.assertEqual(answer["tool"], "differentiate")
        self.assertTrue(answer["verified_clean"])
        self.assertIn("temporarily unavailable", answer["raw_answer"])
        self.assertIsNone(answer["discrepancy"])  # no AI-alone expression to compare

    def test_common_intent_skips_gemini_planner(self) -> None:
        result = {
            "tool": "differentiate",
            "title": "Derivative",
            "values": {"derivative": "2 x"},
            "chart_png_base64": None,
            "wolfram_code": "D[x^2, x]",
        }
        with (
            patch("app.pipeline.raw_answer", return_value={"prose": "2x", "expr": "2x"}),
            patch("app.pipeline.plan") as planner,
            patch("app.pipeline.narrate", return_value="The derivative is 2 x."),
            patch("app.pipeline.run_tool", return_value=result),
        ):
            tutor("differentiate x^2")
        planner.assert_not_called()

    def test_answer_check_includes_mistake_analysis(self) -> None:
        with patch(
            "app.pipeline.run_tool",
            return_value={
                "values": {
                    "equivalent": False,
                    "student_simplified": "2 x",
                    "correct_simplified": "3 x^2",
                },
                "wolfram_code": "FullSimplify[...]",
            },
        ):
            from app.pipeline import check_answer

            result = check_answer("2 x", "3 x^2")
        self.assertFalse(result["equivalent"])
        self.assertIn("analysis", result)

    def test_symbolic_discrepancy_catches_a_wrong_derivative(self) -> None:
        def fake_run_tool(name: str, **params):
            if name == "verify_answer":
                return {"tool": name, "values": {"equivalent": False}, "wolfram_code": "FullSimplify[...]"}
            return {
                "tool": "differentiate",
                "title": "Derivative",
                "values": {"input": "x^2 Sin[x]", "derivative": "2 x Sin[x] + x^2 Cos[x]", "order": 1},
                "chart_png_base64": None,
                "wolfram_code": "D[x^2 Sin[x], x]",
            }

        with (
            patch("app.pipeline.raw_answer", return_value={"prose": "It's 2x cos(x).", "expr": "2 x Cos[x]"}),
            patch("app.pipeline.plan", return_value={"name": "differentiate", "args": {"expression": "x^2 Sin[x]", "variable": "x"}}),
            patch("app.pipeline.narrate", return_value="The derivative is 2 x sin(x) + x^2 cos(x)."),
            patch("app.pipeline.run_tool", side_effect=fake_run_tool),
        ):
            answer = tutor("derivative of x^2 sin(x)")

        disc = answer["discrepancy"]
        self.assertIsNotNone(disc)
        self.assertEqual(disc["kind"], "symbolic")
        self.assertFalse(disc["agree"])  # caught the AI teaching it wrong
        self.assertEqual(disc["raw_value"], "2 x Cos[x]")

    def test_symbolic_discrepancy_carries_step_diff_fields(self) -> None:
        def fake_run_tool(name: str, **params):
            if name == "verify_answer":
                return {
                    "tool": name,
                    "values": {
                        "equivalent": False,
                        "student_tex": "2 x \\cos (x)",
                        "correct_tex": "x^2 \\cos (x)+2 x \\sin (x)",
                        "difference": "x^2 Cos[x] + 2 x Sin[x] - 2 x Cos[x]",
                        "difference_tex": "x^2 \\cos (x)+2 x \\sin (x)-2 x \\cos (x)",
                    },
                    "wolfram_code": "FullSimplify[...]",
                }
            return {
                "tool": "differentiate",
                "title": "Derivative",
                "values": {"input": "x^2 Sin[x]", "derivative": "2 x Sin[x] + x^2 Cos[x]", "order": 1},
                "chart_png_base64": None,
                "wolfram_code": "D[x^2 Sin[x], x]",
            }

        with (
            patch("app.pipeline.raw_answer", return_value={"prose": "It's 2x cos(x).", "expr": "2 x Cos[x]"}),
            patch("app.pipeline.plan", return_value={"name": "differentiate", "args": {"expression": "x^2 Sin[x]", "variable": "x"}}),
            patch("app.pipeline.narrate", return_value="The derivative is 2 x sin(x) + x^2 cos(x)."),
            patch("app.pipeline.run_tool", side_effect=fake_run_tool),
        ):
            disc = tutor("derivative of x^2 sin(x)")["discrepancy"]

        self.assertEqual(disc["raw_tex"], "2 x \\cos (x)")
        self.assertEqual(disc["verified_tex"], "x^2 \\cos (x)+2 x \\sin (x)")
        self.assertIn("difference_tex", disc)
        self.assertTrue(disc["difference"])  # the exact symbolic gap is surfaced

    def test_pipeline_graceful_when_no_tool_matches(self) -> None:
        with patch("app.pipeline.raw_answer") as raw, patch("app.pipeline.plan") as planner:
            answer = tutor("tell me a story about triangles")
        self.assertIsNone(answer["tool"])
        self.assertIn("currently handles math questions", answer["verified_answer"])
        self.assertEqual(answer["verification"]["scope"], "none")
        raw.assert_not_called()
        planner.assert_not_called()


class ReportTests(unittest.TestCase):
    def test_report_builds_worked_solution_sections(self) -> None:
        def fake_run_tool(name: str, **params):
            return {
                "tool": name,
                "title": name.replace("_", " ").title(),
                "values": {"result": "ok"},
                "chart_png_base64": None,
                "wolfram_code": f"{name}[]",
            }

        with patch("app.report.tools.run_tool", side_effect=fake_run_tool):
            report = build_report("x^2", "x", "f(x) = x^2")

        names = [s["tool"] for s in report["sections"]]
        self.assertIn("differentiate", names)
        self.assertIn("integrate_expression", names)
        self.assertIn("plot_function", names)

    def test_report_never_returns_a_blank_document(self) -> None:
        with (
            patch("app.report.tools.run_tool", side_effect=RuntimeError("Wolfram down")),
            self.assertRaises(ToolError),
        ):
            build_report("x^2", "x")

    def test_report_uses_the_actual_operation_when_supplied(self) -> None:
        result = {
            "tool": "integrate_expression",
            "title": "Definite integral",
            "values": {"definite_integral": 9},
            "chart_png_base64": None,
            "wolfram_code": "Integrate[x^2, {x, 0, 3}]",
        }
        args = {"expression": "x^2", "variable": "x", "lower": "0", "upper": "3"}
        with patch("app.report.tools.run_tool", return_value=result) as run:
            report = build_report("x^2", "x", tool="integrate_expression", tool_args=args)
        self.assertEqual(len(report["sections"]), 1)
        run.assert_called_once_with("integrate_expression", **args)


class LearningTests(unittest.TestCase):
    def test_practice_generation_and_progressive_hint(self) -> None:
        problem = generate_practice("calculus", "easy")
        self.assertEqual(problem["topic"], "calculus")
        self.assertNotIn("answer", problem)
        hint = practice_hint(problem["id"], 1)
        self.assertEqual(hint["level"], 1)
        self.assertTrue(hint["hint"])

    def test_mistake_analysis_detects_sign_and_missing_term(self) -> None:
        sign = analyze_mistake("-2 x", "2 x", False)
        missing = analyze_mistake("2 x Cos[x]", "2 x Sin[x] + x^2 Cos[x]", False)
        self.assertEqual(sign["kind"], "sign")
        self.assertEqual(missing["kind"], "missing_term")


class PdfAndApiTests(unittest.TestCase):
    def setUp(self) -> None:
        _RATE_BUCKETS.clear()

    def test_pdf_renderer_returns_pdf_bytes(self) -> None:
        pdf = render_report_pdf(
            {
                "label": "f(x) = x^2 <worked>",
                "generated_on": "2026-06-10",
                "sections": [
                    {
                        "tool": "differentiate",
                        "title": "Derivative of x^2 & friends",
                        "values": {"derivative": "2 x", "order": 1},
                        "chart_png_base64": None,
                        "wolfram_code": "D[x^2, x]",
                    }
                ],
            }
        )
        self.assertGreater(len(pdf), 1000)
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_study_report_renderer_returns_pdf_bytes(self) -> None:
        pdf = render_study_report_pdf(
            "Revision set",
            [{"question": "Differentiate x^2", "tool": "differentiate", "values": {"derivative": "2 x"}, "wolfram_code": "D[x^2, x]"}],
        )
        self.assertTrue(pdf.startswith(b"%PDF"))

    def test_study_report_has_its_own_label_and_date(self) -> None:
        with patch("app.pdf.render_report_pdf", return_value=b"%PDF") as renderer:
            render_study_report_pdf(
                "Revision set",
                [{"question": "Evaluate 2+2", "values": {"exact": "4"}}],
            )
        report = renderer.call_args.args[0]
        self.assertEqual(report["document_type"], "STEPWISE STUDY REPORT")
        self.assertTrue(report["generated_on"])

    def test_pdf_formats_symbolic_lists(self) -> None:
        self.assertEqual(_fmt_value("solutions", ["x = 1", "x = 2"]), "[x = 1, x = 2]")

    def test_pdf_reuses_the_worked_solution_preview(self) -> None:
        report_data = {
            "label": "Cached solution",
            "generated_on": "2026-06-10",
            "sections": [
                {
                    "tool": "differentiate",
                    "title": "Derivative",
                    "values": {"derivative": "2 x"},
                    "chart_png_base64": None,
                    "wolfram_code": "D[x^2, x]",
                }
            ],
        }
        REPORT_CACHE.clear()
        client = TestClient(app)
        body = {"expression": "x^2", "variable": "x", "label": "Cached solution"}
        with patch("app.main.build_report", return_value=report_data) as builder:
            preview = client.post("/api/report", json=body)
            pdf = client.post("/api/report/pdf", json=body)

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        builder.assert_called_once()

    def test_examples_endpoint_lists_demo_questions(self) -> None:
        client = TestClient(app)
        res = client.get("/api/examples")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.json()["questions"]) >= 3)

    def test_practice_topics_and_generation_endpoints(self) -> None:
        client = TestClient(app)
        topics = client.get("/api/practice/topics")
        generated = client.post("/api/practice/generate", json={"topic": "algebra", "difficulty": "easy"})
        self.assertEqual(topics.status_code, 200)
        self.assertEqual(generated.status_code, 200)
        self.assertNotIn("answer", generated.json())

    def test_study_report_endpoint_returns_pdf(self) -> None:
        client = TestClient(app)
        res = client.post(
            "/api/study-report/pdf",
            json={"title": "Study set", "items": [{"question": "Evaluate 2+2", "tool": "evaluate_expression", "values": {"exact": "4"}, "wolfram_code": "2+2"}]},
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.content.startswith(b"%PDF"))

    def test_root_explains_backend_entrypoints(self) -> None:
        client = TestClient(app)
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status_url"], "/api/health")
        self.assertEqual(res.json()["health_alias"], "/health")
        self.assertEqual(res.json()["interactive_docs"], "/docs")

    def test_health_alias_matches_api_health(self) -> None:
        client = TestClient(app)
        with patch("app.main.health_check", return_value="15.0"):
            canonical = client.get("/api/health")
            alias = client.get("/health")
        self.assertEqual(alias.status_code, canonical.status_code)
        self.assertEqual(alias.json(), canonical.json())

    def test_photo_question_requires_transcription_confirmation(self) -> None:
        client = TestClient(app)
        with (
            patch("app.main.extract_question", return_value="differentiate x^2") as extract,
            patch("app.main.tutor") as verified_tutor,
        ):
            res = client.post(
                "/api/ask/photo",
                json={"image_base64": "aW1hZ2U=", "mime_type": "image/jpeg"},
            )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"question": "differentiate x^2", "confirmed": False})
        extract.assert_called_once_with(b"image", "image/jpeg")
        verified_tutor.assert_not_called()

    def test_photo_question_rejects_unsupported_files(self) -> None:
        client = TestClient(app)
        res = client.post(
            "/api/ask/photo",
            json={"image_base64": "aW1hZ2U=", "mime_type": "application/pdf"},
        )
        self.assertEqual(res.status_code, 415)

    def test_request_models_reject_oversized_questions(self) -> None:
        client = TestClient(app)
        res = client.post("/api/ask", json={"question": "x" * 1201})
        self.assertEqual(res.status_code, 422)

    def test_health_reports_dependency_failure(self) -> None:
        client = TestClient(app)
        with patch("app.main.health_check", side_effect=RuntimeError("offline")):
            res = client.get("/api/health")
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.json()["status"], "degraded")

    def test_optional_api_key_protects_write_routes(self) -> None:
        client = TestClient(app)
        with patch("app.main.config.STEPWISE_API_KEY", "secret"), patch("app.main.tutor", return_value={}):
            denied = client.post("/api/ask", json={"question": "differentiate x^2"})
            allowed = client.post(
                "/api/ask",
                json={"question": "differentiate x^2"},
                headers={"x-stepwise-key": "secret"},
            )
        self.assertEqual(denied.status_code, 401)
        self.assertNotEqual(allowed.status_code, 401)

    def test_post_rate_limit_returns_429(self) -> None:
        client = TestClient(app)
        with patch("app.main.config.RATE_LIMIT_PER_MINUTE", 1), patch("app.main.check_answer", return_value={}):
            first = client.post("/api/check", json={"student": "x", "correct": "x"})
            second = client.post("/api/check", json={"student": "x", "correct": "x"})
        self.assertNotEqual(first.status_code, 429)
        self.assertEqual(second.status_code, 429)


if __name__ == "__main__":
    unittest.main()
