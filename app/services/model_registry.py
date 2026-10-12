"""Loads the CNNs once at startup and answers predictions. The only module that knows about PyTorch.

Later (NaturalAGI): add a second class with the same interface (predict / info / all_classes) and pick it in
main.py, nothing else changes. To deploy without PyTorch, an onnxruntime-based class can replace this one.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)
MODES = ("letters", "digits", "mixed")


class UnknownMode(ValueError):
    pass


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, dict] = {}

    # ---- loading ----
    def load(self, name: str, path: Path) -> None:
        import torch

        from app.ml.net import Net
        ckpt = torch.load(path, map_location="cpu")
        net = Net(len(ckpt["classes"])); net.load_state_dict(ckpt["state_dict"]); net.eval()
        self._models[name] = {"net": net, "classes": ckpt["classes"]}
        log.info("loaded %s <- %s (%d classes)", name, path.name, len(ckpt["classes"]))

    def load_dir(self, models_dir: Path) -> None:
        for name in MODES:
            p = models_dir / f"cnn_{name}.pt"
            if p.exists():
                self.load(name, p)
        for required in ("letters", "digits"):
            if required not in self._models:
                raise RuntimeError(f"models/cnn_{required}.pt not found in {models_dir}")

    # ---- queries ----
    def has(self, name: str) -> bool:
        return name in self._models

    def all_classes(self) -> list[str]:
        if self.has("mixed"):
            return self._models["mixed"]["classes"]
        return self._models["letters"]["classes"] + self._models["digits"]["classes"]

    def info(self) -> dict:
        return {"unified": self.has("mixed"), "classes": {k: v["classes"] for k, v in self._models.items()}, "all": self.all_classes()}

    # ---- inference ----
    def _single(self, name: str, arr28: np.ndarray, topk: int) -> list[tuple[str, float]]:
        import torch
        if name not in self._models:
            raise UnknownMode(name)
        m = self._models[name]
        x = torch.tensor(arr28, dtype=torch.float32)[None, None]
        with torch.no_grad():
            p = torch.softmax(m["net"](x), 1)[0].numpy()
        order = np.argsort(-p)[:topk]
        return [(m["classes"][i], float(p[i])) for i in order]

    def predict(self, arr28: np.ndarray, topk: int, mode: str = "auto") -> list[tuple[str, float]]:
        """(28,28) float in [0,1] -> [(label, prob)] best first."""
        if mode != "auto":
            return self._single(mode, arr28, topk)
        if self.has("mixed"):
            return self._single("mixed", arr28, topk)
        merged: list[tuple[str, float]] = []      # no mixed model: both CNNs, each weighted 0.5
        for name in ("letters", "digits"):
            merged += [(l, p * 0.5) for l, p in self._single(name, arr28, len(self._models[name]["classes"]))]
        merged.sort(key=lambda c: -c[1])
        return merged[:topk]
