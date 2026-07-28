# Skladno

> Your ideas, in your voice.

Skladno is a local-first AI editorial workspace for technical authors. It supports the full path from rough theses to a polished, fact-checked, voice-consistent article while keeping every meaningful edit under the author's control.

The project is currently in its planning and foundation stage. The product backlog is tracked in [GitHub Issues](https://github.com/kirillta/skladno/issues).

## What Skladno is for

A typical editorial session looks like this:

```text
theses
  → coherent draft
  → author's revision
  → flow improvement
  → fact-check
  → style review
  → translation
  → platform-ready copy
```

The sequence is suggested, not enforced. Authors can move between steps as their work requires.

Skladno is designed around three visible parts:

- a list of articles and source materials;
- a plain-text article editor;
- a conversational editorial assistant.

AI output is always a proposal. The author reviews a diff and explicitly accepts or rejects it. Accepted changes create immutable versions, and any earlier version can be restored later.

## MVP

The first release is a personal, single-user application running locally. It includes:

- local article storage and autosave;
- a plain-text editor with Unicode-aware length guidance;
- streamed editorial conversations;
- thesis-to-draft composition and flow revision;
- reviewable diffs with full or partial acceptance;
- immutable version history and restoration;
- an author-style corpus and style review;
- fact-checking with linked sources and stated uncertainty;
- reviewable translation into a separate language version;
- LinkedIn-oriented plain-text preview and clipboard export;
- configurable publishing-limit profiles;
- privacy-conscious diagnostics, backup guidance, and failure recovery.

The MVP deliberately excludes accounts, cloud synchronization, direct publishing, team collaboration, and an Electron distribution.

## Product principles

- **The author stays in control.** Generated text never silently replaces an article.
- **History is recoverable.** Accepted changes and restorations are immutable revisions.
- **Local first.** Drafts, source materials, style samples, and settings remain local by default.
- **Evidence over confidence.** Fact-check findings include sources and expose uncertainty.
- **Voice over generic polish.** Improvements should retain the author's claims, terminology, rhythm, and intent.
- **Platform guidance is configurable.** Length and formatting rules can change and are not hard-coded as universal truths.
- **Desktop-ready, not desktop-first.** The MVP validates the workflow as a local web application while preserving a clean path to Electron.

## Planned architecture

The implementation will use a separated TypeScript architecture:

```text
React SPA
    │
    │ typed application client
    ▼
local Node.js service
    ├── SQLite persistence and migrations
    ├── immutable document revisions
    ├── OpenAI Responses API and SSE streaming
    ├── web search for fact-checking
    └── local configuration and secrets

shared packages
    ├── domain types
    ├── validation schemas
    └── transport-neutral contracts
```

This boundary keeps credentials and privileged operations out of the browser renderer. A future Electron main/preload layer can implement the same application-client contract without rewriting the React interface or domain logic.

The exact workspace layout, package manager, framework configuration, and development commands will be established by [issue #1](https://github.com/kirillta/skladno/issues/1).

## Editorial safety model

Every model operation follows the same basic lifecycle:

```text
current revision
    → explicit author request
    → streamed model operation
    → completed proposal
    → diff review
    → accept or reject
    → new immutable revision when accepted
```

Cancellation, network failure, malformed output, or an incomplete stream must leave the current article unchanged.

Fact-check findings and style findings are attached to the exact revision that was reviewed. Translations and derived formats remain separate from their source article.

## Roadmap

The MVP work is split into dependency-aware issues covering foundation, persistence, workspace, AI integration, editorial workflows, revision control, style, fact-checking, translation, publishing preview, and release hardening.

Deferred capabilities live in the [Future enhancements (post-MVP) milestone](https://github.com/kirillta/skladno/milestone/1). They include:

- URL and LinkedIn imports;
- larger style corpora and personal terminology;
- Markdown, HTML, and DOCX exports;
- additional platforms and direct publishing;
- research, source libraries, voice notes, and visual assets;
- an Electron application and offline workflows;
- multiple providers and local models;
- cloud sync, teams, analytics, custom workflows, mobile, PWA, and browser-extension experiences.

These features are intentionally held until the core editorial loop has been validated with real publications.

## Development

The implementation skeleton has not been initialized yet. Setup and verification commands will be added here as part of the foundation issue.

Until then:

1. Select an issue whose dependencies are satisfied.
2. Read its goal, scope, acceptance criteria, risks, and evaluation section.
3. Follow the repository instructions in [AGENTS.md](AGENTS.md).
4. Keep implementation within the selected issue's scope.

## Privacy

Skladno processes unpublished writing and style samples, so privacy is a product requirement:

- API credentials stay in the privileged local service.
- Private content and credentials must not appear in logs by default.
- Model requests contain only the context required for the requested operation.
- Provider-side storage is disabled unless the user explicitly opts into a future feature that requires it.
- Network-dependent actions are visible and initiated by the author.

## Status

Planning is complete and the implementation backlog is ready. The next step is [establishing the local-first application architecture](https://github.com/kirillta/skladno/issues/1).

## License

Skladno is available under the [MIT License](LICENSE).
