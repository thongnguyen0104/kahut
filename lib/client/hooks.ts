"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { serverNow } from "./clock";

const noop = () => () => {};

/** false during SSR/hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Server-synced "now", re-rendering every `intervalMs` while `active`. */
export function useServerNow(intervalMs = 200, active = true): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
