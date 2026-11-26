import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "../supabaseUrl";

let client: SupabaseClient | null = null;

/**
 * Browser client with the public anon key. Used for sign-in (the session is kept
 * in localStorage), Realtime channels and signed-URL image uploads — never to
 * read tables directly.
 */
export function getBrowserClient(): SupabaseClient {
  if (!client) {
    const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}
