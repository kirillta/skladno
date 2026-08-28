# MVP release, recovery, and limitations

Use this guide to prepare and verify the browser-based local-first MVP and the unsigned Windows Electron preview. Do not put credentials, an author's Article, or a production database in release evidence.

## Release checklist

1. Start from a clean worktree and install the locked dependencies with `npm ci`.
2. Run the release checks:

   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run test:e2e
   npm run build
   npm run product:check
   ```

3. Complete the [accessibility release walkthrough](accessibility-release-walkthrough.md). Its unresolved manual blockers must have an explicit release decision and linked follow-up.
4. Run the clean-profile journey below using a new, empty `SKLADNO_DATA_DIR`. Use a disposable provider credential supplied outside the repository, or verify the non-AI steps without one.
5. Create a manual backup in a private test folder and complete the recovery drill. Record only command results, versions, and pass/fail outcomes.

## Clean-profile manual author journey

Set a new empty data folder for the local service, copy `.env.example` to an untracked `.env` only when AI verification is in scope, then run `npm run dev` and open `http://localhost:5173`.

1. In Settings, verify General, Key bindings, AI, Publishing, and Data & backups open. Select a backup folder that is private to the test account and create a manual backup.
2. Create an Article named `Release check` with the body `A short public release fixture.` and save a Revision.
3. Request an editorial improvement. Confirm the Article remains unchanged until a Proposal is explicitly accepted; accept it and confirm a new Revision appears.
4. In Revisions, restore the initial Revision and confirm restoration appends another Revision instead of rewriting history.
5. Request a fact check. Confirm Findings are advisory, cite sources, and do not alter the Article.
6. Configure a translation language, create a translation, and confirm it opens as a linked, independently editable Article.
7. Use the Status Bar Copy control for Markdown and plain text. Confirm it copies output only; it must not publish to a platform.
8. Restart the service and confirm the Articles, Revisions, settings, and backup policy remain available.

Mark a step failed if it silently changes the Article, loses Revision history, exposes a credential, or cannot be recovered. Capture a linked defect rather than substituting private content in the report.

## Recovery drill

This drill proves recovery from a backup snapshot; it intentionally replaces the active database. Use the clean-profile data folder, not a maintainer's working data.

1. Stop Skladno completely.
2. Make a separate copy of the current `skladno.sqlite` from the configured `SKLADNO_DATA_DIR`.
3. Copy the selected manual backup `.sqlite` over that folder's `skladno.sqlite`.
4. Restart Skladno and verify the Article, its Revision history, and Settings state from before the backup are present.
5. Record pass/fail, the application revision, OS and browser version, and the backup filename. Do not record the data-folder path if it identifies an author or shared location.

If backup creation fails, leave the active database alone, check the folder permission, and retry. Browser backups require a browser with directory-picker support and retained folder permission. Manual backups are never removed by automatic-backup retention.

## Release boundaries

Verify local data and recovery against [ADR-005](../architecture/adr-005-article-state-and-consistency.md) and [ADR-006](../architecture/adr-006-sqlite-lifecycle-and-recovery.md). Verify diagnostics, AI completion and storage, and renderer isolation against [ADR-004](../architecture/adr-004-local-diagnostics.md), [ADR-007](../architecture/adr-007-completion-gated-editorial-engine.md), and [ADR-008](../architecture/adr-008-loopback-service-trust-boundary.md).

The supported releases are the browser-based local-first MVP and the unsigned Windows preview described below. The [cross-cutting inventory](../product/cross-cutting-inventory.md) owns deferred product boundaries. Publishing profiles remain guidance and Copy remains the only publishing action.

## Windows Electron preview

The preview target is Windows 11 x64. It is unsigned, so Windows may show a SmartScreen warning. GitHub prerelease updates are optional, author-controlled, and unsigned; signing remains in issue #168. Native backup folder selection, Explorer reveal, and manual snapshots use the restricted desktop Settings client.

Build the unpacked application with `npm run package:electron`, or build the Squirrel.Windows installer with `npm run make:electron`. Both commands build the existing React application first. The packaged renderer uses local IPC and does not require the loopback HTTP server.

Environment-variable credentials remain supported. Managed credentials use Windows Credential Manager and never enter SQLite, backup snapshots, or renderer responses. The installer does not create or import a `.env` file.

### Desktop acceptance scenario

Run this pass with a disposable `SKLADNO_DATA_DIR` and no private content:

1. Install and launch the x64 preview. Record the expected unsigned-app warning. Confirm the workspace opens, then launch Skladno again and confirm the existing window restores and receives focus.
2. Complete the clean-profile author journey above through Article creation, Draft checkpointing, Revision save and restore, Proposal acceptance, fact checking, translation, Settings, theme changes, keyboard navigation, and Copy. In Settings, add a managed API key, verify its connection, restart the app, verify it again, then remove the inactive connection. Confirm the key is held only in Windows Credential Manager and the app does not start the HTTP server.
3. Open HTTP and HTTPS links and confirm they use the system browser. Confirm file and custom-scheme navigation does not open. Test light and dark themes and the Windows 11 keyboard accessibility pass.
4. Remove the configured provider credential, retry an AI operation, and confirm the UI reports the unavailable configuration without exposing provider details. Repeat while offline, cancel an in-progress request, and confirm incomplete output does not change the Article.
5. Edit the active Article and close the window before the normal checkpoint delay. Restart and confirm the Draft reopens. Exercise the failed-checkpoint dialog with a disposable unwritable or conflicted fixture and verify both returning to the Article and explicitly quitting without the latest checkpoint.
6. Restart and confirm Articles, Drafts, Revisions, Settings, Findings, and completed Assistant output persist. Upgrade or reinstall over the same data directory and repeat the check.
7. In Data & backups, request Delete all local data and cancel the native confirmation; verify the disposable data is unchanged. Repeat with Create backup and delete, confirm the app exits, and verify only the disposable data directory was removed. Restart to confirm a new empty local profile opens.
8. With a separate disposable profile, uninstall Skladno. Confirm the installer removed the application but left that profile’s `.skladno` directory unchanged, then remove the disposable data manually.

### Preview update drill

Create a draft GitHub prerelease with the setup executable, `RELEASES`, and full `.nupkg`, then publish it only after this drill passes. Install an older preview into a disposable profile, create an Article, Draft, Revision, and Settings change, then use General Settings to check, explicitly download, and Restart and update. Confirm all data reopens and the update status becomes current.

Exercise failed discovery, failed download, and failed snapshot paths. A failed checkpoint or snapshot must leave the existing preview open. For a failed upgraded startup, follow the public [update recovery guide](../../user/update-recovery.md): reinstall the previous preview and restore its matching pre-update snapshot. Record old and new versions, Windows architecture, pass/fail, recovery result, and remaining checks without private paths or Article content.

Mark the desktop pass failed if the renderer gains Node, filesystem, database, credential, or unrestricted IPC access; if generated content changes an Article without approval; or if install, upgrade, reinstall, or uninstall changes `.skladno` data.
