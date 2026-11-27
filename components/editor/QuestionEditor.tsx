"use client";

import { OptionBadge, OptionIcon, optionBg } from "@/components/options";
import { Button, inputBase, labelClass } from "@/components/ui";
import { LIMITS, TIME_LIMIT_OPTIONS } from "@/lib/config";
import { QUESTION_TYPES, type Question, type QuestionType } from "@/lib/game/types";
import { trueFalseOptions } from "@/lib/game/validate";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { AudioField } from "./AudioField";
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
      audioUrl: null,
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

/** Colour coding per question type (sidebar numbers, type picker). */
export const TYPE_TONE: Record<QuestionType, string> = {
  single: "bg-lilac",
  true_false: "bg-mint",
  multi: "bg-sun",
  text: "bg-bubble",
};

const TYPE_GLYPH: Record<QuestionType, string> = {
  single: "①",
  true_false: "✓✗",
  multi: "☑",
  text: "Aa",
};

const POINTS = [
  { value: 1, key: "editor.pointsStandard" },
  { value: 2, key: "editor.pointsDouble" },
  { value: 0, key: "editor.pointsNone" },
] as const;

/** Row of small pill buttons — quicker than a dropdown for a handful of choices. */
export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`press rounded-full border-2 border-ink px-3 py-1.5 font-display text-sm font-extrabold ${on ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function QuestionEditor({
  question,
  onChange,
  quizId,
}: {
  question: Question;
  onChange: (q: Question) => void;
  quizId: string;
}) {
  const { t } = useI18n();
  const q = question;
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <span className={labelClass}>{t("editor.type")}</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t("editor.type")}>
          {QUESTION_TYPES.map((type) => {
            const on = q.type === type;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(convertType(q, type))}
                className={`press flex items-center gap-2 rounded-xl border-3 border-ink px-3 py-2.5 text-left font-display text-sm font-extrabold ${on ? `${TYPE_TONE[type]} shadow-hard-sm` : "bg-white text-ink-soft hover:text-ink"}`}
              >
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-ink bg-white px-1 text-xs text-ink" aria-hidden>
                  {TYPE_GLYPH[type]}
                </span>
                {t(`qtype.${type}`)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-2.5">
        <span className={`flex justify-between ${labelClass}`}>
          {t("editor.prompt")}
          <span className="font-sans text-xs font-semibold tabular-nums text-ink-soft">
            {q.prompt.length}/{LIMITS.promptMax}
          </span>
        </span>
        <textarea
          value={q.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          maxLength={LIMITS.promptMax}
          rows={2}
          placeholder={t("editor.promptPlaceholder")}
          className={`${inputBase} resize-y font-display text-2xl font-extrabold`}
        />
      </label>

      <div className="grid gap-7 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-2.5">
          <span className={labelClass}>{t("editor.image")}</span>
          <ImageField value={q.imageUrl} onChange={(imageUrl) => set({ imageUrl })} quizId={quizId} />
          <span className={`mt-3 ${labelClass}`}>♪ {t("editor.questionAudio")}</span>
          <p className="-mt-1 text-sm font-medium text-ink-soft">{t("editor.questionAudioHint")}</p>
          <AudioField value={q.audioUrl ?? null} onChange={(audioUrl) => set({ audioUrl })} quizId={quizId} />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <span className={labelClass}>⏱ {t("editor.timeLimit")}</span>
            <Chips
              label={t("editor.timeLimit")}
              value={q.timeLimitSec}
              onChange={(timeLimitSec) => set({ timeLimitSec })}
              options={TIME_LIMIT_OPTIONS.map((s) => ({ value: s as number, label: `${s}s` }))}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <span className={labelClass}>★ {t("editor.points")}</span>
            <Chips
              label={t("editor.points")}
              value={q.pointsMultiplier}
              onChange={(pointsMultiplier) => set({ pointsMultiplier })}
              options={POINTS.map((p) => ({ value: p.value as number, label: t(p.key) }))}
            />
          </div>
        </div>
      </div>

      <AnswersEditor question={q} onChange={onChange} />
    </div>
  );
}

function CorrectToggle({ on, round, onClick, label }: { on: boolean; round: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`press flex size-10 shrink-0 items-center justify-center border-3 border-ink ${round ? "rounded-full" : "rounded-lg"} ${on ? "bg-mint shadow-hard-sm" : "bg-white text-transparent hover:text-ink/25"}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4.5 12.5l5 5 10-11" />
      </svg>
    </button>
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
          <span className={labelClass}>{t("editor.acceptedAnswers")}</span>
          <p className="text-sm text-ink-soft">{t("editor.acceptedHint")}</p>
        </div>
        {answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl border-3 border-ink bg-bubble p-2 shadow-hard-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-white font-display font-extrabold">
              {i + 1}
            </span>
            <input
              value={a}
              onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={LIMITS.acceptedAnswerMax}
              placeholder={t("editor.acceptedPlaceholder", { n: i + 1 })}
              className="min-w-0 flex-1 rounded-lg border-2 border-ink bg-white px-3 py-2 font-display text-lg font-extrabold outline-none placeholder:text-ink/30"
            />
            {answers.length > 1 && (
              <button
                type="button"
                aria-label={t("common.delete")}
                onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg font-bold hover:bg-white/60"
              >
                ✕
              </button>
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
        <span className={labelClass}>{t("editor.pickCorrect")}</span>
        <div className="grid grid-cols-2 gap-4">
          {q.options.map((o, i) => {
            const selected = o.isCorrect;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange({ ...q, options: trueFalseOptions(o.id as "true" | "false") })}
                aria-pressed={selected}
                className={`press relative flex h-24 items-center justify-center gap-3 rounded-2xl border-3 border-ink font-display text-3xl font-extrabold ${selected ? `${optionBg(i, q.type, o.id)} shadow-hard` : "hatched bg-white text-ink/40"}`}
              >
                <OptionIcon index={i} type={q.type} optionId={o.id} className="size-9" />
                {t(o.id === "true" ? "tf.true" : "tf.false")}
                {selected && (
                  <span className="absolute -right-3 -top-3 rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs" style={{ transform: "rotate(8deg)" }}>
                    ✓
                  </span>
                )}
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
      <span className={labelClass}>
        {t("editor.answers")} <span className="font-sans text-xs font-semibold text-ink-soft">— {t("editor.markCorrect")} ✓</span>
      </span>
      <div className="grid gap-4 md:grid-cols-2">
        {q.options.map((o, i) => (
          <div
            key={o.id}
            className={`flex items-center gap-2 rounded-2xl border-3 border-ink p-2 ${optionBg(i, q.type, o.id)} ${o.isCorrect ? "shadow-hard" : "shadow-hard-sm"}`}
          >
            <OptionBadge index={i} type={q.type} optionId={o.id} size="sm" />
            <input
              value={o.text}
              onChange={(e) => setOptions(q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
              maxLength={LIMITS.optionTextMax}
              placeholder={t("editor.optionPlaceholder", { n: i + 1 })}
              className="min-w-0 flex-1 rounded-lg border-2 border-ink bg-white px-3 py-2 font-display text-lg font-extrabold outline-none placeholder:text-ink/30"
            />
            <CorrectToggle on={o.isCorrect} round={!multi} onClick={() => toggleCorrect(o.id)} label={t("editor.markCorrect")} />
            {q.options.length > LIMITS.minOptions && (
              <button
                type="button"
                aria-label={t("common.delete")}
                onClick={() => setOptions(q.options.filter((x) => x.id !== o.id))}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg font-bold hover:bg-white/50"
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
