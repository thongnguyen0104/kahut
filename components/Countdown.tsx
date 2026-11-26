/** Round countdown sticker: an ink ring that drains, tomato when ≤5s. */
export function CountdownRing({
  remainingMs,
  totalMs,
  size = 120,
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
}) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = seconds <= 5;

  return (
    <div
      className={`relative shrink-0 rounded-full border-3 border-ink shadow-hard ${urgent ? "bg-tomato" : "bg-sun"}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="#fff" stroke="rgb(23 19 15 / 0.12)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#17130f"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-extrabold tabular-nums"
        style={{ fontSize: size * 0.34 }}
      >
        {seconds}
      </span>
    </div>
  );
}

/** Full-width time bar for phones: easier to read at a glance than a ring. */
export function TimeBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = seconds <= 5;
  return (
    <div className="flex items-center gap-2" role="timer" aria-label={`${seconds}`}>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full border-3 border-ink bg-white">
        <div
          className={`absolute inset-y-0 left-0 border-r-3 border-ink ${urgent ? "bg-tomato" : "bg-sun"}`}
          style={{ width: `${fraction * 100}%`, transition: "width 0.2s linear" }}
        />
      </div>
      <span className="w-9 text-right font-display text-xl font-extrabold tabular-nums">{seconds}</span>
    </div>
  );
}

/** Bar that fills while the question is being read. */
export function ReadBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 1;
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-full border-3 border-ink bg-white shadow-hard-sm">
      <div
        className="absolute inset-y-0 left-0 bg-lilac"
        style={{ width: `${fraction * 100}%`, transition: "width 0.2s linear" }}
      />
    </div>
  );
}
