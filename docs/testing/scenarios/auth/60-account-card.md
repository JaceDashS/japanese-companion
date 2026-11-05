# Account Card

## Account Card Scenarios
- Design: [Account Card](../../../design/auth/60-account-card.md#account-card-component)

### Google Only Account Details
- Input: Signed-in Google-only account with name, verified email, join date and last sign-in.
- Steps: Open the settings view at 1280 px and 360 px.
- Expected result: All six rows show, the email shows its verified state, the method is Google only, the My Page link points to `https://jace-s.com/#my-page`, and there is no horizontal scroll.

### Password Account Details
- Input: Session response with `hasLocalPassword` true.
- Steps: Open the settings view.
- Expected result: The method shows username and password.

### Rejected Sign Out
- Input: The logout request returns 500.
- Steps: Press sign out.
- Expected result: The app stays open and a retry message appears.

### Successful Sign Out
- Input: The logout request returns 204.
- Steps: Press sign out.
- Expected result: The request carries the session CSRF header, the account screen unmounts and login appears and the login dialog is shown.
