"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorBanner, FullPageSpinner, Tag, TopBar, buttonClass, inputClass, labelClass } from "@/components/ui";
import { errorCode } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

/** Only same-site paths, so ?next= can't be used to bounce users to another site. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/my-quizzes";
}

export default function LoginClient() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { loading, user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // The effect above redirects once the session is stored.
    } catch (err) {
      setError(errorCode(err));
      setBusy(false);
    }
  }

  if (loading || user) return <FullPageSpinner />;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pb-16">
        <Card className="flex flex-col gap-5 p-6 sm:p-8" style={{ transform: "rotate(-0.8deg)" }}>
          <div className="flex flex-col items-start gap-2">
            <Tag tone="lilac">{t("auth.hostOnly")}</Tag>
            <h1 className="text-3xl font-extrabold leading-tight">{t("auth.loginTitle")}</h1>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className={labelClass}>{t("auth.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>{t("auth.password")}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>
            <Button type="submit" size="lg" variant="dark" disabled={busy}>
              {busy ? t("auth.signingIn") : t("auth.login")}
            </Button>
          </form>
          <p className="text-sm font-medium text-ink-soft">{t("auth.loginHint")}</p>
        </Card>

        <ErrorBanner>{errorText(error)}</ErrorBanner>

        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-3 border-dashed border-ink/50 p-4"
          style={{ transform: "rotate(0.6deg)" }}
        >
          <span className="text-sm font-semibold">{t("auth.playerNote")}</span>
          <Link href="/" className={buttonClass("primary", "sm")}>
            {t("auth.playerCta")}
          </Link>
        </div>
      </main>
    </div>
  );
}
