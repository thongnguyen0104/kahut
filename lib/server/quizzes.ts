import "server-only";
import type { Quiz } from "../game/types";
import type { AuthUser } from "./auth";
import { HttpError } from "./http";
import { getAdminClient } from "./supabase";

export interface QuizRow {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  questions: Quiz["questions"];
  owner_id: string | null;
  owner_email: string | null;
  updated_at: string;
}

export const QUIZ_COLUMNS =
  "id,title,description,cover_image_url,questions,owner_id,owner_email,updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getQuizRow(id: string): Promise<QuizRow> {
  if (!UUID.test(id)) throw new HttpError(404, "quiz_not_found");
  const { data, error } = await getAdminClient()
    .from("quizzes")
    .select(QUIZ_COLUMNS)
    .eq("id", id)
    .maybeSingle<QuizRow>();
  if (error) throw error;
  if (!data) throw new HttpError(404, "quiz_not_found");
  return data;
}

/** Loads a quiz the account may edit: its own, or any quiz for a superadmin. */
export async function getOwnedQuiz(id: string, user: AuthUser): Promise<QuizRow> {
  const row = await getQuizRow(id);
  if (row.owner_id !== user.id && !user.isSuperadmin) throw new HttpError(403, "forbidden");
  return row;
}

export function rowToQuiz(row: QuizRow): Quiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    questions: row.questions,
    updatedAt: row.updated_at,
  };
}
