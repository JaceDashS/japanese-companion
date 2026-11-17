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
