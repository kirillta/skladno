# Windows preview update recovery

Skladno preview updates are optional and unsigned. If an update cannot start cleanly after a restart, do not open the newer database with an older preview.

1. Reinstall the prior preview version from its GitHub release.
2. Restore the matching pre-update SQLite snapshot recorded by Skladno before the update.
3. Start the prior preview and verify the expected Articles, Drafts, Revisions, and Settings.

Use a disposable profile for the release drill. Record only versions, Windows architecture, pass/fail, and recovery result; never include an Article, credential, or private path.
