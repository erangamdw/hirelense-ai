from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentType


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
    created_at: datetime
