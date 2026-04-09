import type { CandidateGeneratedReportBase, DocumentType, ReportType } from "@/lib/api/types";

const DEFAULT_JOB_DESCRIPTION_KEY = "hirelense.candidate.default-job-description";
const WORKSPACE_STATE_KEY = "hirelense.candidate.workspace";

type CandidateWorkspaceState = {
  query: string;
  selectedDocumentTypes: DocumentType[];
  selectedDocumentIds: number[];
  result: CandidateGeneratedReportBase | null;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function buildWorkspaceStorageKey(userId: number, reportType: ReportType) {
  return `${WORKSPACE_STATE_KEY}:${userId}:${reportType}`;
}

function buildDefaultJobDescriptionStorageKey(userId: number) {
  return `${DEFAULT_JOB_DESCRIPTION_KEY}:${userId}`;
}

export function readCandidateWorkspaceState<T extends CandidateGeneratedReportBase>(userId: number, reportType: ReportType) {
  if (!hasWindow()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(buildWorkspaceStorageKey(userId, reportType));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as CandidateWorkspaceState & { result: T | null };
  } catch {
    window.localStorage.removeItem(buildWorkspaceStorageKey(userId, reportType));
    return null;
  }
}

export function writeCandidateWorkspaceState<T extends CandidateGeneratedReportBase>(
  userId: number,
  reportType: ReportType,
  state: {
    query: string;
    selectedDocumentTypes: DocumentType[];
    selectedDocumentIds: number[];
    result: T | null;
  },
) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(buildWorkspaceStorageKey(userId, reportType), JSON.stringify(state));
}

export function clearCandidateWorkspaceState(userId: number, reportType: ReportType) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(buildWorkspaceStorageKey(userId, reportType));
}

export function readDefaultCandidateJobDescriptionId(userId: number) {
  if (!hasWindow()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(buildDefaultJobDescriptionStorageKey(userId));
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function writeDefaultCandidateJobDescriptionId(userId: number, documentId: number) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(buildDefaultJobDescriptionStorageKey(userId), String(documentId));
}
