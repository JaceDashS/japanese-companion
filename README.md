# Japanese Companion

Product repository for the web study client and native mobile app. Shared learning rules live in `shared/`. The hosted web and mobile clients use the platform API at `https://api.jace-s.com`; platform pages, authentication services and account records remain in the platform repository.

- [Documentation](docs/00-index.md)
- Web dependencies: `npm ci`; type check: `npm run typecheck`
- Mobile dependencies: `npm ci --prefix mobile`; type check: `npm run typecheck:mobile`; tests: `npm run test:mobile`
- Android package: `npm run build:android` after configuring Java and the Android SDK

Example: clone this repository on its own, install the web and mobile dependencies, then run both type checks. Neither command needs a sibling product repository. The optional local `server/` and curriculum assets are preserved; hosted account storage remains in the platform API.
