"use client";

import { useState } from "react";
import { Button, Card, ErrorBanner, FullPageSpinner, Notice, PageTitle, Tag, TopBar, inputClass, labelClass } from "@/components/ui";
import { useRequireAuth } from "@/lib/client/auth";
import { getBrowserClient } from "@/lib/client/supabase";
import { PASSWORD_MIN_LENGTH } from "@/lib/accounts";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function AccountClient() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const { ready, user } = useRequireAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!ready || !user) return <FullPageSpinner />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) return setError("password_mismatch");
    if (next.length < PASSWORD_MIN_LENGTH) return setError("weak_password");
    if (next === current) return setError("same_password");

    setBusy(true);
    const auth = getBrowserClient().auth;
    // Re-check the current password first (also satisfies "recent login" rules).
    const verify = await auth.signInWithPassword({ email: user!.email, password: current });
    if (verify.error) {
      setError(verify.error.status === 429 ? "too_many_requests" : "wrong_password");
      setBusy(false);
      return;
    }
    const { error: updateError } = await auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "same_password"
          : updateError.code === "weak_password"
            ? "weak_password"
            : "server_error",
      );
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pb-12 pt-2">
        <PageTitle>{t("auth.account")}</PageTitle>

        <Card tone="sun" className="flex items-center gap-4" style={{ transform: "rotate(-0.8deg)" }}>
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-3 border-ink bg-white font-display text-3xl font-extrabold uppercase">
            {user.email.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-extrabold">{user.email}</p>
            <Tag tone={user.isSuperadmin ? "tomato" : "white"} tilt={0} className="mt-1">
              {user.isSuperadmin ? t("auth.roleSuperadmin") : t("auth.roleUser")}
            </Tag>
          </div>
        </Card>

        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold">{t("auth.changePassword")}</h2>
            <input type="email" value={user.email} autoComplete="username" readOnly hidden />
            {(
              [
                ["auth.currentPassword", current, setCurrent, "current-password"],
                ["auth.newPassword", next, setNext, "new-password"],
                ["auth.confirmPassword", confirm, setConfirm, "new-password"],
              ] as const
            ).map(([label, value, set, autoComplete]) => (
              <label key={label} className="flex flex-col gap-2">
                <span className={labelClass}>{t(label)}</span>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  autoComplete={autoComplete}
                  required
                  className={inputClass}
                />
              </label>
            ))}
            <p className="text-sm text-ink-soft">{t("auth.passwordHint", { n: PASSWORD_MIN_LENGTH })}</p>
            <Button type="submit" variant="dark" disabled={busy}>
              {busy ? t("common.saving") : t("auth.changePassword")}
            </Button>
          </form>
        </Card>
        {done && <Notice>{t("auth.passwordChanged")}</Notice>}
        <ErrorBanner>{errorText(error)}</ErrorBanner>
      </main>
    </div>
  );
}
