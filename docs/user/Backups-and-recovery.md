# Backups and recovery

Choose a **Backup folder** in **Settings → Data & backups**, then select **Create backup**. In supported web browsers, Skladno asks the browser for permission to write snapshots only in that folder. Snapshots contain your local Articles, Revisions, Draft checkpoints, Assistant records, and Settings. They never include `.env` files or API keys.

Set **Automatic backups** to Daily to create one snapshot the first time Skladno opens each day, while the browser still permits the chosen folder. Retention removes only older automatic snapshots; manually created backups are always kept.

## Restore a backup

Restoring replaces the active local database, so first stop Skladno completely.

1. Keep a copy of your current local database as a precaution.
2. Copy the selected backup `.sqlite` file over `skladno.sqlite` in your configured Skladno data directory.
3. Start Skladno again and verify your Articles and Revisions.

If a backup cannot be created, Skladno leaves the active database and your editing session unchanged. Check that the destination exists and that your account can write to it, then retry.
