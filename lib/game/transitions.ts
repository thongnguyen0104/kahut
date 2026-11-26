import type { GameStatus } from "./types";

export const HOST_ACTIONS = ["start", "reveal", "leaderboard", "next", "end"] as const;
export type HostAction = (typeof HOST_ACTIONS)[number];

export interface GamePosition {
  status: GameStatus;
  questionIndex: number;
}

export type TransitionPlan =
  | { ok: true; from: GamePosition; to: GamePosition }
  | { ok: false; error: "invalid_transition" | "no_questions" };

/**
 * Decides where a host action moves the game. Pure: the caller applies it with a
 * conditional UPDATE on `from`, so double-clicks and retries are harmless.
 *
 *   lobby → question(0) → reveal → leaderboard → question(i+1) … → finished
 */
export function planTransition(
  current: GamePosition,
  action: HostAction,
  totalQuestions: number,
): TransitionPlan {
  const from = current;
  const i = current.questionIndex;
  const fail = { ok: false, error: "invalid_transition" } as const;

  switch (action) {
    case "start":
      if (current.status !== "lobby") return fail;
      if (totalQuestions < 1) return { ok: false, error: "no_questions" };
      return { ok: true, from, to: { status: "question", questionIndex: 0 } };

    case "reveal":
      if (current.status !== "question") return fail;
      return { ok: true, from, to: { status: "reveal", questionIndex: i } };

    case "leaderboard":
      if (current.status !== "reveal") return fail;
      return { ok: true, from, to: { status: "leaderboard", questionIndex: i } };

    case "next":
      if (current.status !== "reveal" && current.status !== "leaderboard") return fail;
      if (i + 1 < totalQuestions) {
        return { ok: true, from, to: { status: "question", questionIndex: i + 1 } };
      }
      return { ok: true, from, to: { status: "finished", questionIndex: i } };

    case "end":
      if (current.status === "finished") return fail;
      return { ok: true, from, to: { status: "finished", questionIndex: i } };
  }
}

const STATUS_ORDER: Record<GameStatus, number> = {
  lobby: 0,
  question: 1,
  reveal: 2,
  leaderboard: 3,
  finished: 4,
};

/**
 * Monotonic progress key. Broadcasts can arrive out of order, so clients ignore
 * a `state_changed` whose key is lower than what they already show.
 */
export function progressKey(pos: GamePosition): number {
  if (pos.status === "finished") return Number.MAX_SAFE_INTEGER;
  return (pos.questionIndex + 1) * 10 + STATUS_ORDER[pos.status];
}
