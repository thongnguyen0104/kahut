"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorBanner, FullPageSpinner, PageTitle, Spinner, TONE_BG, TopBar, buttonClass, type Tone } from "@/components/ui";
import type { QuizSummary } from "@/lib/accounts";
import { errorCode } from "@/lib/client/api";
import { authApi, useAuth, useRequireAuth } from "@/lib/client/auth";
import { saveHostSession } from "@/lib/client/storage";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

const COVER_TONES: Tone[] = ["lilac", "sun", "bubble", "mint", "sky"];

function toneFor(id: string): Tone {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COVER_TONES[Math.abs(h) % COVER_TONES.length];
}

export default function MyQuizzesClient() {
  const { ready } = useRequireAuth();
  if (!ready) return <FullPageSpinner />;
  return <MyQuizzes />;
}

function MyQuizzes() {
  const { t, locale } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; code: string } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    authApi<{ quizzes: QuizSummary[] }>("/api/quizzes").then(
      (res) => setQuizzes(res.quizzes),
      (err) => setError({ id: "", code: errorCode(err) }),
    );
  }, []);

  async function play(q: QuizSummary) {
    setBusyId(q.id);
    setError(null);
    try {
      const res = await authApi<{ pin: string; hostToken: string }>("/api/games", {
        method: "POST",
        body: { quizId: q.id },
      });
      saveHostSession({ pin: res.pin, hostToken: res.hostToken, quizId: q.id });
      router.push(`/host/${res.pin}`);
    } catch (err) {
      setError({ id: q.id, code: errorCode(err) });
      setBusyId(null);
    }
  }

  async function remove(q: QuizSummary) {
    if (!window.confirm(t("myQuizzes.deleteConfirm", { title: q.title || t("editor.untitled") }))) return;
    setBusyId(q.id);
    setError(null);
    try {
      await authApi(`/api/quizzes/${q.id}`, { method: "DELETE" });
      setQuizzes((list) => list?.filter((x) => x.id !== q.id) ?? null);
    } catch (err) {
      setError({ id: q.id, code: errorCode(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const { id } = await authApi<{ id: string }>("/api/quizzes", { method: "POST", body: { title: "" } });
      router.push(`/quiz/${id}/edit`);
    } catch (err) {
      setError({ id: "", code: errorCode(err) });
      setCreating(false);
    }
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 pb-12 pt-2 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle label={quizzes ? `${quizzes.length} quiz` : undefined} tone="mint">
            {user?.isSuperadmin ? t("myQuizzes.allTitle") : t("myQuizzes.title")}
          </PageTitle>
          <Button size="lg" onClick={() => void create()} disabled={creating}>
            + {creating ? t("home.creating") : t("home.createQuiz")}
          </Button>
        </div>
        {error?.id === "" && <ErrorBanner>{errorText(error.code)}</ErrorBanner>}

        {!quizzes ? (
          !error && (
            <div className="flex justify-center py-12">
              <Spinner className="size-8" />
            </div>
          )
        ) : quizzes.length === 0 ? (
          <button
            type="button"
            onClick={() => void create()}
            className="flex flex-col items-center gap-3 rounded-3xl border-3 border-dashed border-ink/50 px-6 py-14 text-center transition hover:border-ink hover:bg-white"
          >
            <span className="animate-wiggle flex size-16 items-center justify-center rounded-2xl border-3 border-ink bg-sun font-display text-4xl font-extrabold shadow-hard">
              +
            </span>
            <span className="max-w-sm font-display text-xl font-extrabold">{t("myQuizzes.empty")}</span>
          </button>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q, i) => (
              <li key={q.id} className="sticker flex flex-col overflow-hidden bg-white" style={{ transform: `rotate(${[-0.8, 0.6, -0.4][i % 3]}deg)` }}>
                {/* "Box art": cover image, or a coloured panel with the first letter. */}
                <div className={`relative flex h-36 items-center justify-center border-b-3 border-ink ${q.coverImageUrl ? "bg-paper-2" : TONE_BG[toneFor(q.id)]}`}>
                  {q.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.coverImageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="font-display text-7xl font-extrabold opacity-90">
                      {(q.title || "?").trim().slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 font-display text-xs font-extrabold">
                    {t("myQuizzes.questionsCount", { count: q.questionCount })}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <h2 className="line-clamp-2 text-xl font-extrabold leading-tight">{q.title || t("editor.untitled")}</h2>
                  <p className="text-xs font-medium text-ink-soft">
                    {t("myQuizzes.updated", { date: dateFormat.format(new Date(q.updatedAt)) })}
                  </p>
                  {user?.isSuperadmin && !q.mine && (
                    <p className="truncate text-xs font-semibold">
                      {t("myQuizzes.owner", { email: q.ownerEmail ?? t("myQuizzes.noOwner") })}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Button size="sm" onClick={() => void play(q)} disabled={busyId !== null} className="flex-1">
                      ▶ {busyId === q.id ? t("editor.starting") : t("myQuizzes.play")}
                    </Button>
                    <Link href={`/quiz/${q.id}/edit`} className={buttonClass("secondary", "sm")}>
                      {t("myQuizzes.edit")}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(q)}
                      disabled={busyId !== null}
                      aria-label={t("myQuizzes.delete")}
                      title={t("myQuizzes.delete")}
                      className="px-2.5 hover:text-tomato-deep hover:no-underline"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                      </svg>
                    </Button>
                  </div>
                  {error?.id === q.id && (
                    <div className="pt-2">
                      <ErrorBanner>{errorText(error.code)}</ErrorBanner>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
