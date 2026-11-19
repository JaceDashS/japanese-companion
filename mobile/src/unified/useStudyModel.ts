import { getStorageScope } from "../../.generated/product/shared/controllers/data/storageScope.js";
import { useEffect, useRef, useState } from "react";
import { toLearningPathKey } from "../../.generated/product/shared/controllers/domain/learningPath.js";
import type { StudyState, SessionView, StudyItem, LearningPath } from "../../../shared/domain/studyTypes";
import { buildAppState } from "../../.generated/product/shared/controllers/domain/curriculumFiles.js";
import { useHomeDashboardData } from "../../.generated/product/shared/controllers/domain/homeDashboard.js";
import { useLearningPlanSync, updateDailyLearningCount } from "../../.generated/product/shared/controllers/domain/learningPlanSync.js";
import { createSourcePersistence, readPendingSourceWrites, useSourceWriteQueue } from "../../.generated/product/shared/controllers/domain/sourcePersistence.js";
import { createProgressActions } from "../../.generated/product/shared/controllers/domain/progressActions.js";
import { createSessionController } from "../../.generated/product/shared/controllers/domain/sessionController.js";
import type { Completion } from "./CompletionHud";
import { createSessionOpeners } from "../../.generated/product/shared/controllers/domain/sessionOpeners.js";
import { useSessionSelection } from "../../.generated/product/shared/controllers/domain/sessionSelectors.js";
import { createQuizInputActions } from "../../.generated/product/shared/controllers/domain/sessionInput.js";
import { getPathDay, replaceDay, isQuizTarget, shuffleArray, getDisplayDayIndex, getDisplayItemId } from "../../.generated/product/shared/controllers/domain/studyHelpers.js";
import { buildProblemPayload, createProblemDraft, normalizeJsonBlock, normalizeProblem } from "../../.generated/product/shared/controllers/domain/problem.js";
import { normalizeSrsSettings } from "../../.generated/product/shared/domain/srsPreferences.js";
import { applyQuizResultForDay, applyReviewResultForDay } from "../../.generated/product/shared/domain/srs.js";
import { mergeCurriculumFromSource, patchMemoInCurriculumFiles } from "../../.generated/product/shared/controllers/domain/curriculumSource.js";
import { japaneseMemoKey } from "../../.generated/product/shared/controllers/domain/expression.js";
import { applyDayDecompositionImport, resetDayDecompositions, resetDayProblems } from "../../.generated/product/shared/controllers/domain/dayClipboardImporter.js";
import { buildDayWordCopyPayload } from "../../.generated/product/shared/controllers/domain/dayClipboardHelpers.js";
import { apiFetch, client, hydrateState, loadView, saveState } from "./runtime";
import { writeAppPreferences } from "../../.generated/product/shared/controllers/domain/appPreferences.js";
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
type AvailableBook = { id: string; title: string };
type Curriculum = { files: Record<string, unknown>; book: string; books: AvailableBook[] };
export type BootData = Curriculum & { preferences: Preferences };

function readCurriculum(book?: string) {
  return client.get<Curriculum>("curriculum", getStorageScope(), book ? { book } : undefined);
}

export async function loadStudy(data: Curriculum, { preferences }: { preferences: Preferences }): Promise<BootData> {
  await hydrateState(data.book);
  return { ...data, preferences, files: await applyQueuedWrites(data.files) };
}

/** Replay the account FIFO on the loaded book; retain the unmodified server payload for disk. */
async function applyQueuedWrites(files: Record<string, unknown>) {
  const writes = await readPendingSourceWrites(apiFetch);
  if (!writes.length) return files;
  let next = JSON.parse(JSON.stringify(files)) as Record<string, unknown>;
  const itemFields = new Set(["memo", "memoPersonal", "decomposition", "memoDecomposition", "problem", "lastResult", "lastAttemptDate"]);
  const dayFields = new Set(["stage", "stageCompleteDate", "nextReviewDate", "lastAttemptDate"]);
  type Item = { expression?: string; [key: string]: unknown };
  type Day = { items?: Item[]; [key: string]: unknown };
  for (const write of writes) {
    const book = next[String(write?.sourcePath)] as { days?: { day?: Day[] }[] } | undefined;
    const day = book?.days?.[Number(write?.unitPath ?? 0)]?.day?.[Number(write?.dayIndex)];
    if (!day) continue;
    if (Array.isArray(write.items) && write.day) {
      for (const field of dayFields) if (Object.hasOwn(write.day, field)) day[field] = write.day[field];
      for (const result of write.items) {
        const item = day.items?.[Number(result?.itemIndex)];
        if (item) item.lastResult = result.lastResult;
      }
    } else if (write.targetType === "day" && dayFields.has(write.field)) {
      day[write.field] = write.value;
    } else if (itemFields.has(write.field)) {
      const item = day.items?.[Number(write.itemIndex)];
      if (!item) continue;
      if (write.field === "memo" || write.field === "memoPersonal") {
        if (item.expression) next = patchMemoInCurriculumFiles(next, item.expression, String(write.value ?? ""));
      } else if (write.field === "decomposition" || write.field === "memoDecomposition") {
        item.decomposition = write.value;
        item.memoDecomposition = write.value;
      } else {
        item[write.field] = write.value;
      }
    }
  }
  return next;
}

/** Share the existing web study rules, source-write queue and controllers across Expo platforms. */
export function useStudyModel(initial: BootData, today: string, notify: (text: string, tone?: string) => void, verified: boolean, cache: (data: Curriculum, prefs: Preferences) => void) {
  const [files, setFiles] = useState(initial.files);
  const [book, setBook] = useState(initial.book);
  const [books, setBooks] = useState(initial.books);
  const selecting = useRef(false);
  const [switching, setSwitching] = useState(false);
  const [state, setState] = useState<StudyState>(() => buildState(book, files, initial.preferences.dailyNewLearningCount ?? 1));
  const [session, setSession] = useState<SessionView | null>(null);
  const [editor, setEditor] = useState({ open: false, draft: createProblemDraft(null), error: "" });
  const activeBook = useRef(book);
  activeBook.current = book;
  const inSession = useRef(false);
  inSession.current = Boolean(session);
  const deferred = useRef<{ book: string; files: Curriculum["files"]; books: AvailableBook[] } | null>(null);
  useEffect(() => {
    if (session || !deferred.current) return;
    const next = deferred.current;
    deferred.current = null;
    if (next.book !== book) return;
    setBooks(next.books);
    setFiles(next.files);
    setState(previous => identifyStudyState({ ...previous, curriculum: mergeCurriculumFromSource(previous.curriculum, next.files) }));
  }, [book, session]);
  const [srs, setSrs] = useState(() => normalizeSrsSettings(initial.preferences.srs));
  const [plan, setPlan] = useState(() => ({ start: initial.preferences.planRange?.start ?? today, end: initial.preferences.planRange?.end ?? (today.slice(0, 4) + "-06-01" >= today ? today.slice(0, 4) + "-06-01" : (Number(today.slice(0, 4)) + 1) + "-06-01") }));
  const [memos, setMemos] = useState<MemoEntry[]>([]);
  const reloadMemos = () => loadMemos().then(setMemos).catch((error) => notify(String(error), "error"));
  useEffect(() => { if (verified) void reloadMemos(); }, [verified]);
  const queue = useSourceWriteQueue(apiFetch, verified);
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
  useEffect(() => { if (verified) saveState(state, book); }, [state, book, verified]);
  const dashboard = useHomeDashboardData({ dailyNewLearningCount: state.dailyNewLearningCount ?? 1, planRange: plan, srsSettings: srs, state, today });
  const selection = useSessionSelection({ getPathDay, isQuizTarget, session, stateCurriculum: state.curriculum });
  const { currentItem, sessionDay, sessionItems } = selection;
  const progress = createProgressActions({ session, stateCurriculum: state.curriculum, today, setState, getPathDay, replaceDay, ...persistence });
  const refresh = async () => {
    if (selecting.current) return;
    await waitForSaves();
    const next = await readCurriculum(book);
    if (selecting.current || activeBook.current !== next.book) return;
    const prefs = { ...initial.preferences, selectedBookId: next.book, dailyNewLearningCount: state.dailyNewLearningCount, planRange: plan, srs };
    cache(next, prefs);
    const fresh = await applyQueuedWrites(next.files);
    if (activeBook.current !== next.book || selecting.current) return;
    if (inSession.current) { deferred.current = { ...next, files: fresh }; return; }
    setBooks(next.books);
    setFiles(fresh);
    setState(previous => identifyStudyState({ ...previous, curriculum: mergeCurriculumFromSource(previous.curriculum, fresh) }));
    void reloadMemos();
  };

  /** Reload the catalog and the open textbook after a personal book changes. */
  const reloadBooks = async () => {
    await waitForSaves();
    const { books: available } = await client.get<{ books: AvailableBook[] }>("books", getStorageScope());
    const retained = available.some(entry => entry.id === book);
    const next = await readCurriculum(retained ? book : undefined);
    await hydrateState(next.book);
    setBooks(next.books);
    setFiles(next.files);
    setState(previous => buildState(next.book, next.files, previous.dailyNewLearningCount ?? 1));
    if (!retained) {
      setBook(next.book);
      setSession(null);
      await writeAppPreferences({ selectedBookId: next.book });
    }
  };
  const syncMemoState = (expression: string, value: string, target?: { reading?: string; meaningKo?: string }) => {
    const key = japaneseMemoKey(expression);
    if (!key) return;
    setFiles((previous) => patchMemoInCurriculumFiles(previous, expression, value));
    setMemos((previous) => {
      const existing = previous.find((entry) => japaneseMemoKey(entry.expression) === key);
      const rest = previous.filter((entry) => japaneseMemoKey(entry.expression) !== key);
      return value.trim()
        ? [...rest, { expression: key, memo: value, reading: String(target?.reading ?? existing?.reading ?? ""), meaningKo: String(target?.meaningKo ?? existing?.meaningKo ?? "") }]
        : rest;
    });
  };
  /** Applies an already-persisted memo (e.g. from WordLookup) across loaded books, curriculum and related notes. */
  const applyMemo = (expression: string, value: string) => {
    const key = japaneseMemoKey(expression);
    if (!key) return;
    setState((previous) => ({
      ...previous,
      curriculum: previous.curriculum.map((unit) => ({
        ...unit,
        days: unit.days.map((day) => (day.items.some((item) => japaneseMemoKey(String(item.expression ?? "")) === key)
          ? { ...day, items: day.items.map((item) => (japaneseMemoKey(String(item.expression ?? "")) === key ? { ...item, memo: value } : item)) }
          : day)),
      })),
    }));
    syncMemoState(expression, value);
  };
  /** Saves a memo or decomposition and keeps loaded books and related-note lists in step with memo edits. */
  const updateMemo = (itemId: string, field: "memo" | "decomposition", value: string) => {
    progress.updateMemo(itemId, field, value);
    if (field !== "memo") return;
    const target = getPathDay(state.curriculum, { unitId: session?.unitId ?? "", dayId: session?.dayId ?? "" })?.items.find((item: StudyItem) => item.id === itemId);
    const expression = String(target?.expression ?? "");
    if (!expression) return;
    syncMemoState(expression, value, { reading: String(target?.reading ?? ""), meaningKo: String(target?.meaningKo ?? "") });
  };
  const goHome = () => { setSession(null); };
  // The last finished quiz; the home screen shows it once and clears it.
  const [completion, setCompletion] = useState<Completion | null>(null);
  // Attempt dates are days; the order in which Days were opened, answered or graded here breaks same-day ties in recent study.
  const [recentOpened, setRecentOpened] = useState<string[]>([]);
  const touchRecent = (path: LearningPath) => setRecentOpened(previous => [toLearningPathKey(path), ...previous.filter(key => key !== toLearningPathKey(path))].slice(0, 50));
  const markDayAttemptNow = (path: LearningPath) => { touchRecent(path); progress.markDayAttemptNow(path); };
  const updateLastResultNow: typeof progress.updateLastResultNow = (...args) => { if (session) touchRecent({ unitId: session.unitId, dayId: session.dayId }); return progress.updateLastResultNow(...args); };
  const controller = createSessionController({
    session, sessionItems, currentItem, problemEditor: editor, setProblemEditor: setEditor,
    setSession, setState, stateCurriculum: state.curriculum, today, ...progress, markDayAttemptNow,
    normalizeProblem, createProblemDraft, buildProblemPayload, getPathDay, replaceDay,
    applyReviewResultForDay: (day: any, date: string, results: any) => applyReviewResultForDay(day, date, results, srs),
    applyQuizResultForDay: (day: any, date: string, results: any) => applyQuizResultForDay(day, date, results, srs),
    persistSourceDayResult: persistence.persistSourceDayResult, goHome,
    onQuizComplete: (result: Omit<Completion, "id">) => setCompletion({ ...result, id: Date.now() }),
  });
  const input = createQuizInputActions({ currentItem, goNextQuizItem: controller.goNextQuizItem, normalizeProblem, session, setSession, updateLastResultNow });
  const openers = createSessionOpeners({ getPathDay, isQuizTarget, markDayAttemptNow, setSession, shuffleArray, stateCurriculum: state.curriculum });
  useEffect(() => { setEditor({ open: false, draft: createProblemDraft(currentItem?.problem), error: "" }); }, [currentItem?.id]);
  useEffect(() => {
    if (!session || session.phase !== "quiz" || !currentItem || session.choiceOrders?.[currentItem.id]) return;
    const problem = normalizeProblem(currentItem.problem);
    if (problem?.choices.length) setSession((previous) => previous && ({ ...previous, choiceOrders: { ...previous.choiceOrders, [currentItem.id]: shuffleArray(problem.choices) } }));
  }, [currentItem?.id, currentItem?.problem, session?.phase, session?.index]);
  const mutateOptions = (path: LearningPath) => ({ getDisplayDayIndex, isQuizTarget, persistSourceField: persistence.persistSourceField, replaceDay, setState, showToast: notify, targetDay: getPathDay(state.curriculum, path), targetPath: path });
  return {
    state, files, book, books, switching, session, setSession, editor, setEditor,
    srs, plan, dashboard, queue, currentItem: currentItem as StudyItem | null, sessionDay, sessionItems,
    ...controller, ...input, ...progress, ...openers, markDayAttemptNow, updateLastResultNow, recentOpened, completion, clearCompletion: () => setCompletion(null), updateMemo, applyMemo, memos, reloadBooks, getDisplayItemId: displayItemId, goHome, refresh,
    async switchBook(next: string) {
      if (next === book || selecting.current) return;
      selecting.current = true;
      setSwitching(true);
      try {
        await waitForSaves();
        const data = await readCurriculum(next);
        await hydrateState(data.book);
        const { preferences } = await client.post<{ preferences: Preferences }>("app-preferences", { preferences: { selectedBookId: data.book, dailyNewLearningCount: state.dailyNewLearningCount ?? 1 } }, getStorageScope());
        cache(data, preferences);
        const fresh = await applyQueuedWrites(data.files);
        setBooks(data.books);
        setFiles(fresh);
        setState(buildState(data.book, fresh, state.dailyNewLearningCount ?? 1));
        setBook(data.book);
        setSession(null);
      } finally {
        setSwitching(false);
        selecting.current = false;
      }
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
