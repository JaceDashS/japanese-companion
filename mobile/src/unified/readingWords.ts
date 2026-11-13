/** Reading material contracts and preview segmentation; server tokens are authoritative. */
export interface LibraryWord { id: string; word: string; meaning: string; example: string; quiz: { sentences: string[]; answer: number } | null }
export interface LibraryBook { id: string; title: string; kind: "book" | "vocabulary"; body: string; words: LibraryWord[]; tokens?: ProseWord[] }
export interface WordDetail { word: string; meaning: string; reading: string; note: string; studyNote: string }
export type LibraryApi = <T>(endpoint: string, body?: unknown, query?: Record<string, string>) => Promise<T>;
export interface ProseWord { text: string; word: boolean }

/** Keep every character in order, making every word actionable rather than only registered entries. */
export function segmentProse(text: string, language: "ja" | "en"): ProseWord[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => { segment: (text: string) => Iterable<{ segment: string; isWordLike: boolean }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(language, { granularity: "word" }).segment(text), part => ({ text: part.segment, word: part.isWordLike }));
  // Unicode fallback retains all text and leaves every script run selectable on older native engines.
  return (text.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|[\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu) ?? []).map(part => ({ text: part, word: /[\p{L}\p{N}]/u.test(part) }));
}
