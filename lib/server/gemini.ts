import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { HttpError } from "./http";

/** Override with GEMINI_MODEL / GEMINI_FALLBACK_MODEL (empty fallback = no fallback). */
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** Whole call, both models included. The route's maxDuration is 60s. */
const TIMEOUT_MS = 50_000;

/** Statuses where the fallback model may still work: unknown model, quota, overload. */
const TRY_FALLBACK = new Set([404, 429, 500, 503]);

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "ai_not_configured");
  // No SDK retries: on the free tier a retry burns quota; we fall back to another model instead.
  client ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  return client;
}

function models(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim() ?? DEFAULT_FALLBACK_MODEL;
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

/**
 * Asks Gemini for JSON matching `schema` (structured output) and returns it parsed.
 * Errors become HttpError codes the client translates: ai_not_configured, ai_bad_key,
 * ai_rate_limited (free quota used up) or ai_failed.
 */
export async function generateJson(system: string, user: string, schema: unknown): Promise<unknown> {
  const ai = getClient();
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  let lastStatus = 0;

  for (const model of models()) {
    let output: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          abortSignal: deadline,
        },
      });
      output = res.text;
      if (!output) {
        const reason = res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? "empty";
        console.error(`Gemini ${model}: no text in response (${reason})`);
        throw new HttpError(502, "ai_failed");
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof ApiError) {
        lastStatus = err.status;
        console.error(`Gemini ${model} failed: ${err.status} ${err.message}`);
        if (/API key not valid|API_KEY_INVALID/i.test(err.message)) throw new HttpError(503, "ai_bad_key");
        if (TRY_FALLBACK.has(err.status) && !deadline.aborted) continue;
        break;
      }
      console.error(`Gemini ${model} failed:`, err);
      throw new HttpError(502, "ai_failed");
    }

    try {
      return JSON.parse(output);
    } catch {
      console.error(`Gemini ${model}: response is not valid JSON`);
      throw new HttpError(502, "ai_failed");
    }
  }

  if (lastStatus === 429) throw new HttpError(429, "ai_rate_limited");
  throw new HttpError(502, "ai_failed");
}
