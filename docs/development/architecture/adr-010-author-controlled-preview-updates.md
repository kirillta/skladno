# ADR-010: Windows preview updates remain author-controlled

- Status: Accepted
- Date: 2026-08-27
- Scope: Windows preview distribution, update discovery, apply and restart, and recovery
- Depends on: [ADR-006](adr-006-sqlite-lifecycle-and-recovery.md), [ADR-008](adr-008-loopback-service-trust-boundary.md), [ADR-009](adr-009-native-settings-credentials-and-data-switching.md)

## Context

Skladno distributes an unsigned Windows 11 x64 preview through GitHub Releases and Squirrel.Windows. Preview users need updates before paid Windows code signing is justified. An update can replace application binaries and start forward-only SQLite migrations, so it must not bypass Draft recovery, database shutdown, or author choice.

GitHub Releases can host the installer, full package, and `RELEASES` manifest required by Squirrel.Windows. Electron's public update service ignores releases marked as prereleases and would add another network recipient. Skladno already needs separate discovery and download actions, so that service adds no useful capability here.

## Decision

Keep Windows 11 x64 as the only update target. Publish preview builds as GitHub prereleases with SemVer tags such as `v0.1.0-preview.2`. A security-related preview uses the exact optional suffix `.security`, for example `v0.1.1-preview.1.security`. The release workflow validates the tag and package versions.

Use GitHub directly. General Settings requires the author's persisted network permission, confirmed in an in-app dialog naming GitHub and the data boundary, before a packaged Electron main process checks public release metadata; after consent, it checks at startup and at most once every 24 hours unless the author disables automatic checks. It uses Electron's Chromium network stack so normal system networking policy applies. Settings contains the permission and automatic-check switches, current version, check status, release summary, explicit Check, Download, and Restart actions, plus privacy and recovery guidance. Discovery sends the repository identity, installed version, platform, architecture, and normal connection metadata to GitHub. It sends no device identifier, account, Article content, or analytics.

Only the newest compatible prerelease is offered. The author may ignore it indefinitely. Skladno never forces a check, download, deadline, restart, or install because an update is security-related. The `.security` suffix changes the visible warning only.

After discovery, Electron's native Squirrel updater downloads only when the author requests it. Skladno points it at the selected GitHub release assets. It validates external metadata before it becomes renderer-safe update state. Raw GitHub and Squirrel errors remain in the privileged process and are mapped to stable, localized failures.

The Article Status Bar and Article Library utility area show one update controller when an action is relevant. The controller presents available, downloading, ready, security warning, and failed states with accessible names and non-color cues. Downloading uses a quiet pulse; reduced-motion mode uses a static busy mark. Clicking it opens General Settings and focuses Updates. Detailed actions and failures remain in Settings.

Restart and update is explicit. It first obtains the latest Draft checkpoint and creates a pre-update SQLite snapshot. Either failure cancels the update. It then closes streams, application services, and SQLite through the existing shutdown path before applying the staged update. Ordinary close and operating-system shutdown do not apply it.

The runtime records the prior version and recovery snapshot outside SQLite. Startup marks the update successful only after SQLite opens, migrations complete, application services start, and the renderer reports ready. Retain one snapshot from the previous installed version until the next update succeeds. A failed installation may use Squirrel recovery. After a migrated startup, rollback means reinstalling the prior preview together with restoring its matching pre-update snapshot. Opening a migrated database with an older binary alone is unsupported.

CI creates a public GitHub prerelease, uploads the installer, `RELEASES`, and full package, and validates the complete asset set. The documented disposable-profile upgrade drill runs against that prerelease. Windows signing remains required before stable distribution and is tracked in issue #168.

## Consequences

Preview users receive updates without a signing certificate or a separate update server. They still see unsigned-publisher warnings, and Windows policy may block installation. HTTPS and Squirrel package integrity do not establish Authenticode publisher identity, so the preview must not be described as signed or suitable for general enterprise distribution.

The renderer gains only a narrow desktop update client and validated state. GitHub access, release selection, Squirrel control, snapshots, and restart authority stay in Electron main. Browser and development builds expose no updater imitation.

The release process becomes deliberately manual at publication. Percentage rollout, multiple channels, downgrade migrations, mandatory security updates, update analytics, macOS, Linux, ARM64, and stable-release signing remain outside this decision.

## Verification

Focused tests cover tag validation, release metadata validation, update state transitions, 24-hour scheduling, security-warning presentation, reduced-motion behavior, renderer-safe failures, Draft and snapshot gates, shutdown reuse, and startup success marking.

The Windows release drill installs the previous preview into a disposable data directory, creates an Article, Draft, Revision, and Settings, updates through the staged flow, and verifies that all local data reopens. It also exercises failed discovery, failed download, failed snapshot, deferred restart, and documented snapshot rollback without recording private paths or Article content.
