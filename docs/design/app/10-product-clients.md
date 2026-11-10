# Product Clients Design

## Shared Learning Source
- Input: Curriculum file map, saved state, settings and an authenticated account date.
- Output: Parsed study units, grades and stable server payloads.
- Code: `shared/domain/`, `shared/data/` when present, `shared/controllers/domain/`, `mobile/src/study.ts`.
- Shared controllers are maintained under `shared/controllers/`; platform bindings provide the authenticated calendar, API and storage.
- `mobile/scripts/prepare-domain.mjs` transpiles the product allowlist, normalizes relative JavaScript imports and rejects browser runtime dependencies. Generation is required before native type checks, tests and bundling.
- The native study adapter normalizes only this product's curriculum and creates the same API payload as before. Generic mobile UI and transport are owned by each product copy; changes shared between products must be applied and tested in both repositories.
- Spec: [Product Clients](../../specs/app/10-product-clients.md)
- Architecture: [Overview](../../architecture/10-overview.md)
- Scenarios: [Product Clients](../../testing/scenarios/app/10-product-clients.md)

## Public Modules
The shared modules expose the following identifiers. Generated adapters preserve the existing controller contracts for both web and Android. Scheduling helpers consume a YYYY-MM-DD date and preserve existing stage and retry calculations; parsers preserve original item addresses and order; public types define the same curriculum and session models.

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
- `mobile/src/client.ts`: `CompanionClient` and `ApiError` implement serialized authentication, account checks and API errors; `accountDate` derives the account date from server time. The `AppKey`, `User`, `Clock`, `SessionStore` and fetch types define transport inputs. The new [Unified Client](20-unified-client.md#platform-session) adds browser cookie mode, account details, Google exchange and a source-controller fetch adapter while retaining the default native mode.
- `mobile/src/study.ts`: `booksFromFiles` returns normalized books, `grade` returns PASS or FAIL, `progressPayload` returns an account-calendar SRS write, and `memoPayload` returns an original-address memo patch. Its public model types describe books, units, items and settings.
- `mobile/src/unified/App.tsx` owns the shared screen lifecycle. Shared screens, `LoginScreen`, `PasswordScreen` and `StudyMarkdown` serve web and Android; the superseded standalone native screens are removed.
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
- Docker copies `mobile/` and `shared/`, installs the mobile lockfile and exports the same screen tree for web.
- Hosted Docker uses the common Expo web entry. Local commands use that same entry and platform API; standalone content server tooling is retained without a second UI. See [Hosted Packaging](20-unified-client.md#hosted-packaging).

## Continuous Checks
`.github/workflows/ci.yml` runs on product main pushes and pull requests. It installs the root and mobile lockfiles, checks both clients and runs native plus product parser or stage tests. The manual Android workflow remains separate. Platform CI validates its own API contracts without cloning this product.

## Quiz Scratch Memo
- Input: Text typed by the learner on a quiz question with choices.
- Output: Nothing persisted; the text exists only in component state.
- Code: `mobile/src/unified/SessionScreen.tsx` renders the keyed `QuizMemo` for Japanese quiz questions on both platforms.
- Steps: The keyed component remounts whenever the current item changes, so React discards the previous text.
- Scenario: Type a note on question 3, move to question 4 → the field is empty.
- Spec: [Quiz Scratch Memo](../../specs/app/10-product-clients.md#quiz-scratch-memo)
- All scenarios: [Quiz Scratch Memo Scenarios](../../testing/scenarios/app/10-product-clients.md#quiz-scratch-memo-scenarios)

## Book Display Names
- Input: asset/jlpt-one-book-n1.json and asset/jlpt-short-term.json combined metadata.
- Output: Titles n1 and n2 from getAvailableBooks in shared/data/initialState.ts, re-exported through shared/controllers/domain/curriculumFiles.ts.
- Only meta.title changes; filenames, levels, Unit and item data remain unchanged. Hosted source has matching metadata in the platform repository.
- Example input: Existing jlpt-one-book-n1 account state. Steps: Read renamed metadata. Expected result: n1 is displayed without changing its state key.
- Scenarios: [Book Display Names](../../testing/scenarios/app/10-product-clients.md#book-display-names).

## Production Book Catalog
- Input: The remaining asset/jlpt-one-book-n1.json and asset/jlpt-short-term.json combined sources.
- Output: Only n1 and n2 from the existing catalog reader; no test-book source is bundled or listed.
- Code: scripts/audit-missing-problems.cjs, scripts/audit-fix-problem-answers.cjs, scripts/audit-duplicate-problem-answers.cjs and scripts/repair-kanji-decomposition-problems.cjs default only to those two files after removing the retired source. Audit and repair behavior is otherwise unchanged.
- mobile/src/unified/useStudyModel.ts loadStudy already falls back to n1 if a remembered selectedBookId is absent from the new catalog. No account record is deleted or rewritten for removal.
- Example input: Run a default content audit after removing the test source. Steps: Resolve its default filenames. Expected result: Both production sources exist and the removed test file is never opened.
- Scenarios: [Production Book Catalog](../../testing/scenarios/app/10-product-clients.md#production-book-catalog).
