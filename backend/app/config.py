"""Central configuration. Loads secrets from backend/.env."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# --- LLM: Gemini free tier ONLY (hard project rule) ---------------------------
# Multiple keys supported for round-robin / failover on rate limits.
GEMINI_API_KEYS: list[str] = [
    k.strip() for k in os.environ.get("GEMINI_API_KEYS", "").split(",") if k.strip()
]
# Single-key fallback for convenience.
if not GEMINI_API_KEYS and os.environ.get("GEMINI_API_KEY"):
    GEMINI_API_KEYS = [os.environ["GEMINI_API_KEY"].strip()]

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")

# Optional comma-separated production frontend origins. Localhost remains
# allowed through the development regex configured in app.main.
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
STEPWISE_API_KEY = os.environ.get("STEPWISE_API_KEY", "").strip()
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "30"))

# --- Compute: Wolfram Cloud (Secured Authentication Key) ----------------------
WOLFRAM_CONSUMER_KEY = os.environ.get("WOLFRAM_CONSUMER_KEY")
WOLFRAM_CONSUMER_SECRET = os.environ.get("WOLFRAM_CONSUMER_SECRET")

DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


def assert_wolfram_configured() -> None:
    if not (WOLFRAM_CONSUMER_KEY and WOLFRAM_CONSUMER_SECRET):
        raise RuntimeError(
            "Missing WOLFRAM_CONSUMER_KEY / WOLFRAM_CONSUMER_SECRET in backend/.env"
        )
