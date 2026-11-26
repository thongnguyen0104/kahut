import { bearerToken, handle, json } from "@/lib/server/http";
import { allImageUrls, getGameByPin, loadGameView } from "@/lib/server/games";
import { tokenMatches } from "@/lib/tokens";

/**
 * Current public state of a game. Used on page load and to resync after a
 * reconnect. With the host token, also returns every image URL for preloading.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/games/[pin]/state">) {
  return handle(async () => {
    const { pin } = await ctx.params;
    const game = await getGameByPin(pin);
    const view = await loadGameView(game);
    const isHost = tokenMatches(bearerToken(req), game.host_token_hash);
    return json({ view, imageUrls: isHost ? allImageUrls(game) : undefined });
  });
}
