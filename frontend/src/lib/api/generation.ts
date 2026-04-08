import { apiFetch } from "@/lib/api/client";
import type {
  CandidateAnswerGuidanceResult,
  CandidateGenerationPayload,
  CandidateInterviewQuestionsResult,
  CandidateSkillGapAnalysisResult,
  CandidateStarAnswerResult,
} from "@/lib/api/types";

function buildCandidateGenerationBody(payload: CandidateGenerationPayload) {
  return {
    query: payload.query,
    document_types: payload.documentTypes,
    top_k: payload.topK,
    score_threshold: payload.scoreThreshold,
    model_override: payload.modelOverride,
    use_upgrade_model: payload.useUpgradeModel,
    temperature: payload.temperature,
    max_output_tokens: payload.maxOutputTokens,
  };
}

export function generateCandidateInterviewQuestions(
  accessToken: string,
  payload: CandidateGenerationPayload,
) {
  return apiFetch<CandidateInterviewQuestionsResult>("/rag/candidate/interview-questions", {
    method: "POST",
    accessToken,
    body: JSON.stringify(buildCandidateGenerationBody(payload)),
  });
}

export function generateCandidateAnswerGuidance(
  accessToken: string,
  payload: CandidateGenerationPayload,
) {
  return apiFetch<CandidateAnswerGuidanceResult>("/rag/candidate/answer-guidance", {
    method: "POST",
    accessToken,
    body: JSON.stringify(buildCandidateGenerationBody(payload)),
  });
}

export function generateCandidateStarAnswer(
  accessToken: string,
  payload: CandidateGenerationPayload,
) {
  return apiFetch<CandidateStarAnswerResult>("/rag/candidate/star-answer", {
    method: "POST",
    accessToken,
    body: JSON.stringify(buildCandidateGenerationBody(payload)),
  });
}

export function generateCandidateSkillGapAnalysis(
  accessToken: string,
  payload: CandidateGenerationPayload,
) {
  return apiFetch<CandidateSkillGapAnalysisResult>("/rag/candidate/skill-gap-analysis", {
    method: "POST",
    accessToken,
    body: JSON.stringify(buildCandidateGenerationBody(payload)),
  });
}
