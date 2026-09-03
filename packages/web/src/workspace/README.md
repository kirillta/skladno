# Workspace ownership map

Start a workspace change at its owning production component and closest test:

| Concern | Owner | Focused tests |
| --- | --- | --- |
| Composition and shortcuts | `EditorialWorkspace.tsx`, `components/WorkspaceScreen.tsx` | `EditorialWorkspace.lifecycle.test.tsx`, `EditorialWorkspace.layout.test.tsx` |
| Article loading, Drafts, Revisions, and persistence | `state/article-workspace-state.ts`, `state/article-revisions-state.ts` | `drafts/draft-lifecycle.test.ts`, `EditorialWorkspace.lifecycle.test.tsx` |
| Assistant requests and stored responses | `state/assistant-messages-state.ts`, `state/editorial-proposal-state.ts` | `EditorialWorkspace.assistant.test.tsx`, `components/assistant/AssistantTimeline.test.tsx` |
| Article header, editor, views, and status bar | `components/ArticleWorkspace.tsx`, `components/WorkspaceViewRouter.tsx` | `EditorialWorkspace.article-controls.test.tsx`, `views/*.test.tsx` |
| Shell, library, tabs, and panel layout | `components/WorkspaceShell.tsx`, `components/ArticleLibraryPanel.tsx`, `components/WorkspaceTabBar.tsx` | matching `components/*.test.tsx`, `EditorialWorkspace.layout.test.tsx` |

`EditorialWorkspaceProvider` composes browser state and routes to Settings; `WorkspaceScreen` owns workspace markup. `App.tsx` owns application-level screen, theme, desktop commands, and renderer startup.

Article edits flow through `ArticleWorkspace` to `useArticleWorkspace`, then through the typed `EditorialWorkspaceClient` in `application-client.ts`; Draft checkpoints remain mutable and Revision promotion remains explicit. Assistant requests originate in `EditorialAssistantPanel`, flow through `useAssistantMessages`, and only completed results update proposal, Finding, or translation state.

Workspace code calls neither server routes nor Electron directly. Cross the renderer boundary through `application-client.ts`; shared contracts live in `@skladno/shared`; Electron access stays behind the renderer bridge and `desktop-client.ts`.

See [ADR-003](../../../../docs/development/architecture/adr-003-web-feature-oriented-react-architecture.md), the [UI design system](../../../../docs/development/ui/design-system.md), and the [testing guide](../../../../docs/development/guides/testing.md) for the rules and commands.
