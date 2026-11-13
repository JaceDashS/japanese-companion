# Reading Books

- Design: [Implementation](../../design/app/40-reading-books.md)
- Scenarios: [Cases](../../testing/scenarios/app/40-reading-books.md)

## Requirements
- Distinguish reading books from vocabulary textbooks when adding materials. Existing study textbooks remain vocabulary textbooks.
- Reading books contain prose, not mandatory quizzes. Each language has one short original example.
- Every word opens a lookup, including words not registered in study content. Missing data displays 등록된 단어가 없습니다. Network errors have a separate retryable error.
- Reading and meaning are hidden in prose by default; selecting a word reveals its saved study data and personal note. No external dictionary is queried.
- One personal note exists per account, language and word. Repeated writes update it across vocabulary occurrences and reading books.
- Personal books and English notes survive reload and stay isolated between accounts.

## Example
- Input: A story containing a registered word and an unknown word.
- Steps: Open the story, select each word, edit the registered word note and reopen it.
- Expected result: Unannotated prose initially; registered details and the saved note, or an explicit missing-word message.
