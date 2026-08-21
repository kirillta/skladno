# Skladno agent guide

Skladno is a local-first AI editorial workspace. It assists authors; it does not autonomously edit or publish their work.

## Start here

Before changing code:

1. Read the active issue and the code, contracts, and tests on the affected path.
2. Run `npm run product:impact -- <affected paths>` and preserve the matched implemented capabilities unless the issue explicitly changes them. Read a whole canonical area only when path routing is insufficient.
3. Follow the existing architecture and nearby conventions. Do not create parallel structures.

The user-provided issue or task is the active source of truth for scope; do not infer another issue from repository history. [`README.md`](README.md) describes the product and development setup. Generated files in `docs/development/product/*-inventory.md` are not edited directly; update the product model and run `npm run product:docs -- <area>`.

Keep `docs/development/plans` for active work only. When a plan is complete, move lasting decisions into an ADR or guide and delete the plan. Keep ADRs focused on durable choices and consequences; source trees, progress logs, and release evidence belong in the repository, issue, or dated guide result.

## Product invariants

- The author explicitly approves every AI-generated content change.
- Accepting or restoring content creates a new immutable Revision; history is never rewritten.
- Articles, translations, and generated variants remain independently recoverable.
- A Draft checkpoint is mutable recovery state, not a Revision. Promote only a checkpoint based on the current Revision, and clear only the promoted checkpoint.
- Proposals and Findings stay tied to their base Revision and become stale when the current Revision changes.
- Fact-check Findings are advisory and include sources and uncertainty.
- Author materials and style samples are local-first. Send only the minimum context required for an explicit operation.
- Publishing limits are configurable guidance. The MVP does not publish directly to external platforms.
- Preserve claims, numbers, URLs, code, technical terms, and author voice.

Use the domain terms in the [Skladno glossary](docs/user/Glossary.md), `packages/shared`, and the product model. Use **Article**, not `document`, except for browser DOM APIs.

## Architecture and security

- Keep domain contracts in `packages/shared`, privileged and persistent work in `packages/server`, renderer UI in `packages/web`, and Electron bridges narrow and context-isolated.
- The renderer must not receive credentials or direct filesystem/database access. UI code talks through the application client, not server internals.
- Keep AI calls, web search, persistence, and secrets in the local service. Persist generated output only after valid completion.
- Validate process and transport boundaries. SQLite schema changes use forward-only migrations.
- Never commit or log credentials, private author content, local databases, or full article bodies. Redact sensitive diagnostics and sanitize imported or generated HTML.
- Do not expand network, persistence, permission, or provider-side storage behavior without explicit scope.

## UI changes

- Follow the [web design system](docs/development/ui/design-system.md) and reuse its primitives and semantic Tailwind tokens.
- Keep `packages/web/src/styles.css` for Tailwind imports, tokens, and global behavior only.
- All application-owned visible and accessible copy goes through the typed ICU catalog in `packages/web/src/i18n/messages.ts`. Never use translated text as program state or identifiers.
- Preserve keyboard access and useful loading, empty, cancelled, offline, and recoverable-error states.

## Handoff

- Add the narrowest test that protects changed behavior and use deterministic provider fixtures.
- Run the smallest relevant scripts from the root `package.json`; use npm only. At minimum, run lint and typecheck for source changes.
- If a capability, status, contract, persistence boundary, or user-visible behavior changed, update the matching `product-model/areas/*.json`, run `npm run product:docs -- <area>`, and run `npm run product:check`. Do not change the model merely because an owner path was touched.
- Report checks run and any manual verification still needed.
