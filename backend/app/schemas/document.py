from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentParsingStatus, DocumentType


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_user_id: int
    document_type: DocumentType
    original_filename: str
    stored_filename: str
    storage_path: str
    mime_type: str
    size_bytes: int
    parsed_text: str | None
    parsing_status: DocumentParsingStatus
    parsing_error: str | None
    parsed_at: datetime | None
    created_at: datetime


class ChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    chunk_index: int
    chunk_text: str
    section_title: str | None
    page_number: int | None
    metadata_json: dict[str, Any] | None
    embedding_ref: str | None
    created_at: datetime


class DocumentChunkingResponse(BaseModel):
    document_id: int
    chunk_count: int
    chunks: list[ChunkResponse]
