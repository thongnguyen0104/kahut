"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Chips, TYPE_TONE } from "@/components/editor/QuestionEditor";
import { Button, ErrorBanner, Spinner, Tag, inputBase, inputClass, labelClass } from "@/components/ui";
import type { AiDifficulty, AiLanguage } from "@/lib/ai/quizGen";
import { errorCode, errorDetail } from "@/lib/client/api";
import { authApi, useAuth } from "@/lib/client/auth";
import { AI_DIFFICULTIES, AI_MAX_QUESTIONS, AI_TOPIC_MAX, AI_TOPIC_MIN } from "@/lib/config";
import { QUESTION_TYPES, type Question, type QuestionType } from "@/lib/game/types";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export interface AiAppendResult {
  title: string;
  description: string;
  questions: Question[];
  generated: number;
  requested: number;
}

type Props =
  | { mode: "create"; onClose: () => void }
  | {
      mode: "append";
      onClose: () => void;
      quizId: string;
      /** How many questions still fit in the quiz. */
      maxCount: number;
      onAppend: (result: AiAppendResult) => void;
    };

const COUNT_PRESETS = [5, 10, 15, 20, 30];
const LANGUAGE_LABEL: Record<AiLanguage, string> = { vi: "Tiếng Việt", en: "English" };

/**
 * Modal form: topic + settings → POST /api/quizzes/generate. Mount it to open it;
 * it calls onClose when dismissed. In "create" mode it opens the new quiz in the editor.
 */
export function AiGenerateDialog(props: Props) {
  const { t, locale } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const max = props.mode === "append" ? Math.min(AI_MAX_QUESTIONS, props.maxCount) : AI_MAX_QUESTIONS;
  const [topic, setTopic] = useState("");
  const [countText, setCountText] = useState(String(Math.min(10, max)));
  const [types, setTypes] = useState<QuestionType[]>(["single"]);
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [language, setLanguage] = useState<AiLanguage>(locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const isSuperadmin = useAuth().user?.isSuperadmin === true;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const count = Number(countText);
  const countValid = Number.isInteger(count) && count >= 1 && count <= max;

  function toggleType(type: QuestionType) {
    setTypes((current) =>
      current.includes(type)
        ? current.length > 1
          ? current.filter((x) => x !== type)
          : current
        : QUESTION_TYPES.filter((x) => x === type || current.includes(x)),
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (topic.trim().length < AI_TOPIC_MIN) {
      setError("topic_required");
      setDetail(null);
      return;
    }
    if (!countValid) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    const body = {
      topic,
      count,
      types,
      difficulty,
      language,
      ...(props.mode === "append" ? { quizId: props.quizId } : {}),
    };
    try {
      if (props.mode === "create") {
        const res = await authApi<{ id: string }>("/api/quizzes/generate", { method: "POST", body });
        router.push(`/quiz/${res.id}/edit`); // stay busy until the editor replaces this page
      } else {
        const res = await authApi<AiAppendResult>("/api/quizzes/generate", { method: "POST", body });
        props.onAppend(res);
        dialogRef.current?.close();
      }
    } catch (err) {
      setError(errorCode(err));
      setDetail(errorDetail(err));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={props.onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault(); // Esc must not drop a request in flight
      }}
      aria-labelledby="ai-dialog-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border-3 border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/55"
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex flex-col items-start gap-2">
          <Tag tone="lilac">✦ AI · Gemini</Tag>
          <h2 id="ai-dialog-title" className="text-3xl font-extrabold leading-tight">
            {props.mode === "create" ? t("ai.createButton") : t("ai.appendButton")}
          </h2>
          <p className="text-sm font-medium text-ink-soft">{t("ai.intro")}</p>
        </div>

        <fieldset disabled={busy} className="flex flex-col gap-6 disabled:opacity-60">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>{t("ai.topic")}</span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={AI_TOPIC_MAX}
              rows={3}
              autoFocus
              placeholder={t("ai.topicPlaceholder")}
              className={`${inputClass} resize-y`}
            />
          </label>

          <div className="flex flex-col gap-2.5">
            <span className={labelClass}>{t("ai.count")}</span>
            <div className="flex flex-wrap items-center gap-2">
              {COUNT_PRESETS.filter((n) => n <= max).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCountText(String(n))}
                  aria-pressed={count === n}
                  className={`press rounded-full border-2 border-ink px-3.5 py-1.5 font-display text-sm font-extrabold ${count === n ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                value={countText}
                onChange={(e) => setCountText(e.target.value)}
                aria-label={t("ai.count")}
                aria-invalid={!countValid}
                className={`${inputBase} w-24 py-1.5 text-center font-display font-extrabold ${countValid ? "" : "border-tomato-deep"}`}
              />
            </div>
            <span className="text-xs font-semibold text-ink-soft">{t("ai.countHint", { max })}</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className={labelClass}>{t("ai.types")}</span>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={t("ai.types")}>
              {QUESTION_TYPES.map((type) => {
                const on = types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleType(type)}
                    className={`press flex items-center gap-2 rounded-xl border-3 border-ink px-3 py-2.5 text-left font-display text-sm font-extrabold ${on ? `${TYPE_TONE[type]} shadow-hard-sm` : "bg-white text-ink-soft"}`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-ink text-xs ${on ? "bg-white" : ""}`}
                      aria-hidden
                    >
                      {on ? "✓" : ""}
                    </span>
                    {t(`qtype.${type}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <span className={labelClass}>{t("ai.difficulty")}</span>
              <Chips
                value={difficulty}
                options={AI_DIFFICULTIES.map((d) => ({ value: d, label: t(`ai.${d}`) }))}
                onChange={setDifficulty}
                label={t("ai.difficulty")}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <span className={labelClass}>{t("ai.language")}</span>
              <Chips
                value={language}
                options={(Object.keys(LANGUAGE_LABEL) as AiLanguage[]).map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
                onChange={setLanguage}
                label={t("ai.language")}
              />
            </div>
          </div>
        </fieldset>

        <p className="text-xs font-medium text-ink-soft">{t("ai.privacyHint")}</p>
        <ErrorBanner>{errorText(error)}</ErrorBanner>
        {error && detail && isSuperadmin && (
          <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-ink/50 bg-white p-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              {t("ai.errorDetail")} · {error}
            </span>
            <code className="whitespace-pre-wrap wrap-break-word font-mono text-xs leading-relaxed">{detail}</code>
            <Link
              href="/admin/ai-logs"
              target="_blank"
              className="self-start font-display text-sm font-extrabold underline decoration-2 underline-offset-2"
            >
              {t("ai.viewLogs")} ↗
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t-3 border-dashed border-ink/25 pt-5">
          {busy && (
            <span className="mr-auto flex items-center gap-2 text-sm font-semibold" role="status">
              <Spinner className="size-5" />
              <span className="flex flex-col">
                <span>{t("ai.generating")}</span>
                <span className="text-xs text-ink-soft">{t("ai.waitHint")}</span>
              </span>
            </span>
          )}
          <Button variant="ghost" onClick={() => dialogRef.current?.close()} disabled={busy}>
            {t("ai.cancel")}
          </Button>
          <Button type="submit" size="lg" disabled={busy || !countValid}>
            ✦ {busy ? t("ai.generating") : t("ai.generate")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
