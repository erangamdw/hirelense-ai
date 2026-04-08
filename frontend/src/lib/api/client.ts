import { createApiUrl } from "@/lib/config";
import type { ApiErrorPayload } from "@/lib/api/types";

type ApiRequestOptions = RequestInit & {
  accessToken?: string | null;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

function stringifyValidationPath(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }
  const path = value
    .map((segment) => String(segment))
    .filter((segment) => segment !== "body");
  return path.length ? path.join(".") : "";
}

function getErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const firstItem = detail[0];
    if (typeof firstItem === "string") {
      return firstItem;
    }
    if (firstItem && typeof firstItem === "object") {
      const item = firstItem as { msg?: unknown; loc?: unknown };
      const message = typeof item.msg === "string" ? item.msg : null;
      const path = stringifyValidationPath(item.loc);
      if (message && path) {
        return `${path}: ${message}`;
      }
      if (message) {
        return message;
      }
    }
    return "The request was invalid.";
  }

  if (detail && typeof detail === "object") {
    const maybeMessage = (detail as { message?: unknown; error?: unknown; detail?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
    const maybeError = (detail as { message?: unknown; error?: unknown; detail?: unknown }).error;
    if (typeof maybeError === "string") {
      return maybeError;
    }
    const nestedDetail = (detail as { message?: unknown; error?: unknown; detail?: unknown }).detail;
    if (typeof nestedDetail === "string") {
      return nestedDetail;
    }
  }

  return null;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (!(body instanceof FormData) && body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(createApiUrl(path), {
    ...rest,
    body,
    headers: requestHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await parseJsonSafely<ApiErrorPayload>(response);
    const detail = getErrorDetail(payload?.detail);
    throw new ApiError(
      response.status,
      detail || `Request failed with status ${response.status}.`,
    );
  }

  const payload = await parseJsonSafely<T>(response);
  if (payload === null) {
    throw new ApiError(response.status, "The API returned an empty response.");
  }

  return payload;
}
