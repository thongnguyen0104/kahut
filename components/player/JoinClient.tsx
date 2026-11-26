"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button, Card, ErrorBanner, FullPageSpinner, PinTiles, Tag, TopBar, labelClass } from "@/components/ui";
import { AVATAR_IDS, randomAvatarId } from "@/lib/avatars";
import { api, cleanPin, errorCode } from "@/lib/client/api";
import { useHydrated } from "@/lib/client/hooks";
import { getPlayerSession, savePlayerSession, type PlayerSession } from "@/lib/client/storage";
import { LIMITS } from "@/lib/config";
import type { GameView } from "@/lib/game/types";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function JoinClient() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const pin = cleanPin(params.get("pin") ?? "");
  if (!hydrated) return <FullPageSpinner />;
  return <JoinForm key={pin} initialPin={pin} />;
}

function JoinForm({ initialPin }: { initialPin: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();

  const [pin, setPin] = useState(initialPin);
  const [room, setRoom] = useState<GameView | null>(null);
  const [checking, setChecking] = useState(initialPin.length === 6);
  const [existing, setExisting] = useState<PlayerSession | null>(() =>
    initialPin ? getPlayerSession(initialPin) : null,
  );
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(randomAvatarId);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check the room exists before asking for a nickname.
  useEffect(() => {
    if (initialPin.length !== 6) return;
    let cancelled = false;
    api<{ view: GameView }>(`/api/games/${initialPin}/state`)
      .then(({ view }) => {
        if (cancelled) return;
        if (view.status === "finished") setError("game_finished");
        else setRoom(view);
      })
      .catch((err) => {
        if (!cancelled) setError(errorCode(err));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialPin]);

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) {
      setError("invalid_pin");
      return;
    }
    router.replace(`/join?pin=${pin}`);
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    const name = nickname.trim();
    if (!name) {
      setError("nickname_required");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await api<{ playerId: string; playerToken: string; nickname: string; avatar: string }>(
        `/api/games/${room.pin}/join`,
        { method: "POST", body: { nickname: name, avatar } },
      );
      savePlayerSession({ pin: room.pin, ...res });
      router.replace(`/play/${room.pin}`);
    } catch (err) {
      setError(errorCode(err));
      setJoining(false);
    }
  }

  const step = room ? 2 : 1;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-12 pt-2">
        <ol className="flex items-center gap-2 font-display text-sm font-extrabold" aria-label={t("join.title")}>
          {[t("join.stepPin"), t("join.stepYou")].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="h-[3px] w-6 rounded bg-ink" aria-hidden />}
              <span
                className={`flex size-7 items-center justify-center rounded-full border-3 border-ink ${step > i ? "bg-sun" : "bg-white"}`}
              >
                {i + 1}
              </span>
              <span className={step === i + 1 ? "" : "text-ink-soft"}>{label}</span>
            </li>
          ))}
        </ol>

        {!room && (
          <Card className="flex flex-col gap-4" style={{ transform: "rotate(-0.6deg)" }}>
            <h1 className="text-3xl font-extrabold">{t("join.title")}</h1>
            <form onSubmit={submitPin} className="flex flex-col gap-4">
              <label className={labelClass} htmlFor="pin">
                {t("join.pinLabel")}
              </label>
              <input
                id="pin"
                value={pin}
                onChange={(e) => setPin(cleanPin(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="000000"
                className="h-20 w-full rounded-2xl border-3 border-ink bg-paper-2 text-center font-display text-5xl font-extrabold tracking-[0.25em] tabular-nums outline-none placeholder:text-ink/20 focus:bg-white focus:shadow-hard-sm"
              />
              <Button type="submit" size="xl" disabled={checking}>
                {checking ? t("common.loading") : `${t("join.checkPin")} →`}
              </Button>
            </form>
          </Card>
        )}

        {room && (
          <div className="flex flex-col items-start gap-2">
            <Tag tone="mint">{t("join.pinLabel")}</Tag>
            <PinTiles pin={room.pin} size="md" />
            <p className="font-display text-xl font-extrabold">{room.quizTitle}</p>
          </div>
        )}

        {room && existing && (
          <Card tone="sun" className="flex flex-col items-center gap-4 text-center">
            <Avatar id={existing.avatar} size={88} />
            <Button size="lg" variant="dark" className="w-full" onClick={() => router.replace(`/play/${room.pin}`)}>
              {t("join.continueAs", { name: existing.nickname })}
            </Button>
            <Button variant="ghost" onClick={() => setExisting(null)}>
              {t("join.useAnotherName")}
            </Button>
          </Card>
        )}

        {room && !existing && (
          <form onSubmit={join} className="flex flex-col gap-5">
            {/* Live "name sticker" preview of how you'll appear on the big screen. */}
            <div className="sticker flex items-center gap-3 bg-white p-3 pr-5" style={{ transform: "rotate(-1.5deg)" }}>
              <Avatar id={avatar} size={64} />
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={LIMITS.nicknameMax}
                autoFocus
                autoComplete="nickname"
                aria-label={t("join.nickname")}
                placeholder={t("join.nicknamePlaceholder")}
                className="min-w-0 flex-1 border-b-3 border-dashed border-ink/40 bg-transparent py-2 font-display text-2xl font-extrabold outline-none placeholder:text-ink/30 focus:border-ink"
              />
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className={`${labelClass} mb-3`}>{t("join.chooseAvatar")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvatar(id)}
                    aria-pressed={avatar === id}
                    className={`press rounded-xl border-3 p-1 ${avatar === id ? "border-ink bg-sun shadow-hard-sm" : "border-transparent"}`}
                  >
                    <Avatar id={id} size={44} className="w-full" />
                  </button>
                ))}
              </div>
            </fieldset>

            <Button type="submit" size="xl" disabled={joining}>
              {joining ? t("join.joining") : t("join.submit")}
            </Button>
          </form>
        )}

        <ErrorBanner>{errorText(error)}</ErrorBanner>
      </main>
    </div>
  );
}
