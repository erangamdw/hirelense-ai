from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_candidate, get_current_recruiter
from app.services.candidate import (
    CandidateStructuredRequest,
    generate_candidate_answer_guidance,
    generate_candidate_interview_questions,
    generate_candidate_skill_gap_analysis,
    generate_candidate_star_answer,
)
from app.services.recruiter import (
    RecruiterStructuredRequest,
    generate_recruiter_fit_summary,
    generate_recruiter_interview_pack,
)
from app.core.config import get_settings
from app.models.user import User, UserRole
from app.schemas.generation import (
    CandidateAnswerGuidanceResponse,
    CandidateGenerationRequest,
    CandidateInterviewQuestionsResponse,
    CandidateSkillGapAnalysisResponse,
    CandidateStarAnswerResponse,
    GenerationQueryRequest,
    GenerationResponse,
    RecruiterFitSummaryResponse,
    RecruiterGenerationRequest,
    RecruiterInterviewPackResponse,
)
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


def build_candidate_structured_request(
    *,
    payload: CandidateGenerationRequest,
    current_user: User,
) -> CandidateStructuredRequest:
    return CandidateStructuredRequest(
        query=payload.query,
        user=current_user,
        document_types=payload.document_types,
        top_k=payload.top_k,
        score_threshold=payload.score_threshold,
        model_override=payload.model_override,
        use_upgrade_model=payload.use_upgrade_model,
        temperature=payload.temperature,
        max_output_tokens=payload.max_output_tokens,
    )


def build_recruiter_structured_request(
    *,
    payload: RecruiterGenerationRequest,
    current_user: User,
) -> RecruiterStructuredRequest:
    return RecruiterStructuredRequest(
        query=payload.query,
        user=current_user,
        document_types=payload.document_types,
        top_k=payload.top_k,
        score_threshold=payload.score_threshold,
        model_override=payload.model_override,
        use_upgrade_model=payload.use_upgrade_model,
        temperature=payload.temperature,
        max_output_tokens=payload.max_output_tokens,
    )


@router.post("/candidate/interview-questions", response_model=CandidateInterviewQuestionsResponse)
def generate_candidate_interview_questions_output(
    payload: CandidateGenerationRequest,
    current_user: User = Depends(get_current_candidate),
) -> CandidateInterviewQuestionsResponse:
    try:
        return CandidateInterviewQuestionsResponse.model_validate(
            generate_candidate_interview_questions(
                build_candidate_structured_request(payload=payload, current_user=current_user)
            )
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/candidate/answer-guidance", response_model=CandidateAnswerGuidanceResponse)
def generate_candidate_answer_guidance_output(
    payload: CandidateGenerationRequest,
    current_user: User = Depends(get_current_candidate),
) -> CandidateAnswerGuidanceResponse:
    try:
        return CandidateAnswerGuidanceResponse.model_validate(
            generate_candidate_answer_guidance(
                build_candidate_structured_request(payload=payload, current_user=current_user)
            )
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/candidate/star-answer", response_model=CandidateStarAnswerResponse)
def generate_candidate_star_answer_output(
    payload: CandidateGenerationRequest,
    current_user: User = Depends(get_current_candidate),
) -> CandidateStarAnswerResponse:
    try:
        return CandidateStarAnswerResponse.model_validate(
            generate_candidate_star_answer(
                build_candidate_structured_request(payload=payload, current_user=current_user)
            )
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/candidate/skill-gap-analysis", response_model=CandidateSkillGapAnalysisResponse)
def generate_candidate_skill_gap_analysis_output(
    payload: CandidateGenerationRequest,
    current_user: User = Depends(get_current_candidate),
) -> CandidateSkillGapAnalysisResponse:
    try:
        return CandidateSkillGapAnalysisResponse.model_validate(
            generate_candidate_skill_gap_analysis(
                build_candidate_structured_request(payload=payload, current_user=current_user)
            )
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/recruiter/fit-summary", response_model=RecruiterFitSummaryResponse)
def generate_recruiter_fit_summary_output(
    payload: RecruiterGenerationRequest,
    current_user: User = Depends(get_current_recruiter),
) -> RecruiterFitSummaryResponse:
    try:
        return RecruiterFitSummaryResponse.model_validate(
            generate_recruiter_fit_summary(
                build_recruiter_structured_request(payload=payload, current_user=current_user)
            )
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/recruiter/interview-pack", response_model=RecruiterInterviewPackResponse)
def generate_recruiter_interview_pack_output(
    payload: RecruiterGenerationRequest,
    current_user: User = Depends(get_current_recruiter),
) -> RecruiterInterviewPackResponse:
    try:
        return RecruiterInterviewPackResponse.model_validate(
            generate_recruiter_interview_pack(
                build_recruiter_structured_request(payload=payload, current_user=current_user)
            )
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
