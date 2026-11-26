/** Circular countdown. `remainingMs` / `totalMs` drive the ring. */
export function CountdownRing({
  remainingMs,
  totalMs,
  size = 120,
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
}) {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgent = seconds <= 5;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="rgb(255 255 255 / 0.08)" stroke="rgb(255 255 255 / 0.12)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? "var(--color-bad)" : "var(--color-accent)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-black tabular-nums ${urgent ? "text-rose-300" : "text-white"}`}
        style={{ fontSize: size * 0.36 }}
      >
        {seconds}
      </span>
    </div>
  );
}

/** Thin bar that fills while the question is being read. */
export function ReadBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 1;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${fraction * 100}%`, transition: "width 0.2s linear" }}
      />
    </div>
  );
}
