import "server-only";
import type { AiAttempt, AiLogView } from "../ai/logs";
import type { GenerateInput } from "../ai/quizGen";
import type { AuthUser } from "./auth";
import { HttpError } from "./http";
import { getAdminClient } from "./supabase";

/** Rows older than this are pruned when a new one is written. */
const KEEP_DAYS = 30;

interface AiLogRow {
  id: number;
  created_at: string;
  user_email: string | null;
  mode: "create" | "append";
  quiz_id: string | null;
  topic: string;
  settings: AiLogView["settings"];
  requested: number;
  received: number | null;
  generated: number | null;
  ok: boolean;
  error_code: string | null;
  error_detail: string | null;
  attempts: AiAttempt[];
  duration_ms: number;
}

export interface AiLogEntry {
  user: AuthUser;
  mode: "create" | "append";
  quizId: string | null;
  input: GenerateInput;
  ok: boolean;
  received?: number;
  generated?: number;
  errorCode?: string;
  errorDetail?: string;
  attempts: AiAttempt[];
  durationMs: number;
}

/** Best effort: a missing table or a DB hiccup must never break generation itself. */
export async function writeAiLog(entry: AiLogEntry): Promise<void> {
  try {
    const db = getAdminClient();
    const { error } = await db.from("ai_logs").insert({
      user_id: entry.user.id,
      user_email: entry.user.email,
      mode: entry.mode,
      quiz_id: entry.quizId,
      topic: entry.input.topic,
      settings: {
        types: entry.input.types,
        difficulty: entry.input.difficulty,
        language: entry.input.language,
      },
      requested: entry.input.count,
      received: entry.received ?? null,
      generated: entry.generated ?? null,
      ok: entry.ok,
      error_code: entry.errorCode ?? null,
      error_detail: entry.errorDetail ?? null,
      attempts: entry.attempts,
      duration_ms: entry.durationMs,
    });
    if (error) {
      console.error("ai_logs insert failed:", error.message);
      return;
    }
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000).toISOString();
    await db.from("ai_logs").delete().lt("created_at", cutoff);
  } catch (err) {
    console.error("ai_logs insert failed:", err);
  }
}

/** Newest first. `onlyErrors` keeps failed requests only. */
export async function listAiLogs(limit: number, onlyErrors: boolean): Promise<AiLogView[]> {
  let query = getAdminClient()
    .from("ai_logs")
    .select(
      "id,created_at,user_email,mode,quiz_id,topic,settings,requested,received,generated,ok,error_code,error_detail,attempts,duration_ms",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (onlyErrors) query = query.eq("ok", false);

  const { data, error } = await query;
  if (error) {
    // PGRST205 / 42P01: the migration creating ai_logs has not been applied yet.
    if (error.code === "PGRST205" || error.code === "42P01") {
      throw new HttpError(503, "ai_logs_missing", error.message);
    }
    throw error;
  }
  return (data as AiLogRow[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    userEmail: r.user_email,
    mode: r.mode,
    quizId: r.quiz_id,
    topic: r.topic,
    settings: r.settings,
    requested: r.requested,
    received: r.received,
    generated: r.generated,
    ok: r.ok,
    errorCode: r.error_code,
    errorDetail: r.error_detail,
    attempts: r.attempts ?? [],
    durationMs: r.duration_ms,
  }));
}
