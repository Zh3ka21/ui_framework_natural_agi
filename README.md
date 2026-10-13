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

## Hand gestures (webcam)

Switch on **Hand tracking** in the sidebar and show one hand to the camera. Hand landmarks are detected in the browser
with MediaPipe Hand Landmarker (about 10 MB, downloaded on first use); camera frames never leave the machine.

- Pinch thumb and index finger: draw (the pen follows the point between the two fingertips).
- Open the fingers: lift the pen.
- Hold a fist for one second: clear the canvas.

The camera needs HTTPS or `localhost`. Thresholds live in `CFG` at the top of `static/js/gesture.js`; hover the status
text under the camera preview to see the live pinch ratio while tuning them.

## Tests

```bash
python -m pytest -q tests          # API
node --test tests/js/*.test.mjs    # gesture logic (Node 22+, no browser or camera needed)
```
