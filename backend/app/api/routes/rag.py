from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_candidate, get_current_recruiter, get_db_session
from app.services.candidate import (
    CandidateStructuredRequest,
    generate_candidate_answer_guidance,
    generate_candidate_interview_questions,
    generate_candidate_skill_gap_analysis,
    generate_candidate_star_answer,
)
from app.services.recruiter import (
    RecruiterCandidateNotFoundError,
    RecruiterJobNotFoundError,
    RecruiterStructuredRequest,
    generate_recruiter_fit_summary,
    generate_recruiter_interview_pack,
    get_recruiter_candidate,
    get_recruiter_job,
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
    db: Session,
) -> RetrievalResponse:
    settings = get_settings()
    retriever = get_retriever_service()
    recruiter_job_id, recruiter_candidate_id = validate_recruiter_scope_for_retrieval(
        db=db,
        current_user=current_user,
        role=role,
        recruiter_job_id=payload.recruiter_job_id,
        recruiter_candidate_id=payload.recruiter_candidate_id,
    )
    applied_document_types = resolve_document_types(role=role, requested=payload.document_types)
    evidence = retriever.retrieve(
        RetrievalRequest(
            query=payload.query,
            user=current_user,
            role=role,
            document_types=payload.document_types,
            top_k=payload.top_k,
            score_threshold=payload.score_threshold,
            recruiter_job_id=recruiter_job_id,
            recruiter_candidate_id=recruiter_candidate_id,
        )
    )
    return RetrievalResponse(
        query=payload.query,
        role=role.value,
        applied_document_types=applied_document_types,
        recruiter_job_id=recruiter_job_id,
        recruiter_candidate_id=recruiter_candidate_id,
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
    db: Session,
) -> GenerationResponse:
    generation_service = get_generation_service()
    recruiter_job_id, recruiter_candidate_id = validate_recruiter_scope_for_generation(
        db=db,
        current_user=current_user,
        role=role,
        recruiter_job_id=payload.recruiter_job_id,
        recruiter_candidate_id=payload.recruiter_candidate_id,
    )
    result = generation_service.generate(
        GroundedGenerationRequest(
            query=payload.query,
            user=current_user,
            role=role,
            prompt_type=payload.prompt_type,
            document_types=payload.document_types,
            top_k=payload.top_k,
            score_threshold=payload.score_threshold,
            recruiter_job_id=recruiter_job_id,
            recruiter_candidate_id=recruiter_candidate_id,
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
        recruiter_job_id=result.recruiter_job_id,
        recruiter_candidate_id=result.recruiter_candidate_id,
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
    db: Session = Depends(get_db_session),
) -> RetrievalResponse:
    try:
        return build_retrieval_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.CANDIDATE,
            db=db,
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
    db: Session = Depends(get_db_session),
) -> RetrievalResponse:
    try:
        return build_retrieval_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.RECRUITER,
            db=db,
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
    db: Session = Depends(get_db_session),
) -> GenerationResponse:
    try:
        return build_generation_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.CANDIDATE,
            db=db,
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
    db: Session,
) -> RecruiterStructuredRequest:
    recruiter_job_id, recruiter_candidate_id = validate_recruiter_scope_for_generation(
        db=db,
        current_user=current_user,
        role=UserRole.RECRUITER,
        recruiter_job_id=payload.recruiter_job_id,
        recruiter_candidate_id=payload.recruiter_candidate_id,
    )
    return RecruiterStructuredRequest(
        query=payload.query,
        user=current_user,
        document_types=payload.document_types,
        top_k=payload.top_k,
        score_threshold=payload.score_threshold,
        recruiter_job_id=recruiter_job_id,
        recruiter_candidate_id=recruiter_candidate_id,
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
    db: Session = Depends(get_db_session),
) -> RecruiterFitSummaryResponse:
    try:
        return RecruiterFitSummaryResponse.model_validate(
            generate_recruiter_fit_summary(
                build_recruiter_structured_request(payload=payload, current_user=current_user, db=db)
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
    db: Session = Depends(get_db_session),
) -> RecruiterInterviewPackResponse:
    try:
        return RecruiterInterviewPackResponse.model_validate(
            generate_recruiter_interview_pack(
                build_recruiter_structured_request(payload=payload, current_user=current_user, db=db)
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
    db: Session = Depends(get_db_session),
) -> GenerationResponse:
    try:
        return build_generation_response(
            payload=payload,
            current_user=current_user,
            role=UserRole.RECRUITER,
            db=db,
        )
    except GroundedGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


def validate_recruiter_scope_for_retrieval(
    *,
    db: Session,
    current_user: User,
    role: UserRole,
    recruiter_job_id: int | None,
    recruiter_candidate_id: int | None,
) -> tuple[int | None, int | None]:
    try:
        return resolve_recruiter_scope(
            db=db,
            current_user=current_user,
            role=role,
            recruiter_job_id=recruiter_job_id,
            recruiter_candidate_id=recruiter_candidate_id,
        )
    except ValueError as exc:
        raise RetrievalError(str(exc)) from exc


def validate_recruiter_scope_for_generation(
    *,
    db: Session,
    current_user: User,
    role: UserRole,
    recruiter_job_id: int | None,
    recruiter_candidate_id: int | None,
) -> tuple[int | None, int | None]:
    try:
        return resolve_recruiter_scope(
            db=db,
            current_user=current_user,
            role=role,
            recruiter_job_id=recruiter_job_id,
            recruiter_candidate_id=recruiter_candidate_id,
        )
    except ValueError as exc:
        raise GroundedGenerationError(str(exc)) from exc


def resolve_recruiter_scope(
    *,
    db: Session,
    current_user: User,
    role: UserRole,
    recruiter_job_id: int | None,
    recruiter_candidate_id: int | None,
) -> tuple[int | None, int | None]:
    if role != UserRole.RECRUITER:
        if recruiter_job_id is not None or recruiter_candidate_id is not None:
            raise ValueError("Recruiter job and candidate scoping is only available to recruiters.")
        return None, None

    resolved_job_id = recruiter_job_id
    resolved_candidate_id = recruiter_candidate_id

    try:
        if recruiter_job_id is not None:
            get_recruiter_job(db, recruiter=current_user, job_id=recruiter_job_id)
        if recruiter_candidate_id is not None:
            candidate = get_recruiter_candidate(
                db,
                recruiter=current_user,
                job_id=recruiter_job_id,
                candidate_id=recruiter_candidate_id,
            )
            resolved_job_id = candidate.job_id
            resolved_candidate_id = candidate.id
    except (RecruiterJobNotFoundError, RecruiterCandidateNotFoundError) as exc:
        raise ValueError(str(exc)) from exc

    return resolved_job_id, resolved_candidate_id
