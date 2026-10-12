"""FastAPI application factory.   uvicorn app.main:app   (or: python run.py)"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes import predict, samples, system
from app.core.config import settings
from app.core.logging import setup_logging
from app.services.model_registry import ModelRegistry

log = logging.getLogger(__name__)


def create_app(load_models: bool = True) -> FastAPI:
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        startup_started = time.perf_counter()
        if load_models:                        # tests pass False and set app.state.registry themselves
            registry = ModelRegistry()
            registry.load_dir(settings.models_dir)
            app.state.registry = registry
        app.state.startup_ms = (time.perf_counter() - startup_started) * 1000
        app.state.started_at = time.perf_counter()
        app.state.first_request_ms = None
        log.info("ready; startup_ms=%.1f", app.state.startup_ms)
        yield

    app = FastAPI(title="handwriting-live", lifespan=lifespan)
    @app.middleware("http")
    async def record_first_request(request, call_next):
        # This records time since application startup, not the provider's full sleep/wake delay.
        if getattr(app.state, "first_request_ms", None) is None and hasattr(app.state, "started_at"):
            app.state.first_request_ms = (time.perf_counter() - app.state.started_at) * 1000
        return await call_next(request)

    app.include_router(system.router)
    app.include_router(predict.router)
    app.include_router(samples.router)
    app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
    return app


app = create_app()
