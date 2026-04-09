from __future__ import annotations

from pathlib import Path
from typing import Any

import chromadb

from app.core.config import get_settings
from app.models.chunk import Chunk


class ChromaVectorStoreError(Exception):
    """Raised when Chroma operations fail."""


def build_collection_name() -> str:
    settings = get_settings()
    raw_name = f"{settings.chroma_collection_prefix}-{settings.environment}"
    return raw_name.replace("_", "-")


def get_chroma_client() -> chromadb.PersistentClient:
    settings = get_settings()
    vector_path = Path(settings.vector_db_path)
    vector_path.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(vector_path))


def get_document_collection():
    try:
        client = get_chroma_client()
        return client.get_or_create_collection(name=build_collection_name())
    except Exception as exc:
        raise ChromaVectorStoreError(str(exc) or "Unable to connect to Chroma.") from exc


def _normalize_metadata_value(value: Any) -> str | int | float | bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, str)):
        return value
    return str(value)


def build_chroma_metadata(chunk: Chunk) -> dict[str, str | int | float | bool]:
    metadata: dict[str, Any] = dict(chunk.metadata_json or {})
    metadata["chunk_id"] = chunk.id
    metadata["document_id"] = chunk.document_id
    metadata["chunk_index"] = chunk.chunk_index
    if chunk.section_title is not None:
        metadata["section_title"] = chunk.section_title
    if chunk.page_number is not None:
        metadata["page_number"] = chunk.page_number
    if chunk.embedding_ref is not None:
        metadata["embedding_ref"] = chunk.embedding_ref
    return {key: _normalize_metadata_value(value) for key, value in metadata.items() if value is not None}


def build_metadata_filter(
    *,
    document_id: int | None = None,
    document_ids: list[int] | None = None,
    owner_user_id: int | None = None,
    document_type: str | None = None,
    owner_role: str | None = None,
    recruiter_job_id: int | None = None,
    recruiter_candidate_id: int | None = None,
) -> dict[str, object] | None:
    conditions: list[dict[str, object]] = []
    if document_id is not None:
        conditions.append({"document_id": document_id})
    if document_ids:
        unique_document_ids = sorted({int(item) for item in document_ids})
        if len(unique_document_ids) == 1:
            conditions.append({"document_id": unique_document_ids[0]})
        else:
            conditions.append({"$or": [{"document_id": item} for item in unique_document_ids]})
    if owner_user_id is not None:
        conditions.append({"owner_user_id": owner_user_id})
    if document_type is not None:
        conditions.append({"document_type": document_type})
    if owner_role is not None:
        conditions.append({"owner_role": owner_role})
    if recruiter_job_id is not None:
        conditions.append({"recruiter_job_id": recruiter_job_id})
    if recruiter_candidate_id is not None:
        conditions.append({"recruiter_candidate_id": recruiter_candidate_id})
    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def upsert_chunks(*, ids: list[str], documents: list[str], embeddings: list[list[float]], metadatas: list[dict[str, Any]]) -> None:
    try:
        collection = get_document_collection()
        collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    except Exception as exc:
        raise ChromaVectorStoreError(str(exc) or "Unable to upsert vectors into Chroma.") from exc


def delete_document_vectors(*, document_id: int, owner_user_id: int | None = None) -> None:
    try:
        collection = get_document_collection()
        collection.delete(where=build_metadata_filter(document_id=document_id, owner_user_id=owner_user_id))
    except Exception as exc:
        raise ChromaVectorStoreError(str(exc) or "Unable to delete vectors from Chroma.") from exc
