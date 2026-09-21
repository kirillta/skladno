# Issue #177: Create and revise Skills in Assistant chat

Issue: <https://github.com/kirillta/skladno/issues/177>

Status: partially implemented; remaining work replanned against the current tree.
The observations below come from source inspection, not a passing test run.
Preserve existing implementation and concurrent uncommitted changes.

Execution: solo. Chat results, file-backed Skill Revisions, and file updates share
contracts and completion rules. Implement the business slices below in order.
Each slice includes errors, localization, diagnostics, accessibility, product
evidence, and verification. These are completion requirements, not later cleanup.

## Author decisions and scope

- Creation happens entirely in Assistant chat. The model infers a reusable Skill
  from the conversation. When unsure about the purpose, triggers, instructions or
  references, it asks clarifying questions in chat. Follow-up questions are supported;
  a mandatory questionnaire, separate creation screen or Skill Article is not needed.
- There is no validation workflow, approval score, or mandatory test stage. Authors
  refine Skills conversationally and recover earlier content through Skill Revisions.
- Both built-in and Author Skills are Markdown packages. Built-ins ship read-only.
  Author packages belong to the active application data directory and work across
  Articles. Neither installed definitions nor Skill history belong in SQLite.
- An Author's request to create a Skill authorizes saving its Markdown package.
  Successful creation makes it available immediately, without an Install button or
  another approval. Requests to edit, restore or delete likewise authorize that
  change. An unsolicited suggestion alone does not authorize saving a Skill.
- Author edits to Markdown files update the Assistant's Skill on the next catalog
  refresh; deleting `SKILL.md` or its package removes it. No registration record,
  reinstallation, version bump or application restart is required.
- Keep internal parsing, bounded reads, safe paths, completion gates, and capability
  checks. Revisions recover unwanted instructions; they cannot make unsafe file
  access acceptable. Show ordinary load/save errors beside the chat action without
  creating a validation screen or checklist.

The benefit is reusable editorial help without leaving the conversation. The cost
is a small file-backed history for Skills, separate from Article Revisions. Reuse
append-only recovery semantics, not Article database tables or Article screens.

## Current baseline

Server paths below are relative to `packages/server/src`.

| Owner | Observed implementation | Remaining work |
| --- | --- | --- |
| `application/assistant/skills/built-in-skill-packages.ts`, `skills/built-in/*/SKILL.md` | Built-ins load Markdown packages | Preserve IDs and edited instructions; add Creator without hard-coded instructions |
| `skills/skill-package-parser.ts`, `skills/create-skill-package.ts` | Installed `yaml` parser, metadata/reference limits, path checks, content hash | Reuse; bound reads before allocation and apply consistent conflict/path checks |
| `skills/file-assistant-skill-source.ts` | Refresh, install, replace, delete, staging | Add immutable history, typed errors and crash recovery; current `.previous` is deleted after replacement |
| `skills/assistant-skill-catalog.ts` | Multiple sources; discovery filters duplicate IDs/names | Enforce reservations on direct load/mutations and snapshot consistently per run |
| `application/create-application-services.ts` and its options | Optional Author root and file source composition | Expose lifecycle service and wire active roots in both runtimes |
| `application/assistant/capabilities/assistant-capability-loop.ts` | Instructions and references reach the model | Generalize explicit built-in IDs and add non-editorial Skill results |
| `application/assistant/requests/assistant-request-preparation.ts`, `presentation/routes/assistant-route.ts` | Built-in selection and Article-scoped parsing | Add Creator context, Skill references, provenance and retries |
| `scripts/copy-skill-assets.mjs`, server build, Electron composition | Asset copying and built-in root selection exist | Verify packaged resources independently of working directory |
| `packages/web/src/workspace/state/assistant-request-state.ts` | Ordinary sending calls `workspace.save()` | Creator must not save or transmit unrelated Article content |

Abbreviated `skills/` paths mean `application/assistant/skills/`. Existing source
tests establish basic loading and error cases, not the complete lifecycle below.
Recheck this baseline before implementing; do not repeat completed conversion work.

## Fixed contracts

### Markdown packages

Keep implemented YAML keys `id`, `name`, `description`, `version`, and optional
`references`. Instructions are the Markdown body. Keep current limits: ID regex
`^[a-z][a-z0-9_-]{2,63}$`, name 80 characters, description 280 characters,
instructions 64 KiB, eight references of 16 KiB each, whole package 96 KiB.
Versions retain the existing one-to-three numeric components. References are
single-level `references/<name>.md` files explicitly listed in frontmatter.

Keep using the installed `yaml` dependency. No new parser, Skill framework or
package registry. Links inside prose remain text and never trigger remote imports.
Reject scripts, custom tool/permission declarations, path traversal and symlink or
junction escapes. Application capabilities remain the authority boundary.

### Skill Revisions and file updates

Use server-owned directories beneath the active data root:

```text
skills/<skill-id>/SKILL.md                 installed execution source
skills/<skill-id>/references/*.md
skill-history/<skill-id>/<revision-id>/   immutable complete package snapshot
  package/SKILL.md
  package/references/*.md
  revision.json                          request, hash, time, parent, restoration source
skill-history/<skill-id>/state.json       latest recorded Revision identity
skill-staging/<operation-id>/             pending writes and recovery journal
```

Revision IDs are server-generated UUIDs. Parse the snapshot's `package/` directory.
Metadata lives outside package roots;
the existing strict parser must not interpret it as a package resource.
A completed, Author-requested creation writes the package and records a Skill
Revision as one recoverable operation. The Skill is then available to the Assistant.
Conversational edits update the live package and append a Revision. An Author's
restore request copies an older snapshot into the live package and appends a new
Revision. Delete removes the live package from discovery and keeps recorded history
recoverable. History never recreates a deleted package without an Author's restore
request. Permanent erasure remains the explicit application-data deletion operation.

Markdown files determine availability; history metadata is not an activation flag.
Refresh before each Assistant request, when opening the Skill picker/list, and after
app-managed writes; no watcher is required. External edits never get overwritten
from history. Missing or malformed files remove the Skill from new requests rather
than retaining stale cached instructions. Unrelated Skills keep working; explain a
malformed package when the Author tries to use or manage it.
Before replacing/deleting, compare the expected installed hash and preserve the
current package in history if it is not already represented. On conflict, keep
both versions and ask the Author to reload before retrying. Active requests use
their already loaded snapshots; later requests see edits/deletions. Record valid
externally changed snapshots when observed. Intermediate external edits or deletions
between refreshes cannot all be recovered; history preserves observed versions only.

Use NFKC plus locale-independent lowercase for name conflicts. Reserve built-in
IDs and names on discovery, direct load, install and replace. Replacement preserves
ID; name changes are allowed when available. The service increments the last
numeric version component for managed replacement. Restoring old content gets a
new version when restored, rather than moving the installed version backwards.
External edits take effect through content hashing even if their version is unchanged.

### Chat and persistence

Reuse the current Article-associated chat as host, without creating a Skill Article.
Creator receives the request and existing bounded, scope-permitted chat history;
it gets no Article body by default. References come from explicitly supplied text.
Truncated context leads to a concise question, not an unbounded history fetch.

An ordinary conversation may suggest creating a Skill. An explicit create/revise
request permits the model to infer its content, clarify uncertainty and save it.
A typed chat result
contains a server-issued Skill Revision identity. UI actions never parse commands
from model prose or code fences.

SQLite may store result references and execution provenance, not canonical Skill
definitions or Skill history. Chat text may quote instructions but is never the
installed package store. The file-backed Revision survives loss of its chat link.

## 1. Finish recoverable file lifecycle and backup support

Dependency: none. Keep new lifecycle actions unexposed until recovery checks pass.
Read ADR-001, ADR-004, ADR-006, ADR-008, ADR-009 and the release/recovery guide.

Impact command, repository root:

```powershell
npm run product:impact -- packages/server/src/application/assistant/skills packages/server/src/infrastructure/persistence packages/electron/src/presentation/settings packages/electron/src/infrastructure/recovery packages/web/src/settings/web-backups.ts
```

Owners:

- Existing parser, catalog, `FileAssistantSkillSource`, service composition and roots.
- New `packages/server/src/application/assistant/skills/author-skill-service.ts`
  for use cases and `packages/server/src/infrastructure/skills/skill-revision-store.ts`
  for snapshot/journal I/O. Keep one installed-package source.
- `packages/server/src/application/settings/backup-manager.ts`,
  `packages/server/src/infrastructure/persistence/sqlite-backup-manager.ts`.
- `packages/electron/src/presentation/settings/desktop-settings.ts`,
  `src/infrastructure/recovery/pending-restore.ts`, `pending-restore-contract.ts`,
  `src/infrastructure/runtime/runtime-settings.ts` within the Electron package,
  and `packages/electron/src/presentation/main.ts`.
- `packages/web/src/settings/web-backups.ts`, its settings HTTP client and existing
  backup Settings controls.

Implement:

1. Add list/read, create, update, restore and delete use cases that save live Markdown
   and record history together. Reuse internal install/replace methods as needed;
   they are implementation details, not extra Author steps.
   Inputs use Skill/Revision identities and expected hashes, never renderer paths.
   Check file sizes before reading and containment before every filesystem operation.
   Apply the same duplicate/reserved-name rules to all entry points.
2. Serialize mutations per Skill. Stage writes and journal intent, preserve the old
   snapshot, activate by rename, then commit the journal. Startup completes or rolls
   back interrupted operations idempotently. Exclude staging/history from discovery.
3. Add a directory backup bundle: `manifest.json`, `database.sqlite`, `skills/`,
   `skill-history/`. Manifest format 1 lists relative paths, sizes and SHA-256 hashes;
   write it last. Pause application Skill writes during capture and compare external
   file hashes before/after capture. Changed files cause a recoverable backup failure.
   Exclude built-ins/staging. This uses filesystem operations, not an archive library.
4. Treat each native bundle as one backup for selection/retention. Extend the browser
   folder handle with directory support; serve staged export files through opaque
   IDs and a manifest, never arbitrary paths. Clean up exports after completion or
   failure. Keep existing `.sqlite` backup recognition. Restore legacy backups with
   current Skill files retained and an explanatory localized message. New bundles
   restore their exact saved Skill set after retaining a complete recovery bundle.
5. Stage and switch database plus Skill directories on restart, rolling back the
   complete set on failure. Carry Skills/history during data relocation and retain
   the old directory. Check the actual relocation owner before extending it: ADR-009
   describes a contract and is not proof that every path exists. Reject unsafe or
   corrupt manifests before activation; do not require valid editorial instructions
   to back up an Author's files.
6. Translate filesystem failures into shared application error codes, mapped through
   `packages/web/src/i18n/errors.ts`, `messages.ts`, and `locales/en.ts`. Reuse redacted
   local diagnostics with operation/safe failure class only. No paths, Skill names,
   bodies, hashes or raw errors. Preserve backup telemetry outcomes without adding
   content or new remote payloads. Localize backup labels and accessible names; keep
   existing Settings focus and keyboard behavior.
7. Update ADR-006/009, applicable `product-model/areas/settings.json` and application
   scenarios, and `docs/user/Backups-and-recovery.md` with this slice.

Checks, all must exit 0:

```powershell
# packages/server; add the new store suite at this path
npx tsx --test src/application/assistant/skills/file-assistant-skill-source.test.ts src/application/assistant/skills/assistant-skill-catalog.test.ts src/infrastructure/skills/skill-revision-store.test.ts src/infrastructure/persistence/sqlite-backup-manager.test.ts
# packages/electron
npx tsx --test src/presentation/settings/desktop-settings.backups.test.ts src/infrastructure/recovery/pending-restore.test.ts
# repository root
npm test --workspace @skladno/web -- src/settings/ApplicationSettings.backups.test.tsx
```

Prove append-only restoration, deletion recovery, external-edit conflicts, duplicate
rejection, interrupted activation/restart, new/legacy backup restore and failed-switch
rollback. Run the per-slice gates below and manually test native backup selection.
Done when failures retain a usable prior database/package/history set.

## 2. Use Author Skills through the ordinary Assistant

Dependency: slice 1. Read ADR-002, ADR-007, ADR-008, ADR-011 and the i18n guide.

```powershell
# repository root
npm run product:impact -- packages/shared/src/assistant packages/server/src/application/assistant packages/server/src/presentation/routes/assistant-route.ts packages/web/src/workspace
```

Owners: `packages/shared/src/assistant/assistant.ts`, `assistant-events.ts`;
server `presentation/routes/assistant-route.ts`, Assistant `requests/` preparation,
prepared/replayed request types, `capabilities/assistant-capability-loop.ts`,
`infrastructure/editorial/adapters/ai-sdk-assistant.ts`; persistence
`repositories/assistant-repository.ts`, `assistant-record-mappers.ts`, `migrations.ts`;
web `application/client.ts` and HTTP adapters, `workspace/state/assistant-request-state.ts`,
`workspace/components/assistant/AssistantComposer.tsx` and its plugins.

1. Carry source/ID/version/hash selection and loaded-Skill provenance through
   requests, streaming, history and retry. Read legacy built-in IDs at the existing
   compatibility boundary. Snapshot discovery/loaded packages once per run.
2. Reuse description discovery and `load_skill`; references already reach the model.
   Bound discovery to 50 summaries per step and loaded Skill text to 192 KiB per run.
   For larger catalogs, use bounded paged discovery, with explicit selection always
   directly addressable. Do not silently discard later Skills or widen capability
   authority. Preserve the existing six-step run bound.
3. Generalize explicit composer selection. Retry fails with a localized new-request
   action if the recorded package is missing or changed. An active request retains
   its snapshot during file edits/replacement/deletion.
4. Preserve scope checks, action-intent verification, purpose-specific models,
   cancellation and completion gates. Keep the built-in editorial-operation mapping
   at its compatibility boundary; do not map arbitrary Skills to an editorial operation.
5. Add shared error codes and ICU mappings for missing/changed/unsupported Skills.
   Reuse request tracing and redacted diagnostics, excluding private package text.
   Preserve composer keyboard selection, focus and accessible names. Update ADR-011
   and editorial-workflows product scenarios with matching test markers.

Checks:

```powershell
# packages/server
npx tsx --test src/application/assistant/skills/assistant-skill-catalog.test.ts src/application/assistant/capabilities/assistant-capability-loop.test.ts src/presentation/editorial-integration.assistant.test.ts
# repository root
npm test --workspace @skladno/web -- src/workspace/EditorialWorkspace.assistant-composer.test.tsx src/workspace/EditorialWorkspace.assistant-requests.test.tsx
```

All pass for built-in compatibility, explicit/inferred Author Skills, reference
loading, scope restrictions, changed retries and replacement during a run. Run
per-slice gates. Done when Author Skills use the same bounded execution path.

Also prove that editing instructions or reference text without changing `version`
affects the next request, removing `SKILL.md` removes discovery and explicit use,
recreating a valid file makes it available again, and history cannot resurrect a
deleted Skill. Check picker/list refresh without restart or reinstallation.

## 3. Infer, create, revise and manage Skills entirely in chat

Dependency: slices 1-2. Read ADR-003, ADR-005, ADR-007, ADR-011, ADR-012,
the design system, i18n guide and Assistant panel UI guardrails.

```powershell
# repository root
npm run product:impact -- packages/server/src/application/assistant packages/server/src/infrastructure/editorial packages/shared/src/assistant packages/web/src/workspace/components/assistant packages/web/src/workspace/state
```

Owners: new server `application/assistant/skills/built-in/skill-creator/SKILL.md`,
shared built-in inventory and loader count checks; Assistant capability loop,
`completion/assistant-completion.ts`, `completion/completion-event.ts`,
`assistant-service.ts`, and AI SDK Assistant adapter/executor. Add a narrow
`presentation/routes/author-skills-route.ts`, register in `presentation/server.ts`,
and expose through the application client. Classify new operations in the existing
capability/transport coverage registry. Register narrowly scoped Skill lifecycle
operations for Author-requested chat changes. Reuse the existing action-intent
verification for the requested operation/target. Requests phrased as questions,
such as "Can you create a Skill from this?", authorize creation. Informational
questions, hypotheticals and unsolicited suggestions do not authorize writes.
These application-owned operations
grant no custom tools or arbitrary filesystem access. Remove the prior blanket
classification excluding all Skill writes from Assistant authority.

Renderer owners: `AssistantTimeline.tsx`, `AssistantTimelineMessage.tsx`,
`AssistantComposer.tsx` under `packages/web/src/workspace/components/assistant`,
and workspace state `assistant-request-state.ts`, `assistant-stream-events-state.ts`.
Add one focused `AssistantSkillResult.tsx` beside the timeline components.

1. Creator instructions infer the goal, name, discovery description, procedure and
   reference text from conversation. Ask whenever uncertainty about the intended
   Skill would change its behavior, and continue the conversation until resolved.
   Use model routing, not a new intent regex or fixed interview sequence.
2. Add a discriminated Creator request context using the existing chat host/history
   without calling `workspace.save()` or attaching Article content. Existing ordinary
   Article requests keep their behavior. No new Skill Article, editor or Settings page.
3. Add a typed completed Skill write carrying metadata, Markdown and reference
   text. Use the configured Assistant model and existing structured-output facilities.
   Stage until valid completion, then save the live package and append a file-backed
   Revision. Refresh discovery before reporting success; the Skill is available now.
   Clarifying turns finish as plain conversation without a file write. Creator
   success does not require an Article Proposal or a second install action.
4. Make writes idempotent by request ID. Use slice 1's journal to save history and
   the live package, then commit the chat reference. A failed chat commit after
   package activation reports that the Skill was saved but its chat result could
   not be recorded. Retry repairs that link without another write or Revision.
   Startup reconciles interrupted operations; SQLite cannot roll back filesystem
   writes. Cancellation/incomplete generation before commit changes no live Skill.
   Cancellation after a completed save must not claim the save was undone.
5. Show a compact chat result with name/description, expandable Markdown/references,
   Revise, Revisions, and Delete. Report created/updated availability directly; omit
   Install, Apply and Replace approval buttons. Revise sets
   composer context to the selected Skill identity and focuses the composer. Revisions
   lists timestamped snapshots; restore writes the selected content and appends a
   new Revision. History and available
   Skills remain reachable through a chat list action even after their originating
   conversation is removed. Read/list access needs no new mutation capability.
   Externally deleted files must also disappear from this list on its next refresh;
   retained Revision history may be shown separately as recoverable deleted work.
6. Bind operations to server-issued Skill/Revision IDs and expected hashes. An
   Author's chat request or direct Revision/Delete action is sufficient authority
   for that operation; no extra confirmation button is required. Use structured
   operations, not parsed model prose. Creation, editing, restoration and deletion
   update the live files. There is no validation checklist, creation form, separate
   management screen or mandatory trial. Ordinary Skill use never self-modifies it.
7. Return localized creation/save/conflict/missing-Revision errors beside the action,
   with correction/retry and prior Revisions intact. Add ICU messages and accessible
   names in `i18n/messages.ts` and `locales/en.ts`, mappings in `i18n/errors.ts`.
   Reuse UI primitives/tokens, keyboard controls, pending disabling, visible focus,
   status announcements and focus return. Reuse request tracing; log no Skill/chat
   content or raw provider errors.
8. Update ADR-011, `product-model/areas/editorial-workflows.json` and new
   `docs/user/Skills.md`, linked from the existing user documentation entry point.
   Explain clarifying questions, availability immediately after creation, direct
   file editing/deletion, refresh timing and Skill versus Article Revisions.
   Restoring a Skill Revision updates the available Skill immediately. Record that
   these decisions supersede the issue's separate installation approval flow.

Checks:

```powershell
# packages/server; add the two new focused suites
npx tsx --test src/application/assistant/skills/author-skill-service.test.ts src/presentation/server.author-skills.test.ts src/presentation/editorial-integration.assistant.test.ts
# repository root; add the focused result-card suite
npm test --workspace @skladno/web -- src/workspace/components/assistant/AssistantSkillResult.test.tsx src/workspace/components/assistant/AssistantTimeline.test.tsx src/workspace/EditorialWorkspace.assistant-requests.test.tsx src/i18n/catalog-validation.test.ts
npm run test:e2e -- --grep "Author Skills"
```

Add an `Author Skills` journey in `e2e/author-journeys.spec.ts` using
`packages/server/src/test-support/e2e-service.ts`. Prove inference, necessary
follow-up, creation with immediate discovery, edit, restore, delete and restart.
Assert no Article/Draft mutation, no save from a suggestion or unanswered clarifying
turn, no live changes after failed generation, idempotent recovery and working
keyboard/focus behavior. Include file edits/deletion while the app stays open. All
commands exit 0; run per-slice gates. Done when creation and recovery stay in chat.

## 4. Optional chat trial against current writing

Dependency: slices 1-3. This retains the issue's Draft-testing capability as an
optional Author request, never a prerequisite to creation or availability. Read
ADR-005/007/011; rerun slice 3's impact command for the same execution/UI owners.

1. Add `Try on current Draft` to the chat result, carrying the saved Skill Revision ID,
   current Draft version/base Revision and optional selection. Bypass ordinary
   Draft promotion in `assistant-request-state.ts` for this request kind only.
2. Request preparation obtains the Draft through the existing Article store, checks
   its version and validates offsets against that snapshot. Reuse the capability loop
   with reads/temporary results only. Reject mutations server-side before dispatch.
   Operations that reload saved Article text must use the authorized snapshot or be
   unavailable for trial; never silently run against different text.
3. Show output in chat without an actionable Article artifact or Skill mutation.
   Base Revision changes stop the run; Draft changes invalidate the result. Preserve
   normal cancellation, minimum context, provider storage and completion boundaries.
4. Add localized start/stale/failure/retry copy, keyboard access and accessible status
   beside the action. Reuse tracing without private diagnostic content. Update trial
   product scenarios and `docs/user/Skills.md` in this slice.

Rerun slice 2's capability-loop and request suites, slice 3's result-card suite and
the Author Skills E2E journey. Add assertions for exact Draft/selection input,
zero Article Revision creation, rejected mutations, stale Draft/base Revision,
cancellation and no valid output on incomplete completion. All exit 0. Run per-slice
gates and inspect the trial in Electron. Done when trial cannot change saved work.

## Per-slice gates and final acceptance

From the repository root after each completed business slice:

```powershell
npm run lint
npm run typecheck
npm run product:docs
npm run product:check
git diff --check
```

Expected: exit 0, no missing/unknown scenario markers, stale generated inventories
or whitespace errors. After typecheck refreshes shared output, run
`node --test dist/assistant/assistant.test.js` from `packages/shared` for modified
Assistant contracts. Automated AI checks use deterministic fixtures, not live keys.

Final integration: `npm run verify`, the Author Skills E2E journey and
`npm run package:electron`. Launch packaged Electron from another working directory.
Check chat inference, keyboard/screen-reader behavior, collapsed Assistant layout,
external file edits, restart, backup/restore and retained Skill Revisions on supported
desktop targets. Browser E2E is not evidence for Electron packaging or recovery.
Report environments, results, and every unrun manual/desktop check.

Move lasting decisions into their ADRs/guides and remove this plan when all slices
are complete. No executable resources, custom tools, permission grants, remote
imports, sharing or filesystem watcher are in scope. Saving an Author-requested
Skill makes it available automatically; a separate installation workflow is omitted.
