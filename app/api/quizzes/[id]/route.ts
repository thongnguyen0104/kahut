import { IMAGE_BUCKET } from "@/lib/config";
import { findQuizProblems, sanitizeQuiz } from "@/lib/game/validate";
import { requireUser } from "@/lib/server/auth";
import { HttpError, check, handle, json, readJson } from "@/lib/server/http";
import { QUIZ_COLUMNS, getOwnedQuiz, rowToQuiz, type QuizRow } from "@/lib/server/quizzes";
import { getAdminClient, imageUrlPrefix } from "@/lib/server/supabase";

export async function GET(req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getOwnedQuiz(id, await requireUser(req));
    const quiz = rowToQuiz(row);
    return json({ quiz, problems: findQuizProblems(quiz) });
  });
}

/** Saves the whole quiz (title, cover, questions) in one atomic update. */
export async function PUT(req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    await getOwnedQuiz(id, await requireUser(req));

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
        .select(QUIZ_COLUMNS)
        .single(),
    ) as QuizRow;

    const quiz = rowToQuiz(row);
    return json({ quiz, problems: findQuizProblems(quiz) });
  });
}

/** Deletes a quiz and its images. Games already played keep their own snapshot. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    await getOwnedQuiz(id, await requireUser(req));
    const db = getAdminClient();
    check(await db.from("quizzes").delete().eq("id", id));

    // Best effort: an orphaned image is harmless.
    const storage = db.storage.from(IMAGE_BUCKET);
    const { data: files } = await storage.list(id, { limit: 1000 });
    if (files?.length) await storage.remove(files.map((f) => `${id}/${f.name}`));

    return json({ ok: true });
  });
}
