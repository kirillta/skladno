---
name: skladno-ui-guardrails
description: Preserve the established visual system and interaction hierarchy when changing Skladno's React/Tailwind user interface. Use for Skladno workspace, Article Library Panel, Navigation Rail, Editorial Assistant Panel, controls, responsive states, or any UI redesign and visual regression fix.
---

# Skladno UI Guardrails

Keep Skladno’s editorial workspace visually stable while extending it. Treat existing design decisions as contracts unless the user explicitly asks to revise them.

## Required workflow

1. Read the repository `AGENTS.md`, `packages/web/src/ui/design-system.md`, relevant UI primitives, and the component being changed.
2. Inspect the current rendered state before editing. Use the collaborative preview for desktop and collapsed-panel states when present.
3. Reuse semantic Tailwind tokens and existing primitives. Do not introduce raw colors, radius, focus, elevation, or a parallel CSS layer.
4. Preserve labels, keyboard access, accessible names, focus treatment, and non-color state cues while changing appearance.
5. Run the narrowest relevant tests and typecheck. Visually inspect every changed responsive or collapsed state before handoff.

Read [references/article-workspace-inventory.md](references/article-workspace-inventory.md) before changing the Article Workspace, Article Header, Workspace Tab Bar, Workspace View, or Article Status Bar. Update the inventory in the same change when an implemented workspace feature or contract changes.

## Decision rules

- Keep the Article as the visual center; navigation and assistant areas stay secondary.
- Preserve alignment across expanded and collapsed states. Match header and footer heights, baseline positions, padding rhythms, and control rows.
- Use actual UI icons or inline SVGs with accessible labels; do not substitute unrelated glyphs or emojis.
- Keep intentional empty areas quiet. Do not add duplicate hints, section headings, or controls when there is no content to organize.
- Use sentence case for visible button captions and their accessible labels: capitalize only the first word and proper nouns. Workspace view and panel names may remain title case.
- Use `w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl` as the default width for focused dialogs. This gives dialogs a comfortable 48rem desktop width while preserving 1rem viewport margins on narrow screens; deviate only when the task requires a deliberately compact or wider dialog.
- Empty-state titles use regular-weight muted hint text, never strong or heading styling. Add extra top space only where the surrounding workspace needs it; for the empty Article Workspace, keep the create action comfortably below the workspace top rather than changing every empty state's vertical rhythm.
- Keep the desktop Editorial Workspace at the viewport height. The Article Workspace, Article Library Panel, and Editorial Assistant Panel stretch to that height; scroll only their designated internal content regions, never the page shell.
- The Article Status Bar is always visible at the bottom of the Article Workspace. Keep it a compact fixed 24px row; it must not absorb spare vertical space or be pushed beneath the viewport.
- The writing surface is a white (`bg-surface-raised`) worksheet within the subtly tinted workspace canvas. Constrain its document column and keep long drafts scrolling inside the editor rather than changing the shell height.
- The Workspace View owns the Article Editor's vertical scrolling so its scrollbar sits flush with the Assistant Panel divider, never inset beside the constrained document column. Keep it quiet: a slim `w-2` track with no arrow buttons, a transparent track, and a rounded `bg-border-strong` thumb.
- Make actionable UI controls functional. Route existing actions through the established application state; do not leave dead buttons.
- Use the current UI font for product identity text. Do not switch font families between expanded and collapsed representations of the same label.

## Focused references

Read [references/article-library-panel.md](references/article-library-panel.md) before changing the Article Library Panel or Navigation Rail.

Read [references/editorial-assistant-panel.md](references/editorial-assistant-panel.md) before changing the Editorial Assistant Panel, its composer, Quick actions, or target-language flow.
