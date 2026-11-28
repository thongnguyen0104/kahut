import { AI_MODELS } from "../config";

const MAX_MODELS = 6;
const MODEL_ID = /^[a-z0-9][a-z0-9.\-]{1,79}$/i;

/**
 * The Gemini models to try, in order. Env GEMINI_MODELS ("a,b,c") replaces the list in
 * lib/config.ts. The older GEMINI_MODEL / GEMINI_FALLBACK_MODEL pair still works when
 * GEMINI_MODELS is unset: they go first, then the configured list.
 */
export function resolveModels(env: {
  GEMINI_MODELS?: string;
  GEMINI_MODEL?: string;
  GEMINI_FALLBACK_MODEL?: string;
}): string[] {
  const split = (value: string | undefined) =>
    (value ?? "")
      .split(/[\s,]+/)
      .map((m) => m.trim().replace(/^models\//, ""))
      .filter((m) => MODEL_ID.test(m));

  const fromList = split(env.GEMINI_MODELS);
  const models = fromList.length
    ? fromList
    : [...split(env.GEMINI_MODEL), ...split(env.GEMINI_FALLBACK_MODEL), ...AI_MODELS];
  return [...new Set(models)].slice(0, MAX_MODELS);
}
