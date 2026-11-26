"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { serverNow } from "@/lib/client/clock";
import { getSoundMuted, setSoundMuted } from "@/lib/client/storage";
import type { GameView } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * What should be audible right now:
 * - lobby, and questions without their own clip: the quiz background music (looping);
 * - a question with a clip: silence while it is read (the clip preloads), then the clip from
 *   the moment answering opens, seeked to the shared clock so devices stay roughly in sync;
 * - reveal, leaderboard, podium: silence (the background resumes where it stopped).
 */
type Want =
  | { kind: "bg"; src: string }
  | { kind: "clip"; src: string; startAt: number; play: boolean }
  | null;

function pick(view: GameView, now: number): Want {
  const bg: Want = view.musicUrl ? { kind: "bg", src: view.musicUrl } : null;
  if (view.status === "lobby") return bg;
  if (view.status !== "question") return null;
  const clip = view.question?.audioUrl;
  if (!clip) return bg;
  const startAt = view.startedAt ?? 0;
  return { kind: "clip", src: clip, startAt, play: now >= startAt };
}

function seek(el: HTMLAudioElement, seconds: number) {
  if (el.readyState >= 1) el.currentTime = seconds;
  else el.addEventListener("loadedmetadata", () => (el.currentTime = seconds), { once: true });
}

export interface GameMusic {
  /** The quiz has any music at all (show the toggle). */
  available: boolean;
  muted: boolean;
  /** The browser refused to start sound until the user taps (autoplay policy). */
  needsTap: boolean;
  toggleMuted: () => void;
  unlock: () => void;
}

/**
 * Plays the game's music on this device. One <audio> element serves both the background track
 * and question clips: iOS unlocks sound per element after a tap, so one tap covers everything.
 */
export function useGameMusic(view: GameView | null, now: number): GameMusic {
  const [muted, setMuted] = useState(getSoundMuted);
  const [blocked, setBlocked] = useState(false);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const bgPos = useRef(0);
  const wantRef = useRef<Want>(null);

  const want = view ? pick(view, now) : null;
  const kind = want?.kind ?? null;
  const src = want?.src ?? null;
  const startAt = want?.kind === "clip" ? want.startAt : null;
  const audible = want ? want.kind === "bg" || want.play : false;

  const apply = useCallback((w: Want) => {
    if (!elRef.current) {
      const el = new Audio();
      el.preload = "auto";
      elRef.current = el;
    }
    const el = elRef.current;

    // Leaving the background track: remember where it was so it can resume there.
    if (el.dataset.kind === "bg" && el.dataset.src && w?.kind !== "bg") bgPos.current = el.currentTime;
    if (!w) {
      el.pause();
      return;
    }

    if (el.dataset.src !== w.src || el.dataset.kind !== w.kind) {
      const resumeBg = w.kind === "bg" && el.dataset.src !== w.src;
      el.src = w.src;
      el.dataset.src = w.src;
      el.dataset.kind = w.kind;
      if (resumeBg && bgPos.current > 0) seek(el, bgPos.current);
    }
    el.loop = w.kind === "bg";

    if (w.kind === "clip") {
      if (!w.play) {
        el.pause(); // src is set: the clip buffers while the question is read
        return;
      }
      const offset = Math.max(0, (serverNow() - w.startAt) / 1000);
      if (Math.abs(el.currentTime - offset) > 1) seek(el, offset);
    }

    el.play().then(
      () => setBlocked(false),
      (err: unknown) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") setBlocked(true);
      },
    );
  }, []);

  useEffect(() => {
    const w: Want =
      kind === "bg" && src
        ? { kind, src }
        : kind === "clip" && src && startAt !== null
          ? { kind, src, startAt, play: audible }
          : null;
    wantRef.current = w;
    apply(muted ? null : w);
  }, [kind, src, startAt, audible, muted, apply]);

  // Must run inside the tap itself: iOS only starts sound from a user gesture.
  const unlock = useCallback(() => apply(wantRef.current), [apply]);

  useEffect(() => {
    if (!blocked || muted) return;
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [blocked, muted, unlock]);

  // Stop the music when leaving the game screen.
  useEffect(
    () => () => {
      const el = elRef.current;
      if (!el) return;
      el.pause();
      el.removeAttribute("src");
      el.load();
    },
    [],
  );

  const toggleMuted = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    apply(next ? null : wantRef.current);
  }, [muted, apply]);

  return {
    available: Boolean(view?.hasAudio),
    muted,
    needsTap: blocked && !muted && audible,
    toggleMuted,
    unlock,
  };
}

function SpeakerIcon({ off, className }: { off: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

/** Sound on/off sticker; turns into a "tap to play" pill when the browser blocked autoplay. */
export function SoundToggle({ music }: { music: GameMusic }) {
  const { t } = useI18n();
  if (!music.available) return null;
  if (music.needsTap) {
    return (
      <button
        type="button"
        onClick={music.unlock}
        className="press animate-pulse-soft flex items-center gap-1.5 rounded-xl border-3 border-ink bg-sun px-2.5 py-1 font-display text-sm font-extrabold shadow-hard-sm"
      >
        <SpeakerIcon off={false} className="size-5" />
        {t("common.tapForSound")}
      </button>
    );
  }
  const label = music.muted ? t("common.soundOn") : t("common.soundOff");
  return (
    <button
      type="button"
      onClick={music.toggleMuted}
      aria-label={label}
      title={label}
      aria-pressed={!music.muted}
      className={`press flex size-10 items-center justify-center rounded-xl border-3 border-ink shadow-hard-sm ${music.muted ? "bg-paper-2 text-ink/60" : "bg-mint"}`}
    >
      <SpeakerIcon off={music.muted} className="size-5" />
    </button>
  );
}
