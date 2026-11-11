import { apiFetch, apiUrl } from "./runtime";
import type { MemoEntry } from "./relatedWords";

export { kanjiOf, relatedMemos, type MemoEntry } from "./relatedWords";

export type PersonalBook = { id: string; title: string; dayCount: number; wordCount: number; createdAt: string };
export type ImportResult = {
  added: number;
  days: number;
  excluded: { expression: string; reason: "exists" | "repeated" }[];
  invalid: { index: number; expression: string; errors: string[] }[];
};
export type FuriganaSegment = { text: string; reading: string | null };

/** Personal books are served as asset/user-<id>.json, so their book ID is "user-<id>". */
export function personalBookId(bookId: string): string | null {
  return bookId.startsWith("user-") ? bookId.slice("user-".length) : null;
}

async function call<T>(suffix: string, body?: unknown): Promise<T> {
  const response = await apiFetch(apiUrl(suffix), body === undefined
    ? { credentials: "include" }
    : { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) throw new Error(String(payload?.error ?? `요청 실패 (${response.status})`));
  return payload as T;
}

export async function loadMemos(): Promise<MemoEntry[]> {
  return (await call<{ memos: MemoEntry[] }>("memos")).memos;
}
export async function listPersonalBooks(): Promise<PersonalBook[]> {
  return (await call<{ books: PersonalBook[] }>("user-books")).books;
}
export async function createPersonalBook(title: string): Promise<PersonalBook> {
  return (await call<{ book: PersonalBook }>("user-books/create", { title })).book;
}
export async function renamePersonalBook(bookId: string, title: string): Promise<void> {
  await call("user-books/rename", { bookId, title });
}
export async function deletePersonalBook(bookId: string): Promise<void> {
  await call("user-books/delete", { bookId });
}
export async function importPersonalWords(bookId: string, payload: string): Promise<ImportResult> {
  return (await call<{ result: ImportResult }>("user-books/import", { bookId, payload })).result;
}
export async function deletePersonalWord(bookId: string, itemId: string): Promise<void> {
  await call("user-books/delete-word", { bookId, itemId });
}

/**
 * Prompt for an external AI. The user sends it first, then any unstructured word list; the AI answers
 * with JSON that the import accepts as is.
 */
export const IMPORT_PROMPT = `너는 일본어 단어장 정리기다. 이 메시지에는 "단어 목록을 보내 주세요."라고만 답해라.
그다음 내가 보내는 단어 목록은 형식이 자유롭다(줄바꿈, 쉼표, 뜻이 섞여 있거나 없을 수 있다).
그 목록의 모든 단어를 아래 형식의 JSON 하나로만 출력해라. JSON 앞뒤에 설명이나 코드 블록 표시를 붙이지 마라.

{
  "format": "jace-s.japanese-words",
  "version": 1,
  "words": [
    {
      "expression": "穴",
      "kanjiToKana": { "穴": "あな" },
      "meaningKo": "구멍",
      "decomposition": "| 항목 | 穴 |\\n| --- | --- |\\n| 音読 | ケツ |\\n| 訓読 | あな |\\n| 뜻 | 구멍 |\\n| 예시 | 落とし穴（おとしあな）: 함정 |\\n| 분해 | 宀[지붕] + 八[여덟] |",
      "problem": {
        "sentence": "子どもが地面の穴をのぞきこんでいた。",
        "furigana": "{子|こ}どもが{地面|じめん}の{穴|あな}をのぞきこんでいた。",
        "target": "穴",
        "choices": ["あな", "あに", "かな", "あま"],
        "answer": "あな",
        "problemType": "reading"
      }
    }
  ],
  "skipped": []
}

규칙:
1. expression은 사전형 표기다. 내가 활용형을 보냈으면 사전형으로 바꾼다.
2. kanjiToKana는 expression 안의 한자(또는 숙자훈처럼 한 덩어리로 읽는 한자 묶음)마다 그 읽기(히라가나)를 적는다. 오쿠리가나는 넣지 않는다. 예: 戒める → { "戒": "いまし" }, 素直 → { "素直": "すなお" }. 가나만 있는 단어는 {}로 둔다. expression의 한자를 kanjiToKana의 읽기로 바꾸면 정확한 전체 읽기가 되어야 한다.
3. meaningKo는 대표 한국어 뜻이다. 내가 뜻을 함께 적었으면 그 뜻을 쓴다.
4. decomposition은 한자가 있을 때만 쓰고, 한자마다 열 하나인 마크다운 표다. 행은 항목, 音読, 訓読, 뜻, 예시, 분해 순서로 고정한다. 줄바꿈은 \\n으로 쓴다. 모르는 칸은 지어내지 말고 "(추정)"을 붙이거나 "-"로 둔다. 가나만 있는 단어는 ""로 둔다.
5. problem.sentence는 expression이 활용하지 않은 모양 그대로 들어간 자연스러운 일본어 예문이다. 단어마다 문장 구조를 다르게 만들고, 「X」라는 표현을 썼다 같은 틀 문장은 쓰지 않는다.
6. problem.furigana는 sentence와 같은 문장이고, 한자 부분만 {한자|읽기}로 감싼다. {} 안에는 한자만 넣고 오쿠리가나는 밖에 둔다. 문장의 모든 한자에 읽기를 붙인다. {}와 | 표시를 지우면 sentence와 글자까지 같아야 한다.
7. problem.target은 expression과 같다. 단 expression에 괄호가 있으면(예: 確認(する)) 괄호만 지운 값(確認する)을 쓰고 문장에도 그 모양으로 넣는다.
8. expression에 한자가 하나라도 있으면 problemType은 "reading"이다. choices는 히라가나 4개이고 answer는 expression의 전체 읽기다. 오답은 장음, 탁음, 촉음, 비슷한 음독처럼 실제로 헷갈릴 만한 읽기로 만든다.
9. expression이 가나로만 되어 있으면 problemType은 "meaning"이다. choices는 한국어 뜻 4개이고 answer는 meaningKo와 글자까지 같다. 오답은 품사가 같고 비슷한 뜻으로 만든다.
10. choices 4개는 모두 서로 다르고, answer는 그중 하나와 글자까지 같다.
11. 같은 단어가 여러 번 나오면 한 번만 넣는다. 일본어 단어로 볼 수 없는 입력은 words에 넣지 말고 skipped에 원문 그대로 넣는다.`;
