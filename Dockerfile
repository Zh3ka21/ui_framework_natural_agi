# Hugging Face Spaces Docker runtime
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    LOG_LEVEL=INFO

WORKDIR /app

# Pillow and PyTorch wheels are installed from requirements.txt; no compiler is needed at runtime.
COPY requirements-runtime.txt ./
RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.2" && \
    python -m pip install --no-cache-dir -r requirements-runtime.txt

COPY app ./app
COPY static ./static
COPY models ./models
COPY run.py ./run.py

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
