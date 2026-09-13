# ADR-001: Three-layer server architecture and Electron readiness

- Status: Accepted
- Date: 2026-08-08
- Updated: 2026-09-13
- Scope: `packages/server`, shared application contracts, and Electron integration

## Context

Skladno is local-first. The renderer must remain isolated from credentials, SQLite, the filesystem, and provider SDKs. The primary Electron runtime and the development HTTP runtime reuse the same application behavior without duplicating use cases.

## Decision

Organize the local service into dependency-ordered areas:

```text
presentation -> application -> application ports
      |              ^
      +--- infrastructure implementations
```

Presentation owns HTTP and Electron IPC adaptation, transport validation, serialization, streaming, and error mapping. Application services own use cases and product invariants through narrow ports. Infrastructure owns SQLite, configuration, AI providers, filesystem work, diagnostics, and runtime lifecycle.

Composition roots construct infrastructure and inject ready application services into presentation. `packages/server/src/local-application.ts` composes the shared repositories and application services. `packages/server/src/index.ts` adds the loopback HTTP server, while `packages/electron/src/presentation/main.ts` registers the allowlisted IPC adapter and opens the existing React build. Both runtimes use the same SQLite data and application behavior.

`packages/shared` contains transport-neutral, renderer-safe contracts. The Electron preload exposes only the typed application client through a context-isolated bridge.

### Application ownership

Paths below are relative to `packages/server/src/application`. Keep ports beside the feature that consumes them.

| Area | Responsibility |
| --- | --- |
| `articles/` | Article lifecycle, Draft and Revision conflicts, Article storage and Assistant greeting ports |
| `assistant/` | Request orchestration and storage ports, with `requests/`, `capabilities/`, `completion/`, and `skills/` owning their respective steps |
| `editorial/` | Editorial orchestration, with `engine/` for engine contracts, `fact-checking/` for Findings and artifact persistence, `proposals/` for summaries, and `style/` and `translation/` for their domain work |
| `settings/` | Settings service and normalizers, credential, backup, model-discovery, date-format, and Settings storage ports |
| `publishing/`, `telemetry/`, `errors/` | Publishing guidance, the telemetry observer port, and safe application errors |

`application-services.ts` declares the service collection. `create-application-services.ts` wires application collaborators from grouped `stores`, `settings`, and optional `integration` dependencies. `local-application.ts` owns concrete infrastructure construction and supplies those dependencies; it also constructs the shared `EditorialService`.

## Rules

- Application code does not import HTTP, Electron, SQLite, filesystem, configuration, or provider modules.
- Presentation does not construct or depend directly on persistence repositories.
- Infrastructure implements application ports and remains outside renderer imports.
- New use cases use focused services and ports. A second runtime or implementation must justify additional abstraction.
- Group dependencies by responsibility and keep methods within one operation scope. Extract a crossed responsibility into a focused helper rather than expanding a service into unrelated work.
- Name service and repository operations for their domain effect, such as `getArticle`, `listEditorialArtifacts`, or `resolveFactCheckFinding`. Keep names aligned across ports, implementations, and callers.
- Generated output is persisted only after valid completion and never applied without author approval.

## Consequences

HTTP and Electron can share behavior while privileged systems remain outside the renderer. Composition stays explicit. The repository does not need a dependency-injection container, service locator, event bus, CQRS layer, or aggregate repository facade.

## Verification

Run lint, typecheck, tests, and import-boundary checks. Adapter tests must prove that HTTP and Electron expose renderer-safe results and stable application errors without importing privileged implementation types.
