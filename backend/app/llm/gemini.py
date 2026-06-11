"""Gemini client: multi-key rotation + transient-error retries + model fallback.

Project hard rule: Gemini free tier is the ONLY LLM. For demo reliability the client
survives three failure modes without breaking a request:
  * rate-limit / dead (leaked/invalid) key  -> rotate to the next key
  * transient server error (500/503 overload) -> backoff + retry, rotate key
  * a model being overloaded for a while       -> fall back to another free Gemini model
"""
from __future__ import annotations

import time
from typing import Any, Callable

from google import genai
from google.genai import types

from app import config

# Supported Gemini models only — we never leave Gemini.
# gemini-2.0-flash was shut down on June 1, 2026.
_FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"]


class GeminiClient:
    def __init__(self, keys: list[str] | None = None, model: str | None = None):
        self.keys = keys or config.GEMINI_API_KEYS
        if not self.keys:
            raise RuntimeError("No GEMINI_API_KEYS configured in backend/.env")
        primary = model or config.GEMINI_MODEL
        self.models = [primary] + [m for m in _FALLBACK_MODELS if m != primary]
        self._i = 0

    @staticmethod
    def _classify(exc: Exception) -> str:
        s = str(exc).lower()
        code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        if code == 429 or any(
            x in s
            for x in ("429", "resource_exhausted", "quota", "exhausted", "rate limit",
                      "leaked", "api key not valid", "api_key_invalid", "invalid api key",
                      "permission_denied")
        ):
            return "rotate"
        if code in (500, 503) or any(
            x in s for x in ("503", "500", "unavailable", "overloaded", "high demand",
                             "internal error", "deadline", "timeout")
        ):
            return "retry"
        return "fatal"

    def _call(self, fn: Callable[[genai.Client, str], Any]) -> Any:
        last: Exception | None = None
        for model in self.models:
            for i in range(len(self.keys) + 2):
                client = genai.Client(
                    api_key=self.keys[self._i],
                    http_options=types.HttpOptions(timeout=60_000),
                )
                try:
                    return fn(client, model)
                except Exception as exc:  # noqa: BLE001
                    last = exc
                    kind = self._classify(exc)
                    if kind == "rotate":
                        self._i = (self._i + 1) % len(self.keys)
                        continue
                    if kind == "retry":
                        self._i = (self._i + 1) % len(self.keys)
                        time.sleep(min(1.2 * (i + 1), 5))
                        continue
                    raise
            # this model keeps failing — fall back to the next free Gemini model
        raise RuntimeError(f"All Gemini keys/models exhausted. Last error: {last}")

    def generate_text(
        self, prompt: str, system: str | None = None, temperature: float = 0.0
    ) -> str:
        def fn(client: genai.Client, model: str) -> str:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system, temperature=temperature
                ),
            )
            return (resp.text or "").strip()

        return self._call(fn)

    def generate_text_with_image(
        self,
        prompt: str,
        image: bytes,
        mime_type: str,
        system: str | None = None,
        temperature: float = 0.0,
    ) -> str:
        def fn(client: genai.Client, model: str) -> str:
            resp = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=image, mime_type=mime_type),
                    types.Part.from_text(text=prompt),
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system, temperature=temperature
                ),
            )
            return (resp.text or "").strip()

        return self._call(fn)

    def select_function(
        self,
        prompt: str,
        system: str,
        function_declarations: list[types.FunctionDeclaration],
    ) -> dict[str, Any] | None:
        def fn(client: genai.Client, model: str) -> dict[str, Any] | None:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0.0,
                    tools=[types.Tool(function_declarations=function_declarations)],
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(mode="AUTO")
                    ),
                ),
            )
            for cand in resp.candidates or []:
                for part in cand.content.parts or []:
                    call = getattr(part, "function_call", None)
                    if call:
                        return {"name": call.name, "args": dict(call.args or {})}
            return None

        return self._call(fn)


_client: GeminiClient | None = None


def get_client() -> GeminiClient:
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client
