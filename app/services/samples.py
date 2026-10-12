"""Stores user-confirmed samples. Today: PNG files under samples/<label>/. Later: a row in SQLite next to the file."""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np
from PIL import Image


def save_sample(samples_dir: Path, label: str, arr28: np.ndarray) -> str:
    d = samples_dir / label
    d.mkdir(parents=True, exist_ok=True)
    name = f"{int(time.time() * 1000)}.png"
    Image.fromarray((arr28 * 255).astype(np.uint8)).save(d / name)
    return f"{label}/{name}"
