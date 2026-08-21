# ADR-003: Feature-oriented organization of the web renderer

- Status: Accepted
- Date: 2026-08-09
- Updated: 2026-08-21
- Scope: `packages/web`
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-002](adr-002-shared-contract-organization.md)

## Context

The renderer owns interaction and browser presentation but must remain a thin client of the local service. Organizing everything around a single workspace component mixes composition, orchestration, state, and rendering.

## Decision

Organize the renderer by feature first, then by responsibility inside each feature. `settings` and `workspace` own product screens. `ui`, `i18n`, `key-bindings`, and `notifications` are cross-cutting renderer services.

Within the workspace, components and views render prepared state and invoke explicit callbacks. State modules own browser-side orchestration such as loading, Draft checkpoints, Proposal and Finding state, Assistant streams, publishing guidance, and layout preferences. `App` and `EditorialWorkspace` remain composition boundaries.

`application-client.ts` is the web-owned adapter to the shared application client. UI code does not call server routes or privileged modules directly. Cross-cutting modules do not import feature components or feature state.

## Rules

- Extract a component, hook, or helper when it has an independent caller, test contract, or visual responsibility.
- Keep local helpers beside their only caller.
- Reuse the typed ICU catalog, semantic tokens, and shared UI primitives.
- Route Article-changing actions through existing application state and explicit author controls.
- Add no global store, event bus, second client, or hypothetical runtime abstraction without a demonstrated need.

## Consequences

Feature ownership and renderer dependency direction remain visible. Focused files cost some navigation, but avoid a second application layer and keep privileged behavior out of React.

## Verification

Run lint, typecheck, tests, `npm run check:imports`, product impact routing for affected paths, and visual verification of changed desktop and responsive states.
