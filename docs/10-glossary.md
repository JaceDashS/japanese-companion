# Glossary

## Product
An independently versioned study application, containing a web client and a native mobile client.

## Shared Learning Rules
The TypeScript source in `shared/` plus the existing product controllers in `shared/controllers/domain/` reused by the common Expo screen tree. Generated adapters bind platform API, storage and account date boundaries rather than duplicating scheduling or grading.

## Platform
The separate repository that provides account authentication, access checks, user records and the main site pages.

## Example
- Input: A learner completes a review in the mobile client.
- Steps: Shared rules calculate the payload; the platform API authenticates and saves it.
- Expected result: The account record is updated without modifying the curriculum source.

## Browser Google Sign In
The official GIS button exchanging a nonce-bound Google credential for the existing platform account session. Used only by the hosted browser login dialog in this change. Code: GoogleButton, CompanionClient.googleConfig, CompanionClient.googleChallenge, CompanionClient.googleLogin.

## Quiz Scratch Memo
- Definition: A one-line, never-saved text field on a quiz question that resets when the question changes
- Code: `QuizMemo`, `mobile/src/unified/SessionScreen.tsx`
- Avoid: "memo" alone, which refers to the saved word memo (`memoPayload`)

## Account Card
- Definition: The settings card that shows the signed-in platform account and signs out of the shared session
- Code: common Expo `SettingsScreen`, `CompanionClient.account`, `CompanionClient.logout`
- Avoid: "My Page", which is the main site page where profile changes happen

## Source Identity
- Definition: A session item key derived from the original source file, unit path, Day index and item index. It distinguishes items with the same display ID.
- Code: `identifyStudyState`, `displayItemId`, `StudyItem.sourceRef`
- Avoid: Treating the displayed item ID as a unique persistence address.

## Native Google Challenge

A one-use server nonce bound to the Android Google account picker token. Code: nativeGoogleChallenge, nativeGoogleLogin and signInWithNativeGoogle. Separate from the browser cookie challenge.

## Desktop Layout
- Definition: The wide composition with desktop navigation and dashboard columns, automatically enabled at width 1024 and short side 600 logical pixels or above. Existing explicit PC preferences override auto.
- Code: `isDesktopLayout`. Logical pixels are layout units, not physical display pixels.

## Reading Book
- Definition: Prose material read without a required quiz; every word can open its study dictionary and personal note.
- Code: LibraryBook kind book, ReadingLibrary, ReaderText.

## Vocabulary Material
- Definition: A collection of words used by the existing study and quiz screens.
- Code: LibraryBook kind vocabulary; existing Japanese personal textbooks.

## Personal Word Note
- Definition: One account-owned note shared by all occurrences of the same word within a language.
- Code: Japanese japanese_memos, English reading library notes.
