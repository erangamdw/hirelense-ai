from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.models.document import DocumentType
from app.models.user import User
from app.schemas.document import DocumentChunkingResponse, ChunkResponse, DocumentResponse
from app.services.documents import (
    DocumentNotFoundError,
    DocumentChunkingError,
    DocumentParsingError,
    DocumentValidationError,
    chunk_stored_document,
    create_document_record,
    parse_stored_document,
    save_upload_file,
)

router = APIRouter(prefix="/documents")


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DocumentResponse:
    try:
        original_filename, storage_path, size_bytes = save_upload_file(
            file=file,
            user=current_user,
            document_type=document_type,
        )
    except DocumentValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    finally:
        file.file.close()

    document = create_document_record(
        db,
        user=current_user,
        document_type=document_type,
        original_filename=original_filename,
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    return DocumentResponse.model_validate(document)


@router.post("/{document_id}/parse", response_model=DocumentResponse)
def parse_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DocumentResponse:
    try:
        document = parse_stored_document(db, user=current_user, document_id=document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DocumentParsingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return DocumentResponse.model_validate(document)


@router.post("/{document_id}/chunk", response_model=DocumentChunkingResponse)
def chunk_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DocumentChunkingResponse:
    try:
        chunks = chunk_stored_document(db, user=current_user, document_id=document_id)
    except DocumentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except DocumentChunkingError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return DocumentChunkingResponse(
        document_id=document_id,
        chunk_count=len(chunks),
        chunks=[ChunkResponse.model_validate(chunk) for chunk in chunks],
    )
