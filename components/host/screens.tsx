"use client";

import { QRCodeSVG } from "qrcode.react";
import { Avatar } from "@/components/Avatar";
import { CountdownRing, ReadBar } from "@/components/Countdown";
import { CheckBadge, OptionIcon, optionBg } from "@/components/options";
import { READ_TIME_MS } from "@/lib/config";
import type { GameView, PlayerView, PublicQuestion } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
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
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-white p-6 text-ink shadow-2xl animate-rise">
        <p className="text-center text-lg font-bold">{t("host.joinAt", { url: shortUrl })}</p>
        <div>
          <p className="text-center text-sm font-bold uppercase tracking-widest text-slate-500">{t("host.pin")}</p>
          <p className="text-center text-6xl font-black tabular-nums tracking-wider xl:text-7xl">
            {formatPin(view.pin)}
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500">{t("host.orScan")}</p>
        <QRCodeSVG value={joinUrl} size={260} marginSize={2} level="M" className="h-auto w-full max-w-65" />
      </section>

      <section className="flex min-h-0 flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-3xl font-black">{view.quizTitle}</h1>
          <span className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-xl font-black tabular-nums">
            {t("host.playerCount", { count: view.players.length })}
          </span>
        </div>
        {view.players.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-line p-10 text-xl font-bold text-white/60 animate-pulse-soft">
            {t("host.waitingPlayers")}
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {view.players.map((p) => (
                <li key={p.id} className="animate-pop">
                  <button
                    type="button"
                    onClick={() => onKick(p)}
                    title={t("host.kickHint")}
                    className="group flex w-full items-center gap-2 rounded-2xl bg-white/10 p-2 pr-3 text-left ring-1 ring-line transition hover:bg-bad/30"
                  >
                    <span className="relative">
                      <Avatar id={p.avatar} size={44} />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-ink ${onlineIds.has(p.id) ? "bg-good" : "bg-slate-500"}`}
                      />
                    </span>
                    <span className="truncate font-extrabold group-hover:line-through">{p.nickname}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-white/50">{t("host.kickHint")}</p>
          </>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- question */

function QuestionImage({ question, className = "" }: { question: PublicQuestion; className?: string }) {
  if (!question.imageUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={question.imageUrl}
      alt=""
      className={`mx-auto max-h-full max-w-full rounded-2xl object-contain shadow-2xl ${className}`}
    />
  );
}

function OptionTiles({
  question,
  correctIds,
  counts,
}: {
  question: PublicQuestion;
  correctIds?: string[];
  counts?: Record<string, number>;
}) {
  const { t } = useI18n();
  const revealed = Boolean(correctIds);
  return (
    <div className={`grid gap-3 ${question.options.length > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
      {question.options.map((o, i) => {
        const isCorrect = correctIds?.includes(o.id) ?? false;
        const label = question.type === "true_false" ? t(o.id === "true" ? "tf.true" : "tf.false") : o.text;
        return (
          <div
            key={o.id}
            className={`${optionBg(i, question.type, o.id)} flex min-h-20 items-center gap-4 rounded-2xl px-5 py-3 text-2xl font-extrabold shadow-[0_5px_0_0_rgb(0_0_0/0.3)] transition xl:text-3xl ${revealed && !isCorrect ? "opacity-35" : ""}`}
          >
            <OptionIcon index={i} type={question.type} optionId={o.id} className="size-9 shrink-0" />
            <span className="min-w-0 flex-1 leading-tight">{label}</span>
            {revealed && isCorrect && <CheckBadge className="size-9 shrink-0" />}
            {counts && <span className="shrink-0 tabular-nums">{counts[o.id] ?? 0}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function HostQuestion({ view, question, now }: { view: GameView; question: PublicQuestion; now: number }) {
  const { t } = useI18n();
  const startedAt = view.startedAt ?? now;
  const limitMs = question.timeLimitSec * 1000;

  if (now < startedAt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <h1 className="max-w-5xl text-4xl font-black leading-tight animate-pop xl:text-6xl">{question.prompt}</h1>
        <div className="max-h-[40vh]">
          <QuestionImage question={question} className="max-h-[40vh]" />
        </div>
        <div className="w-full max-w-xl">
          <ReadBar remainingMs={startedAt - now} totalMs={READ_TIME_MS} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h1 className="rounded-2xl bg-white px-6 py-4 text-center text-3xl font-black leading-tight text-ink shadow-xl xl:text-4xl">
        {question.prompt}
      </h1>
      <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-6">
        <CountdownRing remainingMs={startedAt + limitMs - now} totalMs={limitMs} size={140} />
        <div className="flex h-full max-h-[42vh] min-h-0 items-center justify-center">
          <QuestionImage question={question} className="max-h-[42vh]" />
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-white/10 px-6 py-4 ring-1 ring-line">
          <span className="text-5xl font-black tabular-nums">{view.answeredPlayerIds.length}</span>
          <span className="text-sm font-bold text-white/70">
            {t("host.answered")} / {view.players.length}
          </span>
        </div>
      </div>
      {question.type === "text" ? (
        <p className="rounded-2xl bg-white/10 p-6 text-center text-2xl font-bold animate-pulse-soft">
          {t("host.typingHint")}
        </p>
      ) : (
        <OptionTiles question={question} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- reveal */

export function HostReveal({ view, question }: { view: GameView; question: PublicQuestion }) {
  const { t } = useI18n();
  const reveal = view.reveal;
  if (!reveal) return null;
  const counts = reveal.distribution;
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h1 className="rounded-2xl bg-white px-6 py-4 text-center text-3xl font-black leading-tight text-ink shadow-xl xl:text-4xl">
        {question.prompt}
      </h1>

      {question.type === "text" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <p className="text-lg font-bold text-white/70">{t("host.acceptedAnswers")}</p>
          <ul className="flex flex-wrap justify-center gap-3">
            {reveal.acceptedAnswers.map((a) => (
              <li key={a} className="rounded-2xl bg-good px-6 py-3 text-3xl font-black animate-pop">
                {a}
              </li>
            ))}
          </ul>
          <div className="flex gap-6 text-2xl font-black">
            <span className="text-green-300">{t("host.correctCount", { count: counts.correct ?? 0 })}</span>
            <span className="text-rose-300">{t("host.incorrectCount", { count: counts.incorrect ?? 0 })}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-[34vh] min-h-40 items-stretch justify-center gap-6 px-6">
            {question.options.map((o, i) => {
              const count = counts[o.id] ?? 0;
              const correct = reveal.correctOptionIds.includes(o.id);
              return (
                <div key={o.id} className="flex w-28 flex-col items-center gap-2">
                  <span className="text-3xl font-black tabular-nums">{count}</span>
                  <div className="relative w-full flex-1">
                    <div
                      className={`${optionBg(i, question.type, o.id)} absolute inset-x-0 bottom-0 rounded-t-xl transition-all duration-700 ${correct ? "" : "opacity-40"}`}
                      style={{ height: `${(count / max) * 100}%`, minHeight: 8 }}
                    />
                  </div>
                  <span className="flex items-center gap-1">
                    <OptionIcon index={i} type={question.type} optionId={o.id} className="size-7" />
                    {correct && <CheckBadge className="size-7 text-green-300" />}
                  </span>
                </div>
              );
            })}
          </div>
          <OptionTiles question={question} correctIds={reveal.correctOptionIds} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ leaderboard */

export function HostLeaderboard({ view }: { view: GameView }) {
  const { t } = useI18n();
  const top = view.players.slice(0, 5);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
      <h1 className="text-center text-4xl font-black">{t("host.leaderboard")}</h1>
      {top.length === 0 && <p className="text-center text-white/60">{t("host.noPlayersYet")}</p>}
      <ol className="flex flex-col gap-3">
        {top.map((p, i) => {
          const gained = view.reveal?.results[p.id]?.points ?? 0;
          return (
            <li
              key={p.id}
              className="flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-line animate-rise"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="w-8 text-center text-2xl font-black text-white/60">{p.rank}</span>
              <Avatar id={p.avatar} size={52} />
              <span className="min-w-0 flex-1 truncate text-2xl font-extrabold">{p.nickname}</span>
              {gained > 0 && <span className="text-lg font-black text-accent">+{gained}</span>}
              <span className="text-2xl font-black tabular-nums">{p.score}</span>
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
  const columns: { player: PlayerView | undefined; height: string; medal: string; delay: number }[] = [
    { player: second, height: "h-40", medal: "🥈", delay: 400 },
    { player: first, height: "h-56", medal: "🏆", delay: 900 },
    { player: third, height: "h-28", medal: "🥉", delay: 0 },
  ];

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      <h1 className="text-4xl font-black">{t("host.results")}</h1>
      <div className="flex items-end justify-center gap-4">
        {columns.map(({ player, height, medal, delay }, i) => (
          <div key={i} className="flex w-44 flex-col items-center gap-2 animate-rise" style={{ animationDelay: `${delay}ms` }}>
            {player && (
              <>
                <Avatar id={player.avatar} size={i === 1 ? 96 : 76} />
                <span className="max-w-full truncate text-xl font-black">{player.nickname}</span>
                <span className="font-bold tabular-nums text-white/80">
                  {player.score} {t("common.points")}
                </span>
              </>
            )}
            <div
              className={`${height} flex w-full items-start justify-center rounded-t-2xl bg-linear-to-b from-accent to-accent-strong pt-3 text-5xl shadow-2xl ${player ? "" : "opacity-25"}`}
            >
              {player ? medal : ""}
            </div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="grid w-full max-w-3xl gap-2 sm:grid-cols-2">
          {rest.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2">
              <span className="w-6 font-black text-white/60">{p.rank}</span>
              <Avatar id={p.avatar} size={32} />
              <span className="min-w-0 flex-1 truncate font-bold">{p.nickname}</span>
              <span className="font-black tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
