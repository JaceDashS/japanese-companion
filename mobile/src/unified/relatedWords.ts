export type MemoEntry = { expression: string; memo: string; reading: string; meaningKo: string };

/** Kanji, the iteration mark and kanji-like counters; kana are never compared for related notes. */
const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]/g;

/** Unique kanji of an expression, excluding the iteration mark. */
export function kanjiOf(text: string): string[] {
  return [...new Set((text.match(KANJI) ?? []).filter((char) => char !== "々"))];
}

/** Memos of other expressions sharing at least one kanji with the given expression. */
export function relatedMemos(expression: string, memos: readonly MemoEntry[]): MemoEntry[] {
  const kanji = new Set(kanjiOf(expression));
  if (kanji.size === 0) return [];
  return memos.filter((entry) => entry.expression !== expression && kanjiOf(entry.expression).some((char) => kanji.has(char)));
}
