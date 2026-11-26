import { ANSWER_GRACE_MS, EARLY_TOLERANCE_MS } from "@/lib/config";
import { computePoints, isAnswerCorrect, parseSubmittedAnswer } from "@/lib/game/scoring";
import { HttpError, bearerToken, handle, json, readJson } from "@/lib/server/http";
import { getGameByPin, getPlayerByToken } from "@/lib/server/games";
import { broadcast } from "@/lib/server/realtime";
import { getAdminClient } from "@/lib/server/supabase";

/**
 * Records a player's answer. Timing and scoring are decided here, on the server.
 * The result is not returned: players learn it at reveal, like everyone else.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[pin]/answer">) {
  const receivedAt = Date.now();
  return handle(async () => {
    const { pin } = await ctx.params;
    const body = await readJson(req);

    const game = await getGameByPin(pin);
    const player = await getPlayerByToken(game, bearerToken(req));

    const index = game.current_question_index;
    if (game.status !== "question" || body.questionIndex !== index || !game.question_started_at) {
      throw new HttpError(409, "question_closed");
    }
    const question = game.quiz_snapshot.questions[index];
    const startedAt = Date.parse(game.question_started_at);
    const limitMs = question.timeLimitSec * 1000;

    if (receivedAt < startedAt - EARLY_TOLERANCE_MS) throw new HttpError(409, "too_early");
    if (receivedAt > startedAt + limitMs + ANSWER_GRACE_MS) {
      throw new HttpError(409, "question_closed");
    }

    const answer = parseSubmittedAnswer(question, body);
    if (!answer) throw new HttpError(400, "bad_answer");

    const responseMs = Math.min(limitMs, Math.max(0, receivedAt - startedAt));
    const correct = isAnswerCorrect(question, answer);
    const points = computePoints({
      correct,
      responseMs,
      timeLimitMs: limitMs,
      multiplier: question.pointsMultiplier,
    });

    const db = getAdminClient();
    const { error } = await db.from("answers").insert({
      game_id: game.id,
      player_id: player.id,
      question_index: index,
      answer,
      is_correct: correct,
      points,
      response_ms: responseMs,
    });
    if (error?.code === "23505") throw new HttpError(409, "already_answered");
    if (error) throw error;

    const { count } = await db
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .eq("question_index", index);

    await broadcast(pin, "answer_count", {
      questionIndex: index,
      playerId: player.id,
      count: count ?? 0,
    });

    return json({ ok: true, serverNow: Date.now() });
  });
}
