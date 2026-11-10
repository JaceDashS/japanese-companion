# Unified Client

## Requirements
- Maintain one React Native screen implementation for web and Android, built with Expo and React Native Web.
- Preserve every hosted web feature: account details and sign out, learning plans, daily and review queues, Day search, progress, study, quizzes, scratch memo, word notes, question editing, JSON import, source-write retries, backup and preferences.
- Keep the existing package identity, original curriculum addresses, account-calendar calculations, server scheduling and API contracts.
- Browser sessions stay in API-origin cookies. Native credentials stay in the existing encrypted session store. Do not copy credentials between platforms.
- Keep the current hosted app available until feature parity is checked. Local web uses the same Expo screens and platform API; the standalone content server is preserved as tooling, without a separate UI.
- Design: [Unified Client](../../design/app/20-unified-client.md)

## Example
- Input: A browser already signed in to another jace-s companion.
- Steps: Open the Japanese app, restore the API session, load app permission and account clock, then save a study result.
- Expected result: No second browser sign-in is needed, and the write includes the response CSRF token and original account ID.

## Failed Day Review
- Input: A stage 3 Day with one correct and one incorrect answer on 2026-11-10, using default retry settings.
- Steps: Apply the shared Day result, persist the schedule and results, then build the daily review queue on 2026-11-11.
- Expected result: Stage becomes 2, next review is 2026-11-11, and incorrect questions appear first when that Day opens. Stage never falls below 1. Custom retry intervals remain respected.
- The result screen displays only `2개 중 1개 정답`, without completion or perfect score labels. Immediate retries are not added.
- Code: `shared/domain/srs.ts`, `shared/controllers/domain/homeDashboardBuilders.ts`, `shared/controllers/domain/sessionOpeners.ts`, `mobile/src/unified/SessionScreen.tsx`.
- Test: `mobile/tests/study.test.ts` tests failed review scheduling, next day queue inclusion and failed question ordering; `scripts/test-stage-progression.cjs` covers promotion and configured retry intervals.
