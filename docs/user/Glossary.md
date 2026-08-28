# Skladno glossary

These terms describe concepts visible to authors and the domain language used throughout Skladno.

## Articles and revisions

- **Article**: an independently recoverable piece of editorial work. Skladno uses “Article” rather than “document.”
- **Article library**: the author's local collection of Articles. The **current Article** is open in the workspace; an **Article list** presents the collection.
- **Draft**: Article text currently being edited but not yet saved as a Revision.
- **Draft checkpoint**: recoverable, mutable Draft state saved locally and tied to a base Revision. It is not a Revision. A **Current Draft** is based on the Article's current Revision; a **stale Draft** is based on an older Revision.
- **Revision**: an immutable saved snapshot of an Article.
- **Revision promotion**: the author's explicit save of a Current Draft as a new Revision. It clears only the matching Draft checkpoint.
- **Proposal**: AI-generated candidate content or changes that require explicit author approval.
- **Proposal base Revision**: the Revision reviewed to produce a Proposal. The Proposal becomes stale when it no longer matches the current Revision.
- **Change selection**: the subset of a Proposal the author chooses to accept. Acceptance creates a new Revision.
- **Finding**: advisory output, such as a fact-check or style-review result, that does not change an Article.
- **Source Article** and **translation Article**: independently recoverable linked Articles. A translation is never a Revision of its source.

## Editorial work

- **Editorial operation**: an author-requested assistant activity, such as composing, smoothing, fact-checking, style review, or translation.
- **Editorial request**: one invocation of an Editorial operation.
- **Editorial session**: the interaction sequence and activity history for Editorial requests.
- **Editorial guidance**: author-entered instructions or context supplied with an Editorial request.
- **Style corpus**: local writing samples provided by the author. A **style profile** is their compact derived representation.
- **Workflow stage**: optional, author-selected progress guidance. It never runs AI or changes Article content.

## Publishing and settings

- **Publishing profile**: configurable platform guidance, including a character limit. Its default applies only to new Articles.
- **Publishing copy**: Markdown or plain text explicitly copied from the current Article through the Article Status Bar. Skladno does not provide a Publishing Preview Workspace View.
- **Application Settings**: workspace-level preferences, AI configuration, Publishing profiles, and local data management. Settings never belong to Article Revision history.
- **AI connection**: a named server-side provider configuration with a Credential source. The **active AI connection** is used for new Editorial requests.
- **Credential source**: the private source used by an AI connection. It is either an environment-variable reference or a Managed credential.
- **Managed credential**: an API key held by the operating-system credential store. Skladno persists connection metadata but never writes the key to SQLite or a Backup snapshot.
- **Model preference**: a default model identifier or an Editorial operation-specific override.
- **Interface locale**: the language of the Skladno interface, separate from Article and translation languages.
- **Default Article language**: the language assigned to a new Article when none is supplied.
- **Default translation languages**: ordered languages offered first for translation requests. They never start translations automatically.
- **Backup destination**: a local directory where Skladno writes Backup snapshots.
- **Backup snapshot**: a consistent point-in-time copy of local data, separate from the active database and excluding credentials.
- **Data location**: the active local directory containing Skladno's SQLite data.
- **Data relocation**: an author-confirmed copy and restart that switches Skladno to a new Data location while retaining the old copy for recovery.
- **Recovery snapshot**: a Backup snapshot retained before Skladno replaces active data during restore.
- **Application update**: a newer packaged Skladno version that the desktop client can check for, download, and apply only through author-controlled steps. An update never changes Article content by itself.
- **Security update**: an Application update whose release tag carries the `.security` suffix. Skladno warns about it but never forces a check, download, or restart.
- **Staged update**: a downloaded Application update waiting for the author to choose Restart and update. Ordinary close does not apply it.
- **Pre-update snapshot**: a Backup snapshot of local data created before Skladno applies a staged update. Restoring it requires the matching earlier application version.
- **Diagnostics event**: a redacted local service record written to the host process logs for startup or recoverable failure support. It never includes private Article content, model bodies, or environment-variable values.

## Interface

- **Editorial Workspace**: the main authoring screen containing the Article Library Panel, Article Workspace, and Editorial Assistant Panel.
- **Article Library Panel**: Article search, the Article list, and workspace-level entry points. Its collapsed form is the **Navigation Rail**; its temporary small-screen form is the **Navigation Drawer**.
- **Article Workspace**: the Article Header, Workspace Tab Bar, selected Workspace View, and Article Status Bar.
- **Workspace View**: the selected Article Editor or supporting view: Proposal Review, Revision History, Fact Check, Style Profile, or Translations.
- **Article Editor**: the writing view. Its main editing area is the **writing surface**.
- **Editorial Assistant Panel**: Editorial guidance, actions, request status, and activity. Its temporary small-screen form is the **Assistant Drawer**.
- **Application Settings Navigation**: navigation among the General, AI, Publishing profiles, and Data & backups Settings sections.
