# AGENTS.md

This file contains repository-wide instructions for coding agents and contributors working on Skladno.

## Product intent

Skladno is a local-first AI editorial workspace for authors of technical articles. It helps turn theses into a coherent draft, improve flow, verify facts, preserve the author's voice, translate the result, and prepare platform-ready text.

The product is an editor with an assistant, not an autonomous publishing bot. The author must remain in control of the article at every step.

## Ubiquitous language

Use the following terms consistently in product copy, UI labels, domain code, tests, and documentation. Prefer responsibility-based names over positional names so they remain accurate when the layout adapts.

- **Article**: the author's independently recoverable editorial work. Use this as the canonical product and domain term; reserve `document` only for DOM-standard browser APIs.
- **Article library**: the author's local collection of articles. An **article list** is a presentation of that collection; the **current article** is the article open in the workspace.
- **Revision**: an immutable saved snapshot of an article.
- **Draft**: the article text currently being edited and not yet saved as a revision.
- **Proposal**: AI-generated candidate content or changes that require the author's explicit approval.
- **Proposal base revision**: the saved revision reviewed to produce a proposal. A proposal becomes **stale** when the current article revision no longer matches its base revision.
- **Change selection**: the subset of a proposal's changes that the author has selected to accept. Accepting a selection creates a new revision.
- **Finding**: advisory output, such as a fact-check or style-review result, that does not change an article.
- **Editorial operation**: an author-requested assistant activity, such as smoothing, fact-checking, style review, or translation.
- **Editorial request**: one invocation of an editorial operation. An **editorial session** is the interaction sequence and activity history for those requests.
- **Editorial guidance**: author-entered instruction or context supplied with an editorial request.
- **Source article** and **translation article**: independently recoverable linked articles. A translation is never a revision of its source article.
- **Style corpus**: author-provided local writing samples; a **style profile** is their compact derived representation.
- **Publishing profile**: configurable platform guidance; a **publishing preview** is derived copy prepared for review or copying.
- **Workflow stage**: optional author-selected progress guidance. It is advisory and never runs AI or changes article content.

The desktop **Editorial Workspace** is composed as follows:

```text
Editorial Workspace
├── Article Library Panel
├── Article Workspace
│   ├── Article Header
│   ├── Workspace Tab Bar
│   ├── Workspace View
│   │   ├── Article Editor
│   │   ├── Proposal Review
│   │   ├── Revision History
│   │   ├── Fact Check
│   │   ├── Style Profile
│   │   ├── Translations
│   │   └── Publishing Preview
│   └── Article Status Bar
└── Editorial Assistant Panel
```

The **Workspace Shell** is the layout container for the Editorial Workspace. The Article Library Panel contains article search, the article list, and workspace-level entry points. A collapsed Article Library Panel is a **Navigation Rail**; a temporary small-screen form is a **Navigation Drawer** or **Assistant Drawer**. The Editorial Assistant Panel contains editorial guidance, editorial actions, request status, and assistant activity. It may be shortened to “assistant panel” in conversation, but do not call it a generic “right panel” in code or documentation.

An **Article Header** identifies the current article and holds article-level controls. The **Workspace Tab Bar** selects the active **Workspace View**; its tabs are not views themselves. The **Article Editor** is the writing view and its principal area is the **writing surface**. **Proposal Review**, **Revision History**, **Fact Check**, **Style Profile**, **Translations**, and **Publishing Preview** are supporting workspace views. The **Article Status Bar** shows article persistence and revision status.

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
- Organize shared domain contracts into focused modules by concern. Do not accumulate unrelated records and inputs in a catch-all file as the application grows.
- Preserve the root `@skladno/shared` barrel as the stable public import surface while allowing internal domain modules to evolve independently.
- Define transport-level constants shared by the server and renderer, such as HTTP status codes, once in `shared`.
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

## Code style

Preserve the established spacious, vertically organized formatting across the workspace.

- ESLint is the source of truth for mechanically enforceable JavaScript and TypeScript formatting, including indentation, brace placement, conditional formatting, statement separation, whitespace, quotes, and semicolons. Run `npm run lint`; the root build also runs it automatically.
- Keep single-statement conditional bodies unbraced on the following indented line. Use braces when a branch contains multiple statements, and brace every branch consistently when one branch requires them.
- Use four spaces and no tabs in JSON, CSS, and nested HTML content, which ESLint does not inspect.
- Never combine multiple logical actions or side effects on one line, even when they form a single syntactic statement.
- Separate top-level declarations with two blank lines. Within a function, use blank lines to separate logical phases such as validation, setup, persistence, and return.
- Expand non-trivial object literals so each property is on its own line. Apply the same structure to nested objects and arrays in JSON configuration.
- Format fluent call chains vertically, with each chained operation on its own indented line when the chain would otherwise be dense.
- Keep multiline boolean expressions vertically aligned beneath the opening parenthesis.
- Use named constants for protocol values such as HTTP status codes; do not use magic numbers in handlers, clients, or tests.
- Write CSS as expanded blocks: one selector per line when grouped, one declaration per line, a blank line between rules, and fully expanded media-query contents.
- Preserve the surrounding style when editing an existing file; do not introduce compact one-line formatting into expanded code.

## Web UI foundation

- Use Tailwind utility classes for web UI component styling. Do not introduce a parallel plain-CSS component layer.
- Keep `packages/web/src/styles.css` limited to Tailwind imports, semantic design tokens, and truly global base behavior such as focus visibility and reduced motion.
- Follow [`packages/web/src/ui/design-system.md`](packages/web/src/ui/design-system.md) when building or changing UI primitives and feature controls. It defines the available primitives, their state variants, accessibility baseline, and the non-color status and diff conventions.
- Consume the semantic tokens exposed through Tailwind rather than introducing raw palette, radius, focus, or elevation values in feature code.

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

The MVP Article refactor has one intentional schema transition: at startup, detect the legacy Documents schema, delete its `skladno.sqlite` file and SQLite sidecars once, and recreate the Article schema in the same location. Preserve the resulting Article database on future starts. If cleanup fails, stop startup with a clear error.

Use npm from the repository root:

- `npm install` installs workspace dependencies.
- `npm run dev` starts the server and web development processes.
- `npm run lint` checks JavaScript and TypeScript source formatting and correctness.
- `npm run lint:fix` applies safe automatic lint fixes.
- `npm run typecheck` checks the TypeScript project references.
- `npm test` runs the workspace test suites.
- `npm run build` creates production builds for workspaces that define a build script, then runs the project linter through the root `postbuild` hook.

No standalone migration command is defined; database migrations run through the server’s documented startup and repository flows.

Do not invent substitute commands or introduce a second package manager.

## Backlog boundaries

Issues in the `Future enhancements (post-MVP)` milestone are intentionally deferred until the core editorial loop has been validated with real publications. Do not pull them into MVP work unless the active issue explicitly changes scope.
