import { findQuizProblems, sanitizeQuiz } from "@/lib/game/validate";
import { HttpError, bearerToken, check, handle, json, readJson } from "@/lib/server/http";
import { getEditableQuiz, rowToQuiz, type QuizRow } from "@/lib/server/quizzes";
import { getAdminClient, imageUrlPrefix } from "@/lib/server/supabase";

export async function GET(req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getEditableQuiz(id, bearerToken(req));
    const quiz = rowToQuiz(row);
    return json({ quiz, problems: findQuizProblems(quiz) });
  });
}

/** Saves the whole quiz (title, cover, questions) in one atomic update. */
export async function PUT(req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    await getEditableQuiz(id, bearerToken(req));

    const content = sanitizeQuiz(await readJson(req), imageUrlPrefix());
    if (!content) throw new HttpError(400, "bad_request");

    const row = check(
      await getAdminClient()
        .from("quizzes")
        .update({
          title: content.title,
          description: content.description,
          cover_image_url: content.coverImageUrl,
          questions: content.questions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id,title,description,cover_image_url,questions,edit_token_hash,updated_at")
        .single(),
    ) as QuizRow;

    const quiz = rowToQuiz(row);
    return json({ quiz, problems: findQuizProblems(quiz) });
  });
}
