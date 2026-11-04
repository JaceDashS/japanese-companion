import assert from "node:assert/strict";
import { test } from "node:test";
import {
  booksFromFiles,
  grade,
  progressPayload,
  memoPayload,
} from "../src/study.ts";
const settings = { srs: { maxReviewStage: 6, failureRetryDays: 2 } };
test("Japanese source positions and duplicate item IDs remain stable in saved payloads", () => {
  const files = {
    "asset/jlpt-test.json": {
      format: "combined",
      meta: { title: "Test" },
      days: [
        {
          day: [
            {
              stage: 1,
              items: [
                {
                  id: "duplicate",
                  expression: "日",
                  reading: "ひ",
                  meaningKo: "날",
                  problem: {
                    sentence: "Q",
                    choices: ["ひ", "つき"],
                    answer: "ひ",
                  },
                },
                {
                  id: "duplicate",
                  expression: "月",
                  reading: "つき",
                  meaningKo: "달",
                  problem: { choices: ["つき"], answer: "つき" },
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const [book] = booksFromFiles("japanese", files, settings);
  const unit = book.units[0];
  assert.equal(unit.source, "asset/jlpt-test.json");
  assert.equal(unit.unitPath, "0");
  assert.equal(unit.dayIndex, 0);
  assert.notEqual(unit.items[0].key, unit.items[1].key);
  const results = Object.fromEntries(
    unit.items.map((i) => [i.key, "PASS" as const]),
  );
  const payload: any = progressPayload(
    "japanese",
    unit,
    "2026-10-28",
    results,
    settings,
  );
  assert.deepEqual(
    payload.items.map((i: any) => i.itemIndex),
    [0, 1],
  );
  assert.equal(payload.day.stage, 2);
  assert.equal(payload.day.nextReviewDate, "2026-10-29");
  const mixed: any = progressPayload(
    "japanese",
    unit,
    "2026-10-28",
    { [unit.items[0].key]: "FAIL", [unit.items[1].key]: "PASS" },
    settings,
  );
  assert.equal(mixed.day.stage, 1);
  assert.equal(mixed.items[0].lastResult, "FAIL");
  assert.equal(
    (memoPayload("japanese", unit, unit.items[1], "memo") as any).itemIndex,
    1,
  );
});
