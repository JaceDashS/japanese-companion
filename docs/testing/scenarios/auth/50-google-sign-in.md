# Google Sign In Scenarios

- Design: [Google Sign In](../../../design/auth/50-google-sign-in.md).

## Direct Browser Entry
- Input: Direct product URL with no account session and Google enabled.
- Steps: Show the existing login dialog, render the official Google button, exchange the returned credential, then check app permission.
- Expected result: The app URL is preserved and the existing account curriculum opens.

## Disabled Configuration
- Input: Google config reports enabled false.
- Steps: Mount the login dialog and read runtime config.
- Expected result: No Google button or misleading error; password login remains available.

## Credential Retry
- Input: A failed credential exchange or a script/challenge error.
- Steps: Show safe error guidance and select retry.
- Expected result: Obtain a fresh challenge and render a new official button. No credential or provider internals are displayed.

## Session Writes
- Input: Successful Google response with user and csrfToken, with remember enabled or disabled.
- Steps: Cache the response CSRF token, continue the app access check, and perform a subsequent authenticated request.
- Expected result: Remember is included in the exchange and the later request can use the issued CSRF token despite the API host-only cookie.
- Test: `client/tests/google-auth.test.ts`.

## Main Site Launch
- Input: Signed-out user clicks this app from the platform app list.
- Steps: Existing platform launch guard opens the platform login card before app navigation.
- Expected result: Product Google support does not bypass the platform login flow.

## Stale And Duplicate Callbacks
- Input: A callback from a previous nonce attempt or two credential callbacks for one active attempt.
- Steps: Retry after a conflict, invoke the earlier callback, then invoke the current callback twice.
- Expected result: The stale callback sends no request and the active attempt sends one exchange only.

## Permission And Password Compatibility
- Input: Google disabled with a valid password login, or Google success for an account without app permission.
- Steps: Complete the existing password login; separately complete Google login with app access denied.
- Expected result: Password login still opens the app, while the Google account receives the existing permission-denied screen without navigation.

## Local Verification
- Verified 2026-11-05: Web type checking and four hosted Google transport tests passed. The existing native transport and UI were not changed.
- Edge at 360px passed direct entry, conflict guidance, fresh-nonce retry, stale and duplicate callback suppression, remember selection, original URL preservation, password fallback and permission denial using a mocked GIS script and API.
- These local browser checks do not prove a real Google account login or production deployment.
