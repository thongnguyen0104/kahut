"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { progressKey } from "../game/transitions";
import type { GameEventMap, GameView } from "../game/types";
import { api, errorCode } from "./api";
import { getBrowserClient } from "./supabase";

interface StateResponse {
  view: GameView;
  imageUrls?: string[];
}

export interface UseGameResult {
  view: GameView | null;
  /** Where the current view came from: an authoritative fetch or a broadcast. */
  source: "fetch" | "broadcast" | null;
  error: string | null;
  connected: boolean;
  /** Player ids currently connected (from Realtime presence). */
  onlineIds: Set<string>;
  /** Host only: every question image, for preloading. */
  imageUrls: string[];
  /** Player ids removed by the host (from broadcasts). */
  kickedIds: Set<string>;
  refresh: () => Promise<void>;
  /** Applies a view returned by our own API call (ignored if older). */
  applyView: (view: GameView) => void;
}

function newer(current: GameView | null, next: GameView): boolean {
  return !current || progressKey(next) >= progressKey(current);
}

/**
 * Keeps a live copy of a game's state: loads it from the API, then follows the
 * `game:{pin}` broadcast channel. Resyncs on (re)subscribe and when the tab
 * becomes visible again, so a phone waking up catches up immediately.
 */
export function useGame(
  pin: string,
  options: { token?: string | null; presenceKey?: string | null } = {},
): UseGameResult {
  const { token = null, presenceKey = null } = options;
  const [view, setView] = useState<GameView | null>(null);
  const [source, setSource] = useState<UseGameResult["source"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [kickedIds, setKickedIds] = useState<Set<string>>(() => new Set());
  const requestSeq = useRef(0);

  const refresh = useCallback((): Promise<void> => {
    const seq = ++requestSeq.current;
    return api<StateResponse>(`/api/games/${pin}/state`, { token }).then(
      (data) => {
        if (seq !== requestSeq.current) return; // a newer refresh is in flight
        setView(data.view);
        setSource("fetch");
        if (data.imageUrls) setImageUrls(data.imageUrls);
        setError(null);
      },
      (err) => {
        if (seq === requestSeq.current) setError(errorCode(err));
      },
    );
  }, [pin, token]);

  const applyView = useCallback((next: GameView) => {
    setView((cur) => (newer(cur, next) ? next : cur));
    setSource("fetch");
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    const supabase = getBrowserClient();

    channel = supabase.channel(`game:${pin}`, {
      config: { presence: { key: presenceKey ?? "" } },
    });

    const on = <E extends keyof GameEventMap>(
      event: E,
      handler: (payload: GameEventMap[E]) => void,
    ) => {
      channel!.on("broadcast", { event }, (msg) => handler(msg.payload as GameEventMap[E]));
    };

    on("state_changed", (next) => {
      setView((cur) => (newer(cur, next) ? next : cur));
      setSource("broadcast");
    });

    on("player_joined", (player) => {
      setView((cur) => {
        if (!cur || cur.players.some((p) => p.id === player.id)) return cur;
        return { ...cur, players: [...cur.players, { ...player, rank: cur.players.length + 1 }] };
      });
    });

    on("player_kicked", ({ playerId }) => {
      setKickedIds((cur) => new Set(cur).add(playerId));
      setView((cur) =>
        cur
          ? {
              ...cur,
              players: cur.players.filter((p) => p.id !== playerId),
              answeredPlayerIds: cur.answeredPlayerIds.filter((id) => id !== playerId),
            }
          : cur,
      );
    });

    on("answer_count", ({ questionIndex, playerId }) => {
      setView((cur) => {
        if (
          !cur ||
          cur.status !== "question" ||
          cur.questionIndex !== questionIndex ||
          cur.answeredPlayerIds.includes(playerId)
        ) {
          return cur;
        }
        return { ...cur, answeredPlayerIds: [...cur.answeredPlayerIds, playerId] };
      });
    });

    channel.on("presence", { event: "sync" }, () => {
      setOnlineIds(new Set(Object.keys(channel!.presenceState())));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        if (presenceKey) void channel!.track({ online: true });
        void refresh(); // catch anything sent before we were listening
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConnected(false);
      }
    });

    void refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [pin, presenceKey, refresh]);

  return { view, source, error, connected, onlineIds, imageUrls, kickedIds, refresh, applyView };
}
