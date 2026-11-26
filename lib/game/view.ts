import { correctOptionIds } from "./scoring";
import type {
  GameStatus,
  GameView,
  PlayerResult,
  PlayerView,
  PublicQuestion,
  Question,
  QuizContent,
  RevealView,
  SubmittedAnswer,
} from "./types";

/** Database row shapes (snake_case, as returned by Supabase). */
export interface GameRow {
  id: string;
  pin: string;
  quiz_id: string | null;
  quiz_snapshot: QuizContent;
  host_token_hash: string;
  status: GameStatus;
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  kicked: boolean;
  joined_at: string;
}

export interface AnswerRow {
  player_id: string;
  question_index: number;
  answer: SubmittedAnswer;
  is_correct: boolean;
  points: number;
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    timeLimitSec: q.timeLimitSec,
    pointsMultiplier: q.pointsMultiplier,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  };
}

/** Sorts by score (desc), then join time; equal scores share a rank. */
export function rankPlayers(players: PlayerRow[]): PlayerView[] {
  const sorted = players
    .filter((p) => !p.kicked)
    .sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  let rank = 0;
  let prevScore: number | null = null;
  return sorted.map((p, i) => {
    if (p.score !== prevScore) rank = i + 1;
    prevScore = p.score;
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      rank,
    };
  });
}

export function buildReveal(
  question: Question,
  players: PlayerView[],
  answers: AnswerRow[],
): RevealView {
  const distribution: Record<string, number> = {};
  if (question.type === "text") {
    distribution.correct = 0;
    distribution.incorrect = 0;
  } else {
    for (const o of question.options) distribution[o.id] = 0;
  }

  const byPlayer = new Map(answers.map((a) => [a.player_id, a]));
  const results: Record<string, PlayerResult> = {};

  for (const p of players) {
    const a = byPlayer.get(p.id);
    if (!a) {
      results[p.id] = { answered: false, correct: false, points: 0 };
      continue;
    }
    results[p.id] = { answered: true, correct: a.is_correct, points: a.points };
    if (question.type === "text") {
      distribution[a.is_correct ? "correct" : "incorrect"] += 1;
    } else {
      for (const id of a.answer.optionIds ?? []) {
        if (id in distribution) distribution[id] += 1;
      }
    }
  }

  return {
    correctOptionIds: correctOptionIds(question),
    acceptedAnswers: question.type === "text" ? question.acceptedAnswers : [],
    distribution,
    results,
  };
}

/**
 * Builds the public game state. `answers` must be the answers for the current
 * question only. Correct answers are included only once the question is revealed.
 */
export function buildGameView(
  game: GameRow,
  players: PlayerRow[],
  answers: AnswerRow[],
  now: number,
): GameView {
  const quiz = game.quiz_snapshot;
  const idx = game.current_question_index;
  const showsQuestion =
    game.status === "question" || game.status === "reveal" || game.status === "leaderboard";
  const question = showsQuestion ? (quiz.questions[idx] ?? null) : null;

  const ranked = rankPlayers(players);
  const activeIds = new Set(ranked.map((p) => p.id));
  const current = answers.filter((a) => a.question_index === idx && activeIds.has(a.player_id));

  const revealed = game.status === "reveal" || game.status === "leaderboard";

  return {
    pin: game.pin,
    status: game.status,
    quizTitle: quiz.title,
    coverImageUrl: quiz.coverImageUrl,
    totalQuestions: quiz.questions.length,
    questionIndex: idx,
    question: question ? toPublicQuestion(question) : null,
    startedAt: game.question_started_at ? Date.parse(game.question_started_at) : null,
    players: ranked,
    answeredPlayerIds: current.map((a) => a.player_id),
    reveal: revealed && question ? buildReveal(question, ranked, current) : null,
    serverNow: now,
  };
}
