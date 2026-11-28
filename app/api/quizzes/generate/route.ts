import type { AiAttempt } from "@/lib/ai/logs";
import { aiOutputToQuiz, buildPrompt, buildQuizSchema, parseGenerateInput, type GeneratedQuiz } from "@/lib/ai/quizGen";
import { writeAiLog } from "@/lib/server/aiLogs";
import { requireSuperadmin } from "@/lib/server/auth";
import { AiCallError, generateJson } from "@/lib/server/gemini";
import { HttpError, check, handle, json, readJson } from "@/lib/server/http";
import { getOwnedQuiz } from "@/lib/server/quizzes";
import { getAdminClient } from "@/lib/server/supabase";

/** A Gemini call takes ~10–40s; the default function timeout may be shorter. */
export const maxDuration = 60;

/**
 * Generates questions with Gemini (superadmin only). Every request that reaches the
 * model is written to ai_logs (see /admin/ai-logs); errors carry a technical `detail`.
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

    const started = Date.now();
    let attempts: AiAttempt[] = [];
    let quiz: GeneratedQuiz | null = null;
    const log = { user, mode: quizId ? ("append" as const) : ("create" as const), quizId, input };

    try {
      const { system, user: userText } = buildPrompt(input);
      const result = await generateJson(system, userText, buildQuizSchema(input));
      attempts = result.attempts;
      quiz = aiOutputToQuiz(result.data, input);
      if (quiz.questions.length === 0) {
        throw new HttpError(
          502,
          "ai_empty",
          `The model answered with ${quiz.received} questions; none passed validation.`,
        );
      }

      const counts = { generated: quiz.questions.length, requested: input.count };
      let response: Response;
      let savedQuizId = quizId;
      if (quizId) {
        const { title, description, questions } = quiz;
        response = json({ title, description, questions, ...counts });
      } else {
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
        response = json({ id: row.id, ...counts }, 201);
        savedQuizId = row.id;
      }

      await writeAiLog({
        ...log,
        quizId: savedQuizId,
        ok: true,
        received: quiz.received,
        generated: quiz.questions.length,
        attempts,
        durationMs: Date.now() - started,
      });
      return response;
    } catch (err) {
      if (err instanceof AiCallError) attempts = err.attempts;
      const code = err instanceof HttpError ? err.code : "server_error";
      // Supabase errors are plain objects with a message, not always Error instances.
      const detail =
        err instanceof HttpError
          ? err.detail
          : typeof (err as { message?: unknown })?.message === "string"
            ? (err as { message: string }).message
            : String(err);
      await writeAiLog({
        ...log,
        ok: false,
        received: quiz?.received,
        generated: quiz?.questions.length,
        errorCode: code,
        errorDetail: detail,
        attempts,
        durationMs: Date.now() - started,
      });
      // Superadmin-only route: hand the technical detail to the UI too.
      if (err instanceof HttpError) throw err;
      console.error(err);
      throw new HttpError(500, "server_error", detail);
    }
  });
}
