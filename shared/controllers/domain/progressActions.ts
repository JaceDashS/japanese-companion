import type { LearningPath, QuizResult, SessionView, SetStudyState, StudyDay, StudyItem, StudyUnit } from "../../domain/studyTypes.ts";

type PersistSourceField = (item: StudyItem, field: string, value: unknown) => Promise<unknown>;
type PersistSourceDayField = (day: StudyDay, field: string, value: unknown, path?: LearningPath) => Promise<unknown>;

type ProgressActionsOptions = {
  session: SessionView | null;
  stateCurriculum: StudyUnit[];
  today: string;
  setState: SetStudyState;
  getPathDay: (curriculum: StudyUnit[], path: LearningPath) => StudyDay | null;
  replaceDay: (curriculum: StudyUnit[], targetPath: LearningPath, nextDay: StudyDay) => StudyUnit[];
  persistSourceField: PersistSourceField;
  persistSourceDayField: PersistSourceDayField;
};

export function createProgressActions({
  session,
  stateCurriculum,
  today,
  setState,
  getPathDay,
  replaceDay,
  persistSourceField,
  persistSourceDayField,
}: ProgressActionsOptions) {
  const markDayAttemptNow = (path: LearningPath) => {
    const day = getPathDay(stateCurriculum, path);
    if (!day || day.lastAttemptDate === today) return;

    const nextDay = {
      ...day,
      lastAttemptDate: today,
    };

    setState((prev) => ({
      ...prev,
      curriculum: replaceDay(prev.curriculum, path, nextDay),
    }));

    void persistSourceDayField(day, "lastAttemptDate", today, path);
  };

  /**
   * A memo belongs to the expression, so every loaded word written the same way shows the new memo.
   * A decomposition stays with its one word.
   */
  const updateMemo = (itemId: string, field: "memo" | "decomposition", value: string) => {
    if (!session) return;
    const path = {
      unitId: session.unitId,
      dayId: session.dayId,
    };

    const day = getPathDay(stateCurriculum, path);
    if (!day) return;

    const targetItem = day.items.find((item) => item.id === itemId);
    if (!targetItem) return;

    if (field === "memo") {
      const expression = targetItem.expression;
      const matches = (item: { id: string; expression?: string }) => item.id === itemId || Boolean(expression && item.expression === expression);
      setState((prev) => ({
        ...prev,
        curriculum: prev.curriculum.map((unit) => ({
          ...unit,
          days: unit.days.map((candidate) => (candidate.items.some(matches)
            ? { ...candidate, items: candidate.items.map((item) => (matches(item) ? { ...item, memo: value } : item)) }
            : candidate)),
        })),
      }));
    } else {
      const nextDay = {
        ...day,
        items: day.items.map((item) => (item.id === itemId ? { ...item, decomposition: value } : item)),
      };
      setState((prev) => ({
        ...prev,
        curriculum: replaceDay(prev.curriculum, path, nextDay),
      }));
    }
    void persistSourceField(targetItem, field, value);
  };

  const updateProblem = (itemId: string, value: unknown) => {
    if (!session) return;
    const path = {
      unitId: session.unitId,
      dayId: session.dayId,
    };

    const day = getPathDay(stateCurriculum, path);
    if (!day) return;

    const targetItem = day.items.find((item) => item.id === itemId);
    if (!targetItem) return;

    const nextDay = {
      ...day,
      items: day.items.map((item) => (item.id === itemId ? { ...item, problem: value } : item)),
    };

    setState((prev) => ({
      ...prev,
      curriculum: replaceDay(prev.curriculum, path, nextDay),
    }));
    void persistSourceField(targetItem, "problem", value);
  };

  const updateLastResultNow = (itemId: string, result: Extract<QuizResult, "PASS" | "FAIL">) => {
    if (!session) return;
    const path = {
      unitId: session.unitId,
      dayId: session.dayId,
    };

    const day = getPathDay(stateCurriculum, path);
    if (!day) return;
    const targetItem = day.items.find((item) => item.id === itemId);
    if (!targetItem) return;

    const nextDay = {
      ...day,
      items: day.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              lastResult: result,
            }
          : item,
      ),
      lastAttemptDate: today,
    };

    setState((prev) => ({
      ...prev,
      curriculum: replaceDay(prev.curriculum, path, nextDay),
    }));
  };

  return {
    markDayAttemptNow,
    updateMemo,
    updateProblem,
    updateLastResultNow,
  };
}
