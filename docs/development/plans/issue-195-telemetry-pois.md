# Issue #195 implementation POIs

The [telemetry follow-up plan](issue-195-telemetry-follow-up.md) supersedes this plan's implementation sequence and default-off instructions. The product owner confirmed default-on telemetry until beta ends. Use the follow-up plan for the current fixes.

Agent handoff for [#195](https://github.com/kirillta/skladno/issues/195), opt-in PostHog telemetry for the packaged Windows Electron app. POI means a point of interest to inspect or change during implementation.

Prepared on 2026-09-09 against commit `814b5ee`. This file describes remaining work. No telemetry implementation or PostHog account configuration was performed. Treat the issue as the acceptance contract; re-read its body and comments before implementation.

## Recorded deviation

On 2026-09-09, the product owner selected one PostHog Cloud project in the US (Virginia) region and explicitly declined a separate test project. Automated tests and development must use only fake transports and never send events to PostHog. Production payload inspection is limited to an explicitly opted-in packaged beta installation during manual release acceptance.

## Start here

1. Read the root [agent guide](../../../AGENTS.md) and [context-efficient workflow](../guides/context-efficient-agent-work.md). Check the working tree and revalidate the symbols below against the implementation branch.
2. Read POIs 1–5 before editing. They determine consent storage, event ownership, and the network boundary.
3. Run `npm run product:impact -- <affected paths>` with the actual owners selected below. Preserve each matched implemented capability. This preparation changes documentation only, so it does not change product records.
4. Implement in the order under “Implementation sequence.” Each POI has a completion criterion. Record deviations and evidence here while work remains active.
5. After implementation, move lasting decisions into the relevant ADRs/guides, then delete this plan as required by the repository guide.

All source paths below are repository-relative. Proposed names and policy choices are recommendations, not existing APIs or approved account settings.

## POI 1. Consent belongs to installation runtime settings

Inspect:

- `packages/electron/src/infrastructure/runtime-settings.ts`, `RuntimeSettings`, `readRuntimeSettings`, and `writeRuntimeSettings`.
- `packages/electron/src/presentation/main.ts`, construction of `runtimePath` beneath Electron `userData`.
- `packages/shared/src/settings/settings.ts`, `GeneralSettings`.
- `packages/server/src/application/settings/application-settings-service.ts`, persisted application Settings.

The existing runtime reader picks known fields and returns an empty object on invalid input. The writer uses a temporary file and rename. General Settings belong to the Article database; placing consent there would let a restore copy consent.

Work:

- Add a semantically grouped telemetry runtime value with validated consent and random identity. Define how the exact consent contract is recognized, including older/malformed records. Missing consent means off.
- Keep consent and identity outside SQLite, snapshots, and Article data directories. Update-network permission and provider-storage permission remain independent.
- Generate an identity only for a successful enable transition. Restart retains it; disabling removes it; re-enabling generates a new one.
- Save before committing the effective setting. A write failure keeps the previous effective state and yields a safe Settings error. Resolve a failed disable explicitly in tests rather than silently claiming that collection stopped permanently.
- Runtime corruption must fail closed. An invalid or missing identity must never become an identifier derived from a path, account, credential, or hardware property.

Done when fresh install, upgrade, corrupt config, restart, save failure, disable, and re-enable have deterministic state-transition tests.

## POI 2. Shared runtime writers can overwrite consent

Inspect all callers of `writeRuntimeSettings`, especially:

- `packages/electron/src/presentation/desktop-update-coordinator.ts`, `checkNow`.
- `packages/electron/src/presentation/desktop-settings.ts`, directory selection and restore staging.
- `packages/electron/src/application/pending-restore.ts`, apply/complete/rollback.

Confirmed risk: update discovery reads runtime settings, awaits a network response, and later writes a spread of that earlier record. Adding telemetry fields alone would allow a late update response to overwrite a newer opt-out or restore a discarded identity.

Work:

- At writes that follow an await, merge the operation's changed fields into freshly read runtime state. Inspect every sibling writer for the same stale-snapshot pattern.
- Keep writes synchronous and localized where the existing mechanism suffices. Add a coordinator only if the actual interleavings require one.
- Test enable/disable while update discovery or a native dialog is pending. Verify unrelated update and backup preferences survive telemetry changes as well.

Done when no existing runtime writer can resurrect consent or identity from an older snapshot.

## POI 3. Main-process lifecycle owns collection and delivery

Inspect `packages/electron/src/presentation/main.ts`, `createMainWindow`, `quitFrom`, startup composition, restart callbacks, and startup failure handling. Also inspect `packages/electron/src/application/close-coordinator.ts`.

Work:

- Read consent before constructing any network-capable telemetry client, including before startup recovery if recovery failures are to be observed.
- Gate operation on packaged runtime, valid destination/project configuration, and consent. A developer override must require an explicit isolated test configuration. Browser development and automated tests default to no collection.
- Keep one main-process owner for consent state, in-memory counters, identity, queue, timers, and transport disposal. Supply a narrow provider-neutral observer to service composition.
- Emit `app_session_started` once after readiness. First enablement may start the current process session; decide and test how repeated enablement in one process interacts with the “once per process” rule and fresh identity.
- Stamp work with the current consent generation or an equivalent invalidation mechanism. Opt-out must prevent pending callbacks, retries, aggregation timers, or shutdown work from reviving old events. An operation started while disabled must not upload retrospectively when it finishes after opt-in.
- On successful opt-out, stop collection and transmission, abort requests where possible, and discard queue, counters, and identity. Already transmitted data cannot be recalled.
- Keep Draft checkpoint coordination ahead of database close. Telemetry must not add a delivery wait to startup, editing, restart, or shutdown.

Done when tests cover opt-out during a request/retry, opt-out followed by re-enable, an operation spanning opt-in, startup failure, and shutdown with a pending Draft checkpoint.

## POI 4. Versioned event schema and privacy boundary

Read [ADR-002](../architecture/adr-002-shared-contract-organization.md) and [ADR-008](../architecture/adr-008-loopback-service-trust-boundary.md). Put renderer-safe types and runtime validation in a focused shared contract module, following existing exports.

Work:

- Define a discriminated event union and strict validator. Reject unknown event names, unknown keys, wrong types, non-finite/negative durations, invalid counters, and invalid enum combinations. TypeScript types alone do not validate IPC.
- Define finite operation, recovery, failure, and exit-reason enums. Map unknown errors to a safe fallback; never use raw `Error.name`, `Error.code`, messages, or arbitrary strings as the remote category.
- Main adds schema version, app version/release, platform, OS version, architecture, timestamp, and installation identity. Renderer inputs cannot override trusted fields. Add an ephemeral session ID only for a named metric that needs it.
- Use a monotonic clock for elapsed time. Specify bounds/precision for counters and durations and the exact meaning of the release field.
- Exclude Article/Revision/Proposal IDs, titles, content, prompts, AI responses, keys, environment values, paths, URLs, stacks, request/response bodies, and arbitrary provider/model names.
- Validate the final outbound envelope as well as application inputs. SDK-added properties need their own audit under POI 6.

Done when malicious payload tests reject extra and nested fields, and seeded private strings are absent from serialized outbound batches.

## POI 5. Event ownership and actual completion boundaries

Read [ADR-001](../architecture/adr-001-three-layer-server-and-electron.md), [ADR-005](../architecture/adr-005-article-state-and-consistency.md), and [ADR-007](../architecture/adr-007-completion-gated-editorial-engine.md). Inspect direct callers before choosing an instrumentation point.

| Event | Verified starting owners | Implementation criterion |
| --- | --- | --- |
| `app_session_started` | Electron `main.ts`; readiness integration in `desktop-update-coordinator.ts` | One opted-in ready process session, with no replay of earlier actions. |
| `ai_operation_finished` | `packages/server/src/application/assistant/assistant-service.ts`, `assistant-completion.ts`; `packages/server/src/application/editorial/editorial-service.ts`; `packages/server/src/local-application.ts` | One completed/failed/cancelled terminal event per explicit operation, finite operation type, elapsed milliseconds, and failure category when applicable. |
| `proposal_reviewed` | `packages/server/src/application/articles/article-service.ts`, `acceptProposal`; `packages/web/src/workspace/state/editorial-proposal-state.ts`, acceptance path and `rejectAll` | Accept only after successful persistence. Reject only after the explicit decision. Send the finite decision alone. |
| `draft_checkpoint_finished` | `packages/web/src/workspace/state/article-workspace-state.ts`, `checkpoint`; `article-service.ts`, `saveDraft` | Aggregate actual attempts, successes, failures, and duration measurements over a bounded interval. Define treatment of discard/no-op checkpoints. |
| `backup_finished` | Electron `desktop-settings.ts`, `createNativeBackup`; server `application-settings-service.ts`, `createBackup`; `packages/server/src/infrastructure/persistence/sqlite-backup-manager.ts`; update coordinator snapshots | Identify which explicit/automatic backup attempts count, then emit completed/failed plus elapsed time and safe category once at their owner. |
| `recovery_finished` | Electron `pending-restore.ts` and startup completion/rollback in `main.ts`; `article-service.ts`, `restoreRevision`; renderer Draft recovery paths | First select the finite recovery kinds from implemented flows. Emit actual completion/failure, not snapshot selection or restart scheduling. |
| `app_failure` | Electron startup catch and observed renderer/child-process termination hooks | Emit only an allowlisted category/reason while consent is available and transmission remains possible. No native crash dumps or exception auto-capture. |

Specific traps:

- `AssistantService` observes the engine completion before `AssistantCompletion.persist` finishes. Use the successfully persisted application completion for success. Cover persistence failure after valid generation.
- Editorial `stream` and `streamStaged` have different persistence responsibilities. Trace their consumers so a staged internal operation and its enclosing Assistant request do not both count as explicit user operations.
- Include preparation failures and incomplete streams in the terminal policy. A catch around only provider iteration can miss failures before iteration; generator cancellation can end iteration without that catch.
- Proposal rejection is currently renderer-local. Acceptance goes through `client.acceptProposal` and appends a Revision. Do not infer rejection from navigation, staleness, or a failed acceptance. Decide whether individual change decisions count or only whole-Proposal review; partial acceptance must not accidentally emit many review events.
- Checkpoint scheduling is debounced and includes discard/no-op paths. A service `saveDraft` count and a renderer checkpoint count have different denominators. Choose one, document it, and do not count both.
- Native backup creation is also used by protective flows. Check all callers before instrumenting both the wrapper and snapshot helper.
- Recovery selection cancellation is not a failed restore. Successful staging is not successful recovery. Decide how a failed apply followed by successful rollback is represented without double-counting one recovery attempt.
- Main-process crashes cannot reliably report themselves. Lost terminal events/counters are acceptable beta limitations and must appear in metric notes.

Done when each row has one named owner, a trigger definition, exact allowed fields, and a focused test proving terminal semantics and absence of duplicate events.

## POI 6. PostHog adapter and bounded delivery

Inspect `packages/electron/package.json` and packaging configuration before adding a dependency. The issue prefers the supported Node SDK only if it can satisfy the required behavior. Audit the selected installed version using current official PostHog documentation and its actual outbound payloads.

Work:

- Confine PostHog-specific code to an Electron infrastructure adapter. Use explicit events only. Disable automatic capture, replay, screenshots, console/network breadcrumbs, surveys, feature-flag polling, exception capture, and AI tracing.
- Check construction, capture, flush, retry, and shutdown behavior. Verify no background requests or separately managed SDK backlog bypass the consent gate or queue bounds.
- Specify numeric queue capacity, event rate cap, batch size, expiration, flush interval, request timeout, retry limit, and capped backoff. Record chosen values and rationale before tests; these values are not established by this plan.
- Bound failure storms and checkpoint aggregation. Drop expired/excess events. Use memory only, with no telemetry database or persistent offline backlog.
- Allowlist the selected regional ingestion destination and handle redirects without permitting an arbitrary destination. Invalid/missing configuration disables delivery safely.
- Audit Electron networking/proxy behavior for the selected transport. Use only the public capture/project key in packaged configuration; personal/admin keys stay out of the binary and repository.
- Catch synchronous SDK exceptions and asynchronous failures without changing application results, showing delivery notifications, or recursively reporting telemetry failures.

Done when a fake transport proves offline, timeout, rate-limit, exception, overflow, expiration, retry cap, and opt-out behavior; later, a test-project payload inspection confirms the real SDK follows the same contract.

## POI 7. Finite preload and IPC contract

Inspect:

- `packages/electron/src/presentation/preload.ts` and `preload-bridge.ts`.
- `packages/electron/src/presentation/desktop-settings.ts` and `desktop-settings-client.ts`.
- `packages/electron/src/presentation/desktop-updates.ts`, an existing finite desktop-client pattern.
- `packages/shared/src/application/electron-ipc.ts` and `packages/web/src/desktop-client.ts`.

Work:

- Expose finite get-consent/set-consent operations and only the renderer-owned events identified in POI 5. Prefer main/service instrumentation whenever the owner already runs there.
- Validate request shape, argument counts, enums, unknown keys, and sender/frame authority in main. Validate responses at the renderer boundary using existing conventions.
- Main rechecks effective consent and runtime eligibility for every renderer event. Renderer visibility/state is never authorization to transmit.
- Provide no generic analytics proxy, arbitrary URL, or property bag. Browser runtime has no remote-telemetry fallback.

Done when IPC/preload tests cover malformed inputs, unauthorized senders, disabled consent, and the allowed operation set.

## POI 8. General Settings and disclosure

Read the [design system](../ui/design-system.md), [internationalization guide](../guides/internationalization.md), and UI guardrail skill before UI edits. Inspect:

- `packages/web/src/settings/components/GeneralSettingsSection.tsx` and `SettingRow.tsx`.
- `packages/web/src/settings/ApplicationSettings.tsx` and `components/SettingsContent.tsx`.
- `packages/web/src/settings/components/UpdatesSettingsGroup.tsx` for desktop-specific Settings wiring.
- `packages/web/src/i18n/locales/en.ts` and existing error-message ownership.

Work:

- Add a SettingRow-style switch in a privacy/diagnostics group under General. Suggested label from the issue: “Share diagnostic and usage data.”
- Explain the reliability and usage events, PostHog destination, excluded private content, and optional default-off behavior. Use pseudonymous terminology rather than “anonymous.”
- Render from confirmed main-process consent. Handle loading/saving and failed saves through existing Settings/notification patterns; avoid optimistic consent that remains wrong after failure.
- Use accessible naming, description association, keyboard focus, and localized messages. Browser/development presentation must not imply that unsupported collection is active.
- Add a details link with exact fields, selected region, connection metadata, retention, and deletion instructions. Opening details must not grant consent.
- Explain that opt-out stops future collection but cannot recall previously sent events.

Done when focused Settings tests and the changed E2E journey verify persistence, accessible interaction, error behavior, and unsupported-runtime behavior.

## POI 9. Restore, relocation, and local-data deletion

Read [ADR-006](../architecture/adr-006-sqlite-lifecycle-and-recovery.md) and [ADR-009](../architecture/adr-009-native-settings-credentials-and-data-switching.md). Inspect `pending-restore.ts`, native Settings backup/restore/delete flows, and their tests.

Observed mismatch: ADR-009 describes selected data-directory configuration and a pending restore-or-relocation record. The inspected `RuntimeSettings` contains a pending restore record only, and startup resolves the database from server configuration. Re-check the branch before claiming relocation is implemented. This issue must not turn into implementing missing relocation.

Work:

- Verify snapshots and restore staging contain Article data without telemetry runtime state. Restore completion and rollback preserve the current installation's consent, rather than applying backup-origin consent.
- Verify changing the configured Article data location leaves consent and identity attached to the installation. Exercise any implemented relocation path discovered on the implementation branch.
- Inspect local-data deletion scope and record its intended consent/identity behavior. Do not silently broaden deletion or treat local deletion as a remote PostHog deletion request.

Done when restore success/failure/rollback and data-location tests prove that consent and installation identity are neither imported nor cloned. Record unsupported relocation explicitly.

## POI 10. Preserve local diagnostics and disabled AI tracing

Inspect `packages/server/src/infrastructure/diagnostics/local-diagnostics.ts` and its test, plus callers of `createLocalDiagnostics`. Search provider configuration for existing AI SDK telemetry settings.

The local diagnostics API accepts arbitrary context and extracts error names/codes. Its redaction is not a strict remote event allowlist. Reusing its output wholesale would violate #195's event contract.

Work:

- Keep the existing stdout/stderr diagnostics behavior and failure isolation.
- Emit remote events from the identified outcome owners with separately constructed finite fields. Keep PostHog imports outside editorial domain logic.
- Leave AI SDK telemetry disabled and preserve provider-storage permission semantics.

Done when existing diagnostics/redaction tests still pass and new payload tests prove raw diagnostic context cannot reach remote events.

## POI 11. Account setup, privacy decisions, and dashboards

These are release prerequisites requiring current account evidence. This plan does not choose a region, promise a retention period, or assert current pricing terms.

Record before release configuration is enabled:

- Production project and isolated test project, regional ingestion/storage location, and approved endpoint.
- Current [PostHog pricing](https://posthog.com/pricing), no-card free-tier behavior, collection limits, and event-volume monitoring. The issue's 600,000 events/month is a planning example, not a forecast.
- SDK metadata plus IP/geolocation enrichment settings. Disable unnecessary enrichment and disclose connection metadata that remains observable by the service.
- Actual retention, authorized maintainers, and a tested deletion procedure. Resolve how an Author can supply the pseudonymous identifier before opt-out removes it, and describe the limitation after it is lost. Do not introduce email/account identity into events.
- A synthetic test event and inspection of the complete stored payload, including PostHog-added fields. Keep credentials and private Article content out of evidence.

| Dashboard | Required definition |
| --- | --- |
| Active/returning installations | Distinct opted-in installation identities in explicit daily/weekly windows; define returning across windows. Session starts alone do not necessarily observe every day of a long-running process. |
| AI outcomes and latency by release | Completed, failed, and cancelled terminal counts; define denominator as observed terminal operations and specify latency statistic/window. Separate outcome series. |
| Proposal acceptance | Accepted divided by accepted plus rejected review events, using the exact review unit selected in POI 5. This is not acceptance of all generated Proposals. |
| Draft checkpoint failures | Sum aggregated failures divided by the corresponding counted attempts, using the selected checkpoint definition. |
| Backup/recovery failures | Failed divided by completed plus failed observed operations, with a stated window and recovery kind where allowed. |

Every chart must state that it describes consenting installations, not people or all beta users. Note identity resets, reinstalls, bounded dropping, opt-out, counters lost on termination, missing terminal events, and incomplete crash coverage.

Done when dashboard queries agree with the shipped schema and the account/disclosure evidence is recorded. Account access or unresolved privacy details can block release configuration without blocking deterministic implementation work.

## POI 12. Canonical documentation and verification

Update only after behavior exists:

- [ADR-004](../architecture/adr-004-local-diagnostics.md) for explicit remote diagnostics alongside preserved local process streams.
- [ADR-008](../architecture/adr-008-loopback-service-trust-boundary.md) for the finite IPC operation and approved network expansion.
- Relevant native Settings/privacy guides and any affected ADR-009 runtime-state statements.
- `product-model/areas/settings.json`, `cross-cutting.json`, and other records selected by product impact. Do not mark a plan as implemented evidence or edit generated inventories directly.

Follow the [testing guide](../guides/testing.md). Extend focused suites near the changed owner; likely starting points include:

- `packages/electron/src/presentation/desktop-settings.backups.test.ts`, `desktop-settings.delete.test.ts`, `desktop-updates.test.ts`, and `preload-bridge.test.ts`.
- `packages/electron/src/application/pending-restore.test.ts`.
- `packages/server/src/presentation/editorial-integration.requests.test.ts` and `editorial-integration.assistant.test.ts`.
- `packages/server/src/infrastructure/electron/electron-ipc-application-adapter.test.ts`.
- `packages/web/src/settings/ApplicationSettings.general.test.tsx` and `ApplicationSettings.updates.test.tsx`.
- `packages/web/src/workspace/EditorialWorkspace.assistant-proposals.test.tsx` and `EditorialWorkspace.persistence.test.tsx`.

Add focused consent/schema/transport tests where no existing owner test exists. Use injected clocks, scheduling, and transport where needed; automated checks must never contact PostHog.

Required evidence:

1. Zero PostHog requests in fresh, upgraded-without-consent, disabled, unconfigured, browser, development, and default test runtimes, including initialization/background activity.
2. Strict validation and private-data absence at both serialized and stored payload boundaries.
3. Exactly one terminal event at the real outcome, including cancellation, incomplete stream, persistence failure, and overlapping service/adapter paths.
4. Consent-save failure and stale runtime-write tests, opt-out/retry/shutdown races, identity reset, and restore isolation.
5. Bounded resources and unchanged editing/save/recovery behavior under transport failures.
6. Focused tests, `npm run lint`, `npm run typecheck`, and `npm run test:e2e` for changed Settings/client journeys. After canonical product edits, run `npm run product:docs` and `npm run product:check`.
7. Packaged Windows acceptance using the [release guide](../guides/mvp-release-and-recovery.md): consent persistence, outbound request and full payload inspection, opt-out during transmission, offline use, and shutdown with a pending Draft checkpoint. Browser E2E is not evidence for Electron networking or preload isolation.

Done when every issue acceptance item has a passing check or an explicitly recorded remaining manual prerequisite. Report environment and results without credentials or private content; do not claim release readiness while required account or packaged checks remain incomplete.

## Implementation sequence

1. Revalidate ownership and product impact; settle event units, consent transitions, and the runtime-write race policy. Exit with an exact event schema and one owner per event.
2. Implement runtime consent and strict shared contracts, then finite IPC. Exit with passing default-off, persistence, validation, and stale-write tests.
3. Implement the main-process lifecycle and PostHog adapter with a fake transport. Exit with bounded-delivery and opt-out-race tests passing.
4. Wire General Settings and the selected outcome owners. Exit with focused Settings and terminal-semantics checks passing.
5. Complete disclosure/account decisions, inspect a synthetic test-project payload, and create dashboards. Keep production configuration disabled until prerequisites are satisfied.
6. Update canonical documentation/product records, run applicable gates once, and perform packaged Windows acceptance. Record remaining manual work separately from automated results.

Keep scope to #195. Self-hosting, custom collectors, Sentry, native crash dumps, replay, AI content tracing, accounts, cross-device identity, feature flags, publication analytics, and autonomous editing/publishing remain excluded.
