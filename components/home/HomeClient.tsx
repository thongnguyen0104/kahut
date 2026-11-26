"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionIcon } from "@/components/options";
import { Button, Card, ErrorBanner, Tag, TopBar, buttonClass } from "@/components/ui";
import { cleanPin, errorCode } from "@/lib/client/api";
import { authApi, useAuth } from "@/lib/client/auth";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

/** Decorative answer-stickers scattered around the hero (desktop only). */
function Scatter() {
  // Kept in the left gutter / right margin so they never cover the headline.
  const items = [
    { i: 0, bg: "bg-opt-0", pos: "left-0 top-[24%]", tilt: -12, size: "size-12" },
    { i: 1, bg: "bg-opt-1", pos: "left-[52%] top-[6%]", tilt: 10, size: "size-11" },
    { i: 2, bg: "bg-opt-2", pos: "right-[2%] top-[30%]", tilt: 8, size: "size-14" },
    { i: 3, bg: "bg-opt-3", pos: "left-0 bottom-[12%]", tilt: -6, size: "size-10" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      {items.map(({ i, bg, pos, tilt, size }) => (
        <span
          key={i}
          className={`absolute flex items-center justify-center rounded-2xl border-3 border-ink shadow-hard-sm ${bg} ${pos} ${size}`}
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          <OptionIcon index={i} type="single" optionId="" className="size-1/2 text-white" />
        </span>
      ))}
    </div>
  );
}

export default function HomeClient() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const { loading, user } = useAuth();
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
      const { id } = await authApi<{ id: string }>("/api/quizzes", { method: "POST", body: { title: "" } });
      router.push(`/quiz/${id}/edit`);
    } catch (err) {
      setError(errorCode(err));
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-16 pt-2 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Hero: second on phones (players come here to type a PIN), first on desktop. */}
        <section className="relative order-2 flex flex-col gap-7 py-4 lg:order-1 lg:py-12">
          <Scatter />
          <div className="relative flex flex-col items-start gap-5 lg:pl-16">
            <Tag tone="mint">{t("home.kicker")}</Tag>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl">
              <span className="block">{t("home.headlineA")}</span>
              <span className="my-1 inline-block rounded-2xl border-3 border-ink bg-sun px-3 pb-1 shadow-hard" style={{ transform: "rotate(-2deg)" }}>
                {t("home.headlineB")}
              </span>
              <span className="block">{t("home.headlineC")}</span>
            </h1>
            <p className="max-w-md text-lg font-medium text-ink-soft">{t("home.tagline")}</p>
          </div>

          <ol className="relative grid gap-3 sm:grid-cols-3 lg:pl-16">
            {(["home.how1", "home.how2", "home.how3"] as const).map((key, i) => (
              <li
                key={key}
                className="sticker flex gap-3 bg-white p-4 text-sm font-medium sm:flex-col"
                style={{ transform: `rotate(${[-1.2, 0.8, -0.6][i]}deg)` }}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-lilac font-display font-extrabold">
                  {i + 1}
                </span>
                {t(key)}
              </li>
            ))}
          </ol>
        </section>

        {/* Join + host: first on phones. */}
        <section className="order-1 flex flex-col gap-6 lg:order-2">
          <Card className="relative flex flex-col gap-4 p-6 sm:p-8" style={{ transform: "rotate(0.8deg)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-extrabold">{t("home.playTitle")}</h2>
              <Tag tone="bubble" tilt={4}>
                PIN
              </Tag>
            </div>
            <form onSubmit={join} className="flex flex-col gap-4">
              <input
                value={pin}
                onChange={(e) => setPin(cleanPin(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
                aria-label={t("home.pinPlaceholder")}
                placeholder="000000"
                className="h-20 w-full rounded-2xl border-3 border-ink bg-paper-2 text-center font-display text-5xl font-extrabold tracking-[0.25em] tabular-nums outline-none placeholder:text-ink/20 focus:bg-white focus:shadow-hard-sm"
              />
              <p className="-mt-2 text-sm font-medium text-ink-soft">{t("home.pinHint")}</p>
              <Button type="submit" size="xl" className="w-full">
                {t("home.join")} →
              </Button>
            </form>
          </Card>

          <ErrorBanner>{errorText(error)}</ErrorBanner>

          <Card tone="lilac" className="flex flex-col gap-3" style={{ transform: "rotate(-0.6deg)" }}>
            <h2 className="text-xl font-extrabold">{t("home.hostTitle")}</h2>
            {loading ? (
              <div className="h-12" />
            ) : user ? (
              <div className="flex flex-wrap gap-3">
                <Button variant="dark" className="flex-1" onClick={createQuiz} disabled={creating}>
                  + {creating ? t("home.creating") : t("home.createQuiz")}
                </Button>
                <Link href="/my-quizzes" className={buttonClass("secondary", "md", "flex-1")}>
                  {t("home.myQuizzes")}
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login?next=%2Fmy-quizzes" className={buttonClass("dark", "md")}>
                  {t("auth.loginToCreate")}
                </Link>
                <p className="text-sm font-medium">{t("home.hostHint")}</p>
              </>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
