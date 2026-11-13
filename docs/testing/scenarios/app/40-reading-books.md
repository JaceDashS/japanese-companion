# Reading Book Scenarios

- Spec: [Requirements](../../../specs/app/40-reading-books.md)
- Design: [Implementation](../../../design/app/40-reading-books.md)

## Registered And Unknown Words
- Input: Story with registered vocabulary, punctuation and an unregistered word.
- Steps: Open reader and select each word using pointer or keyboard.
- Expected result: Prose initially has no reading or meaning, punctuation remains intact, and every word activates details or an explicit missing-entry message.

## Shared Unique Note
- Input: The same word in two materials under account A and an independent account B.
- Steps: Save a note twice through A, reopen it from the other material, then read it as B.
- Expected result: A has one latest personal note; B cannot see it. Vocabulary and study progress are preserved.

## Material Types And Persistence
- Input: New material title and the book or vocabulary choice.
- Steps: Create, edit content, save, reload, select and open it.
- Expected result: Type persists; reading opens prose and vocabulary opens study. One short example is available for each language.

## Automated Coverage
- Platform scripts/test-english-companion.ts covers known and missing lookup, note upsert, case-insensitive identity, account isolation, type validation, payload limits, ownership, stable word IDs, CSRF and permission denial.
- Platform scripts/test-japanese-companion.ts covers known reading and meaning, missing lookup, one personal note shared across repeated words and material creation.
- Product domain and relatedWords test suites verify token text preservation and unknown word actions.

## Browser Verification
- Input: Real exported Japanese and English web bundles, a 1280x900 desktop and 390x844 mobile viewport, and an isolated test account and API database.
- Steps: Open 雨の日の手紙 or The Open Window, use pointer and Enter to open known and unknown words, save a note and reopen it, resize to mobile, then create an English reading book and vocabulary material and look up the new vocabulary from the story.
- Expected result: Annotations stay hidden in prose, saved notes return, unknown words have the explicit absent message, keyboard activation works, and mobile has no horizontal page overflow.
- Verification: Passed 2026-11-14 in headless Edge. Browser API requests were intercepted into the real API handlers with an isolated test session; no live account data was modified. Android launch was not tested.
