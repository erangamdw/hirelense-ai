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
    model_override: str | None = Field(default=None, min_length=1, max_length=120)
    use_upgrade_model: bool = False
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=64, le=4000)


class GenerationResponse(BaseModel):
    query: str
    role: str
    prompt_type: GroundedPromptType
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence_count: int
    answer: str
    evidence: list[EvidenceChunkResponse]
