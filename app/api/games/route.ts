import { findQuizProblems } from "@/lib/game/validate";
import { HttpError, bearerToken, handle, json, readJson } from "@/lib/server/http";
import { getEditableQuiz, rowToQuiz } from "@/lib/server/quizzes";
import { getAdminClient } from "@/lib/server/supabase";
import { generatePin, generateToken, hashToken } from "@/lib/tokens";

const STALE_GAME_HOURS = 12;

/** Starts a new game room for a quiz (needs the quiz edit token). */
export async function POST(req: Request) {
  return handle(async () => {
    const { quizId } = await readJson(req);
    if (typeof quizId !== "string") throw new HttpError(400, "bad_request");

    const quiz = rowToQuiz(await getEditableQuiz(quizId, bearerToken(req)));
    if (findQuizProblems(quiz).length > 0) throw new HttpError(422, "quiz_not_playable");

    const db = getAdminClient();

    // Free PINs held by abandoned games.
    const staleBefore = new Date(Date.now() - STALE_GAME_HOURS * 3600_000).toISOString();
    await db
      .from("games")
      .update({ status: "finished", ended_at: new Date().toISOString() })
      .neq("status", "finished")
      .lt("created_at", staleBefore);

    const hostToken = generateToken();
    const snapshot = {
      title: quiz.title,
      description: quiz.description,
      coverImageUrl: quiz.coverImageUrl,
      questions: quiz.questions,
    };

    for (let attempt = 0; attempt < 10; attempt++) {
      const pin = generatePin();
      const { error } = await db.from("games").insert({
        pin,
        quiz_id: quiz.id,
        quiz_snapshot: snapshot,
        host_token_hash: hashToken(hostToken),
      });
      if (!error) return json({ pin, hostToken }, 201);
      if (error.code !== "23505") throw error; // anything but "PIN already in use"
    }
    throw new HttpError(503, "no_pin_available");
  });
}
