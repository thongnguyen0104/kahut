/**
 * Server clock estimate. Every API response carries `serverNow`; we keep the
 * offset from the lowest-latency sample, so countdowns agree across devices.
 */
let offset = 0;
let bestRtt = Number.POSITIVE_INFINITY;
let bestAt = 0;

const SAMPLE_TTL_MS = 5 * 60_000;

export function syncClock(serverNow: number, sentAt: number, receivedAt: number): void {
  const rtt = Math.max(0, receivedAt - sentAt);
  const stale = receivedAt - bestAt > SAMPLE_TTL_MS;
  if (rtt <= bestRtt || stale) {
    offset = serverNow + rtt / 2 - receivedAt;
    bestRtt = rtt;
    bestAt = receivedAt;
  }
}

export function serverNow(): number {
  return Date.now() + offset;
}
