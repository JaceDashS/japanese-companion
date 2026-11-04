# Account Card

## Account Details
- When the app runs with the site login (hosted mode), the top of the settings view shows an account card. Local mode has no site login and shows no card.
- The card shows the name, username, email with its verification state, sign-in method (username and password, or Google only), join date and last sign-in, with Korean labels.
- Missing values show "none". Name, email and password changes stay on the main site My Page, linked from the card.
- Design: [Account Card](../../design/auth/60-account-card.md#account-card-component)

## Sign Out
- The card's sign-out button ends the platform session. The session cookie belongs to the API origin, so the other jace-s apps and the main site in the same browser are signed out too.
- After a successful sign out the page reloads and starts at the login dialog, so no study state of the previous account stays in memory.
- A rejected sign out keeps the user signed in and shows a retry message; the app never pretends the session ended.

## Example
- Input: A Google-only account opens the settings view and presses sign out.
- Steps: The card shows "Google 전용", the sign-out request carries the session CSRF token, then the page reloads.
- Expected result: The login dialog appears, and the main site in the same browser is also signed out.
