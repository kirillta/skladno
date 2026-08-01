# Skladno application and Article library inventory

| Area | Feature | Status | Owner / contract |
|---|---|---|---|
| Application shell | Local React application with loopback Node.js service and typed client | Implemented | `packages/web`, `packages/server`, `packages/shared`; credentials and privileged operations stay server-side. |
| Application shell | Health reporting and recoverable client errors | Implemented | `/api/health`, application client, notifications; errors do not expose secrets or full Article bodies. |
| Application shell | Separate Editorial Workspace and Application Settings screens | Implemented | `App` and workspace provider; Settings never enter Article Revision history. |
| Application shell | Single-user, local-first operation | Implemented | SQLite persistence for Articles, Draft checkpoints, materials, style samples, and settings. |
| Application shell | Desktop-ready responsive shell | Partial | Desktop shell and collapsed panels exist; Electron, mobile, and offline modes are deferred. |
| Article library | Create, search, select, and list recent Articles | Implemented | `ArticleLibraryPanel` and Article routes; new Articles use the configured default Article language. |
| Article library | Collapsed Navigation Rail with Style Profile, Settings, and save state | Implemented | `ArticleLibraryPanel`; layout is local preference and controls remain accessible. |
| Workspace shell | Three-column Article Library Panel, Article Workspace, and Editorial Assistant Panel | Implemented | `WorkspaceShell`; panels collapse and resize independently while the Article stays central. |
| Workspace shell | Focus mode | Implemented | `WorkspaceShell`; hides supporting panels without changing Article content, metadata, or Revisions. |
| Article header | Rename, workflow, source/target language, Draft state, save Revision, focus mode, delete | Implemented | `ArticleHeader`; workflow and source persist as Article metadata, while target language is stable request guidance only. |
| Article header | Advisory workflow stage | Implemented | Article metadata; never runs AI, changes text, or creates a Revision. |
| Workspace navigation | Write, Proposal Review, Revisions, Fact Check, Style Profile, Translations, Publish | Implemented | `WorkspaceTabBar` and `WorkspaceViewRouter`; active view is local UI state. |
| Article editor | Markdown writing surface, formatting toolbar, safe HTML paste conversion | Implemented | `ArticleRichEditor` and editor helpers; writing surface is a constrained worksheet. |
| Draft lifecycle | Debounced checkpoints, restore, retry, flush, and conflict recovery | Implemented | Mutable per-Article Draft checkpoints; explicit save promotes the exact checkpoint as one Revision. |
| Article status | Current Revision, Article publishing-profile selector, plus shared character count and remaining/overflow guidance | Implemented | `ArticleStatusBar`; fixed 24px bottom row of the Article Workspace. |
