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
