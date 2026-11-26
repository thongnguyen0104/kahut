import "server-only";
import type { GameView } from "../game/types";
import { buildGameView, type AnswerRow, type GameRow, type PlayerRow } from "../game/view";
import { hashToken, tokenMatches } from "../tokens";
import { HttpError, check } from "./http";
import { getAdminClient } from "./supabase";

const GAME_COLUMNS =
  "id,pin,quiz_id,quiz_snapshot,host_token_hash,status,current_question_index,question_started_at,created_at";
const PLAYER_COLUMNS = "id,game_id,nickname,avatar,score,streak,kicked,joined_at";

/** Latest game with this PIN (a running one always wins over finished ones). */
export async function getGameByPin(pin: string): Promise<GameRow> {
  if (!/^\d{6}$/.test(pin)) throw new HttpError(404, "game_not_found");
  const rows = check(
    await getAdminClient()
      .from("games")
      .select(GAME_COLUMNS)
      .eq("pin", pin)
      .order("created_at", { ascending: false })
      .limit(5),
  ) as GameRow[];
  const game = rows.find((g) => g.status !== "finished") ?? rows[0];
  if (!game) throw new HttpError(404, "game_not_found");
  return game;
}

export function assertHost(game: GameRow, token: string | null): void {
  if (!tokenMatches(token, game.host_token_hash)) throw new HttpError(403, "forbidden");
}

export async function getPlayerByToken(game: GameRow, token: string | null): Promise<PlayerRow> {
  if (!token) throw new HttpError(401, "unauthorized");
  const player = check(
    await getAdminClient()
      .from("players")
      .select(PLAYER_COLUMNS)
      .eq("game_id", game.id)
      .eq("token_hash", hashToken(token))
      .maybeSingle(),
  ) as PlayerRow | null;
  if (!player) throw new HttpError(401, "unauthorized");
  if (player.kicked) throw new HttpError(403, "kicked");
  return player;
}

export async function listPlayers(gameId: string): Promise<PlayerRow[]> {
  return check(
    await getAdminClient().from("players").select(PLAYER_COLUMNS).eq("game_id", gameId),
  ) as PlayerRow[];
}

export async function listAnswers(gameId: string, questionIndex: number): Promise<AnswerRow[]> {
  if (questionIndex < 0) return [];
  return check(
    await getAdminClient()
      .from("answers")
      .select("player_id,question_index,answer,is_correct,points")
      .eq("game_id", gameId)
      .eq("question_index", questionIndex),
  ) as AnswerRow[];
}

export async function loadGameView(game: GameRow): Promise<GameView> {
  const [players, answers] = await Promise.all([
    listPlayers(game.id),
    listAnswers(game.id, game.current_question_index),
  ]);
  return buildGameView(game, players, answers, Date.now());
}

/** Image URLs of every question, so the host screen can preload them. */
export function allImageUrls(game: GameRow): string[] {
  const urls = game.quiz_snapshot.questions.map((q) => q.imageUrl);
  return [...new Set(urls.filter((u): u is string => Boolean(u)))];
}
