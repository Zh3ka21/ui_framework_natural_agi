"""Settings in one place. Every value can be overridden with an environment variable (handy for Docker later)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    root: Path = ROOT
    models_dir: Path = field(default_factory=lambda: Path(os.getenv("MODELS_DIR", ROOT / "models")))
    static_dir: Path = field(default_factory=lambda: Path(os.getenv("STATIC_DIR", ROOT / "static")))
    samples_dir: Path = field(default_factory=lambda: Path(os.getenv("SAMPLES_DIR", ROOT / "samples")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    topk_max: int = 10


settings = Settings()
