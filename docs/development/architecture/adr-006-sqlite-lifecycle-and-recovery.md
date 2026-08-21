# ADR-006: Local data uses forward-only SQLite migrations and snapshot recovery

- Status: Accepted
- Date: 2026-08-21
- Scope: Local persistence, schema migration, backups, and recovery
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-005](adr-005-article-state-and-consistency.md)

## Context

Skladno stores private author data locally and must upgrade it without a remote migration service. Schema changes, interrupted starts, and recovery must not rewrite Article history or expose credentials.

## Decision

SQLite is the local system of record. The service enables foreign keys and WAL mode. Schema changes are ordered, forward-only migrations recorded in `schema_migrations`; each unapplied migration runs in one immediate transaction.

The pre-Article prototype schema is detected by its known tables and replaced once rather than supported through a permanent compatibility layer. This destructive transition remains explicit in code and release review. Future supported schemas migrate forward without deleting the database.

Backups are SQLite snapshots. They include application data and exclude environment files and credentials. Automatic retention never deletes manual backups. Recovery occurs while Skladno is stopped by replacing the active database with a selected snapshot, followed by an application-level verification of Articles, Revisions, and Settings.

On POSIX, Skladno restricts its data directory and database files to the current user. Windows and browser-selected folder access use platform permissions.

## Consequences

Migrations stay small and auditable, and recovery does not require a second persistence format. Downgrade migrations and in-place restore are unsupported. Legacy prototype data is not preserved by the one-time transition.

## Verification

Database and backup tests cover ordered transactional migrations, repository recovery, snapshot creation, retention, and permissions where the platform exposes them. The release recovery drill verifies a real snapshot without using private production data.

