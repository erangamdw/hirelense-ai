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
from app.services.documents.parsing import get_owned_document
from app.services.rag import ChromaVectorStoreError, delete_document_vectors

ALLOWED_EXTENSIONS_BY_TYPE: dict[DocumentType, set[str]] = {
    DocumentType.CV: {".pdf"},
    DocumentType.JOB_DESCRIPTION: {".txt", ".md", ".pdf"},
    DocumentType.PROJECT_NOTES: {".txt", ".md", ".pdf"},
    DocumentType.INTERVIEW_FEEDBACK: {".txt", ".md", ".pdf"},
    DocumentType.RECRUITER_CANDIDATE_CV: {".pdf"},
}

TEXT_SUBMISSION_ALLOWED_TYPES: set[DocumentType] = {
    DocumentType.JOB_DESCRIPTION,
    DocumentType.PROJECT_NOTES,
    DocumentType.INTERVIEW_FEEDBACK,
}


class DocumentValidationError(Exception):
    """Raised when the uploaded file is invalid."""


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return sanitized or "upload"


def validate_upload_file(file: UploadFile, document_type: DocumentType) -> str:
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


def validate_text_submission(
    *,
    document_type: DocumentType,
    title: str | None,
    content: str,
) -> tuple[str, bytes]:
    settings = get_settings()
    if document_type not in TEXT_SUBMISSION_ALLOWED_TYPES:
        raise DocumentValidationError(
            f"Text submission is not supported for {document_type.value}. "
            f"Allowed: {', '.join(sorted(item.value for item in TEXT_SUBMISSION_ALLOWED_TYPES))}."
        )

    normalized_content = content.replace("\r\n", "\n").strip()
    if not normalized_content:
        raise DocumentValidationError("Submitted text content cannot be empty.")

    encoded_content = normalized_content.encode("utf-8")
    if len(encoded_content) > settings.max_upload_size_bytes:
        raise DocumentValidationError(
            f"Submitted text exceeds the {settings.max_upload_size_bytes} byte limit."
        )

    title_stem = sanitize_filename(title or document_type.value)
    if Path(title_stem).suffix.lower() not in {".txt", ".md"}:
        title_stem = f"{title_stem}.txt"

    return title_stem, encoded_content


def build_user_storage_path(*, user: User, document_type: DocumentType, extension: str) -> Path:
    settings = get_settings()
    upload_root = Path(settings.upload_dir)
    user_dir = upload_root / str(user.id) / document_type.value
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir / f"{uuid4().hex}{extension}"


def save_upload_file(
    *,
    file: UploadFile,
    user: User,
    document_type: DocumentType,
) -> tuple[str, str, int]:
    settings = get_settings()
    sanitized_filename = validate_upload_file(file, document_type)

    extension = Path(sanitized_filename).suffix.lower()
    destination = build_user_storage_path(
        user=user,
        document_type=document_type,
        extension=extension,
    )

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


def save_text_document(
    *,
    title: str | None,
    content: str,
    user: User,
    document_type: DocumentType,
) -> tuple[str, str, int]:
    original_filename, encoded_content = validate_text_submission(
        document_type=document_type,
        title=title,
        content=content,
    )
    destination = build_user_storage_path(
        user=user,
        document_type=document_type,
        extension=Path(original_filename).suffix.lower() or ".txt",
    )
    destination.write_bytes(encoded_content)
    return original_filename, str(destination), len(encoded_content)


def create_document_record(
    db: Session,
    *,
    user: User,
    document_type: DocumentType,
    original_filename: str,
    storage_path: str,
    mime_type: str,
    size_bytes: int,
    recruiter_job_id: int | None = None,
    recruiter_candidate_id: int | None = None,
) -> Document:
    stored_filename = Path(storage_path).name
    document = Document(
        owner_user_id=user.id,
        recruiter_job_id=recruiter_job_id,
        recruiter_candidate_id=recruiter_candidate_id,
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


def list_documents_for_user(
    db: Session,
    *,
    user_id: int,
    limit: int = 20,
) -> list[Document]:
    statement = (
        select(Document)
        .where(Document.owner_user_id == user_id)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .limit(limit)
    )
    return list(db.execute(statement).scalars().all())


def delete_document_for_user(db: Session, *, user: User, document_id: int) -> None:
    document = get_owned_document(db, user=user, document_id=document_id)
    storage_path = Path(document.storage_path)

    try:
        delete_document_vectors(document_id=document.id, owner_user_id=document.owner_user_id)
    except ChromaVectorStoreError:
        # Do not block deletion if vector cleanup fails; removing the document record
        # is the higher-priority action and stale vectors can be re-cleaned later.
        pass

    db.delete(document)
    db.commit()

    try:
        if storage_path.exists():
            storage_path.unlink()
    except OSError:
        pass
