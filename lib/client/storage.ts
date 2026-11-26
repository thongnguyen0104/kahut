/**
 * Browser-side persistence. Tokens live in localStorage so a refresh keeps the
 * player/host/editor session. Every access is guarded: storage can be blocked.
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

export interface SavedQuiz {
  id: string;
  editToken: string;
  title: string;
  questionCount: number;
  updatedAt: string;
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

const QUIZZES_KEY = "my-quizzes";

export function listMyQuizzes(): SavedQuiz[] {
  const list = read<SavedQuiz[]>(QUIZZES_KEY);
  return Array.isArray(list) ? list : [];
}

export function upsertMyQuiz(quiz: SavedQuiz): void {
  const rest = listMyQuizzes().filter((q) => q.id !== quiz.id);
  write(QUIZZES_KEY, [quiz, ...rest]);
}

export function removeMyQuiz(id: string): void {
  write(QUIZZES_KEY, listMyQuizzes().filter((q) => q.id !== id));
}

export function getQuizToken(id: string): string | null {
  return listMyQuizzes().find((q) => q.id === id)?.editToken ?? null;
}
