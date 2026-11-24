# Data Flow

The unified Expo screen combines textbook content with the current account records received through the platform client. Shared controllers handle study interactions and submit changes through the account-scoped queue.

```mermaid
flowchart LR
    A[Unified screen] --> B[Shared study controller]
    B[Shared study controller] --> C[Authenticated client]
    C[Authenticated client] --> D[Platform textbook and account API]
```

See [Architecture Overview](10-overview.md).
