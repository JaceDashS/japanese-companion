import { test } from "node:test";
import assert from "node:assert/strict";
import { kanjiOf, relatedMemos } from "../src/unified/relatedWords";

const memo = (expression: string) => ({ expression, memo: `${expression} memo`, reading: "", meaningKo: "" });

test("related notes share at least one kanji and never compare kana", () => {
  const memos = [memo("要素"), memo("直す"), memo("素直"), memo("なおす"), memo("沈黙")];
  assert.deepEqual(relatedMemos("素直", memos).map((entry) => entry.expression), ["要素", "直す"]);
  assert.deepEqual(relatedMemos("けなげ", memos), []);
  assert.deepEqual(relatedMemos("黙る", memos).map((entry) => entry.expression), ["沈黙"]);
});

test("kanji extraction keeps order and skips the iteration mark", () => {
  assert.deepEqual(kanjiOf("華々しい人々"), ["華", "人"]);
  assert.deepEqual(kanjiOf("ぎくしゃく"), []);
});
