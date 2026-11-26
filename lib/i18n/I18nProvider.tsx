"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { en } from "./en";
import type { Locale, MessageKey, Messages, Translate } from "./types";
import { vi } from "./vi";

const MESSAGES: Record<Locale, Messages> = { vi, en };
const STORAGE_KEY = "locale";
const CHANGE_EVENT = "locale-change";
const DEFAULT_LOCALE: Locale = "vi";

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    // storage blocked: fall back to default
  }
  return DEFAULT_LOCALE;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function lookup(messages: Messages, key: MessageKey): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown>)?.[part];
  }
  return typeof node === "string" ? node : key;
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Server render and hydration use the default locale; the saved one applies right after.
  const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo<I18nValue>(() => {
    const messages = MESSAGES[locale];
    const t: Translate = (key, vars) => {
      const text = lookup(messages, key);
      if (!vars) return text;
      return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Translates an API error code, falling back to a generic message. */
export function useErrorText(): (code: string | null | undefined) => string {
  const { t } = useI18n();
  return useCallback(
    (code) => {
      if (!code) return "";
      const key = `errors.${code}` as MessageKey;
      const text = t(key);
      return text === key ? t("errors.server_error") : text;
    },
    [t],
  );
}
