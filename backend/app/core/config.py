import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "HireLens AI API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    environment: str = os.getenv("APP_ENV", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    enable_docs: bool = os.getenv("ENABLE_DOCS", "true").lower() == "true"
    api_prefix: str = os.getenv("API_PREFIX", "")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./hirelense_ai.db")
    database_echo: bool = os.getenv("DATABASE_ECHO", "false").lower() == "true"
    upload_dir: str = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
    max_upload_size_bytes: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(5 * 1024 * 1024)))
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
