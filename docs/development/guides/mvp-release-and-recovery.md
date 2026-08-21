# MVP release, recovery, and limitations

Use this guide to prepare and verify the browser-based local-first MVP. It is a maintainer runbook, not an Electron release procedure. Do not put credentials, an author's Article, or a production database in release evidence.

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

## Privacy and MVP limits

- Articles, Draft checkpoints, Revisions, Assistant records, Settings, style samples, and backup snapshots are local SQLite data. Snapshots exclude `.env` files and API keys.
- Credentials are read only by the local service from environment variables; the browser receives neither their values nor direct filesystem or SQLite access.
- An author action is required before an AI request. Generated content stays a Proposal until accepted. Incomplete, cancelled, or failed requests do not modify the Article.
- The requested editorial context goes to the configured AI provider. Provider response storage is disabled by default; setting `SKLADNO_AI_SESSION_CONTINUATION=true` explicitly opts into eligible same-Article continuation.
- Diagnostics are local process output and redact credentials, Article/model bodies, raw error messages, and stacks. Windows backup-folder permissions are controlled by the selected folder's ACLs.
- The MVP has no accounts, sync, teams, analytics, direct publishing, import/export workflow, alternate providers, mobile/offline client, or packaged Electron application. Publishing profiles are guidance and Copy is the only publishing action.

## Electron boundary

The repository contains typed Electron IPC and a context-isolated preload bridge, but no Electron window/bootstrap or packaged desktop runtime. Do not represent the browser MVP as an Electron app.

Future desktop packaging is tracked in [#32](https://github.com/kirillta/skladno/issues/32). Native folder choice, secure credential storage, in-app backup restore, and data relocation are tracked in [#34](https://github.com/kirillta/skladno/issues/34); they are not implemented by this guide.
