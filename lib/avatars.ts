/** Built-in avatar set: 24 procedurally drawn creatures (see components/Avatar.tsx). */
export const AVATAR_COUNT = 24;

export const AVATAR_IDS: string[] = Array.from(
  { length: AVATAR_COUNT },
  (_, i) => `a${String(i).padStart(2, "0")}`,
);

export function isAvatarId(value: unknown): value is string {
  return typeof value === "string" && AVATAR_IDS.includes(value);
}

export function randomAvatarId(): string {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}

const BODY_COLORS = ["#f97316", "#14b8a6", "#8b5cf6", "#ec4899", "#22c55e", "#0ea5e9", "#eab308", "#ef4444"];
const BG_COLORS = ["#ffedd5", "#ccfbf1", "#ede9fe", "#fce7f3", "#dcfce7", "#e0f2fe", "#fef9c3", "#fee2e2"];
const SHAPES = ["blob", "box", "ghost"] as const;
const EYES = ["dots", "big", "sleepy", "wink"] as const;
const MOUTHS = ["smile", "open", "flat", "tongue"] as const;
const EXTRAS = ["none", "antenna", "ears", "horns", "leaf"] as const;

export interface AvatarParts {
  body: string;
  bg: string;
  shape: (typeof SHAPES)[number];
  eyes: (typeof EYES)[number];
  mouth: (typeof MOUTHS)[number];
  extra: (typeof EXTRAS)[number];
}

export function avatarParts(id: string): AvatarParts {
  const n = Number(id.slice(1));
  const i = Number.isInteger(n) && n >= 0 ? n % AVATAR_COUNT : 0;
  const color = (i * 3) % BODY_COLORS.length;
  return {
    body: BODY_COLORS[color],
    bg: BG_COLORS[color],
    shape: SHAPES[i % SHAPES.length],
    eyes: EYES[Math.floor(i / 3) % EYES.length],
    mouth: MOUTHS[(i * 5 + 1) % MOUTHS.length],
    extra: EXTRAS[(i * 7 + 2) % EXTRAS.length],
  };
}
