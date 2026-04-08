from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import get_settings
from app.schemas.generation import GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse


class LLMProviderError(Exception):
    """Raised when text generation cannot be completed."""


@dataclass(frozen=True)
class LLMGenerationRequest:
    prompt_type: GroundedPromptType
    system_prompt: str
    user_prompt: str
    evidence: list[EvidenceChunkResponse]
    model_override: str | None = None
    use_upgrade_model: bool = False
    temperature: float | None = None
    max_output_tokens: int | None = None


@dataclass(frozen=True)
class LLMGenerationResult:
    content: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, request: LLMGenerationRequest) -> LLMGenerationResult:
        raise NotImplementedError


class OpenAILLMProvider(LLMProvider):
    def __init__(
        self,
        *,
        api_key: str,
        default_model: str,
        upgrade_model: str,
        default_temperature: float,
        default_max_output_tokens: int,
        base_url: str | None = None,
    ) -> None:
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.default_model = default_model
        self.upgrade_model = upgrade_model
        self.default_temperature = default_temperature
        self.default_max_output_tokens = default_max_output_tokens

    def generate(self, request: LLMGenerationRequest) -> LLMGenerationResult:
        model = request.model_override or (
            self.upgrade_model if request.use_upgrade_model else self.default_model
        )
        temperature = (
            request.temperature if request.temperature is not None else self.default_temperature
        )
        max_output_tokens = request.max_output_tokens or self.default_max_output_tokens

        try:
            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_output_tokens,
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.user_prompt},
                ],
            )
            content = response.choices[0].message.content or ""
        except Exception as exc:
            raise LLMProviderError(str(exc) or "OpenAI generation request failed.") from exc

        if isinstance(content, list):
            text_parts = [str(part.text) for part in content if getattr(part, "text", None)]
            content = "\n".join(text_parts)

        normalized_content = str(content).strip()
        if not normalized_content:
            raise LLMProviderError("The language model returned an empty response.")

        return LLMGenerationResult(
            content=normalized_content,
            provider="openai",
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )


class DeterministicLLMProvider(LLMProvider):
    """Stable local fallback for grounded generation during development and tests."""

    def __init__(
        self,
        *,
        default_model: str = "deterministic-grounded-v1",
        default_temperature: float = 0.0,
        default_max_output_tokens: int = 700,
    ) -> None:
        self.default_model = default_model
        self.default_temperature = default_temperature
        self.default_max_output_tokens = default_max_output_tokens

    def generate(self, request: LLMGenerationRequest) -> LLMGenerationResult:
        model = request.model_override or self.default_model
        temperature = (
            request.temperature if request.temperature is not None else self.default_temperature
        )
        max_output_tokens = request.max_output_tokens or self.default_max_output_tokens
        content = render_deterministic_output(
            prompt_type=request.prompt_type,
            evidence=request.evidence,
            query=request.user_prompt,
        )
        return LLMGenerationResult(
            content=content,
            provider="deterministic",
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )


def render_deterministic_output(
    *,
    prompt_type: GroundedPromptType,
    evidence: list[EvidenceChunkResponse],
    query: str,
) -> str:
    compact_query = extract_query_line(query)
    evidence_lines = build_evidence_lines(evidence)

    if prompt_type == GroundedPromptType.CANDIDATE_INTERVIEW_QUESTIONS:
        question_lines = build_interview_questions(evidence=evidence, query=compact_query)
        return "\n".join(
            [
                "Likely interview questions:",
                *question_lines,
                "",
                "Evidence used:",
                *evidence_lines,
            ]
        )

    if prompt_type == GroundedPromptType.CANDIDATE_ANSWER_GUIDANCE:
        return "\n".join(
            [
                "Answer outline:",
                f"- Start with a direct response to: {compact_query}",
                f"- Highlight the strongest evidence-backed example from {pick_source_label(evidence, 0)}.",
                f"- Reinforce the impact using the detail from {pick_source_label(evidence, 1)}.",
                "",
                "Evidence cues:",
                *evidence_lines,
            ]
        )

    if prompt_type == GroundedPromptType.STAR_ANSWER:
        return "\n".join(
            [
                "STAR draft:",
                f"Situation: {pick_content(evidence, 0)}",
                f"Task: {pick_content(evidence, 1)}",
                f"Action: {pick_content(evidence, 2)}",
                "Result: Connect the action to measurable impact and keep it tied to the retrieved evidence.",
                "",
                "Evidence cues:",
                *evidence_lines,
            ]
        )

    if prompt_type == GroundedPromptType.SKILL_GAP_ANALYSIS:
        return "\n".join(
            [
                "Skill-gap analysis:",
                f"Strengths: {pick_content(evidence, 0)}",
                f"Supporting signals: {pick_content(evidence, 1)}",
                f"Potential gap to clarify: {infer_gap_statement(compact_query, evidence)}",
                "Next action: Add a concrete example or metric that directly addresses the missing signal.",
                "",
                "Evidence cues:",
                *evidence_lines,
            ]
        )

    if prompt_type == GroundedPromptType.RECRUITER_FIT_SUMMARY:
        return "\n".join(
            [
                "Fit summary:",
                f"Strengths: {pick_content(evidence, 0)}",
                f"Supporting evidence: {pick_content(evidence, 1)}",
                f"Concern to probe: {infer_gap_statement(compact_query, evidence)}",
                "Recommendation: Keep the interview focused on evidence gaps instead of repeating known strengths.",
                "",
                "Evidence cues:",
                *evidence_lines,
            ]
        )

    if prompt_type == GroundedPromptType.RECRUITER_INTERVIEW_PACK:
        interview_lines = build_interview_questions(evidence=evidence, query=compact_query)
        return "\n".join(
            [
                "Interview pack:",
                "Core probes:",
                *interview_lines,
                "",
                "Rationale:",
                *evidence_lines,
            ]
        )

    raise LLMProviderError(f"Unsupported prompt type: {prompt_type}")


def build_interview_questions(
    *,
    evidence: list[EvidenceChunkResponse],
    query: str,
) -> list[str]:
    if not evidence:
        return [
            f"1. What evidence do you have that directly answers: {query}?",
            "2. Which project best demonstrates the missing skill?",
            "3. What outcome or metric can you add to make the answer stronger?",
        ]

    questions: list[str] = []
    for index, item in enumerate(evidence[:3], start=1):
        focus = summarize_content(item.content)
        questions.append(f"{index}. Tell me about {focus.lower()} and how it supports {query}.")
    while len(questions) < 3:
        questions.append(
            f"{len(questions) + 1}. What measurable outcome best proves your impact on {query}?"
        )
    return questions


def build_evidence_lines(evidence: list[EvidenceChunkResponse]) -> list[str]:
    if not evidence:
        return ["- No matching evidence was retrieved. State that the answer needs more source material."]

    lines: list[str] = []
    for index, item in enumerate(evidence[:4], start=1):
        location_bits: list[str] = []
        if item.section_title:
            location_bits.append(item.section_title)
        if item.page_number is not None:
            location_bits.append(f"page {item.page_number}")
        location = f" ({', '.join(location_bits)})" if location_bits else ""
        lines.append(
            f"- [E{index}] {item.source_label}{location}: {summarize_content(item.content, limit=180)}"
        )
    return lines


def infer_gap_statement(query: str, evidence: list[EvidenceChunkResponse]) -> str:
    if not evidence:
        return f"No retrieved evidence directly supports '{query}'."

    combined_content = " ".join(item.content.lower() for item in evidence)
    for token in query.lower().split():
        normalized = token.strip(".,:;!?()[]{}")
        if len(normalized) >= 5 and normalized not in combined_content:
            return f"The retrieved evidence does not explicitly mention '{normalized}'."
    return "The retrieved evidence is relevant, but it should be backed by a concrete metric or outcome."


def pick_source_label(evidence: list[EvidenceChunkResponse], index: int) -> str:
    if not evidence:
        return "the retrieved evidence"
    return evidence[min(index, len(evidence) - 1)].source_label


def pick_content(evidence: list[EvidenceChunkResponse], index: int) -> str:
    if not evidence:
        return "No evidence was retrieved, so the answer should explicitly ask for more supporting material."
    return summarize_content(evidence[min(index, len(evidence) - 1)].content)


def summarize_content(content: str, *, limit: int = 140) -> str:
    normalized = " ".join(content.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def extract_query_line(user_prompt: str) -> str:
    for line in user_prompt.splitlines():
        if line.startswith("User request: "):
            return line.removeprefix("User request: ").strip()
    return summarize_content(user_prompt, limit=120)


def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    provider_name = settings.llm_provider.lower()

    if provider_name == "openai":
        if not settings.openai_api_key:
            raise LLMProviderError("OPENAI_API_KEY must be set when LLM_PROVIDER=openai.")
        return OpenAILLMProvider(
            api_key=settings.openai_api_key,
            default_model=settings.openai_generation_model,
            upgrade_model=settings.openai_generation_upgrade_model,
            default_temperature=settings.generation_temperature,
            default_max_output_tokens=settings.generation_max_output_tokens,
            base_url=settings.openai_base_url,
        )

    if provider_name == "deterministic":
        return DeterministicLLMProvider(
            default_temperature=settings.generation_temperature,
            default_max_output_tokens=settings.generation_max_output_tokens,
        )

    raise LLMProviderError(f"Unsupported llm provider: {settings.llm_provider}")
