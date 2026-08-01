# Skladno history, evidence, and publishing inventory

| Area | Feature | Status | Owner / contract |
|---|---|---|---|
| Revision history | Ordered immutable Revision list | Implemented | `RevisionHistoryView` and Article repository. |
| Revision history | Restore a prior Revision | Implemented | Restore creates a new Revision and never rewrites history; uncommitted Drafts require an explicit choice. |
| Style corpus | Add/remove local writing samples and derive a compact style profile | Implemented | `StyleProfileView` and style corpus repository; raw samples stay local. |
| Fact Check | Revision-tied findings, statuses, source links, and uncertainty | Implemented | `FactCheckView` and workflow-artifact repository; findings never modify Article text. |
| Translations | Source Article/Revision linkage, stale warning, explicit linked translation creation | Implemented | `TranslationsView`; translation Articles remain independently recoverable. |
| Publishing preview | Plain-text preparation, Article-specific profile selection, shared character guidance, copy-ready preview | Implemented | `PublishingPreviewView` and publishing helpers; direct publishing is not performed. |
| Publishing profiles | Named user-managed profiles with configurable limits | Partial | Current UI exposes fixed legacy profile selection; custom profile management is incomplete. |
