"""Turn a photographed STEM problem into text before the verified pipeline runs."""
from __future__ import annotations

import re

from app.llm.gemini import get_client

_SYSTEM = """You transcribe photographed STEM problems for StepWise.
Return only the problem the student wants solved, as one concise plain-text question.
Preserve equations, symbols, bounds, matrices, and requested operations accurately.
Use ^ for powers when practical. Do not solve, explain, or wrap the result in markdown."""


def extract_question(image: bytes, mime_type: str) -> str:
    text = get_client().generate_text_with_image(
        "Read the photographed problem and transcribe it exactly enough for a math engine.",
        image,
        mime_type,
        system=_SYSTEM,
    )
    text = re.sub(r"^```(?:text)?\s*|\s*```$", "", text.strip(), flags=re.I)
    text = re.sub(r"^(problem|question)\s*:\s*", "", text, flags=re.I)
    if not text:
        raise ValueError("I could not find a readable STEM problem in that photo.")
    if len(text) > 1200:
        raise ValueError("The photographed problem is too long. Crop to one problem and try again.")
    return text
