from fastapi import Request

from app.core.config import Settings, settings
from app.services.model_registry import ModelRegistry


def get_registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


def get_settings() -> Settings:
    return settings
