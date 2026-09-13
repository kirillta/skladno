# ADR-003: Feature-oriented organization of the web renderer

- Status: Accepted
- Date: 2026-08-09
- Updated: 2026-09-13
- Scope: `packages/web`
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-002](adr-002-shared-contract-organization.md)

## Context

The renderer owns interaction and browser presentation but must remain a thin client of the local service. Organizing everything around a single workspace component mixes composition, orchestration, state, and rendering.

## Decision

Organize the renderer by feature first, then by responsibility inside each feature. `settings` and `workspace` own product screens. `ui`, `i18n`, `key-bindings`, and `notifications` are cross-cutting renderer services.

Within the workspace, components and views render prepared state and invoke explicit callbacks. State modules own browser-side orchestration such as loading, Draft checkpoints, Proposal and Finding state, Assistant streams, publishing guidance, and layout preferences. `App` and `EditorialWorkspace` remain composition boundaries.

`application/client.ts` is the web-owned HTTP adapter to the shared application client, with transport helpers in `application/http/`. `application/desktop-client.ts` provides access to the desktop bridges. UI code uses the injected application client or the narrow desktop clients; it does not call server routes or privileged modules directly. Cross-cutting modules do not import feature components or feature state.

### State and controller ownership

`EditorialWorkspace.tsx` prepares the props and callbacks for the screen. Under `workspace/state/`, `article-workspace-state.ts` composes Article state with `article-workspace-actions.ts`, `article-workspace-articles.ts`, and `article-revisions-state.ts`. `assistant-messages-state.ts` composes message history, request execution, and stream-event handling from their sibling modules. New requests and retries share the execution, completion, and recovery helpers in `assistant-request-state.ts`.

`editorial-proposal-state.ts` owns Proposal state and composes `editorial-proposal-actions.ts`, `editorial-proposal-helpers.ts`, and `editorial-results-state.ts`. Keep Proposal decisions and generation actions in the actions module, summary loading and editorial event handling in the helpers module, and Findings and translation state in the results module.

`settings/ApplicationSettings.tsx` owns the Settings screen and saved preferences. `settings/use-ai-settings-controller.ts` owns AI connection form state, connection actions, model loading, and rename/removal dialog state. Settings components render that prepared state and invoke its callbacks.

In `notifications/`, `notifications.ts` declares the caller API, `notification-state.ts` declares stored state, `notification-duration.ts` owns dismissal timing defaults, and `notification-limit.ts` owns the visible limit. `NotificationProvider.tsx` owns lifecycle and `NotificationViewport.tsx` renders notifications. Feature callers use `useNotifications` rather than manipulating stored notification state.

## Rules

- Extract a component, hook, or helper when it has an independent caller, test contract, or visual responsibility.
- Keep local helpers beside their only caller.
- Preserve the extracted ownership when adding behavior. Group hook inputs by their meaning and expose explicit callbacks; do not copy request cleanup or controller state into views.
- Reuse the typed ICU catalog, semantic tokens, and shared UI primitives.
- Route Article-changing actions through existing application state and explicit author controls.
- Add no global store, event bus, second client, or hypothetical runtime abstraction without a demonstrated need.

## Consequences

Feature ownership and renderer dependency direction remain visible. Focused files cost some navigation, but avoid a second application layer and keep privileged behavior out of React.

## Verification

Follow the [testing guide](../guides/testing.md) for the changed paths. Lint includes `npm run check:imports`; run focused behavior tests and verify changed desktop and responsive states. The import checker currently still matches the former `application-client.ts` filename for its client-to-feature rule, so review imports under `application/` directly until that rule is updated.
