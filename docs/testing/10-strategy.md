# Test Strategy

## Checks
- Install root and mobile dependencies independently using their lockfiles.
- Run `npm run typecheck`, `npm run typecheck:mobile`, and `npm run test:mobile`.
- Reuse the native client, navigation and product study regression tests under `mobile/tests/`.
- A standalone clone is required to check that no sibling product or platform source is read.
- Type checking and unit tests do not demonstrate a physical Android launch, production HTTPS login or a signed release. Run separate device checks when changing runtime behavior.

## Example
- Input: A product checkout without its sibling repository.
- Steps: Install dependencies, run both type checks and native unit tests.
- Expected result: No missing source or cross-product import is reported.

- [Scenarios](scenarios/app/10-product-clients.md)

## CI Ownership
The product CI runs the checks above without a platform checkout. Actual product-API integration remains an optional test in the platform repository and is run separately for each product transport.

## Hosted Google Checks
Run npm run test:google-auth for browser transport contracts. Separate mocked Edge checks exercise the HostedGate dialog and official-button callback integration; real Google and production sessions require interactive verification. Mocked Edge checks also render HostedGate with AccountCard to cover account details, rejected sign out and successful sign out with the CSRF header.
