# Linux desktop support plan

## Goal

Ship an unsigned Skladno preview for Ubuntu 22.04 x64 and compatible Debian-based distributions as a `.deb`
package. The Linux app must preserve the same Article, Draft, Revision, backup,
credential, privacy, and renderer-isolation guarantees as the Windows app.

The first release uses the system package manager or a manual `.deb` reinstall
for updates. Electron does not support `autoUpdater` on Linux, so the app must
not show Windows download or restart actions there.

## Decisions

- Use Ubuntu 22.04 x64 as the release-validation baseline and allow compatible Debian-based distributions to install the same package. Add ARM64, RPM, Snap, Flatpak, and
  AppImage only after demand and a maintainer test environment exist.
- Publish one `.deb` per stable or preview GitHub release from an Ubuntu CI job.
  Keep the Windows workflow and its Squirrel assets unchanged.
- Reuse the existing Electron renderer, IPC clients, native dialogs, folder
  reveal behavior, runtime settings, SQLite recovery, telemetry boundary, and
  shutdown flow.
- Use `@napi-rs/keyring` with Linux Secret Service for managed credentials. Do
  not fall back to a plaintext file or the non-persistent kernel keyring. If no
  Secret Service is available, keep environment-variable connections usable
  and report that managed credentials are unavailable.
- Store app runtime files through Electron's Linux `userData` directory and
  keep Article data in the existing resolved `.skladno` data directory. A Linux
  install, upgrade, reinstall, or uninstall must not remove author data.
- Keep Linux update settings unavailable until the project has a package
  repository or another update mechanism that preserves the existing explicit
  checkpoint and recovery gates.

## Implementation

### 1. Make startup platform-aware

Owners:

- `packages/electron/src/presentation/main.ts`
- `packages/electron/src/presentation/updates/desktop-updates.ts`
- `packages/electron/src/presentation/updates/desktop-update-coordinator.ts`
- focused Electron update and startup tests

Guard Squirrel startup handling, the Windows AppUserModelID, and construction
of the Squirrel update coordinator with `process.platform === "win32"`. Expose
the existing desktop update client only when native updates are supported, as
the web Settings code already handles an absent desktop update client. Do not
add a fake Linux updater.

Acceptance:

- A packaged Linux process starts without calling Squirrel or `autoUpdater`.
- About Settings shows the version and no unsupported check, download, channel,
  or restart controls.
- Windows update discovery, recovery snapshots, and restart behavior retain
  their current tests and product contract.

### 2. Supply a Linux credential adapter

Owners:

- `packages/server/src/application/settings/credential-store.ts`
- `packages/server/src/infrastructure/configuration/windows-credential-store.ts`
- a new Linux adapter beside the Windows adapter
- `packages/server/src/local-application.ts`
- focused credential-store and Settings tests

Select the credential adapter once in the composition root. Keep the existing
`CredentialStore` port and service identifier. The Linux adapter must require
Secret Service and translate missing D-Bus, locked collection, or unavailable
service failures into `managed_credentials_unavailable`. It must never persist
an API key in SQLite, runtime JSON, diagnostics, or a fallback file.

Acceptance:

- A key added under GNOME Keyring survives app restart and can be renamed,
  tested, and removed through the existing Settings flow.
- Starting without Secret Service leaves Article editing and
  environment-variable AI connections available.
- Renderer responses and logs never contain the key.

### 3. Package a Debian application

Owners:

- `packages/electron/package.json`
- `packages/electron/forge.config.js`
- `packages/electron/assets`
- root package scripts and lockfile

Add Electron Forge's Debian maker and a `make:electron:linux` script that runs
on Linux x64. Use the existing SVG or PNG icon, Debian package name `skladno`,
desktop category `Office`, and the repository URL as the homepage. Change the
native-module copy hook to select the current platform package instead of
always copying `keyring-win32-x64-msvc`; include only
`keyring-linux-x64-gnu` in the Linux package.

Keep `package:electron` useful on the host platform. Keep the current
`make:electron` Windows command as a compatibility alias until release scripts
and documentation use explicit Windows and Linux names.

Acceptance:

- `dpkg-deb --info` reports the expected name, version, architecture,
  maintainer, and desktop metadata.
- The installed launcher uses the correct icon and opens one Skladno window.
- The package contains the Linux keyring binary and no Windows keyring binary.

### 4. Add Linux CI and release assets

Owners:

- a new `.github/workflows/electron-linux.yml`, or a Linux job in the existing
  Electron release workflow
- `scripts/check-electron-release-tag.mjs`
- release script tests when asset validation changes

On pull requests, install with `npm ci`, run Electron tests, and build the Linux
package on `ubuntu-latest`. On a tag or manual dispatch, package telemetry with
the same approved public key, build the `.deb`, validate that exactly one x64
Debian asset exists, and upload it to the same GitHub release as the Windows
assets. Use `gh release upload --clobber` so independently finishing platform
jobs do not race to create the release.

Acceptance:

- Pull requests prove that the Linux native module loads and Forge can build.
- Stable and preview tags publish matching Windows and Linux versions.
- Release evidence contains versions and pass or fail results, never private
  paths, Article content, credentials, or production databases.

### 5. Record support and run the Linux acceptance pass

Owners:

- `product-model/areas/application.json`
- generated product inventories
- `docs/development/architecture/adr-009-native-settings-credentials-and-data-switching.md`
- `docs/development/architecture/adr-010-author-controlled-preview-updates.md`
- `docs/development/guides/mvp-release-and-recovery.md`
- user-facing installation and recovery documentation

Add a Linux desktop capability and scenarios rather than widening the Windows
capability until its Squirrel-specific contract becomes ambiguous. Amend
ADR-009 with the Secret Service choice. Keep ADR-010 scoped to Windows and
record package-manager updates as the Linux decision. Regenerate product docs.

Run the existing clean-profile, recovery, renderer isolation, close, external
link, telemetry, offline, and local-data deletion checks on an installed `.deb`.
Also verify GNOME Keyring locked and unavailable states, single-instance focus,
file picker and folder reveal behavior, desktop launcher integration, upgrade,
reinstall, and uninstall data preservation.

## Local WSL verification

The available environment is WSL2 with Ubuntu 22.04 x64. Install a Linux Node
22 toolchain plus `fakeroot`; `dpkg-deb` is already present. Work from a clone
inside the WSL filesystem rather than `/mnt/c` so native modules, permissions,
and package paths match Linux.

Use WSL for the focused loop:

```bash
npm ci
npm test --workspace @skladno/electron
npm test --workspace @skladno/server
npm run make:electron:linux
dpkg-deb --info packages/electron/out/make/deb/x64/*.deb
dpkg-deb --contents packages/electron/out/make/deb/x64/*.deb
```

If WSLg is available, install the `.deb` and run the smoke journey there. Treat
an Ubuntu VM or physical Ubuntu desktop as the release gate because WSLg does
not reproduce a normal login session, desktop launcher, Secret Service, or
uninstall environment reliably.

## Required checks

Before each implementation phase, run `npm run product:impact -- <affected
paths>` and preserve every matched scenario. Use focused tests during the
phase. After source and configuration changes, run `npm run verify`. After the
product-model edit, run `npm run product:docs` and `npm run product:check`.
Inspect links and commands, then run `git diff --check`.

The work is complete when CI publishes an installable `.deb` and the Ubuntu
desktop acceptance pass records no failures. A successful Forge build alone is
not Linux support.
