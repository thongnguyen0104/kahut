import "server-only";
import type { GameEventMap, GameEventName } from "../game/types";
import { getAdminClient } from "./supabase";

export function gameChannelName(pin: string): string {
  return `game:${pin}`;
}

/**
 * Sends a broadcast to everyone on the game channel over Supabase's REST endpoint
 * (no websocket needed, so it works from a serverless function).
 * Failures are logged, not thrown: clients resync through GET /state anyway.
 */
export async function broadcast<E extends GameEventName>(
  pin: string,
  event: E,
  payload: GameEventMap[E],
): Promise<void> {
  const supabase = getAdminClient();
  const channel = supabase.channel(gameChannelName(pin));
  try {
    const res = await channel.httpSend(event, payload);
    if (!res.success) console.error(`broadcast ${event} failed`, res.status, res.error);
  } catch (err) {
    console.error(`broadcast ${event} failed`, err);
  } finally {
    await supabase.removeChannel(channel);
  }
}
