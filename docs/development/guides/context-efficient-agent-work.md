# Context-efficient agent work

Use this workflow when a coding task needs broad discovery, changes TypeScript or TSX, or needs more than one verification loop. It reduces repeated context without reducing product, architectural, or verification requirements.

## Workflow

1. **Map the change.** Start with `rg` for the requested behavior, then run `npm run product:impact -- <affected paths>` when changing an existing behavior owner. Find direct callers and imports. Stop once the production owner, its immediate collaborators, and the smallest relevant test are known.
2. **Read only the needed code.** Read ranges around relevant symbols first. Read a complete file only when its full structure is necessary to make the change safely. Stop when the confirmed flow explains every requested acceptance criterion.
3. **Keep a short ledger.** Record the goal, owners, confirmed flow, decisions, checks passed, and remaining work. Replace raw exploration history with this ledger when it is sufficient; start a clean continuation if the old thread no longer helps.
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

Follow [ADR-003](../architecture/adr-003-web-feature-oriented-react-architecture.md): extract a component, hook, helper, or fixture only when it gains an independent caller, test contract, state responsibility, or visual responsibility. Keep a single-use helper with its caller. Follow the [UI design system](../ui/design-system.md) for renderer changes.

### Workspace ownership

| Concern | Owner | Focused tests |
| --- | --- | --- |
| Composition and shortcuts | `EditorialWorkspace.tsx`, `components/WorkspaceScreen.tsx` | `EditorialWorkspace.lifecycle.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
| Article loading, Drafts, Revisions, and persistence | `state/article-workspace-state.ts`, `state/article-revisions-state.ts` | `drafts/draft-lifecycle.test.ts`, `EditorialWorkspace.lifecycle.test.tsx` |
| Assistant requests and stored responses | `state/assistant-messages-state.ts`, `state/editorial-proposal-state.ts` | `EditorialWorkspace.assistant.test.tsx`, `components/assistant/AssistantTimeline.test.tsx` |
| Article header, editor, views, and status bar | `components/ArticleWorkspace.tsx`, `components/WorkspaceViewRouter.tsx` | `EditorialWorkspace.article-controls.test.tsx`, `views/*.test.tsx` |
| Shell, library, tabs, and panel layout | `components/WorkspaceShell.tsx`, `components/ArticleLibraryPanel.tsx`, `components/WorkspaceTabBar.tsx` | matching `components/*.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
