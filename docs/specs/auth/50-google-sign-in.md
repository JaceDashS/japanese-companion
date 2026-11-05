# Google Sign In

## Entry Behavior
- Direct unauthenticated browser entry shows Google in the existing common App gate login dialog, alongside password login.
- Main site app-list clicks retain the platform login-before-launch behavior.
- Successful Google login uses the existing account identity and session, then the existing app access guard. It does not navigate away from the original app URL or reset saved study records.
- Google-disabled deployments hide the button. Cancellation keeps the dialog usable. Failures show retry guidance; retries obtain a fresh nonce. Never store or display the Google credential.
- The shared remember selection applies to Google and password login. Concurrent submissions are blocked. Late callbacks after unmount must not initiate another login.
- Installed native app login is outside this browser-only change.
- Design: [Google Sign In](../../design/auth/50-google-sign-in.md).

## Example
- Input: A signed-out visitor opens this product URL directly.
- Steps: common App gate shows its dialog, Google authentication succeeds, and the existing access guard checks the account.
- Expected result: The visitor continues in this product with existing saved records, or receives the existing permission-denied screen.
