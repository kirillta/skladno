---
name: skladno-ui-guardrails
description: Preserve the established visual system and interaction hierarchy when changing Skladno's React/Tailwind user interface. Use for Skladno workspace, Article Library Panel, Navigation Rail, Editorial Assistant Panel, controls, responsive states, or any UI redesign and visual regression fix.
---

# Skladno UI Guardrails

Read `docs/development/ui/design-system.md`, the changed component and tests, and only the matching focused reference:

- [Article Library Panel and Navigation Rail](references/article-library-panel.md)
- [Editorial Assistant Panel](references/editorial-assistant-panel.md)
- [Article Workspace](references/article-workspace.md)

Run `npm run product:impact -- <affected paths>`; do not also load the full Article Workspace model or generated inventory unless routing is insufficient.

Reuse semantic tokens and existing primitives. Preserve controls, copy, keyboard access, accessible names, focus, non-color cues, persistence, responsive states, and the Article-centered hierarchy. Do not remove or narrow a capability without explicit authorization.

Inspect the rendered desktop and affected collapsed/responsive states when available. Run focused tests and typecheck; update the product model and run product docs/check only when behavior or its contract changed.
