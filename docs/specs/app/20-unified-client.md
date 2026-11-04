# Unified Client

## Requirements
- Maintain one React Native screen implementation for web and Android, built with Expo and React Native Web.
- Preserve every hosted web feature: account details and sign out, learning plans, daily and review queues, Day search, progress, study, quizzes, scratch memo, word notes, question editing, JSON import, source-write retries, backup and preferences.
- Keep the existing package identity, original curriculum addresses, account-calendar calculations, server scheduling and API contracts.
- Browser sessions stay in API-origin cookies. Native credentials stay in the existing encrypted session store. Do not copy credentials between platforms.
- Keep the current hosted app available until feature parity is checked. Local study server behavior remains supported.
- Design: [Unified Client](../../design/app/20-unified-client.md)

## Example
- Input: A browser already signed in to another jace-s companion.
- Steps: Open the Japanese app, restore the API session, load app permission and account clock, then save a study result.
- Expected result: No second browser sign-in is needed, and the write includes the response CSRF token and original account ID.
