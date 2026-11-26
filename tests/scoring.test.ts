import { describe, expect, it } from "vitest";
import { computePoints, isAnswerCorrect, parseSubmittedAnswer } from "@/lib/game/scoring";
import { normalizeText } from "@/lib/game/normalize";
import { normalizeSupabaseUrl } from "@/lib/supabaseUrl";
import type { Question } from "@/lib/game/types";

const base = { id: "q1", prompt: "?", imageUrl: null, timeLimitSec: 20, pointsMultiplier: 1 };

const single: Question = {
  ...base,
  type: "single",
  options: [
    { id: "a", text: "A", isCorrect: false },
    { id: "b", text: "B", isCorrect: true },
    { id: "c", text: "C", isCorrect: false },
  ],
  acceptedAnswers: [],
};

const multi: Question = {
  ...base,
  type: "multi",
  options: [
    { id: "a", text: "A", isCorrect: true },
    { id: "b", text: "B", isCorrect: false },
    { id: "c", text: "C", isCorrect: true },
  ],
  acceptedAnswers: [],
};

const trueFalse: Question = {
  ...base,
  type: "true_false",
  options: [
    { id: "true", text: "", isCorrect: false },
    { id: "false", text: "", isCorrect: true },
  ],
  acceptedAnswers: [],
};

const text: Question = {
  ...base,
  type: "text",
  options: [],
  acceptedAnswers: ["Hà Nội", "Thăng Long"],
};

describe("normalizeText", () => {
  it("strips Vietnamese diacritics, case, extra spaces and edge punctuation", () => {
    expect(normalizeText("  Hà   Nội. ")).toBe("ha noi");
    expect(normalizeText("ĐÀ NẴNG!")).toBe("da nang");
    expect(normalizeText("Thành phố Hồ Chí Minh")).toBe("thanh pho ho chi minh");
  });
  it("keeps inner punctuation", () => {
    expect(normalizeText("3.14")).toBe("3.14");
  });
});

describe("normalizeSupabaseUrl", () => {
  it("strips API paths, slashes, quotes and spaces", () => {
    const bare = "https://abc.supabase.co";
    expect(normalizeSupabaseUrl(bare)).toBe(bare);
    expect(normalizeSupabaseUrl(`${bare}/`)).toBe(bare);
    expect(normalizeSupabaseUrl(`${bare}/rest/v1/`)).toBe(bare);
    expect(normalizeSupabaseUrl(`${bare}/rest/v1`)).toBe(bare);
    expect(normalizeSupabaseUrl(` "${bare}/" `)).toBe(bare);
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
    expect(normalizeSupabaseUrl(undefined)).toBe("");
  });
});

describe("isAnswerCorrect", () => {
  it("single choice", () => {
    expect(isAnswerCorrect(single, { optionIds: ["b"] })).toBe(true);
    expect(isAnswerCorrect(single, { optionIds: ["a"] })).toBe(false);
    expect(isAnswerCorrect(single, { optionIds: ["a", "b"] })).toBe(false);
    expect(isAnswerCorrect(single, { optionIds: [] })).toBe(false);
  });
  it("true / false", () => {
    expect(isAnswerCorrect(trueFalse, { optionIds: ["false"] })).toBe(true);
    expect(isAnswerCorrect(trueFalse, { optionIds: ["true"] })).toBe(false);
  });
  it("multi choice is all-or-nothing", () => {
    expect(isAnswerCorrect(multi, { optionIds: ["a", "c"] })).toBe(true);
    expect(isAnswerCorrect(multi, { optionIds: ["c", "a"] })).toBe(true);
    expect(isAnswerCorrect(multi, { optionIds: ["a"] })).toBe(false);
    expect(isAnswerCorrect(multi, { optionIds: ["a", "b", "c"] })).toBe(false);
  });
  it("typed answers ignore accents and case", () => {
    expect(isAnswerCorrect(text, { text: "ha noi" })).toBe(true);
    expect(isAnswerCorrect(text, { text: "THĂNG LONG" })).toBe(true);
    expect(isAnswerCorrect(text, { text: "Huế" })).toBe(false);
    expect(isAnswerCorrect(text, { text: "   " })).toBe(false);
  });
});

describe("parseSubmittedAnswer", () => {
  it("rejects unknown options and wrong arity", () => {
    expect(parseSubmittedAnswer(single, { optionIds: ["zzz"] })).toBeNull();
    expect(parseSubmittedAnswer(single, { optionIds: ["a", "b"] })).toBeNull();
    expect(parseSubmittedAnswer(single, { optionIds: "a" })).toBeNull();
    expect(parseSubmittedAnswer(single, null)).toBeNull();
    expect(parseSubmittedAnswer(single, { optionIds: ["a"] })).toEqual({ optionIds: ["a"] });
  });
  it("dedupes multi selections", () => {
    expect(parseSubmittedAnswer(multi, { optionIds: ["a", "a", "c"] })).toEqual({
      optionIds: ["a", "c"],
    });
  });
  it("trims and caps typed answers", () => {
    expect(parseSubmittedAnswer(text, { text: "  hi  " })).toEqual({ text: "hi" });
    expect(parseSubmittedAnswer(text, { text: "   " })).toBeNull();
    expect(parseSubmittedAnswer(text, { text: "x".repeat(500) })?.text).toHaveLength(100);
  });
});

describe("computePoints", () => {
  const limit = 20_000;
  it("gives full points for instant answers and half on the buzzer", () => {
    expect(computePoints({ correct: true, responseMs: 0, timeLimitMs: limit, multiplier: 1 })).toBe(1000);
    expect(computePoints({ correct: true, responseMs: limit, timeLimitMs: limit, multiplier: 1 })).toBe(500);
    expect(computePoints({ correct: true, responseMs: limit / 2, timeLimitMs: limit, multiplier: 1 })).toBe(750);
  });
  it("clamps late and negative response times", () => {
    expect(computePoints({ correct: true, responseMs: limit + 900, timeLimitMs: limit, multiplier: 1 })).toBe(500);
    expect(computePoints({ correct: true, responseMs: -200, timeLimitMs: limit, multiplier: 1 })).toBe(1000);
  });
  it("applies multipliers", () => {
    expect(computePoints({ correct: true, responseMs: 0, timeLimitMs: limit, multiplier: 2 })).toBe(2000);
    expect(computePoints({ correct: true, responseMs: 0, timeLimitMs: limit, multiplier: 0 })).toBe(0);
  });
  it("gives zero for wrong answers", () => {
    expect(computePoints({ correct: false, responseMs: 0, timeLimitMs: limit, multiplier: 2 })).toBe(0);
  });
});
