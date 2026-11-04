import type { StudyModel } from "./useStudyModel";
/** Native navigation uses touch controls and hardware Back rather than DOM keyboard listeners. */
export function useSessionKeys(_model: StudyModel, _onNotes: () => void, _onHome: () => void) {}
