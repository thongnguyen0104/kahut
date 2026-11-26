const EDGE_PUNCTUATION = /^[\s.,!?;:'"`()[\]{}]+|[\s.,!?;:'"`()[\]{}]+$/g;

/**
 * Normalizes a typed answer for comparison: removes Vietnamese diacritics
 * (including đ), lowercases, collapses whitespace and strips punctuation
 * at the edges. "  Hà  Nội. " -> "ha noi".
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(EDGE_PUNCTUATION, "")
    .trim();
}
