import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_BUCKET, MAX_PLAYERS_DEFAULT } from "../config";

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: only ever use it on the server. */
export function getAdminClient(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
      );
    }
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Only images from our own bucket are accepted in quizzes. */
export function imageUrlPrefix(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}

export function maxPlayers(): number {
  const n = Number(process.env.MAX_PLAYERS);
  return Number.isInteger(n) && n > 0 ? n : MAX_PLAYERS_DEFAULT;
}
