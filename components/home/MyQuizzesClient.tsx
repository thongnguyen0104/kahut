"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorBanner, FullPageSpinner, TopBar, buttonClass } from "@/components/ui";
import { api, errorCode } from "@/lib/client/api";
import { useHydrated } from "@/lib/client/hooks";
import { listMyQuizzes, removeMyQuiz, saveHostSession, upsertMyQuiz, type SavedQuiz } from "@/lib/client/storage";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function MyQuizzesClient() {
  const hydrated = useHydrated();
  if (!hydrated) return <FullPageSpinner />;
  return <MyQuizzes />;
}

function MyQuizzes() {
  const { t, locale } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>(() => listMyQuizzes());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; code: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const editUrl = (q: SavedQuiz) => `/quiz/${q.id}/edit?k=${encodeURIComponent(q.editToken)}`;

  async function play(q: SavedQuiz) {
    setBusyId(q.id);
    setError(null);
    try {
      const res = await api<{ pin: string; hostToken: string }>("/api/games", {
        method: "POST",
        token: q.editToken,
        body: { quizId: q.id },
      });
      saveHostSession({ pin: res.pin, hostToken: res.hostToken, quizId: q.id });
      router.push(`/host/${res.pin}`);
    } catch (err) {
      setError({ id: q.id, code: errorCode(err) });
      setBusyId(null);
    }
  }

  function remove(q: SavedQuiz) {
    if (!window.confirm(t("myQuizzes.removeConfirm"))) return;
    removeMyQuiz(q.id);
    setQuizzes(listMyQuizzes());
  }

  async function create() {
    setCreating(true);
    try {
      const { id, editToken } = await api<{ id: string; editToken: string }>("/api/quizzes", {
        method: "POST",
        body: { title: "" },
      });
      upsertMyQuiz({ id, editToken, title: "", questionCount: 0, updatedAt: new Date().toISOString() });
      router.push(`/quiz/${id}/edit?k=${encodeURIComponent(editToken)}`);
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-12 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black">{t("myQuizzes.title")}</h1>
          <Button onClick={() => void create()} disabled={creating}>
            {creating ? t("home.creating") : `+ ${t("home.createQuiz")}`}
          </Button>
        </div>
        <p className="text-sm text-white/60">{t("myQuizzes.hint")}</p>
        {error?.id === "" && <ErrorBanner>{errorText(error.code)}</ErrorBanner>}

        {quizzes.length === 0 ? (
          <Card className="text-center text-white/70">{t("myQuizzes.empty")}</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-extrabold">{q.title || t("editor.untitled")}</h2>
                      <p className="text-sm text-white/60">
                        {t("myQuizzes.questionsCount", { count: q.questionCount })} ·{" "}
                        {t("myQuizzes.updated", { date: dateFormat.format(new Date(q.updatedAt)) })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={editUrl(q)} className={buttonClass("secondary", "sm")}>
                        {t("myQuizzes.edit")}
                      </Link>
                      <Button size="sm" onClick={() => void play(q)} disabled={busyId !== null}>
                        {busyId === q.id ? t("editor.starting") : t("myQuizzes.play")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(q)} aria-label={t("myQuizzes.remove")}>
                        ✕
                      </Button>
                    </div>
                  </div>
                  {error?.id === q.id && <ErrorBanner>{errorText(error.code)}</ErrorBanner>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
