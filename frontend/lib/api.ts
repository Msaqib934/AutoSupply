export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code = "API_ERROR", status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  // Required for cookie session CSRF protection
  if (!headers.has("X-Requested-With")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const errorBody = data?.error;
    const msg = errorBody?.message || res.statusText || "Request failed";
    const code = errorBody?.code || `HTTP_${res.status}`;
    throw new ApiError(msg, code, res.status, errorBody?.details);
  }

  return data as T;
}
