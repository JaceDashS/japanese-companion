# Japanese Companion

One Expo React Native screen codebase for web and Android. Screens live in `mobile/src/unified/`; learning rules and controllers live in `shared/`. The platform owns authentication and account records.

- [Documentation](docs/00-index.md)
- Install: `npm ci` and `npm ci --prefix mobile`
- Web development: `npm run dev`; web export: `npm run build`
- Check common code: `npm run typecheck` and `npm test`
- Android JavaScript: `npm run export:android`; APK: `npm run build:android`
- [Development and API settings](docs/guides/10-development.md)

Local web uses the same platform API as hosted web by default. Configure a compatible development API for isolated account writes. Original curriculum and standalone content server tooling remain preserved without a second UI.

Example: Change a common question screen, build web and Android, and both outputs include the same change. No sibling product repository is required.
