# Independent Development

## Setup
Install root tools with `npm ci` and common Expo dependencies with `npm ci --prefix mobile`. Root tools do not contain a second React DOM UI. Both lockfiles belong to this product.

## Commands
- `npm run dev` or `npm run dev:client`: Start Expo web from `mobile/unified.ts`.
- `npm start --prefix mobile`: Start the same Expo project for device development.
- `npm run build` or `npm run export:web`: Export common screens to `mobile/dist/web`.
- `npm run preview`: Serve the export on loopback port 47832; set `PORT` to choose another port.
- `npm run local`: Build and preview the same Expo export. `local:no-build` reuses the existing export.
- `npm run typecheck`, `npm test`: Prepare shared sources and check the common code.
- `npm run export:android`: Bundle the same entry for Android.
- `npm run build:android`: Build the APK with the existing Android SDK and JDK 17 tooling.
- `npm run dev:server`: Optional standalone content server tooling. It has no separate UI; it does not implement platform account login.

## API Settings
Local web uses platform authentication, account records and curriculum, exactly like hosted web. Set `EXPO_PUBLIC_JPC_API_ORIGIN` to a compatible development platform API before starting/exporting if isolated data is required. The default is `https://api.jace-s.com`; local UI changes do not imply isolated account writes. The standalone content server is not a substitute for this API.

## Source Ownership
Maintain screens only in `mobile/src/unified/` and common login/Markdown components. Maintain controllers in `shared/controllers/`, and grading/parsing in `shared/domain/` and `shared/data/` where present. Generated adapters are disposable build output, not editable source. Platform-specific session, storage, keyboard and Google rendering adapters remain separate.

## Packaging
Hosted Docker and local commands use the same web export; Android uses the same `mobile/unified.ts` entry. APKs use the existing package identity. Current local release builds use the debug signing key, so store signing and physical-device behavior require separate checks.

## Integration
Commit and publish product changes independently before updating a platform submodule reference. Do not import sibling product sources. The platform owns account APIs and records; original curriculum and server tooling are preserved.

## Example
- Input: Change a question label in `mobile/src/unified/SessionScreen.tsx`.
- Steps: Run `npm run build` and `npm run export:android`.
- Expected result: Both outputs use the same modified screen without an alternate DOM build.
- Design: [Unified Client](../design/app/20-unified-client.md)

## Shared Development Build
The platform shared-development stack explicitly sets `EXPO_PUBLIC_COMPANION_LOCAL_API=1` and `EXPO_PUBLIC_BASE_PATH`. This selects only the current browser origin and prefixes web resource URLs. Ordinary local commands retain the configured HTTPS API default. Companion polling exports require browser refresh after completion; main-site HMR is separate.
