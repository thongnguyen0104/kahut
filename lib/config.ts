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
