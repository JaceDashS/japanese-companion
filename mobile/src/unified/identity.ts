import type { StudyState, StudyItem } from "../../../shared/domain/studyTypes";
/** Use source addresses as session keys while preserving the original ID for display and copy. */
export function identifyStudyState(state: StudyState): StudyState {
  return { ...state, curriculum: state.curriculum.map((unit) => ({ ...unit, days: unit.days.map((day) => ({ ...day, items: day.items.map((item, index) => ({ ...item,
    displayId: item.displayId ?? item.id,
    id: JSON.stringify([item.sourceRef?.sourcePath ?? unit.id, item.sourceRef?.unitPath ?? unit.id, item.sourceRef?.dayIndex ?? day.id, item.sourceRef?.itemIndex ?? index]),
  })) })) })) };
}
export function displayItemId(item: StudyItem | null | undefined) { return String(item?.displayId ?? item?.id ?? ""); }
