# Skladno 0.5.6: move to Warplyn

Skladno continues as **Warplyn**, a separately installed application. This is the final Skladno announcement release. Skladno no longer checks for or downloads further updates in this build.

Open the [migration guide](https://main.dhsgh2xsr7g3j.amplifyapp.com/docs/migration.html) for Warplyn downloads and recovery instructions. This is the initial AWS Amplify address while the canonical `warplyn.com/docs/migration.html` domain certificate is being verified.

1. Finish active AI work and reopen Skladno so the latest Draft is checkpointed.
2. In Data & backups, create a manual backup. Keep the `.sqlite` snapshot and adjacent `.sqlite.skills` directory together with their original names.
3. Install Warplyn separately, then restore that backup in its Data & backups settings. Restore replaces any existing Warplyn work; back it up first.
4. Verify Articles, Drafts, Revision and Assistant history, publishing settings, and Author Skills.
5. Add managed API keys again and select the replacement connections and models. Environment-based connections require the corresponding variables in the new process environment.
6. Choose a separate ongoing backup folder and review Warplyn's update and telemetry preferences.

Keep Skladno, its data, and the migration backup until you have verified the restore. The apps do not synchronize or merge subsequent edits. Older database-only backups cannot restore Skill files they never contained.

You can export a supported backup directly from an earlier Skladno build; installing this announcement build is not required. Linux installation remains a manual package-manager operation. Both applications remain unsigned.
