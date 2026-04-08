from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import re

from app.core.config import get_settings
from app.models.document import DocumentType
from app.models.user import User, UserRole
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.providers import EmbeddingProviderError, get_embedding_provider
from app.services.rag.vector_store import ChromaVectorStoreError, build_metadata_filter, get_document_collection


DEFAULT_DOCUMENT_TYPES_BY_ROLE: dict[UserRole, list[DocumentType]] = {
    UserRole.CANDIDATE: [
        DocumentType.CV,
        DocumentType.JOB_DESCRIPTION,
        DocumentType.PROJECT_NOTES,
        DocumentType.INTERVIEW_FEEDBACK,
    ],
    UserRole.RECRUITER: [
        DocumentType.JOB_DESCRIPTION,
        DocumentType.PROJECT_NOTES,
        DocumentType.INTERVIEW_FEEDBACK,
        DocumentType.RECRUITER_CANDIDATE_CV,
    ],
}

LEXICAL_STOPWORDS = {
    "about",
    "answer",
    "background",
    "best",
    "click",
    "could",
    "describe",
    "explain",
    "generate",
    "guidance",
    "help",
    "interview",
    "likely",
    "parts",
    "probing",
    "prompt",
    "question",
    "questions",
    "role",
    "should",
    "target",
    "their",
    "this",
    "what",
    "which",
    "with",
    "your",
}


@dataclass(frozen=True)
class RetrievalRequest:
    query: str
    user: User
    role: UserRole
    document_types: list[DocumentType] | None = None
    top_k: int | None = None
    score_threshold: float | None = None
    recruiter_job_id: int | None = None
    recruiter_candidate_id: int | None = None


class RetrievalError(Exception):
    """Raised when retrieval cannot be completed."""


class RetrieverService(ABC):
    @abstractmethod
    def retrieve(self, request: RetrievalRequest) -> list[EvidenceChunkResponse]:
        raise NotImplementedError


def resolve_document_types(*, role: UserRole, requested: list[DocumentType] | None) -> list[DocumentType]:
    allowed = DEFAULT_DOCUMENT_TYPES_BY_ROLE[role]
    if requested is None:
        return allowed
    return [document_type for document_type in requested if document_type in allowed]


def build_score_note(*, section_title: str | None, page_number: int | None, source_label: str) -> str:
    notes: list[str] = []
    if section_title:
        notes.append(f"Matched section '{section_title}'")
    if page_number is not None:
        notes.append(f"page {page_number}")
    if not notes:
        notes.append(f"Matched source '{source_label}'")
    return " in ".join(notes)


class ChromaRetrieverService(RetrieverService):
    def retrieve(self, request: RetrievalRequest) -> list[EvidenceChunkResponse]:
        settings = get_settings()
        document_types = resolve_document_types(role=request.role, requested=request.document_types)
        if not document_types:
            raise RetrievalError("No allowed document types remain after applying role filters.")

        top_k = request.top_k or settings.retrieval_top_k
        score_threshold = request.score_threshold if request.score_threshold is not None else settings.retrieval_score_threshold
        oversample = max(top_k * 4, 10)
        base_filter = build_metadata_filter(
            owner_user_id=request.user.id,
            owner_role=request.role.value,
            recruiter_job_id=request.recruiter_job_id,
            recruiter_candidate_id=request.recruiter_candidate_id if request.recruiter_job_id is None else None,
        )

        try:
            embedding_provider = get_embedding_provider()
            query_embedding = embedding_provider.embed_texts([request.query])[0]
            collection = get_document_collection()
            raw_results = collection.query(
                query_embeddings=[query_embedding],
                n_results=oversample,
                where=base_filter,
                include=["documents", "metadatas", "distances"],
            )
        except (EmbeddingProviderError, ChromaVectorStoreError, IndexError) as exc:
            raise RetrievalError(str(exc) or "Unable to retrieve indexed chunks.") from exc
        except Exception as exc:
            raise RetrievalError(str(exc) or "Unexpected retrieval error.") from exc

        documents = raw_results.get("documents", [[]])[0]
        metadatas = raw_results.get("metadatas", [[]])[0]
        distances = raw_results.get("distances", [[]])[0]

        evidence: list[EvidenceChunkResponse] = []
        seen_contents: set[str] = set()
        allowed_document_type_values = {document_type.value for document_type in document_types}

        for content, metadata, distance in zip(documents, metadatas, distances):
            metadata = metadata or {}
            document_type_value = str(metadata.get("document_type", ""))
            if document_type_value not in allowed_document_type_values:
                continue
            if not matches_recruiter_scope(metadata=metadata, request=request):
                continue

            normalized_content = " ".join(str(content).split())
            if not normalized_content or normalized_content in seen_contents:
                continue

            numeric_distance = float(distance if distance is not None else 999999.0)
            relevance_score = 1.0 / (1.0 + max(numeric_distance, 0.0))
            if relevance_score < score_threshold:
                continue

            source_label = str(metadata.get("source_label") or document_type_value)
            section_title = metadata.get("section_title")
            page_number = metadata.get("page_number")

            evidence.append(
                EvidenceChunkResponse(
                    chunk_id=int(metadata.get("chunk_id", 0)),
                    document_id=int(metadata.get("document_id", 0)),
                    chunk_index=int(metadata.get("chunk_index", 0)),
                    document_type=DocumentType(document_type_value),
                    source_label=source_label,
                    owner_role=str(metadata.get("owner_role") or request.role.value),
                    owner_user_id=int(metadata.get("owner_user_id") or request.user.id),
                    recruiter_job_id=int(metadata["recruiter_job_id"]) if metadata.get("recruiter_job_id") is not None else None,
                    recruiter_candidate_id=int(metadata["recruiter_candidate_id"])
                    if metadata.get("recruiter_candidate_id") is not None
                    else None,
                    section_title=section_title if isinstance(section_title, str) else None,
                    page_number=int(page_number) if isinstance(page_number, int) else None,
                    content=normalized_content,
                    relevance_score=round(relevance_score, 4),
                    distance=round(numeric_distance, 4),
                    score_note=build_score_note(
                        section_title=section_title if isinstance(section_title, str) else None,
                        page_number=int(page_number) if isinstance(page_number, int) else None,
                        source_label=source_label,
                    ),
                )
            )
            seen_contents.add(normalized_content)

            if len(evidence) == top_k:
                break

        if evidence:
            return evidence

        if settings.embedding_provider.lower() == "deterministic":
            return build_deterministic_fallback_evidence(
                collection=collection,
                request=request,
                document_types=document_types,
                top_k=top_k,
                base_filter=base_filter,
            )

        return evidence


def matches_recruiter_scope(*, metadata: dict[str, object], request: RetrievalRequest) -> bool:
    metadata_job_id = int(metadata["recruiter_job_id"]) if metadata.get("recruiter_job_id") is not None else None
    metadata_candidate_id = (
        int(metadata["recruiter_candidate_id"]) if metadata.get("recruiter_candidate_id") is not None else None
    )

    if request.recruiter_job_id is not None and metadata_job_id != request.recruiter_job_id:
        return False

    if request.recruiter_candidate_id is None:
        return True

    if request.recruiter_job_id is None:
        return metadata_candidate_id == request.recruiter_candidate_id

    return metadata_candidate_id in {None, request.recruiter_candidate_id}


def tokenize_for_lexical_score(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+-]{2,}", text.lower())
        if token not in LEXICAL_STOPWORDS
    }


def build_evidence_response(
    *,
    metadata: dict[str, object],
    content: str,
    relevance_score: float,
    distance: float,
    score_note: str,
    request: RetrievalRequest,
) -> EvidenceChunkResponse:
    source_label = str(metadata.get("source_label") or metadata.get("document_type") or "document")
    section_title = metadata.get("section_title")
    page_number = metadata.get("page_number")
    document_type_value = str(metadata.get("document_type", ""))

    return EvidenceChunkResponse(
        chunk_id=int(metadata.get("chunk_id", 0)),
        document_id=int(metadata.get("document_id", 0)),
        chunk_index=int(metadata.get("chunk_index", 0)),
        document_type=DocumentType(document_type_value),
        source_label=source_label,
        owner_role=str(metadata.get("owner_role") or request.role.value),
        owner_user_id=int(metadata.get("owner_user_id") or request.user.id),
        recruiter_job_id=int(metadata["recruiter_job_id"]) if metadata.get("recruiter_job_id") is not None else None,
        recruiter_candidate_id=int(metadata["recruiter_candidate_id"])
        if metadata.get("recruiter_candidate_id") is not None
        else None,
        section_title=section_title if isinstance(section_title, str) else None,
        page_number=int(page_number) if isinstance(page_number, int) else None,
        content=content,
        relevance_score=round(relevance_score, 4),
        distance=round(distance, 4),
        score_note=score_note,
    )


def build_deterministic_fallback_evidence(
    *,
    collection,
    request: RetrievalRequest,
    document_types: list[DocumentType],
    top_k: int,
    base_filter: dict[str, object] | None,
) -> list[EvidenceChunkResponse]:
    raw_rows = collection.get(
        where=base_filter,
        include=["documents", "metadatas"],
    )
    documents = raw_rows.get("documents", [])
    metadatas = raw_rows.get("metadatas", [])
    if not documents or not metadatas:
        return []

    allowed_document_type_values = {document_type.value for document_type in document_types}
    document_type_order = {document_type.value: index for index, document_type in enumerate(document_types)}
    query_terms = tokenize_for_lexical_score(request.query)

    candidates: list[tuple[int, int, int, str, dict[str, object]]] = []
    seen_contents: set[str] = set()

    for content, metadata in zip(documents, metadatas):
        metadata = metadata or {}
        document_type_value = str(metadata.get("document_type", ""))
        if document_type_value not in allowed_document_type_values:
            continue
        if not matches_recruiter_scope(metadata=metadata, request=request):
            continue

        normalized_content = " ".join(str(content).split())
        if not normalized_content or normalized_content in seen_contents:
            continue

        overlap = len(query_terms & tokenize_for_lexical_score(normalized_content))
        candidates.append(
            (
                overlap,
                -len(normalized_content),
                document_type_order.get(document_type_value, len(document_type_order)),
                normalized_content,
                metadata,
            )
        )
        seen_contents.add(normalized_content)

    if not candidates:
        return []

    lexical_matches = [item for item in candidates if item[0] > 0]
    ranked = sorted(
        lexical_matches or candidates,
        key=lambda item: (-item[0], item[2], item[1]),
    )[:top_k]

    evidence: list[EvidenceChunkResponse] = []
    used_scoped_fallback = not lexical_matches

    for overlap, _neg_len, _doc_order, content, metadata in ranked:
        if used_scoped_fallback:
            score_note = "No semantic match cleared the deterministic threshold, so a scoped evidence fallback was used."
            relevance_score = 0.05
            distance = 999.0
        else:
            score_note = f"Deterministic lexical fallback matched {overlap} query terms in the scoped evidence."
            relevance_score = min(0.6, 0.2 + (overlap * 0.08))
            distance = max(0.0, 1.0 - relevance_score)

        evidence.append(
            build_evidence_response(
                metadata=metadata,
                content=content,
                relevance_score=relevance_score,
                distance=distance,
                score_note=score_note,
                request=request,
            )
        )

    return evidence


def get_retriever_service() -> RetrieverService:
    return ChromaRetrieverService()
