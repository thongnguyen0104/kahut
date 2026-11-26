export const QUESTION_TYPES = ["single", "true_false", "multi", "text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  timeLimitSec: number;
  /** 0 = no points, 1 = standard, 2 = double. */
  pointsMultiplier: number;
  /** Empty for `text` questions. `true_false` always has ids "true" and "false". */
  options: AnswerOption[];
  /** Only used by `text` questions. */
  acceptedAnswers: string[];
}

export interface QuizContent {
  title: string;
  description: string;
  coverImageUrl: string | null;
  questions: Question[];
}

export interface Quiz extends QuizContent {
  id: string;
  updatedAt: string;
}

/** What players are allowed to see of a question (no correct flags). */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  timeLimitSec: number;
  pointsMultiplier: number;
  options: { id: string; text: string }[];
}

export interface SubmittedAnswer {
  optionIds?: string[];
  text?: string;
}

export const GAME_STATUSES = [
  "lobby",
  "question",
  "reveal",
  "leaderboard",
  "finished",
] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export interface PlayerView {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  rank: number;
}

export interface PlayerResult {
  answered: boolean;
  correct: boolean;
  points: number;
}

export interface RevealView {
  correctOptionIds: string[];
  acceptedAnswers: string[];
  /** optionId -> count. For `text` questions keys are "correct" / "incorrect". */
  distribution: Record<string, number>;
  /** playerId -> result for the revealed question. */
  results: Record<string, PlayerResult>;
}

/** The full public state of a game, sent on load and on every transition. */
export interface GameView {
  pin: string;
  status: GameStatus;
  quizTitle: string;
  coverImageUrl: string | null;
  totalQuestions: number;
  /** -1 while in the lobby. */
  questionIndex: number;
  question: PublicQuestion | null;
  /** Epoch ms when answering opens (question is shown READ_TIME_MS before). */
  startedAt: number | null;
  /** Active (not kicked) players, sorted by rank. */
  players: PlayerView[];
  answeredPlayerIds: string[];
  reveal: RevealView | null;
  serverNow: number;
}

/** Realtime broadcast events on channel `game:{pin}`. */
export interface GameEventMap {
  state_changed: GameView;
  player_joined: PlayerView;
  player_kicked: { playerId: string };
  answer_count: { questionIndex: number; playerId: string; count: number };
}
export type GameEventName = keyof GameEventMap;
