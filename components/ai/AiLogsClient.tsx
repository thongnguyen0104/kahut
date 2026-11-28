"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ErrorBanner, FullPageSpinner, PageTitle, Spinner, Tag, TopBar } from "@/components/ui";
import type { AiAttempt, AiLogView } from "@/lib/ai/logs";
import { errorCode, errorDetail } from "@/lib/client/api";
import { authApi, useRequireAuth } from "@/lib/client/auth";
import type { MessageKey } from "@/lib/i18n/types";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

interface LogsResponse {
  logs: AiLogView[];
  models: string[];
  configured: boolean;
}

/** Superadmin-only: every AI generation request with what each model call did. */
export default function AiLogsClient() {
  const { ready } = useRequireAuth({ superadmin: true });
  if (!ready) return <FullPageSpinner />;
  return <AiLogs />;
}

function AiLogs() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; detail: string | null } | null>(null);

  // State is only set in the callbacks; callers flip `loading` on before calling.
  const load = useCallback((errorsOnly: boolean) => {
    return authApi<LogsResponse>(`/api/admin/ai-logs?limit=200${errorsOnly ? "&errors=1" : ""}`)
      .then(
        (res) => {
          setData(res);
          setError(null);
        },
        (err) => setError({ code: errorCode(err), detail: errorDetail(err) }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load(onlyErrors);
  }, [load, onlyErrors]);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-12 pt-2 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle label="✦ AI · Gemini" tone="lilac">
            {t("aiLogs.title")}
          </PageTitle>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={onlyErrors}
              onClick={() => {
                setLoading(true);
                setOnlyErrors((v) => !v);
              }}
              className={`press flex h-10 items-center gap-2 rounded-xl border-3 border-ink px-3 font-display text-sm font-extrabold shadow-hard-sm ${onlyErrors ? "bg-tomato" : "bg-white"}`}
            >
              <span className={`flex size-5 items-center justify-center rounded-md border-2 border-ink text-xs ${onlyErrors ? "bg-white" : ""}`} aria-hidden>
                {onlyErrors ? "✓" : ""}
              </span>
              {t("aiLogs.onlyErrors")}
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoading(true);
                void load(onlyErrors);
              }}
              disabled={loading}
            >
              ↻ {t("aiLogs.refresh")}
            </Button>
          </div>
        </div>

        <p className="max-w-3xl text-sm font-medium text-ink-soft">{t("aiLogs.intro")}</p>
        {data && (
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span>{t("aiLogs.models")}</span>
            {data.models.map((m, i) => (
              <code key={m} className={`rounded-md border-2 border-ink px-1.5 py-0.5 font-mono text-xs ${i === 0 ? "bg-sun" : "bg-white"}`}>
                {m}
              </code>
            ))}
            {!data.configured && <Tag tone="tomato">{t("aiLogs.keyMissing")}</Tag>}
          </p>
        )}

        {error && (
          <div className="flex flex-col gap-2">
            <ErrorBanner>{errorText(error.code)}</ErrorBanner>
            {error.detail && <code className="font-mono text-xs text-ink-soft">{error.detail}</code>}
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-8" />
          </div>
        ) : data && data.logs.length === 0 ? (
          <p className="rounded-2xl border-3 border-dashed border-ink/40 px-6 py-12 text-center font-display text-lg font-extrabold text-ink-soft">
            {t("aiLogs.empty")}
          </p>
        ) : (
          <ul className={`flex flex-col gap-4 transition ${loading ? "opacity-50" : ""}`}>
            {data?.logs.map((log) => <LogItem key={log.id} log={log} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function LogItem({ log }: { log: AiLogView }) {
  const { t, locale } = useI18n();
  const errorText = useErrorText();
  const time = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(log.createdAt));

  const chip = "rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-bold";

  return (
    <li className={`flex flex-col gap-3 rounded-2xl border-3 border-ink p-4 shadow-hard-sm ${log.ok ? "bg-white" : "bg-tomato-soft"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">
        <Tag tone={log.ok ? "mint" : "tomato"} tilt={0}>
          {log.ok ? `✓ ${t("aiLogs.ok")}` : `✕ ${t("aiLogs.failed")}`}
        </Tag>
        <span className="tabular-nums">{time}</span>
        <span className="text-ink-soft">·</span>
        <span>{log.mode === "create" ? t("aiLogs.modeCreate") : t("aiLogs.modeAppend")}</span>
        <span className="text-ink-soft">·</span>
        <span className="tabular-nums">{t("aiLogs.seconds", { s: seconds(log.durationMs) })}</span>
        {log.userEmail && <span className="ml-auto truncate text-xs text-ink-soft">{log.userEmail}</span>}
      </div>

      <p className="font-display text-lg font-extrabold leading-snug">{log.topic}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chip} ${log.ok ? "bg-mint" : ""}`}>
          {t("aiLogs.questions", { generated: log.generated ?? 0, requested: log.requested })}
        </span>
        {log.received !== null && <span className={chip}>{t("aiLogs.received", { count: log.received })}</span>}
        {log.settings.types?.map((type) => (
          <span key={type} className={chip}>
            {t(`qtype.${type}` as MessageKey)}
          </span>
        ))}
        {log.settings.difficulty && <span className={chip}>{t(`ai.${log.settings.difficulty}` as MessageKey)}</span>}
        {log.settings.language && <span className={`${chip} uppercase`}>{log.settings.language}</span>}
        {log.quizId && (
          <Link href={`/quiz/${log.quizId}/edit`} className="ml-auto text-sm font-extrabold underline decoration-2 underline-offset-2">
            {t("aiLogs.openQuiz")} →
          </Link>
        )}
      </div>

      {!log.ok && (
        <div className="flex flex-col gap-1 rounded-xl border-2 border-ink bg-white p-3">
          <span className="text-sm font-bold">
            {errorText(log.errorCode)} <code className="font-mono text-xs text-ink-soft">({log.errorCode})</code>
          </span>
          {log.errorDetail && <code className="whitespace-pre-wrap wrap-break-word font-mono text-xs leading-relaxed">{log.errorDetail}</code>}
        </div>
      )}

      {log.attempts.length > 0 && (
        <details open={!log.ok} className="group">
          <summary className="cursor-pointer select-none font-display text-sm font-extrabold">
            {t("aiLogs.attempts")} · {log.attempts.length}
          </summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {log.attempts.map((a, i) => (
              <AttemptRow key={i} attempt={a} />
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function AttemptRow({ attempt: a }: { attempt: AiAttempt }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg border-2 border-ink/20 bg-white/70 px-2.5 py-1.5 font-mono text-xs">
      <span className={`font-bold ${a.ok ? "text-ink" : "text-tomato-deep"}`}>{a.ok ? "✓" : "✕"}</span>
      <span className="font-bold">{a.model}</span>
      {a.status !== undefined && <span className="rounded bg-tomato-soft px-1">HTTP {a.status}</span>}
      <span className="tabular-nums">{seconds(a.ms)}s</span>
      {a.finishReason && <span>{a.finishReason}</span>}
      {(a.inputTokens !== undefined || a.outputTokens !== undefined) && (
        <span className="text-ink-soft">{t("aiLogs.tokens", { input: a.inputTokens ?? "?", output: a.outputTokens ?? "?" })}</span>
      )}
      {a.error && <span className="basis-full whitespace-pre-wrap wrap-break-word text-ink-soft">{a.error}</span>}
    </li>
  );
}
