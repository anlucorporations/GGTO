"""Configuración de la aplicación (variables de entorno)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # --- Aplicación ---
    app_name: str = "GGTO API"
    app_env: str = "development"
    app_version: str = "0.9.0"
    app_timezone: str = "America/Caracas"

    # --- Base de datos ---
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "ggtov2"
    db_user: str = "ggtov2_app"
    db_password: str = ""
    db_sslmode: str = "prefer"
    # Esquema alternativo para pruebas/preview (`search_path`); vacío = por defecto.
    db_schema: str = ""

    # --- Seguridad ---
    secret_key: str = "cambiar-esta-clave-en-produccion"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480          # 8 h de jornada
    max_intentos: int = 3                    # RF-20
    palabras_seguridad: int = 12             # RF-20
    palabras_requeridas: int = 3             # RF-20
    rate_limit_intentos: int = 10            # RNF-22
    rate_limit_ventana_seg: int = 60

    # --- CORS ---
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
