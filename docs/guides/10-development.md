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
- Common Expo web build: `npm run export:web --prefix mobile` writes `mobile/dist/web`. The current local study server retains its React DOM client until its own entry is changed.
- Common Android and web entry: `mobile/unified.ts`. Domain preparation includes the maintained web controllers and fails on unexpected browser runtime dependencies. Generated modules are disposable; do not edit them.
- Windows APK builds use JDK 17 and `ANDROID_HOME` pointing to the Android SDK. CMake staging is shortened for application and library projects. The generated release variant currently uses the Android debug key for local installation.

## Integration
The platform pins a product commit through a submodule. Push the product commit first, then commit the updated submodule reference in the platform. Do not expect a platform push to publish product source. Hosted pages use the platform API; the local server is retained for the existing local study mode.

## Example
- Input: A changed mobile study screen.
- Steps: Check and commit it in the product repository; push it; update the platform submodule reference.
- Expected result: The platform checkout reproducibly selects that exact product revision.
