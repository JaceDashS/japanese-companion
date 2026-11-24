# Unified Client Scenarios

- Design: [Unified Client](../../../design/app/20-unified-client.md)

## Restore Browser Session
- Input: An existing API cookie session, no native credential store entry.
- Steps: Restore the session, read the account card data, save a result.
- Expected result: Browser requests use credentials include, no explicit Cookie header or stored cookie value, and writes include response CSRF and the account ID.
- Test: `mobile/tests/client.test.ts` browser restores the shared session and sends response CSRF without exposing cookies.

## Preserve Source Write Failures
- Input: A current-account source write receiving 503; a stale-account write; a URL outside the product API prefix.
- Steps: Send each through the source-controller fetch adapter.
- Expected result: The first preserves status 503 for retries. The stale write returns 403 without sending it. Untrusted URLs are rejected without a network call.
- Test: `mobile/tests/client.test.ts` source controller transport preserves HTTP failures and account binding.

## Browser Google Exchange
- Input: Synthetic Google configuration, one-use nonce and credential exchange response.
- Steps: Read configuration, obtain challenge, exchange credential, sign out.
- Expected result: Sign out uses the CSRF token returned by the exchange. This verifies transport behavior rather than actual Google authentication.
- Test: `mobile/tests/client.test.ts` browser Google session keeps the token returned by the exchange.

## Common Screen Walkthrough
- Input: Two synthetic Japanese questions, a Google-only account, and mocked API responses at 1280 and 360 px.
- Steps: Open settings, read account data, change theme, study, switch to quiz, answer wrong then correctly, finish, inspect source-addressed saves, open progress, fail sign out once, then sign out successfully.
- Expected result: Account fields and theme render without horizontal overflow, grading uses the original rules, all writes carry account identity and CSRF, progress renders, failed sign out preserves the account and successful sign out returns to login.
- Observed 2026-11-05: Passed both widths using the common Expo web export in Edge. This is synthetic API evidence, not production or real Google sign-in verification.

## Native Queue Persistence
- Input: Two queued writes for account A, the first marked failed; an independent account B; unavailable or corrupt storage.
- Steps: Recreate the queue storage, read records, remove one, and attempt writes with unavailable storage.
- Expected result: Order, IDs and failure state survive recreation, B sees no A records, live records survive a write failure and persistence is reported unavailable. Corrupt saved bytes are not overwritten.
- Test: `mobile/tests/study.test.ts` native queue snapshots restore order and failures without crossing account stores.

## Day Import And Editing
- Input: Existing decomposition and question content plus a second Day with empty fields.
- Steps: Import matching JSON, edit a personal note, edit a question through form/JSON, and return to the Day list.
- Expected result: Existing content stays intact during import, empty fields receive the new values, validation blocks malformed questions, and saves retain original source positions.
- Observed 2026-11-05: Passed at 360 px in mocked Edge, including existing-field protection, empty decomposition/question import, invalid JSON rejection and valid question edits. A question with no choices has no scratch memo; adding a question through import creates the field.

## Source Queue Recovery
- Input: A source write receiving 422, followed by a successful retry after browser reload.
- Steps: Edit a note, inspect the failed queue entry in settings, reload, then press retry.
- Expected result: The failed record survives reload; explicit retry sends the original account-bound write and removes the successful entry.
- Observed 2026-11-05: Passed at 360 px in mocked Edge. The 422 record survived reload, retry sent the original account header and cleared the queue on success.

## Hosted Container
- Input: The common Expo Dockerfile, API origin `https://api.jace-s.com`, notice app ID 42 and a Linux Docker engine.
- Steps: Build a separate image, run an isolated read-only container without an external network or data mounts, fetch health, HTML, JavaScript and a source-map path from its loopback interface.
- Expected result: Health, HTML and JavaScript return 200, the source-map path returns 404, and the bundle contains the configured API origin and common quiz screen.
- Observed 2026-11-05: Passed with image `1f547f971b9e` on Linux. Source Dockerfile, lockfile and common root hashes matched the development machine. Production containers were not replaced in this check.

## Android Artifact
- Input: JDK 17.0.18, Android SDK, common Expo entry and both arm64-v8a and x86_64 targets.
- Steps: Build the release APK, inspect badging and verify its signing certificate.
- Expected result: Existing package identity `com.jaces.japanesecompanion` is preserved, both ABIs are included and the APK signature verifies.
- Observed 2026-11-05: Gradle 9.4.1 completed successfully. APK version 0.1.0 code 1, min SDK 24, target SDK 36, size 41,822,599 bytes, SHA256 `5fb71bbb64d695e3da3ff9502410519cd269d3b0279af17223b54002dbe6fbab`, verified Android Debug certificate. This is a local installation artifact; no device launch, live login or store-signing verification is claimed.

## Single Source Builds
- Input: A checkout with the obsolete DOM screen tree removed, shared controllers and the common Expo entry.
- Steps: Run the root web build, Android JavaScript export, type check and the existing account/queue/study tests.
- Expected result: Both outputs resolve the same screens and shared source; no build reads the removed client directory. Existing payloads, grading and retry semantics remain unchanged.
- Tests: `mobile/tests/study.test.ts`, `mobile/tests/client.test.ts`, `mobile/tests/navigation.test.ts` and the web/Android exports.

## Development API Isolation
- Input: An explicit browser development origin, a mismatched HTTP origin and a native client.
- Steps: Construct the common client in each mode and build a web export with the development prefix.
- Expected result: Only the matching explicitly configured browser origin can use HTTP. Production defaults and native validation remain unchanged; prefixed assets stay under the companion route.
- Test: `mobile/tests/client.test.ts` explicit browser development origin remains isolated from native and other HTTP origins.

## Cleanup Verification 2026 11 05
- Input: The common source after removing obsolete DOM/native screens and updating root commands.
- Steps: Run root type checking, 15 common transport/navigation/study tests, hosted web and Android JavaScript exports, prefixed development web export, and mocked Chrome at 1280 and 360 px.
- Observed result: Checks passed. Both browser widths restored a synthetic account, showed account details, signed out and had no horizontal overflow or runtime exceptions. Development builds made only same-origin account/notice requests. Certificate study images remained served after moving them to Expo public assets.
- Boundary: Synthetic browser responses do not prove real Google authentication, production deployment, APK launch or physical-device behavior. Docker Engine was unavailable; Compose configuration validation passed but the Linux stack was not run.

## Failed Day Review
- Input: A stage 3 Day with one correct and one incorrect answer on 2026-11-10, using default retry settings.
- Steps: Apply the shared Day result, persist the schedule and results, then build the daily review queue on 2026-11-11.
- Expected result: Stage becomes 2, next review is 2026-11-11, and incorrect questions appear first when that Day opens. Stage never falls below 1. Custom retry intervals remain respected.
- The result screen displays only `2개 중 1개 정답`, without completion or perfect score labels. Immediate retries are not added.
- Code: `shared/domain/srs.ts`, `shared/controllers/domain/homeDashboardBuilders.ts`, `shared/controllers/domain/sessionOpeners.ts`, `mobile/src/unified/SessionScreen.tsx`.
- Test: `mobile/tests/study.test.ts` tests failed review scheduling, next day queue inclusion and failed question ordering; `scripts/test-stage-progression.cjs` covers promotion and configured retry intervals.
