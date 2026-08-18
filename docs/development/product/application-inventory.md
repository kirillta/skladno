# Application inventory

This file is generated from `product-model/areas/application.json`. Edit the canonical product model, then run `npm run product:docs -- application`.

| ID | Feature | Status | Contract | Persistence | Related capabilities |
|---|---|---|---|---|---|
| application.local-service-client | Local React application with loopback service and typed client | Implemented | The renderer uses typed HTTP and Electron application-client operations, including supporting Proposal summaries, against local application services; credentials and privileged model operations remain server-side. | No renderer access to secrets, files, or SQLite. | — |
| application.health-and-recoverable-errors | Health reporting and recoverable client errors | Implemented | Health and stable error codes allow the renderer to present recoverable failures without exposing secrets or full Article bodies. | Errors are transient UI state; sensitive values are not included in the transport contract. | — |
| application.workspace-and-settings-screens | Separate Editorial Workspace and Application Settings screens | Implemented | Application Settings is a workspace-level screen and never belongs to Article Revision history. | Screen selection is renderer state; Application Settings persist through their dedicated service contracts. | — |
| application.local-first-single-user | Single-user, local-first operation | Implemented | Articles, Draft checkpoints, materials, style samples, model preferences, and completed Proposal summaries persist in local SQLite storage through focused domain-specific repositories wired at local-service startup; no aggregate repository facade is required. | SQLite is the active data store; private author data is not delegated to a remote application database. | — |
| application.desktop-responsive-shell | Desktop-ready responsive shell | Partial | The desktop shell supports collapsed panels, responsive workspace layout, and locally dismissible workspace advisories. | Workspace layout and advisory-dismissal preferences are persisted locally in browser storage. | — |
