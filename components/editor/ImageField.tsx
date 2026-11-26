"use client";

import { useRef, useState } from "react";
import { Button, ErrorBanner, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/client/api";
import { uploadQuizImage } from "@/lib/client/upload";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

export function ImageField({
  value,
  onChange,
  quizId,
  editToken,
  compact = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  quizId: string;
  editToken: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadQuizImage(file, quizId, editToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "upload_failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-2xl bg-black/30 ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className={`mx-auto w-auto object-contain ${compact ? "max-h-40" : "max-h-64"}`} />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button size="sm" variant="secondary" className="bg-ink/80" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {t("editor.changeImage")}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)} disabled={uploading}>
              {t("editor.removeImage")}
            </Button>
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <Spinner className="size-8 text-accent" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-white/60 transition hover:border-accent hover:text-white ${compact ? "h-28" : "h-40"}`}
        >
          {uploading ? (
            <>
              <Spinner className="size-7 text-accent" />
              <span className="text-sm font-bold">{t("editor.uploading")}</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span className="text-sm font-bold">{t("editor.addImage")}</span>
            </>
          )}
        </button>
      )}
      <ErrorBanner>{errorText(error)}</ErrorBanner>
    </div>
  );
}
