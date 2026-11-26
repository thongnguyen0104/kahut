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
  compact = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  quizId: string;
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
      onChange(await uploadQuizImage(file, quizId));
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
        <div className="flex flex-col gap-3">
          {/* Polaroid-style frame */}
          <div className="relative self-start rounded-xl border-3 border-ink bg-white p-2 pb-3 shadow-hard" style={{ transform: "rotate(-1deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className={`w-auto rounded-md object-contain ${compact ? "max-h-40" : "max-h-60"}`} />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
                <Spinner className="size-8" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {t("editor.changeImage")}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)} disabled={uploading}>
              {t("editor.removeImage")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-ink/40 bg-paper-2/60 transition hover:border-ink hover:bg-white ${compact ? "h-32" : "h-44"}`}
        >
          {uploading ? (
            <>
              <Spinner className="size-7" />
              <span className="text-sm font-bold">{t("editor.uploading")}</span>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-xl border-3 border-ink bg-sky shadow-hard-sm" style={{ transform: "rotate(-6deg)" }}>
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </span>
              <span className="font-display text-sm font-extrabold">+ {t("editor.addImage")}</span>
            </>
          )}
        </button>
      )}
      <ErrorBanner>{errorText(error)}</ErrorBanner>
    </div>
  );
}
