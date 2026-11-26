"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CountdownRing, ReadBar } from "@/components/Countdown";
import { CheckBadge, OptionBadge, OptionIcon, optionBg } from "@/components/options";
import { QuestionImage } from "@/components/QuestionImage";
import { PinTiles, TONE_BG, Tag, type Tone } from "@/components/ui";
import { READ_TIME_MS } from "@/lib/config";
import type { GameView, PlayerView, PublicQuestion } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

/** Stable small tilt per player so stickers look hand-placed but don't jump around. */
function tiltFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.9;
}

/* ------------------------------------------------------------------ lobby */

export function HostLobby({
  view,
  joinUrl,
  onlineIds,
  onKick,
}: {
  view: GameView;
  joinUrl: string;
  onlineIds: Set<string>;
  onKick: (player: PlayerView) => void;
}) {
  const { t } = useI18n();
  const shortUrl = joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "");

  return (
    <div className="grid flex-1 items-start gap-8 lg:grid-cols-[minmax(0,480px)_1fr]">
      <section className="sticker flex flex-col gap-5 bg-white p-6" style={{ transform: "rotate(-1deg)" }}>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-lilac font-display font-extrabold">
            1
          </span>
          <p className="font-display text-xl font-extrabold">{t("host.joinAt", { url: shortUrl })}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-lilac font-display font-extrabold">
              2
            </span>
            <p className="font-display text-xl font-extrabold">{t("host.pin")}</p>
          </div>
          <div className="flex justify-center py-1">
            <PinTiles pin={view.pin} size="xl" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-[3px] flex-1 rounded bg-ink/15" />
          <span className="text-sm font-bold text-ink-soft">{t("host.orScan")}</span>
          <span className="h-[3px] flex-1 rounded bg-ink/15" />
        </div>
        <div className="mx-auto rounded-2xl border-3 border-ink bg-white p-3 shadow-hard" style={{ transform: "rotate(1.5deg)" }}>
          <QRCodeSVG value={joinUrl} size={220} marginSize={0} level="M" fgColor="#17130f" className="h-auto w-full max-w-55" />
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl font-extrabold xl:text-5xl">{view.quizTitle}</h1>
          <span
            className="rounded-2xl border-3 border-ink bg-sun px-5 py-2 font-display text-2xl font-extrabold tabular-nums shadow-hard"
            style={{ transform: "rotate(2deg)" }}
          >
            {t("host.playerCount", { count: view.players.length })}
          </span>
        </div>
        {view.players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-3 border-dashed border-ink/40 p-10 text-center">
            <span className="animate-wiggle flex size-20 items-center justify-center rounded-2xl border-3 border-ink bg-bubble shadow-hard">
              <OptionIcon index={2} type="single" optionId="" className="size-10 text-white" />
            </span>
            <p className="font-display text-2xl font-extrabold">{t("host.waitingPlayers")}</p>
          </div>
        ) : (
          <>
            <ul className="flex flex-wrap content-start gap-3">
              {view.players.map((p) => (
                <li key={p.id} className="animate-pop" style={{ ["--tilt" as string]: `${tiltFor(p.id)}deg` }}>
                  <button
                    type="button"
                    onClick={() => onKick(p)}
                    title={t("host.kickHint")}
                    className="press group flex items-center gap-2 rounded-2xl border-3 border-ink bg-white py-1.5 pl-1.5 pr-4 shadow-hard-sm hover:bg-tomato-soft"
                  >
                    <span className="relative">
                      <Avatar id={p.avatar} size={44} />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-ink ${onlineIds.has(p.id) ? "bg-mint" : "bg-paper-2"}`}
                      />
                    </span>
                    <span className="max-w-40 truncate font-display text-lg font-extrabold group-hover:line-through">
                      {p.nickname}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-ink-soft">{t("host.kickHint")}</p>
          </>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- question */

function PromptCard({ question }: { question: PublicQuestion }) {
  return (
    <h1 className="sticker bg-white px-6 py-4 text-center text-3xl font-extrabold leading-tight xl:text-4xl">
      {question.prompt}
    </h1>
  );
}

/**
 * Answer tiles. Short answers ("1", "2", "Hà Nội"…) go on one row to leave height for the
 * picture. `side` is the narrow column next to a picture: 2×2 for short answers, else stacked.
 */
function OptionTiles({
  question,
  correctIds,
  side = false,
}: {
  question: PublicQuestion;
  correctIds?: string[];
  side?: boolean;
}) {
  const { t } = useI18n();
  const revealed = Boolean(correctIds);
  const labels = question.options.map((o) =>
    question.type === "true_false" ? t(o.id === "true" ? "tf.true" : "tf.false") : o.text,
  );
  const short = labels.every((l) => l.trim().length <= 16);
  const cols = side
    ? short
      ? "grid-cols-2"
      : "grid-cols-1"
    : short && question.options.length === 4
      ? "grid-cols-2 lg:grid-cols-4"
      : short && question.options.length === 3
        ? "grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2";
  return (
    <div className={`grid gap-4 ${cols}`}>
      {question.options.map((o, i) => {
        const isCorrect = correctIds?.includes(o.id) ?? false;
        const dimmed = revealed && !isCorrect;
        return (
          <div
            key={o.id}
            className={`relative flex items-center gap-4 rounded-2xl border-3 border-ink px-4 py-3 font-display font-extrabold ${side ? "min-h-16 text-2xl" : "min-h-20 text-2xl xl:text-3xl"} ${dimmed ? "hatched bg-paper-2 text-ink/45" : `${optionBg(i, question.type, o.id)} shadow-hard`}`}
          >
            <OptionBadge index={i} type={question.type} optionId={o.id} />
            <span className="min-w-0 flex-1 leading-tight">{labels[i]}</span>
            {revealed && isCorrect && (
              <span className="animate-stamp flex size-12 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-white">
                <CheckBadge className="size-7" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Big picture on the left, everything else in a column on the right (stacked on narrow screens). */
function WithPicture({ picture, children }: { picture: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
      {picture}
      <div className="flex flex-col justify-center gap-5">{children}</div>
    </div>
  );
}

function AnsweredCount({ view }: { view: GameView }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center rounded-2xl border-3 border-ink bg-mint px-6 py-4 shadow-hard" style={{ transform: "rotate(2deg)" }}>
      <span className="font-display text-6xl font-extrabold tabular-nums leading-none">{view.answeredPlayerIds.length}</span>
      <span className="mt-1 text-sm font-bold">
        {t("host.answered")} / {view.players.length}
      </span>
    </div>
  );
}

function TypingHint() {
  const { t } = useI18n();
  return (
    <p className="sticker flex items-center justify-center gap-3 bg-sun p-6 text-center font-display text-2xl font-extrabold">
      <span className="animate-pulse-soft">✎</span> {t("host.typingHint")}
    </p>
  );
}

export function HostQuestion({ view, question, now }: { view: GameView; question: PublicQuestion; now: number }) {
  const { t } = useI18n();
  // Lifted so an enlarged picture stays open when reading time ends and answering starts.
  const [zoomed, setZoomed] = useState(false);
  const startedAt = view.startedAt ?? now;
  const limitMs = question.timeLimitSec * 1000;
  const label = t("play.questionOf", { current: view.questionIndex + 1, total: view.totalQuestions });

  if (now < startedAt) {
    const readBar = <ReadBar remainingMs={startedAt - now} totalMs={READ_TIME_MS} />;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Tag tone="lilac" className="text-base">
          {label}
        </Tag>
        <h1
          className={`sticker animate-pop max-w-5xl bg-white px-8 py-6 font-extrabold leading-tight ${question.imageUrl ? "text-4xl xl:text-5xl" : "text-4xl xl:text-6xl"}`}
          style={{ ["--tilt" as string]: "-1deg" }}
        >
          {question.prompt}
        </h1>
        {question.imageUrl && (
          <QuestionImage
            src={question.imageUrl}
            className="min-h-56 w-full flex-1"
            zoomed={zoomed}
            onZoomedChange={setZoomed}
            zoomHeader={<div className="mx-auto max-w-xl">{readBar}</div>}
          />
        )}
        <div className="w-full max-w-xl">{readBar}</div>
      </div>
    );
  }

  const remainingMs = startedAt + limitMs - now;

  if (question.imageUrl) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <PromptCard question={question} />
        <WithPicture
          picture={
            <QuestionImage
              src={question.imageUrl}
              className="min-h-64"
              zoomed={zoomed}
              onZoomedChange={setZoomed}
              zoomHeader={
                <div className="flex items-center gap-4">
                  <CountdownRing remainingMs={remainingMs} totalMs={limitMs} size={64} />
                  <span className="rounded-xl border-3 border-ink bg-mint px-3 py-1 font-display text-lg font-extrabold shadow-hard-sm">
                    {view.answeredPlayerIds.length} {t("host.answered")} / {view.players.length}
                  </span>
                </div>
              }
            />
          }
        >
          <div className="flex items-center justify-around gap-4">
            <CountdownRing remainingMs={remainingMs} totalMs={limitMs} size={130} />
            <AnsweredCount view={view} />
          </div>
          {question.type === "text" ? <TypingHint /> : <OptionTiles question={question} side />}
        </WithPicture>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptCard question={question} />
      <div className="flex min-h-0 flex-1 items-center justify-between gap-6">
        <CountdownRing remainingMs={remainingMs} totalMs={limitMs} size={150} />
        <AnsweredCount view={view} />
      </div>
      {question.type === "text" ? <TypingHint /> : <OptionTiles question={question} />}
    </div>
  );
}

/* ----------------------------------------------------------------- reveal */

function DistributionChart({
  question,
  counts,
  correctIds,
  className,
}: {
  question: PublicQuestion;
  counts: Record<string, number>;
  correctIds: string[];
  className: string;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className={`flex min-h-40 items-stretch justify-center gap-4 px-2 xl:gap-8 ${className}`}>
      {question.options.map((o, i) => {
        const count = counts[o.id] ?? 0;
        const correct = correctIds.includes(o.id);
        return (
          <div key={o.id} className="flex w-20 flex-col items-center gap-2 xl:w-28">
            <span className="font-display text-4xl font-extrabold tabular-nums">{count}</span>
            <div className="relative w-full flex-1">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-xl border-3 border-ink transition-all duration-700 ${correct ? `${optionBg(i, question.type, o.id)} shadow-hard` : "hatched bg-paper-2"}`}
                style={{ height: `${(count / max) * 100}%`, minHeight: 10 }}
              />
            </div>
            <span className="flex items-center gap-1">
              <OptionBadge index={i} type={question.type} optionId={o.id} size="sm" />
              {correct && (
                <span className="flex size-8 items-center justify-center rounded-full border-3 border-ink bg-mint">
                  <CheckBadge className="size-4" />
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HostReveal({ view, question }: { view: GameView; question: PublicQuestion }) {
  const { t } = useI18n();
  const reveal = view.reveal;
  if (!reveal) return null;
  const counts = reveal.distribution;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PromptCard question={question} />

      {question.type === "text" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <Tag tone="white" className="text-sm">
            {t("host.acceptedAnswers")}
          </Tag>
          <ul className="flex flex-wrap justify-center gap-4">
            {reveal.acceptedAnswers.map((a, i) => (
              <li
                key={a}
                className="animate-pop rounded-2xl border-3 border-ink bg-mint px-6 py-3 font-display text-4xl font-extrabold shadow-hard"
                style={{ ["--tilt" as string]: `${i % 2 ? 2 : -2}deg` }}
              >
                {a}
              </li>
            ))}
          </ul>
          <div className="flex gap-4 font-display text-2xl font-extrabold">
            <span className="rounded-xl border-3 border-ink bg-mint px-4 py-1 shadow-hard-sm">
              {t("host.correctCount", { count: counts.correct ?? 0 })}
            </span>
            <span className="rounded-xl border-3 border-ink bg-tomato px-4 py-1 shadow-hard-sm">
              {t("host.incorrectCount", { count: counts.incorrect ?? 0 })}
            </span>
          </div>
        </div>
      ) : question.imageUrl ? (
        // The picture stays where it was, so the host can explain the answer with it.
        <WithPicture picture={<QuestionImage src={question.imageUrl} className="min-h-64" />}>
          <DistributionChart question={question} counts={counts} correctIds={reveal.correctOptionIds} className="h-[24vh]" />
          <OptionTiles question={question} correctIds={reveal.correctOptionIds} side />
        </WithPicture>
      ) : (
        <>
          <DistributionChart question={question} counts={counts} correctIds={reveal.correctOptionIds} className="h-[32vh]" />
          <OptionTiles question={question} correctIds={reveal.correctOptionIds} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ leaderboard */

const RANK_TONES: Tone[] = ["sun", "lilac", "bubble"];

export function HostLeaderboard({ view }: { view: GameView }) {
  const { t } = useI18n();
  const top = view.players.slice(0, 5);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      <h1 className="text-center text-5xl font-extrabold">{t("host.leaderboard")}</h1>
      {top.length === 0 && <p className="text-center font-semibold text-ink-soft">{t("host.noPlayersYet")}</p>}
      <ol className="flex flex-col gap-3">
        {top.map((p, i) => {
          const gained = view.reveal?.results[p.id]?.points ?? 0;
          return (
            <li
              key={p.id}
              className="sticker flex animate-rise items-center gap-4 bg-white px-4 py-3"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-full border-3 border-ink font-display text-2xl font-extrabold ${TONE_BG[RANK_TONES[p.rank - 1] ?? "white"]}`}
              >
                {p.rank}
              </span>
              <Avatar id={p.avatar} size={54} />
              <span className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold">{p.nickname}</span>
              {gained > 0 && (
                <span className="rounded-lg border-2 border-ink bg-mint px-2 py-0.5 font-display text-base font-extrabold">
                  +{gained}
                </span>
              )}
              <span className="w-24 text-right font-display text-3xl font-extrabold tabular-nums">{p.score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------------- podium */

export function HostPodium({ view }: { view: GameView }) {
  const { t } = useI18n();
  const [first, second, third] = view.players;
  const rest = view.players.slice(3, 10);
  const columns: { player: PlayerView | undefined; rank: number; height: string; tone: Tone; delay: number }[] = [
    { player: second, rank: 2, height: "h-40", tone: "lilac", delay: 400 },
    { player: first, rank: 1, height: "h-56", tone: "sun", delay: 900 },
    { player: third, rank: 3, height: "h-28", tone: "bubble", delay: 0 },
  ];

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-5xl font-extrabold">{t("host.results")}</h1>
      <div className="flex items-end justify-center gap-3">
        {columns.map(({ player, rank, height, tone, delay }) => (
          <div key={rank} className="flex w-48 animate-rise flex-col items-center gap-2" style={{ animationDelay: `${delay}ms` }}>
            {player && (
              <>
                <Avatar id={player.avatar} size={rank === 1 ? 104 : 80} />
                <span className="max-w-full truncate rounded-xl border-3 border-ink bg-white px-3 py-0.5 font-display text-xl font-extrabold shadow-hard-sm">
                  {player.nickname}
                </span>
                <span className="font-display font-extrabold tabular-nums">
                  {player.score} {t("common.points")}
                </span>
              </>
            )}
            <div
              className={`${height} flex w-full items-start justify-center rounded-t-2xl border-3 border-b-0 border-ink pt-3 font-display text-6xl font-extrabold ${player ? `${TONE_BG[tone]} shadow-hard` : "bg-paper-2 text-ink/25"}`}
            >
              {rank}
            </div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="grid w-full max-w-3xl gap-2 sm:grid-cols-2">
          {rest.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border-3 border-ink bg-white px-3 py-2 shadow-hard-sm">
              <span className="w-6 font-display font-extrabold">{p.rank}</span>
              <Avatar id={p.avatar} size={32} />
              <span className="min-w-0 flex-1 truncate font-bold">{p.nickname}</span>
              <span className="font-display font-extrabold tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
