"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { APP_NAME } from "@/lib/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-ink hover:bg-accent-strong shadow-[0_4px_0_0_#b45309] active:translate-y-[2px] active:shadow-[0_2px_0_0_#b45309]",
  secondary: "bg-white/10 text-white hover:bg-white/20 ring-1 ring-inset ring-line",
  ghost: "text-white/80 hover:text-white hover:bg-white/10",
  danger: "bg-bad/90 text-white hover:bg-bad",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-base rounded-xl gap-2",
  lg: "h-14 px-7 text-lg rounded-2xl gap-2",
  xl: "h-16 px-10 text-2xl rounded-2xl gap-3",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `inline-flex items-center justify-center font-extrabold transition select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-accent">
      <Spinner className="size-10" />
    </div>
  );
}

export function Logo({ className = "text-2xl" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-1.5 font-black tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[1.1em] text-accent" fill="currentColor" aria-hidden>
        <path d="M13.5 2 4 13.5h6.5L9 22l10-12h-6.5z" />
      </svg>
      <span>{APP_NAME}</span>
    </Link>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-bad/15 px-4 py-3 text-sm font-semibold text-rose-200 ring-1 ring-bad/40">
      {children}
    </p>
  );
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
      className={`rounded-lg px-3 py-1.5 text-sm font-bold text-white/80 ring-1 ring-line hover:bg-white/10 hover:text-white ${className}`}
    >
      {t("lang.switchTo")}
    </button>
  );
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Logo />
      <div className="flex items-center gap-2">
        {children}
        <LanguageToggle />
      </div>
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-ink-2/80 p-5 ring-1 ring-line backdrop-blur sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent";
