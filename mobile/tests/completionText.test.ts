import { test } from "node:test";
import assert from "node:assert/strict";
import { completionLines, nextReviewText } from "../src/unified/completionText";

test("all correct shows the count and the next review day", () => {
  assert.deepEqual(completionLines({ id: 1, passCount: 10, total: 10, allPass: true, nextReviewDate: "2026-11-21" }, "2026-11-18"), {
    title: "10개 모두 정답", detail: null, next: "다음 복습 · 11월 21일 (3일 뒤)",
  });
});

test("mistakes say how many were wrong and when they come back", () => {
  assert.deepEqual(completionLines({ id: 1, passCount: 7, total: 10, allPass: false, nextReviewDate: "2026-11-19" }, "2026-11-18"), {
    title: "10개 중 7개 정답", detail: "틀린 3개는 다음 복습 때 다시 나와요", next: "다음 복습 · 11월 19일 (내일)",
  });
});

test("a finished schedule has no next review", () => {
  assert.equal(nextReviewText(null, "2026-11-18"), null);
  assert.equal(completionLines({ id: 1, passCount: 5, total: 5, allPass: true, nextReviewDate: null }, "2026-11-18").detail, "모든 복습 단계를 마쳤어요");
  assert.equal(nextReviewText("2026-11-18", "2026-11-18"), "11월 18일 (오늘)");
});
