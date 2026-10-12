import time

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_registry, get_settings
from app.core.config import Settings
from app.schemas.predict import Candidate, PredictIn, PredictOut
from app.services.model_registry import ModelRegistry, UnknownMode
from app.services.preprocess import canvas_data_url_to_28

router = APIRouter(tags=["predict"])


@router.post("/predict", response_model=PredictOut)
def predict(req: PredictIn, registry: ModelRegistry = Depends(get_registry), cfg: Settings = Depends(get_settings)):
    # Sync route runs in a worker thread. Keep stage timers separate and monotonic.
    started = time.perf_counter()
    preprocess_started = started
    arr = canvas_data_url_to_28(req.image)
    preprocess_ms = (time.perf_counter() - preprocess_started) * 1000
    if arr is None:
        elapsed = (time.perf_counter() - started) * 1000
        return PredictOut(empty=True, label=None, candidates=[], preview=None, ms=elapsed,
                          timings={"preprocess_ms": preprocess_ms, "model_ms": 0.0, "server_ms": elapsed})
    model_started = time.perf_counter()
    try:
        cands = registry.predict(arr, min(req.topk, cfg.topk_max), req.mode)
    except UnknownMode:
        raise HTTPException(400, f"unknown mode {req.mode!r}")
    model_ms = (time.perf_counter() - model_started) * 1000
    elapsed = (time.perf_counter() - started) * 1000
    return PredictOut(
        empty=False, label=cands[0][0],
        candidates=[Candidate(label=l, prob=p) for l, p in cands],
        preview=(arr * 255).astype(int).tolist(),
        ms=model_ms,
        timings={"preprocess_ms": preprocess_ms, "model_ms": model_ms, "server_ms": elapsed},
    )
