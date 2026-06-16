# StepWise - the AI tutor that shows its computation

> StepWise uses **Wolfram Language** to compute the displayed result, **Gemini** to explain it,
> and a numeric-claim guard to keep unsupported numbers out of the explanation.

Built for **OSC AI Build 1.0** · Theme: AI for Social Impact (education) · Future of Productivity

**Live demo:** [step-wise-taupe.vercel.app](https://step-wise-taupe.vercel.app/) ·
**Source code:** [github.com/RajdeepKushwaha5/StepWise](https://github.com/RajdeepKushwaha5/StepWise) ·
**Demo video:** [Watch the StepWise demo on YouTube](https://youtu.be/aNBWgXBYtb4)

---

## The problem
Normal AI tutors sound confident while getting math subtly wrong — a dropped term, a flipped sign,
a skipped rule. For a student who is *learning*, a confidently wrong explanation is worse than no
answer at all.

## The idea
StepWise separates **teaching** from **math**:
- A deterministic **intent router** handles common math; Gemini can map unfamiliar supported
  phrasing to approved tools, while unmapped requests fail closed without pretending to verify them.
- **Gemini** explains the returned computation like a patient tutor.
- **Wolfram Language** computes every displayed result and graph — the source of the answer.
- A **number-guard** rejects any number in the explanation that didn't come from Wolfram.
- The UI shows **AI alone vs StepWise** side by side, and when they differ it renders a **step-diff**:
  the AI's answer, the Wolfram answer, and the exact symbolic term that's off — all typeset.
- **Worked steps** (on demand): Wolfram computes the intermediate steps — the product rule term by
  term, or a definite integral as antiderivative → evaluate bounds → subtract — each line verified.
- **Multilingual**: the same Wolfram-verified answer can be explained in the student's language
  (English, Hindi, Bengali, Tamil, Telugu, Marathi, Spanish); the math, graph, and provenance stay
  identical — only the explanation changes.
- Practice Mode adds a repeatable learning loop with progressive hints, Wolfram-verified answers,
  targeted mistake analysis, and local progress tracking.
- Learning Insights turns those attempts into a mastery map, recurring-misconception analysis,
  hint-dependency metrics, and an adaptive next-topic recommendation.
- Computed tutor and practice sessions are saved locally and can be combined into study-report PDFs.

> Every other AI tutor asks you to trust it. StepWise shows the computation — and teaches you why.

## How AI is integrated
AI is the core of the product, not a bolt-on:
- A deterministic router maps common questions to Wolfram tools without an LLM. **Gemini (free
  tier only)** uses function-calling to translate unfamiliar supported questions into approved
  Wolfram operations, then narrates the result pedagogically.
- A second **"AI alone"** Gemini pass answers with no tools, and StepWise **symbolically compares** it to
  the Wolfram-computed answer (`FullSimplify[a - b == 0]`) to surface mistakes live.
- Gemini also **reads photographed problems** (multimodal) into an editable transcription, and
  **narrates in the student's chosen language** while keeping every number and expression untouched.
- Multi-key rotation + model fallback keep it reliable on the free tier.

## How Wolfram Language is used (judging note)
Wolfram is load-bearing — the verified result does not come from the LLM. Eight vetted
Wolfram tools run in **Wolfram Cloud**: `solve_equation`, `evaluate_expression`,
`simplify_expression`, `differentiate`, `integrate_expression`, `plot_function`, `verify_answer`
(symbolic equivalence), and `matrix_analysis`. Every computed answer ships with the exact Wolfram
code that produced it (provenance), graphs are rendered by Wolfram, the on-demand **worked steps**
and the **step-diff** are Wolfram-computed, and worked-solution PDFs are built from Wolfram
computations only.

## Try it
- Open **Practice** to choose a topic and difficulty, request hints, and submit an answer.
- Open **Insights** after several attempts to see recurring misconceptions, mastery by topic,
  difficulty performance, hint dependency, and the recommended next practice topic.
- Open **History** to search, reopen, delete, or export saved solutions and revision sets.
- Open **Tool lab** to inspect all eight supported operations and launch an example directly into
  the live tutor.
- "What is the derivative of x² sin(x)?" — compare the AI-alone answer with an independent Wolfram result.
- Click **Show the worked steps** on a derivative or definite integral to see each Wolfram-computed step.
- Switch the **language selector** to हिन्दी (or another language) and ask again — the explanation
  changes language while the Wolfram math stays identical.
- Upload a photo — review and correct the transcription before StepWise solves it.
- "Check my answer" — type your working; Wolfram verifies it symbolically.
- "Worked solution" → **Download PDF** — a provenance-backed study sheet in one click.

---

## Architecture

```
┌─────────────┐   POST /api/ask      ┌───────────────────────────────────────────┐
│  Next.js    │ ───────────────────► │              FastAPI backend              │
│ 2-col tutor │ {question, language} │  1. Gemini RAW pass   (no tools → may err)│
│  + KaTeX    │ ◄─────────────────── │  2. INTENT ROUTER     (deterministic first)│
└─────────────┘  {raw_answer,        │     → Gemini fallback for unfamiliar NL   │
                  verified_answer,   │  3. Wolfram executor  (wolframclient)     │
                  chart, wl_code,    │  4. Gemini NARRATOR   (grounded in #3,    │
                  discrepancy}       │     in the chosen language)               │
                                     │  5. Number-guard: trace numeric claims    │
                                     │  6. Diff AI-alone vs computed (symbolic)  │
                                     └───────────────────────────────────────────┘
                                          │ LLM: Gemini (free)      │ Compute: Wolfram Cloud
```

Worked steps (`POST /api/steps`) and photo transcription (`POST /api/ask/photo`) are separate,
isolated calls: worked steps are computed on demand and never affect the primary answer.

## Project layout
```
backend/                FastAPI service (Python)
  app/
    main.py             routes
    config.py           env / secrets (.env)
    learning.py         practice bank, progressive hints, and mistake analysis
    pipeline.py         tutoring loop (raw → route → compute → narrate[language] → guard → diff) + check_answer
    report.py           worked-solution builder (Wolfram tools, no LLM)
    pdf.py              ReportLab PDF of a worked solution
    llm/                gemini client, planner, raw pass, narrator (multilingual), vision (photo OCR)
    verify/guard.py     number-guard + AI-alone-vs-computed discrepancy
    wolfram/            cloud session + the 8 math-tool templates + isolated worked-steps templates
  Dockerfile            container for Render/Railway/Fly
frontend/               Next.js 16 app
  app/                  pages (/, /practice, /insights, /history, /capabilities, /architecture) + globals.css
  components/           navigation, AskConsole (photo + language), Verdict (step-diff), WorkedSteps,
                        CheckAnswer, Tex (KaTeX), ReportView, BackendWarmup (auto-retry cold start)…
  lib/                  API client, local history/progress/insight analytics, types, formatting
```

## Stack
Next.js 16 · Tailwind v4 · KaTeX · FastAPI · Gemini (free tier, `google-genai`) ·
Wolfram Cloud (`wolframclient`) · ReportLab.

The demo defaults to `gemini-2.5-flash-lite` for responsive free-tier judging, with additional
Gemini Flash models retained as automatic fallbacks.

---

## Run locally
Two services. Start the backend first.

### Prerequisites
- Python 3.13 (standard CPython build)
- Node.js 22+ and npm
- Gemini API key(s)
- Wolfram Cloud Secured Authentication Key

### Secrets
Copy `backend/.env.example` to `backend/.env`, then replace the placeholders. The real `.env` is
git-ignored and must never be committed.

```powershell
Copy-Item backend\.env.example backend\.env
```

Key settings:
```
GEMINI_API_KEYS=key1,key2,key3          # free keys from aistudio.google.com/apikey
WOLFRAM_CONSUMER_KEY=...                 # Wolfram Cloud Secured Authentication Key
WOLFRAM_CONSUMER_SECRET=...
CORS_ORIGINS=https://your-frontend.example.com   # optional, comma-separated
RATE_LIMIT_PER_MINUTE=30                         # optional, per-IP POST limit
```

`STEPWISE_API_KEY` is supported by the backend for server-to-server use, but the current browser
frontend does not send it. Do not set it for the current Vercel-style frontend deployment or all
browser POST requests will return `401`.

### Backend (`backend/`)
```powershell
py -3.13 -m venv .venv                    # standard CPython 3.13 (NOT the 3.13t free-threaded build)
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
.\run.ps1                                 # serves on http://localhost:8000 (one instance only)
```
`run.ps1` kills any straggler on :8000 first. Manual equivalent:
`$env:PYTHONPATH=(Get-Location).Path; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`

### Frontend (`frontend/`)
```powershell
npm ci
npm run dev                               # http://localhost:3000
```
The frontend calls `http://localhost:8000` by default; override with `NEXT_PUBLIC_API_URL` for a
deployed backend.

### Frontend pages
- `/` — live tutor: AI-alone vs Wolfram comparison + step-diff, on-demand worked steps, multilingual
  explanations, photo input, answer checking, and reports
- `/practice` — topic/difficulty practice, progressive hints, mistake analysis, and progress metrics
- `/insights` — browser-local misconception trends, accuracy breakdowns, mastery map, and adaptive
  next-topic recommendation
- `/history` — local solved-session library with search, reopen, delete, and PDF export
- `/capabilities` — Tool Lab with all eight approved operations, runnable examples, and the honest
  verification matrix
- `/architecture` — trust boundaries, request pipeline, and document pipeline

---

## API
- `GET  /api/health` or `/health` — Wolfram `$Version` + Gemini key count
- `GET  /api/examples` — a few demo questions
- `GET  /api/practice/topics` — available practice topics and difficulties
- `POST /api/practice/generate` — select a curated practice problem without returning its answer
- `POST /api/practice/hint` — reveal one progressive hint level
- `POST /api/practice/check` — Wolfram-verify an answer and return mistake analysis
- `POST /api/practice/reveal` — reveal the Wolfram-computed answer
- `POST /api/ask` — `{question, language}` → AI-alone vs Wolfram-computed answer + discrepancy + graph + code (explanation in the chosen language)
- `POST /api/ask/photo` — `{image_base64, mime_type}` → editable transcription; never auto-solves
- `POST /api/steps` — `{tool, tool_args}` → on-demand Wolfram-computed worked steps (isolated; returns `[]` rather than erroring)
- `POST /api/check` — `{student, correct, variable}` → symbolic equivalence verdict
- `POST /api/report` — expression plus originating tool context → operation-specific solution record
- `POST /api/report/pdf` — same, returns a downloadable PDF
- `POST /api/study-report/pdf` — combine selected saved computations into one PDF

Student/LLM expressions pass a strict math-only allowlist before evaluation (`_safe_expr`: approved
characters and function heads only, no assignments or executable syntax, length cap) and every
Wolfram call is time-bounded (`TimeConstrained`, 15s). If Gemini is briefly unavailable, common
questions fall back to deterministic intent routing and a no-LLM narration built from the Wolfram
result.

---

## Tests
```powershell
# backend — fast unit tests, no network (Wolfram/Gemini mocked)
cd backend; .\.venv\Scripts\python.exe -m unittest test_backend_unit -v
# backend — live Wolfram/Gemini smoke tests (self-skip when .env secrets are absent)
.\.venv\Scripts\python.exe test_tools.py
.\.venv\Scripts\python.exe test_pipeline.py
# frontend
cd frontend; npm run lint; npm run test:format; npm run build
```

## Deploy
Deploy `backend/` to a Docker-compatible host using the included `Dockerfile`, then deploy
`frontend/` to Vercel or another Next.js host. Set `NEXT_PUBLIC_API_URL` to the deployed backend,
set `CORS_ORIGINS` to the frontend origin, and provide all backend secrets as host environment
variables. Never commit `backend/.env`.
