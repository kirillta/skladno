# ADR-003: Feature-oriented organization of the web renderer

- Status: Accepted
- Date: 2026-08-09
- Scope: `packages/web`
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-002](adr-002-shared-contract-organization.md)

## Context

The server and shared packages now make their dependency direction visible,
but the web renderer still has two different levels of organization. The
top-level application and cross-cutting concerns are already separated, while
the Editorial Workspace keeps composition, stateful orchestration, panels, and
view selection close together. Several panels and views also contain both
interaction state and presentational details in one file.

The renderer must remain a thin, browser-safe client. It may own React state,
view composition, local layout preferences, and browser interaction, but it
must not gain server, filesystem, database, provider, or secret access. The
web refactor is therefore a source-organization change, not a second
application layer or a contract rewrite.

## Decision

Organize the renderer by feature first, then by responsibility within a
feature:

```text
packages/web/src/
├── application-client.ts       # browser-safe application port and HTTP adapter
├── i18n/                        # catalog, formatting, and locale boundary
├── key-bindings/               # keyboard dispatch and shortcut presentation
├── notifications/              # notification state and viewport
├── settings/                   # Application Settings feature
├── ui/                         # renderer-wide primitives, icons, and tokens
└── workspace/                  # Editorial Workspace feature
    ├── components/             # shell, panels, header, status, dialogs
    ├── drafts/                 # Draft checkpoint lifecycle
    ├── editor/                 # writing surface and editor-only helpers
    ├── state/                  # workspace orchestration hooks and state
    ├── views/                  # tab-selected supporting Workspace Views
    └── workspace-views.ts      # view IDs, labels, and keyboard commands
```

The dependency direction is:

```text
App / feature composition
          ↓
workspace components and views
          ↓
workspace state hooks and editor helpers
          ↓
application-client + shared contracts
```

`ui`, `i18n`, `key-bindings`, and `notifications` are cross-cutting renderer
services. They may be consumed by features, but they do not import feature
components or feature state. The root `App` remains the renderer composition
root. `application-client.ts` remains the only web-owned adapter boundary for
the shared application client; UI code does not call `fetch` or server
internals directly.

### Workspace components

`components` owns the persistent Editorial Workspace frame and its panels.
The shell owns sizing and responsive collapse behavior. The Article Header,
Article Library Panel, Editorial Assistant Panel, Article Status Bar, and
dialogs own their interaction surfaces. A component may compose focused local
children, such as assistant timeline messages or revision navigation, but it
must not move use-case orchestration into the child.

### Workspace views

`views` owns content selected by the Workspace Tab Bar. Each view receives
already-prepared state and callbacks from the workspace composition boundary.
Views may manage local presentation state, such as which Revision is being
inspected, but accepting proposals, restoring revisions, creating
translations, and changing Article content remain explicit callbacks supplied
by the state layer.

### Workspace state

Workspace orchestration hooks belong in `workspace/state` as they are
extracted. They own loading, Draft checkpointing, Proposal and Finding
lifecycles, Assistant streaming state, publishing guidance, and persisted
workspace layout. The state layer depends on the narrow
`EditorialWorkspaceClient` and shared contracts; it does not import UI
components or manipulate server internals.

The migration is incremental. Existing stable imports may temporarily
re-export state types or helpers while callers move to their feature-local
paths. Barrels, when added, only re-export symbols and contain no
implementation.

## File and dependency rules

- Prefer one independently named component, hook, or pure helper per file
  when it has an independent caller, test contract, or meaningful visual
  responsibility.
- Keep small private helpers next to their primary component or hook.
- Do not create folders or abstractions for hypothetical screens or runtimes.
- Do not duplicate the application client, API calls, use-case behavior, or
  shared domain contracts in the renderer.
- Keep visible and accessible copy in the typed ICU catalog.
- Reuse semantic Tailwind tokens and existing UI primitives; do not create a
  parallel component CSS layer or introduce raw design-system values.
- Preserve explicit Proposal approval, immutable Revision behavior, Draft
  recovery, revision-bound Findings and translations, and Assistant
  cancellation/error recovery.

## Migration strategy

1. Keep the current feature folders and make their ownership explicit.
2. Split compound panels and views at stable visual or interaction seams.
3. Extract workspace orchestration hooks into `workspace/state` one cohesive
   hook at a time, keeping compatibility re-exports until imports are moved.
4. Add focused tests at the state, component, and view boundaries when an
   extraction creates an independently testable contract.
5. Remove obsolete compatibility paths only after web tests, typecheck, lint,
   and product-inventory checks pass.

This ADR does not change routes, HTTP contracts, shared types, persistence,
product capability status, or visible interaction behavior.

## Preserved product contracts

The refactor preserves the Article Library Panel and Navigation Rail,
Editorial Assistant Panel and selection scope, Article Header controls,
Workspace Tab Bar and all supporting Workspace Views, Draft checkpoint and
revision-promotion recovery, explicit Proposal review and acceptance,
revision-bound Fact Check and Style Review findings, independently recoverable
Translations, Publishing Preview guidance, Settings navigation, keyboard
commands, internationalization, accessibility, responsive collapse behavior,
and renderer isolation from secrets and privileged systems.

## Consequences

Feature ownership and visual boundaries become easier to find, and the
workspace composition root no longer needs to be the only place where all
renderer responsibilities can be understood. The cost is a few more focused
files and temporary compatibility exports during incremental state extraction.
No dependency-injection container, global store, event bus, or second client
abstraction is needed for the current local-first application.

## Verification

Run the repository checks for each migration slice:

```text
npm run lint
npm run typecheck
npm test
npm run product:impact -- <changed paths>
npm run product:check
```

When a change affects an Article Workspace capability, compare the final
rendered desktop and collapsed-panel states with the existing baseline.

## Implementation status

Implemented in this slice:

- the feature-oriented renderer boundary documented above;
- focused Assistant panel subcomponents for timeline and composer behavior;
- focused Revision History navigation and details components;
- workspace orchestration hooks extracted into focused `workspace/state`
  modules, with `EditorialWorkspace.tsx` retained as the composition boundary;
- view-local extracted rendering pieces without changing callbacks or
  product contracts.

Deferred to later slices:

- splitting Application Settings sections where the current file still has a
  cohesive screen-level interaction contract;
- adding automated import-boundary checks after the layout settles.
