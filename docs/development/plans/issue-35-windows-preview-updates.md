# Issue 35: Windows preview updates

## Outcome

Deliver author-controlled updates for the unsigned Windows 11 x64 preview through GitHub Releases and Squirrel.Windows. Keep signing in issue #168 and keep every current Article, Draft, Revision, Settings, trust-boundary, and data-preservation guarantee.

The lasting decisions are in [ADR-010](../architecture/adr-010-author-controlled-preview-updates.md).

## Phase 1: Release artifacts and version contract

- Extend `scripts/check-electron-release-tag.mjs` and its test to accept `v<version>-preview.<n>` plus the exact optional `.security` suffix while keeping root and Electron package versions equal.
- Change `.github/workflows/electron-windows.yml` to create a public GitHub prerelease, upload the setup executable, `RELEASES`, and full `.nupkg`, and fail if any required asset is missing.
- Keep GitHub's prerelease flag. Run the upgrade drill against the published prerelease.
- Update release copy so it states that the build and updater are unsigned and links signing to #168.

## Phase 2: Narrow desktop update boundary

- Add renderer-safe update types and validation in `packages/shared`. Model lifecycle states as a discriminated union so invalid combinations such as ready-without-a-version cannot reach React.
- Add a separate context-isolated desktop update client beside the existing desktop Settings client. Browser and development builds receive no update client.
- In Electron main, discover GitHub prereleases, select only the newest compatible Windows x64 version, recognize only the `.security` tag suffix, and map network or Squirrel failures to stable error codes.
- Persist the automatic-check preference, last successful check, staged version, prior version, snapshot reference, and startup-success marker in the existing atomic runtime settings file. Store no Article content or raw remote response.
- Check shortly after packaged startup and no more than once per 24 hours. Disabling checks stops future scheduling but does not attempt to cancel a native download.

## Phase 3: Download, restart, and recovery

- Drive Electron's built-in `autoUpdater` from a small update coordinator with explicit available, downloading, ready, failed, and applying transitions. Use GitHub release assets as the Squirrel feed.
- Download only after the author requests it. Keep a downloaded update staged across ordinary close.
- Route Restart and update through the existing Draft-checkpoint and application shutdown path. Unlike ordinary quit, a failed checkpoint cancels the update with no force option.
- Before shutdown, create and validate a SQLite snapshot. Abort if it fails. Retain one snapshot from the previous installed version until the next update completes a successful startup.
- Mark startup successful only after SQLite and services open and the renderer signals ready. Do not promise database downgrade. Recovery reinstalls the prior preview together with its matching snapshot.

## Phase 4: General Settings and Article Status Bar

- Add an Updates group at the end of General Settings using `SettingRow`, shared controls, localized copy, and an enabled-by-default native switch.
- Show current version, last check, privacy disclosure, release title and plain-text summary, View release notes, Check now, Download, Restart and update, Retry, and Update recovery as state permits.
- Open GitHub release notes and the recovery guide in the system browser. Never render remote Markdown or HTML.
- Add one code-native `UpdateIcon` to `packages/web/src/ui/icons.tsx` and an `UpdateController` beside Revision and language in `ArticleStatusBar`.
- Keep lifecycle ownership outside the component. `UpdateController` maps validated state to the icon, accessible label, title, tone, quiet downloading pulse, reduced-motion fallback, security mark, and Settings navigation.
- Keep the controller hidden when updates are current, checking, disabled, or unsupported. Detailed status and retry controls stay in Settings.
- Inspect the desktop workspace, narrow workspace, General Settings, keyboard focus, tooltip, non-color states, and reduced-motion state.

## Phase 5: Product evidence and release guidance

- Update `application.electron-windows-preview` only when implementation lands. Remove the automatic-update limitation, retain unsigned and Windows-only limitations, and add automated scenarios for discovery, explicit download, guarded restart, accessible status, and recovery.
- Keep signed Windows distribution deferred to #168 in `cross-cutting.deferred-mvp-boundary`.
- Regenerate the application and cross-cutting inventories after canonical product-model changes.
- Extend `docs/development/guides/mvp-release-and-recovery.md` with prerelease publication, old-to-new updater installation, failure recovery, snapshot rollback, and the exact evidence fields to record.
- Add the public versioned update-recovery guide linked from General Settings.

## Checks

- Run `npm run product:impact --` for the changed Electron, shared, Settings, Status Bar, workflow, release guide, and product-model paths before implementation and preserve every matched scenario.
- Run focused shared validation, Electron coordinator and shutdown, Settings, Status Bar, release-tag, backup, and migration tests.
- Run `npm run product:check`, `npm run lint`, `npm run typecheck`, and the relevant workspace tests.
- Run the packaged Windows manual upgrade drill against the published prerelease. Record versions, Windows architecture, pass or failure, recovery result, and remaining checks without private paths or Article content.

## Explicitly deferred

- Windows Authenticode signing and publisher reputation, issue #168.
- Stable, beta, or percentage-based release channels.
- Mandatory security updates, background analytics, and device identifiers.
- Automatic database downgrade or opening a migrated database with an older binary.
- macOS, Linux, ARM64, Microsoft Store, and browser update flows.
