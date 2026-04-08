from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.models.document import DocumentType
from app.schemas.retrieval import EvidenceChunkResponse


class GroundedPromptType(str, Enum):
    CANDIDATE_INTERVIEW_QUESTIONS = "candidate_interview_questions"
    CANDIDATE_ANSWER_GUIDANCE = "candidate_answer_guidance"
    STAR_ANSWER = "star_answer"
    SKILL_GAP_ANALYSIS = "skill_gap_analysis"
    RECRUITER_FIT_SUMMARY = "recruiter_fit_summary"
    RECRUITER_INTERVIEW_PACK = "recruiter_interview_pack"


class GenerationQueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    prompt_type: GroundedPromptType
    document_types: list[DocumentType] | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    recruiter_job_id: int | None = Field(default=None, ge=1)
    recruiter_candidate_id: int | None = Field(default=None, ge=1)
    model_override: str | None = Field(default=None, min_length=1, max_length=120)
    use_upgrade_model: bool = False
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=64, le=4000)


class GenerationResponse(BaseModel):
    query: str
    role: str
    prompt_type: GroundedPromptType
    recruiter_job_id: int | None
    recruiter_candidate_id: int | None
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    answer: str
    evidence: list[EvidenceChunkResponse]


class CandidateGenerationRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    document_types: list[DocumentType] | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    model_override: str | None = Field(default=None, min_length=1, max_length=120)
    use_upgrade_model: bool = False
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=64, le=4000)


class RecruiterGenerationRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    document_types: list[DocumentType] | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    recruiter_job_id: int | None = Field(default=None, ge=1)
    recruiter_candidate_id: int | None = Field(default=None, ge=1)
    model_override: str | None = Field(default=None, min_length=1, max_length=120)
    use_upgrade_model: bool = False
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=64, le=4000)


class SkillGapSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CandidateInterviewQuestionResponse(BaseModel):
    category: str
    question: str
    rationale: str
    evidence_chunk_ids: list[int]


class CandidateInterviewQuestionsResponse(BaseModel):
    query: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    overview: str
    questions: list[CandidateInterviewQuestionResponse]
    evidence: list[EvidenceChunkResponse]


class CandidateAnswerGuidanceResponse(BaseModel):
    query: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    answer_draft: str
    opening_answer: str
    talking_points: list[str]
    stronger_version_tip: str
    follow_up_questions: list[str]
    evidence: list[EvidenceChunkResponse]


class CandidateStarSectionResponse(BaseModel):
    content: str
    evidence_chunk_ids: list[int]


class CandidateStarAnswerResponse(BaseModel):
    query: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    editable_draft: str
    situation: CandidateStarSectionResponse
    task: CandidateStarSectionResponse
    action: CandidateStarSectionResponse
    result: CandidateStarSectionResponse
    missing_signals: list[str]
    evidence: list[EvidenceChunkResponse]


class CandidateStrengthSignalResponse(BaseModel):
    title: str
    summary: str
    evidence_chunk_ids: list[int]


class CandidateSkillGapItemResponse(BaseModel):
    skill_area: str
    severity: SkillGapSeverity
    summary: str
    recommendation: str
    evidence_chunk_ids: list[int]


class CandidateSkillGapAnalysisResponse(BaseModel):
    query: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    analysis_summary: str
    strengths: list[CandidateStrengthSignalResponse]
    missing_signals: list[CandidateSkillGapItemResponse]
    improvement_actions: list[str]
    evidence: list[EvidenceChunkResponse]


class RecruiterStrengthSignalResponse(BaseModel):
    title: str
    summary: str
    evidence_chunk_ids: list[int]


class RecruiterConcernResponse(BaseModel):
    title: str
    summary: str
    evidence_chunk_ids: list[int]


class RecruiterFitSummaryResponse(BaseModel):
    query: str
    recruiter_job_id: int | None
    recruiter_candidate_id: int | None
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    summary: str
    strengths: list[RecruiterStrengthSignalResponse]
    concerns: list[RecruiterConcernResponse]
    missing_evidence_areas: list[str]
    recommendation: str
    evidence: list[EvidenceChunkResponse]


class RecruiterInterviewProbeResponse(BaseModel):
    category: str
    prompt: str
    rationale: str
    evidence_chunk_ids: list[int]


class RecruiterInterviewPackResponse(BaseModel):
    query: str
    recruiter_job_id: int | None
    recruiter_candidate_id: int | None
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    overview: str
    probes: list[RecruiterInterviewProbeResponse]
    follow_up_questions: list[str]
    evidence: list[EvidenceChunkResponse]
