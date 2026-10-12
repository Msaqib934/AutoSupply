"""Base configuration settings shared by microservices."""

import os
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class CommonSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    jwt_secret: str = "dev-only-insecure-secret-change-me"  # noqa: S105
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    session_cookie_name: str = "ash_session"

    # Gateway URLs to downstream services
    auth_service_url: str = os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001")
    supplier_service_url: str = os.getenv("SUPPLIER_SERVICE_URL", "http://127.0.0.1:8002")
    component_service_url: str = os.getenv("COMPONENT_SERVICE_URL", "http://127.0.0.1:8003")
    order_service_url: str = os.getenv("ORDER_SERVICE_URL", "http://127.0.0.1:8004")

    # CORS
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_common_settings() -> CommonSettings:
    return CommonSettings()
