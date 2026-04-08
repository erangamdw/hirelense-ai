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
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://127.0.0.1:3000,http://localhost:3000",
        ).split(",")
        if origin.strip()
    )
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./hirelense_ai.db")
    database_echo: bool = os.getenv("DATABASE_ECHO", "false").lower() == "true"
    upload_dir: str = os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))
    max_upload_size_bytes: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(5 * 1024 * 1024)))
    langchain_chunk_size: int = int(os.getenv("LANGCHAIN_CHUNK_SIZE", "1000"))
    langchain_chunk_overlap: int = int(os.getenv("LANGCHAIN_CHUNK_OVERLAP", "150"))
    min_chunk_characters: int = int(os.getenv("MIN_CHUNK_CHARACTERS", "120"))
    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "deterministic")
    llm_provider: str = os.getenv("LLM_PROVIDER", "deterministic")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
    openai_base_url: str | None = os.getenv("OPENAI_BASE_URL") or None
    openai_embedding_model: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    openai_generation_model: str = os.getenv("OPENAI_GENERATION_MODEL", "gpt-4.1-mini")
    openai_generation_upgrade_model: str = os.getenv("OPENAI_GENERATION_UPGRADE_MODEL", "gpt-4.1")
    generation_temperature: float = float(os.getenv("GENERATION_TEMPERATURE", "0.2"))
    generation_max_output_tokens: int = int(os.getenv("GENERATION_MAX_OUTPUT_TOKENS", "700"))
    vector_db_path: str = os.getenv("VECTOR_DB_PATH", str(BASE_DIR / "chroma"))
    chroma_collection_prefix: str = os.getenv("CHROMA_COLLECTION_PREFIX", "hirelense-ai")
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))
    retrieval_score_threshold: float = float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", "0.2"))
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
