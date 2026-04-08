from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.models.user import UserRole
from app.schemas.generation import GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse


@dataclass(frozen=True)
class PromptBundle:
    system_prompt: str
    user_prompt: str


def build_grounded_prompt(
    *,
    prompt_type: GroundedPromptType,
    role: UserRole,
    query: str,
    evidence: list[EvidenceChunkResponse],
) -> PromptBundle:
    system_prompt = build_system_prompt(role=role)
    evidence_block = format_evidence_for_prompt(evidence)
    user_prompt = PROMPT_BUILDERS[prompt_type](query=query, evidence_block=evidence_block)
    return PromptBundle(system_prompt=system_prompt, user_prompt=user_prompt)


def build_system_prompt(*, role: UserRole) -> str:
    role_label = "candidate" if role == UserRole.CANDIDATE else "recruiter"
    return (
        "You are HireLens AI.\n"
        f"You are generating a grounded response for a {role_label} workflow.\n"
        "Use only the retrieved evidence provided in the prompt.\n"
        "Do not invent experience, achievements, skills, or concerns that are not supported by the evidence.\n"
        "If the evidence is incomplete, state the limitation directly.\n"
        "Keep the answer actionable and easy to scan."
    )


def format_evidence_for_prompt(evidence: list[EvidenceChunkResponse]) -> str:
    if not evidence:
        return "No supporting evidence was retrieved."

    formatted_chunks: list[str] = []
    for index, item in enumerate(evidence, start=1):
        context_bits: list[str] = [
            f"source={item.source_label}",
            f"document_type={item.document_type.value}",
            f"score={item.relevance_score}",
        ]
        if item.section_title:
            context_bits.append(f"section={item.section_title}")
        if item.page_number is not None:
            context_bits.append(f"page={item.page_number}")
        metadata_line = ", ".join(context_bits)
        formatted_chunks.append(
            f"[E{index}] {metadata_line}\n{item.content.strip()}"
        )
    return "\n\n".join(formatted_chunks)


def build_candidate_interview_question_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Generate likely interview questions grounded in the evidence.\n"
        "Output format:\n"
        "- 3 to 5 questions\n"
        "- tag each question with a short category label\n"
        "- add a one-line rationale that references the evidence\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


def build_candidate_answer_guidance_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Produce a concise answer outline grounded in the evidence.\n"
        "Output format:\n"
        "- short opening answer\n"
        "- 2 to 4 evidence-backed talking points\n"
        "- one stronger version tip if the evidence is thin\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


def build_star_answer_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Turn the evidence into a STAR-format draft.\n"
        "Output format:\n"
        "- Situation\n"
        "- Task\n"
        "- Action\n"
        "- Result\n"
        "- note any missing metric or outcome\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


def build_skill_gap_analysis_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Compare the request against the evidence and identify skill gaps.\n"
        "Output format:\n"
        "- strengths found in evidence\n"
        "- missing or weak signals\n"
        "- concrete next actions to strengthen the profile\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


def build_recruiter_fit_summary_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Produce a recruiter-facing fit summary grounded in the evidence.\n"
        "Output format:\n"
        "- strengths\n"
        "- concerns or missing evidence\n"
        "- short recommendation\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


def build_recruiter_interview_pack_prompt(*, query: str, evidence_block: str) -> str:
    return (
        f"User request: {query}\n"
        "Task: Create an interview pack grounded in the evidence.\n"
        "Output format:\n"
        "- 3 to 5 interview probes\n"
        "- follow-up questions\n"
        "- evidence rationale per probe\n\n"
        f"Retrieved evidence:\n{evidence_block}"
    )


PROMPT_BUILDERS: dict[GroundedPromptType, Callable[..., str]] = {
    GroundedPromptType.CANDIDATE_INTERVIEW_QUESTIONS: build_candidate_interview_question_prompt,
    GroundedPromptType.CANDIDATE_ANSWER_GUIDANCE: build_candidate_answer_guidance_prompt,
    GroundedPromptType.STAR_ANSWER: build_star_answer_prompt,
    GroundedPromptType.SKILL_GAP_ANALYSIS: build_skill_gap_analysis_prompt,
    GroundedPromptType.RECRUITER_FIT_SUMMARY: build_recruiter_fit_summary_prompt,
    GroundedPromptType.RECRUITER_INTERVIEW_PACK: build_recruiter_interview_pack_prompt,
}
