import { LIMITS, POINTS_MULTIPLIER_OPTIONS, TIME_LIMIT_OPTIONS } from "../config";
import { QUESTION_TYPES, type AnswerOption, type Question, type QuestionType, type QuizContent } from "./types";

const DEFAULT_TIME_LIMIT = 20;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function shortId(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : fallback;
}

/** A file URL from our own storage bucket (when a prefix is given), else null. */
function storageUrl(value: unknown, allowedPrefix: string | null): string | null {
  if (typeof value !== "string" || !value || value.length > 500) return null;
  if (allowedPrefix && !value.startsWith(allowedPrefix)) return null;
  if (!/^https?:\/\//.test(value)) return null;
  return value;
}

function audioUrl(value: unknown, allowedPrefix: string | null): string | null {
  const url = storageUrl(value, allowedPrefix);
  return url && /\.mp3$/i.test(url) ? url : null;
}

export function trueFalseOptions(correct: "true" | "false" | null): AnswerOption[] {
  return [
    { id: "true", text: "", isCorrect: correct === "true" },
    { id: "false", text: "", isCorrect: correct === "false" },
  ];
}

function sanitizeQuestion(raw: unknown, index: number, prefix: string | null): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const type: QuestionType = QUESTION_TYPES.includes(q.type as QuestionType)
    ? (q.type as QuestionType)
    : "single";

  const timeLimitSec = (TIME_LIMIT_OPTIONS as readonly number[]).includes(q.timeLimitSec as number)
    ? (q.timeLimitSec as number)
    : DEFAULT_TIME_LIMIT;
  const pointsMultiplier = (POINTS_MULTIPLIER_OPTIONS as readonly number[]).includes(
    q.pointsMultiplier as number,
  )
    ? (q.pointsMultiplier as number)
    : 1;

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  let options: AnswerOption[] = [];
  let acceptedAnswers: string[] = [];

  if (type === "true_false") {
    const correct = rawOptions.find(
      (o) => o && typeof o === "object" && (o as AnswerOption).isCorrect === true,
    ) as AnswerOption | undefined;
    const id = correct?.id === "true" || correct?.id === "false" ? correct.id : null;
    options = trueFalseOptions(id);
  } else if (type === "text") {
    const rawAccepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
    acceptedAnswers = rawAccepted
      .map((a) => str(a, LIMITS.acceptedAnswerMax))
      .filter(Boolean)
      .slice(0, LIMITS.acceptedAnswersMax);
  } else {
    const seen = new Set<string>();
    options = rawOptions.slice(0, LIMITS.maxOptions).map((o, i) => {
      const opt = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
      let id = shortId(opt.id, `o${i}`);
      if (seen.has(id)) id = `o${i}_${index}`;
      seen.add(id);
      return {
        id,
        text: str(opt.text, LIMITS.optionTextMax),
        isCorrect: opt.isCorrect === true,
      };
    });
    if (type === "single") {
      // Keep at most one correct flag.
      let found = false;
      options = options.map((o) => {
        const isCorrect = o.isCorrect && !found;
        if (isCorrect) found = true;
        return { ...o, isCorrect };
      });
    }
  }

  return {
    id: shortId(q.id, `q${index}`),
    type,
    prompt: str(q.prompt, LIMITS.promptMax),
    imageUrl: storageUrl(q.imageUrl, prefix),
    audioUrl: audioUrl(q.audioUrl, prefix),
    timeLimitSec,
    pointsMultiplier,
    options,
    acceptedAnswers,
  };
}

/**
 * Structural clean-up of an editor payload. Coerces types and clamps lengths but
 * allows incomplete drafts (empty prompts etc.) so work in progress can be saved.
 * Returns null when the payload is not a quiz at all.
 */
export function sanitizeQuiz(raw: unknown, imageUrlPrefix: string | null): QuizContent | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.questions)) return null;

  const ids = new Set<string>();
  const questions: Question[] = [];
  body.questions.slice(0, LIMITS.questionsMax).forEach((rq, i) => {
    const q = sanitizeQuestion(rq, i, imageUrlPrefix);
    if (!q) return;
    if (ids.has(q.id)) q.id = `${q.id}_${i}`;
    ids.add(q.id);
    questions.push(q);
  });

  return {
    title: str(body.title, LIMITS.titleMax),
    description: str(body.description, LIMITS.descriptionMax),
    coverImageUrl: storageUrl(body.coverImageUrl, imageUrlPrefix),
    musicUrl: audioUrl(body.musicUrl, imageUrlPrefix),
    questions,
  };
}

export type QuizProblemCode =
  | "title_required"
  | "no_questions"
  | "prompt_required"
  | "options_count"
  | "option_text_required"
  | "needs_one_correct"
  | "needs_some_correct"
  | "accepted_required";

export interface QuizProblem {
  /** -1 for quiz-level problems. */
  questionIndex: number;
  code: QuizProblemCode;
}

/** Semantic checks that must pass before a quiz can be played. */
export function findQuizProblems(quiz: QuizContent): QuizProblem[] {
  const problems: QuizProblem[] = [];
  if (!quiz.title.trim()) problems.push({ questionIndex: -1, code: "title_required" });
  if (quiz.questions.length === 0) problems.push({ questionIndex: -1, code: "no_questions" });

  quiz.questions.forEach((q, i) => {
    const add = (code: QuizProblemCode) => problems.push({ questionIndex: i, code });
    if (!q.prompt.trim()) add("prompt_required");

    const correctCount = q.options.filter((o) => o.isCorrect).length;
    switch (q.type) {
      case "text":
        if (q.acceptedAnswers.length === 0) add("accepted_required");
        break;
      case "true_false":
        if (correctCount !== 1) add("needs_one_correct");
        break;
      case "single":
      case "multi":
        if (q.options.length < LIMITS.minOptions || q.options.length > LIMITS.maxOptions) {
          add("options_count");
        }
        if (q.options.some((o) => !o.text.trim())) add("option_text_required");
        if (q.type === "single" && correctCount !== 1) add("needs_one_correct");
        if (q.type === "multi" && correctCount < 1) add("needs_some_correct");
        break;
    }
  });
  return problems;
}
