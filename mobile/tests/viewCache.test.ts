import assert from "node:assert/strict";
import { test } from "node:test";
import { pickView } from "../src/unified/viewCache.ts";

test("view cache keeps only layout numbers, never the curriculum", () => {
  const curriculum = [{ id: "u", title: "N1", days: [{ id: "d", title: "Day 1", items: [] }] }];
  const view = pickView({ schemaVersion: 3, curriculum, studyDrawerWidth: 320, dayListDrawerWidth: 280, learningPlan: { date: "2026-11-13" } });
  assert.deepEqual(view, { studyDrawerWidth: 320, dayListDrawerWidth: 280 });
  assert.ok(JSON.stringify(view).length < 100);
});

test("view cache drops broken values", () => {
  assert.deepEqual(pickView({ studyDrawerWidth: "320", dayListDrawerWidth: Number.NaN }), {});
  assert.deepEqual(pickView(null), {});
});
