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
    throw new ApiError(
      response.status,
      payload?.detail || `Request failed with status ${response.status}.`,
    );
  }

  const payload = await parseJsonSafely<T>(response);
  if (payload === null) {
    throw new ApiError(response.status, "The API returned an empty response.");
  }

  return payload;
}
