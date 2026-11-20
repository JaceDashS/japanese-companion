import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bookImportPrompt,
  importBookFromClipboard,
  importBookJson,
  importWordsFromClipboard,
  importWordsJson,
  parseBookImport,
} from "../src/unified/bookImport";

test("book JSON needs a title and body and may be fenced", () => {
  assert.deepEqual(parseBookImport('```json\n{"format":"jace-s.reading-book","version":1,"title":" 海辺 ","body":" 本文 "}\n```'), { title: "海辺", body: "本文" });
  assert.throws(() => parseBookImport("not json"), /JSON/);
  assert.throws(() => parseBookImport('{"title":"","body":"x"}'), /title/);
  assert.throws(() => parseBookImport('{"title":"x","body":""}'), /body/);
});

test("the prompt asks for the same title on later pages", () => {
  assert.match(bookImportPrompt("ja"), /같은 책의 다음 페이지/);
  assert.match(bookImportPrompt("en"), /영어/);
});

test("one-click book clipboard import creates on first batch, appends consecutive same-title batches, and respects targetId", async () => {
  const store: Array<{ id: string; title: string; body: string }> = [];
  const deps = {
    books: store,
    targetId: null as string | null,
    saveBook: async (title: string, body: string) => {
      const book = { id: `b${store.length + 1}`, title, body };
      store.push(book);
      return book;
    },
    appendBook: async (id: string, body: string) => {
      const target = store.find((entry) => entry.id === id)!;
      target.body = `${target.body}\n\n${body}`;
      return { ...target };
    },
  };

  const first = await importBookFromClipboard(
    async () => '{"title":"海辺のカフカ","body":"첫 페이지"}',
    "",
    deps,
  );
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.mode, "created");
    assert.match(first.status, /海辺のカフカ/);
  }

  const second = await importBookFromClipboard(
    async () => '{"title":"海辺のカフカ","body":"둘째 페이지"}',
    "",
    deps,
  );
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.mode, "appended");
    assert.equal(second.book.id, "b1");
    assert.equal(second.book.body, "첫 페이지\n\n둘째 페이지");
    assert.match(second.status, /海辺のカフカ/);
  }

  const targeted = await importBookFromClipboard(
    async () => '{"title":"다른 제목","body":"셋째 페이지"}',
    "",
    { ...deps, targetId: "b1" },
  );
  assert.equal(targeted.ok, true);
  if (targeted.ok) {
    assert.equal(targeted.mode, "appended");
    assert.equal(targeted.book.id, "b1");
    assert.equal(store.length, 1);
  }
});

test("book clipboard import reports empty or unreadable clipboard without overwriting text, and falls back to manual input on invalid JSON", async () => {
  const deps = {
    books: [],
    targetId: null,
    saveBook: async () => ({ id: "b1", title: "t" }),
    appendBook: async () => ({ id: "b1", title: "t" }),
  };

  const empty = await importBookFromClipboard(async () => "   ", "기존 입력", deps);
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.match(empty.error, /비어/);
    assert.equal(empty.openManual, false);
    assert.equal(empty.text, "기존 입력");
  }

  const unreadable = await importBookFromClipboard(async () => { throw new Error("권한 없음"); }, "기존 입력", deps);
  assert.equal(unreadable.ok, false);
  if (!unreadable.ok) {
    assert.equal(unreadable.error, "권한 없음");
    assert.equal(unreadable.openManual, false);
    assert.equal(unreadable.text, "기존 입력");
  }

  const badJson = await importBookFromClipboard(async () => "{broken json", "", deps);
  assert.equal(badJson.ok, false);
  if (!badJson.ok) {
    assert.match(badJson.error, /JSON/);
    assert.equal(badJson.openManual, true);
    assert.equal(badJson.text, "{broken json");
  }

  const retry = await importBookJson('{"title":"海辺","body":"수정본"}', deps);
  assert.equal(retry.ok, true);
});

test("word clipboard import handles consecutive Day batches and preserves invalid text for retry", async () => {
  let dayCount = 0;
  const mockImport = async (raw: string) => {
    const parsed = JSON.parse(raw) as { words?: string[] };
    if (!parsed.words) throw new Error("words 배열이 필요합니다.");
    dayCount += 1;
    return { added: parsed.words.length, days: 1, excluded: [], invalid: [] };
  };

  const batch1 = await importWordsFromClipboard(async () => '{"words":["穴"]}', "", mockImport);
  const batch2 = await importWordsFromClipboard(async () => '{"words":["森"]}', "", mockImport);
  assert.equal(batch1.ok, true);
  assert.equal(batch2.ok, true);
  assert.equal(dayCount, 2);

  const empty = await importWordsFromClipboard(async () => "", "kept", mockImport);
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.openManual, false);
    assert.equal(empty.text, "kept");
  }

  const bad = await importWordsFromClipboard(async () => '{"words":bad}', "", mockImport);
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.openManual, true);
    assert.equal(bad.text, '{"words":bad}');
  }

  const allInvalid = await importWordsJson('{"words":[]}', async () => ({
    added: 0,
    days: 0,
    excluded: [],
    invalid: [{ index: 0, expression: "壁", errors: ["보기 중복"] }],
  }));
  assert.equal(allInvalid.ok, false);
  if (!allInvalid.ok) {
    assert.equal(allInvalid.openManual, true);
    assert.equal(allInvalid.result?.invalid.length, 1);
  }
});
