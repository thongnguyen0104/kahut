/** App-wide constants shared by client and server. */

/** Display name. Change it here to rebrand the app. */
export const APP_NAME = "QuizRush";

/** Default cap on players per room (server can override with env MAX_PLAYERS). */
export const MAX_PLAYERS_DEFAULT = 30;

/** Time the question is shown before answers open (ms). */
export const READ_TIME_MS = 4000;

/** Answers arriving this long after the deadline are still accepted (network slack). */
export const ANSWER_GRACE_MS = 1000;

/** Answers arriving this early before answers open are still accepted (clock skew). */
export const EARLY_TOLERANCE_MS = 300;

/** Max points for an instant correct answer at multiplier 1. */
export const BASE_POINTS = 1000;

export const TIME_LIMIT_OPTIONS = [5, 10, 20, 30, 45, 60, 90, 120] as const;
export const POINTS_MULTIPLIER_OPTIONS = [1, 2, 0] as const;

export const LIMITS = {
  titleMax: 120,
  descriptionMax: 500,
  promptMax: 300,
  optionTextMax: 90,
  acceptedAnswerMax: 60,
  acceptedAnswersMax: 5,
  questionsMax: 100,
  nicknameMax: 20,
  typedAnswerMax: 100,
  minOptions: 2,
  maxOptions: 4,
} as const;

export const IMAGE_BUCKET = "quiz-images";
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Background music and per-question clips (.mp3), stored in the same bucket as images. */
export const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const AUDIO_MIME_TYPE = "audio/mpeg";

/**
 * Gemini models for AI quiz generation, tried in order: the first is the main model, the
 * rest are fallbacks used when one fails (quota, overload, timeout, unknown model…).
 * Override without a code change with env GEMINI_MODELS="model-a,model-b,…".
 * Free tier, 30 questions (2026-11-28): 3.1-flash-lite ~6s, 3.5-flash-lite ~7s,
 * 3.5-flash ~22s, 3.6-flash ~29s, 3.8-flash ~2min (too slow); 2.5-flash-lite closed to new users.
 */
export const AI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"] as const;
/** Whole generate request, all models included (the route's maxDuration is 60s). */
export const AI_TIMEOUT_MS = 50_000;
/** Cap per model when more models follow, so one hanging model can't use up the whole budget. */
export const AI_ATTEMPT_TIMEOUT_MS = 30_000;

/** AI quiz generation (Gemini): one request per batch, so keep batches modest. */
export const AI_MAX_QUESTIONS = 30;
export const AI_TOPIC_MIN = 3;
export const AI_TOPIC_MAX = 300;
export const AI_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const AI_LANGUAGES = ["vi", "en"] as const;
