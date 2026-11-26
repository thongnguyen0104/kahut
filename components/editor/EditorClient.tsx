"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ErrorBanner, FullPageSpinner, LanguageToggle, Logo, Spinner, buttonClass, inputClass } from "@/components/ui";
import { api, errorCode } from "@/lib/client/api";
import { useHydrated } from "@/lib/client/hooks";
import { getQuizToken, saveHostSession, upsertMyQuiz } from "@/lib/client/storage";
import { LIMITS } from "@/lib/config";
import type { Question, Quiz, QuizContent } from "@/lib/game/types";
import { findQuizProblems, type QuizProblem } from "@/lib/game/validate";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";
import { ImageField } from "./ImageField";
import { QuestionEditor, newQuestion, randomId } from "./QuestionEditor";

const AUTOSAVE_MS = 1500;

export default function EditorClient() {
  const hydrated = useHydrated();
  const { id } = useParams<{ id: string }>();
  const urlToken = useSearchParams().get("k");
  if (!hydrated) return <FullPageSpinner />;
  return <EditorGate key={id} id={id} urlToken={urlToken} />;
}

function EditorGate({ id, urlToken }: { id: string; urlToken: string | null }) {
  const { t } = useI18n();
  const [token] = useState(() => urlToken || getQuizToken(id));
  if (!token) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-md text-lg font-bold">{t("editor.noToken")}</p>
        <Link href="/my-quizzes" className={buttonClass("secondary")}>
          {t("home.myQuizzes")}
        </Link>
      </div>
    );
  }
  return <Editor id={id} token={token} />;
}

function rememberQuiz(id: string, token: string, quiz: QuizContent, updatedAt: string) {
  upsertMyQuiz({ id, editToken: token, title: quiz.title, questionCount: quiz.questions.length, updatedAt });
}

function Editor({ id, token }: { id: string; token: string }) {
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
  const [copied, setCopied] = useState(false);

  const version = useRef(0);
  const savingRef = useRef(false);
  const quizRef = useRef<QuizContent | null>(null);
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);

  // Load once.
  useEffect(() => {
    let cancelled = false;
    api<{ quiz: Quiz }>(`/api/quizzes/${id}`, { token })
      .then(({ quiz: loaded }) => {
        if (cancelled) return;
        const content: QuizContent = {
          title: loaded.title,
          description: loaded.description,
          coverImageUrl: loaded.coverImageUrl,
          questions: loaded.questions.length ? loaded.questions : [newQuestion()],
        };
        setQuiz(content);
        setSelected(loaded.title ? 0 : -1);
        rememberQuiz(id, token, loaded, loaded.updatedAt);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorCode(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const save = useCallback(async (): Promise<boolean> => {
    const current = quizRef.current;
    if (!current || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const savedVersion = version.current;
    try {
      const res = await api<{ quiz: Quiz }>(`/api/quizzes/${id}`, { method: "PUT", token, body: current });
      rememberQuiz(id, token, res.quiz, res.quiz.updatedAt);
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
  }, [id, token]);

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
      const res = await api<{ pin: string; hostToken: string }>("/api/games", {
        method: "POST",
        token,
        body: { quizId: id },
      });
      saveHostSession({ pin: res.pin, hostToken: res.hostToken, quizId: id });
      router.push(`/host/${res.pin}`);
    } catch (err) {
      setError(errorCode(err));
      setStarting(false);
    }
  }

  const manageUrl = `${window.location.origin}/quiz/${id}/edit?k=${encodeURIComponent(token)}`;
  async function copyManageLink() {
    try {
      await navigator.clipboard.writeText(manageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("editor.manageLink"), manageUrl);
    }
  }

  const problemsFor = (index: number) => problems.filter((p) => p.questionIndex === index);
  const current = selected >= 0 ? quiz.questions[selected] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur">
        <Logo className="text-xl" />
        <input
          value={quiz.title}
          onChange={(e) => update((q) => ({ ...q, title: e.target.value }))}
          maxLength={LIMITS.titleMax}
          placeholder={t("editor.titlePlaceholder")}
          aria-label={t("editor.titlePlaceholder")}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-lg font-extrabold outline-none ring-line hover:ring-1 focus:ring-2 focus:ring-accent"
        />
        <span className="flex items-center gap-1.5 text-sm font-bold text-white/60">
          {saving ? (
            <>
              <Spinner className="size-4" /> {t("common.saving")}
            </>
          ) : dirty ? (
            t("common.unsaved")
          ) : (
            t("common.saved")
          )}
        </span>
        <Button variant="secondary" size="sm" onClick={() => void save()} disabled={saving || !dirty}>
          {t("common.save")}
        </Button>
        <Button size="md" onClick={() => void play()} disabled={starting}>
          {starting ? t("editor.starting") : t("editor.play")}
        </Button>
        <LanguageToggle />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <aside className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          <SidebarItem active={selected === -1} onClick={() => setSelected(-1)} warn={problemsFor(-1).length > 0}>
            <span className="font-extrabold">{t("editor.quizInfo")}</span>
          </SidebarItem>
          <p className="hidden px-1 pt-2 text-xs font-bold uppercase tracking-wider text-white/50 md:block">
            {t("editor.questions")} · {quiz.questions.length}
          </p>
          {quiz.questions.map((q, i) => (
            <SidebarItem key={q.id} active={selected === i} onClick={() => setSelected(i)} warn={problemsFor(i).length > 0}>
              <span className="text-xs font-bold text-white/60">
                {t("editor.question", { n: i + 1 })} · {t(`qtype.${q.type}`)}
              </span>
              <span className="line-clamp-2 text-sm font-bold">{q.prompt || t("editor.emptyPrompt")}</span>
            </SidebarItem>
          ))}
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={addQuestion}
            disabled={quiz.questions.length >= LIMITS.questionsMax}
          >
            + {t("editor.addQuestion")}
          </Button>
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          {showProblems && problems.length > 0 && <ProblemList problems={problems} onPick={setSelected} />}
          <ErrorBanner>{errorText(error)}</ErrorBanner>

          {selected === -1 && (
            <Card className="flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-white/70">{t("editor.titlePlaceholder")}</span>
                <input
                  value={quiz.title}
                  onChange={(e) => update((q) => ({ ...q, title: e.target.value }))}
                  maxLength={LIMITS.titleMax}
                  placeholder={t("editor.untitled")}
                  className={`${inputClass} text-xl font-extrabold`}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-white/70">{t("editor.description")}</span>
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
                <span className="text-sm font-bold text-white/70">{t("editor.cover")}</span>
                <ImageField
                  value={quiz.coverImageUrl}
                  onChange={(coverImageUrl) => update((q) => ({ ...q, coverImageUrl }))}
                  quizId={id}
                  editToken={token}
                  compact
                />
              </div>
              <div className="flex flex-col gap-2 rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/40">
                <span className="text-sm font-bold text-accent">{t("editor.manageLink")}</span>
                <div className="flex gap-2">
                  <input readOnly value={manageUrl} onFocus={(e) => e.target.select()} className={`${inputClass} text-sm`} />
                  <Button variant="secondary" onClick={() => void copyManageLink()}>
                    {copied ? t("common.copied") : t("common.copy")}
                  </Button>
                </div>
                <p className="text-xs text-white/70">{t("editor.manageLinkHint")}</p>
              </div>
            </Card>
          )}

          {current && (
            <Card className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-black">{t("editor.question", { n: selected + 1 })}</h2>
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
                  <Button variant="ghost" size="sm" onClick={() => duplicateQuestion(selected)}>
                    {t("editor.duplicate")}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-rose-300" onClick={() => deleteQuestion(selected)}>
                    {t("editor.deleteQuestion")}
                  </Button>
                </div>
              </div>
              <QuestionEditor
                key={current.id}
                question={current}
                onChange={(q) => setQuestion(selected, q)}
                quizId={id}
                editToken={token}
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
      className={`relative flex w-44 shrink-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left ring-1 transition md:w-auto ${active ? "bg-white/15 ring-accent" : "bg-white/5 ring-line hover:bg-white/10"}`}
    >
      {children}
      {warn && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-bad" />}
    </button>
  );
}

function ProblemList({ problems, onPick }: { problems: QuizProblem[]; onPick: (index: number) => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-2xl bg-bad/15 p-4 ring-1 ring-bad/40">
      <p className="mb-2 font-extrabold text-rose-200">{t("editor.fixBeforePlay")}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {problems.map((p, i) => (
          <li key={i}>
            <button type="button" className="text-left text-rose-100 underline-offset-2 hover:underline" onClick={() => onPick(p.questionIndex)}>
              {t(`problems.${p.code}`, { n: p.questionIndex + 1 })}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
