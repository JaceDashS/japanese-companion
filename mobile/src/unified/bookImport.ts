/** Book JSON exchanged with an external AI: a title and the text of one or more pages. */
export const BOOK_FORMAT = "jace-s.reading-book";

const LANGUAGE = { ja: "일본어", en: "영어" } as const;

/** Prompt the learner pastes into an external AI before sending book pages or text. */
export function bookImportPrompt(language: "ja" | "en"): string {
  return `너는 ${LANGUAGE[language]} 책 본문 정리기다. 이 메시지에는 "책 제목과 본문을 보내 주세요."라고만 답해라.
그다음 내가 보내는 책 페이지(사진, 복사한 글 등)를 아래 형식의 JSON 하나로만 출력해라. JSON 앞뒤에 설명이나 코드 블록 표시를 붙이지 마라.
- title: 책 이름. 같은 책의 다음 페이지를 보낼 때도 처음과 똑같은 이름을 쓴다.
- body: 페이지의 ${LANGUAGE[language]} 본문을 원문 그대로 옮긴다. 번역, 요약, 설명, 읽는 법 표시를 넣지 않는다. 문단 사이는 빈 줄 하나로 나눈다.

{
  "format": "${BOOK_FORMAT}",
  "version": 1,
  "title": "책 이름",
  "body": "본문"
}`;
}

/** Parse pasted book JSON, accepting a surrounding code fence. */
export function parseBookImport(raw: string): { title: string; body: string } {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let parsed: unknown;
  try { parsed = JSON.parse(fenced ? fenced[1] : trimmed); }
  catch { throw new Error("JSON 형식이 아닙니다. AI가 출력한 JSON 전체를 붙여 넣으세요."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON 객체가 필요합니다.");
  const value = parsed as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  if (!title) throw new Error("JSON에 책 이름(title)이 없습니다.");
  if (title.length > 60) throw new Error("책 이름은 60자까지 쓸 수 있습니다.");
  if (!body) throw new Error("JSON에 본문(body)이 없습니다.");
  return { title, body };
}

export type BookSummary = { id: string; title: string };

export type BookImportDeps<T extends BookSummary> = {
  books: readonly T[];
  targetId: string | null;
  saveBook: (title: string, body: string) => Promise<T>;
  appendBook: (id: string, body: string) => Promise<T>;
};

export type BookImportOutcome<T extends BookSummary> =
  | { ok: true; mode: "created" | "appended"; book: T; status: string }
  | { ok: false; error: string; text: string; openManual: boolean };

export type WordImportResultShape = {
  added: number;
  days: number;
  excluded: unknown[];
  invalid: unknown[];
};

export type WordImportOutcome<R extends WordImportResultShape> =
  | { ok: true; result: R; text: string }
  | { ok: false; error: string; text: string; openManual: boolean; result: R | null };

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** Validate, match an existing target/title, and save or append one book JSON batch. */
export async function importBookJson<T extends BookSummary>(
  raw: string,
  deps: BookImportDeps<T>,
): Promise<BookImportOutcome<T>> {
  try {
    const parsed = parseBookImport(raw);
    const existing =
      (deps.targetId ? deps.books.find((book) => book.id === deps.targetId) : undefined) ??
      deps.books.find((book) => book.title.trim() === parsed.title);
    const book = existing
      ? await deps.appendBook(existing.id, parsed.body)
      : await deps.saveBook(parsed.title, parsed.body);
    return {
      ok: true,
      mode: existing ? "appended" : "created",
      book,
      status: existing
        ? `「${book.title}」에 내용을 이어 붙였습니다. 다음 묶음을 계속 추가할 수 있습니다.`
        : `「${book.title}」을(를) 책장에 추가했습니다. 같은 제목으로 다음 묶음을 계속 추가할 수 있습니다.`,
    };
  } catch (cause) {
    return {
      ok: false,
      error: errorMessage(cause, "책을 저장하지 못했습니다."),
      text: raw,
      openManual: true,
    };
  }
}

/** Read book JSON from clipboard and immediately validate and save in one step. */
export async function importBookFromClipboard<T extends BookSummary>(
  readClipboard: () => Promise<string>,
  currentText: string,
  deps: BookImportDeps<T>,
): Promise<BookImportOutcome<T>> {
  let clip: string;
  try {
    clip = await readClipboard();
  } catch (cause) {
    return {
      ok: false,
      error: errorMessage(cause, "클립보드를 읽지 못했습니다."),
      text: currentText,
      openManual: false,
    };
  }
  if (!clip.trim()) {
    return {
      ok: false,
      error: "클립보드가 비어 있습니다. AI가 출력한 JSON을 먼저 복사하세요.",
      text: currentText,
      openManual: false,
    };
  }
  return importBookJson(clip, deps);
}

/** Validate and save a word JSON batch, preserving raw JSON for manual retry when all items fail. */
export async function importWordsJson<R extends WordImportResultShape>(
  raw: string,
  importFn: (payload: string) => Promise<R>,
): Promise<WordImportOutcome<R>> {
  try {
    const result = await importFn(raw);
    if (result.added === 0 && result.invalid.length > 0) {
      return {
        ok: false,
        error: "검증에 실패한 단어를 수정한 뒤 다시 시도하세요.",
        text: raw,
        openManual: true,
        result,
      };
    }
    return { ok: true, result, text: "" };
  } catch (cause) {
    return {
      ok: false,
      error: errorMessage(cause, "단어를 가져오지 못했습니다."),
      text: raw,
      openManual: true,
      result: null,
    };
  }
}

/** Read vocabulary JSON from clipboard and immediately validate and save in one step. */
export async function importWordsFromClipboard<R extends WordImportResultShape>(
  readClipboard: () => Promise<string>,
  currentText: string,
  importFn: (payload: string) => Promise<R>,
): Promise<WordImportOutcome<R>> {
  let clip: string;
  try {
    clip = await readClipboard();
  } catch (cause) {
    return {
      ok: false,
      error: errorMessage(cause, "클립보드를 읽지 못했습니다."),
      text: currentText,
      openManual: false,
      result: null,
    };
  }
  if (!clip.trim()) {
    return {
      ok: false,
      error: "클립보드가 비어 있습니다. AI가 출력한 JSON을 먼저 복사하세요.",
      text: currentText,
      openManual: false,
      result: null,
    };
  }
  return importWordsJson(clip, importFn);
}
