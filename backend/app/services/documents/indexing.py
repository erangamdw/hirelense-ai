from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.chunk import Chunk
from app.models.document import DocumentIndexingStatus
from app.models.user import User
from app.services.documents.parsing import get_owned_document
from app.services.providers import EmbeddingProviderError, get_embedding_provider
from app.services.rag import ChromaVectorStoreError, build_chroma_metadata, build_collection_name, delete_document_vectors, upsert_chunks


@dataclass(frozen=True)
class DocumentIndexingResult:
    document_id: int
    chunk_count: int
    collection_name: str
    vector_ids: list[str]
    indexing_status: DocumentIndexingStatus


class DocumentIndexingError(Exception):
    """Raised when a document cannot be indexed."""


def build_vector_id(*, chunk: Chunk) -> str:
    return f"document-{chunk.document_id}-chunk-{chunk.id}"


def index_document_chunks(db: Session, *, user: User, document_id: int) -> DocumentIndexingResult:
    document = get_owned_document(db, user=user, document_id=document_id)
    chunks = list(document.chunks)
    if not chunks:
        raise DocumentIndexingError("Document must be chunked before indexing.")

    collection_name = build_collection_name()
    vector_ids = [build_vector_id(chunk=chunk) for chunk in chunks]
    documents = [chunk.chunk_text for chunk in chunks]
    metadatas = [build_chroma_metadata(chunk) for chunk in chunks]

    try:
        provider = get_embedding_provider()
        embeddings = provider.embed_texts(documents)
        if len(embeddings) != len(chunks):
            raise DocumentIndexingError("Embedding provider returned an unexpected number of vectors.")

        delete_document_vectors(document_id=document.id, owner_user_id=document.owner_user_id)
        upsert_chunks(ids=vector_ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    except (ChromaVectorStoreError, DocumentIndexingError, EmbeddingProviderError) as exc:
        document.indexing_status = DocumentIndexingStatus.FAILED
        document.indexing_error = str(exc)
        document.indexed_at = None
        for chunk in chunks:
            chunk.embedding_ref = None
            db.add(chunk)
        db.add(document)
        db.commit()
        try:
            delete_document_vectors(document_id=document.id, owner_user_id=document.owner_user_id)
        except ChromaVectorStoreError:
            pass
        raise DocumentIndexingError(str(exc)) from exc

    for chunk, vector_id in zip(chunks, vector_ids):
        chunk.embedding_ref = vector_id
        db.add(chunk)

    document.indexing_status = DocumentIndexingStatus.SUCCEEDED
    document.indexing_error = None
    document.indexed_at = datetime.now(timezone.utc)
    db.add(document)
    db.commit()

    for chunk in chunks:
        db.refresh(chunk)
    db.refresh(document)

    return DocumentIndexingResult(
        document_id=document.id,
        chunk_count=len(chunks),
        collection_name=collection_name,
        vector_ids=vector_ids,
        indexing_status=document.indexing_status,
    )
