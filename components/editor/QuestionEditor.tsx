"use client";

import { OptionIcon, optionBg } from "@/components/options";
import { Button, inputClass } from "@/components/ui";
import { LIMITS, TIME_LIMIT_OPTIONS } from "@/lib/config";
import { QUESTION_TYPES, type Question, type QuestionType } from "@/lib/game/types";
import { trueFalseOptions } from "@/lib/game/validate";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ImageField } from "./ImageField";

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankOptions(count: number) {
  return Array.from({ length: count }, () => ({ id: randomId(), text: "", isCorrect: false }));
}

export function newQuestion(type: QuestionType = "single"): Question {
  return convertType(
    {
      id: randomId(),
      type: "single",
      prompt: "",
      imageUrl: null,
      timeLimitSec: 20,
      pointsMultiplier: 1,
      options: blankOptions(4),
      acceptedAnswers: [],
    },
    type,
  );
}

/** Switches question type while keeping as much of the content as makes sense. */
export function convertType(q: Question, type: QuestionType): Question {
  if (q.type === type) return q;
  const next: Question = { ...q, type };
  if (type === "true_false") {
    next.options = trueFalseOptions(null);
  } else if (type === "text") {
    next.options = [];
    const fromOptions = q.options.filter((o) => o.isCorrect && o.text.trim()).map((o) => o.text);
    next.acceptedAnswers = q.acceptedAnswers.length ? q.acceptedAnswers : fromOptions.slice(0, LIMITS.acceptedAnswersMax);
  } else {
    const reusable = q.type === "single" || q.type === "multi" ? q.options : [];
    next.options = reusable.length ? reusable : blankOptions(4);
    if (type === "single") {
      let found = false;
      next.options = next.options.map((o) => {
        const isCorrect = o.isCorrect && !found;
        if (isCorrect) found = true;
        return { ...o, isCorrect };
      });
    }
  }
  return next;
}

const POINTS = [
  { value: 1, key: "editor.pointsStandard" },
  { value: 2, key: "editor.pointsDouble" },
  { value: 0, key: "editor.pointsNone" },
] as const;

export function QuestionEditor({
  question,
  onChange,
  quizId,
  editToken,
}: {
  question: Question;
  onChange: (q: Question) => void;
  quizId: string;
  editToken: string;
}) {
  const { t } = useI18n();
  const q = question;
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-white/70">{t("editor.type")}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange(convertType(q, type))}
              aria-pressed={q.type === type}
              className={`rounded-xl px-3 py-2.5 text-sm font-extrabold ring-1 transition ${q.type === type ? "bg-accent text-ink ring-accent" : "bg-white/5 ring-line hover:bg-white/10"}`}
            >
              {t(`qtype.${type}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="flex justify-between text-sm font-bold text-white/70">
          {t("editor.prompt")}
          <span className="tabular-nums text-white/40">
            {q.prompt.length}/{LIMITS.promptMax}
          </span>
        </span>
        <textarea
          value={q.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          maxLength={LIMITS.promptMax}
          rows={2}
          placeholder={t("editor.promptPlaceholder")}
          className={`${inputClass} resize-y text-xl font-bold`}
        />
      </label>

      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-white/70">{t("editor.image")}</span>
          <ImageField value={q.imageUrl} onChange={(imageUrl) => set({ imageUrl })} quizId={quizId} editToken={editToken} />
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-white/70">{t("editor.timeLimit")}</span>
            <select
              value={q.timeLimitSec}
              onChange={(e) => set({ timeLimitSec: Number(e.target.value) })}
              className={`${inputClass} font-bold`}
            >
              {TIME_LIMIT_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-ink">
                  {t("editor.seconds", { n: s })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-white/70">{t("editor.points")}</span>
            <select
              value={q.pointsMultiplier}
              onChange={(e) => set({ pointsMultiplier: Number(e.target.value) })}
              className={`${inputClass} font-bold`}
            >
              {POINTS.map((p) => (
                <option key={p.value} value={p.value} className="bg-ink">
                  {t(p.key)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <AnswersEditor question={q} onChange={onChange} />
    </div>
  );
}

function AnswersEditor({ question: q, onChange }: { question: Question; onChange: (q: Question) => void }) {
  const { t } = useI18n();

  if (q.type === "text") {
    const answers = q.acceptedAnswers.length ? q.acceptedAnswers : [""];
    const setAnswers = (list: string[]) => onChange({ ...q, acceptedAnswers: list });
    return (
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-sm font-bold text-white/70">{t("editor.acceptedAnswers")}</span>
          <p className="text-xs text-white/50">{t("editor.acceptedHint")}</p>
        </div>
        {answers.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={a}
              onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={LIMITS.acceptedAnswerMax}
              placeholder={t("editor.acceptedPlaceholder", { n: i + 1 })}
              className={`${inputClass} font-bold`}
            />
            {answers.length > 1 && (
              <Button variant="ghost" aria-label={t("common.delete")} onClick={() => setAnswers(answers.filter((_, j) => j !== i))}>
                ✕
              </Button>
            )}
          </div>
        ))}
        {answers.length < LIMITS.acceptedAnswersMax && (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setAnswers([...answers, ""])}>
            + {t("editor.addAccepted")}
          </Button>
        )}
      </div>
    );
  }

  if (q.type === "true_false") {
    return (
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-white/70">{t("editor.pickCorrect")}</span>
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((o, i) => {
            const selected = o.isCorrect;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange({ ...q, options: trueFalseOptions(o.id as "true" | "false") })}
                aria-pressed={selected}
                className={`${optionBg(i, q.type, o.id)} flex h-20 items-center justify-center gap-3 rounded-2xl text-2xl font-black transition ${selected ? "ring-4 ring-white" : "opacity-50 hover:opacity-80"}`}
              >
                <OptionIcon index={i} type={q.type} optionId={o.id} className="size-8" />
                {t(o.id === "true" ? "tf.true" : "tf.false")}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const multi = q.type === "multi";
  const setOptions = (options: Question["options"]) => onChange({ ...q, options });
  const toggleCorrect = (id: string) =>
    setOptions(
      q.options.map((o) =>
        multi ? (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: o.id === id },
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-bold text-white/70">{t("editor.answers")}</span>
      <div className="grid gap-3 md:grid-cols-2">
        {q.options.map((o, i) => (
          <div key={o.id} className={`${optionBg(i, q.type, o.id)} flex items-center gap-2 rounded-2xl p-2 pl-3`}>
            <OptionIcon index={i} type={q.type} optionId={o.id} className="size-6 shrink-0" />
            <input
              value={o.text}
              onChange={(e) => setOptions(q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
              maxLength={LIMITS.optionTextMax}
              placeholder={t("editor.optionPlaceholder", { n: i + 1 })}
              className="min-w-0 flex-1 rounded-lg bg-black/20 px-3 py-2 font-bold text-white placeholder:text-white/60 outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="button"
              onClick={() => toggleCorrect(o.id)}
              aria-pressed={o.isCorrect}
              title={t("editor.markCorrect")}
              className={`flex size-9 shrink-0 items-center justify-center ${multi ? "rounded-lg" : "rounded-full"} ring-2 ring-white transition ${o.isCorrect ? "bg-white text-green-600" : "bg-transparent text-transparent hover:bg-white/20"}`}
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </button>
            {q.options.length > LIMITS.minOptions && (
              <button
                type="button"
                aria-label={t("common.delete")}
                onClick={() => setOptions(q.options.filter((x) => x.id !== o.id))}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-black/20"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {q.options.length < LIMITS.maxOptions && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setOptions([...q.options, { id: randomId(), text: "", isCorrect: false }])}
        >
          + {t("editor.addOption")}
        </Button>
      )}
    </div>
  );
}
