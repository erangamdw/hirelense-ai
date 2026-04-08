const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export const appConfig = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || DEFAULT_API_BASE_URL,
};

export function createApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appConfig.apiBaseUrl}${normalizedPath}`;
}
