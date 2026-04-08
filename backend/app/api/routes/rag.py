from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_candidate, get_current_recruiter
from app.core.config import get_settings
from app.models.user import User, UserRole
from app.schemas.generation import GenerationQueryRequest, GenerationResponse
from app.schemas.retrieval import RetrievalQueryRequest, RetrievalResponse
from app.services.rag import (
    GroundedGenerationError,
    GroundedGenerationRequest,
    RetrievalError,
    RetrievalRequest,
    get_generation_service,
    get_retriever_service,
)
from app.services.rag.retrieval import resolve_document_types

router = APIRouter(prefix="/rag")


def build_retrieval_response(
    *,
    payload: RetrievalQueryRequest,
    current_user: User,
    role: UserRole,
) -> RetrievalResponse:
    settings = get_settings()
    retriever = get_retriever_service()
    applied_document_types = resolve_document_types(role=role, requested=payload.document_types)
    evidence = retriever.retrieve(
        RetrievalRequest(
            query=payload.query,
            user=current_user,
            role=role,
            document_types=payload.document_types,
            top_k=payload.top_k,
            score_threshold=payload.score_threshold,
        )
    )
    return RetrievalResponse(
        query=payload.query,
        role=role.value,
        applied_document_types=applied_document_types,
        top_k=payload.top_k or settings.retrieval_top_k,
        score_threshold=payload.score_threshold if payload.score_threshold is not None else settings.retrieval_score_threshold,
        result_count=len(evidence),
        evidence=evidence,
    )


def build_generation_response(
    *,
    payload: GenerationQueryRequest,
    current_user: User,
    role: UserRole,
) -> GenerationResponse:
    generation_service = get_generation_service()
    result = generation_service.generate(
        GroundedGenerationRequest(
            query=payload.query,
            user=current_user,
            role=role,
            prompt_type=payload.prompt_type,
            document_types=payload.document_types,
            top_k=payload.top_k,
            score_threshold=payload.score_threshold,
            model_override=payload.model_override,
            use_upgrade_model=payload.use_upgrade_model,
            temperature=payload.temperature,
            max_output_tokens=payload.max_output_tokens,
        )
    )
    return GenerationResponse(
        query=payload.query,
        role=role.value,
        prompt_type=payload.prompt_type,
        provider=result.provider,
        model=result.model,
        temperature=result.temperature,
        max_output_tokens=result.max_output_tokens,
        applied_document_types=result.applied_document_types,
        evidence_count=len(result.evidence),
        answer=result.answer,
        evidence=result.evidence,
    )


@router.post("/candidate/retrieve", response_model=RetrievalResponse)
def retrieve_candidate_evidence(
    payload: RetrievalQueryRequest,
    current_user: User = Depends(get_current_candidate),
) -> RetrievalResponse:
    try:
        return build_retrieval_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.CANDIDATE,
        )
    except RetrievalError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/recruiter/retrieve", response_model=RetrievalResponse)
def retrieve_recruiter_evidence(
    payload: RetrievalQueryRequest,
    current_user: User = Depends(get_current_recruiter),
) -> RetrievalResponse:
    try:
        return build_retrieval_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.RECRUITER,
        )
    except RetrievalError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/candidate/generate", response_model=GenerationResponse)
def generate_candidate_output(
    payload: GenerationQueryRequest,
    current_user: User = Depends(get_current_candidate),
) -> GenerationResponse:
    try:
        return build_generation_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.CANDIDATE,
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/recruiter/generate", response_model=GenerationResponse)
def generate_recruiter_output(
    payload: GenerationQueryRequest,
    current_user: User = Depends(get_current_recruiter),
) -> GenerationResponse:
    try:
        return build_generation_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.RECRUITER,
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
