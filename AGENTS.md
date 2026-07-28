# AGENTS.md

This file contains repository-wide instructions for coding agents and contributors working on Skladno.

## Product intent

Skladno is a local-first AI editorial workspace for authors of technical articles. It helps turn theses into a coherent draft, improve flow, verify facts, preserve the author's voice, translate the result, and prepare platform-ready text.

The product is an editor with an assistant, not an autonomous publishing bot. The author must remain in control of the document at every step.

## Sources of truth

Use these sources in descending order:

1. The active GitHub issue and its acceptance criteria.
2. The product invariants and architecture boundaries in this file.
3. [README.md](README.md).
4. Other open issues and the post-MVP milestone.

If an issue conflicts with a product invariant below, stop and call out the conflict before implementing it.

## Product invariants

- Never apply AI-generated text to an article without explicit author approval.
- Every accepted content change creates an immutable revision.
- Restoring an old revision creates a new revision; it never rewrites history.
- Keep original articles, translations, and generated variants independently recoverable.
- Raw author materials and the style corpus are local-first. Send only the minimum context required for an explicit model operation.
- Fact-check results are advisory, tied to the reviewed revision, and include source links and uncertainty.
- Suggested workflow order is smoothing, fact-checking, then style review. The workflow remains flexible rather than enforced.
- Publishing limits are configurable guidance, not universal hard-coded facts.
- The MVP does not publish directly to LinkedIn or other platforms.
- Optimize for preserving claims, numbers, URLs, code, technical terms, and author voice.

## Architecture boundaries

The intended shape is a TypeScript workspace with:

- `web`: React single-page renderer and user interface.
- `server`: local Node.js service, SQLite access, OpenAI integration, streaming, and privileged operations.
- `shared`: domain types, validation schemas, API contracts, and transport-neutral application interfaces.

Exact folders and tooling are established by the foundation issue. Once established, follow the repository rather than creating parallel structures.

Keep these boundaries:

- The renderer must not receive API keys or direct filesystem/database access.
- UI code depends on a narrow application-client interface, not server internals.
- OpenAI calls, web search, persistence, and secrets stay in the local service.
- Domain logic should be transport-neutral so a future Electron client can reuse it.
- Electron main/preload APIs must remain narrow, typed, context-isolated, and renderer-safe.
- SQLite schema changes require explicit, forward-only migrations.
- Persist streamed or generated output only after the operation reaches a valid completed state.

## Security and privacy

- Never commit `.env` files, credentials, private author content, or local databases.
- Never log API keys or full document bodies by default.
- Redact sensitive values in errors, diagnostics, fixtures, and snapshots.
- Treat imported documents, drafts, style samples, research notes, and audio as private user data.
- Sanitize rendered model output and imported HTML.
- Make network-dependent actions explicit in the UI.
- Do not enable provider-side storage unless a scoped issue explicitly changes that decision.

## Implementation workflow

Before changing code:

1. Read the complete issue, including dependencies, risks, and evaluation.
2. Confirm prerequisite issues are implemented or identify a safe seam for independent work.
3. Inspect existing contracts, migrations, and tests before introducing new ones.
4. Keep the change limited to the issue's goal and scope.

While changing code:

- Prefer small, typed modules and explicit state transitions.
- Validate data at process and transport boundaries.
- Preserve unrelated user changes in the working tree.
- Add or update tests with the implementation.
- Avoid speculative abstractions for post-MVP features.
- Do not silently expand the network, persistence, or permission surface.

Before handing off:

1. Run the smallest relevant checks documented by the repository.
2. Verify the issue's acceptance criteria and failure paths.
3. Report checks that were run and checks that still require manual verification.
4. Update documentation when behavior, setup, contracts, or architecture changes.

## Testing expectations

Use the narrowest effective layer:

- Unit tests for Unicode counting, diff logic, revision conflicts, validation, and pure domain behavior.
- Repository tests against a temporary SQLite database for migrations and persistence.
- Contract/integration tests for REST, SSE, cancellation, retries, timeouts, rate limits, and malformed provider responses.
- Component tests for editor state, autosave, proposal review, error recovery, and accessibility.
- End-to-end tests for critical author journeys.
- Evaluation fixtures for editorial quality, claim preservation, style, and translation.

AI-facing tests should prefer deterministic fixtures or mocked provider responses. Never require a real API key for the default test suite.

## Content and UX language

- Use plain, author-centered language.
- Clearly distinguish current article text, a generated proposal, and an accepted revision.
- Explain destructive actions and require confirmation where recovery is not obvious.
- Always provide useful loading, empty, cancelled, offline, and recoverable error states.
- Core workflows must be keyboard accessible.

## Repository commands

The project skeleton and canonical commands have not been created yet. When the foundation issue defines them, document the exact install, development, type-check, test, lint, and migration commands here and in the README.

Do not invent substitute commands or introduce a second package manager.

## Backlog boundaries

Issues in the `Future enhancements (post-MVP)` milestone are intentionally deferred until the core editorial loop has been validated with real publications. Do not pull them into MVP work unless the active issue explicitly changes scope.

