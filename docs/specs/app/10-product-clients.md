# Product Clients

## Requirements
- The japanese product can be cloned, installed and checked without the platform source tree or another product repository.
- Web and native clients use one maintained implementation of the product learning rules.
- Existing account API paths, app identity, calendar behavior and record addresses remain unchanged.
- No account files, credentials or private development notes are published.
- Native runtime UI remains React Native; the web runtime remains React DOM.
- Design: [Product Clients](../../design/app/10-product-clients.md).

## Example
- Input: A standalone product checkout with dependencies installed.
- Steps: Run web type checking, mobile type checking and native unit tests.
- Expected result: Checks resolve all product dependencies inside this checkout.
