"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** width / height of the picture once it has loaded (null until then). */
function useImageRatio(src: string): number | null {
  const [measured, setMeasured] = useState<{ src: string; ratio: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive && img.naturalWidth && img.naturalHeight) {
        setMeasured({ src, ratio: img.naturalWidth / img.naturalHeight });
      }
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return measured?.src === src ? measured.ratio : null;
}

/**
 * Largest size that fits the nearest size container while keeping the aspect ratio, so the ink
 * frame hugs the picture and small uploads are scaled up too. Leaves room for the 3px border
 * and the 5px hard shadow.
 */
function fitStyle(ratio: number | null): CSSProperties {
  return ratio
    ? { width: `min(100cqw - 6px, ${ratio} * (100cqh - 12px) + 6px)` }
    : { maxWidth: "calc(100cqw - 6px)", maxHeight: "calc(100cqh - 12px)" };
}

/**
 * Size container that fills its (relatively positioned) parent. Absolutely positioned so its
 * size never comes from flex-grow: Chrome resolved `cqh` to 0 for a flex-grown container.
 */
function FitBox({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center @container-size">{children}</div>;
}

function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5M10.5 8v5M8 10.5h5" />
    </svg>
  );
}

/**
 * Question picture that fills its box (give it a size: flex-1, h-full, or `aspect` + a max height)
 * and opens full screen on tap. Pass `zoomed`/`onZoomedChange` to keep the zoom open across
 * screens that render separate instances (e.g. reading → answering).
 */
export function QuestionImage({
  src,
  className = "",
  style,
  aspect = false,
  zoomed: zoomedProp,
  onZoomedChange,
  zoomHeader,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** Size the box from the picture's aspect ratio (full width, cap it with a max height). */
  aspect?: boolean;
  zoomed?: boolean;
  onZoomedChange?: (zoomed: boolean) => void;
  /** Shown above the enlarged picture, e.g. the countdown. */
  zoomHeader?: ReactNode;
}) {
  const { t } = useI18n();
  const ratio = useImageRatio(src);
  const [zoomedState, setZoomedState] = useState(false);
  const zoomed = zoomedProp ?? zoomedState;
  const setZoomed = onZoomedChange ?? setZoomedState;
  const close = useCallback(() => setZoomed(false), [setZoomed]);

  return (
    <>
      <div className={`relative ${className}`} style={aspect ? { aspectRatio: ratio ?? 4 / 3, ...style } : style}>
        <FitBox>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={t("common.zoomImage")}
            title={t("common.zoomImage")}
            className="group relative cursor-zoom-in rounded-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className={`block rounded-2xl border-3 border-ink bg-white shadow-hard ${ratio ? "" : "invisible"}`}
              style={fitStyle(ratio)}
            />
            <span
              aria-hidden
              className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full border-3 border-ink bg-sun shadow-hard-sm transition group-hover:scale-110"
            >
              <MagnifierIcon className="size-5" />
            </span>
          </button>
        </FitBox>
      </div>
      {zoomed && (
        <ImageLightbox src={src} ratio={ratio} onClose={close}>
          {zoomHeader}
        </ImageLightbox>
      )}
    </>
  );
}

/** Full-screen view of a picture. Tap anywhere, press Esc or use the button to close. */
function ImageLightbox({
  src,
  ratio,
  onClose,
  children,
}: {
  src: string;
  ratio: number | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("common.zoomImage")}
      onClick={onClose}
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col gap-3 bg-paper p-3 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <Button variant="dark" size="sm" onClick={onClose} autoFocus>
          ✕ {t("common.close")}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <FitBox>
          {/* Taps on the picture don't close it, so a double-tap or pinch to zoom is safe. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="block cursor-default rounded-2xl border-3 border-ink bg-white shadow-hard"
            style={fitStyle(ratio)}
          />
        </FitBox>
      </div>
      {ratio !== null && ratio > 1.1 && (
        <p className="hidden text-center text-sm font-bold text-ink-soft portrait:pointer-coarse:block">
          {t("common.rotateHint")}
        </p>
      )}
    </div>
  );
}
