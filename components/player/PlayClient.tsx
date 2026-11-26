"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CountdownRing, ReadBar } from "@/components/Countdown";
import { CheckBadge, CrossBadge, OptionIcon, optionBg } from "@/components/options";
import { Button, ErrorBanner, FullPageSpinner, Spinner, buttonClass, inputClass } from "@/components/ui";
import { api, errorCode } from "@/lib/client/api";
import { useHydrated, useServerNow } from "@/lib/client/hooks";
import { clearPlayerSession, getPlayerSession, type PlayerSession } from "@/lib/client/storage";
import { useGame } from "@/lib/client/useGame";
import { LIMITS, READ_TIME_MS } from "@/lib/config";
import type { GameView, PlayerView, PublicQuestion, SubmittedAnswer } from "@/lib/game/types";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function PlayClient() {
  const hydrated = useHydrated();
  const { pin } = useParams<{ pin: string }>();
  if (!hydrated) return <FullPageSpinner />;
  return <PlayGate pin={pin} />;
}

function PlayGate({ pin }: { pin: string }) {
  const router = useRouter();
  const [session] = useState(() => getPlayerSession(pin));
  useEffect(() => {
    if (!session) router.replace(`/join?pin=${pin}`);
  }, [session, pin, router]);
  if (!session) return <FullPageSpinner />;
  return <PlayGame session={session} />;
}

function PlayGame({ session }: { session: PlayerSession }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const game = useGame(session.pin, { token: session.playerToken, presenceKey: session.playerId });
  const { view, source, refresh } = game;
  const me = view?.players.find((p) => p.id === session.playerId) ?? null;

  // A broadcast built just before we joined may not list us yet: double-check.
  const missingFromBroadcast = Boolean(view && !me && source === "broadcast");
  useEffect(() => {
    if (missingFromBroadcast) void refresh();
  }, [missingFromBroadcast, refresh]);

  const kicked =
    game.kickedIds.has(session.playerId) ||
    game.error === "kicked" ||
    Boolean(view && !me && source === "fetch");

  if (kicked) {
    return (
      <Centered>
        <p className="text-xl font-bold">{t("play.kicked")}</p>
        <Link href="/" className={buttonClass("secondary")} onClick={() => clearPlayerSession(session.pin)}>
          {t("play.otherRoom")}
        </Link>
      </Centered>
    );
  }

  if (!view) {
    if (game.error) {
      return (
        <Centered>
          <ErrorBanner>{errorText(game.error)}</ErrorBanner>
          <Button variant="secondary" onClick={() => void refresh()}>
            {t("common.retry")}
          </Button>
        </Centered>
      );
    }
    return <FullPageSpinner />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 bg-black/20 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar id={session.avatar} size={36} />
          <span className="truncate font-extrabold">{session.nickname}</span>
        </div>
        <div className="flex items-center gap-3">
          {!game.connected && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
              <Spinner className="size-3.5" />
              {t("play.reconnecting")}
            </span>
          )}
          <span className="rounded-lg bg-white/10 px-3 py-1 font-black tabular-nums">{me?.score ?? 0}</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4">
        <PlayScreen view={view} me={me} session={session} />
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center animate-rise">
      {children}
    </div>
  );
}

function PlayScreen({ view, me, session }: { view: GameView; me: PlayerView | null; session: PlayerSession }) {
  const { t } = useI18n();

  switch (view.status) {
    case "lobby":
      return (
        <Centered>
          <Avatar id={session.avatar} size={112} className="animate-pop" />
          <h1 className="text-3xl font-black">{t("play.waitingTitle")}</h1>
          <p className="max-w-xs text-white/70">{t("play.waitingHint")}</p>
          <p className="text-sm text-white/50">{view.quizTitle}</p>
        </Centered>
      );
    case "question":
      return view.question ? (
        <QuestionPhase key={view.questionIndex} view={view} question={view.question} session={session} />
      ) : null;
    case "reveal":
    case "leaderboard":
      return <ResultPhase view={view} me={me} playerId={session.playerId} />;
    case "finished":
      return <FinalPhase view={view} me={me} />;
  }
}

function QuestionHeader({ view, question }: { view: GameView; question: PublicQuestion }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between text-sm font-bold text-white/70">
      <span>{t("play.questionOf", { current: view.questionIndex + 1, total: view.totalQuestions })}</span>
      {question.pointsMultiplier === 2 && <span className="text-accent">{t("play.doublePoints")}</span>}
      {question.pointsMultiplier === 0 && <span>{t("play.noPoints")}</span>}
    </div>
  );
}

function QuestionPhase({
  view,
  question,
  session,
}: {
  view: GameView;
  question: PublicQuestion;
  session: PlayerSession;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const now = useServerNow(200);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAt = view.startedAt ?? 0;
  const limitMs = question.timeLimitSec * 1000;
  const reading = now < startedAt;
  const remaining = startedAt + limitMs - now;
  const answered = sent || view.answeredPlayerIds.includes(session.playerId);

  async function submit(answer: SubmittedAnswer) {
    if (sending || answered) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/games/${session.pin}/answer`, {
        method: "POST",
        token: session.playerToken,
        body: { questionIndex: view.questionIndex, ...answer },
      });
      setSent(true);
    } catch (err) {
      const code = errorCode(err);
      if (code === "already_answered") setSent(true);
      else setError(code);
    } finally {
      setSending(false);
    }
  }

  if (reading) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <QuestionHeader view={view} question={question} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-lg font-bold text-accent">{t("play.getReady")}</p>
          <h1 className="text-2xl font-black leading-snug animate-pop">{question.prompt}</h1>
          <div className="w-full max-w-xs">
            <ReadBar remainingMs={startedAt - now} totalMs={READ_TIME_MS} />
          </div>
        </div>
      </div>
    );
  }

  if (answered) {
    return (
      <Centered>
        <div className="flex size-20 items-center justify-center rounded-full bg-accent text-ink animate-pop">
          <CheckBadge className="size-10" />
        </div>
        <h2 className="text-2xl font-black">{t("play.submitted")}</h2>
        <p className="text-white/70 animate-pulse-soft">{t("play.waitingOthers")}</p>
      </Centered>
    );
  }

  if (remaining <= 0) {
    return (
      <Centered>
        <h2 className="text-3xl font-black">{t("play.timeUp")}</h2>
        <ErrorBanner>{errorText(error)}</ErrorBanner>
      </Centered>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <QuestionHeader view={view} question={question} />
          <h1 className="text-lg font-extrabold leading-snug">{question.prompt}</h1>
        </div>
        <CountdownRing remainingMs={remaining} totalMs={limitMs} size={64} />
      </div>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.imageUrl} alt="" className="mx-auto max-h-36 rounded-xl object-contain" />
      )}
      <AnswerPad question={question} disabled={sending} onSubmit={submit} />
      <ErrorBanner>{errorText(error)}</ErrorBanner>
    </div>
  );
}

function AnswerPad({
  question,
  disabled,
  onSubmit,
}: {
  question: PublicQuestion;
  disabled: boolean;
  onSubmit: (answer: SubmittedAnswer) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");

  if (question.type === "text") {
    return (
      <form
        className="mt-auto flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSubmit({ text });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.typedAnswerMax}
          autoFocus
          autoComplete="off"
          placeholder={t("play.typeAnswer")}
          className={`${inputClass} h-16 text-center text-xl font-bold`}
        />
        <Button type="submit" size="lg" disabled={disabled || !text.trim()}>
          {t("play.submit")}
        </Button>
      </form>
    );
  }

  const multi = question.type === "multi";
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="mt-auto flex flex-1 flex-col gap-3">
      {multi && <p className="text-center text-sm font-bold text-white/70">{t("play.selectAll")}</p>}
      <div className={`grid flex-1 gap-3 ${question.options.length > 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {question.options.map((o, i) => {
          const isSelected = selected.includes(o.id);
          const label = question.type === "true_false" ? t(o.id === "true" ? "tf.true" : "tf.false") : o.text;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => (multi ? toggle(o.id) : onSubmit({ optionIds: [o.id] }))}
              aria-pressed={multi ? isSelected : undefined}
              className={`${optionBg(i, question.type, o.id)} relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center font-extrabold shadow-[0_5px_0_0_rgb(0_0_0/0.3)] transition active:translate-y-1 active:shadow-none disabled:opacity-60 ${multi && isSelected ? "ring-4 ring-white" : ""} ${multi && selected.length > 0 && !isSelected ? "opacity-60" : ""}`}
            >
              <OptionIcon index={i} type={question.type} optionId={o.id} className="size-8" />
              <span className="line-clamp-3 text-base leading-tight">{label}</span>
              {multi && isSelected && (
                <span className="absolute right-2 top-2 rounded-full bg-white p-0.5 text-ink">
                  <CheckBadge className="size-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {multi && (
        <Button size="lg" disabled={disabled || selected.length === 0} onClick={() => onSubmit({ optionIds: selected })}>
          {t("play.submit")}
        </Button>
      )}
    </div>
  );
}

function ResultPhase({ view, me, playerId }: { view: GameView; me: PlayerView | null; playerId: string }) {
  const { t } = useI18n();
  const result = view.reveal?.results[playerId];

  if (view.status === "leaderboard") {
    return (
      <Centered>
        <p className="text-white/70">{t("play.lookUp")}</p>
        {me && <p className="text-4xl font-black">{t("play.rank", { rank: me.rank, total: view.players.length })}</p>}
        {me && <p className="text-xl font-bold text-white/80">{t("play.total", { score: me.score })}</p>}
      </Centered>
    );
  }

  const correct = Boolean(result?.correct);
  return (
    <div
      className={`-m-4 flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center ${result?.answered ? (correct ? "bg-good/25" : "bg-bad/25") : ""}`}
    >
      <div
        className={`flex size-24 items-center justify-center rounded-full animate-pop ${correct ? "bg-good" : "bg-bad"}`}
      >
        {correct ? <CheckBadge className="size-12" /> : <CrossBadge className="size-12" />}
      </div>
      <h1 className="text-3xl font-black">
        {!result?.answered ? t("play.noAnswer") : correct ? t("play.correct") : t("play.incorrect")}
      </h1>
      {correct && result && result.points > 0 && (
        <p className="rounded-xl bg-black/25 px-4 py-2 text-2xl font-black text-accent animate-rise">
          {t("play.gained", { points: result.points })}
        </p>
      )}
      {me && me.streak >= 2 && <p className="font-bold">{t("play.streak", { count: me.streak })}</p>}
      {me && (
        <p className="text-lg font-bold text-white/80">
          {t("play.rank", { rank: me.rank, total: view.players.length })} · {t("play.total", { score: me.score })}
        </p>
      )}
    </div>
  );
}

function FinalPhase({ view, me }: { view: GameView; me: PlayerView | null }) {
  const { t } = useI18n();
  const podium = me && me.rank <= 3 ? t(`play.podium${me.rank}` as "play.podium1") : null;
  return (
    <Centered>
      <p className="text-lg font-bold text-white/70">{t("play.gameOver")}</p>
      {podium && <p className="text-4xl font-black text-accent animate-pop">{podium}</p>}
      {me && <h1 className="text-3xl font-black">{t("play.finalRank", { rank: me.rank })}</h1>}
      {me && <p className="text-xl font-bold">{t("play.total", { score: me.score })}</p>}
      <p className="text-sm text-white/50">{view.quizTitle}</p>
      <Link href="/" className={buttonClass("secondary")}>
        {t("play.otherRoom")}
      </Link>
    </Centered>
  );
}
