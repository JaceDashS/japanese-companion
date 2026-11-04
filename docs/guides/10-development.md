# Independent Development

## Checkout
Clone this product repository directly, or initialize it through the platform submodule checkout. Install web dependencies with `npm ci` at the product root and native dependencies with `npm ci --prefix mobile`. Mobile is intentionally not included in the root npm workspaces because it uses a different React runtime.

## Commands
- Web type check: `npm run typecheck`
- Native type check: `npm run typecheck:mobile`
- Native unit tests: `npm run test:mobile`
- Web dev server: `npm run dev:client`
- Native dev server: `npm start --prefix mobile`
- Native Android build: `npm run build:android` after installing the required Android SDK and Java.

## Integration
The platform pins a product commit through a submodule. Push the product commit first, then commit the updated submodule reference in the platform. Do not expect a platform push to publish product source. Hosted pages use the platform API; the local server is retained for the existing local study mode.

## Example
- Input: A changed mobile study screen.
- Steps: Check and commit it in the product repository; push it; update the platform submodule reference.
- Expected result: The platform checkout reproducibly selects that exact product revision.
