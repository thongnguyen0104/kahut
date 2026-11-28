import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { failureCode, shortGeminiMessage, summarizeAttempts, type AiAttempt } from "../ai/logs";
import { resolveModels } from "../ai/models";
import { AI_ATTEMPT_TIMEOUT_MS, AI_TIMEOUT_MS } from "../config";
import { HttpError } from "./http";

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Models to try, in order: AI_MODELS in lib/config.ts, or env GEMINI_MODELS. */
export function geminiModels(): string[] {
  const { GEMINI_MODELS, GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = process.env;
  return resolveModels({ GEMINI_MODELS, GEMINI_MODEL, GEMINI_FALLBACK_MODEL });
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "ai_not_configured", "GEMINI_API_KEY is not set on the server.");
  // No SDK retries: on the free tier a retry burns quota; we move to the next model instead.
  client ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  return client;
}

/** A failed AI call, carrying what each model attempt did (for the log and the superadmin UI). */
export class AiCallError extends HttpError {
  constructor(
    status: number,
    code: string,
    public attempts: AiAttempt[],
  ) {
    super(status, code, summarizeAttempts(attempts));
  }
}

const STATUS_FOR: Record<string, number> = {
  ai_timeout: 504,
  ai_rate_limited: 429,
  ai_bad_key: 503,
  ai_failed: 502,
};

/**
 * Asks Gemini for JSON matching `schema` (structured output) and returns it parsed, with
 * one AiAttempt per model tried. Models are tried in order until one answers with valid
 * JSON; any failure except a bad key moves on to the next model. Every model but the last
 * gets at most AI_ATTEMPT_TIMEOUT_MS, all of them together AI_TIMEOUT_MS.
 * Throws AiCallError: ai_bad_key, ai_rate_limited, ai_timeout or ai_failed.
 */
export async function generateJson(
  system: string,
  user: string,
  schema: unknown,
): Promise<{ data: unknown; attempts: AiAttempt[] }> {
  const ai = getClient();
  const models = geminiModels();
  const deadline = AbortSignal.timeout(AI_TIMEOUT_MS);
  const attempts: AiAttempt[] = [];
  const fail = (code: string) => new AiCallError(STATUS_FOR[code] ?? 502, code, attempts);

  for (const [index, model] of models.entries()) {
    if (deadline.aborted) break;
    const isLast = index === models.length - 1;
    const signal = isLast ? deadline : AbortSignal.any([deadline, AbortSignal.timeout(AI_ATTEMPT_TIMEOUT_MS)]);
    const started = Date.now();
    try {
      const res = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          abortSignal: signal,
        },
      });
      const attempt: AiAttempt = {
        model,
        ok: false,
        ms: Date.now() - started,
        finishReason: res.candidates?.[0]?.finishReason,
        inputTokens: res.usageMetadata?.promptTokenCount,
        outputTokens: res.usageMetadata?.candidatesTokenCount,
      };
      const output = res.text;
      if (!output) {
        attempts.push({ ...attempt, error: `no text in response (${res.promptFeedback?.blockReason ?? attempt.finishReason ?? "empty"})` });
        continue;
      }
      let data: unknown;
      try {
        data = JSON.parse(output);
      } catch {
        const cut = attempt.finishReason === "MAX_TOKENS";
        attempts.push({ ...attempt, error: cut ? "answer cut off (MAX_TOKENS)" : "answer is not valid JSON" });
        continue;
      }
      attempts.push({ ...attempt, ok: true });
      return { data, attempts };
    } catch (err) {
      const ms = Date.now() - started;
      if (err instanceof ApiError) {
        attempts.push({ model, ok: false, ms, status: err.status, error: shortGeminiMessage(err.message) });
        if (/API key not valid|API_KEY_INVALID/i.test(err.message)) throw fail("ai_bad_key");
        continue;
      }
      if (signal.aborted) {
        attempts.push({ model, ok: false, ms, error: `timeout: no answer within ${(ms / 1000).toFixed(0)}s` });
        continue;
      }
      attempts.push({ model, ok: false, ms, error: shortGeminiMessage(String((err as Error)?.message ?? err)) });
    }
  }

  for (const a of attempts) console.error(`Gemini ${a.model} failed (${a.ms}ms): ${a.status ?? ""} ${a.error ?? ""}`);
  const timedOut = deadline.aborted || (attempts.length > 0 && attempts.every((a) => a.error?.startsWith("timeout")));
  throw fail(failureCode(attempts, timedOut));
}
