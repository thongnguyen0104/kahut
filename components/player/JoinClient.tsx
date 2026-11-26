"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button, Card, ErrorBanner, FullPageSpinner, TopBar, inputClass } from "@/components/ui";
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

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-12 pt-4">
        <h1 className="text-center text-2xl font-black">{t("join.title")}</h1>

        {!room && (
          <Card>
            <form onSubmit={submitPin} className="flex flex-col gap-3">
              <label className="text-sm font-bold text-white/70" htmlFor="pin">
                {t("join.pinLabel")}
              </label>
              <input
                id="pin"
                value={pin}
                onChange={(e) => setPin(cleanPin(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                className={`${inputClass} h-16 text-center text-3xl font-black tracking-[0.3em]`}
              />
              <Button type="submit" size="lg" disabled={checking}>
                {checking ? t("common.loading") : t("join.checkPin")}
              </Button>
            </form>
          </Card>
        )}

        {room && existing && (
          <Card className="flex flex-col items-center gap-4 text-center">
            <Avatar id={existing.avatar} size={72} />
            <Button size="lg" className="w-full" onClick={() => router.replace(`/play/${room.pin}`)}>
              {t("join.continueAs", { name: existing.nickname })}
            </Button>
            <Button variant="ghost" onClick={() => setExisting(null)}>
              {t("join.useAnotherName")}
            </Button>
          </Card>
        )}

        {room && !existing && (
          <Card>
            <form onSubmit={join} className="flex flex-col gap-4">
              <div className="text-center">
                <p className="text-sm font-bold text-white/60">{t("join.room", { pin: room.pin })}</p>
                <p className="text-lg font-extrabold">{room.quizTitle}</p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-white/70">{t("join.nickname")}</span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={LIMITS.nicknameMax}
                  autoFocus
                  autoComplete="nickname"
                  placeholder={t("join.nicknamePlaceholder")}
                  className={`${inputClass} text-lg font-bold`}
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-bold text-white/70">{t("join.chooseAvatar")}</legend>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAvatar(id)}
                      aria-pressed={avatar === id}
                      className={`rounded-full p-0.5 transition ${avatar === id ? "scale-110 ring-4 ring-accent" : "opacity-70 hover:opacity-100"}`}
                    >
                      <Avatar id={id} size={44} className="w-full" />
                    </button>
                  ))}
                </div>
              </fieldset>

              <Button type="submit" size="lg" disabled={joining}>
                {joining ? t("join.joining") : t("join.submit")}
              </Button>
            </form>
          </Card>
        )}

        <ErrorBanner>{errorText(error)}</ErrorBanner>
      </main>
    </div>
  );
}
