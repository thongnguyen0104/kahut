"use client";

import { useRef, useState } from "react";
import { Button, ErrorBanner, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/client/api";
import { uploadQuizAudio } from "@/lib/client/upload";
import { useErrorText, useI18n } from "@/lib/i18n/I18nProvider";

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

/** Upload / preview / remove an .mp3 (quiz background music or a question clip). */
export function AudioField({
  value,
  onChange,
  quizId,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  quizId: string;
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
      onChange(await uploadQuizAudio(file, quizId));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "audio_upload_failed");
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
        accept="audio/mpeg,.mp3"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border-3 border-ink bg-white p-2.5 shadow-hard-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-3 border-ink bg-mint" style={{ transform: "rotate(-6deg)" }}>
              <NoteIcon className="size-5" />
            </span>
            {/* key: reload the player when the file changes */}
            <audio key={value} src={value} controls preload="none" className="h-10 min-w-0 flex-1" />
            {uploading && <Spinner className="size-6" />}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {t("editor.changeAudio")}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)} disabled={uploading}>
              {t("editor.removeAudio")}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-3 rounded-2xl border-3 border-dashed border-ink/40 bg-paper-2/60 px-4 py-3 text-left transition hover:border-ink hover:bg-white"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-3 border-ink bg-mint shadow-hard-sm" style={{ transform: "rotate(-6deg)" }}>
            {uploading ? <Spinner className="size-5" /> : <NoteIcon className="size-5" />}
          </span>
          <span className="flex flex-col">
            <span className="font-display text-sm font-extrabold">
              {uploading ? t("editor.uploadingAudio") : `+ ${t("editor.addAudio")}`}
            </span>
            <span className="text-xs font-semibold text-ink-soft">{t("editor.audioLimit")}</span>
          </span>
        </button>
      )}
      <ErrorBanner>{errorText(error)}</ErrorBanner>
    </div>
  );
}
