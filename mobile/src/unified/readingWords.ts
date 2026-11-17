/** Reading material contracts. The server marks which words are selectable; the client never guesses. */
export interface LibraryQuiz { pattern?: string; sentences: string[]; answer: number }
export interface LibraryWord { id: string; word: string; meaning: string; example: string; decomposition?: string; roots?: string[]; quizzes?: LibraryQuiz[]; quiz: LibraryQuiz | null }
export interface LibraryBook { id: string; title: string; kind: "book" | "vocabulary"; body: string; words: LibraryWord[]; tokens?: ProseWord[] }
export interface WordDetail { word: string; meaning: string; reading: string; note: string; studyNote: string; roots?: string[] }
export type LibraryApi = <T>(endpoint: string, body?: unknown, query?: Record<string, string>) => Promise<T>;
export interface ProseWord { text: string; word: boolean }
/** Account reader state: last opened book, last vocabulary, and per-book position and bookmarks as character offsets. */
export interface ReadingState { lastBookId: string; vocabularyId: string; books: Record<string, { offset: number; bookmarks: number[] }> }
export const EMPTY_READING: ReadingState = { lastBookId: "", vocabularyId: "", books: {} };

/** Without server tokens (an unsaved preview) nothing is selectable: only registered words may be. */
export function proseTokens(book: Pick<LibraryBook, "body" | "tokens">): ProseWord[] {
  return book.tokens ?? (book.body ? [{ text: book.body, word: false }] : []);
}
