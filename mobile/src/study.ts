import {
  createInitialState,
  getAvailableBooks,
} from "../.generated/data/initialState.js";
import { applyQuizResultForDay } from "../.generated/domain/srs.js";
import type { AppKey } from "./client";
export type Result = "PASS" | "FAIL" | "NEUTRAL";
export type Raw = Record<string, any>;
export interface Item {
  key: string;
  id: string;
  index: number;
  title: string;
  reading: string;
  meaning: string;
  choices: { key: string; text: string }[];
  answers: string[];
  multi: boolean;
  explanation: string;
  memo: string;
  decomposition: string;
  raw: Raw;
}
export interface Unit {
  key: string;
  title: string;
  group: string;
  source: string;
  unitPath?: string;
  dayIndex?: number;
  stage: number;
  due: string | null;
  items: Item[];
  note: string;
  raw: Raw;
}
export interface Book {
  id: string;
  title: string;
  units: Unit[];
  raw?: Raw;
}
export interface Settings {
  language?: "ko" | "en";
  shuffleChoices?: boolean;
  theme?: "midnight" | "daylight";
  selectedBookId?: string;
  selectedCertificationId?: string;
  dailyNewLearningCount?: number;
  srs?: { maxReviewStage?: number; failureRetryDays?: number };
}
/** Normalize server curriculum using the same parsers as the existing clients. */
export function booksFromFiles(
  app: AppKey,
  files: Record<string, unknown>,
  settings: Settings,
): Book[] {
  return getAvailableBooks(files).map((book: any) => {
    const state = createInitialState(book.id, files);
    return {
      id: book.id,
      title: book.title,
      units: state.curriculum.flatMap((unit: any) =>
        unit.days.map((day: any) => {
          const ref = day.items[0]?.sourceRef;
          return {
            key: ref?.sourcePath + ":" + ref?.unitPath + ":" + ref?.dayIndex,
            title: day.title,
            group: unit.title,
            source: ref?.sourcePath,
            unitPath: ref?.unitPath,
            dayIndex: ref?.dayIndex,
            stage: day.stage ?? 1,
            due: day.nextReviewDate ?? null,
            raw: day,
            note: "",
            items: day.items.map((q: any, index: number) => {
              const p =
                q.problem && typeof q.problem === "object" ? q.problem : {};
              return {
                key: q.id + ":" + index,
                id: q.id,
                index,
                title: q.expression,
                reading: q.reading ?? "",
                meaning: q.meaningKo ?? "",
                choices: Array.isArray(p.choices)
                  ? p.choices.map((v: any) => ({
                      key: String(v),
                      text: String(v),
                    }))
                  : [],
                answers: p.answer ? [String(p.answer)] : [],
                multi: false,
                explanation: String(p.sentence ?? ""),
                memo: q.memo ?? q.memoPersonal ?? "",
                decomposition: q.decomposition ?? q.memoDecomposition ?? "",
                raw: q,
              };
            }),
          };
        }),
      ),
    };
  });
}
/** Grade a native selection using stable choice keys, including multiple-answer questions. */
export function grade(item: Item, selected: string[]): Result {
  if (!selected.length) return "FAIL";
  if (!item.answers.length) return "PASS";
  return [...selected].sort().join("\u0000") ===
    [...item.answers].sort().join("\u0000")
    ? "PASS"
    : "FAIL";
}
/** Create an API payload using the original per-app SRS implementation and server calendar date. */
export function progressPayload(
  app: AppKey,
  unit: Unit,
  today: string,
  results: Record<string, Result>,
  settings: Settings,
) {
  const graded = Object.fromEntries(
    unit.items.filter((i) => results[i.key]).map((i) => [i.id, results[i.key]]),
  );
  const nativeDay = {
    ...unit.raw,
    items: unit.raw.items.map((i: Raw, index: number) => ({
      ...i,
      id: unit.items[index].key,
    })),
  };
  const outcome = applyQuizResultForDay(
    nativeDay,
    today,
    results,
    settings.srs as any,
  );
  const d = outcome.day;
  return {
    sourcePath: unit.source,
    unitPath: unit.unitPath,
    dayIndex: unit.dayIndex,
    day: {
      stage: d.stage,
      stageCompleteDate: d.stageCompleteDate,
      nextReviewDate: d.nextReviewDate,
      lastAttemptDate: today,
    },
    items: unit.items
      .filter((i) => results[i.key])
      .map((i) => ({
        itemIndex: i.index,
        lastResult: results[i.key],
        lastAttemptDate: today,
      })),
  };
}
/** Bind a memo patch to the curriculum-provided item address, never a guessed ID. */
export function memoPayload(
  app: AppKey,
  unit: Unit,
  item: Item,
  value: string,
  field = "memo",
) {
  return {
    sourcePath: unit.source,
    unitPath: unit.unitPath,
    dayIndex: unit.dayIndex,
    itemIndex: item.index,
    targetType: "item",
    field,
    value,
  };
}
