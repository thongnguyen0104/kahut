/**
 * Returns the bare project URL even if it was pasted with quotes, spaces, a
 * trailing slash or an API path such as ".../rest/v1/" (the "RESTful endpoint"
 * shown in the Supabase dashboard). supabase-js appends "rest/v1", "realtime/v1"
 * and "storage/v1" itself, so any path here would break every request.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime|graphql)\/v1$/i, "")
    .replace(/\/+$/, "");
}
