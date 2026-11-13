import { useEffect, useRef, useState } from "react";
import type { StudyState, SessionView, StudyItem, LearningPath } from "../../../shared/domain/studyTypes";
import { buildAppState, listAvailableBooks, loadCurriculumFiles } from "../../.generated/product/shared/controllers/domain/curriculumFiles.js";
import { useHomeDashboardData } from "../../.generated/product/shared/controllers/domain/homeDashboard.js";
import { useLearningPlanSync, updateDailyLearningCount } from "../../.generated/product/shared/controllers/domain/learningPlanSync.js";
import { createSourcePersistence, useSourceWriteQueue } from "../../.generated/product/shared/controllers/domain/sourcePersistence.js";
import { createProgressActions } from "../../.generated/product/shared/controllers/domain/progressActions.js";
import { createSessionController } from "../../.generated/product/shared/controllers/domain/sessionController.js";
import { createSessionOpeners } from "../../.generated/product/shared/controllers/domain/sessionOpeners.js";
import { useSessionSelection } from "../../.generated/product/shared/controllers/domain/sessionSelectors.js";
import { createQuizInputActions } from "../../.generated/product/shared/controllers/domain/sessionInput.js";
import { getPathDay, replaceDay, isQuizTarget, shuffleArray, getDisplayDayIndex, getDisplayItemId } from "../../.generated/product/shared/controllers/domain/studyHelpers.js";
import { buildProblemPayload, createProblemDraft, normalizeJsonBlock, normalizeProblem } from "../../.generated/product/shared/controllers/domain/problem.js";
import { normalizeSrsSettings } from "../../.generated/product/shared/domain/srsPreferences.js";
import { applyQuizResultForDay, applyReviewResultForDay } from "../../.generated/product/shared/domain/srs.js";
import { mergeCurriculumFromSource } from "../../.generated/product/shared/controllers/domain/curriculumSource.js";
import { applyDayDecompositionImport, resetDayDecompositions, resetDayProblems } from "../../.generated/product/shared/controllers/domain/dayClipboardImporter.js";
import { buildDayWordCopyPayload } from "../../.generated/product/shared/controllers/domain/dayClipboardHelpers.js";
import { apiFetch, apiUrl, hydrateState, loadView, saveState } from "./runtime";
import { readAppPreferences, writeAppPreferences } from "../../.generated/product/shared/controllers/domain/appPreferences.js";
import { identifyStudyState, displayItemId } from "./identity";
import { loadMemos, type MemoEntry } from "./japaneseWords";

export type Preferences = {
  selectedBookId?: string;
  dailyNewLearningCount?: number;
  srs?: { maxReviewStage?: number; failureRetryDays?: number };
  planRange?: { start?: string; end?: string };
};
/** Build a book's study state from server files and reapply the cached screen layout. */
function buildState(book: string, files: Record<string, unknown>, dailyNewLearningCount: number): StudyState {
  return identifyStudyState({ ...buildAppState(book, files, { dailyNewLearningCount }), ...loadView(book) });
}
export type BootData = { files: Record<string, unknown>; preferences: Preferences; book: string };

/** Load server content and the selected book's account-scoped cache before mounting study hooks. */
export async function loadStudy(): Promise<BootData> {
  const [files, rawPreferences] = await Promise.all([loadCurriculumFiles(), readAppPreferences()]);
  const preferences = rawPreferences as Preferences;
  const books = listAvailableBooks(files);
  const book = books.find((item: any) => item.id === preferences.selectedBookId)?.id ?? books.find((item: any) => item.id === "jlpt-one-book-n1")?.id ?? books[0]?.id;
  if (!book) throw new Error("커리큘럼을 찾을 수 없습니다.");
  await hydrateState(book);
  return { files, preferences, book };
}

/** Share the existing web study rules, source-write queue and controllers across Expo platforms. */
export function useStudyModel(initial: BootData, today: string, notify: (text: string, tone?: string) => void) {
  const [files, setFiles] = useState(initial.files);
  const [book, setBook] = useState(initial.book);
  const [state, setState] = useState<StudyState>(() => buildState(book, files, initial.preferences.dailyNewLearningCount ?? 1));
  const [session, setSession] = useState<SessionView | null>(null);
  const [editor, setEditor] = useState({ open: false, draft: createProblemDraft(null), error: "" });
  const [srs, setSrs] = useState(() => normalizeSrsSettings(initial.preferences.srs));
  const [plan, setPlan] = useState(() => ({ start: initial.preferences.planRange?.start ?? today, end: initial.preferences.planRange?.end ?? (today.slice(0, 4) + "-06-01" >= today ? today.slice(0, 4) + "-06-01" : (Number(today.slice(0, 4)) + 1) + "-06-01") }));
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const reloadMemos = () => loadMemos().then(setMemos).catch((error) => notify(String(error), "error"));
  useEffect(() => { void reloadMemos(); }, []);
  const queue = useSourceWriteQueue(apiFetch);
  const stalled = useRef(new Set<(error: Error) => void>());
  const stalledError = () => new Error("저장하지 못한 학습 기록이 있어 다시 시도하는 중입니다. 연결을 확인한 뒤 잠시 후 다시 시도해 주세요.");
  const retrying = queue.items.some((item: { status: string }) => item.status === "retrying");
  useEffect(() => {
    if (!retrying) return;
    for (const reject of stalled.current) reject(stalledError());
    stalled.current.clear();
  }, [retrying]);
  /** Waits for queued saves, but rejects once a save is retrying so the screen never waits forever. */
  const waitForSaves = () => {
    if (retrying) return Promise.reject(stalledError());
    return new Promise<void>((resolve, reject) => {
      stalled.current.add(reject);
      queue.waitForIdle().then(resolve, reject).finally(() => stalled.current.delete(reject));
    });
  };
  const persistence = createSourcePersistence(apiFetch);
  useLearningPlanSync({ setState, state, today });
  useEffect(() => { saveState(state, book); }, [state, book]);
  const dashboard = useHomeDashboardData({ dailyNewLearningCount: state.dailyNewLearningCount ?? 1, planRange: plan, srsSettings: srs, state, today });
  const selection = useSessionSelection({ getPathDay, isQuizTarget, session, stateCurriculum: state.curriculum });
  const { currentItem, sessionDay, sessionItems } = selection;
  const progress = createProgressActions({ session, stateCurriculum: state.curriculum, today, setState, getPathDay, replaceDay, ...persistence });
  const refresh = async () => {
    await waitForSaves();
    const next = await loadCurriculumFiles();
    setFiles(next);
    setState((previous) => identifyStudyState({ ...previous, curriculum: mergeCurriculumFromSource(previous.curriculum, next) }));
    void reloadMemos();
  };
  /** Reloads the textbooks after a personal book changed; a deleted current book falls back to the default. */
  const reloadBooks = async () => {
    await waitForSaves();
    const next = await loadCurriculumFiles();
    setFiles(next);
    const available = listAvailableBooks(next);
    if (available.some((item: any) => item.id === book)) {
      setState((previous) => buildState(book, next, previous.dailyNewLearningCount ?? 1));
      return;
    }
    const fallback = available.find((item: any) => item.id === "jlpt-one-book-n1")?.id ?? available[0]?.id;
    if (!fallback) return;
    await hydrateState(fallback);
    setState(buildState(fallback, next, state.dailyNewLearningCount ?? 1));
    setBook(fallback); setSession(null);
    await writeAppPreferences({ selectedBookId: fallback });
  };
  /** Saves a memo or decomposition and keeps the related-note list in step with memo edits. */
  const updateMemo = (itemId: string, field: "memo" | "decomposition", value: string) => {
    progress.updateMemo(itemId, field, value);
    if (field !== "memo") return;
    const target = getPathDay(state.curriculum, { unitId: session?.unitId ?? "", dayId: session?.dayId ?? "" })?.items.find((item: StudyItem) => item.id === itemId);
    const expression = String(target?.expression ?? "");
    if (!expression) return;
    setMemos((previous) => {
      const rest = previous.filter((entry) => entry.expression !== expression);
      return value.trim() ? [...rest, { expression, memo: value, reading: String(target?.reading ?? ""), meaningKo: String(target?.meaningKo ?? "") }] : rest;
    });
  };
  const goHome = () => { setSession(null); void refresh().catch((error) => notify(String(error), "error")); };
  const controller = createSessionController({
    session, sessionItems, currentItem, problemEditor: editor, setProblemEditor: setEditor,
    setSession, setState, stateCurriculum: state.curriculum, today, ...progress,
    normalizeProblem, createProblemDraft, buildProblemPayload, getPathDay, replaceDay,
    applyReviewResultForDay: (day: any, date: string, results: any) => applyReviewResultForDay(day, date, results, srs),
    applyQuizResultForDay: (day: any, date: string, results: any) => applyQuizResultForDay(day, date, results, srs),
    persistSourceDayResult: persistence.persistSourceDayResult, goHome,
  });
  const input = createQuizInputActions({ currentItem, goNextQuizItem: controller.goNextQuizItem, normalizeProblem, session, setSession, updateLastResultNow: progress.updateLastResultNow });
  const openers = createSessionOpeners({ getPathDay, isQuizTarget, markDayAttemptNow: progress.markDayAttemptNow, setSession, shuffleArray, stateCurriculum: state.curriculum });
  useEffect(() => { setEditor({ open: false, draft: createProblemDraft(currentItem?.problem), error: "" }); }, [currentItem?.id]);
  useEffect(() => {
    if (!session || session.phase !== "quiz" || !currentItem || session.choiceOrders?.[currentItem.id]) return;
    const problem = normalizeProblem(currentItem.problem);
    if (problem?.choices.length) setSession((previous) => previous && ({ ...previous, choiceOrders: { ...previous.choiceOrders, [currentItem.id]: shuffleArray(problem.choices) } }));
  }, [currentItem?.id, currentItem?.problem, session?.phase, session?.index]);
  const mutateOptions = (path: LearningPath) => ({ getDisplayDayIndex, isQuizTarget, persistSourceField: persistence.persistSourceField, replaceDay, setState, showToast: notify, targetDay: getPathDay(state.curriculum, path), targetPath: path });
  return {
    state, files, book, books: listAvailableBooks(files), session, setSession, editor, setEditor,
    srs, plan, dashboard, queue, currentItem: currentItem as StudyItem | null, sessionDay, sessionItems,
    ...controller, ...input, ...openers, ...progress, updateMemo, memos, reloadBooks, getDisplayItemId: displayItemId, goHome, refresh,
    async switchBook(next: string) {
      if (next === book) return;
      await waitForSaves();
      await hydrateState(next);
      setState(buildState(next, files, state.dailyNewLearningCount ?? 1));
      setBook(next); setSession(null);
      await writeAppPreferences({ selectedBookId: next, dailyNewLearningCount: state.dailyNewLearningCount ?? 1 });
    },
    updatePlan(next: { start: string; end: string }) { setPlan(next); void writeAppPreferences({ planRange: next }); },
    setSideWidth(value: number) { setState((previous) => previous.studyDrawerWidth === value ? previous : { ...previous, studyDrawerWidth: Math.max(260, Math.min(560, value)) }); },
    updateDaily(value: string) { updateDailyLearningCount({ event: { target: { value } }, setState, today }); },
    updateSrs(patch: Partial<NonNullable<Preferences["srs"]>>) { const next = normalizeSrsSettings({ ...srs, ...patch }); setSrs(next); void writeAppPreferences({ srs: next }); },
    dayCopy(path: LearningPath) { const day = getPathDay(state.curriculum, path); return day ? JSON.stringify(buildDayWordCopyPayload(day.items, isQuizTarget), null, 2) : ""; },
    async importDay(path: LearningPath, text: string) { const options = mutateOptions(path); if (!options.targetDay) return false; return applyDayDecompositionImport({ ...options, normalizeJsonBlock, rawText: text }); },
    async resetDay(path: LearningPath, problems: boolean) { const options = mutateOptions(path); if (options.targetDay) await (problems ? resetDayProblems : resetDayDecompositions)(options); },
  };
}
export type StudyModel = ReturnType<typeof useStudyModel>;
