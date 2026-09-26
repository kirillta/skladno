# Skladno agent guide

Skladno is a beta, local-first AI editorial workspace. The Author controls accepted changes and publication. Electron is the primary product; the web app mainly supports development.

## Product decision criteria

Evaluate product, UX, and architecture decisions against these principles:

- Build for Authors who should not need AI infrastructure expertise. Keep setup and everyday use approachable regardless of where the model runs.
- Judge capabilities by their value to Authors and their writing work. Let Authors' needs guide the product's scope; treat current features as examples, never as a closed list of permitted capabilities.
- Keep accepted changes under Author control, with recoverable work and preserved history. Apply the guarantees below.
- Preserve open-source usability and choice among supported providers and models. Make capability limits clear and keep generalized workflows provider-neutral.

For product decisions, identify the Author benefit and any tradeoff against these principles.

## Working on a change

1. Use the user request as the scope. Check the implementation and read the references for the affected area below.
2. When changing existing product behavior or its owner paths, run `npm run product:impact -- <affected paths>`. Preserve matched implemented capabilities unless the request changes them. Update `product-model/areas` only when capability, status, contract, persistence, or visible behavior changes.
3. For broad discovery or multi-step coding, use the [agent-work guide](docs/development/guides/context-efficient-agent-work.md). For code structure, use the [refactoring skill](.codex/skills/refactoring/SKILL.md).
4. Complete the requested change and its applicable checks. The [testing guide](docs/development/guides/testing.md) gives the checks for source, docs, product records, and Electron.

## Plans and delegation

Use the [plans and delegation skill](.codex/skills/plans-and-delegation/SKILL.md) when creating or implementing a durable plan, or for requested agent delegation.

## Read for the affected area

| Change | Reference |
| --- | --- |
| Server layers, composition, or Electron integration | [ADR-001](docs/development/architecture/adr-001-three-layer-server-and-electron.md) |
| Shared contracts | [ADR-002](docs/development/architecture/adr-002-shared-contract-organization.md) |
| Renderer ownership and imports | [ADR-003](docs/development/architecture/adr-003-web-feature-oriented-react-architecture.md) |
| Diagnostics | [ADR-004](docs/development/architecture/adr-004-local-diagnostics.md) |
| Article, Draft, Revision, Proposal, Finding, or translation state | [ADR-005](docs/development/architecture/adr-005-article-state-and-consistency.md) |
| SQLite, migrations, backups, or recovery | [ADR-006](docs/development/architecture/adr-006-sqlite-lifecycle-and-recovery.md) |
| AI generation, streaming, or provider storage | [ADR-007](docs/development/architecture/adr-007-completion-gated-editorial-engine.md) |
| HTTP, IPC, preload, or privileged access | [ADR-008](docs/development/architecture/adr-008-loopback-service-trust-boundary.md) |
| Native Settings, credentials, restore, or data relocation | [ADR-009](docs/development/architecture/adr-009-native-settings-credentials-and-data-switching.md) |
| Updates, packaging, or release automation | [ADR-010](docs/development/architecture/adr-010-author-controlled-preview-updates.md) and [release guide](docs/development/guides/mvp-release-and-recovery.md) |
| Assistant Skills, capabilities, routing, or tool execution | [ADR-011](docs/development/architecture/adr-011-assistant-skills-and-bounded-capabilities.md) |
| Workspace or Settings focus-area navigation | [ADR-012](docs/development/architecture/adr-012-workspace-keyboard-focus-areas.md) |
| UI layout, controls, or interaction states | [Design system](docs/development/ui/design-system.md) |
| Visible copy, accessible names, or locale formatting | [Internationalization](docs/development/guides/internationalization.md) |

## Documentation ownership

[README.md](README.md) covers setup. The [glossary](docs/user/Glossary.md), `packages/shared`, and the product model define domain terms. Use **Article** for author content; reserve `document` for browser DOM APIs.

Keep `docs/development/plans` for active work. Move lasting decisions from completed plans into an ADR or guide, then delete the plan. Generated product inventories are read-only; update `product-model/areas` and regenerate them.

ADRs own architecture; guides own procedures; plans describe remaining work. Verify implementation and product records before claiming a plan or ADR is fully implemented. Resolve mismatches within the request's scope.

## Always preserve

- The author explicitly approves generated content. Acceptance or restoration appends an immutable Revision; history is never rewritten.
- A Draft checkpoint is mutable recovery state tied to a base Revision. Revision-bound Proposals and Findings become stale when the current Revision changes.
- Articles and translations remain independently recoverable. Fact-check Findings remain advisory, sourced, and uncertain where appropriate.
- Send only the minimum private context required for an explicit operation. Persist generated output only after valid completion.
- Every Author-facing error names what failed and gives a useful next step without exposing implementation details, raw errors, or private data.
- Preserve claims, numbers, URLs, code, technical terms, and author voice. Publishing limits remain guidance; Skladno does not publish directly.

## Boundaries

Keep renderer-safe contracts in `packages/shared`, privileged work in `packages/server`, UI in `packages/web`, and Electron bridges narrow and context-isolated. The renderer uses the application client and receives no credentials or direct database or filesystem access.

OpenAI is one potential provider. Use provider-neutral names for generalized concepts and identifiers; reserve `openai` for OpenAI-specific code (for example, do not name a provider-neutral identifier `io.github.kirillta.skladno.openai`).

Validate transport and process boundaries. Keep credentials, private content, databases, raw provider errors, and full Article bodies out of commits and diagnostics. Expanding network, persistence, permissions, or provider-side storage requires explicit scope.

## Handoff

- Before creating a GitHub issue, check whether an existing issue covers it. Assign new issues to a milestone.
- Report checks run and remaining manual verification.
