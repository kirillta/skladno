# ADR-008: The renderer is an unprivileged client of a loopback service

- Status: Accepted
- Date: 2026-08-21
- Updated: 2026-08-23
- Scope: Browser, HTTP, Electron IPC, credentials, and privileged local access
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-009](adr-009-native-settings-credentials-and-data-switching.md)

## Context

The browser renderer handles private Article content but cannot safely own API credentials, database handles, arbitrary filesystem access, or provider clients. Skladno also needs browser and Electron runtimes without two security models.

## Decision

The local service listens on loopback by default and accepts browser requests only from the configured origin. It owns credentials, persistence, provider calls, web search, filesystem operations, and backup creation.

The renderer uses the shared `EditorialWorkspaceClient`. The browser implementation adapts that client to HTTP. The Electron main process composes the same local application services without opening an HTTP listener, and its sandboxed, context-isolated preload exposes the allowlisted client through IPC. Neither renderer receives credential values, database or filesystem handles, raw server errors, or unrestricted IPC.

The Electron window denies renderer-created windows and in-renderer navigation. It opens validated HTTP and HTTPS links in the system browser and rejects other schemes. Desktop close coordinates the active Draft checkpoint before cancelling streams and closing SQLite.

Browser directory handles used for author-selected backup destinations remain browser capabilities and do not grant general local-service filesystem access. Expanding hosts, origins, IPC operations, network destinations, persistence, permissions, or provider-side storage requires an explicit security review.

Windows-native Settings operations are exposed through their own finite, context-isolated desktop client; dialogs, Explorer reveal, credential storage, and native snapshots remain in Electron main as specified by ADR-009.

The loopback boundary limits network exposure but does not defend against another process already running as the same local user. Operating-system account security remains part of the trust model.

## Consequences

Privileged behavior has one service-side implementation and two narrow transports. Browser development remains possible without making React a trusted process. Deployments that expose the service beyond loopback need authentication and a separate decision.

## Verification

Configuration tests reject invalid hosts, origins, ports, and storage values. HTTP and Electron adapter tests validate request boundaries, allowlisted operations, renderer-safe errors, cancellation, and stream behavior.

