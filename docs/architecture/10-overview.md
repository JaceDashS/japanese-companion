# Product Architecture

## Modules
- `mobile/src/unified/` is the only maintained screen tree for local web, hosted web and Android.
- `mobile/unified.ts` registers that tree; `mobile/index.ts` delegates to the same entry.
- `mobile/src/` also owns session transport, login, Markdown, navigation and shared primitives. Obsolete standalone native screens are removed.
- `shared/domain/` and `shared/data/` own curriculum parsing, grading and scheduling. `shared/controllers/` owns reused study controllers and account-scoped queues.
- `mobile/scripts/prepare-domain.mjs` and `prepare-unified.mjs` generate disposable Expo modules from those sources. API, date and storage contracts bind to the common authenticated runtime. Generated files are build output, never a second maintained implementation.
- `server/` and curriculum assets remain independent content tooling. Local UI uses the platform API just like hosted web; there is no separate DOM or standalone-server UI.
- Root tools and mobile dependencies retain independent lockfiles. Product code must not import sibling products.

```mermaid
flowchart LR
 S["Shared rules and controllers"] --> E["Common Expo screens"]
 E --> W["Local and hosted web"]
 E --> N["Android"]
 W --> A["Platform API"]
 N --> A
```

## Example
- Input: A question text label changes in the common screen.
- Steps: Build web and Android from the product checkout.
- Expected result: Both outputs contain the same updated screen and use the existing account-bound API.
- Design: [Unified Client](../design/app/20-unified-client.md)
- Product rules: [Product Clients](../design/app/10-product-clients.md)
