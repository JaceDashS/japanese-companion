import { test } from "node:test";
import assert from "node:assert/strict";
import { pageAt, paginate, spreadStart, toggleBookmark } from "../src/unified/readingPagination";

const story = Array.from({ length: 12 }, (_, i) => `第${i + 1}段落の文章です。` + "あ".repeat(60) + "。").join("\n\n");

test("pages keep every character, break near the target and never split a word", () => {
  const tokens = [{ text: "素直", word: true }, { text: story, word: false }, { text: "素直", word: true }];
  const pages = paginate(tokens, 200);
  assert.ok(pages.length >= 4);
  assert.equal(pages[0].start, 0);
  for (let i = 1; i < pages.length; i++) assert.equal(pages[i].start, pages[i - 1].end);
  assert.equal(pages[pages.length - 1].end, 4 + story.length);
  assert.ok(pages.every(page => page.tokens.filter(token => token.word).every(token => token.text === "素直")));
  assert.ok(pages.slice(0, -1).every(page => page.end - page.start <= 230));
});

test("a saved character offset opens the page that contains it on any page size", () => {
  const tokens = [{ text: story, word: false }];
  for (const size of [150, 300]) {
    const pages = paginate(tokens, size);
    const offset = pages[2].start + 5;
    assert.equal(pageAt(pages, offset), 2);
    assert.equal(pageAt(pages, 10 ** 9), pages.length - 1);
  }
});

test("two-page spreads pair pages and bookmarks toggle per page", () => {
  assert.equal(spreadStart(3, 2), 2);
  assert.equal(spreadStart(3, 1), 3);
  const pages = paginate([{ text: story, word: false }], 200);
  const marked = toggleBookmark([], pages[1].start + 3, pages);
  assert.deepEqual(marked, [pages[1].start]);
  assert.deepEqual(toggleBookmark(marked, pages[1].start + 10, pages), []);
});
