from __future__ import annotations

from dataclasses import dataclass
import re

from app.models.document import DocumentType
from app.models.user import User, UserRole
from app.schemas.generation import GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.rag import GroundedGenerationRequest, get_generation_service


QUESTION_CATEGORY_BY_DOCUMENT_TYPE: dict[str, str] = {
    "cv": "experience",
    "project_notes": "project",
    "job_description": "requirements",
    "interview_feedback": "feedback",
}

STOPWORDS = {
    "about",
    "above",
    "across",
    "after",
    "again",
    "against",
    "align",
    "also",
    "analysis",
    "answer",
    "based",
    "because",
    "before",
    "being",
    "below",
    "between",
    "build",
    "candidate",
    "clear",
    "clearly",
    "compare",
    "concrete",
    "could",
    "directly",
    "draft",
    "evidence",
    "example",
    "experience",
    "focus",
    "from",
    "grounded",
    "have",
    "highlight",
    "improve",
    "interview",
    "into",
    "job",
    "just",
    "make",
    "more",
    "need",
    "next",
    "output",
    "profile",
    "question",
    "request",
    "response",
    "role",
    "should",
    "skills",
    "some",
    "strengthen",
    "stronger",
    "that",
    "their",
    "them",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "tied",
    "using",
    "with",
    "work",
    "workflow",
}
IMPACT_TERMS = {"metric", "metrics", "result", "results", "outcome", "outcomes", "impact", "improved", "reduced"}
STAKEHOLDER_TERMS = {"stakeholder", "stakeholders", "customer", "customers", "user", "users", "team", "teams"}


@dataclass(frozen=True)
class CandidateStructuredRequest:
    query: str
    user: User
    document_types: list[DocumentType] | None = None
    document_ids: list[int] | None = None
    top_k: int | None = None
    score_threshold: float | None = None
    model_override: str | None = None
    use_upgrade_model: bool = False
    temperature: float | None = None
    max_output_tokens: int | None = None


def generate_candidate_interview_questions(request: CandidateStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.CANDIDATE,
            prompt_type=GroundedPromptType.CANDIDATE_INTERVIEW_QUESTIONS,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    questions = build_structured_questions(query=request.query, evidence=generation.evidence)
    return {
        "query": request.query,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "overview": generation.answer,
        "questions": questions,
        "evidence": generation.evidence,
    }


def generate_candidate_answer_guidance(request: CandidateStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.CANDIDATE,
            prompt_type=GroundedPromptType.CANDIDATE_ANSWER_GUIDANCE,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    return {
        "query": request.query,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "answer_draft": generation.answer,
        "opening_answer": build_opening_answer(query=request.query, evidence=generation.evidence),
        "talking_points": build_talking_points(evidence=generation.evidence),
        "stronger_version_tip": build_stronger_version_tip(query=request.query, evidence=generation.evidence),
        "follow_up_questions": build_follow_up_questions(query=request.query, evidence=generation.evidence),
        "evidence": generation.evidence,
    }


def generate_candidate_star_answer(request: CandidateStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.CANDIDATE,
            prompt_type=GroundedPromptType.STAR_ANSWER,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    sections = build_star_sections(query=request.query, evidence=generation.evidence)
    missing_signals = build_star_missing_signals(evidence=generation.evidence)
    return {
        "query": request.query,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "editable_draft": build_editable_star_draft(sections=sections, missing_signals=missing_signals),
        "situation": sections["situation"],
        "task": sections["task"],
        "action": sections["action"],
        "result": sections["result"],
        "missing_signals": missing_signals,
        "evidence": generation.evidence,
    }


def generate_candidate_skill_gap_analysis(request: CandidateStructuredRequest):
    generation = get_generation_service().generate(
        GroundedGenerationRequest(
            query=request.query,
            user=request.user,
            role=UserRole.CANDIDATE,
            prompt_type=GroundedPromptType.SKILL_GAP_ANALYSIS,
            document_types=request.document_types,
            document_ids=request.document_ids,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            model_override=request.model_override,
            use_upgrade_model=request.use_upgrade_model,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
    )

    missing_signals = build_skill_gap_items(query=request.query, evidence=generation.evidence)
    return {
        "query": request.query,
        "provider": generation.provider,
        "model": generation.model,
        "temperature": generation.temperature,
        "max_output_tokens": generation.max_output_tokens,
        "applied_document_types": generation.applied_document_types,
        "evidence_count": len(generation.evidence),
        "analysis_summary": generation.answer,
        "strengths": build_strength_signals(evidence=generation.evidence),
        "missing_signals": missing_signals,
        "improvement_actions": build_improvement_actions(missing_signals=missing_signals),
        "evidence": generation.evidence,
    }


def build_structured_questions(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[dict[str, object]]:
    questions: list[dict[str, object]] = []
    seen_questions: set[str] = set()
    for item in evidence[:4]:
        question_text = build_question_text(query=query, evidence=item)
        if question_text in seen_questions:
            continue
        questions.append(
            {
                "category": QUESTION_CATEGORY_BY_DOCUMENT_TYPE.get(item.document_type.value, "impact"),
                "question": question_text,
                "rationale": build_rationale(item),
                "evidence_chunk_ids": [item.chunk_id],
            }
        )
        seen_questions.add(question_text)

    for fallback in build_fallback_questions(query=query, evidence=evidence):
        if len(questions) >= 3:
            break
        if fallback["question"] in seen_questions:
            continue
        questions.append(fallback)
        seen_questions.add(str(fallback["question"]))
    return questions


def build_fallback_questions(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[dict[str, object]]:
    fallback_chunk_ids = [item.chunk_id for item in evidence[:1]]
    fallback_questions = [
        {
            "category": "impact",
            "question": f"What measurable outcome best proves your impact on {query}?",
            "rationale": "Use a metric, scope number, or business result so the answer does not stay generic.",
            "evidence_chunk_ids": fallback_chunk_ids,
        },
        {
            "category": "scope",
            "question": f"What was the scale, complexity, or ownership level behind {query}?",
            "rationale": "Scope details help the answer sound credible even when the retrieved evidence is thin.",
            "evidence_chunk_ids": fallback_chunk_ids,
        },
        {
            "category": "decision-making",
            "question": f"Which trade-off or decision mattered most when delivering {query}?",
            "rationale": "Decision-making questions surface judgment instead of repeating a task summary.",
            "evidence_chunk_ids": fallback_chunk_ids,
        },
        {
            "category": "stakeholders",
            "question": f"Who benefited from your work on {query}, and how did you know it worked?",
            "rationale": "Stakeholder context keeps the answer tied to user or team impact rather than isolated activity.",
            "evidence_chunk_ids": fallback_chunk_ids,
        },
    ]
    return fallback_questions


def build_question_text(*, query: str, evidence: EvidenceChunkResponse) -> str:
    summary = extract_display_sentence(evidence.content, limit=180)
    if evidence.document_type.value == "job_description":
        return f"Which part of your background best matches this requirement: {summary.lower()}?"
    if evidence.document_type.value == "project_notes":
        return f"Can you walk me through the project where you {summary.lower()} and tie it back to {query}?"
    return f"How would you explain {summary.lower()} when answering {query}?"


def build_rationale(evidence: EvidenceChunkResponse) -> str:
    location_bits: list[str] = [evidence.source_label]
    if evidence.section_title:
        location_bits.append(evidence.section_title)
    if evidence.page_number is not None:
        location_bits.append(f"page {evidence.page_number}")
    return f"Grounded in {' / '.join(location_bits)} with relevance score {evidence.relevance_score}."


def build_opening_answer(*, query: str, evidence: list[EvidenceChunkResponse]) -> str:
    if not evidence:
        return f"I would answer {query} by first stating that I need stronger supporting examples."
    first = evidence[0]
    return (
        f"I would answer {query} by leading with {summarize_text(first.content, limit=110)} "
        f"from {first.source_label}."
    )


def build_talking_points(*, evidence: list[EvidenceChunkResponse]) -> list[str]:
    if not evidence:
        return ["Call out the missing evidence and add a concrete project example before using this answer."]
    return [
        f"Use {item.source_label} to highlight {extract_display_sentence(item.content, limit=260)}."
        for item in evidence[:3]
    ]


def build_stronger_version_tip(*, query: str, evidence: list[EvidenceChunkResponse]) -> str:
    if not evidence:
        return f"Add a concrete project, metric, or stakeholder outcome that directly supports {query}."

    combined = " ".join(item.content.lower() for item in evidence)
    for token in query.lower().split():
        normalized = token.strip(".,:;!?()[]{}")
        if len(normalized) >= 5 and normalized not in combined:
            return f"Add an example that explicitly mentions '{normalized}' so the answer matches the question more directly."
    return "Make the answer stronger by attaching a measurable result, scope, or stakeholder outcome to the strongest example."


def build_follow_up_questions(*, query: str, evidence: list[EvidenceChunkResponse]) -> list[str]:
    if not evidence:
        return [
            f"What project gives you the clearest evidence for {query}?",
            "What metric or business outcome can you add?",
        ]

    follow_ups = [
        f"What measurable result came from {extract_display_sentence(evidence[0].content, limit=200).lower()}?",
        f"Which tools or decisions mattered most when delivering {query}?",
    ]
    if len(evidence) > 1:
        follow_ups.append(
            f"How does {evidence[1].source_label} reinforce the story with a second example?"
        )
    return follow_ups


def summarize_text(text: str, *, limit: int) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def extract_display_sentence(text: str, *, limit: int) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= limit:
        return normalized

    sentence_match = re.search(r"^(.{40,}?[.!?])(?:\s|$)", normalized)
    if sentence_match:
        sentence = sentence_match.group(1).strip()
        if len(sentence) <= max(limit + 40, 220):
            return sentence

    return summarize_text(normalized, limit=limit)


def build_star_sections(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> dict[str, dict[str, object]]:
    situation_item = pick_evidence(
        evidence=evidence,
        preferred_types=[DocumentType.PROJECT_NOTES, DocumentType.CV, DocumentType.JOB_DESCRIPTION],
    )
    task_item = pick_evidence(
        evidence=evidence,
        preferred_types=[DocumentType.JOB_DESCRIPTION, DocumentType.PROJECT_NOTES, DocumentType.CV],
    )
    action_item = pick_evidence(
        evidence=evidence,
        preferred_types=[DocumentType.PROJECT_NOTES, DocumentType.CV, DocumentType.JOB_DESCRIPTION],
    )
    result_item = pick_result_evidence(evidence=evidence) or action_item or situation_item

    return {
        "situation": build_star_section(
            item=situation_item,
            fallback="Add the project or role context before using this STAR answer.",
            content_builder=build_situation_content,
        ),
        "task": build_star_section(
            item=task_item,
            fallback=f"State the specific responsibility or goal that matters most for {query}.",
            content_builder=lambda item: build_task_content(query=query, item=item),
        ),
        "action": build_star_section(
            item=action_item,
            fallback="Add the concrete actions you took so the answer is not just a summary.",
            content_builder=build_action_content,
        ),
        "result": build_star_section(
            item=result_item,
            fallback="Add the measurable outcome, scope, or business effect that followed.",
            content_builder=build_result_content,
        ),
    }


def build_star_section(
    *,
    item: EvidenceChunkResponse | None,
    fallback: str,
    content_builder,
) -> dict[str, object]:
    if item is None:
        return {"content": fallback, "evidence_chunk_ids": []}
    return {
        "content": content_builder(item),
        "evidence_chunk_ids": [item.chunk_id],
    }


def build_situation_content(item: EvidenceChunkResponse) -> str:
    summary = normalize_star_fragment(extract_display_sentence(item.content, limit=280))
    if item.document_type == DocumentType.JOB_DESCRIPTION:
        return f"The target context is a role that expects: {summary}."
    return f"The example context is: {summary}."


def build_task_content(*, query: str, item: EvidenceChunkResponse) -> str:
    summary = normalize_star_fragment(extract_display_sentence(item.content, limit=280))
    if item.document_type == DocumentType.JOB_DESCRIPTION:
        return f"My task was to show clear alignment to this role requirement: {summary}."
    return f"My responsibility was to deliver: {summary}. This directly supports: {query}."


def build_action_content(item: EvidenceChunkResponse) -> str:
    summary = normalize_star_fragment(extract_display_sentence(item.content, limit=300))
    return f"I took action by: {summary}."


def build_result_content(item: EvidenceChunkResponse) -> str:
    summary = normalize_star_fragment(extract_display_sentence(item.content, limit=300))
    if contains_metric(summary):
        return f"The result was: {summary}."
    return f"The result was: {summary}."


def normalize_star_fragment(text: str) -> str:
    normalized = " ".join(text.split())
    normalized = re.sub(r"\s*[•▪◦·]+\s*", "; ", normalized)
    normalized = re.sub(r";\s*;\s*", "; ", normalized)
    return normalized.strip(" ;,")


def build_star_missing_signals(*, evidence: list[EvidenceChunkResponse]) -> list[str]:
    if not evidence:
        return ["No retrieved evidence was available, so the STAR draft needs source material before use."]

    combined = " ".join(item.content.lower() for item in evidence)
    missing_signals: list[str] = []
    if not any(contains_metric(item.content) for item in evidence):
        missing_signals.append("No explicit metric or business outcome was retrieved yet.")
    if DocumentType.JOB_DESCRIPTION not in {item.document_type for item in evidence}:
        missing_signals.append("No job-description evidence was included, so the draft may not align tightly to a target role.")
    if not any(term in combined for term in STAKEHOLDER_TERMS):
        missing_signals.append("The draft needs clearer stakeholder, user, or team context.")
    return missing_signals[:3]


def build_editable_star_draft(
    *,
    sections: dict[str, dict[str, object]],
    missing_signals: list[str],
) -> str:
    lines = [
        "Situation: " + str(sections["situation"]["content"]),
        "Task: " + str(sections["task"]["content"]),
        "Action: " + str(sections["action"]["content"]),
        "Result: " + str(sections["result"]["content"]),
    ]
    if missing_signals:
        lines.append("Missing signals: " + "; ".join(missing_signals))
    return "\n".join(lines)


def build_strength_signals(*, evidence: list[EvidenceChunkResponse]) -> list[dict[str, object]]:
    candidate_evidence = [item for item in evidence if item.document_type != DocumentType.JOB_DESCRIPTION]
    strengths: list[dict[str, object]] = []
    for item in (candidate_evidence or evidence)[:3]:
        strengths.append(
            {
                "title": build_strength_title(item),
                "summary": summarize_text(item.content, limit=120),
                "evidence_chunk_ids": [item.chunk_id],
            }
        )
    return strengths


def build_strength_title(item: EvidenceChunkResponse) -> str:
    if item.document_type == DocumentType.CV:
        return "Resume-backed experience"
    if item.document_type == DocumentType.PROJECT_NOTES:
        return "Project evidence"
    if item.document_type == DocumentType.INTERVIEW_FEEDBACK:
        return "Interview feedback signal"
    return f"{item.document_type.value.replace('_', ' ').title()} signal"


def build_skill_gap_items(
    *,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> list[dict[str, object]]:
    jd_evidence = [item for item in evidence if item.document_type == DocumentType.JOB_DESCRIPTION]
    candidate_evidence = [item for item in evidence if item.document_type != DocumentType.JOB_DESCRIPTION]
    candidate_text = " ".join(item.content.lower() for item in candidate_evidence)

    missing_terms: list[str] = []
    for item in jd_evidence:
        for token in extract_keywords(item.content):
            if token not in candidate_text and token not in missing_terms:
                missing_terms.append(token)
            if len(missing_terms) == 3:
                break
        if len(missing_terms) == 3:
            break

    if not missing_terms and not any(contains_metric(item.content) for item in candidate_evidence):
        missing_terms.append("measurable outcomes")
    if not missing_terms and not any(term in candidate_text for term in STAKEHOLDER_TERMS):
        missing_terms.append("stakeholder communication")
    if not missing_terms:
        fallback_token = next(iter(extract_keywords(query)), "role alignment")
        missing_terms.append(fallback_token)

    gap_items: list[dict[str, object]] = []
    for index, token in enumerate(missing_terms[:3]):
        source_item = find_evidence_for_term(term=token, evidence=jd_evidence) or (jd_evidence[0] if jd_evidence else None)
        gap_items.append(
            {
                "skill_area": token.replace("-", " "),
                "severity": classify_gap_severity(index=index),
                "summary": build_gap_summary(term=token, candidate_text=candidate_text),
                "recommendation": build_gap_recommendation(term=token),
                "evidence_chunk_ids": [source_item.chunk_id] if source_item is not None else [],
            }
        )
    return gap_items


def build_improvement_actions(*, missing_signals: list[dict[str, object]]) -> list[str]:
    actions: list[str] = []
    seen: set[str] = set()
    for item in missing_signals:
        recommendation = str(item["recommendation"])
        if recommendation not in seen:
            actions.append(recommendation)
            seen.add(recommendation)
    return actions


def pick_evidence(
    *,
    evidence: list[EvidenceChunkResponse],
    preferred_types: list[DocumentType],
) -> EvidenceChunkResponse | None:
    for document_type in preferred_types:
        for item in evidence:
            if item.document_type == document_type:
                return item
    return evidence[0] if evidence else None


def pick_result_evidence(*, evidence: list[EvidenceChunkResponse]) -> EvidenceChunkResponse | None:
    for item in evidence:
        if contains_metric(item.content):
            return item
    return pick_evidence(
        evidence=evidence,
        preferred_types=[DocumentType.PROJECT_NOTES, DocumentType.CV, DocumentType.JOB_DESCRIPTION],
    )


def contains_metric(text: str) -> bool:
    lowered = text.lower()
    return bool(re.search(r"\d", lowered)) or any(term in lowered for term in IMPACT_TERMS)


def extract_keywords(text: str) -> list[str]:
    keywords: list[str] = []
    for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+-]{3,}", text.lower()):
        normalized = token.strip("-+")
        if normalized in STOPWORDS or normalized in keywords:
            continue
        keywords.append(normalized)
    return keywords


def find_evidence_for_term(
    *,
    term: str,
    evidence: list[EvidenceChunkResponse],
) -> EvidenceChunkResponse | None:
    for item in evidence:
        if term in item.content.lower():
            return item
    return evidence[0] if evidence else None


def classify_gap_severity(*, index: int) -> str:
    if index == 0:
        return "high"
    if index == 1:
        return "medium"
    return "low"


def build_gap_summary(*, term: str, candidate_text: str) -> str:
    if term == "measurable outcomes":
        return "The retrieved candidate evidence describes work performed, but not the metric or outcome it produced."
    if term == "stakeholder communication":
        return "The retrieved candidate evidence does not clearly show stakeholder, user, or cross-team communication."
    if term in candidate_text:
        return f"The evidence mentions {term}, but not strongly enough to make it a reliable interview answer."
    return f"No direct candidate evidence was retrieved for {term}."


def build_gap_recommendation(*, term: str) -> str:
    if term == "measurable outcomes":
        return "Add a metric, scope, or business result to the strongest project example."
    return f"Add a project example, explicit keyword match, or quantified result that shows {term}."
