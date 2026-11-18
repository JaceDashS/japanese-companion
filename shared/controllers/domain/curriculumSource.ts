import {
  getSourceDay,
  getSourceExpression,
  getSourceItem,
  getSourceKanjiToKana,
  getSourceReading,
  toLastResult,
  toNullableDate,
  toOptionalString,
  toStage,
} from "./curriculumSourceAccess.ts";
import type { SourceRef, StudyUnit } from "../../domain/studyTypes.ts";
import { japaneseMemoKey } from "./expression.ts";

/** Updates memo and memoPersonal for every item matching the canonical expression key across all loaded books. */
export function patchMemoInCurriculumFiles(
  files: Record<string, unknown>,
  expression: string,
  memo: string,
): Record<string, unknown> {
  const targetKey = japaneseMemoKey(expression);
  if (!targetKey) return files;
  let changed = false;
  const nextFiles: Record<string, unknown> = {};
  for (const [sourcePath, rawFile] of Object.entries(files)) {
    const file = rawFile && typeof rawFile === "object" ? (rawFile as Record<string, unknown>) : null;
    const units = Array.isArray(file?.days) ? file.days : null;
    if (!file || !units) {
      nextFiles[sourcePath] = rawFile;
      continue;
    }
    let fileChanged = false;
    const nextUnits = units.map((rawUnit) => {
      const unit = rawUnit && typeof rawUnit === "object" ? (rawUnit as Record<string, unknown>) : null;
      const days = Array.isArray(unit?.day) ? unit.day : null;
      if (!unit || !days) return rawUnit;
      let unitChanged = false;
      const nextDays = days.map((rawDay) => {
        const day = rawDay && typeof rawDay === "object" ? (rawDay as Record<string, unknown>) : null;
        const items = Array.isArray(day?.items) ? day.items : null;
        if (!day || !items) return rawDay;
        let dayChanged = false;
        const nextItems = items.map((rawItem) => {
          const item = rawItem && typeof rawItem === "object" ? (rawItem as Record<string, unknown>) : null;
          if (!item || typeof item.expression !== "string" || japaneseMemoKey(item.expression) !== targetKey) {
            return rawItem;
          }
          if (item.memo === memo && item.memoPersonal === memo) return rawItem;
          dayChanged = true;
          return { ...item, memo, memoPersonal: memo };
        });
        if (!dayChanged) return rawDay;
        unitChanged = true;
        return { ...day, items: nextItems };
      });
      if (!unitChanged) return rawUnit;
      fileChanged = true;
      return { ...unit, day: nextDays };
    });
    if (fileChanged) {
      changed = true;
      nextFiles[sourcePath] = { ...file, days: nextUnits };
    } else {
      nextFiles[sourcePath] = rawFile;
    }
  }
  return changed ? nextFiles : files;
}

export function mergeCurriculumFromSource(curriculum: StudyUnit[], files?: Record<string, unknown>): StudyUnit[] {
  if (!files) return curriculum;

  return curriculum.map((unit) => ({
    ...unit,
    days: unit.days.map((day) => {
      const daySourceRef = day.items.find((item) => item?.sourceRef?.sourcePath)?.sourceRef ?? null;
      const sourceJson = daySourceRef?.sourcePath ? files[daySourceRef.sourcePath] : null;
      const sourceDay = daySourceRef ? getSourceDay(sourceJson, daySourceRef.dayIndex, daySourceRef.unitPath) : null;

      return {
        ...day,
        stage: toStage(sourceDay?.stage, day.stage),
        stageCompleteDate:
          sourceDay && Object.prototype.hasOwnProperty.call(sourceDay, "stageCompleteDate")
            ? toNullableDate(sourceDay.stageCompleteDate, day.stageCompleteDate)
            : day.stageCompleteDate,
        nextReviewDate:
          sourceDay && Object.prototype.hasOwnProperty.call(sourceDay, "nextReviewDate")
            ? toNullableDate(sourceDay.nextReviewDate, day.nextReviewDate)
            : day.nextReviewDate,
        lastAttemptDate: toOptionalString(sourceDay?.lastAttemptDate, day.lastAttemptDate),
        lastAttemptAt: toOptionalString(sourceDay?.lastAttemptAt, day.lastAttemptAt ?? ""),
        lastCompletedDate: toOptionalString(sourceDay?.lastCompletedDate, day.lastCompletedDate),
        items: day.items.map((item) => {
          const sourceRef = item.sourceRef as SourceRef | null | undefined;
          if (!sourceRef?.sourcePath) return item;

          const sourceItemJson = files[sourceRef.sourcePath];
          const sourceItem = getSourceItem(sourceItemJson, sourceRef.dayIndex, sourceRef.itemIndex, sourceRef.unitPath);
          if (!sourceItem) return item;
          const nextExpression = getSourceExpression(
            sourceItem,
            item.expression,
            `mergeCurriculumFromSource:${sourceRef.sourcePath}:day${sourceRef.dayIndex + 1}:item${sourceRef.itemIndex + 1}`,
          );

          return {
            ...item,
            expression: nextExpression,
            reading: getSourceReading(sourceItem, item.reading),
            meaningKo: String(sourceItem.meaningKo ?? sourceItem.meaning ?? sourceItem.sentence ?? item.meaningKo ?? ""),
            kanjiToKana: getSourceKanjiToKana(sourceItem, item.kanjiToKana),
            stage: toStage(sourceItem.stage, item.stage),
            nextReviewDate: Object.prototype.hasOwnProperty.call(sourceItem, "nextReviewDate")
              ? toNullableDate(sourceItem.nextReviewDate, item.nextReviewDate)
              : item.nextReviewDate,
            lastResult: toLastResult(sourceItem.lastResult, item.lastResult),
            lastAttemptDate: toOptionalString(sourceItem.lastAttemptDate, item.lastAttemptDate),
            decomposition: toOptionalString(sourceItem.decomposition ?? sourceItem.memoDecomposition, item.decomposition),
            memo: toOptionalString(sourceItem.memo ?? sourceItem.memoPersonal, item.memo),
            problem: Object.prototype.hasOwnProperty.call(sourceItem, "problem") ? sourceItem.problem : item.problem,
          };
        }),
      };
    }),
  }));
}
