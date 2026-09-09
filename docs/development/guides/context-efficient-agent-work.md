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
4. a shared UI primitive, localization entry, or `application-client` boundary only when the change crosses it;
5. the parent composition root only when wiring changes.

Search symbols and imports before full reads. A `.tsx` file may combine rendering, state, accessibility, localization, and integration wiring; it is not a reason to scan the feature.

Use [ADR-003](../architecture/adr-003-web-feature-oriented-react-architecture.md) to decide whether extraction is warranted and the [UI design system](../ui/design-system.md) for renderer changes.

### Workspace ownership

Paths below are relative to `packages/web/src/workspace`. Use this map as a starting point, then confirm current callers and test paths with `rg`.

| Concern | Owner | Focused tests |
| --- | --- | --- |
| Composition and shortcuts | `EditorialWorkspace.tsx`, `components/WorkspaceScreen.tsx` | `EditorialWorkspace.lifecycle.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
| Article loading, Drafts, Revisions, and persistence | `state/article-workspace-state.ts`, `state/article-revisions-state.ts` | `drafts/draft-lifecycle.test.ts`, `EditorialWorkspace.lifecycle.test.tsx` |
| Assistant requests and stored responses | `state/assistant-messages-state.ts`, `state/editorial-proposal-state.ts` | `EditorialWorkspace.assistant-proposals.test.tsx`, `EditorialWorkspace.assistant-requests.test.tsx`, `EditorialWorkspace.assistant-selection.test.tsx`, `components/assistant/AssistantTimeline.test.tsx` |

### Focused-suite context snapshot

Issue #192 split the largest test suites by behavior. Counts are source lines before and after the split; the representative context column names the focused test and directly shared helper a reader needs.

| Former suite | Before | Focused suites | After | Representative context |
| --- | ---: | --- | --- | --- |
| `server/editorial-integration.test.ts` | 720 | `editorial-integration.requests.test.ts`, `editorial-integration.style-translation.test.ts`, `editorial-integration.findings.test.ts`, `editorial-integration.assistant.test.ts` | 204 / 97 / 92 / 258 | focused suite + `editorial-integration.test-utils.ts` |
| `web/workspace/EditorialWorkspace.assistant.test.tsx` | 660 | `EditorialWorkspace.assistant-proposals.test.tsx`, `EditorialWorkspace.assistant-requests.test.tsx`, `EditorialWorkspace.assistant-selection.test.tsx` | 200 / 307 / 179 | focused suite + `EditorialWorkspace.test-utils.tsx` |
| `server/infrastructure/persistence/repositories.test.ts` | 437 | `repositories.assistant-records.test.ts`, `repositories.article-lifecycle.test.ts`, `repositories.storage-and-style.test.ts` | 176 / 145 / 111 | focused suite + `repositories.test-utils.ts` |
| `web/settings/ApplicationSettings.ai.test.tsx` | 344 | `ApplicationSettings.ai-connections.test.tsx`, `ApplicationSettings.ai-models.test.tsx` | 197 / 163 | focused suite + `ApplicationSettings.test-utils.ts` |
| `server/presentation/server.test.ts` | 306 | `server.article-and-publishing.test.ts`, `server.general-settings.test.ts`, `server.ai-connections.test.ts` | 158 / 95 / 87 | focused suite and its local service setup |
| Article header, editor, views, and status bar | `components/ArticleWorkspace.tsx`, `components/WorkspaceViewRouter.tsx` | `EditorialWorkspace.article-controls.test.tsx`, `views/*.test.tsx` |
| Shell, library, tabs, and panel layout | `components/WorkspaceShell.tsx`, `components/ArticleLibraryPanel.tsx`, `components/WorkspaceTabBar.tsx` | matching `components/*.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
