import { ApiError } from "./errors";

const API_BASE = "/api/v1";
export const CSRF_COOKIE = "ib_csrf";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const entry of document.cookie.split(";")) {
    const [key, ...rest] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function buildQuery(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { preserveEnvelope?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const csrfToken = readCookie(CSRF_COOKIE);
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      body?.error?.code ?? "HTTP_ERROR",
      body?.error?.message ?? response.statusText,
      response.status,
      body?.error?.details,
    );
  }

  const envelope = payload as { data?: T } | null;
  if (options.preserveEnvelope) return payload as T;
  return (envelope?.data ?? payload) as T;
}
