/** AI generation log: shapes shared by the server, the log API and the superadmin UI. */

/** One call to one Gemini model while serving a generate request. */
export interface AiAttempt {
  model: string;
  ok: boolean;
  /** Wall time of this call. */
  ms: number;
  /** HTTP status from Gemini when it answered with an error. */
  status?: number;
  /** e.g. STOP, MAX_TOKENS, SAFETY. */
  finishReason?: string;
  /** Short reason when the call failed. */
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiLogView {
  id: number;
  createdAt: string;
  userEmail: string | null;
  mode: "create" | "append";
  quizId: string | null;
  topic: string;
  settings: { types: string[]; difficulty: string; language: string };
  requested: number;
  /** Questions in the model's answer, before validation. */
  received: number | null;
  /** Questions kept after validation. */
  generated: number | null;
  ok: boolean;
  errorCode: string | null;
  errorDetail: string | null;
  attempts: AiAttempt[];
  durationMs: number;
}

const ERROR_MAX = 300;

/** Gemini errors arrive as a JSON string; keep just the human message, shortened. */
export function shortGeminiMessage(raw: string): string {
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") message = parsed.error.message;
  } catch {
    // not JSON: keep as is
  }
  message = message.replace(/\s+/g, " ").trim();
  return message.length > ERROR_MAX ? `${message.slice(0, ERROR_MAX - 1)}…` : message;
}

/** "gemini-x: 503 overloaded (1.2s) → gemini-y: timeout (48.8s)" for the UI and the log. */
export function summarizeAttempts(attempts: AiAttempt[]): string {
  return attempts
    .map((a) => {
      const what = a.ok ? "ok" : [a.status, a.error].filter(Boolean).join(" ") || "failed";
      return `${a.model}: ${what} (${(a.ms / 1000).toFixed(1)}s)`;
    })
    .join(" → ");
}

/** Error code for a request where every attempt failed. */
export function failureCode(attempts: AiAttempt[], timedOut: boolean): string {
  if (timedOut) return "ai_timeout";
  if (attempts.some((a) => a.status === 429)) return "ai_rate_limited";
  return "ai_failed";
}
