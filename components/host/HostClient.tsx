"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ErrorBanner, FullPageSpinner, LanguageToggle, Logo, Spinner, buttonClass } from "@/components/ui";
import { api, errorCode } from "@/lib/client/api";
import { authApi, useAuth } from "@/lib/client/auth";
import { useHydrated, useServerNow } from "@/lib/client/hooks";
import { getHostSession, saveHostSession, type HostSession } from "@/lib/client/storage";
import { useGame } from "@/lib/client/useGame";
import type { HostAction } from "@/lib/game/transitions";
import type { GameView, PlayerView } from "@/lib/game/types";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";
import { HostLeaderboard, HostLobby, HostPodium, HostQuestion, HostReveal, formatPin } from "./screens";

export default function HostClient() {
  const hydrated = useHydrated();
  const { pin } = useParams<{ pin: string }>();
  if (!hydrated) return <FullPageSpinner />;
  return <HostGate key={pin} pin={pin} />;
}

function HostGate({ pin }: { pin: string }) {
  const { t } = useI18n();
  const [session] = useState(() => getHostSession(pin));
  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="sticker flex max-w-md flex-col items-center gap-3 bg-white p-6">
          <p className="font-display text-2xl font-extrabold">{t("host.noAccess", { pin })}</p>
          <p className="font-medium text-ink-soft">{t("host.noAccessHint")}</p>
          <Link href="/my-quizzes" className={buttonClass("dark")}>
            {t("home.myQuizzes")}
          </Link>
        </div>
      </div>
    );
  }
  return <HostGame session={session} />;
}

function HostGame({ session }: { session: HostSession }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const signedIn = Boolean(useAuth().user);
  const game = useGame(session.pin, { token: session.hostToken });
  const { view, applyView } = game;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (action: HostAction | "kick", extra?: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api<{ changed: boolean; view?: GameView }>(`/api/games/${session.pin}/control`, {
          method: "POST",
          token: session.hostToken,
          body: { action, ...extra },
        });
        if (res.view) applyView(res.view);
      } catch (err) {
        setError(errorCode(err));
      } finally {
        setBusy(false);
      }
    },
    [session.pin, session.hostToken, applyView],
  );

  // Warm the browser cache so question images appear instantly.
  useEffect(() => {
    for (const url of game.imageUrls) {
      const img = new Image();
      img.src = url;
    }
  }, [game.imageUrls]);

  // Close the question when time runs out or everyone has answered.
  const isQuestion = view?.status === "question";
  const now = useServerNow(250, isQuestion);
  const question = view?.question ?? null;
  const deadline = isQuestion && view?.startedAt && question ? view.startedAt + question.timeLimitSec * 1000 : null;
  const everyoneAnswered = Boolean(
    view && view.players.length > 0 && view.answeredPlayerIds.length >= view.players.length,
  );
  const shouldReveal =
    deadline !== null && view?.startedAt != null && now >= view.startedAt && (now >= deadline || everyoneAnswered);
  const revealedIndex = useRef(-1);
  const questionIndex = view?.questionIndex ?? -1;

  useEffect(() => {
    if (shouldReveal && revealedIndex.current !== questionIndex) {
      revealedIndex.current = questionIndex;
      void act("reveal");
    }
  }, [shouldReveal, questionIndex, act]);

  const joinUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base.replace(/\/$/, "")}/join?pin=${session.pin}`;
  }, [session.pin]);

  function kick(player: PlayerView) {
    if (window.confirm(t("host.kickConfirm", { name: player.nickname }))) {
      void act("kick", { playerId: player.id });
    }
  }

  function endGame() {
    if (window.confirm(t("host.endConfirm"))) void act("end");
  }

  async function playAgain() {
    setBusy(true);
    try {
      const res = await authApi<{ pin: string; hostToken: string }>("/api/games", {
        method: "POST",
        body: { quizId: session.quizId },
      });
      saveHostSession({ pin: res.pin, hostToken: res.hostToken, quizId: session.quizId });
      router.push(`/host/${res.pin}`);
    } catch (err) {
      setError(errorCode(err));
      setBusy(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (!view) {
    return game.error ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <ErrorBanner>{errorText(game.error)}</ErrorBanner>
        <Button variant="secondary" onClick={() => void game.refresh()}>
          {t("common.retry")}
        </Button>
      </div>
    ) : (
      <FullPageSpinner />
    );
  }

  const hasNext = view.questionIndex + 1 < view.totalQuestions;

  let primary: { label: string; onClick: () => void; disabled?: boolean } | null = null;
  switch (view.status) {
    case "lobby":
      primary = { label: t("host.start"), onClick: () => void act("start"), disabled: view.players.length === 0 };
      break;
    case "question":
      if (view.startedAt && now >= view.startedAt) primary = { label: t("host.skip"), onClick: () => void act("reveal") };
      break;
    case "reveal":
      primary = { label: t("host.showLeaderboard"), onClick: () => void act("leaderboard") };
      break;
    case "leaderboard":
      primary = {
        label: hasNext ? t("host.nextQuestion") : t("host.showResults"),
        onClick: () => void act("next"),
      };
      break;
  }

  return (
    <div className="flex min-h-dvh flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo className="text-xl" />
          {view.status !== "lobby" && (
            <span className="rounded-lg border-3 border-ink bg-white px-3 py-0.5 font-display text-lg font-extrabold tabular-nums shadow-hard-sm">
              PIN {formatPin(view.pin)}
            </span>
          )}
          {view.question && view.status !== "finished" && (
            <span className="rounded-lg border-3 border-ink bg-lilac px-3 py-0.5 font-display text-lg font-extrabold shadow-hard-sm">
              {view.questionIndex + 1}/{view.totalQuestions}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!game.connected && <Spinner className="size-5" />}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            ⛶ {t("host.fullscreen")}
          </Button>
          <LanguageToggle />
          {view.status !== "finished" && (
            <Button variant="danger" size="sm" onClick={endGame}>
              {t("host.endGame")}
            </Button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {view.status === "lobby" && (
          <HostLobby view={view} joinUrl={joinUrl} onlineIds={game.onlineIds} onKick={kick} />
        )}
        {view.status === "question" && question && (
          <HostQuestion key={view.questionIndex} view={view} question={question} now={now} />
        )}
        {view.status === "reveal" && question && <HostReveal view={view} question={question} />}
        {view.status === "leaderboard" && <HostLeaderboard view={view} />}
        {view.status === "finished" && <HostPodium view={view} />}
      </main>

      <footer className="flex flex-wrap items-center justify-end gap-3">
        <div className="mr-auto">
          <ErrorBanner>{errorText(error)}</ErrorBanner>
        </div>
        {view.status === "finished" && signedIn && (
          <>
            <Link href={`/quiz/${session.quizId}/edit`} className={buttonClass("secondary", "lg")}>
              {t("host.backToEditor")}
            </Link>
            <Button size="lg" onClick={() => void playAgain()} disabled={busy}>
              ↻ {t("host.playAgain")}
            </Button>
          </>
        )}
        {primary && (
          <Button size="xl" onClick={primary.onClick} disabled={busy || primary.disabled} className="min-w-56">
            {busy && <Spinner className="size-6" />}
            {primary.label} →
          </Button>
        )}
      </footer>
    </div>
  );
}
