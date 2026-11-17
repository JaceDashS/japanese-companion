import { test } from "node:test";
import assert from "node:assert/strict";
import { bookImportPrompt, parseBookImport } from "../src/unified/bookImport";

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
