import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from app.api.deps import get_registry, get_settings
from app.core.config import Settings
from app.schemas.system import InfoOut
from app.services.model_registry import ModelRegistry

router = APIRouter(tags=["system"])
ONNX_NAME = re.compile(r"^cnn_[a-z]+\.onnx$")


@router.get("/", include_in_schema=False)
def index(cfg: Settings = Depends(get_settings)):
    return FileResponse(cfg.static_dir / "index.html")


@router.get("/api/info", response_model=InfoOut)
def info(registry: ModelRegistry = Depends(get_registry)):
    """Which models exist and which labels are valid (the page needs it for the in-browser backend)."""
    return registry.info()


@router.get("/api/health")
def health():
    return {"status": "ok"}


@router.get("/api/metrics")
def runtime_metrics(request: Request):
    """Process-local startup telemetry; resets whenever the Space restarts."""
    started_at = getattr(request.app.state, "started_at", time.perf_counter())
    return {
        "startup_ms": round(getattr(request.app.state, "startup_ms", 0.0), 3),
        "uptime_ms": round((time.perf_counter() - started_at) * 1000, 3),
        "first_request_ms": getattr(request.app.state, "first_request_ms", None),
    }


@router.get("/models/{filename}", include_in_schema=False)
def onnx_model(filename: str, cfg: Settings = Depends(get_settings)):
    """Serves only the exported .onnx files; the .pt checkpoints stay private."""
    path = cfg.models_dir / filename
    if not ONNX_NAME.match(filename) or not path.is_file():
        raise HTTPException(404)
    return FileResponse(path, media_type="application/octet-stream")
