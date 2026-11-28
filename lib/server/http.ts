import "server-only";
import { unstable_rethrow } from "next/navigation";

/**
 * Error codes are translated on the client (messages.errors.*). `detail` is technical,
 * untranslated text sent along with the code: only use it on superadmin-only routes.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Wraps a route handler: HttpError → JSON error, anything else → 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    // Next's own control-flow errors (e.g. the build's prerender bailout on req.headers).
    unstable_rethrow(err);
    if (err instanceof HttpError) {
      return json(err.detail ? { error: err.code, detail: err.detail } : { error: err.code }, err.status);
    }
    console.error(err);
    return json({ error: "server_error" }, 500);
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, "bad_request");
}

/** Throws on a Supabase error so `handle` turns it into a 500. */
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
