# Skladno UI foundation

Use the semantic tokens in `styles.css` and the shared components in `packages/web/src/ui/primitives.tsx`. Feature code must not introduce raw palette, radius, focus, elevation, font-size, or tracking values.

The [visual atlas](visual-atlas.md) maps typography, color, and visual roles to the token layer. `styles.css` owns token values. Add a genuinely new role to both before using it.

## Components and feedback

Reuse the shared primitives for controls, status, loading, empty states, tabs, temporary focused tasks, and diffs. Preserve their accessible names, keyboard behavior, loading behavior, reduced-motion treatment, and non-color state cues.

Use application popup notifications for cross-screen outcomes and background actions. Keep validation and workflow feedback beside the operation that produced it. Notifications do not move focus; use `status` for informational or successful outcomes and `alert` for warnings or errors.

## Accessibility

- Resolve application-owned visible and accessible copy through the typed ICU catalog; never use translated text as logic or persisted values.
- Give every focusable control a visible focus indicator, every icon-only control an accessible name, and every status a visible non-color cue.
- Keep controls at least 36px; use 44px for sparse icon-only actions where space allows.
- Connect persistent help to its control with `aria-describedby`; tooltips supplement rather than replace labels or essential instructions.
- Recheck WCAG AA contrast whenever a token changes.

## Workspace hierarchy

Keep the Article as the visual and keyboard-order center. Navigation and assistant surfaces are secondary and may collapse; responsive layouts must preserve a comfortable editorial line length rather than permanently narrowing the editor.

Use the established supporting surface, alignment, and quiet scrollbar treatments across workspace regions. Keep intentional empty areas quiet, use real UI icons rather than unrelated glyphs or emojis, and preserve existing controls and responsive states.

## Canonical feature guidance

Feature behavior belongs in the canonical records rather than this visual foundation:

- [`product-model/areas`](../../../product-model/areas) records capabilities and contracts.
- The UI guardrail references define the [Article Library Panel and Navigation Rail](../../../.codex/skills/skladno-ui-guardrails/references/article-library-panel.md) and [Editorial Assistant Panel](../../../.codex/skills/skladno-ui-guardrails/references/editorial-assistant-panel.md).
- Generated inventories in [`docs/development/product`](../product) summarize the product model and must not be edited directly.
