# Google Sign In

## Entry Behavior
- Direct unauthenticated browser entry shows Google in the existing common App gate login dialog, alongside password login.
- Main site app-list clicks retain the platform login-before-launch behavior.
- Successful Google login uses the existing account identity and session, then the existing app access guard. It does not navigate away from the original app URL or reset saved study records.
- Google-disabled deployments hide the button. Cancellation keeps the dialog usable. Failures show retry guidance; retries obtain a fresh nonce. Never store or display the Google credential.
- The shared remember selection applies to Google and password login. Concurrent submissions are blocked. Late callbacks after unmount must not initiate another login.
- Android sign in uses the separate native account picker contract below; browser GIS remains the web implementation.
- Design: [Google Sign In](../../design/auth/50-google-sign-in.md).

## Example
- Input: A signed-out visitor opens this product URL directly.
- Steps: common App gate shows its dialog, Google authentication succeeds, and the existing access guard checks the account.
- Expected result: The visitor continues in this product with existing saved records, or receives the existing permission-denied screen.

## Android Google Account Picker

Android login must use the official Google account picker and the same account/session as web login. Cancellation creates no session; retry obtains a fresh native challenge. Browser GIS authentication stays separate. APK packaging and physical picker validation are deferred until mobile web testing is complete.

Example input: User cancels the Android picker. Steps: Open login, choose Google, cancel. Expected result: Login remains available without a credential exchange.

- Design: [Companion authentication](../../design/auth/50-google-sign-in.md#native-google-implementation)
