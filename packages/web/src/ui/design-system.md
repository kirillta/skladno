# Skladno UI foundation

Use the semantic tokens in `styles.css`; feature code must not introduce palette, radius, focus, or elevation values. The paired system UI stack does not require a downloaded font. Article content uses the editorial serif stack.

## Control states

`Button`, `Field`, and `TextareaField` accept `default`, `loading`, `success`, `warning`, `error`, `outdated`, and `conflicted` states. Use `Status` or `Banner` for visible status text and an icon; never present a state using color alone.

Buttons expose default, hover, focus, active, disabled, and loading behavior. The semantic state variants add a solid success/warning/error border, a dashed outdated border, or a double conflicted border so the meaning survives color loss.

Use `TabList` and `Tab` for tab selection, `Progress` for streaming work, `Skeleton` while content is loading, `EmptyState` for an intentionally blank area, and `Dialog` or `Drawer` for a temporary focused task. `Tooltip` supplements, rather than replaces, an accessible label. Use `Diff` for review changes so additions and removals have text labels as well as distinct striped patterns.

## Accessibility baseline

- `--color-ink` on canvas and surface, white on brand, and all semantic status foreground/background pairs are selected for WCAG AA normal-text contrast.
- All focusable controls have a persistent two-pixel focus indicator plus a three-pixel focus halo.
- Controls have a minimum 36px target; use 44px for sparse icon-only actions where space allows.
- Diff additions/removals include `ins`/`del` semantics and striped backgrounds; status components include an icon and visible label text.
- Motion is suppressed for people who request reduced motion.

Check contrast again whenever a token changes, especially for citations and status copy.

## Application workspace

The desktop shell has a compact document-navigation panel, a central writing surface, and an assistant panel. Treat the article as the visual and keyboard-order center. Navigation and assistant panels may collapse independently; focus mode collapses both. Persist only panel and layout preferences locally, never in document history.

At 1440 × 1024 and 1280 × 800, preserve a comfortable editorial line length before showing secondary content. Use tabs, collapse, or drawers for supporting work rather than permanently narrowing the editor.

## Workspace tabs

Use accessible tabs for Editor, Diff, Version History, Fact Check, Style Profile, Translations, and Publish. Set `aria-selected` on the active tab and make keyboard focus visible. Use compact badges only for actionable or stale content; the badge text must name the condition.

## Editorial operations

Before a network operation, show the saved revision being reviewed and describe the minimum author context that will be sent. Streaming progress must be announced through a polite live region without moving focus. Provide explicit stop and retry controls.

Generated text is always a proposal. It must remain visibly distinct from the current article and never enter the editor until the author explicitly accepts it. Cancellation, failure, malformed output, and retry must leave article text and revision history unchanged.

## Diff and revision history

Show changes in labeled, keyboard-operable blocks. Pair addition/removal semantics and patterns with text labels; color is supplementary only. State whether each block is pending, accepted, or rejected.

Do not permit partial application of a proposal whose base revision is stale. Explain that it was based on an older revision and offer regeneration or whole-proposal review as appropriate. Show revision provenance, time, and preview in chronological history. Restoring must require confirmation and explain that it creates a new immutable revision without deleting later history.

## Advisory findings

Fact-check and style-review output is advisory. Tie fact-check findings to the reviewed revision and show claim, plain-language status, rationale, uncertainty, source quality, date when available, and keyboard-reachable citation links. Missing evidence is never verification.

Style Profile views identify only local samples and the compact traits derived from them. Keep raw corpus content local. Explain when no profile is available, and route any proposed correction or style revision through the normal proposal review flow.

## Derived documents and publishing

Translations are independent linked documents with their own histories. Show source language, source revision, protected-span validation notes, and a stale-source warning when the source has changed; never synchronize or alter translation text automatically.

Publishing previews are deterministic plain text. Profiles provide configurable guidance, not a hard block: show count, remaining or overflow, and the exact text that Copy plain text transfers. State that copying is explicit and destination formatting may differ. Publishing preview remains available when AI features are unavailable.
