export type UserRole = "candidate" | "recruiter" | "admin";

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

export type RecruiterRecentReport = {
  id: number;
  title: string;
  report_type: string;
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
