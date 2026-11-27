import { aiOutputToQuiz, buildPrompt, buildQuizSchema, parseGenerateInput } from "@/lib/ai/quizGen";
import { requireSuperadmin } from "@/lib/server/auth";
import { generateJson } from "@/lib/server/gemini";
import { HttpError, check, handle, json, readJson } from "@/lib/server/http";
import { getOwnedQuiz } from "@/lib/server/quizzes";
import { getAdminClient } from "@/lib/server/supabase";

/** A Gemini call takes ~10–40s; the default function timeout may be shorter. */
export const maxDuration = 60;

/**
 * Generates questions with Gemini (superadmin only).
 * - Without `quizId`: creates a new quiz from them → `{ id, generated, requested }`.
 * - With `quizId`: only returns them for the editor to append (nothing is saved here)
 *   → `{ title, description, questions, generated, requested }`.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireSuperadmin(req);
    const body = await readJson(req);

    const parsed = parseGenerateInput(body);
    if ("error" in parsed) throw new HttpError(400, parsed.error);
    const { input } = parsed;

    const quizId = typeof body.quizId === "string" ? body.quizId : null;
    if (quizId) await getOwnedQuiz(quizId, user);

    const { system, user: userText } = buildPrompt(input);
    const quiz = aiOutputToQuiz(await generateJson(system, userText, buildQuizSchema(input)), input);
    if (quiz.questions.length === 0) throw new HttpError(502, "ai_empty");

    const counts = { generated: quiz.questions.length, requested: input.count };
    if (quizId) return json({ ...quiz, ...counts });

    const row = check(
      await getAdminClient()
        .from("quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          owner_id: user.id,
          owner_email: user.email,
        })
        .select("id")
        .single(),
    ) as { id: string };
    return json({ id: row.id, ...counts }, 201);
  });
}
