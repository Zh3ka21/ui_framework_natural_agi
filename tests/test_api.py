"""API tests with a fake model, so they run without PyTorch.   pytest -q"""
import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.deps import get_settings
from app.core.config import Settings
from app.main import create_app
from app.services.model_registry import UnknownMode

LETTERS, DIGITS = [chr(65 + i) for i in range(26)], [str(i) for i in range(10)]


class FakeRegistry:
    def has(self, name): return False
    def all_classes(self): return LETTERS + DIGITS
    def info(self): return {"unified": False, "classes": {"letters": LETTERS, "digits": DIGITS}, "all": self.all_classes()}
    def predict(self, arr, topk, mode="auto"):
        if mode not in ("auto", "letters", "digits"):
            raise UnknownMode(mode)
        pool = DIGITS if mode == "digits" else LETTERS
        return [(pool[i], 1 / (i + 2)) for i in range(topk)]


def data_url(ink: bool) -> str:
    img = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if ink:
        img.paste((255, 255, 255, 255), (100, 100, 140, 300))
    buf = io.BytesIO(); img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def client(tmp_path):
    app = create_app(load_models=False)
    app.state.registry = FakeRegistry()
    app.dependency_overrides[get_settings] = lambda: Settings(samples_dir=tmp_path)
    return TestClient(app)


def test_health_and_info(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/info").json()["classes"]["digits"] == DIGITS
    metrics = client.get("/api/metrics").json()
    assert {"startup_ms", "uptime_ms", "first_request_ms"} <= set(metrics)


def test_predict_ink(client):
    r = client.post("/predict", json={"image": data_url(True), "topk": 3, "mode": "digits"}).json()
    assert r["empty"] is False and r["label"] == "0" and len(r["candidates"]) == 3
    assert len(r["preview"]) == 28 and len(r["preview"][0]) == 28
    assert {"preprocess_ms", "model_ms", "server_ms"} <= set(r["timings"])
    assert r["ms"] == r["timings"]["model_ms"]


def test_predict_empty_canvas(client):
    assert client.post("/predict", json={"image": data_url(False)}).json()["empty"] is True


def test_predict_bad_mode_and_topk(client):
    assert client.post("/predict", json={"image": data_url(True), "mode": "emoji"}).status_code == 400
    assert client.post("/predict", json={"image": data_url(True), "topk": 99}).status_code == 422


def test_save_sample(client, tmp_path):
    r = client.post("/save", json={"image": data_url(True), "label": "B"})
    assert r.status_code == 200 and (tmp_path / r.json()["saved"]).is_file()
    assert client.post("/save", json={"image": data_url(True), "label": "?"}).status_code == 400
    assert client.post("/save", json={"image": data_url(False), "label": "B"}).status_code == 400


def test_models_route_only_serves_onnx(client):
    assert client.get("/models/cnn_letters.pt").status_code == 404
    assert client.get("/models/..%2Fserver.py").status_code == 404


def test_page_and_static(client):
    assert client.get("/").status_code == 200
    assert client.get("/static/js/main.js").status_code == 200
