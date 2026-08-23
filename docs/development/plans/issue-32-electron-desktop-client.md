# Issue #32 implementation plan: Windows Electron preview

- Status: Active
- Issue: [#32](https://github.com/kirillta/skladno/issues/32)
- Milestone: P3 - Electron desktop
- Target: Windows 11 x64 unsigned preview

## Outcome

Ship the existing React application as an installable Electron preview without duplicating product behavior or granting renderer privileges. The preview uses the existing typed application client over context-isolated IPC, opens the existing `~/.skladno` data, and preserves every current author workflow.

The public signed release remains in [#35](https://github.com/kirillta/skladno/issues/35) because Windows signing is paid. Automatic updates also remain in #35.

## Dependencies

Complete [#144](https://github.com/kirillta/skladno/issues/144) before enabling browser and Electron processes against the same database. It must make stale-state checks atomic, add expiring Article edit leases with read-only fallback, version shared global state, and coordinate migrations across processes.

Issue #32 may develop the shell in parallel, but its packaged acceptance scenario is blocked until #144 passes cross-process tests.

## Preserved contracts

The implementation must preserve the capabilities returned by:

```powershell
npm run product:impact -- packages/electron/src packages/server/src/index.ts packages/server/src/infrastructure/electron packages/web/src/application-client.ts package.json
```

In particular:

- The renderer receives no credentials, database or filesystem handles, provider clients, raw errors, or unrestricted IPC.
- The browser and Electron clients use the same `EditorialWorkspaceClient` behavior.
- Draft checkpoints remain mutable recovery state. Revisions remain immutable and append-only.
- Proposals and Findings remain Revision-bound. Generated text changes an Article only after explicit author acceptance.
- Assistant and editorial streams persist output only after valid completion.
- System environment variables remain the provider credential source. Electron does not add a credential editor or packaged `.env` contract.
- Ordinary install, upgrade, and uninstall never delete or rewrite `~/.skladno`.

## Implementation sequence

### 1. Add the Electron composition root

Add the minimum Electron runtime under `packages/electron`:

- Construct the existing server application services directly in the main process.
- Register the existing Electron IPC adapter.
- Expose only `EditorialWorkspaceClient` from the preload bridge.
- Load the built React SPA in one `BrowserWindow`.
- Select the Electron client at renderer startup without introducing a second React application or global store.
- Keep the browser HTTP client and development workflow unchanged.

Completion criterion: development Electron launches the current SPA and completes typed health, Article, Settings, Assistant-stream, and editorial-stream operations without starting the HTTP server.

### 2. Harden the window boundary

Configure the production window with context isolation and sandboxing enabled, Node integration disabled, a narrow preload, and no remote module. Deny new windows and in-renderer navigation. Open validated `http` and `https` links with the system browser and reject other schemes.

Acquire Electron's single-instance lock before composing services. A second launch focuses and restores the existing window. Persist safe window bounds locally, and move invalid or off-screen bounds onto the active display. Closing the only window exits the app; there is no tray or background mode.

Completion criterion: automated main-process tests prove the security preferences, navigation policy, single-instance focus behavior, and safe bounds restoration.

### 3. Make shutdown recovery-safe

Before closing, ask the renderer to finish the active Draft checkpoint. Continue only after success. On failure, show actions to return to the Article or quit without the latest checkpoint. Do not imply that a failed checkpoint was saved.

Cancel active Assistant and editorial streams during shutdown and close application services and SQLite handles in order. Release the active Article lease through #144's lifecycle contract.

Completion criterion: tests cover successful close, failed checkpoint cancellation, explicit quit after failure, stream cancellation, lease release, and database close.

### 4. Package one Windows preview

Use Electron Forge with Squirrel.Windows. Package only Windows 11 x64 in #32. Set:

- Application ID: `io.github.kirillta.skladno`
- Product name: `Skladno`
- Version: the root package SemVer
- One high-contrast `S` monogram source icon, with generated Windows assets
- ASAR packaging and supported Electron security fuses

Keep maker configuration localized so [macOS #146](https://github.com/kirillta/skladno/issues/146) and [Linux #147](https://github.com/kirillta/skladno/issues/147) can add makers without changing runtime code. Do not add auto-update code, signing credentials, a tray, protocol handlers, or a portable build.

Completion criterion: a clean Windows checkout produces an installable x64 artifact whose metadata, icon, application ID, and version are correct.

### 5. Add CI and prerelease delivery

Keep the existing Ubuntu quality job. Add a Windows job that builds and tests Electron on pull requests without publishing. On a matching prerelease tag such as `v0.1.0-preview.1`, build the installer and attach it to a GitHub prerelease.

Reject tag and root-package version mismatches. Label the artifact and release notes as unsigned, document the expected Windows warning, and state that #35 gates a signed public release. Keep workflow permissions read-only except for the release job's minimum contents permission.

Completion criterion: a test prerelease tag produces one reproducible unsigned installer, while pull requests cannot publish artifacts as releases.

### 6. Record the product change

Update `product-model/areas/application.json` so the Electron shell is no longer deferred and the desktop capability records the Windows preview limitation. Update `product-model/areas/cross-cutting.json` to remove only the Electron client from the deferred alternate-client boundary. Add product scenarios for packaged startup, safe IPC, Draft-preserving close, and data-preserving reinstall.

Regenerate the affected inventories. Update ADR-001 and ADR-008 with the implemented Electron composition root and runtime boundary. Extend the release guide with the Windows preview build, install, warning, environment-variable, recovery, and uninstall behavior.

No glossary entry is needed: Electron, IPC, installer, and Article lease are implementation terms, not author-facing domain concepts. Add a term only if the final UI introduces a named product concept.

Completion criterion: canonical product records match the shipped behavior, generated docs are current, and architecture documents contain no remaining claim that the Electron bootstrap is deferred.

## Verification

Run focused checks while implementing, then finish with:

```powershell
npm run product:impact -- <affected paths>
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run product:docs -- application
npm run product:docs -- cross-cutting
npm run product:check
```

Electron-specific automated coverage must include:

- Main/preload IPC allowlisting, malformed payload rejection, renderer-safe errors, streaming, and cancellation.
- Production `webPreferences`, navigation denial, external-link validation, and single-instance focus.
- Draft checkpoint coordination and ordered shutdown.
- Shared-database behavior supplied by #144.
- Packaged application launch, Article reopen, Draft edit, Revision save, restart, and persistence.
- One deterministic AI Proposal request, stream completion, explicit acceptance, and resulting Revision.
- Install over an existing `~/.skladno`, upgrade/reinstall, and uninstall without data deletion.

Perform and record a manual Windows 11 x64 pass through every user-visible workflow. Include keyboard navigation, light and dark themes, missing environment variables, offline/provider failures, cancellation, restart recovery, a second launch focusing the first window, external links, installer warning, reinstall, and uninstall. Use disposable data and no real credentials or private Articles.

## Follow-up boundaries

- [#35](https://github.com/kirillta/skladno/issues/35): paid Windows signing and automatic updates.
- [#145](https://github.com/kirillta/skladno/issues/145): explicit, backup-aware deletion of all local data from Settings.
- [#146](https://github.com/kirillta/skladno/issues/146): signed and notarized macOS distribution.
- [#147](https://github.com/kirillta/skladno/issues/147): one evidence-selected Linux distribution target and package format.
- Existing Electron Settings work remains in [#34](https://github.com/kirillta/skladno/issues/34). Issue #32 does not add native backup pickers, credential-vault storage, restore, or data relocation.

## Done

Issue #32 is complete when the unsigned Windows 11 x64 prerelease installs, runs the existing application through the secured IPC boundary, passes focused automation and the full manual workflow checklist, preserves local data across restart/reinstall/uninstall, and leaves signing, updates, destructive deletion, macOS, and Linux in their linked issues.
