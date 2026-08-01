# Skladno UI foundation

Use the semantic tokens in `styles.css`; feature code must not introduce palette, radius, focus, or elevation values. The paired system UI stack does not require a downloaded font. Article content uses the editorial serif stack.

The complete typography and color reference is the [visual atlas](visual-atlas.md). Treat its named roles and semantic tokens as the allowed application vocabulary. When a new role is genuinely needed, add it to the atlas and token layer before using it in feature code.

## Control states

`Button`, `Field`, and `TextareaField` accept `default`, `loading`, `success`, `warning`, `error`, `outdated`, and `conflicted` states. Use `Status` or `Banner` for visible status text and an icon; never present a state using color alone.

Buttons expose default, hover, focus, active, disabled, and loading behavior. The semantic state variants add a solid success/warning/error border, a dashed outdated border, or a double conflicted border so the meaning survives color loss.

## Popup notifications

Use application-level popup notifications for cross-screen outcomes and background actions. Use the `useNotifications` hook within the application notification provider; callers must provide localized title, message, and action text. `notifyError` maps local-service failures through the existing localized error catalog and never presents raw unknown error details.

Informational and successful notifications dismiss after six seconds. Warnings and errors remain until the author dismisses them. A popup may expose one optional action and always exposes a keyboard-accessible dismiss control. The visible stack is limited to three items; additional notifications wait in order. Timers pause while a popup is hovered, focused, or the application is hidden.

Popups do not move focus and use `status` for informational/success content and `alert` for warnings/errors. Use visible icon, title, and text alongside semantic color. Keep them out of document flow above the supporting workspace surfaces.

Do not use popup notifications for field validation or contextual workflow state. Editorial Assistant request, streaming, cancellation, retry, and composer-validation feedback stays inside the Editorial Assistant Panel so the author can resolve it where the operation occurred. Reserve a global popup for assistant-originated failures only when they affect the application beyond that request.

Use `TabList` and `Tab` for tab selection, `Progress` for streaming work, `Skeleton` while content is loading, `EmptyState` for an intentionally blank area, and `Dialog` or `Drawer` for a temporary focused task. `Tooltip` supplements, rather than replaces, an accessible label. Use `Diff` for review changes so additions and removals have text labels as well as distinct striped patterns.

## Accessibility baseline

Application-owned visible and accessible copy resolves through the typed ICU catalog. Use semantic message IDs, complete accessible-label messages, named parameters, and shared number/date formatting; never use translated text as logic, selectors, or persisted values.

- `--color-ink` on canvas and surface, white on brand, and all semantic status foreground/background pairs are selected for WCAG AA normal-text contrast.
- All focusable controls have a persistent two-pixel focus indicator plus a three-pixel focus halo.
- Controls have a minimum 36px target; use 44px for sparse icon-only actions where space allows.
- Diff additions/removals include `ins`/`del` semantics and striped backgrounds; status components include an icon and visible label text.
- Motion is suppressed for people who request reduced motion.

Check contrast again whenever a token changes, especially for citations and status copy.

## Application workspace

The desktop shell has an Article Library Panel, an Article Workspace with a central writing surface, and an Editorial Assistant Panel. Treat the Article as the visual and keyboard-order center. Navigation and assistant panels may collapse independently; focus mode collapses both. Persist only panel and layout preferences locally, never in Article Revision history.

At 1440 × 1024 and 1280 × 800, preserve a comfortable editorial line length before showing secondary content. Use tabs, collapse, or drawers for supporting work rather than permanently narrowing the editor.

## Application Settings

Application Settings is a separate application screen, never a Workspace View or Workspace Tab Bar item. Its desktop navigation is a `w-52` supporting surface with a Back to workspace action; the central settings content is constrained to `max-w-3xl` and is the only scrolling area. Do not show the Editorial Assistant Panel there. Narrow layouts use an accessible section selector and compact Back action.

Use `bg-surface-supporting` for Settings Navigation, the Article Library Panel, and the Editorial Assistant Panel. This slightly darker shared surface elevates the supporting areas above the main workspace without changing their borders or control states.

Each setting needs a visible label, persistent author-centered hint, control, and save or validation status. Connect each control to its help with `aria-describedby`; essential explanation never belongs only in a tooltip. Appearance selection persists without changing visual tokens until the dedicated theme work lands.

Key bindings are local application preferences. Show each command's current platform-aware shortcut with an accessible recording control, clear action, and reset-to-default action. A conflicting shortcut must remain unsaved and identify the command that already owns it. Settings defines bindings and the dispatcher; connecting bindings to workspace actions is a separate task.

## Article Library Panel and Navigation Rail

The expanded Article Library Panel is a narrow, full-height (`w-52`) supporting surface. Its header and collapsed Navigation Rail header share a `min-h-18` height so product identity and controls remain vertically aligned across modes. Use the Skladno wordmark in the expanded header and an `S` in the same UI font, size, weight, and brand color in the Navigation Rail.

Keep search in a dedicated bordered row. It uses a compact search control (`min-h-9`, `py-1.5`, `pl-8`, `pr-2`) with a search icon. Show the `Recent` label only when the Article library contains Articles. When the library is empty, leave the panel content area quiet; the Article Workspace supplies the create-Article empty state.

Each Article entry includes a document icon, title, detail line, and selected-state card. Keep the expanded utility area ordered as Style Profile, Settings, then language/local and save state. Align utility icons and captions to the left.

The collapsed Navigation Rail uses `w-10`, keeps Style Profile and Settings as labeled icon-only controls at the bottom, and retains an accessible semantic save-state dot. Icon-only controls require at least a 36px target and an accessible label. Do not replace UI icons with unrelated glyphs or emojis.

## Workspace tabs

Use accessible tabs for Write, Proposal Review, Revisions, Fact Check, Style Profile, Translations, and Publish. Each tab requires a stable ID, `aria-controls`, matching tab panel, and Arrow/Home/End keyboard navigation. Use compact badges only for actionable or stale content; the badge text must name the condition.

## Article formatting

The Write view uses a WYSIWYG Markdown editor. Article content is persisted as the supported Markdown subset, never HTML or editor JSON. Keep its compact formatting toolbar directly beneath the Workspace Tab Bar and above the scrolling writing surface; it has the accessible name “Article formatting”, keyboard Arrow/Home/End navigation, and visible pressed states. It may scroll horizontally at constrained widths. The supported subset is paragraphs, headings, bold, italic, strikethrough, links, quotes, nested lists, inline and fenced code, and line breaks. Images, media, attachments, embeds, tables, task lists, raw HTML, and Word-only styles remain excluded.

## Editorial operations

Before a network operation, show the saved revision being reviewed and describe the minimum author context that will be sent. Streaming progress must be announced through a polite live region without moving focus. Provide explicit stop and retry controls.

Generated text is always a proposal. It must remain visibly distinct from the current article and never enter the editor until the author explicitly accepts it. Cancellation, failure, malformed output, and retry must leave article text and revision history unchanged.

## Diff and revision history

Show changes in labeled, keyboard-operable blocks. Pair addition/removal semantics and patterns with text labels; color is supplementary only. State whether each block is pending, accepted, or rejected.

Do not permit partial application of a proposal whose base revision is stale. Explain that it was based on an older revision and offer regeneration or whole-proposal review as appropriate. Show revision provenance, time, and preview in chronological history. Restoring must require confirmation and explain that it creates a new immutable revision without deleting later history.

## Advisory findings

Fact-check and style-review output is advisory. Tie fact-check findings to the reviewed revision and show claim, plain-language status, rationale, uncertainty, source quality, date when available, and keyboard-reachable citation links. Missing evidence is never verification.

Style Profile views identify only local samples and the compact traits derived from them. Keep raw corpus content local. Explain when no profile is available, and route any proposed correction or style revision through the normal proposal review flow.

## Derived Articles and publishing

Translations are independent linked Articles with their own Revisions. Show source language, source Revision, protected-span validation notes, and a stale-source warning when the source has changed; never synchronize or alter translation text automatically.

Publishing previews are deterministic plain text. Profiles provide configurable guidance, not a hard block: show count, remaining or overflow, and the exact text that Copy plain text transfers. State that copying is explicit and destination formatting may differ. Publishing preview remains available when AI features are unavailable.
