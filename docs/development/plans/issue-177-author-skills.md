# Issue #177: Skill Creator and Markdown Skill packages

Issue: <https://github.com/kirillta/skladno/issues/177>

Status: planned, implementation not started.

Execution: solo. Package validation, request handling, and storage share contracts;
implement them sequentially with one owner. Reassess independent verification
work after those contracts are stable.

## Goal and agreed decisions

Help an Author turn an editorial goal into a validated Skladno Skill, test it
against a Draft, and explicitly install it for reuse across Articles. Skills
guide existing approved capabilities and grant no new authority.

Both built-in and Author Skills use Markdown files as their source of truth.
Do not store package definitions in SQLite or hard-code instruction strings.
Built-ins ship as read-only application assets. Author Skills live under the
active application data directory and belong to that local application data
collection, rather than an individual Article or workspace.

This makes Skills readable and editable outside Skladno. It also requires
filesystem validation, refresh after external edits, and backup support beyond
the current SQLite snapshots.

```text
skills/
  flow-and-clarity/
    SKILL.md
    references/
      guidance.md
```

Each `SKILL.md` has YAML frontmatter containing a stable ID, name, description,
and version, followed by Markdown instructions. Optional references are bundled
local Markdown text. Finalize the reference declaration syntax, ID grammar,
supported frontmatter keys, field limits, reference count, and total UTF-8 byte
limit before implementing the parser. Reuse an installed safe YAML parser if
available; do not create a partial YAML parser.

The database may retain request provenance, including source, ID, version, and
content hash. It is not a second store for Skill definitions.

## Confirmed starting points

- Dependency #113 is closed. The bounded capability loop and multi-source
  `AssistantSkillCatalog` exist.
- `built-in-skill-packages.ts` currently contains instruction strings and the
  general package interface.
- Shared contracts already have source, ID, and version references, but explicit
  request paths still use `BuiltInSkillId`.
- The loop supplies compact descriptions for discovery and instructions through
  `load_skill`. Bundled references currently do not reach that loading path.
- Request preparation reads the current Revision. Draft testing needs a
  temporary snapshot path that does not promote a Draft or create a Revision.
- Explicit built-in Skill completion currently expects an editorial artifact.
  Creator interviews and package candidates need valid non-editorial completion.
- `product:impact` was inspected for Assistant application, shared contracts, and
  renderer request ownership. Rerun it with the final affected paths, including
  desktop storage and backup owners, before implementation.

## Implementation sequence

### 1. Define and load the shared file format

Move the general package contract out of the built-in package module. Implement
one server-owned parser and validator used by both sources, generated candidates,
preview tests, installation, and replacement.

Validate required metadata, stable identity, instructions, references, size limits,
and unsupported content. Reserve built-in IDs and normalized names. Reject
duplicate Author IDs and normalized name conflicts deterministically. Explicit
replacement may retain its own identity and name.

Accept only the documented package files. Reject executable resources, custom
tool or permission declarations, remote imports, absolute reference paths, path
traversal, and symlink or junction escapes. Links in ordinary reference prose
remain text and do not authorize fetching their targets. Treat instructions as
untrusted guidance; textual validation cannot establish that a Skill is safe.

Return specific corrections without exposing private paths or raw parser errors.
Invalid Author packages are unavailable for execution and appear with corrections
in management. A broken package must not disable unrelated valid Skills.

Convert existing built-ins to `SKILL.md` packages while preserving IDs and
behavior. Ensure development and packaged Electron builds resolve the same
assets without relying on the process working directory.

### 2. Integrate discovery and execution

Load both filesystem sources through the existing catalog. Refresh before each
request and after management operations; do not add a filesystem watcher initially.
Expose descriptions for discovery and load instructions plus bundled references
only when selected. Bound aggregate discovery and loaded context as well as
individual package sizes.

Carry full Skill references through explicit selection, request preparation,
streaming, history, and retry. Preserve compatibility with stored built-in IDs.
Do not add Creator or Author Skills to the built-in editorial-operation mapping.
Retain legacy editorial behavior at its existing compatibility boundary.

Keep an immutable in-memory package snapshot for each active request. A file edit,
replacement, or deletion must not change a running request. Record its content
hash because external edits may leave the declared version unchanged. A retry
must not silently substitute changed instructions; explain when the recorded
package is missing or different and offer a new request with the current package.

Existing capability allowlists, scope validation, action-intent checks, model
selection, step limits, and completion gates remain authoritative. Skill text
cannot widen any of them.

### 3. Add the Creator conversation and candidate preview

Ship Skill Creator as another built-in Markdown package. Interview the Author
about their goal, discovery description, instructions, and necessary reference
text. Do not attach Article content merely to conduct the interview.

Use a narrow structured candidate result, validated by the package validator,
after valid model completion. Reuse the Assistant conversation and streaming
infrastructure without representing a Skill candidate as an Article Proposal.
The candidate remains uninstalled and separate from the discovery catalog.

Show editable package content, validation corrections, the exact discovery
description, and relevant existing capabilities. Explain that discovery is
semantic and capability suggestions grant no permissions. Generation, preview,
and testing never install or replace a Skill.

### 4. Test candidates against a Draft safely

Capture an explicit temporary snapshot of the current Draft, its base Revision,
and any selection. Do not use the ordinary Draft-promotion path. Validate selection
offsets against this snapshot and send only the selected text and required context
for selection-scoped tests.

Reuse the Assistant loop, provider behavior, cancellation, privacy rules, and
completion validation. Allow existing reads and temporary generated results.
Exclude deterministic mutations, installation, and durable editorial artifacts.
Enforce this restriction server-side before dispatch, not by prompt instruction.
Capabilities whose implementations read persisted Revision text must use the
authorized snapshot or be unavailable for testing; do not silently test old text.

Stop on a base Revision conflict. Cancel or mark the result obsolete when the
Draft changes. Show completed test output separately without Article acceptance
actions. Failure, cancellation, or incomplete output leaves no valid result.

### 5. Implement explicit file lifecycle and recovery

Provide Install, Replace, and Delete through the renderer-safe application client
and validated server operations. Classify management endpoints as outside
Assistant mutation authority. The renderer receives no filesystem access.

Revalidate before writing. Use application-derived package paths, staged writes,
and recoverable replacement so interruption cannot leave a partially installed
package. Check the expected existing content hash before replacement or deletion
to catch external edits. Reject conflicting changes instead of overwriting them.
Increment the version on application-managed replacement and preserve the ID.

Include Author Skill files in backup, restore, and data relocation. Extend the
existing backup workflow with a documented snapshot format that contains SQLite
and validated Skill files; finalize the format before writing lifecycle code.
Preserve restore support for older database-only backups and explicitly define
what happens to existing Author Skills when restoring one. Do not silently delete
them or claim that an older backup contains them. Built-ins come from the installed
application and are not copied into Author backups.

Validate restored paths and packages before activation. Define interruption
recovery for the database and Skill set together and test it in Electron. Do not
ship file persistence before its backup and relocation behavior is implemented.

### 6. Add Author controls and documentation

Provide an application-wide Skills management entry with built-ins read-only and
Author packages editable through the Creator flow. Use explicit Install, Replace,
and Delete controls. Preserve the established Settings and workspace hierarchy,
keyboard access, focus behavior, and localized corrections.

Update ADR-011 for file packages and Author lifecycle, ADR-006 and the recovery
guide for expanded backups, and any affected request or transport contracts.
Update canonical product-model records and Author guidance to cover ownership,
external editing, validation, Draft testing, installation, replacement, deletion,
retry, and recovery. Regenerate product inventories after those records change.

## Verification

- Parser and catalog tests cover malformed metadata, limits, duplicate IDs and
  names, built-in shadowing, unknown declarations, unsafe paths, bundled references,
  external edits, and continued availability of unrelated valid packages.
- Request tests cover explicit Author selection, inferred discovery, legacy
  built-in history, reference loading, changed-package retries, and active-run
  stability during replacement or deletion.
- Creator tests cover interviews, correction and regeneration, valid candidate
  completion, and no implicit installation on any generation or test path.
- Preview tests prove that Draft text is used without promotion, selection excludes
  unselected content, stale runs stop, mutations are rejected, and failed or
  incomplete runs persist no valid editorial artifact.
- Filesystem tests cover create conflicts, stale hash rejection, partial writes,
  restart recovery, packaged built-in assets, backup/restore, legacy backups, and
  data relocation.
- Add a deterministic renderer-to-service journey from interview through invalid
  candidate correction, preview, Draft test, install, replace, and delete.
- Run focused tests, lint, typecheck, affected E2E and Electron checks. Run
  `npm run product:docs` and `npm run product:check` after product-model changes.
- Manually verify the packaged Electron journey, keyboard and screen-reader
  behavior, and recovery. Record any checks that remain unrun.

Before editing, read the affected ADRs listed in `AGENTS.md`, the UI design and
internationalization guides for renderer work, and the testing guide. After
completion, move lasting decisions into their owning ADRs or guides and remove
this plan.

## Deferred

Executable scripts, custom tools, permission grants, remote imports, sharing,
filesystem watchers, per-Article Skill ownership, and a package registry.
