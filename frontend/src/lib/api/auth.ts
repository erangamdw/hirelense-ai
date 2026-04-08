import { apiFetch } from "@/lib/api/client";
import type { AuthResponse, CurrentUser, LoginPayload, RegisterPayload } from "@/lib/api/types";

export function registerUser(payload: RegisterPayload) {
  return apiFetch<CurrentUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(accessToken: string) {
  return apiFetch<CurrentUser>("/auth/me", {
    method: "GET",
    accessToken,
  });
}
