# ADR-009: Native Settings use platform adapters and restart-safe data switching

- Status: Accepted
- Date: 2026-08-23
- Scope: Electron Settings, managed credentials, native backups, restore, and data relocation
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-006](adr-006-sqlite-lifecycle-and-recovery.md), [ADR-008](adr-008-loopback-service-trust-boundary.md)

## Context

Skladno now has a Windows Electron client and browser-based Application Settings. The browser owns its selected backup-directory handle, while the local application service owns SQLite snapshots and environment-variable credential resolution.

Native Settings need operating-system folder selection, File Explorer integration, managed credentials, backup restore, and relocation of live SQLite data. These operations cannot grant filesystem or credential access to the renderer. Restore and relocation also cannot switch an open SQLite database safely.

Windows 11 x64 is the current desktop target. The Settings domain must not require a later macOS or Linux implementation to replace shared contracts or application use cases.

## Decision

Represent an AI connection's credential source as either an environment-variable reference or a managed credential. Store managed API keys in the operating-system credential store through a narrow application port. The Windows implementation uses Windows Credential Manager. Persist only sanitized connection metadata in SQLite.

Both the Windows loopback service and Electron composition root use the same credential adapter. Browser clients may select, test, and use managed connections, but only the Electron client may create, rename, or remove them. No client receives a credential value.

Expose native Settings through a separate, context-isolated preload client. Electron main owns native dialogs, File Explorer actions, retained picker selections, credential mutation, and restart coordination. The application client remains transport-neutral. The renderer cannot submit arbitrary paths for privileged actions.

Keep browser and native backup destinations outside SQLite. The browser retains its permission handle. Windows stores its native destination in a validated runtime configuration beneath the operating-system application-data directory.

The same runtime configuration stores the selected live data directory and a discriminated pending restore or relocation record. `SKLADNO_DATA_DIR` has higher precedence and disables relocation. Runtime configuration contains no credentials or Article content and is written atomically.

Restore and relocation use staged SQLite snapshots and apply only during restart. Before restore, Skladno creates and retains a recovery snapshot. Relocation retains the complete old data directory. Startup clears pending state only after the new database and application services open successfully. A failed switch attempts one automatic rollback and cannot enter a relaunch loop.

Live data must remain on a local filesystem. Native backup snapshots may use a network destination. Backup and data directories cannot contain one another.

Define platform-neutral credential and native-settings boundaries, then implement and accept only the Windows adapters. Do not add placeholder platform implementations. A later platform supplies its credential store, runtime configuration location, native dialogs, reveal action, and acceptance tests behind the same boundaries.

## Consequences

Managed credentials remain available to both current Windows runtimes without entering renderer responses, SQLite, backups, or runtime configuration. Native path authority stays in Electron main. Restore and relocation gain an explicit recovery state instead of mutating an open database.

The Windows package gains one native credential-store dependency and must ship its matching x64 binary. Runtime startup becomes responsible for resolving and completing or rolling back a pending data switch before normal composition.

Other desktop platforms are not implemented by this decision. Their adapters can reuse the Settings contracts and switching state machine, but each platform needs separate credential-store, filesystem, packaging, and recovery acceptance evidence.

## Rejected alternatives

- Electron `safeStorage`: a separately launched loopback service cannot access it, so managed connections would not be usable from the browser runtime.
- Credential values in SQLite or runtime JSON: snapshots and relocation would copy secrets and weaken the renderer and persistence boundary.
- A generic filesystem IPC bridge: it would grant more authority than Settings needs.
- In-place restore or live relocation: an open WAL-mode database cannot be replaced safely.
- Automatic deletion of old data or orphaned credentials: it would remove rollback options without a separate author decision.
- Platform-specific fields in shared Settings contracts: they would make future adapters change the domain model.

## Verification

Contract and adapter tests must cover credential-source validation, no secret serialization, allowlisted IPC, retained picker selections, path containment, snapshot compatibility, configuration precedence, staged switching, one rollback attempt, and restart-loop prevention.

The packaged Windows 11 x64 acceptance drill must prove Windows Credential Manager access from Electron and the loopback service, native backup retention, successful restore and relocation, failure rollback, retained old data, and continued browser behavior.
