import { BASE_POINTS, LIMITS } from "../config";
import { normalizeText } from "./normalize";
import type { PublicQuestion, Question, SubmittedAnswer } from "./types";

/**
 * Validates the raw answer body against the question shape.
 * Returns null when the payload is malformed for this question type.
 */
export function parseSubmittedAnswer(
  question: Pick<PublicQuestion, "type" | "options">,
  raw: unknown,
): SubmittedAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;

  if (question.type === "text") {
    if (typeof body.text !== "string") return null;
    const text = body.text.trim().slice(0, LIMITS.typedAnswerMax);
    return text ? { text } : null;
  }

  if (!Array.isArray(body.optionIds)) return null;
  const valid = new Set(question.options.map((o) => o.id));
  const ids = [...new Set(body.optionIds)];
  if (ids.length === 0 || !ids.every((id) => typeof id === "string" && valid.has(id))) {
    return null;
  }
  if (question.type !== "multi" && ids.length !== 1) return null;
  return { optionIds: ids as string[] };
}

export function isAnswerCorrect(question: Question, answer: SubmittedAnswer): boolean {
  if (question.type === "text") {
    const typed = normalizeText(answer.text ?? "");
    if (!typed) return false;
    return question.acceptedAnswers.some((a) => normalizeText(a) === typed);
  }

  const chosen = new Set(answer.optionIds ?? []);
  const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
  if (chosen.size === 0 || correct.size === 0) return false;

  if (question.type === "multi") {
    // All-or-nothing: exactly the set of correct options.
    if (chosen.size !== correct.size) return false;
    return [...chosen].every((id) => correct.has(id));
  }

  return chosen.size === 1 && correct.has([...chosen][0]);
}

/**
 * Speed-weighted points: an instant correct answer earns BASE_POINTS × multiplier,
 * an answer on the buzzer earns half of that. Wrong answers earn 0.
 */
export function computePoints(params: {
  correct: boolean;
  responseMs: number;
  timeLimitMs: number;
  multiplier: number;
}): number {
  const { correct, responseMs, timeLimitMs, multiplier } = params;
  if (!correct || multiplier <= 0 || timeLimitMs <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, responseMs / timeLimitMs));
  return Math.round(BASE_POINTS * multiplier * (1 - ratio / 2));
}

export function correctOptionIds(question: Question): string[] {
  return question.options.filter((o) => o.isCorrect).map((o) => o.id);
}
