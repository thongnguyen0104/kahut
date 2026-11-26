import "server-only";
import type { Quiz } from "../game/types";
import { tokenMatches } from "../tokens";
import { HttpError } from "./http";
import { getAdminClient } from "./supabase";

export interface QuizRow {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  questions: Quiz["questions"];
  edit_token_hash: string;
  updated_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getQuizRow(id: string): Promise<QuizRow> {
  if (!UUID.test(id)) throw new HttpError(404, "quiz_not_found");
  const { data, error } = await getAdminClient()
    .from("quizzes")
    .select("id,title,description,cover_image_url,questions,edit_token_hash,updated_at")
    .eq("id", id)
    .maybeSingle<QuizRow>();
  if (error) throw error;
  if (!data) throw new HttpError(404, "quiz_not_found");
  return data;
}

/** Loads a quiz and checks the caller holds its edit token. */
export async function getEditableQuiz(id: string, token: string | null): Promise<QuizRow> {
  const row = await getQuizRow(id);
  if (!tokenMatches(token, row.edit_token_hash)) throw new HttpError(403, "forbidden");
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
