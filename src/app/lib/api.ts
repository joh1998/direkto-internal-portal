// ── Direkto Admin API Client ──────────────────────────────────
// Thin wrapper around fetch for the backend at /api/v1
// In production, set VITE_API_URL to the full backend URL (e.g. https://direkto-backend-production.up.railway.app/api/v1)

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    const msg =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as Record<string, unknown>).message)
        : statusText;
    super(msg);
    this.name = 'ApiError';
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem('direkto_access_token');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('direkto_access_token', access);
  localStorage.setItem('direkto_refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('direkto_access_token');
  localStorage.removeItem('direkto_refresh_token');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('direkto_refresh_token');
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store' as RequestCache,
  });

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, res.statusText, body);
  }

  return body as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) =>
    request<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),

  /** Upload a single file via multipart/form-data */
  uploadFile: async (file: File, folder: string = 'uploads'): Promise<{ url: string; key: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/admin/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, res.statusText, body);
    return body.data;
  },

  /** Upload multiple files via multipart/form-data */
  uploadFiles: async (files: File[], folder: string = 'uploads'): Promise<{ url: string; key: string }[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/admin/upload/multiple?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, res.statusText, body);
    return body.data;
  },
};
