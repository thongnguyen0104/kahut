import { connection } from "next/server";
import { IMAGE_BUCKET } from "@/lib/config";
import { geminiConfigured, geminiModels } from "@/lib/server/gemini";
import { getAdminClient } from "@/lib/server/supabase";
import { normalizeSupabaseUrl } from "@/lib/supabaseUrl";

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
  const normalized = normalizeSupabaseUrl(url);
  if (!/^https?:\/\/[^\s/]+$/.test(normalized)) return "unexpected-format";
  return normalized === url ? "ok" : "auto-corrected (remove the path/slash after .supabase.co in Vercel)";
}

async function check(fn: () => Promise<string | null>): Promise<string> {
  try {
    return (await fn()) ?? "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "error";
  }
}

/**
 * Deployment self-check: GET /api/health. Never returns key values.
 * Healthy: anonKey "jwt:anon" (or "publishable"), serviceRoleKey "jwt:service_role"
 * (or "secret"), and db / storage / realtime all "ok".
 */
export async function GET() {
  await connection();
  const env = {
    supabaseUrl: describeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: describeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    // Optional (AI quiz generation). Not called here, to save the free daily quota.
    geminiKey: geminiConfigured() ? "configured" : "missing (AI quiz generation off)",
    geminiModels: geminiModels().join(" → "),
  };

  const [db, storage, realtime] = await Promise.all([
    // A real GET: HEAD requests hide 404s in supabase-js.
    check(async () => {
      const { error } = await getAdminClient().from("games").select("id").limit(1);
      return error ? `${error.code ?? "error"}: ${error.message}` : null;
    }),
    check(async () => {
      const { error } = await getAdminClient().storage.getBucket(IMAGE_BUCKET);
      return error ? `bucket "${IMAGE_BUCKET}": ${error.message}` : null;
    }),
    check(async () => {
      const supabase = getAdminClient();
      const channel = supabase.channel("health-check");
      try {
        const res = await channel.httpSend("ping", { at: Date.now() });
        return res.success ? null : `${res.status}: ${res.error}`;
      } finally {
        await supabase.removeChannel(channel);
      }
    }),
  ]);

  // Accounts must only come from a superadmin: public sign-up has to be off in Supabase.
  const signups = await check(async () => {
    const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      cache: "no-store",
    });
    const settings = (await res.json()) as { disable_signup?: boolean };
    return settings.disable_signup
      ? null
      : "WARNING: public sign-up is ON. Turn off 'Allow new users to sign up' in Supabase → Authentication.";
  });

  const ok = db === "ok" && storage === "ok" && realtime === "ok";
  return Response.json(
    { ok, env, db, storage, realtime, signups: signups === "ok" ? "disabled (ok)" : signups },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
