"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useAuth } from "@/lib/client/auth";
import { APP_NAME } from "@/lib/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

/* ------------------------------------------------------------- buttons */

type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "press border-3 border-ink bg-tomato text-ink shadow-hard-sm hover:shadow-hard",
  secondary: "press border-3 border-ink bg-white text-ink shadow-hard-sm hover:shadow-hard",
  dark: "press border-3 border-ink bg-ink text-paper shadow-[3px_3px_0_0_var(--color-tomato)]",
  ghost: "border-3 border-transparent text-ink underline-offset-4 decoration-2 hover:underline",
  danger: "press border-3 border-ink bg-white text-tomato-deep shadow-hard-sm hover:bg-tomato-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-10 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-12 px-5 text-base rounded-xl gap-2",
  lg: "h-14 px-7 text-lg rounded-2xl gap-2",
  xl: "h-16 px-9 text-2xl rounded-2xl gap-3",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `inline-flex items-center justify-center font-display font-extrabold tracking-tight select-none whitespace-nowrap disabled:opacity-45 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------- surfaces */

export type Tone = "white" | "paper" | "sun" | "lilac" | "mint" | "bubble" | "tomato" | "sky";

export const TONE_BG: Record<Tone, string> = {
  white: "bg-white",
  paper: "bg-paper-2",
  sun: "bg-sun",
  lilac: "bg-lilac",
  mint: "bg-mint",
  bubble: "bg-bubble",
  tomato: "bg-tomato",
  sky: "bg-sky",
};

export function Card({
  children,
  className = "",
  tone = "white",
  style,
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return (
    <div className={`sticker p-5 sm:p-6 ${TONE_BG[tone]} ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Small rotated label, like a price sticker. */
export function Tag({
  children,
  tone = "sun",
  tilt = -2,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  tilt?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wider ${TONE_BG[tone]} ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  );
}

/** A 6-digit PIN as individual tiles, like letter tiles in a board game. */
export function PinTiles({ pin, size = "lg" }: { pin: string; size?: "md" | "lg" | "xl" }) {
  const box = {
    md: "h-12 w-10 text-3xl rounded-lg border-2",
    lg: "h-16 w-12 text-4xl rounded-xl border-3",
    xl: "h-20 w-14 text-5xl rounded-2xl border-3 xl:h-24 xl:w-16 xl:text-6xl",
  }[size];
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={pin}>
      {pin.split("").map((d, i) => (
        <span
          key={i}
          aria-hidden
          className={`flex items-center justify-center border-ink bg-white font-display font-extrabold tabular-nums shadow-hard-sm ${box} ${i === 3 ? "ml-2" : ""}`}
          style={{ transform: `rotate(${[-2, 1.5, -1, 2, -1.5, 1][i]}deg)` }}
        >
          {d}
        </span>
      ))}
    </span>
  );
}

/** Field chrome without font size/weight, for fields that set their own type. */
export const inputBase =
  "w-full rounded-xl border-3 border-ink bg-white px-4 py-3 text-ink placeholder:text-ink-soft/60 outline-none transition focus:shadow-hard-sm focus:-translate-x-px focus:-translate-y-px focus-visible:outline-none";

export const inputClass = `${inputBase} text-base font-medium`;

export const labelClass = "font-display text-sm font-extrabold";

/* ------------------------------------------------------------- feedback */

export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner className="size-10" />
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border-3 border-ink bg-tomato-soft px-4 py-3 text-sm font-semibold shadow-hard-sm"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-tomato font-display text-xs font-black">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2.5 rounded-xl border-3 border-ink bg-mint/40 px-4 py-3 text-sm font-semibold shadow-hard-sm"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-mint" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------ chrome */

export function Logo({ className = "text-2xl" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${className}`}>
      <span
        className="flex size-[1.45em] items-center justify-center rounded-lg border-3 border-ink bg-sun shadow-hard-sm transition group-hover:rotate-0"
        style={{ transform: "rotate(-8deg)" }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-[0.85em]" fill="currentColor">
          <path d="M13.5 2 4 13.5h6.5L9 22l10-12h-6.5z" />
        </svg>
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
      title={t("lang.switchTo")}
      className={`press flex h-10 items-center gap-1.5 rounded-xl border-3 border-ink bg-white px-2.5 font-display text-sm font-extrabold shadow-hard-sm ${className}`}
    >
      <span className={locale === "vi" ? "rounded-md bg-sun px-1.5" : "px-1.5 text-ink-soft"}>VI</span>
      <span className={locale === "en" ? "rounded-md bg-sun px-1.5" : "px-1.5 text-ink-soft"}>EN</span>
    </button>
  );
}

/** Sign-in link, or the account's links + sign-out when signed in. */
export function UserMenu() {
  const { t } = useI18n();
  const { loading, user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  if (loading) return null;
  if (!user) {
    if (pathname === "/login") return null;
    return (
      <Link href="/login" className={buttonClass("secondary", "sm")}>
        {t("auth.login")}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {user.isSuperadmin && (
        <Link href="/admin/users" className={buttonClass("ghost", "sm", "hidden md:inline-flex")}>
          {t("auth.manageUsers")}
        </Link>
      )}
      <Link
        href="/account"
        title={t("auth.signedInAs", { email: user.email })}
        className={buttonClass("secondary", "sm", "max-w-44 gap-2")}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lilac text-[11px] uppercase" aria-hidden>
          {user.email.slice(0, 1)}
        </span>
        <span className="truncate">{user.email}</span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
      >
        {t("auth.logout")}
      </Button>
    </div>
  );
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
      <Logo />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        <UserMenu />
        <LanguageToggle />
      </div>
    </header>
  );
}

/** Big page title with an optional rotated sticker label above it. */
export function PageTitle({ children, label, tone = "sun" }: { children: ReactNode; label?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {label && <Tag tone={tone}>{label}</Tag>}
      <h1 className="text-4xl font-extrabold leading-none sm:text-5xl">{children}</h1>
    </div>
  );
}
