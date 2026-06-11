"""Wolfram Cloud session management.

One long-lived authenticated session is reused across requests to save latency
and (importantly) cloud credits. All Wolfram Language evaluation in StepWise goes
through `evaluate()` here.
"""
from __future__ import annotations

import threading
import time

from wolframclient.evaluation import SecuredAuthenticationKey, WolframCloudSession
from wolframclient.language import wlexpr

from app import config

_session: WolframCloudSession | None = None
_lock = threading.Lock()
_eval_lock = threading.Lock()

_MAX_ATTEMPTS = 4


def _start_session() -> WolframCloudSession:
    config.assert_wolfram_configured()
    sak = SecuredAuthenticationKey(
        config.WOLFRAM_CONSUMER_KEY, config.WOLFRAM_CONSUMER_SECRET
    )
    last: Exception | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            session = WolframCloudSession(credentials=sak)
            session.start()
            return session
        except Exception as exc:  # noqa: BLE001 - transient SSL/connection resets
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(
        f"Wolfram Cloud authentication failed after {_MAX_ATTEMPTS} attempts. "
        f"If on campus Wi-Fi, switch to a hotspot. Last error: {last}"
    )


def get_session() -> WolframCloudSession:
    """Return a started, authenticated Wolfram Cloud session (lazy singleton)."""
    global _session
    if _session is None:
        with _lock:
            if _session is None:
                _session = _start_session()
    return _session


def reset_session() -> None:
    """Drop the cached session so the next call re-authenticates from scratch.

    The Wolfram Cloud occasionally returns a transient 401 ('Authentication
    required') when a token goes stale; recreating the SAK session fixes it.
    """
    global _session
    with _lock:
        if _session is not None:
            try:
                _session.terminate()
            except Exception:  # noqa: BLE001
                pass
            _session = None


def _evaluate_locked(code: str, retry: bool = True):
    try:
        return get_session().evaluate(wlexpr(code))
    except Exception:  # noqa: BLE001
        if not retry:
            raise
        reset_session()
        time.sleep(0.6)
        return _evaluate_locked(code, retry=False)


def evaluate(code: str):
    """Evaluate Wolfram code through the shared cloud session.

    The cloud session is intentionally reused, but its evaluations are serialized
    so simultaneous ask/report requests cannot corrupt or terminate one another.
    On a transient failure the session is rebuilt once before surfacing the error.
    """
    with _eval_lock:
        return _evaluate_locked(code)


def health_check() -> str:
    """Return the cloud kernel $Version (proves auth + connectivity)."""
    return evaluate("$Version")
