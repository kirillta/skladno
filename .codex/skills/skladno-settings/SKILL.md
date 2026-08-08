---
name: skladno-settings
description: Implement, review, or repair Skladno Application Settings, including settings UI, local-service routes, persistence, OpenAI configuration, publishing profiles, backups, autosave, and accessibility. Use whenever changing Settings sections or their contracts.
---

# Skladno Settings

Read `../../../product-model/areas/settings.json` and generated `../../../docs/settings-inventory.md` before changing Settings. Update the canonical model, then run `npm run product:docs` and `npm run product:check` when a Settings capability or contract changes.

## Workflow

1. Treat every implemented or partial capability in `../../../product-model/areas/settings.json` as a preservation requirement. Before editing, identify the affected settings capabilities and how the change preserves, extends, replaces, or intentionally removes each one.
2. Preserve Application Settings as a separate application screen, never a Workspace View.
3. Inspect the client, shared contract, route, repository, migration, workspace integration, tests, and working-tree diff before editing.
4. Give every control a visible label, persistent plain-language hint, and `aria-describedby` connection. Do not rely on placeholders or tooltips as instructions.
5. Keep secrets server-side: store only environment-variable names; never return, log, or enumerate values.
6. Persist valid changes through focused settings documents or repositories. Retain invalid local input and explain recovery.
7. Do not delete, hide, disable, narrow, or overwrite an existing Settings capability unless the active issue or user explicitly requires it. Silence in the active issue, a redesign, or replacement of a section is not authorization for feature loss. If authorization is absent, stop and ask.
8. When removal or narrowing is explicitly authorized, trace the affected UI, shared contracts, routes, persistence, migrations, tests, accessibility, and documentation. Update rather than silently delete the inventory row, record the concrete limitation or status change, and call out the intentional feature loss in the handoff.
9. Use semantic Tailwind tokens, the Settings Navigation save-state placement, and the shared thin scrollbar.
10. Before handoff, compare the final diff with the inventory baseline and verify that unrelated Settings Sections and every affected baseline capability still work. Update the inventory in the same change without downgrading status merely to match an incomplete implementation.
11. Run focused tests, typecheck, and lint.
