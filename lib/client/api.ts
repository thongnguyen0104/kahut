import { syncClock } from "./clock";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    /** Technical detail; the server only sends it on superadmin-only routes. */
    public detail?: string,
  ) {
    super(code);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

/** JSON fetch against our API. Throws ApiError with a translatable code. */
export async function api<T>(path: string, { method = "GET", body, token }: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  const sentAt = Date.now();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", 0);
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new ApiError(
      typeof data?.error === "string" ? data.error : "server_error",
      res.status,
      typeof data?.detail === "string" ? data.detail : undefined,
    );
  }

  const view = data?.view as { serverNow?: unknown } | undefined;
  const now = typeof data?.serverNow === "number" ? data.serverNow : view?.serverNow;
  if (typeof now === "number") syncClock(now, sentAt, Date.now());

  return data as T;
}

/** Keeps only digits, max 6 (what a PIN looks like). */
export function cleanPin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function errorCode(err: unknown): string {
  return err instanceof ApiError ? err.code : "server_error";
}

export function errorDetail(err: unknown): string | null {
  return err instanceof ApiError ? (err.detail ?? null) : null;
}
