from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.document import DocumentType


class RetrievalQueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    document_types: list[DocumentType] | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class EvidenceChunkResponse(BaseModel):
    chunk_id: int
    document_id: int
    chunk_index: int
    document_type: DocumentType
    source_label: str
    owner_role: str
    owner_user_id: int
    section_title: str | None
    page_number: int | None
    content: str
    relevance_score: float
    distance: float
    score_note: str


class RetrievalResponse(BaseModel):
    query: str
    role: str
    applied_document_types: list[DocumentType]
    top_k: int
    score_threshold: float
    result_count: int
    evidence: list[EvidenceChunkResponse]
