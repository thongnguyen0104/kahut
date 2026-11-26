/**
 * Load test / end-to-end check with simulated players.
 *
 *   npm run bots -- --players 30                 # full auto: creates a quiz, hosts it, plays it, verifies scores
 *   npm run bots -- --players 30 --pin 123456    # bots only: join a room you host in the browser
 *
 * Options: --base http://localhost:3000  --min-delay 500  --max-delay 6000
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { GameView, PublicQuestion, QuizContent } from "../lib/game/types";
import { normalizeSupabaseUrl } from "../lib/supabaseUrl";

try {
  process.loadEnvFile(".env.local");
} catch {
  // rely on the real environment
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const PLAYERS = Number(arg("players", "30"));
const GIVEN_PIN = arg("pin", "");
const MIN_DELAY = Number(arg("min-delay", "500"));
const MAX_DELAY = Number(arg("max-delay", "6000"));
const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local)");
  process.exit(1);
}

const stats = {
  httpErrors: new Map<string, number>(),
  answerLatency: [] as number[],
  broadcastLatency: [] as number[],
  answersSent: 0,
};

function countError(code: string) {
  stats.httpErrors.set(code, (stats.httpErrors.get(code) ?? 0) + 1);
}

let clockOffset = 0; // serverTime - localTime

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const sent = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = `${res.status} ${String(data.error ?? "unknown")}`;
    countError(code);
    throw new Error(`${init.method ?? "GET"} ${path} → ${code}`);
  }
  const serverNow = (data.view as GameView | undefined)?.serverNow ?? (data.serverNow as number | undefined);
  if (typeof serverNow === "number") {
    const rtt = Date.now() - sent;
    clockOffset = serverNow + rtt / 2 - Date.now();
  }
  return data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pct = (list: number[], p: number) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};

/* ----------------------------------------------------------- demo quiz */

const DEMO_QUIZ: QuizContent = {
  title: "Bot test quiz",
  description: "",
  coverImageUrl: null,
  questions: [
    {
      id: "q1", type: "single", prompt: "Thủ đô của Việt Nam?", imageUrl: null, timeLimitSec: 10, pointsMultiplier: 1,
      options: [
        { id: "a", text: "Huế", isCorrect: false },
        { id: "b", text: "Hà Nội", isCorrect: true },
        { id: "c", text: "Đà Nẵng", isCorrect: false },
        { id: "d", text: "Cần Thơ", isCorrect: false },
      ],
      acceptedAnswers: [],
    },
    {
      id: "q2", type: "true_false", prompt: "Mặt trời mọc ở hướng Tây.", imageUrl: null, timeLimitSec: 10, pointsMultiplier: 2,
      options: [
        { id: "true", text: "", isCorrect: false },
        { id: "false", text: "", isCorrect: true },
      ],
      acceptedAnswers: [],
    },
    {
      id: "q3", type: "multi", prompt: "Số nào là số nguyên tố?", imageUrl: null, timeLimitSec: 10, pointsMultiplier: 1,
      options: [
        { id: "a", text: "2", isCorrect: true },
        { id: "b", text: "4", isCorrect: false },
        { id: "c", text: "7", isCorrect: true },
        { id: "d", text: "9", isCorrect: false },
      ],
      acceptedAnswers: [],
    },
    {
      id: "q4", type: "text", prompt: "Thành phố lớn nhất miền Nam?", imageUrl: null, timeLimitSec: 10, pointsMultiplier: 1,
      options: [],
      acceptedAnswers: ["Hồ Chí Minh", "Sài Gòn"],
    },
    {
      id: "q5", type: "single", prompt: "2 + 3 = ?", imageUrl: null, timeLimitSec: 10, pointsMultiplier: 0,
      options: [
        { id: "a", text: "5", isCorrect: true },
        { id: "b", text: "6", isCorrect: false },
      ],
      acceptedAnswers: [],
    },
  ],
};

/** Picks an answer: right ~60% of the time when the quiz is known, random otherwise. */
function pickAnswer(q: PublicQuestion, known?: QuizContent["questions"][number]) {
  const smart = known && Math.random() < 0.6;
  if (q.type === "text") {
    if (smart) return { text: known!.acceptedAnswers[0].toLowerCase() };
    return { text: Math.random() < 0.5 ? "sai gon" : "Hà Nội" };
  }
  if (smart) return { optionIds: known!.options.filter((o) => o.isCorrect).map((o) => o.id) };
  if (q.type === "multi") {
    const ids = q.options.filter(() => Math.random() < 0.5).map((o) => o.id);
    return { optionIds: ids.length ? ids : [q.options[0].id] };
  }
  return { optionIds: [q.options[Math.floor(Math.random() * q.options.length)].id] };
}

/* ---------------------------------------------------------------- bots */

interface Bot {
  name: string;
  playerId: string;
  token: string;
  client: SupabaseClient;
  channel: RealtimeChannel;
  answered: Set<number>;
}

async function startBot(pin: string, i: number, quiz?: QuizContent): Promise<Bot> {
  const name = `Bot ${String(i + 1).padStart(2, "0")}`;
  const avatar = `a${String(i % 24).padStart(2, "0")}`;
  const joined = await call<{ playerId: string; playerToken: string }>(`/api/games/${pin}/join`, {
    method: "POST",
    body: { nickname: name, avatar },
  });

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const bot: Bot = {
    name,
    playerId: joined.playerId,
    token: joined.playerToken,
    client,
    channel: client.channel(`game:${pin}`, { config: { presence: { key: joined.playerId } } }),
    answered: new Set(),
  };

  bot.channel.on("broadcast", { event: "state_changed" }, ({ payload }) => {
    const view = payload as GameView;
    stats.broadcastLatency.push(Date.now() + clockOffset - view.serverNow);
    if (view.status !== "question" || !view.question || bot.answered.has(view.questionIndex)) return;
    bot.answered.add(view.questionIndex);
    const startsIn = (view.startedAt ?? 0) - (Date.now() + clockOffset);
    const delay = startsIn + rand(MIN_DELAY, Math.min(MAX_DELAY, view.question.timeLimitSec * 1000 - 500));
    const known = quiz?.questions[view.questionIndex];
    const question = view.question;
    void sleep(delay).then(async () => {
      const t0 = Date.now();
      try {
        await call(`/api/games/${pin}/answer`, {
          method: "POST",
          token: bot.token,
          body: { questionIndex: view.questionIndex, ...pickAnswer(question, known) },
        });
        stats.answersSent += 1;
        stats.answerLatency.push(Date.now() - t0);
      } catch (err) {
        console.warn(`${bot.name}: ${(err as Error).message}`);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name}: realtime subscribe timed out`)), 15_000);
    bot.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        void bot.channel.track({ online: true });
        resolve();
      }
    });
  });
  return bot;
}

/* -------------------------------------------------------------- host */

async function autoHost(): Promise<void> {
  const created = await call<{ id: string; editToken: string }>("/api/quizzes", { method: "POST", body: {} });
  await call(`/api/quizzes/${created.id}`, { method: "PUT", token: created.editToken, body: DEMO_QUIZ });
  const game = await call<{ pin: string; hostToken: string }>("/api/games", {
    method: "POST",
    token: created.editToken,
    body: { quizId: created.id },
  });
  console.log(`Room ${game.pin} created. Starting ${PLAYERS} bots…`);

  const t0 = Date.now();
  const bots = await Promise.all(Array.from({ length: PLAYERS }, (_, i) => startBot(game.pin, i, DEMO_QUIZ)));
  console.log(`${bots.length} bots joined + subscribed in ${Date.now() - t0} ms`);

  const state = () => call<{ view: GameView }>(`/api/games/${game.pin}/state`).then((r) => r.view);
  const control = (action: string) =>
    call<{ changed: boolean; view: GameView }>(`/api/games/${game.pin}/control`, {
      method: "POST",
      token: game.hostToken,
      body: { action },
    });

  const lobby = await state();
  if (lobby.players.length !== PLAYERS) throw new Error(`lobby shows ${lobby.players.length}/${PLAYERS} players`);

  const expected = new Map<string, number>();
  let view = (await control("start")).view;

  while (view.status === "question") {
    const q = view.question!;
    const deadline = view.startedAt! + q.timeLimitSec * 1000;
    // Wait until everyone answered or time is up (like the host screen does).
    for (;;) {
      await sleep(400);
      const s = await state();
      if (s.answeredPlayerIds.length >= PLAYERS || Date.now() + clockOffset >= deadline) break;
    }
    const revealed = (await control("reveal")).view;
    const r = revealed.reveal!;
    const answered = Object.values(r.results).filter((x) => x.answered).length;
    const correct = Object.values(r.results).filter((x) => x.correct).length;
    console.log(
      `Q${revealed.questionIndex + 1} (${q.type}): ${answered}/${PLAYERS} answered, ${correct} correct, distribution ${JSON.stringify(r.distribution)}`,
    );
    for (const [id, res] of Object.entries(r.results)) expected.set(id, (expected.get(id) ?? 0) + res.points);

    // Idempotency: a second reveal must be a no-op.
    if ((await control("reveal")).changed) throw new Error("duplicate reveal changed the game");

    await control("leaderboard");
    view = (await control("next")).view;
  }

  const final = await state();
  let mismatches = 0;
  for (const p of final.players) {
    if (p.score !== (expected.get(p.id) ?? 0)) {
      mismatches += 1;
      console.error(`score mismatch for ${p.nickname}: ${p.score} vs ${expected.get(p.id)}`);
    }
  }
  console.log(`\nFinal status: ${final.status}. Top 3: ${final.players.slice(0, 3).map((p) => `${p.nickname} ${p.score}`).join(", ")}`);
  console.log(mismatches === 0 ? "✔ All scores match the sum of revealed points" : `✘ ${mismatches} score mismatches`);

  await Promise.all(bots.map((b) => b.client.removeAllChannels()));
  report();
  if (mismatches > 0 || final.status !== "finished") process.exitCode = 1;
}

async function botsOnly(pin: string): Promise<void> {
  const bots = await Promise.all(Array.from({ length: PLAYERS }, (_, i) => startBot(pin, i)));
  console.log(`${bots.length} bots in room ${pin}. Host the game in your browser; Ctrl+C to stop.`);
  process.on("SIGINT", async () => {
    await Promise.all(bots.map((b) => b.client.removeAllChannels()));
    report();
    process.exit(0);
  });
}

function report() {
  console.log("\n── stats ──");
  console.log(`answers sent: ${stats.answersSent}`);
  console.log(`answer HTTP latency ms  p50=${pct(stats.answerLatency, 50)} p95=${pct(stats.answerLatency, 95)} max=${pct(stats.answerLatency, 100)}`);
  console.log(`broadcast latency ms    p50=${pct(stats.broadcastLatency, 50)} p95=${pct(stats.broadcastLatency, 95)} max=${pct(stats.broadcastLatency, 100)}`);
  console.log(`HTTP errors: ${stats.httpErrors.size ? JSON.stringify(Object.fromEntries(stats.httpErrors)) : "none"}`);
}

(GIVEN_PIN ? botsOnly(GIVEN_PIN) : autoHost()).catch((err) => {
  console.error(err);
  report();
  process.exit(1);
});
