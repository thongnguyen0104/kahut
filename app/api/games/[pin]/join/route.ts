import { isAvatarId } from "@/lib/avatars";
import { LIMITS } from "@/lib/config";
import { HttpError, handle, json, readJson } from "@/lib/server/http";
import { getGameByPin } from "@/lib/server/games";
import { broadcast } from "@/lib/server/realtime";
import { getAdminClient, maxPlayers } from "@/lib/server/supabase";
import { generateToken, hashToken } from "@/lib/tokens";

/** Joins a room. Allowed until the game finishes (late joiners start at 0 points). */
export async function POST(req: Request, ctx: RouteContext<"/api/games/[pin]/join">) {
  return handle(async () => {
    const { pin } = await ctx.params;
    const body = await readJson(req);

    const nickname =
      typeof body.nickname === "string"
        ? body.nickname.replace(/\s+/g, " ").trim().slice(0, LIMITS.nicknameMax)
        : "";
    if (!nickname) throw new HttpError(400, "nickname_required");
    const avatar = isAvatarId(body.avatar) ? body.avatar : "a00";

    const game = await getGameByPin(pin);
    if (game.status === "finished") throw new HttpError(410, "game_finished");

    const db = getAdminClient();
    const { count, error: countError } = await db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .eq("kicked", false);
    if (countError) throw countError;
    if ((count ?? 0) >= maxPlayers()) throw new HttpError(409, "room_full");

    const playerToken = generateToken();
    const { data, error } = await db
      .from("players")
      .insert({ game_id: game.id, nickname, avatar, token_hash: hashToken(playerToken) })
      .select("id")
      .single();
    if (error?.code === "23505") throw new HttpError(409, "nickname_taken");
    if (error) throw error;

    await broadcast(pin, "player_joined", {
      id: data.id,
      nickname,
      avatar,
      score: 0,
      streak: 0,
      rank: (count ?? 0) + 1,
    });

    return json({ playerId: data.id, playerToken, nickname, avatar }, 201);
  });
}
