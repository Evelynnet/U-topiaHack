import type { Dictionary } from "@/i18n/dictionaries/th";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** Small fetch wrapper: JSON in/out, throws ApiError with the server's error code. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const isJsonBody = init.body !== undefined && !(init.body instanceof FormData);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: isJsonBody ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError(0, "generic");
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "generic");
  return data as T;
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function errorMessage(t: Dictionary, err: unknown): string {
  const code = err instanceof ApiError ? err.code : "generic";
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}
