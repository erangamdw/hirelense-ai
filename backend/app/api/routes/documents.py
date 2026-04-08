from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db_session
from app.models.document import DocumentType
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services.documents import DocumentValidationError, create_document_record, save_upload_file

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
