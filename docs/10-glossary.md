# Glossary

## Product
An independently versioned study application, containing a web client and a native mobile client.

## Shared Learning Rules
The TypeScript source in `shared/` used by web adapters and transpiled for native consumption. It includes curriculum parsing, scheduling and product-specific grading helpers.

## Platform
The separate repository that provides account authentication, access checks, user records and the main site pages.

## Example
- Input: A learner completes a review in the mobile client.
- Steps: Shared rules calculate the payload; the platform API authenticates and saves it.
- Expected result: The account record is updated without modifying the curriculum source.

## Browser Google Sign In
The official GIS button exchanging a nonce-bound Google credential for the existing platform account session. Used only by the hosted browser login dialog in this change. Code: GoogleSignIn, createHostedGoogleAuth, hostedGoogleAuth.

## Quiz Scratch Memo
- Definition: A one-line, never-saved text field on a quiz question that resets when the question changes
- Code: `QuizMemo`, `.jc-quiz-memo`
- Avoid: "memo" alone, which refers to the saved word memo (`memoPayload`)
