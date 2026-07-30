export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_SHARED_SECRET = process.env.NEXT_PUBLIC_API_SHARED_SECRET;

// Local-disk uploads come back as a relative "/uploads/..." path (served by the backend);
// S3 uploads come back as an already-absolute URL. Only the former needs API_BASE_URL prepended.
export function resolveFileUrl(fileUrl: string): string {
  return fileUrl.startsWith("http://") || fileUrl.startsWith("https://") ? fileUrl : `${API_BASE_URL}${fileUrl}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_SHARED_SECRET ? { "x-app-secret": API_SHARED_SECRET } : {}),
      ...options.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    headers: API_SHARED_SECRET ? { "x-app-secret": API_SHARED_SECRET } : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || res.statusText, res.status);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>(path, formData),
};

export interface HealthCheckResult {
  status: "ok" | "degraded";
  timestamp: string;
  services: {
    database: { ok: boolean; error?: string };
    redis: { ok: boolean; error?: string };
  };
}
