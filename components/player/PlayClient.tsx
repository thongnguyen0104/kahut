"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ReadBar, TimeBar } from "@/components/Countdown";
import { CheckBadge, CrossBadge, OptionBadge, optionBg } from "@/components/options";
import { QuestionImage } from "@/components/QuestionImage";
import { Button, ErrorBanner, FullPageSpinner, Spinner, TONE_BG, Tag, buttonClass, type Tone } from "@/components/ui";
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

/** Full-bleed coloured stage: the whole phone turns into one big sticker colour. */
function Stage({
  tone = "white",
  children,
  center = true,
  tight = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  center?: boolean;
  /** Smaller gaps, for screens that also show a question picture. */
  tight?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 flex-col ${tight ? "gap-3 p-4" : "gap-5 p-5"} ${TONE_BG[tone]} ${center ? "items-center justify-center text-center" : ""}`}
    >
      {children}
    </div>
  );
}

/** Big rotated result stamp. */
function Stamp({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div
      className={`animate-stamp flex size-28 items-center justify-center rounded-full border-3 border-ink shadow-hard-lg ${TONE_BG[tone]}`}
    >
      {children}
    </div>
  );
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
      <Stage tone="paper">
        <Stamp tone="tomato">
          <CrossBadge className="size-14" />
        </Stamp>
        <p className="font-display text-2xl font-extrabold">{t("play.kicked")}</p>
        <Link href="/" className={buttonClass("dark")} onClick={() => clearPlayerSession(session.pin)}>
          {t("play.otherRoom")}
        </Link>
      </Stage>
    );
  }

  if (!view) {
    if (game.error) {
      return (
        <Stage>
          <ErrorBanner>{errorText(game.error)}</ErrorBanner>
          <Button variant="secondary" onClick={() => void refresh()}>
            {t("common.retry")}
          </Button>
        </Stage>
      );
    }
    return <FullPageSpinner />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b-3 border-ink bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar id={session.avatar} size={38} />
          <span className="truncate font-display text-lg font-extrabold">{session.nickname}</span>
        </div>
        <div className="flex items-center gap-3">
          {!game.connected && (
            <span className="flex items-center gap-1 text-xs font-bold">
              <Spinner className="size-3.5" />
              {t("play.reconnecting")}
            </span>
          )}
          <span className="rounded-lg border-3 border-ink bg-sun px-3 py-0.5 font-display text-lg font-extrabold tabular-nums shadow-hard-sm">
            {me?.score ?? 0}
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <PlayScreen view={view} me={me} session={session} />
      </main>
    </div>
  );
}

function PlayScreen({ view, me, session }: { view: GameView; me: PlayerView | null; session: PlayerSession }) {
  const { t } = useI18n();

  switch (view.status) {
    case "lobby":
      return (
        <Stage>
          <div className="animate-pop" style={{ ["--tilt" as string]: "-6deg" }}>
            <Avatar id={session.avatar} size={140} />
          </div>
          <span
            className="rounded-xl border-3 border-ink bg-sun px-4 py-1 font-display text-2xl font-extrabold shadow-hard-sm"
            style={{ transform: "rotate(2deg)" }}
          >
            {session.nickname}
          </span>
          <h1 className="text-4xl font-extrabold">{t("play.waitingTitle")}</h1>
          <p className="max-w-xs font-medium text-ink-soft">{t("play.waitingHint")}</p>
          <Tag tone="lilac">{view.quizTitle}</Tag>
        </Stage>
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

function QuestionTags({ view, question }: { view: GameView; question: PublicQuestion }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag tone="white">{t("play.questionOf", { current: view.questionIndex + 1, total: view.totalQuestions })}</Tag>
      {question.pointsMultiplier === 2 && (
        <Tag tone="sun" tilt={3}>
          {t("play.doublePoints")}
        </Tag>
      )}
      {question.pointsMultiplier === 0 && (
        <Tag tone="paper" tilt={3}>
          {t("play.noPoints")}
        </Tag>
      )}
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
  // Lifted so an enlarged picture stays open when reading time ends and answering starts.
  const [zoomed, setZoomed] = useState(false);

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
    const readBar = <ReadBar remainingMs={startedAt - now} totalMs={READ_TIME_MS} />;
    return (
      <Stage tone="lilac" tight={Boolean(question.imageUrl)}>
        <QuestionTags view={view} question={question} />
        <p className="font-display text-lg font-extrabold">{t("play.getReady")}</p>
        <h1 className="sticker animate-pop bg-white p-5 text-2xl font-extrabold leading-snug" style={{ ["--tilt" as string]: "-1deg" }}>
          {question.prompt}
        </h1>
        {/* Show the picture already while reading: players get a head start on studying it. */}
        {question.imageUrl && (
          <QuestionImage
            src={question.imageUrl}
            aspect
            className="w-full"
            style={{ maxHeight: "max(8rem, min(45dvh, 100dvh - 24rem))" }}
            zoomed={zoomed}
            onZoomedChange={setZoomed}
            zoomHeader={readBar}
          />
        )}
        <div className="w-full max-w-xs">{readBar}</div>
      </Stage>
    );
  }

  if (answered) {
    return (
      <Stage tone="sky">
        <Stamp tone="white">
          <CheckBadge className="size-14" />
        </Stamp>
        <h2 className="text-3xl font-extrabold">{t("play.submitted")}</h2>
        <p className="animate-pulse-soft font-semibold">{t("play.waitingOthers")}</p>
      </Stage>
    );
  }

  if (remaining <= 0) {
    return (
      <Stage tone="paper">
        <h2 className="animate-stamp rounded-2xl border-3 border-ink bg-white px-6 py-3 text-4xl font-extrabold shadow-hard">
          {t("play.timeUp")}
        </h2>
        <ErrorBanner>{errorText(error)}</ErrorBanner>
      </Stage>
    );
  }

  const timeBar = <TimeBar remainingMs={remaining} totalMs={limitMs} />;
  return (
    <Stage center={false} tight={Boolean(question.imageUrl)}>
      {question.imageUrl ? (
        // One row for tags + timer: every pixel of height goes to the picture.
        <div className="flex items-center gap-3">
          <QuestionTags view={view} question={question} />
          <div className="min-w-0 flex-1">{timeBar}</div>
        </div>
      ) : (
        <>
          {timeBar}
          <QuestionTags view={view} question={question} />
        </>
      )}
      <h1 className="text-xl font-extrabold leading-snug">{question.prompt}</h1>
      {question.imageUrl && (
        // Full width; the height cap leaves room for the header, prompt and two rows of answers.
        <QuestionImage
          src={question.imageUrl}
          aspect
          className="w-full shrink-0"
          style={{ maxHeight: "max(10rem, min(50dvh, 100dvh - 24rem))" }}
          zoomed={zoomed}
          onZoomedChange={setZoomed}
          zoomHeader={timeBar}
        />
      )}
      <AnswerPad question={question} disabled={sending} onSubmit={submit} compact={Boolean(question.imageUrl)} />
      <ErrorBanner>{errorText(error)}</ErrorBanner>
    </Stage>
  );
}

function AnswerPad({
  question,
  disabled,
  onSubmit,
  compact = false,
}: {
  question: PublicQuestion;
  disabled: boolean;
  onSubmit: (answer: SubmittedAnswer) => void;
  /** Shorter buttons (icon beside the label) so a question picture gets the room. */
  compact?: boolean;
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
          className="h-16 w-full rounded-2xl border-3 border-ink bg-white px-4 text-center font-display text-2xl font-extrabold outline-none shadow-hard-sm placeholder:text-ink/30"
        />
        <Button type="submit" size="xl" variant="dark" disabled={disabled || !text.trim()}>
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
      {multi && <p className="text-center text-sm font-bold">{t("play.selectAll")}</p>}
      <div className={`grid flex-1 gap-3 ${question.options.length > 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {question.options.map((o, i) => {
          const isSelected = selected.includes(o.id);
          const label = question.type === "true_false" ? t(o.id === "true" ? "tf.true" : "tf.false") : o.text;
          const labelSize = !compact ? "text-lg" : label.length <= 12 ? "text-xl" : "text-base";
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => (multi ? toggle(o.id) : onSubmit({ optionIds: [o.id] }))}
              aria-pressed={multi ? isSelected : undefined}
              className={`press relative flex items-center justify-center rounded-2xl border-3 border-ink font-display font-extrabold shadow-hard disabled:opacity-60 ${compact ? "min-h-18 flex-row gap-2.5 p-2.5 text-left" : "min-h-28 flex-col gap-2 p-3 text-center"} ${optionBg(i, question.type, o.id)} ${multi && selected.length > 0 && !isSelected ? "opacity-55" : ""} ${multi && isSelected ? "-translate-y-1 shadow-hard-lg" : ""}`}
            >
              <OptionBadge index={i} type={question.type} optionId={o.id} size={compact ? "sm" : "md"} />
              <span className={`line-clamp-3 leading-tight ${labelSize}`}>{label}</span>
              {multi && isSelected && (
                <span className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full border-3 border-ink bg-white">
                  <CheckBadge className="size-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {multi && (
        <Button size="xl" variant="dark" disabled={disabled || selected.length === 0} onClick={() => onSubmit({ optionIds: selected })}>
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
      <Stage tone="sun">
        <p className="font-semibold">{t("play.lookUp")}</p>
        {me && (
          <p className="rounded-2xl border-3 border-ink bg-white px-6 py-3 font-display text-5xl font-extrabold shadow-hard">
            #{me.rank}
            <span className="text-2xl text-ink-soft"> / {view.players.length}</span>
          </p>
        )}
        {me && <p className="font-display text-xl font-extrabold">{t("play.total", { score: me.score })}</p>}
      </Stage>
    );
  }

  const answered = Boolean(result?.answered);
  const correct = Boolean(result?.correct);
  const tone: Tone = !answered ? "paper" : correct ? "mint" : "tomato";

  return (
    <Stage tone={tone}>
      <Stamp tone={correct ? "white" : answered ? "white" : "paper"}>
        {correct ? <CheckBadge className="size-14" /> : <CrossBadge className="size-14" />}
      </Stamp>
      <h1 className="text-4xl font-extrabold">
        {!answered ? t("play.noAnswer") : correct ? t("play.correct") : t("play.incorrect")}
      </h1>
      {correct && result && result.points > 0 && (
        <p
          className="animate-pop rounded-xl border-3 border-ink bg-sun px-5 py-2 font-display text-3xl font-extrabold shadow-hard"
          style={{ ["--tilt" as string]: "-3deg" }}
        >
          {t("play.gained", { points: result.points })}
        </p>
      )}
      {me && me.streak >= 2 && <Tag tone="white">{t("play.streak", { count: me.streak })}</Tag>}
      {me && (
        <p className="font-display text-lg font-extrabold">
          {t("play.rank", { rank: me.rank, total: view.players.length })} · {t("play.total", { score: me.score })}
        </p>
      )}
    </Stage>
  );
}

function FinalPhase({ view, me }: { view: GameView; me: PlayerView | null }) {
  const { t } = useI18n();
  const podium = me && me.rank <= 3 ? t(`play.podium${me.rank}` as "play.podium1") : null;
  return (
    <Stage tone={podium ? "sun" : "lilac"}>
      <Tag tone="white">{t("play.gameOver")}</Tag>
      {podium && (
        <p className="animate-stamp rounded-2xl border-3 border-ink bg-white px-5 py-2 font-display text-4xl font-extrabold shadow-hard">
          {podium}
        </p>
      )}
      {me && <h1 className="text-4xl font-extrabold">{t("play.finalRank", { rank: me.rank })}</h1>}
      {me && <p className="font-display text-xl font-extrabold">{t("play.total", { score: me.score })}</p>}
      <p className="text-sm font-semibold">{view.quizTitle}</p>
      <Link href="/" className={buttonClass("dark", "lg")}>
        {t("play.otherRoom")}
      </Link>
    </Stage>
  );
}
