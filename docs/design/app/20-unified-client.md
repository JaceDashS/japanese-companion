# Unified Client Design

- Spec: [Unified Client](../../specs/app/20-unified-client.md)
- Architecture: [Overview](../../architecture/10-overview.md)
- Scenarios: [Unified Client](../../testing/scenarios/app/20-unified-client.md)

## Platform Session
- Input: API origin, product key, session store and fetch implementation.
- Output: Serialized authenticated requests and current account details.
- Code: `mobile/src/client.ts` exports `CompanionClient` and `User`. Existing native callers keep the default native mode. The optional browser mode restores cookies directly through `/auth/session`, sends `credentials: include`, never constructs a Cookie header and obtains CSRF from response bodies. Native mode keeps encrypted explicit cookies and `credentials: omit`.
- `mobile/src/platformClient.ts` exports `createPlatformClient`, using Expo fetch and SecureStore under the existing Japanese key. `platformClient.web.ts` exports the same factory using browser fetch and `EXPO_PUBLIC_JPC_API_ORIGIN`.
- `account` reads complete session details and rejects an unexpected account ID. `googleConfig`, `googleChallenge` and browser-only `googleLogin` implement the existing Google exchange.
- `CompanionClient.fetch` adapts source-write controllers to this same serialized transport. It accepts only this product's API origin and companion prefix, GET or POST, preserves HTTP error status for retry handling, and checks the original `x-companion-user` against the validated session before sending writes.
- `account` reads the top-level `hasLocalPassword` session flag and combines it with the user fields for display. Error payloads remain available to backup warning handling through `ApiError.payload`.
- `onUnauthenticated` notifies the gate for every 401, including clock and account calls outside the source-write adapter. `login` accepts the selected remember flag; `mobile/src/LoginScreen.tsx` renders it for the shared entry.

## Shared Screens
- Input: Server curriculum, account preferences, calendar and authenticated account.
- Output: React Native views and original source-addressed writes on browser and Android.
- `mobile/unified.ts` registers `mobile/src/unified/App.tsx`; the app owns login, password changes, account-specific remounting, clock refresh, notices and tab navigation.
- `mobile/src/unified/useStudyModel.ts` exports `loadStudy`, `useStudyModel`, `BootData`, `Preferences` and `StudyModel`. It hydrates the selected book cache and composes the existing dashboard, learning plan, source persistence, session, grading, import and scheduling controllers. It does not maintain a second scheduling algorithm.
- `mobile/src/unified/HomeScreen.tsx` exports `HomeScreen` for daily queues, book choice, Day search, failed-only filtering, stage distribution, recent study and progress dates. Pending source writes are excluded from the daily queue. Missing decomposition opens the existing Day import workflow.
- `mobile/src/unified/SessionScreen.tsx` exports `SessionScreen`: study and quiz, original IDs, per-character readings, meaning visibility, note editing, question editing, item jumps, resizable desktop panel and phone sheets. `QuizMemo` remounts by the source-derived item key and never enters model or persistence state.
- `mobile/src/unified/WordActions.tsx` exports `WordActions`, which passes copy/import/reset operations to the maintained product helpers. Copy serializes the original word payload to JSON; imports retain existing-data protection and source positions.
- `mobile/src/unified/SettingsScreen.tsx` exports `SettingsScreen` and `Display`, covering the account card, profile link, logout, theme, device mode, daily/SRS settings, backup with mojibake confirmation, restore, local cache reset, queue controls and debug copy.
- `mobile/src/unified/ui.tsx` exports `Theme`, `palettes`, `layout`, `Label`, `Card`, `Action`, `Field`, `Sheet`, `Meter` and `Memo`. Inputs are screen values and callbacks; outputs are themed native primitives. `StudyMarkdown` reads the same theme while retaining its safe link/image rules.

## Reused Controllers
- `mobile/scripts/prepare-domain.mjs` now also runs `mobile/scripts/prepare-unified.mjs`. The latter recursively transpiles runtime dependencies of an explicit controller allowlist from `shared/controllers/` and `shared/domain/` into ignored generated files. Browser API, cache and account-date imports are bound to `mobile/src/unified/runtime.ts`; unexpected window, document or import.meta usage rejects generation.
- `mobile/src/unified/runtime.ts` exports the shared `client`, `listenForExpiry`, `setClock`, `getTodayString`, `apiUrl`, `apiFetch`, `hydrateState`, `loadState`, `saveState` and `clearState`. Source writes retain their original account header even after an account change. The clock projects monotonic elapsed time in the account zone.
- `mobile/src/unified/storage.ts` exports `hydrate`, `read`, `readAsync` and `write`: native AsyncStorage plus a hydrated synchronous cache; `mobile/src/unified/storage.web.ts` implements the same boundary with browser storage. State keys retain the existing account and book names.
- `mobile/src/unified/identity.ts` exports `identifyStudyState` and `displayItemId`. Session keys use the source address tuple, while display/copy retains the original ID. This preserves the old native client's support for duplicate item IDs without changing any server address.
- `shared/controllers/domain/sourceWriteQueue.ts` exports `configureQueueStorage`, `QueueStorage`, `StoredQueueRecord` and `NewStoredQueueRecord` for native persistence injection; existing browser callers keep IndexedDB by default.
- `mobile/src/unified/queueStorage.ts` exports `NativeQueueStorage`, consuming account-scoped read/save callbacks and serializing JSON snapshots. Corrupt/read-failed storage is preserved and marked memory-only; write failure retains the live queue and reports that persistence is unavailable.

## Platform Components
- `mobile/src/unified/GoogleButton.tsx` defines `GoogleButtonProps` and the native no-button implementation; `.web.tsx` renders GIS in the native web View with nonce refresh and retry behavior.
- `mobile/src/unified/platform.ts` and `.web.ts` export `confirmAction`, using native dialogs or browser confirmation respectively. `useMainReturn` retains its existing mounted-screen and busy guards on both platforms.
- `mobile/src/unified/useSessionKeys.ts` and `.web.ts` export `useSessionKeys`: native touch/hardware controls, or the original browser number/arrow/space handlers and note shortcut outside editable fields.
- `mobile/src/unified/useNoticePreview.ts` and `.web.ts` export `useNoticePreview`, providing browser developer-preview state only on web. `mobile/src/unified/Notices.tsx` exports `loadNotices` and `Notices`, keeping independent health/notice reads, app ID 42, outage precedence, eight-second normal notices and persistent outage notices.
- `mobile/src/unified/config.ts` exports `API_ORIGIN`, `SITE_ORIGIN` and `NOTICE_APP_ID` from Expo build settings.
- `mobile/src/unified/useHomeFocus.ts` and `mobile/src/unified/useHomeFocus.web.ts` export `useHomeFocus`, refreshing home content after queued writes on native foregrounding or browser focus/visibility changes.
- `mobile/src/useMainReturn.ts` uses browser confirmation on web and retains native dialogs and stale-callback guards on Android. `mobile/src/StudyMarkdown.tsx` reads the common theme; `mobile/src/LoginScreen.tsx` accepts the shared remember control and Google button slot.
- `mobile/app.config.js` enables Metro web output. `mobile/plugins/with-short-cmake-path.cjs` configures separate application/library CMake staging before Expo evaluates projects, including Expo modules built from source.

## Hosted Packaging
- Input: `mobile/package.json` and its independent lockfile, common screens, shared controllers and domain source.
- Output: The Expo web export served by the existing static HTTP server.
- Code: `Dockerfile` installs only mobile dependencies, copies the controller/shared sources for preparation, maps the existing VITE build arguments to Expo public settings, and copies `mobile/dist/web` into the final image. `.dockerignore` excludes native build output and generated caches.
- `.github/workflows/ci.yml` checks both web and Android JavaScript exports in addition to the existing product tests. These exports do not establish APK or physical-device behavior.
- Example: Build the hosted image with API origin `https://api.jace-s.com` and notice ID 42; it serves the same React Native screen tree as the Android entry while the independent local UI uses the same Expo screens and platform session.

```mermaid
flowchart LR
 S["Shared screens"] --> C["CompanionClient"]
 C --> W["Browser cookies and response CSRF"]
 C --> N["Native encrypted credentials"]
 W --> A["Platform API"]
 N --> A
```

## Representative Scenario
- Input: A queued write created by account A while account B is currently signed in.
- Steps: The controller passes its original account header through `CompanionClient.fetch`; the client checks the validated session ID.
- Expected result: A 403 ACCOUNT_CHANGED response is returned without any network request. Another account's results cannot be saved.

## Shared Controller Modules
- Input: Curriculum, settings, session actions, account date and queued original-address payloads.
- Output: Dashboard/session state and account-bound writes; scheduling and grading remain in shared domain rules.
- The following public modules moved from the removed DOM client. Their implementation and call contracts are reused by the common model through generated platform bindings.
- `shared/controllers/api.ts`: `apiUrl`, `apiFetch`.
- `shared/controllers/data/initialState.ts`: re-exports the corresponding shared domain rules.
- `shared/controllers/data/storage.ts`: `loadState`, `saveState`, `clearState`.
- `shared/controllers/data/storageScope.ts`: `setStorageScope`, `scopedStorageKey`, `getStorageScope`.
- `shared/controllers/domain/appPreferences.ts`: `PlanRangePreference`, `AppPreferences`, `readAppPreferences`, `writeAppPreferences`, `normalizeAppPreferences`, `normalizePlanRangePreference`.
- `shared/controllers/domain/constants.ts`: re-exports the corresponding shared domain rules.
- `shared/controllers/domain/curriculumFiles.ts`: `AssetFileMap`, `AvailableBook`, `loadCurriculumFiles`, `getDefaultBookId`, `listAvailableBooks`, `buildAppState`.
- `shared/controllers/domain/curriculumSource.ts`: `mergeCurriculumFromSource`.
- `shared/controllers/domain/curriculumSourceAccess.ts`: `RawRecord`, `asRecord`, `toNullableDate`, `toOptionalString`, `toStage`, `toLastResult`, `getSourceDay`, `getSourceItem`, `getSourceReading`, `getSourceExpression`, `getSourceKanjiToKana`.
- `shared/controllers/domain/date.ts`: `getTodayString`.
- `shared/controllers/domain/dateMath.ts`: `parseYmd`, `diffDays`.
- `shared/controllers/domain/dayClipboardHelpers.ts`: `ImportPayload`, `cloneProblemValue`, `isMemoEmpty`, `isProblemEmpty`, `buildAnswerFromKanjiToKana`, `buildDayWordCopyPayload`, `buildImportPayloadByExpression`.
- `shared/controllers/domain/dayClipboardImporter.ts`: `applyDayDecompositionImport`, `resetDayDecompositions`, `resetDayProblems`.
- `shared/controllers/domain/drawerPreferences.ts`: `DEFAULT_STUDY_DRAWER_WIDTH`, `DEFAULT_DAY_LIST_DRAWER_WIDTH`, `MIN_STUDY_DRAWER_WIDTH`, `MAX_STUDY_DRAWER_WIDTH`, `MIN_DAY_LIST_DRAWER_WIDTH`, `MAX_DAY_LIST_DRAWER_WIDTH`, `normalizeStudyDrawerWidth`, `normalizeDayListDrawerWidth`.
- `shared/controllers/domain/expression.ts`: re-exports the corresponding shared domain rules.
- `shared/controllers/domain/homeDashboard.ts`: `useHomeDashboardData`.
- `shared/controllers/domain/homeDashboardBuilders.ts`: `ReviewDueRow`, `LearningPlanRow`, `PlanRange`, `buildReviewDue`, `buildHomeDueDebug`, `buildOverallMeta`, `buildDateRangeMeta`, `buildLearningPlanRows`, `buildDebugLogs`, `buildAllDayRows`.
- `shared/controllers/domain/homeDueDebug.ts`: `HomeDueDebugRow`.
- `shared/controllers/domain/learningPath.ts`: `DayPath`, `DaySequenceIndex`, `getPathDay`, `getAllDayPaths`, `getFirstDayPath`, `getNextDayPath`, `getDaySequenceIndex`, `isValidLearningPath`, `toLearningPathKey`, `isSameLearningPath`, `areLearningPathListsEqual`.
- `shared/controllers/domain/learningPlanHelpers.ts`: `isLearningCompletedDay`, `findFirstUnattemptedPath`, `getContinueLearningPath`, `normalizeDailyNewLearningCount`, `getTodayStartedLearningPath`, `buildDailyLearningPlanPaths`.
- `shared/controllers/domain/learningPlanSync.ts`: `updateDailyLearningCount`, `useLearningPlanSync`.
- `shared/controllers/domain/problem.ts`: `normalizeProblem`, `createProblemDraft`, `buildProblemPayload`.
- `shared/controllers/domain/problemPayload.ts`: `normalizeJsonBlock`, `readProblemPayloadFromDraft`, `validateProblemPayload`, `mergeProblemPayload`.
- `shared/controllers/domain/progressActions.ts`: `createProgressActions`.
- `shared/controllers/domain/sessionController.ts`: `createSessionController`.
- `shared/controllers/domain/sessionInput.ts`: `createQuizInputActions`, `createSessionKeyboardHandler`.
- `shared/controllers/domain/sessionOpeners.ts`: `createSessionOpeners`.
- `shared/controllers/domain/sessionSelectors.ts`: `useSessionSelection`.
- `shared/controllers/domain/sessionViewTypes.ts`: `SessionView`, `SessionItemView`, `SessionDayView`, `SetSession`, `SetBoolean`, `SetString`, `ProblemDraft`, `ProblemEditorState`, `SetProblemEditor`.
- `shared/controllers/domain/sourcePersistence.ts`: `PersistSourceDayResult`, `SourceWriteQueueController`, `useSourceWriteQueue`, `createSourcePersistence`.
- `shared/controllers/domain/sourceWriteQueue.ts`: `SourceWriteFetch`, `SourceWriteLearningPath`, `SourceWriteRequest`, `SourceWriteQueueStatus`, `SourceWriteQueueItem`, `SourceWriteQueueSnapshot`, `StoredQueueRecord`, `NewStoredQueueRecord`, `QueueStorage`, `configureQueueStorage`, `SourceWriteQueue`.
- `shared/controllers/domain/srs.ts`: re-exports the corresponding shared domain rules.
- `shared/controllers/domain/srsPreferences.ts`: re-exports the corresponding shared domain rules.
- `shared/controllers/domain/stateCompatibility.ts`: `hasValidSourceRef`, `sanitizeCurriculum`, `isStateCompatible`.
- `shared/controllers/domain/studyHelpers.ts`: `isQuizTarget`, `replaceDay`, `getDayProgress`, `getDayPassRatio`, `getDayMissingDecompositionCount`, `getUnitProgress`, `getDisplayDayIndex`, `isValidAttemptDate`, `isFutureReviewDate`, `getDayStage`, `getDayNextReviewDate`, `getDayStageCompleteDate`, `getDayLastAttemptDate`, `getDayLastCompletedDate`, `getDisplayItemId`, `shuffleArray`.
- `shared/controllers/domain/textRepair.ts`: re-exports the corresponding shared domain rules.

### Controller Example
- Input: An existing queued source or chapter write for account A.
- Steps: The shared queue invokes the common runtime transport and checks its captured account.
- Expected result: The same payload and retry behavior is preserved; another account cannot receive the write.

## Root Build Commands
- Input: Root npm command, Expo dependencies, common source and API environment.
- Output: A web development server, static export/preview or Android JavaScript export from the same entry.
- Code: `package.json`, `mobile/package.json`, `scripts/dev-monorepo.js`, `scripts/prod-monorepo.js`, `scripts/serve-static.mjs`, `Dockerfile`, `.github/workflows/ci.yml`.
- Root development delegates to Expo web. Build exports to `mobile/dist/web`; local and preview serve that export with the existing traversal and source-map protection. Docker sets its bind host explicitly. No standalone content server is started by these UI commands.
- Example: Run root build and preview after editing the shared question screen; the browser serves the same screen bundled for Android.
- Guide: [Development](../../guides/10-development.md)

## Shared Development Origin
- Input: An explicit `EXPO_PUBLIC_COMPANION_LOCAL_API=1` build and the current browser origin.
- Output: Same-origin API, notice and profile requests against isolated development services, with the existing CSRF/account bindings.
- Code: `mobile/src/unified/config.ts` exports `DEVELOPMENT_BROWSER_ORIGIN`; `mobile/src/platformClient.web.ts` passes it to `CompanionClient`. Only browser mode accepts HTTP for that exact explicit origin. Ordinary builds and native HTTPS checks are unchanged. `mobile/app.config.js` uses `EXPO_PUBLIC_BASE_PATH` for prefixed web exports.
- Example: Open the LAN development URL with the explicit development build; it calls that same origin rather than production. A different HTTP API or native caller is still rejected.
