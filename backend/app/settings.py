"""Configuración del backend (secrets, rutas, etc.)."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = Field(
        default="CHANGE_ME_QURII_COMISIONES_DEV_SECRET_CHANGE_IN_PROD_12345",
        description="Clave para firmar los JWT. Reemplazar en producción.",
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 horas

    # CORS
    allowed_origins: str = "*"

    # Datos persistentes
    data_dir: Path = Path(__file__).parent.parent / "data"
    db_url: str = "sqlite:///./data/qurii.db"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
