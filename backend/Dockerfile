# StepWise backend — FastAPI + wolframclient. Wolfram runs in the Cloud (via SAK),
# so the container itself is small and needs no local Wolfram Engine.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Hosts (Render/Railway/Fly) inject $PORT. Default to 8000 for local docker runs.
ENV PORT=8000
EXPOSE 8000

# --proxy-headers so request.client.host is the real client IP behind the host's
# load balancer (the per-IP rate limiter would otherwise throttle everyone together).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
