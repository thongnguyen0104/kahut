"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorBanner, FullPageSpinner, Notice, PageTitle, Spinner, Tag, TopBar, inputBase, inputClass, labelClass } from "@/components/ui";
import { PASSWORD_MIN_LENGTH, ROLES, type AccountView, type Role } from "@/lib/accounts";
import { errorCode } from "@/lib/client/api";
import { authApi, useAuth, useRequireAuth } from "@/lib/client/auth";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export default function AdminUsersClient() {
  const { ready } = useRequireAuth({ superadmin: true });
  if (!ready) return <FullPageSpinner />;
  return <AdminUsers />;
}

function AdminUsers() {
  const { t, locale } = useI18n();
  const errorText = useErrorText();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AccountView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    return authApi<{ users: AccountView[] }>("/api/admin/users").then(
      (res) => setUsers(res.users),
      (err) => setError(errorCode(err)),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel = (r: Role) => (r === "superadmin" ? t("auth.roleSuperadmin") : t("auth.roleUser"));
  const dateFormat = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });

  async function run(id: string, action: () => Promise<unknown>, message: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authApi<{ user: AccountView }>("/api/admin/users", {
        method: "POST",
        body: { email, password, role },
      });
      setNotice(t("admin.created", { email: res.user.email }));
      setEmail("");
      setPassword("");
      setRole("user");
      await load();
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setCreating(false);
    }
  }

  function resetPassword(u: AccountView) {
    const value = window.prompt(t("admin.resetPrompt", { email: u.email, n: PASSWORD_MIN_LENGTH }));
    if (!value) return;
    void run(
      u.id,
      () => authApi(`/api/admin/users/${u.id}`, { method: "PATCH", body: { password: value } }),
      t("admin.passwordReset", { email: u.email }),
    );
  }

  function changeRole(u: AccountView, next: Role) {
    void run(
      u.id,
      () => authApi(`/api/admin/users/${u.id}`, { method: "PATCH", body: { role: next } }),
      t("admin.roleChanged", { email: u.email }),
    );
  }

  function remove(u: AccountView) {
    if (!window.confirm(t("admin.deleteConfirm", { email: u.email }))) return;
    void run(
      u.id,
      () => authApi(`/api/admin/users/${u.id}`, { method: "DELETE" }),
      t("admin.deleted", { email: u.email }),
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-12 pt-2">
        <div className="flex flex-col gap-2">
          <PageTitle label="Superadmin" tone="tomato">
            {t("admin.title")}
          </PageTitle>
          <p className="max-w-xl font-medium text-ink-soft">{t("admin.hint")}</p>
        </div>

        <Card tone="sun">
          <form onSubmit={create} className="flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold">+ {t("admin.createTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1.5fr_auto] sm:items-end">
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{t("auth.email")}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" className={inputClass} />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{t("auth.password")}</span>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className={labelClass}>{t("auth.role")}</span>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputBase} text-base font-bold`}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="lg" variant="dark" disabled={creating}>
                {creating ? t("admin.creating") : t("admin.create")}
              </Button>
            </div>
            <p className="text-sm font-medium">{t("auth.passwordHint", { n: PASSWORD_MIN_LENGTH })}</p>
          </form>
        </Card>

        <Notice>{notice}</Notice>
        <ErrorBanner>{errorText(error)}</ErrorBanner>

        {!users ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-8" />
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <p className="font-display text-lg font-extrabold">{t("admin.count", { count: users.length })}</p>
            <ul className="flex flex-col gap-3">
              {users.map((u) => {
                const isMe = u.id === me?.id;
                const superadmin = u.role === "superadmin";
                return (
                  <li key={u.id} className="sticker flex flex-wrap items-center gap-3 bg-white p-4">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-3 border-ink font-display text-lg font-extrabold uppercase ${superadmin ? "bg-tomato" : "bg-lilac"}`}
                      aria-hidden
                    >
                      {u.email.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-display text-lg font-extrabold">
                        <span className="truncate">{u.email}</span>
                        {isMe && (
                          <Tag tone="sun" tilt={0}>
                            {t("admin.you")}
                          </Tag>
                        )}
                      </p>
                      <p className="text-xs font-medium text-ink-soft">
                        {t("admin.createdAt")}: {dateFormat.format(new Date(u.createdAt))} · {t("admin.lastSignIn")}:{" "}
                        {u.lastSignInAt ? dateFormat.format(new Date(u.lastSignInAt)) : t("admin.never")}
                      </p>
                    </div>
                    <select
                      value={u.role}
                      disabled={isMe || busyId === u.id}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      aria-label={t("auth.role")}
                      className={`h-10 rounded-xl border-3 border-ink px-3 font-display text-sm font-extrabold disabled:opacity-60 ${superadmin ? "bg-tomato-soft" : "bg-white"}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <Button variant="secondary" size="sm" disabled={busyId === u.id} onClick={() => resetPassword(u)}>
                      {t("admin.resetPassword")}
                    </Button>
                    {!isMe && (
                      <Button variant="danger" size="sm" disabled={busyId === u.id} onClick={() => remove(u)}>
                        {t("common.delete")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
