from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document, DocumentType
from app.models.user import User

ALLOWED_EXTENSIONS_BY_TYPE: dict[DocumentType, set[str]] = {
    DocumentType.CV: {".pdf"},
    DocumentType.JOB_DESCRIPTION: {".txt", ".md", ".pdf"},
    DocumentType.PROJECT_NOTES: {".txt", ".md", ".pdf"},
    DocumentType.INTERVIEW_FEEDBACK: {".txt", ".md", ".pdf"},
    DocumentType.RECRUITER_CANDIDATE_CV: {".pdf"},
}


class DocumentValidationError(Exception):
    """Raised when the uploaded file is invalid."""


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return sanitized or "upload"


def validate_upload_file(file: UploadFile, document_type: DocumentType) -> str:
    settings = get_settings()
    if not file.filename:
        raise DocumentValidationError("Uploaded file must include a filename.")

    sanitized_filename = sanitize_filename(file.filename)
    extension = Path(sanitized_filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS_BY_TYPE[document_type]:
        raise DocumentValidationError(
            f"Unsupported file type for {document_type.value}. Allowed: "
            f"{', '.join(sorted(ALLOWED_EXTENSIONS_BY_TYPE[document_type]))}."
        )

    return sanitized_filename


def save_upload_file(
    *,
    file: UploadFile,
    user: User,
    document_type: DocumentType,
) -> tuple[str, str, int]:
    settings = get_settings()
    sanitized_filename = validate_upload_file(file, document_type)

    upload_root = Path(settings.upload_dir)
    user_dir = upload_root / str(user.id) / document_type.value
    user_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(sanitized_filename).suffix.lower()
    stored_filename = f"{uuid4().hex}{extension}"
    destination = user_dir / stored_filename

    content = file.file.read()
    size_bytes = len(content)
    if size_bytes == 0:
        raise DocumentValidationError("Uploaded file cannot be empty.")
    if size_bytes > settings.max_upload_size_bytes:
        raise DocumentValidationError(
            f"Uploaded file exceeds the {settings.max_upload_size_bytes} byte limit."
        )

    destination.write_bytes(content)
    return sanitized_filename, str(destination), size_bytes


def create_document_record(
    db: Session,
    *,
    user: User,
    document_type: DocumentType,
    original_filename: str,
    storage_path: str,
    mime_type: str,
    size_bytes: int,
) -> Document:
    stored_filename = Path(storage_path).name
    document = Document(
        owner_user_id=user.id,
        document_type=document_type,
        original_filename=original_filename,
        stored_filename=stored_filename,
        storage_path=storage_path,
        mime_type=mime_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def count_documents_for_user(db: Session, *, user_id: int) -> int:
    statement = select(func.count(Document.id)).where(Document.owner_user_id == user_id)
    return int(db.execute(statement).scalar_one())
