/**
 * Browser-side persistence. Player/host tokens live in localStorage so a refresh
 * keeps the session. Every access is guarded: storage can be blocked.
 * (Quizzes themselves belong to accounts and are listed from the API.)
 */

export interface PlayerSession {
  pin: string;
  playerId: string;
  playerToken: string;
  nickname: string;
  avatar: string;
}

export interface HostSession {
  pin: string;
  hostToken: string;
  quizId: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the session just won't survive a refresh
  }
}

export const getPlayerSession = (pin: string) => read<PlayerSession>(`player:${pin}`);
export const savePlayerSession = (s: PlayerSession) => write(`player:${s.pin}`, s);
export const clearPlayerSession = (pin: string) => write(`player:${pin}`, null);

export const getHostSession = (pin: string) => read<HostSession>(`host:${pin}`);
export const saveHostSession = (s: HostSession) => write(`host:${s.pin}`, s);
