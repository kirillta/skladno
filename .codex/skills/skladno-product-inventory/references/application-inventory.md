# Skladno application and Article library inventory

| Area | Feature | Status | Owner / contract |
|---|---|---|---|
| Application shell | Local React application with loopback Node.js service and typed client | Implemented | `packages/web`, `packages/server`, `packages/shared`; credentials and privileged operations stay server-side. |
| Application shell | Health reporting and recoverable client errors | Implemented | `/api/health`, application client, notifications; errors do not expose secrets or full Article bodies. |
| Application shell | Separate Editorial Workspace and Application Settings screens | Implemented | `App` and workspace provider; Settings never enter Article Revision history. |
| Application shell | Single-user, local-first operation | Implemented | SQLite persistence for Articles, Draft checkpoints, materials, style samples, and settings. |
| Application shell | Desktop-ready responsive shell | Partial | Desktop shell and collapsed panels exist; Electron, mobile, and offline modes are deferred. |
