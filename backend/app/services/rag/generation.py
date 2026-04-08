from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models.document import DocumentType
from app.models.user import User, UserRole
from app.schemas.generation import GroundedPromptType
from app.schemas.retrieval import EvidenceChunkResponse
from app.services.providers import LLMGenerationRequest, LLMProviderError, get_llm_provider
from app.services.rag.prompts import PromptBundle, build_grounded_prompt
from app.services.rag.retrieval import RetrievalError, RetrievalRequest, get_retriever_service, resolve_document_types


ALLOWED_PROMPT_TYPES_BY_ROLE: dict[UserRole, set[GroundedPromptType]] = {
    UserRole.CANDIDATE: {
        GroundedPromptType.CANDIDATE_INTERVIEW_QUESTIONS,
        GroundedPromptType.CANDIDATE_ANSWER_GUIDANCE,
        GroundedPromptType.STAR_ANSWER,
        GroundedPromptType.SKILL_GAP_ANALYSIS,
    },
    UserRole.RECRUITER: {
        GroundedPromptType.RECRUITER_FIT_SUMMARY,
        GroundedPromptType.RECRUITER_INTERVIEW_PACK,
    },
    UserRole.ADMIN: set(),
}


@dataclass(frozen=True)
class GroundedGenerationRequest:
    query: str
    user: User
    role: UserRole
    prompt_type: GroundedPromptType
    document_types: list[DocumentType] | None = None
    top_k: int | None = None
    score_threshold: float | None = None
    model_override: str | None = None
    use_upgrade_model: bool = False
    temperature: float | None = None
    max_output_tokens: int | None = None


@dataclass(frozen=True)
class GroundedGenerationResult:
    answer: str
    provider: str
    model: str
    temperature: float
    max_output_tokens: int
    applied_document_types: list[DocumentType]
    evidence: list[EvidenceChunkResponse]


class GroundedGenerationError(Exception):
    """Raised when grounded generation cannot be completed."""


class GroundedGenerationService(ABC):
    @abstractmethod
    def generate(self, request: GroundedGenerationRequest) -> GroundedGenerationResult:
        raise NotImplementedError


class RetrievalBackedGenerationService(GroundedGenerationService):
    def generate(self, request: GroundedGenerationRequest) -> GroundedGenerationResult:
        validate_prompt_type_for_role(role=request.role, prompt_type=request.prompt_type)
        applied_document_types = resolve_document_types(role=request.role, requested=request.document_types)
        retriever = get_retriever_service()

        try:
            evidence = retriever.retrieve(
                RetrievalRequest(
                    query=request.query,
                    user=request.user,
                    role=request.role,
                    document_types=applied_document_types,
                    top_k=request.top_k,
                    score_threshold=request.score_threshold,
                )
            )
            prompt_bundle = build_grounded_prompt(
                prompt_type=request.prompt_type,
                role=request.role,
                query=request.query,
                evidence=evidence,
            )
            llm_provider = get_llm_provider()
            generation = llm_provider.generate(
                request=build_llm_request(
                    request=request,
                    prompt_bundle=prompt_bundle,
                    evidence=evidence,
                )
            )
        except (RetrievalError, LLMProviderError) as exc:
            raise GroundedGenerationError(str(exc)) from exc
        except Exception as exc:
            raise GroundedGenerationError(str(exc) or "Unable to generate a grounded response.") from exc

        return GroundedGenerationResult(
            answer=generation.content,
            provider=generation.provider,
            model=generation.model,
            temperature=generation.temperature,
            max_output_tokens=generation.max_output_tokens,
            applied_document_types=applied_document_types,
            evidence=evidence,
        )


def build_llm_request(
    *,
    request: GroundedGenerationRequest,
    prompt_bundle: PromptBundle,
    evidence: list[EvidenceChunkResponse],
) -> LLMGenerationRequest:
    return LLMGenerationRequest(
        prompt_type=request.prompt_type,
        system_prompt=prompt_bundle.system_prompt,
        user_prompt=prompt_bundle.user_prompt,
        evidence=evidence,
        model_override=request.model_override,
        use_upgrade_model=request.use_upgrade_model,
        temperature=request.temperature,
        max_output_tokens=request.max_output_tokens,
    )


def validate_prompt_type_for_role(*, role: UserRole, prompt_type: GroundedPromptType) -> None:
    allowed = ALLOWED_PROMPT_TYPES_BY_ROLE.get(role, set())
    if prompt_type not in allowed:
        raise GroundedGenerationError(
            f"Prompt type '{prompt_type.value}' is not available for role '{role.value}'."
        )


def get_generation_service() -> GroundedGenerationService:
    return RetrievalBackedGenerationService()
