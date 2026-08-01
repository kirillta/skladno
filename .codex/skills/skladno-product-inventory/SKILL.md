---
name: skladno-product-inventory
description: Maintain Skladno's product feature inventories and distinguish implemented, partial, and deferred capabilities. Use when adding, reviewing, or documenting user-visible Skladno features outside the detailed Settings and Article Workspace guardrails.
---

# Skladno Product Inventory

Use the feature-area reference that matches the change:

- Read `references/application-inventory.md` for the application shell, Article library, and workspace entry points.
- Read `references/editorial-workflows-inventory.md` for the assistant, AI operations, proposals, and editorial safety.
- Read `references/history-and-publishing-inventory.md` for Revisions, evidence, translations, and publishing preview.
- Read `references/cross-cutting-inventory.md` for internationalization, accessibility, keyboard control, notifications, privacy, validation, and database lifecycle.

Keep the inventories synchronized with the repository. Use **Implemented** only when the user-facing flow and contract exist, **Partial** when an explicit limitation remains, and **Deferred** for intentionally out-of-scope MVP capabilities. Record persistence and safety boundaries, not just UI labels.

When a change affects Application Settings or the Article Workspace, also read and update the authoritative references in `skladno-settings` or `skladno-ui-guardrails`.
