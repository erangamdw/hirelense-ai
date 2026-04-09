import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


@dataclass(frozen=True)
class Settings:
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "HireLens AI API"))
    app_version: str = field(default_factory=lambda: os.getenv("APP_VERSION", "0.1.0"))
    environment: str = field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    enable_docs: bool = field(default_factory=lambda: os.getenv("ENABLE_DOCS", "true").lower() == "true")
    api_prefix: str = field(default_factory=lambda: os.getenv("API_PREFIX", ""))
    allowed_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            origin.strip()
            for origin in os.getenv(
                "ALLOWED_ORIGINS",
                "http://127.0.0.1:3000,http://localhost:3000",
            ).split(",")
            if origin.strip()
        )
    )
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./hirelense_ai.db"))
    database_echo: bool = field(default_factory=lambda: os.getenv("DATABASE_ECHO", "false").lower() == "true")
    upload_dir: str = field(default_factory=lambda: os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
    max_upload_size_bytes: int = field(
        default_factory=lambda: int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(5 * 1024 * 1024)))
    )
    langchain_chunk_size: int = field(default_factory=lambda: int(os.getenv("LANGCHAIN_CHUNK_SIZE", "1000")))
    langchain_chunk_overlap: int = field(default_factory=lambda: int(os.getenv("LANGCHAIN_CHUNK_OVERLAP", "150")))
    min_chunk_characters: int = field(default_factory=lambda: int(os.getenv("MIN_CHUNK_CHARACTERS", "120")))
    embedding_provider: str = field(default_factory=lambda: os.getenv("EMBEDDING_PROVIDER", "deterministic"))
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "deterministic"))
    openai_api_key: str | None = field(default_factory=lambda: os.getenv("OPENAI_API_KEY") or None)
    openai_base_url: str | None = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL") or None)
    openai_embedding_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    )
    openai_generation_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_GENERATION_MODEL", "gpt-4.1-mini")
    )
    openai_generation_upgrade_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_GENERATION_UPGRADE_MODEL", "gpt-4.1")
    )
    generation_temperature: float = field(default_factory=lambda: float(os.getenv("GENERATION_TEMPERATURE", "0.2")))
    generation_max_output_tokens: int = field(
        default_factory=lambda: int(os.getenv("GENERATION_MAX_OUTPUT_TOKENS", "700"))
    )
    vector_db_path: str = field(default_factory=lambda: os.getenv("VECTOR_DB_PATH", str(BASE_DIR / "chroma")))
    chroma_collection_prefix: str = field(
        default_factory=lambda: os.getenv("CHROMA_COLLECTION_PREFIX", "hirelense-ai")
    )
    retrieval_top_k: int = field(default_factory=lambda: int(os.getenv("RETRIEVAL_TOP_K", "5")))
    retrieval_score_threshold: float = field(
        default_factory=lambda: float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", "0.2"))
    )
    jwt_secret_key: str = field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", "change-this-in-production"))
    jwt_algorithm: str = field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
