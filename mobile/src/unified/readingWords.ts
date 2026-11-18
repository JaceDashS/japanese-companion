/** Reading material contracts. The server marks which words are selectable; the client never guesses. */
export interface LibraryQuiz { pattern?: string; sentences: string[]; answer: number }
export interface LibraryWord { id: string; word: string; meaning: string; example: string; decomposition?: string; roots?: string[]; quizzes?: LibraryQuiz[]; quiz: LibraryQuiz | null }
export interface LibraryBook { id: string; title: string; kind: "book" | "vocabulary"; body: string; words: LibraryWord[]; tokens?: ProseWord[] }
export interface WordDetail { word: string; meaning: string; reading: string; note: string; studyNote: string; roots?: string[] }
export type LibraryApi = <T>(endpoint: string, body?: unknown, query?: Record<string, string>) => Promise<T>;
export interface ProseWord { text: string; word: boolean }
export type ReadingSection = "vocabulary" | "bookshelf";
/**
 * Account reader state: last opened book, last vocabulary, per-book position and bookmarks as character offsets, and
 * where the app was left: the header section and the book still open in it ("" when none).
 */
export interface ReadingState { lastBookId: string; vocabularyId: string; books: Record<string, { offset: number; bookmarks: number[] }>; section?: ReadingSection; openBookId?: string }
export const EMPTY_READING: ReadingState = { lastBookId: "", vocabularyId: "", books: {}, section: "vocabulary", openBookId: "" };

/** Key of a word in the library's word details; matches the server's readingWordKey. */
export function wordKey(language: "ja" | "en", word: string) {
  const trimmed = word.normalize("NFKC").trim();
  return language === "en" ? trimmed.toLocaleLowerCase("en") : trimmed;
}

/** Without server tokens (an unsaved preview) nothing is selectable: only registered words may be. */
export function proseTokens(book: Pick<LibraryBook, "body" | "tokens">): ProseWord[] {
  return book.tokens ?? (book.body ? [{ text: book.body, word: false }] : []);
}
