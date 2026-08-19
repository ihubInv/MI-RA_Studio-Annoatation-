"""
MI-RA Studio — Application Configuration
Local-first: Supabase Postgres + native Redis/Celery (no Docker required).
"""
from functools import lru_cache
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        extra="ignore",
    )

    # Application
    APP_ENV: str = "development"
    APP_NAME: str = "MI-RA Studio"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Backend
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000

    # Supabase / Database
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:password@db.localhost:5432/postgres?sslmode=require"
    )
    # Session/direct URL for Alembic DDL (optional; falls back to DATABASE_URL)
    DATABASE_URL_MIGRATE: str = ""

    # Redis (local native install)
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    CELERY_BROKER_URL: str = "redis://127.0.0.1:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://127.0.0.1:6379/1"

    # Object storage: local | minio | supabase
    STORAGE_BACKEND: Literal["local", "minio", "supabase"] = "local"
    LOCAL_STORAGE_ROOT: str = "./data"
    STORAGE_BASE_URL: str = "http://localhost:8000/api/v1/media"

    # MinIO (optional legacy / Docker path)
    MINIO_ENDPOINT: str = "127.0.0.1:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "mira-studio"
    MINIO_SECURE: bool = False

    # Supabase Storage (optional)
    SUPABASE_STORAGE_BUCKET: str = "mira-studio"

    # JWT
    JWT_SECRET: str = "changeme"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS (comma-separated in .env)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # GPU / AI
    GPU_ENABLED: bool = False
    CUDA_VISIBLE_DEVICES: str = "0"

    # Features
    ENABLE_AI_PRELABELING: bool = True
    ENABLE_ACTIVE_LEARNING: bool = False
    ENABLE_GEOSPATIAL: bool = True

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@mira-lab.ai"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def migration_database_url(self) -> str:
        return self.DATABASE_URL_MIGRATE or self.DATABASE_URL

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def database_requires_ssl(self) -> bool:
        url = self.DATABASE_URL.lower()
        return "supabase" in url or "sslmode=require" in url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
