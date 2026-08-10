# ADR-002: Feature-oriented organization of shared contracts

- Status: Accepted
- Date: 2026-08-09
- Scope: `packages/shared`
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md)

## Context

`packages/shared` is the stable contract surface used by the renderer, the
local service, and the Electron preload client. It contains a
mix of transport constants, application-client interfaces, domain records,
feature algorithms, validation helpers, errors, and persistence types at one
directory level. The public barrel keeps imports stable, but the source layout
does not make ownership or dependency direction clear.

The shared package must remain transport-neutral. It cannot become a second
server layer, import Node.js, Electron, SQLite, filesystem APIs, or provider
SDKs, and it must not contain server orchestration. Reorganizing it must also
preserve the existing Article, Draft, Revision, Proposal, Finding, Assistant,
Settings, publishing, health, error, and keyboard contracts.

ADR-001 established an entity-per-file rule for server code. The same
navigation benefit is needed here, with one qualification: small, cohesive
sets of types that form one protocol or domain concept may remain together
until separating them improves ownership rather than merely increasing file
count.

## Decision

Organize shared source by feature and contract responsibility, with a small
transport-neutral foundation. Dependencies point toward leaf domain and
cross-cutting contracts; feature barrels and the root barrel only re-export.

```text
packages/shared/src/
├── application/
│   ├── client/
│   └── health/
├── articles/
│   ├── article/
│   ├── draft/
│   ├── revision/
│   └── workspace/
├── assistant/
├── editorial/
├── publishing/
├── settings/
├── style/
├── persistence/
├── transport/
├── cross-cutting/
└── index.ts
```

The exact leaf filenames are introduced incrementally, but independently
named exported entities use their own files when they have an independent
concept, caller, or test contract. Cohesive protocol unions and their
closely-related records may stay in one module. Private helpers remain next
to the primary exported entity.

### Responsibility boundaries

- `application` contains renderer-safe client contracts and health
  response validation. It contains no HTTP implementation.
- `articles` contains Article, Draft, Revision, Proposal, and workspace
  client contracts. Revision and proposal helpers remain pure and never
  accept or apply AI output implicitly.
- `assistant` and `editorial` contain their transport-neutral request,
  response, event, and result contracts. Streaming events remain proposals
  or findings until an explicit application operation accepts them.
- `publishing`, `settings`, and `style` contain their feature contracts,
  pure guidance/validation helpers, and feature-specific client interfaces.
- `persistence` contains shared persisted record and input shapes only. It
  does not open a database or know a storage implementation.
- `transport` contains shared route and protocol constants, including HTTP
  methods and statuses, without request handling or response serialization.
- `cross-cutting` contains shared errors, languages, key bindings, and other
  contracts that are not owned by one feature.

Each area may have a local barrel for discoverability. Barrels may re-export
symbols but must not contain implementations. The root `index.ts` remains the
only stable public import surface for package consumers; consumers continue to
import from `@skladno/shared`, not internal paths.

The package remains dependency-light and runtime-neutral:

```text
transport / cross-cutting / persistence
                  ↓
       feature contracts and pure helpers
                  ↓
       application-client contracts
```

The arrows describe allowed type/helper reuse, not runtime ownership. No
shared module may import from `packages/server` or `packages/web`.

## Target organization

The first target mapping is:

| Current module | Target responsibility |
|---|---|
| `health.ts` | `application/health` |
| `workspace.ts` | `articles/workspace` |
| `revisions.ts` | `articles/revision` |
| `persistence/articles.ts` | `articles/article` and `articles/draft` |
| `assistant.ts` | `assistant` |
| `editorial.ts` | `editorial` |
| `publishing.ts` | `publishing` |
| `settings.ts` | `settings` |
| `style.ts` | `style` |
| `persistence/*` | `persistence` or the owning feature, after usage is verified |
| `http.ts` | `transport/http` |
| `errors.ts`, `languages.ts`, `key-bindings.ts` | `cross-cutting/*` |

This mapping is a migration destination, not permission to split a module
without checking its imports, tests, and public exports. A move must preserve
the root-barrel export names and generated declaration surface.

## Migration strategy

This is an incremental source reorganization, not a contract rewrite:

1. Add the target directories and move the smallest cohesive modules first.
2. Update internal relative imports while keeping root-barrel exports
   unchanged.
3. Split persistence and feature modules only where entity ownership is clear;
   do not create empty folders or speculative abstractions.
4. Add focused local barrels only when they reduce import noise or clarify a
   boundary.
5. Add import-boundary and public-barrel checks after the layout stabilizes.
6. Remove obsolete paths only after all workspace, server, and shared tests
   pass and no internal imports remain.

No compatibility aliases for internal source paths are required. The stable
compatibility promise is the `@skladno/shared` package entry point.

## Preserved contracts

Every migration phase must preserve:

- the renderer's narrow, transport-neutral client interfaces and health
  parsing;
- stable HTTP method/status and application-error values;
- Article, Draft checkpoint, Revision promotion, restoration, and conflict
  types;
- proposal diff, selection, explicit acceptance, and stale-proposal safety;
- revision-bound editorial findings, citations, translations, and streaming
  event shapes;
- Assistant skill, request, message, streaming, cancellation, and recovery
  contracts;
- Settings, AI connection, model preference, publishing profile, and style
  corpus contracts;
- Article language and keyboard normalization/conflict behavior;
- the absence of secrets, filesystem/database access, provider SDKs, and
  network calls from the shared package.

The reorganization must not change product inventory status or add a product
capability. If a contract is changed rather than moved, it requires a separate
decision and the relevant canonical product model update.

## Consequences

### Positive

- Feature ownership and dependency direction are visible from the tree.
- Shared contracts are easier to find and safer to reuse from HTTP or future
  Electron adapters, including the typed IPC operation and stream contracts.
- The root public API remains stable while internals can evolve.
- Pure domain helpers can be tested without server or browser infrastructure.

### Costs

- Relative imports and test locations change during migration.
- There are more small files and local barrels.
- Some concepts span features and require an explicit ownership decision.

These costs are accepted because the shared package is now a permanent
boundary between runtimes. Further splitting stops when it no longer improves
navigation, ownership, or test isolation.

## Verification

Each migration slice must run:

```text
npm run lint
npm run typecheck
npm test
```

The slice must also verify that the root barrel exports the same public names
and that shared source imports no server, web, Node.js, Electron, SQLite, or AI
provider modules.

## Implementation status

The first migration slice is implemented and verified:

- application health contracts are under `application/`;
- Article, Draft, Revision, and workspace contracts are under `articles/`;
- Assistant, Editorial, Publishing, Settings, Style, Transport, and
  Cross-cutting contracts have feature-owned directories;
- persistence records that are not Article/Draft/Revision-specific remain
  under `persistence/`;
- the root barrel preserves the existing public export names;
- lint, typecheck, and the full workspace test suite pass.

Future slices may add local barrels or further split cohesive modules only
when ownership or independent testing justifies them.
