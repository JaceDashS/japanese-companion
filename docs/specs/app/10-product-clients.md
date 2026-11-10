# Product Clients

## Requirements
- The japanese product can be cloned, installed and checked without the platform source tree or another product repository.
- Web and native clients use one maintained implementation of the product learning rules.
- Existing account API paths, app identity, calendar behavior and record addresses remain unchanged.
- No account files, credentials or private development notes are published.
- Native runtime UI remains React Native. The web and Android clients use the same approved [Unified Client](20-unified-client.md), using React Native Web.
- Design: [Product Clients](../../design/app/10-product-clients.md).

## Example
- Input: A standalone product checkout with dependencies installed.
- Steps: Run web type checking, mobile type checking and native unit tests.
- Expected result: Checks resolve all product dependencies inside this checkout.

## Quiz Scratch Memo
- Web and native quiz screens show one single-line text field between the question and the choices.
- The field is for temporary working notes only. Its text is never sent to the server, stored in the browser or device, or included in study results.
- Moving to another question shows an empty field; returning to an earlier question also starts empty.
- The field appears only for questions that have choices. It is separate from the saved word memo.
- Design: [Quiz Scratch Memo](../../design/app/10-product-clients.md#quiz-scratch-memo).

Example:
- Input: The learner types "て形" while answering question 3.
- Steps: Select a choice, grade, move to question 4.
- Expected result: Question 4 shows an empty memo field and no request contains "て形".

## Book Display Names
- Existing jlpt-one-book-n1 and jlpt-short-term books display n1 and n2 respectively. Preserve file-derived identifiers, item addresses and learning data.
- Example input: Existing jlpt-short-term progress. Steps: Reload the catalog with its new title. Expected result: The same book appears as n2 with records intact.

## Production Book Catalog
- Offer only the n1 and n2 production books. Remove the Dev 입력 테스트 source from the product catalog and default content tooling; retain existing account records.
- Example input: A saved selection still names dev. Steps: Reload the catalog without that test book. Expected result: Existing loadStudy fallback selects n1; remaining books and progress stay intact.
