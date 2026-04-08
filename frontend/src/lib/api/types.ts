export type UserRole = "candidate" | "recruiter" | "admin";
export type DocumentType =
  | "cv"
  | "job_description"
  | "project_notes"
  | "interview_feedback"
  | "recruiter_candidate_cv";
export type DocumentProcessingStatus = "pending" | "succeeded" | "failed";
export type ReportType =
  | "candidate_interview_questions"
  | "candidate_answer_guidance"
  | "candidate_star_answer"
  | "candidate_skill_gap_analysis"
  | "recruiter_fit_summary"
  | "recruiter_interview_pack";

export type ApiErrorPayload = {
  detail?: string;
};

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name?: string;
  role: UserRole;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type CandidateDashboardSummary = {
  user_id: number;
  email: string;
  full_name: string | null;
  has_profile: boolean;
  target_roles: string[];
  uploaded_document_count: number;
  saved_report_count: number;
  latest_interview_sessions: string[];
};

export type CandidateProfilePayload = {
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  years_experience?: number | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  target_roles: string[];
};

export type CandidateProfile = CandidateProfilePayload & {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
};

export type CandidateDocument = {
  id: number;
  owner_user_id: number;
  recruiter_job_id: number | null;
  recruiter_candidate_id: number | null;
  document_type: DocumentType;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  parsed_text: string | null;
  parsing_status: DocumentProcessingStatus;
  parsing_error: string | null;
  parsed_at: string | null;
  indexing_status: DocumentProcessingStatus;
  indexing_error: string | null;
  indexed_at: string | null;
  created_at: string;
};

export type EvidenceChunk = {
  chunk_id: number;
  document_id: number;
  chunk_index: number;
  document_type: DocumentType;
  source_label: string;
  owner_role: string;
  owner_user_id: number;
  recruiter_job_id: number | null;
  recruiter_candidate_id: number | null;
  section_title: string | null;
  page_number: number | null;
  content: string;
  relevance_score: number;
  distance: number;
  score_note: string;
};

export type CandidateGenerationPayload = {
  query: string;
  documentTypes?: DocumentType[];
  topK?: number;
  scoreThreshold?: number;
  modelOverride?: string;
  useUpgradeModel?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
};

export type CandidateGeneratedReportBase = {
  query: string;
  provider: string;
  model: string;
  temperature: number;
  max_output_tokens: number;
  applied_document_types: DocumentType[];
  evidence_count: number;
  evidence: EvidenceChunk[];
};

export type CandidateInterviewQuestion = {
  category: string;
  question: string;
  rationale: string;
  evidence_chunk_ids: number[];
};

export type CandidateInterviewQuestionsResult = CandidateGeneratedReportBase & {
  overview: string;
  questions: CandidateInterviewQuestion[];
};

export type CandidateAnswerGuidanceResult = CandidateGeneratedReportBase & {
  answer_draft: string;
  opening_answer: string;
  talking_points: string[];
  stronger_version_tip: string;
  follow_up_questions: string[];
};

export type CandidateStarSection = {
  content: string;
  evidence_chunk_ids: number[];
};

export type CandidateStarAnswerResult = CandidateGeneratedReportBase & {
  editable_draft: string;
  situation: CandidateStarSection;
  task: CandidateStarSection;
  action: CandidateStarSection;
  result: CandidateStarSection;
  missing_signals: string[];
};

export type CandidateStrengthSignal = {
  title: string;
  summary: string;
  evidence_chunk_ids: number[];
};

export type SkillGapSeverity = "low" | "medium" | "high";

export type CandidateSkillGapItem = {
  skill_area: string;
  severity: SkillGapSeverity;
  summary: string;
  recommendation: string;
  evidence_chunk_ids: number[];
};

export type CandidateSkillGapAnalysisResult = CandidateGeneratedReportBase & {
  analysis_summary: string;
  strengths: CandidateStrengthSignal[];
  missing_signals: CandidateSkillGapItem[];
  improvement_actions: string[];
};

export type SavedReportListItem = {
  id: number;
  owner_user_id: number;
  recruiter_job_id: number | null;
  recruiter_candidate_id: number | null;
  owner_role: UserRole;
  report_type: ReportType;
  title: string;
  query: string;
  payload_version: number;
  created_at: string;
};

export type SavedReportHistory = {
  total: number;
  items: SavedReportListItem[];
};

export type SavedReport = SavedReportListItem & {
  payload: Record<string, unknown>;
};

export type RecruiterRecentReport = {
  id: number;
  title: string;
  report_type: ReportType;
  recruiter_job_id: number | null;
  recruiter_candidate_id: number | null;
  created_at: string;
};

export type RecruiterDashboardSummary = {
  user_id: number;
  email: string;
  full_name: string | null;
  jobs_count: number;
  candidate_count: number;
  candidate_document_count: number;
  report_count: number;
  recent_reports: RecruiterRecentReport[];
  recent_candidate_names: string[];
};

export type RecruiterJobPayload = {
  title: string;
  description: string;
  seniority?: string | null;
  location?: string | null;
  skills_required: string[];
};

export type RecruiterCandidatePayload = {
  full_name: string;
  email?: string | null;
  current_title?: string | null;
  notes?: string | null;
};

export type RecruiterCandidate = {
  id: number;
  recruiter_user_id: number;
  job_id: number;
  full_name: string;
  email: string | null;
  current_title: string | null;
  notes: string | null;
  document_count: number;
  created_at: string;
  updated_at: string;
};

export type RecruiterJobListItem = {
  id: number;
  recruiter_user_id: number;
  title: string;
  description: string;
  seniority: string | null;
  location: string | null;
  skills_required: string[];
  candidate_count: number;
  linked_document_count: number;
  created_at: string;
  updated_at: string;
};

export type RecruiterJobDetail = RecruiterJobListItem & {
  candidates: RecruiterCandidate[];
};

export type RecruiterJobList = {
  total: number;
  items: RecruiterJobListItem[];
};

export type RecruiterJobReviewCandidate = {
  id: number;
  full_name: string;
  current_title: string | null;
  notes: string | null;
  document_count: number;
  report_count: number;
  latest_report_title: string | null;
  latest_report_type: ReportType | null;
  latest_report_created_at: string | null;
};

export type RecruiterJobReview = {
  job_id: number;
  title: string;
  description: string;
  seniority: string | null;
  location: string | null;
  skills_required: string[];
  job_document_count: number;
  candidate_count: number;
  report_count: number;
  latest_report_title: string | null;
  latest_report_type: ReportType | null;
  latest_report_created_at: string | null;
  candidates: RecruiterJobReviewCandidate[];
};

export type RecruiterCandidateReview = {
  candidate_id: number;
  job_id: number;
  full_name: string;
  email: string | null;
  current_title: string | null;
  notes: string | null;
  document_count: number;
  document_types: string[];
  report_count: number;
  latest_report_title: string | null;
  latest_report_type: ReportType | null;
  latest_report_created_at: string | null;
  report_history: RecruiterRecentReport[];
};
