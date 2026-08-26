---
name: skladno-ui-guardrails
description: Preserve the established visual system and interaction hierarchy when changing Skladno's React/Tailwind user interface. Use for Settings, the workspace, its panels and controls, responsive states, or any UI redesign and visual regression fix.
---

# Skladno UI Guardrails

Read `docs/development/ui/design-system.md`, the changed component and tests, and only the matching focused reference:

- [Article Library Panel and Navigation Rail](references/article-library-panel.md)
- [Editorial Assistant Panel](references/editorial-assistant-panel.md)
- [Article Workspace](references/article-workspace.md)
- [Settings](references/settings.md)

Reuse semantic tokens and existing primitives. Preserve controls, copy, keyboard access, accessible names, focus, non-color cues, persistence, and responsive states. Keep the Article-centered hierarchy in workspace changes. Do not remove or narrow a capability without explicit authorization.

Inspect the rendered desktop and affected collapsed/responsive states when available. Run focused tests and typecheck.
