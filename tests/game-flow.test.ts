import { describe, expect, it } from "vitest";
import { planTransition, progressKey } from "@/lib/game/transitions";
import { findQuizProblems, sanitizeQuiz } from "@/lib/game/validate";
import { buildGameView, rankPlayers, type GameRow, type PlayerRow } from "@/lib/game/view";
import { generatePin, hashToken, tokenMatches, generateToken } from "@/lib/tokens";

describe("planTransition", () => {
  const lobby = { status: "lobby", questionIndex: -1 } as const;

  it("walks lobby → question → reveal → leaderboard → next question → finished", () => {
    const s1 = planTransition(lobby, "start", 2);
    expect(s1).toMatchObject({ ok: true, to: { status: "question", questionIndex: 0 } });
    const s2 = planTransition({ status: "question", questionIndex: 0 }, "reveal", 2);
    expect(s2).toMatchObject({ ok: true, to: { status: "reveal", questionIndex: 0 } });
    const s3 = planTransition({ status: "reveal", questionIndex: 0 }, "leaderboard", 2);
    expect(s3).toMatchObject({ ok: true, to: { status: "leaderboard", questionIndex: 0 } });
    const s4 = planTransition({ status: "leaderboard", questionIndex: 0 }, "next", 2);
    expect(s4).toMatchObject({ ok: true, to: { status: "question", questionIndex: 1 } });
    const s5 = planTransition({ status: "reveal", questionIndex: 1 }, "next", 2);
    expect(s5).toMatchObject({ ok: true, to: { status: "finished" } });
  });

  it("rejects invalid moves", () => {
    expect(planTransition(lobby, "reveal", 2).ok).toBe(false);
    expect(planTransition(lobby, "start", 0)).toEqual({ ok: false, error: "no_questions" });
    expect(planTransition({ status: "question", questionIndex: 0 }, "next", 2).ok).toBe(false);
    expect(planTransition({ status: "finished", questionIndex: 1 }, "end", 2).ok).toBe(false);
  });

  it("allows ending from any live state", () => {
    expect(planTransition(lobby, "end", 2).ok).toBe(true);
    expect(planTransition({ status: "question", questionIndex: 1 }, "end", 2).ok).toBe(true);
  });

  it("progressKey only increases along the flow", () => {
    const seq = [
      { status: "lobby", questionIndex: -1 },
      { status: "question", questionIndex: 0 },
      { status: "reveal", questionIndex: 0 },
      { status: "leaderboard", questionIndex: 0 },
      { status: "question", questionIndex: 1 },
      { status: "reveal", questionIndex: 1 },
      { status: "finished", questionIndex: 1 },
    ] as const;
    const keys = seq.map(progressKey);
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("sanitizeQuiz / findQuizProblems", () => {
  const prefix = "https://x.supabase.co/storage/v1/object/public/quiz-images/";

  it("coerces bad input and drops foreign image URLs", () => {
    const quiz = sanitizeQuiz(
      {
        title: "  My quiz  ",
        coverImageUrl: "https://evil.example/a.png",
        questions: [
          {
            id: "q1",
            type: "single",
            prompt: "2+2?",
            imageUrl: `${prefix}abc/1.webp`,
            timeLimitSec: 999,
            pointsMultiplier: 7,
            options: [
              { id: "a", text: "3", isCorrect: true },
              { id: "b", text: "4", isCorrect: true },
            ],
          },
          { type: "nope", prompt: 42 },
        ],
      },
      prefix,
    );
    expect(quiz).not.toBeNull();
    expect(quiz!.title).toBe("My quiz");
    expect(quiz!.coverImageUrl).toBeNull();
    const [q1, q2] = quiz!.questions;
    expect(q1.imageUrl).toBe(`${prefix}abc/1.webp`);
    expect(q1.timeLimitSec).toBe(20);
    expect(q1.pointsMultiplier).toBe(1);
    // single choice keeps only the first correct flag
    expect(q1.options.map((o) => o.isCorrect)).toEqual([true, false]);
    expect(q2.type).toBe("single");
    expect(q2.prompt).toBe("");
  });

  it("forces true/false options", () => {
    const quiz = sanitizeQuiz(
      { title: "t", questions: [{ type: "true_false", prompt: "p", options: [{ id: "false", isCorrect: true }] }] },
      null,
    );
    expect(quiz!.questions[0].options).toEqual([
      { id: "true", text: "", isCorrect: false },
      { id: "false", text: "", isCorrect: true },
    ]);
  });

  it("returns null for non-quiz payloads", () => {
    expect(sanitizeQuiz(null, null)).toBeNull();
    expect(sanitizeQuiz({ title: "x" }, null)).toBeNull();
  });

  it("reports what blocks playing", () => {
    const quiz = sanitizeQuiz(
      {
        title: "",
        questions: [
          { type: "single", prompt: "", options: [{ id: "a", text: "A" }, { id: "b", text: "" }] },
          { type: "multi", prompt: "m", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
          { type: "text", prompt: "t", acceptedAnswers: [] },
        ],
      },
      null,
    )!;
    const codes = findQuizProblems(quiz).map((p) => `${p.questionIndex}:${p.code}`);
    expect(codes).toEqual([
      "-1:title_required",
      "0:prompt_required",
      "0:option_text_required",
      "0:needs_one_correct",
      "1:needs_some_correct",
      "2:accepted_required",
    ]);
  });
});

describe("buildGameView", () => {
  const players: PlayerRow[] = [
    { id: "p1", game_id: "g", nickname: "An", avatar: "a01", score: 900, streak: 1, kicked: false, joined_at: "2026-01-01T00:00:01Z" },
    { id: "p2", game_id: "g", nickname: "Bình", avatar: "a02", score: 1500, streak: 2, kicked: false, joined_at: "2026-01-01T00:00:02Z" },
    { id: "p3", game_id: "g", nickname: "Chi", avatar: "a03", score: 900, streak: 0, kicked: false, joined_at: "2026-01-01T00:00:03Z" },
    { id: "p4", game_id: "g", nickname: "Kicked", avatar: "a04", score: 5000, streak: 0, kicked: true, joined_at: "2026-01-01T00:00:00Z" },
  ];

  const game: GameRow = {
    id: "g",
    pin: "123456",
    quiz_id: "quiz",
    host_token_hash: "x",
    status: "question",
    current_question_index: 0,
    question_started_at: "2026-01-01T00:01:00.000Z",
    created_at: "2026-01-01T00:00:00Z",
    quiz_snapshot: {
      title: "Quiz",
      description: "",
      coverImageUrl: null,
      questions: [
        {
          id: "q1",
          type: "single",
          prompt: "?",
          imageUrl: null,
          timeLimitSec: 20,
          pointsMultiplier: 1,
          options: [
            { id: "a", text: "A", isCorrect: true },
            { id: "b", text: "B", isCorrect: false },
          ],
          acceptedAnswers: [],
        },
      ],
    },
  };

  const answers = [
    { player_id: "p1", question_index: 0, answer: { optionIds: ["a"] }, is_correct: true, points: 900 },
    { player_id: "p2", question_index: 0, answer: { optionIds: ["b"] }, is_correct: false, points: 0 },
    { player_id: "p4", question_index: 0, answer: { optionIds: ["a"] }, is_correct: true, points: 1000 },
  ];

  it("ranks active players with shared ranks for ties", () => {
    expect(rankPlayers(players).map((p) => [p.id, p.rank])).toEqual([
      ["p2", 1],
      ["p1", 2],
      ["p3", 2],
    ]);
  });

  it("hides correct answers while the question is open", () => {
    const view = buildGameView(game, players, answers, 0);
    expect(view.reveal).toBeNull();
    expect(JSON.stringify(view.question)).not.toContain("isCorrect");
    expect(view.answeredPlayerIds).toEqual(["p1", "p2"]); // kicked player excluded
    expect(view.startedAt).toBe(Date.parse("2026-01-01T00:01:00.000Z"));
  });

  it("includes distribution and per-player results after reveal", () => {
    const view = buildGameView({ ...game, status: "reveal" }, players, answers, 0);
    expect(view.reveal).toEqual({
      correctOptionIds: ["a"],
      acceptedAnswers: [],
      distribution: { a: 1, b: 1 },
      results: {
        p1: { answered: true, correct: true, points: 900 },
        p2: { answered: true, correct: false, points: 0 },
        p3: { answered: false, correct: false, points: 0 },
      },
    });
  });

  it("shows no question in the lobby", () => {
    const view = buildGameView({ ...game, status: "lobby", current_question_index: -1 }, players, [], 0);
    expect(view.question).toBeNull();
    expect(view.totalQuestions).toBe(1);
  });
});

describe("tokens", () => {
  it("generates 6-digit PINs without a leading zero", () => {
    for (let i = 0; i < 200; i++) expect(generatePin()).toMatch(/^[1-9]\d{5}$/);
  });
  it("matches tokens against stored hashes", () => {
    const t = generateToken();
    expect(tokenMatches(t, hashToken(t))).toBe(true);
    expect(tokenMatches("wrong", hashToken(t))).toBe(false);
    expect(tokenMatches(null, hashToken(t))).toBe(false);
  });
});
