# Context-efficient agent work

Use this workflow when a coding task needs broad discovery, changes TypeScript or TSX, or needs more than one verification loop. It reduces repeated context without reducing product, architectural, or verification requirements.

## Workflow

1. **Map the change.** Start with `rg` for the requested behavior, then run `npm run product:impact -- <affected paths>` when changing an existing behavior owner. Find direct callers and imports. Stop once the production owner, its immediate collaborators, and the smallest relevant test are known.
2. **Read only the needed code.** Read ranges around relevant symbols first. Read a complete file only when its full structure is necessary to make the change safely. Stop when the confirmed flow explains every requested acceptance criterion.
3. **Keep a short ledger for multi-step work.** Record the goal, owners, confirmed flow, decisions, checks passed, and remaining work in the working context. Include user constraints and unresolved failures so a continuation can resume without repeating discovery. Create a repository plan only when the task needs a durable handoff.
4. **Make the smallest behavior change.** Run the smallest test that can fail for the requested behavior. Iterate on that check until it passes.
5. **Run broad gates once.** After the focused loop passes, run the checks required by [the testing guide](testing.md) and the affected architecture guidance. Rerun a broad gate only after its failure or a source change that can affect it.
6. **Review the production path.** Before reporting completion, trace each acceptance criterion through its production caller and confirm no direct caller was omitted.

For each command, return either its failing diagnostic or a short success summary. Keep source inspection separate from test execution. Use targeted diff hunks, `git diff --stat`, and `git diff --check`; do not dump complete diffs. Inspect installed dependency source only for a named unresolved question that local types and targeted documentation cannot answer.

This guide complements, rather than repeats, the [testing guide](testing.md), [product-impact instructions](../../../AGENTS.md), and the TypeScript project rules.

## Renderer discovery

For TSX changes, inspect in this order:

1. the owning component or view;
2. its direct state owner or hook;
3. the closest focused test;
4. a shared UI primitive, localization entry, or `application/client.ts` boundary only when the change crosses it;
5. the parent composition root only when wiring changes.

Search symbols and imports before full reads. A `.tsx` file may combine rendering, state, accessibility, localization, and integration wiring; it is not a reason to scan the feature.

Use [ADR-003](../architecture/adr-003-web-feature-oriented-react-architecture.md) to decide whether extraction is warranted and the [UI design system](../ui/design-system.md) for renderer changes.

### Workspace ownership

Paths below are relative to `packages/web/src/workspace`. Use this map as a starting point, then confirm current callers and test paths with `rg`.

| Concern | Owner | Focused tests |
| --- | --- | --- |
| Composition and shortcuts | `EditorialWorkspace.tsx`, `components/WorkspaceScreen.tsx` | `EditorialWorkspace.settings.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
| Article loading, Drafts, Revisions, and persistence | `state/article-workspace-state.ts`, `state/article-workspace-actions.ts`, `state/article-workspace-articles.ts`, `state/article-revisions-state.ts` | `drafts/draft-lifecycle.test.ts`, `EditorialWorkspace.persistence.test.tsx`, `state/article-revisions-state.test.tsx` |
| Article creation and Settings entry | `components/ArticleWorkspace.tsx`, `EditorialWorkspace.tsx` | `EditorialWorkspace.creation.test.tsx`, `EditorialWorkspace.settings.test.tsx` |
| Assistant requests, retries, and stream recovery | `state/assistant-messages-state.ts`, `state/assistant-request-state.ts`, `state/assistant-stream-events-state.ts`, `state/assistant-streaming.ts` | `EditorialWorkspace.assistant-requests.test.tsx`, `EditorialWorkspace.assistant-selection.test.tsx` |
| Assistant composer and stored responses | `components/assistant/AssistantComposer.tsx`, `state/assistant-message-history-state.ts` | `EditorialWorkspace.assistant-composer.test.tsx`, `components/assistant/AssistantTimeline.test.tsx` |
| Proposal generation, summaries, and decisions | `state/editorial-proposal-state.ts`, `state/editorial-proposal-actions.ts`, `state/editorial-proposal-helpers.ts` | `state/editorial-proposal-state.test.ts`, `EditorialWorkspace.assistant-proposals.test.tsx`, `views/ProposalReviewView.test.tsx` |
| Findings and translation results | `state/editorial-results-state.ts` | `views/FactCheckView.test.tsx`, `views/TranslationsView.test.tsx`, `EditorialWorkspace.assistant-proposals.test.tsx` |
| Article header, editor, views, and status bar | `components/ArticleWorkspace.tsx`, `components/WorkspaceViewRouter.tsx` | `EditorialWorkspace.article-controls.test.tsx`, `views/*.test.tsx` |
| Shell, library, tabs, and panel layout | `components/WorkspaceShell.tsx`, `components/ArticleLibraryPanel.tsx`, `components/WorkspaceTabBar.tsx` | matching `components/*.test.tsx`, `EditorialWorkspace.layout.test.tsx` |

### Other focused entry points

Paths below are relative to the named package's `src` directory. Read the focused suite first and its shared test helper only as needed. File extraction does not require a new test for every helper; keep testing the behavior through its existing caller.

| Package and concern | Owner | Focused tests |
| --- | --- | --- |
| Web AI Settings | `settings/use-ai-settings-controller.ts`, `settings/ApplicationSettings.tsx` | `settings/ApplicationSettings.ai-connections.test.tsx`, `settings/ApplicationSettings.ai-connection-management.test.tsx`, `settings/ApplicationSettings.ai-models.test.tsx` |
| Web general Settings, backups, publishing, and updates | `settings/ApplicationSettings.tsx`, matching `settings/components/` section | matching `settings/ApplicationSettings.general.test.tsx`, `settings/ApplicationSettings.backups.test.tsx`, `settings/ApplicationSettings.publishing.test.tsx`, `settings/ApplicationSettings.updates.test.tsx` |
| Web notifications | `notifications/NotificationProvider.tsx`, `notifications/NotificationViewport.tsx`, `notifications/notification-duration.ts` | `notifications/NotificationProvider.behavior.test.tsx`, `notifications/NotificationProvider.errors.test.tsx` |
| Web shared controls | `ui/primitives.tsx` | `ui/primitives.test.tsx` |
| Shared Assistant contracts | `assistant/assistant.ts`, `assistant/assistant-skills.ts`, `assistant/assistant-events.ts` | `assistant/assistant.test.ts` |
| Server Assistant capabilities | `application/assistant/capabilities/` | `application/assistant/capabilities/editorial-capability-catalog.test.ts`, `application/assistant/capabilities/assistant-capability-loop.test.ts` |
| Server editorial integration | `application/editorial/editorial-service.ts`, `application/assistant/assistant-service.ts` | `presentation/editorial-integration.requests.test.ts`, `presentation/editorial-integration.style-translation.test.ts`, `presentation/editorial-integration.findings.test.ts`, `presentation/editorial-integration.assistant.test.ts`, `presentation/editorial-integration.telemetry.test.ts` |
| Server persistence | `infrastructure/persistence/repositories/` | `infrastructure/persistence/repositories.assistant-records.test.ts`, `infrastructure/persistence/repositories.article-lifecycle.test.ts`, `infrastructure/persistence/repositories.storage-and-style.test.ts` |
| Server HTTP presentation | `presentation/routes/` | `presentation/server.article-and-publishing.test.ts`, `presentation/server.general-settings.test.ts`, `presentation/server.ai-connections.test.ts` |
| Electron data Settings | `presentation/settings/desktop-settings.ts` | `presentation/settings/desktop-settings.backups.test.ts`, `presentation/settings/desktop-settings.delete.test.ts` |
