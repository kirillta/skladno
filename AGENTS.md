# Skladno agent guide

Skladno is a local-first AI editorial workspace. It assists authors; it never edits or publishes their work autonomously.

## Before changing code

1. Treat the user-provided issue or task as the active scope. Do not infer another issue from repository history.
2. Read the affected code, contracts, and tests. Run `npm run product:impact -- <affected paths>` and preserve every matched implemented capability unless the task changes it.
3. Follow nearby architecture. For package boundaries read [ADR-001](docs/development/architecture/adr-001-three-layer-server-and-electron.md), [ADR-002](docs/development/architecture/adr-002-shared-contract-organization.md), or [ADR-003](docs/development/architecture/adr-003-web-feature-oriented-react-architecture.md).
4. For diagnostics, Article state, persistence, AI, or trust-boundary changes read [ADR-004](docs/development/architecture/adr-004-local-diagnostics.md), [ADR-005](docs/development/architecture/adr-005-article-state-and-consistency.md), [ADR-006](docs/development/architecture/adr-006-sqlite-lifecycle-and-recovery.md), [ADR-007](docs/development/architecture/adr-007-completion-gated-editorial-engine.md), or [ADR-008](docs/development/architecture/adr-008-loopback-service-trust-boundary.md).

[README.md](README.md) covers setup. The [glossary](docs/user/Glossary.md), `packages/shared`, and the product model define domain terms. Use **Article**, not `document`, except for browser DOM APIs.

Keep `docs/development/plans` for active work. Move lasting decisions from completed plans into an ADR or guide, then delete the plan. Generated product inventories are read-only; update `product-model/areas` and regenerate them.

## Always preserve

- The author explicitly approves generated content. Acceptance or restoration appends an immutable Revision; history is never rewritten.
- A Draft checkpoint is mutable recovery state tied to a base Revision. Revision-bound Proposals and Findings become stale when the current Revision changes.
- Articles and translations remain independently recoverable. Fact-check Findings remain advisory, sourced, and uncertain where appropriate.
- Send only the minimum private context required for an explicit operation. Persist generated output only after valid completion.
- Preserve claims, numbers, URLs, code, technical terms, and author voice. Publishing limits remain guidance; Skladno does not publish directly.

## Boundaries

Keep renderer-safe contracts in `packages/shared`, privileged work in `packages/server`, UI in `packages/web`, and Electron bridges narrow and context-isolated. The renderer uses the application client and receives no credentials or direct database or filesystem access.

Validate transport and process boundaries. Keep credentials, private content, databases, raw provider errors, and full Article bodies out of commits and diagnostics. Expanding network, persistence, permissions, or provider-side storage requires explicit scope.

For UI changes, follow the [web design system](docs/development/ui/design-system.md). It owns primitives, tokens, internationalized copy, accessibility, and interaction-state guidance.

## Handoff

- Follow the [testing guide](docs/development/guides/testing.md). Source changes require focused tests, lint, and typecheck.
- Update the canonical product model only when capability, status, contract, persistence, or visible behavior changes; regenerate the affected inventory and run `npm run product:check`.
- Report checks run and remaining manual verification.
