"""StepWise FastAPI backend — computed results with visible provenance."""
from __future__ import annotations

import io
import re
import base64
import binascii
import threading
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app import config
from app.pdf import render_report_pdf, render_study_report_pdf
from app.learning import check_practice, generate_practice, practice_hint, practice_topics, reveal_practice
from app.pipeline import check_answer, tutor
from app.report import build_report
from app.llm.vision import extract_question
from app.wolfram.session import health_check
from app.wolfram.tools import ToolError, solution_steps

app = FastAPI(title="StepWise", description="A STEM tutor that computes results with Wolfram Language.")

app.add_middleware(
    CORSMiddleware,
    # Any localhost port — the Next dev server falls back to 3001/3002 when 3000 is busy,
    # which would otherwise silently break every API call from the browser.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPORT_CACHE: dict[tuple[str, str], dict] = {}
MAX_CACHED_REPORTS = 32
_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_RATE_LOCK = threading.Lock()
# Cap the number of tracked client buckets so the limiter can't grow without bound
# on a long-lived server; stale buckets are pruned each request and, as a backstop,
# the oldest bucket is evicted once this ceiling is reached.
_MAX_RATE_BUCKETS = 10_000


def _client_ip(request: Request) -> str:
    """Best-effort real client IP.

    Behind a proxy (Render/Vercel/etc.) request.client.host is the proxy address, so
    every visitor would share one bucket. The first hop of X-Forwarded-For is the
    original client; fall back to the direct peer when the header is absent.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",", 1)[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _prune_rate_buckets(now: float, keep: str) -> None:
    """Drop fully-aged-out buckets so memory stays bounded as clients come and go."""
    for ip in [ip for ip, hits in _RATE_BUCKETS.items() if not hits or now - hits[-1] >= 60]:
        if ip != keep:
            del _RATE_BUCKETS[ip]
    if keep not in _RATE_BUCKETS and len(_RATE_BUCKETS) >= _MAX_RATE_BUCKETS:
        # Backstop against a flood of distinct IPs: drop the least-recently-seen bucket.
        oldest = min(_RATE_BUCKETS, key=lambda ip: _RATE_BUCKETS[ip][-1] if _RATE_BUCKETS[ip] else 0.0)
        del _RATE_BUCKETS[oldest]


def _rate_limited(request: Request) -> bool:
    """Per-client sliding-window limiter. Returns True when the caller is over budget."""
    client = _client_ip(request)
    now = time.monotonic()
    with _RATE_LOCK:
        _prune_rate_buckets(now, client)
        bucket = _RATE_BUCKETS[client]
        while bucket and now - bucket[0] >= 60:
            bucket.popleft()
        if len(bucket) >= config.RATE_LIMIT_PER_MINUTE:
            return True
        bucket.append(now)
        return False

# A few demo problems that reliably show the "AI alone vs Wolfram-verified" gap.
EXAMPLE_QUESTIONS = [
    "What is the derivative of x^2 sin(x)?",
    "Solve x^2 - 5x + 6 = 0",
    "Integrate x^2 from 0 to 3",
    "Simplify (x^2 - 1)/(x - 1)",
    "Factor x^3 - x",
    "Plot sin(x)/x",
]


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    language: str = Field(default="English", max_length=40)


class PhotoAskBody(BaseModel):
    image_base64: str = Field(min_length=1, max_length=7_100_000)
    mime_type: str = Field(min_length=1, max_length=40)


class CheckBody(BaseModel):
    student: str = Field(min_length=1, max_length=400)
    correct: str = Field(min_length=1, max_length=400)
    variable: str = Field(default="x", min_length=1, max_length=32)


class StepsBody(BaseModel):
    tool: str = Field(min_length=1, max_length=80)
    tool_args: dict[str, Any] = Field(default_factory=dict)


class ReportBody(BaseModel):
    expression: str = Field(min_length=1, max_length=400)
    variable: str = Field(default="x", min_length=1, max_length=32)
    label: str = Field(default="Worked solution", max_length=240)
    tool: str | None = Field(default=None, max_length=80)
    tool_args: dict[str, Any] = Field(default_factory=dict)
    question: str = Field(default="", max_length=1200)


class PracticeGenerateBody(BaseModel):
    topic: str = Field(min_length=1, max_length=40)
    difficulty: str = Field(min_length=1, max_length=20)
    exclude_id: str = Field(default="", max_length=80)


class PracticeHintBody(BaseModel):
    problem_id: str = Field(min_length=1, max_length=80)
    level: int = Field(default=1, ge=1, le=3)


class PracticeCheckBody(BaseModel):
    problem_id: str = Field(min_length=1, max_length=80)
    student: str = Field(min_length=1, max_length=400)


class StudyReportItem(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    tool: str | None = Field(default=None, max_length=80)
    values: dict[str, Any] = Field(default_factory=dict)
    wolfram_code: str | None = Field(default=None, max_length=20_000)


class StudyReportBody(BaseModel):
    title: str = Field(default="StepWise study report", max_length=160)
    items: list[StudyReportItem] = Field(min_length=1, max_length=20)


@app.get("/")
def root() -> dict:
    return {
        "service": "StepWise API",
        "status_url": "/api/health",
        "health_alias": "/health",
        "interactive_docs": "/docs",
        "frontend": "https://step-wise-taupe.vercel.app/",
    }


@app.middleware("http")
async def protect_public_api(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method != "GET":
        if config.STEPWISE_API_KEY and request.headers.get("x-stepwise-key") != config.STEPWISE_API_KEY:
            return JSONResponse({"detail": "Missing or invalid API key."}, status_code=401)
        if _rate_limited(request):
            return JSONResponse(
                {"detail": "Too many requests. Wait a minute and try again."},
                status_code=429,
                headers={"Retry-After": "60"},
            )
    return await call_next(request)


def _worked_solution(body: ReportBody) -> dict:
    """Build once, then reuse the exact worked solution for preview and PDF."""
    normalized_label = body.label.strip() or "Worked solution"
    cache_key = (
        f"{body.expression}::{body.variable}::{body.tool}::{body.tool_args}",
        normalized_label,
    )
    cached = REPORT_CACHE.get(cache_key)
    if cached is not None:
        return cached
    try:
        report_data = build_report(
            body.expression,
            body.variable,
            normalized_label,
            body.tool,
            body.tool_args,
            body.question,
        )
    except ToolError as exc:
        raise HTTPException(422, str(exc)) from exc
    if len(REPORT_CACHE) >= MAX_CACHED_REPORTS:
        REPORT_CACHE.pop(next(iter(REPORT_CACHE)))
    REPORT_CACHE[cache_key] = report_data
    return report_data


@app.get("/health", include_in_schema=False)
@app.get("/api/health")
def health() -> JSONResponse:
    try:
        wolfram = health_check()
    except Exception as exc:  # noqa: BLE001 - health should report dependency failure, not 500
        wolfram = f"unavailable: {exc}"
    ok = not str(wolfram).startswith("unavailable:") and bool(config.GEMINI_API_KEYS)
    return JSONResponse({
        "status": "ok" if ok else "degraded",
        "wolfram": wolfram,
        "gemini_keys": len(config.GEMINI_API_KEYS),
        "model": config.GEMINI_MODEL,
    }, status_code=200 if ok else 503)


@app.get("/api/examples")
def examples() -> dict:
    return {"questions": EXAMPLE_QUESTIONS}


@app.get("/api/practice/topics")
def practice_topic_list() -> dict:
    return practice_topics()


@app.post("/api/practice/generate")
def practice_generate(body: PracticeGenerateBody) -> dict:
    try:
        return generate_practice(body.topic, body.difficulty, body.exclude_id)
    except ToolError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/practice/hint")
def practice_get_hint(body: PracticeHintBody) -> dict:
    try:
        return practice_hint(body.problem_id, body.level)
    except ToolError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/practice/check")
def practice_check(body: PracticeCheckBody) -> dict:
    try:
        return check_practice(body.problem_id, body.student)
    except ToolError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/practice/reveal")
def practice_reveal(body: PracticeHintBody) -> dict:
    try:
        return reveal_practice(body.problem_id)
    except ToolError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/ask")
def ask(body: AskBody) -> dict:
    if not body.question.strip():
        raise HTTPException(400, "question is empty")
    return tutor(body.question, body.language)


@app.post("/api/ask/photo")
def ask_photo(body: PhotoAskBody) -> dict:
    if body.mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Use a JPEG, PNG, or WebP photo.")
    try:
        image = base64.b64decode(body.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(400, "The photo data is invalid.") from exc
    if not image:
        raise HTTPException(400, "The photo is empty.")
    if len(image) > 5 * 1024 * 1024:
        raise HTTPException(413, "The photo is larger than 5 MB. Crop or compress it and try again.")
    try:
        question = extract_question(image, body.mime_type)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "I could not read that photo right now. Try again or type the problem.") from exc
    return {"question": question, "confirmed": False}


@app.post("/api/steps")
def steps(body: StepsBody) -> dict:
    # On-demand, Wolfram-verified worked steps. Isolated: returns [] rather than erroring.
    return {"steps": solution_steps(body.tool, body.tool_args)}


@app.post("/api/check")
def check(body: CheckBody) -> dict:
    if not body.student.strip() or not body.correct.strip():
        raise HTTPException(400, "both student and correct answers are required")
    try:
        return check_answer(body.student, body.correct, body.variable)
    except ToolError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post("/api/report")
def report(body: ReportBody) -> dict:
    if not body.expression.strip():
        raise HTTPException(400, "expression is empty")
    return _worked_solution(body)


@app.post("/api/report/pdf")
def report_pdf(body: ReportBody) -> StreamingResponse:
    if not body.expression.strip():
        raise HTTPException(400, "expression is empty")
    report_data = _worked_solution(body)
    pdf = render_report_pdf(report_data)
    safe_label = re.sub(r"[^a-zA-Z0-9_-]+", "-", body.label.strip() or "stepwise-solution").strip("-")
    filename = f"{safe_label or 'stepwise-solution'}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/study-report/pdf")
def study_report_pdf(body: StudyReportBody) -> StreamingResponse:
    pdf = render_study_report_pdf(body.title, [item.model_dump() for item in body.items])
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="stepwise-study-report.pdf"'},
    )
