---
name: skladno-product-inventory
description: Preserve and maintain Skladno's user-visible product capabilities and feature inventories while distinguishing implemented, partial, and deferred work. Use before adding, changing, replacing, or removing a Skladno feature, including architectural hooks, reducers, providers, state machines, persistence boundaries, routes, clients, or shared contracts that serve a user-visible capability. Use especially when a change could regress, replace, hide, or narrow an existing capability outside the detailed Settings and Article Workspace guardrails.
---

# Skladno Product Inventory

Use the canonical product-model area that matches the change:

- Read `../../../product-model/areas/application.json` and generated `../../../docs/development/product/application-inventory.md` for application-shell contracts.
- Read `../../../product-model/areas/editorial-workflows.json` and generated `../../../docs/development/product/editorial-workflows-inventory.md` for the assistant, AI operations, proposals, and editorial safety.
- Read `../../../product-model/areas/history-and-publishing.json` and generated `../../../docs/development/product/history-and-publishing-inventory.md` for Revisions, evidence, translations, and publishing preview.
- Read `../../../product-model/areas/cross-cutting.json` and generated `../../../docs/development/product/cross-cutting-inventory.md` for internationalization, accessibility, keyboard control, notifications, privacy, validation, and database lifecycle.

## Registry-owned product areas

Application shell, Article Workspace, Editorial workflows, History and publishing, Cross-cutting, and Settings are registry-owned. Before changing any of those areas:

1. Read its canonical JSON model and generated inventory in `../../../product-model/areas/` and `../../../docs/development/product/`.
2. Optionally run `npm run product:impact -- <changed paths>` to identify capabilities that may be affected. Path matches are guidance, not proof of a product change.
3. Update the canonical model only when capability, status, contract, persistence, or user-visible behavior changes. Then run `npm run product:docs -- <area>` and `npm run product:check`.

Use `automated` evidence only when the referenced check identifies the scenario. Use `human-reviewed` for evidence that requires a person; it is recorded, not mechanically verified.

Do not edit generated inventories by hand. They are evidence for people and agents; the model is authoritative.

## Architectural changes

Invoke this skill before introducing, replacing, or removing a hook, reducer, provider, state machine, persistence boundary, route, client, or shared contract that supports a user-visible capability—even when visible UI copy is unchanged. Identify the affected capability IDs and preserve their state, persistence, error, and recovery contracts before changing the architecture.

## Preserve the baseline

Before changing product code or an inventory:

1. Read every inventory relevant to the touched surface, including the authoritative Settings or Article Workspace inventory when applicable.
2. Treat each existing **Implemented** or **Partial** row as a preservation requirement, not disposable documentation.
3. Inspect the current implementation, contracts, tests, and working-tree diff for those rows. Inventory text alone is not proof that code is present, and the active issue's silence is not permission to remove a capability.
4. List the affected existing capabilities and how the planned change preserves, extends, replaces, or intentionally removes each one.

Prefer additive integration. Keep existing controls, states, persistence behavior, accessibility, and safety boundaries working while adding the new feature. A redesign, refactor, renamed component, or narrower acceptance criterion does not authorize loss of behavior.

## Control feature loss

Do not delete, hide, disable, narrow, or overwrite an existing **Implemented** or **Partial** capability unless the active issue or user explicitly requires that product change. This includes accidental loss caused by replacing a component, route, contract, state model, translation key, or inventory row.

If explicit removal or narrowing is required:

- identify the exact capability and authorizing requirement before editing;
- trace affected UI, shared contracts, persistence, tests, accessibility, and documentation;
- preserve recoverability and all product invariants;
- update rather than silently delete its inventory row, recording the new status and limitation or deferral reason;
- call out the intentional feature loss in the handoff.

If authorization is absent or conflicts with a product invariant, stop and ask rather than infer removal.

## Maintain status accurately

Keep the inventories synchronized with repository evidence. Use **Implemented** only when the complete user-facing flow and contract exist, **Partial** when a concrete limitation remains, and **Deferred** only for intentionally out-of-scope capabilities. Record persistence and safety boundaries, not just UI labels.

Do not downgrade **Implemented** to **Partial** or **Deferred**, delete a row, or rewrite a row so it covers less behavior merely to make an incomplete implementation appear consistent. First preserve or repair the implementation. Change status only when repository evidence shows the prior inventory was inaccurate or an explicitly authorized product decision changed the capability; record the concrete reason in the row.

## Audit before handoff

After implementation:

1. Compare the final diff against the pre-change inventory baseline.
2. Search for removed controls, routes, contracts, tests, messages, and persistence paths related to affected capabilities.
3. Verify every affected baseline capability still has implementation and test evidence, alongside the new behavior.
4. Update inventory rows additively where possible; do not collapse distinct capabilities into a vague row that conceals loss.
5. Report preserved capabilities, intentional status changes, and any verification that remains.

When a change affects Application Settings, also follow the `skladno-settings` workflow and update the canonical model. For the Article Workspace, use the registry-owned model above and the focused visual guidance in `skladno-ui-guardrails`.
