from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod

from openai import OpenAI

from app.core.config import get_settings


class EmbeddingProviderError(Exception):
    """Raised when embeddings cannot be generated."""


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, *, api_key: str, model: str, base_url: str | None = None) -> None:
        self.model = model
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = self.client.embeddings.create(model=self.model, input=texts)
        except Exception as exc:
            raise EmbeddingProviderError(str(exc) or "OpenAI embedding request failed.") from exc

        ordered_rows = sorted(response.data, key=lambda row: row.index)
        return [list(row.embedding) for row in ordered_rows]


class DeterministicEmbeddingProvider(EmbeddingProvider):
    """Stable local fallback so indexing can be exercised without external credentials."""

    def __init__(self, *, dimensions: int = 32) -> None:
        self.dimensions = dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_single_text(text) for text in texts]

    def _embed_single_text(self, text: str) -> list[float]:
        seed = text.strip().encode("utf-8")
        values: list[float] = []
        counter = 0
        while len(values) < self.dimensions:
            digest = hashlib.sha256(seed + counter.to_bytes(4, byteorder="big")).digest()
            for byte in digest:
                values.append((byte / 255.0) * 2.0 - 1.0)
                if len(values) == self.dimensions:
                    break
            counter += 1
        return values


def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()
    provider_name = settings.embedding_provider.lower()

    if provider_name == "openai":
        if not settings.openai_api_key:
            raise EmbeddingProviderError("OPENAI_API_KEY must be set when EMBEDDING_PROVIDER=openai.")
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model,
            base_url=settings.openai_base_url,
        )

    if provider_name == "deterministic":
        return DeterministicEmbeddingProvider()

    raise EmbeddingProviderError(f"Unsupported embedding provider: {settings.embedding_provider}")
