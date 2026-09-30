# Company repository and product-name migration

Status: execution in progress. Prepared 2026-09-28 against version 0.5.5. The original repository was transferred to `punk-link/skladno-legacy` and 60 active issues moved to `punk-link/warplyn`. Warplyn v0.6.0 is published. Phase 6 legacy implementation is prepared; announcement publication and installed acceptance remain pending.

## Outcome and decisions

Move stewardship to the company, preserve GitHub conversations, and ship the renamed product as a separate application. Authors explicitly install it and restore their Skladno backup. Their original application, data, credentials, and backups remain available.

Use two public repositories:

| Repository | Purpose |
| --- | --- |
| `COMPANY/skladno-legacy` | The transferred original repository, historical issues and PRs, existing releases, and final Skladno announcement release |
| `COMPANY/NEW-REPO` | Existing Git history plus renamed-product development, transferred active issues, and a separate release feed |

The Author benefit is continuity of writing and recoverability without a fragile installer upgrade. The tradeoff is a manual installation, backup restore, and API-key setup. GitHub conversations remain accessible, although historical work stays in the legacy repository.

Settled scope:

- Preserve the original repository through GitHub's native transfer. Do not delete it or recreate `kirillta/skladno`.
- Move active issues with native issue transfer after both repositories belong to the company. Do not recreate their comments under a bot account.
- Keep old and new release assets strictly separated. New installers never enter the legacy feed.
- Give the new app a distinct installation identity, data directory, Electron profile, credential namespace, and update source.
- Reuse the existing backup/restore flow for migration. Do not build automatic profile discovery or a second import engine for this beta.
- Preserve compatible database settings and Author Skills. Re-enter managed API keys; do not read or delete legacy secrets.
- Re-select machine-specific backup preferences. This deliberately narrows the earlier suggestion to copy runtime settings, because backup restore already provides the useful content migration.
- Continue the current version sequence for clarity, although separate app identities do not require it. Choose actual versions after checking published tags.
- Do not rename internal workspace package scopes, IPC names, or database schema solely for branding. They are not installation identity and changing them adds no Author benefit.

## Inputs to settle before execution

The maintainer supplies these values once; placeholders below are not commands to execute literally.

| Input | Required decision |
| --- | --- |
| Company organization | GitHub owner with permission to receive the transfer and create repositories |
| Product name and repository slug | Final visible name, `NEW-REPO`, executable name, Debian package name |
| Company application identifier | Stable provider-neutral identifier, preferably based on a company-controlled domain |
| Storage names | New default data-folder name and new environment-variable prefix |
| Public migration URL | Stable page containing installers, backup instructions, and recovery help |
| Versions | Final legacy stable version and first renamed-product version |
| Release owner | Person executing transfer, publication, issue transfers, and desktop acceptance |

Planning does not authorize external changes. Execute those actions only when migration execution is requested. Prepare code and release evidence before publication. Native issue transfers notify participants; include them in the explicitly authorized execution scope.

## Verified implementation and owners

Paths in this table are relative to the repository root.

| Responsibility | Current owner and behavior |
| --- | --- |
| Installer identity | `packages/electron/forge.config.js`: Squirrel name and app bundle ID `io.github.kirillta.skladno`, executable `Skladno`, Debian package `skladno` |
| Visible package name | `packages/electron/package.json`: `productName` is `Skladno` |
| Startup and OS identity | `packages/electron/src/presentation/main.ts`: app ID, user-data paths, restore startup, injected GitHub fetch |
| Updates | `packages/electron/src/presentation/updates/desktop-update-coordinator.ts`: legacy discovery URL and separately hardcoded release-download URL |
| Release selection | `packages/electron/src/presentation/updates/desktop-update-releases.ts`: newest compatible stable/preview by asset presence; no mandatory intermediate upgrade |
| Article storage | `packages/server/src/infrastructure/configuration/config.ts`: `SKLADNO_DATA_DIR` or home `.skladno`, database `skladno.sqlite` |
| Runtime settings | `packages/electron/src/infrastructure/runtime/runtime-settings.ts`: backup folder, update preferences/state, pending restore, telemetry consent/identity |
| Native snapshots | `packages/electron/src/presentation/settings/desktop-native-backup.ts`: consistent SQLite snapshot plus `.sqlite.skills` companion directory |
| Restore preparation | `packages/electron/src/presentation/settings/desktop-settings-recovery.ts`: validates and stages backup, checkpoints destination, creates recovery snapshot, restarts |
| Restore commit/rollback | `packages/electron/src/infrastructure/recovery/pending-restore.ts` and `author-skill-backup.ts` |
| Credentials | `packages/server/src/infrastructure/configuration/windows-credential-store.ts` and `linux-credential-store.ts`: OS secrets under the legacy service identifier |
| Settings presentation | `packages/web/src/settings/components/UpdatesSettingsGroup.tsx`, `DataBackupsSettingsSection.tsx`, and `AiConnectionsSection.tsx` |
| Release automation | `.github/workflows/electron-windows.yml`, `electron-linux.yml`, `site.yml`; `scripts/release.mjs` |

Current runtime settings do not persist a selected live data directory, despite the broader relocation contract in ADR-009. Custom source locations currently come from `SKLADNO_DATA_DIR`. Exporting through the running old app avoids guessing where its database is. Do not expand this migration into implementing general data relocation.

The final implementation must follow [ADR-006](../architecture/adr-006-sqlite-lifecycle-and-recovery.md), [ADR-008](../architecture/adr-008-loopback-service-trust-boundary.md), [ADR-009](../architecture/adr-009-native-settings-credentials-and-data-switching.md), and [ADR-010](../architecture/adr-010-author-controlled-preview-updates.md). UI work must follow the [design system](../ui/design-system.md) and [internationalization guide](../guides/internationalization.md).

## Phase 1: inventory and protect the release feeds

Owner: maintainer. No application behavior changes yet.

- [ ] Inventory published releases and tags, including highest stable and preview versions. Verify the current checkout is the intended starting point.
- [ ] Record open issues, labels, milestones, assignees, open PRs, Discussions, wiki, Projects, branch protections, repository rules, environments, integrations, Pages configuration, and package-registry links where present.
- [ ] Save a private Git mirror and a release-asset inventory with checksums. Git alone is not a backup of GitHub issues or releases; export issue/milestone metadata separately for reconciliation.
- [ ] Record the last supported Skladno backup format and an installed-version test matrix. Use disposable content only.
- [ ] Reserve the two company repository names and confirm public release access is allowed by organization policy.
- [ ] Prepare a concise migration page before the announcement release links to it. Until installers exist, it must clearly state that migration is not yet available.

Gate: there is a known legacy release baseline, an artifact inventory, and no ambiguity about which repository may publish each app.

### Phase 1 record, 2026-09-29

- Checkout `4492763b7468186a4229a6890ccb28bc12e32754` matches `origin/main`. The worktree already contained this untracked plan. The highest published stable release is `v0.5.5`; the highest published preview is `v0.4.0-preview.3`. There are 30 published releases and 101 release assets.
- A private mirror and GitHub metadata exports are in the maintainer's `skladno-migration-private` folder outside the repository. The mirror passed `git fsck --full --no-reflogs`. `release-assets.csv` records each asset URL, byte size, and GitHub-published SHA-256 digest. The binaries were not downloaded, so those digests have not been independently recalculated. `issues-and-prs.json`, `issue-comments.json`, `pulls.json`, `review-comments.json`, `milestones.json`, `labels.json`, and `issue-reconciliation.csv` support transfer reconciliation. Git does not contain those records.
- At inventory time there were 156 issues, 60 open issues, no open PRs, 9 labels, and 17 milestones. Branches and repository settings were exported. The repository reports no Discussions, Pages is not enabled, and the `main` branch has no protection or repository ruleset. `Production` and `github-pages` environments exist. Workflow permissions default to read. No webhooks were returned. The wiki flag is enabled, but its Git repository was not found. Project inventory requires a token with `read:project`, and package inventory requires `read:packages`; project membership and package links still need a maintainer check. GitHub App integrations could not be enumerated with this token.
- Last observed native backup format is a `.sqlite` snapshot with an adjacent `.sqlite.skills` directory and manifest format `1`. Older database-only `.sqlite` snapshots remain accepted. The checkout's latest database migration is version `22`; snapshot validation checks known applied migrations, integrity, and foreign keys. Installed-version testing remains to be done on disposable Windows 11 x64 and Ubuntu 22.04 x64 profiles: latest stable `v0.5.5`, highest preview `v0.4.0-preview.3`, and an older database-only backup source. Record backup/restore results and source hashes without private content.
- The migration page is at `site/user-docs/migration.md`, with `https://warplyn.com/docs/migration.html` chosen as its stable public URL. It says migration is unavailable until replacement installers and tested instructions exist. Site deployment is still pending.
- `punk-link` is the chosen organization; the repository slugs are `skladno-legacy` and `warplyn`. The authenticated maintainer is an active organization admin. Neither destination repository currently exists, and the organization allows members to create public repositories. Its existing public repositories show public repository access is in use. Organization Actions policy could not be read with the current token; check it before enabling release workflows. The legacy destination must remain uncreated for GitHub's native transfer, so name availability is verified but cannot be guaranteed until transfer. The `warplyn` repository is also deferred to Phase 3, when the plan calls for creating it with Actions disabled before history import.
- The maintainer authorized the Phase 2 transfer on 2026-09-29 with the recorded inventory limitations. `punk-link/skladno-legacy` alone may publish Skladno installers; the future `punk-link/warplyn` repository alone may publish renamed-app installers. Final product identity and installed-version migration checks remain requirements for later phases.

## Phase 2: transfer the original repository

Owner: maintainer. Depends on phase 1 and confirmed organization/name inputs.

- [x] Use GitHub's native repository transfer to move `kirillta/skladno` to `punk-link/skladno-legacy`. Keep it public.
- [x] Update local remotes and review collaborator permissions and assignees because personal-to-organization transfers can clear assignments for nonmembers.
- [x] Compare issues, comments, milestones, PRs, Discussions, tags, release assets, and repository settings with the inventory. Verify representative old URLs still resolve.
- [ ] Check organization Actions policies, workflow permissions, deployment environments, and installed integrations. Existing secrets may transfer, but company access and policy still need validation.
- [x] Verify the `Production` environment and `SKLADNO_POSTHOG_PROJECT_KEY` release configuration without printing secrets.
- [ ] Verify Pages and the existing `warplyn.com` recovery/documentation routes separately. Repository redirects do not migrate Pages routing. Keep old recovery links functional.
- [ ] Test the original GitHub release API URL and original download URLs for `RELEASES` and `.nupkg` from an actual packaged Skladno installation, including download and staged apply in a disposable profile.
- [x] Do not recreate a repository at `kirillta/skladno`, even as a redirect placeholder.

Gate: old installations still discover and download legacy releases after transfer. If redirects fail in the actual client, stop publication and diagnose that path. Do not send renamed packages through it as a workaround. Existing users can still receive manual legacy installer instructions.

GitHub documents preserved repository assets and URL redirects, and warns that reusing the original location deletes redirects. This does not substitute for the native updater drill. [Repository transfer documentation](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository).

### Phase 2 record, 2026-09-29

- Native transfer completed through `gh api` with `new_owner=punk-link` and `new_name=skladno-legacy`. Repository ID `1315173608`, public visibility, and `main` commit `4492763b7468186a4229a6890ccb28bc12e32754` are preserved. The checkout's `origin` now uses `https://github.com/punk-link/skladno-legacy.git`. The private pre-transfer mirror remains unchanged.
- Before/after exports are in the private archive's `phase2` folder. Issue and PR issue-record comparisons found no changes to IDs, numbers, titles, bodies, state, comment counts, labels, assignees, milestones, or authors. All 92 PRs, 30 releases, 17 milestones, 9 labels, and 15 issue comments retain their IDs. Milestone descriptions/due dates, label colors/descriptions, and comment bodies/timestamps match. All branch/tag refs and all 101 asset names, sizes, and published digests match. Discussions remain disabled; there were no review comments. The wiki remains unverified as recorded in Phase 1.
- `kirillta` retains admin access. Organization access now also grants `vasiariabov` admin and `Dronsan89` and `Alpha17Skirata` write access. No permissions were changed manually. Issue assignments match the immediate pre-transfer inventory.
- Repository Actions remain enabled with all actions allowed; workflow permissions remain read and cannot approve PRs. Both `Production` and `github-pages` environments remain present. `Production` contains a nonempty `SKLADNO_POSTHOG_PROJECT_KEY`; its value was not printed. Repository and Production secret listings are empty. Repository rulesets and webhooks remain empty; `main` remains unprotected. Organization Actions policy requires `admin:org` scope, and installed GitHub App integrations still require a separate authorized settings check.
- Anonymous requests to the original release API, issue `168`, and release `v0.5.5` resolve successfully to the transferred repository. The original `v0.5.5/RELEASES` and full `.nupkg` download URLs work. Downloaded SHA-256 hashes exactly match the Phase 1 inventory: `e3410c0030fcf511105f8e20d049632885f5e2089826084585e3d54c35020cb7` and `0139206fe0e4d1950c4bc980159fdd830d7046eefe1bea07b833242b40f4623e` respectively.
- Pages is disabled, matching the pre-transfer inventory. Site run `36445502932` failed on 2026-09-28 before transfer because Pages was not enabled. On 2026-09-29, the public update-recovery, backups-and-recovery, and migration routes all returned HTTP `421 Misdirected Request` through Cloudflare with an nginx response. Hosting/domain recovery remains outstanding; repository redirects do not repair it.
- **Gate remains open:** run the actual installed Skladno update discovery, download, and staged-apply drill in a disposable profile, restore the public documentation routes, and finish the restricted organization-policy/integration checks. No installed Squirrel application was found for the native drill in this session. Successful anonymous downloads do not prove the installed updater path. No releases were published and no repository was recreated at the old location.

## Phase 3: create the new repository and move active work

Owner: maintainer. Depends on phase 2.

- [ ] Create an empty public `COMPANY/NEW-REPO`. Disable Actions before importing refs so old workflows cannot publish legacy installers or deploy the old website from the new repository.
- [ ] Push the existing Git history and intended branches/tags. Do not copy release assets or blindly mirror GitHub-owned refs. Mark historical tags as inherited history, not renamed-app downloads.
- [ ] Keep license notices and contributor attribution. Update ownership metadata without rewriting history.
- [ ] Copy labels with their descriptions/colors. Recreate milestones needed for active work with matching titles and exact due dates, preserving descriptions and state where applicable.
- [ ] Test one approved active issue transfer. Verify its conversation, attachments, author attribution, assignment, labels, milestone, and old-URL redirect before transferring the rest.
- [ ] Transfer remaining active issues and record an old-to-new issue URL map. Issue numbers can change. Native transfer requires both repositories to have the same owner.
- [ ] Keep closed issues and historical PRs in the legacy repository. For active PRs, finish suitable legacy work there or reopen the branch in the new repository with a link to the original review. Do not represent recreated PRs as preserving review history.
- [ ] Keep historical Discussions and wiki content accessible in legacy. Link them from the new repository; move ongoing discussion only if a separate move is needed and verified.
- [ ] Review Projects separately. User/organization Projects are not Git commits; verify transferred issues' project membership, fields, and access. Retain the existing board if usable rather than rebuilding it by default.
- [ ] Rewrite active documentation references such as bare `#168` to mapped new issues or fully qualified legacy URLs. Do not edit old comments or commits solely to renumber references.
- [ ] Configure branch protections, environments, collaborators, and required checks in the new repository before enabling its corrected workflows.

Example for an individually reviewed issue:

```powershell
gh issue transfer https://github.com/COMPANY/skladno-legacy/issues/123 COMPANY/NEW-REPO
```

Gate: every active issue is accounted for, comments remain attached to their authors, destination milestones are correct, and historical work remains reachable. GitHub preserves comments and assignees on native issue transfer, with label/milestone matching rules. [Issue transfer documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/transferring-an-issue-to-another-repository).

## Phase 4: build the independently installed renamed app

Owner: implementation maintainer, in the new repository. Depends on identity decisions; can proceed while active issues are reconciled.

- [ ] Change visible branding, icons if supplied, package metadata, installer filenames, shortcut labels, Debian metadata, site copy, and localized app references.
- [ ] Set distinct Squirrel package identity, executable, app ID, Debian package/binary identity, Electron `userData` location, default data directory, and credential service identifier on both supported platforms.
- [ ] Use the new environment prefix for the live data directory. Do not silently fall back to `SKLADNO_DATA_DIR`, which could make both apps open the same database. Document the new override and refuse known legacy-directory targets during migration.
- [ ] Keep the database filename and schema compatible unless a functional need requires changing them. Storage-directory separation provides isolation without a schema rename.
- [ ] Point both discovery call sites and the download base at `COMPANY/NEW-REPO`. Update recovery/help links, release workflow titles, Linux homepage assertions, and release asset checks.
- [ ] Keep the ordinary author-controlled update flow in the new app, including channel selection, checkpoint, snapshot, and restart safeguards.
- [ ] Give the new app fresh runtime update state and fresh network/telemetry consent. Never reuse the old telemetry installation ID or pending recovery records.
- [ ] Configure the new repository's release environment explicitly. Do not turn inherited old tags into releases by rerunning unmodified legacy workflows.

Gate: both apps can be installed and launched independently, with separate profiles and credential namespaces. Uninstalling either leaves the other's installation and both sets of Author data intact. An update check in either app cannot select the other app's releases.

## Phase 5: migrate through the existing backup and restore flow

Owner: implementation maintainer. Depends on phase 4 storage isolation.

The supported beta journey is explicit and uses existing controls:

1. In Skladno, finish or cancel active AI work and close/reopen the app to ensure the latest Draft checkpoint has completed. Stop external edits to Author Skill files during backup creation.
2. Select a private migration backup folder in Data & backups and create a manual backup from the active Skladno profile. This works even when its data directory was overridden.
3. Keep the `.sqlite` file and its adjacent `.sqlite.skills` directory together, with their original names. Close Skladno after backup creation.
4. Install and launch the renamed app into its separate empty profile. In Data & backups, select the migration backup folder and restore the Skladno snapshot. Confirm the replacement and restart.
5. Verify Articles, latest Draft, Revision history, Assistant history, settings, publishing profiles, and Author Skills before doing new writing.
6. Add managed AI connections again and select the replacement connections/models for the affected roles. Existing connection metadata may remain, but the old secrets are not available in the new namespace.
7. Select a separate ongoing backup folder for the new app. Keep the migration backup and legacy backups untouched. Choose update-network and telemetry preferences again.
8. Keep Skladno installed until the Author verifies the import. Subsequent edits belong to the app in which they were made; there is no synchronization or merge.

Implementation work and checks:

- [ ] Prove that the new app accepts legacy backup filenames, schema versions, and Skill manifests. Reuse `createNativeBackupRestoration` and the existing staged restore/rollback code.
- [ ] Preserve legacy manifest format identifiers even when visible branding changes. Validate content and supported schema, not the new product-name prefix.
- [ ] Test the native backup pair and older database-only snapshots. Explain that database-only backups cannot restore Skill files they never contained.
- [ ] Preserve all compatible SQLite settings and history without rewriting immutable Revisions. Do not claim that machine/runtime preferences are included in the backup.
- [ ] Verify imported managed connections without secrets report a useful missing-key state. Prefer the existing Add connection and role-selection flow over adding credential migration or a new secret editor.
- [ ] Preserve environment-variable references as metadata, but never copy `.env` files or values. Document that environment-provided connections depend on the new process environment.
- [ ] Leave legacy credential entries untouched, including when removing imported connections in the new app.
- [ ] Ensure restore cancellation, invalid snapshots, corrupt Skill manifests, insufficient disk space, and failed startup leave the destination recoverable and the source backup unchanged.
- [ ] Support migration into a fresh profile. If the new app already contains work, require its existing backup/replacement confirmation; do not attempt database merging.
- [ ] Keep all filesystem operations and native pickers in Electron main. Any necessary UI changes use existing Settings layout, localized accessible controls, and stable actionable errors. Diagnostics contain no private content, credentials, or identifying paths.

Gate: the full journey succeeds on disposable Windows and Ubuntu profiles, and source data/backup hashes remain unchanged by restore. There is no dependency on copying a live WAL-mode database or sharing its directory.

## Phase 6: ship the final Skladno announcement release

Owner: implementation maintainer and release owner, in the legacy repository. Prepare in parallel; publish only after new installers and migration instructions are available.

- [x] Keep every legacy installer identity, executable, data path, credential namespace, and backup format unchanged.
- [x] Add a clear About/Updates notice and explicit external action, such as `Download NEW NAME`, linking to the stable migration page. State that this installs a separate app and requires backup restore and API-key setup.
- [x] In this final build, replace routine update discovery/download controls with the migration notice. Do not fetch the new release feed, automatically download the new installer, or launch it.
- [x] Update any shared update-state contract, status-bar controller, key binding, and localized copy needed so the final build does not retain misleading check/download actions. Preserve startup recovery completion for users arriving through a staged legacy update.
- [ ] Publish a normal legacy stable release greater than every supported published legacy version. Include the existing installer, `RELEASES`, full `.nupkg`, and Debian package. Stable publication makes the announcement reachable from stable-only and preview-inclusive clients.
- [ ] Put migration instructions in its release notes as well. Older builds can read them without first installing the final build; Linux users continue to install packages manually.
- [ ] Do not assume users will install this final build. The backup journey must also work from tested earlier Skladno versions with supported backup formats. Users with checks disabled can use the website and manual downloads.

Gate: a real older Windows installation discovers only the final Skladno release, updates safely, and then offers the external new-app download. Neither that build nor older builds ever receive renamed-app packages from the legacy feed.

### Phase 6 preparation record, 2026-09-29

Prepared in the isolated legacy worktree on `migration/final-skladno-announcement`, targeting stable `0.5.6`, greater than legacy stable `0.5.5` and preview `0.4.0-preview.3`. The original checkout's existing changes are preserved. Warplyn `v0.6.0` is published with its separate setup, RELEASES, full package, and Debian assets.

The final legacy production composition uses a migration-only coordinator. About explains separate installation, backup restore, and API-key setup; Download Warplyn and the relabeled update shortcut explicitly open `https://warplyn.com/docs/migration.html`. Routine release fetching, scheduling, download, and apply are disabled. Startup success completion and existing recovery references remain supported. Legacy installer, executable, profile, data paths, credential services, and backup identifiers are unchanged. Both release workflows use `final-skladno-release-notes.md` so Authors can read the journey without installing the announcement build.

Publication remains pending: the stable migration URL returns HTTP 421. AWS Amplify is the chosen hosting target, but its deployment and domain setup are not verified. Do not tag or publish the announcement until the guide is accessible with working downloads. Installed older-Windows upgrade and keyboard/screen-reader acceptance also remain pending; the earlier waiver covers only the repository-transfer updater drill.

Verification passed: `npm run verify` (including 243 UI tests), production dependency audit, application/site builds, 17 browser E2E journeys, Windows Squirrel packaging, and the packaged Electron failure/restart test. The native package retains `io.github.kirillta.skladno-0.5.6-full.nupkg`, `Skladno-0.5.6-win32-x64-setup.exe`, and `RELEASES`. The focused test proves both Windows/Linux migration-only states cannot fetch, schedule, download, or apply an update and preserve recovery metadata. About controls have accessible names and the migration action is described by its persistent hint. Linux package build and the real installed upgrade drill remain pending CI/manual checks.

## Phase 7: release validation and publication order

Owner: release owner. Use the [testing guide](../guides/testing.md) and [release guide](../guides/mvp-release-and-recovery.md).

For implementation in each repository, first run product impact against its actual changed owner paths. Update matching `product-model/areas` records only when implementing changed behavior; regenerate inventories rather than editing them. This plan alone does not mark capabilities implemented.

Required automated checks for the completed changes:

```powershell
npm run verify
npm run test:e2e
npm run build
npm run build:site
```

Run `npm run product:docs` before verification when product records changed. Package with `npm run make:electron` on Windows and `npm run make:electron:linux` on Linux. Add focused checks to the existing update, Settings, backup/restore, configuration, and credential-adapter tests for changed behavior; do not build a new migration test framework.

| Manual drill | Required result |
| --- | --- |
| Old installation after repository transfer | Old API and asset URLs resolve; legacy update downloads and applies |
| Stable-only and preview-inclusive checks | Final legacy stable release is discoverable; no new-app package appears |
| Fresh new install with legacy environment override present | New app opens its own data, never the old database |
| Default and custom legacy data source | Export contains the actual source profile; restored content is complete |
| Backup with current Skills and Skill history | Both restore and validate alongside the database |
| Missing/locked OS credential service | Editing and recovery work; key setup gives actionable guidance |
| Restore cancel, corruption, failure, restart | Destination recovers; original app and migration backup remain unchanged |
| New app update to a second test version | New feed discovery, download, checkpoint, recovery, and restart work |
| Both apps installed; uninstall each separately | Independent launchers; neither installation deletes Author data |
| UI keyboard and screen reader pass | Migration notice, links, confirmation, and missing-key guidance are usable |

Publish in this order:

1. Complete transfer and legacy redirect drill.
2. Complete new-app packaging and backup compatibility tests using local/CI artifacts.
3. Publish the first new-app release in the new repository. Verify assets anonymously and complete an installed smoke test.
4. Publish the finished migration page with working download links and recovery instructions.
5. Publish the final legacy announcement release and verify its installed upgrade path.
6. Update both READMEs, website navigation, and download links. Preserve old recovery URLs.
7. Finish active issue transfers, verify links and Projects, and stop legacy feature development.
8. Disable unnecessary legacy deployment/release workflows. Archive the legacy repository only after the announcement and issue migration are verified and no further legacy patch is needed. Keep all release assets public.

Do not add code signing, a custom update service, automatic secret migration, or a database merge system to this project. Existing unsigned-distribution guidance remains accurate.

## Failure handling and completion

### Phase 7 rollout record, 2026-09-30

The maintainer merged Phase 6 PR #249 with Quality and both desktop checks passing. Warplyn v0.6.0's four downloaded assets match every GitHub SHA-256 digest, and an anonymous RELEASES request returns HTTP 200. The initial Amplify landing responds successfully; its migration route is missing because the build uploads source instead of the compiled site. Warplyn PR #63 corrects the build and publishes installer guidance.

The maintainer authorized beginning the rollout while custom-domain certificate verification is pending. The final legacy migration action therefore uses `https://main.dhsgh2xsr7g3j.amplifyapp.com/docs/migration.html`; `https://warplyn.com/docs/migration.html` remains the eventual canonical address. Wait for the Amplify guide to deploy before tagging the legacy release. Manual installed-release gates require recorded checks or an explicit maintainer waiver; none is inferred from permission to begin without the custom domain.

The maintainer explicitly chose to keep publication blocked until the remaining manual release checks are completed. Do not create the final legacy tag, publish Skladno 0.5.6, retire its release workflows, or archive this repository before those checks pass.

If transfer redirects fail, pause the announcement rollout and keep manual legacy downloads available while fixing the observed problem. If new-app restore fails, keep the Author on Skladno; retain the failed destination for recovery only as needed and retry from the untouched backup after a fix. Do not point Skladno at a database migrated by the new app.

If the renamed release is faulty, publish a corrected release and update download guidance. Do not overwrite a published version with different installer contents. Returning to Skladno recovers the pre-migration state; writing done later in the new app requires a separate export and is not automatically merged back.

Completion requires recorded pass/fail evidence for both supported desktop baselines, an issue URL map, verified legacy and new release feeds, and accessible migration/recovery documentation. Record versions and outcomes, not private data or credentials.

After implementation, move lasting compatibility and release decisions into ADR-006/009/010 and the release guide, add Author-facing instructions under `site/user-docs`, and delete this completed plan. Unfinished work remains explicitly listed; no capability is declared complete solely because code or a release exists.
