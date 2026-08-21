# ADR-001: Three-layer server architecture and Electron readiness

- Status: Accepted
- Date: 2026-08-08
- Updated: 2026-08-21
- Scope: `packages/server`, shared application contracts, and Electron integration

## Context

Skladno is local-first. The renderer must remain isolated from credentials, SQLite, the filesystem, and provider SDKs. HTTP and a future Electron runtime need to reuse the same application behavior without duplicating use cases.

## Decision

Organize the local service into dependency-ordered areas:

```text
presentation -> application -> application ports
      |              ^
      +--- infrastructure implementations
```

Presentation owns HTTP and Electron IPC adaptation, transport validation, serialization, streaming, and error mapping. Application services own use cases and product invariants through narrow ports. Infrastructure owns SQLite, configuration, AI providers, filesystem work, diagnostics, and runtime lifecycle.

Composition roots construct infrastructure and inject ready application services into presentation. `packages/server/src/index.ts` is the Node composition root. A future Electron main process may be another composition root, but it must reuse the same application services.

`packages/shared` contains transport-neutral, renderer-safe contracts. The Electron preload exposes only the typed application client through a context-isolated bridge.

## Rules

- Application code does not import HTTP, Electron, SQLite, filesystem, configuration, or provider modules.
- Presentation does not construct or depend directly on persistence repositories.
- Infrastructure implements application ports and remains outside renderer imports.
- New use cases use focused services and ports. A second runtime or implementation must justify additional abstraction.
- Generated output is persisted only after valid completion and never applied without author approval.

## Consequences

HTTP and Electron can share behavior while privileged systems remain outside the renderer. Composition stays explicit. The repository does not need a dependency-injection container, service locator, event bus, CQRS layer, or aggregate repository facade.

## Verification

Run lint, typecheck, tests, and import-boundary checks. Adapter tests must prove that HTTP and Electron expose renderer-safe results and stable application errors without importing privileged implementation types.
