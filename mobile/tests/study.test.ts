import assert from "node:assert/strict";
import { test } from "node:test";
import {
  booksFromFiles,
  grade,
  progressPayload,
  memoPayload,
} from "../src/study.ts";
const settings = { srs: { maxReviewStage: 6, failureRetryDays: 2 } };
import { identifyStudyState, displayItemId } from "../src/unified/identity.ts";
import type { StudyState } from "../../shared/domain/studyTypes.ts";
import { NativeQueueStorage } from "../src/unified/queueStorage.ts";
test("native queue snapshots restore order and failures without crossing account stores", async () => {
  const disk = new Map<string, string>();
  const make = (account: string) => new NativeQueueStorage(async (value) => { disk.set(account, value); }, async () => disk.get(account) ?? null);
  const a = make("a");
  const record = { input: "https://api.jace-s.com/companions/japanese/save-item-field", init: { method: "POST", body: "{}" }, label: "note", status: "pending" as const, createdAt: 1, retryCount: 0, nextAttemptAt: null, lastError: "", retryDelayMs: 1000 };
  const [one, two] = await Promise.all([a.add(record), a.add(record)]);
  await a.update(one.id, { status: "failed", lastError: "HTTP 422" });
  const restored = make("a");
  assert.deepEqual((await restored.list()).map((item) => [item.id, item.status]), [[one.id, "failed"], [two.id, "pending"]]);
  assert.deepEqual(await make("b").list(), []);
  await restored.remove(one.id);
  assert.deepEqual((await make("a").list()).map((item) => item.id), [two.id]);
  const broken = new NativeQueueStorage(async () => { throw Error("disk full"); }, async () => null);
  await broken.add(record);
  assert.equal(broken.persistent, false);
  assert.equal((await broken.list()).length, 1);
  const corrupt = new NativeQueueStorage(async () => { throw Error("must not overwrite corrupt bytes"); }, async () => "invalid JSON");
  assert.deepEqual(await corrupt.list(), []);
  assert.equal(corrupt.persistent, false);
});
test("unified sessions distinguish duplicate display IDs without changing source addresses", () => {
  const source = { sourcePath: "asset/test.json", unitPath: "0", dayIndex: 0 };
  const state: StudyState = { schemaVersion: 1, curriculum: [{ id: "unit", title: "Unit", days: [{ id: "day", title: "Day", items: [0, 1].map((itemIndex) => ({ id: "duplicate", sourceRef: { ...source, itemIndex } })) }] }] };
  const once = identifyStudyState(state);
  const items = once.curriculum[0].days[0].items;
  assert.notEqual(items[0].id, items[1].id);
  assert.equal(displayItemId(items[0]), "duplicate");
  assert.equal(displayItemId(items[1]), "duplicate");
  assert.deepEqual(items.map((item) => item.sourceRef), state.curriculum[0].days[0].items.map((item) => item.sourceRef));
  assert.deepEqual(identifyStudyState(once), once);
});
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
