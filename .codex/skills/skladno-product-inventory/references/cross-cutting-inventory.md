# Skladno cross-cutting inventory

| Area | Feature | Status | Contract |
|---|---|---|---|
| Internationalization | Typed, validated catalogs and English interface catalog | Implemented | English is the only complete installed catalog; incomplete locales are not selectable. Application copy is linted, production surfaces inherit the root locale provider, localized labels are excluded from selectors and logic, and pseudo-locale coverage guards core workspace surfaces. |
| Accessibility | Semantic controls, labels, descriptions, focus treatment, keyboard navigation, non-color cues | Implemented | Workspace and Settings accessibility contracts are preserved. |
| Keyboard control | Shortcut hints, normalization, conflict detection, and command registration | Partial | Persisted overrides and dispatch primitives exist; complete workspace-action wiring remains follow-up work. |
| Notifications | Shared success/error provider and viewport | Implemented | Recoverable failures are surfaced without sensitive values. |
| Data validation | Shared domain contracts, HTTP constants, and transport-boundary validation | Implemented | Malformed provider responses are treated as failures. |
| Privacy | Server-side secrets, local materials, minimum request context, redacted diagnostics, provider-storage opt-in | Implemented | `OPENAI_STORE_RESPONSES` is opt-in; private content is not logged or traced by default. |
| Database lifecycle | SQLite persistence and Article schema transition | Implemented | Legacy schema cleanup occurs once at startup; the resulting Article database is preserved later. |
| Assistant persistence | Local Article conversation records | Implemented | Greetings, messages, request scope, completions, and safe failure/cancellation status are isolated per Article with cascade deletion; fixed application-authored messages use stable templates for interface-localized rendering, while authored and model content remain persisted text. Author messages also retain the selected skill and its character offset so structured skill tags can be reproduced at their original inline position. |
| Data-protection activity center | Persistent application-level checkpoint, Revision, backup, and future sync activity | Deferred | [#86](https://github.com/kirillta/skladno/issues/86), `Future enhancements (post-MVP)` milestone. It is distinct from popup-notification history and does not replace contextual recovery. |
| Deferred MVP | Accounts, cloud sync, teams, analytics, direct publishing, imports, exports, research libraries, voice/visual assets, Electron, local models, multiple providers, mobile/PWA/browser extension, custom workflows | Deferred | These remain outside the current MVP boundary. |
