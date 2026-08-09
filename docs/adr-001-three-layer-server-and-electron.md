# ADR-001: Three-layer server architecture and Electron readiness

- Status: Accepted
- Date: 2026-08-08
- Scope: `packages/server`, its shared contracts, and future Electron integration

## Context

The server currently combines HTTP transport, application orchestration,
persistence access, configuration, and AI-engine construction. This makes
routes responsible for business decisions and makes a future Electron main
process likely to duplicate server behavior.

Skladno must remain local-first and preserve its existing Article, Draft,
Revision, Proposal, Finding, Assistant, Settings, privacy, streaming, and
recovery contracts. Electron is a future runtime, not a reason to expose
Electron APIs or provider SDKs to application code.

The codebase also needs predictable navigation. A developer should be able to
find a class, interface, type, enum, or other independently named entity from
its filename without searching through large mixed-purpose modules.

## Decision

Organize the server into three dependency-ordered layers:

```text
Presentation  ->  Application  ->  Ports/contracts
                                      ^
Infrastructure -----------------------+
```

### Presentation layer

Presentation adapts an external transport to application services. It owns:

- HTTP server setup, routing, CORS, and SSE formatting;
- request parsing and transport-level validation;
- HTTP status and response serialization;
- mapping application errors to stable transport errors;
- future Electron IPC handlers and preload-facing adapters.

Presentation must not call SQLite repositories, read environment variables,
construct AI providers, or implement Article/editorial business rules.

### Application layer

Application services own use cases and product invariants. They receive narrow
ports and return domain results or application errors. Initial services are:

- Article service;
- Editorial service;
- Assistant service;
- Settings service;
- Style Corpus service;
- Publishing service.

Application code must not import `node:http`, Electron, SQLite, filesystem
APIs, or AI SDK/provider packages. It must remain usable from either an HTTP
runtime or an Electron main process.

### Infrastructure layer

Infrastructure implements application ports and owns external systems:

- SQLite database and repository implementations;
- AI SDK/provider adapters behind the `EditorialEngine` façade;
- environment and local configuration loading;
- filesystem and backup adapters;
- process and service lifecycle adapters.

Infrastructure may depend on application ports, but application services must
not depend on infrastructure implementations.

### Composition roots

Runtime wiring must be separate from use cases. A reusable composition function
will construct the application runtime from infrastructure implementations.

```text
createApplicationRuntime()
        ├── Node HTTP runtime
        └── Electron main-process runtime
```

The current Node entry point remains one composition root. Electron will later
become another composition root that exposes the same application services
through typed IPC.

The renderer continues to depend on a narrow application-client contract. Its
implementation can remain HTTP-based for the web runtime and become a typed
preload/IPC client for Electron without changing workspace features.

## File organization rule

Every independently named entity gets its own file:

- one primary class per file;
- one primary interface per file;
- one primary type alias per file;
- one primary enum or constant group per file;
- one primary exported function or service factory per file.

Files are named after the entity in kebab-case, for example:

```text
application/editorial/editorial-service.ts
application/ports/editorial-engine.ts
infrastructure/persistence/article-store.ts
presentation/routes/editorial-route.ts
```

Small private helpers that are implementation details of the file's primary
entity may remain co-located. If a helper gains a public name, a second caller,
or an independent test contract, promote it to its own file.

Do not create aggregate files that contain unrelated classes or interfaces.
Barrel files may re-export entities, but must not contain their implementations.

## Target structure

```text
packages/server/src/
├── presentation/
│   ├── server.ts
│   ├── routes/
│   ├── errors/
│   └── transport/
├── application/
│   ├── articles/
│   ├── editorial/
│   ├── assistant/
│   ├── settings/
│   ├── publishing/
│   └── ports/
├── infrastructure/
│   ├── configuration/
│   ├── persistence/
│   ├── editorial/
│   ├── filesystem/
│   └── lifecycle/
└── index.ts
```

`packages/shared` remains the stable public contract surface for transport-
neutral domain types, validation schemas, and client contracts. It must not
import server infrastructure.

## Migration strategy

This is an incremental refactor, not a rewrite:

1. Introduce application ports and the composition function.
2. Extract Editorial and Assistant services first because they contain the
   highest concentration of streaming, persistence, and safety rules.
3. Adapt existing HTTP routes to call those services.
4. Extract Article, Settings, Style Corpus, and Publishing services.
5. Move SQLite and AI implementations behind infrastructure ports.
6. Add import-boundary checks and entity-per-file checks.
7. Add an Electron IPC adapter only after the HTTP runtime uses the same
   application services.

Each phase must preserve existing HTTP contracts and pass the current tests.
No permanent dual implementation, service locator, dependency-injection
container, CQRS layer, or event bus is required for the current single-user
local application.

## Preserved product contracts

The refactor must preserve, at minimum:

- renderer isolation from credentials, SQLite, and filesystem access;
- local Article, Draft, Revision, material, style, Settings, and artifact
  persistence;
- explicit Proposal approval and immutable Revision creation;
- revision-bound Findings, citations, translations, and stale protection;
- Assistant skill resolution, streaming, cancellation, and retry recovery;
- provider-independent `EditorialEngine` contracts;
- stable HTTP error codes and SSE event shapes;
- Electron readiness without exposing Electron APIs to React or application
  services.

## Consequences

### Positive

- HTTP and Electron can share the same application behavior.
- Provider and database implementations can change without changing use cases.
- Routes become smaller transport adapters.
- Entity-per-file navigation makes ownership and dependencies easier to inspect.
- Application services can be tested with fake ports and no network or SQLite.

### Costs

- More files and explicit constructor wiring.
- Temporary adapters may wrap the existing broad `Repositories` class.
- Some small private helpers remain local until they demonstrate independent
  reuse.

These costs are accepted because they directly support navigation, testing,
runtime portability, and preservation of product invariants. More abstraction
should be added only when a second real runtime or implementation requires it.

## Verification

Every migration phase should run:

```text
npm run lint
npm run typecheck
npm test
```

Before introducing Electron IPC, verify that the same application-service test
suite passes with the HTTP and Electron runtime adapters, and that no
application-layer import reaches Node transport, Electron, SQLite, or an AI
provider SDK.

## Implementation status

The first migration slice is implemented:

- Article, publishing, and Style Corpus use focused application services.
- Editorial streaming and completion persistence use `EditorialService`.
- Configuration, database, lifecycle, and AI construction have infrastructure
  entry points.
- The Node entry point is an explicit composition root.
- Existing HTTP contracts and product inventories remain intact.

Assistant and Application Settings orchestration remain on the next migration
slice. They continue to use the existing repository façade until their focused
application ports and services are extracted.
