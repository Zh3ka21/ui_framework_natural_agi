import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_registry, get_settings
from app.core.config import Settings
from app.schemas.samples import SaveIn, SaveOut
from app.services.model_registry import ModelRegistry
from app.services.preprocess import canvas_data_url_to_28
from app.services.samples import save_sample

log = logging.getLogger(__name__)
router = APIRouter(tags=["samples"])


@router.post("/save", response_model=SaveOut)
def save(req: SaveIn, registry: ModelRegistry = Depends(get_registry), cfg: Settings = Depends(get_settings)):
    if req.label not in registry.all_classes():
        raise HTTPException(400, "unknown label")
    arr = canvas_data_url_to_28(req.image)
    if arr is None:
        raise HTTPException(400, "empty canvas")
    saved = save_sample(cfg.samples_dir, req.label, arr)
    log.info("sample saved: %s", saved)
    return SaveOut(saved=saved)
