"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiGenerateDialog, type AiAppendResult } from "@/components/ai/AiGenerateDialog";
import { Button, Card, ErrorBanner, FullPageSpinner, LanguageToggle, Logo, Notice, Spinner, Tag, buttonClass, inputBase, inputClass, labelClass } from "@/components/ui";
import { errorCode } from "@/lib/client/api";
import { authApi, useAuth, useRequireAuth } from "@/lib/client/auth";
import { saveHostSession } from "@/lib/client/storage";
import { LIMITS } from "@/lib/config";
import type { Question, Quiz, QuizContent } from "@/lib/game/types";
import { findQuizProblems, type QuizProblem } from "@/lib/game/validate";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";
import { AudioField } from "./AudioField";
import { ImageField } from "./ImageField";
import { QuestionEditor, TYPE_TONE, newQuestion, randomId } from "./QuestionEditor";

const AUTOSAVE_MS = 1500;

/** The untouched question a new quiz starts with; AI questions replace it instead of following it. */
function isBlankQuestion(q: Question): boolean {
  return (
    !q.prompt.trim() &&
    !q.imageUrl &&
    !q.audioUrl &&
    q.acceptedAnswers.length === 0 &&
    q.options.every((o) => !o.text.trim() && !o.isCorrect)
  );
}

export default function EditorClient() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useRequireAuth();
  if (!ready) return <FullPageSpinner />;
  return <Editor key={id} id={id} />;
}

function Editor({ id }: { id: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();

  const [quiz, setQuiz] = useState<QuizContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0); // -1 = quiz details
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const { user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const version = useRef(0);
  const savingRef = useRef(false);
  const quizRef = useRef<QuizContent | null>(null);
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);

  // Load once.
  useEffect(() => {
    let cancelled = false;
    authApi<{ quiz: Quiz }>(`/api/quizzes/${id}`)
      .then(({ quiz: loaded }) => {
        if (cancelled) return;
        const content: QuizContent = {
          title: loaded.title,
          description: loaded.description,
          coverImageUrl: loaded.coverImageUrl,
          musicUrl: loaded.musicUrl ?? null,
          questions: loaded.questions.length ? loaded.questions : [newQuestion()],
        };
        setQuiz(content);
        setSelected(loaded.title ? 0 : -1);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorCode(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(async (): Promise<boolean> => {
    const current = quizRef.current;
    if (!current || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const savedVersion = version.current;
    try {
      await authApi<{ quiz: Quiz }>(`/api/quizzes/${id}`, { method: "PUT", body: current });
      // Keep the local copy (the user may still be typing); clear dirty only if nothing changed meanwhile.
      if (version.current === savedVersion) setDirty(false);
      setError(null);
      return true;
    } catch (err) {
      setError(errorCode(err));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [id]);

  // Autosave shortly after the last edit.
  useEffect(() => {
    if (!dirty || saving) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [quiz, dirty, saving, save]);

  // Warn before leaving with unsaved changes; Ctrl/Cmd+S saves.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown);
    };
  }, [dirty, save]);

  const problems = useMemo(() => (quiz ? findQuizProblems(quiz) : []), [quiz]);

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <ErrorBanner>
          {t("editor.loadError")} {errorText(loadError)}
        </ErrorBanner>
        <Link href="/my-quizzes" className={buttonClass("secondary")}>
          {t("home.myQuizzes")}
        </Link>
      </div>
    );
  }
  if (!quiz) return <FullPageSpinner />;

  function update(fn: (q: QuizContent) => QuizContent) {
    version.current += 1;
    setQuiz((q) => (q ? fn(q) : q));
    setDirty(true);
  }

  const setQuestion = (index: number, next: Question) =>
    update((q) => ({ ...q, questions: q.questions.map((x, i) => (i === index ? next : x)) }));

  function addQuestion() {
    if (!quiz || quiz.questions.length >= LIMITS.questionsMax) return;
    update((q) => ({ ...q, questions: [...q.questions, newQuestion()] }));
    setSelected(quiz.questions.length);
  }

  // A lone blank starter question gets replaced by AI questions rather than kept in front of them.
  const replaceBlank = quiz.questions.length === 1 && isBlankQuestion(quiz.questions[0]);
  const keptCount = replaceBlank ? 0 : quiz.questions.length;
  const aiRoom = LIMITS.questionsMax - keptCount;

  function appendAiQuestions(res: AiAppendResult) {
    const added = res.questions.slice(0, aiRoom);
    if (added.length === 0) return;
    update((q) => ({
      ...q,
      title: q.title.trim() ? q.title : res.title,
      description: q.description.trim() ? q.description : res.description,
      questions: [...(replaceBlank ? [] : q.questions), ...added],
    }));
    setSelected(keptCount);
    setAiNotice(
      added.length < res.requested
        ? t("ai.addedPartial", { count: added.length, requested: res.requested })
        : t("ai.added", { count: added.length }),
    );
  }

  function duplicateQuestion(index: number) {
    if (!quiz || quiz.questions.length >= LIMITS.questionsMax) return;
    update((q) => {
      const copy = { ...q.questions[index], id: randomId() };
      copy.options = copy.options.map((o) => ({ ...o, id: copy.type === "true_false" ? o.id : randomId() }));
      const questions = [...q.questions];
      questions.splice(index + 1, 0, copy);
      return { ...q, questions };
    });
    setSelected(index + 1);
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (!quiz || target < 0 || target >= quiz.questions.length) return;
    update((q) => {
      const questions = [...q.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...q, questions };
    });
    setSelected(target);
  }

  function deleteQuestion(index: number) {
    if (!window.confirm(t("editor.deleteConfirm"))) return;
    update((q) => ({ ...q, questions: q.questions.filter((_, i) => i !== index) }));
    setSelected((s) => Math.max(0, Math.min(s, (quiz?.questions.length ?? 1) - 2)));
  }

  async function play() {
    setShowProblems(true);
    if (problems.length > 0) return;
    setStarting(true);
    if (dirty && !(await save())) {
      setStarting(false);
      return;
    }
    try {
      const res = await authApi<{ pin: string; hostToken: string }>("/api/games", {
        method: "POST",
        body: { quizId: id },
      });
      saveHostSession({ pin: res.pin, hostToken: res.hostToken, quizId: id });
      router.push(`/host/${res.pin}`);
    } catch (err) {
      setError(errorCode(err));
      setStarting(false);
    }
  }

  const problemsFor = (index: number) => problems.filter((p) => p.questionIndex === index);
  const current = selected >= 0 ? quiz.questions[selected] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b-3 border-ink bg-paper px-4 py-3">
        <Logo className="text-xl" />
        <Link href="/my-quizzes" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
          ← {t("home.myQuizzes")}
        </Link>
        <input
          value={quiz.title}
          onChange={(e) => update((q) => ({ ...q, title: e.target.value }))}
          maxLength={LIMITS.titleMax}
          placeholder={t("editor.titlePlaceholder")}
          aria-label={t("editor.titlePlaceholder")}
          className="min-w-0 flex-1 rounded-xl border-3 border-transparent bg-transparent px-2 py-1 font-display text-2xl font-extrabold outline-none placeholder:text-ink/30 hover:border-ink/20 focus:border-ink focus:bg-white"
        />
        <span
          className={`flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${saving ? "bg-white" : dirty ? "bg-sun" : "bg-mint"}`}
        >
          {saving ? (
            <>
              <Spinner className="size-3.5" /> {t("common.saving")}
            </>
          ) : dirty ? (
            t("common.unsaved")
          ) : (
            `✓ ${t("common.saved")}`
          )}
        </span>
        <Button variant="secondary" size="sm" onClick={() => void save()} disabled={saving || !dirty}>
          {t("common.save")}
        </Button>
        <Button size="md" onClick={() => void play()} disabled={starting}>
          ▶ {starting ? t("editor.starting") : t("editor.play")}
        </Button>
        <LanguageToggle />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 sm:p-6 md:grid-cols-[260px_1fr]">
        <aside className="flex gap-3 overflow-x-auto pb-2 md:flex-col md:overflow-visible">
          <SidebarItem active={selected === -1} onClick={() => setSelected(-1)} warn={problemsFor(-1).length > 0}>
            <span className="flex items-center gap-2 font-display font-extrabold">
              <span className="flex size-7 items-center justify-center rounded-lg border-2 border-ink bg-white" aria-hidden>
                ✎
              </span>
              {t("editor.quizInfo")}
            </span>
          </SidebarItem>
          <p className="hidden px-1 pt-2 font-display text-sm font-extrabold md:block">
            {t("editor.questions")} · {quiz.questions.length}
          </p>
          {quiz.questions.map((q, i) => (
            <SidebarItem key={q.id} active={selected === i} onClick={() => setSelected(i)} warn={problemsFor(i).length > 0}>
              <span className="flex w-full items-start gap-2.5">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink font-display font-extrabold ${TYPE_TONE[q.type]}`}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                    {t(`qtype.${q.type}`)}
                    {q.audioUrl && <span title={t("editor.questionAudio")}> · ♪</span>}
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">
                    {q.prompt || <span className="text-ink/40">{t("editor.emptyPrompt")}</span>}
                  </span>
                </span>
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.imageUrl} alt="" className="size-10 shrink-0 rounded-md border-2 border-ink object-cover" />
                )}
              </span>
            </SidebarItem>
          ))}
          <button
            type="button"
            onClick={addQuestion}
            disabled={quiz.questions.length >= LIMITS.questionsMax}
            className="flex w-44 shrink-0 items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-ink/50 py-4 font-display font-extrabold transition hover:border-ink hover:bg-white disabled:opacity-40 md:w-auto"
          >
            + {t("editor.addQuestion")}
          </button>
          {user?.isSuperadmin && (
            <button
              type="button"
              onClick={() => {
                setAiNotice(null);
                setAiOpen(true);
              }}
              disabled={aiRoom <= 0}
              title={aiRoom <= 0 ? t("ai.full", { max: LIMITS.questionsMax }) : undefined}
              className="press flex w-52 shrink-0 items-center justify-center gap-2 rounded-2xl border-3 border-ink bg-lilac py-4 font-display font-extrabold shadow-hard-sm disabled:opacity-40 md:w-auto"
            >
              ✦ {t("ai.appendButton")}
            </button>
          )}
        </aside>

        {aiOpen && (
          <AiGenerateDialog
            mode="append"
            quizId={id}
            maxCount={aiRoom}
            onAppend={appendAiQuestions}
            onClose={() => setAiOpen(false)}
          />
        )}

        <main className="flex min-w-0 flex-col gap-5">
          {showProblems && problems.length > 0 && <ProblemList problems={problems} onPick={setSelected} />}
          <Notice>{aiNotice}</Notice>
          <ErrorBanner>{errorText(error)}</ErrorBanner>

          {selected === -1 && (
            <Card className="flex flex-col gap-5">
              <Tag tone="lilac">{t("editor.quizInfo")}</Tag>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{t("editor.titlePlaceholder")}</span>
                <input
                  value={quiz.title}
                  onChange={(e) => update((q) => ({ ...q, title: e.target.value }))}
                  maxLength={LIMITS.titleMax}
                  placeholder={t("editor.untitled")}
                  className={`${inputBase} font-display text-2xl font-extrabold`}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{t("editor.description")}</span>
                <textarea
                  value={quiz.description}
                  onChange={(e) => update((q) => ({ ...q, description: e.target.value }))}
                  maxLength={LIMITS.descriptionMax}
                  rows={3}
                  placeholder={t("editor.descriptionPlaceholder")}
                  className={`${inputClass} resize-y`}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className={labelClass}>{t("editor.cover")}</span>
                <ImageField
                  value={quiz.coverImageUrl}
                  onChange={(coverImageUrl) => update((q) => ({ ...q, coverImageUrl }))}
                  quizId={id}
                  compact
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className={labelClass}>♪ {t("editor.music")}</span>
                <p className="text-sm font-medium text-ink-soft">{t("editor.musicHint")}</p>
                <AudioField
                  value={quiz.musicUrl ?? null}
                  onChange={(musicUrl) => update((q) => ({ ...q, musicUrl }))}
                  quizId={id}
                />
              </div>
            </Card>
          )}

          {current && (
            <Card className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 text-3xl font-extrabold">
                  <span
                    className={`flex size-11 items-center justify-center rounded-xl border-3 border-ink shadow-hard-sm ${TYPE_TONE[current.type]}`}
                  >
                    {selected + 1}
                  </span>
                  {t("editor.question", { n: selected + 1 })}
                </h2>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveQuestion(selected, -1)} disabled={selected === 0}>
                    ↑ {t("editor.moveUp")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveQuestion(selected, 1)}
                    disabled={selected === quiz.questions.length - 1}
                  >
                    ↓ {t("editor.moveDown")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => duplicateQuestion(selected)}>
                    ⧉ {t("editor.duplicate")}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => deleteQuestion(selected)}>
                    {t("editor.deleteQuestion")}
                  </Button>
                </div>
              </div>
              <QuestionEditor
                key={current.id}
                question={current}
                onChange={(q) => setQuestion(selected, q)}
                quizId={id}
              />
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarItem({
  active,
  warn,
  onClick,
  children,
}: {
  active: boolean;
  warn: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`press relative flex w-52 shrink-0 flex-col items-start rounded-2xl border-3 border-ink p-2.5 text-left md:w-auto ${active ? "bg-sun shadow-hard" : "bg-white shadow-hard-sm"}`}
    >
      {children}
      {warn && (
        <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border-2 border-ink bg-tomato font-display text-xs font-black">
          !
        </span>
      )}
    </button>
  );
}

function ProblemList({ problems, onPick }: { problems: QuizProblem[]; onPick: (index: number) => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-2xl border-3 border-ink bg-tomato-soft p-4 shadow-hard-sm">
      <p className="mb-2 font-display font-extrabold">{t("editor.fixBeforePlay")}</p>
      <ul className="flex flex-col gap-1 text-sm font-semibold">
        {problems.map((p, i) => (
          <li key={i}>
            <button type="button" className="text-left underline decoration-2 underline-offset-2 hover:decoration-tomato" onClick={() => onPick(p.questionIndex)}>
              → {t(`problems.${p.code}`, { n: p.questionIndex + 1 })}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
