---
title: Handwriting Recognition
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
---

# Handwriting recognition

FastAPI + PyTorch handwriting recognition with an optional ONNX Runtime Web browser backend.

## Run locally with Docker

```bash
docker build -t handwriting-live .
docker run --rm -p 7860:7860 handwriting-live
```

Open http://localhost:7860.

## Latency measurements

`POST /predict` returns:

- `ms`: model inference duration, retained for the existing UI.
- `timings.preprocess_ms`: image decode and server-side preprocessing.
- `timings.model_ms`: server-side model inference.
- `timings.server_ms`: total server handler processing time.

The browser additionally measures PNG encoding, request/response round trip, and painting. Network round-trip includes server processing, so it overlaps with server-side stages and must not be added to them. End-to-end latency is measured from the input event to the next animation frame.
