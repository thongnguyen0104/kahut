import { READ_TIME_MS } from "@/lib/config";
import { HOST_ACTIONS, planTransition, type HostAction } from "@/lib/game/transitions";
import type { GameRow } from "@/lib/game/view";
import { HttpError, bearerToken, check, handle, json, readJson } from "@/lib/server/http";
import { assertHost, getGameByPin, loadGameView } from "@/lib/server/games";
import { broadcast } from "@/lib/server/realtime";
import { getAdminClient } from "@/lib/server/supabase";

/**
 * Host commands: start / reveal / leaderboard / next / end / kick.
 * Every transition is a conditional update on the current position, so a
 * repeated or stale command is a no-op that just returns the current state.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[pin]/control">) {
  return handle(async () => {
    const { pin } = await ctx.params;
    const body = await readJson(req);
    const game = await getGameByPin(pin);
    assertHost(game, bearerToken(req));
    const db = getAdminClient();

    if (body.action === "kick") {
      if (typeof body.playerId !== "string") throw new HttpError(400, "bad_request");
      check(
        await db
          .from("players")
          .update({ kicked: true })
          .eq("id", body.playerId)
          .eq("game_id", game.id),
      );
      await broadcast(pin, "player_kicked", { playerId: body.playerId });
      return json({ changed: true });
    }

    if (!HOST_ACTIONS.includes(body.action as HostAction)) throw new HttpError(400, "bad_request");
    const action = body.action as HostAction;

    const plan = planTransition(
      { status: game.status, questionIndex: game.current_question_index },
      action,
      game.quiz_snapshot.questions.length,
    );
    if (!plan.ok) {
      if (plan.error === "no_questions") throw new HttpError(422, "quiz_not_playable");
      return json({ changed: false, view: await loadGameView(game) });
    }

    let updated: GameRow | null = null;

    if (plan.to.status === "reveal") {
      const changed = check(
        await db.rpc("reveal_question", { p_game_id: game.id, p_index: plan.from.questionIndex }),
      ) as boolean;
      if (changed) updated = { ...game, status: "reveal" };
    } else {
      const now = Date.now();
      const patch: Record<string, unknown> = {
        status: plan.to.status,
        current_question_index: plan.to.questionIndex,
      };
      if (plan.to.status === "question") {
        patch.question_started_at = new Date(now + READ_TIME_MS).toISOString();
      }
      if (plan.to.status === "finished") patch.ended_at = new Date(now).toISOString();

      const rows = check(
        await db
          .from("games")
          .update(patch)
          .eq("id", game.id)
          .eq("status", plan.from.status)
          .eq("current_question_index", plan.from.questionIndex)
          .select("question_started_at"),
      ) as Pick<GameRow, "question_started_at">[];

      if (rows.length > 0) {
        updated = {
          ...game,
          status: plan.to.status,
          current_question_index: plan.to.questionIndex,
          question_started_at: rows[0].question_started_at,
        };
      }
    }

    if (!updated) {
      // Someone else (another tab, a retry) already moved the game.
      return json({ changed: false, view: await loadGameView(await getGameByPin(pin)) });
    }

    const view = await loadGameView(updated);
    await broadcast(pin, "state_changed", view);
    return json({ changed: true, view });
  });
}
