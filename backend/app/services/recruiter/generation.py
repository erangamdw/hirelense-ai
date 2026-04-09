from __future__ import annotations

from dataclasses import dataclass

from app.models.document import DocumentType
from app.models.user import User, UserRole
from app.schemas.generation import GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.candidate.generation import (
    STAKEHOLDER_TERMS,
    build_rationale,
    contains_metric,
    summarize_text,
)
from app.services.rag import GroundedGenerationRequest, get_generation_service


FIT_STRENGTH_TITLES: dict[DocumentType, str] = {
    DocumentType.RECRUITER_CANDIDATE_CV: "Candidate evidence",
    DocumentType.PROJECT_NOTES: "Supporting project signal",
    DocumentType.INTERVIEW_FEEDBACK: "Interview feedback signal",
    DocumentType.JOB_DESCRIPTION: "Role requirement match",
}

PROBE_CATEGORY_BY_DOCUMENT_TYPE: dict[str, str] = {
    "job_description": "requirements",
    "recruiter_candidate_cv": "experience",
    "project_notes": "project",
    "interview_feedback": "risk",
}


@dataclass(frozen=True)
class RecruiterStructuredRequest:
    query: str
    user: User
    document_types: list[DocumentType] | None = None
    document_ids: list[int] | None = None
    top_k: int | None = None
    score_threshold: float | None = None
    recruiter_job_id: int | None = None
    recruiter_candidate_id: int | None = None
    model_override: str | None = None
    use_upgrade_model: bool = False
    temperature: float | None = None
    max_output_tokens: int | None = None


def generate_recruiter_fit_summary(request: RecruiterStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.RECRUITER,
            prompt_type=GroundedPromptType.RECRUITER_FIT_SUMMARY,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            recruiter_job_id=request.recruiter_job_id,
            recruiter_candidate_id=request.recruiter_candidate_id,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    concerns = build_recruiter_concerns(query=request.query, evidence=generation.evidence)
    missing_evidence_areas = build_recruiter_missing_evidence_areas(
        query=request.query,
        evidence=generation.evidence,
    )
    return {
        "query": request.query,
        "recruiter_job_id": request.recruiter_job_id,
        "recruiter_candidate_id": request.recruiter_candidate_id,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "summary": generation.answer,
        "strengths": build_recruiter_strengths(evidence=generation.evidence),
        "concerns": concerns,
        "missing_evidence_areas": missing_evidence_areas,
        "recommendation": build_recruiter_recommendation(concerns=concerns, missing_evidence_areas=missing_evidence_areas),
        "evidence": generation.evidence,
    }


def generate_recruiter_interview_pack(request: RecruiterStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.RECRUITER,
            prompt_type=GroundedPromptType.RECRUITER_INTERVIEW_PACK,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            recruiter_job_id=request.recruiter_job_id,
            recruiter_candidate_id=request.recruiter_candidate_id,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    probes = build_recruiter_probes(query=request.query, evidence=generation.evidence)
    return {
        "query": request.query,
        "recruiter_job_id": request.recruiter_job_id,
        "recruiter_candidate_id": request.recruiter_candidate_id,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "overview": generation.answer,
        "probes": probes,
        "follow_up_questions": build_recruiter_follow_up_questions(query=request.query, evidence=generation.evidence),
        "evidence": generation.evidence,
    }


def build_recruiter_strengths(*, evidence: list[EvidenceChunkResponse]) -> list[dict[str, object]]:
    strengths: list[dict[str, object]] = []
    for item in evidence[:3]:
        strengths.append(
            {
                "title": FIT_STRENGTH_TITLES.get(item.document_type, "Grounded evidence"),
                "summary": summarize_text(item.content, limit=120),
                "evidence_chunk_ids": [item.chunk_id],
            }
        )
    return strengths


def build_recruiter_concerns(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[dict[str, object]]:
    concerns: list[dict[str, object]] = []
    candidate_evidence = [item for item in evidence if item.document_type != DocumentType.JOB_DESCRIPTION]

    if not any(contains_metric(item.content) for item in candidate_evidence):
        concerns.append(
            {
                "title": "Impact evidence is thin",
                "summary": "Retrieved candidate evidence describes experience, but not a strong measurable outcome.",
                "evidence_chunk_ids": [candidate_evidence[0].chunk_id] if candidate_evidence else [],
            }
        )

    combined = " ".join(item.content.lower() for item in candidate_evidence)
    if not any(term in combined for term in STAKEHOLDER_TERMS):
        concerns.append(
            {
                "title": "Stakeholder communication is unclear",
                "summary": f"The current evidence does not clearly show collaboration or stakeholder handling for {query}.",
                "evidence_chunk_ids": [candidate_evidence[0].chunk_id] if candidate_evidence else [],
            }
        )

    feedback_item = next(
        (item for item in evidence if item.document_type == DocumentType.INTERVIEW_FEEDBACK),
        None,
    )
    if feedback_item is not None:
        concerns.append(
            {
                "title": "Prior interview signal needs follow-up",
                "summary": summarize_text(feedback_item.content, limit=120),
                "evidence_chunk_ids": [feedback_item.chunk_id],
            }
        )

    if not concerns:
        fallback_item = candidate_evidence[0] if candidate_evidence else (evidence[0] if evidence else None)
        concerns.append(
            {
                "title": "Validate depth with probing",
                "summary": f"Use the interview to confirm the depth behind {query} instead of assuming the written evidence is complete.",
                "evidence_chunk_ids": [fallback_item.chunk_id] if fallback_item is not None else [],
            }
        )
    return concerns[:3]


def build_recruiter_missing_evidence_areas(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[str]:
    candidate_evidence = [item for item in evidence if item.document_type != DocumentType.JOB_DESCRIPTION]
    missing: list[str] = []

    if not candidate_evidence:
        return [f"No candidate-specific evidence was retrieved for {query}."]

    if not any(item.document_type == DocumentType.RECRUITER_CANDIDATE_CV for item in evidence):
        missing.append("No recruiter candidate CV evidence was retrieved.")
    if not any(contains_metric(item.content) for item in candidate_evidence):
        missing.append("No clear metric, scope, or quantified result was retrieved.")
    if not any(term in " ".join(item.content.lower() for item in candidate_evidence) for term in STAKEHOLDER_TERMS):
        missing.append("No clear stakeholder, team, or customer-facing signal was retrieved.")
    if not missing:
        missing.append("The current evidence is useful, but the interview should still validate depth against live examples.")
    return missing[:3]


def build_recruiter_recommendation(
    *,
    concerns: list[dict[str, object]],
    missing_evidence_areas: list[str],
) -> str:
    if any("Impact evidence" in str(item["title"]) for item in concerns):
        return "Probe for measurable outcomes first, then verify scope and decision ownership."
    if any("Stakeholder" in str(item["title"]) for item in concerns):
        return "Use scenario-based questions to test stakeholder communication and cross-team judgment."
    if missing_evidence_areas:
        return "Keep the screen focused on the missing evidence areas instead of repeating already-grounded strengths."
    return "Advance the candidate if live examples confirm the strongest grounded evidence."


def build_recruiter_probes(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[dict[str, object]]:
    probes: list[dict[str, object]] = []
    for item in evidence[:4]:
        probes.append(
            {
                "category": PROBE_CATEGORY_BY_DOCUMENT_TYPE.get(item.document_type.value, "fit"),
                "prompt": build_probe_prompt(query=query, evidence=item),
                "rationale": build_rationale(item),
                "evidence_chunk_ids": [item.chunk_id],
            }
        )

    while len(probes) < 3:
        probes.append(
            {
                "category": "fit",
                "prompt": f"What concrete example would prove the candidate can deliver on {query}?",
                "rationale": "Fallback probe keeps the recruiter focused on evidence gaps instead of general impressions.",
                "evidence_chunk_ids": [item.chunk_id for item in evidence[:1]],
            }
        )
    return probes


def build_probe_prompt(*, query: str, evidence: EvidenceChunkResponse) -> str:
    summary = summarize_text(evidence.content, limit=95).lower()
    if evidence.document_type == DocumentType.JOB_DESCRIPTION:
        return f"Ask for a concrete example that proves the candidate can meet this requirement: {summary}."
    if evidence.document_type == DocumentType.INTERVIEW_FEEDBACK:
        return f"Follow up on this earlier signal and test whether it still holds: {summary}."
    return f"Ask the candidate to walk through {summary} and connect it directly to {query}."


def build_recruiter_follow_up_questions(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[str]:
    if not evidence:
        return [
            f"What example best proves the candidate can handle {query}?",
            "What measurable result can they cite?",
        ]

    follow_ups = [
        f"What was the measurable result behind {summarize_text(evidence[0].content, limit=70).lower()}?",
        f"Which decision did the candidate personally own when handling {query}?",
    ]
    if len(evidence) > 1:
        follow_ups.append(
            f"What second example supports the signal from {evidence[1].source_label}?"
        )
    return follow_ups
