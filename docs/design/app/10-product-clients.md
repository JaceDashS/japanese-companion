# Product Clients Design

## Shared Learning Source
- Input: Curriculum file map, saved state, settings and an authenticated account date.
- Output: Parsed study units, grades and stable server payloads.
- Code: `shared/domain/`, `shared/data/` when present, `client/src/domain/`, `mobile/src/study.ts`.
- Web modules at the old paths re-export shared TypeScript source. Date adapters retain the web account calendar while shared date arithmetic stays free of browser dependencies.
- `mobile/scripts/prepare-domain.mjs` transpiles the product allowlist, normalizes relative JavaScript imports and rejects browser runtime dependencies. Generation is required before native type checks, tests and bundling.
- The native study adapter normalizes only this product's curriculum and creates the same API payload as before. Generic mobile UI and transport are owned by each product copy; changes shared between products must be applied and tested in both repositories.
- Spec: [Product Clients](../../specs/app/10-product-clients.md)
- Architecture: [Overview](../../architecture/10-overview.md)
- Scenarios: [Product Clients](../../testing/scenarios/app/10-product-clients.md)

## Public Modules
The shared modules expose the following identifiers. Re-export adapters preserve the existing web call sites. Scheduling helpers consume a YYYY-MM-DD date and preserve existing stage and retry calculations; parsers preserve original item addresses and order; public types define the same curriculum and session models.

- `shared/data/assetModules.ts`: `extractBookId`, `extractAssetPath`, `normalizeAssetPath`, `toModulePath`, `getAssetModules`, `getCombinedModules`
- `shared/data/initialState.ts`: `getAvailableBooks`, `createInitialState`
- `shared/data/initialStateParsing.ts`: `RawRecord`, `RawDayBlock`, `asRecord`, `createExpressionItem`, `extractDayBlocks`, `toReading`, `toExpression`, `toMeaning`, `toKanjiToKana`, `toItemId`
- `shared/domain/constants.ts`: `REVIEW_STAGE_MAX`, `MIN_REVIEW_STAGE`, `GRADUATED_STAGE`, `STAGE_LABELS`, `normalizeReviewStageLimit`, `getStageLabel`, `isGraduatedStage`, `getOffsetToNextStage`
- `shared/domain/date.ts`: `formatDate`, `getTodayString`, `addDays`, `isDueOnOrBefore`
- `shared/domain/expression.ts`: `assertNoDisallowedExpressionKeys`, `getExpressionStrict`
- `shared/domain/shuffle.ts`: `shuffle`
- `shared/domain/srs.ts`: `getStageProgressRatio`, `getNextStageState`, `getFailStageState`, `applyQuizResultForDay`, `applyReviewResultForDay`
- `shared/domain/srsPreferences.ts`: `DEFAULT_MAX_REVIEW_STAGE`, `DEFAULT_FAILURE_RETRY_DAYS`, `MAX_FAILURE_RETRY_DAYS`, `SrsSettings`, `DEFAULT_SRS_SETTINGS`, `normalizeSrsSettings`
- `shared/domain/studyTypes.ts`: `QuizResult`, `LearningPath`, `SourceRef`, `StudyProblem`, `StudyItem`, `StudyDay`, `StudyUnit`, `StudyState`, `SessionPhase`, `SessionMode`, `SessionView`, `SetStudyState`, `SetSession`
- `shared/domain/textRepair.ts`: `repairMojibakeText`

## Native Interfaces
- `mobile/src/client.ts`: `CompanionClient` and `ApiError` implement serialized authentication, account checks and API errors; `accountDate` derives the account date from server time. The `AppKey`, `User`, `Clock`, `SessionStore` and fetch types define transport inputs.
- `mobile/src/study.ts`: `booksFromFiles` returns normalized books, `grade` returns PASS or FAIL, `progressPayload` returns an account-calendar SRS write, and `memoPayload` returns an original-address memo patch. Its public model types describe books, units, items and settings.
- Native screen modules accept the existing state and action callbacks and render their React Native views. `App` owns login, refresh and navigation. `LibraryScreen`, `LoginScreen`, `PasswordScreen`, `StudyScreen`, `SettingsScreen`, `StudyMarkdown`, and certificate-only `PracticeScreen` retain their current UI behavior.
- `mobile/src/navigation.ts` and `useMainReturn.ts`: `createMainReturn`, return-state types and `useMainReturn` preserve busy protection and unsaved-work confirmation before returning to the library.
- `mobile/src/ui.tsx`: shared view components and styles for the native screens.
- `mobile/app.config.js`: the product identity, package IDs and API origin. `scripts/expo.mjs` and `scripts/build-android.mjs` always select this product, so callers need no product argument.
- `mobile/plugins/with-short-cmake-path.cjs`: generated CMake staging stays under this product checkout rather than a parent platform folder.

## Example
- Input: A passing review on the same account date in the web and native clients.
- Steps: Both clients consume the same product scheduling implementation, and native normalization preserves the server item address.
- Expected result: The native payload keeps the existing stage, due date and account-bound identifiers.

## Hosted Static Server
- Input: Built web files, BASE_PATH, STATIC_DIR and a request URL.
- Output: Static responses, the existing health response and source-map denial.
- Code: `scripts/serve-static.mjs`, `Dockerfile`.
- Docker copies both client and shared source before the web compilation step. The native package remains outside the web dependency workspace.

## Continuous Checks
`.github/workflows/ci.yml` runs on product main pushes and pull requests. It installs the root and mobile lockfiles, checks both clients and runs native plus product parser or stage tests. The manual Android workflow remains separate. Platform CI validates its own API contracts without cloning this product.

## Quiz Scratch Memo
- Input: Text typed by the learner on a quiz question with choices.
- Output: Nothing persisted; the text exists only in component state.
- Code: `client/src/components/session/QuizPane.tsx` → `QuizMemo` rendered with `key={currentItem.id}`; `mobile/src/StudyScreen.tsx` → `QuizMemo` rendered with `key={item.key}` for the japanese app only; style `.jc-quiz-memo` in `client/src/ui/theme.css`.
- Steps: The keyed component remounts whenever the current item changes, so React discards the previous text.
- Scenario: Type a note on question 3, move to question 4 → the field is empty.
- Spec: [Quiz Scratch Memo](../../specs/app/10-product-clients.md#quiz-scratch-memo)
- All scenarios: [Quiz Scratch Memo Scenarios](../../testing/scenarios/app/10-product-clients.md#quiz-scratch-memo-scenarios)
