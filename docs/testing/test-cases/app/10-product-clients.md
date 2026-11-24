# Product Client Scenarios

- [Design](../../../design/app/10-product-clients.md)

## Standalone Checkout
- Input: A clone containing only this product repository, with root and mobile dependencies installed.
- Steps: Run web type checking, mobile type checking and native unit tests.
- Expected result: Shared learning rules resolve inside this checkout without a platform or sibling product tree.

## Stable Study Payload
- Input: The existing synthetic product curriculum and a server account date.
- Steps: Parse the curriculum, grade selected answers and create the progress or memo payload.
- Expected result: The original item address, stage transition and review date are preserved.
- Test: `mobile/tests/study.test.ts`.
- The unified screen identity case in that same test verifies duplicate display IDs remain independently addressable, source references are unchanged and repeated normalization is stable.

## Session And Main Return
- Input: A native session request or an unsaved native study screen.
- Steps: Run the existing transport and navigation regression tests.
- Expected result: Authentication serialization, account binding, busy guards and discard confirmation keep their current behavior.
- Tests: `mobile/tests/client.test.ts`, `mobile/tests/navigation.test.ts`.

## Migration Verification
- Input: Product checkout on 2026-11-04.
- Steps: Install root and native lockfiles independently, run web and native type checks, then native unit tests.
- Expected result: Both type checks pass and 9 native tests pass.
- Observed result: Passed before installing the repository into the platform services path. No APK, iOS build or physical device validation was performed for this source-layout change.
- Additional verification: `npm run test:stage-progression` passed all 8 existing cases using `shared/domain/` source. Test modules compile in memory and create no temporary files.

## Quiz Scratch Memo Scenarios
- Design: [Quiz Scratch Memo](../../../design/app/10-product-clients.md#quiz-scratch-memo)

### Memo Clears On Next Question
- Input: Quiz question with choices, the learner types a note.
- Steps: Grade the question and move to the next one.
- Expected result: The next question shows an empty memo field.
- Verified 2026-11-05: Common Expo web export in mocked Edge at 1280 and 360 px; scratch text is cleared after moving to the next question.

### Memo Is Never Saved
- Input: A note typed during a quiz session.
- Steps: Finish the session and save results, then reload.
- Expected result: No request body, browser storage or device storage contains the note; the reloaded quiz shows an empty field.
- Verified 2026-11-05: Mocked Edge save requests exclude the scratch sentinel. Native storage/runtime and reloaded-question behavior remain separate checks.

### Memo Only With Choices
- Input: A question without choices, or the certificate app.
- Steps: Open the question.
- Expected result: No memo field is shown.

## Book Display Names
- Input: Both original combined files and their renamed versions.
- Steps: Parse all fields, replace the expected meta.title only and compare entire resulting documents.
- Expected result: jlpt-one-book-n1 displays n1 and jlpt-short-term displays n2; every other field and identity is preserved.
- Verified 2026-11-10: Exact parsed-document comparisons passed for both product assets and the two platform hosted copies.

## Production Book Catalog
- Input: The source directory after removing the development book, and a previously selected dev book ID.
- Steps: Enumerate remaining combined JSON files, read the actual catalog and inspect existing loadStudy fallback and default content-tool filenames.
- Expected result: Exactly n1 and n2 with original IDs, no default tool reference to the removed file, and reload falls back to n1 without deleting account data.
- Verification: Actual catalog enumeration and syntax checks for all four modified content tools; no repair command is executed.
