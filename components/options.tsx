import type { QuestionType } from "@/lib/game/types";

/** Answer tiles use our own palette + icons (star / bolt / heart / moon). */
const OPTION_BG = ["bg-opt-0", "bg-opt-1", "bg-opt-2", "bg-opt-3"];

const ICONS = [
  // star
  "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z",
  // bolt
  "M13.5 2 4 13.5h6.5L9 22l10-12h-6.5z",
  // heart
  "M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.9a4.8 4.8 0 0 1 8.5 2.9C20.5 15.7 12 21 12 21z",
  // moon
  "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z",
];

const CHECK = "M4.5 12.5l5 5 10-11";
const CROSS = "M6 6l12 12M18 6 6 18";

export function optionBg(index: number, type: QuestionType, optionId: string): string {
  if (type === "true_false") return optionId === "true" ? "bg-opt-3" : "bg-opt-2";
  return OPTION_BG[index % OPTION_BG.length];
}

export function OptionIcon({
  index,
  type,
  optionId,
  className = "size-7",
}: {
  index: number;
  type: QuestionType;
  optionId: string;
  className?: string;
}) {
  if (type === "true_false") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={optionId === "true" ? CHECK : CROSS} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={ICONS[index % ICONS.length]} />
    </svg>
  );
}

export function CheckBadge({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={CHECK} />
    </svg>
  );
}

export function CrossBadge({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
      <path d={CROSS} />
    </svg>
  );
}
