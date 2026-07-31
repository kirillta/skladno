---
name: skladno-settings
description: Implement, review, or repair Skladno Application Settings, including settings UI, local-service routes, persistence, OpenAI configuration, publishing profiles, backups, autosave, and accessibility. Use whenever changing Settings sections or their contracts.
---

# Skladno Settings

Read `references/settings-inventory.md` before changing Settings.

## Workflow

1. Preserve Application Settings as a separate application screen, never a Workspace View.
2. Inspect the client, shared contract, route, repository, migration, and workspace integration before editing.
3. Give every control a visible label, persistent plain-language hint, and `aria-describedby` connection. Do not rely on placeholders or tooltips as instructions.
4. Keep secrets server-side: store only environment-variable names; never return, log, or enumerate values.
5. Persist valid changes through focused settings documents or repositories. Retain invalid local input and explain recovery.
6. Do not simplify an implemented Settings Section while changing another. Update the inventory in the same change.
7. Use semantic Tailwind tokens, the Settings Navigation save-state placement, and the shared thin scrollbar.
8. Run focused tests, typecheck, and lint.
