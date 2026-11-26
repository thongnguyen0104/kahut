import { connection } from "next/server";
import { getAdminClient } from "@/lib/server/supabase";

/** Describes a key without revealing it: its type/role and obvious copy-paste mistakes. */
function describeKey(key: string | undefined): string {
  if (!key) return "missing";
  if (key !== key.trim()) return "has-surrounding-whitespace";
  if (/^["']|["']$/.test(key)) return "has-quotes";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  const parts = key.split(".");
  if (parts.length !== 3) return "unrecognized";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return typeof payload.role === "string" ? `jwt:${payload.role}` : "jwt";
  } catch {
    return "invalid-jwt";
  }
}

function describeUrl(url: string | undefined): string {
  if (!url) return "missing";
  if (url !== url.trim()) return "has-surrounding-whitespace";
  return /^https?:\/\/[^\s/]+\/?$/.test(url) ? "ok" : "unexpected-format";
}

/**
 * Deployment self-check: GET /api/health.
 * Expected when healthy: serviceRoleKey "jwt:service_role" (or "secret"), anonKey "jwt:anon"
 * (or "publishable"), db "ok". Never returns key values.
 */
export async function GET() {
  await connection();
  const env = {
    supabaseUrl: describeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: describeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  let db = "ok";
  try {
    const { error } = await getAdminClient().from("games").select("id", { head: true, count: "exact" });
    if (error) db = `${error.code ?? "error"}: ${error.message}`;
  } catch (err) {
    db = err instanceof Error ? err.message : "error";
  }

  const ok = db === "ok";
  return Response.json({ ok, env, db }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
