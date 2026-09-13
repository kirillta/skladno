# ADR-002: Feature-oriented organization of shared contracts

- Status: Accepted
- Date: 2026-08-09
- Updated: 2026-09-13
- Scope: `packages/shared`
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md)

## Context

The web renderer, local service, and Electron bridge share domain and transport contracts. A flat shared package obscures ownership, while moving orchestration into shared code would create a second application layer.

## Decision

Organize `packages/shared/src` by product feature and contract responsibility. Feature modules own Article, Draft, Revision, Assistant, editorial, publishing, Settings, and style contracts. Small foundation modules own application-client, persistence-record, transport, and cross-cutting contracts.

The root barrel and dedicated feature barrels only re-export. Independently named concepts use separate files when they have an independent caller or test contract; cohesive protocol unions may remain together. A domain module may retain compatibility re-exports without becoming a barrel-only file.

`application/client.ts` owns `EditorialWorkspaceClient`; `application/desktop/` owns Electron and desktop bridge contracts. In `assistant/`, `assistant.ts` owns requests, messages, and results, `assistant-skills.ts` owns built-in Skill IDs and compatibility mapping, and `assistant-events.ts` owns the event protocol and its validator. Keep public exports available through `index.ts` when moving a contract.

Shared code remains transport-neutral and renderer-safe. It may contain schemas, pure validation, constants, domain algorithms, and client interfaces. It does not contain server orchestration or import Node, Electron, SQLite, filesystem, or provider SDK modules.

## Consequences

Callers can find contracts by domain ownership, and HTTP and Electron reuse the same public types. Some protocol modules remain intentionally grouped to avoid file-per-type boilerplate.

## Verification

Run lint, typecheck, tests, and import-boundary checks. Public imports remain available through `packages/shared/src/index.ts`, and shared modules have no privileged runtime dependencies.
