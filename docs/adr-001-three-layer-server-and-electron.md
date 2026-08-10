# ADR-001: Three-layer server architecture and Electron readiness

- Status: Accepted
- Date: 2026-08-08
- Updated: 2026-08-10
- Scope: `packages/server`, its shared contracts, and future Electron integration

## Context

Skladno is a local-first editorial workspace. The server owns HTTP transport,
application orchestration, persistence, configuration, and AI-engine
construction, while the renderer must remain isolated from credentials,
SQLite, and the filesystem. Electron is a future runtime, not a reason to
expose Electron APIs or provider SDKs to application code.

The server refactor is incremental. The repository has introduced application
ports and focused application services while preserving the existing HTTP
contracts. This ADR documents both the architectural direction and the
boundary that is actually implemented today.

## Decision

Organize the server around three dependency-ordered areas:

```text
presentation  ->  application  ->  application ports
      |                 ^
      +------ infrastructure implementations
```

The intended dependency rule is that infrastructure implements application
ports, application services depend on ports rather than implementations, and
presentation adapts HTTP (or, later, Electron IPC) to the available services.

The current Node runtime now enforces this rule at its presentation boundary:
presentation receives application services and transport configuration, while
the composition root owns repository construction.

### Presentation

`presentation` owns the Node HTTP server, routing, request parsing, response
serialization, CORS, SSE formatting, and transport-level error mapping. The
route modules adapt these transports to application services and do not accept
concrete persistence repositories.

The future Electron adapter belongs here and must expose the same application
behavior through a typed, narrow IPC/preload contract.

### Application

`application` contains use-case services, product invariants, and transport-
neutral ports. The implemented focused services are:

- `ArticleService`;
- `AssistantService` for Assistant skill resolution, streaming, and persistence;
- `ApplicationSettingsService` for Settings normalization, persistence, and provider operations;
- `PublishingService`;
- `StyleCorpusService`;
- `EditorialService` for editorial streaming and completion persistence.

`ApplicationServices` exposes Article, Assistant, Application Settings,
Publishing, and Style Corpus services. `EditorialService` is composed by the
Node root alongside those services and passed to presentation as a ready
application dependency.

Application code must not import `node:http`, Electron, SQLite, filesystem
APIs, or AI provider SDKs. Its ports are small contracts such as article,
assistant, editorial, style-corpus, settings, and engine interfaces. New use cases should
be added as focused services and ports rather than by expanding the compatibility
repository facade.

### Infrastructure

`infrastructure` owns external systems and their adapters:

- configuration and environment loading;
- SQLite database access and repository implementations;
- AI SDK/provider adapters and configured engine resolution;
- service startup and shutdown lifecycle.

`Repositories` is retained as a compatibility facade for tests. The
independently named repositories under `infrastructure/persistence/repositories`
are the preferred integration points for composition roots and ports.

### Composition roots

`packages/server/src/index.ts` is the current Node composition root. It loads
the environment and configuration, opens SQLite, constructs repositories,
creates the focused application services and `EditorialService`, and
creates/listens to the local HTTP service.

`presentation/server.ts` completes only HTTP runtime setup and creates the
presentation router from ready application dependencies. It has no persistence
repository parameters. The Node composition root passes the configured engine
resolver into the application services and constructs `EditorialService`. A
future Electron main process may become another composition root, but it must
reuse the application services and ports instead of duplicating use-case
behavior.

## Actual source structure

The implemented source tree is:

```text
packages/server/src/
├── index.ts
├── application/
│   ├── application-services.ts
│   ├── create-application-services.ts
│   ├── articles/article-service.ts
│   ├── assistant/assistant-service.ts
│   ├── settings/application-settings-service.ts
│   ├── editorial/
│   │   ├── editorial-request.ts
│   │   ├── editorial-service.ts
│   │   ├── style-corpus-service.ts
│   │   ├── translation.ts (+ test)
│   │   └── workflow-prompt.ts (+ test)
│   ├── errors/application-service-error.ts
│   ├── ports/
│   │   ├── article-store.ts
│   │   ├── assistant-artifact-store.ts
│   │   ├── assistant-store.ts
│   │   ├── available-models-provider.ts
│   │   ├── editorial-conversation-request.ts
│   │   ├── editorial-engine*.ts
│   │   ├── editorial-store.ts
│   │   ├── settings-store.ts
│   │   ├── system-date-time-format-provider.ts
│   │   └── style-corpus-store.ts
│   └── publishing/publishing-service.ts
├── infrastructure/
│   ├── configuration/
│   │   ├── config.ts (+ test)
│   │   └── system-date-time-format.ts
│   ├── editorial/
│   │   ├── ai-sdk-editorial-engine.ts (+ test)
│   │   ├── available-models.ts
│   │   ├── configured-editorial-engine-resolver.ts
│   │   └── create-editorial-engine.ts
│   ├── lifecycle/service-lifecycle.ts (+ test)
│   └── persistence/
│       ├── database.ts
│       ├── index.ts
│       ├── repositories.ts (+ test)
│       ├── article-*-conflict-error.ts
│       └── repositories/
│           ├── articles-repository.ts
│           ├── assistant-repository.ts
│           ├── editorial-sessions-repository.ts
│           ├── materials-repository.ts
│           ├── repository-utils.ts
│           ├── settings-repository.ts
│           ├── style-corpus-repository.ts
│           └── workflow-artifacts-repository.ts
└── presentation/
    ├── server.ts (+ test)
    ├── router.ts (+ test)
    ├── editorial-integration.test.ts
    ├── errors/application-error.ts
    ├── transport/json.ts
    └── routes/
        ├── create-presentation-router.ts
        ├── articles-route.ts
        ├── assistant-route.ts
        ├── editorial-route.ts
        ├── health-route.ts
        ├── publish-settings-route.ts
        ├── settings-route.ts
        └── style-corpus-route.ts
```

Tests are colocated with the layer and feature they exercise. There are no
`infrastructure/filesystem` or Electron directories in the current
implementation; those directories must not be documented or created until
the corresponding extraction is made.

The application `errors` directory also contains the Article Draft and
Revision conflict errors. Persistence repositories import those application
errors directly; persistence does not re-export them.

`packages/shared` remains the stable public contract surface for
transport-neutral domain types, validation schemas, paths, status codes, and
client contracts. It must not import server infrastructure.

## File and dependency rules

- Prefer one independently named exported entity per file: primary class,
  interface, type alias, enum/constant group, function, or service factory.
- Name files after their primary entity in kebab-case.
- Keep small private helpers with their primary entity. Extract a helper when
  it gains a public name, a second caller, or an independent test contract.
- Barrels may re-export entities but must not contain their implementations.
- Do not add aggregate files containing unrelated domain entities. The
  `Repositories` facade is an explicitly temporary compatibility exception.
- Keep transport concerns in `presentation`, external-system concerns in
  `infrastructure`, and reusable use-case behavior in `application`.
- New application code must depend on narrow ports. Do not pass a concrete
  repository into a new application service unless the migration explicitly
  records that seam.
- Keep AI provider calls, configuration values, SQLite, filesystem access, and
  secrets out of the renderer and application services.
- Persist generated output only after a valid completed operation, and never
  apply a Proposal to an Article without explicit author approval.

## Migration strategy

Continue the incremental refactor:

1. Extract Assistant orchestration into application services and focused ports.
2. Extract Application Settings orchestration and its settings ports.
3. Keep EditorialService construction and engine resolution in the composition
   root while keeping presentation responsible only for transport.
4. Replace remaining presentation repository parameters with application
   service contracts. **Completed 2026-08-10:** presentation factories now
   receive only application services; conflict errors are application-owned.
5. Remove the compatibility `Repositories` facade when no test
   seam requires it.
6. Add import-boundary checks before introducing Electron IPC.

Each slice must preserve existing HTTP contracts, product inventories, SSE
events, error codes, cancellation/retry behavior, and recovery semantics.
No service locator, dependency-injection container, CQRS layer, event bus, or
permanent dual implementation is required for the current single-user local
application.

## Preserved product contracts

The refactor must preserve renderer isolation, local Article/Draft/Revision/
material/style/Settings/artifact persistence, explicit Proposal approval,
immutable Revision creation, revision-bound Findings and translations, stale
protection, Assistant streaming/cancellation/retry recovery, provider-
independent `EditorialEngine` contracts, stable HTTP error codes and SSE event
shapes, and Electron readiness without exposing Electron APIs to React or
application services.

## Consequences

The current structure gives focused services and ports where the migration
slices need them while keeping the existing HTTP behavior working. The
remaining compatibility repository facade is test-only. Additional
abstraction requires a second real runtime, implementation, or test boundary.

## Verification

Run the repository checks for each migration slice:

```text
npm run lint
npm run typecheck
npm test
```

Before introducing Electron IPC, also verify that application imports do not
reach Node transport, Electron, SQLite, filesystem, or AI provider modules,
and that the same application-service tests pass through both runtime
adapters.

## Implementation status

Implemented:

- focused Article, Publishing, and Style Corpus application services;
- ApplicationSettingsService with settings, system-format, and model-provider ports;
- EditorialService for streaming and completed-output persistence;
- application ports for article, editorial engine/store, settings, and style
  corpus access;
- infrastructure entry points for configuration, database, lifecycle, and AI
  engine construction;
- application-owned Article conflict errors and transport mapping without
  persistence imports in presentation;
- explicit Node composition in `index.ts`;
- presentation factories that accept application services rather than concrete
  persistence repositories;
- individually named persistence repositories and a temporary compatibility
  facade;
- existing HTTP contracts and product inventories remain intact.

Deferred to later migration slices:

- removal of the compatibility `Repositories` facade;
- Electron IPC adapter.
