"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorBanner, TopBar, buttonClass, inputClass } from "@/components/ui";
import { api, cleanPin, errorCode } from "@/lib/client/api";
import { upsertMyQuiz } from "@/lib/client/storage";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function HomeClient() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) {
      setError("invalid_pin");
      return;
    }
    router.push(`/join?pin=${pin}`);
  }

  async function createQuiz() {
    setCreating(true);
    setError(null);
    try {
      const { id, editToken } = await api<{ id: string; editToken: string }>("/api/quizzes", {
        method: "POST",
        body: { title: "" },
      });
      upsertMyQuiz({ id, editToken, title: "", questionCount: 0, updatedAt: new Date().toISOString() });
      router.push(`/quiz/${id}/edit?k=${encodeURIComponent(editToken)}`);
    } catch (err) {
      setError(errorCode(err));
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 pb-16">
        <p className="animate-rise text-center text-lg font-semibold text-white/80">{t("home.tagline")}</p>

        <Card className="animate-rise">
          <form onSubmit={join} className="flex flex-col gap-3">
            <input
              value={pin}
              onChange={(e) => setPin(cleanPin(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              aria-label={t("home.pinPlaceholder")}
              placeholder={t("home.pinPlaceholder")}
              className={`${inputClass} h-16 text-center text-3xl font-black tracking-[0.3em] placeholder:tracking-normal placeholder:text-xl`}
            />
            <Button type="submit" size="lg" className="w-full">
              {t("home.join")}
            </Button>
          </form>
        </Card>

        <ErrorBanner>{errorText(error)}</ErrorBanner>

        <section className="flex flex-col gap-3 text-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">{t("home.hostTitle")}</h2>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={createQuiz} disabled={creating}>
              {creating ? t("home.creating") : t("home.createQuiz")}
            </Button>
            <Link href="/my-quizzes" className={buttonClass("secondary", "md", "flex-1")}>
              {t("home.myQuizzes")}
            </Link>
          </div>
        </section>

        <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-line">
          <h2 className="mb-3 font-extrabold">{t("home.howTitle")}</h2>
          <ol className="flex flex-col gap-2 text-white/80">
            {(["home.how1", "home.how2", "home.how3"] as const).map((key, i) => (
              <li key={key} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-ink">
                  {i + 1}
                </span>
                {t(key)}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
